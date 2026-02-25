#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: "inherit" });
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
    proc.on("error", (err) => reject(new Error(`ffmpeg not found: ${err.message}`)));
  });
}

async function main() {
  const [juzArg] = process.argv.slice(2);
  if (!juzArg) {
    console.error("Usage: node scripts/concat-juz.mjs <juz>");
    process.exit(1);
  }
  const juz = Number(juzArg);
  if (!Number.isInteger(juz) || juz < 1 || juz > 30) {
    console.error("Juz must be 1–30");
    process.exit(1);
  }

  const root = path.join(__dirname, "..");
  const timelinePath = path.join(root, "timelines", `juz_${juz}.json`);
  const outDir = path.join(root, "out", `juz_${juz}`);
  const outFile = path.join(root, "out", `juz_${juz}.mp4`);

  const raw = await fs.readFile(timelinePath, "utf8");
  const { segments } = JSON.parse(raw);
  const verseKeys = segments.map((s) => s.verseKey);

  const files = [];
  for (const vk of verseKeys) {
    const safeKey = vk.replace(":", "_");
    const p = path.join(outDir, `ayah_${safeKey}.mp4`);
    const abs = path.resolve(p);
    try {
      await fs.access(abs);
    } catch {
      console.error(`Missing: ${p}`);
      process.exit(1);
    }
    files.push(abs);
  }

  const listPath = path.join(os.tmpdir(), `quran-juz-${juz}-concat-${Date.now()}.txt`);
  const listContent = files
    .map((f) => `file '${f.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
    .join("\n");
  await fs.writeFile(listPath, listContent, "utf8");

  console.log(`Concatenating ${files.length} ayahs → ${outFile} (lossless)...`);
  await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outFile]);
  await fs.unlink(listPath).catch(() => {});

  console.log(`Done: ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
