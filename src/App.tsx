import { useCallback, useEffect, useRef, useState } from 'react';
import { PageAssistantProvider, usePageAssistant } from '@unopsitg/page-assistant-react';
import { CHARACTERS, DEFAULT_CHARACTER_ID, voiceTag as voiceTagFn } from '@unopsitg/page-assistant-core';
import type { TourConfig, TourStep, TourStepAction, VoicePreference } from '@unopsitg/page-assistant-core';
import './App.css';

type ThemeId = 'midnight' | 'light' | 'grey';

const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'midnight', label: 'Midnight' },
  { id: 'light', label: 'Light' },
  { id: 'grey', label: 'Grey' },
];

const CHARACTER_OPTIONS = Object.values(CHARACTERS).sort((a, b) => a.label.localeCompare(b.label));

const TARGET_OPTIONS = [
  { label: 'Features', selector: '#features' },
  { label: 'Pricing', selector: '#pricing' },
  { label: 'Feature 1', selector: '#feature-1' },
  { label: 'Feature 2', selector: '#feature-2' },
  { label: 'Feature 3', selector: '#feature-3' },
  { label: 'Feature 4', selector: '#feature-4' },
];

function App() {
  const [characterId, setCharacterId] = useState(DEFAULT_CHARACTER_ID);
  const [theme, setTheme] = useState<ThemeId>('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <PageAssistantProvider key={characterId} characterId={characterId} stickyHeaderSelector=".site-header">
      <DemoContent
        characterId={characterId}
        onCharacterChange={setCharacterId}
        theme={theme}
        onThemeChange={setTheme}
      />
    </PageAssistantProvider>
  );
}

interface DemoContentProps {
  characterId: string;
  onCharacterChange: (id: string) => void;
  theme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
}

type ControlTab = 'actions' | 'tour';
type TourViewMode = 'visual' | 'json';

function buildDefaultTourJson(name: string): string {
  const config: TourConfig = {
    showSpeechBubble: true,
    speechEnabled: true,
    autoSpeak: true,
    defaultVoice: { lang: 'en-US', quality: 'neural' },
    steps: [
      {
        element: '.hero',
        action: 'walkTo',
        popover: {
          title: 'Welcome!',
          description: `Hi! I'm ${name}, your page assistant. Let me show you around!`,
        },
        duration: 2000,
      },
      {
        element: '#features',
        action: 'walkTo',
        popover: {
          title: 'Features',
          description: `Here are the features that make ${name} special. Walk, point, wave — it's all built in.`,
        },
        duration: 2500,
      },
      {
        element: '#feature-1',
        action: 'pointAt',
        walkTo: true,
        popover: {
          title: 'Spatial Awareness',
          description: `${name} can walk to any element on your page using CSS selectors.`,
        },
        duration: 3000,
      },
      {
        element: '#pricing',
        action: 'walkTo',
        popover: {
          title: 'Pricing',
          description: 'Every plan is free. Seriously. Zero dollars. We checked.',
        },
        duration: 2500,
      },
      {
        action: 'wave',
        popover: {
          title: 'That\'s the tour!',
          description: 'Thanks for watching! Click any of the controls below to try the API yourself.',
        },
        duration: 2000,
      },
      {
        action: 'dance',
        popover: {
          title: 'Dance',
          description: 'Dance like a pro and show your skills!',
        },
        duration: 4000,
      },
    ],
  };
  return JSON.stringify(config, null, 2);
}

function DemoContent({ characterId, onCharacterChange, theme, onThemeChange }: DemoContentProps) {
  const assistant = usePageAssistant();
  const [state, setState] = useState(assistant.currentState);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [controlTab, setControlTab] = useState<ControlTab>('actions');

  const activeCharacter = CHARACTERS[characterId];
  const characterName = activeCharacter?.label ?? 'Assistant';
  const pronoun = activeCharacter?.sex === 'male' ? 'him' : 'her';

  const [actionTarget, setActionTarget] = useState('#features');
  const [voiceOpen, setVoiceOpen] = useState(false);

  const [tourJson, setTourJson] = useState(() => buildDefaultTourJson(characterName));
  const [tourJsonError, setTourJsonError] = useState('');
  const [tourViewMode, setTourViewMode] = useState<TourViewMode>('visual');
  const [popupView, setPopupView] = useState<'visual' | 'json' | null>(null);
  const [voiceMode, setVoiceMode] = useState<'preference' | 'exact'>('preference');
  const [voicePref, setVoicePref] = useState<VoicePreference>({ lang: 'en-US', quality: 'neural' });
  const [exactVoiceName, setExactVoiceName] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const tourJsonRef = useRef(tourJson);
  tourJsonRef.current = tourJson;

  const availableLangs = Array.from(new Set(voices.map((v) => v.lang))).sort();

  const voicesByQuality = (() => {
    const groups: Record<string, SpeechSynthesisVoice[]> = {};
    const order = ['Neural', 'Online', 'Network', 'Standard'];
    for (const tier of order) groups[tier] = [];
    for (const v of voices) {
      const tag = voiceTagFn(v);
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push(v);
    }
    return order.filter((t) => groups[t].length > 0).map((t) => ({ tier: t, voices: groups[t] }));
  })();

  useEffect(() => {
    setTourJson(buildDefaultTourJson(characterName));
  }, [characterName]);

  useEffect(() => {
    setTourJson((prev) => {
      try {
        const obj = JSON.parse(prev);
        if (obj && typeof obj === 'object') {
          if (voiceMode === 'exact' && exactVoiceName) {
            obj.defaultVoice = exactVoiceName;
          } else {
            const cleaned: VoicePreference = {};
            if (voicePref.lang) cleaned.lang = voicePref.lang;
            if (voicePref.gender) cleaned.gender = voicePref.gender;
            if (voicePref.quality && voicePref.quality !== 'any') cleaned.quality = voicePref.quality;
            obj.defaultVoice = Object.keys(cleaned).length > 0 ? cleaned : undefined;
          }
          return JSON.stringify(obj, null, 2);
        }
      } catch { /* leave JSON as-is if invalid */ }
      return prev;
    });
  }, [voicePref, voiceMode, exactVoiceName]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const load = () => {
      const v = speechSynthesis.getVoices();
      if (v.length > 0) setVoices(v);
    };
    load();
    speechSynthesis.addEventListener('voiceschanged', load);
    return () => speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  useEffect(() => {
    setState(assistant.currentState);
    return assistant.onStateChange(setState);
  }, [assistant]);

  const run = useCallback((fn: () => void | Promise<void>) => {
    void fn();
  }, []);

  const toggleVisibility = useCallback(() => {
    if (state === 'hidden' || !assistant.isVisible) {
      assistant.show();
    } else {
      assistant.hide();
    }
  }, [assistant, state]);

  const isHidden = state === 'hidden';

  const handlePlayTour = useCallback(() => {
    try {
      const parsed = JSON.parse(tourJsonRef.current) as TourConfig;
      setTourJsonError('');
      assistant.startTour(parsed);
    } catch (err) {
      setTourJsonError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }, [assistant]);

  const handleStopTour = useCallback(() => {
    assistant.stopTour();
  }, [assistant]);

  const TOUR_ACTIONS: TourStepAction[] = ['walkTo', 'pointAt', 'wave', 'talk', 'dance', 'idle'];

  const parsedConfig = (() => {
    try {
      const obj = JSON.parse(tourJson);
      if (obj && typeof obj === 'object' && Array.isArray(obj.steps)) return obj as TourConfig;
    } catch { /* invalid JSON */ }
    return null;
  })();

  const updateConfig = useCallback((updater: (config: TourConfig) => TourConfig) => {
    setTourJson((prev) => {
      try {
        const obj = JSON.parse(prev) as TourConfig;
        const updated = updater(obj);
        return JSON.stringify(updated, null, 2);
      } catch { return prev; }
    });
    setTourJsonError('');
  }, []);

  const updateStep = useCallback((index: number, patch: Partial<TourStep>) => {
    updateConfig((config) => ({
      ...config,
      steps: config.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }, [updateConfig]);

  const updateStepPopover = useCallback((index: number, field: 'title' | 'description', value: string) => {
    updateConfig((config) => ({
      ...config,
      steps: config.steps.map((s, i) =>
        i === index ? { ...s, popover: { ...s.popover, [field]: value || undefined } } : s
      ),
    }));
  }, [updateConfig]);

  const removeStep = useCallback((index: number) => {
    updateConfig((config) => ({
      ...config,
      steps: config.steps.filter((_, i) => i !== index),
    }));
  }, [updateConfig]);

  const moveStep = useCallback((index: number, direction: -1 | 1) => {
    updateConfig((config) => {
      const steps = [...config.steps];
      const target = index + direction;
      if (target < 0 || target >= steps.length) return config;
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...config, steps };
    });
  }, [updateConfig]);

  const addStep = useCallback(() => {
    updateConfig((config) => ({
      ...config,
      steps: [...config.steps, { action: 'wave', popover: { title: '', description: '' }, duration: 2000 }],
    }));
  }, [updateConfig]);

  return (
    <div className="demo-root">
      <span className="state-badge" aria-live="polite">
        {state}
      </span>

      <header className="site-header">
        <nav className="nav-inner" aria-label="Primary">
          <span className="logo-mark">{characterName}</span>
          <a className="nav-link nav-link-collapse" href="#features">
            Features
          </a>
          <a className="nav-link nav-link-collapse" href="#pricing">
            Pricing
          </a>
          <a className="nav-link nav-link-collapse" href="#controls">
            Controls
          </a>
          <div className="nav-theme" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`nav-theme-btn${t.id === theme ? ' nav-theme-btn-active' : ''}`}
                onClick={() => onThemeChange(t.id)}
                aria-pressed={t.id === theme}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-glow" aria-hidden />
          <div className="hero-inner">
            <p className="hero-eyebrow">Animated Page Assistant</p>
            <h1 id="hero-title" className="hero-title">
              Meet <InlineCharacterPicker
                characterId={characterId}
                onChange={onCharacterChange}
              />, Your Page Assistant
            </h1>
            <p className="hero-subtitle">
              An animated guide who walks your page, points at what matters, and reacts to your visitors — all in
              real time, right in the browser.
            </p>
            <div className="hero-cta">
              <a className="btn btn-primary" href="#features">
                Explore features
              </a>
              <a className="btn btn-ghost" href="#pricing">
                See pricing
              </a>
            </div>
            <p className="hero-hint">Click on {characterName} to see {pronoun} dance!</p>
            <p className="hero-hint">Click anywhere on the page to walk {characterName} there.</p>
          </div>
        </section>

        <section id="features" className="section features" aria-labelledby="features-title">
          <div className="container">
            <h2 id="features-title" className="section-title">
              Built for memorable pages
            </h2>
            <p className="section-lead">
              Scroll, walk, and point — {characterName} connects your UI to a living character without leaving your UI framework.
            </p>
            <div className="feature-grid">
              <article id="feature-1" className="feature-card">
                <span className="feature-icon" aria-hidden>
                  ◎
                </span>
                <h3 className="feature-name">Spatial awareness</h3>
                <p className="feature-desc">
                  Walk to any element by selector or ref. {characterName} navigates your layout like part of the scene.
                </p>
              </article>
              <article id="feature-2" className="feature-card">
                <span className="feature-icon" aria-hidden>
                  ↗
                </span>
                <h3 className="feature-name">Directed attention</h3>
                <p className="feature-desc">
                  Point at CTAs, plans, or highlights so users know exactly where to look next.
                </p>
              </article>
              <article id="feature-3" className="feature-card">
                <span className="feature-icon" aria-hidden>
                  ✦
                </span>
                <h3 className="feature-name">Expressive gestures</h3>
                <p className="feature-desc">
                  Wave, talk, and dance on cue — or wire your own behavior to clicks and state changes.
                </p>
              </article>
              <article id="feature-4" className="feature-card">
                <span className="feature-icon" aria-hidden>
                  ◇
                </span>
                <h3 className="feature-name">Cursor and gaze</h3>
                <p className="feature-desc">
                  Follow the pointer for a playful feel, or lock forward for a calm, presenter mode.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="pricing" className="section pricing" aria-labelledby="pricing-title">
          <div className="container">
            <h2 id="pricing-title" className="section-title">
              Simple pricing
            </h2>
            <p className="section-lead">Every plan is free. Yes, even the fancy one.</p>
            <div className="pricing-grid">
              <article className="pricing-card">
                <h3 className="pricing-name">Hobbyist</h3>
                <p className="pricing-price">
                  <span className="price-amount">$0</span>
                  <span className="price-unit">/forever</span>
                </p>
                <ul className="pricing-list">
                  <li><a href="https://www.npmjs.com/package/@unopsitg/page-assistant-core" target="_blank" rel="noopener">@unopsitg/page-assistant-core</a></li>
                  <li>Types, constants &amp; utilities</li>
                  <li>Support via vibes</li>
                </ul>
              </article>
              <article className="pricing-card pricing-card-featured">
                <span className="pricing-badge">Popular</span>
                <h3 className="pricing-name">Professional</h3>
                <p className="pricing-price">
                  <span className="price-amount">$0</span>
                  <span className="price-unit">/forever</span>
                </p>
                <ul className="pricing-list">
                  <li><a href="https://www.npmjs.com/package/@unopsitg/page-assistant-web-component" target="_blank" rel="noopener">@unopsitg/page-assistant-web-component</a></li>
                  <li>Works with any framework</li>
                  <li>Onboarding: you got this, champ</li>
                </ul>
              </article>
              <article className="pricing-card">
                <h3 className="pricing-name">Enterprise</h3>
                <p className="pricing-price">
                  <span className="price-amount">$0</span>
                  <span className="price-unit">/forever</span>
                </p>
                <ul className="pricing-list">
                  <li><a href="https://www.npmjs.com/package/@unopsitg/page-assistant-react" target="_blank" rel="noopener">@unopsitg/page-assistant-react</a></li>
                  <li>Custom characters &amp; models</li>
                  <li>SLA: {characterName} believes in you</li>
                </ul>
              </article>
            </div>
            <p className="pricing-cta">
              Everything you see on this page is powered by open-source npm packages. Install them and add {characterName} to your own site today:
              {' '}<a href="https://www.npmjs.com/package/@unopsitg/page-assistant-react" target="_blank" rel="noopener">React</a>
              {' · '}<a href="https://www.npmjs.com/package/@unopsitg/page-assistant-web-component" target="_blank" rel="noopener">Web Component</a>
              {' · '}<a href="https://www.npmjs.com/package/@unopsitg/page-assistant-core" target="_blank" rel="noopener">Core</a>
              {' · '}<a href="https://github.com/tushardighe-builder/page-assistant" target="_blank" rel="noopener">GitHub</a>
            </p>
          </div>
        </section>

        <section id="controls" className="section controls-spacer" aria-label="Control panel anchor" />
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <p>Built by <a href="mailto:tushard@unops.org">Tushar Dighe</a> · <a href="https://github.com/tushardighe-builder/page-assistant" target="_blank" rel="noopener">GitHub</a></p>
        </div>
      </footer>

      {mobileActionsOpen && (
        <div className="mobile-backdrop" onClick={() => setMobileActionsOpen(false)} />
      )}

      <div
        className={`control-panel${mobileActionsOpen ? ' control-panel-expanded' : ''}${desktopCollapsed ? ' control-panel-desktop-collapsed' : ''}`}
        role="region"
        aria-label="Assistant controls"
      >
        <div className="control-panel-inner">
          <div className="control-panel-header">
            <p className="control-panel-label">Try the API</p>
            <div className="quick-actions">
              {assistant.isTourActive ? (
                <>
                  <button type="button" className="quick-btn quick-btn-danger" onClick={handleStopTour}>Stop Tour</button>
                  <span className="tour-step-badge">Step {assistant.currentTourStep + 1}</span>
                </>
              ) : (
                <button type="button" className="quick-btn quick-btn-primary" onClick={handlePlayTour}>&#9654; Tour</button>
              )}
              <button type="button" className={`quick-btn${state === 'waving' ? ' quick-btn-active' : ''}`}
                onClick={() => run(() => assistant.wave({ duration: 2000 }))}>Wave</button>
              <button type="button" className={`quick-btn${state === 'dancing' ? ' quick-btn-active' : ''}`}
                onClick={() => run(() => assistant.dance({ duration: 4000 }))}>Dance</button>
            </div>
            <div className="panel-character-select">
              <span className="panel-character-label">Character</span>
              <select
                className="selector-dropdown"
                value={characterId}
                onChange={(e) => onCharacterChange(e.target.value)}
                aria-label="Character"
              >
                {CHARACTER_OPTIONS.map((ch) => (
                  <option key={ch.id} value={ch.id}>{ch.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="download-glb-btn"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = activeCharacter.modelPath;
                  a.download = `${characterId}.glb`;
                  a.click();
                }}
                aria-label={`Download ${characterName} GLB model`}
                title={`Download ${characterName} .glb`}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 1v9m0 0L5 7m3 3 3-3M2 12v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div className="control-tabs">
              <button type="button" className={`control-tab${controlTab === 'actions' ? ' control-tab-active' : ''}`}
                onClick={() => setControlTab('actions')}>Actions</button>
              <button type="button" className={`control-tab${controlTab === 'tour' ? ' control-tab-active' : ''}`}
                onClick={() => setControlTab('tour')}>Tour</button>
            </div>
            <button
              type="button"
              className="desktop-collapse-trigger"
              onClick={() => setDesktopCollapsed(!desktopCollapsed)}
              aria-expanded={!desktopCollapsed}
              aria-label={desktopCollapsed ? 'Expand panel' : 'Collapse panel'}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d={desktopCollapsed ? 'M6 8l4 4 4-4' : 'M6 12l4-4 4 4'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              className="mobile-expand-trigger"
              onClick={() => setMobileActionsOpen(!mobileActionsOpen)}
              aria-expanded={mobileActionsOpen}
              aria-label={mobileActionsOpen ? 'Collapse panel' : 'Expand panel'}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d={mobileActionsOpen ? 'M6 12l4-4 4 4' : 'M6 8l4 4 4-4'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="control-panel-body">
            {controlTab === 'actions' && (
              <div className="actions-grouped">
                <div className="action-group">
                  <span className="action-group-label">Gestures</span>
                  <div className="action-group-btns">
                    <button type="button" className={`ctrl-btn ctrl-btn-featured${state === 'waving' ? ' ctrl-btn-active' : ''}`}
                      onClick={() => run(() => assistant.wave({ duration: 2000 }))}>Wave</button>
                    <button type="button" className={`ctrl-btn ctrl-btn-featured${state === 'talking' ? ' ctrl-btn-active' : ''}`}
                      onClick={() => run(() => assistant.talk({ duration: 3000 }))}>Talk</button>
                    <button type="button" className={`ctrl-btn ctrl-btn-featured${state === 'dancing' ? ' ctrl-btn-active' : ''}`}
                      onClick={() => run(() => assistant.dance({ duration: 4000 }))}>Dance</button>
                    <button type="button" className={`ctrl-btn${state === 'pointing' ? ' ctrl-btn-active' : ''}`}
                      onClick={() => run(() => assistant.point({ duration: 2500 }))}>Point</button>
                    <button type="button" className="ctrl-btn" onClick={() => assistant.idle()}>Idle</button>
                  </div>
                </div>

                <div className="action-group">
                  <span className="action-group-label">Navigate</span>
                  <div className="action-group-btns">
                    <select className="target-select" value={actionTarget} onChange={(e) => setActionTarget(e.target.value)} aria-label="Target element">
                      {TARGET_OPTIONS.map((t) => (
                        <option key={t.selector} value={t.selector}>{t.label}</option>
                      ))}
                    </select>
                    <button type="button" className={`ctrl-btn${state === 'walking' ? ' ctrl-btn-active' : ''}`}
                      onClick={() => run(() => assistant.walkTo(actionTarget))}>Walk To</button>
                    <button type="button" className={`ctrl-btn${state === 'pointing' ? ' ctrl-btn-active' : ''}`}
                      onClick={() => run(() => assistant.pointAt(actionTarget, { duration: 3000 }))}>Point At</button>
                    <button type="button" className="ctrl-btn"
                      onClick={() => run(() => assistant.pointAt(actionTarget, { walkTo: true, duration: 3000 }))}>Walk &amp; Point</button>
                  </div>
                </div>

                <div className="action-group">
                  <span className="action-group-label">Orientation</span>
                  <div className="action-group-btns">
                    <button type="button" className="ctrl-btn ctrl-btn-secondary" onClick={() => assistant.turnLeft()}>&#8592; Turn Left</button>
                    <button type="button" className="ctrl-btn ctrl-btn-secondary" onClick={() => assistant.turnRight()}>Turn Right &#8594;</button>
                    <button type="button" className="ctrl-btn ctrl-btn-secondary" onClick={() => assistant.straightenUp()}>Straighten Up</button>
                  </div>
                </div>

                <div className="action-group">
                  <span className="action-group-label">Behavior</span>
                  <div className="action-group-btns">
                    <label className={`toggle-switch${assistant.isFollowingCursor ? ' toggle-switch-on' : ''}`}>
                      <span className="toggle-track" />
                      <span>Follow Cursor</span>
                      <input type="checkbox" checked={assistant.isFollowingCursor}
                        onChange={() => assistant.isFollowingCursor ? assistant.lookForward() : assistant.lookAtCursor()} hidden />
                    </label>
                    <label className={`toggle-switch${assistant.isFollowingWithArms ? ' toggle-switch-on' : ''}`}>
                      <span className="toggle-track" />
                      <span>Follow with Arms</span>
                      <input type="checkbox" checked={assistant.isFollowingWithArms}
                        onChange={() => assistant.isFollowingWithArms ? assistant.stopFollowingCursorWithArms() : assistant.followCursorWithArms()} hidden />
                    </label>
                    <button type="button" className="ctrl-btn ctrl-btn-muted" onClick={toggleVisibility}>
                      {isHidden ? 'Show' : 'Hide'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {controlTab === 'tour' && (
              <div className="tour-panel">
                <div className="tour-panel-top">
                  <div className="tour-controls">
                    {assistant.isTourActive ? (
                      <button type="button" className="ctrl-btn ctrl-btn-danger" onClick={handleStopTour}>Stop Tour</button>
                    ) : (
                      <button type="button" className="ctrl-btn ctrl-btn-primary" onClick={handlePlayTour}>Play Tour</button>
                    )}
                    {assistant.isTourActive && (
                      <span className="tour-step-badge">Step {assistant.currentTourStep + 1}</span>
                    )}
                  </div>
                </div>

                {tourJsonError && <div className="tour-json-error">{tourJsonError}</div>}

                {tourViewMode === 'visual' && (
                  parsedConfig ? (
                    <div className="tour-visual-editor">
                      <div className="tour-editor-toolbar">
                        <div className="tour-toolbar-right">
                          <div className="tour-view-tabs">
                            <button type="button" className="tour-view-tab tour-view-tab-active"
                              onClick={() => setTourViewMode('visual')}>Visual</button>
                            <button type="button" className="tour-view-tab"
                              onClick={() => setTourViewMode('json')}>JSON</button>
                          </div>
                          <button type="button" className="tour-expand-btn" onClick={() => setPopupView('visual')} title="Expand editor" aria-label="Expand visual editor">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                          </button>
                        </div>
                      </div>
                      <fieldset className="tour-voice-fieldset tour-voice-visual-compact" disabled={assistant.isTourActive}>
                        <div className="tour-voice-header-row">
                          <button type="button" className={`voice-disclosure-trigger${voiceOpen ? ' voice-disclosure-trigger-open' : ''}`}
                            onClick={() => setVoiceOpen(!voiceOpen)}>
                            <svg className="voice-disclosure-chevron" width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden>
                              <path d="M8 6l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Voice Settings
                          </button>
                          <div className="tour-global-toggles">
                            <label className={`tour-toggle${parsedConfig.showSpeechBubble !== false ? ' tour-toggle-on' : ''}`}>
                              <span className="toggle-track" /><span>Speech Bubble</span>
                              <input type="checkbox" hidden checked={parsedConfig.showSpeechBubble !== false}
                                onChange={(e) => updateConfig((c) => ({ ...c, showSpeechBubble: e.target.checked }))} />
                            </label>
                            <label className={`tour-toggle${parsedConfig.speechEnabled !== false ? ' tour-toggle-on' : ''}`}>
                              <span className="toggle-track" /><span>Speech</span>
                              <input type="checkbox" hidden checked={parsedConfig.speechEnabled !== false}
                                onChange={(e) => updateConfig((c) => ({ ...c, speechEnabled: e.target.checked }))} />
                            </label>
                            <label className={`tour-toggle${parsedConfig.autoSpeak !== false ? ' tour-toggle-on' : ''}`}>
                              <span className="toggle-track" /><span>Auto-Speak</span>
                              <input type="checkbox" hidden checked={parsedConfig.autoSpeak !== false}
                                onChange={(e) => updateConfig((c) => ({ ...c, autoSpeak: e.target.checked }))} />
                            </label>
                          </div>
                        </div>
                        {voiceOpen && (
                          <div className="tour-voice-selector tour-voice-selector-inline">
                            <div className="voice-mode-toggle">
                              <button type="button" className={`voice-mode-btn${voiceMode === 'preference' ? ' voice-mode-btn-active' : ''}`}
                                onClick={() => setVoiceMode('preference')}>Preference</button>
                              <button type="button" className={`voice-mode-btn${voiceMode === 'exact' ? ' voice-mode-btn-active' : ''}`}
                                onClick={() => setVoiceMode('exact')}>Exact Voice</button>
                            </div>
                            {voiceMode === 'preference' ? (
                              <div className="voice-pref-row">
                                <select className="selector-dropdown voice-pref-select" value={voicePref.lang ?? ''}
                                  onChange={(e) => setVoicePref((p: VoicePreference) => ({ ...p, lang: e.target.value || undefined }))} aria-label="Language">
                                  <option value="">Any lang</option>
                                  {availableLangs.map((l) => <option key={l} value={l}>{l}</option>)}
                                </select>
                                <select className="selector-dropdown voice-pref-select" value={voicePref.gender ?? ''}
                                  onChange={(e) => setVoicePref((p: VoicePreference) => ({ ...p, gender: (e.target.value || undefined) as VoicePreference['gender'] }))} aria-label="Gender">
                                  <option value="">Any gender</option>
                                  <option value="female">Female</option>
                                  <option value="male">Male</option>
                                </select>
                                <select className="selector-dropdown voice-pref-select" value={voicePref.quality ?? 'any'}
                                  onChange={(e) => setVoicePref((p: VoicePreference) => ({ ...p, quality: (e.target.value || undefined) as VoicePreference['quality'] }))} aria-label="Quality">
                                  <option value="any">Any quality</option>
                                  <option value="neural">Neural only</option>
                                  <option value="online">Online+</option>
                                </select>
                              </div>
                            ) : (
                              <select className="selector-dropdown" value={exactVoiceName}
                                onChange={(e) => setExactVoiceName(e.target.value)} aria-label="Exact voice">
                                <option value="">Select a voice…</option>
                                {voicesByQuality.map(({ tier, voices: tierVoices }) => (
                                  <optgroup key={tier} label={tier}>
                                    {tierVoices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
                                  </optgroup>
                                ))}
                              </select>
                            )}
                          </div>
                        )}
                      </fieldset>
                      <div className="tour-steps-list">
                        {parsedConfig.steps.map((step, idx) => (
                          <div className="tour-step-card" key={idx}>
                            <div className="tour-step-header">
                              <span className="tour-step-number">{idx + 1}</span>
                              <select className="tour-step-action-select" value={step.action ?? 'walkTo'}
                                onChange={(e) => updateStep(idx, { action: e.target.value as TourStepAction })} disabled={assistant.isTourActive}>
                                {TOUR_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                              </select>
                              <div className="tour-step-actions">
                                <button type="button" className="tour-step-move" disabled={idx === 0 || assistant.isTourActive}
                                  onClick={() => moveStep(idx, -1)} aria-label="Move up" title="Move up">&#9650;</button>
                                <button type="button" className="tour-step-move" disabled={idx === parsedConfig.steps.length - 1 || assistant.isTourActive}
                                  onClick={() => moveStep(idx, 1)} aria-label="Move down" title="Move down">&#9660;</button>
                                <button type="button" className="tour-step-delete" disabled={assistant.isTourActive}
                                  onClick={() => removeStep(idx)} aria-label="Remove step" title="Remove step">&#10005;</button>
                              </div>
                            </div>
                            <div className="tour-step-fields">
                              {(step.action === 'walkTo' || step.action === 'pointAt') && (
                                <label className="tour-step-field">
                                  <span className="tour-field-label">Element</span>
                                  <input type="text" className="tour-field-input" value={step.element ?? ''} placeholder=".selector or #id"
                                    disabled={assistant.isTourActive} onChange={(e) => updateStep(idx, { element: e.target.value || undefined })} />
                                </label>
                              )}
                              <label className="tour-step-field">
                                <span className="tour-field-label">Title</span>
                                <input type="text" className="tour-field-input" value={step.popover?.title ?? ''} placeholder="Step title"
                                  disabled={assistant.isTourActive} onChange={(e) => updateStepPopover(idx, 'title', e.target.value)} />
                              </label>
                              <label className="tour-step-field tour-step-field-wide">
                                <span className="tour-field-label">Description</span>
                                <input type="text" className="tour-field-input" value={step.popover?.description ?? ''} placeholder="Step description"
                                  disabled={assistant.isTourActive} onChange={(e) => updateStepPopover(idx, 'description', e.target.value)} />
                              </label>
                              <label className="tour-step-field tour-step-field-narrow">
                                <span className="tour-field-label">Duration</span>
                                <input type="number" className="tour-field-input" min={0} step={500} value={step.duration ?? ''} placeholder="ms"
                                  disabled={assistant.isTourActive} onChange={(e) => updateStep(idx, { duration: e.target.value ? Number(e.target.value) : undefined })} />
                              </label>
                              {step.action === 'pointAt' && (
                                <label className={`tour-toggle tour-toggle-inline${step.walkTo ? ' tour-toggle-on' : ''}`}>
                                  <span className="toggle-track" /><span>Walk To</span>
                                  <input type="checkbox" hidden checked={!!step.walkTo} disabled={assistant.isTourActive}
                                    onChange={(e) => updateStep(idx, { walkTo: e.target.checked || undefined })} />
                                </label>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="tour-json-error">Invalid JSON — switch to JSON tab to fix syntax errors</div>
                  )
                )}

                {tourViewMode === 'json' && (
                  <div className="tour-json-section">
                    <div className="tour-json-toolbar">
                      <div className="tour-toolbar-right">
                        <div className="tour-view-tabs">
                          <button type="button" className="tour-view-tab"
                            onClick={() => setTourViewMode('visual')}>Visual</button>
                          <button type="button" className="tour-view-tab tour-view-tab-active"
                            onClick={() => setTourViewMode('json')}>JSON</button>
                        </div>
                        <button type="button" className="tour-expand-btn" onClick={() => setPopupView('json')} title="Expand editor" aria-label="Expand JSON editor">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                        </button>
                      </div>
                    </div>
                    <fieldset className="tour-voice-fieldset tour-voice-visual-compact" disabled={assistant.isTourActive}>
                      <div className="tour-voice-header-row">
                        <button type="button" className={`voice-disclosure-trigger${voiceOpen ? ' voice-disclosure-trigger-open' : ''}`}
                          onClick={() => setVoiceOpen(!voiceOpen)}>
                          <svg className="voice-disclosure-chevron" width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden>
                            <path d="M8 6l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Voice Settings
                        </button>
                        {parsedConfig && (
                          <div className="tour-global-toggles">
                            <label className={`tour-toggle${parsedConfig.showSpeechBubble !== false ? ' tour-toggle-on' : ''}`}>
                              <span className="toggle-track" /><span>Speech Bubble</span>
                              <input type="checkbox" hidden checked={parsedConfig.showSpeechBubble !== false}
                                onChange={(e) => updateConfig((c) => ({ ...c, showSpeechBubble: e.target.checked }))} />
                            </label>
                            <label className={`tour-toggle${parsedConfig.speechEnabled !== false ? ' tour-toggle-on' : ''}`}>
                              <span className="toggle-track" /><span>Speech</span>
                              <input type="checkbox" hidden checked={parsedConfig.speechEnabled !== false}
                                onChange={(e) => updateConfig((c) => ({ ...c, speechEnabled: e.target.checked }))} />
                            </label>
                            <label className={`tour-toggle${parsedConfig.autoSpeak !== false ? ' tour-toggle-on' : ''}`}>
                              <span className="toggle-track" /><span>Auto-Speak</span>
                              <input type="checkbox" hidden checked={parsedConfig.autoSpeak !== false}
                                onChange={(e) => updateConfig((c) => ({ ...c, autoSpeak: e.target.checked }))} />
                            </label>
                          </div>
                        )}
                      </div>
                      {voiceOpen && (
                        <div className="tour-voice-selector tour-voice-selector-inline">
                          <div className="voice-mode-toggle">
                            <button type="button" className={`voice-mode-btn${voiceMode === 'preference' ? ' voice-mode-btn-active' : ''}`}
                              onClick={() => setVoiceMode('preference')}>Preference</button>
                            <button type="button" className={`voice-mode-btn${voiceMode === 'exact' ? ' voice-mode-btn-active' : ''}`}
                              onClick={() => setVoiceMode('exact')}>Exact Voice</button>
                          </div>
                          {voiceMode === 'preference' ? (
                            <div className="voice-pref-row">
                              <select className="selector-dropdown voice-pref-select" value={voicePref.lang ?? ''}
                                onChange={(e) => setVoicePref((p: VoicePreference) => ({ ...p, lang: e.target.value || undefined }))} aria-label="Language">
                                <option value="">Any lang</option>
                                {availableLangs.map((l) => <option key={l} value={l}>{l}</option>)}
                              </select>
                              <select className="selector-dropdown voice-pref-select" value={voicePref.gender ?? ''}
                                onChange={(e) => setVoicePref((p: VoicePreference) => ({ ...p, gender: (e.target.value || undefined) as VoicePreference['gender'] }))} aria-label="Gender">
                                <option value="">Any gender</option>
                                <option value="female">Female</option>
                                <option value="male">Male</option>
                              </select>
                              <select className="selector-dropdown voice-pref-select" value={voicePref.quality ?? 'any'}
                                onChange={(e) => setVoicePref((p: VoicePreference) => ({ ...p, quality: (e.target.value || undefined) as VoicePreference['quality'] }))} aria-label="Quality">
                                <option value="any">Any quality</option>
                                <option value="neural">Neural only</option>
                                <option value="online">Online+</option>
                              </select>
                            </div>
                          ) : (
                            <select className="selector-dropdown" value={exactVoiceName}
                              onChange={(e) => setExactVoiceName(e.target.value)} aria-label="Exact voice">
                              <option value="">Select a voice…</option>
                              {voicesByQuality.map(({ tier, voices: tierVoices }) => (
                                <optgroup key={tier} label={tier}>
                                  {tierVoices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
                                </optgroup>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </fieldset>
                    <textarea className="tour-json-editor" value={tourJson}
                      onChange={(e) => { setTourJson(e.target.value); setTourJsonError(''); }}
                      spellCheck={false} rows={5} disabled={assistant.isTourActive} aria-label="Tour JSON configuration" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {popupView && (
        <div className="tour-popup-overlay" onClick={() => setPopupView(null)}>
          <div className="tour-popup" onClick={(e) => e.stopPropagation()}>
            <div className="tour-popup-header">
              <span className="tour-popup-title">{popupView === 'visual' ? 'Tour Steps' : 'Tour JSON'}</span>
              <button type="button" className="tour-popup-close" onClick={() => setPopupView(null)} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="tour-popup-body">
              {popupView === 'visual' && parsedConfig && (
                <div className="tour-visual-editor tour-visual-editor-popup">
                  <fieldset className="tour-toggles-fieldset" disabled={assistant.isTourActive}>
                    <div className="tour-global-toggles">
                      <label className={`tour-toggle${parsedConfig.showSpeechBubble !== false ? ' tour-toggle-on' : ''}`}>
                        <span className="toggle-track" />
                        <span>Speech Bubble</span>
                        <input type="checkbox" hidden checked={parsedConfig.showSpeechBubble !== false}
                          onChange={(e) => updateConfig((c) => ({ ...c, showSpeechBubble: e.target.checked }))} />
                      </label>
                      <label className={`tour-toggle${parsedConfig.speechEnabled !== false ? ' tour-toggle-on' : ''}`}>
                        <span className="toggle-track" />
                        <span>Speech</span>
                        <input type="checkbox" hidden checked={parsedConfig.speechEnabled !== false}
                          onChange={(e) => updateConfig((c) => ({ ...c, speechEnabled: e.target.checked }))} />
                      </label>
                      <label className={`tour-toggle${parsedConfig.autoSpeak !== false ? ' tour-toggle-on' : ''}`}>
                        <span className="toggle-track" />
                        <span>Auto-Speak</span>
                        <input type="checkbox" hidden checked={parsedConfig.autoSpeak !== false}
                          onChange={(e) => updateConfig((c) => ({ ...c, autoSpeak: e.target.checked }))} />
                      </label>
                    </div>
                  </fieldset>
                  <fieldset className="tour-voice-fieldset" disabled={assistant.isTourActive}>
                    <div className="tour-voice-selector">
                      <div className="voice-section-label">Voice Settings</div>
                      <div className="voice-mode-toggle">
                        <button type="button" className={`voice-mode-btn${voiceMode === 'preference' ? ' voice-mode-btn-active' : ''}`}
                          onClick={() => setVoiceMode('preference')}>Preference</button>
                        <button type="button" className={`voice-mode-btn${voiceMode === 'exact' ? ' voice-mode-btn-active' : ''}`}
                          onClick={() => setVoiceMode('exact')}>Exact Voice</button>
                      </div>
                      {voiceMode === 'preference' ? (
                        <div className="voice-pref-row">
                          <select className="selector-dropdown voice-pref-select" value={voicePref.lang ?? ''}
                            onChange={(e) => setVoicePref((p: VoicePreference) => ({ ...p, lang: e.target.value || undefined }))} aria-label="Language">
                            <option value="">Any lang</option>
                            {availableLangs.map((l) => <option key={l} value={l}>{l}</option>)}
                          </select>
                          <select className="selector-dropdown voice-pref-select" value={voicePref.gender ?? ''}
                            onChange={(e) => setVoicePref((p: VoicePreference) => ({ ...p, gender: (e.target.value || undefined) as VoicePreference['gender'] }))} aria-label="Gender">
                            <option value="">Any gender</option>
                            <option value="female">Female</option>
                            <option value="male">Male</option>
                          </select>
                          <select className="selector-dropdown voice-pref-select" value={voicePref.quality ?? 'any'}
                            onChange={(e) => setVoicePref((p: VoicePreference) => ({ ...p, quality: (e.target.value || undefined) as VoicePreference['quality'] }))} aria-label="Quality">
                            <option value="any">Any quality</option>
                            <option value="neural">Neural only</option>
                            <option value="online">Online+</option>
                          </select>
                        </div>
                      ) : (
                        <select className="selector-dropdown" value={exactVoiceName}
                          onChange={(e) => setExactVoiceName(e.target.value)} aria-label="Exact voice">
                          <option value="">Select a voice…</option>
                          {voicesByQuality.map(({ tier, voices: tierVoices }) => (
                            <optgroup key={tier} label={tier}>
                              {tierVoices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
                            </optgroup>
                          ))}
                        </select>
                      )}
                    </div>
                  </fieldset>
                  <div className="tour-steps-list tour-steps-list-popup">
                    {parsedConfig.steps.map((step, idx) => (
                      <div className="tour-step-card" key={idx}>
                        <div className="tour-step-header">
                          <span className="tour-step-number">{idx + 1}</span>
                          <select
                            className="tour-step-action-select"
                            value={step.action ?? 'walkTo'}
                            onChange={(e) => updateStep(idx, { action: e.target.value as TourStepAction })}
                            disabled={assistant.isTourActive}
                          >
                            {TOUR_ACTIONS.map((a) => (
                              <option key={a} value={a}>{a}</option>
                            ))}
                          </select>
                          <div className="tour-step-actions">
                            <button type="button" className="tour-step-move" disabled={idx === 0 || assistant.isTourActive}
                              onClick={() => moveStep(idx, -1)} aria-label="Move up" title="Move up">&#9650;</button>
                            <button type="button" className="tour-step-move" disabled={idx === parsedConfig.steps.length - 1 || assistant.isTourActive}
                              onClick={() => moveStep(idx, 1)} aria-label="Move down" title="Move down">&#9660;</button>
                            <button type="button" className="tour-step-delete" disabled={assistant.isTourActive}
                              onClick={() => removeStep(idx)} aria-label="Remove step" title="Remove step">&#10005;</button>
                          </div>
                        </div>
                        <div className="tour-step-fields">
                          {(step.action === 'walkTo' || step.action === 'pointAt') && (
                            <label className="tour-step-field">
                              <span className="tour-field-label">Element</span>
                              <input type="text" className="tour-field-input"
                                value={step.element ?? ''} placeholder=".selector or #id"
                                disabled={assistant.isTourActive}
                                onChange={(e) => updateStep(idx, { element: e.target.value || undefined })} />
                            </label>
                          )}
                          <label className="tour-step-field">
                            <span className="tour-field-label">Title</span>
                            <input type="text" className="tour-field-input"
                              value={step.popover?.title ?? ''} placeholder="Step title"
                              disabled={assistant.isTourActive}
                              onChange={(e) => updateStepPopover(idx, 'title', e.target.value)} />
                          </label>
                          <label className="tour-step-field tour-step-field-wide">
                            <span className="tour-field-label">Description</span>
                            <input type="text" className="tour-field-input"
                              value={step.popover?.description ?? ''} placeholder="Step description"
                              disabled={assistant.isTourActive}
                              onChange={(e) => updateStepPopover(idx, 'description', e.target.value)} />
                          </label>
                          <label className="tour-step-field tour-step-field-narrow">
                            <span className="tour-field-label">Duration</span>
                            <input type="number" className="tour-field-input" min={0} step={500}
                              value={step.duration ?? ''} placeholder="ms"
                              disabled={assistant.isTourActive}
                              onChange={(e) => updateStep(idx, { duration: e.target.value ? Number(e.target.value) : undefined })} />
                          </label>
                          {step.action === 'pointAt' && (
                            <label className={`tour-toggle tour-toggle-inline${step.walkTo ? ' tour-toggle-on' : ''}`}>
                              <span className="toggle-track" />
                              <span>Walk To</span>
                              <input type="checkbox" hidden checked={!!step.walkTo}
                                disabled={assistant.isTourActive}
                                onChange={(e) => updateStep(idx, { walkTo: e.target.checked || undefined })} />
                            </label>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="ctrl-btn tour-add-step" disabled={assistant.isTourActive} onClick={addStep}>
                    + Add Step
                  </button>
                </div>
              )}
              {popupView === 'json' && (
                <textarea
                  className="tour-json-editor tour-json-editor-popup"
                  value={tourJson}
                  onChange={(e) => {
                    setTourJson(e.target.value);
                    setTourJsonError('');
                  }}
                  spellCheck={false}
                  disabled={assistant.isTourActive}
                  aria-label="Tour JSON configuration"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface InlineCharacterPickerProps {
  characterId: string;
  onChange: (id: string) => void;
}

function InlineCharacterPicker({ characterId, onChange }: InlineCharacterPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const activeCharacter = CHARACTERS[characterId];
  const characterName = activeCharacter?.label ?? 'Assistant';

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <span className="hero-name-picker" ref={ref}>
      <button
        type="button"
        className="hero-name-btn"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {characterName}
        <svg className="hero-name-chevron" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="hero-name-dropdown" role="listbox" aria-label="Select character">
          {CHARACTER_OPTIONS.map((ch) => (
            <li key={ch.id} role="option" aria-selected={ch.id === characterId}>
              <button
                type="button"
                className={`hero-name-option${ch.id === characterId ? ' hero-name-option-active' : ''}`}
                onClick={() => { onChange(ch.id); setOpen(false); }}
              >
                {ch.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

export default App;
