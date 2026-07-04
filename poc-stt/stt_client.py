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
# Phrases d'adaptation (vocabulaire métier pompier)
# ---------------------------------------------------------------------------
# Configurable via STT_ADAPTATION_PHRASES (séparées par |, ex: "CODIS|VSAV|PSE 1")
_DEFAULT_ADAPTATION_PHRASES = [
    "chef de colonne",
    "CODIS",
    "VSAV",
    "PSE 1",
    "code alpha",
    "victime incarcérée",
]

def _parse_adaptation_phrases() -> list[str]:
    """Parse les phrases d'adaptation depuis l'environnement ou utilise les défauts."""
    raw = os.getenv("STT_ADAPTATION_PHRASES")
    if raw:
        return [p.strip() for p in raw.split("|") if p.strip()]
    return _DEFAULT_ADAPTATION_PHRASES


# ---------------------------------------------------------------------------
# Configuration de reconnaissance Chirp 3
# ---------------------------------------------------------------------------
def build_stt_config(language_code: str = "auto") -> cloud_speech.StreamingRecognizeRequest:
    """Construit la requête de configuration initiale pour le streaming.

    Points clés :
    - LINEAR16, 16 kHz, mono → format explicite (pas d'auto-detection)
    - language_codes : si "auto" → ["auto"] (détection automatique), sinon [language_code]
      (ex: ["fr-FR"]). Forcer la langue réduit le WER de 5-15%.
    - model="chirp_3" → modèle multilingue Google
    - interim_results=True → feedback temps réel
    - enable_automatic_punctuation=True → ponctuation automatique
    - enable_voice_activity_events=True → événements début/fin de parole (VAD)
    - adaptation → vocabulary métier pompier via STT_ADAPTATION_PHRASES

    ⚠ Pas de diarization : l'API V2 ne supporte pas SpeakerDiarizationConfig
    en mode StreamingRecognize (erreur 400). Voir docstring du module.

    Args:
        language_code: "auto" pour détection automatique, sinon code BCP-47
                       (ex: "fr-FR", "en-US", "it-IT").

    Returns:
        StreamingRecognizeRequest contenant uniquement la streaming_config
        (pas d'audio — c'est le premier message du stream).
    """
    # Résoudre le code langue : "auto" → ["auto"], sinon [code explicite]
    lang_codes = ["auto"] if language_code == "auto" else [language_code]
    logger.info("Langue STT : %s", lang_codes[0])

    recognition_config = cloud_speech.RecognitionConfig(
        explicit_decoding_config=cloud_speech.ExplicitDecodingConfig(
            encoding=cloud_speech.ExplicitDecodingConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=16000,
            audio_channel_count=1,  # mono
        ),
        language_codes=lang_codes,
        model="chirp_3",
        features=cloud_speech.RecognitionFeatures(
            enable_automatic_punctuation=True,
        ),
    )

    # --- Speech Adaptation : désactivé en streaming ---
    # ⚠ L'API V2 ne supporte PAS SpeechAdaptation en mode StreamingRecognize
    # (erreur 404 "Requested entity was not found"), comme pour la diarization.
    # Le code ci-dessous est prêt mais commenté — à réactiver si Google
    # ajoute le support en streaming, ou à utiliser en mode Recognize/BatchRecognize.
    #
    # adaptation_phrases = _parse_adaptation_phrases()
    # if adaptation_phrases:
    #     recognition_config.adaptation = cloud_speech.SpeechAdaptation(
    #         phrase_sets=[
    #             cloud_speech.SpeechAdaptation.AdaptationPhraseSet(
    #                 inline_phrase_set=cloud_speech.PhraseSet(
    #                     phrases=[
    #                         cloud_speech.PhraseSet.Phrase(value=p, boost=15.0)
    #                         for p in adaptation_phrases
    #                     ]
    #                 )
    #             )
    #         ]
    #     )
    #     logger.info("Speech Adaptation activée — %d phrases", len(adaptation_phrases))

    streaming_config = cloud_speech.StreamingRecognitionConfig(
        config=recognition_config,
        streaming_features=cloud_speech.StreamingRecognitionFeatures(
            interim_results=True,
            enable_voice_activity_events=True,
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
    language_code: str = "auto",
) -> None:
    """Exécute la reconnaissance streaming Google STT de manière bloquante.

    Conçue pour être appelée via asyncio.to_thread().

    Args:
        audio_queue: Queue thread-safe. Attend des bytes (chunks audio LINEAR16)
                     ou None (signal de fin de stream).
        result_queue: Queue thread-safe. Reçoit des dicts :
                      {"type": "transcript", "text": ..., "is_final": bool,
                       "language_code": "fr-FR"}
                      {"type": "speech_event", "event": "speech_begin"|"speech_end"}
                      {"type": "utterance", "text": "...", "language_code": "..."}
                      ou {"type": "error", "message": "..."}
                      ou None (signal de fin).
        language_code: "auto" ou code BCP-47 (ex: "fr-FR").

    Le flux :
    1. Un générateur yield d'abord la config, puis les chunks audio au fur
       et à mesure qu'ils arrivent dans audio_queue.
    2. client.streaming_recognize() itère sur le générateur et renvoie les
       réponses de Google.
    3. Chaque réponse est convertie en dict et poussée dans result_queue.
    4. Quand audio_queue reçoit None → le générateur s'arrête → le stream
       Google se termine → on pousse None dans result_queue.
    """
    import threading

    client = get_client()
    config_request = build_stt_config(language_code=language_code)

    # ------------------------------------------------------------------
    # État pour le buffering d'utterance (levier 3)
    # ------------------------------------------------------------------
    utterance_buffer: list[str] = []
    utterance_language: str | None = None
    silence_timer: threading.Timer | None = None
    utterance_lock = threading.Lock()  # protège buffer + timer contre les races
    SILENCE_THRESHOLD_SEC = 2.5  # pause considérée comme fin d'utterance

    def _flush_utterance():
        """Vide le buffer d'utterance et pousse un message 'utterance'."""
        nonlocal utterance_buffer, utterance_language
        with utterance_lock:
            if utterance_buffer:
                full_text = " ".join(utterance_buffer).strip()
                if full_text:
                    logger.info(
                        "Utterance complète (%d segments, %.80s…) — prête pour LLM",
                        len(utterance_buffer), full_text,
                    )
                    result_queue.put({
                        "type": "utterance",
                        "text": full_text,
                        "language_code": utterance_language or "unknown",
                    })
                utterance_buffer = []
                utterance_language = None

    def _cancel_silence_timer():
        """Annule le timer de silence s'il est actif."""
        nonlocal silence_timer
        with utterance_lock:
            if silence_timer is not None:
                silence_timer.cancel()
                silence_timer = None

    def request_generator():
        """Générateur qui alimente streaming_recognize.

        Premier message = config uniquement.
        Messages suivants = chunks audio.
        S'arrête quand il reçoit None de audio_queue.
        """
        yield config_request
        while True:
            chunk = audio_queue.get()
            if chunk is None:
                logger.info("Fin du stream audio (signal None reçu)")
                break
            logger.debug("Envoi chunk audio : %d octets", len(chunk))
            yield cloud_speech.StreamingRecognizeRequest(audio=chunk)

    try:
        logger.info("Démarrage du stream Google STT (chirp_3, langue=%s)...", language_code)
        responses = client.streaming_recognize(requests=request_generator())

        for response in responses:
            # --- Événements VAD (Voice Activity Detection) — levier 2 ---
            # Utilisés UNIQUEMENT pour l'affichage visuel (dot pulsant frontend).
            # Le flush d'utterance est déclenché par le timer sur is_final: true,
            # PAS par les événements VAD.
            speech_event = getattr(response, "speech_event", None)
            if speech_event is not None:
                event_type = getattr(speech_event, "event", None)
                if event_type is not None:
                    event_name = cloud_speech.StreamingRecognizeResponse.SpeechEventType.Name(event_type)
                    logger.debug("Événement VAD : %s", event_name)

                    if event_type == 2:  # SPEECH_ACTIVITY_BEGIN
                        result_queue.put({"type": "speech_event", "event": "speech_begin"})

                    elif event_type == 3:  # SPEECH_ACTIVITY_END
                        result_queue.put({"type": "speech_event", "event": "speech_end"})

                continue  # Les événements VAD n'ont pas de results

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

                # --- Accumuler les segments finaux dans le buffer d'utterance (levier 3) ---
                if result.is_final and alternative.transcript.strip():
                    with utterance_lock:
                        utterance_buffer.append(alternative.transcript.strip())
                        if utterance_language is None and language_code != "unknown":
                            utterance_language = language_code
                    # Chaque final reset le timer de silence → flush si 2.5s sans nouveau final
                    _cancel_silence_timer()
                    silence_timer = threading.Timer(
                        SILENCE_THRESHOLD_SEC, _flush_utterance
                    )
                    silence_timer.daemon = True
                    silence_timer.start()

        # Fin normale du stream : flusher ce qui reste
        _cancel_silence_timer()
        _flush_utterance()
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
