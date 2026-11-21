---
name: revideo-video
description: Turn an idea into a narrated vertical short video (1080x1920 MP4) with Revideo, the MIT-licensed canvas video framework. Writes the script, generates the voice and word timings with ElevenLabs, and renders a starter project with five scene types, word-by-word captions and a lip-synced mascot, about 3x faster than real time. Use when the user says "/revideo-video", "make a video with Revideo", or wants a fast or licence-free render of a Short / Reel / TikTok. For the HTML/CSS-based engine use remotion-video.
---

# revideo-video

You take the user's idea and hand back an MP4. The kit next to this file does the heavy lifting: `kit/new-video.sh` creates a project, `narrate.py` turns a script into audio plus timings, and the Revideo project renders it.

If there is no `kit` folder beside this file, the skill was copied without it. Clone https://github.com/anujkapoor-arch/video-skills and use its `kit` folder.

## Before you start

Check these, and stop with a clear message if one is missing:

- `node --version`, `python3 --version`, `ffmpeg -version`. The kit was tested on Node 24, Python 3 and ffmpeg 8.
- `ELEVENLABS_API_KEY` in the environment, or the user ready to put it in the project's `.env`. There is no silent or free mode. Never print the key or commit it.

Tell the user three things about Revideo once, before installing:

- It is MIT licensed, with no seat or company pricing.
- It is pre-1.0 (the kit pins 0.11.0) and its docs are thin. The starter already works around the bugs we hit.
- Its installer writes a random id to `~/.revideo/id.txt`, and each render reports a "render started" event to PostHog. The kit's `src/render.ts` sets `DISABLE_TELEMETRY=true`, so renders started with `npm run render` send nothing.

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
<this skill's folder>/kit/new-video.sh revideo <new-folder>
cd <new-folder>
npm install
```

`npm install` takes about a minute and also downloads Chrome for Puppeteer (about 575 MB) into `~/.cache/puppeteer`.

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

### 4. Check each scene before trusting the full render

Revideo has no single-frame command, but a short range renders in 2 to 5 seconds:

```sh
npm run render -- 10 14 clip                                  # seconds 10 to 14 -> out/clip.mp4
ffmpeg -v error -y -ss 3 -i out/clip.mp4 -frames:v 1 out/check.png   # one frame, 3 s into the clip
```

Do this for every scene, about a second after its last cue, and look at each frame. Check that text fits the card, nothing overlaps the captions or the mascot, and nothing important sits below y = 1620 (the Shorts / Reels UI covers it). A full render is fast enough that you can also render everything and pull frames from `out/video.mp4`.

### 5. Render

```sh
npm run render                # -> out/video.mp4, audio included
WORKERS=2 npm run render      # split the frames across two browsers
VITE_DEBUG_LOGS=1 npm run render   # print browser errors as text, not "JSHandle@object"
```

`npm start` opens Revideo's editor with a timeline. We have not tested it with this kit.

### 6. Report

Run `ffprobe` on the file and tell the user the length, the size and where it is. Say what you checked (frames) and what you did not (you can't hear the audio or watch motion). Ask them to watch it once with sound.

## Changing things

| To change | Edit |
|---|---|
| Colours, channel name, footer, captions on or off, mascot on or off | `script.json`, then `python3 narrate.py` (free, the audio is cached) |
| Voice | `voice.id` in `script.json` or `ELEVENLABS_VOICE_ID`. A new voice re-bills every line. |
| Font | Put `.ttf` files in `public/fonts`, list them in `src/project.ts`, change `FONT` in `src/spec.ts` |
| Layout of a scene type | Its builder function in `src/scene.tsx` |
| Header, card, captions, mascot, bubble, confetti | The matching section of `src/scene.tsx` |

### Add a scene kind

1. Write a builder in `src/scene.tsx` next to `hook`, `points`, `stat`, `bars` and `cta`. Start with `const g = group(s)`, add nodes to `g`, and schedule animations with `at(seconds, ...)`.
2. Add it to the `build` map below the builders and to the `kind` union in `src/spec.ts`.
3. Add it to `KINDS` in `narrate.py` with its required fields.

### Swap the mascot

Draw the character from `Circle`, `Rect`, `Line` and `Path` nodes, as the starter does. Keep five things as functions of the `time` signal: mouth size from `open()`, eye `scale` from `blink()`, pupil position, brow offset, and a head node that rotates.

## Rules that keep Revideo renders correct

Each of these cost a debugging session. The starter follows all of them.

1. Never give `<Txt>` a function for `text`. It renders nothing and logs "The scene is not available in the current context". For text that changes (a count-up, a bubble), call `.text(value)` by hand inside a `tween` or a generator.
2. Don't use the `<SVG>` node for anything you animate. It flattens `<g>` groups, drops their ids, and builds its shapes lazily, so parts come out invisible or unreachable.
3. Wrap text yourself. `wrap()` and `fit()` in `src/spec.ts` measure with a canvas, and `block()` in `scene.tsx` adds one `<Txt>` per line. Heights are then known before layout.
4. Fonts must be registered before anything measures text. `src/project.ts` awaits the `FontFace` loads, then imports the scene.
5. Don't use `shadowBlur`. It takes a slow path. Draw a darker copy of the shape a few pixels lower.
6. Coordinates are centre-origin. The starter puts everything inside one `stage` node shifted to the top-left, so positions read as normal pixels.
7. z-order is the order nodes are added. Add the footer and the confetti last.
8. Time is a generator: "wait for this word, then spring this in" is `at(word.t, pop(node))`. For things that are a pure function of time (mouth, blink, drifting shapes) read the `time` signal.
9. To reach frame N Revideo plays the timeline from 0, so there is no single-frame render. Use a short range: 4 seconds took 2.2 s here.
10. For anything with many parts (captions, a dense chart), draw with raw canvas calls in the `Painter` node. One paint function is easier to keep right than hundreds of nodes.

One warning prints on every render: "Tried to access an asynchronous property before the node was ready". The output is correct. We have not found which node causes it.

## Numbers from our test machine (Apple M2, 8 GB RAM)

- 25 s video: 8 to 10 s to render with one worker, 6.2 s with two. The file is 11 MB (Remotion's is 4.9 MB for the same video); re-encode with ffmpeg if size matters.
- `node_modules`: about 310 MB, plus 575 MB of Chrome in `~/.cache/puppeteer`.
