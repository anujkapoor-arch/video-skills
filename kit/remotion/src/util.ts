import {Easing, interpolate, spring} from 'remotion';
import raw from './spec.json';

export type Word = {word: string; t: number};
export type Item = {text?: string; label?: string; value?: number; icon?: string; at?: string; t: number};
export type Scene = {
  kind: 'hook' | 'points' | 'stat' | 'bars' | 'cta';
  say: string;
  start: number; // seconds from the start of the video
  dur: number; // scene length, including the pause after the line
  talk: number; // length of the spoken line
  words: Word[]; // t is seconds from the start of the scene
  t?: number; // absolute time of the scene's own cue (stat count-up)
  items?: Item[]; // each item.t is an absolute time
  title?: string;
  subtitle?: string;
  chip?: string;
  bubble?: string;
  label?: string;
  value?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  note?: string;
  unit?: string;
};
type Theme = {background: string[]; ink: string; accents: string[]; highlight: string};
export type Spec = {
  width: number;
  height: number;
  fps: number;
  total: number;
  channel?: string;
  tag?: string;
  footer?: string;
  captions?: boolean;
  mascot?: boolean;
  theme?: Partial<Theme>;
  scenes: Scene[];
};

export const spec = raw as unknown as Spec;
export const FPS = spec.fps;
export const FONT = 'Mukta, sans-serif';

const theme: Theme = {
  background: ['#ffd23f', '#ff9f1c', '#ff5d8f'],
  ink: '#1b1035',
  accents: ['#7b2ff7', '#00c2a8', '#ff5d8f'],
  highlight: '#ffd23f',
  ...spec.theme,
};
export const C = {
  bg: theme.background,
  ink: theme.ink,
  accents: theme.accents,
  highlight: theme.highlight,
  grey: '#6b6280',
  white: '#ffffff',
};
export const accent = (i: number) => C.accents[i % C.accents.length];

// Text that sits straight on the background (header) flips to white on a dark theme. Use 6-digit hex colours.
const lum = (hex: string) => {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};
export const ON_BG = lum(C.bg[0]) < 0.45 ? '#ffffff' : C.ink;
// With a footer the mascot is drawn smaller and higher, so the footer never covers its feet.
export const MASCOT = spec.footer ? {x: 865, y: 1372, k: 0.82} : {x: 865, y: 1410, k: 0.97};

// Layout, in 1080x1920 pixels. The Shorts / Reels / TikTok UI covers everything below SAFE_BOTTOM.
export const SAFE_BOTTOM = 1620;
export const CARD = {x: 48, y: 200, w: 984, h: 900};

export const end = (s: Scene) => s.start + s.dur;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// Springy 0 -> 1 with overshoot, starting at `at` seconds.
export const pop = (frame: number, at: number, damping = 11, stiffness = 170, mass = 0.7) =>
  spring({frame: frame - at * FPS, fps: FPS, config: {damping, stiffness, mass}});

// Smooth 0 -> 1 between two times (seconds).
export const ramp = (frame: number, from: number, to: number, easing = Easing.inOut(Easing.cubic)) =>
  interpolate(frame / FPS, [from, to], [0, 1], {...clamp, easing});

export const easeOut = (u: number) => 1 - (1 - u) ** 3;

// Every spoken word with its absolute start and end time.
export const spoken = spec.scenes.flatMap((s, si) =>
  s.words.map((w, i) => {
    const start = s.start + w.t;
    const next = i + 1 < s.words.length ? s.start + s.words[i + 1].t : s.start + s.talk + 0.15;
    return {word: w.word, scene: si, start, next, end: Math.min(next - 0.03, start + 0.34)};
  }),
);

// Mouth openness 0..1 at time t, from the word timings. No audio analysis needed.
export const mouthOpen = (t: number): number => {
  for (const w of spoken) {
    if (t >= w.start && t < w.end) {
      const u = (t - w.start) / (w.end - w.start);
      const envelope = Math.sin(Math.PI * u) ** 0.6;
      const syllables = 0.55 + 0.45 * Math.abs(Math.sin((t - w.start) * Math.PI * 5.5));
      return envelope * syllables;
    }
  }
  return 0;
};
export const isTalking = (t: number) => spec.scenes.some((s) => t >= s.start && t < s.start + s.talk);

// Caption chunks: up to 3 words or 18 characters, never across a sentence end or a scene.
export type Chunk = {from: number; to: number; words: {word: string; start: number}[]};
export const chunks: Chunk[] = [];
{
  let cur: Chunk | null = null;
  let chars = 0;
  spoken.forEach((w, i) => {
    const prev = spoken[i - 1];
    const brk = !cur || !prev || prev.scene !== w.scene || /[.!?,;:]$/.test(prev.word) || cur.words.length >= 3 || chars + w.word.length > 18;
    if (brk) {
      cur = {from: w.start, to: w.next, words: []};
      chunks.push(cur);
      chars = 0;
    }
    cur!.words.push({word: w.word, start: w.start});
    cur!.to = w.next;
    chars += w.word.length + 1;
  });
}

export const fmt = (n: number, decimals = 0) =>
  n.toLocaleString('en-US', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
