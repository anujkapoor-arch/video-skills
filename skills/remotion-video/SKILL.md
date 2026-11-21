---
name: remotion-video
description: Turn an idea into a narrated vertical short video (1080x1920 MP4) with Remotion. Writes the script, generates the voice and word timings with ElevenLabs, and renders a starter project with five scene types, word-by-word captions and a lip-synced mascot. Use when the user says "/remotion-video", "make a video about X", "make a Short / Reel / TikTok", "explainer video", or asks for a Remotion video. For the faster canvas-based engine use revideo-video.
---

# remotion-video

You take the user's idea and hand back an MP4. The kit next to this file does the heavy lifting: `kit/new-video.sh` creates a project, `narrate.py` turns a script into audio plus timings, and the Remotion project renders it.

If there is no `kit` folder beside this file, the skill was copied without it. Clone https://github.com/anujkapoor-arch/video-skills and use its `kit` folder.

## Before you start

Check these, and stop with a clear message if one is missing:

- `node --version`, `python3 --version`, `ffmpeg -version`. The kit was tested on Node 24, Python 3 and ffmpeg 8.
- `ELEVENLABS_API_KEY` in the environment, or the user ready to put it in the project's `.env`. There is no silent or free mode. Never print the key or commit it.
- Remotion's licence. It is free for individuals and for companies with up to 3 employees. A larger company needs a paid Company Licence (remotion.dev/docs/license). Tell the user once. If that rules Remotion out, use the `revideo-video` skill, which is MIT.

## Steps

### 1. Get the idea down to a script

Ask only for what you can't infer: the topic, who it's for, the channel name. Then write the script yourself.

- 4 to 7 scenes, 20 to 45 seconds in total. People speak about 2.5 words a second.
- Open with a `hook`, close with a `cta`. Use `points`, `stat` and `bars` in between.
- Each `say` is one or two short sentences, written for the ear. Spell numbers as words.
- Every number on screen needs a source the user gave you or one you can name. If you don't have one, ask. Never invent a statistic.
- Pick a cue word (`at`) for each item so visuals land on the spoken word.

The full field list is in `kit/common/SCRIPT.md`. Read it before writing the script.

### 2. Create the project

```sh
<this skill's folder>/kit/new-video.sh remotion <new-folder>
cd <new-folder>
npm install
```

`npm install` takes about 20 seconds. The first render also downloads Chrome Headless Shell (about 470 MB) into `node_modules`.

### 3. Write script.json, check it, then pay for the voice

Replace the example `script.json` with the user's script, then:

```sh
python3 narrate.py --check    # validates and prints the character count, no API call
```

Show the user the spoken lines and the character count, and get a yes before the next command. ElevenLabs bills per character.

```sh
python3 narrate.py            # writes public/narration.wav and src/spec.json
```

It prints each scene's start and length. Lines are cached in `.tts-cache/`, so re-running after an edit only pays for the lines that changed.

### 4. Check stills before a full render

A still takes about 4 seconds; a full render takes about as long as the video.

```sh
npx remotion still src/index.ts Video out/check.png --frame=150
```

Frame = seconds x 30. Render one still inside every scene, about a second after its last cue, and look at each one. Check that text fits the card, nothing overlaps the captions or the mascot, and nothing important sits below y = 1620 (the Shorts / Reels UI covers it).

### 5. Render

```sh
npm run render                # -> out/video.mp4
npm run studio                # optional: preview with a timeline and hot reload
```

### 6. Report

Run `ffprobe` on the file and tell the user the length, the size and where it is. Say what you checked (stills) and what you did not (you can't hear the audio or watch motion). Ask them to watch it once with sound.

## Changing things

| To change | Edit |
|---|---|
| Colours, channel name, footer, captions on or off, mascot on or off | `script.json`, then `python3 narrate.py` (free, the audio is cached) |
| Voice | `voice.id` in `script.json` or `ELEVENLABS_VOICE_ID`. A new voice re-bills every line. |
| Font | Put `.ttf` files in `public/fonts`, list them in `src/fonts.ts`, change `FONT` in `src/util.ts` |
| Layout of a scene type | Its component in `src/scenes.tsx` |
| Header, card, captions, bubble, confetti | `src/Video.tsx` |
| The mascot | `src/Mascot.tsx` |

### Add a scene kind

1. Write a component in `src/scenes.tsx` that takes `{s: Scene}` and wraps its content in `<Layer s={s}>`.
2. Add it to `KINDS` at the bottom of that file and to the `kind` union in `src/util.ts`.
3. Add it to `KINDS` in `narrate.py` with its required fields.

### Swap the mascot

Port the character's SVG into `src/Mascot.tsx` as JSX. Don't load the `.svg` file. Keep five things driven per frame: mouth height from `open`, eye `scaleY` from `blink`, pupil offset, brow offset, and a head group that tilts. If the SVG changes later, the port has to be redone.

## Rules that keep Remotion renders correct

- Everything on screen is a function of the current frame. No `useState`, no CSS transitions, no `setTimeout`, no `Math.random()`. Remotion renders frames in parallel and out of order, so anything with memory breaks. Use `random(seed)` from `remotion`.
- All timing comes from `spec.json`. Never hard-code a time in seconds. Read `s.start`, `item.t` or a word's `t`, so a new narration re-times the video without code changes.
- Fonts load in `src/fonts.ts` behind `delayRender`. Without it a frame can be captured before the font is ready.
- Files the browser loads at render time (audio, fonts, images) live in `public/` and are referenced with `staticFile()`.
- HTML wraps long text but nothing shrinks it. The starter picks font sizes from the character count. If you add text, do the same or it will overflow the card.
- A spring is `spring({frame: frame - at * fps, fps, config})`. The `pop()` helper in `util.ts` wraps it.
- The lip sync comes from the word timings (`mouthOpen` in `util.ts`), with no audio analysis.
- The video length rounds up to a whole frame, so the MP4 can be up to 1/30 s longer than `spec.total`.

## Numbers from our test machine (Apple M2, 8 GB RAM)

- 25 s video: 26.5 s to render, 4.9 MB.
- `node_modules`: 240 MB after install, about 950 MB after the first render (Chrome Headless Shell plus the webpack cache).
