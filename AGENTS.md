# AGENTS.md — Plan directeur d'Athena

## Vue d'ensemble
**App :** Athena — dashboard temps réel de gestion de crise pour sapeurs-pompiers (COS + officiers de PC), alimenté automatiquement par IA depuis les appels d'urgence. Zéro saisie manuelle pendant la crise.
**Objectif :** une démo qui scotche des pompiers → 1 SDIS pilote (achat innovant < 140 k€).
**Stack réelle :** Vite + React 18 + TypeScript · zustand · Supabase (PostgreSQL + PostGIS + Realtime + Storage) · MapLibre GL JS + fonds IGN · Gladia (STT) · Claude API (extraction structurée).
**Phase actuelle :** Phase F0 — Socle dashboard.

## Décision d'architecture amendée (⚠ diffère du TechDesign)
Le TechDesign proposait Next.js. **Le code réel utilise Vite + React** (l'éditeur EAV fonctionne déjà dessus). Décision : on garde Vite.
- Le dashboard Athena se construit dans `frontend/` (nouvelles routes react-router-dom), il ne remplace pas l'éditeur EAV.
- Vite n'a pas de serveur → **tout ce qui touche un secret passe par des Supabase Edge Functions** (`supabase/functions/`) : extraction LLM, token STT éphémère. Le géocodage IGN est public (appel direct client OK).
- Clés (`GLADIA_API_KEY`, `ANTHROPIC_API_KEY`) : `supabase secrets set` — **jamais** dans `frontend/`.

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
**Dernière mise à jour :** 2026-07-04 (fin de journée)
**En cours :** Phase F0 v2 — **reconstruite dans le shell shadcn du collègue** (sa refonte avait retiré la v1 au commit `184ff66`). Code terminé, build vert, vérifié navigateur. Reste : appliquer la migration `0002` dans Supabase puis rejouer le test de référence temps réel.
**Récemment terminé :** dashboard F0 porté en shadcn/Tailwind — routes `/tableau-de-bord` (liste + création, Cards/Input/Badge/Skeleton) et `/tableau-de-bord/:id` (carte MapLibre+IGN, main courante, badges de fiabilité), intégrées au `AppLayout` sidebar. Logique (types, API, store, hook realtime) restaurée telle quelle depuis `f66bf29`. Messages d'erreur pédagogiques (détecte la migration manquante). `frontend/.env.local` créé (git-ignoré). Éditeur EAV non régressé.
**Bloqué par :** application de la migration `0002` dans le SQL Editor Supabase — action utilisateur (2 min).

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
**F1.a — Chaîne complète sans clé API** (aucun prérequis utilisateur) :
- [ ] Simulateur d'appel : transcript scénarisé qui défile comme une transcription live (panneau appel)
- [ ] Géocodage IGN réel (`data.geopf.fr/geocodage`, gratuit sans clé) + seuil 0,8 → badge « présumé » ou bandeau « adresse à confirmer » + validation humaine
- [ ] Écriture au journal (`payload.extrait_source`) → entité sur la carte
**F1.b — Extraction LLM réelle** (prérequis : clé Anthropic + `supabase login` + `supabase link`) :
- [ ] Edge Function `extraction` : texte → JSON structuré (champs optionnels : adresse?, nature?, nb_victimes?, etage?, moyens?, danger?) — secrets via `supabase secrets set`
**F1.c — Transcription réelle + banc d'essai** (prérequis : compte Gladia + 2-3 enregistrements test) :
- [ ] Edge Function `stt-token` (token éphémère) + streaming websocket dans le panneau appel
- [ ] Banc d'essai STT : page interne d'upload audio → transcriptions comparées sur NOS enregistrements
- [ ] Test de référence F1 : enregistrement joué → victime placée au bon endroit, zéro clavier

### Phase F2 : Onglet Flux (les appels)
- [ ] Migration `0003_appels.sql` (additive) : table `appels` (`id`, `intervention_id`, `titre`, `audio_url`, `ts_debut`, `duree`, `transcript`, timestamps)
- [ ] Page Flux : liste des appels passés (`Item`/`Card` + `Empty`), upload d'audio (`Attachment`) vers `frontend/public/audio_demo/` (démo) ou Supabase Storage
- [ ] Moteur de simulation : joue les audios de `audio_demo/` selon leurs heures de début — appels qui popent (`Sonner`), transcript live (`Message`+`Message Scroller`), entités progressives sur la carte
- [ ] Sidebar : entrées « Flux » et « Carte » (remplacent/complètent « Tableau de bord »)

### Phase F3 : Onglet Carte — timeline de montage + replay
⚠️ À coder seulement quand la transcription (F1) fonctionne — instruction Oscar.
- [ ] Zone timeline sous la carte, façon Premiere Pro : pistes, clips d'appels draggables/overlappables, curseur — assemblage 100 % shadcn (`Scroll Area` + `Slider` + `Item` + `Context Menu` + `Tooltip`), mécanique de drag en logique pure
- [ ] Replay : le curseur qui défile fait apparaître sur la carte les objets ayant une position (état reconstruit depuis les événements ≤ T — remplace l'ancien « rejeu RETEX »)

### Phase F4 : Polish démo vidéo
- [ ] 3-5 enregistrements scénarisés (fictifs, joués par des proches) dans `frontend/public/audio_demo/`
- [ ] Gestion d'erreurs (audio inaudible, STT en panne → saisie manuelle), test tablette, répétition du « money shot »

## À NE PAS faire
- Ne PAS supprimer de fichiers sans confirmation explicite.
- Ne PAS modifier `evenements` par UPDATE/DELETE — **journal append-only**, corrections par ajout.
- Ne PAS mettre de clé secrète dans `frontend/` (seules les `VITE_*` publiques y sont autorisées).
- Ne PAS ajouter de fonctionnalité hors de la phase courante (la radio ANTARES = phase post-MVP).
- Ne PAS laisser l'IA décider seule d'une donnée critique : **l'IA propose, l'humain valide** (adresse en premier).
- Ne PAS casser l'éditeur EAV en travaillant sur le dashboard (routes et stores séparés).
- Ne PAS changer le schéma SQL sans nouvelle migration versionnée dans `supabase/migrations/`.
- Ne PAS utiliser de contenu bouche-trou (« Lorem ipsum ») dans la démo.
