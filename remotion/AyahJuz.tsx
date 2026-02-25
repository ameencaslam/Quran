import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

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
  backgroundRelPath?: string;
};

export const AyahJuz: React.FC<Props> = ({ segments, backgroundRelPath }) => {
  const { fps } = useVideoConfig();
  const ENABLE_AUDIO = true; // audio enabled

  return (
    <AbsoluteFill style={{ backgroundColor: "black", color: "white" }}>
      {backgroundRelPath ? (
        <AbsoluteFill>
          <Img
            src={staticFile(backgroundRelPath)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            alt=""
          />
        </AbsoluteFill>
      ) : null}
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

const fontSizeByChars = (
  len: number,
  tiers: { max: number; size: number }[],
  minSize: number,
) => {
  for (const { max, size } of tiers) {
    if (len <= max) return size;
  }
  return minSize;
};

const ARABIC_FONT_TIERS = [
  { max: 40, size: 80 },
  { max: 80, size: 70 },
  { max: 120, size: 60 },
  { max: 200, size: 50 },
];
const TRANS_FONT_TIERS = [
  { max: 60, size: 36 },
  { max: 120, size: 30 },
  { max: 180, size: 24 },
  { max: 280, size: 20 },
];

const CurrentAyahOverlay: React.FC<{ segments: AyahSegment[] }> = ({
  segments,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
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
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const stripFootnoteTags = (s: string) =>
    s
      .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const getByResource = (resourceId: number) => {
    const t =
      seg.translations.find((tr) => tr.resourceId === resourceId)?.text || "";
    return stripFootnoteTags(t);
  };

  const toArabicIndic = (n: number) =>
    String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
  const endOfAyahMarker = `\u06DD${toArabicIndic(seg.ayahNumber)}`;

  const arabicLen = seg.arabic.uthmani.length;
  const enText = getByResource(131) || "[English missing]";
  const mlText = getByResource(37) || "[Malayalam missing]";
  const hiText = getByResource(122) || "[Hindi missing]";

  const arabicFont = fontSizeByChars(arabicLen, ARABIC_FONT_TIERS, 24);
  const enFont = fontSizeByChars(enText.length, TRANS_FONT_TIERS, 16);
  const mlFont = fontSizeByChars(mlText.length, TRANS_FONT_TIERS, 16);
  const hiFont = fontSizeByChars(hiText.length, TRANS_FONT_TIERS, 16);

  const usableHeight = height - 160;
  const arabicHeight = usableHeight * (1 / 3);
  const transHeight = usableHeight * (2 / 9);

  return (
    <AbsoluteFill
      style={{
        opacity: fade,
        padding: 80,
        textAlign: "center",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          height: arabicHeight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: arabicFont,
            direction: "rtl",
            lineHeight: 1.4,
          }}
        >
          {seg.arabic.uthmani} {endOfAyahMarker}
        </div>
      </div>

      <div
        style={{
          height: usableHeight * (2 / 3),
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        <div
          style={{
            height: transHeight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 24px",
            borderRadius: 8,
            backgroundColor: "rgba(255,255,255,0.08)",
            fontFamily: '"Noto Sans", system-ui, sans-serif',
            fontSize: enFont,
            lineHeight: 1.35,
            overflow: "hidden",
          }}
        >
          {enText}
        </div>
        <div
          style={{
            height: transHeight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 24px",
            borderRadius: 8,
            backgroundColor: "rgba(255,255,255,0.03)",
            fontFamily: '"Noto Sans Malayalam", system-ui, sans-serif',
            fontSize: mlFont,
            lineHeight: 1.35,
            overflow: "hidden",
          }}
        >
          {mlText}
        </div>
        <div
          style={{
            height: transHeight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 24px",
            borderRadius: 8,
            backgroundColor: "rgba(255,255,255,0.08)",
            fontFamily: '"Noto Sans Devanagari", system-ui, sans-serif',
            fontSize: hiFont,
            lineHeight: 1.35,
            overflow: "hidden",
          }}
        >
          {hiText}
        </div>
      </div>
    </AbsoluteFill>
  );
};
