"""Generate one MP3 per conversation (10 calls + 5 radio channels) from the scripts.

- Parses each transcript, skipping *(EN: ...)* glosses, [CAD ...] lines and net-control
  '--' lines; strips inline [stage directions] from spoken text.
- One consistent Gradium voice per character / callsign (voicemap.py).
- Telephone colour for calls, comms colour for radio; procedural SFX beds
  (phone hiss + smoke-alarm for trapped callers, static + fireground + squelch for
  radio, approaching siren where relevant).
- Writes  emergency_calls/<stem>/<stem>.mp3  and  radio_comms/<CH>/<CH>.mp3

Usage:
  python generate.py calls           # all 10 calls
  python generate.py radio           # all 5 channels
  python generate.py all             # everything
  python generate.py one CALL-01     # a single call (by id) for testing
  python generate.py one CH1_OPS_DISPATCH
"""
import concurrent.futures as cf
import pathlib
import re
import sys

import audio_fx as fx
import voicemap as vm
from gradium import tts_wav, api_key

SCEN = pathlib.Path(__file__).parent.parent
CALLS = SCEN / "emergency_calls"
RADIO = SCEN / "radio_comms"

CALL_LINE = re.compile(r"^\[(\d\d:\d\d:\d\d)\]\s+(OPERATOR|CALLER):\s+(.*)$")
RADIO_LINE = re.compile(r"^\[([^\]]+)\]\s+\[(\d\d:\d\d:\d\d)\]:\s+(.*)$")
STAGE = re.compile(r"\[[^\]]*\]")          # inline [coughs], [background: ...]
GLOSS = re.compile(r"^\*\(EN:")
TRAPPED_CALLS = {"CALL-01", "CALL-02", "CALL-03", "CALL-04", "CALL-05"}
FAILURES = []                              # (label, text) segments that would not synth

_PUNCT = {"—": " - ", "–": " - ", "…": "...", "’": "'",
          "‘": "'", "“": '"', "”": '"', " ": " ",
          "«": '"', "»": '"', "‹": "'", "›": "'"}


def sanitize(text):
    for k, v in _PUNCT.items():
        text = text.replace(k, v)
    return re.sub(r"\s+", " ", text).strip()


def clean(text):
    text = STAGE.sub("", text)             # drop stage directions from spoken words
    text = sanitize(text).strip(" -")
    return text.strip()


def split_long(text, limit=380):
    """Split an over-long line into sentence-sized chunks for the TTS API."""
    if len(text) <= limit:
        return [text]
    parts, cur = [], ""
    for sent in re.split(r"(?<=[.!?])\s+", text):
        if len(cur) + len(sent) + 1 > limit and cur:
            parts.append(cur.strip())
            cur = ""
        cur += " " + sent
    if cur.strip():
        parts.append(cur.strip())
    return parts or [text[:limit]]


def has_siren(text):
    return bool(re.search(r"siren|blue light|engine", text, re.I))


# ------------------------------------------------------------------ parsing --
def parse_call(path):
    call_id = path.stem.split("_")[0]
    segs = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if GLOSS.match(line) or line.startswith("[CAD"):
            continue
        m = CALL_LINE.match(line)
        if not m:
            continue
        txt = clean(m.group(3))
        if not txt:
            continue
        v = vm.call_voice(call_id, m.group(2))
        segs.append({"voice": v, "text": txt, "siren": has_siren(m.group(3))})
    return call_id, segs


def parse_radio(path):
    segs, cur = [], None
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()
        if line.strip().startswith(">>") and cur is not None:
            cur["text"] += " " + clean(line.strip()[2:])
            continue
        m = RADIO_LINE.match(line.strip())
        if not m:
            continue
        if cur:
            segs.append(cur)
        cur = {"voice": vm.radio_voice(m.group(1)), "text": clean(m.group(3))}
    if cur:
        segs.append(cur)
    return [s for s in segs if s["text"]]


# --------------------------------------------------------------- synthesis --
def synth_all(segs, key):
    """TTS every segment (threaded, cached, resilient) -> attach decoded samples.

    A line the API refuses (persistent 5xx) is replaced by a short silence and
    recorded in FAILURES, so one bad line never aborts a whole conversation."""
    def work(s):
        chunks = []
        for piece in split_long(s["text"]):
            try:
                chunks.append(fx.decode(tts_wav(piece, s["voice"]["uid"], key=key)))
            except Exception as e:                       # noqa: BLE001
                FAILURES.append((s["voice"]["name"], piece[:70], str(e)[:60]))
                chunks.append(fx.silence(0.4))
        out = chunks[0]
        for c in chunks[1:]:
            out = fx.overlay(out, c, fx.duration(out) + 0.06)
        return out
    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        for s, samples in zip(segs, ex.map(work, segs)):
            s["samples"] = samples
    return segs


# ------------------------------------------------------------------- build --
def build_call(call_id, segs, key):
    synth_all(segs, key)
    gap = fx.silence(0.35)
    track = fx.silence(0.4)
    for s in segs:
        voiced = fx.treat(s["samples"], s["voice"]["treatment"])
        track = fx.overlay(track, voiced, fx.duration(track))
        track = fx.overlay(track, gap, fx.duration(track))
    total = fx.duration(track) + 0.4

    bed = fx.hiss(total, level=0.018)                       # phone-line hiss
    if call_id in TRAPPED_CALLS:
        bed = bed + fx.smoke_alarm(total, level=0.035)      # detector chirp
    # approaching engine in the final third (crews arrive during the call)
    s_len = min(total * 0.4, 14.0)
    bed = fx.overlay(bed, fx.siren(s_len, level=0.03, approach=True), total - s_len)
    track = fx.overlay(track, bed, 0.0)
    return track


def build_radio(segs, key):
    synth_all(segs, key)
    track = fx.silence(0.3)
    for s in segs:
        track = fx.overlay(track, fx.squelch_open(), fx.duration(track))
        voiced = fx.treat(s["samples"], "radio")
        track = fx.overlay(track, voiced, fx.duration(track))
        track = fx.overlay(track, fx.roger_beep(), fx.duration(track) + 0.02)
        track = fx.overlay(track, fx.silence(0.25), fx.duration(track))
    total = fx.duration(track) + 0.3
    bed = fx.hiss(total, level=0.012) + fx.fireground(total, level=0.02)
    bed = fx.overlay(bed, fx.siren(min(total, 10.0), level=0.02, approach=False), 0.5)
    return fx.overlay(track, bed, 0.0)


# -------------------------------------------------------------------- main --
def _conv_dir(path):
    """Conversation folder for a transcript in either layout (flat or script/)."""
    return path.parent.parent if path.parent.name == "script" else path.parent


def do_call(path, key):
    call_id, segs = parse_call(path)
    print(f"  {path.stem}: {len(segs)} lines …", flush=True)
    track = build_call(call_id, segs, key)
    out_dir = _conv_dir(path) if path.parent.name == "script" else (CALLS / path.stem)
    out_dir.mkdir(exist_ok=True)
    out = out_dir / f"{path.stem}.mp3"
    fx.export_mp3(track, out)
    print(f"    -> {out.name}  ({fx.duration(track):.0f}s)", flush=True)


def do_radio(path, key):
    ch_dir = _conv_dir(path)
    ch = ch_dir.name
    segs = parse_radio(path)
    print(f"  {ch}: {len(segs)} transmissions …", flush=True)
    track = build_radio(segs, key)
    out = ch_dir / f"{ch}.mp3"
    fx.export_mp3(track, out)
    print(f"    -> {out.name}  ({fx.duration(track):.0f}s)", flush=True)


def _find_calls():
    return sorted(CALLS.glob("CALL-*/script/*.md")) or sorted(CALLS.glob("CALL-*.md"))


def _find_radio():
    return sorted(RADIO.glob("*/script/transcript.md")) or sorted(RADIO.glob("*/transcript.md"))


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "all"
    key = api_key()
    call_files = _find_calls()
    radio_files = _find_radio()

    if target == "one":
        needle = sys.argv[2]
        for p in call_files:
            if p.stem.startswith(needle):
                return do_call(p, key)
        for p in radio_files:
            if _conv_dir(p).name.startswith(needle):
                return do_radio(p, key)
        raise SystemExit(f"no conversation matching {needle}")

    if target in ("calls", "all"):
        print("EMERGENCY CALLS")
        for p in call_files:
            do_call(p, key)
    if target in ("radio", "all"):
        print("RADIO CHANNELS")
        for p in radio_files:
            do_radio(p, key)

    if FAILURES:
        print(f"\n{len(FAILURES)} line(s) could not be synthesised (silenced):")
        for name, txt, err in FAILURES:
            print(f"  [{name}] {txt!r} — {err}")


if __name__ == "__main__":
    main()
