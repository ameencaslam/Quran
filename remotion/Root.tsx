import React from 'react';
import { Composition } from 'remotion';
import { AyahJuz } from './AyahJuz';
import { FPS, WIDTH, HEIGHT } from '../src/config.mjs';
import './fonts.css';
// Default timeline (Juz 1) so the composition has shape; renderer will override props.
// Ensure you build timelines first.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const juz1 = require('../timelines/juz_1.json');

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="JuzVideo"
      component={AyahJuz}
      durationInFrames={Math.round(juz1.totalDurationSec * FPS)}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{
        segments: juz1.segments,
      }}
    />
  </>
);

