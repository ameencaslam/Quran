import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import fs from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";
import { FPS } from "../src/config.mjs";
import { writeProgressBar } from "./progress-bar.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Timeline = {
  juzNumber: number;
  totalDurationSec: number;
  segments: any[];
};

async function renderAyah(juzNumber: number, verseKey: string) {
  const timelinePath = path.join(
    __dirname,
    "..",
    "timelines",
    `juz_${juzNumber}.json`,
  );
  const raw = await fs.readFile(timelinePath, "utf8");
  const timeline: Timeline = JSON.parse(raw);

  const seg = timeline.segments.find((s) => s.verseKey === verseKey);
  if (!seg) {
    throw new Error(`VerseKey ${verseKey} not found in Juz ${juzNumber}`);
  }

  // Normalize this ayah to start at t=0 in its own clip
  const ayahSegment = {
    ...seg,
    startSec: 0,
  };

  const segmentsToRender = [ayahSegment];
  const totalDurationSec = ayahSegment.durationSec as number;
  const durationInFrames = Math.round(totalDurationSec * FPS);

  const entry = path.join(__dirname, "index.tsx");
  const bundleLocation = await bundle({
    entryPoint: entry,
    webpackOverride: (config) => config,
  });

  const bgIndex = ((juzNumber - 1) % 5) + 1;
  const backgroundRelPath = `/backgrounds/${bgIndex}.png`;

  const comps = await getCompositions(bundleLocation, {
    inputProps: { segments: segmentsToRender, backgroundRelPath },
  });
  const comp = comps.find((c) => c.id === "JuzVideo");
  if (!comp) {
    throw new Error('Composition "JuzVideo" not found in bundle');
  }
  const ayahComp = {
    ...comp,
    durationInFrames,
  };

  const outDir = path.join(__dirname, "..", "out", `juz_${juzNumber}`);
  await fs.mkdir(outDir, { recursive: true });
  const safeKey = verseKey.replace(":", "_");
  const outPath = path.join(outDir, `ayah_${safeKey}.mp4`);

  const concurrency =
    process.env.REMOTION_CONCURRENCY != null
      ? Number(process.env.REMOTION_CONCURRENCY)
      : os.cpus().length;
  console.log(
    `Rendering ayah ${verseKey} of Juz ${juzNumber} to ${outPath}... (concurrency: ${concurrency})`,
  );

  const startTime = Date.now();
  let lastStage: string | null = null;
  type ProgressSnapshot = {
    renderedDoneIn: number | null;
    encodedDoneIn: number | null;
    stitchStage: string;
    renderedFrames: number;
    encodedFrames: number;
  };
  let lastProgress: ProgressSnapshot | null = null;

  await renderMedia({
    composition: ayahComp,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outPath,
    inputProps: {
      segments: segmentsToRender,
      backgroundRelPath,
    },
    crf: 15,
    imageFormat: "jpeg",
    jpegQuality: 95,
    concurrency,
    onProgress: (p) => {
      lastProgress = p as ProgressSnapshot;
      if (p.stitchStage !== lastStage) {
        process.stdout.write("\n");
        lastStage = p.stitchStage;
      }
      writeProgressBar(p.progress, p.stitchStage);
    },
  });
  process.stdout.write("\n");

  const totalMs = Date.now() - startTime;
  console.log(`Rendered ${outPath}`);
  console.log("--- Timing ---");
  console.log(`Total: ${(totalMs / 1000).toFixed(1)}s`);
  const snap = lastProgress as ProgressSnapshot | null;
  if (snap) {
    const r = snap.renderedDoneIn;
    const e = snap.encodedDoneIn;
    if (r != null)
      console.log(
        `Rendering (${snap.renderedFrames} frames): ${(r / 1000).toFixed(1)}s`,
      );
    if (e != null) console.log(`Encoding: ${(e / 1000).toFixed(1)}s`);
  }
}

(async () => {
  const [juzArg, verseKey] = process.argv.slice(2);
  if (!juzArg || !verseKey) {
    console.error("Usage: npm run render:ayah -- <juzNumber> <verseKey>");
    process.exit(1);
  }
  const j = Number(juzArg);
  if (!Number.isInteger(j) || j < 1 || j > 30) {
    console.error("Juz must be 1–30");
    process.exit(1);
  }

  await renderAyah(j, verseKey);
})();
