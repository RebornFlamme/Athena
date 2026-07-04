# Code Patterns — Athena

## Règle UI absolue (instruction Oscar, 4 juil. 2026)
- **AUCUN élément visuel codé à la main** : uniquement des **composants shadcn emboîtés** les uns dans les autres. Pas de div stylée custom, pas de CSS maison (les classes Tailwind utilitaires de mise en page — flex, gap, tailles — restent permises pour *assembler*, jamais pour *dessiner*).
- Doc d'un composant : `https://ui.shadcn.com/docs/components/base/<nom>.md` (ex. `.../base/accordion.md`) — la consulter (WebFetch) avant d'utiliser un composant non encore présent dans `src/components/ui/`.
- **Composants disponibles** : Accordion · Alert · Alert Dialog · Aspect Ratio · Attachment · Avatar · Badge · Breadcrumb · Bubble · Button · Button Group · Calendar · Card · Carousel · Chart · Checkbox · Collapsible · Combobox · Command · Context Menu · Data Table · Date Picker · Dialog · Direction · Drawer · Dropdown Menu · Empty · Field · Hover Card · Input · Input Group · Input OTP · Item · Kbd · Label · Marker · Menubar · Message · Message Scroller · Native Select · Navigation Menu · Pagination · Popover · Progress · Radio Group · Resizable · Scroll Area · Select · Separator · Sheet · Sidebar · Skeleton · Slider · Sonner · Spinner · Switch · Table · Tabs · Textarea · Toast · Toggle · Toggle Group · Tooltip · Typography
- **Correspondances Athena** : transcript live → `Message` + `Message Scroller` · upload d'audio → `Attachment` · appels qui popent → `Sonner` · états vides → `Empty` · chargements → `Spinner`/`Skeleton` · marqueurs carte → `Marker` (à évaluer, sinon composer) · timeline de montage → assemblage `Scroll Area` + `Slider` + `Item` + `Context Menu` + `Tooltip` (mécanique de drag = logique pure, rendu shadcn) · listes d'appels → `Item`/`Data Table` · badges d'état → `Badge`.
- Dette de conformité connue : les marqueurs MapLibre de `CarteIntervention.tsx` (div custom) → à remplacer lors de F1.

## Architecture en couches (respecter ce sens de dépendance)
```
types.ts  →  lib/ (logique pure)  →  data/ (accès Supabase)  →  store/ (zustand)  →  hooks/  →  components/
```
- `src/types.ts` : types miroir des tables SQL + constantes (`DATA_TYPES`…). Un seul endroit.
- `src/data/*Api.ts` : CRUD Supabase **pur** (aucune logique d'UI, aucun state).
- `src/store/*.ts` : zustand — **mise à jour locale optimiste, puis appel API, puis réconciliation Realtime idempotente par id** (pattern établi dans `useSchemaStore.ts` : à reproduire pour le dashboard).
- `src/hooks/useRealtime*.ts` : abonnements `postgres_changes` → dispatch vers le store.
- `src/components/` : affichage seulement ; l'état vient du store.

## Conventions établies (éditeur EAV — à respecter, ne pas casser)
- `nodeTypes` React Flow défini **hors composant** (référence stable).
- Sélection pilotée par le store (`selectedEntityId`), pas par React Flow.
- Positions persistées **uniquement** `onNodeDragStop` (type `OnNodeDrag<Node>`, pas `NodeMouseHandler`).
- Import CSS requis : `@xyflow/react/dist/style.css` dans `main.tsx`.
- CSS simple dans `index.css` (thème sombre), **aucun framework UI** — continuer ainsi.

## Patterns dashboard (nouvelles règles, phases F0+)
- **Écriture au journal** : toute mutation métier passe par une fonction `data/evenementsApi.ts` qui INSÈRE dans `evenements` (jamais d'UPDATE/DELETE). La projection `entites` est mise à jour par le même appel (ou trigger SQL) — jamais directement depuis un composant.
- **Abonnement par intervention** : canal Realtime filtré `intervention_id=eq.{id}`, ouvert dans un hook `useRealtimeIntervention(id)`, nettoyé au démontage.
- **Badges d'état partout** : tout affichage d'une info métier montre `statut` (ambre présumé / vert confirmé / rouge à valider) et la fiabilité. Composant unique `BadgeFiabilite`.
- **Zod aux frontières** : toute donnée qui entre (réponse LLM, formulaire) est validée par un schéma zod avant d'entrer dans le store.
- **Edge Functions** : une fonction = un fichier = une responsabilité (`extraction`, `stt-token`). Les secrets n'existent que là.

## Nommage
- Domaine en **français** (cohérent avec le métier et le SQL) : `evenements`, `entites`, `MainCourante`, `RejeuRetex`, `FicheExtraction`.
- Composants en PascalCase, hooks en `useCamelCase`, fichiers API en `camelCaseApi.ts`.
- Types d'événements en SCREAMING_SNAKE : `VICTIME_SIGNALEE`, `MOYEN_PRESENTE`, `ORDRE_DONNE`, `CORRECTION`.

## Gestion d'erreurs
- Jamais d'échec silencieux : toute erreur API remonte une bannière/toast lisible en français.
- IA en panne = mode dégradé visible (« transcription indisponible — saisie manuelle ») pas un crash.
- Erreurs attendues (adresse introuvable, audio inaudible) = états UI de première classe, pas des `catch` vides.
