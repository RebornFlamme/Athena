# Testing — Athena

## Boucle de vérification (après CHAQUE changement)
1. `cd frontend && npm run build` — le compilateur TypeScript est le premier filet (le build échoue si les types cassent).
2. Test manuel de la feature en cours, **décrit avant de coder** (« je joue l'audio X, je dois voir Y sur la carte en < 2 s »).
3. Vérifier que l'éditeur EAV (`/`) fonctionne toujours (non-régression rapide).

## Tests manuels de référence par phase
| Phase | Test qui fait foi |
|---|---|
| F0 | INSERT à la main dans `evenements` (SQL Editor Supabase) → marqueur + ligne main courante apparaissent sans recharger |
| F1 | enregistrement « feu 3ᵉ étage, 12 rue des Lilas, 1 personne bloquée » → victime placée au bon endroit, zéro clavier ; enregistrement piège (adresse ambiguë) → bandeau validation humaine |
| F1-bis | couper `GLADIA_API_KEY` → message clair + saisie manuelle fonctionne (pas de crash) |
| F2 | une correction crée une ligne `CORRECTION` liée ; l'ancienne info reste visible barrée/périmée |
| F3 | curseur temporel → les entités apparaissent/disparaissent dans l'ordre chronologique réel |
| F4 | démo complète 3× de suite sans accroc, sur tablette |

## Banc d'essai STT (livrable de la phase F1, AVANT de choisir un fournisseur)
Page interne : upload d'un fichier audio → transcriptions Gladia / alternative(s) côte à côte + temps de réponse. Juger sur NOS enregistrements (téléphone, accents, stress simulé) — aucun benchmark public ne couvre le français téléphonique dégradé.

## Definition of Done — démo MVP
- [ ] Parcours complet : audio joué → extraction → carte → main courante → rejeu
- [ ] Adresse ambiguë → validation humaine demandée
- [ ] STT en panne → mode dégradé fonctionnel
- [ ] Tablette + desktop OK
- [ ] ≥ 90 % d'extraction correcte sur les 5 enregistrements test
- [ ] Zéro contenu bouche-trou ; données fictives réalistes
- [ ] Démo répétée 3× sans accroc

## Plus tard (pas maintenant)
- Vitest sur `lib/` (projection, retex — logique pure facilement testable)
- Playwright sur le parcours critique
- Hooks pre-commit (le template en fournit dans `vibe-coding-prompt-template-main/.claude/hooks/hooks.json` — à activer sur demande)
