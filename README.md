# Page Assistant

An animated 3D character that lives on your webpage — walking, pointing, dancing, and reacting to visitors in real time, right in the browser.

Built with **React**, **Three.js**, and **React Three Fiber**.

![Page Assistant demo screenshot](public/pagecompanion_small.png)

**Live demo:** [pagecompanion.web.app](https://pagecompanion.web.app/)

## Features

- **Walk anywhere** — click any spot on the page and the character walks there, scrolling if needed
- **Walk to elements** — programmatically guide the character to any DOM element by selector
- **Gestures** — wave, point, talk, and dance animations with configurable duration
- **Head tracking** — the character follows the user's cursor with head, neck, and spine bone overrides
- **Look at elements** — direct the character's gaze toward a specific element
- **9 characters** — Amy, Sophie, Michelle, AJ, Boss, Brian, Doozy, Joe, and Mousey (Mixamo FBX rigs)
- **3 themes** — Midnight (dark), Light, and Grey, controlled via CSS custom properties
- **Full API** — a React hook (`usePageAssistant`) exposes walk, gesture, look, visibility, and event methods
- **Accessibility** — respects `prefers-reduced-motion` and provides a `reducedMotion` prop
- **Responsive** — adjusts camera and layout for mobile viewports

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI | React 19, TypeScript 5.9 |
| 3D | Three.js 0.183, React Three Fiber 9, Drei 10 |
| Build | Vite 8 |
| Hosting | Firebase Hosting |

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install
```

### 3D Assets

Character models are **Mixamo FBX files** and must be placed under `public/mixamo_files/`. Each character folder needs a T-pose and six animation files:

```
public/mixamo_files/<character>/
  ├── <character>-tpose.fbx
  ├── <character>-idle.fbx
  ├── <character>-walk.fbx
  ├── <character>-point.fbx
  ├── <character>-wave.fbx
  ├── <character>-talk.fbx
  └── <character>-hiphop.fbx
```

Characters: `amy`, `sophie`, `michelle`, `aj`, `boss`, `brian`, `doozy`, `joe`, `mousey`.

### Development

```bash
npm run dev
```

Opens a local Vite dev server (default `http://localhost:5173`).

### Build

```bash
npm run build
```

Outputs a production bundle to `dist/`.

### Deploy

```bash
npm run build
firebase deploy --only hosting:pagecompanion
```

Or use the included script:

```bash
build-deploy.bat
```

## Usage

Wrap your app with `PageAssistantProvider` and use the `usePageAssistant` hook to control the character:

```tsx
import { PageAssistantProvider, usePageAssistant } from './components/PageAssistant';

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
      <button onClick={() => assistant.walkTo('#pricing')}>
        Walk to Pricing
      </button>
      <button onClick={() => assistant.wave()}>Wave</button>
      <button onClick={() => assistant.dance()}>Dance</button>
      <button onClick={() => assistant.lookAtCursor()}>Follow Cursor</button>

      <section id="pricing">...</section>
    </div>
  );
}
```

## API Reference

The `usePageAssistant()` hook returns a `PageAssistantAPI` object:

### Movement

| Method | Description |
|--------|-------------|
| `walkTo(target, options?)` | Walk to a DOM element or CSS selector. Scrolls the page if needed. |
| `walkToPosition(screenX, screenY, options?)` | Walk to screen coordinates. |
| `setPosition(screenX, screenY)` | Snap to a screen X position instantly. |

### Gestures

| Method | Description |
|--------|-------------|
| `wave(options?)` | Play the wave animation (one-shot). |
| `point(options?)` | Play the point animation (one-shot). |
| `talk(options?)` | Play the talk animation (looping). |
| `dance(options?)` | Play the dance animation (looping). |
| `idle()` | Return to idle. |

### Orientation

| Method | Description |
|--------|-------------|
| `turnLeft()` | Rotate the character to face left. |
| `turnRight()` | Rotate the character to face right. |
| `straightenUp()` | Reset rotation to face forward. |

### Look

| Method | Description |
|--------|-------------|
| `lookAt(target)` | Turn head/neck/spine toward a DOM element or selector. |
| `lookAtCursor()` | Follow the user's cursor with head tracking. |
| `lookForward()` | Reset head to look forward. |

### Visibility

| Method | Description |
|--------|-------------|
| `show()` | Show the character. |
| `hide()` | Hide the character. |
| `isVisible` | Read-only — whether the character is visible. |

### Events

| Method | Description |
|--------|-------------|
| `onStateChange(callback)` | Subscribe to state changes. Returns an unsubscribe function. |
| `onClick(callback)` | Subscribe to clicks on the character. Returns an unsubscribe function. |
| `onHover(callback)` | Subscribe to hover state changes. Returns an unsubscribe function. |

### State

| Property | Type | Description |
|----------|------|-------------|
| `currentState` | `AssistantState` | One of `idle`, `walking`, `pointing`, `waving`, `talking`, `dancing`, `hidden`. |
| `isFollowingCursor` | `boolean` | Whether cursor tracking is active. |

### Options

```typescript
interface WalkOptions {
  speed?: number;
  onArrive?: () => void;
}

interface GestureOptions {
  duration?: number;
  returnToIdle?: boolean;
}
```

## Provider Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `characterId` | `string` | `'amy'` | Character to render (see characters list above). |
| `containerMode` | `boolean` | `false` | Render in a sized container instead of full-viewport overlay. |
| `width` | `string \| number` | — | Container width (when `containerMode` is `true`). |
| `height` | `string \| number` | — | Container height (when `containerMode` is `true`). |
| `className` | `string` | — | CSS class for the canvas wrapper. |
| `initiallyVisible` | `boolean` | `true` | Whether the character is visible on mount. |
| `reducedMotion` | `boolean` | `false` | Disable the assistant entirely (also respects `prefers-reduced-motion`). |

## Project Structure

```
├── index.html                  Entry point
├── src/
│   ├── main.tsx                React root
│   ├── App.tsx                 Demo page with controls, themes, character picker
│   ├── App.css                 Demo layout and control panel styles
│   ├── index.css               Global styles and theme variables
│   └── components/
│       └── PageAssistant/
│           ├── index.ts                Public exports
│           ├── PageAssistantProvider.tsx  Context, API, click-to-walk, scroll logic
│           ├── AssistantCanvas.tsx        R3F Canvas, lighting, camera
│           ├── CharacterModel.tsx         FBX loading, animation mixer, walking
│           ├── BoneOverrideController.tsx Head/neck/spine look-at system
│           ├── useCursorTracking.ts       Mouse/touch position tracking
│           ├── useScreenToWorld.ts        Screen-to-world coordinate projection
│           ├── constants.ts              Characters, bones, animation config
│           └── types.ts                  TypeScript interfaces
├── public/
│   └── mixamo_files/           3D character assets (FBX)
├── firebase.json               Firebase Hosting config
├── vite.config.ts              Vite config
├── tsconfig.json               TypeScript config
└── package.json                Dependencies and scripts
```

## License

Private — not currently published under an open-source license.
