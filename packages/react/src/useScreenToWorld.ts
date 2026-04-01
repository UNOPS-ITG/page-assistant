import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useCallback } from 'react';

export function useScreenToWorld() {
  const { camera, gl } = useThree();

  const viewportToWorld = useCallback(
    (viewportX: number, viewportY: number, targetZ = 0): Vector3 => {
      const rect = gl.domElement.getBoundingClientRect();
      const canvasX = viewportX - rect.left;
      const canvasY = viewportY - rect.top;
      const ndcX = (canvasX / rect.width) * 2 - 1;
      const ndcY = -(canvasY / rect.height) * 2 + 1;

      const near = new Vector3(ndcX, ndcY, 0).unproject(camera);
      const far = new Vector3(ndcX, ndcY, 1).unproject(camera);
      const dir = far.sub(near).normalize();
      const t = (targetZ - near.z) / dir.z;

      return new Vector3(near.x + dir.x * t, near.y + dir.y * t, targetZ);
    },
    [camera, gl],
  );

  const viewportXToWorldX = useCallback(
    (viewportX: number): number => {
      const rect = gl.domElement.getBoundingClientRect();
      return viewportToWorld(viewportX, rect.top + rect.height / 2, 0).x;
    },
    [viewportToWorld, gl],
  );

  return { viewportToWorld, viewportXToWorldX };
}
