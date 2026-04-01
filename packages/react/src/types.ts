import type { Bone, Quaternion } from 'three';
import type { AssistantState, LookTarget } from '@unopsitg/page-assistant-core';

export interface ArmRestData {
  leftArmRestQuat: Quaternion;
  rightArmRestQuat: Quaternion;
  leftForearmRestQuat: Quaternion;
  rightForearmRestQuat: Quaternion;
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
  jaw: Bone | null;
  leftArm: Bone | null;
  leftForeArm: Bone | null;
  rightArm: Bone | null;
  rightForeArm: Bone | null;
}

export interface AssistantCanvasProps {
  containerMode?: boolean;
  width?: string | number;
  height?: string | number;
  className?: string;
}
