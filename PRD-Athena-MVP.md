# Product Requirements Document : Athena — MVP

## Vue d'ensemble du produit

| | |
|---|---|
| **Nom** | Athena |
| **Slogan** | Le poste de commandement des pompiers qui se remplit tout seul. |
| **Objectif de lancement** | Décrocher 1 SDIS pilote (contrat « achat innovant » < 140 k€) grâce à une démo qui scotche des pompiers. |
| **Lancement visé** | MVP démontrable ~2-3 mois · pilote ~9-12 mois |
| **Statut** | Brouillon — prêt pour la conception technique |
| **Date** | 4 juillet 2026 |

---

## Pour qui c'est fait

### Utilisateur principal : le COS et ses officiers de PC

Le **Commandant des Opérations de Secours (COS)** dirige une intervention depuis son poste de commandement, entouré de 4 officiers (Moyens, Renseignements, Actions, Anticipation). Aujourd'hui, chacun tient **son propre tableau papier** et recopie l'information à la main pour maintenir la carte tactique (SITAC) à jour.

**Utilisateur secondaire :** l'**opérateur CTA-CODIS** qui reçoit l'appel du 18/112.

**Profil :** à l'aise avec les outils métier, mais **en situation de stress extrême** — casqués, parfois de nuit, sous pression du temps. L'écran doit être lisible en 2 secondes, pas rempli comme un formulaire.

**Leur douleur actuelle :**
- Ressaisie manuelle multiple de la même information (tableau → SITAC → main courante)
- Risque d'oubli ou d'erreur quand tout va vite
- Le COS regarde des tableaux au lieu de regarder le terrain
- Débriefing (RETEX) laborieux à reconstituer après coup

**Ce dont ils ont besoin :**
- Une vision de la situation qui se met à jour **toute seule**
- La bonne information, à la bonne place sur la carte, **sans taper au clavier**
- Une trace fiable et horodatée pour le débriefing et le juridique

### Exemple d'histoire utilisateur

> Le **capitaine Martin**, COS sur un feu d'appartement, entend un témoin crier au téléphone : « une personne âgée est bloquée au 3ᵉ ! ». Aujourd'hui, il faudrait qu'un officier le note, qu'un autre le reporte sur la SITAC — 90 secondes et un risque d'oubli. Avec Athena, la victime apparaît **automatiquement à la bonne adresse sur la carte**, la main courante s'écrit seule, la SITAC se dessine. Martin garde les yeux sur le terrain. Après l'intervention, il **rejoue toute la chronologie** en un clic pour le RETEX.

---

## Le problème qu'on résout

Pendant une intervention, l'information vitale (adresse, victimes, dangers, moyens) circule **à la voix** — appels des témoins, radio des équipes — puis doit être **saisie et re-saisie à la main** par plusieurs officiers pour construire la vision commune de la situation. C'est lent, source d'erreurs, et ça détourne le commandant de sa mission.

Le document officiel de l'école des pompiers (Mémento Chef de Colonne, ENSOSP) le prouve : le PC repose sur 4 tableaux papier séparés avec recopie manuelle entre eux. Une étude (IHM'19) chiffre 155-250 s rien que pour tracer une SITAC de 10 symboles.

**Pourquoi maintenant :** l'IA vocale en français est enfin assez mûre (transcription temps réel + extraction structurée fiable), le réseau radio se modernise (RRF 4G/5G, 2025-2027), et une porte d'entrée légale existe (achat innovant 140 k€).

**Pourquoi les solutions existantes ne suffisent pas :**

| Solution actuelle | Pourquoi c'est insuffisant |
|---|---|
| NexSIS 18-112 (État) | SI de gestion + carto, mais **aucune extraction IA** des appels/radio. En retard (9/99 SIS mi-2025). |
| Crimson (CS/Sopra) | Leader du SITAC, mais **saisie 100 % manuelle** — il attend qu'on le nourrisse. |
| Tablet Command (USA) | Glisser-déposer manuel des moyens. Pas d'IA vocale. |
| Prepared / Axon (USA) | Fait de l'IA sur appels 911, mais **écosystème fermé américain** (RGPD/souveraineté KO pour la France). |

---

## Parcours utilisateur

**Découverte → Première utilisation → Succès**

1. **Découverte** — Via un SDIS champion, le réseau Atraksis / Safe Cluster / ENSOSP, ou un exercice. Accroche : « et si le PC se remplissait tout seul ? »
2. **Onboarding (5 premières minutes)** — On lance une intervention de démo → on joue un enregistrement d'appel → l'officier voit la carte se construire seule. Quick win immédiat et visible.
3. **Boucle d'usage principale** — À chaque appel / message radio : transcription → extraction → l'événement apparaît sur la carte + dans la main courante. Le COS supervise et valide les infos critiques.
4. **Moment « aha ! »** — « Je n'ai rien tapé, et tout est là, à jour. » Puis, en débriefing : « on rejoue toute l'intervention ? »

---

## Fonctionnalités du MVP

### Indispensables pour le lancement

#### 1. Extraction des appels d'urgence
- **Quoi :** transcrire l'appel du 18/112 en temps réel et en extraire les infos structurées (adresse, nature du sinistre, nombre de victimes, moyens demandés).
- **User story :** *En tant qu'* opérateur/COS, *je veux que* l'appel soit analysé automatiquement *afin de* ne plus tout saisir à la main.
- **Critères de réussite :**
  - [ ] La transcription s'affiche en direct pendant l'appel
  - [ ] Les champs clés (adresse, nature, victimes) sont extraits dans un schéma fixe
  - [ ] L'adresse est validée par géocodage IGN ; si le score est bas → alerte de validation humaine
- **Priorité :** P0 (Critique)

#### 2. Dashboard carte temps réel
- **Quoi :** une carte (MapLibre + fonds IGN) qui affiche en direct victimes, moyens, zones et événements.
- **User story :** *En tant que* COS, *je veux* voir la situation sur une carte à jour *afin de* décider vite sans quitter le terrain des yeux.
- **Critères de réussite :**
  - [ ] Les entités extraites apparaissent au bon endroit, en temps réel (< 2 s)
  - [ ] Lisible en un coup d'œil (icônes claires, pas de surcharge)
  - [ ] Fonctionne sur tablette et desktop
- **Priorité :** P0 (Critique)

#### 3. Main courante automatique
- **Quoi :** le journal d'événements horodatés qui s'écrit tout seul à partir de ce qui est extrait.
- **User story :** *En tant que* COS, *je veux* une main courante qui se remplit seule *afin d'*avoir une trace fiable sans effort.
- **Critères de réussite :**
  - [ ] Chaque info extraite crée un événement horodaté (heure d'observation + heure de remontée)
  - [ ] Chaque événement garde sa source et son niveau de fiabilité
  - [ ] Une correction ajoute un nouvel événement (rien n'est effacé)
- **Priorité :** P0 (Critique)

#### 4. Rejeu post-intervention (RETEX)
- **Quoi :** rejouer la chronologie complète de l'intervention pour le débriefing.
- **User story :** *En tant que* COS, *je veux* rembobiner l'intervention *afin de* débriefer et documenter.
- **Critères de réussite :**
  - [ ] On peut revoir l'état de la situation à n'importe quel instant T
  - [ ] La timeline est exportable/consultable après l'intervention
- **Priorité :** P0 (Critique) — *quasi-gratuit grâce à l'architecture « journal d'événements »*

### Sympa si le temps le permet
- **Filtrage du bruit d'appels** : signaler les appels sans suite probable (~80 % du flux)
- **Note de fiabilité visible** (code Admiralty A1→F6) affichée sur chaque info

### PAS dans le MVP (pour plus tard)
- **Extraction radio ANTARES** : après le MVP appel — canal bruité 2 kbit/s, nécessite du fine-tuning
- **Gestion du déploiement des moyens** : déjà couvert par Systel/NexSIS/Crimson — on s'interface plus tard
- **Export EMSI vers NexSIS/Crimson** : après la signature d'un pilote
- **Multi-département / passage à l'échelle** : après validation terrain

*Pourquoi on attend : garder un MVP focalisé et démontrable en ~2-3 mois.*

---

## Comment on saura que ça marche

### Métriques de lancement (démo, 30 premiers jours)

| Métrique | Cible | Mesure |
|---|---|---|
| Précision d'extraction | **≥ 90 %** des infos clés (adresse, nature, nb victimes) correctes | Comparaison manuelle sur un jeu d'appels test |
| Zéro saisie | 0 champ tapé au clavier pendant la démo | Observation de la démo |
| Effet « wow » | Retour qualitatif positif des pompiers | Feedback après démo |

### Métriques de croissance (mois 2-3+)

| Métrique | Cible | Mesure |
|---|---|---|
| Pilote signé | **1 SDIS** engagé (achat innovant) | Contrat |
| Gain de temps ressenti | Tenue de la SITAC perçue 2× plus rapide | Interviews officiers |

---

## Look & Feel

**Vibe :** opérationnel · clair · temps réel · sobre · fiable *(esprit « salle de crise », pas « appli grand public »)*

**Principes visuels :**
1. **Lisibilité sous stress** — gros contrastes, hiérarchie forte, l'essentiel saute aux yeux
2. **La carte est reine** — le reste (main courante, fiche) est autour, jamais au-dessus
3. **L'état se lit dans la forme** — couleur/forme encode le statut (présumé/confirmé, fiabilité, danger)

**Écrans clés :**
1. **Carte d'intervention** (écran principal) : la situation en direct
2. **Panneau appel/extraction** : transcription + champs extraits à valider
3. **Main courante** : le fil chronologique des événements
4. **Rejeu RETEX** : la timeline rembobinable

### Wireframe simplifié (écran principal)
```
┌───────────────────────────────────────────┐
│ ATHENA   Intervention #142 · Feu appart.   │
├──────────────────────────────┬────────────┤
│                              │  APPEL EN   │
│                              │  COURS      │
│         CARTE (MapLibre      │  ──────────  │
│         + fonds IGN)         │  transcription│
│      victimes · moyens ·     │  live +      │
│      zones · dangers         │  champs      │
│                              │  extraits    │
│                              │  [à valider] │
├──────────────────────────────┴────────────┤
│ MAIN COURANTE  14:02 victime 3e · 14:03 …  │
└───────────────────────────────────────────┘
```

---

## Points techniques

*(Détaillés dans la recherche — voir [RECHERCHE_ATHENA.md](RECHERCHE_ATHENA.md) §03-05)*

| | |
|---|---|
| **Plateforme** | Web (desktop + tablette), responsive |
| **Carte** | MapLibre GL JS + fonds IGN Géoplateforme (gratuit, souverain) |
| **Base + temps réel** | Supabase (PostgreSQL + Realtime + PostGIS) — journal d'événements + projection |
| **Framework** | Next.js (React) — bonne compatibilité assistance IA |
| **Transcription** | À tester sur audio réel : Gladia / Mistral Voxtral / Speechmatics |
| **Extraction** | LLM en « structured output » (schéma JSON forcé, < 0,2 % d'erreur de format) |
| **Adresse** | Géocodage IGN (`data.geopf.fr/geocodage`) + validation humaine si score bas |
| **Performance** | Affichage carte < 2 s ; mise à jour temps réel fluide |
| **Hébergement** | Souverain (OVH / Scaleway / Outscale) — anticipation SecNumCloud |

---

## Standards de qualité

**Ce que ce projet REFUSE :**
- Contenu bouche-trou en production (« Lorem ipsum », fausses données)
- Fonctionnalités à moitié cassées — c'est complet ou c'est coupé
- Sauter le test sur tablette avant une démo
- **L'IA qui décide seule sur une donnée critique** — l'IA propose, l'humain valide (surtout l'adresse)
- Ignorer les bases d'accessibilité (contraste, tailles)

*Ces standards seront appliqués par l'assistant de code IA.*

---

## Budget & contraintes

| | |
|---|---|
| **Budget dev (MVP)** | ~100-500 $/mois (outils IA + services : Supabase, STT, LLM) |
| **Budget pilote** | ~1-4 k€/mois + 2-8 k€ juridique (RGPD/DPO, one-shot) |
| **Timeline** | MVP démontrable ~2-3 mois · pilote ~9-12 mois |
| **Équipe** | Fondateur solo, assisté par IA (Lovable/Bolt puis Claude Code/Cursor) |
| **Réglementaire** | RGPD (données de victimes sensibles), hébergement souverain, anticipation SecNumCloud, HDS si données médicales |

---

## Questions ouvertes & hypothèses

- **Hypothèse :** un DDSIS champion accepte un pilote via l'achat innovant (< 140 k€, sans appel d'offres)
- **Hypothèse :** la transcription FR est assez fiable sur du **téléphone** (canal propre) dès le MVP — à valider par test réel
- **Ouvert :** obtenir des enregistrements d'appels réels (RGPD) pour tester → sinon, jeux de données simulés au départ
- **Ouvert :** statut RGPD exact des données d'appel (art. 9) — à cadrer avec un DPO/avocat
- **Ouvert :** licence des fonds IGN pour un usage commercial SaaS — à vérifier sur cartes.gouv.fr

---

## Stratégie de lancement (brève)

- **Soft launch :** démo devant 1-2 SDIS volontaires (via Atraksis / Safe Cluster / ENSOSP)
- **Cibles :** 1 SDIS pilote engagé
- **Feedback :** observation en exercice + interviews d'officiers
- **Itération :** cycle court, réagir aux retours terrain à chaque exercice

---

## Definition of Done du MVP

Le MVP est prêt à être démontré quand :
- [ ] Les 4 fonctionnalités P0 marchent (extraction appel · carte · main courante · rejeu)
- [ ] Un parcours complet fonctionne de bout en bout (appel → carte → main courante → rejeu)
- [ ] Ça marche sur tablette et desktop
- [ ] La gestion d'erreur de base fonctionne (appel inaudible, adresse ambiguë → validation humaine)
- [ ] L'extraction atteint ≥ 90 % sur le jeu d'appels test
- [ ] Un suivi analytique de base est en place
- [ ] Test « famille & amis » (ou pompiers relais) effectué
- [ ] Déploiement automatisé (hébergement souverain)

---

## Prochaines étapes

Une fois ce PRD validé :
1. Créer le Document de Conception Technique (Partie 3)
2. Mettre en place l'environnement de dev
3. Construire le MVP avec l'assistance IA
4. Tester avec 5-10 utilisateurs (pompiers relais)
5. Démo → pilote !

---

*Document créé le 4 juillet 2026*
*Statut : Brouillon — prêt pour la conception technique*
