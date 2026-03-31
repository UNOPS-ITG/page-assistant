export const BONE_NAMES = {
  HEAD: 'mixamorigHead',
  NECK: 'mixamorigNeck',
  SPINE: 'mixamorigSpine',
  SPINE1: 'mixamorigSpine1',
  SPINE2: 'mixamorigSpine2',
  HIPS: 'mixamorigHips',
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
  MIN_POINT_AT_TURN: Math.PI / 4,
  MAX_ARM_IK_ANGLE: Math.PI * 0.42,
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

export interface CharacterDefinition {
  id: string;
  label: string;
  sex: CharacterSex;
  basePath: string;
  animations: Record<string, string>;
  modelHeight: number;
  modelScale: number;
}

function buildCharacterPaths(folder: string, prefix: string) {
  return {
    basePath: `/mixamo_files/${folder}/${prefix}-tpose.fbx`,
    animations: {
      [CLIP_NAMES.IDLE]: `/mixamo_files/${folder}/${prefix}-idle.fbx`,
      [CLIP_NAMES.WALK]: `/mixamo_files/${folder}/${prefix}-walk.fbx`,
      [CLIP_NAMES.POINT]: `/mixamo_files/${folder}/${prefix}-point.fbx`,
      [CLIP_NAMES.WAVE]: `/mixamo_files/${folder}/${prefix}-wave.fbx`,
      [CLIP_NAMES.TALK]: `/mixamo_files/${folder}/${prefix}-talk.fbx`,
      [CLIP_NAMES.DANCE]: `/mixamo_files/${folder}/${prefix}-hiphop.fbx`,
    },
  };
}

export const CHARACTERS: Record<string, CharacterDefinition> = {
  amy: {
    id: 'amy',
    label: 'Amy',
    sex: 'female',
    ...buildCharacterPaths('amy', 'amy'),
    modelHeight: 1.47,
    modelScale: 0.01,
  },
  sophie: {
    id: 'sophie',
    label: 'Sophie',
    sex: 'female',
    ...buildCharacterPaths('sophie', 'sophie'),
    modelHeight: 1.47,
    modelScale: 0.01,
  },
  michelle: {
    id: 'michelle',
    label: 'Michelle',
    sex: 'female',
    ...buildCharacterPaths('michelle', 'michelle'),
    modelHeight: 1.47,
    modelScale: 0.01,
  },
  aj: {
    id: 'aj',
    label: 'AJ',
    sex: 'male',
    ...buildCharacterPaths('aj', 'aj'),
    modelHeight: 1.47,
    modelScale: 0.01,
  },
  boss: {
    id: 'boss',
    label: 'Boss',
    sex: 'male',
    ...buildCharacterPaths('boss', 'boss'),
    modelHeight: 1.47,
    modelScale: 0.01,
  },
  brian: {
    id: 'brian',
    label: 'Brian',
    sex: 'male',
    ...buildCharacterPaths('brian', 'brian'),
    modelHeight: 1.47,
    modelScale: 0.01,
  },
  doozy: {
    id: 'doozy',
    label: 'Doozy',
    sex: 'female',
    ...buildCharacterPaths('doozy', 'doozy'),
    modelHeight: 1.47,
    modelScale: 0.01,
  },
  joe: {
    id: 'joe',
    label: 'Joe',
    sex: 'male',
    ...buildCharacterPaths('joe', 'joe'),
    modelHeight: 1.47,
    modelScale: 0.01,
  },
  mousey: {
    id: 'mousey',
    label: 'Mousey',
    sex: 'female',
    ...buildCharacterPaths('mousey', 'mousey'),
    modelHeight: 1.47,
    modelScale: 0.01,
  },
} as const;

export const DEFAULT_CHARACTER_ID = 'amy';
