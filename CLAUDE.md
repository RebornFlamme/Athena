# CLAUDE.md — Projet Athena

## Objet du dépôt

Athena est (à terme) un dashboard temps réel de gestion de crise pour pompiers. Le contenu
actuel du repo est un **éditeur visuel de schémas de données EAV** : un outil où un opérateur
dessine des objets/sous-objets comme des nodes d'un graphe React Flow, leur ajoute des champs
typés, et relie références et sous-objets. Le schéma dessiné est persisté dans Supabase.

Le modèle métier Athena (`Ressources/modele-donnees.md`, `backend/db/schema.sql`) sert
**d'inspiration uniquement** — l'éditeur démarre sur un canvas vierge et est 100 % générique.

## Stack

- **Frontend** (`frontend/`) : Vite + React 18 + TypeScript, `react-router-dom`,
  `@xyflow/react` (React Flow v12), `zustand` (state), `@supabase/supabase-js`. CSS simple
  (aucun framework UI), thème sombre dans `src/index.css`.
- **DB** (`supabase/`) : PostgreSQL/Supabase. Migrations dans `supabase/migrations/`,
  versionnées dans git. Config CLI dans `supabase/config.toml`.

## Modèle de données (méta-schéma EAV)

Deux tables (canvas unique → pas de table `projects`) :

- `entities` : `id`, `name`, `is_subobject`, `position_x/y`, `color`, timestamps.
- `attributes` : `id`, `entity_id`, `name`, `data_type` (`string|text|boolean|integer|number|
  datetime|enum|reference|object`), `is_list`, `enum_values text[]`, `target_entity_id`
  (cible si `reference`/`object`), `required`, `description`, `ordinal`, timestamps.

Les **arêtes** du graphe sont **dérivées** des attributs avec `target_entity_id` (pas de table
`edges`). RLS activée avec policies **permissives** (accès `anon` ouvert — pas d'auth).
Realtime activé sur les deux tables.

## Architecture frontend

- `src/types.ts` — types miroir des tables + `DATA_TYPES`, `RELATION_TYPES`.
- `src/lib/supabase.ts` — client + `isSupabaseConfigured` (l'app démarre sans env, bannière).
- `src/data/schemaApi.ts` — CRUD Supabase (couche d'accès pure).
- `src/store/useSchemaStore.ts` — store zustand : `entities`, `attributes`, sélection, actions
  (mise à jour locale optimiste puis appel API ; réconciliation Realtime idempotente par id).
- `src/hooks/useRealtimeSchema.ts` — abonnement `postgres_changes` → store.
- `src/components/` — `SchemaEditorPage` (provider + layout), `Toolbar`, `Canvas`
  (React Flow, nodes/edges dérivés du store), `nodes/EntityNode`, `InspectorPanel`,
  `FieldEditor`.

### Conventions & pièges React Flow

- `nodeTypes` est défini **hors composant** (référence stable, sinon warning/re-render).
- La **sélection** est pilotée par le store (`selectedEntityId`), pas par la sélection interne
  de React Flow ; `EntityNode` lit `selected` depuis le store.
- Les **positions** sont gérées par React Flow pendant le drag (`useNodesState`) et persistées
  seulement `onNodeDragStop` (évite un flood d'écritures + les sauts de position).
- `onNodeDragStop` attend le type `OnNodeDrag<Node>`, **pas** `NodeMouseHandler`.
- Import du CSS React Flow requis : `@xyflow/react/dist/style.css` (dans `main.tsx`).

## Commandes

- `cd frontend && npm run dev` — dev (port 5173).
- `cd frontend && npm run build` — `tsc -b && vite build` (utilisé pour vérifier les types).
- Migration SQL : SQL Editor Supabase, ou `supabase db push` après `supabase link`.

## État / TODO connus

- Pas d'authentification (accès ouvert assumé) — à durcir avant prod.
- Pas d'export SQL/JSON (décision produit : hors scope v1).
- Bundle > 500 kB (React Flow) — warning bénin, code-splitting possible plus tard.
