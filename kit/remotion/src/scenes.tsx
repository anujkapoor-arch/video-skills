import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, CARD, FONT, FPS, Scene, accent, easeOut, end, fmt, pop, ramp, spec} from './util';

// One component per scene kind. Each one fills the white card and is a pure function of the frame:
// there is no "play this, then that" in Remotion, only "where is everything at this time".
// Add a kind: write a component here, add it to KINDS at the bottom, and add it to KINDS in narrate.py.

const isLast = (s: Scene) => spec.scenes[spec.scenes.length - 1] === s;

/* Shared wrapper: lays the scene out inside the card and handles enter / exit. */
const Layer: React.FC<{s: Scene; children: React.ReactNode; style?: React.CSSProperties}> = ({s, children, style}) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const to = isLast(s) ? spec.total + 1 : end(s);
  if (t < s.start - 0.05 || t > to) return null;
  const exit = isLast(s) ? 0 : ramp(frame, to - 0.27, to);
  return (
    <div
      style={{
        position: 'absolute',
        left: CARD.x,
        top: CARD.y,
        width: CARD.w,
        height: CARD.h,
        boxSizing: 'border-box',
        padding: 56,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT,
        color: C.ink,
        opacity: 1 - exit,
        transform: `translateY(${-36 * exit}px) scale(${1 - 0.06 * exit})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// HTML wraps text for us, but nothing shrinks it. Sizes are picked from the character count
// (Mukta ExtraBold averages about half its font size per character), so long text still fits the card.
const titleSize = (text: string) => (text.length <= 26 ? 68 : text.length <= 31 ? 58 : 50);
const titleHeight = (text?: string) => (text ? (text.length > 34 ? 2 : 1) * titleSize(text) * 1.1 + 36 : 0);
const Title: React.FC<{s: Scene}> = ({s}) => {
  const frame = useCurrentFrame();
  if (!s.title) return null;
  const a = pop(frame, s.start + 0.05, 13, 130);
  return (
    <div style={{fontSize: titleSize(s.title), fontWeight: 800, lineHeight: 1.1, marginBottom: 36, opacity: Math.min(1, a * 2), transform: `translateY(${(1 - a) * 40}px)`}}>
      {s.title}
    </div>
  );
};

/* ---------- hook: chip, big title, subtitle ---------- */
const Hook: React.FC<{s: Scene}> = ({s}) => {
  const frame = useCurrentFrame();
  const title = s.title ?? '';
  const size = title.length <= 10 ? 190 : title.length <= 20 ? 150 : title.length <= 36 ? 116 : 90;
  const a = pop(frame, s.start, 11, 170);
  const b = pop(frame, s.start + 0.08, 8, 150);
  const c = pop(frame, s.start + 0.5, 13, 120);
  return (
    <Layer s={s} style={{justifyContent: 'center', alignItems: 'flex-start'}}>
      {s.chip && (
        <div style={{background: accent(0), color: '#fff', fontSize: 42, fontWeight: 800, padding: '12px 30px', borderRadius: 44, transform: `scale(${a})`, transformOrigin: '0 50%', marginBottom: 34}}>
          {s.chip}
        </div>
      )}
      <div style={{fontSize: size, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2, transform: `scale(${b})`, transformOrigin: '0 60%'}}>{title}</div>
      {s.subtitle && (
        <div style={{fontSize: 54, fontWeight: 700, lineHeight: 1.2, color: C.grey, marginTop: 36, opacity: Math.min(1, c * 2), transform: `translateY(${(1 - c) * 30}px)`}}>
          {s.subtitle}
        </div>
      )}
    </Layer>
  );
};

/* ---------- points: numbered rows, each lands on its cue word ---------- */
const Points: React.FC<{s: Scene}> = ({s}) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const items = s.items ?? [];
  const current = items.reduce((k, it, i) => (t >= it.t ? i : k), -1);
  // shrink everything by k when the rows would not fit (about 24 characters per line at full size)
  const need = items.reduce((a, it) => a + 52 + Math.max(84, Math.ceil((it.text ?? '').length / 24) * 63), 0) + 28 * (items.length - 1);
  const k = Math.min(1, (CARD.h - 112 - titleHeight(s.title)) / need);
  return (
    <Layer s={s}>
      <Title s={s} />
      <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 * k}}>
        {items.map((it, i) => {
          const a = pop(frame, it.t, 12, 160);
          const lit = i === current ? Math.min(1, (t - it.t) / 0.15) : i < current ? Math.max(0, 1 - (t - items[i + 1].t) / 0.3) : 0;
          const col = accent(i);
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 28 * k,
                padding: `${26 * k}px ${30 * k}px`,
                borderRadius: 40 * k,
                background: lit > 0.5 ? col : '#f4f1f9',
                color: lit > 0.5 ? '#fff' : C.ink,
                opacity: Math.min(1, a * 3),
                transform: `translateX(${(1 - a) * -90}px)`,
                boxShadow: `0 ${10 * lit}px 0 rgba(27,16,53,${0.14 * lit})`,
              }}
            >
              <div style={{flex: 'none', width: 84 * k, height: 84 * k, borderRadius: 42, background: lit > 0.5 ? '#fff' : col, color: lit > 0.5 ? col : '#fff', fontSize: 50 * k, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                {i + 1}
              </div>
              <div style={{fontSize: 56 * k, fontWeight: 800, lineHeight: 1.12}}>{it.text}</div>
            </div>
          );
        })}
      </div>
    </Layer>
  );
};

/* ---------- stat: one big number that counts up on its cue word ---------- */
const Stat: React.FC<{s: Scene}> = ({s}) => {
  const frame = useCurrentFrame();
  const at = s.t ?? s.start + 0.35;
  const u = easeOut(ramp(frame, at, at + 1.0, (x) => x));
  const final = `${s.prefix ?? ''}${fmt(s.value ?? 0, s.decimals)}`;
  const suffix = (s.suffix ?? '').trim();
  const inline = suffix.length <= 1; // "%" sits next to the number, " days" goes underneath
  const len = final.length + (inline ? suffix.length : 0);
  const size = len <= 3 ? 400 : len <= 5 ? 290 : len <= 8 ? 190 : 140;
  const a = pop(frame, s.start + 0.05, 13, 130);
  const land = pop(frame, at + 1.0, 7, 200);
  const n = pop(frame, at + 1.1, 10, 170);
  return (
    <Layer s={s} style={{alignItems: 'center', justifyContent: 'center', textAlign: 'center'}}>
      <div style={{fontSize: 58, fontWeight: 800, color: C.grey, lineHeight: 1.15, opacity: Math.min(1, a * 2)}}>{s.label}</div>
      <div style={{fontSize: size, fontWeight: 800, lineHeight: 1, letterSpacing: -4, color: accent(0), margin: '30px 0 0', transform: `scale(${1 + 0.5 * (land - Math.min(1, land))})`, fontVariantNumeric: 'tabular-nums'}}>
        {s.prefix ?? ''}
        {fmt((s.value ?? 0) * u, s.decimals)}
        {inline ? suffix : ''}
      </div>
      {!inline && <div style={{fontSize: 96, fontWeight: 800, lineHeight: 1, marginTop: 6}}>{suffix}</div>}
      {s.note && (
        <div style={{marginTop: 54, background: C.ink, color: '#fff', fontSize: 40, fontWeight: 700, padding: '14px 34px', borderRadius: 40, transform: `scale(${n})`}}>
          {s.note}
        </div>
      )}
    </Layer>
  );
};

/* ---------- bars: up to 6 bars, each grows on its cue word ---------- */
const Bars: React.FC<{s: Scene}> = ({s}) => {
  const frame = useCurrentFrame();
  const items = s.items ?? [];
  const max = Math.max(...items.map((it) => it.value ?? 0), 1e-9);
  const plotH = 620 - titleHeight(s.title);
  return (
    <Layer s={s}>
      <Title s={s} />
      <div style={{flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 24, borderBottom: `6px solid ${C.ink}`, paddingBottom: 0}}>
        {items.map((it, i) => {
          const g = pop(frame, it.t, 14, 110, 0.9);
          const lab = pop(frame, it.t + 0.25, 9, 190);
          const h = Math.max(10, ((it.value ?? 0) / max) * plotH * g);
          return (
            <div key={i} style={{flex: 1, maxWidth: 220, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
              <div style={{fontSize: 58, fontWeight: 800, transform: `scale(${lab})`, marginBottom: 10, whiteSpace: 'nowrap'}}>
                {fmt(it.value ?? 0, s.decimals)}
                {s.unit ?? ''}
              </div>
              <div style={{width: '100%', height: h, background: accent(i), borderRadius: '24px 24px 0 0', opacity: Math.min(1, g * 4)}} />
            </div>
          );
        })}
      </div>
      <div style={{display: 'flex', justifyContent: 'space-around', gap: 24, marginTop: 16}}>
        {items.map((it, i) => (
          <div key={i} style={{flex: 1, maxWidth: 220, textAlign: 'center', fontSize: 40, fontWeight: 700, color: C.grey, lineHeight: 1.1}}>
            {it.label}
          </div>
        ))}
      </div>
    </Layer>
  );
};

/* ---------- cta: up to 3 pills with icons ---------- */
export const ICONS: Record<string, string> = {
  heart: 'M0 30 C -46 -2 -40 -38 -18 -38 C -6 -38 0 -28 0 -22 C 0 -28 6 -38 18 -38 C 40 -38 46 -2 0 30 Z',
  chat: 'M-34 -30 h68 a10 10 0 0 1 10 10 v32 a10 10 0 0 1 -10 10 h-40 l-20 18 v-18 h-8 a10 10 0 0 1 -10 -10 v-32 a10 10 0 0 1 10 -10 z',
  play: 'M-18 -32 L 32 0 L -18 32 Z',
  star: 'M0 -40 L11 -13 L40 -12 L17 6 L25 34 L0 18 L-25 34 L-17 6 L-40 -12 L-11 -13 Z',
  check: 'M-34 2 L-12 24 L34 -24 L24 -34 L-12 4 L-24 -8 Z',
};
const ctaSize = (text: string) => (text.length <= 10 ? 96 : text.length <= 14 ? 80 : text.length <= 19 ? 64 : 52);
const Cta: React.FC<{s: Scene}> = ({s}) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const items = s.items ?? [];
  const a = pop(frame, s.start + 0.05, 8, 150);
  return (
    <Layer s={s} style={{alignItems: 'center'}}>
      {s.title && <div style={{fontSize: s.title.length <= 16 ? 92 : s.title.length <= 22 ? 72 : 58, fontWeight: 800, lineHeight: 1.05, textAlign: 'center', transform: `scale(${a})`}}>{s.title}</div>}
      <div style={{flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 34}}>
        {items.map((it, i) => {
          const p = pop(frame, it.t, 8, 180);
          const wobble = t >= it.t ? Math.sin((t - it.t) * 14) * 6 * Math.exp(-(t - it.t) * 4) * (i % 2 ? -1 : 1) : 0;
          const col = accent(i);
          return (
            <div key={i} style={{height: 176, borderRadius: 88, background: col, display: 'flex', alignItems: 'center', gap: 34, padding: '0 26px', transform: `scale(${p}) rotate(${wobble}deg)`, boxShadow: '0 14px 0 rgba(27,16,53,0.18)'}}>
              <div style={{flex: 'none', width: 128, height: 128, borderRadius: 64, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <svg viewBox="-50 -50 100 100" width={96} height={96}>
                  <path d={ICONS[it.icon ?? 'star'] ?? ICONS.star} fill={col} />
                </svg>
              </div>
              <div style={{fontSize: ctaSize(it.text ?? ''), fontWeight: 800, color: '#fff', whiteSpace: 'nowrap'}}>{it.text}</div>
            </div>
          );
        })}
      </div>
    </Layer>
  );
};

export const KINDS: Record<Scene['kind'], React.FC<{s: Scene}>> = {hook: Hook, points: Points, stat: Stat, bars: Bars, cta: Cta};
