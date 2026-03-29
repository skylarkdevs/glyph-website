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

const REQUEST_SECRET = process.env.GLYPH_REQUEST_SECRET || "";
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VALID_TYPES = new Set([
  "textLabel", "icon", "button", "image", "listItem",
  "navBar", "tabBar", "statusBar", "inputField", "toggle",
  "card", "background",
]);

export const maxDuration = 60;

// --- Shared auth helpers ---

function verifySignature(signature: string, timestamp: string, deviceId: string): boolean {
  if (!REQUEST_SECRET) return true;
  const expected = crypto
    .createHmac("sha256", REQUEST_SECRET)
    .update(`${timestamp}.${deviceId}`)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
}

function isTimestampValid(timestamp: string): boolean {
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;
  return Math.abs(Math.floor(Date.now() / 1000) - ts) < 300;
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
// GEMINI DETECTION PROMPT — few-shot, edge-case-aware, structured output
// =============================================================================

const DETECTION_PROMPT = `You are a precise iOS UI element detection system. Analyze the screenshot and return a JSON array of every visible UI element.

OUTPUT SCHEMA — each element is an object with exactly these keys:
{
  "type": string,     // one of: textLabel, icon, button, image, listItem, navBar, tabBar, statusBar, inputField, toggle, card, background
  "x": number,        // left edge, normalized 0.0–1.0 (0 = left edge of image)
  "y": number,        // top edge, normalized 0.0–1.0 (0 = top edge of image)
  "width": number,    // element width as fraction of image width
  "height": number,   // element height as fraction of image height
  "content": string|null, // text content or brief description
  "confidence": number    // 0.0–1.0
}

COORDINATE SYSTEM:
- All values are fractions of the full image dimensions, NOT pixels.
- (0, 0) = top-left corner. (1, 1) = bottom-right corner.
- A full-width element spanning the top 5% of the screen: x=0, y=0, width=1, height=0.05
- An element in the center-right: x≈0.6, y≈0.45, width≈0.35, height≈0.08

CLASSIFICATION RULES:
1. statusBar: the iOS status bar at the very top (time, signal bars, battery). Always present, typically y=0, height≈0.04–0.055.
2. navBar: navigation bar below the status bar (back button, title, action buttons). Typically height≈0.05–0.07.
3. tabBar: bottom tab bar with icons/labels. Typically y≈0.91–0.95, extends to bottom.
4. textLabel: any visible text — headings, body text, captions, section headers, timestamps. EVERY readable string gets its own textLabel entry.
5. button: tappable controls — buttons, links, CTAs, action chips. Include the button text in "content".
6. icon: small graphical elements — SF Symbols, app icons, decorative icons. Describe briefly in "content" (e.g., "gear icon", "heart filled", "chevron right").
7. image: photos, illustrations, hero images, thumbnails, avatars. Describe briefly (e.g., "profile photo", "landscape photo", "product thumbnail").
8. listItem: a single repeated row/cell in a list, grid, or collection. Each row is a separate listItem. Include the primary text in "content".
9. inputField: text fields, search bars, text areas. Include placeholder or entered text in "content".
10. toggle: switches, checkboxes, segmented controls, steppers. Include state in "content" (e.g., "on", "off", "selected: Option A").
11. card: a grouped container (rounded rect, shadow, distinct background) that wraps other elements. Only mark the outer card boundary. Still detect interactive elements INSIDE cards as separate entries.
12. background: large decorative/gradient areas that aren't content. Use sparingly — only for distinct colored sections.

IMPORTANT RULES:
- Bounding boxes must TIGHTLY wrap each element. No excessive padding.
- Order: top-to-bottom, left-to-right.
- GROUPING: Calendars, grids, tables, and collections with many similar cells MUST be detected as ONE card covering the entire component, NOT individual cells. A calendar is ONE card, not 30+ listItems. A grid of icons is ONE card, not 20+ icons.
- For lists with 5+ identical rows, detect the first 3 individually, then add one card with content="[remaining list area]" covering the rest.
- Maximum 25 elements total. If you detect more, merge small adjacent elements into their parent containers.
- Dark mode / light mode doesn't matter — detect elements the same way regardless of color scheme.
- If the screen appears empty or is a loading/splash screen, return a minimal array with just statusBar and any visible elements.
- DO NOT detect invisible elements, placeholder outlines, or elements fully behind overlays.
- DO NOT detect individual day cells in calendars, individual grid cells, or individual table cells. Always group them into one container.

FEW-SHOT EXAMPLES:

Example 1 — Simple settings screen:
[
  {"type":"statusBar","x":0,"y":0,"width":1,"height":0.047,"content":"9:41","confidence":0.95},
  {"type":"navBar","x":0,"y":0.047,"width":1,"height":0.06,"content":"Settings","confidence":0.92},
  {"type":"icon","x":0.04,"y":0.047,"width":0.08,"height":0.06,"content":"back chevron","confidence":0.88},
  {"type":"textLabel","x":0.35,"y":0.05,"width":0.3,"height":0.04,"content":"Settings","confidence":0.95},
  {"type":"listItem","x":0,"y":0.12,"width":1,"height":0.065,"content":"Notifications","confidence":0.9},
  {"type":"toggle","x":0.85,"y":0.13,"width":0.11,"height":0.035,"content":"on","confidence":0.88},
  {"type":"listItem","x":0,"y":0.19,"width":1,"height":0.065,"content":"Dark Mode","confidence":0.9},
  {"type":"toggle","x":0.85,"y":0.2,"width":0.11,"height":0.035,"content":"off","confidence":0.88}
]

Example 2 — Home screen with cards and tab bar:
[
  {"type":"statusBar","x":0,"y":0,"width":1,"height":0.047,"content":"12:30","confidence":0.95},
  {"type":"textLabel","x":0.04,"y":0.06,"width":0.5,"height":0.04,"content":"Good morning, Alex","confidence":0.93},
  {"type":"card","x":0.04,"y":0.11,"width":0.92,"height":0.22,"content":null,"confidence":0.85},
  {"type":"image","x":0.04,"y":0.11,"width":0.92,"height":0.15,"content":"hero banner photo","confidence":0.87},
  {"type":"textLabel","x":0.06,"y":0.27,"width":0.6,"height":0.03,"content":"Featured: Summer Collection","confidence":0.9},
  {"type":"button","x":0.7,"y":0.27,"width":0.22,"height":0.04,"content":"Shop Now","confidence":0.91},
  {"type":"tabBar","x":0,"y":0.92,"width":1,"height":0.08,"content":null,"confidence":0.95},
  {"type":"icon","x":0.08,"y":0.935,"width":0.06,"height":0.035,"content":"house icon, selected","confidence":0.88},
  {"type":"icon","x":0.28,"y":0.935,"width":0.06,"height":0.035,"content":"search icon","confidence":0.88},
  {"type":"icon","x":0.48,"y":0.935,"width":0.06,"height":0.035,"content":"cart icon","confidence":0.88},
  {"type":"icon","x":0.68,"y":0.935,"width":0.06,"height":0.035,"content":"person icon","confidence":0.88}
]

Example 3 — Empty/loading state:
[
  {"type":"statusBar","x":0,"y":0,"width":1,"height":0.047,"content":"9:41","confidence":0.95},
  {"type":"image","x":0.25,"y":0.3,"width":0.5,"height":0.2,"content":"empty state illustration","confidence":0.8},
  {"type":"textLabel","x":0.15,"y":0.52,"width":0.7,"height":0.04,"content":"No items yet","confidence":0.92},
  {"type":"textLabel","x":0.1,"y":0.57,"width":0.8,"height":0.03,"content":"Tap the + button to create your first item","confidence":0.9},
  {"type":"button","x":0.3,"y":0.65,"width":0.4,"height":0.055,"content":"Get Started","confidence":0.91}
]

COMPLETENESS CHECK — you MUST detect ALL of these if visible:
- Every text string on screen (headings, body, captions, labels, badge text, tab labels) → textLabel
- Every icon (SF Symbols, app icons, decorative icons, chevrons, close buttons) → icon
- Every tappable button or link → button
- Every card/container with a distinct background → card
- Every image, photo, avatar, or thumbnail → image
- Status bar and tab bar → statusBar / tabBar
- Every list row or grid cell → listItem

A typical iOS screen has 15-30+ detectable elements. If you return fewer than 10, you're probably missing elements. Go back and look harder.

Now analyze the provided screenshot. Return ONLY the JSON array. No markdown fences, no explanation, no preamble.`;

// =============================================================================
// Response parsing + cleaning
// =============================================================================

interface RawElement {
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  content?: string | null;
  confidence?: number;
  // Common Gemini variations we normalize
  label?: string;
  text?: string;
  left?: number;
  top?: number;
  w?: number;
  h?: number;
  score?: number;
  bbox?: number[];
}

function cleanJsonString(raw: string): string {
  let s = raw.trim();

  // Strip markdown fences: ```json ... ``` or ``` ... ```
  s = s.replace(/^```(?:json|JSON)?\s*\n?/i, "").replace(/\n?\s*```\s*$/i, "");

  // Strip leading text before the first [ (Gemini sometimes adds "Here are the elements:")
  const firstBracket = s.indexOf("[");
  if (firstBracket > 0 && firstBracket < 200) {
    s = s.slice(firstBracket);
  }

  // Strip trailing text after the last ]
  const lastBracket = s.lastIndexOf("]");
  if (lastBracket > 0 && lastBracket < s.length - 1) {
    s = s.slice(0, lastBracket + 1);
  }

  // Fix trailing commas before ] (common LLM error)
  s = s.replace(/,\s*]/g, "]");

  // Fix trailing commas before } (common LLM error)
  s = s.replace(/,\s*}/g, "}");

  return s.trim();
}

function normalizeElement(raw: RawElement, imgWidth: number = 0, imgHeight: number = 0): {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string | null;
  confidence: number;
} | null {
  // Normalize type
  const type = raw.type?.trim();
  if (!type || !VALID_TYPES.has(type)) return null;

  // Normalize coordinates — handle alternate key names
  let x = Number(raw.x ?? raw.left ?? 0);
  let y = Number(raw.y ?? raw.top ?? 0);
  let width = Number(raw.width ?? raw.w ?? 0);
  let height = Number(raw.height ?? raw.h ?? 0);

  // Handle bbox array format: [x, y, width, height]
  if (raw.bbox && Array.isArray(raw.bbox) && raw.bbox.length >= 4) {
    [x, y, width, height] = raw.bbox.map(Number);
  }

  // Detect pixel values and normalize using actual image dimensions
  if (x > 1 || y > 1 || width > 1 || height > 1) {
    const imgW = imgWidth > 0 ? imgWidth : Math.max(x + width, 1290);
    const imgH = imgHeight > 0 ? imgHeight : Math.max(y + height, 2796);
    x = x / imgW;
    y = y / imgH;
    width = width / imgW;
    height = height / imgH;
  }

  // Clamp to 0–1
  x = clamp(x);
  y = clamp(y);
  width = clamp(width, 0, 1 - x);
  height = clamp(height, 0, 1 - y);

  // Filter degenerate rects
  if (width < 0.005 || height < 0.003) return null;

  // Normalize content
  const content = typeof (raw.content ?? raw.label ?? raw.text) === "string"
    ? String(raw.content ?? raw.label ?? raw.text).slice(0, 500) || null
    : null;

  // Normalize confidence
  const confidence = clamp(Number(raw.confidence ?? raw.score ?? 0.5));
  if (confidence < 0.3) return null;

  return { type, x, y, width, height, content, confidence };
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

// =============================================================================
// Main handler
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return json({ error: "GEMINI_API_KEY not configured" }, 500);
    }

    // Auth
    const deviceId = req.headers.get("x-device-id")?.trim();
    if (!deviceId || deviceId.length < 10) {
      return json({ error: "Missing or invalid X-Device-Id" }, 401);
    }

    if (REQUEST_SECRET) {
      const signature = req.headers.get("x-signature")?.trim();
      const timestamp = req.headers.get("x-timestamp")?.trim();
      if (!signature || !timestamp) return json({ error: "Missing signature" }, 401);
      if (!isTimestampValid(timestamp)) return json({ error: "Request expired" }, 401);
      try {
        if (!verifySignature(signature, timestamp, deviceId))
          return json({ error: "Invalid signature" }, 403);
      } catch {
        return json({ error: "Invalid signature" }, 403);
      }
    }

    // Input validation
    const body = await req.json();
    const { image } = body as { image?: string };

    if (!image) return json({ error: "Missing required field: image (base64)" }, 400);
    if (image.length > 7_000_000) return json({ error: "Image too large. Max 5MB." }, 413);

    let mimeType = "image/jpeg";
    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    if (mimeMatch) mimeType = mimeMatch[1];
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return json({ error: `Unsupported type: ${mimeType}` }, 400);
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    // Detect actual image dimensions for accurate coordinate normalization
    let imgWidth = 0;
    let imgHeight = 0;
    try {
      const imgBuffer = Buffer.from(base64Data, "base64");
      const meta = await sharp(imgBuffer).metadata();
      imgWidth = meta.width ?? 0;
      imgHeight = meta.height ?? 0;
    } catch {
      // Fall back to 0 (normalizeElement will use heuristic)
    }

    // --- Gemini detection call ---
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    });

    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Data } },
      { text: DETECTION_PROMPT },
    ]);

    const rawText = result.response.text();
    if (!rawText) return json({ error: "No response from Gemini" }, 502);

    // --- Parse + clean ---
    let parsed: unknown[];
    const cleaned = cleanJsonString(rawText);

    try {
      parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) throw new Error("not array");
    } catch {
      // Retry: send the broken output back to Gemini for repair
      try {
        const fixModel = genAI.getGenerativeModel({
          model: "gemini-2.0-flash",
          generationConfig: { temperature: 0, maxOutputTokens: 8192 },
        });
        const fixResult = await fixModel.generateContent([
          {
            text: `This was supposed to be a valid JSON array of UI element objects but has errors. Return ONLY the corrected JSON array — no explanation, no markdown fences.\n\nBroken output:\n${rawText.slice(0, 4000)}`,
          },
        ]);
        const fixCleaned = cleanJsonString(fixResult.response.text());
        parsed = JSON.parse(fixCleaned);
        if (!Array.isArray(parsed)) throw new Error("not array after fix");
      } catch {
        return json(
          {
            error: "Failed to parse detection results",
            rawResponse: rawText.slice(0, 500),
          },
          422
        );
      }
    }

    // Normalize all elements through the validation pipeline
    const elements = parsed
      .filter((el): el is RawElement => typeof el === "object" && el !== null)
      .map((el) => normalizeElement(el, imgWidth, imgHeight))
      .filter((el): el is NonNullable<typeof el> => el !== null);

    // Deduplicate near-identical detections (same type, overlapping > 80%)
    const deduped = deduplicateElements(elements);

    // Merge dense clusters: if 8+ elements of same type overlap in a region, merge into one card
    const merged = mergeDenseClusters(deduped);

    // Cap at 25 elements max
    const capped = merged.slice(0, 25);

    // Stats
    try {
      const now = new Date();
      const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      await redis.incr(`detect:${month}:requests`);
    } catch {
      // Best-effort
    }

    return json({
      elements: capped,
      elementCount: capped.length,
      imageWidth: imgWidth || undefined,
      imageHeight: imgHeight || undefined,
    }, 200);
  } catch (error) {
    console.error("detect-elements error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}

// =============================================================================
// Deduplication — remove near-identical overlapping detections
// =============================================================================

function iou(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  if (x2 <= x1 || y2 <= y1) return 0;

  const intersection = (x2 - x1) * (y2 - y1);
  const aArea = a.width * a.height;
  const bArea = b.width * b.height;
  return intersection / (aArea + bArea - intersection);
}

function deduplicateElements<T extends { type: string; x: number; y: number; width: number; height: number; confidence: number }>(
  elements: T[]
): T[] {
  // Sort by confidence descending so we keep the higher-confidence detection
  const sorted = [...elements].sort((a, b) => b.confidence - a.confidence);
  const kept: T[] = [];

  for (const el of sorted) {
    const isDuplicate = kept.some(
      (existing) => existing.type === el.type && iou(existing, el) > 0.7
    );
    if (!isDuplicate) {
      kept.push(el);
    }
  }

  // Re-sort top-to-bottom, left-to-right
  return kept.sort((a, b) => a.y - b.y || a.x - b.x);
}

// =============================================================================
// Merge dense clusters of small elements into single container elements
// =============================================================================

function mergeDenseClusters<T extends { type: string; x: number; y: number; width: number; height: number; content: string | null; confidence: number }>(
  elements: T[]
): T[] {
  // Find clusters: groups of 8+ elements of the same type within a tight region
  const typeGroups = new Map<string, T[]>();
  for (const el of elements) {
    const group = typeGroups.get(el.type) || [];
    group.push(el);
    typeGroups.set(el.type, group);
  }

  const result: T[] = [];
  const merged = new Set<T>();

  for (const [type, group] of typeGroups) {
    if (group.length < 8) {
      // Not enough to form a dense cluster — keep individual elements
      continue;
    }

    // Check if elements are spatially clustered (all within a tight bounding box)
    const minX = Math.min(...group.map(e => e.x));
    const minY = Math.min(...group.map(e => e.y));
    const maxX = Math.max(...group.map(e => e.x + e.width));
    const maxY = Math.max(...group.map(e => e.y + e.height));
    const clusterW = maxX - minX;
    const clusterH = maxY - minY;
    const clusterArea = clusterW * clusterH;

    // If the cluster covers a significant area and is dense, merge
    const totalElementArea = group.reduce((sum, e) => sum + e.width * e.height, 0);
    const density = totalElementArea / Math.max(0.001, clusterArea);

    if (density > 0.15 && group.length >= 8) {
      // Merge into a single card covering the cluster bounding box
      const mergedElement = {
        type: "card",
        x: minX,
        y: minY,
        width: clusterW,
        height: clusterH,
        content: `${type} group (${group.length} items)`,
        confidence: 0.85,
      } as unknown as T;

      result.push(mergedElement);
      for (const el of group) merged.add(el);
    }
  }

  // Keep all non-merged elements
  for (const el of elements) {
    if (!merged.has(el)) {
      result.push(el);
    }
  }

  return result.sort((a, b) => a.y - b.y || a.x - b.x);
}
