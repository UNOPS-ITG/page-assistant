import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PageAssistantStandalone } from '@unopsitg/page-assistant-react';
import type {
  PageAssistantAPI,
  AssistantState,
  CharacterDefinition,
  WalkOptions,
  GestureOptions,
  PointAtOptions,
  SpeechOptions,
  SpeechBubbleData,
  TourConfig,
} from '@unopsitg/page-assistant-core';

const OBSERVED_ATTRIBUTES = [
  'character-id',
  'initially-visible',
  'reduced-motion',
  'container-mode',
  'width',
  'height',
  'class-name',
  'sticky-header-selector',
] as const;

export class PageAssistantElement extends HTMLElement {
  private _root: Root | null = null;
  private _container: HTMLDivElement | null = null;
  private _api: PageAssistantAPI | null = null;
  private _unsubscribers: (() => void)[] = [];
  private _characters: Record<string, CharacterDefinition> | undefined;

  static get observedAttributes() {
    return [...OBSERVED_ATTRIBUTES];
  }

  connectedCallback() {
    this.style.display = 'contents';
    this._container = document.createElement('div');
    this.appendChild(this._container);
    this._root = createRoot(this._container);
    this._render();
  }

  disconnectedCallback() {
    this._unsubscribers.forEach((fn) => fn());
    this._unsubscribers = [];
    this._api = null;
    this._root?.unmount();
    this._root = null;
    this._container?.remove();
    this._container = null;
  }

  attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;
    if (this._root && this._container) {
      this._root.unmount();
      this._root = createRoot(this._container);
      this._render();
    }
  }

  get characters(): Record<string, CharacterDefinition> | undefined {
    return this._characters;
  }

  set characters(value: Record<string, CharacterDefinition> | undefined) {
    this._characters = value;
    if (this._root && this._container) {
      this._root.unmount();
      this._root = createRoot(this._container);
      this._render();
    }
  }

  private _render() {
    if (!this._root) return;

    this._root.render(
      <PageAssistantStandalone
        ref={(api: PageAssistantAPI | null) => {
          this._api = api;
          if (api) this._setupEventForwarding();
        }}
        characterId={this.getAttribute('character-id') ?? undefined}
        characters={this._characters}
        initiallyVisible={this.getAttribute('initially-visible') !== 'false'}
        reducedMotion={this.getAttribute('reduced-motion') === 'true'}
        containerMode={this.hasAttribute('container-mode')}
        width={this.getAttribute('width') ?? undefined}
        height={this.getAttribute('height') ?? undefined}
        className={this.getAttribute('class-name') ?? undefined}
        stickyHeaderSelector={this.getAttribute('sticky-header-selector') ?? undefined}
      />,
    );
  }

  private _setupEventForwarding() {
    this._unsubscribers.forEach((fn) => fn());
    this._unsubscribers = [];

    if (!this._api) return;

    this._unsubscribers.push(
      this._api.onStateChange((state) => {
        this.dispatchEvent(new CustomEvent('statechange', { detail: { state }, bubbles: true }));
      }),
    );

    this._unsubscribers.push(
      this._api.onClick(() => {
        this.dispatchEvent(new CustomEvent('assistantclick', { bubbles: true }));
      }),
    );

    this._unsubscribers.push(
      this._api.onHover((hovering) => {
        this.dispatchEvent(new CustomEvent('assistanthover', { detail: { hovering }, bubbles: true }));
      }),
    );
  }

  // --- Delegated API methods ---

  walkTo(target: HTMLElement | string, options?: WalkOptions): Promise<void> {
    return this._api?.walkTo(target, options) ?? Promise.resolve();
  }

  walkToPosition(screenX: number, screenY: number, options?: WalkOptions): Promise<void> {
    return this._api?.walkToPosition(screenX, screenY, options) ?? Promise.resolve();
  }

  setPosition(screenX: number, screenY: number): void {
    this._api?.setPosition(screenX, screenY);
  }

  point(options?: GestureOptions): Promise<void> {
    return this._api?.point(options) ?? Promise.resolve();
  }

  pointAt(target: HTMLElement | string | { x: number; y: number }, options?: PointAtOptions): Promise<void> {
    return this._api?.pointAt(target, options) ?? Promise.resolve();
  }

  wave(options?: GestureOptions): Promise<void> {
    return this._api?.wave(options) ?? Promise.resolve();
  }

  talk(options?: GestureOptions): Promise<void> {
    return this._api?.talk(options) ?? Promise.resolve();
  }

  dance(options?: GestureOptions): Promise<void> {
    return this._api?.dance(options) ?? Promise.resolve();
  }

  idle(): void {
    this._api?.idle();
  }

  turnLeft(): void {
    this._api?.turnLeft();
  }

  turnRight(): void {
    this._api?.turnRight();
  }

  straightenUp(): void {
    this._api?.straightenUp();
  }

  lookAt(targetElement: HTMLElement | string): void {
    this._api?.lookAt(targetElement);
  }

  lookAtCursor(): void {
    this._api?.lookAtCursor();
  }

  followCursorWithArms(): void {
    this._api?.followCursorWithArms();
  }

  stopFollowingCursorWithArms(): void {
    this._api?.stopFollowingCursorWithArms();
  }

  lookForward(): void {
    this._api?.lookForward();
  }

  show(): void {
    this._api?.show();
  }

  hide(): void {
    this._api?.hide();
  }

  say(text: string, options?: SpeechOptions): void {
    this._api?.say(text, options);
  }

  stopSpeaking(): void {
    this._api?.stopSpeaking();
  }

  showBubble(data: Omit<SpeechBubbleData, 'visible'>): void {
    this._api?.showBubble(data);
  }

  hideBubble(): void {
    this._api?.hideBubble();
  }

  startTour(config: TourConfig): void {
    this._api?.startTour(config);
  }

  nextStep(): void {
    this._api?.nextStep();
  }

  prevStep(): void {
    this._api?.prevStep();
  }

  restartTour(): void {
    this._api?.restartTour();
  }

  stopTour(): void {
    this._api?.stopTour();
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this._api?.getAvailableVoices() ?? [];
  }

  // --- Read-only properties ---

  get assistantVisible(): boolean {
    return this._api?.isVisible ?? false;
  }

  get followingCursor(): boolean {
    return this._api?.isFollowingCursor ?? false;
  }

  get followingWithArms(): boolean {
    return this._api?.isFollowingWithArms ?? false;
  }

  get currentState(): AssistantState {
    return this._api?.currentState ?? 'hidden';
  }

  get tourActive(): boolean {
    return this._api?.isTourActive ?? false;
  }

  get currentTourStep(): number {
    return this._api?.currentTourStep ?? -1;
  }

  get tourStepCount(): number {
    return this._api?.tourStepCount ?? 0;
  }
}
