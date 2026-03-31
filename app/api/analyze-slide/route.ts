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

export const maxDuration = 120;

function usageKey(deviceId: string): string {
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `enhance:${deviceId}:${month}`;
}

function verifySignature(sig: string, ts: string, deviceId: string): boolean {
  if (!REQUEST_SECRET) return true;
  const expected = crypto
    .createHmac("sha256", REQUEST_SECRET)
    .update(`${ts}.${deviceId}`)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(sig, "hex"),
    Buffer.from(expected, "hex")
  );
}

function isTimestampValid(ts: string): boolean {
  const t = parseInt(ts, 10);
  if (isNaN(t)) return false;
  return Math.abs(Math.floor(Date.now() / 1000) - t) < 300;
}

function json(data: object, status: number) {
  return NextResponse.json(data, { status });
}

// --- System prompt: marketing slide design expert ---

const SYSTEM_PROMPT = `You are a world-class App Store screenshot designer. Analyze the MARKETING LAYER of this slide and suggest exactly 3 high-impact visual improvements.

SUGGESTION TYPES (use ONLY these):

"addVisualElements" — Add icons, shapes, patterns, floating UI cards, or decorative objects to empty areas
"improveBackground" — Upgrade flat/generic gradients with richer depth, texture, or multi-layered effects
"enhanceComposition" — Fix visual balance: add glows, halos, or bridging elements between text and content areas. NEVER mention phone, device, or frame in instructions — the background layer has no phone visible
"addDepth" — Add layering, frosted glass, shadows, or 3D depth effects for a premium feel
"colorHarmony" — Strengthen accent colors, add visual rhythm, or improve contrast

GOOD EXAMPLES (these produce great results):
- {"type":"addVisualElements","instruction":"Scatter 20-30 semi-transparent rounded app icons at various sizes (40px-120px) and slight rotations across the background, using warm pastel tones that complement the existing gradient, with larger icons near the edges and smaller ones toward the center","displayLabel":"Floating icon mosaic","priority":5,"impact":"high"}
- {"type":"addDepth","instruction":"Add a large soft radial glow (300px radius, 10% opacity) centered behind the phone frame using a lighter shade of the background color, plus 3-4 small frosted glass rectangles floating at different angles around the phone edges","displayLabel":"Premium depth layers","priority":4,"impact":"high"}
- {"type":"improveBackground","instruction":"Transform the flat single-color gradient into a rich three-tone gradient sweeping diagonally from deep navy (top-left) through the current base color to a warm highlight (bottom-right), with a subtle noise texture overlay at 3% opacity","displayLabel":"Rich gradient upgrade","priority":4,"impact":"medium"}

BAD EXAMPLES (NEVER suggest these):
- Vague instructions like "improve the background" or "make it look better"
- Any text changes: "rewrite headline", "change tagline", "update copy"
- Changes inside the phone screen
- Flat solid color backgrounds
- Generic "add a gradient" without specifying colors/direction/layers
- Changes that reduce contrast or readability at thumbnail size

CRITICAL — NEVER GENERATE TEXT:
- NEVER add, render, or generate any text, labels, words, letters, or typography in the background
- No "Headline", "Background", "Title", watermarks, or any readable characters
- Instructions must NEVER ask the AI to write or place text
- Only visual elements: shapes, icons, gradients, glows, textures, patterns

RULES:
- Return exactly 3 suggestions, sorted by impact (highest first)
- Every instruction must be 30+ characters with SPECIFIC details (colors, sizes, positions, quantities)
- Think THUMBNAIL SIZE — what pops at 200x400 pixels in the App Store search results?
- ENHANCE the current vibe, don't fight it (dark slide → deepen it, light slide → add warmth)
- displayLabel: max 35 chars, inspiring, user-facing

Return ONLY a valid JSON array. No markdown, no explanation:
[{"type":"...","instruction":"...","displayLabel":"...","priority":5,"impact":"high"}]`;

// --- Handler ---

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY)
      return json({ error: "GEMINI_API_KEY not configured" }, 500);
    if (!process.env.UPSTASH_REDIS_REST_URL)
      return json({ error: "Redis not configured" }, 500);

    const deviceId = req.headers.get("x-device-id")?.trim();
    if (!deviceId || deviceId.length < 10)
      return json({ error: "Missing X-Device-Id" }, 401);

    if (REQUEST_SECRET) {
      const sig = req.headers.get("x-signature")?.trim();
      const ts = req.headers.get("x-timestamp")?.trim();
      if (!sig || !ts) return json({ error: "Missing signature" }, 401);
      if (!isTimestampValid(ts)) return json({ error: "Request expired" }, 401);
      try {
        if (!verifySignature(sig, ts, deviceId))
          return json({ error: "Invalid signature" }, 403);
      } catch {
        return json({ error: "Invalid signature" }, 403);
      }
    }

    // Rate limit (shared counter)
    const key = usageKey(deviceId);
    const used = (await redis.get<number>(key)) ?? 0;
    const remaining = Math.max(0, MONTHLY_LIMIT - used);
    if (remaining <= 0)
      return json(
        { error: "Monthly limit reached", remainingCredits: 0 },
        429
      );

    const body = await req.json();
    const { image, headline, subtitle, vibe, backgroundColor, templateType, suiteContext } = body as {
      image?: string;
      headline?: string;
      subtitle?: string;
      vibe?: string;
      backgroundColor?: string;
      templateType?: string;      // "deviceMockup", "iconShowcase", etc.
      suiteContext?: string;      // Summary of all slides for coherence
    };

    if (!image) return json({ error: "Missing image", remainingCredits: remaining }, 400);

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    let mimeType = "image/jpeg";
    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    if (mimeMatch) mimeType = mimeMatch[1];

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    const templateInfo = templateType && templateType !== "deviceMockup"
      ? `Template type: ${templateType} (this slide does NOT have a phone device — do NOT suggest adding one)`
      : `Template type: deviceMockup (slide has a phone showing the app)`;

    const contextLines = [
      headline ? `Current headline: "${headline}"` : null,
      subtitle ? `Current subtitle: "${subtitle}"` : null,
      vibe ? `Current style/vibe: ${vibe}` : null,
      backgroundColor ? `Background color: ${backgroundColor}` : null,
      templateInfo,
      suiteContext ? `\nSUITE CONTEXT (other slides in this set — ensure visual coherence):\n${suiteContext}` : null,
      suiteContext
        ? "IMPORTANT: Your suggestions should be VISUALLY COHERENT with the other slides. Use the same visual language (e.g., if other slides use geometric shapes, suggest geometric shapes here too. If others use icon patterns, suggest icon patterns)."
        : null,
      "Analyze this App Store marketing slide and suggest 3-5 visual improvements to the MARKETING LAYER (background, decorative elements, composition). Return JSON array.",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Data } },
      { text: contextLines },
    ]);

    const text = result.response.text();
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    let suggestions: unknown[];
    try {
      const parsed = JSON.parse(cleaned);
      suggestions = Array.isArray(parsed) ? parsed : [];
    } catch {
      return json(
        {
          error: "Failed to parse AI response",
          raw: cleaned.substring(0, 500),
          remainingCredits: remaining,
        },
        422
      );
    }

    // Don't count analysis toward usage (it's lightweight text-only)
    return json({ suggestions, remainingCredits: remaining }, 200);
  } catch (error) {
    console.error("analyze-slide error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
}
