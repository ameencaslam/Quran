import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
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
  { max: 30, size: 48 },
  { max: 60, size: 46 },
  { max: 90, size: 44 },
  { max: 120, size: 42 },
  { max: 160, size: 40 },
  { max: 200, size: 38 },
  { max: 250, size: 36 },
  { max: 320, size: 34 },
  { max: 400, size: 32 },
  { max: 500, size: 30 },
  { max: 650, size: 28 },
];
const TRANS_FONT_TIERS = [
  { max: 50, size: 28 },
  { max: 100, size: 26 },
  { max: 150, size: 24 },
  { max: 200, size: 22 },
  { max: 250, size: 20 },
  { max: 300, size: 19 },
  { max: 360, size: 18 },
  { max: 440, size: 17 },
  { max: 540, size: 16 },
  { max: 660, size: 15 },
  { max: 800, size: 14 },
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

  const arabicFont = fontSizeByChars(arabicLen, ARABIC_FONT_TIERS, 22);
  const enFont = fontSizeByChars(enText.length, TRANS_FONT_TIERS, 14);
  const mlFont = fontSizeByChars(mlText.length, TRANS_FONT_TIERS, 14);
  const hiFont = fontSizeByChars(hiText.length, TRANS_FONT_TIERS, 14);

  const usableHeight = height - 160;
  const arabicHeight = usableHeight * (1 / 3);
  const transHeight = usableHeight * (2 / 9);

  return (
    <AbsoluteFill
      style={{
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
