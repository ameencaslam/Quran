import path from 'node:path';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import {bundle} from '@remotion/bundler';
import {getCompositions, renderMedia} from '@remotion/renderer';
import {FPS} from '../src/config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Timeline = {
  juzNumber: number;
  totalDurationSec: number;
  segments: any[];
};

async function renderAyah(juzNumber: number, verseKey: string) {
  const timelinePath = path.join(__dirname, '..', 'timelines', `juz_${juzNumber}.json`);
  const raw = await fs.readFile(timelinePath, 'utf8');
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

  const entry = path.join(__dirname, 'index.tsx');
  const bundleLocation = await bundle({
    entryPoint: entry,
    webpackOverride: (config) => config,
  });

  const comps = await getCompositions(bundleLocation, {
    inputProps: {segments: segmentsToRender},
  });
  const comp = comps.find((c) => c.id === 'JuzVideo');
  if (!comp) {
    throw new Error('Composition "JuzVideo" not found in bundle');
  }
  const ayahComp = {
    ...comp,
    durationInFrames,
  };

  const outDir = path.join(__dirname, '..', 'out', `juz_${juzNumber}`);
  await fs.mkdir(outDir, {recursive: true});
  const safeKey = verseKey.replace(':', '_');
  const outPath = path.join(outDir, `ayah_${safeKey}.mp4`);

  console.log(`Rendering ayah ${verseKey} of Juz ${juzNumber} to ${outPath}...`);

  let lastPct = -1;
  let lastTime = Date.now();

  await renderMedia({
    composition: ayahComp,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outPath,
    inputProps: {
      segments: segmentsToRender,
    },
    onProgress: ({progress}) => {
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
  const [juzArg, verseKey] = process.argv.slice(2);
  if (!juzArg || !verseKey) {
    console.error('Usage: npm run render:ayah -- <juzNumber> <verseKey>');
    process.exit(1);
  }
  const j = Number(juzArg);
  if (!Number.isInteger(j) || j < 1 || j > 30) {
    console.error('Juz must be 1–30');
    process.exit(1);
  }

  await renderAyah(j, verseKey);
})();

