# Product Requirements Document: Animated Page Assistant

**Version:** 1.0
**Date:** 30 March 2026
**Author:** Tushar / Claude (co-authored)
**Status:** Draft

---

## 1. Overview

The Animated Page Assistant is a 3D character rendered inline on a web page using React Three Fiber. The character performs motion-captured animations (sourced from Adobe Mixamo), tracks the user's cursor with its head and torso, walks to positions on the page, and points at specific DOM elements to guide the user's attention. It behaves like a game NPC transplanted into a web application - standing on the page, reacting to context, and directing the user through content.

This document defines the architecture, asset pipeline, animation system, and interaction model required to build the assistant.

---

## 2. Goals

- Deliver a visually realistic, animated 3D character embedded in a standard React web page.
- The character must feel alive at rest: breathing, subtle weight shifts, head tracking.
- The character must walk between positions on the page under programmatic control.
- The character must point at, gesture toward, or otherwise direct the user's attention to specific DOM elements.
- The character must track the user's cursor with its head and upper body in real-time.
- Animation quality must be high (motion-captured), not hand-keyframed or procedurally generated from scratch.
- The system must integrate cleanly with an existing React application without requiring a full game engine.

---

## 3. Non-Goals

- This is not a virtual assistant with speech, NLP, or conversational AI capabilities. It is a visual/animation layer only. Behavioral triggers come from the host application.
- This is not a full 3D scene. The character exists in a constrained, fixed-camera composition designed to overlay or sit alongside conventional DOM content.
- Character customization (skin, clothing, face) is out of scope for v1. A single pre-selected Mixamo character is sufficient.
- Lip-sync and facial animation are out of scope for v1.

---

## 4. Architecture

### 4.1 Technology Stack

| Layer | Technology | Role |
|---|---|---|
| Rendering | React Three Fiber (R3F) | React-idiomatic wrapper around Three.js |
| 3D Engine | Three.js (r182+) | WebGL/WebGPU rendering, skeletal animation, skinned meshes |
| React Integration | @react-three/drei | Utility hooks: `useGLTF`, `useAnimations`, `Html` overlay |
| Asset Format | glTF Binary (.glb) | Single file containing character mesh, skeleton, textures, and all animation clips |
| Animation Source | Adobe Mixamo | Motion-captured animation library, auto-rigging |
| Asset Pipeline | Blender or mixamo2gltf.com | FBX-to-GLB conversion with animation merging |

### 4.2 Component Hierarchy

```
<PageAssistantProvider>          // React context: exposes imperative API
  <Canvas>                       // R3F canvas, positioned via CSS
    <AssistantScene>             // Lights, camera, floor/shadow plane
      <CharacterModel>           // GLB loader, animation mixer, bone refs
        <BoneOverrideController> // Procedural head/torso/arm control
      </CharacterModel>
    </AssistantScene>
  </Canvas>
</PageAssistantProvider>
```

### 4.3 Rendering Approach

The R3F `<Canvas>` is rendered as a fixed or absolutely-positioned element on the page. It does not replace the DOM layout. The canvas is transparent (or matches the page background) so the character composites visually on top of the page content.

Camera: fixed perspective camera, positioned to frame the character from roughly waist-up or full-body depending on layout. No user-controllable orbit or zoom.

The character's world-space position maps to a screen-space position. Movement across the page is achieved by translating the character model (or the camera) within the 3D scene, synchronized to a target screen position derived from DOM element coordinates.

---

## 5. Asset Pipeline

### 5.1 Character Selection

**Selected character: Amy** (Mixamo built-in).

Amy is a stylized female character from Mixamo's standard library. She has clean topology, a standard Mixamo humanoid rig (65 bones, `mixamorig` prefix), and is well-tested across the Mixamo animation library. Requirements:

- Clean topology suitable for web (target under 20k triangles).
- A humanoid rig compatible with Mixamo's standard skeleton (65 bones, `mixamorig` prefix).
- Textures compressed for web delivery (target total GLB under 5 MB with all clips).

### 5.2 Animation Clips

Download the following clips from Mixamo as separate FBX files, each exported as **FBX Binary (.fbx)**, **Without Skin** (except the T-Pose base which is exported **With Skin**):

| Clip Name | Mixamo Search Term | Notes |
|---|---|---|
| TPose | (Amy base character download) | With Skin. Reference pose. |
| Idle | "Breathing Idle" or "Happy Idle" | Looping. Subtle weight shift, breathing. |
| Walk | "Walking" (In Place) | Looping. Must be "In Place" variant. |
| Point | "Pointing" or "Pointing Gesture" | One-shot or looping. Arm extended. |
| Wave | "Waving" | One-shot. Greeting gesture. |
| Talk | "Talking" or "Explaining Gesture" | Looping. Hands move as if explaining. |
| Hip-Hop Dance | "Hip Hop Dancing" | Looping. Fun/easter-egg interaction. |
| LookAround | "Looking Around" | One-shot. Head/torso turns. For idle variation. Optional. |
| WalkStart | "Start Walking" | One-shot transition into walk. Optional. |
| WalkStop | "Stop Walking" | One-shot transition out of walk. Optional. |

Adjustable parameters in Mixamo (arm spacing, overdrive, character arm-space) should be tweaked before download to avoid interpenetration with the character's body.

### 5.3 Conversion to GLB

**Option A: Blender Pipeline**

1. Open Blender (4.x). Create empty scene.
2. Import T-Pose FBX with Manual Orientation and Automatic Bone Orientation enabled.
3. Import each animation FBX the same way.
4. For each animation: select its armature, open the Dope Sheet (Action Editor), assign the action to the character's armature, then push it to an NLA track via Stash.
5. Delete the extra armatures (animation-only objects).
6. Export as glTF Binary (.glb) with all animations included.
7. Validate in the Three.js glTF viewer (gltf-viewer.donmccurdy.com) or gltfjsx.

**Option B: Online Tool**

Use mixamo2gltf.com to upload all FBX files and merge them into a single GLB. Faster, no Blender required. Less control over optimization.

### 5.4 React Component Generation

Run `npx gltfjsx character.glb --types --transform` to generate:

- A typed React component with refs to all nodes, materials, and bones.
- A Draco-compressed version of the GLB (if `--transform` is used).
- Named refs to `mixamorigHead`, `mixamorigNeck`, `mixamorigSpine`, `mixamorigLeftArm`, etc.

---

## 6. Animation System

### 6.1 Animation Mixer

The Three.js `AnimationMixer` manages playback of all clips. It is instantiated once per character and updated every frame via `mixer.update(delta)` inside R3F's `useFrame` hook.

Each clip is accessed via `useAnimations(animations, groupRef)` which returns an `actions` object keyed by clip name.

### 6.2 State Machine

A lightweight state machine governs which clip is playing. States and transitions:

```
          ┌──────────────┐
          │              │
    ┌────>│    Idle      │<────┐
    │     │              │     │
    │     └──────┬───────┘     │
    │            │             │
    │      walk  │  point/     │
    │      Command│  wave/     │ clip
    │            │  talk/      │ ends
    │            │  dance      │
    │            v             │
    │     ┌──────────────┐     │
    │     │   Walking    │     │
    │     └──────┬───────┘     │
    │            │             │
    │      arrive│             │
    │            v             │
    │     ┌──────────────┐     │
    │     │  Gesturing   │─────┘
    │     │ (Point/Wave/ │
    │     │  Talk/Dance) │
    │     └──────────────┘
    │            │
    └────────────┘
```

Transitions use `action.fadeIn(duration)` and `action.fadeOut(duration)` for smooth crossfading. Default crossfade duration: 0.4s.

### 6.3 Bone Splicing (Track Removal)

For cursor tracking to work simultaneously with clip playback, the following bone tracks must be removed from every animation clip before it is registered with the mixer:

- **Head** (`mixamorigHead`): rotation tracks (quaternion or euler, typically track indices vary per clip)
- **Neck** (`mixamorigNeck`): rotation tracks
- **Spine** (`mixamorigSpine`): rotation tracks (for torso twist toward cursor)
- **Left/Right Upper Arm** (`mixamorigLeftArm` / `mixamorigRightArm`): rotation tracks on the pointing arm only, and only during the Point state.

The removal is done once at load time by filtering `clip.tracks` to exclude tracks whose `name` property matches these bone paths. This is more robust than index-based splicing:

```js
const bonesToExclude = ['mixamorigHead', 'mixamorigNeck', 'mixamorigSpine'];

clips.forEach(clip => {
  clip.tracks = clip.tracks.filter(track => {
    return !bonesToExclude.some(bone => track.name.includes(bone));
  });
});
```

With these tracks removed, the mixer animates everything else (legs, hips, arms, fingers, weight shift) while the application code controls head, neck, and spine rotation directly.

### 6.4 Procedural Bone Override

After `mixer.update(delta)` runs each frame, the following overrides are applied:

**Cursor Tracking (Head + Neck + Spine):**

1. Read the cursor's screen position (or use a fixed gaze target).
2. Convert to Normalized Device Coordinates: `ndcX = (screenX / windowWidth) * 2 - 1`, `ndcY = -(screenY / windowHeight) * 2 + 1`.
3. Map NDC to bone rotation ranges:
   - Head Y rotation: `ndcX * maxHeadTurn` (e.g., 0.8 radians)
   - Head X rotation: `ndcY * maxHeadTilt` (e.g., 0.5 radians)
   - Neck: same axis, reduced amplitude (e.g., 60% of head values)
   - Spine: same axis, further reduced (e.g., 30% of head values)
4. Apply via `THREE.MathUtils.lerp()` between current and target rotation for smooth damping. Lerp factor ~0.05 per frame for natural follow lag.

**Pointing at DOM Elements (Arm):**

1. Get target DOM element's `getBoundingClientRect()`.
2. Compute center point: `cx = rect.left + rect.width/2`, `cy = rect.top + rect.height/2`.
3. Convert screen position to world-space `Vector3` using `vector.set(ndcX, ndcY, 0.5).unproject(camera)`.
4. Obtain the upper arm bone's world position.
5. Compute the direction vector from arm to target.
6. Convert direction to local bone space (accounting for parent bone transforms).
7. Apply rotation via `bone.quaternion.slerp(targetQuaternion, lerpFactor)`.

This is the most technically complex part of the system. An IK solver (e.g., THREE.IK or a custom CCD/FABRIK solver targeting the hand with the elbow as a mid-joint) will produce more natural pointing than direct bone rotation. Evaluate both approaches during prototyping.

---

## 7. Interaction Model

### 7.1 Imperative API

The `PageAssistantProvider` context exposes an imperative API to the host application:

```typescript
interface PageAssistantAPI {
  // Movement
  walkTo(targetElement: HTMLElement | string, options?: WalkOptions): Promise<void>;
  walkToPosition(screenX: number, screenY: number, options?: WalkOptions): Promise<void>;
  setPosition(screenX: number, screenY: number): void;

  // Gestures
  pointAt(targetElement: HTMLElement | string, options?: GestureOptions): Promise<void>;
  wave(options?: GestureOptions): Promise<void>;
  talk(options?: GestureOptions): Promise<void>;
  dance(options?: GestureOptions): Promise<void>;
  idle(): void;

  // Gaze
  lookAt(targetElement: HTMLElement | string): void;
  lookAtCursor(): void;  // Default behavior
  lookForward(): void;

  // Visibility
  show(): void;
  hide(): void;
  isVisible: boolean;

  // State
  currentState: AssistantState;
  onStateChange: (callback: (state: AssistantState) => void) => () => void;
}

interface WalkOptions {
  speed?: number;         // Walk speed in screen pixels per second
  onArrive?: () => void;  // Callback when character reaches destination
}

interface GestureOptions {
  duration?: number;      // How long to hold the gesture (ms). 0 = until interrupted.
  returnToIdle?: boolean; // Whether to auto-return to idle after gesture completes
}

type AssistantState = 'idle' | 'walking' | 'pointing' | 'waving' | 'talking' | 'dancing' | 'hidden';
```

### 7.2 Walking Across the Page

When `walkTo(element)` is called:

1. State transitions to `walking`.
2. Walk animation clip fades in (with optional WalkStart transition clip).
3. The character's world-space X position is interpolated toward the target screen X, converted to world-space via the camera projection.
4. The character faces the direction of travel (Y rotation on root).
5. On arrival (within threshold distance), walk animation fades out (with optional WalkStop transition clip).
6. Promise resolves. State transitions to `idle` or the next queued action.

The walk animation is "in place" - the legs move but the character does not translate. Translation is applied separately to the model's root group, synchronized to the animation's apparent step speed.

### 7.3 Click/Hover Interaction on the Character

Raycasting detects mouse interaction with the character mesh.

**Default click behavior:** Clicking on the character transitions it into the Hip-Hop Dance state. The dance plays for its full loop duration (or a configurable number of loops), then crossfades back to Idle. If the character is clicked again while already dancing, the dance restarts from the beginning. If the character is mid-walk or mid-gesture when clicked, the current action is interrupted and the dance takes priority.

The host application can override this default by registering a custom `onClick` callback. When a custom callback is registered, it replaces the default dance behavior entirely - the callback is responsible for deciding what happens (it may call `assistant.dance()` itself, or do something else).

**Hover behavior:** On hover, the cursor changes to `pointer` over the character mesh (via a CSS class toggle on the canvas container). An optional `onHover` callback is available for the host application to react (e.g., show a tooltip, trigger a subtle reaction animation).

```typescript
interface PageAssistantAPI {
  // ... (extends above)
  onClick: (callback: () => void) => () => void;   // Returns unsubscribe function
  onHover: (callback: (hovering: boolean) => void) => () => void;
}
```

---

## 8. Layout and Composition

### 8.1 Canvas Placement

The R3F `<Canvas>` is rendered as a fixed-position overlay or within a designated container element. Two layout modes:

**Overlay Mode:** Canvas covers the full viewport with `pointer-events: none` (re-enabled only on the character mesh via raycasting). The character appears to stand on the page content. This mode requires careful z-index management.

**Container Mode:** Canvas is placed inside a specific `<div>` with defined dimensions (e.g., a sidebar, a bottom-right corner widget, or a dedicated assistant panel). Simpler integration but constrains the character's movement range.

### 8.2 Camera Configuration

A fixed `PerspectiveCamera` with:

- FOV: ~50
- Position: framing the character from roughly mid-body, looking slightly down.
- No user orbit/zoom controls.
- Near/far planes tuned to the character's scale.

For a more "flat" game-character-on-page look, an orthographic camera may be evaluated. This simplifies the screen-to-world coordinate mapping (linear rather than perspective-projected) but produces a different visual feel.

### 8.3 Shadow and Ground Plane

A transparent ground plane with `receiveShadow: true` sits beneath the character, catching a soft directional light shadow. The ground plane is invisible except for the shadow, giving the character a grounded appearance on the page.

---

## 9. Performance Requirements

| Metric | Target |
|---|---|
| GLB file size (compressed) | Under 5 MB total |
| Draw calls per frame | Under 50 |
| Frame rate | 60 fps on mid-range desktop, 30 fps minimum on mobile |
| Time to first render | Under 2 seconds after GLB fetch completes |
| Memory | Under 100 MB GPU memory for the character scene |
| Initial load impact | Canvas and GLB load lazily; do not block page paint |

### 9.1 Optimization Strategies

- Draco compression on the GLB via gltfjsx `--transform`.
- Texture resolution capped at 1024x1024 for web delivery.
- Animation clips trimmed to only the frames needed (no wasted keyframes at start/end).
- `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` to cap at 2x on high-DPI screens.
- WebGPU renderer as primary with automatic WebGL 2 fallback (Three.js r171+).
- Lazy-load the canvas and GLB: render a placeholder silhouette or static image until the 3D scene is ready.
- Consider `requestIdleCallback` or `IntersectionObserver` to defer canvas initialization if the assistant is below the fold.

---

## 10. Accessibility

- The 3D canvas is decorative/supplementary. All information conveyed by the assistant's gestures must also be available via conventional UI (text, highlights, focus management).
- The canvas element carries `aria-hidden="true"` and `role="presentation"`.
- A "Reduce Motion" media query (`prefers-reduced-motion: reduce`) disables the character or replaces it with a static image.
- Click/hover interactions on the character have keyboard-accessible alternatives in the DOM.

---

## 11. Open Questions

1. **Character aesthetic fit:** Amy has been selected as the v1 character. If Amy's visual style doesn't fit the product's identity, a replacement character can be swapped in using the same pipeline (re-download from Mixamo, re-run conversion and gltfjsx).

2. **IK vs. direct rotation for pointing:** A simple two-bone IK solver (upper arm + forearm) will produce more natural pointing than direct quaternion manipulation on the upper arm bone alone. Prototyping will determine whether the added complexity is justified.

3. **Walk-to-element vertical movement:** If the character needs to "walk" up or down the page (e.g., to an element above the fold), does it walk off-screen and re-enter, or does it visually translate vertically? Vertical translation looks odd for a walking character. Options: walk off-screen left, reappear at new Y position walking in from left. Or: teleport with a transition animation.

4. **Multiple characters:** Is there ever a need for more than one assistant character on screen? If so, the architecture should support multiple `AnimationMixer` instances and independent state machines from the outset.

5. **Mobile:** On small screens, a full 3D character may dominate the viewport. Should mobile get a reduced version (head-and-shoulders only, smaller canvas) or be opted out entirely?

6. **Custom characters:** For v2, should the pipeline support uploading a custom character (e.g., from Ready Player Me or Avaturn) and auto-rigging via Mixamo's API?

---

## 12. Implementation Plan

The build is structured as three sequential stages. Claude executes all code, conversion, and assembly. Tushar handles the one step that requires browser authentication (Mixamo downloads).

### Stage 1: Asset Acquisition (Tushar)

Mixamo requires an Adobe account and interactive browser session. Claude cannot authenticate to Mixamo. Tushar performs the following downloads from https://www.mixamo.com:

**Character:** Amy (Mixamo's built-in character, search "Amy")

**Downloads required:**

| # | Asset | Mixamo Search Term | Download Settings |
|---|---|---|---|
| 1 | Amy T-Pose (base mesh) | (Select Amy as character) | Format: **FBX Binary (.fbx)**, Pose: **T-Pose**, **With Skin** |
| 2 | Idle | "Breathing Idle" | Format: **FBX Binary (.fbx)**, Skin: **Without Skin** |
| 3 | Walk | "Walking" | Format: **FBX Binary (.fbx)**, Skin: **Without Skin**, **In Place** checked |
| 4 | Point | "Pointing" | Format: **FBX Binary (.fbx)**, Skin: **Without Skin** |
| 5 | Wave | "Waving" | Format: **FBX Binary (.fbx)**, Skin: **Without Skin** |
| 6 | Talking | "Talking" or "Explaining" | Format: **FBX Binary (.fbx)**, Skin: **Without Skin** |
| 7 | Hip-Hop Dance | "Hip Hop Dancing" | Format: **FBX Binary (.fbx)**, Skin: **Without Skin** |

**Important download notes:**
- For each animation, select Amy as the active character first so the preview confirms the clip works with her rig.
- For the Walk clip, ensure the **"In Place"** checkbox is ticked. This keeps the root stationary so we can control translation in code.
- Tweak the **Arm Space** slider if Amy's arms clip through her body on any clip. Wider arm spacing prevents interpenetration.
- Use 60 FPS for all downloads (Mixamo default). Do not reduce to 30.
- Rename downloads to clean names after downloading: `amy-tpose.fbx`, `amy-idle.fbx`, `amy-walk.fbx`, `amy-point.fbx`, `amy-wave.fbx`, `amy-talk.fbx`, `amy-hiphop.fbx`.

**Deliverable:** Seven `.fbx` files uploaded to the Claude conversation.

### Stage 2: Asset Conversion (Claude)

Claude takes the seven FBX files and produces a single optimized GLB.

**Step 2.1: Merge animations into one GLB**

Primary approach: use the Mixamo Animation Combiner (https://mixamo2gltf.com) if accessible from the build environment. Upload all seven FBX files, merge, and download the combined GLB.

Fallback approach: use a Python-based FBX-to-glTF pipeline in the build environment:
- Install `fbx2gltf` (Facebook's open-source converter) or use `trimesh` / `pygltflib`.
- Convert each FBX to individual glTF.
- Merge all animation clips into the T-Pose base model's glTF using a script that copies `AnimationClip` data.
- Export as binary `.glb`.

**Step 2.2: Validate the GLB**

- Confirm all seven clips are present and named correctly in the animation array.
- Confirm the skeleton uses `mixamorig` bone name prefix.
- Confirm the mesh renders correctly (no distorted vertices, no missing textures).
- Check file size. Target: under 5 MB. If over, reduce texture resolution to 1024x1024 and apply Draco mesh compression.

**Step 2.3: Generate React component scaffold**

Run `npx gltfjsx amy.glb --types --transform` to produce:
- A typed `<Amy>` React component with named refs to all bones (`mixamorigHead`, `mixamorigNeck`, `mixamorigSpine`, `mixamorigLeftArm`, `mixamorigRightArm`, `mixamorigHips`, etc.).
- A Draco-compressed copy of the GLB.
- Type definitions for all nodes, materials, and animation actions.

**Deliverable:** One `amy.glb` file and one `Amy.tsx` scaffold component.

### Stage 3: Application Code (Claude)

Claude writes all code from scratch. The build is broken into four incremental milestones. Each milestone produces a working, testable artifact.

#### Milestone 1: Character on Page with Cursor Tracking

**Files created:**
```
src/
  components/
    PageAssistant/
      index.ts                    # Public export
      PageAssistantProvider.tsx    # React context + imperative API
      AssistantCanvas.tsx          # R3F <Canvas> wrapper with camera, lights, shadows
      AmyModel.tsx                # GLB loader, animation mixer setup, bone refs
      BoneOverrideController.tsx  # Cursor tracking logic (head/neck/spine)
      useCursorTracking.ts        # Hook: maps cursor screen position to bone rotation targets
      useScreenToWorld.ts         # Hook: converts DOM coordinates to Three.js world coordinates
      constants.ts                # Bone names, rotation limits, lerp factors, camera config
      types.ts                    # TypeScript interfaces for API, state, options
  public/
    models/
      amy.glb                    # Character asset
```

**What it does:**
- Renders the R3F canvas as a fixed-position overlay (or container, configurable via prop).
- Loads `amy.glb`, instantiates the `AnimationMixer`, plays the Idle clip.
- At load time, splices head/neck/spine rotation tracks out of the Idle clip using name-based track filtering (not index-based).
- On every frame (`useFrame`): updates the mixer, then overrides head, neck, and spine bone rotations to track the cursor position with smooth lerp damping.
- Shadow-catching ground plane beneath the character.
- Transparent canvas background so the character composites over the page.

**Testable result:** Amy stands on the page, breathes (idle animation on body), and smoothly follows the cursor with her head and upper torso.

#### Milestone 2: Animation State Machine + Walking

**What it adds:**
- All seven animation clips registered with the mixer. All clips have head/neck/spine tracks spliced out.
- A state machine (implemented as a `useReducer` or a small finite state machine) governing transitions between: `idle`, `walking`, `pointing`, `waving`, `talking`, `dancing`.
- Crossfade transitions between clips using `action.fadeIn(0.4)` / `action.fadeOut(0.4)`.
- `walkTo(target)` implementation:
  - Accepts an `HTMLElement`, a CSS selector string, or an `{x, y}` screen coordinate.
  - Converts the target's screen X position to a world-space X position via camera unprojection.
  - Transitions to the Walk clip.
  - Translates the character's root group toward the target X on each frame, synchronized to the walk animation's step cadence.
  - Flips the character's facing direction (Y rotation on root) based on travel direction.
  - On arrival (within threshold), crossfades back to Idle.
  - Returns a `Promise<void>` that resolves on arrival.

**Testable result:** Calling `assistant.walkTo('#some-element')` makes Amy walk across the screen to that element's horizontal position, then stop.

#### Milestone 3: Pointing, Gestures, and Full API

**What it adds:**
- `pointAt(target)` implementation:
  - Converts the target DOM element's center to world-space `Vector3` via `vector.unproject(camera)`.
  - Transitions to the Point animation clip.
  - Additionally overrides the right arm bone chain (upper arm, forearm) to aim toward the world-space target.
  - Uses either direct quaternion rotation or a lightweight two-bone IK solver (CCD or analytical) for natural arm posing.
  - The arm tracks for the pointing arm are spliced out of the Point clip specifically, while the left arm and body remain animation-driven.
- `wave()`, `talk()`, `dance()` implementations: straightforward clip transitions with configurable duration and auto-return-to-idle.
- `lookAt(target)` override: directs head tracking at a specific element instead of the cursor.
- Raycasting for click detection on the character mesh. Default click behavior: transition to Hip-Hop Dance, play for one full loop, crossfade back to Idle. Clicking while dancing restarts the dance. Custom `onClick` callback overrides the default.
- Hover detection: cursor changes to `pointer` over the character mesh. `onHover` callback available.
- Full `PageAssistantProvider` context exposing the imperative API defined in Section 7.1.
- Action queuing: if `walkTo()` is called while already walking, the new target replaces the current one. If `pointAt()` is called, it waits for walk to complete (or interrupts, configurable).

**Testable result:** A consuming component can do:
```tsx
const assistant = usePageAssistant();

// Walk to an element, then point at it
await assistant.walkTo('#pricing-table');
await assistant.pointAt('#pricing-table');

// After 3 seconds, wave and go idle
setTimeout(() => {
  assistant.wave({ duration: 2000 });
}, 3000);

// Clicking Amy makes her dance (this is the default behavior,
// no code needed). To override:
assistant.onClick(() => {
  console.log('Custom click handler - dance is suppressed');
  assistant.wave();
});
});
```

#### Milestone 4: Polish and Production Readiness

**What it adds:**
- Idle variation system: after N seconds of idle, randomly play a subtle LookAround or weight-shift variant, then return to base idle. Prevents the character from feeling frozen.
- Loading state: render a CSS placeholder (silhouette or spinner) while the GLB is fetching. Fade in the 3D canvas once the first frame renders.
- `prefers-reduced-motion` media query: when active, hide the canvas entirely or show a static image of Amy.
- `aria-hidden="true"` and `role="presentation"` on the canvas.
- `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` cap.
- Lazy initialization: do not create the WebGL context until the `<PageAssistantProvider>` mounts (or until an `IntersectionObserver` confirms visibility).
- Bundle analysis: confirm the R3F/Three.js/Drei chunk is code-split from the main bundle and loaded on demand.
- Documentation: inline JSDoc on all public API methods, plus a README with usage examples.

**Testable result:** Production-deployable `<PageAssistantProvider>` component with clean API, graceful degradation, and no performance regressions on the host page.

---

### Execution Summary

| Stage | Owner | Input | Output |
|---|---|---|---|
| 1. Asset Acquisition | Tushar | Mixamo account + browser | 7 FBX files |
| 2. Asset Conversion | Claude | 7 FBX files | `amy.glb` + `Amy.tsx` scaffold |
| 3. Application Code | Claude | `amy.glb` + this PRD | Complete `PageAssistant` component library |

Tushar's only manual step is Stage 1 (roughly 15-20 minutes in the Mixamo browser UI). Everything else is Claude's job.

---

## 13. Key References

- **Codrops Interactive 3D Character Tutorial** (Kyle Wetton): The definitive reference for cursor-tracking bone override with Mixamo + Three.js. Demonstrates bone splicing, raycasting, and animation switching. https://tympanus.net/codrops/2019/10/14/how-to-create-an-interactive-3d-character-with-three-js/

- **React Three Fiber Character Animation** (CodeWorkshop): End-to-end Mixamo-to-R3F pipeline with Blender conversion. https://codeworkshop.dev/blog/2021-01-20-react-three-fiber-character-animation

- **Three.js AnimationMixer Documentation**: Core animation system API. https://threejs.org/docs/#api/en/animation/AnimationMixer

- **gltfjsx**: Auto-generates typed React components from GLB files. https://github.com/pmndrs/gltfjsx

- **Mixamo**: Character and animation library. https://www.mixamo.com

- **Mixamo Animation Combiner**: Browser-based FBX-to-GLB merger. https://mixamo2gltf.com

- **THREE.IK**: IK solver library for Three.js (for pointing). https://github.com/jsantell/THREE.IK