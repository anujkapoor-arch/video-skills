// Revideo sends an anonymous "render started" event to PostHog on every render unless this is set.
process.env.DISABLE_TELEMETRY ??= 'true';

import {renderVideo} from '@revideo/renderer';

// usage: tsx src/render.ts [fromSeconds toSeconds] [outName]
//   npm run render             full video -> out/video.mp4
//   npm run render -- 4 9 clip seconds 4 to 9 only -> out/clip.mp4 (fast way to check one scene)
//   WORKERS=2 npm run render   split the frames across 2 headless Chromes
const [from, to, name] = process.argv.slice(2);
const t0 = Date.now();
const file = await renderVideo({
  projectFile: './src/project.ts',
  settings: {
    outFile: `${name ?? 'video'}.mp4` as `${string}.mp4`,
    outDir: './out',
    workers: Number(process.env.WORKERS ?? 1),
    logProgress: true,
    ffmpeg: process.env.FFMPEG_PATH
      ? {ffmpegPath: process.env.FFMPEG_PATH, ffprobePath: process.env.FFPROBE_PATH}
      : undefined,
    projectSettings: from !== undefined && to !== undefined ? {range: [Number(from), Number(to)]} : {},
  },
});
console.log(`rendered ${file} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(0);
