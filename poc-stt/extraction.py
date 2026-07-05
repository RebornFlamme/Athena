"""Extraction LLM — construit le tableau opérationnel d'un appel dans Supabase.

Job serveur lancé après la transcription d'un appel (`transcribe_job`). Au lieu
d'un simple appel « texte → JSON », Gemini pilote une **boucle d'outils** qui lit
et écrit le graphe d'entités réel (tables `entites` / `evenements`) :

    lister_entites → creer_entite / mettre_a_jour_entite / lier_entites / geocoder

C'est ce qui rend le rattachement INTELLIGENT : Gemini voit les objets déjà
créés (avec leur `id` stable), décide lui-même si un fait concerne un objet
existant (coréférence) ou un nouveau, et pose des relations entre objets
(victime « située dans » zone, moyen « engagé sur » sinistre).

Règle produit : l'IA propose, l'humain valide. Chaque écriture laisse une trace
dans le journal append-only `evenements` (avec `payload.extrait_source`).

Périmètre v1 : la résolution d'entités est cadrée PAR APPEL (`appel_id`) — pas de
liaison inter-appels (à sérialiser plus tard, les jobs tournent en parallèle).

Note : ce module est DORMANT — l'agent sémantique actif est `agent_job.py`
(qui écrit `object_instances` / `agent_journal`). Ce fichier est conservé
comme référence pour le pattern d'extraction sur les tables héritées
`entites` / `evenements`.
"""

import json
import logging
import os

from google import genai
from google.genai import types

from backend.models import GEMINI_MODEL_PRO

import geocodage_ign

logger = logging.getLogger("poc-stt.extraction")

# Intervention « propriétaire » de la simulation (les entités sont ancrées sur
# une intervention). Id fixe : tous les appels d'un run la partagent.
SIMULATION_INTERVENTION_ID = "00000000-0000-0000-0000-000000000001"

# Garde-fou : nombre max de tours de boucle d'outils par appel.
MAX_TOURS = 16

SYSTEME = """Tu es le module d'extraction d'Athena, un dashboard temps réel de gestion \
de crise pour sapeurs-pompiers. Tu reçois la transcription d'UN appel d'urgence et tu \
construis, via tes outils, le tableau opérationnel : des OBJETS (entités) posés sur la \
carte et reliés entre eux.

Méthode :
1. Commence TOUJOURS par `lister_entites` pour voir ce qui existe déjà pour cet appel.
2. Pour chaque fait explicite du transcript, décide : est-ce un objet EXISTANT (mets-le \
à jour avec son id) ou un objet NOUVEAU (crée-le) ? Ne crée jamais de doublon.
3. Relie les objets avec `lier_entites` : la ou les victimes sont « situee_dans » la zone \
du sinistre ; chaque moyen engagé est « engage_sur » le sinistre.
4. Si une adresse est donnée, appelle `geocoder`, puis positionne la zone du sinistre \
avec `mettre_a_jour_entite` (lon/lat) — statut "confirme" si le géocodage est fiable.

Types d'entités : "zone" (le sinistre / le lieu), "acteur" (victime, témoin), "moyen" \
(VSAV, FPT, EPA…). Champs d'`etat` recommandés :
- zone : nature, danger, nb_victimes, adresse
- acteur (victime) : presence, etat, localisation
- moyen : engage

Libellés lisibles : "Sinistre", "Victime #1", "VSAV 12". N'extrais QUE ce qui est \
EXPLICITEMENT dit. N'invente rien, surtout pas une adresse. Quand tu as tout traité, \
termine sans appeler d'outil."""

# --- Déclarations de fonctions Gemini ----------------------------------------
OUTILS: list[types.Tool] = [
    types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name="lister_entites",
                description=(
                    "Liste les entités déjà créées pour cet appel (id, type, libellé, "
                    "état, position)."
                ),
                parameters_json_schema={"type": "object", "properties": {}},
            ),
            types.FunctionDeclaration(
                name="creer_entite",
                description=(
                    "Crée une nouvelle entité. Renvoie son id. N'utilise que pour un "
                    "objet réellement nouveau."
                ),
                parameters_json_schema={
                    "type": "object",
                    "properties": {
                        "type": {
                            "type": "string",
                            "enum": ["zone", "acteur", "moyen"],
                        },
                        "libelle": {
                            "type": "string",
                            "description": "Libellé lisible, ex. 'Victime #1'.",
                        },
                        "sous_type": {
                            "type": "string",
                            "description": "Optionnel : victime, temoin, vsav, fpt…",
                        },
                        "etat": {
                            "type": "object",
                            "description": (
                                "État initial (paires champ→valeur), "
                                'ex. {"nature": "incendie"}.'
                            ),
                        },
                        "extrait_source": {
                            "type": "string",
                            "description": "Phrase exacte du transcript.",
                        },
                        "confiance": {"type": "number"},
                    },
                    "required": ["type", "libelle", "etat", "extrait_source", "confiance"],
                },
            ),
            types.FunctionDeclaration(
                name="mettre_a_jour_entite",
                description=(
                    "Met à jour une entité existante (fusion d'état, et/ou position "
                    "lon/lat, et/ou statut)."
                ),
                parameters_json_schema={
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "etat_patch": {"type": "object"},
                        "lon": {"type": "number"},
                        "lat": {"type": "number"},
                        "statut": {
                            "type": "string",
                            "enum": ["presume", "confirme"],
                        },
                        "extrait_source": {"type": "string"},
                        "confiance": {"type": "number"},
                    },
                    "required": ["id", "extrait_source"],
                },
            ),
            types.FunctionDeclaration(
                name="lier_entites",
                description=(
                    "Enregistre une relation entre deux entités "
                    "(ex. victime situee_dans zone)."
                ),
                parameters_json_schema={
                    "type": "object",
                    "properties": {
                        "source_id": {"type": "string"},
                        "cible_id": {"type": "string"},
                        "relation": {
                            "type": "string",
                            "description": "ex. situee_dans, engage_sur.",
                        },
                        "extrait_source": {"type": "string"},
                    },
                    "required": ["source_id", "cible_id", "relation"],
                },
            ),
            types.FunctionDeclaration(
                name="geocoder",
                description=(
                    "Géocode une adresse (IGN) → {lon, lat, fiable, label}. "
                    "Ne modifie rien."
                ),
                parameters_json_schema={
                    "type": "object",
                    "properties": {"adresse": {"type": "string"}},
                    "required": ["adresse"],
                },
            ),
        ]
    ),
]


def _fiabilite(confiance: float | None) -> str:
    """Code Admiralty simplifié depuis la confiance du modèle."""
    return "A2" if (confiance or 0) >= 0.85 else "B3"


def _intervention_simulation(sb) -> str:
    """Assure l'existence de l'intervention propriétaire de la simulation."""
    sb.table("interventions").upsert(
        {"id": SIMULATION_INTERVENTION_ID, "titre": "Simulation Athena"}
    ).execute()
    return SIMULATION_INTERVENTION_ID


class _Outils:
    """Implémentation des outils, liée à un appel (Supabase + périmètre)."""

    def __init__(self, sb, intervention_id: str, appel_id: str):
        self.sb = sb
        self.intervention_id = intervention_id
        self.appel_id = appel_id

    def lister_entites(self, **_) -> list[dict]:
        res = (
            self.sb.table("entites")
            .select("id, type, sous_type, libelle, etat, lon, lat, statut")
            .eq("appel_id", self.appel_id)
            .execute()
        )
        return res.data or []

    def creer_entite(
        self, type, libelle, etat, extrait_source, confiance, sous_type=None, statut="presume", **_
    ) -> dict:
        fiab = _fiabilite(confiance)
        ligne = (
            self.sb.table("entites")
            .insert({
                "intervention_id": self.intervention_id,
                "appel_id": self.appel_id,
                "type": type,
                "sous_type": sous_type,
                "libelle": libelle,
                "etat": etat or {},
                "fiabilite": fiab,
                "statut": statut if statut in ("presume", "confirme") else "presume",
            })
            .execute()
            .data[0]
        )
        self._journal(ligne["id"], type, "ENTITE_CREEE", {"etat": etat, "extrait_source": extrait_source}, fiab)
        return {"id": ligne["id"]}

    def mettre_a_jour_entite(
        self, id, extrait_source=None, etat_patch=None, lon=None, lat=None, statut=None, confiance=None, **_
    ) -> dict:
        actuelles = (
            self.sb.table("entites").select("etat, type").eq("id", id).execute().data
        )
        if not actuelles:
            return {"erreur": "entité introuvable"}
        etat = {**(actuelles[0].get("etat") or {}), **(etat_patch or {})}
        patch = {"etat": etat}
        if lon is not None:
            patch["lon"] = lon
        if lat is not None:
            patch["lat"] = lat
        if statut is not None:
            patch["statut"] = statut
        self.sb.table("entites").update(patch).eq("id", id).execute()
        self._journal(
            id, actuelles[0]["type"], "ENTITE_MAJ",
            {"patch": etat_patch, "lon": lon, "lat": lat, "extrait_source": extrait_source},
            _fiabilite(confiance),
        )
        return {"ok": True}

    def lier_entites(self, source_id, cible_id, relation, extrait_source=None, **_) -> dict:
        src = self.sb.table("entites").select("type, etat").eq("id", source_id).execute().data
        src_type = src[0]["type"] if src else "evenement"
        # Dénormalisation légère pour la carte : liste des rattachements sur la source.
        if src:
            etat = src[0].get("etat") or {}
            liens = etat.get("rattachements", [])
            liens.append({"relation": relation, "cible": cible_id})
            etat["rattachements"] = liens
            self.sb.table("entites").update({"etat": etat}).eq("id", source_id).execute()
        self._journal(
            source_id, src_type, "RELATION",
            {"source_id": source_id, "cible_id": cible_id, "relation": relation, "extrait_source": extrait_source},
            "B3",
        )
        return {"ok": True}

    def geocoder(self, adresse, **_) -> dict:
        try:
            r = geocodage_ign.geocoder(adresse)
        except Exception:  # noqa: BLE001
            return {"trouve": False, "erreur": "géocodage indisponible"}
        return {"trouve": bool(r), **(r or {})}

    def _journal(self, entity_id, entity_type, event_type, payload, fiabilite) -> None:
        self.sb.table("evenements").insert({
            "intervention_id": self.intervention_id,
            "appel_id": self.appel_id,
            "entity_id": entity_id,
            "entity_type": entity_type if entity_type in ("acteur", "moyen", "zone") else "evenement",
            "event_type": event_type,
            "payload": payload,
            "source": "appel_18",
            "fiabilite": fiabilite,
        }).execute()


def _transcript_appel(sb, appel_id: str) -> str:
    res = (
        sb.table("transcriptions")
        .select("texte")
        .eq("appel_id", appel_id)
        .order("ordinal")
        .execute()
    )
    return " ".join(s["texte"] for s in (res.data or []) if s.get("texte"))


def extraire_appel(appel: dict, sb) -> None:
    """Extrait le tableau opérationnel d'un appel (boucle d'outils → Supabase).

    Idempotent par run : on efface d'abord les faits déjà extraits pour cet appel
    (« à chaque lancement », cohérent avec la transcription).
    """
    appel_id = appel["id"]
    transcript = _transcript_appel(sb, appel_id)
    if len(transcript) < 20:
        logger.info("Extraction appel %s : transcript trop court, ignoré", appel_id)
        return

    api_key = os.environ.get("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY absent — extraction non lancée (appel %s)", appel_id)
        return

    # Client Gemini (nouveau SDK google-genai, supporte les clés AQ. et AIza).
    client = genai.Client(api_key=api_key)

    intervention_id = _intervention_simulation(sb)
    # Ardoise vierge pour cet appel (service_role bypass RLS — reset de démo).
    sb.table("evenements").delete().eq("appel_id", appel_id).execute()
    sb.table("entites").delete().eq("appel_id", appel_id).execute()

    outils = _Outils(sb, intervention_id, appel_id)

    config = types.GenerateContentConfig(
        system_instruction=SYSTEME,
        tools=OUTILS,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )

    history: list[types.Content] = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=f"Transcription de l'appel :\n\n{transcript}")],
        ),
    ]

    for _ in range(MAX_TOURS):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL_PRO,
                contents=history,
                config=config,
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("Extraction LLM KO (appel %s) : %s", appel_id, exc)
            break

        if not response.candidates or not response.candidates[0].content:
            break

        # 1. Ajouter la réponse du modèle à l'historique TELLE QUELLE.
        history.append(response.candidates[0].content)

        # 2. Extraire les function_calls.
        fcs = response.function_calls or []
        if not fcs:
            break  # Pas de function call → fin.

        # 3. Exécuter les outils et construire un Content role="tool".
        tool_parts: list[types.Part] = []
        for fc in fcs:
            fn = getattr(outils, fc.name, None)
            try:
                result = fn(**dict(fc.args)) if fn else {"erreur": f"outil inconnu {fc.name}"}
            except Exception as exc:  # noqa: BLE001
                logger.exception("Outil %s KO (appel %s)", fc.name, appel_id)
                result = {"erreur": str(exc)}
            tool_parts.append(
                types.Part.from_function_response(name=fc.name, response=result)
            )
        history.append(types.Content(role="tool", parts=tool_parts))

    n = len(outils.lister_entites())
    logger.info("Extraction appel %s terminée : %d entité(s)", appel_id, n)
