# CLAUDE.md — Projet Athena

## Workflow agents — à lire en premier

1. **Plan directeur : [AGENTS.md](AGENTS.md)** — phase courante, roadmap, règles « à ne pas faire ». S'y référer avant toute tâche de build.
2. **Détails à la demande :** `agent_docs/` (brief, stack, patterns, exigences produit, tests).
3. **Docs stratégiques complets :** `vibe-coding-prompt-template-main/docs/` (recherche, PRD, TechDesign, ARCHITECTURE).
4. **Méthode :** plan en 5 lignes → accord → implémenter petit → `cd frontend && npm run build` + test manuel avant d'avancer.

Le reste de ce fichier décrit les conventions de l'existant (éditeur EAV) — elles restent valables.

## Dashboard Athena — onglet Flux (F1.a, juil. 2026)
- **Contrainte UI (non négociable, cf. `plan_base_webapp.md`) : UI = composants shadcn emboîtés uniquement**, aucun visuel codé à la main.
- Deux domaines séparés du EAV : `typesAthena.ts` (socle F0 : `interventions`/`evenements` append-only/`entites`) et `typesFlux.ts` (scénarios de simulation).
- **Onglet Flux** (`/flux`) : `components/flux/FluxPage.tsx` liste les scénarios (`data/scenariosApi.ts` → `public/audio_demo/scenarios.json`) + upload audio local. « Lancer » crée une intervention démo puis rend `SimulationView`.
- **Moteur de simulation** `sim/useSimulation.ts` : `setTimeout` sur les `t_ms` du scénario → révèle le transcript (`PanneauTranscript.tsx`) et, aux pas d'extraction, géocode (`data/geocodageIgn.ts`, IGN sans clé, `SEUIL_FIABLE=0.8`) puis écrit `evenement` + `entite` dans Supabase. **La carte/main courante se mettent à jour via le Realtime F0** (on n'écrit PAS directement le store — on passe par la base, comme un vrai flux).
- `data/interventionApi.ts` : ajouts `majCentreIntervention` (recentrage carte) et `upsertEntite` (id client `crypto.randomUUID`). Journal `evenements` toujours **append-only** (insert seul).
- Prérequis runtime : migration `0002` appliquée + `.env.local`. Sans table → message pédagogique (détecte « Could not find the table »).

## Objet du dépôt

Athena est (à terme) un dashboard temps réel de gestion de crise pour pompiers. Le contenu
actuel du repo est un **éditeur visuel de schémas de données EAV** : un outil où un opérateur
dessine des objets/sous-objets comme des nodes d'un graphe React Flow, leur ajoute des champs
typés, et relie références et sous-objets. Le schéma dessiné est persisté dans Supabase.

Le modèle métier Athena (`Ressources/modele-donnees.md`, `backend/db/schema.sql`) sert
**d'inspiration uniquement** — l'éditeur démarre sur un canvas vierge et est 100 % générique.

## Stack

- **Frontend** (`frontend/`) : Vite + React 18 + TypeScript, `react-router-dom`,
  `@xyflow/react` (React Flow v12), `zustand` (state), `@supabase/supabase-js`.
  **UI : Tailwind CSS v3 + shadcn/ui** (`src/components/ui/`), icônes `lucide-react`.
  Thème sombre (classe `.dark` sur `<html>`, variables shadcn zinc dans `src/index.css`).
  Alias d'import `@` → `src` (configuré dans `vite.config.ts` + `tsconfig.app.json`).
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
- `src/store/useSchemaStore.ts` — store zustand **local-first** : toutes les mutations restent
  en mémoire et marquent `dirty` ; **rien n'est envoyé à Supabase avant `saveAll()`** (bouton
  « Enregistrer » de la `Toolbar`). Les nouveaux ids sont générés côté client (`crypto.randomUUID`)
  pour que les relations pointent vers des cibles avant sauvegarde ; les suppressions sont
  bufferisées (`removedEntityIds`/`removedAttributeIds`) puis envoyées au save.
- `src/data/schemaApi.ts` — CRUD + `saveSchema()` (suppressions puis upserts en lot, entités
  avant attributs pour la FK `target_entity_id`).
- **Pas de synchronisation temps réel** (choix produit : édition locale + save explicite).
  Un garde-fou `beforeunload` avertit si `dirty` à la fermeture de l'onglet.
- **Shell webapp** : `main.tsx` définit un `createBrowserRouter` avec une route layout
  `AppLayout` (shadcn `SidebarProvider` + `AppSidebar` + `SidebarInset` + `<Outlet/>`) et des
  pages enfants : `/` → `SchemaEditorPage`, plus des `PlaceholderPage` (`/tableau-de-bord`,
  `/ressources`, `/parametres`). `AppSidebar` = nav (composant `Sidebar` shadcn, collapsible
  icon). Le `SidebarTrigger` vit dans l'en-tête de chaque page.
- `src/components/` — `SchemaEditorPage` (`ReactFlowProvider` + header + canvas, `h-svh`),
  `Toolbar` (header : trigger sidebar, statut save, boutons Objet/Enregistrer),
  `Canvas` (React Flow, nodes/edges dérivés du store ; **pas de MiniMap**), `nodes/EntityNode`
  (carte shadcn éditable + `FieldRow`/`RelationRow` ; suppression via `AlertDialog`),
  `edges/RelationEdge` (edge custom), `ui/*` (primitives shadcn, dont `sidebar`).

**Toute l'édition se fait sur le node** (pas de panneau latéral : `InspectorPanel` et
`FieldEditor` ont été supprimés). Ajout de champ via bouton dans la carte, type via `Select`
shadcn. Les **relations se créent en tirant un lien** entre deux cartes (`onConnect` du Canvas
→ crée un attribut `reference` ciblant l'entité). Leur genre (`reference`/`object`) se change
via le `Select` de la ligne de relation.

### Conventions & pièges React Flow

- `nodeTypes` / `edgeTypes` sont définis **hors composant** (référence stable, sinon
  warning/re-render).
- Éléments interactifs dans un node (inputs, selects, boutons) : classe **`nodrag`** obligatoire,
  sinon cliquer/glisser dessus déplace le node.
- **Handles** : `source` à droite (`id="s"`), `target` à gauche (`id="t"`).
- **Espacement des racines de liens** : quand plusieurs arêtes partent (ou arrivent) du même
  node, le Canvas groupe par `source` et par `target`, calcule `sourceIndex/sourceCount` +
  `targetIndex/targetCount` et les passe dans `edge.data` ; `RelationEdge` décale alors le point
  d'ancrage le long du côté (`SPACING`) pour répartir uniformément (`getBezierPath` sur un
  `sourceY`/`targetY` offset).
- **Édition inline sans bug** : jamais d'écriture par frappe. Nom d'objet / de champ persistés
  au **blur / Enter** (état local dans le composant, resynchronisé sur changement de prop) ;
  type / liste persistés au **change**. Évite les conflits avec l'écho Realtime.
- Les **positions** sont gérées par React Flow pendant le drag (`useNodesState`) et persistées
  seulement `onNodeDragStop` (type `OnNodeDrag<Node>`, **pas** `NodeMouseHandler`).
- Import du CSS React Flow requis : `@xyflow/react/dist/style.css` (dans `main.tsx`).

## Commandes

- `cd frontend && npm run dev` — dev (port 5173).
- `cd frontend && npm run build` — `tsc -b && vite build` (utilisé pour vérifier les types).
- Migration SQL : SQL Editor Supabase, ou `supabase db push` après `supabase link`.

## État / TODO connus

- Pas d'authentification (accès ouvert assumé) — à durcir avant prod.
- Pas d'export SQL/JSON (décision produit : hors scope v1).
- Bundle > 500 kB (React Flow + Radix/shadcn) — warning bénin, code-splitting possible plus tard.
