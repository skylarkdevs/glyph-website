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

function usageKey(deviceId: string): string {
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `enhance:${deviceId}:${month}`;
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

function json(data: object, status: number) {
  return NextResponse.json(data, { status });
}

// --- System prompt ---

const SYSTEM_PROMPT = `You are an App Store screenshot analyst. Identify the 1-2 most impactful VISUAL improvements for this app screenshot.

CONTEXT: This screenshot appears inside a phone mockup on an App Store marketing slide. Users see it small — only bold visual changes matter.

YOU CAN ONLY SUGGEST THESE TWO TYPES:

1. "heroResize" (priority: 5) — Identify the MOST IMPORTANT visual element on screen that should be made bigger and more prominent.
   - The main feature card, hero image, key metric, or primary content block
   - The element that best sells the app's value at thumbnail size
   - Only suggest ONE heroResize per screenshot — the single most impactful element
   - The instruction should name what the element is
   → Example: {"type":"heroResize","instruction":"The nutrition goals card with calories and macros is the key feature","displayLabel":"Highlight nutrition card","priority":5,"x":0.08,"y":0.45,"width":0.84,"height":0.15}

2. "enhanceGlow" (priority: 4) — Add a subtle glow/highlight behind a key visual element to make it pop.
   - App icons, feature cards, hero images, or important buttons
   - The glow makes the element feel premium and draws the eye
   - Only suggest this for elements that would benefit from visual emphasis
   → Example: {"type":"enhanceGlow","instruction":"Add a warm glow behind the app icon to make it the focal point","displayLabel":"Glow on app icon","priority":4,"x":0.3,"y":0.1,"width":0.4,"height":0.12}

BANNED — NEVER suggest these:
- ANY text changes (replace, rename, translate, populate text)
- Filling empty screens with fake data
- Removing or rearranging UI elements
- Color changes, filter effects, or blur
- More than 2 suggestions total

RULES:
- Return 1-2 suggestions MAX. Quality over quantity.
- Bounding box (x, y, width, height): normalized 0-1 coordinates of the target element
- The bounding box must tightly wrap the specific element, not a large region
- displayLabel: max 35 chars
- If the screenshot already looks polished, return an empty array []

Return ONLY a valid JSON array:
[{"type":"heroResize","instruction":"...","displayLabel":"...","priority":5,"x":0,"y":0,"width":0,"height":0}]`;

// --- Handler ---

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not configured" }, 500);
    if (!process.env.UPSTASH_REDIS_REST_URL) return json({ error: "Redis not configured" }, 500);

    const deviceId = req.headers.get("x-device-id")?.trim();
    if (!deviceId || deviceId.length < 10) return json({ error: "Missing X-Device-Id" }, 401);

    if (REQUEST_SECRET) {
      const sig = req.headers.get("x-signature")?.trim();
      const ts = req.headers.get("x-timestamp")?.trim();
      if (!sig || !ts) return json({ error: "Missing signature" }, 401);
      if (!isTimestampValid(ts)) return json({ error: "Request expired" }, 401);
      try { if (!verifySignature(sig, ts, deviceId)) return json({ error: "Invalid signature" }, 403); }
      catch { return json({ error: "Invalid signature" }, 403); }
    }

    const key = usageKey(deviceId);
    const used = (await redis.get<number>(key)) ?? 0;
    const remaining = Math.max(0, MONTHLY_LIMIT - used);
    if (remaining <= 0) return json({ error: "Monthly limit reached", remainingCredits: 0 }, 429);

    const body = await req.json();
    const { image, language, elementSummary } = body as {
      image?: string;
      language?: string;
      elementSummary?: string;
    };

    if (!image) return json({ error: "Missing image", remainingCredits: remaining }, 400);

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    let mimeType = "image/jpeg";
    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    if (mimeMatch) mimeType = mimeMatch[1];

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    // Build context-rich user prompt
    let userPrompt = "Analyze this app screenshot for App Store marketing optimization.\n";

    // Language context is passed for awareness but NOT for text localization suggestions
    // (text changes are banned in the system prompt — only visual improvements allowed)
    if (language && language !== "en") {
      userPrompt += `\nNote: This app targets a non-English market. Consider cultural visual preferences but do NOT suggest text changes.\n`;
    }

    if (elementSummary) {
      userPrompt += `\nDetected UI elements on this screen:\n${elementSummary}\nUse this to identify specific elements in your suggestions.\n`;
    }

    userPrompt += "\nReturn 3-5 suggestions as a JSON array.";

    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Data } },
      { text: userPrompt },
    ]);

    const text = result.response.text();
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let suggestions: Array<{
      type: string; instruction: string; displayLabel: string;
      priority?: number; x?: number; y?: number; width?: number; height?: number;
    }>;

    try {
      suggestions = JSON.parse(cleaned);
      if (!Array.isArray(suggestions)) throw new Error("Not an array");
    } catch {
      return json({ error: "Failed to parse AI response", raw: cleaned, remainingCredits: remaining }, 422);
    }

    // Cap at 5 suggestions
    suggestions = suggestions.slice(0, 5);

    // Increment usage
    const newUsed = await redis.incr(key);
    if (newUsed === 1) await redis.expire(key, 35 * 24 * 60 * 60);

    return json({
      suggestions,
      remainingCredits: Math.max(0, MONTHLY_LIMIT - newUsed),
    }, 200);
  } catch (error) {
    console.error("analyze-screenshot error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
