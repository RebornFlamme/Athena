"""Audio processing for the scenario voices: decode, telephone/radio EQ, procedural
sound-effects (all synthesised with numpy — no external assets), mixing and export.

Everything runs at SR = 44100, mono, float32 in [-1, 1].
"""
import io
import math
import subprocess
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, resample_poly

SR = 44100
rng = np.random.default_rng(1403)  # fixed seed -> reproducible noise beds


# ----------------------------------------------------------------- decode ----
def decode(wav_bytes):
    data, sr = sf.read(io.BytesIO(wav_bytes), dtype="float32", always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)
    if data.size == 0:                       # Gradium occasionally returns 0 frames
        return silence(0.25)
    if sr != SR:
        g = math.gcd(int(sr), SR)
        data = resample_poly(data, SR // g, sr // g).astype("float32")
    return data.astype("float32")


# ------------------------------------------------------------- filters -------
def _bandpass(x, lo, hi, order=4):
    if x.size == 0:
        return x
    sos = butter(order, [lo / (SR / 2), min(hi, SR / 2 - 1) / (SR / 2)],
                 btype="band", output="sos")
    return sosfilt(sos, x).astype("float32")


def _highpass(x, cut, order=2):
    sos = butter(order, cut / (SR / 2), btype="high", output="sos")
    return sosfilt(sos, x).astype("float32")


def _lowpass(x, cut, order=4):
    sos = butter(order, min(cut, SR / 2 - 1) / (SR / 2), btype="low", output="sos")
    return sosfilt(sos, x).astype("float32")


def _soft_clip(x, k):
    return (np.tanh(k * x) / math.tanh(k)).astype("float32")


def peak_normalize(x, peak_db=-1.0):
    if x.size == 0:
        return x
    p = np.max(np.abs(x)) or 1.0
    return (x * (10 ** (peak_db / 20) / p)).astype("float32")


def _rms_normalize(x, rms_db=-20.0):
    if x.size == 0:
        return x
    r = np.sqrt(np.mean(x ** 2)) or 1e-6
    return (x * (10 ** (rms_db / 20) / r)).astype("float32")


# ----------------------------------------------------- voice treatments ------
def treat(x, kind):
    """Apply the per-channel colour: 'operator' (clean headset), 'caller'
    (phone line), 'radio' (comms)."""
    if x.size < 16:
        return silence(0.1)
    x = _rms_normalize(x, -20.5)
    if kind == "operator":
        y = _highpass(x, 110)
        y = _lowpass(y, 8000)
    elif kind == "caller":
        y = _bandpass(x, 320, 3200, order=6)
        y = _soft_clip(y, 1.4)
        y = y * 1.05
    elif kind == "radio":
        y = _bandpass(x, 350, 2900, order=6)
        y = _soft_clip(y, 2.2)                 # comms distortion
        y = y + 0.006 * rng.standard_normal(len(y)).astype("float32")  # floor hiss
    else:
        y = x
    return _rms_normalize(y, -20.0)


# -------------------------------------------------------------- SFX ----------
def _env(n, attack, release):
    e = np.ones(n, dtype="float32")
    a = min(int(attack * SR), n // 2)
    r = min(int(release * SR), n // 2)
    if a:
        e[:a] = np.linspace(0, 1, a)
    if r:
        e[-r:] = np.linspace(1, 0, r)
    return e


def silence(dur):
    return np.zeros(int(dur * SR), dtype="float32")


def hiss(dur, level=0.02):
    n = int(dur * SR)
    return _bandpass(rng.standard_normal(n).astype("float32"), 300, 3400) * level


def static_burst(dur=0.12, level=0.06):
    n = int(dur * SR)
    x = _bandpass(rng.standard_normal(n).astype("float32"), 500, 3200)
    return (x * _env(n, 0.01, 0.05) * level).astype("float32")


def roger_beep(freq=1180.0, dur=0.09, level=0.05):
    n = int(dur * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * freq * t).astype("float32") * _env(n, 0.004, 0.02)
    return np.concatenate([static_burst(0.03, 0.05), tone * level])


def squelch_open():
    return static_burst(0.05, 0.07)


def smoke_alarm(dur, level=0.05, period=7.0):
    """Intermittent T3 smoke-detector chirp (3.1 kHz) — background of trapped calls."""
    out = silence(dur)
    n = len(out)
    chirp_n = int(0.10 * SR)
    t = np.arange(chirp_n) / SR
    chirp = (np.sin(2 * np.pi * 3100 * t) * _env(chirp_n, 0.003, 0.02)).astype("float32")
    step = int(period * SR)
    for start in range(int(1.5 * SR), n - chirp_n, step):
        for k in range(3):  # temporal-3 pattern
            s = start + k * int(0.18 * SR)
            if s + chirp_n < n:
                out[s:s + chirp_n] += chirp * level
    return out


def siren(dur, level=0.05, approach=True):
    """Two-tone French 'pin-pon' siren; fades in to simulate an approaching engine."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    # alternate 435 / 580 Hz every 0.6 s
    sw = (np.sign(np.sin(2 * np.pi * t / 1.2)) + 1) / 2
    tone = np.sin(2 * np.pi * (435 + 145 * sw) * t).astype("float32")
    tone = _bandpass(tone, 300, 2500)
    if approach:
        tone *= np.clip(np.linspace(0.1, 1.4, n), 0, 1.4)
    return (tone * level).astype("float32")


def fireground(dur, level=0.03):
    """Low broadband fireground ambience (pumps + distant activity) for radio beds."""
    n = int(dur * SR)
    base = _lowpass(rng.standard_normal(n).astype("float32"), 900) * 0.5
    flick = np.interp(np.arange(n), np.arange(0, n, SR // 4),
                      rng.uniform(0.4, 1.0, size=len(range(0, n, SR // 4))))
    return (base * flick * level).astype("float32")


# -------------------------------------------------------------- mix ----------
def overlay(base, clip, at_sec, gain=1.0):
    at = int(at_sec * SR)
    end = at + len(clip)
    if end > len(base):
        base = np.concatenate([base, np.zeros(end - len(base), dtype="float32")])
    base[at:end] += clip * gain
    return base


def export_mp3(samples, path, bitrate="192k"):
    buf = io.BytesIO()
    sf.write(buf, peak_normalize(samples, -1.0), SR, format="WAV", subtype="PCM_16")
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-i", "pipe:0", "-codec:a", "libmp3lame", "-b:a", bitrate, str(path)],
        input=buf.getvalue(), check=True)


def duration(samples):
    return len(samples) / SR
