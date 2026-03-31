import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from "@upstash/redis";
import crypto from "crypto";
import sharp from "sharp";

// --- Config ---

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

const MONTHLY_LIMIT = parseInt(process.env.MONTHLY_CREDIT_LIMIT || "1000", 10);
const REQUEST_SECRET = process.env.GLYPH_REQUEST_SECRET || "";
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VALID_STRATEGIES = ["A", "B", "C"] as const;
type Strategy = (typeof VALID_STRATEGIES)[number];

export const maxDuration = 60;

// --- Auth helpers ---

function usageKey(deviceId: string): string {
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `enhance:${deviceId}:${month}`;
}

function statsKey(field: string): string {
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `stats:inpaint:${month}:${field}`;
}

function verifySignature(sig: string, ts: string, deviceId: string): boolean {
  if (!REQUEST_SECRET) return true;
  const expected = crypto.createHmac("sha256", REQUEST_SECRET).update(`${ts}.${deviceId}`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
}

function isTimestampValid(ts: string): boolean {
  const t = parseInt(ts, 10);
  if (isNaN(t)) return false;
  return Math.abs(Math.floor(Date.now() / 1000) - t) < 300;
}

function json(data: object, status: number): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "Access-Control-Allow-Origin": "", "Access-Control-Allow-Methods": "POST" },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 405 });
}

// =============================================================================
// Strategy-specific prompts
// =============================================================================

// Strategy A: Red overlay on image — Gemini sees ONE image with red-highlighted regions
const PROMPT_A = `You are a precise mobile app screenshot editor.

You will receive ONE image: a mobile app screenshot where certain regions are highlighted with a semi-transparent RED overlay. You will also receive an editing instruction.

YOUR TASK:
1. Identify the RED-highlighted regions — these are the ONLY areas you may modify.
2. Apply the instruction to those red regions, removing the red overlay and replacing the content underneath.
3. Everything NOT highlighted in red must remain EXACTLY as-is — pixel-identical, no color shifts, no artifacts.
4. Return the COMPLETE modified screenshot at the EXACT same resolution.

QUALITY RULES:
- Match the surrounding UI's font family, size, weight, color, and alignment when editing text.
- Match the visual style and quality when replacing images or icons.
- The edited regions should blend seamlessly with their surroundings — no visible seams or style mismatches.
- Maintain the exact same image dimensions.`;

// Strategy B: Separate mask image — Gemini sees original + B&W mask as two images
const PROMPT_B = `You are a precise mobile app screenshot editor.

You will receive TWO images and an editing instruction.

IMAGE 1: The original mobile app screenshot.
IMAGE 2: A black-and-white mask of the same dimensions.
  - WHITE pixels = the working area where you CAN make changes.
  - BLACK pixels = regions you MUST keep EXACTLY as they appear in the original.

IMPORTANT — THE WHITE AREA IS INTENTIONALLY LARGER THAN THE ELEMENT:
The white mask region extends well beyond the original UI element. This gives you room to:
- Make elements BIGGER if the instruction says so (expand into the surrounding white space)
- Add new content around the element
- Reposition or reshape the element within the white zone

The white zone is your canvas. Use ALL of it if the instruction calls for it (e.g., "make this bigger", "triple the size", "add icons around it"). Don't confine your changes to just the original element bounds.

YOUR TASK:
1. Identify the original UI element(s) within the white mask region.
2. Read the user instruction carefully. Do EXACTLY what it says — nothing more, nothing less.
3. Apply the instruction — use the full white area as needed.
4. Return the COMPLETE modified screenshot at the EXACT same resolution as the input.
5. Black (unmasked) regions must be pixel-identical to the original.

CRITICAL:
- Follow the user's instruction LITERALLY. If they say "make it 3x bigger", make it 3x bigger. If they say "change the text to X", change it to exactly X.
- Do NOT interpret, improve, or add creative changes beyond what was asked.
- Do NOT change the overall image resolution or aspect ratio.

QUALITY RULES:
- Match the surrounding UI's font family, size, weight, color, and alignment.
- Match the visual style when replacing images or icons.
- Edited regions should blend seamlessly with their surroundings.
- When making elements bigger: scale proportionally, maintain visual style, fill the expanded area naturally.
- Maintain the EXACT same image dimensions as the input.`;

// Strategy C: Cropped region — Gemini sees ONLY the region to edit (smaller image)
const PROMPT_C = `You are a precise mobile app UI element editor.

You will receive ONE image: a cropped section of a mobile app screenshot showing a specific UI element or region. You will also receive an editing instruction.

YOUR TASK:
1. Modify the content of this cropped region according to the instruction.
2. Keep the EXACT same dimensions, background color, padding, and overall layout.
3. Return the modified crop at the EXACT same resolution.

QUALITY RULES:
- Match the visual style: same font family, size, weight, color, and alignment.
- If there's a background gradient or color, preserve it exactly.
- If replacing text, maintain the same visual weight and positioning.
- If replacing an image, maintain aspect ratio and quality.
- The output must be a drop-in replacement — same width, same height, same style.`;

// =============================================================================
// Image preprocessing for each strategy
// =============================================================================

/** Strategy A: Composite a red overlay onto the original image where mask is white. */
async function prepareStrategyA(
  imgBuf: Buffer,
  maskBuf: Buffer
): Promise<{ buffer: Buffer; mimeType: string }> {
  const imgMeta = await sharp(imgBuf).metadata();
  const w = imgMeta.width!;
  const h = imgMeta.height!;

  // Resize mask to match image dimensions if needed
  const resizedMask = await sharp(maskBuf).resize(w, h, { fit: "fill" }).greyscale().raw().toBuffer();

  // Create red overlay: semi-transparent red (255, 60, 60, 100) where mask is white
  const overlay = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const maskVal = resizedMask[i]; // 0-255 greyscale
    if (maskVal > 128) {
      // White region → red overlay
      overlay[i * 4] = 255;     // R
      overlay[i * 4 + 1] = 60;  // G
      overlay[i * 4 + 2] = 60;  // B
      overlay[i * 4 + 3] = 100; // A (semi-transparent)
    } else {
      // Black region → fully transparent
      overlay[i * 4] = 0;
      overlay[i * 4 + 1] = 0;
      overlay[i * 4 + 2] = 0;
      overlay[i * 4 + 3] = 0;
    }
  }

  const overlayPng = await sharp(overlay, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();

  const composite = await sharp(imgBuf)
    .composite([{ input: overlayPng, blend: "over" }])
    .png()
    .toBuffer();

  return { buffer: composite, mimeType: "image/png" };
}

/** Strategy C: Crop the bounding box of white mask pixels from the original image. */
async function prepareStrategyC(
  imgBuf: Buffer,
  maskBuf: Buffer
): Promise<{ croppedImage: Buffer; mimeType: string; cropBox: { left: number; top: number; width: number; height: number } }> {
  const imgMeta = await sharp(imgBuf).metadata();
  const w = imgMeta.width!;
  const h = imgMeta.height!;

  const resizedMask = await sharp(maskBuf).resize(w, h, { fit: "fill" }).greyscale().raw().toBuffer();

  // Find bounding box of white pixels
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (resizedMask[y * w + x] > 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Add 8px padding around the crop for context
  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  if (cropW < 10 || cropH < 10) {
    throw new Error("Mask region too small to crop");
  }

  const croppedImage = await sharp(imgBuf)
    .extract({ left: minX, top: minY, width: cropW, height: cropH })
    .png()
    .toBuffer();

  return {
    croppedImage,
    mimeType: "image/png",
    cropBox: { left: minX, top: minY, width: cropW, height: cropH },
  };
}

/** Strategy C post-processing: composite the edited crop back onto the original. */
async function compositeStrategyC(
  originalBuf: Buffer,
  editedCropBuf: Buffer,
  cropBox: { left: number; top: number; width: number; height: number }
): Promise<Buffer> {
  // Resize edited crop to match original crop dimensions (in case Gemini changed size)
  const resizedCrop = await sharp(editedCropBuf)
    .resize(cropBox.width, cropBox.height, { fit: "fill" })
    .png()
    .toBuffer();

  return sharp(originalBuf)
    .composite([{ input: resizedCrop, left: cropBox.left, top: cropBox.top }])
    .png()
    .toBuffer();
}

// =============================================================================
// Input validation
// =============================================================================

function validateBase64Image(
  field: string,
  value: string | undefined,
  maxLen: number
): { error?: string; base64: string; mimeType: string } {
  if (!value) return { error: `Missing required field: ${field}`, base64: "", mimeType: "" };
  if (value.length > maxLen) return { error: `${field} too large`, base64: "", mimeType: "" };

  let mimeType = "image/png";
  const m = value.match(/^data:(image\/\w+);base64,/);
  if (m) mimeType = m[1];
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) return { error: `Unsupported ${field} type: ${mimeType}`, base64: "", mimeType: "" };

  const base64 = value.replace(/^data:image\/\w+;base64,/, "");
  try {
    if (Buffer.from(base64, "base64").length === 0) throw new Error();
  } catch {
    return { error: `Invalid base64 in ${field}`, base64: "", mimeType: "" };
  }

  return { base64, mimeType };
}

// =============================================================================
// Main handler
// =============================================================================

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let statusCode = 500;

  try {
    if (!process.env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not configured" }, (statusCode = 500));
    if (!process.env.UPSTASH_REDIS_REST_URL) return json({ error: "Redis not configured" }, (statusCode = 500));

    // --- Auth ---
    const deviceId = req.headers.get("x-device-id")?.trim();
    if (!deviceId || deviceId.length < 10) return json({ error: "Missing X-Device-Id" }, (statusCode = 401));

    if (REQUEST_SECRET) {
      const sig = req.headers.get("x-signature")?.trim();
      const ts = req.headers.get("x-timestamp")?.trim();
      if (!sig || !ts) return json({ error: "Missing signature" }, (statusCode = 401));
      if (!isTimestampValid(ts)) return json({ error: "Request expired" }, (statusCode = 401));
      try { if (!verifySignature(sig, ts, deviceId)) return json({ error: "Invalid signature" }, (statusCode = 403)); }
      catch { return json({ error: "Invalid signature" }, (statusCode = 403)); }
    }

    // --- Rate limit ---
    const key = usageKey(deviceId);
    const used = (await redis.get<number>(key)) ?? 0;
    const remaining = Math.max(0, MONTHLY_LIMIT - used);
    if (remaining <= 0) return json({ error: "Monthly limit reached", remainingCredits: 0 }, (statusCode = 429));

    // --- Parse body ---
    const body = await req.json();
    const { image, mask, instruction, strategy: rawStrategy } = body as {
      image?: string;
      mask?: string;
      instruction?: string;
      strategy?: string;
    };

    // Default to strategy B (separate mask), allow override for testing
    const strategy: Strategy = (VALID_STRATEGIES as readonly string[]).includes(rawStrategy ?? "")
      ? (rawStrategy as Strategy)
      : "B";

    if (!instruction || typeof instruction !== "string") return json({ error: "Missing instruction" }, (statusCode = 400));
    if (instruction.length > 2000) return json({ error: "Instruction too long (max 2000)" }, (statusCode = 400));

    const imgResult = validateBase64Image("image", image, 7_000_000);
    if (imgResult.error) return json({ error: imgResult.error, remainingCredits: remaining }, (statusCode = 400));

    const maskResult = validateBase64Image("mask", mask, 7_000_000);
    if (maskResult.error) return json({ error: maskResult.error, remainingCredits: remaining }, (statusCode = 400));

    const imgBuf = Buffer.from(imgResult.base64, "base64");
    const maskBuf = Buffer.from(maskResult.base64, "base64");

    // --- Build Gemini content array based on strategy ---
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-image",
      generationConfig: {
        // @ts-expect-error - responseModalities valid for image output
        responseModalities: ["image", "text"],
      },
    });

    let contentParts: Parameters<typeof model.generateContent>[0];
    let cropBox: { left: number; top: number; width: number; height: number } | null = null;

    switch (strategy) {
      case "A": {
        // Red overlay composited onto the original image
        const { buffer, mimeType } = await prepareStrategyA(imgBuf, maskBuf);
        contentParts = [
          { text: PROMPT_A },
          { inlineData: { mimeType, data: buffer.toString("base64") } },
          { text: `EDITING INSTRUCTION — follow EXACTLY: ${instruction}\n\nExecute this literally. If it says "make bigger", scale significantly. If it says "replace", replace entirely. If it says "change to X", change to exactly X. Do NOT just make minor adjustments.` },
        ];
        break;
      }

      case "B": {
        // Original + mask as two separate images
        contentParts = [
          { text: PROMPT_B },
          { inlineData: { mimeType: imgResult.mimeType, data: imgResult.base64 } },
          { inlineData: { mimeType: maskResult.mimeType, data: maskResult.base64 } },
          { text: `EDITING INSTRUCTION — follow EXACTLY: ${instruction}\n\nExecute this literally. If it says "make bigger", scale the element to fill the white mask area. If it says "replace", replace entirely. If it says "change to X", change to exactly X. Do NOT just make minor adjustments. The white mask area is your full canvas — use ALL of it when the instruction calls for size changes.` },
        ];
        break;
      }

      case "C": {
        // Cropped region only
        const prepared = await prepareStrategyC(imgBuf, maskBuf);
        cropBox = prepared.cropBox;
        contentParts = [
          { text: PROMPT_C },
          { inlineData: { mimeType: prepared.mimeType, data: prepared.croppedImage.toString("base64") } },
          { text: `INSTRUCTION: ${instruction}\n\nIMPORTANT: Return the modified crop at the EXACT same dimensions (${cropBox.width}x${cropBox.height} pixels).` },
        ];
        break;
      }
    }

    // --- Gemini call ---
    const result = await model.generateContent(contentParts);
    const parts = result.response.candidates?.[0]?.content?.parts;

    if (!parts) return json({ error: "No response from Gemini", remainingCredits: remaining }, (statusCode = 502));

    const imagePart = parts.find((p) => "inlineData" in p && p.inlineData?.mimeType?.startsWith("image/"));

    if (!imagePart || !("inlineData" in imagePart) || !imagePart.inlineData) {
      const textPart = parts.find((p) => "text" in p);
      return json({
        error: "Gemini did not return an image",
        textResponse: textPart && "text" in textPart ? textPart.text : null,
        remainingCredits: remaining,
      }, (statusCode = 422));
    }

    // --- Strategy C post-processing: composite crop back onto original ---
    let finalImageBase64 = imagePart.inlineData.data!;
    let finalMimeType = imagePart.inlineData.mimeType!;

    if (strategy === "C" && cropBox) {
      const editedCropBuf = Buffer.from(finalImageBase64, "base64");
      const composited = await compositeStrategyC(imgBuf, editedCropBuf, cropBox);
      finalImageBase64 = composited.toString("base64");
      finalMimeType = "image/png";
    }

    // --- Success ---
    const newUsed = await redis.incr(key);
    if (newUsed === 1) await redis.expire(key, 35 * 24 * 60 * 60);

    statusCode = 200;
    return json({
      image: finalImageBase64,
      mimeType: finalMimeType,
      remainingCredits: Math.max(0, MONTHLY_LIMIT - newUsed),
      strategy,
    }, statusCode);
  } catch (error) {
    console.error("inpaint-screenshot error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, (statusCode = 500));
  } finally {
    const duration = Date.now() - startTime;
    try {
      const p = redis.pipeline();
      p.incr(statsKey("requests"));
      p.incrby(statsKey("totalDurationMs"), duration);
      if (statusCode >= 400) p.incr(statsKey("errors"));
      p.expire(statsKey("requests"), 90 * 86400);
      p.expire(statsKey("totalDurationMs"), 90 * 86400);
      p.expire(statsKey("errors"), 90 * 86400);
      await p.exec();
    } catch { /* best-effort */ }
  }
}
