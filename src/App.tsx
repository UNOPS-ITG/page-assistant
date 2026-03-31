import { useCallback, useEffect, useRef, useState } from 'react';
import { PageAssistantProvider, usePageAssistant } from './components/PageAssistant';
import { CHARACTERS, DEFAULT_CHARACTER_ID } from './components/PageAssistant/constants';
import './App.css';

type ThemeId = 'midnight' | 'light' | 'grey';

const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'midnight', label: 'Midnight' },
  { id: 'light', label: 'Light' },
  { id: 'grey', label: 'Grey' },
];

const CHARACTER_OPTIONS = Object.values(CHARACTERS).sort((a, b) => a.label.localeCompare(b.label));

function App() {
  const [characterId, setCharacterId] = useState(DEFAULT_CHARACTER_ID);
  const [theme, setTheme] = useState<ThemeId>('midnight');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <PageAssistantProvider key={characterId} characterId={characterId}>
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

function DemoContent({ characterId, onCharacterChange, theme, onThemeChange }: DemoContentProps) {
  const assistant = usePageAssistant();
  const [state, setState] = useState(assistant.currentState);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);

  const activeCharacter = CHARACTERS[characterId];
  const characterName = activeCharacter?.label ?? 'Assistant';
  const pronoun = activeCharacter?.sex === 'male' ? 'him' : 'her';

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

  return (
    <div className="demo-root">
      <span className="state-badge" aria-live="polite">
        {state}
      </span>

      <header className="site-header">
        <nav className="nav-inner" aria-label="Primary">
          <span className="logo-mark">{characterName}</span>
          <a className="nav-link" href="#features">
            Features
          </a>
          <a className="nav-link" href="#pricing">
            Pricing
          </a>
          <a className="nav-link nav-link-desktop" href="#controls">
            Controls
          </a>
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
            <p className="hero-hint">Click on {characterName} to make {pronoun} dance!</p>
            <p className="hero-hint">Click anywhere on the page to walk {characterName} there</p>
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
            <p className="section-lead">Pick a tier. {characterName} walks your visitors through every step.</p>
            <div className="pricing-grid">
              <article className="pricing-card">
                <h3 className="pricing-name">Starter</h3>
                <p className="pricing-price">
                  <span className="price-amount">$0</span>
                  <span className="price-unit">/mo</span>
                </p>
                <ul className="pricing-list">
                  <li>Idle and walk</li>
                  <li>Single site</li>
                  <li>Community support</li>
                </ul>
              </article>
              <article className="pricing-card pricing-card-featured">
                <span className="pricing-badge">Popular</span>
                <h3 className="pricing-name">Pro</h3>
                <p className="pricing-price">
                  <span className="price-amount">$29</span>
                  <span className="price-unit">/mo</span>
                </p>
                <ul className="pricing-list">
                  <li>All gestures</li>
                  <li>Custom click handlers</li>
                  <li>Priority support</li>
                </ul>
              </article>
              <article className="pricing-card">
                <h3 className="pricing-name">Team</h3>
                <p className="pricing-price">
                  <span className="price-amount">$99</span>
                  <span className="price-unit">/mo</span>
                </p>
                <ul className="pricing-list">
                  <li>Multiple projects</li>
                  <li>Shared presets</li>
                  <li>SLA and onboarding</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section id="controls" className="section controls-spacer" aria-label="Control panel anchor" />
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <p>{characterName} · Page Assistant demo</p>
        </div>
      </footer>

      {mobileActionsOpen && (
        <div className="mobile-backdrop" onClick={() => setMobileActionsOpen(false)} />
      )}

      <div
        className={`control-panel${mobileActionsOpen ? ' control-panel-expanded' : ''}`}
        role="region"
        aria-label="Assistant controls"
      >
        <div className="control-panel-inner">
          <div className="control-panel-top">
            <p className="control-panel-label">Try the API</p>
            <div className="selector-group">
              <div className="selector-field">
                <span className="selector-label">Select Character</span>
                <select
                  className="selector-dropdown"
                  value={characterId}
                  onChange={(e) => onCharacterChange(e.target.value)}
                  aria-label="Character"
                >
                  {CHARACTER_OPTIONS.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="selector-field">
                <span className="selector-label">Select Theme</span>
                <div className="selector" role="radiogroup" aria-label="Theme">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`selector-btn${t.id === theme ? ' selector-btn-active' : ''}`}
                      onClick={() => onThemeChange(t.id)}
                      aria-pressed={t.id === theme}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              className={`mobile-actions-trigger${mobileActionsOpen ? ' mobile-actions-trigger-active' : ''}`}
              onClick={() => setMobileActionsOpen(!mobileActionsOpen)}
              aria-expanded={mobileActionsOpen}
            >
              {mobileActionsOpen ? 'Close' : 'Actions'}
            </button>
          </div>
          <div className="control-buttons">
            <button type="button" className="ctrl-btn" onClick={() => run(() => assistant.wave({ duration: 2000 }))}>
              Wave
            </button>
            <button type="button" className="ctrl-btn" onClick={() => run(() => assistant.talk({ duration: 3000 }))}>
              Talk
            </button>
            <button type="button" className="ctrl-btn" onClick={() => run(() => assistant.dance({ duration: 4000 }))}>
              Dance
            </button>
            <button type="button" className="ctrl-btn" onClick={() => assistant.idle()}>
              Idle
            </button>
            <button type="button" className="ctrl-btn" onClick={() => run(() => assistant.walkTo('#features'))}>
              Walk to Features
            </button>
            <button type="button" className="ctrl-btn" onClick={() => run(() => assistant.walkTo('#pricing'))}>
              Walk to Pricing
            </button>
            <button type="button" className="ctrl-btn" onClick={() => run(() => assistant.point({ duration: 2500 }))}>
              Point
            </button>
            <button type="button" className="ctrl-btn" onClick={() => run(() => assistant.pointAt('#features', { duration: 3000 }))}>
              Point At Features
            </button>
            <button type="button" className="ctrl-btn" onClick={() => run(() => assistant.pointAt('#pricing', { duration: 3000 }))}>
              Point At Pricing
            </button>
            <button type="button" className="ctrl-btn" onClick={() => run(() => assistant.pointAt('#features', { walkTo: true, duration: 3000 }))}>
              Walk &amp; Point Features
            </button>
            <button type="button" className="ctrl-btn" onClick={() => run(() => assistant.pointAt('#pricing', { walkTo: true, duration: 3000 }))}>
              Walk &amp; Point Pricing
            </button>
            <button type="button" className="ctrl-btn" onClick={() => assistant.turnLeft()}>
              Turn Left
            </button>
            <button type="button" className="ctrl-btn" onClick={() => assistant.turnRight()}>
              Turn Right
            </button>
            <button type="button" className="ctrl-btn" onClick={() => assistant.straightenUp()}>
              Straighten Up
            </button>
            <label className={`toggle-switch${assistant.isFollowingCursor ? ' toggle-switch-on' : ''}`}>
              <span className="toggle-track" />
              <span>Follow Cursor</span>
              <input
                type="checkbox"
                checked={assistant.isFollowingCursor}
                onChange={() => assistant.isFollowingCursor ? assistant.lookForward() : assistant.lookAtCursor()}
                hidden
              />
            </label>
            <label className={`toggle-switch${assistant.isFollowingWithArms ? ' toggle-switch-on' : ''}`}>
              <span className="toggle-track" />
              <span>Follow with Arms</span>
              <input
                type="checkbox"
                checked={assistant.isFollowingWithArms}
                onChange={() => assistant.isFollowingWithArms ? assistant.stopFollowingCursorWithArms() : assistant.followCursorWithArms()}
                hidden
              />
            </label>
            <button type="button" className="ctrl-btn ctrl-btn-muted" onClick={toggleVisibility}>
              {isHidden ? 'Show' : 'Hide'}
            </button>
          </div>
        </div>
      </div>
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
