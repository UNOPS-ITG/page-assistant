export const BONE_NAMES = {
  HEAD: 'mixamorigHead',
  NECK: 'mixamorigNeck',
  SPINE: 'mixamorigSpine',
  SPINE1: 'mixamorigSpine1',
  SPINE2: 'mixamorigSpine2',
  HIPS: 'mixamorigHips',
  JAW: 'mixamorigJaw',
  LEFT_ARM: 'mixamorigLeftArm',
  LEFT_FOREARM: 'mixamorigLeftForeArm',
  RIGHT_ARM: 'mixamorigRightArm',
  RIGHT_FOREARM: 'mixamorigRightForeArm',
} as const;

export const ROTATION_LIMITS = {
  HEAD_TURN: 0.8,
  HEAD_TILT: 0.5,
  NECK_FACTOR: 0.6,
  SPINE_FACTOR: 0.3,
  ARM_BLEND_SPEED: 8,
  MAX_POINT_AT_TURN: Math.PI / 2,
  MIN_POINT_AT_TURN: Math.PI / 12,
  MAX_ARM_IK_ANGLE: Math.PI * 0.75,
} as const;

export const ANIMATION_CONFIG = {
  CROSSFADE_DURATION: 0.4,
  CURSOR_LERP_FACTOR: 0.05,
  WALK_SPEED: 150,
  ARRIVAL_THRESHOLD: 0.05,
  IDLE_VARIATION_MIN_SEC: 8,
  IDLE_VARIATION_MAX_SEC: 15,
  ROTATION_LERP_SPEED: 0.15,
  HEAD_MARGIN: 0.15,
} as const;

export const CAMERA_CONFIG = {
  FOV: 50,
  POSITION: [0, 1.2, 3] as [number, number, number],
  LOOK_AT: [0, 0.9, 0] as [number, number, number],
  NEAR: 0.1,
  FAR: 100,
} as const;

export const CLIP_NAMES = {
  IDLE: 'Idle',
  WALK: 'Walk',
  POINT: 'Point',
  WAVE: 'Wave',
  TALK: 'Talk',
  DANCE: 'Dance',
} as const;

export const BONES_TO_EXCLUDE_FROM_CLIPS = [
  BONE_NAMES.HEAD,
  BONE_NAMES.NECK,
  BONE_NAMES.SPINE,
  BONE_NAMES.JAW,
];

export const LOOPING_CLIPS = new Set([
  CLIP_NAMES.IDLE,
  CLIP_NAMES.WALK,
  CLIP_NAMES.TALK,
  CLIP_NAMES.DANCE,
]);

export const ONE_SHOT_CLIPS = new Set([
  CLIP_NAMES.POINT,
  CLIP_NAMES.WAVE,
]);

export type CharacterSex = 'male' | 'female';

export interface CharacterLightingOverrides {
  /** Extra point-light intensity added inside the character group as fill. */
  fillLightIntensity?: number;
  /** Override the per-character directional light intensity (default 1.5). */
  directionalIntensity?: number;
  /** Flat emissive boost applied to every material on the mesh (0-1 range). */
  emissiveIntensity?: number;
}

export interface CharacterDefinition {
  id: string;
  label: string;
  sex: CharacterSex;
  /** Path to the merged GLB file containing the mesh and all animation clips. */
  modelPath: string;
  modelHeight: number;
  modelScale: number;
  /** Max angle (radians) the arm IK can rotate from the idle rest pose. Defaults to ROTATION_LIMITS.MAX_ARM_IK_ANGLE. */
  maxArmIkAngle?: number;
  lightingOverrides?: CharacterLightingOverrides;
}

export const CHARACTERS: Record<string, CharacterDefinition> = {
  amy: {
    id: 'amy',
    label: 'Amy',
    sex: 'female',
    modelPath: '/models/amy.glb',
    modelHeight: 1.47,
    modelScale: 1,
    lightingOverrides: {
      fillLightIntensity: 0.4,
      directionalIntensity: 2.2,
      emissiveIntensity: 0,
    },
  },
  sophie: {
    id: 'sophie',
    label: 'Sophie',
    sex: 'female',
    modelPath: '/models/sophie.glb',
    modelHeight: 1.47,
    modelScale: 1,
    maxArmIkAngle: Math.PI * 0.45,
    lightingOverrides: {
      fillLightIntensity: 0.4,
      directionalIntensity: 3.2,
      emissiveIntensity: 0,
    },
  },
  michelle: {
    id: 'michelle',
    label: 'Michelle',
    sex: 'female',
    modelPath: '/models/michelle.glb',
    modelHeight: 1.47,
    modelScale: 1,
    lightingOverrides: {
      fillLightIntensity: 0.4,
      directionalIntensity: 5.2,
      emissiveIntensity: 0,
    },
  },
  aj: {
    id: 'aj',
    label: 'AJ',
    sex: 'male',
    modelPath: '/models/aj.glb',
    modelHeight: 1.47,
    modelScale: 1,
    lightingOverrides: {
      fillLightIntensity: 0.4,
      directionalIntensity: 3.2,
      emissiveIntensity: 0,
    },
  },
  boss: {
    id: 'boss',
    label: 'Boss',
    sex: 'male',
    modelPath: '/models/boss.glb',
    modelHeight: 1.47,
    modelScale: 1,
    maxArmIkAngle: Math.PI * 0.45,
    lightingOverrides: {
      fillLightIntensity: 0.4,
      directionalIntensity: 1.2,
      emissiveIntensity: 0,
    },
  },
  brian: {
    id: 'brian',
    label: 'Brian',
    sex: 'male',
    modelPath: '/models/brian.glb',
    modelHeight: 1.47,
    modelScale: 1,
    maxArmIkAngle: Math.PI * 0.55,
    lightingOverrides: {
      fillLightIntensity: 0.4,
      directionalIntensity: 1.2,
      emissiveIntensity: 0,
    },
  },
  doozy: {
    id: 'doozy',
    label: 'Doozy',
    sex: 'female',
    modelPath: '/models/doozy.glb',
    modelHeight: 1.47,
    modelScale: 1,
    lightingOverrides: {
      fillLightIntensity: 0.4,
      directionalIntensity: 1.2,
      emissiveIntensity: 0,
    },
  },
  joe: {
    id: 'joe',
    label: 'Joe',
    sex: 'male',
    modelPath: '/models/joe.glb',
    modelHeight: 1.47,
    modelScale: 1,
    maxArmIkAngle: Math.PI * 0.50,
    lightingOverrides: {
      fillLightIntensity: 0.4,
      directionalIntensity: 1.2,
      emissiveIntensity: 0,
    },
  },
  mousey: {
    id: 'mousey',
    label: 'Mousey',
    sex: 'female',
    modelPath: '/models/mousey.glb',
    modelHeight: 1.47,
    modelScale: 1,
    lightingOverrides: {
      fillLightIntensity: 0.4,
      directionalIntensity: 1.2,
      emissiveIntensity: 0,
    },
  },
} as const;

export const DEFAULT_CHARACTER_ID = 'amy';
