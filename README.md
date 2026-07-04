# Athena

Outil visuel de création de **schémas de données EAV** (Entity-Attribute-Value) pour le
projet Athena. L'opérateur dessine ses objets sur un canvas graphe (chaque objet / sous-objet
est un node), leur ajoute des champs typés, et relie références et sous-objets. Le schéma est
persisté dans Supabase.

## Structure

- `frontend/` — application **Vite + React + React Router + React Flow** (l'éditeur)
- `supabase/` — `config.toml` + migrations SQL (méta-schéma versionné dans git)
- `Ressources/` — modèle de données de référence Athena (inspiration, non chargé par l'outil)
- `backend/` — réservé (vide pour l'instant)
- `AGENTS.md` + `agent_docs/` — plan directeur et consignes pour les assistants IA (vibe-coding, étape 4)
- `vibe-coding-prompt-template-main/docs/` — documents stratégiques (recherche, PRD, TechDesign, architecture)

## Concepts (méta-schéma EAV)

L'outil ne stocke pas des données métier mais la **définition** des schémas :

- **`entities`** — un objet (`is_subobject = false`) ou un sous-objet (`is_subobject = true`).
- **`attributes`** — un champ d'une entité (nom + type). Types disponibles : `string`, `text`,
  `boolean`, `integer`, `number`, `datetime`, `enum`, `reference` (→ un autre objet), `object`
  (sous-objet). Un champ peut être une **liste** (`is_list`) et **obligatoire** (`required`).
- Les **arêtes** du graphe sont dérivées des champs `reference` / `object` (via `target_entity_id`).

## Démarrage rapide

### 1. Créer le projet Supabase et appliquer le schéma

1. Crée un projet sur [supabase.com](https://supabase.com).
2. Applique la migration, au choix :
   - **SQL Editor** : copie-colle le contenu de
     `supabase/migrations/0001_init_eav_editor.sql` et exécute-le ; **ou**
   - **CLI** :
     ```bash
     supabase login
     supabase link --project-ref <ref-de-ton-projet>
     supabase db push
     ```

### 2. Connecter Supabase à git (versionner le schéma)

Dans le dashboard Supabase → **Settings → Integrations → GitHub** : connecte ce dépôt.
À partir de là, les migrations du dossier `supabase/migrations/` sont suivies par git et
peuvent être déployées via les branches Supabase (Preview Branches). Cette étape se fait dans
le dashboard (OAuth GitHub) — elle ne peut pas être automatisée depuis le code.

### 3. Lancer le frontend

```bash
cd frontend
cp .env.example .env.local     # puis renseigne les 2 variables
npm install
npm run dev                    # http://localhost:5173
```

Variables d'environnement (dashboard Supabase → **Project Settings → API**) :

| Variable | Valeur |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet (`https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | clé publique `anon` |

> Sans `.env.local`, l'app démarre quand même et affiche une bannière d'aide, mais rien n'est
> sauvegardé.

## Utilisation

1. **＋ Nouvel objet** (barre du haut) crée un node au centre du canvas.
2. Sélectionne un objet → le **panneau de droite** permet de le renommer, changer sa couleur,
   ajouter/éditer/supprimer des **champs**, ou supprimer l'objet.
3. Un champ de type **Référence** ou **Sous-objet** cible un autre objet (existant ou créé à la
   volée) → une **arête** apparaît automatiquement (pleine = référence, pointillée animée =
   sous-objet).
4. Déplace les nodes : la position est sauvegardée. Recharge la page → tout revient.
5. Plusieurs onglets restent synchronisés en temps réel (Supabase Realtime).

## Accès / sécurité

Accès **ouvert** pour l'instant : clé `anon` + RLS avec policies permissives (`using (true)`).
Pas d'authentification. À restreindre avant toute mise en production (ajouter Supabase Auth et
des policies par utilisateur).

## Scripts (`frontend/`)

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de dev (port 5173) |
| `npm run build` | build de production (`tsc -b && vite build`) |
| `npm run preview` | prévisualise le build |
