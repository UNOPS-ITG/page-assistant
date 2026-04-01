# @unopsitg/page-assistant-core

<p align="center">
  <img src="https://raw.githubusercontent.com/tushardighe-unops/page-assistant/main/public/pagecompanion_small.png" alt="Page Assistant" width="600" />
</p>

Framework-agnostic types, constants, and utilities for the Page Assistant ecosystem.

This package is the shared foundation used by [`@unopsitg/page-assistant-react`](https://www.npmjs.com/package/@unopsitg/page-assistant-react) and [`@unopsitg/page-assistant-web-component`](https://www.npmjs.com/package/@unopsitg/page-assistant-web-component). You typically don't install it directly — it comes as a dependency of those packages — but you can import from it when you need access to types, constants, or utility functions.

## Installation

```bash
npm install @unopsitg/page-assistant-core
```

## What's inside

### Types

All TypeScript interfaces and type aliases used across the Page Assistant packages:

| Type | Description |
|------|-------------|
| `CharacterDefinition` | Full definition of a character (model path, scale, sex, lighting, etc.) |
| `CharacterSex` | `'male' \| 'female'` |
| `CharacterLightingOverrides` | Per-character lighting tweaks |
| `PageAssistantAPI` | The full imperative API surface |
| `AssistantState` | Union of assistant states (`'idle'`, `'walking'`, `'pointing'`, etc.) |
| `WalkOptions` | Options for `walkTo` / `walkToPosition` |
| `GestureOptions` | Options for gesture methods (`wave`, `point`, `talk`, `dance`) |
| `PointAtOptions` | Options for `pointAt` (extends `GestureOptions`) |
| `TourConfig` | Configuration for guided tours |
| `TourStep` | A single step within a tour |
| `TourStepAction` | Actions available per tour step |
| `TourStepPopover` | Popover content for a tour step |
| `SpeechOptions` | Options for `say()` |
| `SpeechBubbleData` | Data driving the speech bubble UI |
| `VoicePreference` | Voice selection criteria (language, gender, quality) |
| `VoiceQuality` | `'neural' \| 'online' \| 'any'` |
| `SpeechStatus` | `'idle' \| 'speaking' \| 'paused'` |
| `SpeechProgress` | Tracks progress through speech chunks |
| `LookMode` | `'cursor' \| 'element' \| 'forward'` |
| `LookTarget` | Describes where the character is looking |

### Constants

| Export | Description |
|--------|-------------|
| `CHARACTERS` | Built-in character definitions record |
| `DEFAULT_CHARACTER_ID` | Default character key (`'amy'`) |
| `BONE_NAMES` | Mixamo bone name mappings |
| `ROTATION_LIMITS` | Bone rotation constraints |
| `ANIMATION_CONFIG` | Animation timing/blending configuration |
| `CAMERA_CONFIG` | Default camera setup |
| `CLIP_NAMES` | Named animation clip identifiers |

### Utilities

| Export | Description |
|--------|-------------|
| `resolveElement(target)` | Resolves a CSS selector or HTMLElement to an element |
| `getElementCenter(el)` | Returns the center coordinates of a DOM element |
| `getSectionLeftStandPoint(el)` | Computes a walk-to position at the left edge of an element |
| `resolvePointAtCoords(target)` | Converts a point-at target to world coordinates |
| `smoothScrollTo(y, opts?)` | Smooth-scrolls the page with optional sticky header offset |
| `computeArmAndTurn(...)` | Computes IK arm angles and body turn for pointing gestures |
| `chunkText(text)` | Splits text into speakable chunks |
| `resolveVoice(preference?)` | Selects a `SpeechSynthesisVoice` matching a preference |
| `voiceScore(voice, pref)` | Scores a voice against a preference |
| `voiceTag(voice)` | Returns a display tag for a voice |
| `inferGender(voice)` | Infers gender from a voice name |

## Usage

```typescript
import { CHARACTERS, DEFAULT_CHARACTER_ID, resolveVoice } from '@unopsitg/page-assistant-core';
import type { CharacterDefinition, PageAssistantAPI } from '@unopsitg/page-assistant-core';

// Access built-in characters
const amy = CHARACTERS[DEFAULT_CHARACTER_ID];
console.log(amy.label); // "Amy"

// Define a custom character
const custom: CharacterDefinition = {
  id: 'robot',
  label: 'Robot',
  sex: 'male',
  modelPath: '/models/robot.glb',
  modelHeight: 1.47,
  modelScale: 1,
};
```

## Related packages

| Package | Description |
|---------|-------------|
| [`@unopsitg/page-assistant-react`](https://www.npmjs.com/package/@unopsitg/page-assistant-react) | React component and hooks |
| [`@unopsitg/page-assistant-web-component`](https://www.npmjs.com/package/@unopsitg/page-assistant-web-component) | Framework-agnostic `<page-assistant>` custom element |

## License

MIT
