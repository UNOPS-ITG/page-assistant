import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ANIMATION_CONFIG, ROTATION_LIMITS } from './constants';
import type { ArmRestData, AssistantState, BoneRefs, LookTarget, PointAtTarget } from './types';

interface BoneOverrideControllerProps {
  boneRefs: React.RefObject<BoneRefs>;
  lookTarget: React.RefObject<LookTarget>;
  currentState: React.RefObject<AssistantState>;
  cursorTracking: React.RefObject<{ ndcX: number; ndcY: number; screenX: number; screenY: number }>;
  groupRef: React.RefObject<THREE.Group | null>;
  pointAtTarget: React.RefObject<PointAtTarget | null>;
  armRestData: React.RefObject<ArmRestData>;
  isSpeaking: React.RefObject<boolean>;
  maxArmIkAngle: number;
}

const _eye = new THREE.Vector3();
const _charNdc = new THREE.Vector3();

const _shoulderPos = new THREE.Vector3();
const _elbowPos = new THREE.Vector3();
const _desiredDir = new THREE.Vector3();
const _currentDir = new THREE.Vector3();
const _armWorldQuat = new THREE.Quaternion();
const _desiredWorldQuat = new THREE.Quaternion();
const _parentWorldQuat = new THREE.Quaternion();
const _aimRotation = new THREE.Quaternion();
const _savedArmQuat = new THREE.Quaternion();
const _savedForearmQuat = new THREE.Quaternion();
const _clampAxis = new THREE.Vector3();
const _postShoulderPos = new THREE.Vector3();
const _postElbowPos = new THREE.Vector3();
const _postArmDir = new THREE.Vector3();
const _correctedDir = new THREE.Vector3();
const _correctionRot = new THREE.Quaternion();

const MIN_CROSS_BODY_DOT = 0.3;

function computeArmIK(
  armBone: THREE.Bone | null,
  forearmBone: THREE.Bone | null,
  armRestQuat: THREE.Quaternion,
  forearmRestQuat: THREE.Quaternion,
  target: { worldX: number; worldY: number; worldZ: number },
  outAimQuat: THREE.Quaternion,
  isRightArm: boolean,
  bodyRotationY: number,
  maxIkAngle: number,
): boolean {
  if (!armBone?.parent || !forearmBone) return false;

  _savedArmQuat.copy(armBone.quaternion);
  _savedForearmQuat.copy(forearmBone.quaternion);

  armBone.quaternion.copy(armRestQuat);
  forearmBone.quaternion.copy(forearmRestQuat);
  armBone.updateWorldMatrix(true, false);
  forearmBone.updateWorldMatrix(true, false);

  armBone.getWorldPosition(_shoulderPos);
  forearmBone.getWorldPosition(_elbowPos);

  _currentDir.copy(_elbowPos).sub(_shoulderPos);
  _desiredDir.set(target.worldX, target.worldY, target.worldZ).sub(_shoulderPos);

  const valid = _currentDir.lengthSq() > 0.0001 && _desiredDir.lengthSq() > 0.0001;
  if (valid) {
    _currentDir.normalize();
    _desiredDir.normalize();

    const localPlusX_X = Math.cos(bodyRotationY);
    const localPlusX_Z = -Math.sin(bodyRotationY);
    const outX = isRightArm ? -localPlusX_X : localPlusX_X;
    const outZ = isRightArm ? -localPlusX_Z : localPlusX_Z;
    const outDot = _desiredDir.x * outX + _desiredDir.z * outZ;

    if (outDot < MIN_CROSS_BODY_DOT) {
      _desiredDir.x += (MIN_CROSS_BODY_DOT - outDot) * outX;
      _desiredDir.z += (MIN_CROSS_BODY_DOT - outDot) * outZ;
      if (_desiredDir.lengthSq() < 0.0001) {
        armBone.quaternion.copy(_savedArmQuat);
        forearmBone.quaternion.copy(_savedForearmQuat);
        return false;
      }
      _desiredDir.normalize();
    }

    const ikAngle = _currentDir.angleTo(_desiredDir);
    if (ikAngle > maxIkAngle) {
      _clampAxis.crossVectors(_currentDir, _desiredDir);
      if (_clampAxis.lengthSq() > 0.0001) {
        _clampAxis.normalize();
        _desiredDir.copy(_currentDir).applyAxisAngle(_clampAxis, maxIkAngle);
      }
    }

    _aimRotation.setFromUnitVectors(_currentDir, _desiredDir);

    armBone.getWorldQuaternion(_armWorldQuat);
    _desiredWorldQuat.copy(_aimRotation).multiply(_armWorldQuat);

    armBone.parent.getWorldQuaternion(_parentWorldQuat);
    outAimQuat.copy(_parentWorldQuat).invert().multiply(_desiredWorldQuat);
  }

  armBone.quaternion.copy(_savedArmQuat);
  forearmBone.quaternion.copy(_savedForearmQuat);

  return valid;
}

function applyLookRotation(
  bone: THREE.Bone | null,
  targetY: number,
  targetX: number,
  lerpFactor: number,
) {
  if (!bone) return;
  bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, targetY, lerpFactor);
  bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, targetX, lerpFactor);
}

const ARM_SIDE_BASE_DOT = 0.12;
const ARM_SIDE_DOWN_DOT = 0.30;
const _enfWorldQuat = new THREE.Quaternion();
const _enfParentInv = new THREE.Quaternion();

function enforceArmSide(
  armBone: THREE.Bone | null,
  forearmBone: THREE.Bone | null,
  isRightArm: boolean,
  localPlusX_X: number,
  localPlusX_Z: number,
) {
  if (!armBone || !forearmBone) return;

  armBone.updateWorldMatrix(true, false);
  forearmBone.updateWorldMatrix(true, false);
  armBone.getWorldPosition(_postShoulderPos);
  forearmBone.getWorldPosition(_postElbowPos);
  _postArmDir.subVectors(_postElbowPos, _postShoulderPos);
  if (_postArmDir.lengthSq() < 0.0001) return;
  _postArmDir.normalize();

  const outX = isRightArm ? -localPlusX_X : localPlusX_X;
  const outZ = isRightArm ? -localPlusX_Z : localPlusX_Z;

  const downwardness = Math.max(0, -_postArmDir.y);
  const threshold = ARM_SIDE_BASE_DOT + ARM_SIDE_DOWN_DOT * downwardness;

  const outDot = _postArmDir.x * outX + _postArmDir.z * outZ;
  if (outDot >= threshold) return;

  _correctedDir.copy(_postArmDir);
  _correctedDir.x += (threshold - outDot) * outX;
  _correctedDir.z += (threshold - outDot) * outZ;
  if (_correctedDir.lengthSq() < 0.0001) return;
  _correctedDir.normalize();

  _correctionRot.setFromUnitVectors(_postArmDir, _correctedDir);

  armBone.getWorldQuaternion(_enfWorldQuat);
  _correctionRot.multiply(_enfWorldQuat);

  _enfParentInv.identity();
  if (armBone.parent) {
    armBone.parent.getWorldQuaternion(_enfParentInv);
    _enfParentInv.invert();
  }
  armBone.quaternion.copy(_enfParentInv.multiply(_correctionRot));
}

const FINGER_CURL_ANGLE = Math.PI * 0.45;
const ENFORCE_ARM_SIDE_THRESHOLD = 0.15;
const ARM_OVERRIDE_CUTOFF = 0.03;

interface HandFingerBones {
  index: THREE.Bone[];
  curl: THREE.Bone[];
  restRotations: Map<THREE.Bone, THREE.Euler>;
}

function collectFingerBones(forearmBone: THREE.Bone | null): HandFingerBones | null {
  if (!forearmBone) return null;
  const index: THREE.Bone[] = [];
  const curl: THREE.Bone[] = [];
  const restRotations = new Map<THREE.Bone, THREE.Euler>();
  forearmBone.traverse((node) => {
    if (!(node as THREE.Bone).isBone) return;
    const n = node.name.toLowerCase();
    if (n.includes('index')) {
      index.push(node as THREE.Bone);
      restRotations.set(node as THREE.Bone, (node as THREE.Bone).rotation.clone());
    } else if (n.includes('middle') || n.includes('ring') || n.includes('pinky')) {
      curl.push(node as THREE.Bone);
      restRotations.set(node as THREE.Bone, (node as THREE.Bone).rotation.clone());
    }
  });
  if (curl.length === 0) return null;
  return { index, curl, restRotations };
}

function applyPointingFingers(
  fingers: HandFingerBones,
  blend: number,
) {
  for (const bone of fingers.curl) {
    bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, FINGER_CURL_ANGLE, blend);
  }
  for (const bone of fingers.index) {
    bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, 0, blend);
    bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, 0, blend);
    bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, 0, blend);
  }
}

function resetFingerBones(fingers: HandFingerBones) {
  for (const bone of [...fingers.curl, ...fingers.index]) {
    const rest = fingers.restRotations.get(bone);
    if (rest) bone.rotation.copy(rest);
  }
}

const JAW_OPEN_ANGLE = 0.18;
const JAW_SMOOTH_SPEED = 12;

export function BoneOverrideController({
  boneRefs,
  lookTarget,
  currentState,
  cursorTracking,
  groupRef,
  pointAtTarget,
  armRestData,
  isSpeaking,
  maxArmIkAngle,
}: BoneOverrideControllerProps) {
  const { camera, gl } = useThree();
  const leftBlendRef = useRef(0);
  const rightBlendRef = useRef(0);
  const leftAimRef = useRef(new THREE.Quaternion());
  const rightAimRef = useRef(new THREE.Quaternion());
  const leftFingersRef = useRef<HandFingerBones | null | undefined>(undefined);
  const rightFingersRef = useRef<HandFingerBones | null | undefined>(undefined);
  const leftWasOverridingRef = useRef(false);
  const rightWasOverridingRef = useRef(false);
  const jawTimeRef = useRef(0);
  const jawTargetRef = useRef(0);
  const jawCurrentRef = useRef(0);
  const jawPhaseRef = useRef(0);
  const jawNextFlipRef = useRef(0);

  useFrame((_, delta) => {
    const bones = boneRefs.current;
    if (!bones) return;

    const look = lookTarget.current ?? { mode: 'forward' as const };
    let ndcX = 0;
    let ndcY = 0;
    if (look.mode === 'cursor') {
      const cursor = cursorTracking.current;
      const rect = gl.domElement.getBoundingClientRect();
      ndcX = rect.width > 0 ? ((cursor?.screenX ?? rect.left + rect.width / 2) - rect.left) / rect.width * 2 - 1 : 0;
      ndcY = rect.height > 0 ? -(((cursor?.screenY ?? rect.top + rect.height / 2) - rect.top) / rect.height) * 2 + 1 : 0;

      if (groupRef.current) {
        groupRef.current.getWorldPosition(_charNdc);
      }
      if (bones.head) {
        bones.head.updateWorldMatrix(true, false);
        bones.head.getWorldPosition(_eye);
        _charNdc.y = _eye.y;
        _charNdc.z = _eye.z;
      }
      _charNdc.project(camera);
      ndcX = THREE.MathUtils.clamp(ndcX - _charNdc.x, -1, 1);
      ndcY = THREE.MathUtils.clamp(ndcY - _charNdc.y, -1, 1);
    } else if (look.mode === 'element') {
      ndcX = look.ndcX ?? 0;
      ndcY = look.ndcY ?? 0;
    }

    const state = currentState.current;
    const isWalking = state === 'walking';
    const headY = isWalking ? 0 : ndcX * ROTATION_LIMITS.HEAD_TURN;
    const headX = isWalking ? 0 : -ndcY * ROTATION_LIMITS.HEAD_TILT;
    const lf = ANIMATION_CONFIG.CURSOR_LERP_FACTOR;

    applyLookRotation(bones.head, headY, headX, lf);
    applyLookRotation(
      bones.neck,
      headY * ROTATION_LIMITS.NECK_FACTOR,
      headX * ROTATION_LIMITS.NECK_FACTOR,
      lf,
    );
    applyLookRotation(
      bones.spine,
      headY * ROTATION_LIMITS.SPINE_FACTOR,
      headX * ROTATION_LIMITS.SPINE_FACTOR,
      lf,
    );

    // --- Procedural arm pointing override ---
    const pointAt = pointAtTarget.current;
    const restData = armRestData.current;
    const isPointingAt = state === 'pointingAt';
    const wantLeft = isPointingAt && pointAt?.arm === 'left';
    const wantRight = isPointingAt && pointAt?.arm === 'right';

    const inSpeed = ROTATION_LIMITS.ARM_BLEND_SPEED;
    const outSpeed = ROTATION_LIMITS.ARM_BLEND_SPEED * 1.5;

    leftBlendRef.current += ((wantLeft ? 1 : 0) - leftBlendRef.current)
      * (1 - Math.exp(-(wantLeft ? inSpeed : outSpeed) * delta));
    rightBlendRef.current += ((wantRight ? 1 : 0) - rightBlendRef.current)
      * (1 - Math.exp(-(wantRight ? inSpeed : outSpeed) * delta));

    if (!wantLeft && leftBlendRef.current < ARM_OVERRIDE_CUTOFF) leftBlendRef.current = 0;
    if (!wantRight && rightBlendRef.current < ARM_OVERRIDE_CUTOFF) rightBlendRef.current = 0;

    leftBlendRef.current = THREE.MathUtils.clamp(leftBlendRef.current, 0, 1);
    rightBlendRef.current = THREE.MathUtils.clamp(rightBlendRef.current, 0, 1);

    const bodyRotY = groupRef.current?.rotation.y ?? 0;
    const localPlusX_X = Math.cos(bodyRotY);
    const localPlusX_Z = -Math.sin(bodyRotY);

    if (pointAt && restData) {
      if (pointAt.arm === 'left') {
        computeArmIK(
          bones.leftArm, bones.leftForeArm,
          restData.leftArmRestQuat, restData.leftForearmRestQuat,
          pointAt, leftAimRef.current, false, bodyRotY, maxArmIkAngle,
        );
      } else {
        computeArmIK(
          bones.rightArm, bones.rightForeArm,
          restData.rightArmRestQuat, restData.rightForearmRestQuat,
          pointAt, rightAimRef.current, true, bodyRotY, maxArmIkAngle,
        );
      }
    }

    const leftOverriding = leftBlendRef.current > 0;
    if (leftOverriding && restData) {
      bones.leftArm?.quaternion.slerp(leftAimRef.current, leftBlendRef.current);
      bones.leftForeArm?.quaternion.slerp(restData.leftForearmRestQuat, leftBlendRef.current);
      if (leftBlendRef.current > ENFORCE_ARM_SIDE_THRESHOLD)
        enforceArmSide(bones.leftArm, bones.leftForeArm, false, localPlusX_X, localPlusX_Z);

      if (leftFingersRef.current === undefined)
        leftFingersRef.current = collectFingerBones(bones.leftForeArm);
      if (leftFingersRef.current)
        applyPointingFingers(leftFingersRef.current, leftBlendRef.current);
    } else if (leftWasOverridingRef.current) {
      if (leftFingersRef.current) resetFingerBones(leftFingersRef.current);
      // Explicitly restore the arm to rest. This is required when the Idle
      // animation clip has no arm tracks (e.g. after FBX→GLB conversion with
      // mismatched bone names), otherwise the bone freezes in pointing pose.
      if (restData) {
        if (bones.leftArm) bones.leftArm.quaternion.copy(restData.leftArmRestQuat);
        if (bones.leftForeArm) bones.leftForeArm.quaternion.copy(restData.leftForearmRestQuat);
      }
    }
    leftWasOverridingRef.current = leftOverriding;

    const rightOverriding = rightBlendRef.current > 0;
    if (rightOverriding && restData) {
      bones.rightArm?.quaternion.slerp(rightAimRef.current, rightBlendRef.current);
      bones.rightForeArm?.quaternion.slerp(restData.rightForearmRestQuat, rightBlendRef.current);
      if (rightBlendRef.current > ENFORCE_ARM_SIDE_THRESHOLD)
        enforceArmSide(bones.rightArm, bones.rightForeArm, true, localPlusX_X, localPlusX_Z);

      if (rightFingersRef.current === undefined)
        rightFingersRef.current = collectFingerBones(bones.rightForeArm);
      if (rightFingersRef.current)
        applyPointingFingers(rightFingersRef.current, rightBlendRef.current);
    } else if (rightWasOverridingRef.current) {
      if (rightFingersRef.current) resetFingerBones(rightFingersRef.current);
      if (restData) {
        if (bones.rightArm) bones.rightArm.quaternion.copy(restData.rightArmRestQuat);
        if (bones.rightForeArm) bones.rightForeArm.quaternion.copy(restData.rightForearmRestQuat);
      }
    }
    rightWasOverridingRef.current = rightOverriding;

    // --- Jaw oscillation for speech ---
    if (bones.jaw) {
      jawTimeRef.current += delta;

      if (isSpeaking.current) {
        if (jawTimeRef.current >= jawNextFlipRef.current) {
          jawPhaseRef.current = jawPhaseRef.current > 0.3 ? 0 : 1;
          const hold = jawPhaseRef.current > 0.3
            ? 0.06 + Math.random() * 0.12
            : 0.03 + Math.random() * 0.06;
          jawNextFlipRef.current = jawTimeRef.current + hold;
        }
        const openAmount = jawPhaseRef.current > 0.3
          ? (0.6 + Math.random() * 0.4)
          : 0;
        jawTargetRef.current = openAmount * JAW_OPEN_ANGLE;
      } else {
        jawTargetRef.current = 0;
      }

      jawCurrentRef.current += (jawTargetRef.current - jawCurrentRef.current)
        * (1 - Math.exp(-JAW_SMOOTH_SPEED * delta));

      if (Math.abs(jawCurrentRef.current) > 0.001) {
        bones.jaw.rotation.x = jawCurrentRef.current;
      } else if (!isSpeaking.current) {
        bones.jaw.rotation.x = 0;
      }
    }
  });

  return null;
}
