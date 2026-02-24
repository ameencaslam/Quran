import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';

type Translation = {
  languageId: number;
  resourceId: number;
  text: string;
};

type AyahSegment = {
  verseKey: string;
  ayahNumber: number;
  arabic: { uthmani: string; simple: string };
  translations: Translation[];
  audioRelPath: string;
  startSec: number;
  durationSec: number;
};

type Props = {
  segments: AyahSegment[];
  backgroundVideoPath?: string;
};

export const AyahJuz: React.FC<Props> = ({ segments }) => {
  const { fps } = useVideoConfig();
  const ENABLE_AUDIO = true; // audio enabled

  return (
    <AbsoluteFill style={{ backgroundColor: 'black', color: 'white' }}>
      {ENABLE_AUDIO &&
        segments.map((s) => (
          <Sequence
            key={s.verseKey}
            from={Math.round(s.startSec * fps)}
            durationInFrames={Math.round(s.durationSec * fps)}
          >
            <Audio src={staticFile(s.audioRelPath)} />
          </Sequence>
        ))}

      <CurrentAyahOverlay segments={segments} />
    </AbsoluteFill>
  );
};

const CurrentAyahOverlay: React.FC<{ segments: AyahSegment[] }> = ({ segments }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const seg =
    segments.find((s) => t >= s.startSec && t < s.startSec + s.durationSec) ||
    segments[segments.length - 1];

  if (!seg) return null;

  const rel = t - seg.startSec;
  const fade = interpolate(
    rel,
    [0, 0.4, seg.durationSec - 0.4, seg.durationSec],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const getByResource = (resourceId: number) =>
    seg.translations.find((tr) => tr.resourceId === resourceId)?.text || '';

  const toArabicIndic = (n: number) =>
    String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
  const endOfAyahMarker = `\u06DD${toArabicIndic(seg.ayahNumber)}`;

  return (
    <AbsoluteFill
      style={{
        opacity: fade,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 80,
        textAlign: 'center',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ fontSize: 55, marginBottom: 60, direction: 'rtl' }}>
        {seg.arabic.uthmani} {endOfAyahMarker}
      </div>
      <div
        style={{
          fontSize: 35,
          marginBottom: 30,
          fontFamily: '"Noto Sans", system-ui, sans-serif',
        }}
      >
        {getByResource(131) || '[English missing]'}
      </div>
      <div
        style={{
          fontSize: 35,
          marginBottom: 30,
          fontFamily: '"Noto Sans Malayalam", system-ui, sans-serif',
        }}
      >
        {getByResource(37) || '[Malayalam missing]'}
      </div>
      <div
        style={{
          fontSize: 40,
          fontFamily: '"Noto Sans Devanagari", system-ui, sans-serif',
        }}
      >
        {getByResource(122) || '[Hindi missing]'}
      </div>
    </AbsoluteFill>
  );
};

