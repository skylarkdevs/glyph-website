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

const SYSTEM_PROMPT = `You select ONE visual element from an app screenshot to extract and display enlarged. Return EXACTLY 2 JSON suggestions.

WHAT THIS DOES: The element you select gets cropped out of the screenshot and rendered BIGGER, floating above the phone frame on a marketing slide. It must look clean and impressive when shown standalone at 1.5x size.

STEP 1 — FIND THE BEST VISUAL ELEMENT:
Scan the screenshot and pick the single most eye-catching VISUAL element. Follow this priority:

1. CIRCULAR/ROUND visuals (progress rings, score circles, avatars, round icons with rings)
   → Crop as a SQUARE box — equal width and height, tightly around the circle
   → Example: a "72%" progress ring → square crop centered on the ring

2. DATA CARDS with icons + numbers (weight cards, stat blocks, metric displays)
   → Include the full card: icon + number + label, but NOT section headers above it
   → Example: a card showing "64.9 kg" with a flame icon and macro breakdown

3. GRID GROUPS (2-4 cards in a grid, like location pickers or category selectors)
   → Select ALL cards in the grid as ONE bounding box
   → Example: 4 location cards → one box wrapping all four

4. IMAGE CONTENT (photos, thumbnails, hero images, illustrations)
   → Tight crop around the image boundary

5. LAST RESORT — large interactive elements (big CTAs, prominent toggles)

NEVER SELECT:
- Text sentences or phrases ("ontdek hoe kakker je bent" = NO)
- Section headers ("Settings", "Goals & Targets", "Vibe Check" = NO)
- Status bar, nav bar, tab bar
- Regions wider than 85% of screen — too loose, find something specific
- Empty space or background areas

TEXT vs DATA: "72%" next to a progress ring = YES (data). "64.9 kg" in a metric card = YES. But "Start logging your meals" = NO (sentence). Numbers/metrics with visuals = good. Sentences/phrases = bad.

STEP 2 — DRAW THE BOUNDING BOX:
- x, y = top-left corner. width, height = element dimensions
- Include 5-10% PADDING around the element — our system auto-trims to the precise boundary
- It's BETTER to include slightly too much than to cut off content
- For circular elements: make width ≈ height (square crop) with padding around the circle
- For card groups: wrap the cards generously, exclude obvious headers/titles above
- Don't stress about pixel-perfect accuracy — our auto-trim handles that

STEP 3 — RETURN 2 SUGGESTIONS:
Both target the SAME element with IDENTICAL bounding box.

Suggestion 1: "heroResize" — extract and enlarge the element
Suggestion 2: "enhanceGlow" — glow-only option for the same element

Include glowColor (hex matching the element's dominant color) and glowIntensity (0.0-1.0).
- Sparse screens: 0.7-1.0 (strong glow to fill empty space)
- Busy screens: 0.2-0.5 (subtle, don't overwhelm)

GOOD EXAMPLES:
→ Progress ring: {"type":"heroResize","instruction":"72% crown progress indicator","displayLabel":"Resize score ring","priority":5,"x":0.28,"y":0.22,"width":0.22,"height":0.22,"glowColor":"#D4AF37","glowIntensity":0.8}
→ Data card: {"type":"heroResize","instruction":"Weight and nutrition data card with metrics","displayLabel":"Resize nutrition card","priority":5,"x":0.05,"y":0.42,"width":0.55,"height":0.15,"glowColor":"#8B5CF6","glowIntensity":0.6}
→ Card grid: {"type":"heroResize","instruction":"4 location selector cards in grid","displayLabel":"Resize location grid","priority":5,"x":0.08,"y":0.52,"width":0.84,"height":0.28,"glowColor":"#2D3748","glowIntensity":0.5}

BAD EXAMPLES (never do this):
→ {"x":0.03,"y":0.10,"width":0.94,"height":0.50} ← way too large, grabs everything
→ {"x":0.2,"y":0.45,"width":0.6,"height":0.04} ← text line, not a visual element
→ {"x":0.0,"y":0.0,"width":1.0,"height":0.05} ← status bar

RULES:
- Return EXACTLY 2 suggestions: one heroResize, one enhanceGlow
- IDENTICAL bounding box on both
- displayLabel: max 35 chars
- Visuals over text, always

Return ONLY a valid JSON array:
[{"type":"heroResize","instruction":"...","displayLabel":"...","priority":5,"x":0,"y":0,"width":0,"height":0,"glowColor":"#hex","glowIntensity":0.6},{"type":"enhanceGlow","instruction":"...","displayLabel":"...","priority":4,"x":0,"y":0,"width":0,"height":0,"glowColor":"#hex","glowIntensity":0.7}]`;

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
      model: "gemini-2.5-flash",
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

    userPrompt += "\nReturn EXACTLY 2 suggestions as a JSON array: one heroResize and one enhanceGlow, both targeting the same key element.";

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

    // Cap at 2 suggestions (one heroResize + one enhanceGlow)
    suggestions = suggestions.slice(0, 2);

    // Validate bounding boxes — reject elements that are too small to be meaningful
    suggestions = suggestions.filter(s => {
      const w = s.width ?? 0;
      const h = s.height ?? 0;
      const area = w * h;
      if (w < 0.10 || h < 0.04 || area < 0.008) {
        console.log(`[analyze] Rejected suggestion '${s.displayLabel}': too small (w:${w}, h:${h}, area:${area.toFixed(4)})`);
        return false;
      }
      return true;
    });

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
