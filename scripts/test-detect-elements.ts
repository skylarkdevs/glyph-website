#!/usr/bin/env npx tsx
/**
 * Test suite for /api/detect-elements endpoint.
 *
 * Usage:
 *   npx tsx scripts/test-detect-elements.ts [base-url]
 *
 * Default base URL: https://getglyph.dev
 * Provide a screenshot path as env var to test your own:
 *   TEST_IMAGE=/path/to/screenshot.png npx tsx scripts/test-detect-elements.ts
 *
 * The script generates synthetic test images (colored rectangles simulating
 * common iOS layouts) if no TEST_IMAGE is provided. For real-world testing,
 * point TEST_IMAGE at actual iOS screenshots.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const BASE_URL = process.argv[2] || "https://getglyph.dev";
const ENDPOINT = `${BASE_URL}/api/detect-elements`;
const DEVICE_ID = "test-device-" + crypto.randomUUID().slice(0, 8);
const REQUEST_SECRET = process.env.GLYPH_REQUEST_SECRET || "";

// HMAC signing (same as iOS client)
function signRequest(deviceId: string, timestamp: string): string {
  if (!REQUEST_SECRET) return "";
  return crypto
    .createHmac("sha256", REQUEST_SECRET)
    .update(`${timestamp}.${deviceId}`)
    .digest("hex");
}

interface DetectionResult {
  elements?: Array<{
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    content: string | null;
    confidence: number;
  }>;
  elementCount?: number;
  error?: string;
  rawResponse?: string;
}

async function callDetect(imageBase64: string): Promise<DetectionResult> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signRequest(DEVICE_ID, timestamp);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Device-Id": DEVICE_ID,
    "X-Timestamp": timestamp,
  };
  if (signature) headers["X-Signature"] = signature;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ image: imageBase64 }),
  });

  return res.json() as Promise<DetectionResult>;
}

// --- Test helpers ---

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  FAIL: ${msg}`);
    return false;
  }
  console.log(`  PASS: ${msg}`);
  return true;
}

function validateElement(el: DetectionResult["elements"]![0]): boolean {
  let ok = true;
  if (el.x < 0 || el.x > 1) { console.error(`    bad x: ${el.x}`); ok = false; }
  if (el.y < 0 || el.y > 1) { console.error(`    bad y: ${el.y}`); ok = false; }
  if (el.width <= 0 || el.width > 1) { console.error(`    bad width: ${el.width}`); ok = false; }
  if (el.height <= 0 || el.height > 1) { console.error(`    bad height: ${el.height}`); ok = false; }
  if (el.confidence < 0.3 || el.confidence > 1) { console.error(`    bad confidence: ${el.confidence}`); ok = false; }
  return ok;
}

// --- Tests ---

async function testWithImage(name: string, imagePath: string) {
  console.log(`\n=== Test: ${name} ===`);
  const imageData = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : "image/jpeg";
  const base64 = `data:${mime};base64,${imageData.toString("base64")}`;

  console.log(`  Image size: ${(imageData.length / 1024).toFixed(0)}KB`);

  const start = Date.now();
  const result = await callDetect(base64);
  const duration = Date.now() - start;

  console.log(`  Response time: ${duration}ms`);

  if (result.error) {
    console.error(`  ERROR: ${result.error}`);
    if (result.rawResponse) console.error(`  Raw: ${result.rawResponse.slice(0, 200)}`);
    return;
  }

  const elements = result.elements || [];
  console.log(`  Elements detected: ${elements.length}`);

  // Validate all coordinates are normalized
  let allValid = true;
  for (const el of elements) {
    if (!validateElement(el)) allValid = false;
  }
  assert(allValid, "All element coordinates are valid 0-1 range");

  // Check type distribution
  const types = new Map<string, number>();
  for (const el of elements) {
    types.set(el.type, (types.get(el.type) || 0) + 1);
  }
  console.log(`  Type distribution: ${[...types.entries()].map(([k, v]) => `${k}(${v})`).join(", ")}`);

  // Basic sanity checks
  assert(elements.length > 0, "At least 1 element detected");
  assert(elements.length < 200, "Not too many elements (< 200)");

  // Check for statusBar (should almost always be present in iOS screenshots)
  const hasStatusBar = elements.some((e) => e.type === "statusBar");
  console.log(`  Status bar detected: ${hasStatusBar}`);

  // Check no overlapping duplicates of same type
  let dupes = 0;
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const a = elements[i], b = elements[j];
      if (a.type !== b.type) continue;
      // Simple overlap check
      const ox = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
      const oy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      const inter = ox * oy;
      const aArea = a.width * a.height;
      const bArea = b.width * b.height;
      const iouVal = inter / (aArea + bArea - inter);
      if (iouVal > 0.7) dupes++;
    }
  }
  assert(dupes === 0, `No duplicate detections (found ${dupes} overlapping same-type pairs)`);

  // Print first 10 elements as summary
  console.log(`  First 10 elements:`);
  for (const el of elements.slice(0, 10)) {
    const rect = `(${el.x.toFixed(2)}, ${el.y.toFixed(2)}, ${el.width.toFixed(2)}x${el.height.toFixed(2)})`;
    console.log(`    ${el.type.padEnd(12)} ${rect} ${el.content ? `"${el.content.slice(0, 40)}"` : "(no content)"} [${el.confidence.toFixed(2)}]`);
  }
}

async function testValidation() {
  console.log("\n=== Test: Input validation ===");

  // No image
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signRequest(DEVICE_ID, timestamp);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Device-Id": DEVICE_ID,
    "X-Timestamp": timestamp,
  };
  if (signature) headers["X-Signature"] = signature;

  const res1 = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  assert(res1.status === 400, "Missing image returns 400");

  // No device ID
  const res2 = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: "data:image/jpeg;base64,/9j/..." }),
  });
  assert(res2.status === 401, "Missing device ID returns 401");

  console.log("  Validation tests done");
}

// --- Main ---

async function main() {
  console.log(`Testing ${ENDPOINT}`);
  console.log(`Device ID: ${DEVICE_ID}`);
  console.log(`Signing: ${REQUEST_SECRET ? "enabled" : "disabled (no GLYPH_REQUEST_SECRET)"}`);

  // Run validation tests
  await testValidation();

  // Check for user-provided test image
  const testImage = process.env.TEST_IMAGE;
  if (testImage) {
    if (!fs.existsSync(testImage)) {
      console.error(`TEST_IMAGE not found: ${testImage}`);
      process.exit(1);
    }
    await testWithImage("User-provided screenshot", testImage);
  } else {
    // Look for screenshots in common locations
    const searchPaths = [
      path.join(process.env.HOME || "", "Downloads"),
      path.join(process.env.HOME || "", "Desktop"),
    ];

    let found = false;
    for (const dir of searchPaths) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir)
        .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
        .filter((f) => /screenshot|simulator|IMG_/i.test(f))
        .slice(0, 3);

      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.size > 5_000_000) continue; // Skip oversized
        await testWithImage(file, fullPath);
        found = true;
      }
    }

    if (!found) {
      console.log("\nNo test screenshots found. Set TEST_IMAGE=/path/to/screenshot.png to test with a real screenshot.");
      console.log("Looked in ~/Downloads and ~/Desktop for files matching 'screenshot', 'simulator', or 'IMG_'.");
    }
  }

  console.log("\n=== Done ===");
}

main().catch(console.error);
