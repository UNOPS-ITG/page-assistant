import type { Object3D, AnimationAction, Bone, Quaternion } from 'three';

export type AssistantState = 'idle' | 'walking' | 'pointing' | 'pointingAt' | 'waving' | 'talking' | 'dancing' | 'hidden';

export interface WalkOptions {
  speed?: number;
  onArrive?: () => void;
}

export interface GestureOptions {
  duration?: number;
  returnToIdle?: boolean;
}

export interface PointAtOptions extends GestureOptions {
  walkTo?: boolean;
}

export interface PointAtTarget {
  worldX: number;
  worldY: number;
  worldZ: number;
  arm: 'left' | 'right';
}

export interface ArmRestData {
  leftArmRestQuat: Quaternion;
  rightArmRestQuat: Quaternion;
  leftForearmRestQuat: Quaternion;
  rightForearmRestQuat: Quaternion;
}

// --- Tour types (driver.js-inspired) ---

export type TourStepAction = 'walkTo' | 'pointAt' | 'wave' | 'talk' | 'dance' | 'idle';

export interface TourStepPopover {
  title?: string;
  description?: string;
}

export interface TourStep {
  element?: string;
  action?: TourStepAction;
  popover?: TourStepPopover;
  voice?: string | VoicePreference;
  speechEnabled?: boolean;
  autoSpeak?: boolean;
  showSpeechBubble?: boolean;
  duration?: number;
  walkTo?: boolean;
  onHighlighted?: () => void;
  onDeselected?: () => void;
}

export interface TourConfig {
  steps: TourStep[];
  animate?: boolean;
  showSpeechBubble?: boolean;
  speechEnabled?: boolean;
  autoSpeak?: boolean;
  defaultVoice?: string | VoicePreference;
  onStart?: () => void;
  onComplete?: () => void;
  onStepChange?: (stepIndex: number, step: TourStep) => void;
  onDestroyed?: () => void;
}

// --- Voice preference (portable across devices) ---

export type VoiceQuality = 'neural' | 'online' | 'any';

export interface VoicePreference {
  lang?: string;
  gender?: 'male' | 'female';
  quality?: VoiceQuality;
  name?: string;
}

// --- Speech types ---

export interface SpeechOptions {
  voice?: string | VoicePreference;
}

export interface SpeechBubbleData {
  title?: string;
  description?: string;
  showPlayButton?: boolean;
  visible: boolean;
}

export interface PageAssistantAPI {
  walkTo(targetElement: HTMLElement | string, options?: WalkOptions): Promise<void>;
  walkToPosition(screenX: number, screenY: number, options?: WalkOptions): Promise<void>;
  setPosition(screenX: number, screenY: number): void;
  point(options?: GestureOptions): Promise<void>;
  pointAt(target: HTMLElement | string | { x: number; y: number }, options?: PointAtOptions): Promise<void>;
  wave(options?: GestureOptions): Promise<void>;
  talk(options?: GestureOptions): Promise<void>;
  dance(options?: GestureOptions): Promise<void>;
  idle(): void;
  turnLeft(): void;
  turnRight(): void;
  straightenUp(): void;
  lookAt(targetElement: HTMLElement | string): void;
  lookAtCursor(): void;
  followCursorWithArms(): void;
  stopFollowingCursorWithArms(): void;
  lookForward(): void;
  show(): void;
  hide(): void;
  isVisible: boolean;
  isFollowingCursor: boolean;
  isFollowingWithArms: boolean;
  currentState: AssistantState;
  onStateChange: (callback: (state: AssistantState) => void) => () => void;
  onClick: (callback: () => void) => () => void;
  onHover: (callback: (hovering: boolean) => void) => () => void;

  say(text: string, options?: SpeechOptions): void;
  stopSpeaking(): void;
  showBubble(data: Omit<SpeechBubbleData, 'visible'>): void;
  hideBubble(): void;

  startTour(config: TourConfig): void;
  nextStep(): void;
  prevStep(): void;
  restartTour(): void;
  stopTour(): void;
  isTourActive: boolean;
  currentTourStep: number;
  tourStepCount: number;

  getAvailableVoices(): SpeechSynthesisVoice[];
}

export type LookMode = 'cursor' | 'element' | 'forward';

export interface LookTarget {
  mode: LookMode;
  ndcX?: number;
  ndcY?: number;
}

export interface AssistantController {
  walkToScreen(viewportX: number, viewportY: number): Promise<void>;
  walkToScreenHeadAt(viewportX: number, headViewportY: number): Promise<void>;
  walkToScreenX(viewportX: number): Promise<void>;
  playOneShot(state: AssistantState): Promise<void>;
  snapToViewportX(viewportX: number): void;
  setTargetRotationY(angle: number): void;
  transitionTo(state: AssistantState): void;
  setLookTarget(target: LookTarget): void;
  setCharacterWorldX(worldX: number): void;
  getCharacterScreenX(): number;
  getHeadScreenPosition(): { x: number; y: number } | null;
  getClipDuration(state: AssistantState): number;
  cancelCurrentAction(): void;
  setWalkFacing(angle: number): void;
  setPointAtTarget(viewportX: number, viewportY: number, arm: 'left' | 'right'): void;
  clearPointAtTarget(): void;
}

export interface BoneRefs {
  head: Bone | null;
  neck: Bone | null;
  spine: Bone | null;
  spine1: Bone | null;
  spine2: Bone | null;
  hips: Bone | null;
  leftArm: Bone | null;
  leftForeArm: Bone | null;
  rightArm: Bone | null;
  rightForeArm: Bone | null;
}

export interface AnimationActions {
  [key: string]: AnimationAction | null;
}

export interface CharacterNodes {
  [key: string]: Object3D;
}

export interface AssistantCanvasProps {
  containerMode?: boolean;
  width?: string | number;
  height?: string | number;
  className?: string;
}
