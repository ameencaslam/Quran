import React from 'react';
import { Composition } from 'remotion';
import { AyahJuz } from './AyahJuz';
import { FPS, WIDTH, HEIGHT } from '../src/config.mjs';
import './fonts.css';

const defaultProps = {
  segments: [] as any[],
  backgroundRelPath: '/backgrounds/1.png' as string,
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="JuzVideo"
      component={AyahJuz}
      durationInFrames={60}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={defaultProps}
    />
  </>
);

