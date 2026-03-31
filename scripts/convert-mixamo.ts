/**
 * convert-mixamo.ts
 *
 * Converts a set of Mixamo FBX files into a single optimized GLB file.
 *
 * Input:  One base FBX (character mesh + T-Pose) and N animation-only FBX files.
 * Output: A single compressed .glb with all animations merged in.
 *
 * Pipeline:
 *   1. Convert each FBX to a temporary .glb using FBX2glTF
 *   2. Load the base character .glb (has mesh, skeleton, textures)
 *   3. Load each animation .glb and copy its animation clips into the base document
 *   4. Resample keyframes (remove redundant 60fps frames)
 *   5. Deduplicate accessors and textures
 *   6. Prune unused resources
 *   7. Resize textures to target resolution
 *   8. Compress textures to WebP
 *   9. Apply meshopt compression (geometry + animation data)
 *  10. Write the final .glb
 *
 * Usage:
 *   npx tsx scripts/convert-mixamo.ts [characterId]
 *   npx tsx scripts/convert-mixamo.ts amy
 *   npx tsx scripts/convert-mixamo.ts          # converts all characters
 *
 * Prerequisites:
 *   npm install --save-dev @gltf-transform/core @gltf-transform/functions \
 *     @gltf-transform/extensions meshoptimizer sharp fbx2gltf tsx
 */

import { NodeIO, Document, Logger } from "@gltf-transform/core";
import {
  resample,
  prune,
  dedup,
  textureCompress,
  quantize,
} from "@gltf-transform/functions";
import {
  EXTMeshoptCompression,
  KHRMeshQuantization,
} from "@gltf-transform/extensions";
import { MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import fbx2gltf from "fbx2gltf";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface AnimationSource {
  fbxPath: string;
  clipName: string;
}

interface ConvertOptions {
  baseFbx: string;
  animations: AnimationSource[];
  outputPath: string;
  textureSize?: number;
  textureFormat?: "webp" | "png";
  compressionLevel?: "low" | "medium" | "high";
  keepIntermediate?: boolean;
  quantizePosition?: number;
  normalMapFormat?: "webp" | "png";
}

// ---------------------------------------------------------------------------
// Directory layout — all FBX files live under public/mixamo_files/<character>/
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, "..");
const MIXAMO_DIR = path.join(PROJECT_ROOT, "public", "mixamo_files");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "public", "models");

// Clip names must match the constants in src/components/PageAssistant/constants.ts
const CLIP_NAMES = {
  IDLE: "Idle",
  WALK: "Walk",
  POINT: "Point",
  WAVE: "Wave",
  TALK: "Talk",
  DANCE: "Dance",
} as const;

function buildCharacterConfig(
  characterId: string,
  overrides?: Partial<ConvertOptions>
): ConvertOptions {
  const charDir = path.join(MIXAMO_DIR, characterId);
  const prefix = characterId;

  return {
    baseFbx: path.join(charDir, `${prefix}-tpose.fbx`),
    animations: [
      { fbxPath: path.join(charDir, `${prefix}-idle.fbx`), clipName: CLIP_NAMES.IDLE },
      { fbxPath: path.join(charDir, `${prefix}-walk.fbx`), clipName: CLIP_NAMES.WALK },
      { fbxPath: path.join(charDir, `${prefix}-point.fbx`), clipName: CLIP_NAMES.POINT },
      { fbxPath: path.join(charDir, `${prefix}-wave.fbx`), clipName: CLIP_NAMES.WAVE },
      { fbxPath: path.join(charDir, `${prefix}-talk.fbx`), clipName: CLIP_NAMES.TALK },
      { fbxPath: path.join(charDir, `${prefix}-hiphop.fbx`), clipName: CLIP_NAMES.DANCE },
    ],
    outputPath: path.join(OUTPUT_DIR, `${characterId}.glb`),
    textureSize: 1024,
    textureFormat: "webp",
    compressionLevel: "medium",
    keepIntermediate: false,
    ...overrides,
  };
}

const CHARACTER_OVERRIDES: Record<string, Partial<ConvertOptions>> = {
  brian: {
    textureFormat: "png",
    textureSize: 2048,
    quantizePosition: 16,
  },
};

const ALL_CHARACTER_IDS = [
  "amy",
  "sophie",
  "michelle",
  "aj",
  "boss",
  "brian",
  "doozy",
  "joe",
  "mousey",
];

// ---------------------------------------------------------------------------
// FBX to GLB conversion via FBX2glTF binary
// ---------------------------------------------------------------------------

async function convertFbxToGlb(fbxPath: string): Promise<string> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mixamo-"));
  const baseName = path.basename(fbxPath, ".fbx");
  const outputPath = path.join(tmpDir, `${baseName}.glb`);

  console.log(`  Converting ${path.basename(fbxPath)} -> GLB...`);

  await fbx2gltf(fbxPath, outputPath, ["--binary"]);

  if (!fs.existsSync(outputPath)) {
    throw new Error(`FBX2glTF did not produce output at ${outputPath}`);
  }

  return outputPath;
}

// ---------------------------------------------------------------------------
// Merge animation clips from a source document into a target document
// ---------------------------------------------------------------------------

function mergeAnimations(
  target: Document,
  source: Document,
  clipName: string
): void {
  const sourceRoot = source.getRoot();
  const targetRoot = target.getRoot();

  const targetNodesByName = new Map<
    string,
    ReturnType<typeof targetRoot.listNodes>[0]
  >();
  for (const node of targetRoot.listNodes()) {
    const name = node.getName();
    if (name) {
      targetNodesByName.set(name, node);
    }
  }

  const sourceAnimations = sourceRoot.listAnimations();
  if (sourceAnimations.length === 0) {
    console.warn(`  Warning: No animations found in source for "${clipName}"`);
    return;
  }

  // FBX2glTF sometimes produces multiple animations per file (e.g. Doozy).
  // Pick the one with the most channels for the best coverage.
  const bestAnim = sourceAnimations.reduce((best, curr) =>
    curr.listChannels().length > best.listChannels().length ? curr : best,
    sourceAnimations[0],
  );

  {
    const sourceAnim = bestAnim;
    const targetAnim = target.createAnimation(clipName);

    for (const sourceSampler of sourceAnim.listSamplers()) {
      const inputAccessor = sourceSampler.getInput();
      const outputAccessor = sourceSampler.getOutput();

      if (!inputAccessor || !outputAccessor) continue;

      const targetInput = target
        .createAccessor()
        .setType(inputAccessor.getType())
        .setArray(inputAccessor.getArray()!.slice());

      const targetOutput = target
        .createAccessor()
        .setType(outputAccessor.getType())
        .setArray(outputAccessor.getArray()!.slice());

      const targetSampler = target
        .createAnimationSampler()
        .setInput(targetInput)
        .setOutput(targetOutput)
        .setInterpolation(sourceSampler.getInterpolation());

      targetAnim.addSampler(targetSampler);
    }

    const sourceSamplers = sourceAnim.listSamplers();
    const targetSamplers = targetAnim.listSamplers();
    let channelCount = 0;

    for (const sourceChannel of sourceAnim.listChannels()) {
      const sourceNode = sourceChannel.getTargetNode();
      if (!sourceNode) continue;

      const nodeName = sourceNode.getName();
      const targetNode = targetNodesByName.get(nodeName);

      if (!targetNode) continue;

      const sourceSampler = sourceChannel.getSampler();
      const samplerIndex = sourceSamplers.indexOf(sourceSampler!);

      if (samplerIndex === -1 || !targetSamplers[samplerIndex]) continue;

      const targetChannel = target
        .createAnimationChannel()
        .setTargetNode(targetNode)
        .setTargetPath(sourceChannel.getTargetPath())
        .setSampler(targetSamplers[samplerIndex]);

      targetAnim.addChannel(targetChannel);
      channelCount++;
    }

    if (sourceAnimations.length > 1) {
      console.log(
        `  Merged "${clipName}" (${channelCount} channels, ` +
          `${sourceAnim.listSamplers().length} samplers) ` +
          `[picked best of ${sourceAnimations.length} animations]`
      );
    } else {
      console.log(
        `  Merged "${clipName}" (${channelCount} channels, ` +
          `${sourceAnim.listSamplers().length} samplers)`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Optimization pipeline
// ---------------------------------------------------------------------------

async function optimizeDocument(
  document: Document,
  options: ConvertOptions
): Promise<void> {
  const textureSize = options.textureSize ?? 1024;
  const level = options.compressionLevel ?? "medium";

  console.log("\nOptimizing...");

  document.createExtension(KHRMeshQuantization).setRequired(true);
  document
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({
      method: EXTMeshoptCompression.EncoderMethod.FILTER,
    });

  const positionBits = options.quantizePosition ?? 14;

  const transforms: Parameters<typeof document.transform> = [
    resample({ tolerance: 0.001 }),
    prune(),
    dedup(),
    quantize({
      quantizePosition: positionBits,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
    }),
  ];

  // Normal maps must not be resized with standard interpolation — averaging XYZ
  // direction vectors as colours destroys their unit-length property, producing
  // the dark crushed artefacts visible on Brian's shirt.  Apply compression in
  // two passes: one for colour/roughness/emissive textures (with resize), and a
  // separate PNG-only pass for normal maps (no resize).
  if (options.textureFormat === "webp") {
    transforms.push(
      textureCompress({
        encoder: sharp,
        targetFormat: "webp",
        resize: [textureSize, textureSize],
        quality: 80,
        slots: /^(?!normalTexture$).*/,
      })
    );
  } else {
    transforms.push(
      textureCompress({
        encoder: sharp,
        targetFormat: "png",
        resize: [textureSize, textureSize],
        slots: /^(?!normalTexture$).*/,
      })
    );
  }

  // Normal maps: re-encode to PNG to strip any embedded JPEG artefacts, but
  // deliberately skip the resize so the direction vectors are never interpolated.
  transforms.push(
    textureCompress({
      encoder: sharp,
      targetFormat: "png",
      slots: /^normalTexture$/,
    })
  );

  await document.transform(...transforms);

  console.log("  Resampled animation keyframes");
  console.log("  Pruned unused resources");
  console.log("  Deduplicated accessors");
  console.log(`  Quantized vertex data (position: ${positionBits} bits)`);
  console.log(
    `  Compressed textures to ${options.textureFormat} @ ${textureSize}px`
  );
  console.log(`  Meshopt compression level: ${level}`);
}

// ---------------------------------------------------------------------------
// Stats reporting
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function reportInputSizes(
  baseFbx: string,
  animations: AnimationSource[]
): number {
  let total = 0;
  const baseSize = fs.statSync(baseFbx).size;
  total += baseSize;
  console.log(`  ${path.basename(baseFbx)}: ${formatBytes(baseSize)}`);

  for (const anim of animations) {
    const size = fs.statSync(anim.fbxPath).size;
    total += size;
    console.log(`  ${path.basename(anim.fbxPath)}: ${formatBytes(size)}`);
  }

  console.log(`  Total input: ${formatBytes(total)}`);
  return total;
}

// ---------------------------------------------------------------------------
// Convert a single character
// ---------------------------------------------------------------------------

async function convertCharacter(config: ConvertOptions): Promise<void> {
  if (!fs.existsSync(config.baseFbx)) {
    throw new Error(`Base FBX not found: ${config.baseFbx}`);
  }
  for (const anim of config.animations) {
    if (!fs.existsSync(anim.fbxPath)) {
      throw new Error(`Animation FBX not found: ${anim.fbxPath}`);
    }
  }

  console.log("Input files:");
  const inputTotal = reportInputSizes(config.baseFbx, config.animations);

  await MeshoptEncoder.ready;

  const io = new NodeIO()
    .setLogger(new Logger(Logger.Verbosity.WARN))
    .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({
      "meshopt.encoder": MeshoptEncoder,
    });

  // Step 1: Convert all FBX files to temporary GLBs
  console.log("\nStep 1: Converting FBX to GLB...");
  const tempFiles: string[] = [];

  const baseGlbPath = await convertFbxToGlb(config.baseFbx);
  tempFiles.push(baseGlbPath);

  const animGlbPaths: { path: string; clipName: string }[] = [];
  for (const anim of config.animations) {
    const glbPath = await convertFbxToGlb(anim.fbxPath);
    tempFiles.push(glbPath);
    animGlbPaths.push({ path: glbPath, clipName: anim.clipName });
  }

  // Step 2: Load the base character document
  console.log("\nStep 2: Loading base character...");
  const baseDoc = await io.read(baseGlbPath);

  for (const anim of baseDoc.getRoot().listAnimations()) {
    anim.dispose();
  }
  console.log("  Loaded base mesh and skeleton");

  // FBX2glTF marks materials as BLEND whenever the diffuse texture incidentally
  // contains an alpha channel, even when every pixel is fully opaque.  This
  // causes Three.js to render the mesh with alpha blending, making the torso
  // see-through (far-side limbs visible through the body).  Reset any BLEND
  // material that has no base-color alpha below 1 back to OPAQUE.
  let fixedAlphaCount = 0;
  for (const material of baseDoc.getRoot().listMaterials()) {
    if (material.getAlphaMode() === "BLEND") {
      material.setAlphaMode("OPAQUE");
      fixedAlphaCount++;
    }
  }
  if (fixedAlphaCount > 0) {
    console.log(
      `  Fixed ${fixedAlphaCount} material(s): BLEND -> OPAQUE`
    );
  }

  const boneNames = baseDoc
    .getRoot()
    .listNodes()
    .map((n) => n.getName())
    .filter((n) => n.startsWith("mixamorig"));
  console.log(`  Found ${boneNames.length} skeleton bones`);

  // Step 3: Merge animations
  console.log("\nStep 3: Merging animations...");
  for (const { path: animPath, clipName } of animGlbPaths) {
    const animDoc = await io.read(animPath);
    mergeAnimations(baseDoc, animDoc, clipName);
  }

  const mergedAnims = baseDoc.getRoot().listAnimations();
  console.log(
    `\n  Total animations in merged document: ${mergedAnims.length}`
  );
  for (const anim of mergedAnims) {
    console.log(
      `    - "${anim.getName()}" (${anim.listChannels().length} channels)`
    );
  }

  // Step 4 (optional): Write intermediate uncompressed GLB for debugging
  if (config.keepIntermediate) {
    const intermediatePath = config.outputPath.replace(
      ".glb",
      "-uncompressed.glb"
    );
    await io.write(intermediatePath, baseDoc);
    const intermediateSize = fs.statSync(intermediatePath).size;
    console.log(
      `\n  Intermediate (uncompressed): ${formatBytes(intermediateSize)}`
    );
  }

  // Step 5: Optimize
  await optimizeDocument(baseDoc, config);

  // Step 6: Write final GLB
  console.log("\nStep 6: Writing final GLB...");
  const outputDir = path.dirname(config.outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  await io.write(config.outputPath, baseDoc);
  const outputSize = fs.statSync(config.outputPath).size;

  // Clean up temp files
  for (const tmpFile of tempFiles) {
    try {
      fs.unlinkSync(tmpFile);
      const tmpDir = path.dirname(tmpFile);
      if (fs.readdirSync(tmpDir).length === 0) {
        fs.rmdirSync(tmpDir);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  // Report results
  console.log("\n=== Results ===");
  console.log(
    `  Input:  ${formatBytes(inputTotal)} (${config.animations.length + 1} FBX files)`
  );
  console.log(`  Output: ${formatBytes(outputSize)} (1 GLB file)`);
  console.log(
    `  Reduction: ${((1 - outputSize / inputTotal) * 100).toFixed(1)}%`
  );
  console.log(`  Output: ${config.outputPath}`);
  console.log(
    `\n  Animations: ${mergedAnims.map((a) => a.getName()).join(", ")}`
  );
}

// ---------------------------------------------------------------------------
// Main — accepts optional character IDs as CLI arguments
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Mixamo FBX to Optimized GLB Converter ===\n");

  const args = process.argv.slice(2);
  const characterIds =
    args.length > 0
      ? args.filter((id) => {
          if (!ALL_CHARACTER_IDS.includes(id)) {
            console.warn(`Unknown character: "${id}" — skipping`);
            return false;
          }
          return true;
        })
      : ALL_CHARACTER_IDS;

  if (characterIds.length === 0) {
    console.error("No valid character IDs provided.");
    console.log(`Available: ${ALL_CHARACTER_IDS.join(", ")}`);
    process.exit(1);
  }

  for (const id of characterIds) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`Converting: ${id}`);
    console.log("=".repeat(50));

    try {
      const config = buildCharacterConfig(id, CHARACTER_OVERRIDES[id]);
      await convertCharacter(config);
      console.log(`\n  ✓ ${id}.glb written successfully`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n  ✗ Failed to convert ${id}: ${msg}`);
      if (characterIds.length === 1) process.exit(1);
    }
  }

  console.log("\n\nTo load in R3F:");
  console.log("  import { useGLTF } from '@react-three/drei';");
  console.log("  import { MeshoptDecoder } from 'meshoptimizer';");
  console.log("  useGLTF.setMeshoptDecoder(MeshoptDecoder);");
  console.log("  const { scene, animations } = useGLTF('/models/<character>.glb');");
}

main().catch((err) => {
  console.error("\nFailed:", err.message || err);
  process.exit(1);
});
