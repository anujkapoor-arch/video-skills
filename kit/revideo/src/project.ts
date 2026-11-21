import {makeProject} from '@revideo/core';
import raw from './spec.json';

if (import.meta.env.VITE_DEBUG_LOGS) {
  // Puppeteer prints logged objects as "JSHandle@object"; flatten them to strings while debugging.
  for (const k of ['log', 'warn', 'error'] as const) {
    const orig = console[k].bind(console);
    console[k] = (...a: unknown[]) =>
      orig(a.map(v => (typeof v === 'string' ? v : v instanceof Error ? v.stack : JSON.stringify(v)?.slice(0, 600))).join(' '));
  }
}

// Register the font before any text is measured. The top-level await holds the renderer until it is loaded,
// and scene.tsx is imported only after that, because spec.ts measures text when it loads.
// To change the font: drop the .ttf files in public/fonts, list them here, and change FONT in spec.ts.
const faces: [string, string][] = [
  ['600', 'SemiBold'],
  ['700', 'Bold'],
  ['800', 'ExtraBold'],
];
await Promise.all(
  faces.map(async ([weight, name]) => {
    const face = new FontFace('Mukta', `url(/fonts/Mukta-${name}.ttf)`, {weight});
    document.fonts.add(await face.load());
  }),
);
const {default: scene} = await import('./scene');

export default makeProject({
  name: 'video',
  scenes: [scene],
  settings: {
    shared: {
      size: {x: raw.width, y: raw.height},
      background: '#ffffff',
    },
    rendering: {fps: raw.fps},
    preview: {fps: raw.fps},
  },
});
