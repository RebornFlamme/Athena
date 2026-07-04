"""Décodage audio serveur → PCM 16 kHz mono s16le, sans ffmpeg système.

Utilise PyAV (`av`), dont les wheels embarquent les libs ffmpeg — donc rien à
installer au niveau OS (compatible runtime Python de Render). Le format de sortie
est exactement celui attendu par le streaming Chirp 3 (LINEAR16, 16 kHz, mono).
"""

import io
import logging

import av

logger = logging.getLogger("poc-stt.audio_decode")


def decode_to_pcm16k_mono(data: bytes) -> bytes:
    """Décode un fichier audio (MP3, WAV, OGG…) en PCM 16 kHz mono s16le.

    Args:
        data: octets bruts du fichier audio.

    Returns:
        PCM signé 16 bits little-endian, mono, 16 kHz (prêt à streamer à Google).
    """
    logger.info("Décodage audio : %d octets en entrée", len(data))
    container = av.open(io.BytesIO(data))
    logger.info("Format détecté : %s, streams=%d", container.format.long_name if container.format else "?", len(container.streams))
    resampler = av.AudioResampler(format="s16", layout="mono", rate=16000)

    nb_frames = 0
    chunks: list[bytes] = []
    for frame in container.decode(audio=0):
        nb_frames += 1
        for resampled in resampler.resample(frame):
            chunks.append(resampled.to_ndarray().tobytes())
    # Vidange finale du resampler.
    for resampled in resampler.resample(None):
        chunks.append(resampled.to_ndarray().tobytes())

    container.close()
    pcm = b"".join(chunks)
    duree_s = len(pcm) / (16000 * 2) if pcm else 0
    logger.info("Décodage terminé : %d frames → %d octets PCM (%.1f s)", nb_frames, len(pcm), duree_s)
    return pcm
