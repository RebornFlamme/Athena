# AGENTS.md — Plan directeur d'Athena

## Vue d'ensemble
**App :** Athena — dashboard temps réel de gestion de crise pour sapeurs-pompiers (COS + officiers de PC), alimenté automatiquement par IA depuis les appels d'urgence. Zéro saisie manuelle pendant la crise.
**Objectif :** une démo qui scotche des pompiers → 1 SDIS pilote (achat innovant < 140 k€).
**Stack réelle :** Vite + React 18 + TypeScript · zustand · Supabase (PostgreSQL + PostGIS + Realtime + Storage) · MapLibre GL JS + fonds IGN · Gladia (STT) · Claude API (extraction structurée).
**Phase actuelle :** Phase F0 — Socle dashboard.

**Forme cible de l'UI (deux onglets)** — voir `plan_base_webapp.md` :
- **Onglet Flux** : liste de tous les appels passés + upload de fichiers audio pour ajouter un appel + lancement d'une **simulation de démo** (les appels pop up, le transcript défile en live, les entités apparaissent progressivement sur la carte). Chaque appel a une heure de début.
- **Onglet Map** : carte plein écran + **timeline de montage type Premiere Pro** en bas (drag/overlap des appels, replay). Les objets ayant un attribut `position` apparaissent en live sur la carte au défilement du curseur.

## Décision d'architecture amendée (⚠ diffère du TechDesign)
Le TechDesign proposait Next.js. **Le code réel utilise Vite + React** (l'éditeur EAV fonctionne déjà dessus). Décision : on garde Vite.
- Le dashboard Athena se construit dans `frontend/` (nouvelles routes react-router-dom), il ne remplace pas l'éditeur EAV.
- Vite n'a pas de serveur → **tout ce qui touche un secret passe par des Supabase Edge Functions** (`supabase/functions/`) : extraction LLM, token STT éphémère. Le géocodage IGN est public (appel direct client OK).
- Clés (`GLADIA_API_KEY`, `ANTHROPIC_API_KEY`) : `supabase secrets set` — **jamais** dans `frontend/`.

## Contrainte UI (non négociable — `plan_base_webapp.md`)
- **Aucun élément visuel codé à la main.** Toute l'UI est composée **uniquement de composants shadcn/ui emboîtés** les uns dans les autres.
- Liste blanche des composants disponibles : voir `plan_base_webapp.md`. Doc d'un composant : `https://ui.shadcn.com/docs/components/base/<nom>.md`.
- Si un besoin ne se couvre pas par emboîtement de composants shadcn, le signaler et demander avant d'improviser du markup/CSS sur mesure.
- Le thème sombre shadcn existant (variables zinc dans `src/index.css`) reste la base.

## Comment raisonner
1. **Comprendre l'intention d'abord** ; si une info critique manque, demander avant d'agir.
2. **Plan avant code** : proposer le plan en 5 lignes, attendre l'accord, puis implémenter.
3. **Une fonctionnalité à la fois**, testée avant de passer à la suivante.
4. **Vérifier après chaque changement** : `cd frontend && npm run build` (types) + test manuel.
5. **Expliquer les trade-offs** en langage clair (l'utilisateur est non-développeur).

## Boucle Plan → Exécuter → Vérifier
1. **Plan** : approche + fichiers touchés + comment on testera.
2. **Exécuter** : petite étape autonome.
3. **Vérifier** : build OK + le test manuel décrit passe. Corriger avant d'avancer.

## Fichiers de contexte (charger seulement si besoin)
- `agent_docs/project_brief.md` — vision, règles non négociables, commandes clés
- `agent_docs/tech_stack.md` — stack détaillée, services externes, variables d'env
- `agent_docs/code_patterns.md` — conventions du code existant à respecter
- `agent_docs/product_requirements.md` — résumé du PRD (features P0, critères)
- `agent_docs/testing.md` — stratégie de vérification et Definition of Done
- Docs stratégiques complets : `vibe-coding-prompt-template-main/docs/` (PRD, TechDesign, ARCHITECTURE, research)
- `CLAUDE.md` — conventions spécifiques de l'éditeur EAV existant

## État courant
**Dernière mise à jour :** 2026-07-04
**En cours :** Phase **F1.a — Onglet Flux + simulation d'appel**. Code complet, `npm run build` vert. Reste le test runtime, lui-même bloqué par la migration `0002`.
**Récemment terminé :** F1.a codé — onglet `/flux` (liste de scénarios depuis `public/audio_demo/scenarios.json` + upload audio), géocodage IGN sans clé (seuil 0,8), moteur de simulation (`sim/useSimulation.ts`) qui rejoue un transcript en direct et écrit journal + entités géolocalisées dans Supabase → carte/main courante via le Realtime F0. Tout en composants shadcn. Éditeur EAV et dashboard F0 non régressés.
**Bloqué par :** application de la migration `0002` dans le SQL Editor Supabase — action utilisateur (2 min). Débloque à la fois le test de référence F0 **et** F1.a.

## Contexte d'équipe & déploiement
- **Un collègue** travaille sur le même repo (refonte shadcn/sidebar, éditeur local-first). Coordonner avant toute modification de ses fichiers (`AppLayout`, `AppSidebar`, `SchemaEditorPage`, `Toolbar`, `Canvas`, `nodes/`, `edges/`, `ui/`).
- **Déploiement Vercel de référence : `athena-khaki.vercel.app`**, sur le compte du collègue, **root directory = `frontend/`**. Ne PAS créer d'autre projet Vercel. Déployer = pousser sur GitHub (l'autosync s'en charge).
- **Base Supabase partagée** (`ahipiveicrtvpxalbfot`) — prudence sur les migrations : purement additives, coordonnées.

## Roadmap

### Phase 0 : Outil de conception — ✅ FAIT
- [x] Éditeur EAV React Flow (entities/attributes, realtime, Supabase)

### Phase F0 : Socle dashboard (en cours — code fait, test final en attente)
- [x] Migration `0002_athena_core.sql` **écrite** : `interventions`, `evenements` (append-only : policies RLS select+insert uniquement), `entites` (projection, lon/lat + geom PostGIS générée) + index + realtime. Pas de table `appels` (décision produit) : la phrase source d'un fait vit dans `payload.extrait_source`. → **À appliquer dans Supabase (SQL Editor ou `supabase db push`).**
- [x] Routes (v2, dans le shell sidebar) : `/tableau-de-bord` (liste + création rapide) et `/tableau-de-bord/:id` (carte MapLibre plein écran + fonds IGN + main courante) — design 100 % shadcn/Tailwind
- [x] Abonnement Realtime (code) : INSERT `evenements`/`entites` filtré par intervention → store → marqueur + ligne main courante
- [ ] Test de référence : insérer un événement à la main dans Supabase → il apparaît sans recharger (**nécessite `.env.local` + migration appliquée**)

### Phase F1 : Extraction des appels (le cœur) — découpée pour être démontrable à chaque étape
**F1.a — Onglet Flux + chaîne complète sans clé API** (code fait, build vert ; test runtime en attente de la migration `0002`) :
- [x] **Onglet Flux** (`/flux` + entrée sidebar) : liste des appels (Cards shadcn) issus du manifeste `frontend/public/audio_demo/scenarios.json` (titre, heure de début) + zone d'upload audio (`Input type=file`) → appel ajouté localement. Fichiers : `components/flux/FluxPage.tsx`, `data/scenariosApi.ts`, `typesFlux.ts`.
- [x] **Simulation de démo** : bouton « Lancer » crée une intervention démo puis rejoue le scénario — transcript qui défile en direct (`components/flux/PanneauTranscript.tsx`), entités qui apparaissent progressivement sur la carte. Moteur : `sim/useSimulation.ts` ; vue : `components/flux/SimulationView.tsx` (réutilise `CarteIntervention` + `MainCourante` + Realtime F0).
- [x] Géocodage IGN réel (`data/geocodageIgn.ts`, `data.geopf.fr/geocodage`, sans clé) + seuil 0,8 (`SEUIL_FIABLE`) → statut `presume`/`confirme` selon le score. NB : `12 rue des Lilas, Lyon` score ~0,76 → « présumé » (démo réaliste de la validation).
- [x] Écriture au journal : chaque pas d'extraction → `insererEvenement` (`payload.extrait_source` = la phrase) + `upsertEntite` géolocalisée (`data/interventionApi.ts`). Journal toujours append-only.
- [ ] **Test de référence F1.a** (⏳ bloqué par migration `0002`) : `/flux` → « Lancer la simulation » → victime placée sur la carte + main courante remplie, zéro clavier.
**F1.b — Extraction LLM réelle** (prérequis : clé Anthropic + `supabase login` + `supabase link`) :
- [ ] Edge Function `extraction` : texte → JSON structuré (champs optionnels : adresse?, nature?, nb_victimes?, etage?, moyens?, danger?) — secrets via `supabase secrets set`
**F1.c — Transcription réelle + banc d'essai** (prérequis : compte Gladia + 2-3 enregistrements test) :
- [ ] Edge Function `stt-token` (token éphémère) + streaming websocket dans le panneau appel
- [ ] Banc d'essai STT : page interne d'upload audio → transcriptions comparées sur NOS enregistrements
- [ ] Test de référence F1 : enregistrement joué → victime placée au bon endroit, zéro clavier

### Phase F2 : Main courante automatique
- [ ] Rendu chronologique du journal (heure, source, fiabilité Admiralty, statut)
- [ ] Correction = nouvel événement `CORRECTION` lié (jamais de suppression)

### Phase F3 : Onglet Map — timeline de montage & rejeu RETEX (⚠ différé)
> Le `plan_base_webapp.md` précise : **« pour l'instant ne code pas tout ça, on le codera quand il y aura effectivement une transcription »**. À traiter APRÈS F1.c.
- [ ] Timeline type Premiere Pro en bas de la carte : pistes d'appels qu'on peut drag / faire se chevaucher (overlap)
- [ ] Curseur temporel de replay : état reconstruit depuis les événements ≤ T (même logique que la projection)
- [ ] Les objets ayant un attribut `position` apparaissent/disparaissent en live sur la carte au défilement du curseur

### Phase F4 : Polish démo
- [ ] 3-5 enregistrements scénarisés (fictifs, joués par des proches) dans `frontend/public/audio_demo/`
- [ ] Gestion d'erreurs (audio inaudible, STT en panne → saisie manuelle), test tablette, répétition du « money shot »

## À NE PAS faire
- Ne PAS supprimer de fichiers sans confirmation explicite.
- Ne PAS coder d'élément visuel à la main : **UI = composants shadcn emboîtés uniquement** (cf. « Contrainte UI »).
- Ne PAS implémenter la timeline de montage / le replay (Phase F3) tant qu'il n'y a pas de transcription réelle — décision produit explicite.
- Ne PAS modifier `evenements` par UPDATE/DELETE — **journal append-only**, corrections par ajout.
- Ne PAS mettre de clé secrète dans `frontend/` (seules les `VITE_*` publiques y sont autorisées).
- Ne PAS ajouter de fonctionnalité hors de la phase courante (la radio ANTARES = phase post-MVP).
- Ne PAS laisser l'IA décider seule d'une donnée critique : **l'IA propose, l'humain valide** (adresse en premier).
- Ne PAS casser l'éditeur EAV en travaillant sur le dashboard (routes et stores séparés).
- Ne PAS changer le schéma SQL sans nouvelle migration versionnée dans `supabase/migrations/`.
- Ne PAS utiliser de contenu bouche-trou (« Lorem ipsum ») dans la démo.
