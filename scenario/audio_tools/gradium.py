"""Gradium TTS client with an on-disk cache (resumable, avoids re-billing).

API key resolution order:
  1. env var GRADIUM_API_KEY
  2. key.local next to this file (gitignored)

Returns raw WAV bytes (48 kHz) from api.gradium.ai. See ../../Gradium TTS/README.md.
"""
import hashlib
import json
import os
import pathlib
import time
import urllib.error
import urllib.request

HERE = pathlib.Path(__file__).parent
CACHE = HERE / ".cache"
API_BASE = "https://api.gradium.ai/api"
TTS_URL = API_BASE + "/post/speech/tts"
VOICES_URL = API_BASE + "/voices/?include_catalog=true&limit=300"


def api_key():
    k = os.environ.get("GRADIUM_API_KEY")
    if k:
        return k.strip()
    f = HERE / "key.local"
    if f.exists():
        return f.read_text(encoding="utf-8").strip()
    raise SystemExit("No Gradium API key: set GRADIUM_API_KEY or create audio_tools/key.local")


def _request(url, key, payload=None, timeout=180):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        url, data=data,
        headers={"x-api-key": key, "Content-Type": "application/json"},
        method="POST" if payload is not None else "GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def fetch_voices(key=None):
    key = key or api_key()
    return json.loads(_request(VOICES_URL, key, timeout=40).decode("utf-8"))


def tts_wav(text, voice_uid, key=None, retries=4):
    """WAV bytes for `text` in voice `voice_uid`, cached by (voice, text)."""
    CACHE.mkdir(exist_ok=True)
    h = hashlib.sha1(f"{voice_uid}\x00{text}".encode("utf-8")).hexdigest()
    cached = CACHE / f"{h}.wav"
    if cached.exists() and cached.stat().st_size > 44:
        return cached.read_bytes()
    key = key or api_key()
    payload = {"text": text, "voice_id": voice_uid,
               "output_format": "wav", "only_audio": True}
    last = None
    for attempt in range(retries):
        try:
            wav = _request(TTS_URL, key, payload)
            if len(wav) < 44:
                raise RuntimeError("empty audio")
            cached.write_bytes(wav)
            return wav
        except urllib.error.HTTPError as e:
            last = e
            if e.code == 429 or e.code >= 500:
                time.sleep(2 * (attempt + 1))
                continue
            body = ""
            try:
                body = e.read().decode("utf-8", "replace")[:200]
            except Exception:
                pass
            raise RuntimeError(f"Gradium HTTP {e.code}: {body}") from e
        except (urllib.error.URLError, TimeoutError, RuntimeError) as e:
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Gradium TTS failed after {retries} tries: {last}")
