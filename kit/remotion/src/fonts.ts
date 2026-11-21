import {continueRender, delayRender, staticFile} from 'remotion';

// Load the font from public/fonts and hold the render until it is ready.
// Without delayRender the first frames can be captured in a fallback font.
// To change the font: drop the .ttf files in public/fonts, list them here, and change FONT in util.ts.
const weights: [string, string][] = [
  ['Mukta-SemiBold.ttf', '600'],
  ['Mukta-Bold.ttf', '700'],
  ['Mukta-ExtraBold.ttf', '800'],
];

if (typeof document !== 'undefined') {
  const handle = delayRender('Loading fonts');
  Promise.all(
    weights.map(([file, weight]) => {
      const face = new FontFace('Mukta', `url(${staticFile(`fonts/${file}`)})`, {weight});
      return face.load().then((f) => document.fonts.add(f));
    }),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      throw err;
    });
}
