"""
schema_loader.py — Charge le schéma de la DB au démarrage et le met en cache.

Query information_schema.columns + pg_enum via supabase-py pour produire
une description Markdown compacte du schéma, injectée dans le system prompt
de l'agent à chaque tour.

Le schéma est chargé UNE fois au startup et stocké en mémoire (cache module-level).
"""

from __future__ import annotations

import logging
from typing import Any

from supabase import create_client, Client

from .config import settings

logger = logging.getLogger(__name__)

# ── Cache module-level ────────────────────────────────────────────────
_SCHEMA_CACHE: str | None = None


def _get_supabase_client() -> Client:
    """Crée un client Supabase avec la service_role_key (accès admin).

    Utilise la service_role_key pour pouvoir interroger information_schema.
    """
    if not settings.supabase_url:
        raise RuntimeError("SUPABASE_URL is not configured.")
    # La service_role_key est préférée pour l'introspection ; fallback sur anon key
    key = settings.supabase_service_role_key or settings.supabase_anon_key
    if not key:
        raise RuntimeError("Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY is configured.")
    return create_client(settings.supabase_url, key)


# ── Schéma de référence intégré (fallback statique) ──────────────────
# Basé sur les migrations 0001, 0002, 0003 + backend/db/schema.sql.
# Sert de fallback si la requête information_schema échoue (PostgREST
# n'expose pas les schémas système).
_REFERENCE_SCHEMA_MD = """
## Table `interventions`
- `id` (uuid, PK, default: gen_random_uuid())
- `titre` (text, NOT NULL)
- `statut` (text, NOT NULL, CHECK: active|terminee)
- `adresse` (text, nullable)
- `lon` (double precision, nullable)
- `lat` (double precision, nullable)
- `cree_le` (timestamptz, NOT NULL, default: now())

## Table `evenements`
- `event_id` (bigint, PK, generated always as identity)
- `intervention_id` (uuid, NOT NULL, FK → interventions.id ON DELETE CASCADE)
- `entity_id` (uuid, nullable)
- `entity_type` (text, NOT NULL, CHECK: acteur|moyen|zone|evenement)
- `event_type` (text, NOT NULL) — ex: VICTIME_SIGNALEE, MOYEN_PRESENTE, ORDRE_DONNE, CORRECTION
- `payload` (jsonb, NOT NULL, default: {}) — contient extrait_source
- `ts_observation` (timestamptz, nullable) — quand le fait s'est produit
- `ts_declaration` (timestamptz, NOT NULL, default: now()) — quand on l'a appris
- `source` (text, NOT NULL, default: saisie_operateur) — appel_18|radio|gps|saisie_operateur
- `fiabilite` (text, NOT NULL, default: C3) — code Admiralty A1→F6
- `statut` (text, NOT NULL, CHECK: presume|confirme|corrige|perime)
- `corrige_event_id` (bigint, nullable, FK → evenements.event_id)

## Table `entites`
- `id` (uuid, PK, default: gen_random_uuid())
- `intervention_id` (uuid, NOT NULL, FK → interventions.id ON DELETE CASCADE)
- `type` (text, NOT NULL, CHECK: acteur|moyen|zone)
- `sous_type` (text, nullable) — victime|temoin|fpt|vsav|perimetre|point_eau
- `libelle` (text, NOT NULL) — ex: "Victime — 3e etage"
- `etat` (jsonb, NOT NULL, default: {}) — etat courant fusionne depuis les evenements
- `lon` (double precision, nullable)
- `lat` (double precision, nullable)
- `fiabilite` (text, NOT NULL, default: C3)
- `statut` (text, NOT NULL, CHECK: presume|confirme|corrige|perime)
- `maj_le` (timestamptz, NOT NULL, default: now())

## Table `appels`
- `id` (uuid, PK, default: gen_random_uuid())
- `titre` (text, NOT NULL)
- `audio_url` (text, NOT NULL) — URL publique Supabase Storage
- `audio_path` (text, nullable)
- `ts_debut_ms` (integer, NOT NULL, default: 0) — instant de declenchement timeline
- `duree_ms` (integer, NOT NULL, default: 0) — duree du clip
- `piste` (integer, NOT NULL, default: 0) — track dans la timeline
- `cree_le` (timestamptz, NOT NULL, default: now())
""".strip()


async def load_schema_snapshot() -> str:
    """Charge le schéma de la DB et retourne du Markdown compact.

    Essaye d'abord d'interroger information_schema.columns via supabase-py RPC.
    Si ça échoue (PostgREST n'expose pas les schémas système par défaut),
    utilise le schéma de référence intégré (basé sur les migrations appliquées).

    Returns:
        Une string Markdown listant toutes les tables applicatives (schéma public)
        avec leurs colonnes, types, contraintes et clés étrangères.
    """
    global _SCHEMA_CACHE

    # Essayer le chargement dynamique d'abord
    dynamic_schema = await _try_load_dynamic_schema()
    if dynamic_schema:
        logger.info("Schéma chargé dynamiquement depuis information_schema")
        _SCHEMA_CACHE = dynamic_schema
        return dynamic_schema

    # Fallback : schéma de référence statique
    logger.warning(
        "Impossible d'interroger information_schema (PostgREST n'expose pas les "
        "schémas système). Utilisation du schéma de référence intégré. "
        "Pensez à le mettre à jour si vous ajoutez des migrations."
    )
    _SCHEMA_CACHE = _REFERENCE_SCHEMA_MD
    return _REFERENCE_SCHEMA_MD


async def _try_load_dynamic_schema() -> str | None:
    """Tente de charger le schéma via information_schema.

    Returns:
        Markdown du schéma si réussi, None sinon.
    """
    try:
        client = _get_supabase_client()

        # Approche 1 : RPC vers une fonction d'introspection si elle existe
        try:
            result = client.rpc(
                "get_schema_info",
                params={"schema_name": "public"},
            ).execute()
            if result.data:
                return _format_schema_from_rpc(result.data)
        except Exception:
            logger.debug("RPC get_schema_info non disponible, tentative REST...")

        # Approche 2 : Interroger les tables connues via l'API REST
        # On liste les tables du schéma public en essayant un SELECT count(*)
        known_tables = ["interventions", "evenements", "entites", "appels",
                        "entities", "attributes"]  # 0001 EAV editor tables
        schema_lines: list[str] = []
        for table_name in known_tables:
            try:
                resp = client.table(table_name).select("*", count="exact").limit(0).execute()
                # Si on arrive ici, la table existe
                cols = await _get_table_columns(client, table_name)
                schema_lines.append(f"## Table `{table_name}`")
                for col in cols:
                    schema_lines.append(f"- `{col['name']}` ({col['type']})")
                schema_lines.append("")
            except Exception:
                logger.debug("Table %s non accessible via REST", table_name)
                continue

        if schema_lines:
            return "\n".join(schema_lines).strip()

        return None

    except Exception as exc:
        logger.warning("Chargement dynamique du schéma impossible : %s", exc)
        return None


async def _get_table_columns(client: Client, table_name: str) -> list[dict[str, Any]]:
    """Infère les colonnes d'une table en fetchant une ligne (best-effort)."""
    try:
        resp = client.table(table_name).select("*").limit(1).execute()
        if resp.data and len(resp.data) > 0:
            row = resp.data[0]
            return [
                {"name": key, "type": type(val).__name__ if val is not None else "unknown"}
                for key, val in row.items()
            ]
    except Exception:
        pass
    return []


def _format_schema_from_rpc(data: list[dict[str, Any]]) -> str:
    """Formate les données d'introspection RPC en Markdown."""
    from collections import defaultdict

    tables: dict[str, list[str]] = defaultdict(list)
    for row in data:
        table = row.get("table_name", row.get("table", ""))
        col = row.get("column_name", row.get("column", ""))
        dtype = row.get("data_type", row.get("type", ""))
        nullable = row.get("is_nullable", "")
        pk = "PK" if row.get("is_primary_key") else ""
        fk = f"FK → {row['fk_table']}.{row['fk_column']}" if row.get("fk_table") else ""

        extras = ", ".join(filter(None, [nullable, pk, fk]))
        line = f"- `{col}` ({dtype}"
        if extras:
            line += f", {extras}"
        line += ")"
        tables[table].append(line)

    sections = []
    for table, cols in sorted(tables.items()):
        sections.append(f"## Table `{table}`")
        sections.extend(cols)
        sections.append("")

    return "\n".join(sections).strip()


def get_schema() -> str:
    """Retourne le schéma en cache (doit avoir été chargé avant)."""
    if _SCHEMA_CACHE is None:
        raise RuntimeError(
            "Le schéma n'a pas encore été chargé. "
            "Appelez d'abord `await load_schema_snapshot()` au démarrage."
        )
    return _SCHEMA_CACHE


async def refresh_schema() -> str:
    """Recharge le schéma (vide le cache). Utile en dev ou après une migration."""
    global _SCHEMA_CACHE
    _SCHEMA_CACHE = None
    logger.info("Cache du schéma invalidé, rechargement...")
    return await load_schema_snapshot()
