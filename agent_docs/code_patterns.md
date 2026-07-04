# Code Patterns — Athena

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
