const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const juz = process.env.JUZ;
const t = JSON.parse(fs.readFileSync('timelines/juz_' + juz + '.json', 'utf8'));
const outDir = path.join('out', 'juz_' + juz);
let skipped = 0, rendered = 0;
for (const s of t.segments) {
  const safeKey = s.verseKey.replace(':', '_');
  const outPath = path.join(outDir, 'ayah_' + safeKey + '.mp4');
  if (fs.existsSync(outPath)) {
    skipped++;
    continue;
  }
  try {
    execSync('npm run render:ayah -- ' + juz + ' ' + s.verseKey, { stdio: 'inherit' });
    rendered++;
  } catch (err) {
    try { fs.unlinkSync(outPath); } catch (_) {}
    process.exit(130);
  }
}
console.log('Done. Rendered:', rendered, 'Skipped:', skipped);