# 🚨 Athena

**Copilote IA de gestion de crise pour les sapeurs-pompiers.**
Athena écoute les appels d'urgence et les communications radio et construit **en temps réel, sans aucune saisie manuelle**, la situation tactique — victimes, engins, adresses, dangers — sur une carte 3D.

### 🔗 Démo en ligne
**https://athena-khaki.vercel.app/accueil**

---

## Le problème

Pendant une crise (incendie, accident majeur, afflux de victimes), le centre de traitement de l'alerte est submergé : plusieurs appels 112 et canaux radio arrivent **en même temps**. Les informations vitales — *où, combien de victimes, quels dangers, quels moyens engagés* — sont **mal entendues, oubliées, ou noyées dans le bruit**. La prise de notes manuelle ne suit pas.

Les ordres sont mal compris, des messages radio passent à la trappe, des détails cruciaux disparaissent — et chaque information perdue coûte du temps, de l'argent, parfois des vies.

## La solution

Athena **écoute tout** et fait **émerger la clarté du chaos**. Une seule chaîne transforme la voix brute en une image tactique vivante et partagée — **sans clavier, sans saisie**. L'IA ne se trompe jamais d'écoute, ne se contredit jamais, et n'oublie rien.

```
   Appels 112 + radio  (audio, simultanés)
              │
   ┌──────────▼───────────────────────────────────────────┐
   │ 1. ÉCOUTE   Transcription en streaming, mot à mot     │  Google Chirp 3
   │             (plusieurs appels en parallèle)           │
   ├───────────────────────────────────────────────────────┤
   │ 2. COMPREND Un agent LLM lit VOTRE modèle de données  │  Agent Claude
   │             et en extrait entités, liens et positions │  (tool-use)
   │             — avec résolution d'entités entre appels  │
   ├───────────────────────────────────────────────────────┤
   │ 3. MÉMORISE Chaque fait est écrit dans un journal     │  Supabase
   │             horodaté, append-only. Rien n'est écrasé. │  (event sourcing)
   ├───────────────────────────────────────────────────────┤
   │ 4. AFFICHE  Carte 3D, graphe mémoire, couche          │  Realtime
   │             sémantique et timeline — en direct.       │
   └───────────────────────────────────────────────────────┘
```

---

## 🧪 Tester la démo (pour le jury)

> ⏱️ **Cold start** : le backend (transcription + IA) tourne sur un hébergement gratuit. Le **tout premier lancement peut mettre 30–60 s à se « réveiller »**. C'est normal, patiente un peu.

**Entrer dans l'application :** ouvre **https://athena-khaki.vercel.app/accueil** et clique **« See the dashboard »**. Tu arrives sur le tableau de bord — barre latérale à gauche, contrôles flottants en bas à droite. Ensuite, au choix :

### Option A — Aperçu instantané (30 secondes, le plus simple)

Pour voir le résultat tout de suite, sans attendre le temps réel :

1. Sur le **Dashboard**, en **bas à droite** de l'écran, clique sur le bouton **🧪 (fiole)** — *« Fill with mock objects »*.
   → La carte 3D et les panneaux se remplissent instantanément d'une situation type (victimes, engins, lieux). Re-clique pour vider.

### Option B — La vraie simulation temps réel (l'expérience complète) ⭐

1. Barre latérale → **« Simulation »**.
2. En haut à droite, dans le menu **« Active: »**, sélectionne le **scénario de démonstration**.
3. Barre latérale → **« Dashboard »**.
4. En bas à droite, clique sur **▶ (Play)** — *« Start the demo »*.
5. **Regarde faire** 👀 : les appels d'urgence se jouent en temps réel, la transcription défile dans le panneau **« Live feed »**, et l'IA fait apparaître **toute seule** les victimes, engins et adresses sur la carte 3D — pendant que le graphe mémoire, la couche sémantique et la timeline de rejeu se remplissent.
   - **↺** revient au début · **■** coupe.

**Les panneaux du Dashboard** (déplaçables, comme un poste de commandement) :

| Panneau | Contenu |
|---|---|
| **Map** | Carte 3D IGN, bâtiments en relief, entités géolocalisées, animation de l'engin depuis sa caserne |
| **Objects** | Les objets extraits par l'IA, groupés par type |
| **Live memory** | La mémoire de l'IA visualisée en graphe, qui grandit en direct |
| **Semantic Layer Edit** | Ce que l'IA a compris, avec le diff avant/après (clic → détail) |
| **Live feed** / **Past calls** | Les flux audio en direct et les appels passés avec leur transcription |

---

## ✨ Ce qui nous différencie

- **Zéro saisie manuelle.** L'opérateur ne tape rien : l'IA écoute et documente à sa place.
- **Temps réel & multi-appels.** Transcription en streaming de plusieurs appels 112 + radios **simultanés** — le vrai chaos d'une crise, pas un fichier propre.
- **Extraction pilotée par VOTRE schéma.** Vous *dessinez* vos objets métier (Victime, Engin, Lieu…) dans l'éditeur de schéma ; l'agent LLM instancie **exactement ces types**, avec **résolution d'entités entre appels** (une même victime citée deux fois = un seul objet).
- **Carte tactique 3D souveraine.** MapLibre + **Géoplateforme IGN** (données publiques françaises) : bâtiments 3D (BD TOPO®), géocodage, itinéraire de l'engin *caserne → intervention*.
- **Mémoire event-sourcée + rejeu (RETEX).** Tout est horodaté et append-only ; une timeline permet de **re-scruber** l'intervention (avant / après) pour le débriefing.
- **Explicable — « l'IA propose, l'humain valide ».** La couche sémantique montre le diff de chaque décision de l'IA et sa « stack trace » de raisonnement. Rien n'est écrasé en silence.

---

## 🏗️ Stack technique

| Couche | Technologies |
|---|---|
| **Frontend** | Vite · React · TypeScript · Tailwind + shadcn/ui · MapLibre GL + IGN · dockview · React Flow · zustand — déployé sur **Vercel** |
| **Backend** | FastAPI (Python) sur **Render** — Google Cloud Speech-to-Text V2 (Chirp 3) · agent **Anthropic Claude** (tool-use natif) · PyAV |
| **Données** | **Supabase** — PostgreSQL · Realtime · Storage |

## 📁 Structure du dépôt

- `frontend/` — l'application React : éditeur de schéma, créateur de simulation, dashboard temps réel
- `poc-stt/` — le backend Python : transcription en streaming + agent LLM d'extraction
- `supabase/` — migrations SQL (schéma versionné)
- `Ressources/` — modèle de données de référence Athena

## 💻 Lancer en local

**Frontend :**

```bash
cd frontend
cp .env.example .env.local     # renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm install
npm run dev                    # http://localhost:5173
```

**Backend (transcription + IA), optionnel :**

```bash
cd poc-stt
# .env : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, identifiants Google Cloud, ANTHROPIC_API_KEY
uv run uvicorn main:app
```

> L'accès est **ouvert** (clé Supabase `anon` + RLS permissive, pas d'authentification) — à durcir avant une vraie mise en production.
