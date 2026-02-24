import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Timeline = {
  juzNumber: number;
  totalDurationSec: number;
  segments: { verseKey: string }[];
};

async function renderJuzFromAyahs(juzNumber: number) {
  const timelinePath = path.join(__dirname, '..', 'timelines', 'juz_' + juzNumber + '.json');
  const raw = await fs.readFile(timelinePath, 'utf8');
  const timeline: Timeline = JSON.parse(raw);

  const projectRoot = path.join(__dirname, '..');
  const outDir = path.join(projectRoot, 'out', 'juz_' + juzNumber);
  await fs.mkdir(outDir, { recursive: true });

  const total = timeline.segments.length;
  console.log('Rendering ' + total + ' ayahs for Juz ' + juzNumber + '...\n');

  for (let i = 0; i < total; i++) {
    const seg = timeline.segments[i];
    const verseKey = seg.verseKey;
    const ayahFile = 'ayah_' + verseKey.replace(':', '_') + '.mp4';
    const outPath = path.join(outDir, ayahFile);
    const exists = await fs.stat(outPath).then(() => true).catch(() => false);
    if (exists) {
      console.log('[' + (i + 1) + '/' + total + '] Skip (exists): ' + verseKey);
      continue;
    }
    console.log('[' + (i + 1) + '/' + total + '] Rendering ' + verseKey + '...');
    const r = spawnSync('npx', ['tsx', 'remotion/render-ayah.mts', String(juzNumber), verseKey], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
    });
    if (r.status !== 0) {
      throw new Error('Ayah render failed: ' + verseKey + ' (exit ' + r.status + ')');
    }
  }

  const listPath = path.join(outDir, 'concat-list.txt');
  const lines = timeline.segments.map((seg) => {
    const name = 'ayah_' + seg.verseKey.replace(':', '_') + '.mp4';
    return "file '" + name + "'";
  });
  await fs.writeFile(listPath, lines.join('\n'), 'utf8');

  const outJuzPath = path.join(projectRoot, 'out', 'juz_' + juzNumber + '.mp4');
  console.log('\nStitching to ' + outJuzPath + ' (stream copy, no re-encode)...');
  const ff = spawnSync(
    'ffmpeg',
    ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outJuzPath],
    { cwd: projectRoot, stdio: 'inherit', shell: true }
  );
  if (ff.status !== 0) {
    throw new Error('FFmpeg concat failed (exit ' + ff.status + ')');
  }
  console.log('Done: ' + outJuzPath);
}

(async () => {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npm run render:juz:from-ayahs -- <juzNumber>');
    process.exit(1);
  }
  const j = Number(arg);
  if (!Number.isInteger(j) || j < 1 || j > 30) {
    console.error('Juz must be 1–30');
    process.exit(1);
  }
  await renderJuzFromAyahs(j);
})();
