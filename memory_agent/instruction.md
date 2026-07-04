# Spec — Module `memory_agent`

## Contexte du projet

On construit un système de mémoire opérationnelle partagée en temps réel pour un centre de traitement d'appels d'urgence (CTA pompiers). Un pipeline STT existant (Chirp 3 streaming, WebSocket + FastAPI Python) produit des utterances transcrites en français au fur et à mesure des appels et des communications radio. Ces utterances doivent maintenant alimenter une base Supabase (Postgres) qui représente l'état vivant de l'intervention : victimes, adresses, moyens engagés, état des lieux, etc.

Le module `memory_agent` est le pont entre "texte transcrit" et "mutations DB". Il utilise un agent LLM (Gemini 2.5 Flash via Google ADK) qui a accès à la DB Supabase via un serveur MCP officiel Supabase, et décide à chaque utterance quelles mutations effectuer.

## Objectif de CE module

Fournir une fonction publique unique `process_utterance()` qui, à partir d'une utterance transcrite et de son contexte, met à jour l'état de la mémoire opérationnelle dans Supabase, et retourne un résumé structuré des mutations effectuées (pour logs + affichage frontend).

## Ce qui EST dans le périmètre

- Setup ADK + connexion au serveur MCP Supabase hosté (HTTP + Bearer)
- Chargement du schéma DB au démarrage (via un tool MCP) et injection dans le system prompt
- Construction du system prompt avec règles métier
- Boucle agent : utterance → décision → tool calls MCP → mutations DB
- Récupération d'un snapshot de l'intervention active (via client Supabase Python direct, pas MCP) pour donner le contexte à chaque tour
- Interface publique claire pour brancher au pipeline STT
- Tests scriptés avec fixtures d'utterances

## Ce qui N'EST PAS dans le périmètre

- Le pipeline STT (déjà en place, ne pas y toucher)
- La traduction (autre module, tu reçois du français)
- Le frontend (utilise Supabase Realtime, découvre les mutations tout seul)
- L'authentification opérateur / RLS avancée
- Un système de rollback / undo
- La création du schéma initial de la DB (fait à part par un autre membre de l'équipe)

## Stack technique imposée

- **Python 3.11+**
- **Google ADK** : dernière version stable de `google-adk` (fournit `LlmAgent`, `McpToolset`, `Runner`, `InMemorySessionService`). Vérifier que la version installée supporte Gemini 3.5 Flash.
- **google-genai SDK v2.0.0+** OBLIGATOIRE (breaking changes vs v1.x, requis pour Gemini 3.5)
- **supabase-py** : client Python Supabase officiel pour les lectures directes de snapshot
- **pydantic** + **pydantic-settings** pour la config et les types
- **Gemini 3.5 Flash** comme LLM de l'agent (`model="gemini-3.5-flash"`). GA depuis mai 2026, optimisé pour workflows agentic et long-horizon avec function calling. Thought preservation activée par défaut (le reasoning se propage entre les tours multi-turn — pertinent si on décide plus tard de tenir une conversation stateful avec l'agent).
- **Serveur MCP Supabase hosté** : URL `https://mcp.supabase.com/mcp?project_ref=<PROJECT_REF>` (PAS le subprocess npx local), authentification via header `Authorization: Bearer <PAT>`

## Structure de dossiers à créer

```
backend/
  memory_agent/
    __init__.py            # expose process_utterance
    types.py               # Pydantic models (Utterance, AgentDecision, Mutation)
    config.py              # Settings via pydantic-settings (env vars)
    schema_loader.py       # fetch DB schema au startup, cache en mémoire
    prompt.py              # SYSTEM_PROMPT_TEMPLATE + build_system_prompt()
    snapshot.py            # récupère l'état d'une intervention active (Supabase-py)
    agent.py               # AgentSession class (wrapper ADK)
    integration.py         # process_utterance() — point d'entrée public
    tests/
      __init__.py
      fixtures.py          # utterances scriptées + résultats attendus
      test_agent.py        # tests end-to-end scriptés (sans WebSocket)
    README.md              # comment lancer, tester, brancher au STT
```

## Variables d'environnement (à ajouter au .env du backend)

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>                    # pour supabase-py (lectures snapshot)
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>    # si RLS activé, sinon anon suffit
SUPABASE_PROJECT_REF=<project-ref>              # pour scoper le MCP
SUPABASE_ACCESS_TOKEN=<personal-access-token>   # PAT Supabase, pour le MCP
GOOGLE_API_KEY=<gemini-api-key>                 # pour Gemini via ADK
MEMORY_AGENT_MODEL=gemini-3.5-flash             # override possible
MEMORY_AGENT_LOG_LEVEL=INFO
```

⚠ Le PAT Supabase se crée dans Account Settings > Access Tokens (pas dans les settings projet). Il donne accès à toute l'org, c'est pour ça que le scoping via `project_ref` est critique.

## Interface publique (contrat avec les autres modules)

Fichier `memory_agent/__init__.py` expose :

```python
async def process_utterance(
    session_id: str,
    intervention_id: str,
    utterance_text: str,
    language_code: str,
    speaker_tag: str,           # "operator", "caller", "chef_colonne", etc.
    context_utterances: list[str],  # 2-3 utterances précédentes de la session
    timestamp: str,             # ISO8601
) -> AgentDecision:
    ...
```

Où `AgentDecision` est un modèle Pydantic :

```python
class Mutation(BaseModel):
    table: str
    operation: Literal["INSERT", "UPDATE", "DELETE", "SELECT"]
    row_id: str | None            # si connu
    summary: str                  # description humaine ("victime ajoutée: homme, 45 ans")
    raw_sql: str | None           # SQL réellement exécuté (pour logs/audit)

class AgentDecision(BaseModel):
    session_id: str
    intervention_id: str
    utterance_text: str
    took_action: bool             # False si l'agent a jugé qu'il n'y avait rien à faire
    mutations: list[Mutation]     # peut être vide
    agent_notes: str              # narration courte de ce que l'agent a compris/fait
    latency_ms: int
    error: str | None
```

Le pipeline STT appellera cette fonction à chaque utterance `is_final`. Elle DOIT être async, DOIT gérer ses propres exceptions et retourner un `AgentDecision` avec `error` renseigné plutôt que de raise (sinon un plantage de l'agent kill toute la session STT).

## Étape 1 — `config.py`

Utiliser `pydantic-settings.BaseSettings` pour parser les env vars. Champs :

- `supabase_url`, `supabase_anon_key`, `supabase_service_role_key`, `supabase_project_ref`, `supabase_access_token`
- `google_api_key`
- `memory_agent_model` (default `"gemini-3.5-flash"`)
- `mcp_server_url` = property qui construit `f"https://mcp.supabase.com/mcp?project_ref={self.supabase_project_ref}"`

Exposer un singleton `settings = Settings()`.

## Étape 2 — `schema_loader.py`

**Objectif** : au démarrage du backend, charger le schéma de la DB (tables, colonnes, types, enums, foreign keys) et le mettre en cache pour l'injecter dans le system prompt.

**Comment** : utiliser directement `supabase-py` avec une requête sur `information_schema.columns` (pas besoin de passer par MCP pour ça, c'est plus rapide). Récupérer aussi les types enum via `pg_type` + `pg_enum`.

**Fonction principale** :

```python
async def load_schema_snapshot() -> str:
    """Retourne une string Markdown compacte décrivant toutes les tables applicatives.
    Format:
    ## Table `interventions`
    - `id` (uuid, PK)
    - `adresse` (text, nullable)
    - `statut` (enum: en_cours|clos|annulé)
    - ...
    ## Table `victimes`
    - `id` (uuid, PK)
    - `intervention_id` (uuid, FK → interventions.id)
    ...
    """
```

**Filtrer** : ne prendre que les tables du schéma `public` (exclure `auth`, `storage`, `realtime`, etc.).

**Cache** : la fonction est appelée une seule fois au startup du module. Résultat stocké en variable module-level `_SCHEMA_CACHE`. Une fonction `get_schema()` retourne le cache. Un CLI ou test peut appeler `refresh_schema()` pour recharger.

## Étape 3 — `prompt.py`

**Contenu** : un template Jinja2 (ou f-string, plus simple) pour le system prompt.

**Template à écrire (adapte au contexte final du projet)** :

```
Tu es l'agent de mémoire opérationnelle du centre de traitement d'appels d'urgence.
Ton rôle : à partir de chaque utterance transcrite d'un appel ou d'une communication radio,
mettre à jour la représentation partagée de l'intervention en cours dans la base de données Supabase.

## Contexte de la session
- Intervention active: {intervention_id}
- Session STT: {session_id}
- Speaker de l'utterance courante: {speaker_tag}
- Langue de l'utterance: {language_code}
- Timestamp: {timestamp}

## État actuel de l'intervention (snapshot)
{intervention_snapshot}

## Utterances précédentes (contexte)
{context_utterances_formatted}

## Schéma de la base de données
{schema_snapshot}

## Règles métier IMPÉRATIVES
1. Si l'utterance mentionne une NOUVELLE victime → INSERT dans `victimes` liée à `intervention_id`.
2. Si l'utterance CORRIGE une info existante (adresse, âge, symptôme) → UPDATE la ligne concernée.
3. Si l'utterance mentionne l'engagement d'un moyen (VSAV, FPT, etc.) → INSERT dans `moyens_engages`.
4. Si l'utterance décrit une AGGRAVATION → UPDATE le champ concerné ET INSERT dans `alertes` avec severité.
5. Si l'utterance est purement conversationnelle ("d'accord", "j'entends", "attendez") → NE RIEN FAIRE, retourne took_action=false.
6. Si tu ne sais pas → NE RIEN FAIRE et explique-toi dans agent_notes. NE JAMAIS deviner un INSERT.
7. Un DELETE est autorisé UNIQUEMENT si l'utterance dit explicitement "c'est une erreur", "oubliez ça", "on annule".
8. Toujours utiliser l'outil `execute_sql` avec du SQL paramétré propre. Une seule mutation par appel.

## Format de sortie
Après tes tool calls, retourne UN JSON avec cette structure exacte:
{{
  "took_action": bool,
  "mutations": [
    {{"table": "...", "operation": "INSERT|UPDATE|DELETE|SELECT", "summary": "...", "raw_sql": "..."}}
  ],
  "agent_notes": "..."
}}

Ne jamais mettre de texte hors du JSON dans ta réponse finale.
```

**Fonction principale** :

```python
def build_system_prompt(
    session_id: str,
    intervention_id: str,
    speaker_tag: str,
    language_code: str,
    timestamp: str,
    intervention_snapshot: str,
    context_utterances: list[str],
) -> str:
```

Le `{schema_snapshot}` est injecté depuis `schema_loader.get_schema()`.

## Étape 4 — `snapshot.py`

**Objectif** : récupérer un snapshot compact de l'intervention active, formaté en markdown pour être lu par le LLM.

**Fonction principale** :

```python
async def get_intervention_snapshot(intervention_id: str) -> str:
    """Fetch intervention + victimes + moyens_engages + alertes récentes.
    Retourne du markdown formaté :
    ### Intervention 3f21...
    - Adresse: 12 rue de la Paix, Marseille
    - Statut: en_cours
    - Nature: départ de feu
    ### Victimes (2)
    - Homme, ~45 ans, brûlé aux mains
    - Femme, ~50 ans, inhalation fumée, consciente
    ### Moyens engagés (3)
    - VSAV 12 (arrivé sur zone)
    - FPT 8 (en route)
    ### Alertes actives (0)
    """
```

Utilise `supabase-py` avec `create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`. Fetch en parallèle (asyncio.gather si le client le supporte, sinon en séquentiel — pas critique).

**Gestion d'erreur** : si l'intervention n'existe pas, retourner `"### Intervention non trouvée — pas encore créée en base"` (l'agent peut décider de la créer).

## Étape 5 — `agent.py`

**Le cœur du module**. Classe `AgentSession` qui encapsule la config ADK.

**Setup MCP toolset via HTTP** :

```python
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset, SseConnectionParams
# ATTENTION: pour du HTTP simple (pas SSE), ADK utilise StreamableHttpConnectionParams
# Vérifier la version d'ADK — si SseConnectionParams n'accepte pas de headers,
# utiliser StreamableHttpConnectionParams(url=..., headers={"Authorization": f"Bearer {token}"})
```

Note pour l'implémenteur : la doc ADK évolue vite. Consulter `https://adk.dev/tools-custom/mcp-tools/` au moment de l'implémentation pour le nom exact de la classe HTTP. Le comportement voulu : un `McpToolset` qui se connecte à `settings.mcp_server_url` avec un header `Authorization: Bearer {settings.supabase_access_token}`.

**Classe principale** :

```python
class AgentSession:
    def __init__(self, intervention_id: str, session_id: str):
        self.intervention_id = intervention_id
        self.session_id = session_id
        self._runner = None  # ADK Runner
        self._session_service = InMemorySessionService()
        self._agent = None

    async def initialize(self):
        """Crée le McpToolset, le LlmAgent, et le Runner ADK.
        À appeler une fois par session."""
        toolset = McpToolset(
            connection_params=<HTTP params avec Authorization header>,
            tool_filter=["execute_sql", "list_tables"],  # limiter la surface d'attaque
        )
        # Note: le system_prompt sera passé à chaque tour via l'instruction override,
        # car il change avec le snapshot d'intervention.
        self._agent = LlmAgent(
            model=settings.memory_agent_model,
            name="memory_agent",
            instruction="",  # override par tour
            tools=[toolset],
        )
        self._runner = Runner(
            agent=self._agent,
            app_name="memory_agent",
            session_service=self._session_service,
        )

    async def run_turn(
        self,
        utterance_text: str,
        speaker_tag: str,
        language_code: str,
        context_utterances: list[str],
        timestamp: str,
    ) -> AgentDecision:
        """Un tour d'agent. Récupère snapshot, construit prompt, invoke ADK,
        parse la sortie JSON, retourne AgentDecision."""

        start = time.perf_counter()
        try:
            snapshot = await get_intervention_snapshot(self.intervention_id)
            system_prompt = build_system_prompt(
                session_id=self.session_id,
                intervention_id=self.intervention_id,
                speaker_tag=speaker_tag,
                language_code=language_code,
                timestamp=timestamp,
                intervention_snapshot=snapshot,
                context_utterances=context_utterances,
            )
            # Override l'instruction de l'agent pour ce tour
            self._agent.instruction = system_prompt

            user_msg = f"Nouvelle utterance ({speaker_tag}): {utterance_text}"

            # Invoke via Runner. Voir doc ADK pour l'API exacte de run_async.
            events = self._runner.run_async(
                user_id=self.session_id,
                session_id=self.session_id,
                new_message=<construire types.Content avec user_msg>,
            )

            final_text = ""
            mutations_raw = []  # capturé depuis les mcp_tool_use events si besoin
            async for event in events:
                # tracer les tool calls pour audit
                # capturer la réponse finale textuelle
                ...

            # Parser le JSON final
            decision_data = json.loads(final_text)
            latency_ms = int((time.perf_counter() - start) * 1000)

            return AgentDecision(
                session_id=self.session_id,
                intervention_id=self.intervention_id,
                utterance_text=utterance_text,
                took_action=decision_data["took_action"],
                mutations=[Mutation(**m) for m in decision_data["mutations"]],
                agent_notes=decision_data["agent_notes"],
                latency_ms=latency_ms,
                error=None,
            )
        except Exception as e:
            latency_ms = int((time.perf_counter() - start) * 1000)
            logger.exception("Agent turn failed")
            return AgentDecision(
                session_id=self.session_id,
                intervention_id=self.intervention_id,
                utterance_text=utterance_text,
                took_action=False,
                mutations=[],
                agent_notes="",
                latency_ms=latency_ms,
                error=str(e),
            )

    async def close(self):
        """Nettoyer les ressources (MCP connection, etc.)."""
```

**Registre des sessions actives** : un dict module-level `_ACTIVE_SESSIONS: dict[str, AgentSession]` keyed par `session_id`, avec `get_or_create_session(session_id, intervention_id)`.

## Étape 6 — `integration.py`

Fichier ultra-court qui expose la fonction publique :

```python
async def process_utterance(
    session_id: str,
    intervention_id: str,
    utterance_text: str,
    language_code: str,
    speaker_tag: str,
    context_utterances: list[str],
    timestamp: str,
) -> AgentDecision:
    session = await get_or_create_session(session_id, intervention_id)
    return await session.run_turn(
        utterance_text=utterance_text,
        speaker_tag=speaker_tag,
        language_code=language_code,
        context_utterances=context_utterances,
        timestamp=timestamp,
    )
```

Et une fonction `startup_memory_agent()` à appeler depuis le `lifespan` de FastAPI, qui déclenche `schema_loader.load_schema_snapshot()`.

## Étape 7 — Tests scriptés (`tests/test_agent.py`)

**Objectif** : valider le comportement de l'agent sur 10-15 cas typiques SANS avoir besoin du STT live.

**Fixtures dans `fixtures.py`** : liste d'utterances scriptées avec attentes :

```python
SCENARIOS = [
    {
        "name": "nouvelle_victime",
        "utterance": "on a un homme d'environ 45 ans, brûlé aux deux mains",
        "expected_took_action": True,
        "expected_operations": ["INSERT"],
        "expected_tables": ["victimes"],
    },
    {
        "name": "correction_adresse",
        "utterance": "en fait c'est au 14 rue de la Paix, pas au 12",
        "expected_operations": ["UPDATE"],
        "expected_tables": ["interventions"],
    },
    {
        "name": "acknowledgment",
        "utterance": "d'accord bien reçu",
        "expected_took_action": False,
    },
    {
        "name": "moyen_engage",
        "utterance": "le VSAV 12 arrive sur zone",
        "expected_operations": ["INSERT"],
        "expected_tables": ["moyens_engages"],
    },
    # etc.
]
```

**Test runner** : itère sur les scénarios, appelle `process_utterance` avec des IDs de test, asserte les propriétés attendues sur l'`AgentDecision` retournée.

**⚠ Ces tests hittent la vraie DB Supabase de dev**. Utiliser un `intervention_id` de test qui est cleanup après chaque test (TRUNCATE ou DELETE via supabase-py dans une fixture pytest).

## Étape 8 — Intégration au pipeline STT existant

**À faire par toi (pas l'agent DeepSeek)** — juste pour info, à documenter dans le README.

Dans le handler WebSocket qui reçoit les events de Chirp 3, au moment où une utterance passe `is_final: true` et sort du buffer utterance (après le timer de silence de 2.5s), appeler :

```python
from memory_agent import process_utterance

decision = await process_utterance(
    session_id=ws_session_id,
    intervention_id=current_intervention_id,  # à résoudre depuis le contexte de l'appel
    utterance_text=final_utterance,
    language_code=detected_language,
    speaker_tag=channel_speaker_tag,
    context_utterances=last_3_utterances,
    timestamp=datetime.utcnow().isoformat(),
)
# Optionnel : broadcast la decision au frontend via un canal WS séparé (pour l'affichage "l'agent a fait X")
# Les mutations DB apparaîtront de toute façon en live via Supabase Realtime.
```

## Notes importantes pour l'implémenteur

### Spécificités Gemini 3.5 Flash

- **SDK obligatoire** : `google-genai>=2.0.0` (les breaking changes v2 sont requis pour 3.5). Si tu vois encore `import google.generativeai as genai` quelque part, c'est le vieux SDK legacy, à remplacer par `from google import genai`.
- **NE PAS** override `temperature`, `top_p`, `top_k` dans la config du LlmAgent. Les valeurs par défaut sont explicitement optimisées pour le reasoning du modèle 3.5. Y toucher dégrade les performances.
- **Thinking level** : le default est `medium` (baissé depuis `high` sur Gemini 3 Flash Preview). Pour notre use case (décisions courtes et rapides sur des utterances), `medium` est bien. Si les décisions manquent de rigueur, passer à `high`. Si la latence est trop élevée, `low`. Ne PAS utiliser l'ancien paramètre `thinking_budget` — il est remplacé par `thinking_level` avec les valeurs `minimal|low|medium|high`.
- **Function calling / MCP tool responses** : Gemini 3.5 impose que les `FunctionResponse` matchent strictement les `FunctionCall` précédents (id, name, count). ADK gère ça pour toi via `McpToolset`, mais si tu vois des erreurs "function response mismatch", c'est là qu'il faut regarder.
- **Thought preservation** activée par défaut : sur une conversation multi-tour, le raisonnement se propage. Pour nous ce n'est pas un problème (on override l'instruction à chaque tour), mais garde en tête si tu ajoutes du multi-turn plus tard.

### Autres notes

1. **NE PAS** utiliser le subprocess `npx` pour le MCP. Utilise le mode HTTP hosté avec Bearer auth. Plus simple, plus rapide au démarrage.

2. **NE PAS** demander à l'agent de charger le schéma via `list_tables` à chaque tour. Le schéma est chargé UNE fois au startup, injecté dans le prompt.

3. **NE PAS** exposer tous les tools MCP Supabase à l'agent. Filtre à `["execute_sql", "list_tables"]` uniquement via `tool_filter`. Les tools genre `create_project`, `pause_project`, `deploy_edge_function` sont dangereux et hors scope.

4. **Le JSON de sortie** de l'agent doit être strictement parsable. Dans le system prompt, insister "aucun texte hors du JSON". Si le parse échoue, retourner un `AgentDecision` avec `error` renseigné plutôt que de crash.

5. **Gestion des sessions ADK** : `InMemorySessionService` est OK pour hackathon. En prod on utiliserait `VertexAiSessionService` pour la persistance, mais overkill ici.

6. **Latence cible** : < 2 secondes par utterance en moyenne. Si tu dépasses, cause probable = trop de context dans le prompt (schéma trop verbeux, snapshot trop lourd). Compacter.

7. **Logs** : utiliser `logging` standard Python, logger chaque `AgentDecision` en JSON à niveau INFO. C'est ton audit trail.

8. **Consulter la doc ADK à l'implémentation** : `https://adk.dev/tools-custom/mcp-tools/` pour les noms exacts de classes HTTP MCP (l'API évolue). Consulter aussi `https://supabase.com/docs/guides/ai-tools/mcp` pour les paramètres URL du serveur MCP hosté.

## Checklist de livraison

- [ ] Structure de dossiers créée
- [ ] `config.py` avec toutes les env vars validées par Pydantic
- [ ] `schema_loader.load_schema_snapshot()` fonctionnel, retourne un markdown correct
- [ ] `snapshot.get_intervention_snapshot()` fonctionnel sur une intervention de test
- [ ] `prompt.build_system_prompt()` produit un prompt lisible et complet
- [ ] `AgentSession` initialise sans erreur, se connecte au MCP Supabase hosté
- [ ] Un tour d'agent complet marche : utterance → tool call MCP → mutation DB visible dans Supabase
- [ ] JSON de sortie de l'agent correctement parsé en `AgentDecision`
- [ ] Gestion d'erreur : un plantage de l'agent ne raise pas, retourne `AgentDecision(error=...)`
- [ ] Au moins 5 scénarios de test passent dans `test_agent.py` (avec cleanup DB entre chaque)
- [ ] README avec commande d'exécution des tests + comment brancher au STT
- [ ] Latence moyenne mesurée sur les scénarios de test, documentée dans le README

## Ordre d'implémentation recommandé

1. `config.py` + `types.py` (5 min)
2. `schema_loader.py` (test manuel : print le markdown généré)
3. `snapshot.py` (test manuel avec une intervention en dur)
4. `prompt.py` (test manuel : print le prompt final)
5. `agent.py` — commence par un "hello world" ADK qui liste juste les tables via MCP, valider la connexion
6. `agent.py` — ajoute le vrai flow avec instruction override et parse JSON
7. `integration.py`
8. `tests/` — un scénario d'abord, itère sur le prompt jusqu'à ce qu'il marche, puis ajoute les autres
9. Documenter dans le README

**Temps estimé pour un dev qui connaît Python** : 4-6 heures pour la version qui marche, +2h pour polish et tests. Fais le en une passe si tu peux, la conception est stable.