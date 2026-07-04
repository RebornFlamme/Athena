# Modèle de données — Athena

4 entités : `Victime`, `Evenement`, `Vehicule`, `Personnel`.

## Relations entre entités

```
Evenement 1 ──── n Victime      (un événement regroupe ses victimes)
Evenement 1 ──── n Vehicule     (véhicules engagés / sur les lieux)
Vehicule  1 ──── n Personnel    (équipage ; un chef par véhicule)
Victime   n ──── n Victime      (une victime peut pointer vers une autre victime)
Personnel 1 ──── n Personnel    (hiérarchie chef / subordonné)
```

---

## Victime

| Champ | Type | Description |
|---|---|---|
| `appelant` | booléen | La victime est-elle l'appelant ? |
| `langue` | chaîne | Langue parlée |
| `telephone` | chaîne | Numéro de téléphone |
| `position` | objet | Voir [Position](#position-sous-objet) ci-dessous |
| `evenement` | référence → `Evenement` | Événement considéré |
| `risque_environnement` | évaluation | Évaluation par IA, confirmation humaine |
| `risque_sante` | évaluation | Évaluation par IA, confirmation humaine |
| `identite` | objet | `nom`, `prenom`, `age`, `sexe` |
| `etat` | énum | `vert` / `jaune` / `rouge` / `noir` (triage) |
| `mobilite` | booléen | Possibilité de déplacer la personne |
| `statut_physique` | chaîne | Ex. « Hémorragie » |
| `nb_personnes_sur_place` | entier | Combien de personnes dans l'appartement |
| `victime_liee` | objet | Voir [Victime liée](#victime-liée-sous-objet) ci-dessous |
| `actions_realisees` | liste d'objets | Chaque action : `action` (chaîne), `temps`, `localisation` |

### Position (sous-objet)

| Champ | Type | Description |
|---|---|---|
| `details` | chaîne | Description libre de la localisation géographique |
| `acces_possibles` | liste de chaînes | Accès possibles du site |
| `confirmee` | booléen | Confirmée par les pompiers à leur arrivée sur les lieux |

### Victime liée (sous-objet)

Possibilité de pointer vers une autre victime.

| Champ | Type | Description |
|---|---|---|
| `qui` | référence → `Victime` | Avec quelle autre victime |
| `comment` | énum | `visuel` / `proche_physiquement` |

---

## Evenement

| Champ | Type | Description |
|---|---|---|
| `heure_debut` | datetime | Heure de début |
| `localisation` | objet | Localisation du sinistre |
| `description` | chaîne | Description du sinistre |
| `victimes` | liste de références → `Victime` | Victimes rattachées à l'événement |
| `vehicules_engages` | liste de références → `Vehicule` | Véhicules engagés (pointent eux-mêmes vers les personnels) |
| `vehicules_sur_place` | liste de références → `Vehicule` | Véhicules arrivés sur les lieux |
| `meteo` | objet | Voir [Météo](#météo-sous-objet) ci-dessous |

### Météo (sous-objet)

| Champ | Type | Description |
|---|---|---|
| `actuelle` | objet | `temperature`, `humidite`, `vent` (force, direction) |
| `broadcast` | objet | Prévisions — à préciser |

---

## Vehicule

| Champ | Type | Description |
|---|---|---|
| `type` | énum | `VSAV` / `engin_incendie` / `bras_elevateur_aerien` |
| `institution` | énum | `SAMU` / `Pompiers` / `SDIS` — institution d'origine |
| `equipage` | liste d'objets | Chaque membre : référence → `Personnel` + `fonction` |
| `chef` | référence → `Personnel` | Chef du véhicule |
| `statut` | objet | Voir [Statut](#statut-sous-objet) ci-dessous |
| `infos` | chaîne | Information en plus |

### Statut (sous-objet)

| Champ | Type | Description |
|---|---|---|
| `niveau_eau` | nombre | Uniquement si engin incendie |
| `niveau_oxygene` | nombre | Uniquement si ambulance (VSAV) |

---

## Personnel

| Champ | Type | Description |
|---|---|---|
| `vehicule` | référence → `Vehicule` | Véhicule de rattachement |
| `role` | chaîne | Rôle dans le véhicule |
| `radio_transcription` | liste d'objets | Si équipé d'une radio : STT avec timeline — chaque entrée : `timestamp` + `texte` |
| `subordonne` | objet | Référence → `Personnel` + `appellation` du subordonné |
| `chef` | objet | Référence → `Personnel` + `appellation` du chef |
