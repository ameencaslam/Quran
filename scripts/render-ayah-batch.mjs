#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BATCH_SIZE = 20;

const PROGRESS_RE = /\[.*?\]\s*\d+%.*/;

function runAyah(juz, verseKey, shared = null) {
  return new Promise((resolve, reject) => {
    const useProgress = shared !== null;
    const proc = spawn("npm", ["run", "render:ayah", "--", String(juz), verseKey], {
      stdio: useProgress ? ["ignore", "pipe", "pipe"] : "inherit",
      shell: true,
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        NODE_OPTIONS: (process.env.NODE_OPTIONS || "").trim() + " --no-deprecation",
      },
    });

    if (useProgress) {
      shared.progressMap[verseKey] = "starting…";
      shared.redraw();

      proc.stdout?.on("data", (d) => {
        const s = d.toString();
        const m = s.match(PROGRESS_RE);
        if (m) {
          shared.progressMap[verseKey] = m[0].trim();
          shared.redraw();
        }
      });
      proc.stderr?.on("data", (d) => {
        shared.progressMap[verseKey] = "(error) " + d.toString().trim().slice(0, 50);
        shared.redraw();
      });
      proc.on("close", (code) => {
        if (code === 0) {
          shared.progressMap[verseKey] = "done";
        } else {
          shared.progressMap[verseKey] = `exit ${code}`;
        }
        shared.redraw();
        code === 0 ? resolve() : reject(new Error(`${verseKey} exit ${code}`));
      });
      proc.on("error", (err) => {
        shared.progressMap[verseKey] = "error: " + err.message;
        shared.redraw();
        reject(err);
      });
    } else {
      proc.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error(`${verseKey} exit ${code}`))
      );
      proc.on("error", reject);
    }
  });
}

async function main() {
  const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");
  const args = process.argv.slice(2).filter((a) => a !== "--verbose" && a !== "-v");
  const [juzArg, batchArg] = args;
  if (!juzArg) {
    console.error("Usage: node scripts/render-ayah-batch.mjs <juz> [batchSize] [--verbose|-v]");
    process.exit(1);
  }
  const juz = Number(juzArg);
  const batchSize = batchArg ? Number(batchArg) : BATCH_SIZE;
  if (!Number.isInteger(juz) || juz < 1 || juz > 30) {
    console.error("Juz must be 1–30");
    process.exit(1);
  }
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    console.error("Batch size must be a positive integer");
    process.exit(1);
  }

  const timelinePath = path.join(__dirname, "..", "timelines", `juz_${juz}.json`);
  const raw = await fs.readFile(timelinePath, "utf8");
  const { segments } = JSON.parse(raw);
  const verseKeys = segments.map((s) => s.verseKey);

  const batches = [];
  for (let i = 0; i < verseKeys.length; i += batchSize) {
    batches.push(verseKeys.slice(i, i + batchSize));
  }

  console.log(`Juz ${juz}: ${verseKeys.length} ayahs in ${batches.length} batches of up to ${batchSize}\n`);

  const shared = verbose
    ? null
    : {
        progressMap: {},
        order: [],
        lastLineCount: 0,
        redraw() {
          const keys = this.order.filter((k) => k in this.progressMap);
          if (keys.length === 0) return;
          if (this.lastLineCount > 0) {
            process.stdout.write(`\x1b[${this.lastLineCount}A`);
          }
          const lines = keys.map((k) => `[${k}] ${this.progressMap[k]}`);
          this.lastLineCount = lines.length;
          for (const line of lines) {
            process.stdout.write(`\x1b[2K\r${line}\n`);
          }
        },
      };

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    if (shared) {
      shared.progressMap = {};
      shared.order = [...batch];
      shared.lastLineCount = 0;
    }
    console.log(`\n--- Batch ${b + 1}/${batches.length}: ${batch.join(", ")} ---`);
    await Promise.all(batch.map((vk) => runAyah(juz, vk, shared)));
    if (shared?.lastLineCount) {
      process.stdout.write(`\x1b[${shared.lastLineCount}A\x1b[0J`);
    }
    console.log(`Batch ${b + 1} done.`);
  }

  console.log(`\nAll ${verseKeys.length} ayahs rendered.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
