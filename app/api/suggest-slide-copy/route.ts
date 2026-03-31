import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from "@upstash/redis";
import crypto from "crypto";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

const MONTHLY_LIMIT = parseInt(process.env.MONTHLY_CREDIT_LIMIT || "1000", 10);
const REQUEST_SECRET = process.env.GLYPH_REQUEST_SECRET || "";

export const maxDuration = 30;

// --- Shared helpers (same as enhance-screenshot) ---

function usageKey(deviceId: string): string {
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `enhance:${deviceId}:${month}`;
}

function verifySignature(signature: string, timestamp: string, deviceId: string): boolean {
  if (!REQUEST_SECRET) return true;
  const expected = crypto
    .createHmac("sha256", REQUEST_SECRET)
    .update(`${timestamp}.${deviceId}`)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex")
  );
}

function isTimestampValid(timestamp: string): boolean {
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;
  return Math.abs(Math.floor(Date.now() / 1000) - ts) < 300;
}

function json(data: object, status: number) {
  return NextResponse.json(data, { status });
}

// --- System prompt for structured slide copy suggestions ---

const SYSTEM_PROMPT = `You are a world-class App Store marketing copywriter. You analyze App Store screenshot slides and suggest improved marketing copy.

You will receive:
1. An image of an App Store screenshot slide (with headline text, subtitle, and a phone showing the app)
2. The current headline and subtitle text
3. A user instruction describing what they want changed

Your job: suggest new headline and subtitle text that follows the user's instruction. The text should be punchy, compelling App Store marketing copy.

Rules:
- Headlines: max 4-5 words, bold and impactful. Use power words.
- Subtitles: max 8-10 words, supporting detail that complements the headline.
- Match the tone/energy of the app shown in the phone screenshot.
- Do NOT describe what's in the phone. Write MARKETING copy that sells the feature.
- Return ONLY valid JSON, no markdown fences, no explanation.

Return format:
{"headline": "Your New Headline", "subtitle": "Your supporting subtitle text"}`;

// --- Main handler ---

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return json({ error: "GEMINI_API_KEY not configured" }, 500);
    }
    if (!process.env.UPSTASH_REDIS_REST_URL) {
      return json({ error: "Redis not configured" }, 500);
    }

    // Auth
    const deviceId = req.headers.get("x-device-id")?.trim();
    if (!deviceId || deviceId.length < 10) {
      return json({ error: "Missing X-Device-Id" }, 401);
    }

    if (REQUEST_SECRET) {
      const signature = req.headers.get("x-signature")?.trim();
      const timestamp = req.headers.get("x-timestamp")?.trim();
      if (!signature || !timestamp) return json({ error: "Missing signature" }, 401);
      if (!isTimestampValid(timestamp)) return json({ error: "Request expired" }, 401);
      try {
        if (!verifySignature(signature, timestamp, deviceId)) {
          return json({ error: "Invalid signature" }, 403);
        }
      } catch {
        return json({ error: "Invalid signature" }, 403);
      }
    }

    // Rate limit (shared counter with enhance-screenshot)
    const key = usageKey(deviceId);
    const used = (await redis.get<number>(key)) ?? 0;
    const remaining = Math.max(0, MONTHLY_LIMIT - used);
    if (remaining <= 0) {
      return json({ error: "Monthly limit reached", remainingCredits: 0 }, 429);
    }

    // Parse body
    const body = await req.json();
    const { image, headline, subtitle, instruction } = body as {
      image?: string;
      headline?: string;
      subtitle?: string;
      instruction?: string;
    };

    if (!image || !instruction) {
      return json({ error: "Missing image or instruction", remainingCredits: remaining }, 400);
    }

    // Strip data URI prefix
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    let mimeType = "image/jpeg";
    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    if (mimeMatch) mimeType = mimeMatch[1];

    // Gemini call — TEXT only response
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    const userPrompt = `Current headline: "${headline || ""}"
Current subtitle: "${subtitle || ""}"

User instruction: ${instruction}

Return JSON with suggested headline and subtitle.`;

    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Data } },
      { text: userPrompt },
    ]);

    const text = result.response.text();

    // Parse JSON from response (strip markdown fences if present)
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let suggestion: { headline?: string; subtitle?: string };
    try {
      suggestion = JSON.parse(cleaned);
    } catch {
      return json(
        { error: "Failed to parse AI response", raw: cleaned, remainingCredits: remaining },
        422
      );
    }

    // Increment usage
    const newUsed = await redis.incr(key);
    if (newUsed === 1) await redis.expire(key, 35 * 24 * 60 * 60);

    return json({
      headline: suggestion.headline || headline || "",
      subtitle: suggestion.subtitle || subtitle || "",
      remainingCredits: Math.max(0, MONTHLY_LIMIT - newUsed),
    }, 200);
  } catch (error) {
    console.error("suggest-slide-copy error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
}
