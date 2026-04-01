import { ROTATION_LIMITS } from './constants';

export const DEFAULT_GESTURE_MS = 2500;
export const ARM_SWITCH_HYSTERESIS = 40;

export function computeArmAndTurn(
  targetX: number,
  charScreenX: number,
  currentArm?: 'left' | 'right',
): { arm: 'left' | 'right'; turnAngle: number } {
  const dx = targetX - charScreenX;

  let arm: 'left' | 'right';
  if (currentArm) {
    const threshold = ARM_SWITCH_HYSTERESIS;
    if (currentArm === 'right' && dx > threshold) arm = 'left';
    else if (currentArm === 'left' && dx < -threshold) arm = 'right';
    else arm = currentArm;
  } else {
    arm = dx >= 0 ? 'left' : 'right';
  }

  const armSign = arm === 'left' ? 1 : -1;
  const maxDx = Math.max(window.innerWidth * 0.35, 1);
  const ratio = Math.min(1, Math.abs(dx) / maxDx);
  const proportionalTurn = ratio * ROTATION_LIMITS.MAX_POINT_AT_TURN;
  const turnAngle = armSign * Math.max(proportionalTurn, ROTATION_LIMITS.MIN_POINT_AT_TURN);

  return { arm, turnAngle };
}
