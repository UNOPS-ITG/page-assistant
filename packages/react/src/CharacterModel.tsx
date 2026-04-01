import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';
import type { AnimationClip, Bone, Group } from 'three';
const HOVER_EVENT_TYPES = ['mouseover', 'mouseenter', 'pointerover', 'pointerenter'] as const;

import {
  ANIMATION_CONFIG,
  BONE_NAMES,
  BONES_TO_EXCLUDE_FROM_CLIPS,
  CLIP_NAMES,
  ONE_SHOT_CLIPS,
  ROTATION_LIMITS,
} from '@unopsitg/page-assistant-core';
import type { AssistantState, CharacterDefinition, LookTarget, PointAtTarget } from '@unopsitg/page-assistant-core';
import type { ArmRestData, AssistantController, BoneRefs } from './types';
import { useCursorTracking } from './useCursorTracking';
import { useScreenToWorld } from './useScreenToWorld';
import { BoneOverrideController } from './BoneOverrideController';

function lerpAngle(from: number, to: number, t: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return from + diff * t;
}

function getBoneNameFromTrack(trackName: string): string {
  const dotIdx = trackName.indexOf('.');
  return dotIdx >= 0 ? trackName.substring(0, dotIdx) : trackName;
}

const MIXAMORIG_PREFIX = /^mixamorig\d*[:]?/;

function canonicalBoneSuffix(name: string): string {
  return name.replace(MIXAMORIG_PREFIX, '');
}

function stripBoneTracks(clip: AnimationClip, boneNames: readonly string[]) {
  const suffixSet = new Set(boneNames.map(canonicalBoneSuffix));
  clip.tracks = clip.tracks.filter(
    (track) => !suffixSet.has(canonicalBoneSuffix(getBoneNameFromTrack(track.name))),
  );
}

const BONE_SUFFIX_MAP: Record<string, keyof BoneRefs> = {
  [canonicalBoneSuffix(BONE_NAMES.HEAD)]: 'head',
  [canonicalBoneSuffix(BONE_NAMES.NECK)]: 'neck',
  [canonicalBoneSuffix(BONE_NAMES.SPINE)]: 'spine',
  [canonicalBoneSuffix(BONE_NAMES.SPINE1)]: 'spine1',
  [canonicalBoneSuffix(BONE_NAMES.SPINE2)]: 'spine2',
  [canonicalBoneSuffix(BONE_NAMES.HIPS)]: 'hips',
  [canonicalBoneSuffix(BONE_NAMES.JAW)]: 'jaw',
  [canonicalBoneSuffix(BONE_NAMES.LEFT_ARM)]: 'leftArm',
  [canonicalBoneSuffix(BONE_NAMES.LEFT_FOREARM)]: 'leftForeArm',
  [canonicalBoneSuffix(BONE_NAMES.RIGHT_ARM)]: 'rightArm',
  [canonicalBoneSuffix(BONE_NAMES.RIGHT_FOREARM)]: 'rightForeArm',
};

function collectBoneRefs(root: THREE.Object3D): BoneRefs {
  const refs: BoneRefs = {
    head: null, neck: null, spine: null, spine1: null, spine2: null,
    hips: null, jaw: null, leftArm: null, leftForeArm: null, rightArm: null, rightForeArm: null,
  };
  root.traverse((child) => {
    const bone = child as Bone;
    if (!bone.isBone) return;
    const suffix = canonicalBoneSuffix(bone.name);
    const key = BONE_SUFFIX_MAP[suffix];
    if (key && !refs[key]) {
      refs[key] = bone;
    }
  });
  return refs;
}

function assistantStateToClip(state: AssistantState): string {
  switch (state) {
    case 'idle': return CLIP_NAMES.IDLE;
    case 'walking': return CLIP_NAMES.WALK;
    case 'pointing': return CLIP_NAMES.POINT;
    case 'pointingAt': return CLIP_NAMES.IDLE;
    case 'waving': return CLIP_NAMES.WAVE;
    case 'talking': return CLIP_NAMES.TALK;
    case 'dancing': return CLIP_NAMES.DANCE;
    case 'hidden':
    default: return CLIP_NAMES.IDLE;
  }
}

function computeArmRestData(bones: BoneRefs): ArmRestData {
  const defaultQuat = new THREE.Quaternion();
  return {
    leftArmRestQuat: bones.leftArm?.quaternion.clone() ?? defaultQuat.clone(),
    rightArmRestQuat: bones.rightArm?.quaternion.clone() ?? defaultQuat.clone(),
    leftForearmRestQuat: bones.leftForeArm?.quaternion.clone() ?? defaultQuat.clone(),
    rightForearmRestQuat: bones.rightForeArm?.quaternion.clone() ?? defaultQuat.clone(),
  };
}

interface CharacterModelProps {
  character: CharacterDefinition;
  controllerRef: MutableRefObject<AssistantController | null>;
  isSpeaking?: boolean;
  onStateChange?: (state: AssistantState) => void;
  onLoaded?: () => void;
  onClick?: () => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
}

export function CharacterModel({
  character,
  controllerRef,
  isSpeaking = false,
  onStateChange,
  onLoaded,
  onClick,
  onPointerOver,
  onPointerOut,
}: CharacterModelProps) {
  const groupRef = useRef<Group>(null);
  const { camera, gl } = useThree();
  const { viewportToWorld, viewportXToWorldX } = useScreenToWorld();
  const cursorRef = useCursorTracking();

  const suppressHoverRef = useRef<((ev: Event) => void) | null>(null);

  const lookTargetRef = useRef<LookTarget>({ mode: 'forward' });
  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;
  const stateRef = useRef<AssistantState>('idle');
  const walkTargetRef = useRef<{ x: number; y: number } | null>(null);
  const walkResolveRef = useRef<(() => void) | null>(null);
  const oneShotResolveRef = useRef<(() => void) | null>(null);
  const targetRotationYRef = useRef<number | null>(null);
  const pointAtTargetRef = useRef<PointAtTarget | null>(null);

  const lightRef = useRef<THREE.DirectionalLight>(null);
  const lightConfigured = useRef(false);
  const shadowGroundRef = useRef<THREE.Mesh>(null);
  const walkFacingRef = useRef(0);

  const gltf = useLoader(GLTFLoader, character.modelPath, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });
  const baseModel = gltf.scene;
  const animations = gltf.animations;

  const emissiveBoost = character.lightingOverrides?.emissiveIntensity ?? 0;

  useMemo(() => {
    baseModel.traverse((child) => {
      if ((child as THREE.Mesh).isMesh || (child as THREE.SkinnedMesh).isSkinnedMesh) {
        child.frustumCulled = false;
        (child as THREE.Mesh).castShadow = true;
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of materials) {
          if (!mat) continue;
          const std = mat as THREE.MeshStandardMaterial;
          std.metalness = 0;
          std.roughness = 1;
          std.metalnessMap = null;
          std.roughnessMap = null;
          std.needsUpdate = true;
          if (emissiveBoost > 0) {
            std.emissive = new THREE.Color(0xffffff);
            std.emissiveIntensity = emissiveBoost;
          }
        }
      }
    });
  }, [baseModel, emissiveBoost]);

  const actualModelHeight = useMemo(() => {
    const box = new THREE.Box3().setFromObject(baseModel);
    const size = new THREE.Vector3();
    box.getSize(size);
    return size.y * character.modelScale;
  }, [baseModel, character.modelScale]);

  const actualModelHeightRef = useRef(actualModelHeight);
  actualModelHeightRef.current = actualModelHeight;

  const { mixer, actionsMap, boneRefs, armRestData } = useMemo(() => {
    const mixerInstance = new THREE.AnimationMixer(baseModel);
    const actions: Record<string, THREE.AnimationAction> = {};

    for (const rawClip of animations) {
      const clipName = rawClip.name;
      if (!clipName) continue;

      const clip = rawClip.clone();
      stripBoneTracks(clip, BONES_TO_EXCLUDE_FROM_CLIPS);

      const action = mixerInstance.clipAction(clip);
      if ((ONE_SHOT_CLIPS as ReadonlySet<string>).has(clipName)) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      actions[clipName] = action;
    }

    const bones = collectBoneRefs(baseModel);

    const idleAction = actions[CLIP_NAMES.IDLE];
    if (idleAction) {
      idleAction.reset();
      idleAction.play();
      mixerInstance.update(1 / 60);
    }

    baseModel.updateMatrixWorld(true);
    const armRest = computeArmRestData(bones);

    return { mixer: mixerInstance, actionsMap: actions, boneRefs: bones, armRestData: armRest };
  }, [baseModel, animations]);

  const mixerRef = useRef(mixer);
  mixerRef.current = mixer;
  const actionsRef = useRef(actionsMap);
  actionsRef.current = actionsMap;
  const currentActionRef = useRef<THREE.AnimationAction | null>(actionsMap[CLIP_NAMES.IDLE] ?? null);
  const boneRefsRef = useRef(boneRefs);
  boneRefsRef.current = boneRefs;
  const armRestDataRef = useRef(armRestData);
  armRestDataRef.current = armRestData;

  const transitionToClip = useCallback(
    (clipName: string, crossfadeDuration = ANIMATION_CONFIG.CROSSFADE_DURATION) => {
      const next = actionsRef.current[clipName];
      if (!next) return;
      const prev = currentActionRef.current;
      if (prev === next && next.isRunning()) return;
      next.reset();
      if (prev && prev !== next) {
        next.crossFadeFrom(prev, crossfadeDuration, true);
      }
      next.play();
      currentActionRef.current = next;
    },
    [],
  );

  const transitionToClipRef = useRef(transitionToClip);
  transitionToClipRef.current = transitionToClip;
  const viewportToWorldRef = useRef(viewportToWorld);
  viewportToWorldRef.current = viewportToWorld;
  const viewportXToWorldXRef = useRef(viewportXToWorldX);
  viewportXToWorldXRef.current = viewportXToWorldX;
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  const characterRef = useRef(character);
  characterRef.current = character;

  useEffect(() => {
    const onFinished = (e: unknown) => {
      const action = (e as { action?: THREE.AnimationAction }).action;
      if (!action) return;
      const clipName = action.getClip().name;
      if (!(ONE_SHOT_CLIPS as ReadonlySet<string>).has(clipName)) return;

      const resolve = oneShotResolveRef.current;
      oneShotResolveRef.current = null;

      if (stateRef.current === 'pointing' || stateRef.current === 'waving') {
        stateRef.current = 'idle';
        transitionToClipRef.current(CLIP_NAMES.IDLE);
        onStateChangeRef.current?.('idle');
      }

      resolve?.();
    };

    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [mixer]);

  useEffect(() => {
    return () => {
      const light = lightRef.current;
      if (light?.target.parent) {
        light.target.parent.remove(light.target);
      }
    };
  }, []);

  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;
  const didFireLoaded = useRef(false);

  useEffect(() => {
    const controller: AssistantController = {
      walkToScreen(viewportX: number, viewportY: number) {
        return new Promise<void>((resolve) => {
          walkResolveRef.current?.();
          oneShotResolveRef.current?.();
          oneShotResolveRef.current = null;
          const world = viewportToWorldRef.current(viewportX, viewportY, 0);
          walkTargetRef.current = { x: world.x, y: world.y };
          walkResolveRef.current = resolve;
          stateRef.current = 'walking';
          transitionToClipRef.current(CLIP_NAMES.WALK);
          onStateChangeRef.current?.('walking');
        });
      },
      walkToScreenHeadAt(viewportX: number, headViewportY: number) {
        return new Promise<void>((resolve) => {
          const modelHeight = characterRef.current.modelHeight;
          const headWorld = viewportToWorldRef.current(viewportX, headViewportY, 0);
          walkTargetRef.current = { x: headWorld.x, y: headWorld.y - modelHeight };
          walkResolveRef.current = resolve;
          stateRef.current = 'walking';
          transitionToClipRef.current(CLIP_NAMES.WALK);
          onStateChangeRef.current?.('walking');
        });
      },
      walkToScreenX(viewportX: number) {
        return new Promise<void>((resolve) => {
          const worldX = viewportXToWorldXRef.current(viewportX);
          const currentY = groupRef.current?.position.y ?? 0;
          walkTargetRef.current = { x: worldX, y: currentY };
          walkResolveRef.current = resolve;
          stateRef.current = 'walking';
          transitionToClipRef.current(CLIP_NAMES.WALK);
          onStateChangeRef.current?.('walking');
        });
      },
      snapToViewportX(viewportX: number) {
        const worldX = viewportXToWorldXRef.current(viewportX);
        if (groupRef.current) groupRef.current.position.x = worldX;
      },
      playOneShot(state: AssistantState) {
        return new Promise<void>((resolve) => {
          oneShotResolveRef.current = resolve;
          stateRef.current = state;
          transitionToClipRef.current(assistantStateToClip(state));
          onStateChangeRef.current?.(state);
        });
      },
      transitionTo(state: AssistantState) {
        stateRef.current = state;
        transitionToClipRef.current(assistantStateToClip(state));
        onStateChangeRef.current?.(state);
      },
      setLookTarget(target: LookTarget) {
        lookTargetRef.current = target;
      },
      setCharacterWorldX(worldX: number) {
        if (groupRef.current) groupRef.current.position.x = worldX;
      },
      getCharacterScreenX() {
        if (!groupRef.current) return 0;
        const v = new THREE.Vector3();
        groupRef.current.getWorldPosition(v);
        v.project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        return (v.x * 0.5 + 0.5) * rect.width + rect.left;
      },
      getHeadScreenPosition() {
        if (!groupRef.current) return null;
        const v = new THREE.Vector3();
        groupRef.current.getWorldPosition(v);
        v.y += characterRef.current.modelHeight;
        v.project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        return {
          x: (v.x * 0.5 + 0.5) * rect.width + rect.left,
          y: (-(v.y * 0.5) + 0.5) * rect.height + rect.top,
        };
      },
      getClipDuration(state: AssistantState) {
        const clipName = assistantStateToClip(state);
        const action = actionsRef.current[clipName];
        return action ? action.getClip().duration : 0;
      },
      cancelCurrentAction() {
        walkTargetRef.current = null;
        walkResolveRef.current?.();
        walkResolveRef.current = null;
        oneShotResolveRef.current?.();
        oneShotResolveRef.current = null;
        stateRef.current = 'idle';
        transitionToClipRef.current(CLIP_NAMES.IDLE);
        onStateChangeRef.current?.('idle');
      },
      setTargetRotationY(angle: number) {
        targetRotationYRef.current = angle;
      },
      setWalkFacing(angle: number) {
        walkFacingRef.current = angle;
      },
      setPointAtTarget(viewportX: number, viewportY: number, arm: 'left' | 'right') {
        const worldPos = viewportToWorldRef.current(viewportX, viewportY, 0);
        pointAtTargetRef.current = { worldX: worldPos.x, worldY: worldPos.y, worldZ: worldPos.z, arm };
      },
      clearPointAtTarget() {
        pointAtTargetRef.current = null;
      },
    };

    controllerRef.current = controller;
    return () => { controllerRef.current = null; };
  }, [controllerRef, camera, gl]);

  useEffect(() => {
    if (didFireLoaded.current) return;
    didFireLoaded.current = true;
    onLoadedRef.current?.();
  }, []);

  useEffect(() => {
    return () => {
      if (suppressHoverRef.current) {
        for (const type of HOVER_EVENT_TYPES) {
          document.removeEventListener(type, suppressHoverRef.current, true);
        }
        suppressHoverRef.current = null;
      }
    };
  }, []);

  const getMaxFeetWorldY = useCallback((): number => {
    const modelH = Math.max(characterRef.current.modelHeight, actualModelHeightRef.current);
    const headWorld = viewportToWorldRef.current(0, 0, 0);
    return headWorld.y - modelH - ANIMATION_CONFIG.HEAD_MARGIN;
  }, []);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);

    const walking = stateRef.current === 'walking';
    const target = walkTargetRef.current;
    const group = groupRef.current;
    if (walking && target !== null && group) {
      const rect = gl.domElement.getBoundingClientRect();
      const leftW = viewportToWorldRef.current(rect.left, rect.top + rect.height / 2, 0).x;
      const rightW = viewportToWorldRef.current(rect.right, rect.top + rect.height / 2, 0).x;
      const worldPerPixel = Math.abs(rightW - leftW) / rect.width;
      const speedWorld = ANIMATION_CONFIG.WALK_SPEED * worldPerPixel;
      const maxFeetY = getMaxFeetWorldY();

      const modelHeight = characterRef.current.modelHeight;
      const halfWidth = modelHeight / 4;
      const xMarginWorld = halfWidth + 10 * worldPerPixel;
      const minX = Math.min(leftW, rightW) + xMarginWorld;
      const maxX = Math.max(leftW, rightW) - xMarginWorld;
      if (target.x < minX) target.x = minX;
      if (target.x > maxX) target.x = maxX;

      const dx = target.x - group.position.x;
      const dy = target.y - group.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < ANIMATION_CONFIG.ARRIVAL_THRESHOLD) {
        group.position.x = Math.max(minX, Math.min(maxX, target.x));
        group.position.y = Math.min(target.y, maxFeetY);
        walkTargetRef.current = null;
        walkResolveRef.current?.();
        walkResolveRef.current = null;
        stateRef.current = 'idle';
        transitionToClipRef.current(CLIP_NAMES.IDLE);
        onStateChangeRef.current?.('idle');
      } else {
        const stepDist = Math.min(dist, speedWorld * delta);
        const nx = dx / dist;
        const ny = dy / dist;

        group.position.x = Math.max(minX, Math.min(maxX, group.position.x + nx * stepDist));

        const idealNewY = group.position.y + ny * stepDist;

        if (idealNewY > maxFeetY) {
          group.position.y = maxFeetY;

          const remainingYWorld = target.y - maxFeetY;
          const scrollStepWorld = Math.min(remainingYWorld, speedWorld * delta);
          const scrollStepPx = scrollStepWorld / worldPerPixel;

          if (window.scrollY > 0) {
            const scrollPx = Math.min(scrollStepPx, window.scrollY);
            const html = document.documentElement;
            const prevBehavior = html.style.scrollBehavior;
            html.style.scrollBehavior = 'auto';
            window.scrollBy(0, -scrollPx);
            html.style.scrollBehavior = prevBehavior;
            target.y -= scrollPx * worldPerPixel;
          }
          if (window.scrollY <= 0 && target.y > maxFeetY) {
            target.y = maxFeetY;
          }
        } else {
          group.position.y = idealNewY;
        }

        const targetRotY = Math.atan2(nx, -ny);
        group.rotation.y = lerpAngle(group.rotation.y, targetRotY, ANIMATION_CONFIG.ROTATION_LERP_SPEED);
      }
    }

    if (group && (!walking || target === null)) {
      let rotTarget = 0;
      if (walking && target === null) {
        rotTarget = walkFacingRef.current;
      } else if (targetRotationYRef.current !== null) {
        rotTarget = targetRotationYRef.current;
      }
      group.rotation.y = lerpAngle(group.rotation.y, rotTarget, ANIMATION_CONFIG.ROTATION_LERP_SPEED);
    }

    if (group) {
      const light = lightRef.current;
      if (light) {
        if (!lightConfigured.current) {
          lightConfigured.current = true;
          const cam = light.shadow.camera;
          cam.left = -3; cam.right = 3; cam.top = 3; cam.bottom = -3;
          cam.near = 0.5; cam.far = 20;
          cam.updateProjectionMatrix();
          light.shadow.mapSize.setScalar(1024);
          light.shadow.bias = -0.0005;
          if (group.parent && !light.target.parent) {
            group.parent.add(light.target);
          }
        }
        light.position.set(group.position.x + 3, group.position.y + 5, 5);
        light.target.position.set(group.position.x, group.position.y + 0.7, 0);
      }
      const ground = shadowGroundRef.current;
      if (ground) {
        ground.position.set(group.position.x, group.position.y, 0);
      }
    }
  }, -1);

  return (
    <>
      <group ref={groupRef} dispose={null}>
        <primitive
          object={baseModel}
          scale={character.modelScale}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            let cleanupTimer: ReturnType<typeof setTimeout> | null = null;
            const captureClick = (clickEvent: MouseEvent) => {
              if (cleanupTimer !== null) clearTimeout(cleanupTimer);
              clickEvent.stopImmediatePropagation();
              clickEvent.preventDefault();
              document.removeEventListener('click', captureClick, true);
            };
            cleanupTimer = setTimeout(() => {
              document.removeEventListener('click', captureClick, true);
            }, 600);
            document.addEventListener('click', captureClick, true);
            onClick?.();
          }}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            if (!suppressHoverRef.current) {
              const suppress = (ev: Event) => { ev.stopImmediatePropagation(); };
              suppressHoverRef.current = suppress;
              for (const type of HOVER_EVENT_TYPES) {
                document.addEventListener(type, suppress, true);
              }
            }
            onPointerOver?.();
          }}
          onPointerOut={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            if (suppressHoverRef.current) {
              for (const type of HOVER_EVENT_TYPES) {
                document.removeEventListener(type, suppressHoverRef.current, true);
              }
              suppressHoverRef.current = null;
            }
            onPointerOut?.();
          }}
        />
        {(character.lightingOverrides?.fillLightIntensity ?? 0) > 0 && (
          <pointLight
            position={[0, character.modelHeight / character.modelScale * 0.6, character.modelHeight / character.modelScale * 0.8]}
            intensity={character.lightingOverrides!.fillLightIntensity!}
            distance={character.modelHeight / character.modelScale * 3}
            decay={1.5}
          />
        )}
        <BoneOverrideController
          boneRefs={boneRefsRef}
          lookTarget={lookTargetRef}
          currentState={stateRef}
          cursorTracking={cursorRef}
          groupRef={groupRef}
          pointAtTarget={pointAtTargetRef}
          armRestData={armRestDataRef}
          isSpeaking={isSpeakingRef}
          maxArmIkAngle={character.maxArmIkAngle ?? ROTATION_LIMITS.MAX_ARM_IK_ANGLE}
        />
      </group>
      <directionalLight
        ref={lightRef}
        position={[2, 3, 4]}
        intensity={character.lightingOverrides?.directionalIntensity ?? 1.5}
        castShadow
      />
      <mesh ref={shadowGroundRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <shadowMaterial opacity={0.3} />
      </mesh>
    </>
  );
}
