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
  WalkOptions,
} from './types';
import { CHARACTERS, DEFAULT_CHARACTER_ID, type CharacterDefinition } from './constants';

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
  const followCursorRef = useRef(false);
  const walkingToClickRef = useRef(false);

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

      const target = e.target as HTMLElement;
      if (target.closest('[data-page-assistant-canvas]')) return;
      if (target.closest('button, a, input, select, textarea, label, [role="button"]')) return;

      walkingToClickRef.current = true;
      controllerRef.current?.walkToScreen(e.clientX, e.clientY).then(() => {
        walkingToClickRef.current = false;
      });
    };

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [isLoaded, isVisible]);

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

      lookForward: () => {
        followCursorRef.current = false;
        setIsFollowingCursor(false);
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
    };
  }, [clearGestureTimeouts, currentState, isFollowingCursor, isVisible, scheduleReturnToIdle]);

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
        </>
      )}
    </PageAssistantContext.Provider>
  );
}
