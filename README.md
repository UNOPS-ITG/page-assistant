# Page Assistant

An animated 3D character that lives on your webpage — walking, pointing, dancing, and reacting to visitors in real time, right in the browser.

Available as a **React component** or a framework-agnostic **web component**.

![Page Assistant demo screenshot](public/pagecompanion_small.png)

**Live demo:** [pagecompanion.web.app](https://pagecompanion.web.app/)

## Packages

This is a monorepo containing three publishable packages:

| Package | Description | Size (gzip) |
|---------|-------------|-------------|
| `@unopsitg/page-assistant-core` | Shared types, constants, and utility functions (no framework dependency) | ~3 KB |
| `@unopsitg/page-assistant-react` | React component with Three.js rendering (requires React + Three.js as peer deps) | ~30 KB |
| `@unopsitg/page-assistant-web-component` | `<page-assistant>` custom element — self-contained, works with any framework | ~580 KB |

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
- **9 characters** — Amy, Sophie, Michelle, AJ, Boss, Brian, Doozy, Joe, and Mousey (Mixamo rigs, optimized GLB)
- **3 themes** — Midnight (dark), Light, and Grey, controlled via CSS custom properties
- **Container mode** — embed the assistant in a sized container instead of the default full-viewport overlay
- **Full API** — a React hook (`usePageAssistant`) or web component methods expose walk, gesture, look, speech, tour, visibility, and event methods
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
| 3D | Three.js 0.183, React Three Fiber 9 |
| Build | Vite 8 (monorepo with npm workspaces) |
| Hosting | Firebase Hosting |

---

## Quick Start — React

```bash
npm install @unopsitg/page-assistant-core @unopsitg/page-assistant-react
```

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

**Peer dependencies** — your project must also have `react`, `react-dom`, `three`, `@react-three/fiber`, and `meshoptimizer` installed.

## Quick Start — Web Component

```bash
npm install @unopsitg/page-assistant-web-component
```

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

// Movement
await pa.walkTo('#pricing');
await pa.walkToPosition(400, 300);

// Gestures
await pa.wave();
await pa.dance();
await pa.pointAt('#signup', { walkTo: true });

// Speech
pa.say('Hello, welcome to my page!');
pa.stopSpeaking();
pa.showBubble({ title: 'Welcome', description: 'Let me show you around.' });
pa.hideBubble();

// Tour
pa.startTour({
  steps: [
    { element: '#features', action: 'walkTo', popover: { title: 'Features', description: 'See our amazing features!' } },
    { element: '#pricing', action: 'pointAt', walkTo: true, popover: { title: 'Pricing', description: 'Pick a plan.' } },
  ],
  speechEnabled: true,
  autoSpeak: true,
});
pa.nextStep();
pa.stopTour();

// Events
pa.addEventListener('statechange', (e) => console.log(e.detail.state));
pa.addEventListener('assistantclick', () => console.log('Clicked!'));
pa.addEventListener('assistanthover', (e) => console.log('Hover:', e.detail.hovering));
```

### Web component attributes

| Attribute | Description | Default |
|-----------|-------------|---------|
| `character-id` | Character to render (e.g. `"amy"`, `"boss"`) | First key in `characters` |
| `initially-visible` | Set to `"false"` to start hidden | `"true"` |
| `reduced-motion` | Set to `"true"` to disable the 3D canvas | — |
| `container-mode` | Present to render in a sized container | — |
| `width` | Container width (when `container-mode` is set) | — |
| `height` | Container height (when `container-mode` is set) | — |
| `sticky-header-selector` | CSS selector for a sticky header (adjusts scroll offset) | — |

### Web component JS properties

| Property | Type | Description |
|----------|------|-------------|
| `characters` | `Record<string, CharacterDefinition>` | Custom character definitions (set via JS, not as an attribute). See [Custom Characters](#custom-characters). |

The web component bundles React, Three.js, and R3F internally — consumers do not need to install any peer dependencies.

---

## API Reference

Both the React hook (`usePageAssistant()`) and the web component element expose the same `PageAssistantAPI` surface.

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

**React** — callback-based:

| Method | Description |
|--------|-------------|
| `onStateChange(callback)` | Subscribe to state changes. Returns an unsubscribe function. |
| `onClick(callback)` | Subscribe to clicks on the character. Returns an unsubscribe function. |
| `onHover(callback)` | Subscribe to hover state changes. Returns an unsubscribe function. |

**Web component** — also dispatches `CustomEvent`s:

| Event | `detail` | Description |
|-------|----------|-------------|
| `statechange` | `{ state: AssistantState }` | Fires when the character's state changes. |
| `assistantclick` | — | Fires when the character is clicked. |
| `assistanthover` | `{ hovering: boolean }` | Fires when cursor enters/leaves the character. |

### Speech

| Method | Description |
|--------|-------------|
| `say(text, options?)` | Speak text aloud using the Web Speech API. Animates the jaw while speaking. |
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

## Provider Props (React)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `characterId` | `string` | First key in `characters` | Character to render. |
| `characters` | `Record<string, CharacterDefinition>` | Built-in `CHARACTERS` | Custom character definitions (replaces the built-in set entirely). |
| `containerMode` | `boolean` | `false` | Render in a sized container instead of full-viewport overlay. |
| `width` | `string \| number` | — | Container width (when `containerMode` is `true`). |
| `height` | `string \| number` | — | Container height (when `containerMode` is `true`). |
| `className` | `string` | — | CSS class for the canvas wrapper. |
| `initiallyVisible` | `boolean` | `true` | Whether the character is visible on mount. |
| `reducedMotion` | `boolean` | `false` | Disable the assistant entirely (also respects `prefers-reduced-motion`). |
| `stickyHeaderSelector` | `string` | — | CSS selector for a sticky header element (used to offset scroll calculations). |

## Custom Characters

By default, the assistant ships with 9 built-in characters (Amy, Sophie, Michelle, etc.). You can replace these entirely by passing your own `characters` record. Each character needs a Mixamo-rigged GLB model with the standard animation clips (Idle, Walk, Point, Wave, Talk, Dance).

### CharacterDefinition schema

```typescript
interface CharacterDefinition {
  id: string;                          // Unique key (must match the record key)
  label: string;                       // Display name
  sex: 'male' | 'female';             // Used for voice selection heuristics
  modelPath: string;                   // URL to the .glb file
  modelHeight: number;                 // Approximate height in world units (used for scroll/walk)
  modelScale: number;                  // Scale factor applied to the model
  maxArmIkAngle?: number;             // Max arm IK reach angle in radians (default π × 0.75)
  lightingOverrides?: {
    fillLightIntensity?: number;       // Fill light intensity (default 0)
    directionalIntensity?: number;     // Directional light intensity (default 1.5)
    emissiveIntensity?: number;        // Emissive boost for materials (default 0)
  };
}
```

### React example

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
    lightingOverrides: {
      directionalIntensity: 2.0,
    },
  },
  fairy: {
    id: 'fairy',
    label: 'Fairy',
    sex: 'female',
    modelPath: 'https://cdn.example.com/models/fairy.glb',
    modelHeight: 1.2,
    modelScale: 0.8,
    maxArmIkAngle: Math.PI * 0.5,
  },
};

function App() {
  return (
    <PageAssistantProvider characters={MY_CHARACTERS} characterId="robot">
      <MyPage />
    </PageAssistantProvider>
  );
}
```

### Web component example

```js
import '@unopsitg/page-assistant-web-component';

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
// Then set the character-id attribute or leave it to use the first key
pa.setAttribute('character-id', 'robot');
```

### Model requirements

Custom models must be GLB files containing a Mixamo-compatible skeleton with the following named animation clips:

| Clip name | Type | Description |
|-----------|------|-------------|
| `Idle` | Looping | Breathing / weight shift |
| `Walk` | Looping | Walk cycle (in-place) |
| `Point` | One-shot | Pointing gesture |
| `Wave` | One-shot | Waving gesture |
| `Talk` | Looping | Talking / explaining |
| `Dance` | Looping | Dance animation |

The skeleton must use Mixamo bone naming (`mixamorigHead`, `mixamorigLeftArm`, etc.). See the [3D Assets](#3d-assets) section for how to prepare models.

### Using the built-in characters with a custom base path

If you want to use the built-in character set but serve the models from a different URL, spread and override the `modelPath`:

```tsx
import { CHARACTERS } from '@unopsitg/page-assistant-core';
import type { CharacterDefinition } from '@unopsitg/page-assistant-core';

const BASE = 'https://cdn.example.com/page-assistant';

const myCharacters: Record<string, CharacterDefinition> = Object.fromEntries(
  Object.entries(CHARACTERS).map(([key, char]) => [
    key,
    { ...char, modelPath: `${BASE}${char.modelPath}` },
  ]),
);

// myCharacters.amy.modelPath → "https://cdn.example.com/page-assistant/models/amy.glb"
```

---

## Development

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

This installs root dependencies and links the workspace packages (`packages/*`).

### Dev Server

```bash
npm run dev
```

Opens a local Vite dev server (default `http://localhost:5173`) running the demo app. The demo imports from `@unopsitg/page-assistant-react` and `@unopsitg/page-assistant-core` — Vite resolves these to the package source directories for live reloading.

### Type Check

```bash
npx tsc --noEmit
```

---

## Building Packages

Each package has its own build step that produces a `dist/` folder with ES module output and TypeScript declarations.

### Build all packages

```bash
npm run build:packages
```

This runs `build:core`, then `build:react`, then `build:wc` in sequence (order matters because react depends on core, and web-component depends on both).

### Build individually

```bash
npm run build:core    # @unopsitg/page-assistant-core
npm run build:react   # @unopsitg/page-assistant-react
npm run build:wc      # @unopsitg/page-assistant-web-component
```

### Build output

| Package | Output | Contents |
|---------|--------|----------|
| `@unopsitg/page-assistant-core` | `packages/core/dist/` | `index.js` + `.d.ts` type declarations |
| `@unopsitg/page-assistant-react` | `packages/react/dist/` | `index.js` + `.d.ts` type declarations (react, three externalized) |
| `@unopsitg/page-assistant-web-component` | `packages/web-component/dist/` | `page-assistant.js` + `.d.ts` (self-contained, React/Three bundled) |

### Build the demo app

```bash
npm run build
```

Outputs the demo site to `dist/` at the repo root.

---

## Publishing to npm

### 1. Prerequisites

- An [npm account](https://www.npmjs.com/signup)
- Logged in: `npm login`
- Packages are scoped under `@unopsitg` — you must be a member of the [unopsitg npm organization](https://www.npmjs.com/org/unopsitg), or publish with `--access public`

### 2. Update versions

Bump the version in each package's `package.json` before publishing. All three packages should use the same version:

```bash
# Manually edit, or use npm version:
npm -w @unopsitg/page-assistant-core version 0.2.0
npm -w @unopsitg/page-assistant-react version 0.2.0
npm -w @unopsitg/page-assistant-web-component version 0.2.0
```

Also update the dependency ranges in `@unopsitg/page-assistant-react` and `@unopsitg/page-assistant-web-component` to match the new `@unopsitg/page-assistant-core` version if the major/minor changed.

### 3. Build

```bash
npm run build:packages
```

### 4. Verify package contents

Before publishing, check that each package includes only what's intended:

```bash
npm -w @unopsitg/page-assistant-core pack --dry-run
npm -w @unopsitg/page-assistant-react pack --dry-run
npm -w @unopsitg/page-assistant-web-component pack --dry-run
```

Each should contain only `dist/` files plus `package.json`.

### 5. Publish

Publish in dependency order (core first, then react, then web-component):

```bash
npm -w @unopsitg/page-assistant-core publish --access public
npm -w @unopsitg/page-assistant-react publish --access public
npm -w @unopsitg/page-assistant-web-component publish --access public
```

The `--access public` flag is required for scoped packages on the first publish. After the first publish, it's remembered and can be omitted.

### 6. Verify

```bash
npm info @unopsitg/page-assistant-core
npm info @unopsitg/page-assistant-react
npm info @unopsitg/page-assistant-web-component
```

### Publishing a pre-release

```bash
npm -w @unopsitg/page-assistant-core version 0.2.0-beta.1
npm -w @unopsitg/page-assistant-react version 0.2.0-beta.1
npm -w @unopsitg/page-assistant-web-component version 0.2.0-beta.1

npm run build:packages

npm -w @unopsitg/page-assistant-core publish --access public --tag beta
npm -w @unopsitg/page-assistant-react publish --access public --tag beta
npm -w @unopsitg/page-assistant-web-component publish --access public --tag beta
```

Consumers can install with `npm install @unopsitg/page-assistant-react@beta`.

---

## 3D Assets

Character models start as **Mixamo FBX files** and are converted to optimized **GLB** files for runtime use. The conversion merges 7 FBX files per character into a single compressed GLB (typically 99%+ size reduction).

### Step 1 — Download from Mixamo

Go to [mixamo.com](https://www.mixamo.com) (requires an Adobe account). For each character, download **7 FBX files** — one base mesh and six animations.

**Base mesh (T-Pose):**

1. Search for and select the character (e.g. "Amy").
2. Download with: Format **FBX Binary (.fbx)**, Pose **T-Pose**, **With Skin**.

**Animations (6 clips):**

For each animation below, search Mixamo, preview it on your character, then download with: Format **FBX Binary (.fbx)**, **Without Skin**.

| File name | Mixamo search term | Notes |
|-----------|-------------------|-------|
| `<char>-idle.fbx` | "Breathing Idle" or "Happy Idle" | Looping. Subtle breathing/weight shift. |
| `<char>-walk.fbx` | "Walking" | Looping. **"In Place" must be checked.** |
| `<char>-point.fbx` | "Pointing" or "Pointing Gesture" | One-shot. Arm extended forward. |
| `<char>-wave.fbx` | "Waving" | One-shot. Greeting gesture. |
| `<char>-talk.fbx` | "Talking" or "Explaining Gesture" | Looping. Hands move as if explaining. |
| `<char>-hiphop.fbx` | "Hip Hop Dancing" | Looping. Fun/easter-egg dance. |

**Download tips:**

- Always select your character first so the preview confirms the animation works with their rig.
- For the Walk clip, ensure **"In Place"** is checked — the character's legs animate but the root stays stationary (translation is controlled in code).
- Adjust the **Arm Space** slider if arms clip through the body on any animation.
- Use 60 FPS (Mixamo default). Do not reduce to 30.

**Rename** downloaded files to match the naming convention and place them under `public/mixamo_files/<character>/`:

```
public/mixamo_files/<character>/
  ├── <character>-tpose.fbx      ← With Skin
  ├── <character>-idle.fbx       ← Without Skin
  ├── <character>-walk.fbx       ← Without Skin, In Place
  ├── <character>-point.fbx      ← Without Skin
  ├── <character>-wave.fbx       ← Without Skin
  ├── <character>-talk.fbx       ← Without Skin
  └── <character>-hiphop.fbx     ← Without Skin
```

Characters: `amy`, `sophie`, `michelle`, `aj`, `boss`, `brian`, `doozy`, `joe`, `mousey`.

### Step 2 — Convert FBX to GLB

The conversion script merges all 7 FBX files into a single optimized `.glb` and writes it to `public/models/`.

```bash
# Convert a single character
npm run convert-model -- amy

# Convert all characters at once
npm run convert-model
```

**What the script does:**

1. Converts each FBX to a temporary GLB via [FBX2glTF](https://github.com/facebookincubator/FBX2glTF)
2. Loads the base character mesh (T-Pose with skeleton and textures)
3. Merges all 6 animation clips into the base document, matching bones by name
4. Resamples keyframes (removes redundant 60fps frames)
5. Deduplicates accessors and textures
6. Prunes unused resources
7. Quantizes vertex data (positions, normals, UVs)
8. Compresses textures to WebP at target resolution
9. Applies meshopt compression on geometry and animation data
10. Writes the final `.glb` to `public/models/<character>.glb`

**Tuning parameters:**

Edit `buildCharacterConfig()` in `scripts/convert-mixamo.ts` to adjust conversion settings:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `textureSize` | `1024` | Max texture dimension in pixels. Lower to `512` for smaller files (mobile). |
| `textureFormat` | `'webp'` | `'webp'` for smallest size, `'png'` if WebP causes visual issues. |
| `compressionLevel` | `'medium'` | Meshopt level: `'low'`, `'medium'`, or `'high'`. Higher = smaller but slower to encode. |
| `keepIntermediate` | `false` | Set to `true` to also write an uncompressed GLB for debugging in [glTF Viewer](https://gltf-viewer.donmccurdy.com). |

---

## Project Structure

```
├── packages/
│   ├── core/                      @unopsitg/page-assistant-core
│   │   ├── src/
│   │   │   ├── types.ts           Shared types (PageAssistantAPI, AssistantState, TourConfig, …)
│   │   │   ├── constants.ts       Characters, bone names, animation config
│   │   │   ├── voice.ts           Voice resolution, scoring, tagging
│   │   │   ├── dom.ts             DOM utilities (element resolution, centering)
│   │   │   ├── scroll.ts          Smooth scroll with sticky header support
│   │   │   ├── math.ts            Arm/turn computation
│   │   │   └── index.ts           Barrel export
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   └── vite.config.ts
│   ├── react/                     @unopsitg/page-assistant-react
│   │   ├── src/
│   │   │   ├── usePageAssistantEngine.ts   Core engine hook (state, effects, API)
│   │   │   ├── PageAssistantProvider.tsx    Context provider for React apps
│   │   │   ├── PageAssistantStandalone.tsx  Ref-based standalone (used by web component)
│   │   │   ├── PageAssistantOverlay.tsx     Canvas + speech bubble rendering
│   │   │   ├── AssistantCanvas.tsx          R3F Canvas, camera, lighting
│   │   │   ├── CharacterModel.tsx           GLB loading, animation mixer, walking
│   │   │   ├── BoneOverrideController.tsx   Head/neck/spine look-at & arm IK
│   │   │   ├── SpeechBubble.tsx             Floating bubble anchored to character head
│   │   │   ├── useSpeech.ts                 Web Speech API React hook
│   │   │   ├── useCursorTracking.ts         Mouse/touch position tracking
│   │   │   ├── useScreenToWorld.ts          Screen-to-world coordinate projection
│   │   │   ├── types.ts                     Three.js-dependent types (BoneRefs, Controller)
│   │   │   ├── styles.ts                    CSS-in-JS for bubble and loader
│   │   │   └── index.ts                     Barrel export
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   └── vite.config.ts
│   └── web-component/             @unopsitg/page-assistant-web-component
│       ├── src/
│       │   ├── page-assistant-element.tsx   Custom element class
│       │   └── index.ts                    Registration + exports
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       └── vite.config.ts
├── src/                           Demo application
│   ├── main.tsx                   React root
│   ├── App.tsx                    Demo page with controls, themes, character picker
│   ├── App.css                    Demo layout and control panel styles
│   └── index.css                  Global styles and theme variables
├── scripts/
│   └── convert-mixamo.ts          FBX-to-GLB conversion script
├── public/
│   ├── models/                    Optimized GLB character files (generated)
│   └── mixamo_files/              Source FBX files from Mixamo (not committed)
├── index.html                     Demo entry point
├── package.json                   Root workspace config + demo deps
├── vite.config.ts                 Demo Vite config (with workspace aliases)
├── tsconfig.json                  Root TypeScript config (with workspace paths)
└── firebase.json                  Firebase Hosting config
```

## Deploy (demo site)

```bash
npm run build
firebase deploy --only hosting:pagecompanion
```

## License

Private — not currently published under an open-source license.
