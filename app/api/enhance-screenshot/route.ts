import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from "@upstash/redis";
import crypto from "crypto";

// --- Config ---

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

const MONTHLY_LIMIT = parseInt(process.env.MONTHLY_CREDIT_LIMIT || "1000", 10);
const REQUEST_SECRET = process.env.GLYPH_REQUEST_SECRET || "";
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const maxDuration = 60;

// --- Helpers ---

function usageKey(deviceId: string): string {
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `enhance:${deviceId}:${month}`;
}

function statsKey(field: string): string {
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `stats:${month}:${field}`;
}

/** Verify HMAC-SHA256 signature: HMAC(secret, timestamp + "." + deviceId) */
function verifySignature(signature: string, timestamp: string, deviceId: string): boolean {
  if (!REQUEST_SECRET) return true; // Skip if secret not configured yet
  const expected = crypto
    .createHmac("sha256", REQUEST_SECRET)
    .update(`${timestamp}.${deviceId}`)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex")
  );
}

/** Reject requests with timestamps older than 5 minutes */
function isTimestampValid(timestamp: string): boolean {
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - ts) < 300; // 5 min window
}

function corsHeaders(): HeadersInit {
  // No browser access — only native app
  return {
    "Access-Control-Allow-Origin": "",
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "Content-Type, X-Device-Id, X-Signature, X-Timestamp",
  };
}

function jsonResponse(data: object, status: number): NextResponse {
  return NextResponse.json(data, { status, headers: corsHeaders() });
}

// Block CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 405, headers: corsHeaders() });
}

// --- Main handler ---

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let statusCode = 500;

  try {
    // Validate env
    if (!process.env.GEMINI_API_KEY) {
      statusCode = 500;
      return jsonResponse({ error: "GEMINI_API_KEY not configured" }, statusCode);
    }
    if (!process.env.UPSTASH_REDIS_REST_URL) {
      statusCode = 500;
      return jsonResponse({ error: "Redis not configured" }, statusCode);
    }

    // --- Auth: Device ID ---
    const deviceId = req.headers.get("x-device-id")?.trim();
    if (!deviceId || deviceId.length < 10) {
      statusCode = 401;
      return jsonResponse({ error: "Missing or invalid X-Device-Id header" }, statusCode);
    }

    // --- Auth: Request signing (when secret is configured) ---
    if (REQUEST_SECRET) {
      const signature = req.headers.get("x-signature")?.trim();
      const timestamp = req.headers.get("x-timestamp")?.trim();

      if (!signature || !timestamp) {
        statusCode = 401;
        return jsonResponse({ error: "Missing signature headers" }, statusCode);
      }

      if (!isTimestampValid(timestamp)) {
        statusCode = 401;
        return jsonResponse({ error: "Request expired" }, statusCode);
      }

      try {
        if (!verifySignature(signature, timestamp, deviceId)) {
          statusCode = 403;
          return jsonResponse({ error: "Invalid signature" }, statusCode);
        }
      } catch {
        statusCode = 403;
        return jsonResponse({ error: "Invalid signature" }, statusCode);
      }
    }

    // --- Rate limiting ---
    const key = usageKey(deviceId);
    const used = (await redis.get<number>(key)) ?? 0;
    const remaining = Math.max(0, MONTHLY_LIMIT - used);

    if (remaining <= 0) {
      statusCode = 429;
      return jsonResponse({ error: "Monthly enhancement limit reached", remainingCredits: 0 }, statusCode);
    }

    // --- Input validation ---
    const body = await req.json();
    const { image, instruction, templateType, blankTextRegion } = body as {
      image?: string;
      instruction?: string;
      templateType?: string;   // "deviceMockup", "iconShowcase", "textHero", "fullBleed"
      blankTextRegion?: boolean; // When true, post-process to remove text from top region
    };

    if (!image || !instruction) {
      statusCode = 400;
      return jsonResponse(
        { error: "Missing required fields: image (base64), instruction (string)", remainingCredits: remaining },
        statusCode
      );
    }

    if (typeof instruction !== "string" || instruction.length > 2000) {
      statusCode = 400;
      return jsonResponse({ error: "Instruction must be a string under 2000 chars", remainingCredits: remaining }, statusCode);
    }

    if (image.length > 7_000_000) {
      statusCode = 413;
      return jsonResponse({ error: "Image too large. Max 5MB.", remainingCredits: remaining }, statusCode);
    }

    // Validate MIME type
    let mimeType = "image/jpeg";
    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    if (mimeMatch) {
      mimeType = mimeMatch[1];
    }
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      statusCode = 400;
      return jsonResponse({ error: `Unsupported image type: ${mimeType}. Use JPEG, PNG, or WebP.`, remainingCredits: remaining }, statusCode);
    }

    // Validate it's actually valid base64
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    try {
      const decoded = Buffer.from(base64Data, "base64");
      if (decoded.length === 0) throw new Error("empty");
    } catch {
      statusCode = 400;
      return jsonResponse({ error: "Invalid base64 image data", remainingCredits: remaining }, statusCode);
    }

    // --- Gemini call ---
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-image",
      generationConfig: {
        // @ts-expect-error - responseModalities is valid for image output
        responseModalities: ["image", "text"],
      },
    });

    // Pass instruction to Gemini with a safety prefix to prevent text generation.
    // The renderer handles layering (AI background → phone → text) so Gemini just needs
    // to produce a visually enhanced version of the input image.
    const safeInstruction = `ABSOLUTE RULE — ZERO TEXT: The output image must contain ZERO text, ZERO words, ZERO letters, ZERO numbers, ZERO labels, ZERO typography of any kind. If the input image has text, REMOVE it or paint over it with background color. The output must be a purely visual/graphical image with no readable characters anywhere. This rule overrides everything else.

${instruction}

REMINDER: The image you return must have ABSOLUTELY NO TEXT anywhere — no titles, no labels, no watermarks, no words, no letters, no numbers. Only visual elements: colors, gradients, shapes, glows, textures. Any text in the output is a critical failure.`;
    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Data } },
      { text: safeInstruction },
    ]);

    const parts = result.response.candidates?.[0]?.content?.parts;

    if (!parts) {
      statusCode = 502;
      return jsonResponse({ error: "No response from Gemini", remainingCredits: remaining }, statusCode);
    }

    const imagePart = parts.find(
      (p) => "inlineData" in p && p.inlineData?.mimeType?.startsWith("image/")
    );

    if (!imagePart || !("inlineData" in imagePart) || !imagePart.inlineData) {
      const textPart = parts.find((p) => "text" in p);
      statusCode = 422;
      return jsonResponse(
        {
          error: "Gemini did not return an image",
          textResponse: textPart && "text" in textPart ? textPart.text : null,
          remainingCredits: remaining,
        },
        statusCode
      );
    }

    // --- Success: increment usage ---
    const newUsed = await redis.incr(key);
    if (newUsed === 1) {
      await redis.expire(key, 35 * 24 * 60 * 60);
    }

    statusCode = 200;
    return jsonResponse({
      image: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
      remainingCredits: Math.max(0, MONTHLY_LIMIT - newUsed),
    }, statusCode);
  } catch (error) {
    console.error("enhance-screenshot error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    statusCode = 500;
    return jsonResponse({ error: message }, statusCode);
  } finally {
    // --- Logging: fire-and-forget stats to Redis ---
    const duration = Date.now() - startTime;
    try {
      const reqKey = statsKey("requests");
      const durKey = statsKey("totalDurationMs");
      const errKey = statsKey("errors");

      const pipeline = redis.pipeline();
      pipeline.incr(reqKey);
      pipeline.incrby(durKey, duration);
      if (statusCode >= 400) pipeline.incr(errKey);
      // Auto-expire stats after 90 days
      pipeline.expire(reqKey, 90 * 24 * 60 * 60);
      pipeline.expire(durKey, 90 * 24 * 60 * 60);
      pipeline.expire(errKey, 90 * 24 * 60 * 60);
      await pipeline.exec();
    } catch {
      // Stats are best-effort, don't fail the request
    }
  }
}
