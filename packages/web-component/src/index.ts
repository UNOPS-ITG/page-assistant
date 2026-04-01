import { PageAssistantElement } from './page-assistant-element';

if (typeof customElements !== 'undefined' && !customElements.get('page-assistant')) {
  customElements.define('page-assistant', PageAssistantElement);
}

export { PageAssistantElement };
export { CHARACTERS, DEFAULT_CHARACTER_ID } from '@unopsitg/page-assistant-core';
export type {
  PageAssistantAPI,
  AssistantState,
  CharacterSex,
  CharacterLightingOverrides,
  CharacterDefinition,
  WalkOptions,
  GestureOptions,
  PointAtOptions,
  SpeechOptions,
  SpeechBubbleData,
  TourConfig,
  TourStep,
  TourStepAction,
  VoicePreference,
} from '@unopsitg/page-assistant-core';
