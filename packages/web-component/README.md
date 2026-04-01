# @unopsitg/page-assistant-web-component

<p align="center">
  <img src="https://raw.githubusercontent.com/tushardighe-builder/page-assistant/main/public/pagecompanion_small.png" alt="Page Assistant" width="600" />
</p>

A framework-agnostic custom element (`<page-assistant>`) that renders an interactive 3D character assistant on any web page. Works with vanilla JS, Vue, Svelte, Angular, or any framework that supports standard HTML elements.

This package bundles React, Three.js, and React Three Fiber internally — you don't need to install any peer dependencies.

## Installation

```bash
npm install @unopsitg/page-assistant-web-component
```

## Quick start

### Via script tag

```html
<script type="module">
  import '@unopsitg/page-assistant-web-component';
</script>

<page-assistant character-id="amy"></page-assistant>
```

### Via JavaScript

```js
import '@unopsitg/page-assistant-web-component';

const pa = document.querySelector('page-assistant');

await pa.walkTo('#features');
pa.say('Welcome to our site!');
await pa.wave();
```

## Attributes

| Attribute | Description | Default |
|-----------|-------------|---------|
| `character-id` | Which character to render (e.g. `"amy"`) | First key in `characters` |
| `initially-visible` | Set to `"false"` to start hidden | `"true"` |
| `reduced-motion` | Set to `"true"` to suppress the 3D canvas | — |
| `container-mode` | Present to render in a sized container | — |
| `width` | Container width (when `container-mode` is set) | — |
| `height` | Container height (when `container-mode` is set) | — |
| `sticky-header-selector` | CSS selector for a sticky header (offsets scroll calculations) | — |

## JS properties

| Property | Type | Description |
|----------|------|-------------|
| `characters` | `Record<string, CharacterDefinition>` | Custom character definitions. Set via JS (not an HTML attribute). Replaces the built-in characters entirely. |

```js
const pa = document.querySelector('page-assistant');
pa.characters = {
  robot: {
    id: 'robot',
    label: 'Robot',
    sex: 'male',
    modelPath: '/models/robot.glb',
    modelHeight: 1.47,
    modelScale: 1,
  },
};
pa.setAttribute('character-id', 'robot');
```

## API

All methods from `PageAssistantAPI` are available directly on the element:

### Movement

| Method | Description |
|--------|-------------|
| `walkTo(target, options?)` | Walk to a DOM element or CSS selector. Auto-scrolls if needed. |
| `walkToPosition(screenX, screenY, options?)` | Walk to screen coordinates. |
| `setPosition(screenX, screenY)` | Snap to a position instantly. |

### Gestures

| Method | Description |
|--------|-------------|
| `wave(options?)` | Wave animation. |
| `point(options?)` | Point animation. |
| `pointAt(target, options?)` | Aim an arm at a target. |
| `talk(options?)` | Talking animation. |
| `dance(options?)` | Dance animation. |
| `idle()` | Return to idle. |

### Orientation

| Method | Description |
|--------|-------------|
| `lookAt(target)` | Turn head toward a target. |
| `lookAtCursor()` | Track the cursor. |
| `lookForward()` | Face forward. |
| `followCursorWithArms()` | Point arms at cursor. |
| `stopFollowingCursorWithArms()` | Stop arm tracking. |
| `turnLeft()` / `turnRight()` | Rotate the body. |
| `straightenUp()` | Reset rotation. |

### Visibility

| Method | Description |
|--------|-------------|
| `show()` | Show the character. |
| `hide()` | Hide the character. |

### Speech

| Method | Description |
|--------|-------------|
| `say(text, options?)` | Speak using Web Speech API. |
| `stopSpeaking()` | Stop speech. |
| `showBubble(data)` | Show a speech bubble. |
| `hideBubble()` | Hide the speech bubble. |
| `getAvailableVoices()` | List available voices. |

### Tours

| Method | Description |
|--------|-------------|
| `startTour(config)` | Begin a guided tour. |
| `nextStep()` / `prevStep()` | Navigate steps. |
| `restartTour()` | Restart the tour. |
| `stopTour()` | End the tour. |

### Read-only properties

| Property | Type |
|----------|------|
| `assistantVisible` | `boolean` |
| `followingCursor` | `boolean` |
| `followingWithArms` | `boolean` |
| `currentState` | `AssistantState` |
| `tourActive` | `boolean` |
| `currentTourStep` | `number` |
| `tourStepCount` | `number` |

## Custom events

| Event | `detail` | Description |
|-------|----------|-------------|
| `statechange` | `{ state: AssistantState }` | Fired when the assistant state changes. |
| `assistantclick` | — | Fired when the character is clicked. |
| `assistanthover` | `{ hovering: boolean }` | Fired on hover enter/leave. |

```js
const pa = document.querySelector('page-assistant');

pa.addEventListener('statechange', (e) => {
  console.log('New state:', e.detail.state);
});

pa.addEventListener('assistantclick', () => {
  console.log('Character clicked');
});
```

## Custom characters

See the `characters` JS property above. Models must be Mixamo-rigged GLB files with animation clips: `Idle`, `Walk`, `Point`, `Wave`, `Talk`, `Dance`.

### CharacterDefinition schema

```typescript
interface CharacterDefinition {
  id: string;
  label: string;
  sex: 'male' | 'female';
  modelPath: string;
  modelHeight: number;
  modelScale: number;
  maxArmIkAngle?: number;
  lightingOverrides?: {
    fillLightIntensity?: number;
    directionalIntensity?: number;
    emissiveIntensity?: number;
  };
}
```

## 3D assets

Character GLB models are **not** bundled in this package. They are fetched at runtime from the URL in each character's `modelPath`. The built-in characters expect models at `/models/<name>.glb` — host them on your server or CDN.

## Exported types

This package re-exports types from `@unopsitg/page-assistant-core` for convenience:

```js
import type {
  CharacterDefinition,
  PageAssistantAPI,
  TourConfig,
  AssistantState,
  // ... and more
} from '@unopsitg/page-assistant-web-component';
```

It also exports `CHARACTERS` and `DEFAULT_CHARACTER_ID` constants.

## Related packages

| Package | Description |
|---------|-------------|
| [`@unopsitg/page-assistant-core`](https://www.npmjs.com/package/@unopsitg/page-assistant-core) | Shared types, constants, and utilities |
| [`@unopsitg/page-assistant-react`](https://www.npmjs.com/package/@unopsitg/page-assistant-react) | React component and hooks (if your app is React-based) |

## License

MIT
