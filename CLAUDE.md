# CLAUDE.md — Projet Athena

## Workflow agents — à lire en premier

1. **Plan directeur : [AGENTS.md](AGENTS.md)** — phase courante, roadmap, règles « à ne pas faire ». S'y référer avant toute tâche de build.
2. **Détails à la demande :** `agent_docs/` (brief, stack, patterns, exigences produit, tests).
3. **Docs stratégiques complets :** `vibe-coding-prompt-template-main/docs/` (recherche, PRD, TechDesign, ARCHITECTURE).
4. **Méthode :** plan en 5 lignes → accord → implémenter petit → `cd frontend && npm run build` + test manuel avant d'avancer.

Le reste de ce fichier décrit les conventions de l'existant (éditeur EAV) — elles restent valables.

## Dashboard Athena — Créateur de simulation (F2, juil. 2026)
- **Contrainte UI (non négociable, cf. `plan_base_webapp.md`) : UI = composants shadcn emboîtés uniquement**, aucun visuel codé à la main. NB : une **timeline** implique du positionnement absolu inévitable (clips en px) — assemblé avec `Button`/`Card` faute des composants dédiés (CLI shadcn KO ici, voir plus bas).
- Domaines séparés du EAV : `typesAthena.ts` (socle F0) et `typesSimulation.ts` (`Appel` : `audio_url`, `ts_debut_ms`, `duree_ms`, `piste`).
- **Créateur `/flux`** (`components/simulation/SimulationPage.tsx`) : glisser des MP3 (1 MP3 = 1 appel) → `sim/audioMeta.ts` lit la durée → `data/storageAudio.ts` upload dans **Supabase Storage** (bucket `appels-audio`, public) → `data/appelsApi.ts` insère une ligne `appels`.
- **Timeline** `TimelineMontage.tsx` : clips draggables (pointer events, logique pure), position X = `ts_debut_ms`, Y = `piste` (overlap) ; échelle `PX_PER_SEC`. Persiste via `updateAppel` au relâchement.
- **Contrôle flottant** `ControleSimulation.tsx` (bas-droite, monté dans `AppLayout`) piloté par le store `store/useSimulationPlayback.ts` : Lancer/Revenir/Couper. **Aucun panneau** (exigence utilisateur).
- **Moteur Web Audio** (`useSimulationPlayback.ts`) : chaque appel = `<audio crossOrigin=anonymous>` → `MediaElementSource` → `AnalyserNode`. **Muet par défaut** : l'analyser n'est PAS relié à `ctx.destination`. `basculerEcoute(id)` connecte/déconnecte l'analyser à la sortie = toggle écoute. `getAnalyseur(id)` alimente l'histogramme. État réactif : `actifs` (fenêtre temporelle, calculé dans le rAF), `ecoutes`. `AudioContext` créé/resumé dans le geste du clic (avant le fetch) pour l'autoplay. CORS OK (Supabase Storage renvoie `Access-Control-Allow-Origin: *`).
- **Dashboard `/tableau-de-bord`** (`components/dashboard/DashboardPage.tsx`, page directe) = `ResizablePanelGroup` (`ui/resizable.tsx`, dep `react-resizable-panels`) : **carte** (`dashboard/Carte.tsx`, gauche) + **`PanneauFluxAudio.tsx`** (droite). Chaque flux : titre + `VisualiseurVoix` (barres pilotées par `getByteFrequencyData`, repli synthétique si pas d'analyser) + toggle écoute (`Volume2`/`VolumeX`).
- **Transcription — archi serveur « produce → store → display »** (refactor archi, remplace l'approche STT-navigateur initiale). Flux : le clic **« Lancer »** de la simulation (`store/useSimulationPlayback.lancer()`) fait un **`POST /transcribe`** au backend Render (`data/transcribeApi.ts`, URL HTTP dérivée de `VITE_STT_WS_URL`). Le **backend `poc-stt/`** (job serveur) : lit les appels dans Supabase → **supprime** leurs transcriptions existantes (recalcul « à chaque lancement ») → pour chaque appel, en tâche de fond (`ThreadPoolExecutor`, `transcribe_job.py`) : télécharge le MP3, le **décode en PCM 16 kHz mono via PyAV** (`audio_decode.py`, wheel `av` = ffmpeg embarqué, pas de dépendance OS), le stream **au rythme réel** (chunk 80 ms / 80 ms → live) à travers `stt_client.run_stt_stream` (Chirp 3 streaming), et **`INSERT` chaque segment `final`** dans la table `transcriptions` (via `supabase_client.py`, clé **service_role**). L'`interim` n'est PAS persisté (bruit UI). Le **dashboard est pur lecteur** : `FeuilleTranscription.tsx` (Sheet droite, même carte audio + toggle écoute) lit `transcriptions` via `hooks/useTranscriptionDB.ts` (`data/transcriptionsApi.ts` : `select` initial + abonnement **Realtime** ; un segment `ordinal===0` = nouveau run → reset). **Aucune STT côté front** (les ex-`lib/sttStream.ts` / `hooks/useTranscription.ts` ont été supprimés). Migration **`0004_transcriptions.sql`** (table + Realtime + RLS permissive). Prérequis runtime : migration `0004` appliquée + env Render **`SUPABASE_URL`** & **`SUPABASE_SERVICE_ROLE_KEY`** (en plus des creds GCP). Backend Render existant : `athena-kh52.onrender.com` (voir mémoire projet). `POST /transcribe` cross-origin → **CORS ajouté** dans `main.py`. ⚠ « à chaque lancement » = re-appel Google pour tous les appels à chaque clic Lancer (coût). Le futur service LLM (F3) consommera `transcriptions`.
- ⚠ **La notion d'« intervention » a été retirée de l'UI** (4 juil.) : supprimés `components/intervention/*`, `store/useInterventionStore.ts`, `hooks/useRealtimeIntervention.ts`. Restent dormants `data/interventionApi.ts` + `typesAthena.ts` (types `Entite`/`Evenement`/`STATUTS` encore utilisés par la carte) comme socle de la future pipeline — le modèle DB (`evenements`/`entites`) est encore ancré sur `intervention_id`, à revoir quand on branchera la pipeline.
- La **pipeline de traitement** (STT → extraction LLM → `evenements`/`entites`) reste à brancher (F3) ; helpers prêts : `data/geocodageIgn.ts` (IGN sans clé, `SEUIL_FIABLE=0.8`) et `data/interventionApi.ts` (`upsertEntite`, `majCentreIntervention`, journal append-only).
- Prérequis runtime : migrations `0002` **et** `0003` appliquées + `.env.local`. `0003` crée la table `appels` **et** le bucket Storage.
- ⚠ **CLI shadcn inutilisable ici** : `npx shadcn add` ne reconnaît pas ce repo Vite (pas de `components.json` d'origine) et scaffolde un `next-app/` parasite (supprimé). Pour ajouter un composant shadcn : **copier son source à la main** dans `src/components/ui/`.

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
  bufferisées (`removedEntityIds`/`removedAttributeIds`) puis envoyées au save. `addAttribute`
  calcule `ordinal = max(voisins)+1` (pas `siblings.length` : évite la collision d'ordinal après
  suppression au milieu). `saveAll()` **relance `load()`** après le push → l'état canonique
  (created_at, ordre, ids) revient de Supabase. `resetSchema()` **vide tout** le schéma en base
  (bouton « Réinitialiser », dialog de confirmation) puis remet le local à zéro.
- **Deux boutons d'enregistrement distincts** (demande explicite) : `saveAll()` = « **Écraser
  Supabase** » (remplace le schéma live des tables entities/attributes) ; `saveVersion(label?)` =
  « **Enregistrer la version** » = snapshot du canvas courant (même non écrasé) dans l'historique
  `schema_versions`. Historique : `loadVersions()` (métadonnées), `restoreVersion(id)` recharge le
  payload **dans le canvas** en `dirty` **sans** toucher les tables live (l'utilisateur écrase
  ensuite s'il veut), `renameVersion`/`removeVersion` (optimistes). UI = `SchemaHistorySheet.tsx`
  (Sheet droite : liste, renommage inline, Restaurer, Supprimer).
- `src/data/schemaApi.ts` — CRUD + `saveSchema()` (suppressions puis upserts en lot, entités
  avant attributs pour la FK `target_entity_id`) + `deleteAllSchema()` (delete all attributs puis
  entités ; filtre `neq('id', <uuid impossible>)` car Supabase exige un filtre sur un delete) +
  historique (`listVersions`/`saveVersion`/`getVersionPayload`/`renameVersion`/`deleteVersion`,
  table `schema_versions`, migration **`0006`**).
- **Pas de synchronisation temps réel** (choix produit : édition locale + save explicite).
  Un garde-fou `beforeunload` avertit si `dirty` à la fermeture de l'onglet. **Resynchro à
  l'ouverture** : la remonte de `SchemaEditorPage` par le routeur relance `load()` → le canvas
  reflète le schéma Supabase courant à chaque clic sur l'onglet (bannière « Synchronisation… »
  tant que `status==='loading'`).
- **Shell webapp** : `main.tsx` définit un `createBrowserRouter` avec une route layout
  `AppLayout` (shadcn `SidebarProvider` + `AppSidebar` + `SidebarInset` + `<Outlet/>`) et des
  pages enfants : `/` → `SchemaEditorPage`, plus des `PlaceholderPage` (`/tableau-de-bord`,
  `/ressources`, `/parametres`). `AppSidebar` = nav (composant `Sidebar` shadcn, collapsible
  icon). Le `SidebarTrigger` vit dans l'en-tête de chaque page.
- `src/components/` — `SchemaEditorPage` (`ReactFlowProvider` + header + canvas, `h-svh`),
  `Toolbar` (header : trigger sidebar, statut save, boutons Objet / **Historique** (`SchemaHistorySheet`) /
  **Réinitialiser** / **Enregistrer la version** / **Écraser Supabase**),
  `Canvas` (React Flow, nodes/edges dérivés du store ; **pas de MiniMap**), `nodes/EntityNode`
  (carte shadcn éditable, un seul composant `FieldRow` ; suppression via `AlertDialog`),
  `edges/RelationEdge` (edge custom), `ui/*` (primitives shadcn, dont `sidebar`).

**Toute l'édition se fait sur le node** (pas de panneau latéral : `InspectorPanel` et
`FieldEditor` ont été supprimés). Ajout de champ via bouton dans la carte, type via `Select`
shadcn qui liste **TOUS les types** (dont `reference` « Référence → objet » et `object`
« Sous-objet »). **Plus de section « Relations » séparée** : une relation est un champ dont le
type cible un autre objet. Quand un champ est de type relation, un **Handle apparaît pile en face
de sa ligne** (`id="f-<attrId>"`) ; on le tire vers une autre carte → `onConnect` pose
`target_entity_id` **sur ce champ précis** (il *modifie* l'attribut, il n'en crée pas → plus de
doublons possibles ; auto-référence autorisée, ex. Personnel→Personnel). Aucun menu de sélection
de cible. `reference` = arête pleine, `object` = arête pointillée.

### Conventions & pièges React Flow

- `nodeTypes` / `edgeTypes` sont définis **hors composant** (référence stable, sinon
  warning/re-render).
- Éléments interactifs dans un node (inputs, selects, boutons) : classe **`nodrag`** obligatoire,
  sinon cliquer/glisser dessus déplace le node.
- **Handles** : **une source par champ-relation** à droite (`id="f-<attrId>"`, rendue *dans* la
  `FieldRow`, positionnée absolue `right:-13`), **une seule cible** par carte à gauche (`id="t"`).
  La `Card` n'a **pas** `overflow-hidden` (sinon les handles au bord sont rognés). Comme les
  handles vivent dans les lignes, `EntityNode` appelle **`useUpdateNodeInternals(id)`** dès que la
  mise en page change (signature = `id:data_type` de chaque champ) pour que React Flow re-mesure
  leur position — sinon les arêtes s'ancrent au mauvais Y. Du coup `RelationEdge` est un simple
  bézier (l'ancrage source est déjà le bon, plus de calcul d'offset `SPACING`).
- **Édition inline sans bug** : jamais d'écriture par frappe. Nom d'objet / de champ persistés
  au **blur / Enter** (état local dans le composant, resynchronisé sur changement de prop) ; un
  nom **vidé** au blur **restaure** la valeur courante (pas de nom vide en base) ;
  type / liste persistés au **change**. Évite les conflits avec l'écho Realtime.
- Les **positions** sont gérées par React Flow pendant le drag (`useNodesState`) et persistées
  seulement `onNodeDragStop` (type `OnNodeDrag<Node>`, **pas** `NodeMouseHandler`).
- **Réordonner les champs + redimensionner la carte** (poignées à **logique pointer pure**, pas de
  lib DnD, cf. convention timeline) : chaque `FieldRow` a une poignée `GripVertical` (`nodrag`,
  `setPointerCapture`) → `EntityNode` maintient un ordre local pendant le drag (via `orderRef` +
  refs de lignes, cible = ligne sous le pointeur), et au relâché appelle `reorderAttributes`
  (réécrit les `ordinal`). **Redimensionnement largeur + hauteur** via **3 poignées invisibles**
  (`nodrag`, transparentes, légèrement en dehors de la carte) : bord droit (largeur), bord bas
  (hauteur), coin bas-droit (les deux). `liveWidth`/`liveHeight` locaux pendant le drag, commit
  `setEntitySizeLocal(id, w?, h?)` au relâché (gated par axe). `Card` porte
  `style={{ width, minHeight: height }}` : la **largeur est fixe**, la **hauteur est une min-height**
  (le contenu reste toujours visible, on ne rogne jamais → pas de scroll interne qui désaligne les
  handles). Le delta écran est **divisé par le zoom** (`rf.getZoom()`) pour rester en coordonnées
  flow. Bornes `MIN/MAX_WIDTH` (240–560) et `MIN/MAX_HEIGHT` (96–800). **Le drag de carte reste
  intact** : seules poignées/champs sont `nodrag`. `updateNodeInternals` déclenché aussi sur ordre,
  largeur et hauteur. ⚠ Pas de texte d'aide sous les champs-relations (retiré) : le lien se voit à
  l'arête, pas à une mention « → cible ».
- Import du CSS React Flow requis : `@xyflow/react/dist/style.css` (dans `main.tsx`).

## Commandes

- `cd frontend && npm run dev` — dev (port 5173).
- `cd frontend && npm run build` — `tsc -b && vite build` (utilisé pour vérifier les types).
- Migration SQL : SQL Editor Supabase, ou `supabase db push` après `supabase link`.

## État / TODO connus

- Pas d'authentification (accès ouvert assumé) — à durcir avant prod.
- Pas d'export SQL/JSON (décision produit : hors scope v1).
- Bundle > 500 kB (React Flow + Radix/shadcn) — warning bénin, code-splitting possible plus tard.
- **Prérequis runtime historique** : appliquer la migration **`0006_schema_versions.sql`** dans
  Supabase (SQL Editor). Sans elle, « Enregistrer la version » et le panneau Historique remontent
  une erreur (table absente) — l'éditeur EAV lui-même fonctionne quand même.
- **Prérequis runtime taille des cartes** : appliquer **`0007_entity_width.sql`** (colonne
  `entities.width`) **et `0008_entity_height.sql`** (colonne `entities.height`). ⚠ Sans elles,
  « Écraser Supabase » **échoue** (l'upsert envoie `width`/`height`) — donc le réordre (via
  `ordinal`) ne se sauvegarde pas non plus tant que `0007` **et** `0008` ne sont pas appliquées.
