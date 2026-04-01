import { useEffect, useRef, useState, useCallback, type CSSProperties, type MutableRefObject } from 'react';
import type { AssistantController } from './types';
import type { SpeechStatus } from '@unopsitg/page-assistant-core';

interface SpeechBubbleProps {
  controllerRef: MutableRefObject<AssistantController | null>;
  title?: string;
  description?: string;
  visible: boolean;
  showPlayButton?: boolean;
  speechStatus: SpeechStatus;
  onPlay?: () => void;
  onStopSpeech?: () => void;
  showTourControls?: boolean;
  stepIndex?: number;
  stepCount?: number;
  onPrev?: () => void;
  onNext?: () => void;
  onRestart?: () => void;
  onStopTour?: () => void;
}

const BUBBLE_MAX_WIDTH = 300;
const VIEWPORT_PADDING = 12;
const GAP_FROM_HEAD = 16;
const TAIL_SIZE = 10;

type BubbleSide = 'right' | 'left';

export function SpeechBubble({
  controllerRef,
  title,
  description,
  visible,
  showPlayButton,
  speechStatus,
  onPlay,
  onStopSpeech,
  showTourControls,
  stepIndex = 0,
  stepCount = 0,
  onPrev,
  onNext,
  onRestart,
  onStopTour,
}: SpeechBubbleProps) {
  const [mounted, setMounted] = useState(false);
  const [animIn, setAnimIn] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tailRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const sideRef = useRef<BubbleSide>('right');

  const trackHead = useCallback(() => {
    const el = containerRef.current;
    const tail = tailRef.current;
    const headPos = controllerRef.current?.getHeadScreenPosition();
    if (el && tail && headPos) {
      const elRect = el.getBoundingClientRect();
      const bubbleW = elRect.width || BUBBLE_MAX_WIDTH;
      const bubbleH = elRect.height || 60;

      let side: BubbleSide = 'right';
      let x = headPos.x + GAP_FROM_HEAD + TAIL_SIZE;
      if (x + bubbleW > window.innerWidth - VIEWPORT_PADDING) {
        side = 'left';
        x = headPos.x - GAP_FROM_HEAD - TAIL_SIZE - bubbleW;
      }
      if (x < VIEWPORT_PADDING) {
        x = VIEWPORT_PADDING;
        side = 'right';
      }
      sideRef.current = side;

      let y = headPos.y - bubbleH / 2;
      if (y < VIEWPORT_PADDING) y = VIEWPORT_PADDING;
      if (y + bubbleH > window.innerHeight - VIEWPORT_PADDING) {
        y = window.innerHeight - VIEWPORT_PADDING - bubbleH;
      }

      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.transform = 'none';

      const tailY = headPos.y - y;
      const clampedTailY = Math.max(10, Math.min(bubbleH - 18, tailY - TAIL_SIZE / 2));

      if (side === 'right') {
        tail.style.left = `${-TAIL_SIZE}px`;
        tail.style.right = '';
        tail.style.top = `${clampedTailY}px`;
        tail.style.borderTop = `${TAIL_SIZE}px solid transparent`;
        tail.style.borderBottom = `${TAIL_SIZE}px solid transparent`;
        tail.style.borderRight = `${TAIL_SIZE}px solid rgba(15, 15, 25, 0.92)`;
        tail.style.borderLeft = 'none';
      } else {
        tail.style.right = `${-TAIL_SIZE}px`;
        tail.style.left = '';
        tail.style.top = `${clampedTailY}px`;
        tail.style.borderTop = `${TAIL_SIZE}px solid transparent`;
        tail.style.borderBottom = `${TAIL_SIZE}px solid transparent`;
        tail.style.borderLeft = `${TAIL_SIZE}px solid rgba(15, 15, 25, 0.92)`;
        tail.style.borderRight = 'none';
      }
    }
    rafRef.current = requestAnimationFrame(trackHead);
  }, [controllerRef]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      rafRef.current = requestAnimationFrame(trackHead);
      const t = requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimIn(true));
      });
      return () => {
        cancelAnimationFrame(rafRef.current);
        cancelAnimationFrame(t);
      };
    } else {
      setAnimIn(false);
      const t = setTimeout(() => {
        cancelAnimationFrame(rafRef.current);
        setMounted(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [visible, trackHead]);

  if (!mounted) return null;
  if (!title && !description) return null;

  const isSpeaking = speechStatus === 'speaking';
  const hasPrev = stepIndex > 0;
  const hasNext = stepIndex < stepCount - 1;

  const style: CSSProperties = {
    position: 'fixed',
    left: -9999,
    top: -9999,
    maxWidth: BUBBLE_MAX_WIDTH,
    zIndex: 1050,
    pointerEvents: 'auto',
    opacity: animIn ? 1 : 0,
    transition: 'opacity 0.25s ease',
  };

  return (
    <div ref={containerRef} style={style} className="pa-speech-bubble" data-pa-speech-bubble onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div className="pa-speech-bubble-inner">
        {title && <div className="pa-speech-bubble-title">{title}</div>}
        {description && <div className="pa-speech-bubble-desc">{description}</div>}

        {(showTourControls || showPlayButton) && (
          <div className="pa-speech-bubble-actions">
            {showPlayButton && (
              <button
                type="button"
                className={`pa-bubble-btn pa-bubble-btn-icon${isSpeaking ? ' pa-bubble-btn-active' : ''}`}
                onClick={isSpeaking ? onStopSpeech : onPlay}
                aria-label={isSpeaking ? 'Stop speaking' : 'Play speech'}
                title={isSpeaking ? 'Stop' : 'Listen'}
              >
                {isSpeaking ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z" /></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v7a4.49 4.49 0 002.5-3.5zM14 3.23v2.06a6.51 6.51 0 010 13.42v2.06A8.5 8.5 0 0014 3.23z" /></svg>
                )}
              </button>
            )}

            {showTourControls && (
              <>
                <div className="pa-bubble-btn-divider" />
                <button type="button" className="pa-bubble-btn" onClick={onRestart} aria-label="Restart tour" title="Restart">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35A7.96 7.96 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" /></svg>
                </button>
                <button type="button" className={`pa-bubble-btn${!hasPrev ? ' pa-bubble-btn-disabled' : ''}`} onClick={hasPrev ? onPrev : undefined} disabled={!hasPrev} aria-label="Previous step" title="Prev">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>
                </button>
                <span className="pa-bubble-step-indicator">{stepIndex + 1}/{stepCount}</span>
                <button type="button" className={`pa-bubble-btn${!hasNext ? ' pa-bubble-btn-disabled' : ''}`} onClick={hasNext ? onNext : undefined} disabled={!hasNext} aria-label="Next step" title="Next">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
                </button>
                <button type="button" className="pa-bubble-btn pa-bubble-btn-stop" onClick={onStopTour} aria-label="Stop tour" title="Stop">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <div
        ref={tailRef}
        className="pa-speech-bubble-tail"
        style={{ position: 'absolute', width: 0, height: 0 }}
      />
    </div>
  );
}
