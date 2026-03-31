# Mixamo FBX to GLB Conversion Script

## Setup

Install the dependencies:

```bash
npm install --save-dev \
  @gltf-transform/core \
  @gltf-transform/functions \
  @gltf-transform/extensions \
  meshoptimizer \
  sharp \
  fbx2gltf \
  tsx
```

Add to your `package.json` scripts:

```json
{
  "scripts": {
    "convert-model": "tsx scripts/convert-mixamo.ts"
  }
}
```

## File layout

Place your Mixamo FBX downloads here (adjust paths in the script config if different):

```
src/assets/fbx/
  amy-tpose.fbx      <-- Downloaded With Skin
  amy-idle.fbx        <-- Downloaded Without Skin
  amy-walk.fbx        <-- Downloaded Without Skin, In Place
  amy-point.fbx       <-- Downloaded Without Skin
  amy-wave.fbx        <-- Downloaded Without Skin
  amy-talk.fbx        <-- Downloaded Without Skin
  amy-hiphop.fbx      <-- Downloaded Without Skin
```

## Run

```bash
npm run convert-model
```

Output goes to `public/models/amy.glb`.

## Loader change in your React code

Before (FBX):
```tsx
import { useFBX } from '@react-three/drei';
const fbx = useFBX('/models/amy-idle.fbx');
```

After (GLB with meshopt):
```tsx
import { useGLTF, useAnimations } from '@react-three/drei';
import { MeshoptDecoder } from 'meshoptimizer';

// Call once at app startup
useGLTF.setMeshoptDecoder(MeshoptDecoder);

// In your component
const { scene, animations } = useGLTF('/models/amy.glb');
const { actions } = useAnimations(animations, groupRef);

// All clips available by name
actions.Idle?.play();
actions.Walk?.reset().fadeIn(0.4).play();
actions.HipHop?.reset().fadeIn(0.4).play();
```

## Tuning

In the `config` object at the top of `convert-mixamo.ts`:

- `textureSize`: Lower to 512 for even smaller files (mobile). Default 1024.
- `textureFormat`: `'webp'` for smallest size, `'png'` if WebP causes issues.
- `compressionLevel`: `'medium'` is a good balance. `'high'` is slower to encode but smaller.
- `keepIntermediate`: Set to `true` to also write an uncompressed GLB for debugging in Blender or the Three.js viewer.

## Debugging

If the merged GLB has animation issues:

1. Set `keepIntermediate: true` and inspect the uncompressed GLB at https://gltf-viewer.donmccurdy.com
2. Check that bone names match between the base mesh and animation files (they should if all files came from the same Mixamo character)
3. The script logs channel counts per animation; if a clip shows 0 channels, the bone name mapping failed

## Note on fbx2gltf

The `fbx2gltf` npm package bundles a pre-built binary of Facebook's FBX2glTF converter. On first run it downloads the binary for your platform. If you're behind a corporate proxy or the download fails, you can manually install FBX2glTF and adjust the script to call it directly via `child_process.execSync`.