import { Suspense, useEffect, useState, type CSSProperties, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CharacterModel } from './CharacterModel';
import type { AssistantController } from './types';
import type { AssistantState, CharacterDefinition } from '@unopsitg/page-assistant-core';
import { CAMERA_CONFIG } from '@unopsitg/page-assistant-core';

interface AssistantCanvasInternalProps {
  character: CharacterDefinition;
  controllerRef: MutableRefObject<AssistantController | null>;
  isSpeaking?: boolean;
  containerMode?: boolean;
  width?: string | number;
  height?: string | number;
  className?: string;
  onStateChange?: (state: AssistantState) => void;
  onLoaded?: () => void;
  onCharacterClick?: () => void;
  onCharacterHover?: (hovering: boolean) => void;
}

const MOBILE_CAMERA_Z_SCALE = 1.35;

function CameraSetup({ cameraZ }: { cameraZ: number }) {
  const { camera } = useThree();
  useFrame(() => {
    camera.position.z = cameraZ;
    camera.lookAt(CAMERA_CONFIG.LOOK_AT[0], CAMERA_CONFIG.LOOK_AT[1], CAMERA_CONFIG.LOOK_AT[2]);
  });
  return null;
}

function SceneContent({
  character,
  controllerRef,
  cameraZ,
  isSpeaking,
  onStateChange,
  onLoaded,
  onCharacterClick,
  onCharacterHover,
}: {
  character: CharacterDefinition;
  controllerRef: MutableRefObject<AssistantController | null>;
  cameraZ: number;
  isSpeaking?: boolean;
  onStateChange?: (state: AssistantState) => void;
  onLoaded?: () => void;
  onCharacterClick?: () => void;
  onCharacterHover?: (hovering: boolean) => void;
}) {
  return (
    <>
      <CameraSetup cameraZ={cameraZ} />
      <ambientLight intensity={1.0} />
      <hemisphereLight args={[0xffffff, 0x8c8c8c, 0.8]} />
      <Suspense fallback={null}>
        <CharacterModel
          character={character}
          controllerRef={controllerRef}
          isSpeaking={isSpeaking}
          onStateChange={onStateChange}
          onLoaded={onLoaded}
          onClick={onCharacterClick}
          onPointerOver={() => onCharacterHover?.(true)}
          onPointerOut={() => onCharacterHover?.(false)}
        />
      </Suspense>
    </>
  );
}

export function AssistantCanvas({
  character,
  controllerRef,
  isSpeaking,
  containerMode = false,
  width,
  height,
  className,
  onStateChange,
  onLoaded,
  onCharacterClick,
  onCharacterHover,
}: AssistantCanvasInternalProps) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const cameraZ = isMobile
    ? CAMERA_CONFIG.POSITION[2] * MOBILE_CAMERA_Z_SCALE
    : CAMERA_CONFIG.POSITION[2];

  const wrapperStyle: CSSProperties = containerMode
    ? {
        position: 'relative',
        width: width ?? '100%',
        height: height ?? '400px',
      }
    : {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1000,
        pointerEvents: 'none',
      };

  return (
    <div data-page-assistant-canvas style={wrapperStyle} className={className}>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        gl={{
          alpha: true,
          antialias: true,
          toneMapping: THREE.LinearToneMapping,
          toneMappingExposure: 1.2,
        }}
        dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1}
        camera={{
          fov: CAMERA_CONFIG.FOV,
          position: [CAMERA_CONFIG.POSITION[0], CAMERA_CONFIG.POSITION[1], cameraZ] as [number, number, number],
          near: CAMERA_CONFIG.NEAR,
          far: CAMERA_CONFIG.FAR,
        }}
        style={{ background: 'transparent', pointerEvents: 'none' }}
        eventSource={typeof document !== 'undefined' ? document.documentElement : undefined}
        eventPrefix="client"
        aria-hidden
        role="presentation"
      >
        <SceneContent
          character={character}
          controllerRef={controllerRef}
          cameraZ={cameraZ}
          isSpeaking={isSpeaking}
          onStateChange={onStateChange}
          onLoaded={onLoaded}
          onCharacterClick={onCharacterClick}
          onCharacterHover={onCharacterHover}
        />
      </Canvas>
    </div>
  );
}
