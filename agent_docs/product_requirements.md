# Product Requirements (résumé) — Athena MVP

> Version complète : `vibe-coding-prompt-template-main/docs/PRD-Athena-MVP.md`

## Problème
Pendant une intervention, l'information (adresse, victimes, dangers, moyens) circule à la voix puis est **ressaisie à la main** sur des tableaux séparés par 4 officiers de PC. Lent, source d'erreurs, détourne le COS du terrain. Preuve officielle : Mémento Chef de Colonne ENSOSP ; 155-250 s pour tracer une SITAC de 10 symboles (étude IHM'19).

## Histoire utilisateur pilier
Le capitaine Martin (COS, feu d'appartement) entend « une personne âgée bloquée au 3ᵉ ». Avec Athena : la victime apparaît automatiquement à la bonne adresse sur la carte, la main courante s'écrit seule. Après l'intervention, il rejoue la chronologie pour le débriefing.

## Features P0 (toutes les 4 = le MVP)
| # | Feature | Critères d'acceptation clés |
|---|---|---|
| 1 | **Extraction des appels** | transcription live affichée ; champs extraits (adresse, nature, victimes) dans un schéma fixe ; adresse géocodée IGN, score < 0,8 → validation humaine |
| 2 | **Dashboard carte temps réel** | entités placées au bon endroit < 2 s ; lisible en un coup d'œil ; tablette + desktop |
| 3 | **Main courante automatique** | chaque info = événement horodaté (double horodatage) avec source + fiabilité ; correction par ajout, jamais de suppression |
| 4 | **Rejeu RETEX** | état reconstructible à tout instant T ; timeline consultable après l'intervention |

## Hors MVP (ne PAS construire maintenant)
- Extraction radio ANTARES (phase post-MVP, nécessite fine-tuning)
- Gestion du déploiement des moyens (couvert par Systel/NexSIS/Crimson — on s'interface plus tard)
- Export EMSI, multi-département, authentification fine par rôle

## Métriques de succès
- **Démo :** ≥ 90 % des infos clés correctement extraites sur les 5 enregistrements test ; zéro champ tapé au clavier.
- **Business :** 1 SDIS pilote signé (achat innovant < 140 k€).

## Design
Vibe : **opérationnel, clair, temps réel, sobre, fiable** (salle de crise, pas appli grand public). Thème sombre, la carte = ~70 % de l'écran, badges d'état (ambre/vert/rouge), gros contrastes, cibles tactiles larges.
