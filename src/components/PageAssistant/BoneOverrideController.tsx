import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ANIMATION_CONFIG, ROTATION_LIMITS } from './constants';
import type { AssistantState, BoneRefs, LookTarget } from './types';

interface BoneOverrideControllerProps {
  boneRefs: React.RefObject<BoneRefs>;
  lookTarget: React.RefObject<LookTarget>;
  currentState: React.RefObject<AssistantState>;
  cursorTracking: React.RefObject<{ ndcX: number; ndcY: number; screenX: number; screenY: number }>;
  groupRef: React.RefObject<THREE.Group | null>;
}

const _eye = new THREE.Vector3();
const _charNdc = new THREE.Vector3();

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

export function BoneOverrideController({
  boneRefs,
  lookTarget,
  currentState,
  cursorTracking,
  groupRef,
}: BoneOverrideControllerProps) {
  const { camera, gl } = useThree();

  useFrame(() => {
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
  });

  return null;
}
