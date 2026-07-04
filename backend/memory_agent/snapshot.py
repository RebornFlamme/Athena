"""
snapshot.py — Récupère un snapshot de l'intervention active depuis Supabase.

Formatte l'état courant (intervention + entités projetées + derniers événements)
en Markdown compact pour être injecté dans le system prompt de l'agent LLM.
"""

from __future__ import annotations

import logging
from typing import Any

from supabase import create_client, Client

from .config import settings

logger = logging.getLogger(__name__)


def _get_client() -> Client:
    """Crée un client Supabase (service_role pour lecture admin si dispo)."""
    if not settings.supabase_url:
        raise RuntimeError("SUPABASE_URL is not configured.")
    key = settings.supabase_service_role_key or settings.supabase_anon_key
    if not key:
        raise RuntimeError("SUPABASE_ANON_KEY is not configured.")
    return create_client(settings.supabase_url, key)


async def get_intervention_snapshot(intervention_id: str) -> str:
    """Récupère un snapshot complet de l'intervention pour le LLM.

    Fetch en parallèle :
    - L'intervention elle-même
    - Ses entités projetées (projection courante sur la carte)
    - Les 20 derniers événements du journal (append-only)

    Args:
        intervention_id: UUID de l'intervention.

    Returns:
        Markdown structuré décrivant l'état actuel de l'intervention,
        ou un message indiquant que l'intervention n'existe pas.
    """
    client = _get_client()

    try:
        # ── 1. Intervention ──────────────────────────────────────────
        intervention_resp = (
            client.table("interventions")
            .select("*")
            .eq("id", intervention_id)
            .limit(1)
            .execute()
        )

        if not intervention_resp.data:
            return (
                "### Intervention non trouvée\n\n"
                f"L'intervention `{intervention_id}` n'existe pas encore en base. "
                "Si l'utterance mentionne une nouvelle intervention, tu peux la créer "
                "via INSERT dans `interventions`."
            )

        intervention = intervention_resp.data[0]
        lines: list[str] = []

        # ── En-tête intervention ──────────────────────────────────
        lines.append("## État actuel de l'intervention")
        lines.append("")
        lines.append(f"### Intervention `{intervention_id}`")
        lines.append(f"- **Titre**: {intervention.get('titre', 'N/A')}")
        lines.append(f"- **Statut**: {intervention.get('statut', 'N/A')}")
        if intervention.get("adresse"):
            lines.append(f"- **Adresse**: {intervention['adresse']}")
        if intervention.get("lat") and intervention.get("lon"):
            lines.append(f"- **Coordonnées**: ({intervention['lat']}, {intervention['lon']})")
        lines.append("")

        # ── 2. Entités projetées ─────────────────────────────────
        try:
            entites_resp = (
                client.table("entites")
                .select("*")
                .eq("intervention_id", intervention_id)
                .order("maj_le", desc=True)
                .limit(50)
                .execute()
            )

            if entites_resp.data:
                # Grouper par type
                by_type: dict[str, list[dict[str, Any]]] = {}
                for e in entites_resp.data:
                    etype = e.get("type", "inconnu")
                    by_type.setdefault(etype, []).append(e)

                lines.append(f"### Entités ({len(entites_resp.data)})")
                for etype, items in sorted(by_type.items()):
                    lines.append(f"#### {etype.capitalize()}s ({len(items)})")
                    for item in items:
                        libelle = item.get("libelle", "?")
                        sous_type = item.get("sous_type", "")
                        statut = item.get("statut", "presume")
                        etat = item.get("etat", {})
                        etat_str = _format_etat(etat) if etat else ""
                        extra = f" — {etat_str}" if etat_str else ""
                        tag = f" [{sous_type}]" if sous_type else ""
                        lines.append(
                            f"- `{item['id']}`{tag} **{libelle}** "
                            f"(statut: {statut}){extra}"
                        )
                lines.append("")
        except Exception as exc:
            logger.warning("Impossible de récupérer les entités : %s", exc)
            lines.append("### Entités")
            lines.append("(non disponible)")
            lines.append("")

        # ── 3. Derniers événements (journal) ──────────────────────
        try:
            evenements_resp = (
                client.table("evenements")
                .select("*")
                .eq("intervention_id", intervention_id)
                .order("event_id", desc=True)
                .limit(20)
                .execute()
            )

            if evenements_resp.data:
                lines.append(f"### Derniers événements ({len(evenements_resp.data)})")
                for evt in reversed(evenements_resp.data):  # ordre chronologique
                    event_type = evt.get("event_type", "?")
                    payload = evt.get("payload", {})
                    extrait = ""
                    if isinstance(payload, dict):
                        extrait = payload.get("extrait_source", "")
                    extrait_str = f' — *"{extrait[:120]}"*' if extrait else ""
                    lines.append(
                        f"- [{evt.get('source', '?')}] **{event_type}** "
                        f"(fiabilité: {evt.get('fiabilite', '?')}){extrait_str}"
                    )
                lines.append("")
        except Exception as exc:
            logger.warning("Impossible de récupérer les événements : %s", exc)

        return "\n".join(lines)

    except Exception as exc:
        logger.error(
            "Erreur lors de la récupération du snapshot pour l'intervention %s : %s",
            intervention_id,
            exc,
        )
        return (
            f"### Erreur snapshot\n\n"
            f"Impossible de récupérer l'état de l'intervention `{intervention_id}` : {exc}"
        )


def _format_etat(etat: dict[str, Any]) -> str:
    """Formate un jsonb `etat` en texte lisible pour le LLM."""
    if not etat:
        return ""
    parts = []
    for key, value in etat.items():
        if value is None:
            continue
        if isinstance(value, bool):
            parts.append(f"{key}={value}")
        elif isinstance(value, (int, float)):
            parts.append(f"{key}={value}")
        elif isinstance(value, str) and len(value) < 60:
            parts.append(f"{key}='{value}'")
        elif isinstance(value, str):
            parts.append(f"{key}='{value[:57]}...'")
        else:
            parts.append(f"{key}={{{type(value).__name__}}}")
    return ", ".join(parts)
