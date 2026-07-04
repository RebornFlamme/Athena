"""
integration.py — Point d'entrée public du module memory_agent.

Expose la fonction process_utterance() qui est appelée par le pipeline STT
à chaque utterance finale. C'est l'interface contractuelle entre le STT
et l'agent de mémoire opérationnelle.
"""

from __future__ import annotations

import logging

from .types import AgentDecision
from .agent import get_or_create_session
from .schema_loader import load_schema_snapshot

logger = logging.getLogger(__name__)


async def process_utterance(
    session_id: str,
    intervention_id: str,
    utterance_text: str,
    language_code: str,
    speaker_tag: str,
    context_utterances: list[str],
    timestamp: str,
) -> AgentDecision:
    """Traite une utterance transcrite et met à jour la mémoire opérationnelle.

    Fonction publique unique du module. Appelée par le pipeline STT à chaque
    utterance `is_final` (après le timer de silence de 2.5s).

    Args:
        session_id: Identifiant unique de la session STT (WebSocket).
        intervention_id: UUID de l'intervention en cours.
        utterance_text: Texte transcrit de l'utterance (français).
        language_code: Code langue BCP-47 (ex: "fr").
        speaker_tag: Rôle du locuteur ("caller", "operator", "chef_colonne", etc.).
        context_utterances: 2-3 dernières utterances de la même session
                            (pour le contexte conversationnel).
        timestamp: Horodatage ISO 8601 de l'utterance.

    Returns:
        AgentDecision avec les mutations effectuées, les notes de l'agent,
        et la latence. En cas d'erreur, le champ `error` est renseigné
        (cette fonction ne raise jamais — un plantage de l'agent ne doit
        pas tuer la session STT).

    Example:
        >>> decision = await process_utterance(
        ...     session_id="ws_abc123",
        ...     intervention_id="3f21a9...",
        ...     utterance_text="on a un homme de 45 ans brûlé aux mains",
        ...     language_code="fr",
        ...     speaker_tag="caller",
        ...     context_utterances=["appel d'urgence, je vous écoute"],
        ...     timestamp="2026-07-04T14:30:00Z",
        ... )
        >>> print(decision.took_action)
        True
        >>> print(decision.mutations[0].summary)
        "Victime ajoutée : homme, 45 ans, brûlé aux mains"
    """
    logger.info(
        "process_utterance — session=%s, intervention=%s, speaker=%s",
        session_id, intervention_id, speaker_tag,
    )

    session = await get_or_create_session(session_id, intervention_id)
    return await session.run_turn(
        utterance_text=utterance_text,
        speaker_tag=speaker_tag,
        language_code=language_code,
        context_utterances=context_utterances,
        timestamp=timestamp,
    )


async def startup_memory_agent() -> None:
    """Initialise le module au démarrage du backend.

    À appeler depuis le lifespan FastAPI (ou équivalent) :
    - Charge le schéma DB en cache
    - Valide la configuration

    Si le schéma ne peut pas être chargé, un avertissement est loggé
    mais le module reste fonctionnel (fallback sur le schéma de référence).
    """
    logger.info("Démarrage du module memory_agent...")

    # Charger le schéma DB (ou utiliser le fallback)
    try:
        schema = await load_schema_snapshot()
        logger.info("Schéma DB chargé (%d caractères)", len(schema))
    except Exception as exc:
        logger.warning("Échec du chargement du schéma DB : %s. Fallback activé.", exc)

    logger.info("Module memory_agent prêt.")
