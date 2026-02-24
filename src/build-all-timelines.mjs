import { buildJuzTimeline } from './build-juz-timeline.mjs';

const start = 1;
const end = 30;

(async () => {
  for (let j = start; j <= end; j++) {
    console.log(`=== Building Juz ${j} ===`);
    await buildJuzTimeline(j);
  }
})();
