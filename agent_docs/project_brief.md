# Project Brief — Athena

## Vision
Le poste de commandement des pompiers qui se remplit tout seul. Pendant une intervention, l'information circule à la voix (appels 18/112, radio) puis est ressaisie à la main sur des tableaux séparés par 4 officiers (source : Mémento Chef de Colonne ENSOSP). Athena transcrit, extrait et place automatiquement ces informations sur une carte temps réel — le COS garde les yeux sur le terrain.

## Utilisateurs
- **Primaire :** le COS et ses officiers de PC (Moyens, Renseignements, Actions, Anticipation) — sous stress extrême, sur tablette, parfois de nuit.
- **Secondaire :** l'opérateur CTA-CODIS qui reçoit l'appel.

## Règles non négociables (à appliquer dans CHAQUE feature)
1. **Le journal est la vérité** : `evenements` est append-only. Toute correction est un nouvel événement qui pointe l'ancien. Le rejeu RETEX découle de cette règle.
2. **L'IA propose, l'humain valide** : toute info arrive en statut `presume` (badge ambre). L'adresse avec score de géocodage < 0,8 exige une validation humaine explicite.
3. **Traçabilité totale** : chaque info porte sa source, son double horodatage (observation ≠ déclaration) et sa fiabilité (Admiralty A1→F6).
4. **Pas de point de défaillance unique** : STT ou LLM en panne → la saisie manuelle alimente le même journal ; le dashboard fonctionne sans IA.
5. **Aucun secret côté client** : les clés vivent dans les Edge Functions (`supabase secrets`).
6. **Données fictives uniquement en MVP** : enregistrements scénarisés, jamais de vrai appel (RGPD).

## Qualité (quality gates)
- `cd frontend && npm run build` passe (TypeScript strict) après chaque changement.
- Chaque feature a son test manuel décrit AVANT d'être codée, et il passe avant de continuer.
- Lisibilité sous stress : gros contrastes, badges d'état (ambre présumé / vert confirmé / rouge à valider), la carte occupe ~70 % de l'écran.
- Pas de feature à moitié : complète ou coupée.

## Commandes clés
```bash
cd frontend && npm run dev        # dev (port 5173)
cd frontend && npm run build      # vérification types + build
supabase db push                  # appliquer les migrations
supabase functions serve          # tester les Edge Functions en local
supabase secrets set CLE=valeur   # stocker un secret serveur
```

## Jalon de succès
Démo de 20 min sans accroc devant des pompiers : un enregistrement d'appel joué → fiche remplie, victime placée sur la carte, main courante écrite, SITAC dessinée — zéro clavier. Puis rejeu de l'intervention pour le débriefing.
