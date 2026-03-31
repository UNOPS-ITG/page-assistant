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
 *   npx tsx scripts/convert-mixamo.ts
 *
 * Prerequisites:
 *   npm install --save-dev @gltf-transform/core @gltf-transform/functions \
 *     @gltf-transform/extensions meshoptimizer sharp fbx2gltf
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

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface AnimationSource {
  /** Path to the Mixamo FBX file */
  fbxPath: string;
  /** Name to assign to this animation clip in the final GLB */
  clipName: string;
}

interface ConvertOptions {
  /** Path to the base character FBX (exported With Skin from Mixamo) */
  baseFbx: string;
  /** Animation FBX files (exported Without Skin from Mixamo) */
  animations: AnimationSource[];
  /** Output path for the final GLB */
  outputPath: string;
  /** Maximum texture dimension (width and height). Default: 1024 */
  textureSize?: number;
  /** Texture format: 'webp' or 'png'. Default: 'webp' */
  textureFormat?: "webp" | "png";
  /** Meshopt compression level: 'low' | 'medium' | 'high'. Default: 'medium' */
  compressionLevel?: "low" | "medium" | "high";
  /** Whether to keep a copy of the uncompressed merged GLB for debugging. Default: false */
  keepIntermediate?: boolean;
}

// ---------------------------------------------------------------------------
// Edit this section to match your file layout
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, "..");
const FBX_DIR = path.join(PROJECT_ROOT, "src", "assets", "fbx");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "public", "models");

const config: ConvertOptions = {
  baseFbx: path.join(FBX_DIR, "amy-tpose.fbx"),

  animations: [
    { fbxPath: path.join(FBX_DIR, "amy-idle.fbx"), clipName: "Idle" },
    { fbxPath: path.join(FBX_DIR, "amy-walk.fbx"), clipName: "Walk" },
    { fbxPath: path.join(FBX_DIR, "amy-point.fbx"), clipName: "Point" },
    { fbxPath: path.join(FBX_DIR, "amy-wave.fbx"), clipName: "Wave" },
    { fbxPath: path.join(FBX_DIR, "amy-talk.fbx"), clipName: "Talk" },
    { fbxPath: path.join(FBX_DIR, "amy-hiphop.fbx"), clipName: "HipHop" },
  ],

  outputPath: path.join(OUTPUT_DIR, "amy.glb"),
  textureSize: 1024,
  textureFormat: "webp",
  compressionLevel: "medium",
  keepIntermediate: false,
};

// ---------------------------------------------------------------------------
// FBX to GLB conversion
// ---------------------------------------------------------------------------

async function convertFbxToGlb(fbxPath: string): Promise<string> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mixamo-"));
  const baseName = path.basename(fbxPath, ".fbx");
  const outputPath = path.join(tmpDir, `${baseName}.glb`);

  console.log(`  Converting ${path.basename(fbxPath)} -> GLB...`);

  // fbx2gltf returns the output file path
  await fbx2gltf(fbxPath, outputPath, [
    "--binary",
    "--long-indices", "auto",
    "--keep-attribute", "position",
    "--keep-attribute", "normal",
    "--keep-attribute", "uv0",
    "--keep-attribute", "weights",
  ]);

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

  // Build a map of target nodes by name for matching bones
  const targetNodesByName = new Map<string, ReturnType<typeof targetRoot.listNodes>[0]>();
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

  for (const sourceAnim of sourceAnimations) {
    // Create a new animation in the target document
    const targetAnim = target.createAnimation(clipName);

    for (const sourceSampler of sourceAnim.listSamplers()) {
      // Copy sampler: create new accessors in the target document
      const inputAccessor = sourceSampler.getInput();
      const outputAccessor = sourceSampler.getOutput();

      if (!inputAccessor || !outputAccessor) continue;

      const targetInput = target.createAccessor()
        .setType(inputAccessor.getType())
        .setArray(inputAccessor.getArray()!.slice());

      const targetOutput = target.createAccessor()
        .setType(outputAccessor.getType())
        .setArray(outputAccessor.getArray()!.slice());

      const targetSampler = target.createAnimationSampler()
        .setInput(targetInput)
        .setOutput(targetOutput)
        .setInterpolation(sourceSampler.getInterpolation());

      targetAnim.addSampler(targetSampler);
    }

    // Now handle channels: remap source nodes to target nodes by name
    const sourceSamplers = sourceAnim.listSamplers();
    const targetSamplers = targetAnim.listSamplers();

    for (const sourceChannel of sourceAnim.listChannels()) {
      const sourceNode = sourceChannel.getTargetNode();
      if (!sourceNode) continue;

      const nodeName = sourceNode.getName();
      const targetNode = targetNodesByName.get(nodeName);

      if (!targetNode) {
        // Bone exists in animation but not in base mesh; skip it
        continue;
      }

      // Find the index of this channel's sampler in the source animation
      const sourceSampler = sourceChannel.getSampler();
      const samplerIndex = sourceSamplers.indexOf(sourceSampler!);

      if (samplerIndex === -1 || !targetSamplers[samplerIndex]) continue;

      const targetChannel = target.createAnimationChannel()
        .setTargetNode(targetNode)
        .setTargetPath(sourceChannel.getTargetPath())
        .setSampler(targetSamplers[samplerIndex]);

      targetAnim.addChannel(targetChannel);
    }

    console.log(
      `  Merged "${clipName}" (${sourceAnim.listChannels().length} channels, ` +
      `${sourceAnim.listSamplers().length} samplers)`
    );

    // Only take the first animation from each FBX (Mixamo exports one per file)
    break;
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

  // Register extensions
  document.createExtension(KHRMeshQuantization).setRequired(true);
  document.createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({
      method: EXTMeshoptCompression.EncoderMethod.FILTER,
    });

  const transforms: any[] = [
    // Remove redundant keyframes (biggest animation win)
    resample({ tolerance: 0.001 }),

    // Remove unused resources
    prune(),

    // Deduplicate identical accessors
    dedup(),

    // Quantize vertex data (positions, normals, UVs, skin weights)
    quantize({
      quantizePosition: 14,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
    }),
  ];

  // Texture compression (requires sharp - Node.js only)
  if (options.textureFormat === "webp") {
    transforms.push(
      textureCompress({
        encoder: sharp,
        targetFormat: "webp",
        resize: [textureSize, textureSize],
        quality: 80,
      })
    );
  } else {
    transforms.push(
      textureCompress({
        encoder: sharp,
        targetFormat: "png",
        resize: [textureSize, textureSize],
      })
    );
  }

  await document.transform(...transforms);

  console.log("  Resampled animation keyframes");
  console.log("  Pruned unused resources");
  console.log("  Deduplicated accessors");
  console.log("  Quantized vertex data");
  console.log(`  Compressed textures to ${options.textureFormat} @ ${textureSize}px`);
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

function reportInputSizes(baseFbx: string, animations: AnimationSource[]): number {
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
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Mixamo FBX to Optimized GLB Converter ===\n");

  // Validate input files exist
  if (!fs.existsSync(config.baseFbx)) {
    throw new Error(`Base FBX not found: ${config.baseFbx}`);
  }
  for (const anim of config.animations) {
    if (!fs.existsSync(anim.fbxPath)) {
      throw new Error(`Animation FBX not found: ${anim.fbxPath}`);
    }
  }

  // Report input sizes
  console.log("Input files:");
  const inputTotal = reportInputSizes(config.baseFbx, config.animations);

  // Ensure meshopt encoder is ready
  await MeshoptEncoder.ready;

  // Create IO with extension support
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

  // Remove any existing animations from the T-Pose base (if any)
  for (const anim of baseDoc.getRoot().listAnimations()) {
    anim.dispose();
  }
  console.log("  Loaded base mesh and skeleton");

  // Log skeleton bone names for reference
  const boneNames = baseDoc.getRoot().listNodes()
    .map((n) => n.getName())
    .filter((n) => n.startsWith("mixamorig"));
  console.log(`  Found ${boneNames.length} skeleton bones`);

  // Step 3: Merge animations
  console.log("\nStep 3: Merging animations...");
  for (const { path: animPath, clipName } of animGlbPaths) {
    const animDoc = await io.read(animPath);
    mergeAnimations(baseDoc, animDoc, clipName);
  }

  // Verify merged animations
  const mergedAnims = baseDoc.getRoot().listAnimations();
  console.log(`\n  Total animations in merged document: ${mergedAnims.length}`);
  for (const anim of mergedAnims) {
    console.log(`    - "${anim.getName()}" (${anim.listChannels().length} channels)`);
  }

  // Step 4 (optional): Write intermediate uncompressed GLB for debugging
  if (config.keepIntermediate) {
    const intermediatePath = config.outputPath.replace(".glb", "-uncompressed.glb");
    await io.write(intermediatePath, baseDoc);
    const intermediateSize = fs.statSync(intermediatePath).size;
    console.log(`\n  Intermediate (uncompressed): ${formatBytes(intermediateSize)}`);
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
      // Also remove the temp directory if empty
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
  console.log(`  Input:  ${formatBytes(inputTotal)} (${config.animations.length + 1} FBX files)`);
  console.log(`  Output: ${formatBytes(outputSize)} (1 GLB file)`);
  console.log(`  Reduction: ${((1 - outputSize / inputTotal) * 100).toFixed(1)}%`);
  console.log(`  Output: ${config.outputPath}`);
  console.log(`\n  Animations: ${mergedAnims.map((a) => a.getName()).join(", ")}`);
  console.log(`\n  To load in R3F:`);
  console.log(`    import { useGLTF } from '@react-three/drei';`);
  console.log(`    import { MeshoptDecoder } from 'meshoptimizer';`);
  console.log(`    useGLTF.setMeshoptDecoder(MeshoptDecoder);`);
  console.log(`    const { scene, animations } = useGLTF('/models/amy.glb');`);
}

main().catch((err) => {
  console.error("\nFailed:", err.message || err);
  process.exit(1);
});