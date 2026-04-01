export const LOADING_KEYFRAMES = `
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
}`;

export const SPEECH_BUBBLE_STYLES = `
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
}`;
