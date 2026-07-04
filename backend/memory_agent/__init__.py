"""
memory_agent — Pont entre texte transcrit (STT) et mutations DB (Supabase).

Ce module fournit une fonction publique unique `process_utterance()` qui,
à partir d'une utterance transcrite et de son contexte, met à jour l'état
de la mémoire opérationnelle dans Supabase via un agent LLM (Gemini 3.5 Flash
+ Google ADK + serveur MCP Supabase).

Usage rapide :
    from memory_agent import process_utterance

    decision = await process_utterance(
        session_id="ws_abc123",
        intervention_id="3f21a9...",
        utterance_text="on a un homme de 45 ans brûlé aux mains",
        language_code="fr",
        speaker_tag="caller",
        context_utterances=[],
        timestamp="2026-07-04T14:30:00Z",
    )
"""

from .integration import process_utterance, startup_memory_agent
from .types import AgentDecision, Mutation, Utterance
from .config import Settings, settings

__all__ = [
    # Public API
    "process_utterance",
    "startup_memory_agent",
    # Types
    "AgentDecision",
    "Mutation",
    "Utterance",
    # Config (read-only)
    "Settings",
    "settings",
]
