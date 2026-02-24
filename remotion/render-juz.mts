import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";
import { FPS } from "../src/config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Timeline = {
  juzNumber: number;
  totalDurationSec: number;
  segments: any[];
};

async function renderJuz(juzNumber: number) {
  const timelinePath = path.join(
    __dirname,
    "..",
    "timelines",
    `juz_${juzNumber}.json`,
  );
  const raw = await fs.readFile(timelinePath, "utf8");
  const timeline: Timeline = JSON.parse(raw);

  // Render the full Juz: all segments
  const segmentsToRender = timeline.segments;

  const totalDurationSec = segmentsToRender.reduce(
    (acc, s) => acc + (s.durationSec as number),
    0,
  );
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
  const juzComp = { ...comp, durationInFrames, fps: FPS };

  const outDir = path.join(__dirname, "..", "out");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `juz_${juzNumber}.mp4`);

  console.log(`Rendering Juz ${juzNumber} to ${outPath}...`);

  const startTime = Date.now();
  let lastPct = -1;
  let lastTime = Date.now();
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
    composition: juzComp,
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
    onProgress: (p) => {
      lastProgress = p as ProgressSnapshot;
      if (p.stitchStage !== lastStage) {
        console.log(`[Phase] ${p.stitchStage}`);
        lastStage = p.stitchStage;
      }
      const pct = Math.round(p.progress * 100);
      if (pct !== lastPct) {
        const now = Date.now();
        if (lastPct >= 0) {
          const deltaSec = ((now - lastTime) / 1000).toFixed(1);
          console.log(`Progress: ${pct}% (+${deltaSec}s since ${lastPct}%)`);
        } else {
          console.log(`Progress: ${pct}%`);
        }
        lastPct = pct;
        lastTime = now;
      }
    },
  });

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
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npm run render:juz -- <juzNumber>");
    process.exit(1);
  }
  const j = Number(arg);
  if (!Number.isInteger(j) || j < 1 || j > 30) {
    console.error("Juz must be 1–30");
    process.exit(1);
  }

  await renderJuz(j);
})();
