/**
 * Test script for comparing inpainting strategies A, B, C.
 *
 * Usage:
 *   npx tsx scripts/test-inpaint-strategies.ts [baseUrl]
 *
 * Default baseUrl: https://getglyph.dev
 *
 * Generates a synthetic 400x800 test "screenshot" with a colored header,
 * body text area, and a button. Creates a mask highlighting the text area.
 * Runs all 3 strategies and saves results to /tmp/inpaint-test/.
 *
 * For real testing, replace the synthetic image with an actual screenshot:
 *   Set TEST_IMAGE_PATH env var to a local PNG/JPEG file path.
 *   Set TEST_MASK_PATH env var to a matching mask PNG.
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";

const BASE_URL = process.argv[2] || "https://getglyph.dev";
const OUT_DIR = "/tmp/inpaint-test";
const DEVICE_ID = "test-device-00000000-0000-0000-0000-000000000001";

// Test cases: each defines an instruction and a mask region (normalized)
const TEST_CASES = [
  {
    name: "text-replace",
    instruction: "Replace the text in this region with 'Build your dreams'",
    maskRegion: { x: 0.05, y: 0.3, w: 0.9, h: 0.08 }, // body text area
  },
  {
    name: "button-change",
    instruction: "Change this button to say 'Get Started' with a blue gradient background",
    maskRegion: { x: 0.2, y: 0.7, w: 0.6, h: 0.06 }, // button area
  },
  {
    name: "header-edit",
    instruction: "Change the navigation title to 'Dashboard'",
    maskRegion: { x: 0.0, y: 0.05, w: 1.0, h: 0.06 }, // nav bar
  },
];

async function generateSyntheticScreenshot(): Promise<Buffer> {
  // Check for real image first
  if (process.env.TEST_IMAGE_PATH) {
    console.log(`Using real image: ${process.env.TEST_IMAGE_PATH}`);
    return fs.promises.readFile(process.env.TEST_IMAGE_PATH);
  }

  // Generate a simple synthetic "screenshot"
  const w = 400;
  const h = 800;

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <!-- Status bar -->
    <rect width="${w}" height="40" fill="#1a1a2e"/>
    <text x="20" y="26" fill="#ffffff" font-size="13" font-family="sans-serif">9:41</text>
    <text x="350" y="26" fill="#ffffff" font-size="13" font-family="sans-serif">100%</text>

    <!-- Nav bar -->
    <rect y="40" width="${w}" height="48" fill="#16213e"/>
    <text x="160" y="70" fill="#ffffff" font-size="17" font-weight="bold" font-family="sans-serif">My App</text>

    <!-- Body area -->
    <rect y="88" width="${w}" height="${h - 88 - 80}" fill="#0f3460" rx="0"/>
    <text x="20" y="260" fill="#e0e0e0" font-size="15" font-family="sans-serif">Track your habits daily</text>
    <text x="20" y="285" fill="#a0a0a0" font-size="13" font-family="sans-serif">Stay consistent and reach your goals</text>

    <!-- Card -->
    <rect x="20" y="320" width="360" height="120" rx="12" fill="#1a1a3e"/>
    <text x="40" y="360" fill="#ffffff" font-size="14" font-family="sans-serif">Weekly Progress</text>
    <rect x="40" y="380" width="200" height="8" rx="4" fill="#333366"/>
    <rect x="40" y="380" width="140" height="8" rx="4" fill="#e94560"/>
    <text x="40" y="420" fill="#a0a0a0" font-size="12" font-family="sans-serif">70% complete</text>

    <!-- Button -->
    <rect x="80" y="560" width="240" height="48" rx="24" fill="#e94560"/>
    <text x="155" y="590" fill="#ffffff" font-size="16" font-weight="bold" font-family="sans-serif">Continue</text>

    <!-- Tab bar -->
    <rect y="${h - 80}" width="${w}" height="80" fill="#1a1a2e"/>
    <text x="60" y="${h - 40}" fill="#e94560" font-size="11" font-family="sans-serif">Home</text>
    <text x="170" y="${h - 40}" fill="#666666" font-size="11" font-family="sans-serif">Stats</text>
    <text x="280" y="${h - 40}" fill="#666666" font-size="11" font-family="sans-serif">Profile</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function generateMask(
  w: number,
  h: number,
  region: { x: number; y: number; w: number; h: number }
): Promise<Buffer> {
  if (process.env.TEST_MASK_PATH) {
    console.log(`Using real mask: ${process.env.TEST_MASK_PATH}`);
    return fs.promises.readFile(process.env.TEST_MASK_PATH);
  }

  const px = Math.round(region.x * w);
  const py = Math.round(region.y * h);
  const pw = Math.round(region.w * w);
  const ph = Math.round(region.h * h);

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="black"/>
    <rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="white"/>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function callInpaint(
  imageBase64: string,
  maskBase64: string,
  instruction: string,
  strategy: string
): Promise<{ image?: string; error?: string; textResponse?: string; strategy?: string }> {
  const url = `${BASE_URL}/api/inpaint-screenshot`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Device-Id": DEVICE_ID,
    },
    body: JSON.stringify({
      image: `data:image/png;base64,${imageBase64}`,
      mask: `data:image/png;base64,${maskBase64}`,
      instruction,
      strategy,
    }),
    signal: AbortSignal.timeout(55000),
  });

  return res.json();
}

async function main() {
  console.log(`\n=== Inpainting Strategy Test ===`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Output dir: ${OUT_DIR}\n`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Generate test image
  const screenshot = await generateSyntheticScreenshot();
  const meta = await sharp(screenshot).metadata();
  const imgW = meta.width!;
  const imgH = meta.height!;
  console.log(`Test image: ${imgW}x${imgH}`);

  const imageBase64 = screenshot.toString("base64");
  fs.writeFileSync(path.join(OUT_DIR, "original.png"), screenshot);

  for (const tc of TEST_CASES) {
    console.log(`\n--- Test: ${tc.name} ---`);
    console.log(`  Instruction: ${tc.instruction}`);

    const mask = await generateMask(imgW, imgH, tc.maskRegion);
    const maskBase64 = mask.toString("base64");
    fs.writeFileSync(path.join(OUT_DIR, `${tc.name}-mask.png`), mask);

    for (const strategy of ["A", "B", "C"]) {
      const label = `${tc.name}-strategy-${strategy}`;
      console.log(`  Strategy ${strategy}...`);
      const start = Date.now();

      try {
        const result = await callInpaint(imageBase64, maskBase64, tc.instruction, strategy);
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);

        if (result.error) {
          console.log(`    FAIL (${elapsed}s): ${result.error}`);
          if (result.textResponse) console.log(`    Gemini said: ${result.textResponse.slice(0, 200)}`);
          continue;
        }

        if (result.image) {
          const outBuf = Buffer.from(result.image, "base64");
          const outPath = path.join(OUT_DIR, `${label}.png`);
          fs.writeFileSync(outPath, outBuf);

          const outMeta = await sharp(outBuf).metadata();
          const dimMatch = outMeta.width === imgW && outMeta.height === imgH;

          console.log(`    OK (${elapsed}s) — ${outMeta.width}x${outMeta.height} ${dimMatch ? "✓ dims match" : "✗ DIMS MISMATCH"}`);
          console.log(`    Saved: ${outPath}`);
        }
      } catch (err) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`    ERROR (${elapsed}s): ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  console.log(`\n=== Done. Compare results in ${OUT_DIR} ===`);
  console.log(`  Evaluate:`);
  console.log(`    1. Fidelity: Are unmasked regions pixel-identical to original?`);
  console.log(`    2. Quality: Does the edit look good inside the mask?`);
  console.log(`    3. Consistency: Same strategy, same test → similar output?`);
  console.log(`    4. Dimensions: Does output match input size?`);
}

main().catch(console.error);
