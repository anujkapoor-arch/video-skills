#!/usr/bin/env python3
"""script.json -> narration.wav + spec.json (scene timings and a time for every spoken word).

  python3 narrate.py                 # reads script.json, writes public/narration.wav and src/spec.json
  python3 narrate.py my_script.json  # another script file
  python3 narrate.py --check         # validate the script and print the character count; no API call

Needs ELEVENLABS_API_KEY (environment, or a .env file next to this script) and ffmpeg on PATH.
Every line is cached in .tts-cache/ by voice + speed + text, so a re-run only pays for lines you changed.
No Python packages to install.
"""
import argparse
import base64
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, ".tts-cache")
DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb"   # "George", an ElevenLabs default voice. Swap for any voice id on your account.
DEFAULT_MODEL = "eleven_multilingual_v2"
LEAD = 0.15    # silence before each scene's line, so a cut never clips the first word
GAP = 0.45     # shortest pause after a line before the next scene starts

KINDS = {
    # kind: (required fields, most items that fit on the card)
    "hook": (["title"], 0),
    "points": (["items"], 4),
    "stat": (["value", "label"], 0),
    "bars": (["items"], 6),
    "cta": (["items"], 3),
}


def die(msg):
    sys.exit(f"narrate.py: {msg}")


def load_env():
    """Read KEY=value lines from a .env beside this script (does not override the real environment)."""
    path = os.path.join(HERE, ".env")
    if not os.path.exists(path):
        return
    for line in open(path, encoding="utf-8"):
        m = re.match(r"\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$", line)
        if m and not line.lstrip().startswith("#"):
            os.environ.setdefault(m.group(1), m.group(2).strip("'\""))


def validate(script):
    scenes = script.get("scenes")
    if not scenes:
        die("script has no scenes")
    for n, s in enumerate(scenes, 1):
        where = f"scene {n} ({s.get('kind')})"
        if s.get("kind") not in KINDS:
            die(f"{where}: kind must be one of {', '.join(KINDS)}")
        if not (s.get("say") or "").strip():
            die(f"{where}: 'say' is empty. Every scene needs a spoken line.")
        need, most = KINDS[s["kind"]]
        for f in need:
            if s.get(f) in (None, "", []):
                die(f"{where}: missing '{f}'")
        if most and len(s["items"]) > most:
            die(f"{where}: {len(s['items'])} items, the card fits {most}. Split it into two scenes.")


def tts(text, voice):
    """ElevenLabs mp3 + per-character timings for one line, cached."""
    os.makedirs(CACHE, exist_ok=True)
    tag = f"{voice['id']}|{voice['model']}|{voice['speed']}|{text}"
    stem = os.path.join(CACHE, hashlib.sha1(tag.encode()).hexdigest()[:16])
    if not (os.path.exists(stem + ".mp3") and os.path.exists(stem + ".json")):
        key = os.environ.get("ELEVENLABS_API_KEY")
        if not key:
            die("ELEVENLABS_API_KEY is not set. Export it, or put ELEVENLABS_API_KEY=... in a .env file next to narrate.py.")
        body = json.dumps({
            "text": text,
            "model_id": voice["model"],
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0,
                               "use_speaker_boost": True, "speed": voice["speed"]},
        }).encode()
        req = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice['id']}/with-timestamps?output_format=mp3_44100_128",
            data=body, method="POST", headers={"xi-api-key": key, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                res = json.loads(r.read())
        except urllib.error.HTTPError as e:
            die(f"ElevenLabs returned {e.code}: {e.read().decode(errors='replace')[:400]}")
        open(stem + ".mp3", "wb").write(base64.b64decode(res["audio_base64"]))
        json.dump(res.get("alignment") or {}, open(stem + ".json", "w"), ensure_ascii=False)
    return stem + ".mp3", json.load(open(stem + ".json"))


def duration(path):
    return float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).strip())


def words_of(align):
    """[{word, t}] from ElevenLabs character timings. t is seconds from the start of the scene."""
    chars = align.get("characters") or []
    starts = align.get("character_start_times_seconds") or []
    out, cur, t0 = [], "", None
    for ch, t in zip(chars, starts):
        if ch.isspace():
            if cur:
                out.append({"word": cur, "t": round(t0 + LEAD, 2)})
            cur, t0 = "", None
        else:
            if not cur:
                t0 = t
            cur += ch
    if cur:
        out.append({"word": cur, "t": round(t0 + LEAD, 2)})
    return out


def norm(w):
    return "".join(c for c in w.lower() if c.isalnum())


def cue(at, words, where):
    """Seconds (within the scene) when the cue word is spoken. 'price#2' means its second occurrence."""
    word, _, nth = at.partition("#")
    want, nth = norm(word), int(nth or 1)
    hits = [w for w in words if norm(w["word"]) == want] or [w for w in words if norm(w["word"]).startswith(want)]
    if not want or len(hits) < nth:
        die(f"{where}: cue word '{at}' is not in the spoken line. Words I heard: {' '.join(w['word'] for w in words)}")
    return hits[nth - 1]["t"]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("script", nargs="?", default=os.path.join(HERE, "script.json"))
    ap.add_argument("--spec", default=os.path.join(HERE, "src", "spec.json"))
    ap.add_argument("--audio", default=os.path.join(HERE, "public", "narration.wav"))
    ap.add_argument("--check", action="store_true", help="validate and count characters only")
    a = ap.parse_args()

    load_env()
    try:
        script = json.load(open(a.script, encoding="utf-8"))
    except (OSError, ValueError) as e:
        die(f"cannot read {a.script}: {e}")
    validate(script)
    v = script.get("voice") or {}
    voice = {"id": os.environ.get("ELEVENLABS_VOICE_ID") or v.get("id") or DEFAULT_VOICE,
             "model": v.get("model") or DEFAULT_MODEL,
             "speed": v.get("speed", 1.1)}
    chars = sum(len(s["say"]) for s in script["scenes"])
    if a.check:
        print(f"script OK: {len(script['scenes'])} scenes, {chars} characters to speak (ElevenLabs bills per character)")
        return

    os.makedirs(os.path.dirname(a.audio), exist_ok=True)
    os.makedirs(os.path.dirname(a.spec), exist_ok=True)
    parts, start = [], 0.0
    for n, s in enumerate(script["scenes"], 1):
        where = f"scene {n} ({s['kind']})"
        mp3, align = tts(s["say"].strip(), voice)
        s["talk"] = round(duration(mp3), 2)
        s["dur"] = round(max(float(s.get("min", 0)), s["talk"] + GAP), 2)
        s["start"] = round(start, 2)
        s["words"] = words_of(align)
        if not s["words"]:
            die(f"{where}: ElevenLabs returned no timings for this line")
        # every visual beat gets an absolute time `t`: on its cue word, or spread evenly through the line
        items = s.get("items") or []
        for i, it in enumerate(items):
            rel = cue(it["at"], s["words"], where) if it.get("at") else LEAD + 0.25 + i * max(0.0, s["talk"] - 0.6) / len(items)
            it["t"] = round(s["start"] + rel, 2)
        if s.get("at"):
            s["t"] = round(s["start"] + cue(s["at"], s["words"], where), 2)
        elif s["kind"] == "stat":
            s["t"] = round(s["start"] + 0.35, 2)
        wav = os.path.join(CACHE, f"_part{n}.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp3, "-af", f"adelay={int(LEAD * 1000)}:all=1,apad",
                        "-t", str(s["dur"]), "-ar", "44100", "-ac", "2", wav], check=True)
        parts.append(wav)
        start += s["dur"]

    lst = os.path.join(CACHE, "_parts.txt")
    open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", a.audio],
                   check=True)
    for p in parts + [lst]:
        os.remove(p)

    spec = {"width": 1080, "height": 1920, "fps": 30, **script, "total": round(start, 2)}
    json.dump(spec, open(a.spec, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{'scene':<10}{'start':>7}{'length':>8}  line")
    for s in spec["scenes"]:
        print(f"{s['kind']:<10}{s['start']:>7.2f}{s['dur']:>8.2f}  {s['say'][:60]}")
    print(f"total {spec['total']} s, {chars} characters -> {os.path.relpath(a.audio)} + {os.path.relpath(a.spec)}")


if __name__ == "__main__":
    main()
