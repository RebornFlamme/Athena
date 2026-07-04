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

from audio_decode import stream_pcm16k_mono
from extraction import extraire_appel
from stt_client import run_stt_stream
from supabase_client import get_supabase

logger = logging.getLogger("poc-stt.job")

CHUNK_MS = 80
CHUNK_BYTES = CHUNK_MS * 16000 * 2 // 1000  # 16 kHz * 2 octets/échantillon → 2560 octets / 80 ms


def _download(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=30) as resp:  # noqa: S310 (URL Supabase de confiance)
        return resp.read()


def transcribe_appel(appel: dict, stop_event: threading.Event | None = None) -> None:
    """Transcrit un appel en streaming et insère les segments dans Supabase.

    Args:
        appel: ligne `appels` (au moins `id` et `audio_url`).
        stop_event: si fourni et déclenché (nouveau lancement de simulation),
            le job s'arrête proprement (utile quand l'utilisateur relance / revient
            au début : on ne veut pas que l'ancien run continue d'écrire).
    """
    appel_id = appel["id"]
    url = appel["audio_url"]
    # Job annulé avant même de démarrer (relance pendant qu'il était en file).
    if stop_event is not None and stop_event.is_set():
        return
    sb = get_supabase()
    logger.info("Transcription appel %s (%s)", appel_id, appel.get("titre"))

    try:
        raw = _download(url)
    except Exception as exc:  # noqa: BLE001
        logger.error("Téléchargement KO pour %s : %s", appel_id, exc)
        return

    audio_q: queue.Queue = queue.Queue()
    result_q: queue.Queue = queue.Queue()

    def feeder() -> None:
        """Décode + pousse le PCM en chunks 80 ms au rythme réel, puis None (fin).

        Décodage **au fil de l'eau** (`stream_pcm16k_mono`) : on ne matérialise
        jamais tout le PCM en mémoire → indispensable quand plusieurs jobs (dont
        des réseaux radio de ~15 min) tournent en parallèle sur un petit serveur.
        S'interrompt si `stop_event` est déclenché (relance de la simulation).
        """
        try:
            for chunk in stream_pcm16k_mono(raw, CHUNK_BYTES):
                if stop_event is not None and stop_event.is_set():
                    logger.info("Job appel %s interrompu (relance)", appel_id)
                    break
                audio_q.put(chunk)
                time.sleep(CHUNK_MS / 1000)  # cadence temps réel → transcription live
        except Exception as exc:  # noqa: BLE001
            logger.error("Décodage KO pour %s : %s", appel_id, exc)
        finally:
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

    # Run annulé (relance) : on ne lance pas l'extraction sur un transcript partiel.
    if stop_event is not None and stop_event.is_set():
        return

    # Extraction LLM : transcript → entités/événements liés dans Supabase
    # (→ carte via Realtime). Non bloquant pour la transcription en cas d'échec.
    try:
        extraire_appel(appel, sb)
    except Exception as exc:  # noqa: BLE001
        logger.error("Extraction KO pour l'appel %s : %s", appel_id, exc)
