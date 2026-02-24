import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fetch from "node-fetch";
import { getAudioDurationInSeconds } from "get-audio-duration";
import { RECITATION_ID, TRANSLATIONS, AUDIO_REL_BASE } from "./config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchVersesByJuz(juzNumber) {
  const verses = [];
  let page = 1;
  const perPage = 50;

  for (;;) {
    const url =
      `https://api.quran.com/api/v4/verses/by_juz/${juzNumber}` +
      `?fields=text_uthmani,text_imlaei_simple,chapter_id` +
      `&translations=${encodeURIComponent(TRANSLATIONS)}` +
      `&per_page=${perPage}&page=${page}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`verses by_juz failed ${res.status}`);
    const json = await res.json();

    verses.push(...(json.verses || []));
    const pagination = json.pagination || {};
    if (!pagination.next_page) break;
    page = pagination.next_page;
  }

  return verses;
}

async function fetchEnglishTranslation131FromQdc(chapterId, verseKey) {
  const url =
    `https://quran.com/api/proxy/content/api/qdc/verses/by_chapter/${chapterId}` +
    `?words=false&per_page=1` +
    `&fields=text_uthmani,chapter_id,text_imlaei_simple` +
    `&translations=131` +
    `&from=${encodeURIComponent(verseKey)}&to=${encodeURIComponent(verseKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(
      `Warn: english 131 QDC fetch failed for ${verseKey} (chapter ${chapterId}) with ${res.status}`,
    );
    return null;
  }
  const json = await res.json();
  const v = (json.verses || [])[0];
  const t = (v?.translations || [])[0];
  if (!t) {
    console.warn(
      `Warn: english 131 QDC response missing translation for ${verseKey} (chapter ${chapterId})`,
    );
    return null;
  }
  return {
    resourceId: t.resource_id,
    languageId: t.language_id,
    text: t.text,
    resourceName: t.resource_name,
  };
}

async function fetchAyahAudioUrl(verseKey) {
  const url = `https://api.quran.com/api/v4/recitations/${RECITATION_ID}/by_ayah/${encodeURIComponent(
    verseKey,
  )}`;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`ayah audio failed ${res.status} for ${verseKey}`);
  const json = await res.json();
  const rel = json.audio_files?.[0]?.url;
  if (!rel) throw new Error(`no audio url for ${verseKey}`);

  if (/^https?:\/\//i.test(rel)) return rel;
  return new URL(rel, AUDIO_REL_BASE).toString();
}

async function downloadAudio(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, buf);
}

export async function buildJuzTimeline(juzNumber) {
  const verses = await fetchVersesByJuz(juzNumber);

  const segments = [];
  let cursor = 0;
  let didLogDebug = false;

  for (const v of verses) {
    const verseKey = v.verse_key;
    const chapterId = v.chapter_id;
    const ayahNumber = v.verse_number;
    const arabic = {
      uthmani: v.text_uthmani,
      simple: v.text_imlaei_simple,
    };
    const translations = (v.translations || []).map((t) => ({
      resourceId: t.resource_id,
      languageId: t.language_id,
      text: t.text,
      resourceName: t.resource_name,
    }));

    if (!didLogDebug) {
      const ids = translations.map((t) => t.resourceId);
      console.log(
        `Debug translations for first verse in Juz ${juzNumber} (${verseKey}): resourceIds=${JSON.stringify(
          ids,
        )}`,
      );
      didLogDebug = true;
    }

    const hasEnglish131 = translations.some((t) => t.resourceId === 131);
    if (!hasEnglish131) {
      const eng = await fetchEnglishTranslation131FromQdc(chapterId, verseKey);
      if (eng) translations.push(eng);
    }

    const audioUrl = await fetchAyahAudioUrl(verseKey);
    const fileName = verseKey.replace(":", "_") + ".mp3";
    const relPath = `/audio/juz_${juzNumber}/${fileName}`;
    const localPath = path.join(
      __dirname,
      "..",
      "public",
      relPath.replace(/^\//, "").split("/").join(path.sep),
    );

    // Download locally (used for duration + served via Remotion staticFile)
    await downloadAudio(audioUrl, localPath);
    const durationSec = await getAudioDurationInSeconds(localPath);

    segments.push({
      verseKey,
      ayahNumber,
      arabic,
      translations,
      audioRelPath: relPath,
      startSec: cursor,
      durationSec,
    });

    cursor += durationSec;
    console.log(`Juz ${juzNumber}: ${verseKey} ${durationSec.toFixed(2)}s`);
  }

  const timeline = { juzNumber, segments, totalDurationSec: cursor };
  const outPath = path.join(
    __dirname,
    "..",
    "timelines",
    `juz_${juzNumber}.json`,
  );
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(timeline, null, 2));

  console.log(`Saved timeline ${outPath}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const juz = Number(process.argv[2] || "1");
  buildJuzTimeline(juz).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
