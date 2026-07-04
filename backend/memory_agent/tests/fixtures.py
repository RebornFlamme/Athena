"""
fixtures.py — Scénarios de test scriptés pour le module memory_agent.

Chaque scénario définit :
- Une utterance en français
- Les attentes sur le comportement de l'agent (took_action, type d'opération, table)
- Une description du cas testé

Les scénarios couvrent les 8 règles métier du system prompt.
"""

from __future__ import annotations

from typing import TypedDict


class Scenario(TypedDict):
    name: str
    description: str
    utterance: str
    speaker_tag: str
    expected_took_action: bool
    expected_operations: list[str]  # INSERT, UPDATE, DELETE, SELECT
    expected_tables: list[str]       # interventions, evenements, entites, etc.
    min_mutations: int               # nombre minimum de mutations attendues


# ── Scénarios de test ─────────────────────────────────────────────────
# Chaque scénario est exécuté par test_agent.py.
# L'intervention_id et session_id sont injectés par le test runner.

SCENARIOS: list[Scenario] = [
    # ── Règle 1 : Nouvelle victime ─────────────────────────────────
    {
        "name": "nouvelle_victime_simple",
        "description": "Utterance signalant une nouvelle victime → INSERT dans entites + evenements",
        "utterance": "On a un homme d'environ 45 ans, brûlé aux deux mains, il est au 3e étage",
        "speaker_tag": "caller",
        "expected_took_action": True,
        "expected_operations": ["INSERT", "INSERT"],
        "expected_tables": ["entites", "evenements"],
        "min_mutations": 2,  # une entité + un événement journal
    },
    {
        "name": "nouvelle_victime_avec_details",
        "description": "Victime avec âge, sexe, localisation précise, symptômes",
        "utterance": "Une femme de 30 ans, elle a inhalé de la fumée, elle est consciente mais choquée, au rez-de-chaussée",
        "speaker_tag": "caller",
        "expected_took_action": True,
        "expected_operations": ["INSERT", "INSERT"],
        "expected_tables": ["entites", "evenements"],
        "min_mutations": 2,
    },
    {
        "name": "plusieurs_victimes",
        "description": "Utterance mentionnant plusieurs victimes en même temps",
        "utterance": "Il y a trois personnes bloquées : une femme âgée, un enfant d'environ 10 ans, et un homme qui saigne du bras",
        "speaker_tag": "caller",
        "expected_took_action": True,
        "expected_operations": ["INSERT"],  # au moins un INSERT
        "expected_tables": ["entites"],
        "min_mutations": 3,  # une entité par victime (3)
    },

    # ── Règle 2 : Correction d'info ────────────────────────────────
    {
        "name": "correction_adresse",
        "description": "Correction de l'adresse de l'intervention",
        "utterance": "En fait c'est au 14 rue de la Paix, pas au 12 comme j'ai dit tout à l'heure",
        "speaker_tag": "caller",
        "expected_took_action": True,
        "expected_operations": ["UPDATE", "INSERT"],  # UPDATE adresse + INSERT CORRECTION
        "expected_tables": ["interventions", "evenements"],
        "min_mutations": 2,
    },
    {
        "name": "correction_nombre_victimes",
        "description": "Correction du nombre de victimes",
        "utterance": "Je rectifie : en fait il n'y a pas trois personnes mais plutôt quatre, j'en vois une autre derrière la fenêtre",
        "speaker_tag": "operator",
        "expected_took_action": True,
        "expected_operations": ["INSERT", "INSERT"],  # nouvelle victime + CORRECTION
        "expected_tables": ["entites", "evenements"],
        "min_mutations": 2,
    },
    {
        "name": "correction_etat_victime",
        "description": "Correction de l'état d'une victime déjà signalée",
        "utterance": "Je me suis trompé sur la femme au rez-de-chaussée, elle n'est pas juste choquée, elle commence à avoir du mal à respirer",
        "speaker_tag": "operator",
        "expected_took_action": True,
        "expected_operations": ["UPDATE", "INSERT"],  # UPDATE etat + INSERT CORRECTION
        "expected_tables": ["entites", "evenements"],
        "min_mutations": 2,
    },

    # ── Règle 3 : Moyen engagé ─────────────────────────────────────
    {
        "name": "moyen_arrive_sur_zone",
        "description": "Un VSAV arrive sur les lieux",
        "utterance": "Le VSAV 12 arrive sur zone, on se gare devant l'immeuble",
        "speaker_tag": "operator",
        "expected_took_action": True,
        "expected_operations": ["INSERT", "INSERT"],  # entité + événement
        "expected_tables": ["entites", "evenements"],
        "min_mutations": 2,
    },
    {
        "name": "moyen_en_cours_dengagement",
        "description": "Un FPT est engagé sur l'intervention",
        "utterance": "On engage le FPT 8 pour l'intervention rue de la Paix, départ immédiat",
        "speaker_tag": "chef_colonne",
        "expected_took_action": True,
        "expected_operations": ["INSERT", "INSERT"],
        "expected_tables": ["entites", "evenements"],
        "min_mutations": 2,
    },

    # ── Règle 4 : Aggravation / Alerte ─────────────────────────────
    {
        "name": "aggravation_propagation",
        "description": "Le feu se propage — aggravation de la situation",
        "utterance": "Attention le feu se propage à l'étage supérieur, des flammes sortent par la fenêtre du 4e !",
        "speaker_tag": "operator",
        "expected_took_action": True,
        "expected_operations": ["INSERT"],  # INSERT dans evenements avec ALERTE
        "expected_tables": ["evenements"],
        "min_mutations": 1,
    },
    {
        "name": "danger_imminent_explosion",
        "description": "Danger imminent — bouteille de gaz",
        "utterance": "Il y a une bouteille de gaz dans la cuisine, risque d'explosion, il faut évacuer !",
        "speaker_tag": "operator",
        "expected_took_action": True,
        "expected_operations": ["INSERT"],  # INSERT ALERTE sévérité haute
        "expected_tables": ["evenements"],
        "min_mutations": 1,
    },

    # ── Règle 5 : Conversation vide ────────────────────────────────
    {
        "name": "acknowledgment_simple",
        "description": "Simple accusé de réception — aucune action",
        "utterance": "D'accord, bien reçu",
        "speaker_tag": "operator",
        "expected_took_action": False,
        "expected_operations": [],
        "expected_tables": [],
        "min_mutations": 0,
    },
    {
        "name": "acknowledgment_ok",
        "description": "OK simple — aucune action",
        "utterance": "OK, compris, j'arrive",
        "speaker_tag": "caller",
        "expected_took_action": False,
        "expected_operations": [],
        "expected_tables": [],
        "min_mutations": 0,
    },
    {
        "name": "filler_words",
        "description": "Mots de remplissage conversationnels",
        "utterance": "Euh... attendez, laissez-moi voir... oui voilà c'est ça",
        "speaker_tag": "caller",
        "expected_took_action": False,
        "expected_operations": [],
        "expected_tables": [],
        "min_mutations": 0,
    },

    # ── Règle 6 : Incertitude → pas d'action ───────────────────────
    {
        "name": "information_ambigue",
        "description": "Information trop vague pour agir",
        "utterance": "Je sais pas trop, y a peut-être quelqu'un, je vois pas bien",
        "speaker_tag": "caller",
        "expected_took_action": False,
        "expected_operations": [],
        "expected_tables": [],
        "min_mutations": 0,
    },

    # ── Règle 7 : DELETE sur erreur explicite ──────────────────────
    {
        "name": "annulation_explicite",
        "description": "Annulation explicite d'une information précédente",
        "utterance": "Oubliez ce que j'ai dit sur la bouteille de gaz, c'était une erreur, il n'y a pas de bouteille",
        "speaker_tag": "operator",
        "expected_took_action": True,
        "expected_operations": ["DELETE", "INSERT"],  # DELETE l'alerte + INSERT CORRECTION
        "expected_tables": ["evenements"],
        "min_mutations": 1,
    },
]
