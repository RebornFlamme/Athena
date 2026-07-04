"""Décodage audio serveur → PCM 16 kHz mono s16le, sans ffmpeg système.

Utilise PyAV (`av`), dont les wheels embarquent les libs ffmpeg — donc rien à
installer au niveau OS (compatible runtime Python de Render). Le format de sortie
est exactement celui attendu par le streaming Chirp 3 (LINEAR16, 16 kHz, mono).
"""

import io
from collections.abc import Iterator

import av


def stream_pcm16k_mono(data: bytes, chunk_bytes: int) -> Iterator[bytes]:
    """Décode un fichier audio en PCM 16 kHz mono s16le, **au fil de l'eau**.

    Ne matérialise jamais tout le PCM en mémoire (contrairement à
    `decode_to_pcm16k_mono`) : yield des blocs de `chunk_bytes` octets à mesure
    que le fichier est décodé. Essentiel pour les longs fichiers (réseaux radio
    de ~15 min) quand plusieurs jobs tournent en parallèle sur un petit serveur.

    Args:
        data: octets bruts du fichier audio (MP3, WAV…).
        chunk_bytes: taille des blocs PCM émis (ex. 2560 = 80 ms à 16 kHz mono).

    Yields:
        Blocs de PCM signé 16 bits LE, mono, 16 kHz. Le dernier bloc peut être
        plus court que `chunk_bytes`.
    """
    container = av.open(io.BytesIO(data))
    resampler = av.AudioResampler(format="s16", layout="mono", rate=16000)
    buf = bytearray()

    def _emit(pcm: bytes) -> Iterator[bytes]:
        buf.extend(pcm)
        while len(buf) >= chunk_bytes:
            yield bytes(buf[:chunk_bytes])
            del buf[:chunk_bytes]

    try:
        for frame in container.decode(audio=0):
            for resampled in resampler.resample(frame):
                yield from _emit(resampled.to_ndarray().tobytes())
        # Vidange finale du resampler.
        for resampled in resampler.resample(None):
            yield from _emit(resampled.to_ndarray().tobytes())
        if buf:
            yield bytes(buf)
    finally:
        container.close()


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
