"""Décodage audio serveur → PCM 16 kHz mono s16le, sans ffmpeg système.

Utilise PyAV (`av`), dont les wheels embarquent les libs ffmpeg — donc rien à
installer au niveau OS (compatible runtime Python de Render). Le format de sortie
est exactement celui attendu par le streaming Chirp 3 (LINEAR16, 16 kHz, mono).
"""

import io

import av


def decode_to_pcm16k_mono(data: bytes) -> bytes:
    """Décode un fichier audio (MP3, WAV, OGG…) en PCM 16 kHz mono s16le.

    Args:
        data: octets bruts du fichier audio.

    Returns:
        PCM signé 16 bits little-endian, mono, 16 kHz (prêt à streamer à Google).
    """
    container = av.open(io.BytesIO(data))
    resampler = av.AudioResampler(format="s16", layout="mono", rate=16000)

    chunks: list[bytes] = []
    for frame in container.decode(audio=0):
        for resampled in resampler.resample(frame):
            chunks.append(resampled.to_ndarray().tobytes())
    # Vidange finale du resampler.
    for resampled in resampler.resample(None):
        chunks.append(resampled.to_ndarray().tobytes())

    container.close()
    return b"".join(chunks)
