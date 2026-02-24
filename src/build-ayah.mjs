import fetch from 'node-fetch';

// Simple ayah-level debugger. Usage:
//   npm run debug:ayah -- 1:1

async function debugAyah(verseKey) {
  console.log(`Debugging ayah ${verseKey}...`);

  const url =
    `https://api.quran.com/api/v4/verses/by_key/${encodeURIComponent(verseKey)}` +
    `?fields=text_uthmani,text_imlaei_simple` +
    `&translations=131,80,122`;

  console.log('Request URL:', url);

  const res = await fetch(url);
  console.log('Status:', res.status);
  const json = await res.json().catch((e) => {
    console.error('Failed to parse JSON:', e);
    return null;
  });

  if (!json) {
    console.error('No JSON returned from API.');
    return;
  }

  const verses = json.verses || [];
  const v = verses[0];
  if (!v) {
    console.error('No verses in response:', JSON.stringify(json, null, 2));
    return;
  }

  console.log('Arabic uthmani:', v.text_uthmani);
  console.log('Arabic simple:', v.text_imlaei_simple);

  const translations = v.translations || [];
  console.log(
    'Translations received (resource_id list):',
    JSON.stringify(translations.map((t) => t.resource_id)),
  );

  translations.forEach((t) => {
    console.log(
      ` - resource_id=${t.resource_id}, language_id=${t.language_id}, sample="${String(
        t.text,
      ).slice(0, 100)}"...`,
    );
  });
}

(async () => {
  const verseKey = process.argv[2];
  if (!verseKey) {
    console.error('Usage: npm run debug:ayah -- <verseKey>');
    process.exit(1);
  }
  await debugAyah(verseKey);
})();

