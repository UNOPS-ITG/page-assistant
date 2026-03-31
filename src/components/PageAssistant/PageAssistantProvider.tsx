import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AssistantCanvas } from './AssistantCanvas';
import type {
  AssistantController,
  AssistantState,
  GestureOptions,
  PageAssistantAPI,
  PointAtOptions,
  SpeechBubbleData,
  SpeechOptions,
  TourConfig,
  TourStep,
  WalkOptions,
} from './types';
import { CHARACTERS, DEFAULT_CHARACTER_ID, ROTATION_LIMITS, type CharacterDefinition } from './constants';
import { useSpeech } from './useSpeech';
import { SpeechBubble } from './SpeechBubble';

const PageAssistantContext = createContext<PageAssistantAPI | null>(null);

export function usePageAssistant(): PageAssistantAPI {
  const ctx = useContext(PageAssistantContext);
  if (!ctx) {
    throw new Error('usePageAssistant must be used within PageAssistantProvider');
  }
  return ctx;
}

interface PageAssistantProviderProps {
  children: ReactNode;
  characterId?: string;
  containerMode?: boolean;
  width?: string | number;
  height?: string | number;
  className?: string;
  initiallyVisible?: boolean;
  reducedMotion?: boolean;
}

function resolveElement(target: HTMLElement | string): HTMLElement | null {
  if (typeof target === 'string') {
    return document.querySelector(target);
  }
  return target;
}

function getElementCenter(el: HTMLElement): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function getSectionLeftStandPoint(el: HTMLElement): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left / 2,
    y: rect.top,
  };
}

function resolvePointAtCoords(target: HTMLElement | string | { x: number; y: number }): { x: number; y: number } | null {
  if (typeof target === 'string' || target instanceof HTMLElement) {
    const el = resolveElement(target);
    if (!el) return null;
    return getElementCenter(el);
  }
  return target;
}

function smoothScrollTo(el: HTMLElement, scrollSpeed: number): Promise<void> {
  return new Promise((resolve) => {
    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const stickyNav = document.querySelector('.site-header');
    const navHeight = stickyNav ? stickyNav.getBoundingClientRect().height : 0;
    const scrollMarginTop = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    const offset = Math.max(navHeight, scrollMarginTop);
    const targetScrollY = window.scrollY + rect.top - offset;
    const clampedTarget = Math.max(0, Math.min(targetScrollY, document.documentElement.scrollHeight - viewportH));

    if (Math.abs(clampedTarget - window.scrollY) < 2) {
      resolve();
      return;
    }

    const html = document.documentElement;
    const savedBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';

    let rafId = 0;
    const step = () => {
      const diff = clampedTarget - window.scrollY;
      if (Math.abs(diff) < 2) {
        window.scrollTo({ top: clampedTarget });
        html.style.scrollBehavior = savedBehavior;
        resolve();
        return;
      }
      const delta = Math.sign(diff) * Math.min(Math.abs(diff), scrollSpeed);
      window.scrollBy(0, delta);
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);

    const cleanup = () => {
      cancelAnimationFrame(rafId);
      html.style.scrollBehavior = savedBehavior;
      resolve();
    };
    window.addEventListener('wheel', cleanup, { once: true });
    window.addEventListener('touchstart', cleanup, { once: true });
  });
}

const SCROLL_SPEED_PX_PER_FRAME = 8;
const DEFAULT_GESTURE_MS = 2500;
const ARM_SWITCH_HYSTERESIS = 40;

function computeArmAndTurn(
  targetX: number,
  charScreenX: number,
  currentArm?: 'left' | 'right',
): { arm: 'left' | 'right'; turnAngle: number } {
  const dx = targetX - charScreenX;

  // Mixamo right arm is at -X (viewer's left), left arm at +X (viewer's right).
  // Pick the arm whose screen side matches the target side.
  let arm: 'left' | 'right';
  if (currentArm) {
    const threshold = ARM_SWITCH_HYSTERESIS;
    if (currentArm === 'right' && dx > threshold) arm = 'left';
    else if (currentArm === 'left' && dx < -threshold) arm = 'right';
    else arm = currentArm;
  } else {
    arm = dx >= 0 ? 'left' : 'right';
  }

  // arm='left' (target right) → positive Y → turn right; arm='right' (target left) → negative Y → turn left
  const armSign = arm === 'left' ? 1 : -1;
  const maxDx = Math.max(window.innerWidth * 0.35, 1);
  const ratio = Math.min(1, Math.abs(dx) / maxDx);
  const proportionalTurn = ratio * ROTATION_LIMITS.MAX_POINT_AT_TURN;
  const turnAngle = armSign * Math.max(proportionalTurn, ROTATION_LIMITS.MIN_POINT_AT_TURN);

  return { arm, turnAngle };
}

export function PageAssistantProvider({
  children,
  characterId,
  containerMode,
  width,
  height,
  className,
  initiallyVisible,
  reducedMotion,
}: PageAssistantProviderProps) {
  const controllerRef = useRef<AssistantController | null>(null);
  const [currentState, setCurrentState] = useState<AssistantState>('idle');
  const [isVisible, setIsVisible] = useState(initiallyVisible ?? true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [suppressCanvas, setSuppressCanvas] = useState(false);

  const resolvedCharacterId = characterId && CHARACTERS[characterId] ? characterId : DEFAULT_CHARACTER_ID;
  const character: CharacterDefinition = CHARACTERS[resolvedCharacterId];

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
      const { arm, turnAngle } = computeArmAndTurn(
        clientX, charX, currentFollowArmRef.current,
      );
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
        if (step.element) {
          await api.walkTo(step.element);
        }
        break;
      case 'pointAt':
        if (step.element) {
          await api.pointAt(step.element, {
            walkTo: step.walkTo,
            duration: step.duration ?? 3000,
            returnToIdle: false,
          });
        }
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

  const runTour = useCallback(async (config: TourConfig, apiRef: { current: PageAssistantAPI | null }) => {
    tourConfigRef.current = config;
    tourAbortRef.current = false;
    tourSkipHoldRef.current = false;
    tourTargetStepRef.current = null;
    tourRunningRef.current = true;
    setIsTourActive(true);
    setTourStepCount(config.steps.length);
    config.onStart?.();

    let i = 0;
    while (i < config.steps.length) {
      if (tourAbortRef.current) break;

      tourSkipHoldRef.current = false;
      tourTargetStepRef.current = null;

      const step = config.steps[i];
      setCurrentTourStep(i);
      config.onStepChange?.(i, step);
      step.onHighlighted?.();

      await executeStepAction(step, apiRef);
      if (tourAbortRef.current) break;

      const shouldShowBubble = step.showSpeechBubble ?? config.showSpeechBubble ?? true;
      const isSpeechEnabled = step.speechEnabled ?? config.speechEnabled ?? false;
      const isAutoSpeak = step.autoSpeak ?? config.autoSpeak ?? false;

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
        const voiceName = step.voice ?? config.defaultVoice;
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
      config.onComplete?.();
    }
    config.onDestroyed?.();
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
        await smoothScrollTo(el, options?.speed ?? SCROLL_SPEED_PX_PER_FRAME);

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
              await smoothScrollTo(el, SCROLL_SPEED_PX_PER_FRAME);

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
        scheduleReturnToIdle({
          ...options,
          duration: options?.duration ?? clipMs,
        });
      },

      idle: () => {
        clearGestureTimeouts();
        controllerRef.current?.transitionTo('idle');
      },

      turnLeft: () => {
        controllerRef.current?.setTargetRotationY(-Math.PI / 2);
      },

      turnRight: () => {
        controllerRef.current?.setTargetRotationY(Math.PI / 2);
      },

      straightenUp: () => {
        controllerRef.current?.setTargetRotationY(0);
      },

      lookAt: (target) => {
        const el = resolveElement(target);
        if (!el) return;
        const { x, y } = getElementCenter(el);
        const canvas = document.querySelector<HTMLCanvasElement>(
          '[data-page-assistant-canvas] canvas',
        );
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
        return () => {
          stateChangeCallbacks.current.delete(cb);
        };
      },

      onClick: (cb) => {
        clickCallbacks.current.add(cb);
        return () => {
          clickCallbacks.current.delete(cb);
        };
      },

      onHover: (cb) => {
        hoverCallbacks.current.add(cb);
        return () => {
          hoverCallbacks.current.delete(cb);
        };
      },

      say: (text: string, options?: SpeechOptions) => {
        speechRef.current.speak(text, options?.voice);
      },

      stopSpeaking: () => {
        speechRef.current.stop();
      },

      showBubble: (data) => {
        setBubbleData({ ...data, visible: true });
      },

      hideBubble: () => {
        setBubbleData({ visible: false });
      },

      startTour: (config: TourConfig) => {
        if (tourRunningRef.current) {
          tourAbortRef.current = true;
          speechRef.current.stop();
          setBubbleData({ visible: false });
          setTimeout(() => {
            runTour(config, apiSelfRef);
          }, 400);
          return;
        }
        runTour(config, apiSelfRef);
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

  const handleBubblePlay = useCallback(() => {
    const desc = bubbleDataRef.current.description;
    if (desc) {
      const config = tourConfigRef.current;
      const stepIdx = currentTourStep;
      const step = config?.steps[stepIdx];
      const voiceName = step?.voice ?? config?.defaultVoice;
      speechRef.current.speak(desc, voiceName ?? undefined);
    }
  }, [currentTourStep]);

  const handleBubbleStopSpeech = useCallback(() => {
    speechRef.current.stop();
  }, []);

  const handleBubblePrev = useCallback(() => {
    apiSelfRef.current?.prevStep();
  }, []);

  const handleBubbleNext = useCallback(() => {
    apiSelfRef.current?.nextStep();
  }, []);

  const handleBubbleRestart = useCallback(() => {
    apiSelfRef.current?.restartTour();
  }, []);

  const handleBubbleStopTour = useCallback(() => {
    apiSelfRef.current?.stopTour();
  }, []);

  return (
    <PageAssistantContext.Provider value={api}>
      {children}
      {!suppressCanvas && (
        <>
          {isVisible && !isLoaded && (
            <>
              <style>{`
                @keyframes pa-loader-pulse {
                  0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.45); }
                  50% { box-shadow: 0 0 0 10px rgba(99,102,241,0); }
                }
                @keyframes pa-loader-spin {
                  to { transform: rotate(360deg); }
                }
                @keyframes pa-loader-slide-in {
                  from { opacity: 0; transform: translateY(20px); }
                  to { opacity: 1; transform: translateY(0); }
                }
                @keyframes pa-loader-dot {
                  0%, 80%, 100% { opacity: 0.25; }
                  40% { opacity: 1; }
                }
              `}</style>
              <div
                style={{
                  position: 'fixed',
                  bottom: 24,
                  right: 24,
                  zIndex: 1001,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 20px',
                  borderRadius: 14,
                  background: 'rgba(15,15,25,0.82)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: '0.01em',
                  pointerEvents: 'none',
                  animation: 'pa-loader-pulse 2s ease-in-out infinite, pa-loader-slide-in 0.4s ease-out',
                  border: '1px solid rgba(99,102,241,0.3)',
                }}
                aria-live="polite"
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    border: '2.5px solid rgba(255,255,255,0.2)',
                    borderTopColor: '#818cf8',
                    borderRadius: '50%',
                    animation: 'pa-loader-spin 0.8s linear infinite',
                    flexShrink: 0,
                  }}
                />
                <span>
                  Loading assistant
                  {['0s', '0.15s', '0.3s'].map((delay, i) => (
                    <span
                      key={i}
                      style={{
                        animation: 'pa-loader-dot 1.4s infinite',
                        animationDelay: delay,
                      }}
                    >
                      .
                    </span>
                  ))}
                </span>
              </div>
            </>
          )}
          <div style={{ display: isVisible ? undefined : 'none' }}>
            <AssistantCanvas
              character={character}
              controllerRef={controllerRef}
              isSpeaking={speech.status === 'speaking'}
              containerMode={containerMode}
              width={width}
              height={height}
              className={className}
              onStateChange={handleStateChange}
              onLoaded={() => {
                setIsLoaded(true);
                const section = document.querySelector('main, section');
                if (section) {
                  const gutterX = section.getBoundingClientRect().left / 2;
                  if (gutterX > 10) {
                    controllerRef.current?.snapToViewportX(gutterX);
                  }
                }
              }}
              onCharacterClick={handleClick}
              onCharacterHover={handleHover}
            />
          </div>
          <SpeechBubble
            controllerRef={controllerRef}
            title={bubbleData.title}
            description={bubbleData.description}
            visible={bubbleData.visible && isVisible}
            showPlayButton={bubbleData.showPlayButton}
            speechStatus={speech.status}
            onPlay={handleBubblePlay}
            onStopSpeech={handleBubbleStopSpeech}
            showTourControls={isTourActive}
            stepIndex={currentTourStep}
            stepCount={tourStepCount}
            onPrev={handleBubblePrev}
            onNext={handleBubbleNext}
            onRestart={handleBubbleRestart}
            onStopTour={handleBubbleStopTour}
          />
          <style>{`
            .pa-speech-bubble {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .pa-speech-bubble-inner {
              background: rgba(15, 15, 25, 0.92);
              backdrop-filter: blur(12px);
              -webkit-backdrop-filter: blur(12px);
              border: 1px solid rgba(99, 102, 241, 0.35);
              border-radius: 12px;
              padding: 10px 14px;
              color: #e2e8f0;
              font-size: 13px;
              line-height: 1.5;
              box-shadow: 0 8px 32px rgba(0,0,0,0.4);
              position: relative;
            }
            .pa-speech-bubble-title {
              font-weight: 700;
              font-size: 14px;
              margin-bottom: 4px;
              color: #fff;
            }
            .pa-speech-bubble-desc {
              color: #cbd5e1;
              font-size: 12.5px;
            }
            .pa-speech-bubble-actions {
              display: flex;
              align-items: center;
              gap: 4px;
              margin-top: 8px;
              padding-top: 7px;
              border-top: 1px solid rgba(255,255,255,0.08);
            }
            .pa-bubble-btn {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 26px;
              height: 26px;
              border-radius: 6px;
              border: 1px solid rgba(255,255,255,0.12);
              background: rgba(255,255,255,0.06);
              color: #94a3b8;
              cursor: pointer;
              padding: 0;
              transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
              font-family: inherit;
              flex-shrink: 0;
            }
            .pa-bubble-btn:hover {
              background: rgba(255,255,255,0.12);
              color: #e2e8f0;
              border-color: rgba(255,255,255,0.2);
            }
            .pa-bubble-btn-icon {
              border-radius: 50%;
              border-color: rgba(99, 102, 241, 0.5);
              background: rgba(99, 102, 241, 0.15);
              color: #818cf8;
            }
            .pa-bubble-btn-icon:hover {
              background: rgba(99, 102, 241, 0.3);
              color: #a5b4fc;
            }
            .pa-bubble-btn-active {
              border-color: rgba(239, 68, 68, 0.5) !important;
              background: rgba(239, 68, 68, 0.15) !important;
              color: #ef4444 !important;
            }
            .pa-bubble-btn-active:hover {
              background: rgba(239, 68, 68, 0.3) !important;
            }
            .pa-bubble-btn-stop {
              border-color: rgba(239, 68, 68, 0.35);
              color: #f87171;
            }
            .pa-bubble-btn-stop:hover {
              background: rgba(239, 68, 68, 0.2);
              color: #ef4444;
              border-color: rgba(239, 68, 68, 0.5);
            }
            .pa-bubble-btn-disabled {
              opacity: 0.3;
              cursor: default;
              pointer-events: none;
            }
            .pa-bubble-btn-divider {
              width: 1px;
              height: 16px;
              background: rgba(255,255,255,0.1);
              margin: 0 2px;
              flex-shrink: 0;
            }
            .pa-bubble-step-indicator {
              font-size: 10px;
              font-weight: 600;
              color: #64748b;
              letter-spacing: 0.02em;
              min-width: 24px;
              text-align: center;
              flex-shrink: 0;
            }
            .pa-speech-bubble-tail {
              filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
            }
          `}</style>
        </>
      )}
    </PageAssistantContext.Provider>
  );
}
