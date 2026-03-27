import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from "@upstash/redis";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

const MONTHLY_LIMIT = 20;

export const maxDuration = 60;

// Returns "enhance:DEVICE_ID:2026-03" style key
function usageKey(deviceId: string): string {
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `enhance:${deviceId}:${month}`;
}

export async function POST(req: NextRequest) {
  try {
    // Validate env
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }
    if (!process.env.UPSTASH_REDIS_REST_URL) {
      return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
    }

    // Device ID from header
    const deviceId = req.headers.get("x-device-id")?.trim();
    if (!deviceId || deviceId.length < 10) {
      return NextResponse.json(
        { error: "Missing or invalid X-Device-Id header" },
        { status: 401 }
      );
    }

    // Check usage
    const key = usageKey(deviceId);
    const used = (await redis.get<number>(key)) ?? 0;
    const remaining = Math.max(0, MONTHLY_LIMIT - used);

    if (remaining <= 0) {
      return NextResponse.json(
        { error: "Monthly enhancement limit reached", remainingCredits: 0 },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { image, instruction } = body as {
      image?: string;
      instruction?: string;
    };

    if (!image || !instruction) {
      return NextResponse.json(
        { error: "Missing required fields: image (base64), instruction (string)", remainingCredits: remaining },
        { status: 400 }
      );
    }

    if (image.length > 7_000_000) {
      return NextResponse.json(
        { error: "Image too large. Max 5MB.", remainingCredits: remaining },
        { status: 413 }
      );
    }

    // Strip data URI prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    let mimeType = "image/jpeg";
    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    if (mimeMatch) {
      mimeType = mimeMatch[1];
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-image",
      generationConfig: {
        // @ts-expect-error - responseModalities is valid for image output
        responseModalities: ["image", "text"],
      },
    });

    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Data } },
      { text: instruction },
    ]);

    const parts = result.response.candidates?.[0]?.content?.parts;

    if (!parts) {
      return NextResponse.json(
        { error: "No response from Gemini", remainingCredits: remaining },
        { status: 502 }
      );
    }

    const imagePart = parts.find(
      (p) => "inlineData" in p && p.inlineData?.mimeType?.startsWith("image/")
    );

    if (!imagePart || !("inlineData" in imagePart) || !imagePart.inlineData) {
      const textPart = parts.find((p) => "text" in p);
      return NextResponse.json(
        {
          error: "Gemini did not return an image",
          textResponse: textPart && "text" in textPart ? textPart.text : null,
          remainingCredits: remaining,
        },
        { status: 422 }
      );
    }

    // Success — increment usage counter
    const newUsed = await redis.incr(key);
    // Set TTL to 35 days so keys auto-expire after the month rolls over
    if (newUsed === 1) {
      await redis.expire(key, 35 * 24 * 60 * 60);
    }

    return NextResponse.json({
      image: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
      remainingCredits: Math.max(0, MONTHLY_LIMIT - newUsed),
    });
  } catch (error) {
    console.error("enhance-screenshot error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
