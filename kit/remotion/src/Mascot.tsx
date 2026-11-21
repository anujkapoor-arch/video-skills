import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, FPS, isTalking, mouthOpen} from './util';

// The mascot is written as JSX, not loaded from an .svg file, so every part can be driven per frame.
// To use your own character: paste its SVG shapes in here and keep the five moving parts
// (mouth, eyes, pupils, brows, head group). See the skill's "Swap the mascot" section.
export const Mascot: React.FC<{width: number; excite?: number}> = ({width, excite = 0}) => {
  const t = useCurrentFrame() / FPS;
  const talking = isTalking(t);
  const open = Math.max(mouthOpen(t), excite);

  // A quick blink every 2.6 s, and a double blink now and then.
  const blinkAt = (phase: number) => {
    const u = (t + phase) % 2.6;
    return u < 0.16 ? Math.sin((u / 0.16) * Math.PI) : 0;
  };
  const blink = Math.max(blinkAt(0.4), t % 7.8 > 5 ? blinkAt(0.12) : 0);

  const bob = Math.sin(t * 2.4) * 6 + (talking ? Math.sin(t * 7.5) * 3 : 0);
  const tilt = Math.sin(t * 1.7) * 3 + (talking ? Math.sin(t * 5.2) * 2 : 0) - excite * 5;
  const pupX = Math.sin(t * 0.9) * 4 - 3;
  const pupY = Math.cos(t * 1.3) * 3;
  const brow = (talking ? -3 : 0) - open * 4 - excite * 9;
  const wave = Math.sin(t * 3.1) * 8 + excite * 30;
  const body = C.accents[0];

  const eye = (x: number) => (
    <g transform={`translate(${x} -40) scale(1 ${1 - 0.92 * blink})`}>
      <circle r={36} fill="#fff" />
      <circle cx={pupX} cy={pupY} r={16} fill={C.ink} />
      <circle cx={pupX + 6} cy={pupY - 6} r={5} fill="#fff" />
    </g>
  );

  return (
    <svg viewBox="-170 -200 340 380" width={width} style={{overflow: 'visible', display: 'block'}}>
      <ellipse cx={0} cy={164} rx={104 - bob} ry={14} fill={C.ink} opacity={0.16} />
      <g transform={`translate(0 ${bob})`}>
        <ellipse cx={-52} cy={150} rx={36} ry={17} fill={C.ink} />
        <ellipse cx={52} cy={150} rx={36} ry={17} fill={C.ink} />
        <ellipse cx={-128} cy={36} rx={20} ry={40} fill={body} transform={`rotate(${18 + wave} -118 10)`} />
        <ellipse cx={128} cy={36} rx={20} ry={40} fill={body} transform={`rotate(${-18 - wave} 118 10)`} />
        <g transform={`rotate(${tilt} 0 120)`}>
          <line x1={0} y1={-128} x2={0} y2={-160} stroke={C.ink} strokeWidth={8} strokeLinecap="round" />
          <circle cx={0} cy={-168} r={16} fill={C.highlight} />
          <rect x={-122} y={-132} width={244} height={284} rx={112} fill={body} />
          <ellipse cx={0} cy={86} rx={70} ry={50} fill="#fff" opacity={0.2} />
          {eye(-52)}
          {eye(52)}
          <g transform={`translate(0 ${brow})`}>
            <line x1={-82} y1={-92} x2={-28} y2={-98} stroke={C.ink} strokeWidth={9} strokeLinecap="round" />
            <line x1={82} y1={-92} x2={28} y2={-98} stroke={C.ink} strokeWidth={9} strokeLinecap="round" />
          </g>
          <circle cx={-92} cy={12} r={17} fill={C.accents[2] ?? '#ff5d8f'} opacity={0.75} />
          <circle cx={92} cy={12} r={17} fill={C.accents[2] ?? '#ff5d8f'} opacity={0.75} />
          {open > 0.06 ? (
            <>
              <ellipse cx={0} cy={36 + 8 * open} rx={26 + 5 * open} ry={4 + 28 * open} fill={C.ink} />
              {open > 0.4 && <ellipse cx={0} cy={36 + 26 * open} rx={14} ry={9 * open} fill="#ff7aa5" />}
            </>
          ) : (
            <path d="M-24 30 Q0 50 24 30" stroke={C.ink} strokeWidth={8} strokeLinecap="round" fill="none" />
          )}
        </g>
      </g>
    </svg>
  );
};
