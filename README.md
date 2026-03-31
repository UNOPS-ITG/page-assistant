# Page Assistant

An animated 3D character that lives on your webpage — walking, pointing, dancing, and reacting to visitors in real time, right in the browser.

Built with **React**, **Three.js**, and **React Three Fiber**.

![Page Assistant demo screenshot](public/pagecompanion_small.png)

**Live demo:** [pagecompanion.web.app](https://pagecompanion.web.app/)

## Features

- **Walk anywhere** — click any spot on the page and the character walks there, scrolling if needed
- **Walk to elements** — programmatically guide the character to any DOM element by selector
- **Gestures** — wave, point, talk, and dance animations with configurable duration
- **Point at elements** — IK-driven arm pointing at any DOM element, screen coordinates, or selector (auto-picks left/right arm based on relative position)
- **Guided tour** — JSON-driven multi-step tours that walk the character between elements, play actions, display speech bubbles, and optionally narrate each step with text-to-speech
- **Text-to-speech** — narrate any text via the Web Speech API with configurable voice preferences (language, gender, neural/online quality) and chunked utterance support
- **Speech bubble** — floating UI bubble anchored to the character's head with title, description, and optional listen/stop controls; auto-flips near viewport edges
- **Lip sync** — jaw bone animates open/closed while speech is playing for a visual talking effect
- **Head tracking** — the character follows the user's cursor with head, neck, and spine bone overrides
- **Cursor follow with arms** — optional arm IK that reaches toward the pointer in addition to head tracking
- **Look at elements** — direct the character's gaze toward a specific element
- **9 characters** — Amy, Sophie, Michelle, AJ, Boss, Brian, Doozy, Joe, and Mousey (Mixamo FBX rigs)
- **3 themes** — Midnight (dark), Light, and Grey, controlled via CSS custom properties
- **Container mode** — embed the assistant in a sized container instead of the default full-viewport overlay
- **Full API** — a React hook (`usePageAssistant`) exposes walk, gesture, look, speech, tour, visibility, and event methods
- **Accessibility** — respects `prefers-reduced-motion` and provides a `reducedMotion` prop
- **Responsive** — adjusts camera and layout for mobile viewports; tours hide the bubble on small screens when auto-speak is active

## Characters

<table>
  <tr>
    <td align="center"><img src="public/characters/aj.png" width="120" /><br /><b>AJ</b></td>
    <td align="center"><img src="public/characters/amy.png" width="120" /><br /><b>Amy</b></td>
    <td align="center"><img src="public/characters/boss.png" width="120" /><br /><b>Boss</b></td>
    <td align="center"><img src="public/characters/brian.png" width="120" /><br /><b>Brian</b></td>
    <td align="center"><img src="public/characters/doozy.png" width="120" /><br /><b>Doozy</b></td>
  </tr>
  <tr>
    <td align="center"><img src="public/characters/joe.png" width="120" /><br /><b>Joe</b></td>
    <td align="center"><img src="public/characters/michelle.png" width="120" /><br /><b>Michelle</b></td>
    <td align="center"><img src="public/characters/mousey.png" width="120" /><br /><b>Mousey</b></td>
    <td align="center"><img src="public/characters/sophie.png" width="120" /><br /><b>Sophie</b></td>
    <td></td>
  </tr>
</table>

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
      <button onClick={() => assistant.walkTo('#pricing')}>Walk to Pricing</button>
      <button onClick={() => assistant.pointAt('#signup', { walkTo: true })}>Point at Signup</button>
      <button onClick={() => assistant.wave()}>Wave</button>
      <button onClick={() => assistant.dance()}>Dance</button>
      <button onClick={() => assistant.lookAtCursor()}>Follow Cursor</button>
      <button onClick={() => assistant.say('Welcome to our site!')}>Speak</button>
      <button onClick={() => assistant.startTour({
        steps: [
          { element: '#features', action: 'walkTo', popover: { title: 'Features', description: 'Check out what we offer.' } },
          { element: '#pricing', action: 'pointAt', walkTo: true, popover: { title: 'Pricing', description: 'Affordable plans for everyone.' } },
        ],
        speechEnabled: true,
        autoSpeak: true,
      })}>Start Tour</button>

      <section id="features">...</section>
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
| `pointAt(target, options?)` | Point at a DOM element, selector, or `{x, y}` screen coordinates using IK arm aiming. `options.walkTo` walks to the element first. |
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
| `followCursorWithArms()` | Follow the cursor with head tracking **and** IK arm reaching. |
| `stopFollowingCursorWithArms()` | Stop arm following (head tracking continues if active). |
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

### Speech

| Method | Description |
|--------|-------------|
| `say(text, options?)` | Speak text aloud using the Web Speech API. Plays the talk animation and animates the jaw while speaking. |
| `stopSpeaking()` | Stop any in-progress speech. |
| `getAvailableVoices()` | Return the list of `SpeechSynthesisVoice` objects available in the browser. |

### Speech Bubble

| Method | Description |
|--------|-------------|
| `showBubble(data)` | Display a speech bubble anchored to the character's head with `title`, `description`, and optional `showPlayButton`. |
| `hideBubble()` | Hide the speech bubble. |

### Guided Tour

| Method / Property | Description |
|-------------------|-------------|
| `startTour(config)` | Start a guided tour. The character walks between elements, performs actions, shows speech bubbles, and optionally narrates each step. |
| `nextStep()` | Advance to the next tour step (skips any remaining hold time). |
| `prevStep()` | Go back to the previous tour step. |
| `restartTour()` | Restart the tour from step 1. |
| `stopTour()` | Stop the tour and return to idle. |
| `isTourActive` | `boolean` — whether a tour is currently running. |
| `currentTourStep` | `number` — zero-based index of the active step. |
| `tourStepCount` | `number` — total number of steps in the active tour. |

### State

| Property | Type | Description |
|----------|------|-------------|
| `currentState` | `AssistantState` | One of `idle`, `walking`, `pointing`, `pointingAt`, `waving`, `talking`, `dancing`, `hidden`. |
| `isFollowingCursor` | `boolean` | Whether cursor tracking is active. |
| `isFollowingWithArms` | `boolean` | Whether arm IK cursor tracking is active. |

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

interface PointAtOptions extends GestureOptions {
  walkTo?: boolean;       // walk to the element before pointing
}

interface SpeechOptions {
  voice?: string | VoicePreference;
}

interface VoicePreference {
  lang?: string;           // BCP 47 language tag, e.g. "en-US"
  gender?: 'male' | 'female';
  quality?: 'neural' | 'online' | 'any';
  name?: string;           // exact SpeechSynthesisVoice.name override
}
```

### Tour Configuration

```typescript
interface TourConfig {
  steps: TourStep[];
  animate?: boolean;           // enable walk animations between steps (default true)
  showSpeechBubble?: boolean;  // show bubble for all steps (default true)
  speechEnabled?: boolean;     // enable TTS for all steps
  autoSpeak?: boolean;         // auto-play TTS when each step starts
  defaultVoice?: string | VoicePreference;
  onStart?: () => void;
  onComplete?: () => void;
  onStepChange?: (stepIndex: number, step: TourStep) => void;
  onDestroyed?: () => void;
}

interface TourStep {
  element?: string;            // CSS selector for the target element
  action?: 'walkTo' | 'pointAt' | 'wave' | 'talk' | 'dance' | 'idle';
  popover?: { title?: string; description?: string };
  duration?: number;           // hold time in ms (auto-calculated from speech or text length if omitted)
  walkTo?: boolean;            // for pointAt action: walk to the element first
  voice?: string | VoicePreference;   // per-step voice override
  speechEnabled?: boolean;     // per-step TTS override
  autoSpeak?: boolean;         // per-step auto-speak override
  showSpeechBubble?: boolean;  // per-step bubble override
  onHighlighted?: () => void;
  onDeselected?: () => void;
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
│           ├── PageAssistantProvider.tsx  Context, API, click-to-walk, tour, speech
│           ├── AssistantCanvas.tsx        R3F Canvas, lighting, camera
│           ├── CharacterModel.tsx         FBX loading, animation mixer, walking
│           ├── BoneOverrideController.tsx Head/neck/spine look-at & arm IK system
│           ├── SpeechBubble.tsx           Floating bubble anchored to character head
│           ├── useSpeech.ts              Web Speech API wrapper with voice selection
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
