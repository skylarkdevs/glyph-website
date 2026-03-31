import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import crypto from "crypto";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const REQUEST_SECRET = process.env.GLYPH_REQUEST_SECRET || "";

export const maxDuration = 60;

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

const SYSTEM_PROMPT = `You are an elite App Store screenshot copywriter. You write headlines that stop scrolling and drive downloads.

YOUR JOB: Given app info and what's visible on each screenshot, create a set of 3-5 word headlines that:
1. Tell a narrative story across slides (hook → feature → differentiation → outcome)
2. Each headline relates to what's actually shown on that specific screenshot
3. Use ASO-optimized power words that drive action
4. Focus on USER BENEFITS, not feature names

HEADLINE RULES:
- EXACTLY 3-4 words per headline. 3 is ideal. 4 is max. NEVER 5 or more.
- NO subtitles. Return ONLY the headline field. No description, no subtitle, no secondary text.
- Start with verbs or bold claims: "Track.", "Master.", "Never miss.", "Built different."
- Headlines must be SPECIFIC to the app — never generic. "Your goals. Tracked." is good for a fitness app. "Powerful features" is BANNED.
- Focus on OUTCOMES: what the user GETS, not what the app DOES
- Match the app's tone: fun app = playful copy, professional app = authoritative copy
- Each headline is a mini-ad that makes someone want to download

NARRATIVE ARC (follow this order):
- Slide 1 (Hook): Bold claim or pain point. Scroll-stopper. The ONE reason to care.
- Slide 2 (Core Feature): Your app's #1 capability, framed as a benefit.
- Slide 3 (Differentiation): What makes you different from alternatives.
- Slide 4 (Feature): A secondary benefit or "and also..." moment.
- Slide 5 (CTA/Closing): Final push. Urgency or aspiration.

GOOD HEADLINES:
- "Your goals. Tracked." (3 words, outcome-focused)
- "Never count again." (3 words, pain removal)
- "Built for the bold." (4 words, identity)
- "One tap. Done." (3 words, simplicity)
- "See the difference." (3 words, curiosity)

BAD HEADLINES:
- "Manage Saved Meals in seconds." (too long, 5+ words)
- "Feature-rich nutrition tracker" (feature name, not benefit)
- "My Application makes it easy" (generic, no punch)
- "Settings and Preferences" (UI label, not marketing)

MATCHING HEADLINES TO SCREENSHOTS:
You'll receive OCR text from each screenshot (what's visible on the app screen). Use this to understand what the screenshot shows and write a headline that SELLS that screen. Don't repeat the OCR text — write marketing copy that complements it.

Example: If OCR says "64.9 kg • 2,608 cal • P 117g", the headline could be "Your numbers. Your power." — not "Track calories and macros."

Return ONLY valid JSON:
{"slides": [{"position": 1, "headline": "...", "purpose": "Hook"}, {"position": 2, "headline": "...", "purpose": "Core Feature"}, ...]}`;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not configured" }, 500);

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

    const body = await req.json();
    const {
      appName, appDescription, category, screenshotTexts,
      language, slideCount,
      fullDescription, sellerName, averageRating, ratingCount
    } = body as {
      appName?: string;
      appDescription?: string;
      category?: string;
      screenshotTexts?: string[];
      language?: string;
      slideCount?: number;
      fullDescription?: string;
      sellerName?: string;
      averageRating?: number;
      ratingCount?: number;
    };

    if (!appName) return json({ error: "Missing appName" }, 400);

    const numSlides = Math.min(slideCount || 6, 8);
    const lang = language || "en";

    // ── Build rich context for the AI ──
    let userPrompt = `App name: "${appName}"\n`;
    if (category) userPrompt += `Category: ${category}\n`;
    if (sellerName) userPrompt += `Developer: ${sellerName}\n`;
    if (averageRating) userPrompt += `Rating: ${averageRating.toFixed(1)}★`;
    if (ratingCount) userPrompt += ` (${ratingCount.toLocaleString()} ratings)`;
    if (averageRating) userPrompt += `\n`;

    // Send the FULL App Store description — this is the goldmine for killer headlines.
    // Contains every feature, benefit, social proof claim, and selling point.
    if (fullDescription && fullDescription.length > 50) {
      userPrompt += `\n=== FULL APP STORE DESCRIPTION (analyze this deeply for claims, features, and selling points) ===\n${fullDescription.slice(0, 4000)}\n=== END DESCRIPTION ===\n`;
    } else if (appDescription) {
      userPrompt += `App description: ${appDescription}\n`;
    }

    if (lang !== "en") userPrompt += `\nLanguage: Write ALL headlines in ${lang}. The headlines must sound natural in ${lang}, not translated.\n`;

    userPrompt += `\nNumber of slides needed: ${numSlides}\n`;

    userPrompt += `
INSTRUCTIONS FOR USING THE APP STORE DESCRIPTION:
1. Read the FULL description above. Identify the app's 5 strongest selling points, unique features, and boldest claims.
2. Extract specific numbers, stats, or achievements mentioned (e.g., "500+ templates", "10M+ downloads", "4.9★ rated").
3. Turn each selling point into a punchy 3-4 word headline that a user would screenshot and share.
4. Headlines with SPECIFIC claims always beat generic ones: "100 icons. 60 seconds." beats "Create icons fast."
5. If the description mentions awards, press coverage, or user testimonials — use those as social proof headlines.

`;

    if (screenshotTexts && screenshotTexts.length > 0) {
      userPrompt += `OCR text visible on each uploaded app screenshot:\n`;
      screenshotTexts.forEach((text, i) => {
        if (text) userPrompt += `  Screenshot ${i + 1}: "${text}"\n`;
        else userPrompt += `  Screenshot ${i + 1}: (no text detected)\n`;
      });
      userPrompt += `
HEADLINE-TO-SCREENSHOT MAPPING:
- Slide 1 (Hook): No screenshot. Write a BOLD scroll-stopping claim — the app's single strongest selling point from the description.
- Slides 2 to ${numSlides - 1}: Each paired with a screenshot. Write a headline that SELLS what that screen shows, using claims from the description.
- Slide ${numSlides} (CTA): No screenshot. Closing push — urgency, aspiration, or the app's tagline.

CRITICAL: Every headline must be SPECIFIC to THIS app. Use actual features, numbers, and claims from the description.
BANNED: "Powerful features", "Built for you", "Designed for everyone", "Your app, perfected" — anything that could apply to ANY app.
`;
    }

    userPrompt += `\nGenerate ${numSlides} headlines. Return ONLY JSON.`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent([{ text: userPrompt }]);
    const text = result.response.text();
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed: { slides: Array<{ position: number; headline: string; purpose?: string }> };
    try {
      parsed = JSON.parse(cleaned);
      if (!parsed.slides || !Array.isArray(parsed.slides)) throw new Error("Missing slides array");
    } catch {
      return json({ error: "Failed to parse AI response", raw: cleaned }, 422);
    }

    // Validate: trim to requested count, ensure headlines exist
    const slides = parsed.slides.slice(0, numSlides).map((s, i) => ({
      position: i + 1,
      headline: (s.headline || "").slice(0, 50), // Cap at 50 chars
      purpose: s.purpose || ["Hook", "Core Feature", "Differentiation", "Feature", "Visual Polish", "Call to Action"][i] || "Feature",
    }));

    return json({ slides, language: lang }, 200);
  } catch (error) {
    console.error("generate-copy error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
