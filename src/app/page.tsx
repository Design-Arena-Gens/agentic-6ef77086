'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NextImage from "next/image";
import pixelmatch from "pixelmatch";

type GameStatus = "idle" | "playing" | "finished";

type ReferenceImage = {
  id: string;
  title: string;
  description: string;
  src: string;
  promptIdeas: string[];
};

const GAME_DURATION = 60;
const SCORE_CANVAS_SIZE = 256;

const REFERENCE_IMAGES: ReferenceImage[] = [
  {
    id: "city",
    title: "Neon City Sunset",
    description:
      "A futuristic skyline soaked in neon hues as the sun dips below the horizon.",
    src: "/reference-images/city.jpg",
    promptIdeas: [
      "futuristic neon skyline at sunset",
      "cyberpunk cityscape with glowing billboards",
      "sci fi city during golden hour",
    ],
  },
  {
    id: "forest",
    title: "Emerald Canopy",
    description:
      "Sunbeams cutting through dense forest foliage with a dreamy green glow.",
    src: "/reference-images/forest.jpg",
    promptIdeas: [
      "sunlit forest with misty light rays",
      "lush woodland with glowing green tones",
      "fantasy forest canopy at dawn",
    ],
  },
  {
    id: "mountain",
    title: "Peaks in the Clouds",
    description:
      "Sharp mountains rising into dramatic clouds above a reflective valley.",
    src: "/reference-images/mountain.jpg",
    promptIdeas: [
      "dramatic mountain range with clouds",
      "alpine peaks reflecting in water",
      "cinematic mountains under stormy sky",
    ],
  },
];

function getRandomReference(currentId?: string) {
  const pool = currentId
    ? REFERENCE_IMAGES.filter((img) => img.id !== currentId)
    : REFERENCE_IMAGES;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function imageToImageData(src: string): Promise<ImageData> {
  const ImageCtor =
    typeof window === "undefined" ? undefined : (window.Image ?? undefined);

  if (!ImageCtor) {
    throw new Error("Image constructor unavailable in current environment");
  }

  const img = new ImageCtor();
  img.crossOrigin = "anonymous";
  img.src = src;

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const canvas = document.createElement("canvas");
  canvas.width = SCORE_CANVAS_SIZE;
  canvas.height = SCORE_CANVAS_SIZE;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas context missing");
  }

  ctx.drawImage(img, 0, 0, SCORE_CANVAS_SIZE, SCORE_CANVAS_SIZE);
  return ctx.getImageData(0, 0, SCORE_CANVAS_SIZE, SCORE_CANVAS_SIZE);
}

async function calculateSimilarityScore(
  referenceSrc: string,
  generatedSrc: string,
): Promise<number> {
  const [refData, generatedData] = await Promise.all([
    imageToImageData(referenceSrc),
    imageToImageData(generatedSrc),
  ]);

  const diffPixels = pixelmatch(
    refData.data,
    generatedData.data,
    undefined,
    SCORE_CANVAS_SIZE,
    SCORE_CANVAS_SIZE,
    { threshold: 0.15 },
  );

  const totalPixels = SCORE_CANVAS_SIZE * SCORE_CANVAS_SIZE;
  const similarity = 1 - diffPixels / totalPixels;
  return Math.max(0, Math.round(similarity * 100));
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(1, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export default function Home() {
  const [reference, setReference] = useState<ReferenceImage>(() =>
    getRandomReference(),
  );
  const [status, setStatus] = useState<GameStatus>("idle");
  const [timeRemaining, setTimeRemaining] = useState(GAME_DURATION);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [bestScore, setBestScore] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<
    { prompt: string; image: string; score: number }[]
  >([]);
  const [roundId, setRoundId] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRound = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setRoundId((prev) => prev + 1);
    setStatus("playing");
    setTimeRemaining(GAME_DURATION);
    setPrompt("");
    setGeneratedImage(null);
    setCurrentScore(null);
    setError(null);
    setHistory([]);
  }, []);

  useEffect(() => {
    if (status !== "playing") {
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setStatus("finished");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, roundId]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || status !== "playing") {
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error("Image generation failed");
      }

      const { imageBase64 } = (await response.json()) as {
        imageBase64: string;
      };

      if (!imageBase64) {
        throw new Error("No image returned");
      }

      setGeneratedImage(imageBase64);

      const score = await calculateSimilarityScore(reference.src, imageBase64);
      setCurrentScore(score);
      setBestScore((prev) => Math.max(prev, score));
      setHistory((prev) => [{ prompt, image: imageBase64, score }, ...prev]);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Unexpected error occurred",
      );
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, reference.src, status]);

  const canSubmit = useMemo(
    () => status === "playing" && !isGenerating && prompt.trim().length > 3,
    [status, isGenerating, prompt],
  );

  const handleRestart = useCallback(() => {
    const nextReference = getRandomReference(reference.id);
    setReference(nextReference);
    setBestScore(0);
    startRound();
  }, [reference.id, startRound]);

  useEffect(() => {
    startRound();
  }, [startRound]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-10 text-slate-100">
      <header className="flex flex-col gap-2 rounded-2xl bg-slate-900/70 p-6 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Prompt Match</h1>
            <p className="text-slate-300">
              You have 60 seconds to engineer a prompt that recreates the
              reference scene as closely as possible.
            </p>
          </div>
          <div className="flex items-center gap-4 rounded-xl bg-slate-800/80 px-4 py-3 text-lg font-medium">
            <span className="text-slate-400">Time left</span>
            <span className="text-2xl font-bold tabular-nums">
              {formatTime(timeRemaining)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-300">
            Best score: {bestScore}%
          </span>
          {status === "finished" && (
            <span className="rounded-full bg-rose-500/10 px-3 py-1 text-rose-300">
              Time&apos;s up! Restart for a new challenge.
            </span>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="flex flex-col gap-4 rounded-2xl bg-slate-900/70 p-6 shadow-lg backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Reference Image
              </h2>
              <p className="text-sm text-slate-300">{reference.description}</p>
            </div>
            <button
              onClick={handleRestart}
              className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              New Image
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
            <NextImage
              src={reference.src}
              alt={reference.title}
              width={768}
              height={768}
              className="h-auto w-full object-cover"
              priority
            />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Prompt inspiration
            </h3>
            <ul className="flex flex-wrap gap-2">
              {reference.promptIdeas.map((idea) => (
                <li
                  key={idea}
                  className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300"
                >
                  {idea}
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="flex h-full flex-col gap-4 rounded-2xl bg-slate-900/70 p-6 shadow-lg backdrop-blur">
          <h2 className="text-xl font-semibold text-white">
            Your Generation
          </h2>
          <div className="flex flex-col gap-4">
            <label className="text-sm font-medium text-slate-200">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe the reference image in vivid detail..."
              className="min-h-[120px] rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
              disabled={status !== "playing" || isGenerating}
            />
            <div className="flex items-center justify-between gap-4 text-sm text-slate-400">
              <span>
                {status === "playing"
                  ? "Adjust and submit as many prompts as you like before time runs out."
                  : "Round finished. Restart to try a new scene."}
              </span>
              <button
                onClick={handleGenerate}
                disabled={!canSubmit}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-900/50 disabled:text-emerald-200/60"
              >
                {isGenerating ? "Generating..." : "Generate"}
              </button>
            </div>
            {error && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                {error}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span className="font-semibold uppercase tracking-wide text-slate-400">
                Current score
              </span>
              <span className="text-lg font-semibold text-emerald-300">
                {currentScore !== null ? `${currentScore}% similarity` : "—"}
              </span>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950/60">
              {generatedImage ? (
                <NextImage
                  src={generatedImage}
                  alt="Generated result"
                  width={768}
                  height={768}
                  className="h-auto w-full object-cover"
                />
              ) : (
                <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-slate-500">
                  <span>No image yet</span>
                  <span>Craft a prompt and generate to see your result.</span>
                </div>
              )}
            </div>
          </div>
          {history.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Prompt history
              </h3>
              <ul className="space-y-3">
                {history.map((item, index) => (
                  <li
                    key={`${item.prompt}-${index}`}
                    className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-200">
                        Attempt {history.length - index}
                      </span>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300">
                        {item.score}%
                      </span>
                    </div>
                    <p className="text-slate-300">{item.prompt}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
