"""Outils de l'agent sémantique (tool-use natif Anthropic — le « MCP » in-process).

Donne à l'agent LLM (un par appel, cf. `agent_job`) la capacité de :

    query_schema     → lire le méta-schéma EAV dessiné par l'utilisateur
                       (tables `entities`/`attributes`) : les TYPES d'objets qu'il
                       peut instancier et leurs champs.
    query_instances  → lister les instances déjà créées — TOUS APPELS CONFONDUS —
                       pour dédupliquer (« cette victime existe peut-être déjà »).
    create_instance  → créer une instance d'un type (table `object_instances`).
    update_instance  → mettre à jour une instance existante (fusion de champs,
                       position lon/lat, statut).
    geocoder         → géocoder une adresse (IGN) → lon/lat pour la carte.

Chaque écriture journalise une ligne dans `agent_journal` : les blocs de
raisonnement alimentent la « stack trace » du Sheet d'appel, les create/update
alimentent la couche sémantique (diff champ par champ) et sont visibles dans le
panneau Objets ; les instances positionnées apparaissent sur la carte.

Pas de serveur réseau : ce sont de simples fonctions Python dispatchées par la
boucle d'outils. Écritures via le client `service_role` (bypass RLS).
"""

import json
import logging
from datetime import datetime, timezone

import geocodage_ign

logger = logging.getLogger("poc-stt.agent.tools")

STATUTS_OK = ("presume", "confirme", "corrige", "perime")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _s(v) -> str | None:
    """Sérialise une valeur en texte pour un diff (avant/apres attendus en string|null)."""
    if v is None:
        return None
    if isinstance(v, str):
        return v
    if isinstance(v, (int, float, bool)):
        return str(v)
    return json.dumps(v, ensure_ascii=False, default=str)


def _lire_schema(sb) -> list[dict]:
    """Lit le méta-schéma EAV : chaque type d'objet + ses champs ordonnés."""
    ents = (
        sb.table("entities")
        .select("id, name, is_subobject, color")
        .order("created_at")
        .execute()
        .data
        or []
    )
    attrs = (
        sb.table("attributes")
        .select(
            "entity_id, name, data_type, is_list, enum_values, target_entity_id, required, ordinal"
        )
        .execute()
        .data
        or []
    )
    par_entite: dict[str, list[dict]] = {}
    for a in attrs:
        par_entite.setdefault(a["entity_id"], []).append(a)
    for e in ents:
        e["champs"] = sorted(par_entite.get(e["id"], []), key=lambda x: x.get("ordinal") or 0)
    return ents


def charger_schema_text(sb) -> str:
    """Rendu texte du schéma pour l'injecter dans le system prompt de l'agent."""
    ents = _lire_schema(sb)
    if not ents:
        return "(aucun type d'objet défini dans l'éditeur de schéma)"
    lignes: list[str] = []
    for e in ents:
        suffixe = " [sous-objet]" if e.get("is_subobject") else ""
        lignes.append(f"- Type « {e['name']} » (schema_entity_id: {e['id']}){suffixe}")
        for a in e["champs"]:
            t = a["data_type"] + ("[]" if a.get("is_list") else "")
            req = " (requis)" if a.get("required") else ""
            enum = ""
            if a.get("enum_values"):
                enum = f" ∈ {{{', '.join(a['enum_values'])}}}"
            lignes.append(f"    • {a['name']} : {t}{req}{enum}")
    return "\n".join(lignes)


# --- Schémas d'outils (JSON) -------------------------------------------------
OUTILS = [
    {
        "name": "query_schema",
        "description": (
            "Retourne le schéma des TYPES d'objets définis par l'utilisateur "
            "(nom, schema_entity_id, champs typés). À consulter pour savoir quels "
            "objets créer et quels champs remplir."
        ),
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "query_instances",
        "description": (
            "Liste les instances d'objets déjà créées, TOUS APPELS CONFONDUS "
            "(les plus récentes d'abord). Sert à repérer si un objet (une victime, "
            "un sinistre…) a déjà été créé — par cet appel ou un autre — avant d'en "
            "créer un nouveau. Filtre optionnel par type."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "type_name": {"type": "string", "description": "Nom du type à filtrer (optionnel)."},
                "limit": {"type": "integer", "description": "Max d'instances (défaut 30)."},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "create_instance",
        "description": (
            "Crée une nouvelle instance d'objet. N'utilise que pour un objet "
            "réellement nouveau (sinon update_instance). Renvoie son id."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "type_name": {"type": "string", "description": "Nom exact du type (cf. schéma)."},
                "schema_entity_id": {"type": "string", "description": "id du type (cf. schéma)."},
                "libelle": {"type": "string", "description": "Libellé lisible, ex. 'Victime #1'."},
                "fields": {
                    "type": "object",
                    "description": "Valeurs des champs conformes au type, ex. {\"etat\": \"inconscient\"}.",
                    "additionalProperties": True,
                },
                "lon": {"type": "number", "description": "Longitude (si position connue)."},
                "lat": {"type": "number", "description": "Latitude (si position connue)."},
                "statut": {"type": "string", "enum": list(STATUTS_OK)},
                "extrait_source": {"type": "string", "description": "Phrase exacte du transcript."},
            },
            "required": ["type_name", "libelle", "fields", "extrait_source"],
            "additionalProperties": False,
        },
    },
    {
        "name": "update_instance",
        "description": (
            "Met à jour une instance existante (fusion des champs, et/ou position "
            "lon/lat, et/ou statut). Utilise l'id renvoyé par query_instances."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "patch_fields": {"type": "object", "additionalProperties": True},
                "lon": {"type": "number"},
                "lat": {"type": "number"},
                "statut": {"type": "string", "enum": list(STATUTS_OK)},
                "extrait_source": {"type": "string"},
            },
            "required": ["id", "extrait_source"],
            "additionalProperties": False,
        },
    },
    {
        "name": "geocoder",
        "description": "Géocode une adresse (IGN) → {lon, lat, fiable, label}. Ne modifie rien.",
        "input_schema": {
            "type": "object",
            "properties": {"adresse": {"type": "string"}},
            "required": ["adresse"],
            "additionalProperties": False,
        },
    },
]


class OutilsAgent:
    """Implémentation des outils, liée à un appel (Supabase service_role + périmètre)."""

    def __init__(self, sb, appel_id: str):
        self.sb = sb
        self.appel_id = appel_id
        # nom de type → schema_entity_id, pour résoudre create_instance sans id explicite.
        self._types = {e["name"]: e["id"] for e in _lire_schema(sb)}

    # -- lecture -------------------------------------------------------------
    def query_schema(self, **_) -> list[dict]:
        return [
            {
                "schema_entity_id": e["id"],
                "type_name": e["name"],
                "is_subobject": e.get("is_subobject", False),
                "champs": [
                    {
                        "nom": a["name"],
                        "type": a["data_type"],
                        "liste": a.get("is_list", False),
                        "requis": a.get("required", False),
                        "enum": a.get("enum_values"),
                    }
                    for a in e["champs"]
                ],
            }
            for e in _lire_schema(self.sb)
        ]

    def query_instances(self, type_name=None, limit=30, **_) -> list[dict]:
        q = self.sb.table("object_instances").select(
            "id, type_name, libelle, fields, lon, lat, statut, appel_id, maj_le"
        )
        if type_name:
            q = q.eq("type_name", type_name)
        res = q.order("maj_le", desc=True).limit(min(int(limit or 30), 100)).execute()
        return res.data or []

    # -- écriture ------------------------------------------------------------
    def create_instance(
        self,
        type_name,
        libelle,
        fields=None,
        schema_entity_id=None,
        lon=None,
        lat=None,
        statut="presume",
        extrait_source=None,
        **_,
    ) -> dict:
        sid = schema_entity_id or self._types.get(type_name)
        ligne = (
            self.sb.table("object_instances")
            .insert(
                {
                    "schema_entity_id": sid,
                    "type_name": type_name,
                    "libelle": libelle,
                    "fields": fields or {},
                    "lon": lon,
                    "lat": lat,
                    "appel_id": self.appel_id,
                    "statut": statut if statut in STATUTS_OK else "presume",
                }
            )
            .execute()
            .data[0]
        )
        diff = [{"champ": k, "avant": None, "apres": _s(v)} for k, v in (fields or {}).items()]
        if lon is not None and lat is not None:
            diff.append({"champ": "position", "avant": None, "apres": f"{lat:.5f}, {lon:.5f}"})
        self._journal(ligne["id"], "creation", libelle, extrait_source, diff)
        return {"id": ligne["id"]}

    def update_instance(
        self, id, patch_fields=None, lon=None, lat=None, statut=None, extrait_source=None, **_
    ) -> dict:
        actuel = (
            self.sb.table("object_instances")
            .select("fields, libelle, lon, lat, statut")
            .eq("id", id)
            .execute()
            .data
        )
        if not actuel:
            return {"erreur": "instance introuvable"}
        cur = actuel[0]
        anciens = cur.get("fields") or {}
        patch: dict = {"fields": {**anciens, **(patch_fields or {})}, "maj_le": _now_iso()}
        diff = [
            {"champ": k, "avant": _s(anciens.get(k)), "apres": _s(v)}
            for k, v in (patch_fields or {}).items()
        ]
        if lon is not None:
            patch["lon"] = lon
        if lat is not None:
            patch["lat"] = lat
        if lon is not None and lat is not None:
            avant = (
                f"{cur['lat']:.5f}, {cur['lon']:.5f}" if cur.get("lat") is not None else None
            )
            diff.append({"champ": "position", "avant": avant, "apres": f"{lat:.5f}, {lon:.5f}"})
        if statut is not None:
            patch["statut"] = statut
            diff.append({"champ": "statut", "avant": _s(cur.get("statut")), "apres": _s(statut)})
        self.sb.table("object_instances").update(patch).eq("id", id).execute()
        self._journal(id, "modification", cur.get("libelle"), extrait_source, diff)
        return {"ok": True}

    def geocoder(self, adresse, **_) -> dict:
        try:
            r = geocodage_ign.geocoder(adresse)
        except Exception:  # noqa: BLE001
            return {"trouve": False, "erreur": "géocodage indisponible"}
        return {"trouve": bool(r), **(r or {})}

    # -- journal -------------------------------------------------------------
    def journal_raisonnement(self, texte: str) -> None:
        """Trace une étape de raisonnement (bloc texte de l'agent) → Sheet d'appel."""
        self._journal(None, "raisonnement", None, texte, None)

    def _journal(self, instance_id, kind, objet, texte, diff) -> None:
        try:
            self.sb.table("agent_journal").insert(
                {
                    "appel_id": self.appel_id,
                    "instance_id": instance_id,
                    "kind": kind,
                    "objet": objet,
                    "texte": texte,
                    "diff": diff,
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001
            logger.error("Journal agent KO (appel %s) : %s", self.appel_id, exc)
