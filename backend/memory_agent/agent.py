"""
agent.py — Cœur du module memory_agent.

Encapsule la configuration ADK (Google Agent Development Kit) :
- Connexion au serveur MCP Supabase hosté (HTTP + Bearer)
- Création du LlmAgent (Gemini 3.5 Flash)
- Boucle agent : utterance → décision → tool calls MCP → mutations DB
- Parsing du JSON de sortie → AgentDecision

Chaque session STT a sa propre AgentSession (stateful via InMemorySessionService).
"""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Any

from .config import settings
from .types import AgentDecision, Mutation
from .snapshot import get_intervention_snapshot
from .prompt import build_system_prompt

logger = logging.getLogger(__name__)

# ── Module-level session registry ─────────────────────────────────────
# Keyed by session_id — permet de réutiliser l'agent entre les tours
# d'une même session STT (l'ADK est stateful via InMemorySessionService).
_ACTIVE_SESSIONS: dict[str, AgentSession] = {}


async def get_or_create_session(
    session_id: str,
    intervention_id: str,
) -> AgentSession:
    """Récupère ou crée une AgentSession pour une session STT donnée.

    Args:
        session_id: Identifiant de la session STT (WebSocket).
        intervention_id: UUID de l'intervention en cours.

    Returns:
        Une AgentSession initialisée (existante ou nouvelle).
    """
    if session_id in _ACTIVE_SESSIONS:
        session = _ACTIVE_SESSIONS[session_id]
        # Mettre à jour l'intervention_id si elle a changé
        if session.intervention_id != intervention_id:
            logger.info(
                "Changement d'intervention pour la session %s : %s → %s",
                session_id, session.intervention_id, intervention_id,
            )
            session.intervention_id = intervention_id
        return session

    session = AgentSession(intervention_id, session_id)
    await session.initialize()
    _ACTIVE_SESSIONS[session_id] = session
    logger.info(
        "Nouvelle AgentSession créée : session=%s, intervention=%s",
        session_id, intervention_id,
    )
    return session


# ── AgentSession ──────────────────────────────────────────────────────

class AgentSession:
    """Encapsule un agent ADK connecté au MCP Supabase.

    Usage :
        session = AgentSession(intervention_id, session_id)
        await session.initialize()
        decision = await session.run_turn(utterance_text="...", ...)
        # ...
        await session.close()
    """

    def __init__(self, intervention_id: str, session_id: str):
        self.intervention_id = intervention_id
        self.session_id = session_id
        self._runner = None
        self._session_service = None
        self._agent = None
        self._toolset = None
        self._turn_count = 0

    # ── Initialisation ADK ─────────────────────────────────────────

    async def initialize(self) -> None:
        """Initialise l'agent ADK : McpToolset → LlmAgent → Runner.

        Doit être appelé une seule fois par session, avant tout run_turn().

        Raises:
            RuntimeError: si les variables d'environnement critiques
                         (GOOGLE_API_KEY, SUPABASE_ACCESS_TOKEN, etc.)
                         ne sont pas configurées.
        """
        if not settings.is_configured:
            missing = []
            if not settings.supabase_url:
                missing.append("SUPABASE_URL")
            if not settings.supabase_anon_key:
                missing.append("SUPABASE_ANON_KEY")
            if not settings.supabase_project_ref:
                missing.append("SUPABASE_PROJECT_REF")
            if not settings.supabase_access_token:
                missing.append("SUPABASE_ACCESS_TOKEN")
            if not settings.google_api_key:
                missing.append("GOOGLE_API_KEY")
            raise RuntimeError(
                f"Configuration incomplète. Variables manquantes : {', '.join(missing)}. "
                f"Vérifiez votre fichier .env ou l'environnement."
            )

        try:
            # ── Imports ADK (tardifs pour éviter les crashs à l'import si non installé) ──
            from google.adk.tools.mcp_tool.mcp_toolset import (
                McpToolset,
                StreamableHttpConnectionParams,
            )
            from google.adk.agents import LlmAgent
            from google.adk.runners import Runner
            from google.adk.sessions import InMemorySessionService

            # Configurer l'API key Gemini (utilisée par google-genai en interne)
            import os
            os.environ["GOOGLE_API_KEY"] = settings.google_api_key

            # ── MCP Toolset (HTTP hosté, PAS npx local) ────────────
            mcp_url = settings.mcp_server_url
            logger.info("Connexion au MCP Supabase : %s", mcp_url[:80] + "...")

            connection_params = StreamableHttpConnectionParams(
                url=mcp_url,
                headers={
                    "Authorization": f"Bearer {settings.supabase_access_token}",
                },
            )

            self._toolset = McpToolset(
                connection_params=connection_params,
                tool_filter=["execute_sql", "list_tables"],
            )

            logger.info(
                "McpToolset créé — tools filtrés à [execute_sql, list_tables]"
            )

            # ── LlmAgent (Gemini 3.5 Flash) ────────────────────────
            # NE PAS override temperature/top_p/top_k — les défauts de
            # Gemini 3.5 sont optimisés pour le reasoning.
            self._agent = LlmAgent(
                model=settings.memory_agent_model,
                name="memory_agent",
                instruction="",  # override à chaque tour (snapshot + contexte)
                tools=[self._toolset],
            )

            # ── Runner + SessionService ────────────────────────────
            self._session_service = InMemorySessionService()
            self._runner = Runner(
                agent=self._agent,
                app_name="memory_agent",
                session_service=self._session_service,
            )

            logger.info(
                "AgentSession initialisée — modèle=%s, session=%s",
                settings.memory_agent_model,
                self.session_id,
            )

        except ImportError as e:
            raise RuntimeError(
                f"Dépendance ADK manquante : {e}. "
                f"Installez avec : pip install google-adk google-genai>=2.0.0"
            ) from e

    # ── Tour d'agent ──────────────────────────────────────────────

    async def run_turn(
        self,
        utterance_text: str,
        speaker_tag: str,
        language_code: str,
        context_utterances: list[str],
        timestamp: str,
    ) -> AgentDecision:
        """Exécute un tour d'agent complet.

        1. Récupère le snapshot de l'intervention
        2. Construit le system prompt (schéma + snapshot + contexte)
        3. Override l'instruction de l'agent
        4. Envoie l'utterance à l'agent (via ADK Runner)
        5. Capture les tool calls MCP (pour audit)
        6. Parse le JSON final → AgentDecision

        Args:
            utterance_text: Texte de l'utterance à traiter.
            speaker_tag: Rôle du locuteur.
            language_code: Code langue (ex: "fr").
            context_utterances: 2-3 dernières utterances.
            timestamp: Horodatage ISO 8601.

        Returns:
            AgentDecision (jamais None). En cas d'erreur, le champ
            `error` est renseigné et `took_action` est False.
        """
        self._turn_count += 1
        start = time.perf_counter()
        turn_id = f"{self.session_id}#{self._turn_count}"

        logger.info(
            "Tour %s — speaker=%s, utterance=%.60s...",
            turn_id, speaker_tag, utterance_text,
        )

        try:
            # 1. Snapshot de l'intervention
            snapshot = await get_intervention_snapshot(self.intervention_id)

            # 2. Construire le system prompt
            system_prompt = build_system_prompt(
                session_id=self.session_id,
                intervention_id=self.intervention_id,
                speaker_tag=speaker_tag,
                language_code=language_code,
                timestamp=timestamp,
                intervention_snapshot=snapshot,
                context_utterances=context_utterances,
            )

            # 3. Override l'instruction (le snapshot change à chaque tour)
            self._agent.instruction = system_prompt

            # 4. Construire le message utilisateur
            user_msg = f"Nouvelle utterance ({speaker_tag}): {utterance_text}"

            # 5. Invoquer l'agent via ADK Runner
            from google.adk.types import Content, Part

            user_content = Content(
                role="user",
                parts=[Part.from_text(text=user_msg)],
            )

            events = self._runner.run_async(
                user_id=self.session_id,
                session_id=self.session_id,
                new_message=user_content,
            )

            # 6. Streamer les événements : capturer tool calls + réponse finale
            final_text = ""
            tool_calls_log: list[dict[str, Any]] = []

            async for event in events:
                # Capturer les tool calls MCP (pour audit/logs)
                if hasattr(event, "tool_calls") and event.tool_calls:
                    for tc in event.tool_calls:
                        tc_info = {
                            "name": getattr(tc, "name", "unknown"),
                            "args": str(getattr(tc, "args", {}))[:200],
                        }
                        tool_calls_log.append(tc_info)
                        logger.info(
                            "Tour %s — tool call: %s(%.100s...)",
                            turn_id, tc_info["name"], tc_info["args"],
                        )

                # Capturer le texte final (réponse de l'agent après ses tool calls)
                if hasattr(event, "content") and event.content:
                    for part in getattr(event.content, "parts", []):
                        text = getattr(part, "text", "")
                        if text:
                            final_text += text

                # Certaines versions ADK exposent le texte final via `final_response`
                if hasattr(event, "final_response") and event.final_response:
                    fr = event.final_response
                    if hasattr(fr, "parts"):
                        for part in fr.parts:
                            text = getattr(part, "text", "")
                            if text:
                                final_text += text

            logger.info(
                "Tour %s — %d tool calls, réponse finale: %.80s...",
                turn_id, len(tool_calls_log), final_text,
            )

            # 7. Parser le JSON final
            decision_data = self._parse_json_response(final_text)

            latency_ms = int((time.perf_counter() - start) * 1000)

            decision = AgentDecision(
                session_id=self.session_id,
                intervention_id=self.intervention_id,
                utterance_text=utterance_text,
                took_action=decision_data.get("took_action", False),
                mutations=[
                    Mutation(**m) for m in decision_data.get("mutations", [])
                ],
                agent_notes=decision_data.get("agent_notes", ""),
                latency_ms=latency_ms,
                error=None,
            )

            # Log l'AgentDecision en JSON (audit trail)
            logger.info(
                "AgentDecision tour %s : took_action=%s, mutations=%d, latency=%dms",
                turn_id, decision.took_action, len(decision.mutations), decision.latency_ms,
            )
            logger.debug("AgentDecision complète : %s", decision.model_dump_json())

            return decision

        except Exception as exc:
            latency_ms = int((time.perf_counter() - start) * 1000)
            logger.exception("Tour %s — échec", turn_id)

            return AgentDecision(
                session_id=self.session_id,
                intervention_id=self.intervention_id,
                utterance_text=utterance_text,
                took_action=False,
                mutations=[],
                agent_notes=f"Erreur agent : {exc}",
                latency_ms=latency_ms,
                error=str(exc),
            )

    # ── Parsing JSON ───────────────────────────────────────────────

    @staticmethod
    def _parse_json_response(text: str) -> dict[str, Any]:
        """Extrait et parse le JSON de la réponse finale de l'agent.

        Essaie plusieurs stratégies (par ordre) :
        1. La réponse entière est du JSON
        2. Extraire du JSON entre ```json ... ```
        3. Extraire du JSON entre { } (première accolade à la dernière)
        4. Retourner un dict vide en fallback

        Args:
            text: Texte brut de la réponse finale.

        Returns:
            Dict parsé (peut être vide si aucun JSON trouvé).
        """
        if not text or not text.strip():
            logger.warning("Réponse finale vide — aucun JSON à parser")
            return {"took_action": False, "mutations": [], "agent_notes": "(réponse vide)"}

        text = text.strip()

        # Stratégie 1 : la réponse est du JSON pur
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Stratégie 2 : JSON dans un bloc ```json ... ```
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if match:
            try:
                return json.loads(match.group(1).strip())
            except json.JSONDecodeError:
                pass

        # Stratégie 3 : première { à la dernière }
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                pass

        # Fallback : pas de JSON trouvé
        logger.warning(
            "Impossible de parser le JSON de la réponse. "
            "Réponse brute (200 premiers caractères) : %.200s",
            text,
        )
        return {
            "took_action": False,
            "mutations": [],
            "agent_notes": f"(JSON non parsable) Réponse brute: {text[:300]}",
        }

    # ── Nettoyage ─────────────────────────────────────────────────

    async def close(self) -> None:
        """Ferme les connexions MCP et nettoie les ressources."""
        if self._toolset is not None:
            try:
                # Certaines versions ADK nécessitent un close explicite
                if hasattr(self._toolset, "close"):
                    await self._toolset.close()
                elif hasattr(self._toolset, "aclose"):
                    await self._toolset.aclose()
            except Exception as exc:
                logger.debug("Erreur (non bloquante) à la fermeture du toolset : %s", exc)

        # Retirer de la registry
        _ACTIVE_SESSIONS.pop(self.session_id, None)
        logger.info("AgentSession fermée : session=%s", self.session_id)
