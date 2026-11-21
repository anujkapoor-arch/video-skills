import React from 'react';
import {Composition} from 'remotion';
import {Video} from './Video';
import {spec} from './util';

// Size, frame rate and length all come from spec.json, so a new narration re-times the video with no code change.
export const Root: React.FC = () => (
  <Composition
    id="Video"
    component={Video}
    width={spec.width}
    height={spec.height}
    fps={spec.fps}
    durationInFrames={Math.ceil(spec.total * spec.fps)}
  />
);
