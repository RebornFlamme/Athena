# Module `memory_agent` — Agent de mémoire opérationnelle

Pont entre le pipeline STT (utterances transcrites) et la base de données Supabase.
Un agent LLM (Gemini 3.5 Flash via Google ADK) reçoit chaque utterance, consulte l'état
courant de l'intervention, et décide quelles mutations SQL exécuter via le serveur MCP
Supabase hosté.

## Architecture

```
poc-stt/main.py (WebSocket handler)
    │  à chaque utterance is_final
    ▼
integration.py :: process_utterance()
    │
    ▼
agent.py :: AgentSession.run_turn()
    │  1. Récupère snapshot DB (snapshot.py → supabase-py)
    │  2. Construit system prompt (prompt.py + schema_loader.py)
    │  3. Appelle Gemini 3.5 Flash via ADK → tool calls MCP → execute_sql
    │  4. Parse le JSON de réponse → AgentDecision
    ▼
AgentDecision (mutations + notes → logs + affichage frontend)
```

## Prérequis

- Python 3.11+
- Compte Google Cloud avec accès à Gemini 3.5 Flash
- Projet Supabase avec les migrations 0001, 0002, 0003 appliquées
- Un [Personal Access Token (PAT) Supabase](https://supabase.com/dashboard/account/tokens)

## Installation

```bash
cd backend
pip install -r memory_agent/requirements.txt
```

## Configuration

Créer un fichier `.env` dans le répertoire `backend/` (ou définir les variables d'environnement) :

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_PROJECT_REF=<project-ref>
SUPABASE_ACCESS_TOKEN=<personal-access-token>
GOOGLE_API_KEY=<gemini-api-key>
MEMORY_AGENT_MODEL=gemini-3.5-flash
MEMORY_AGENT_LOG_LEVEL=INFO
```

## Utilisation

```python
from memory_agent import process_utterance

decision = await process_utterance(
    session_id="ws_abc123",
    intervention_id="3f21a9e8-...",
    utterance_text="On a un homme de 45 ans, brûlé aux deux mains, au 3e étage",
    language_code="fr",
    speaker_tag="caller",
    context_utterances=["appel d'urgence, je vous écoute"],
    timestamp="2026-07-04T14:30:00Z",
)

print(decision.took_action)  # True
print(decision.mutations[0].summary)  # "Victime ajoutée : homme, 45 ans, brûlé aux mains"
print(decision.agent_notes)  # Narration de ce que l'agent a compris/fait
print(decision.latency_ms)   # Latence du tour en ms
```

## Branchement au pipeline STT

Dans `poc-stt/main.py`, au moment où une utterance passe `is_final: true` :

```python
from memory_agent import process_utterance

# Dans le handler WebSocket, après le flush d'utterance (timer 2.5s) :
decision = await process_utterance(
    session_id=ws_session_id,
    intervention_id=current_intervention_id,
    utterance_text=final_utterance,
    language_code=detected_language,
    speaker_tag=channel_speaker_tag,
    context_utterances=last_3_utterances,
    timestamp=datetime.utcnow().isoformat(),
)
# Les mutations apparaîtront en live via Supabase Realtime
```

## Tests

### Tests unitaires (pas de dépendances externes)

```bash
cd backend && python -m pytest memory_agent/tests/ -v -k "unit"
```

### Tests d'intégration (nécessitent Supabase + Gemini)

```bash
cd backend && python -m pytest memory_agent/tests/ -v -k "integration"
```

### Tous les tests

```bash
cd backend && python -m pytest memory_agent/tests/ -v
```

## Structure du module

```
memory_agent/
  __init__.py            # Re-export public API (process_utterance, types)
  config.py              # Settings via pydantic-settings (env vars)
  types.py               # Pydantic models (Mutation, AgentDecision, Utterance)
  schema_loader.py       # Cache du schéma DB au démarrage
  snapshot.py            # Snapshot d'intervention formaté (via supabase-py)
  prompt.py              # Construction du system prompt
  agent.py               # AgentSession ADK (cœur : McpToolset, LlmAgent, Runner)
  integration.py         # process_utterance() + startup_memory_agent()
  tests/
    __init__.py
    fixtures.py          # 15 scénarios scriptés
    test_agent.py        # Tests unitaires + intégration
  requirements.txt
  README.md
```

## Règles métier

L'agent suit 8 règles impératives, injectées dans le system prompt :

| # | Règle | Déclencheur |
|---|-------|-------------|
| 1 | **Nouvelle victime** | INSERT dans `entites` + `evenements` (VICTIME_SIGNALEE) |
| 2 | **Correction** | UPDATE la ligne + INSERT CORRECTION dans `evenements` |
| 3 | **Moyen engagé** | INSERT/UPDATE `entites` + événement MOYEN_PRESENTE/ARRIVE/DESENGAGE |
| 4 | **Aggravation** | UPDATE + INSERT ALERTE dans `evenements` |
| 5 | **Conversation vide** | NE RIEN FAIRE (accusés de réception, mots de remplissage) |
| 6 | **Incertitude** | NE RIEN FAIRE (mieux vaut ne rien faire que deviner) |
| 7 | **DELETE** | Autorisé UNIQUEMENT si erreur explicite ("oubliez ça", "on annule") |
| 8 | **SQL propre** | Une seule mutation par appel `execute_sql`, SQL paramétré |

## Notes techniques

- **Gemini 3.5 Flash** : ne PAS override temperature/top_p/top_k. Les défauts sont optimisés.
- **Thinking level** : `medium` par défaut. Si les décisions manquent de rigueur, passer à `high` (via la config ADK). Si la latence est trop élevée, `low`.
- **MCP** : le serveur MCP Supabase est contacté en HTTP hosté (`https://mcp.supabase.com/mcp`), PAS en subprocess npx local.
- **Schéma DB** : chargé UNE fois au démarrage et injecté dans le prompt. Pas de `list_tables` à chaque tour.
- **Tools MCP** : filtrés à `["execute_sql", "list_tables"]` uniquement. Les tools dangereux (`create_project`, `deploy_edge_function`) sont inaccessibles.
- **Latence cible** : < 2 secondes par utterance en moyenne.
- **Logs** : chaque `AgentDecision` est loggée en JSON au niveau INFO (audit trail).

## Démarrage

```python
# Dans le lifespan FastAPI :
from memory_agent import startup_memory_agent

app = FastAPI(lifespan=my_lifespan)

async def my_lifespan(app):
    await startup_memory_agent()
    yield
```
