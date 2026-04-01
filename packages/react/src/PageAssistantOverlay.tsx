import { AssistantCanvas } from './AssistantCanvas';
import { SpeechBubble } from './SpeechBubble';
import { LOADING_KEYFRAMES, SPEECH_BUBBLE_STYLES } from './styles';
import type { PageAssistantEngine } from './usePageAssistantEngine';

export function PageAssistantOverlay(engine: PageAssistantEngine) {
  const {
    controllerRef,
    character,
    isLoaded,
    isVisible,
    suppressCanvas,
    speechStatus,
    onCanvasStateChange,
    onCanvasLoaded,
    onCharacterClick,
    onCharacterHover,
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
  } = engine;

  if (suppressCanvas) return null;

  return (
    <>
      {isVisible && !isLoaded && (
        <>
          <style>{LOADING_KEYFRAMES}</style>
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
          isSpeaking={speechStatus === 'speaking'}
          containerMode={containerMode}
          width={width}
          height={height}
          className={className}
          onStateChange={onCanvasStateChange}
          onLoaded={onCanvasLoaded}
          onCharacterClick={onCharacterClick}
          onCharacterHover={onCharacterHover}
        />
      </div>
      <SpeechBubble
        controllerRef={controllerRef}
        title={bubbleData.title}
        description={bubbleData.description}
        visible={bubbleData.visible && isVisible}
        showPlayButton={bubbleData.showPlayButton}
        speechStatus={speechStatus}
        onPlay={onBubblePlay}
        onStopSpeech={onBubbleStopSpeech}
        showTourControls={isTourActive}
        stepIndex={currentTourStep}
        stepCount={tourStepCount}
        onPrev={onBubblePrev}
        onNext={onBubbleNext}
        onRestart={onBubbleRestart}
        onStopTour={onBubbleStopTour}
      />
      <style>{SPEECH_BUBBLE_STYLES}</style>
    </>
  );
}
