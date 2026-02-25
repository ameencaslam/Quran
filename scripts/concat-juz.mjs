#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import { getAudioDurationInSeconds } from "get-audio-duration";
import { WIDTH, HEIGHT, FPS } from "../src/config.mjs";

const AUDIO_RATE = 48000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GAP_DURATION_SEC = 4;
const BISMI_PATH = path.join(__dirname, "..", "resources", "bismi.mp3");

function runFfmpeg(args, opts = {}) {
  const { onProgress } = opts;
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, {
      stdio: ["ignore", onProgress ? "ignore" : "inherit", onProgress ? "pipe" : "inherit"],
    });
    if (onProgress && proc.stderr) {
      let buf = "";
      proc.stderr.on("data", (chunk) => {
        buf += chunk.toString();
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          const m = line.match(/time=(\d{2}):(\d{2}):(\d{2})\.\d+/);
          if (m) onProgress(m[1] + ":" + m[2] + ":" + m[3]);
        }
      });
    }
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
    proc.on("error", (err) => reject(new Error(`ffmpeg not found: ${err.message}`)));
  });
}

function escapeConcatPath(p) {
  return p.replace(/\\/g, "/").replace(/'/g, "'\\''");
}

async function createGapVideo(outPath) {
  await runFfmpeg([
    "-y", "-threads", "2",
    "-f", "lavfi", "-i", `color=c=black:s=${WIDTH}x${HEIGHT}:d=${GAP_DURATION_SEC}`,
    "-f", "lavfi", "-i", `anullsrc=r=${AUDIO_RATE}:cl=stereo`,
    "-t", String(GAP_DURATION_SEC),
    "-r", String(FPS),
    "-c:v", "libx264", "-pix_fmt", "yuvj420p",
    "-video_track_timescale", "90000",
    "-c:a", "aac", "-ar", String(AUDIO_RATE),
    "-shortest",
    outPath,
  ]);
}

async function createBismiVideo(outPath, bismiPath) {
  const duration = await getAudioDurationInSeconds(bismiPath);
  await runFfmpeg([
    "-y", "-threads", "2",
    "-f", "lavfi", "-i", `color=c=black:s=${WIDTH}x${HEIGHT}`,
    "-i", bismiPath,
    "-t", String(duration),
    "-r", String(FPS),
    "-c:v", "libx264", "-pix_fmt", "yuvj420p",
    "-video_track_timescale", "90000",
    "-c:a", "aac", "-ar", String(AUDIO_RATE),
    "-shortest",
    outPath,
  ]);
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

  try {
    await fs.access(BISMI_PATH);
  } catch {
    console.error(`Missing bismi: ${BISMI_PATH}`);
    process.exit(1);
  }

  const tmpBase = path.join(os.tmpdir(), `quran-juz-${juz}-${Date.now()}`);
  const gapPath = tmpBase + "-gap.mp4";
  const bismiPathOut = tmpBase + "-bismi.mp4";

  const cleanup = async () => {
    await fs.unlink(gapPath).catch(() => {});
    await fs.unlink(bismiPathOut).catch(() => {});
  };

  try {
    console.log("Creating 4s gap clip...");
    await createGapVideo(gapPath);
    console.log("Creating bismi clip...");
    await createBismiVideo(bismiPathOut, BISMI_PATH);

    const surahs = [];
    let current = { chapter: null, verses: [] };
    for (const s of segments) {
      const [chapter] = s.verseKey.split(":");
      if (current.chapter !== chapter) {
        if (current.verses.length) surahs.push(current);
        current = { chapter, verses: [] };
      }
      current.verses.push(s);
    }
    if (current.verses.length) surahs.push(current);

    const fileEntries = [];
    for (let i = 0; i < surahs.length; i++) {
      const surah = surahs[i];
      if (i > 0) {
        fileEntries.push(bismiPathOut);
      }
      for (const s of surah.verses) {
        const safeKey = s.verseKey.replace(":", "_");
        const p = path.join(outDir, `ayah_${safeKey}.mp4`);
        const abs = path.resolve(p);
        try {
          await fs.access(abs);
        } catch {
          console.error(`Missing: ${p}`);
          await cleanup();
          process.exit(1);
        }
        fileEntries.push(abs);
      }
      fileEntries.push(gapPath);
    }

    const listPath = tmpBase + "-list.txt";
    const listContent = fileEntries
      .map((f) => `file '${escapeConcatPath(f)}'`)
      .join("\n");
    await fs.writeFile(listPath, listContent, "utf8");

    const totalClips = fileEntries.length;
    let lastProgress = "";
    console.log(`Concatenating ${totalClips} clips → ${outFile} (lossless, low memory)...`);
    await runFfmpeg([
      "-y", "-threads", "1",
      "-f", "concat", "-safe", "0", "-i", listPath,
      "-c", "copy",
      "-avoid_negative_ts", "make_zero",
      "-stats_period", "2",
      outFile,
    ], {
      onProgress: (timeStr) => {
        if (timeStr !== lastProgress) {
          lastProgress = timeStr;
          process.stdout.write(`\r  Progress: ${timeStr}   `);
        }
      },
    });
    process.stdout.write("\n");
    await fs.unlink(listPath).catch(() => {});
  } finally {
    await cleanup();
  }

  console.log(`Done: ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
