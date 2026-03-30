import type { Object3D, AnimationAction, Bone } from 'three';

export type AssistantState = 'idle' | 'walking' | 'pointing' | 'waving' | 'talking' | 'dancing' | 'hidden';

export interface WalkOptions {
  speed?: number;
  onArrive?: () => void;
}

export interface GestureOptions {
  duration?: number;
  returnToIdle?: boolean;
}

export interface PageAssistantAPI {
  walkTo(targetElement: HTMLElement | string, options?: WalkOptions): Promise<void>;
  walkToPosition(screenX: number, screenY: number, options?: WalkOptions): Promise<void>;
  setPosition(screenX: number, screenY: number): void;
  point(options?: GestureOptions): Promise<void>;
  wave(options?: GestureOptions): Promise<void>;
  talk(options?: GestureOptions): Promise<void>;
  dance(options?: GestureOptions): Promise<void>;
  idle(): void;
  turnLeft(): void;
  turnRight(): void;
  straightenUp(): void;
  lookAt(targetElement: HTMLElement | string): void;
  lookAtCursor(): void;
  lookForward(): void;
  show(): void;
  hide(): void;
  isVisible: boolean;
  isFollowingCursor: boolean;
  currentState: AssistantState;
  onStateChange: (callback: (state: AssistantState) => void) => () => void;
  onClick: (callback: () => void) => () => void;
  onHover: (callback: (hovering: boolean) => void) => () => void;
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
  getClipDuration(state: AssistantState): number;
  cancelCurrentAction(): void;
  setWalkFacing(angle: number): void;
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
