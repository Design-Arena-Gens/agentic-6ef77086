import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { prompt } = (await request.json()) as { prompt?: string };

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 4) {
      return NextResponse.json(
        { error: "A longer prompt is required for generation." },
        { status: 400 },
      );
    }

    const seed = Math.floor(Math.random() * 10_000_000);
    const pollinationsUrl = new URL("https://image.pollinations.ai/prompt/");
    pollinationsUrl.pathname += encodeURIComponent(prompt);
    pollinationsUrl.searchParams.set("width", "512");
    pollinationsUrl.searchParams.set("height", "512");
    pollinationsUrl.searchParams.set("seed", seed.toString());
    pollinationsUrl.searchParams.set("nologo", "true");

    const response = await fetch(pollinationsUrl.toString(), {
      headers: {
        Accept: "image/jpeg",
        "User-Agent":
          "PromptMatchGame/1.0 (+https://agentic-6ef77086.vercel.app)",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to generate image from AI provider." },
        { status: 502 },
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType =
      response.headers.get("content-type") ?? "image/jpeg";
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return NextResponse.json({
      imageBase64: `data:${contentType};base64,${base64}`,
      seed,
    });
  } catch (error) {
    console.error("Generation error", error);
    return NextResponse.json(
      { error: "Unexpected server error while generating image." },
      { status: 500 },
    );
  }
}
