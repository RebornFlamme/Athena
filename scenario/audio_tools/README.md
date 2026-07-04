# audio_tools — scripts → MP3 (Gradium TTS + procedural SFX)

Turns every scenario transcript into a single MP3 per conversation, with a
**consistent voice per character** and **scenario-coherent sound effects**.

> **API key** — never committed. Put your Gradium key in `key.local` (gitignored)
> or set `GRADIUM_API_KEY`. The key that was shared in chat should be rotated after
> the event, since it appeared in plaintext there.

## What it does

- **Voices** (`voicemap.py`): each character and each radio callsign is bound to one
  real Gradium voice, gender-appropriate and distinct within a dialogue. Emergency
  calls use OPERATOR / CALLER labels mapped per file to the real operator/caller.
  No Arabic voice exists in Gradium, so Fatima (CALL-04, darija) uses a French female
  voice; Rosa (CALL-09) uses a Spanish female voice; the clumsy-Spanish operator in
  CALL-09 reads Spanish with an English voice, which reproduces the non-native accent.
- **Parsing** (`generate.py`): skips `*(EN: …)*` glosses, `[CAD …]` lines and radio
  net-control `--` lines; strips inline `[stage directions]`; joins radio `>>`
  continuations; normalises punctuation and splits over-long lines for the API.
- **Colour & SFX** (`audio_fx.py`, all synthesised with numpy — no external assets):
  - calls: operator = clean headset, caller = telephone band-pass; bed = phone-line
    hiss + (for trapped callers) an intermittent smoke-detector chirp + an
    approaching two-tone siren in the final third.
  - radio: comms band-pass + soft-clip, squelch burst + roger-beep around each
    transmission, bed = static + low fireground ambience + a distant siren.
- **Output**: `emergency_calls/<call>/<call>.mp3` and `radio_comms/<CH>/<CH>.mp3`
  (the scripts sit beside them in a `script/` subfolder after reorganisation).

## Run

```
pip install soundfile scipy numpy          # (ffmpeg already on PATH)
python generate.py one CALL-01             # test a single conversation
python generate.py calls                   # all 10 emergency calls
python generate.py radio                   # all 5 radio channels
python generate.py all                     # everything
```

Results are **cached** per (voice, text) in `.cache/` (gitignored), so re-runs and
interruptions are cheap and resumable — only new/changed lines hit the API.

## Files

| File | Role |
|---|---|
| `gradium.py` | Gradium REST client + on-disk cache + retry/backoff |
| `voicemap.py` | character / callsign → Gradium voice uid |
| `audio_fx.py` | decode, telephone/radio EQ, procedural SFX, mix, MP3 export |
| `generate.py` | parse transcripts → synthesise → mix → write MP3 |
| `key.local` | **gitignored** API key |
| `.cache/` | **gitignored** per-line WAV cache |

Voices catalogue: 300 Gradium voices (133 en / 47 fr / 35 es / 65 de / 20 pt),
fetched 2026. See `voicemap.CHARACTERS` for the exact voice bound to each person.
