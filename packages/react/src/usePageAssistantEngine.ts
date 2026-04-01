import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import type {
  AssistantState,
  CharacterDefinition,
  GestureOptions,
  PageAssistantAPI,
  PointAtOptions,
  SpeechBubbleData,
  SpeechOptions,
  SpeechStatus,
  TourConfig,
  TourStep,
  WalkOptions,
} from '@unopsitg/page-assistant-core';
import {
  CHARACTERS,
  DEFAULT_CHARACTER_ID,
  SCROLL_SPEED_PX_PER_FRAME,
  computeArmAndTurn,
  DEFAULT_GESTURE_MS,
  resolveElement,
  getElementCenter,
  getSectionLeftStandPoint,
  resolvePointAtCoords,
  smoothScrollTo,
} from '@unopsitg/page-assistant-core';
import type { AssistantController } from './types';
import { useSpeech } from './useSpeech';

export interface PageAssistantEngineConfig {
  characterId?: string;
  characters?: Record<string, CharacterDefinition>;
  containerMode?: boolean;
  width?: string | number;
  height?: string | number;
  className?: string;
  initiallyVisible?: boolean;
  reducedMotion?: boolean;
  stickyHeaderSelector?: string;
}

export interface PageAssistantEngine {
  api: PageAssistantAPI;
  controllerRef: MutableRefObject<AssistantController | null>;
  character: CharacterDefinition;
  isLoaded: boolean;
  isVisible: boolean;
  suppressCanvas: boolean;
  speechStatus: SpeechStatus;
  onCanvasStateChange: (state: AssistantState) => void;
  onCanvasLoaded: () => void;
  onCharacterClick: () => void;
  onCharacterHover: (hovering: boolean) => void;
  bubbleData: SpeechBubbleData;
  isTourActive: boolean;
  currentTourStep: number;
  tourStepCount: number;
  onBubblePlay: () => void;
  onBubbleStopSpeech: () => void;
  onBubblePrev: () => void;
  onBubbleNext: () => void;
  onBubbleRestart: () => void;
  onBubbleStopTour: () => void;
  containerMode?: boolean;
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function usePageAssistantEngine(config: PageAssistantEngineConfig): PageAssistantEngine {
  const {
    characterId,
    characters: customCharacters,
    containerMode,
    width,
    height,
    className,
    initiallyVisible,
    reducedMotion,
    stickyHeaderSelector,
  } = config;

  const controllerRef = useRef<AssistantController | null>(null);
  const [currentState, setCurrentState] = useState<AssistantState>('idle');
  const [isVisible, setIsVisible] = useState(initiallyVisible ?? true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [suppressCanvas, setSuppressCanvas] = useState(false);

  const effectiveCharacters = customCharacters ?? CHARACTERS;
  const resolvedCharacterId = characterId && effectiveCharacters[characterId] ? characterId : Object.keys(effectiveCharacters)[0] ?? DEFAULT_CHARACTER_ID;
  const character: CharacterDefinition = effectiveCharacters[resolvedCharacterId] ?? CHARACTERS[DEFAULT_CHARACTER_ID];

  const stateChangeCallbacks = useRef(new Set<(state: AssistantState) => void>());
  const clickCallbacks = useRef(new Set<() => void>());
  const hoverCallbacks = useRef(new Set<(hovering: boolean) => void>());
  const gestureTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [isFollowingCursor, setIsFollowingCursor] = useState(false);
  const [isFollowingWithArms, setIsFollowingWithArms] = useState(false);
  const followCursorRef = useRef(false);
  const followWithArmsRef = useRef(false);
  const currentFollowArmRef = useRef<'left' | 'right'>('right');
  const walkingToClickRef = useRef(false);

  const speech = useSpeech();
  const speechRef = useRef(speech);
  speechRef.current = speech;

  const [bubbleData, setBubbleData] = useState<SpeechBubbleData>({ visible: false });
  const bubbleDataRef = useRef(bubbleData);
  bubbleDataRef.current = bubbleData;

  const [isTourActive, setIsTourActive] = useState(false);
  const [currentTourStep, setCurrentTourStep] = useState(-1);
  const [tourStepCount, setTourStepCount] = useState(0);
  const tourConfigRef = useRef<TourConfig | null>(null);
  const tourAbortRef = useRef(false);
  const tourRunningRef = useRef(false);
  const tourSkipHoldRef = useRef(false);
  const tourTargetStepRef = useRef<number | null>(null);

  const stickyHeaderSelectorRef = useRef(stickyHeaderSelector);
  stickyHeaderSelectorRef.current = stickyHeaderSelector;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      setSuppressCanvas(Boolean(reducedMotion) || mq.matches);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [reducedMotion]);

  const clearGestureTimeouts = useCallback(() => {
    gestureTimeoutsRef.current.forEach(clearTimeout);
    gestureTimeoutsRef.current = [];
  }, []);

  const scheduleReturnToIdle = useCallback((options?: GestureOptions) => {
    if (options?.returnToIdle === false) return;
    const d = options?.duration;
    const ms = d === undefined ? DEFAULT_GESTURE_MS : d;
    const id = setTimeout(() => {
      controllerRef.current?.transitionTo('idle');
      gestureTimeoutsRef.current = gestureTimeoutsRef.current.filter((t) => t !== id);
    }, ms);
    gestureTimeoutsRef.current.push(id);
  }, []);

  useEffect(() => () => clearGestureTimeouts(), [clearGestureTimeouts]);

  const characterClickedRef = useRef(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (characterClickedRef.current) {
        characterClickedRef.current = false;
        return;
      }
      if (!isLoaded || !isVisible) return;
      if (walkingToClickRef.current) return;
      if (tourRunningRef.current) return;

      const target = e.target as HTMLElement;
      if (target.closest('[data-page-assistant-canvas]')) return;
      if (target.closest('[data-pa-speech-bubble]')) return;
      if (target.closest('button, a, input, select, textarea, label, [role="button"]')) return;

      walkingToClickRef.current = true;
      controllerRef.current?.walkToScreen(e.clientX, e.clientY).then(() => {
        walkingToClickRef.current = false;
      });
    };

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [isLoaded, isVisible]);

  useEffect(() => {
    if (!isFollowingWithArms) return;

    const updateArmTracking = (clientX: number, clientY: number) => {
      if (!followWithArmsRef.current) return;
      const charX = controllerRef.current?.getCharacterScreenX() ?? 0;
      const { arm, turnAngle } = computeArmAndTurn(clientX, charX, currentFollowArmRef.current);
      currentFollowArmRef.current = arm;
      controllerRef.current?.setTargetRotationY(turnAngle);
      controllerRef.current?.setPointAtTarget(clientX, clientY, arm);
    };

    const onMouseMove = (e: MouseEvent) => updateArmTracking(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      updateArmTracking(e.touches[0].clientX, e.touches[0].clientY);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, [isFollowingWithArms]);

  useEffect(() => {
    if (isFollowingWithArms && currentState === 'idle') {
      controllerRef.current?.transitionTo('pointingAt');
    }
  }, [isFollowingWithArms, currentState]);

  const executeStepAction = useCallback(async (step: TourStep, apiRef: { current: PageAssistantAPI | null }) => {
    const api = apiRef.current;
    if (!api) return;

    const action = step.action ?? (step.element ? 'walkTo' : 'idle');

    switch (action) {
      case 'walkTo':
        if (step.element) await api.walkTo(step.element);
        break;
      case 'pointAt':
        if (step.element) await api.pointAt(step.element, { walkTo: step.walkTo, duration: step.duration ?? 3000, returnToIdle: false });
        break;
      case 'wave':
        await api.wave({ duration: step.duration ?? 2500, returnToIdle: false });
        break;
      case 'talk':
        await api.talk({ duration: step.duration ?? 3000, returnToIdle: false });
        break;
      case 'dance':
        await api.dance({ duration: step.duration ?? 4000, returnToIdle: false });
        break;
      case 'idle':
        api.idle();
        break;
    }
  }, []);

  const runTour = useCallback(async (tourConfig: TourConfig, apiRef: { current: PageAssistantAPI | null }) => {
    tourConfigRef.current = tourConfig;
    tourAbortRef.current = false;
    tourSkipHoldRef.current = false;
    tourTargetStepRef.current = null;
    tourRunningRef.current = true;
    setIsTourActive(true);
    setTourStepCount(tourConfig.steps.length);
    tourConfig.onStart?.();

    let i = 0;
    while (i < tourConfig.steps.length) {
      if (tourAbortRef.current) break;

      tourSkipHoldRef.current = false;
      tourTargetStepRef.current = null;

      const step = tourConfig.steps[i];
      setCurrentTourStep(i);
      tourConfig.onStepChange?.(i, step);
      step.onHighlighted?.();

      await executeStepAction(step, apiRef);
      if (tourAbortRef.current) break;

      const shouldShowBubble = step.showSpeechBubble ?? tourConfig.showSpeechBubble ?? true;
      const isSpeechEnabled = step.speechEnabled ?? tourConfig.speechEnabled ?? false;
      const isAutoSpeak = step.autoSpeak ?? tourConfig.autoSpeak ?? false;

      const hasText = Boolean(step.popover?.title || step.popover?.description);
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

      if (hasText && (shouldShowBubble || !isSpeechEnabled) && !(isMobile && isAutoSpeak)) {
        setBubbleData({
          title: step.popover?.title,
          description: step.popover?.description,
          showPlayButton: isSpeechEnabled && !isAutoSpeak,
          visible: true,
        });
      }

      if (isSpeechEnabled && isAutoSpeak && step.popover?.description) {
        const voiceName = step.voice ?? tourConfig.defaultVoice;
        await speechRef.current.speak(step.popover.description, voiceName ?? undefined);
        if (tourAbortRef.current || tourSkipHoldRef.current) {
          speechRef.current.stop();
          if (tourAbortRef.current) break;
        }
      }

      let holdMs: number;
      if (isSpeechEnabled && isAutoSpeak) {
        holdMs = step.duration ?? 1000;
      } else if (hasText) {
        const text = (step.popover?.title ?? '') + ' ' + (step.popover?.description ?? '');
        const wordCount = text.trim().split(/\s+/).length;
        const readingMs = wordCount * 300 + 2000;
        holdMs = Math.max(step.duration ?? 0, readingMs);
      } else {
        holdMs = step.duration ?? 3000;
      }

      if (!tourAbortRef.current && !tourSkipHoldRef.current) {
        await new Promise<void>((resolve) => {
          let timerDone = false;
          const id = setTimeout(() => { timerDone = true; }, holdMs);
          const poll = setInterval(() => {
            if (tourAbortRef.current || tourSkipHoldRef.current) {
              clearTimeout(id);
              clearInterval(poll);
              resolve();
              return;
            }
            if (timerDone && speechRef.current.status !== 'speaking') {
              clearInterval(poll);
              resolve();
            }
          }, 150);
        });
      }

      step.onDeselected?.();
      setBubbleData({ visible: false });
      speechRef.current.stop();

      if (tourAbortRef.current) break;

      const jump = tourTargetStepRef.current;
      tourTargetStepRef.current = null;
      tourSkipHoldRef.current = false;

      apiRef.current?.idle();
      apiRef.current?.straightenUp();
      await new Promise((r) => setTimeout(r, 300));

      if (jump !== null) {
        i = jump;
      } else {
        i++;
      }
    }

    tourRunningRef.current = false;
    setIsTourActive(false);
    setCurrentTourStep(-1);
    setTourStepCount(0);
    tourConfigRef.current = null;
    setBubbleData({ visible: false });

    if (!tourAbortRef.current) {
      tourConfig.onComplete?.();
    }
    tourConfig.onDestroyed?.();
  }, [executeStepAction]);

  const handleStateChange = useCallback((state: AssistantState) => {
    setCurrentState(state);
    stateChangeCallbacks.current.forEach((cb) => cb(state));
  }, []);

  const handleClick = useCallback(() => {
    characterClickedRef.current = true;
    if (clickCallbacks.current.size > 0) {
      clickCallbacks.current.forEach((cb) => cb());
      return;
    }
    controllerRef.current?.transitionTo('dancing');
    const durationMs = (controllerRef.current?.getClipDuration('dancing') ?? 3) * 1000;
    const id = setTimeout(() => {
      controllerRef.current?.transitionTo('idle');
      gestureTimeoutsRef.current = gestureTimeoutsRef.current.filter((t) => t !== id);
    }, durationMs);
    gestureTimeoutsRef.current.push(id);
  }, []);

  const handleHover = useCallback((hovering: boolean) => {
    const root = document.querySelector('[data-page-assistant-canvas]');
    if (root instanceof HTMLElement) {
      root.style.cursor = hovering ? 'pointer' : '';
    }
    hoverCallbacks.current.forEach((cb) => cb(hovering));
  }, []);

  const api = useMemo((): PageAssistantAPI => {
    return {
      walkTo: async (target, options?: WalkOptions) => {
        const el = resolveElement(target);
        if (!el) {
          options?.onArrive?.();
          return;
        }

        const viewportW = window.innerWidth;
        const centerX = viewportW / 2;

        await controllerRef.current?.walkToScreenX(centerX);

        const elRect = el.getBoundingClientRect();
        const scrollingUp = elRect.top < 0;
        controllerRef.current?.setWalkFacing(scrollingUp ? Math.PI : 0);
        controllerRef.current?.transitionTo('walking');
        await smoothScrollTo(el, options?.speed ?? SCROLL_SPEED_PX_PER_FRAME, stickyHeaderSelectorRef.current);

        const standPoint = getSectionLeftStandPoint(el);
        await controllerRef.current?.walkToScreenHeadAt(standPoint.x, standPoint.y);

        options?.onArrive?.();
      },

      walkToPosition: async (screenX, screenY, options?: WalkOptions) => {
        await controllerRef.current?.walkToScreen(screenX, screenY);
        options?.onArrive?.();
      },

      setPosition: (screenX) => {
        controllerRef.current?.snapToViewportX(screenX);
      },

      point: async (options?: GestureOptions) => {
        clearGestureTimeouts();
        await controllerRef.current?.playOneShot('pointing');
        scheduleReturnToIdle(options);
      },

      pointAt: async (target, options?: PointAtOptions) => {
        clearGestureTimeouts();

        const coords = resolvePointAtCoords(target);
        if (!coords) return;

        const charScreenX = controllerRef.current?.getCharacterScreenX() ?? 0;
        const { arm } = computeArmAndTurn(coords.x, charScreenX);

        if (options?.walkTo) {
          if (typeof target === 'string' || target instanceof HTMLElement) {
            const el = resolveElement(target);
            if (el) {
              const viewportW = window.innerWidth;
              const centerX = viewportW / 2;
              await controllerRef.current?.walkToScreenX(centerX);

              const elRect = el.getBoundingClientRect();
              const scrollingUp = elRect.top < 0;
              controllerRef.current?.setWalkFacing(scrollingUp ? Math.PI : 0);
              controllerRef.current?.transitionTo('walking');
              await smoothScrollTo(el, SCROLL_SPEED_PX_PER_FRAME, stickyHeaderSelectorRef.current);

              const standPoint = getSectionLeftStandPoint(el);
              await controllerRef.current?.walkToScreenHeadAt(standPoint.x, standPoint.y);
            }
          } else {
            const offsetX = arm === 'left' ? -200 : 200;
            await controllerRef.current?.walkToScreen(coords.x + offsetX, coords.y);
          }
        }

        const freshCoords = resolvePointAtCoords(target) ?? coords;
        const freshCharScreenX = controllerRef.current?.getCharacterScreenX() ?? 0;
        const result = computeArmAndTurn(freshCoords.x, freshCharScreenX);

        controllerRef.current?.setTargetRotationY(result.turnAngle);
        controllerRef.current?.setPointAtTarget(freshCoords.x, freshCoords.y, result.arm);
        controllerRef.current?.transitionTo('pointingAt');

        if (options?.returnToIdle !== false) {
          const ms = options?.duration ?? DEFAULT_GESTURE_MS;
          const id = setTimeout(() => {
            controllerRef.current?.clearPointAtTarget();
            controllerRef.current?.setTargetRotationY(0);
            controllerRef.current?.transitionTo('idle');
            gestureTimeoutsRef.current = gestureTimeoutsRef.current.filter((t) => t !== id);
          }, ms);
          gestureTimeoutsRef.current.push(id);
        }
      },

      wave: async (options?: GestureOptions) => {
        clearGestureTimeouts();
        controllerRef.current?.transitionTo('waving');
        scheduleReturnToIdle(options);
      },

      talk: async (options?: GestureOptions) => {
        clearGestureTimeouts();
        controllerRef.current?.transitionTo('talking');
        scheduleReturnToIdle(options);
      },

      dance: async (options?: GestureOptions) => {
        clearGestureTimeouts();
        controllerRef.current?.transitionTo('dancing');
        const clipMs = (controllerRef.current?.getClipDuration('dancing') ?? 3) * 1000;
        scheduleReturnToIdle({ ...options, duration: options?.duration ?? clipMs });
      },

      idle: () => {
        clearGestureTimeouts();
        controllerRef.current?.transitionTo('idle');
      },

      turnLeft: () => { controllerRef.current?.setTargetRotationY(-Math.PI / 2); },
      turnRight: () => { controllerRef.current?.setTargetRotationY(Math.PI / 2); },
      straightenUp: () => { controllerRef.current?.setTargetRotationY(0); },

      lookAt: (target) => {
        const el = resolveElement(target);
        if (!el) return;
        const { x, y } = getElementCenter(el);
        const canvas = document.querySelector<HTMLCanvasElement>('[data-page-assistant-canvas] canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const ndcX = ((x - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((y - rect.top) / rect.height) * 2 + 1;
        controllerRef.current?.setLookTarget({ mode: 'element', ndcX, ndcY });
      },

      lookAtCursor: () => {
        followCursorRef.current = true;
        setIsFollowingCursor(true);
        controllerRef.current?.setLookTarget({ mode: 'cursor' });
      },

      followCursorWithArms: () => {
        clearGestureTimeouts();
        followWithArmsRef.current = true;
        followCursorRef.current = true;
        setIsFollowingWithArms(true);
        setIsFollowingCursor(true);
        controllerRef.current?.setLookTarget({ mode: 'cursor' });
        controllerRef.current?.transitionTo('pointingAt');
      },

      stopFollowingCursorWithArms: () => {
        followWithArmsRef.current = false;
        setIsFollowingWithArms(false);
        controllerRef.current?.clearPointAtTarget();
        controllerRef.current?.setTargetRotationY(0);
        controllerRef.current?.transitionTo('idle');
      },

      lookForward: () => {
        followCursorRef.current = false;
        setIsFollowingCursor(false);
        if (followWithArmsRef.current) {
          followWithArmsRef.current = false;
          setIsFollowingWithArms(false);
          controllerRef.current?.clearPointAtTarget();
          controllerRef.current?.setTargetRotationY(0);
          controllerRef.current?.transitionTo('idle');
        }
        controllerRef.current?.setLookTarget({ mode: 'forward' });
      },

      show: () => {
        setIsVisible(true);
        controllerRef.current?.transitionTo('idle');
      },

      hide: () => {
        controllerRef.current?.transitionTo('hidden');
        setIsVisible(false);
      },

      isVisible,
      isFollowingCursor,
      isFollowingWithArms,
      currentState,

      onStateChange: (cb) => {
        stateChangeCallbacks.current.add(cb);
        return () => { stateChangeCallbacks.current.delete(cb); };
      },

      onClick: (cb) => {
        clickCallbacks.current.add(cb);
        return () => { clickCallbacks.current.delete(cb); };
      },

      onHover: (cb) => {
        hoverCallbacks.current.add(cb);
        return () => { hoverCallbacks.current.delete(cb); };
      },

      say: (text: string, options?: SpeechOptions) => {
        speechRef.current.speak(text, options?.voice);
      },

      stopSpeaking: () => { speechRef.current.stop(); },

      showBubble: (data) => { setBubbleData({ ...data, visible: true }); },

      hideBubble: () => { setBubbleData({ visible: false }); },

      startTour: (tourConfig: TourConfig) => {
        if (tourRunningRef.current) {
          tourAbortRef.current = true;
          speechRef.current.stop();
          setBubbleData({ visible: false });
          setTimeout(() => { runTour(tourConfig, apiSelfRef); }, 400);
          return;
        }
        runTour(tourConfig, apiSelfRef);
      },

      nextStep: () => {
        if (!tourRunningRef.current) return;
        speechRef.current.stop();
        tourSkipHoldRef.current = true;
      },

      prevStep: () => {
        if (!tourRunningRef.current) return;
        speechRef.current.stop();
        const target = Math.max(0, (tourConfigRef.current ? currentTourStep : 0) - 1);
        tourTargetStepRef.current = target;
        tourSkipHoldRef.current = true;
      },

      restartTour: () => {
        if (!tourRunningRef.current) return;
        speechRef.current.stop();
        tourTargetStepRef.current = 0;
        tourSkipHoldRef.current = true;
      },

      stopTour: () => {
        tourAbortRef.current = true;
        tourSkipHoldRef.current = true;
        tourRunningRef.current = false;
        setIsTourActive(false);
        setCurrentTourStep(-1);
        setTourStepCount(0);
        tourConfigRef.current = null;
        speechRef.current.stop();
        setBubbleData({ visible: false });
        controllerRef.current?.transitionTo('idle');
        controllerRef.current?.setTargetRotationY(0);
      },

      isTourActive,
      currentTourStep,
      tourStepCount,

      getAvailableVoices: () => speechRef.current.voices,
    };
  }, [clearGestureTimeouts, currentState, isFollowingCursor, isFollowingWithArms, isVisible, scheduleReturnToIdle, isTourActive, currentTourStep, tourStepCount, runTour]);

  const apiSelfRef = useRef<PageAssistantAPI | null>(null);
  apiSelfRef.current = api;

  const onBubblePlay = useCallback(() => {
    const desc = bubbleDataRef.current.description;
    if (desc) {
      const cfg = tourConfigRef.current;
      const stepIdx = currentTourStep;
      const step = cfg?.steps[stepIdx];
      const voiceName = step?.voice ?? cfg?.defaultVoice;
      speechRef.current.speak(desc, voiceName ?? undefined);
    }
  }, [currentTourStep]);

  const onBubbleStopSpeech = useCallback(() => { speechRef.current.stop(); }, []);
  const onBubblePrev = useCallback(() => { apiSelfRef.current?.prevStep(); }, []);
  const onBubbleNext = useCallback(() => { apiSelfRef.current?.nextStep(); }, []);
  const onBubbleRestart = useCallback(() => { apiSelfRef.current?.restartTour(); }, []);
  const onBubbleStopTour = useCallback(() => { apiSelfRef.current?.stopTour(); }, []);

  const onCanvasLoaded = useCallback(() => {
    setIsLoaded(true);
    const section = document.querySelector('main, section');
    if (section) {
      const gutterX = section.getBoundingClientRect().left / 2;
      if (gutterX > 10) {
        controllerRef.current?.snapToViewportX(gutterX);
      }
    }
  }, []);

  return {
    api,
    controllerRef,
    character,
    isLoaded,
    isVisible,
    suppressCanvas,
    speechStatus: speech.status,
    onCanvasStateChange: handleStateChange,
    onCanvasLoaded,
    onCharacterClick: handleClick,
    onCharacterHover: handleHover,
    bubbleData,
    isTourActive,
    currentTourStep,
    tourStepCount,
    onBubblePlay,
    onBubbleStopSpeech,
    onBubblePrev,
    onBubbleNext,
    onBubbleRestart,
    onBubbleStopTour,
    containerMode,
    width,
    height,
    className,
  };
}
