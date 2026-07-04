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
**Dernière mise à jour :** 2026-07-04
**En cours :** Phase F0 (socle dashboard) — rien de commencé.
**Récemment terminé :** éditeur visuel de schémas EAV (`frontend/`, migration `0001`) ; docs stratégiques (recherche, PRD, TechDesign, architecture) ; ce workspace agents.
**Bloqué par :** rien.

## Roadmap

### Phase 0 : Outil de conception — ✅ FAIT
- [x] Éditeur EAV React Flow (entities/attributes, realtime, Supabase)

### Phase F0 : Socle dashboard (en cours)
- [ ] Migration `0002_athena_core.sql` : tables `interventions`, `evenements` (journal append-only), `entites` (projection), `appels` + index + RLS + realtime (SQL prêt dans TechDesign §4)
- [ ] Route `/intervention/:id` : carte MapLibre plein écran + fonds IGN (data.geopf.fr)
- [ ] Abonnement Realtime : INSERT dans `evenements`/`entites` → marqueur carte + ligne main courante < 2 s
- [ ] Test : insérer un événement à la main dans Supabase → il apparaît sans recharger

### Phase F1 : Extraction des appels (le cœur)
- [ ] Banc d'essai STT : page d'upload audio → transcriptions comparées (Gladia vs alternatives)
- [ ] Streaming transcription (Gladia websocket, token via Edge Function `stt-token`)
- [ ] Edge Function `extraction` : texte → JSON structuré (champs optionnels : adresse?, nature?, nb_victimes?, etage?, moyens?, danger?)
- [ ] Géocodage IGN + seuil 0,8 → badge « présumé » ou file de validation humaine
- [ ] Test : enregistrement joué → victime placée au bon endroit, zéro clavier

### Phase F2 : Main courante automatique
- [ ] Rendu chronologique du journal (heure, source, fiabilité Admiralty, statut)
- [ ] Correction = nouvel événement `CORRECTION` lié (jamais de suppression)

### Phase F3 : Rejeu RETEX
- [ ] Curseur temporel : état reconstruit depuis les événements ≤ T (même logique que la projection)

### Phase F4 : Polish démo
- [ ] 3-5 enregistrements scénarisés (fictifs, joués par des proches) dans `frontend/public/audio-demo/`
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
