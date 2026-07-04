"""
STT Client — Wrapper autour de Google Cloud Speech-to-Text API V2 (modèle chirp_3).

Gère la configuration de reconnaissance et le streaming bidirectionnel gRPC.
Le streaming est synchrone/bloquant → conçu pour être exécuté dans un thread
séparé via asyncio.to_thread().

⚠ Diarization : la diarization (SpeakerDiarizationConfig) n'est PAS supportée
en mode StreamingRecognize dans l'API V2 (l'API renvoie une erreur 400 explicite).
Elle est uniquement disponible en Recognize/BatchRecognize. En attendant que Google
l'active en streaming, la transcription se fait sans distinction de locuteur.
"""

import os
import queue
import logging

from google.cloud.speech_v2 import SpeechClient
from google.cloud.speech_v2.types import cloud_speech
from google.api_core.client_options import ClientOptions

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration depuis l'environnement
# ---------------------------------------------------------------------------
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
REGION = os.getenv("GOOGLE_CLOUD_REGION", "us")


# ---------------------------------------------------------------------------
# Client Speech (initialisé une fois au premier appel)
# ---------------------------------------------------------------------------
_speech_client: SpeechClient | None = None


def get_client() -> SpeechClient:
    """Crée (ou retourne) un SpeechClient configuré avec l'endpoint régional.

    Raises:
        ValueError: si GOOGLE_CLOUD_PROJECT n'est pas défini.
    """
    global _speech_client

    if _speech_client is not None:
        return _speech_client

    if not PROJECT_ID:
        raise ValueError(
            "GOOGLE_CLOUD_PROJECT n'est pas défini. "
            "Exportez la variable d'environnement avant de lancer le serveur."
        )

    _speech_client = SpeechClient(
        client_options=ClientOptions(
            api_endpoint=f"{REGION}-speech.googleapis.com",
        )
    )
    logger.info(
        "SpeechClient initialisé — projet=%s région=%s endpoint=%s-speech.googleapis.com",
        PROJECT_ID,
        REGION,
        REGION,
    )
    return _speech_client


# ---------------------------------------------------------------------------
# Configuration de reconnaissance Chirp 3
# ---------------------------------------------------------------------------
def build_stt_config() -> cloud_speech.StreamingRecognizeRequest:
    """Construit la requête de configuration initiale pour le streaming.

    Points clés :
    - LINEAR16, 16 kHz, mono → format explicite (pas d'auto-detection)
    - language_codes=["auto"] → détection automatique de la langue
    - model="chirp_3" → modèle multilingue Google
    - interim_results=True → feedback temps réel
    - enable_automatic_punctuation=True → ponctuation automatique

    ⚠ Pas de diarization : l'API V2 ne supporte pas SpeakerDiarizationConfig
    en mode StreamingRecognize (erreur 400). Voir docstring du module.

    Returns:
        StreamingRecognizeRequest contenant uniquement la streaming_config
        (pas d'audio — c'est le premier message du stream).
    """
    recognition_config = cloud_speech.RecognitionConfig(
        explicit_decoding_config=cloud_speech.ExplicitDecodingConfig(
            encoding=cloud_speech.ExplicitDecodingConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=16000,
            audio_channel_count=1,  # mono
        ),
        language_codes=["auto"],
        model="chirp_3",
        features=cloud_speech.RecognitionFeatures(
            enable_automatic_punctuation=True,
        ),
    )

    streaming_config = cloud_speech.StreamingRecognitionConfig(
        config=recognition_config,
        streaming_features=cloud_speech.StreamingRecognitionFeatures(
            interim_results=True,
        ),
    )

    config_request = cloud_speech.StreamingRecognizeRequest(
        recognizer=f"projects/{PROJECT_ID}/locations/{REGION}/recognizers/_",
        streaming_config=streaming_config,
    )

    logger.debug(
        "Configuration STT construite : chirp_3, LINEAR16 16kHz, "
        "auto-detect langue, interim_results"
    )
    return config_request


# ---------------------------------------------------------------------------
# Boucle de streaming Google STT (bloquante, à lancer dans un thread)
# ---------------------------------------------------------------------------
def run_stt_stream(
    audio_queue: queue.Queue,
    result_queue: queue.Queue,
) -> None:
    """Exécute la reconnaissance streaming Google STT de manière bloquante.

    Conçue pour être appelée via asyncio.to_thread().

    Args:
        audio_queue: Queue thread-safe. Attend des bytes (chunks audio LINEAR16)
                     ou None (signal de fin de stream).
        result_queue: Queue thread-safe. Reçoit des dicts :
                      {"type": "transcript", "text": ..., "is_final": bool,
                       "language_code": "fr-FR"}
                      ou {"type": "error", "message": "..."}
                      ou None (signal de fin).

    Le flux :
    1. Un générateur yield d'abord la config, puis les chunks audio au fur
       et à mesure qu'ils arrivent dans audio_queue.
    2. client.streaming_recognize() itère sur le générateur et renvoie les
       réponses de Google.
    3. Chaque réponse est convertie en dict et poussée dans result_queue.
    4. Quand audio_queue reçoit None → le générateur s'arrête → le stream
       Google se termine → on pousse None dans result_queue.
    """
    # Limite dure de Google STT V2 : un StreamingRecognize ne peut pas dépasser
    # ~5 min. On rouvre un nouveau stream toutes les ~4 min en continuant à
    # alimenter l'audio (pattern « infinite streaming ») → les fichiers longs
    # (réseaux radio de ~15 min) sont transcrits en entier, sans coupure.
    STREAM_LIMIT_BYTES = 4 * 60 * 16000 * 2  # 4 min de PCM 16 kHz mono s16le

    # État partagé entre les redémarrages de stream (via closure).
    carryover: list[bytes] = []   # chunk déjà lu mais qui appartient au stream suivant
    state = {"finished": False}   # True quand audio_queue a livré None (fin réelle)

    def request_generator(config_request):
        """Alimente UN stream : config, puis chunks jusqu'à la limite ou la fin.

        Rend la main (return) dans deux cas :
        - fin réelle de l'audio (None reçu de audio_queue) → state['finished']=True
        - limite de durée du stream atteinte → le chunk courant est reporté dans
          `carryover` pour ouvrir le prochain stream sans perdre d'audio.
        Premier message = config uniquement.
        """
        yield config_request
        sent = 0
        # Rejouer d'abord le chunk reporté du stream précédent, le cas échéant.
        while carryover:
            chunk = carryover.pop(0)
            sent += len(chunk)
            yield cloud_speech.StreamingRecognizeRequest(audio=chunk)
        while True:
            chunk = audio_queue.get()
            if chunk is None:
                logger.info("Fin du stream audio (signal None reçu)")
                state["finished"] = True
                return
            if sent + len(chunk) > STREAM_LIMIT_BYTES:
                # Limite atteinte : ce chunk ouvrira le prochain stream.
                carryover.append(chunk)
                logger.info("Limite de durée du stream atteinte → reconnexion STT")
                return
            sent += len(chunk)
            logger.debug("Envoi chunk audio : %d octets", len(chunk))
            yield cloud_speech.StreamingRecognizeRequest(audio=chunk)

    try:
        # Init du client Google DANS le try : si les credentials / le projet ne
        # sont pas configurés (SpeechClient introuvable, GOOGLE_CLOUD_PROJECT
        # absent), l'erreur est renvoyée au client via result_queue au lieu de
        # tuer la WebSocket silencieusement (sinon : socket fermée, aucun JSON).
        client = get_client()

        logger.info("Démarrage du stream Google STT (chirp_3)...")
        # Boucle de (re)connexion : un nouveau stream chaque fois que le
        # précédent atteint la limite de durée, jusqu'à la fin réelle de l'audio.
        while not state["finished"]:
            config_request = build_stt_config()
            responses = client.streaming_recognize(
                requests=request_generator(config_request)
            )

            for response in responses:
                if not response.results:
                    continue

                for result in response.results:
                    if not result.alternatives:
                        continue

                    alternative = result.alternatives[0]

                    # Récupération du code langue
                    language_code = getattr(result, "language_code", None)
                    if not language_code:
                        language_code = getattr(alternative, "language_code", None)
                    if not language_code:
                        language_code = "unknown"

                    payload = {
                        "type": "transcript",
                        "text": alternative.transcript,
                        "is_final": result.is_final,
                        "language_code": language_code,
                    }

                    logger.debug(
                        "Résultat STT : is_final=%s lang=%s text=%.60s",
                        result.is_final,
                        language_code,
                        alternative.transcript,
                    )
                    result_queue.put(payload)

        logger.info("Stream Google STT terminé normalement")

    except Exception as exc:
        logger.error("Erreur dans le stream Google STT : %s", exc, exc_info=True)
        result_queue.put({
            "type": "error",
            "message": f"Google STT error: {exc}",
        })

    finally:
        # Signale la fin au sender async
        result_queue.put(None)
