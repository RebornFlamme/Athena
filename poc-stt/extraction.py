"""Extraction LLM — construit le tableau opérationnel d'un appel dans Supabase.

Job serveur lancé après la transcription d'un appel (`transcribe_job`). Gemini
pilote une **boucle d'outils** qui lit et écrit le graphe d'entités réel
(tables `entites` / `evenements`) :

    lister_entites → creer_entite / mettre_a_jour_entite / lier_entites / geocoder

C'est ce qui rend le rattachement INTELLIGENT : Gemini voit les objets déjà
créés (avec leur `id` stable), décide lui-même si un fait concerne un objet
existant (coréférence) ou un nouveau, et pose des relations entre objets
(victime « située dans » zone, moyen « engagé sur » sinistre).

Règle produit : l'IA propose, l'humain valide. Chaque écriture laisse une trace
dans le journal append-only `evenements` (avec `payload.extrait_source`).

Périmètre v1 : la résolution d'entités est cadrée PAR APPEL (`appel_id`) — pas de
liaison inter-appels (à sérialiser plus tard, les jobs tournent en parallèle).
"""

import json
import logging
import os

from google import genai
from google.genai import types

import geocodage_ign

logger = logging.getLogger("poc-stt.extraction")

# Modèle configurable ; défaut Gemini 2.5 Flash (rapide/économe) — la boucle d'outils
# fait plusieurs allers-retours par appel.
EXTRACTION_MODEL = os.getenv("EXTRACTION_MODEL", "gemini-2.5-flash")

# Intervention « propriétaire » de la simulation (les entités sont ancrées sur
# une intervention). Id fixe : tous les appels d'un run la partagent.
SIMULATION_INTERVENTION_ID = "00000000-0000-0000-0000-000000000001"

# Garde-fou : nombre max de tours de boucle d'outils par appel.
MAX_TOURS = 16

# ---------------------------------------------------------------------------
# Client Gemini (initialisé une fois)
# ---------------------------------------------------------------------------
_api_key = os.getenv("GEMINI_API_KEY")
if not _api_key:
    logger.warning(
        "GEMINI_API_KEY n'est pas définie — l'extraction LLM sera désactivée. "
        "Définissez-la dans l'environnement (Render → Environment)."
    )
_client = genai.Client(api_key=_api_key) if _api_key else None

# ---------------------------------------------------------------------------
# Prompt système
# ---------------------------------------------------------------------------
SYSTEME = (
    "Tu es le module d'extraction d'Athena, un dashboard temps réel de gestion "
    "de crise pour sapeurs-pompiers. Tu reçois la transcription d'UN appel d'urgence et tu "
    "construis, via tes outils, le tableau opérationnel : des OBJETS (entités) posés sur la "
    "carte et reliés entre eux.\n\n"
    "Méthode :\n"
    "1. Commence TOUJOURS par `lister_entites` pour voir ce qui existe déjà pour cet appel.\n"
    "2. Pour chaque fait explicite du transcript, décide : est-ce un objet EXISTANT (mets-le "
    "à jour avec son id) ou un objet NOUVEAU (crée-le) ? Ne crée jamais de doublon.\n"
    "3. Relie les objets avec `lier_entites` : la ou les victimes sont « situee_dans » la zone "
    "du sinistre ; chaque moyen engagé est « engage_sur » le sinistre.\n"
    "4. Si une adresse est donnée, appelle `geocoder`, puis positionne la zone du sinistre "
    "avec `mettre_a_jour_entite` (lon/lat) — statut \"confirme\" si le géocodage est fiable.\n\n"
    "Types d'entités : \"zone\" (le sinistre / le lieu), \"acteur\" (victime, témoin), \"moyen\" "
    "(VSAV, FPT, EPA…). Champs d'`etat` recommandés :\n"
    "- zone : nature, danger, nb_victimes, adresse\n"
    "- acteur (victime) : presence, etat, localisation\n"
    "- moyen : engage\n\n"
    "Libellés lisibles : \"Sinistre\", \"Victime #1\", \"VSAV 12\". N'extrais QUE ce qui est "
    "EXPLICITEMENT dit. N'invente rien, surtout pas une adresse. Quand tu as tout traité, "
    "termine sans appeler d'outil."
)

# ---------------------------------------------------------------------------
# Schémas d'outils (format Gemini = function_declarations avec `parameters`)
# ---------------------------------------------------------------------------
OUTILS = [
    {
        "name": "lister_entites",
        "description": "Liste les entités déjà créées pour cet appel (id, type, libellé, état, position).",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "creer_entite",
        "description": "Crée une nouvelle entité. Renvoie son id. N'utilise que pour un objet réellement nouveau.",
        "parameters": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["zone", "acteur", "moyen"]},
                "libelle": {"type": "string", "description": "Libellé lisible, ex. 'Victime #1'."},
                "sous_type": {"type": "string", "description": "Optionnel : victime, temoin, vsav, fpt…"},
                "etat": {
                    "type": "object",
                    "description": "État initial (paires champ→valeur), ex. {'nature': 'incendie'}.",
                    "additionalProperties": True,
                },
                "extrait_source": {"type": "string", "description": "Phrase exacte du transcript."},
                "confiance": {"type": "number"},
            },
            "required": ["type", "libelle", "etat", "extrait_source", "confiance"],
        },
    },
    {
        "name": "mettre_a_jour_entite",
        "description": "Met à jour une entité existante (fusion d'état, et/ou position lon/lat, et/ou statut).",
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "etat_patch": {"type": "object", "additionalProperties": True},
                "lon": {"type": "number"},
                "lat": {"type": "number"},
                "statut": {"type": "string", "enum": ["presume", "confirme"]},
                "extrait_source": {"type": "string"},
                "confiance": {"type": "number"},
            },
            "required": ["id", "extrait_source"],
        },
    },
    {
        "name": "lier_entites",
        "description": "Enregistre une relation entre deux entités (ex. victime situee_dans zone).",
        "parameters": {
            "type": "object",
            "properties": {
                "source_id": {"type": "string"},
                "cible_id": {"type": "string"},
                "relation": {"type": "string", "description": "ex. situee_dans, engage_sur."},
                "extrait_source": {"type": "string"},
            },
            "required": ["source_id", "cible_id", "relation"],
        },
    },
    {
        "name": "geocoder",
        "description": "Géocode une adresse (IGN) → {lon, lat, fiable, label}. Ne modifie rien.",
        "parameters": {
            "type": "object",
            "properties": {"adresse": {"type": "string"}},
            "required": ["adresse"],
        },
    },
]

# Configuration Gemini — réutilisée pour chaque appel (read-only, thread-safe)
_GEMINI_CONFIG = types.GenerateContentConfig(
    system_instruction=SYSTEME,
    tools=[types.Tool(function_declarations=OUTILS)],
    temperature=0.2,  # extraction = tâche structurée → basse température
)


# ============================================================================
# Code Admiralty
# ============================================================================
def _fiabilite(confiance: float | None) -> str:
    """Code Admiralty simplifié depuis la confiance du modèle."""
    return "A2" if (confiance or 0) >= 0.85 else "B3"


def _intervention_simulation(sb) -> str:
    """Assure l'existence de l'intervention propriétaire de la simulation."""
    sb.table("interventions").upsert(
        {"id": SIMULATION_INTERVENTION_ID, "titre": "Simulation Athena"}
    ).execute()
    return SIMULATION_INTERVENTION_ID


# ============================================================================
# Implémentation des outils (liée à un appel — Supabase + périmètre)
# ============================================================================
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


# ============================================================================
# Helpers
# ============================================================================
def _transcript_appel(sb, appel_id: str) -> str:
    res = (
        sb.table("transcriptions")
        .select("texte")
        .eq("appel_id", appel_id)
        .order("ordinal")
        .execute()
    )
    return " ".join(s["texte"] for s in (res.data or []) if s.get("texte"))


# ============================================================================
# Point d'entrée principal
# ============================================================================
def extraire_appel(appel: dict, sb) -> None:
    """Extrait le tableau opérationnel d'un appel (boucle d'outils → Supabase).

    Idempotent par run : on efface d'abord les faits déjà extraits pour cet appel
    (« à chaque lancement », cohérent avec la transcription).
    """
    if _client is None:
        logger.warning("[EXTRACT] Client Gemini non initialisé (GEMINI_API_KEY manquante) — extraction ignorée")
        return

    appel_id = appel["id"]
    logger.info("[EXTRACT %s] ===== DÉBUT EXTRACTION =====", appel_id)

    logger.info("[EXTRACT %s] Lecture du transcript...", appel_id)
    transcript = _transcript_appel(sb, appel_id)
    logger.info("[EXTRACT %s] Transcript : %d caractères", appel_id, len(transcript))

    if len(transcript) < 20:
        logger.info("[EXTRACT %s] ⚠ Transcript trop court (< 20 chars), ignoré", appel_id)
        return

    logger.info("[EXTRACT %s] Transcript : « %.200s »", appel_id, transcript)

    intervention_id = _intervention_simulation(sb)
    logger.info("[EXTRACT %s] Intervention simulation : %s", appel_id, intervention_id)

    # Ardoise vierge pour cet appel (service_role bypass RLS — reset de démo).
    try:
        sb.table("evenements").delete().eq("appel_id", appel_id).execute()
        sb.table("entites").delete().eq("appel_id", appel_id).execute()
        logger.info("[EXTRACT %s] Anciennes entités/événements supprimés", appel_id)
    except Exception as exc:  # noqa: BLE001
        logger.error("[EXTRACT %s] ❌ Delete entités/événements KO : %s", appel_id, exc, exc_info=True)
        # Non bloquant : continue

    outils = _Outils(sb, intervention_id, appel_id)

    # Conversation initiale (format Gemini : liste de Content)
    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=f"Transcription de l'appel :\n\n{transcript}")],
        )
    ]

    for tour in range(MAX_TOURS):
        logger.info("[EXTRACT %s] --- Tour %d/%d ---", appel_id, tour + 1, MAX_TOURS)
        try:
            reponse = _client.models.generate_content(
                model=EXTRACTION_MODEL,
                contents=contents,
                config=_GEMINI_CONFIG,
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("[EXTRACT %s] ❌ Appel Gemini KO au tour %d : %s", appel_id, tour + 1, exc, exc_info=True)
            break

        if not reponse.candidates:
            logger.error("[EXTRACT %s] ❌ Gemini n'a renvoyé aucun candidat", appel_id)
            break

        candidat = reponse.candidates[0]
        if not candidat.content or not candidat.content.parts:
            logger.info("[EXTRACT %s] Réponse vide — fin", appel_id)
            break

        # Déterminer si le modèle appelle des fonctions
        function_calls = []
        text_parts = []
        for part in candidat.content.parts:
            fc = getattr(part, "function_call", None)
            if fc is not None:
                function_calls.append(fc)
            txt = getattr(part, "text", None)
            if txt:
                text_parts.append(txt)

        # Logger le texte si présent
        for txt in text_parts:
            logger.info("[EXTRACT %s] Gemini (texte) : « %.200s »", appel_id, txt)

        if not function_calls:
            logger.info("[EXTRACT %s] Gemini a terminé (pas d'appel d'outil)", appel_id)
            break

        # Ajouter la réponse du modèle à l'historique
        contents.append(
            types.Content(role="model", parts=list(candidat.content.parts))
        )

        # Exécuter les outils et construire les function_response
        function_response_parts = []
        for fc in function_calls:
            logger.info("[EXTRACT %s] 🔧 Outil appelé : %s(%s)", appel_id, fc.name,
                        json.dumps(fc.args, ensure_ascii=False, default=str) if fc.args else "{}")
            fn = getattr(outils, fc.name, None)
            try:
                args = dict(fc.args) if fc.args else {}
                sortie = fn(**args) if fn else {"erreur": f"outil inconnu {fc.name}"}
                logger.info("[EXTRACT %s] ✅ Résultat %s : %s", appel_id, fc.name,
                            json.dumps(sortie, ensure_ascii=False, default=str)[:200])
            except Exception as exc:  # noqa: BLE001
                logger.exception("[EXTRACT %s] ❌ Outil %s en échec : %s", appel_id, fc.name, exc)
                sortie = {"erreur": str(exc)}
            function_response_parts.append(
                types.Part.from_function_response(name=fc.name, response=sortie)
            )

        # Ajouter les résultats d'outils à l'historique
        contents.append(
            types.Content(role="user", parts=function_response_parts)
        )

    if tour + 1 >= MAX_TOURS and function_calls:
        logger.warning("[EXTRACT %s] ⚠ MAX_TOURS (%d) atteint — boucle interrompue", appel_id, MAX_TOURS)

    n = len(outils.lister_entites())
    logger.info("[EXTRACT %s] ✅ Extraction terminée : %d entité(s) créée(s)", appel_id, n)
