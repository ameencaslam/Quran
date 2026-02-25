import path from "node:path";
import { fileURLToPath } from "node:url";
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
  segments: { verseKey: string; durationSec: number; [k: string]: unknown }[];
};

async function renderOne(
  bundleLocation: string,
  juzNumber: number,
  seg: Timeline["segments"][0],
  outPath: string,
): Promise<void> {
  const ayahSegment = { ...seg, startSec: 0 };
  const segmentsToRender = [ayahSegment];
  const durationInFrames = Math.round(ayahSegment.durationSec * FPS);
  const bgIndex = ((juzNumber - 1) % 5) + 1;
  const backgroundRelPath = `/backgrounds/${bgIndex}.png`;

  const comps = await getCompositions(bundleLocation, {
    inputProps: { segments: segmentsToRender, backgroundRelPath },
  });
  const comp = comps.find((c) => c.id === "JuzVideo");
  if (!comp) throw new Error('Composition "JuzVideo" not found in bundle');

  let lastStage: string | null = null;
  await renderMedia({
    composition: { ...comp, durationInFrames },
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outPath,
    inputProps: { segments: segmentsToRender, backgroundRelPath },
    crf: 15,
    imageFormat: "jpeg",
    jpegQuality: 95,
    onProgress: (p) => {
      if (p.stitchStage !== lastStage) {
        process.stdout.write("\n");
        lastStage = p.stitchStage;
      }
      writeProgressBar(p.progress, p.stitchStage);
    },
  });
  process.stdout.write("\n");
}

async function main() {
  const [juzArg] = process.argv.slice(2);
  if (!juzArg) {
    console.error("Usage: tsx remotion/render-ayah-batch.mts <juzNumber>");
    process.exit(1);
  }
  const juzNumber = Number(juzArg);
  if (!Number.isInteger(juzNumber) || juzNumber < 1 || juzNumber > 30) {
    console.error("Juz must be 1–30");
    process.exit(1);
  }

  const timelinePath = path.join(__dirname, "..", "timelines", `juz_${juzNumber}.json`);
  const raw = await fs.readFile(timelinePath, "utf8");
  const timeline: Timeline = JSON.parse(raw);

  const entry = path.join(__dirname, "index.tsx");
  console.log("Bundling (once)...");
  const bundleLocation = await bundle({
    entryPoint: entry,
    webpackOverride: (config) => config,
  });
  console.log("Bundle ready.\n");

  const outDir = path.join(__dirname, "..", "out", `juz_${juzNumber}`);
  await fs.mkdir(outDir, { recursive: true });

  let skipped = 0;
  let rendered = 0;
  for (const seg of timeline.segments) {
    const safeKey = seg.verseKey.replace(":", "_");
    const outPath = path.join(outDir, `ayah_${safeKey}.mp4`);
    if (await fs.stat(outPath).then(() => true).catch(() => false)) {
      skipped++;
      continue;
    }
    try {
      console.log(`Rendering ayah ${seg.verseKey} of Juz ${juzNumber}...`);
      const startTime = Date.now();
      await renderOne(bundleLocation, juzNumber, seg, outPath);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`Rendered ${outPath} (${elapsed}s)`);
      rendered++;
    } catch (err) {
      await fs.unlink(outPath).catch(() => {});
      throw err;
    }
  }

  console.log(`\nDone. Rendered: ${rendered}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
