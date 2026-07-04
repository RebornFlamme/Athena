"""
types.py — Modèles Pydantic pour le module memory_agent.

Définit les structures de données échangées entre :
- le pipeline STT (qui appelle process_utterance)
- l'agent LLM (qui produit des décisions)
- les logs / l'affichage frontend
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Mutation(BaseModel):
    """Une mutation DB décidée et exécutée par l'agent.

    Chaque mutation correspond à UN tool call MCP execute_sql.
    """

    table: str = Field(
        ...,
        description="Nom de la table concernée (ex: 'entites', 'evenements')",
    )
    operation: Literal["INSERT", "UPDATE", "DELETE", "SELECT"] = Field(
        ...,
        description="Type d'opération SQL exécutée",
    )
    row_id: str | None = Field(
        default=None,
        description="UUID de la ligne affectée (si connu après l'opération)",
    )
    summary: str = Field(
        ...,
        description="Description humaine lisible (ex: 'victime ajoutée: homme, 45 ans, brûlé aux mains')",
    )
    raw_sql: str | None = Field(
        default=None,
        description="SQL réellement exécuté (pour logs/audit trail)",
    )


class AgentDecision(BaseModel):
    """Résultat d'un tour d'agent : la décision prise + les mutations effectuées.

    C'est la valeur de retour de process_utterance(). Toujours retournée,
    même en cas d'erreur (dans ce cas error est renseigné).
    """

    session_id: str = Field(
        ...,
        description="Identifiant de la session STT",
    )
    intervention_id: str = Field(
        ...,
        description="Identifiant de l'intervention concernée",
    )
    utterance_text: str = Field(
        ...,
        description="Texte de l'utterance traitée",
    )
    took_action: bool = Field(
        default=False,
        description="False si l'agent a jugé qu'il n'y avait rien à faire",
    )
    mutations: list[Mutation] = Field(
        default_factory=list,
        description="Mutations DB effectuées (peut être vide)",
    )
    agent_notes: str = Field(
        default="",
        description="Narration courte de ce que l'agent a compris/fait",
    )
    latency_ms: int = Field(
        default=0,
        description="Latence du tour en millisecondes",
    )
    error: str | None = Field(
        default=None,
        description="Message d'erreur si le tour a échoué (None = succès)",
    )


class Utterance(BaseModel):
    """Représentation complète d'une utterance entrante (pour usage interne)."""

    session_id: str
    intervention_id: str
    utterance_text: str
    language_code: str = "fr"
    speaker_tag: str = "caller"
    context_utterances: list[str] = Field(default_factory=list)
    timestamp: str = ""
