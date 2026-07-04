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
from extraction import extraire_appel
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
    titre = appel.get("titre", "?")
    logger.info("[JOB %s] ========== DÉBUT TRANSCRIPTION ==========", appel_id)
    logger.info("[JOB %s] Titre : %s", appel_id, titre)
    logger.info("[JOB %s] URL audio : %s", appel_id, url)

    try:
        logger.info("[JOB %s] Téléchargement du MP3...", appel_id)
        raw = _download(url)
        logger.info("[JOB %s] MP3 téléchargé : %d octets", appel_id, len(raw))
        logger.info("[JOB %s] Décodage PCM 16 kHz mono...", appel_id)
        pcm = decode_to_pcm16k_mono(raw)
        logger.info("[JOB %s] PCM décodé : %d octets (%.1f s)", appel_id, len(pcm), len(pcm) / (16000 * 2))
    except Exception as exc:  # noqa: BLE001
        logger.error("[JOB %s] ❌ Téléchargement/décodage KO : %s", appel_id, exc, exc_info=True)
        return

    audio_q: queue.Queue = queue.Queue()
    result_q: queue.Queue = queue.Queue()

    def feeder() -> None:
        """Pousse le PCM en chunks 80 ms au rythme réel, puis None (fin)."""
        try:
            nb_chunks = 0
            for off in range(0, len(pcm), CHUNK_BYTES):
                audio_q.put(pcm[off:off + CHUNK_BYTES])
                nb_chunks += 1
                time.sleep(CHUNK_MS / 1000)  # cadence temps réel → transcription live
            logger.info("[JOB %s] Feeder terminé : %d chunks envoyés", appel_id, nb_chunks)
        except Exception as exc:  # noqa: BLE001
            logger.error("[JOB %s] ❌ Feeder crash : %s", appel_id, exc, exc_info=True)
        finally:
            # GARANTI : toujours signaler la fin, même en cas de crash
            audio_q.put(None)

    threading.Thread(target=feeder, daemon=True).start()
    threading.Thread(target=run_stt_stream, args=(audio_q, result_q), daemon=True).start()

    ordinal = 0
    while True:
        item = result_q.get()
        if item is None:
            logger.info("[JOB %s] Fin du flux de résultats", appel_id)
            break
        if item.get("type") == "error":
            logger.error("[JOB %s] ❌ STT error : %s", appel_id, item.get("message"))
            continue
        if item.get("type") == "transcript":
            is_final = item.get("is_final", False)
            texte = (item.get("text") or "").strip()
            langue = item.get("language_code", "?")
            logger.debug("[JOB %s] Segment %s | %s | « %.80s »", appel_id,
                         "FINAL" if is_final else "interim", langue, texte)
            if is_final and texte:
                try:
                    sb.table("transcriptions").insert({
                        "appel_id": appel_id,
                        "ordinal": ordinal,
                        "texte": texte,
                        "langue": item.get("language_code"),
                    }).execute()
                    logger.info("[JOB %s] ✅ segment #%d inséré : « %.80s »", appel_id, ordinal, texte)
                    ordinal += 1
                except Exception as exc:  # noqa: BLE001
                    logger.error("[JOB %s] ❌ Insert transcription KO : %s", appel_id, exc, exc_info=True)

    logger.info("[JOB %s] ✅ Transcription terminée : %d segments", appel_id, ordinal)

    # Extraction LLM : transcript → entités/événements liés dans Supabase
    # (→ carte via Realtime). Non bloquant pour la transcription en cas d'échec.
    logger.info("[JOB %s] Démarrage extraction LLM...", appel_id)
    try:
        extraire_appel(appel, sb)
        logger.info("[JOB %s] ✅ Extraction LLM OK", appel_id)
    except Exception as exc:  # noqa: BLE001
        logger.error("[JOB %s] ❌ Extraction KO : %s", appel_id, exc, exc_info=True)
    logger.info("[JOB %s] ========== FIN ==========", appel_id)
