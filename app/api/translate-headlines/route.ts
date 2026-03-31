import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const maxDuration = 30;

function json(data: object, status: number) {
  return NextResponse.json(data, { status });
}

const SYSTEM_PROMPT = `You are a professional App Store screenshot translator. You translate short marketing headlines (3-4 words each) between languages.

RULES:
- Keep translations SHORT: 3-4 words maximum. If the source is 3 words, the translation should be 3-4 words.
- Preserve the punchy, marketing tone. These are App Store headlines, not literal translations.
- Adapt idioms naturally — don't translate word-for-word if a local expression works better.
- NEVER add words, explanations, or context. Just the translated headline.
- Return ONLY a valid JSON array of strings, in the same order as the input.

Example:
Input: ["Track. Improve.", "Your goals. Done.", "Built different."]
Target: Spanish
Output: ["Mide. Mejora.", "Tus metas. Listo.", "Hecho diferente."]`;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return json({ error: "GEMINI_API_KEY not configured" }, 500);
    }

    const body = await req.json();
    const { headlines, targetLanguage, targetLanguageName } = body as {
      headlines?: string[];
      targetLanguage?: string;
      targetLanguageName?: string;
    };

    if (!headlines || !headlines.length || !targetLanguage) {
      return json({ error: "Missing headlines or targetLanguage" }, 400);
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    const headlineList = headlines.map((h, i) => `${i + 1}. "${h}"`).join("\n");
    const prompt = `Translate these ${headlines.length} App Store headlines to ${targetLanguageName || targetLanguage}:

${headlineList}

Return ONLY a JSON array of ${headlines.length} translated strings. No explanation.`;

    const result = await model.generateContent([{ text: prompt }]);
    const text = result.response.text();
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let translations: string[];
    try {
      translations = JSON.parse(cleaned);
      if (!Array.isArray(translations)) throw new Error("Not an array");
    } catch {
      return json({ error: "Failed to parse translations", raw: cleaned }, 422);
    }

    // Ensure same count
    if (translations.length !== headlines.length) {
      // Pad or trim to match
      while (translations.length < headlines.length) {
        translations.push(headlines[translations.length]); // Keep original if missing
      }
      translations = translations.slice(0, headlines.length);
    }

    return json({ translations, language: targetLanguage }, 200);
  } catch (error) {
    console.error("translate-headlines error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
