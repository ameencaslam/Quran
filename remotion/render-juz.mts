import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { bundle } from '@remotion/bundler';
import { getCompositions, renderMedia } from '@remotion/renderer';
import { FPS } from '../src/config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Timeline = {
  juzNumber: number;
  totalDurationSec: number;
  segments: any[];
};

async function renderJuz(juzNumber: number) {
  const timelinePath = path.join(__dirname, '..', 'timelines', `juz_${juzNumber}.json`);
  const raw = await fs.readFile(timelinePath, 'utf8');
  const timeline: Timeline = JSON.parse(raw);

  // Render the full Juz: all segments
  const segmentsToRender = timeline.segments;

  const totalDurationSec = segmentsToRender.reduce(
    (acc, s) => acc + (s.durationSec as number),
    0,
  );
  const durationInFrames = Math.round(totalDurationSec * FPS);

  const entry = path.join(__dirname, 'index.tsx');
  const bundleLocation = await bundle({
    entryPoint: entry,
    webpackOverride: (config) => config,
  });

  const bgIndex = ((juzNumber - 1) % 5) + 1;
  const backgroundRelPath = `/backgrounds/${bgIndex}.png`;

  const comps = await getCompositions(bundleLocation, {
    inputProps: { segments: segmentsToRender, backgroundRelPath },
  });
  const comp = comps.find((c) => c.id === 'JuzVideo');
  if (!comp) {
    throw new Error('Composition "JuzVideo" not found in bundle');
  }

  const outDir = path.join(__dirname, '..', 'out');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `juz_${juzNumber}.mp4`);

  console.log(`Rendering Juz ${juzNumber} to ${outPath}...`);

  let lastPct = -1;
  let lastTime = Date.now();

  await renderMedia({
    composition: comp,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outPath,
    inputProps: {
      segments: segmentsToRender,
      backgroundRelPath,
    },
    durationInFrames,
    fps: FPS,
    crf: 15,
    imageFormat: 'png',
    jpegQuality: 95,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct !== lastPct) {
        const now = Date.now();
        if (lastPct >= 0) {
          const deltaMs = now - lastTime;
          const deltaSec = (deltaMs / 1000).toFixed(1);
          console.log(`Progress: ${pct}% (+${deltaSec}s since ${lastPct}%)`);
        } else {
          console.log(`Progress: ${pct}%`);
        }
        lastPct = pct;
        lastTime = now;
      }
    },
  });

  console.log(`Rendered ${outPath}`);
}

(async () => {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npm run render:juz -- <juzNumber>');
    process.exit(1);
  }
  const j = Number(arg);
  if (!Number.isInteger(j) || j < 1 || j > 30) {
    console.error('Juz must be 1–30');
    process.exit(1);
  }

  await renderJuz(j);
})();
