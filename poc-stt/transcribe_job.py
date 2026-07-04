"""Job de transcription serveur (streaming live) d'un appel → Supabase.

Pour un appel : télécharge le MP3 (Supabase Storage), décode en PCM 16 kHz mono,
puis alimente `run_stt_stream` (Chirp 3 streaming) en chunks de 80 ms **au rythme
réel** — pour que les segments arrivent progressivement, calés sur la durée de
l'audio. Chaque segment `final` est inséré dans `transcriptions` au fil de l'eau
(→ le dashboard le voit via Realtime).
"""

import logging
import queue
import threading
import time
import urllib.request

from audio_decode import decode_to_pcm16k_mono
from stt_client import run_stt_stream
from supabase_client import get_supabase

logger = logging.getLogger("poc-stt.job")

CHUNK_MS = 80
CHUNK_BYTES = CHUNK_MS * 16000 * 2 // 1000  # 16 kHz * 2 octets/échantillon → 2560 octets / 80 ms


def _download(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=30) as resp:  # noqa: S310 (URL Supabase de confiance)
        return resp.read()


def transcribe_appel(appel: dict) -> None:
    """Transcrit un appel en streaming et insère les segments dans Supabase.

    Args:
        appel: ligne `appels` (au moins `id` et `audio_url`).
    """
    appel_id = appel["id"]
    url = appel["audio_url"]
    sb = get_supabase()
    logger.info("Transcription appel %s (%s)", appel_id, appel.get("titre"))

    try:
        pcm = decode_to_pcm16k_mono(_download(url))
    except Exception as exc:  # noqa: BLE001
        logger.error("Téléchargement/décodage KO pour %s : %s", appel_id, exc)
        return

    audio_q: queue.Queue = queue.Queue()
    result_q: queue.Queue = queue.Queue()

    def feeder() -> None:
        """Pousse le PCM en chunks 80 ms au rythme réel, puis None (fin)."""
        for off in range(0, len(pcm), CHUNK_BYTES):
            audio_q.put(pcm[off:off + CHUNK_BYTES])
            time.sleep(CHUNK_MS / 1000)  # cadence temps réel → transcription live
        audio_q.put(None)

    threading.Thread(target=feeder, daemon=True).start()
    threading.Thread(target=run_stt_stream, args=(audio_q, result_q), daemon=True).start()

    ordinal = 0
    while True:
        item = result_q.get()
        if item is None:
            break
        if item.get("type") == "error":
            logger.error("STT error appel %s : %s", appel_id, item.get("message"))
            continue
        if item.get("type") == "transcript" and item.get("is_final"):
            texte = (item.get("text") or "").strip()
            if not texte:
                continue
            try:
                sb.table("transcriptions").insert({
                    "appel_id": appel_id,
                    "ordinal": ordinal,
                    "texte": texte,
                    "langue": item.get("language_code"),
                }).execute()
                ordinal += 1
            except Exception as exc:  # noqa: BLE001
                logger.error("Insert transcription KO (appel %s) : %s", appel_id, exc)

    logger.info("Appel %s transcrit : %d segments", appel_id, ordinal)
