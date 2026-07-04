# Modèle de données — Athena

## 🧍 Victime

- **Appelant** : oui / non
- **Langue** :
- **Position** :
  - **Localisation géographique**
    - Détails : chaîne de caractères
    - Accès possibles du site :
  - **Position confirmée ?** — confirmée par les pompiers à leur arrivée sur les lieux
- **Numéro de téléphone** :
- **Événement considéré** : pointe vers l'objet [Événement](#-événement)
- **Risque lié à l'environnement** : évaluation par IA, confirmation humaine
- **Risque lié à la santé** :

### Identité
- Nom
- Prénom
- Âge
- Sexe

### Évaluation de l'état de la personne
| Couleur | |
|---|---|
| 🟢 Vert | |
| 🟡 Jaune | |
| 🔴 Rouge | |
| ⚫ Noir | |

### Évaluation de la mobilité de la personne
- Possibilité de déplacer (mobilité)
- **Statut physique** : chaîne de caractères — ex. « Hémorragie »

### Informations supplémentaires communiquées
- Combien de personnes dans l'appartement
- Possibilité de pointer vers une autre victime :
  - **QUI ?** — avec une autre victime
  - **Comment ?** — en visuel, proche physiquement

### Actions déjà réalisées
- Action : liste (temps, localisation)

---

## 🚨 Événement

Pointe vers :
- Une **heure de début**
- Une **localisation**
- **Description du sinistre** : chaîne de caractères
- **Liste des victimes** → [Victime](#-victime)
- **Les véhicules** (eux-mêmes pointent vers les personnels) → [Véhicules](#-véhicules)
- **Les véhicules sur les lieux**
- Conditions météos :
	- mtn : 
		- température
		- humidité
		- vent, (force direction)
	- broadcast : 

---

## 🚒 Véhicules

- **Type de véhicule** : VSAV, engin incendie, bras élévateur aérien
- **Institution d'origine** : SAMU, Pompiers, SDIS
- **Équipage** : pointe vers les membres de l'équipage, indique la fonction → [Personnels](#-personnels)
- **Chef du véhicule** : pointe vers le chef du véhicule
- **Statut du véhicule** :
  - Niveau d'eau disponible (si engin incendie)
  - Niveau d'oxygène disponible (si ambulance)
- **Information en plus** : string

---

## 👨‍🚒 Personnels

- **Véhicule de rattachement** → [Véhicules](#-véhicules)
- **Rôle dans le véhicule** :
- **Radio** (le cas échéant) : STT avec timeline de ce qui a été dit
- **Subordonné** : pointe vers un autre personnel, avec l'appellation de ce subordonné
- **Chef** : pointe vers son chef, avec l'appellation de son chef
