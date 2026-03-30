import { useEffect, useRef } from 'react';

export interface CursorPosition {
  ndcX: number;
  ndcY: number;
  screenX: number;
  screenY: number;
}

const DEFAULT_POSITION: CursorPosition = {
  ndcX: 0,
  ndcY: 0,
  screenX: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
  screenY: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
};

export function useCursorTracking() {
  const position = useRef<CursorPosition>({ ...DEFAULT_POSITION });

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      position.current = {
        screenX: e.clientX,
        screenY: e.clientY,
        ndcX: (e.clientX / window.innerWidth) * 2 - 1,
        ndcY: -(e.clientY / window.innerHeight) * 2 + 1,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const touch = e.touches[0];
      position.current = {
        screenX: touch.clientX,
        screenY: touch.clientY,
        ndcX: (touch.clientX / window.innerWidth) * 2 - 1,
        ndcY: -(touch.clientY / window.innerHeight) * 2 + 1,
      };
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  return position;
}
