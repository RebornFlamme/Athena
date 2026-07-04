"""
test_agent.py — Tests end-to-end du module memory_agent.

⚠ Ces tests hittent la vraie DB Supabase de dev + l'API Gemini.
Ils nécessitent :
- Les variables d'environnement configurées (SUPABASE_URL, GOOGLE_API_KEY, etc.)
- Une intervention de test dans la DB

L'intervention de test est créée avant les tests et supprimée après (cleanup).

Lancer avec :
    cd backend && python -m pytest memory_agent/tests/ -v

Sans les dépendances externes, utiliser le mode unitaire :
    cd backend && python -m pytest memory_agent/tests/test_agent.py -v -k "unit"
"""

from __future__ import annotations

import asyncio
import os
import sys
import uuid

import pytest

# Ajouter le parent au path pour permettre l'import du module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from memory_agent.tests.fixtures import SCENARIOS
from memory_agent.types import AgentDecision


# ── Helpers ───────────────────────────────────────────────────────────

def _needs_env():
    """Vérifie que les variables d'environnement nécessaires sont présentes."""
    required = [
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "SUPABASE_PROJECT_REF",
        "SUPABASE_ACCESS_TOKEN",
        "GOOGLE_API_KEY",
    ]
    missing = [v for v in required if not os.getenv(v)]
    return missing


missing_env = _needs_env()
NEEDS_EXTERNAL = len(missing_env) == 0


# ── Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def test_ids():
    """Génère des IDs de test uniques pour cette session de test."""
    return {
        "intervention_id": str(uuid.uuid4()),
        "session_id": f"test_session_{uuid.uuid4().hex[:8]}",
    }


@pytest.fixture(scope="session")
async def test_intervention(test_ids):
    """Crée une intervention de test dans Supabase, la nettoie après."""
    if not NEEDS_EXTERNAL:
        pytest.skip("Variables d'environnement manquantes : " + ", ".join(missing_env))

    from supabase import create_client
    from memory_agent.config import settings

    client = create_client(
        settings.supabase_url,
        settings.supabase_service_role_key or settings.supabase_anon_key,
    )

    # Créer l'intervention de test
    intervention_data = {
        "id": test_ids["intervention_id"],
        "titre": "TEST — Intervention mémoire agent",
        "statut": "active",
        "adresse": "12 rue de la Paix, Marseille",
        "lon": 5.36978,
        "lat": 43.29648,
    }

    resp = client.table("interventions").upsert(intervention_data).execute()
    assert resp is not None, "Échec de la création de l'intervention de test"

    yield test_ids

    # Cleanup : supprimer tout ce qui a été créé
    # L'ordre importe : entites d'abord (FK → interventions), puis interventions
    client.table("entites").delete().eq(
        "intervention_id", test_ids["intervention_id"]
    ).execute()
    client.table("evenements").delete().eq(
        "intervention_id", test_ids["intervention_id"]
    ).execute()
    client.table("interventions").delete().eq(
        "id", test_ids["intervention_id"]
    ).execute()


# ── Tests unitaires (pas de dépendances externes) ─────────────────────

class TestJsonParsing:
    """Tests du parseur JSON (pas besoin d'API externe)."""

    @pytest.mark.unit
    def test_parse_json_pur(self):
        """Le parseur reconnaît du JSON pur."""
        from memory_agent.agent import AgentSession

        result = AgentSession._parse_json_response(
            '{"took_action": true, "mutations": [], "agent_notes": "test"}'
        )
        assert result["took_action"] is True
        assert result["mutations"] == []
        assert result["agent_notes"] == "test"

    @pytest.mark.unit
    def test_parse_json_code_block(self):
        """Le parseur extrait le JSON d'un bloc ```json```."""
        from memory_agent.agent import AgentSession

        result = AgentSession._parse_json_response(
            'Voici le résultat :\n```json\n{"took_action": false, "mutations": [], "agent_notes": "rien à faire"}\n```\nVoilà.'
        )
        assert result["took_action"] is False
        assert result["agent_notes"] == "rien à faire"

    @pytest.mark.unit
    def test_parse_json_embedded(self):
        """Le parseur extrait le JSON entre accolades dans du texte."""
        from memory_agent.agent import AgentSession

        result = AgentSession._parse_json_response(
            "J'ai analysé l'utterance et voici ma décision : "
            '{"took_action": true, "mutations": [{"table": "entites", "operation": "INSERT", "summary": "test", "raw_sql": null}], "agent_notes": "ok"}'
            " Fin du message."
        )
        assert result["took_action"] is True
        assert len(result["mutations"]) == 1
        assert result["mutations"][0]["table"] == "entites"

    @pytest.mark.unit
    def test_parse_json_empty(self):
        """Le parseur gère une réponse vide."""
        from memory_agent.agent import AgentSession

        result = AgentSession._parse_json_response("")
        assert result["took_action"] is False
        assert result["mutations"] == []

    @pytest.mark.unit
    def test_parse_json_garbage(self):
        """Le parseur ne crash pas sur du texte sans JSON."""
        from memory_agent.agent import AgentSession

        result = AgentSession._parse_json_response("blablabla pas de json ici")
        assert result["took_action"] is False
        assert "JSON non parsable" in result["agent_notes"]


class TestConfig:
    """Tests de la configuration."""

    @pytest.mark.unit
    def test_settings_singleton(self):
        """Le singleton settings est accessible."""
        from memory_agent.config import settings, get_settings
        assert get_settings() is settings

    @pytest.mark.unit
    def test_mcp_server_url(self):
        """L'URL MCP est correctement construite."""
        from memory_agent.config import Settings
        s = Settings(
            supabase_project_ref="testref123",
            supabase_url="https://test.supabase.co",
            supabase_anon_key="anon",
            supabase_access_token="pat",
            google_api_key="key",
        )
        assert s.mcp_server_url == "https://mcp.supabase.com/mcp?project_ref=testref123"

    @pytest.mark.unit
    def test_mcp_server_url_missing_ref(self):
        """L'URL MCP raise si project_ref manquant."""
        from memory_agent.config import Settings
        s = Settings(
            supabase_project_ref="",
            supabase_url="https://test.supabase.co",
            supabase_anon_key="anon",
            supabase_access_token="pat",
            google_api_key="key",
        )
        with pytest.raises(ValueError, match="SUPABASE_PROJECT_REF"):
            _ = s.mcp_server_url


class TestPrompt:
    """Tests de la construction du prompt."""

    @pytest.mark.unit
    def test_build_system_prompt_minimal(self):
        """Le prompt est construit sans erreur avec des données minimales."""
        from memory_agent.prompt import build_system_prompt

        prompt = build_system_prompt(
            session_id="test_sid",
            intervention_id="test_iid",
            speaker_tag="caller",
            language_code="fr",
            timestamp="2026-07-04T14:30:00Z",
            intervention_snapshot="### Intervention\nPas de données",
            context_utterances=[],
        )
        assert "test_sid" in prompt
        assert "test_iid" in prompt
        assert "caller" in prompt
        assert "fr" in prompt

    @pytest.mark.unit
    def test_build_system_prompt_with_context(self):
        """Le prompt inclut les utterances de contexte."""
        from memory_agent.prompt import build_system_prompt

        prompt = build_system_prompt(
            session_id="s", intervention_id="i", speaker_tag="caller",
            language_code="fr", timestamp="2026-07-04T14:30:00Z",
            intervention_snapshot="### Snapshot",
            context_utterances=["première utterance", "deuxième utterance"],
        )
        assert "première utterance" in prompt
        assert "deuxième utterance" in prompt

    @pytest.mark.unit
    def test_build_system_prompt_no_context(self):
        """Le prompt gère l'absence d'utterances de contexte."""
        from memory_agent.prompt import build_system_prompt

        prompt = build_system_prompt(
            session_id="s", intervention_id="i", speaker_tag="caller",
            language_code="fr", timestamp="2026-07-04T14:30:00Z",
            intervention_snapshot="### Snapshot",
            context_utterances=[],
        )
        assert "aucune utterance précédente" in prompt.lower()


# ── Tests d'intégration (nécessitent Supabase + Gemini) ───────────────

@pytest.mark.integration
@pytest.mark.skipif(
    not NEEDS_EXTERNAL,
    reason=f"Variables d'environnement manquantes : {', '.join(missing_env) if missing_env else ''}",
)
class TestAgentIntegration:
    """Tests end-to-end avec la vraie DB et l'API Gemini.

    Chaque test correspond à un scénario de fixtures.py.
    """

    @pytest.fixture(autouse=True)
    async def setup_agent(self, test_intervention):
        """Initialise l'agent avant chaque test."""
        from memory_agent.agent import get_or_create_session

        self.intervention_id = test_intervention["intervention_id"]
        self.session_id = test_intervention["session_id"]
        self.session = await get_or_create_session(self.session_id, self.intervention_id)

    async def _run_scenario(self, scenario: dict) -> AgentDecision:
        """Exécute un scénario et retourne la décision."""
        from memory_agent.integration import process_utterance

        return await process_utterance(
            session_id=f"{self.session_id}_{scenario['name']}",
            intervention_id=self.intervention_id,
            utterance_text=scenario["utterance"],
            language_code="fr",
            speaker_tag=scenario.get("speaker_tag", "caller"),
            context_utterances=[],
            timestamp="2026-07-04T14:30:00Z",
        )

    async def _assert_scenario(self, scenario: dict):
        """Assertions génériques sur un scénario."""
        decision = await self._run_scenario(scenario)

        # Vérifier que la décision n'est pas None
        assert decision is not None
        assert decision.error is None, f"Erreur inattendue : {decision.error}"

        # Vérifier took_action
        assert decision.took_action == scenario["expected_took_action"], (
            f"[{scenario['name']}] took_action: attendu={scenario['expected_took_action']}, "
            f"obtenu={decision.took_action}. agent_notes={decision.agent_notes}"
        )

        # Vérifier le nombre de mutations
        if scenario["min_mutations"] > 0:
            assert len(decision.mutations) >= scenario["min_mutations"], (
                f"[{scenario['name']}] mutations: attendu ≥{scenario['min_mutations']}, "
                f"obtenu={len(decision.mutations)}. mutations={decision.mutations}"
            )

        # Vérifier que les opérations attendues sont présentes
        for expected_op in scenario["expected_operations"]:
            operations = [m.operation for m in decision.mutations]
            assert expected_op in operations, (
                f"[{scenario['name']}] opération {expected_op} non trouvée "
                f"dans {operations}"
            )

        # Vérifier que les tables attendues sont présentes
        for expected_table in scenario["expected_tables"]:
            tables = [m.table for m in decision.mutations]
            assert expected_table in tables, (
                f"[{scenario['name']}] table {expected_table} non trouvée "
                f"dans {tables}"
            )

        return decision

    @pytest.mark.asyncio
    async def test_nouvelle_victime(self):
        """Scénario : nouvelle victime signalée."""
        await self._assert_scenario(SCENARIOS[0])

    @pytest.mark.asyncio
    async def test_acknowledgment(self):
        """Scénario : accusé de réception → aucune action."""
        await self._assert_scenario(SCENARIOS[10])

    @pytest.mark.asyncio
    async def test_acknowledgment_ok(self):
        """Scénario : OK simple → aucune action."""
        await self._assert_scenario(SCENARIOS[11])

    @pytest.mark.asyncio
    async def test_filler_words(self):
        """Scénario : mots de remplissage → aucune action."""
        await self._assert_scenario(SCENARIOS[12])

    @pytest.mark.asyncio
    async def test_information_ambigue(self):
        """Scénario : information ambiguë → aucune action."""
        await self._assert_scenario(SCENARIOS[13])

    @pytest.mark.asyncio
    async def test_latency(self):
        """La latence est mesurée et raisonnable (< 30s par tour)."""
        decision = await self._run_scenario(SCENARIOS[10])  # acknowledgment simple
        assert decision.latency_ms > 0
        assert decision.latency_ms < 30_000, (
            f"Latence trop élevée : {decision.latency_ms}ms"
        )


# ── Smoke test (toujours exécuté) ─────────────────────────────────────

def test_import_module():
    """Le module s'importe sans erreur."""
    import memory_agent
    assert hasattr(memory_agent, "process_utterance")
    assert hasattr(memory_agent, "AgentDecision")
    assert hasattr(memory_agent, "Mutation")


def test_types_validation():
    """AgentDecision se construit correctement."""
    from memory_agent.types import AgentDecision, Mutation

    decision = AgentDecision(
        session_id="test",
        intervention_id="test",
        utterance_text="hello",
        took_action=True,
        mutations=[Mutation(
            table="entites",
            operation="INSERT",
            summary="test mutation",
        )],
        agent_notes="test notes",
        latency_ms=100,
        error=None,
    )
    assert decision.took_action is True
    assert len(decision.mutations) == 1
    assert decision.error is None


# ── Runner ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
