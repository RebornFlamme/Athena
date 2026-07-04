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
**En cours :** **Créateur de simulation** + **dashboard flux audio**. Code complet, `npm run build` vert. Test runtime bloqué par la migration `0003`.
**⚠ Notion d'« intervention » supprimée de l'UI** (décision produit, 4 juil.) : plus de liste ni de page `/:id`. Le **dashboard** est une **page directe** `/tableau-de-bord` (`components/dashboard/DashboardPage.tsx`), accessible sans rien créer. Fichiers supprimés : `components/intervention/*`, `store/useInterventionStore.ts`, `hooks/useRealtimeIntervention.ts`. La couche données `data/interventionApi.ts` + tables `interventions`/`evenements`/`entites` (migr. `0002`) restent **dormantes** comme socle de la future pipeline (à revoir : le modèle est ancré sur `intervention_id`).
**Dashboard refondu :** panneaux **redimensionnables** shadcn (`ui/resizable.tsx`) — **carte à gauche** (`dashboard/Carte.tsx`, générique), **flux audio à droite** (`PanneauFluxAudio.tsx`). Chaque flux = un appel avec un **histogramme voix live** (`VisualiseurVoix.tsx`, Web Audio `AnalyserNode` FFT). **Lecture muette par défaut** ; **clic sur un flux = bascule l'écoute**. Moteur Web Audio dans `useSimulationPlayback.ts` (`actifs`/`ecoutes`, `basculerEcoute`, `getAnalyseur`).
**Récemment terminé :** l'onglet `/flux` (« Simulation ») est devenu un **créateur** : on glisse des MP3 (1 MP3 = 1 appel), ils sont téléversés dans **Supabase Storage** (`data/storageAudio.ts`, bucket `appels-audio`), listés en table `appels`, et posés sur une **timeline de montage** draggable (`TimelineMontage.tsx` : instant de déclenchement + pistes/overlap). Un **contrôle flottant discret** en bas-droite (`ControleSimulation.tsx` dans `AppLayout`, store `useSimulationPlayback.ts`) fait **Lancer / Revenir au début / Couper** — planifie la lecture des audios aux bons instants + curseur temporel. Aucun panneau. → L'ancien simulateur scénarisé (scenarios.json, transcript, `useSimulation`) a été **supprimé**. Migration `0003_simulation_appels.sql` écrite (table `appels` + bucket + policies).
**Prochaine étape (demandée) :** la **pipeline de traitement des appels** (transcription STT → extraction LLM → entités sur la carte pendant la lecture).
**Bloqué par :** appliquer **`0003`** dans le SQL Editor Supabase (crée la table `appels` + le bucket Storage) — c'est ce qui alimente les flux audio. `0002` n'est plus requise pour l'UI (tables dormantes) mais reste nécessaire à la future pipeline. Le dashboard + le créateur s'affichent même sans migration (flux vide + message).

## Contexte d'équipe & déploiement
- **Un collègue** travaille sur le même repo (refonte shadcn/sidebar, éditeur local-first). Coordonner avant toute modification de ses fichiers (`AppLayout`, `AppSidebar`, `SchemaEditorPage`, `Toolbar`, `Canvas`, `nodes/`, `edges/`, `ui/`).
- **Déploiement Vercel de référence : `athena-khaki.vercel.app`**, sur le compte du collègue, **root directory = `frontend/`**. Ne PAS créer d'autre projet Vercel. Déployer = pousser sur GitHub (l'autosync s'en charge).
- **Base Supabase partagée** (`ahipiveicrtvpxalbfot`) — prudence sur les migrations : purement additives, coordonnées.

## Cible produit — les onglets de la webapp (instructions Oscar, 4 juil. 2026)
- **Onglet Flux** : liste de tous les appels passés ; **upload de fichiers audio** (composant `Attachment`) pour ajouter des appels ; bouton « lancer la simulation » qui joue les audios préenregistrés de `frontend/public/audio_demo/` — les appels **popent** sur le dashboard (`Sonner`), le **transcript défile en temps réel** (`Message` + `Message Scroller`), les **entités se construisent** et apparaissent progressivement sur la carte. **Chaque appel a une heure de début.**
- **Onglet Carte** : carte plein écran + en bas une **timeline façon logiciel de montage (Premiere Pro)** : on peut y drag les appels, les faire s'overlapper ; le **replay de l'intervention** se fait ici — les objets ayant une position apparaissent sur la carte au fil du curseur.
- ⚠️ Décision produit **révisée** : la table `appels` (retirée le 4 juil.) **revient** en migration additive `0003` — la liste d'appels, l'upload, les heures de début et le drag timeline exigent de les persister (`id`, `intervention_id`, `titre`, `audio_url`, `ts_debut`, `duree`, `transcript`).
- ⚠️ Instruction expresse : **ne PAS coder la timeline/simulation tant que la transcription (F1) n'existe pas.**

## Règle UI absolue (instruction Oscar)
**Aucun élément visuel codé à la main : uniquement des composants shadcn emboîtés les uns dans les autres.** Pas de div stylée custom, pas de CSS maison. Doc d'un composant : `https://ui.shadcn.com/docs/components/base/<nom>.md`. Liste complète et correspondances utiles : voir `agent_docs/code_patterns.md`. Les marqueurs MapLibre actuels (div custom) sont à mettre en conformité (composant `Marker`) lors de F1.

## Roadmap

### Phase 0 : Outil de conception — ✅ FAIT
- [x] Éditeur EAV React Flow (entities/attributes, realtime, Supabase)

### Phase F0 : Socle dashboard (en cours — code fait, test final en attente)
- [x] Migration `0002_athena_core.sql` **écrite** : `interventions`, `evenements` (append-only : policies RLS select+insert uniquement), `entites` (projection, lon/lat + geom PostGIS générée) + index + realtime. Pas de table `appels` (décision produit) : la phrase source d'un fait vit dans `payload.extrait_source`. → **À appliquer dans Supabase (SQL Editor ou `supabase db push`).**
- [x] Routes (v2, dans le shell sidebar) : `/tableau-de-bord` (liste + création rapide) et `/tableau-de-bord/:id` (carte MapLibre plein écran + fonds IGN + main courante) — design 100 % shadcn/Tailwind
- [x] Abonnement Realtime (code) : INSERT `evenements`/`entites` filtré par intervention → store → marqueur + ligne main courante
- [ ] Test de référence : insérer un événement à la main dans Supabase → il apparaît sans recharger (**nécessite `.env.local` + migration appliquée**)

### Phase F1 : Extraction des appels (le cœur) — découpée pour être démontrable à chaque étape
**F1.a — (remplacée)** L'onglet `/flux` scénarisé (scenarios.json, transcript, `useSimulation`) a été **supprimé** au profit du **Créateur de simulation** (Phase F2, fait) : les appels ne sont plus des scripts figés mais de vrais MP3 uploadés. Restent réutilisables pour la pipeline : le **géocodage IGN** (`data/geocodageIgn.ts`, seuil 0,8) et l'**écriture au journal** append-only + `upsertEntite` (`data/interventionApi.ts`).
**F1.b — Extraction LLM réelle** (prérequis : clé Anthropic + `supabase login` + `supabase link`) :
- [ ] Edge Function `extraction` : texte → JSON structuré (champs optionnels : adresse?, nature?, nb_victimes?, etage?, moyens?, danger?) — secrets via `supabase secrets set`
**F1.c — Transcription réelle + banc d'essai** (prérequis : compte Gladia + 2-3 enregistrements test) :
- [ ] Edge Function `stt-token` (token éphémère) + streaming websocket dans le panneau appel
- [ ] Banc d'essai STT : page interne d'upload audio → transcriptions comparées sur NOS enregistrements
- [ ] Test de référence F1 : enregistrement joué → victime placée au bon endroit, zéro clavier

### Phase F2 : Créateur de simulation — ✅ FAIT (code ; test runtime en attente migration `0003`)
Un MP3 = un appel ; l'agencement des appels sur la timeline = la simulation active.
- [x] Migration `0003_simulation_appels.sql` : table `appels` (`audio_url`, `audio_path`, `ts_debut_ms`, `duree_ms`, `piste`) + bucket Storage `appels-audio` + policies + realtime.
- [x] Créateur `/flux` (« Simulation ») : glisser des MP3 → durée lue côté client → upload **Supabase Storage** → ligne `appels`. `SimulationPage.tsx`, `data/storageAudio.ts`, `data/appelsApi.ts`, `typesSimulation.ts`.
- [x] **Timeline de montage** `TimelineMontage.tsx` : clips draggables (instant de déclenchement) + pistes (overlap) + curseur. Mécanique de drag en logique pure.
- [x] **Contrôle flottant** `ControleSimulation.tsx` (bas-droite, dans `AppLayout`) : Lancer / Revenir au début / Couper via le store `useSimulationPlayback.ts` (planifie la lecture des MP3 aux bons instants + curseur). Aucun panneau.
- [ ] Test runtime (⏳ migration `0003`) : glisser 2 MP3, les placer, Play → ils se déclenchent aux bons instants, le curseur défile.
- [ ] Conformité composants dédiés (`Attachment`, `Scroll Area`, `Context Menu`, `Sonner`) **reportée** : la CLI shadcn ne s'initialise pas proprement sur ce repo Vite (elle scaffolde un `next-app/` parasite) → prévoir une **copie manuelle** du source des composants.

### Phase F3 : Replay sur la carte — pipeline de traitement des appels (prochaine étape demandée)
⚠️ À coder quand la transcription (F1.c) fonctionne — instruction Oscar. La timeline de montage existe déjà (F2) ; ici on branche le **traitement** :
- [ ] Pipeline : à la lecture (ou en amont), chaque appel MP3 → transcription (STT) → extraction (LLM) → `evenements` + `entites` géolocalisées.
- [ ] Replay : le curseur qui défile fait apparaître sur la carte les objets ayant une position (état reconstruit depuis les événements ≤ T — remplace l'ancien « rejeu RETEX »).

### Phase F4 : Polish démo vidéo
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
