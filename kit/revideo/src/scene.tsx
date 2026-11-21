import {Audio, Circle, Gradient, Line, Node, Path, Rect, Txt, makeScene2D} from '@revideo/2d';
import type {NodeProps} from '@revideo/2d';
import {all, createRef, createSignal, delay, easeInOutCubic, easeOutCubic, linear, makeSpring, spring, tween, waitFor} from '@revideo/core';
import type {ThreadGenerator} from '@revideo/core';
import {C, CARD, FONT, MASCOT, ON_BG, SAFE_BOTTOM, accent, chunks, clamp, end, fit, fmt, isTalking, mouthOpen, rng, spec, textWidth, wrap} from './spec';
import type {Scene} from './spec';

// Revideo rules this file follows (each one cost us a debugging session):
//  1. Never give <Txt> a function for `text`. It renders nothing. Set .text() by hand from a tween.
//  2. Never use the <SVG> node for anything you want to animate. It flattens groups and builds lazily.
//     The mascot is drawn from Circle / Rect / Line / Path nodes.
//  3. Wrap text yourself (wrap() in spec.ts) and add one <Txt> per line. Heights are then known up front.
//  4. Do not use `shadowBlur`. It is slow. Shadows here are a darker shape offset underneath.
//  5. Add things in z-order. The footer and the confetti go last so nothing covers them.

const W = spec.width;
const H = spec.height;
const TOTAL = spec.total;
const INK = C.ink;

const POP = makeSpring(0.1, 30, 1.5); // quick overshoot, settles in about 0.5 s
const SOFT = makeSpring(0.16, 22, 2.4); // gentler, one small overshoot
const WOBBLE = makeSpring(0.1, 34, 0.9); // rings a few times

/** A node that paints with raw canvas calls. Used for the captions; use it for anything with many parts. */
class Painter extends Node {
  private readonly paint: (ctx: CanvasRenderingContext2D) => void;
  public constructor({paint, ...rest}: NodeProps & {paint: (ctx: CanvasRenderingContext2D) => void}) {
    super(rest);
    this.paint = paint;
  }
  protected override async draw(ctx: CanvasRenderingContext2D) {
    this.paint(ctx);
    await this.drawChildren(ctx);
  }
}

function* pop(node: Node, to = 1, s = POP): ThreadGenerator {
  node.opacity(1);
  yield* spring(s, 0, 100, 0.4, v => node.scale((v / 100) * to));
}
function* bump(node: Node, amount = 0.12, base = 1): ThreadGenerator {
  yield* spring(WOBBLE, (base + amount) * 100, base * 100, 0.3, v => node.scale(v / 100));
}
function* slideIn(node: Node, dy = 60, s = SOFT): ThreadGenerator {
  const y = node.y();
  yield* all(
    node.opacity(1, 0.18),
    spring(s, dy * 10, 0, 2, v => node.y(y + v / 10)),
  );
}
function* leave(node: Node, dur = 0.24): ThreadGenerator {
  yield* all(node.opacity(0, dur), node.y(node.y() - 36, dur, easeOutCubic));
}

/** Left-aligned or centred block of text, one <Txt> per line. Returns the node and its height. */
function block(lines: string[], x: number, top: number, size: number, fill: string, opts: {weight?: number; center?: boolean; leading?: number} = {}) {
  const lh = size * (opts.leading ?? 1.1);
  const node = (
    <Node>
      {lines.map((text, i) => (
        <Txt text={text} position={[x, top + lh * (i + 0.5)]} offset={[opts.center ? 0 : -1, 0]} fontFamily={FONT} fontWeight={opts.weight ?? 800} fontSize={size} fill={fill} />
      ))}
    </Node>
  ) as Node;
  return {node, height: lh * lines.length};
}

const ICONS: Record<string, string> = {
  heart: 'M0 30 C -46 -2 -40 -38 -18 -38 C -6 -38 0 -28 0 -22 C 0 -28 6 -38 18 -38 C 40 -38 46 -2 0 30 Z',
  chat: 'M-34 -30 h68 a10 10 0 0 1 10 10 v32 a10 10 0 0 1 -10 10 h-40 l-20 18 v-18 h-8 a10 10 0 0 1 -10 -10 v-32 a10 10 0 0 1 10 -10 z',
  play: 'M-18 -32 L 32 0 L -18 32 Z',
  star: 'M0 -40 L11 -13 L40 -12 L17 6 L25 34 L0 18 L-25 34 L-17 6 L-40 -12 L-11 -13 Z',
  check: 'M-34 2 L-12 24 L34 -24 L24 -34 L-12 4 L-24 -8 Z',
};

export default makeScene2D('video', function* (view) {
  const time = createSignal(0);
  const tl: ThreadGenerator[] = [];
  // at(seconds, ...animations): everything in the video is scheduled through this, against the narration clock.
  const at = (t: number, ...gens: ThreadGenerator[]) => tl.push(delay(Math.max(0, t), all(...gens)));

  // Everything is laid out in top-left pixel coordinates inside `stage` (Revideo's own origin is the centre).
  const stage = createRef<Node>();
  view.add(<Node ref={stage} position={[-W / 2, -H / 2]} />);
  view.add(<Audio src={'/narration.wav'} play={true} />);

  // ── background: gradient + slow drifting shapes ──
  stage().add(
    <Rect
      position={[W / 2, H / 2]}
      size={[W, H]}
      fill={
        new Gradient({
          type: 'linear',
          from: [-W / 2, -H / 2],
          to: [W / 2, H / 2],
          stops: C.bg.map((color, i) => ({offset: C.bg.length > 1 ? i / (C.bg.length - 1) : 0, color})),
        })
      }
    />,
  );
  const r0 = rng(7);
  for (let i = 0; i < 9; i++) {
    const bx = 80 + r0() * (W - 160);
    const by = 60 + (i / 9) * (H - 200) + r0() * 120;
    const size = 90 + r0() * 150;
    const ax = 40 + r0() * 70;
    const ay = 50 + r0() * 90;
    const sp = 0.12 + r0() * 0.2;
    const ph = r0() * 6.28;
    const spin = (r0() - 0.5) * 16;
    const props = {
      position: () => [bx + ax * Math.sin(time() * sp + ph), by + ay * Math.cos(time() * sp * 0.8 + ph)] as [number, number],
      rotation: () => time() * spin + i * 20,
      fill: i % 3 === 2 ? C.highlight : '#ffffff',
      opacity: i % 3 === 2 ? 0.45 : 0.24,
    };
    if (i % 3 === 0) stage().add(<Circle size={size} {...props} />);
    else stage().add(<Rect size={size * 0.9} radius={size * 0.2} {...props} />);
  }

  // ── header ──
  if (spec.channel) stage().add(<Txt text={spec.channel} position={[56, 120]} offset={[-1, 0]} fontFamily={FONT} fontWeight={800} fontSize={50} fill={ON_BG} />);
  if (spec.tag) stage().add(<Txt text={spec.tag} position={[W - 56, 120]} offset={[1, 0]} fontFamily={FONT} fontWeight={700} fontSize={36} fill={ON_BG} />);

  // ── the white card: stays for the whole video, bumps at each scene change ──
  const card = createRef<Node>();
  const cx = CARD.x + CARD.w / 2;
  const cy = CARD.y + CARD.h / 2;
  stage().add(
    <Node ref={card} position={[cx, cy]} scale={0.9} opacity={0}>
      <Rect size={[CARD.w, CARD.h]} radius={56} fill={INK} opacity={0.16} y={16} />
      <Rect size={[CARD.w, CARD.h]} radius={56} fill={'#ffffff'} />
    </Node>,
  );
  at(0, card().opacity(1, 0.15), spring(SOFT, 90, 100, 0.3, v => card().scale(v / 100)));
  spec.scenes.slice(1).forEach(s => at(s.start, bump(card(), 0.015)));

  // Inner box of the card that scenes lay themselves out in.
  const PAD = 56;
  const L = CARD.x + PAD;
  const R = CARD.x + CARD.w - PAD;
  const T = CARD.y + PAD;
  const B = CARD.y + CARD.h - PAD;
  const IW = R - L;

  /** One group per scene: fades in at the scene start and leaves just before the next one. */
  const group = (s: Scene) => {
    const g = (<Node opacity={0} />) as Node;
    stage().add(g);
    const last = spec.scenes[spec.scenes.length - 1] === s;
    at(s.start - 0.02, g.opacity(1, 0.08));
    if (!last) at(end(s) - 0.27, leave(g));
    return g;
  };
  /** Scene title at the top of the card. Returns the y where the content below it can start. */
  const title = (g: Node, s: Scene) => {
    if (!s.title) return T;
    // one line if it fits at 58 or more, otherwise two lines at 50
    const one = textWidth(s.title, 58) <= IW;
    const size = one ? fit(s.title, IW, [68, 58]) : 50;
    const tb = block(one ? [s.title] : wrap(s.title, size, IW).slice(0, 2), L, T, size, INK);
    tb.node.opacity(0);
    g.add(tb.node);
    at(s.start + 0.05, slideIn(tb.node, 40));
    return T + tb.height + 36;
  };

  // ═════════════ scene kinds ═════════════
  // Add a kind: write a builder here, add it to `build` below, and add it to KINDS in narrate.py.

  const hook = (s: Scene) => {
    const g = group(s);
    const text = s.title ?? '';
    const size = text.length <= 10 ? 190 : text.length <= 20 ? 150 : text.length <= 36 ? 116 : 90;
    const tLines = wrap(text, size, IW);
    const sLines = s.subtitle ? wrap(s.subtitle, 54, IW, 700) : [];
    const chipH = s.chip ? 82 + 34 : 0;
    const tH = tLines.length * size * 1.04;
    const sH = sLines.length ? 36 + sLines.length * 54 * 1.2 : 0;
    let y = CARD.y + (CARD.h - chipH - tH - sH) / 2;
    if (s.chip) {
      const w = textWidth(s.chip, 42) + 60;
      const chip = (
        <Rect position={[L, y + 41]} offset={[-1, 0]} size={[w, 82]} radius={41} fill={accent(0)} scale={0}>
          <Txt text={s.chip} fontFamily={FONT} fontWeight={800} fontSize={42} fill={'#fff'} />
        </Rect>
      ) as Rect;
      g.add(chip);
      at(s.start, pop(chip));
      y += chipH;
    }
    const tb = block(tLines, L, y, size, INK, {leading: 1.04});
    // scale from the left edge: put the block in a node whose origin is its left-middle
    const tNode = (<Node position={[L, y + tH / 2]} scale={0}><Node position={[-L, -(y + tH / 2)]}>{tb.node}</Node></Node>) as Node;
    g.add(tNode);
    at(s.start + 0.08, pop(tNode, 1, WOBBLE));
    if (sLines.length) {
      const sb = block(sLines, L, y + tH + 36, 54, C.grey, {weight: 700, leading: 1.2});
      sb.node.opacity(0);
      g.add(sb.node);
      at(s.start + 0.5, slideIn(sb.node, 30));
    }
  };

  const points = (s: Scene) => {
    const g = group(s);
    const top = title(g, s);
    const items = s.items ?? [];
    // lay the rows out at full size; if they are too tall for the card, shrink everything by k and lay out again
    const measure = (k: number) => {
      const rows = items.map(it => {
        const lines = wrap(it.text ?? '', 56 * k, IW - (30 + 84 + 28 + 30) * k);
        return {it, lines, h: 52 * k + Math.max(84 * k, lines.length * 56 * k * 1.12)};
      });
      return {rows, total: rows.reduce((a, r) => a + r.h, 0) + 28 * k * (rows.length - 1)};
    };
    const k = Math.min(1, (B - top) / measure(1).total);
    const {rows, total} = measure(k);
    const GAP = 28 * k;
    const F = 56 * k;
    let y = top + (B - top - total) / 2;
    const lit = rows.map(() => createSignal(0));
    rows.forEach((r, i) => {
      const col = accent(i);
      const midY = y + r.h / 2;
      const txtTop = -(r.lines.length * F * 1.12) / 2;
      const nx = -IW / 2 + (30 + 42) * k;
      const tx = -IW / 2 + (30 + 84 + 28) * k;
      const row = (
        <Node position={[cx, midY]} opacity={0}>
          <Rect size={[IW, r.h]} radius={40} fill={INK} opacity={() => 0.14 * lit[i]()} y={10} />
          <Rect size={[IW, r.h]} radius={40} fill={'#f4f1f9'} />
          <Rect size={[IW, r.h]} radius={40} fill={col} opacity={lit[i]} />
          <Circle x={nx} size={84 * k} fill={col} />
          <Circle x={nx} size={84 * k} fill={'#fff'} opacity={lit[i]} />
          <Txt text={`${i + 1}`} x={nx} y={2} fontFamily={FONT} fontWeight={800} fontSize={50 * k} fill={'#fff'} />
          <Txt text={`${i + 1}`} x={nx} y={2} fontFamily={FONT} fontWeight={800} fontSize={50 * k} fill={col} opacity={lit[i]} />
          {block(r.lines, tx, txtTop, F, INK, {leading: 1.12}).node}
          <Node opacity={lit[i]}>{block(r.lines, tx, txtTop, F, '#fff', {leading: 1.12}).node}</Node>
        </Node>
      ) as Node;
      g.add(row);
      at(
        r.it.t,
        row.opacity(1, 0.12),
        spring(POP, -900, 0, 2, v => row.x(cx + v / 10)),
        lit[i](1, 0.15),
        ...(i > 0 ? [lit[i - 1](0, 0.3)] : []),
      );
      y += r.h + GAP;
    });
  };

  const stat = (s: Scene) => {
    const g = group(s);
    const tAt = s.t ?? s.start + 0.35;
    const value = s.value ?? 0;
    const prefix = s.prefix ?? '';
    const suffix = (s.suffix ?? '').trim();
    const inline = suffix.length <= 1; // "%" sits next to the number, "days" goes underneath
    const show = (v: number) => `${prefix}${fmt(v, s.decimals)}${inline ? suffix : ''}`;
    const len = show(value).length;
    const size = len <= 3 ? 400 : len <= 5 ? 290 : len <= 8 ? 190 : 140;
    const lLines = wrap(s.label ?? '', 58, IW);
    const lH = lLines.length * 58 * 1.15;
    const sH = inline ? 0 : 96 + 6;
    const nH = s.note ? 54 + 72 : 0;
    let y = CARD.y + (CARD.h - lH - 30 - size - sH - nH) / 2;
    const lb = block(lLines, cx, y, 58, C.grey, {center: true, leading: 1.15});
    lb.node.opacity(0);
    g.add(lb.node);
    at(s.start + 0.05, lb.node.opacity(1, 0.2));
    y += lH + 30;
    const num = createRef<Txt>();
    const numG = (
      <Node position={[cx, y + size / 2]}>
        <Txt ref={num} text={show(0)} fontFamily={FONT} fontWeight={800} fontSize={size} letterSpacing={-4} fill={accent(0)} />
      </Node>
    ) as Node;
    g.add(numG);
    // rule 1: the count-up sets .text() by hand
    at(tAt, tween(1.0, v => num().text(show(value * easeOutCubic(v)))));
    at(tAt + 1.0, bump(numG, 0.08));
    y += size;
    if (!inline) {
      g.add(<Txt text={suffix} position={[cx, y + 6 + 48]} fontFamily={FONT} fontWeight={800} fontSize={96} fill={INK} />);
      y += sH;
    }
    if (s.note) {
      const w = textWidth(s.note, 40, 700) + 68;
      const note = (
        <Rect position={[cx, y + 54 + 36]} size={[w, 72]} radius={36} fill={INK} scale={0}>
          <Txt text={s.note} fontFamily={FONT} fontWeight={700} fontSize={40} fill={'#fff'} />
        </Rect>
      ) as Rect;
      g.add(note);
      at(tAt + 1.1, pop(note));
    }
  };

  const bars = (s: Scene) => {
    const g = group(s);
    const top = title(g, s);
    const items = s.items ?? [];
    const max = Math.max(...items.map(it => it.value ?? 0), 1e-9);
    const base = B - 70; // baseline; labels sit under it
    const plotH = base - top - 90; // room above the tallest bar for its value
    const slot = IW / items.length;
    const bw = Math.min(220, slot - 24);
    g.add(<Rect position={[cx, base + 3]} size={[IW, 6]} fill={INK} />);
    items.forEach((it, i) => {
      const x = L + slot * (i + 0.5);
      const full = Math.max(10, ((it.value ?? 0) / max) * plotH);
      const grow = createSignal(0);
      g.add(
        <Rect
          position={() => [x, base - (full * grow()) / 2]}
          size={() => [bw, Math.max(0.01, full * grow())]}
          radius={[24, 24, 0, 0]}
          fill={accent(i)}
          opacity={() => clamp(grow() * 4)}
        />,
      );
      const val = (
        <Txt text={`${fmt(it.value ?? 0, s.decimals)}${s.unit ?? ''}`} position={() => [x, base - full * grow() - 44]} fontFamily={FONT} fontWeight={800} fontSize={58} fill={INK} scale={0} />
      ) as Txt;
      g.add(val);
      g.add(<Txt text={it.label ?? ''} position={[x, base + 46]} fontFamily={FONT} fontWeight={700} fontSize={fit(it.label ?? '', slot - 12, [40, 34, 28], 700)} fill={C.grey} />);
      at(it.t, spring(SOFT, 0, 100, 0.3, v => grow(v / 100)));
      at(it.t + 0.25, pop(val, 1, WOBBLE));
    });
  };

  const cta = (s: Scene) => {
    const g = group(s);
    const items = s.items ?? [];
    let top = T;
    if (s.title) {
      const size = fit(s.title, IW, [92, 80, 68, 56]);
      const t = (<Txt text={s.title} position={[cx, T + 50]} fontFamily={FONT} fontWeight={800} fontSize={size} fill={INK} scale={0} />) as Txt;
      g.add(t);
      at(s.start + 0.05, pop(t, 1, WOBBLE));
      top = T + 100;
    }
    const RH = 176;
    const GAP = 34;
    const total = items.length * RH + (items.length - 1) * GAP;
    const y0 = top + (B - top - total) / 2 + RH / 2;
    items.forEach((it, i) => {
      const col = accent(i);
      const row = (
        <Node position={[cx, y0 + i * (RH + GAP)]} opacity={0} scale={0}>
          <Rect size={[IW, RH]} radius={RH / 2} fill={INK} opacity={0.18} y={14} />
          <Rect size={[IW, RH]} radius={RH / 2} fill={col} />
          <Circle x={-IW / 2 + 26 + 64} size={128} fill={'#fff'} />
          <Node x={-IW / 2 + 26 + 64} scale={0.96}>
            <Path data={ICONS[it.icon ?? 'star'] ?? ICONS.star} fill={col} />
          </Node>
          <Txt text={it.text ?? ''} x={-IW / 2 + 26 + 128 + 34} y={2} offset={[-1, 0]} fontFamily={FONT} fontWeight={800} fontSize={fit(it.text ?? '', IW - 240, [96, 80, 66])} fill={'#fff'} />
        </Node>
      ) as Node;
      g.add(row);
      at(it.t, pop(row), spring(WOBBLE, i % 2 ? -60 : 60, 0, 1, v => row.rotation(v / 10)));
    });
  };

  const build: Record<Scene['kind'], (s: Scene) => void> = {hook, points, stat, bars, cta};
  spec.scenes.forEach(s => build[s.kind](s));

  // ═════════════ captions: the spoken words, three at a time, current word highlighted ═════════════
  if (spec.captions !== false) {
    const SIZE = 62;
    const CY = 1128 + 48;
    stage().add(
      <Painter
        paint={ctx => {
          const t = time();
          const c = chunks.find(k => t >= k.from && t < k.to);
          if (!c) return;
          ctx.save();
          ctx.font = `800 ${SIZE}px ${FONT}`;
          ctx.textBaseline = 'middle';
          const space = ctx.measureText(' ').width;
          const widths = c.words.map(w => ctx.measureText(w.word).width);
          const tw = widths.reduce((a, b) => a + b, 0) + space * (c.words.length - 1);
          const k = 0.86 + 0.14 * clamp((t - c.from) / 0.1);
          ctx.translate(W / 2, CY);
          ctx.scale(k, k);
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.roundRect(-tw / 2 - 34, -48, tw + 68, 96, 34);
          ctx.fill();
          let x = -tw / 2;
          c.words.forEach((w, i) => {
            const now = t >= w.start && (i + 1 === c.words.length || t < c.words[i + 1].start);
            ctx.fillStyle = now ? C.highlight : '#ffffff';
            ctx.fillText(w.word, x, 2);
            x += widths[i] + space;
          });
          ctx.restore();
        }}
      />,
    );
  }

  // ═════════════ mascot + speech bubble ═════════════
  const last = spec.scenes[spec.scenes.length - 1];
  // the party moment: the last cue of a closing cta scene
  const party = last.kind === 'cta' && last.items?.length ? last.items[last.items.length - 1].t : null;
  const excite = createSignal(0);

  if (spec.mascot !== false) {
    const jump = createSignal(700); // starts below the frame and springs in
    const open = () => Math.max(mouthOpen(time()), excite());
    const talking = () => (isTalking(time()) ? 1 : 0);
    const blink = () => {
      const p = (time() + 1.1) % 2.9;
      return p < 0.07 ? p / 0.07 : p < 0.15 ? 1 - (p - 0.07) / 0.08 : 0;
    };
    const pupX = () => Math.sin(time() * 0.9) * 4 - 3;
    const pupY = () => Math.cos(time() * 1.3) * 3;
    const brow = () => -3 * talking() - 4 * open() - 9 * excite();
    const wave = () => Math.sin(time() * 3.1) * 8 + excite() * 30;
    const body = accent(0);
    const eye = (x: number) => (
      <Node position={[x, -40]} scale={() => [1, 1 - 0.92 * blink()]}>
        <Circle size={72} fill={'#fff'} />
        <Circle size={32} fill={INK} position={() => [pupX(), pupY()]} />
        <Circle size={10} fill={'#fff'} position={() => [pupX() + 6, pupY() - 6]} />
      </Node>
    );
    stage().add(
      <Node
        position={() => [MASCOT.x, MASCOT.y + jump() - 30 * excite()]}
        scale={() => {
          const breathe = 0.012 * Math.sin(time() * 2.6);
          const k = MASCOT.k * (1 + 0.1 * excite());
          return [k * (1 + breathe), k * (1 - breathe)];
        }}
      >
        <Circle position={[0, 164]} size={[208, 28]} fill={INK} opacity={0.16} />
        <Node y={() => Math.sin(time() * 2.4) * 6 + talking() * Math.sin(time() * 7.5) * 3}>
          <Circle position={[-52, 150]} size={[72, 34]} fill={INK} />
          <Circle position={[52, 150]} size={[72, 34]} fill={INK} />
          <Node position={[-118, 10]} rotation={() => 18 + wave()}>
            <Circle position={[-10, 26]} size={[40, 80]} fill={body} />
          </Node>
          <Node position={[118, 10]} rotation={() => -18 - wave()}>
            <Circle position={[10, 26]} size={[40, 80]} fill={body} />
          </Node>
          <Node position={[0, 120]} rotation={() => Math.sin(time() * 1.7) * 3 + talking() * Math.sin(time() * 5.2) * 2 - excite() * 5}>
            <Node position={[0, -120]}>
              <Line points={[[0, -128], [0, -160]]} stroke={INK} lineWidth={8} lineCap={'round'} />
              <Circle position={[0, -168]} size={32} fill={C.highlight} />
              <Rect position={[0, 10]} size={[244, 284]} radius={112} fill={body} />
              <Circle position={[0, 86]} size={[140, 100]} fill={'#fff'} opacity={0.2} />
              {eye(-52)}
              {eye(52)}
              <Node y={brow}>
                <Line points={[[-82, -92], [-28, -98]]} stroke={INK} lineWidth={9} lineCap={'round'} />
                <Line points={[[82, -92], [28, -98]]} stroke={INK} lineWidth={9} lineCap={'round'} />
              </Node>
              <Circle position={[-92, 12]} size={34} fill={accent(2)} opacity={0.75} />
              <Circle position={[92, 12]} size={34} fill={accent(2)} opacity={0.75} />
              <Circle position={() => [0, 36 + 8 * open()]} size={() => [52 + 10 * open(), 8 + 56 * open()]} fill={INK} opacity={() => (open() > 0.06 ? 1 : 0)} />
              <Circle position={() => [0, 36 + 26 * open()]} size={() => [28, 18 * open()]} fill={'#ff7aa5'} opacity={() => (open() > 0.4 ? 1 : 0)} />
              <Path data={'M-24 30 Q0 50 24 30'} stroke={INK} lineWidth={8} lineCap={'round'} opacity={() => (open() > 0.06 ? 0 : 1)} />
            </Node>
          </Node>
        </Node>
      </Node>,
    );
    at(0.1, spring(SOFT, 7000, 0, 5, v => jump(v / 10)));
    function* hop(height = 46): ThreadGenerator {
      yield* jump(-height, 0.14, easeOutCubic);
      yield* spring(WOBBLE, -height * 10, 0, 3, v => jump(-Math.abs(v) / 10));
    }

    // speech bubble, to the left of the mascot
    const bubble = createRef<Node>();
    const bubbleTxt = createRef<Txt>();
    stage().add(
      <Node ref={bubble} position={[712, MASCOT.y + 5]} scale={0}>
        <Path data={'M-44 -32 L 16 0 L -44 32 Z'} fill={INK} />
        <Rect position={[-302, 0]} size={[520, 170]} radius={52} fill={INK} />
        <Txt ref={bubbleTxt} text={''} position={[-302, 2]} fontFamily={FONT} fontWeight={800} fontSize={84} fill={'#fff'} />
      </Node>,
    );
    function* say(text: string, hold: number): ThreadGenerator {
      bubbleTxt().fontSize(fit(text, 460, [84, 62, 48]));
      bubbleTxt().text(text); // rule 1 again
      yield* pop(bubble(), 1, WOBBLE);
      yield* waitFor(Math.max(0, hold - 0.6));
      yield* bubble().scale(0, 0.18, easeInOutCubic);
    }
    spec.scenes.forEach(s => {
      if (s.bubble) at(s.start + 0.15, say(s.bubble, Math.min(s.dur - 0.25, 2.45)), ...(s.start > 0.5 ? [hop()] : []));
    });
    if (party !== null) {
      at(party, excite(1, 0.12));
      at(party + 0.7, excite(0, 0.4));
    }
  }

  // ── footer ──
  if (spec.footer) {
    stage().add(<Rect position={[W / 2, SAFE_BOTTOM - 49]} size={[1000, 86]} radius={26} fill={'#ffffff'} opacity={0.86} />);
    const lines = wrap(spec.footer, 29, 940, 700).slice(0, 2);
    stage().add(block(lines, W / 2, SAFE_BOTTOM - 49 - (lines.length * 35) / 2, 29, INK, {weight: 700, center: true, leading: 1.22}).node);
  }

  // ── confetti: last, so it sits on top of everything ──
  if (party !== null) {
    const b = createSignal(-1);
    const r = rng(23);
    const cols = [...C.accents, C.highlight, '#ffffff'];
    for (let i = 0; i < 90; i++) {
      const ang = -Math.PI / 2 + (r() - 0.5) * Math.PI * 1.4;
      const sp = 520 + r() * 1000;
      const vx = Math.cos(ang) * sp;
      const vy = Math.sin(ang) * sp;
      const w = 14 + r() * 16;
      const round = r() > 0.6;
      const spin = (r() - 0.5) * 1400;
      stage().add(
        <Rect
          size={[w, round ? w : w * 0.5]}
          radius={round ? w / 2 : 3}
          fill={cols[i % cols.length]}
          position={() => {
            const t = Math.max(0, b());
            const drag = 1 - Math.exp(-2.2 * t);
            return [540 + (vx * drag) / 2.2, 900 + (vy * drag) / 2.2 + 620 * t * t];
          }}
          rotation={() => spin * Math.max(0, b())}
          opacity={() => (b() < 0 ? 0 : clamp(1.9 - b() * 1.1))}
        />,
      );
    }
    at(party, (function* (): ThreadGenerator {
      b(0);
      yield* b(2.2, 2.2, linear);
    })());
  }

  // ── run: one clock signal drives everything that is a function of time; the timeline plays beside it ──
  yield time(TOTAL + 1, TOTAL + 1, linear);
  for (const g of tl) yield g;
  yield* waitFor(TOTAL);
});
