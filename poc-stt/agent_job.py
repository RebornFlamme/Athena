"""Job agent LLM (un par appel) — construit les instances d'objets au fil de l'eau.

Miroir du job de transcription (`transcribe_job`) : planifié progressivement à
`ts_debut_ms` et annulable par le même `stop_event`. Contrairement à l'ancienne
extraction (une passe unique en fin d'appel sur `entites`/`evenements`), cet agent
tourne EN CONTINU pendant l'appel :

    1. charge une fois le schéma dessiné (`entities`/`attributes`) dans son prompt ;
    2. sonde `transcriptions` toutes les POLL_SEC ;
    3. à chaque nouveau lot de segments, lance une boucle de function calling Gemini
       qui interroge les instances existantes (dédup inter-appels), puis crée / met à
       jour des `object_instances` et journalise `agent_journal` (raisonnement +
       edits) — d'où l'apparition en direct sur la carte, le panneau Objets, la
       couche sémantique et la trace du Sheet.

Chaque lot repart d'une conversation NEUVE : l'état partagé (ce qui existe déjà)
vient de la base via `query_instances`, pas d'un historique qui gonflerait le
contexte. La base est la source de vérité — et c'est ce qui rend la dédup
inter-appels possible.
"""

import logging
import os
import threading
import time

import google.generativeai as genai
from google.protobuf.json_format import MessageToDict

from agent_tools import GEMINI_TOOLS, OutilsAgent, charger_schema_text
from supabase_client import get_supabase

logger = logging.getLogger("poc-stt.agent")

# Modèle configurable ; défaut Gemini 2.5 Flash (rapide/économe) — plusieurs
# allers-retours de function calling par lot de segments.
AGENT_MODEL = os.getenv("AGENT_MODEL", "gemini-3.5-flash")

MAX_TOURS = 12       # tours de function calling max par lot de segments
POLL_SEC = 4.0       # cadence de sondage de `transcriptions`
IDLE_LIMIT = 12      # sondages vides consécutifs avant de clore (après ≥ 1 segment)

SYSTEME = """You are Athena's semantic agent, a real-time crisis-management \
dashboard for firefighters. ONE emergency call is assigned to you: you receive its \
transcription PROGRESSIVELY and build the operational picture live, as OBJECT \
INSTANCES.

The OBJECT TYPES you may create are defined by the user in the schema editor. \
Current schema:

{schema}

Method, on each new chunk of transcription:
1. First call `query_instances` (on the relevant type(s)) to see what ALREADY \
exists — INCLUDING what OTHER CALLS have created. The same victim or the same \
incident may have been reported on another call: in that case UPDATE the existing \
instance (`update_instance`) instead of duplicating it.
2. For each EXPLICIT fact, create (`create_instance`) or update the instance of the \
right type, filling `fields` according to that type's schema. Use the EXACT field \
names from the schema, keeping them verbatim even if they are written in another \
language (e.g. French).
3. If an address or place is given, call `geocoder` then set lon/lat on the instance \
(it will then appear on the map). NEVER invent a position.
4. Before acting, write ONE short sentence of reasoning (free text): it is logged as \
the trace.

Only extract what is explicitly stated. Invent nothing. If there is nothing new to \
do on this chunk, finish without calling a tool.

Write ALL of your reasoning in English."""


def _nouveaux_segments(sb, appel_id: str, apres_ordinal: int) -> list[dict]:
    """Segments `final` d'un appel d'ordinal strictement supérieur au dernier vu."""
    res = (
        sb.table("transcriptions")
        .select("ordinal, texte")
        .eq("appel_id", appel_id)
        .gt("ordinal", apres_ordinal)
        .order("ordinal")
        .execute()
    )
    return res.data or []


def _tour_outils(
    modele: genai.GenerativeModel,
    outils: OutilsAgent,
    messages: list,
    appel_id: str,
    stop_event: threading.Event | None,
) -> None:
    """Boucle de function calling Gemini sur un lot de segments.

    Chaque tour : envoie l'historique complet (`messages`) au modèle. Si la réponse
    contient un `function_call`, on exécute l'outil et on ajoute la réponse à
    l'historique pour le tour suivant. Sinon (pas de function call) → fin.
    """
    for _ in range(MAX_TOURS):
        if stop_event is not None and stop_event.is_set():
            return
        try:
            reponse = modele.generate_content(contents=messages)
        except Exception as exc:  # noqa: BLE001
            logger.error("Agent LLM KO (appel %s) : %s", appel_id, exc)
            return

        # Convertir la réponse protobuf → dict Python (snake_case).
        r = MessageToDict(reponse, preserving_proto_field_name=True)
        candidates = r.get("candidates", [])
        if not candidates:
            return

        parts = candidates[0].get("content", {}).get("parts", [])

        # Trace de raisonnement (blocs texte) → Sheet d'appel.
        for part in parts:
            texte = part.get("text", "") or ""
            if texte.strip():
                outils.journal_raisonnement(texte.strip())

        # Chercher les appels de fonction.
        appels_fn: list[tuple[str, dict]] = []
        for part in parts:
            fc = part.get("function_call")
            if fc:
                nom = fc.get("name", "")
                args = fc.get("args") or {}
                if nom:
                    appels_fn.append((nom, args))

        if not appels_fn:
            return  # Pas de function call → l'agent a fini pour ce lot.

        # Ajouter la réponse du modèle à l'historique.
        messages.append({"role": "model", "parts": parts})

        # Exécuter les outils et construire les FunctionResponse.
        resultats: list[dict] = []
        for nom, args in appels_fn:
            fn = getattr(outils, nom, None)
            try:
                sortie = fn(**args) if fn else {"erreur": f"outil inconnu {nom}"}
            except Exception as exc:  # noqa: BLE001
                logger.exception("Outil %s KO (appel %s)", nom, appel_id)
                sortie = {"erreur": str(exc)}
            resultats.append(
                {"function_response": {"name": nom, "response": sortie}}
            )
        messages.append({"role": "function", "parts": resultats})


def run_agent(appel: dict, stop_event: threading.Event | None = None) -> None:
    """Fait tourner l'agent sémantique d'un appel jusqu'à la fin de l'appel (ou stop).

    Args:
        appel: ligne `appels` (au moins `id`, `duree_ms`).
        stop_event: si déclenché (relance de simulation), l'agent s'arrête net.
    """
    appel_id = appel["id"]
    if stop_event is not None and stop_event.is_set():
        return
    if not os.getenv("GEMINI_API_KEY"):
        logger.warning("GEMINI_API_KEY absent — agent non lancé (appel %s)", appel_id)
        return

    # Configurer le SDK Gemini une fois (API key globale).
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

    sb = get_supabase()
    logger.info("Agent démarré pour l'appel %s (%s)", appel_id, appel.get("titre"))

    systeme = SYSTEME.format(schema=charger_schema_text(sb))
    outils = OutilsAgent(sb, appel_id)

    # Modèle Gemini avec consigne système + outils.
    modele = genai.GenerativeModel(
        model_name=AGENT_MODEL,
        system_instruction=systeme,
        tools=[GEMINI_TOOLS],
    )

    # Garde-fou d'horloge : on ne tourne pas au-delà de la durée de l'appel + marge
    # (sécurité si la transcription ne produit jamais de segment).
    duree_max_s = (appel.get("duree_ms") or 0) / 1000 + 120
    t0 = time.monotonic()

    dernier_ordinal = -1
    vides = 0

    while True:
        if stop_event is not None and stop_event.is_set():
            logger.info("Agent appel %s interrompu (relance)", appel_id)
            return
        if time.monotonic() - t0 > duree_max_s:
            break

        segments = _nouveaux_segments(sb, appel_id, dernier_ordinal)
        if not segments:
            vides += 1
            # Fin d'appel : plus rien n'arrive après avoir traité au moins un segment.
            if vides >= IDLE_LIMIT and dernier_ordinal >= 0:
                break
            time.sleep(POLL_SEC)
            continue

        vides = 0
        dernier_ordinal = segments[-1]["ordinal"]
        bloc = " ".join(s["texte"] for s in segments if s.get("texte"))
        # Conversation NEUVE par lot : l'état vient de la base (query_instances).
        messages = [
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            "Nouveaux segments de l'appel (traite-les) :\n\n" + bloc
                        )
                    }
                ],
            }
        ]
        _tour_outils(modele, outils, messages, appel_id, stop_event)
        time.sleep(POLL_SEC)

    logger.info("Agent appel %s terminé", appel_id)
