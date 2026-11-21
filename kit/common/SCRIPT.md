# script.json reference

`script.json` is the only file you write for a new video. `narrate.py` reads it, calls ElevenLabs, and writes `src/spec.json` (the same content plus timings) and `public/narration.wav`. The renderer reads `spec.json` and never calls an API.

## Top level

| Field | Type | What it does |
|---|---|---|
| `channel` | text | Top-left header. Leave out to hide it. |
| `tag` | text | Top-right header: a date, an episode number. |
| `footer` | text | Small print above the bottom safe line, two lines at most. Empty string hides it. With a footer the mascot is drawn smaller so it stays clear. |
| `captions` | true / false | Word-by-word captions under the card. Default true. |
| `mascot` | true / false | The talking character and its speech bubbles. Default true. |
| `voice.id` | text | ElevenLabs voice id. Empty uses the default voice. The `ELEVENLABS_VOICE_ID` environment variable overrides it. |
| `voice.speed` | 0.7 to 1.2 | Speaking rate. Default 1.1. Short videos want a brisk read. |
| `voice.model` | text | Default `eleven_multilingual_v2`. |
| `theme.background` | 2 or 3 hex colours | Background gradient, top-left to bottom-right. |
| `theme.ink` | hex | Text colour, and the colour of the caption and bubble pills. |
| `theme.accents` | 3 hex colours | Chips, rows, bars and pills cycle through these. The first one is the mascot's body. |
| `theme.highlight` | hex | The current caption word. |
| `scenes` | list | 4 to 7 scenes works best. See below. |

Use 6-digit hex colours (`#1b1035`). The header text turns white by itself on a dark background.

The video is 1080x1920 at 30 fps. The layout is built for that size; another size means editing the layout code.

## Every scene

| Field | What it does |
|---|---|
| `kind` | `hook`, `points`, `stat`, `bars` or `cta`. |
| `say` | The spoken line. One or two sentences. Required. The scene lasts as long as the line takes plus a 0.45 s pause. |
| `bubble` | Optional. Two or three words in the mascot's speech bubble at the start of the scene. |
| `min` | Optional. Shortest length for the scene, in seconds. |

## Cue words (`at`)

A cue ties a visual to a word in `say`, so the row, bar or pill appears as the word is spoken.

- `"at": "shrink"` fires on the first word that starts with "shrink". Case and punctuation are ignored.
- `"at": "stop#2"` fires on the second "stop".
- The word has to be in that scene's `say`. If it isn't, `narrate.py` stops and prints the words it heard.
- Leave `at` out and the items are spread evenly through the line.
- Write numbers in `say` the way they are spoken ("sixty six"), then cue on that word. ElevenLabs returns the text as you wrote it.

## Scene kinds

### hook
The opening card.

| Field | |
|---|---|
| `title` | Required. The size drops as the title gets longer; under 20 characters reads best. |
| `subtitle` | Optional grey line under the title. |
| `chip` | Optional small coloured label above the title. |

### points
A numbered list. Each row lands on its cue and stays lit until the next one.

| Field | |
|---|---|
| `title` | Optional heading. |
| `items` | 1 to 4 rows: `{"text": "...", "at": "word"}`. Keep each under about 45 characters. |

### stat
One big number that counts up.

| Field | |
|---|---|
| `label` | Required. What the number is. |
| `value` | Required. The number. |
| `prefix`, `suffix` | Optional. A one-character suffix such as `%` sits beside the number. A longer one such as ` days` goes on its own line underneath. |
| `decimals` | Optional. Default 0. |
| `note` | Optional pill under the number. Put the source here. |
| `at` | Optional cue word for the start of the count-up. |

### bars
A bar chart.

| Field | |
|---|---|
| `title` | Optional heading. |
| `items` | 1 to 6 bars: `{"label": "2024", "value": 12, "at": "word"}`. Bars are scaled to the largest value. |
| `unit` | Optional text after each value, such as `%` or ` h`. |
| `decimals` | Optional. Default 0. |

### cta
The closing card. If the last scene is a `cta`, confetti fires on its last item and the mascot cheers.

| Field | |
|---|---|
| `title` | Optional heading. |
| `items` | 1 to 3 pills: `{"text": "Follow", "icon": "play", "at": "follow"}`. Icons: `heart`, `chat`, `play`, `star`, `check`. |

## What narrate.py adds

In `spec.json` each scene gains `start`, `dur`, `talk` and `words` (a time for every spoken word), each item gains `t` (its absolute time in seconds), and the top level gains `total`. Don't edit `spec.json` by hand. Change `script.json` and run `narrate.py` again; lines you didn't change come from the cache and cost nothing.
