const BAR_WIDTH = 30;

export function formatProgressBar(progress) {
  const pct = Math.round(progress * 100);
  const filled = Math.min(BAR_WIDTH, Math.round(progress * BAR_WIDTH)) || 0;
  const empty = BAR_WIDTH - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `[${bar}] ${pct}%`;
}

export function writeProgressBar(progress, phase = "") {
  const bar = formatProgressBar(progress);
  const phaseStr = phase ? ` ${phase}` : "";
  process.stdout.write(`\r${bar}${phaseStr}    `);
}
