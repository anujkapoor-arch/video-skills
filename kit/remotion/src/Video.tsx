import React from 'react';
import {AbsoluteFill, Audio, random, staticFile, useCurrentFrame} from 'remotion';
import './fonts';
import {Mascot} from './Mascot';
import {KINDS} from './scenes';
import {C, CARD, FONT, FPS, MASCOT, ON_BG, SAFE_BOTTOM, chunks, end, pop, ramp, spec} from './util';

/* ---------- background: gradient + slow drifting shapes ---------- */
const Background: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const tints = ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.20)', `${C.highlight}77`];
  return (
    <AbsoluteFill style={{background: `linear-gradient(160deg, ${C.bg.join(', ')})`}}>
      {Array.from({length: 10}, (_, i) => {
        const r = (k: string) => random(`bg${i}${k}`);
        const size = 70 + r('s') * 140;
        const k = 0.12 + r('k') * 0.2;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: r('x') * spec.width - size / 2 + Math.sin(t * k * 2 + i) * 60,
              top: r('y') * spec.height - size / 2 + Math.cos(t * k * 1.6 + i * 2) * 70 - t * 4,
              width: size,
              height: size,
              borderRadius: i % 3 === 0 ? size : size * 0.22,
              background: tints[i % tints.length],
              transform: `rotate(${t * k * 60 + i * 30}deg) scale(${1 + Math.sin(t * k * 3 + i) * 0.08})`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Header: React.FC = () => {
  const frame = useCurrentFrame();
  const a = pop(frame, 0.05, 13, 130);
  const b = pop(frame, 0.2, 13, 130);
  return (
    <div style={{position: 'absolute', left: 56, right: 56, top: 86, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: FONT, color: ON_BG}}>
      <div style={{fontSize: 50, fontWeight: 800, transform: `translateY(${(1 - a) * -140}px)`}}>{spec.channel}</div>
      <div style={{fontSize: 36, fontWeight: 700, transform: `translateY(${(1 - b) * -140}px)`}}>{spec.tag}</div>
    </div>
  );
};

/* The white card stays for the whole video and gives a small bump at each scene change. */
const Card: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = pop(frame, 0, 13, 120, 0.9);
  const bump = spec.scenes.slice(1).reduce((v, s) => {
    const dt = frame / FPS - s.start;
    return dt >= 0 && dt < 0.5 ? Math.sin(dt * 20) * 0.012 * Math.exp(-dt * 8) : v;
  }, 0);
  return (
    <div
      style={{
        position: 'absolute',
        left: CARD.x,
        top: CARD.y,
        width: CARD.w,
        height: CARD.h,
        borderRadius: 56,
        background: '#fff',
        boxShadow: '0 16px 0 rgba(27,16,53,0.16)',
        transform: `translateY(${(1 - enter) * 120}px) scale(${0.9 + 0.1 * enter + bump})`,
        opacity: Math.min(1, enter * 2),
      }}
    />
  );
};

/* ---------- captions: the spoken words, three at a time, current word highlighted ---------- */
const CAPTION_Y = 1128;
const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const c = chunks.find((k) => t >= k.from && t < k.to);
  if (!c) return null;
  const a = pop(frame, c.from, 14, 260, 0.5);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: CAPTION_Y, display: 'flex', justifyContent: 'center'}}>
      <div style={{background: C.ink, borderRadius: 34, padding: '10px 34px 14px', fontFamily: FONT, fontWeight: 800, fontSize: 62, lineHeight: 1.15, transform: `scale(${0.86 + 0.14 * a})`, whiteSpace: 'nowrap'}}>
        {c.words.map((w, i) => (
          <span key={i} style={{color: t >= w.start && (i + 1 === c.words.length || t < c.words[i + 1].start) ? C.highlight : '#fff'}}>
            {w.word}
            {i + 1 < c.words.length ? ' ' : ''}
          </span>
        ))}
      </div>
    </div>
  );
};

/* ---------- speech bubble, to the left of the mascot ---------- */
const Bubble: React.FC<{text: string; from: number; to: number}> = ({text, from, to}) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  if (t < from || t > to) return null;
  const s = pop(frame, from, 9, 190) * (1 - ramp(frame, to - 0.2, to));
  const wobble = Math.sin((t - from) * 3) * 1.2;
  return (
    <div style={{position: 'absolute', left: 150, top: MASCOT.y - 80, width: 520, height: 170, transformOrigin: '100% 60%', transform: `scale(${s}) rotate(${wobble}deg)`}}>
      <div style={{position: 'absolute', right: -30, top: 56, width: 64, height: 64, background: C.ink, transform: 'rotate(45deg)', borderRadius: 12}} />
      <div style={{position: 'absolute', inset: 0, borderRadius: 52, background: C.ink, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: text.length > 9 ? 62 : 84, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        {text}
      </div>
    </div>
  );
};

const Footer: React.FC = () =>
  spec.footer ? (
    <div
      style={{
        position: 'absolute',
        left: 40,
        right: 40,
        top: SAFE_BOTTOM - 92,
        height: 86,
        borderRadius: 26,
        background: 'rgba(255,255,255,0.86)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0 30px',
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 29,
        lineHeight: 1.22,
        color: C.ink,
      }}
    >
      {spec.footer}
    </div>
  ) : null;

/* ---------- confetti: seeded with random(), so every render is identical ---------- */
const Confetti: React.FC<{at: number; x: number; y: number; n?: number; seed: string}> = ({at, x, y, n = 80, seed}) => {
  const t = useCurrentFrame() / FPS - at;
  if (t < 0 || t > 2.4) return null;
  const cols = [...C.accents, C.highlight, '#ffffff'];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {Array.from({length: n}, (_, i) => {
        const ang = -Math.PI / 2 + (random(`${seed}a${i}`) - 0.5) * Math.PI * 1.4;
        const speed = 500 + random(`${seed}s${i}`) * 1100;
        const drag = 1 - Math.exp(-2.2 * t);
        const size = 14 + random(`${seed}z${i}`) * 18;
        const round = random(`${seed}r${i}`) > 0.6;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + (Math.cos(ang) * speed * drag) / 2.2,
              top: y + (Math.sin(ang) * speed * drag) / 2.2 + 620 * t * t,
              width: size,
              height: round ? size : size * 0.5,
              borderRadius: round ? size : 4,
              background: cols[i % cols.length],
              opacity: t < 1.5 ? 1 : Math.max(0, 1 - (t - 1.5) / 0.8),
              transform: `rotate(${t * (300 + random(`${seed}w${i}`) * 700) * (i % 2 ? 1 : -1)}deg) scaleX(${Math.cos(t * 9 + i)})`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/* ---------- composition ---------- */
export const Video: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const mascotIn = pop(frame, 0.1, 10, 140);
  const last = spec.scenes[spec.scenes.length - 1];
  // the party moment: the last cue of a closing cta scene
  const party = last.kind === 'cta' && last.items?.length ? last.items[last.items.length - 1].t : null;
  const excite = party !== null && t >= party ? pop(frame, party, 6, 220) * (1 - ramp(frame, party + 0.7, party + 1.1)) : 0;
  // a small hop whenever a bubble appears
  const hop = spec.scenes.reduce((v, s) => {
    const dt = t - (s.start + 0.15);
    return s.bubble && dt >= 0 && dt < 0.6 ? -Math.abs(Math.sin(dt * 9)) * 46 * Math.exp(-dt * 5) : v;
  }, 0);

  return (
    <AbsoluteFill style={{background: C.bg[1] ?? C.bg[0]}}>
      <Background />
      <Audio src={staticFile('narration.wav')} />
      <Header />
      <Card />
      {spec.scenes.map((s, i) => {
        const Kind = KINDS[s.kind];
        return <Kind key={i} s={s} />;
      })}
      {spec.captions !== false && <Captions />}
      {spec.mascot !== false && (
        <>
          {spec.scenes.map((s, i) => (s.bubble ? <Bubble key={i} text={s.bubble} from={s.start + 0.15} to={Math.min(end(s) - 0.1, s.start + 2.6)} /> : null))}
          <div style={{position: 'absolute', left: MASCOT.x - 170 * MASCOT.k, top: MASCOT.y - 200 * MASCOT.k, transform: `translateY(${(1 - mascotIn) * 700 + hop - excite * 30}px) scale(${1 + excite * 0.1})`, transformOrigin: '50% 100%'}}>
            <Mascot width={340 * MASCOT.k} excite={excite} />
          </div>
        </>
      )}
      <Footer />
      {party !== null && <Confetti at={party} x={540} y={900} seed="party" n={110} />}
    </AbsoluteFill>
  );
};
