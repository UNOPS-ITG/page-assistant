# @unopsitg/page-assistant-react

<p align="center">
  <img src="https://raw.githubusercontent.com/tushardighe-builder/page-assistant/main/public/pagecompanion_small.png" alt="Page Assistant" width="600" />
</p>

A React component that renders an interactive 3D character assistant on your page. The character can walk to elements, point at things, speak using Web Speech API, and guide users through tours.

Built on [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) and [Three.js](https://threejs.org/) with Mixamo-rigged GLB models.

## Installation

```bash
npm install @unopsitg/page-assistant-react
```

### Peer dependencies

Your project must also have these installed:

```bash
npm install react react-dom three @react-three/fiber meshoptimizer
```

| Peer dependency | Version |
|----------------|---------|
| `react` | >= 18 |
| `react-dom` | >= 18 |
| `three` | >= 0.150 |
| `@react-three/fiber` | >= 9 |
| `meshoptimizer` | >= 0.20 |

## Quick start

Wrap your app (or a subtree) in `PageAssistantProvider`, then use the `usePageAssistant` hook to control the character:

```tsx
import { PageAssistantProvider, usePageAssistant } from '@unopsitg/page-assistant-react';

function App() {
  return (
    <PageAssistantProvider characterId="amy">
      <MyPage />
    </PageAssistantProvider>
  );
}

function MyPage() {
  const assistant = usePageAssistant();

  return (
    <div>
      <button onClick={() => assistant.show()}>Show</button>
      <button onClick={() => assistant.walkTo('#features')}>Walk to Features</button>
      <button onClick={() => assistant.say('Welcome!')}>Speak</button>
      <button onClick={() => assistant.wave()}>Wave</button>
    </div>
  );
}
```

## Provider props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `characterId` | `string` | First key in `characters` | Which character to render. |
| `characters` | `Record<string, CharacterDefinition>` | Built-in set | Custom character definitions. Replaces the built-in set entirely. |
| `containerMode` | `boolean` | `false` | Render inside a sized container instead of a full-viewport overlay. |
| `width` | `string \| number` | — | Container width (when `containerMode` is `true`). |
| `height` | `string \| number` | — | Container height (when `containerMode` is `true`). |
| `className` | `string` | — | CSS class applied to the canvas wrapper. |
| `initiallyVisible` | `boolean` | `true` | Whether the character is visible on mount. |
| `reducedMotion` | `boolean` | `false` | Suppress the 3D canvas entirely. |
| `stickyHeaderSelector` | `string` | — | CSS selector for a sticky/fixed header. Scroll calculations offset by its height. |

## API

The `usePageAssistant()` hook returns a `PageAssistantAPI` object:

### Movement

| Method | Description |
|--------|-------------|
| `walkTo(target, options?)` | Walk to a DOM element or CSS selector. Auto-scrolls if needed. |
| `walkToPosition(screenX, screenY, options?)` | Walk to screen coordinates. |
| `setPosition(screenX, screenY)` | Snap to a position instantly. |

### Gestures

| Method | Description |
|--------|-------------|
| `wave(options?)` | Wave animation (one-shot). |
| `point(options?)` | Point animation (one-shot). |
| `pointAt(target, options?)` | Aim an arm at a DOM element, selector, or `{x, y}`. |
| `talk(options?)` | Talking animation (looping). |
| `dance(options?)` | Dance animation (looping). |
| `idle()` | Return to idle. |

### Orientation

| Method | Description |
|--------|-------------|
| `lookAt(target)` | Turn head toward a DOM element or selector. |
| `lookAtCursor()` | Continuously track the mouse cursor. |
| `lookForward()` | Stop tracking and face forward. |
| `followCursorWithArms()` | Point arms at cursor position. |
| `stopFollowingCursorWithArms()` | Stop arm tracking. |
| `turnLeft()` / `turnRight()` | Rotate the body. |
| `straightenUp()` | Reset body rotation. |

### Visibility

| Method | Description |
|--------|-------------|
| `show()` | Make the character visible. |
| `hide()` | Hide the character. |

### Speech

| Method | Description |
|--------|-------------|
| `say(text, options?)` | Speak using Web Speech API with an optional voice preference. |
| `stopSpeaking()` | Stop current speech. |
| `showBubble(data)` | Show a speech bubble with title/description. |
| `hideBubble()` | Hide the speech bubble. |
| `getAvailableVoices()` | List available `SpeechSynthesisVoice` objects. |

### Tours

| Method | Description |
|--------|-------------|
| `startTour(config)` | Begin a guided tour. |
| `nextStep()` / `prevStep()` | Navigate tour steps. |
| `restartTour()` | Restart from step 0. |
| `stopTour()` | End the tour. |

### State (read-only)

| Property | Type |
|----------|------|
| `isVisible` | `boolean` |
| `isFollowingCursor` | `boolean` |
| `isFollowingWithArms` | `boolean` |
| `currentState` | `AssistantState` |
| `isTourActive` | `boolean` |
| `currentTourStep` | `number` |
| `tourStepCount` | `number` |

### Events

| Method | Description |
|--------|-------------|
| `onStateChange(cb)` | Subscribe to state changes. Returns unsubscribe function. |
| `onClick(cb)` | Subscribe to character clicks. |
| `onHover(cb)` | Subscribe to hover enter/leave. |

## Custom characters

Pass a `characters` record to replace the built-in set with your own models:

```tsx
import { PageAssistantProvider } from '@unopsitg/page-assistant-react';
import type { CharacterDefinition } from '@unopsitg/page-assistant-react';

const MY_CHARACTERS: Record<string, CharacterDefinition> = {
  robot: {
    id: 'robot',
    label: 'Robot',
    sex: 'male',
    modelPath: '/models/robot.glb',
    modelHeight: 1.47,
    modelScale: 1,
  },
};

<PageAssistantProvider characters={MY_CHARACTERS} characterId="robot">
  <App />
</PageAssistantProvider>
```

Models must be GLB files with a Mixamo-compatible skeleton and these animation clips: `Idle`, `Walk`, `Point`, `Wave`, `Talk`, `Dance`.

See the [monorepo README](https://github.com/user/page-assistant#custom-characters) for the full `CharacterDefinition` schema and model requirements.

## 3D assets

Character GLB models are **not** bundled in this package. They are loaded at runtime from the URL specified in each character's `modelPath`. The built-in characters expect models at `/models/<name>.glb` — you must host these files on your server or CDN.

## Exports

This package re-exports key items from `@unopsitg/page-assistant-core` for convenience:

- `CHARACTERS`, `DEFAULT_CHARACTER_ID` (constants)
- All types: `PageAssistantAPI`, `CharacterDefinition`, `TourConfig`, `AssistantState`, etc.

## Related packages

| Package | Description |
|---------|-------------|
| [`@unopsitg/page-assistant-core`](https://www.npmjs.com/package/@unopsitg/page-assistant-core) | Shared types, constants, and utilities |
| [`@unopsitg/page-assistant-web-component`](https://www.npmjs.com/package/@unopsitg/page-assistant-web-component) | Framework-agnostic `<page-assistant>` custom element |

## License

MIT
