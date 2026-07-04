# Architecture complète — Athena MVP

> Vue d'ensemble technique du système : les briques, qui fait quoi, comment l'information circule, et comment tout ça évolue vers le pilote.
> Documents liés : [PRD-Athena-MVP.md](PRD-Athena-MVP.md) (le quoi) · [TechDesign-Athena-MVP.md](TechDesign-Athena-MVP.md) (le comment + SQL complet) · [RECHERCHE_ATHENA.md](RECHERCHE_ATHENA.md) (les preuves).

---

## 1. Vue d'ensemble — les 5 niveaux

```
┌─────────────────────────── ① SOURCES ────────────────────────────┐
│  Appel 18/112              Radio ANTARES           Saisie manuelle │
│  (MVP : fichier audio      (phase 2 —              (fallback       │
│   joué, pas de vraie        fine-tuning requis)     toujours       │
│   téléphonie)                                       disponible)    │
└───────────────┬──────────────────────────────────────────────────┘
                ▼
┌────────────────────────── ② PIPELINE IA ──────────────────────────┐
│  Transcription ──▶ Extraction LLM ──▶ Validation                   │
│  Gladia streaming   structured output   géocodage IGN              │
│  FR, ~300 ms        JSON forcé, <5 s    + humain si score faible   │
└───────────────┬──────────────────────────────────────────────────┘
                ▼
┌─────────────── ③ CŒUR DE DONNÉES — Supabase (PostgreSQL) ─────────┐
│  JOURNAL D'ÉVÉNEMENTS  ──────▶  PROJECTION « ENTITÉS »             │
│  append-only, jamais effacé      état courant de chaque acteur/    │
│  = LA VÉRITÉ                     moyen/zone = la photo affichable  │
└───────────────┬──────────────────────────────────────────────────┘
                ▼
┌──────────────────────── ④ TEMPS RÉEL ─────────────────────────────┐
│  Supabase Realtime : push websocket vers tous les écrans, < 2 s   │
└───────────────┬──────────────────────────────────────────────────┘
                ▼
┌──────────────────── ⑤ DASHBOARD — Next.js ────────────────────────┐
│  Carte            Panneau appel      Main courante   Rejeu RETEX  │
│  MapLibre + IGN   transcription      journal         curseur      │
│                   live + fiche       affiché         temporel     │
└───────────────────────────────────────────────────────────────────┘
```

**Les 3 principes structurants :**
1. **Le journal est la vérité, la projection est le confort.** Tout fait entre dans `evenements` (append-only) ; `entites` n'est qu'une photo recalculée. Le rejeu RETEX = relire le journal jusqu'à l'instant T.
2. **Pas de point de défaillance unique.** Si le STT ou le LLM tombe, la saisie manuelle alimente le même journal ; le dashboard ne sait même pas que l'IA est en panne.
3. **L'IA propose, l'humain valide.** Toute donnée critique (l'adresse en premier) porte un statut `presume` tant qu'un humain ne l'a pas confirmée.

---

## 2. Qui fait quoi — répartition des responsabilités

| Brique | Rôle | Technologie | Où ça tourne |
|---|---|---|---|
| **Navigateur** (COS, opérateur) | Afficher le dashboard, valider les infos | Chrome/Safari, tablette ou desktop | Chez l'utilisateur |
| **Frontend Next.js** | Les écrans : carte, panneau appel, main courante, rejeu | React + Tailwind + MapLibre GL JS | Vercel (démo) |
| **Routes API Next.js** (`/api/*`) | Tout ce qui touche aux **secrets** : appel LLM, géocodage, tokens STT | Next.js App Router (serveur) | Vercel (démo) |
| **Base de données** | La vérité : journal + projection + interventions | PostgreSQL + PostGIS | Supabase |
| **Temps réel** | Pousser chaque nouvel événement à tous les écrans | Supabase Realtime (websocket) | Supabase |
| **Stockage fichiers** | Les enregistrements audio | Supabase Storage | Supabase |
| **Comptes utilisateurs** | Connexion, rôles (opérateur / COS) | Supabase Auth | Supabase |
| **Transcription** | Audio → texte français en streaming | Gladia (MVP) → Voxtral self-host (pilote) | Cloud Gladia |
| **Extraction** | Texte → JSON structuré (adresse, victimes…) | Claude API structured output | Cloud Anthropic |
| **Cartes & adresses** | Fonds de carte + validation d'adresse | IGN Géoplateforme (tuiles + géocodage) | Cloud IGN (gratuit) |
| **Code & déploiement** | Versionnage + mise en ligne à chaque push | GitHub (autosync déjà actif) + Vercel | Cloud |

**Règle d'or :** le navigateur ne détient **aucun secret**. Les clés API (Gladia, Claude) ne vivent que dans les routes serveur `/api/*` et dans `.env.local` / variables Vercel.

---

## 3. Le pipeline IA pas à pas

| # | Étape | Entrée → Sortie | Latence cible | Si ça échoue |
|---|---|---|---|---|
| 1 | **Lecture audio** — MVP : fichier joué depuis Supabase Storage | audio | — | Réessayer / autre fichier |
| 2 | **Transcription streaming** (Gladia, websocket) | audio → texte partiel au fil de l'eau | ~300 ms | Bandeau « transcription indisponible » + saisie manuelle |
| 3 | **Accumulation** — le texte s'agrège ; déclenchement toutes les ~10 s ou en fin de phrase | texte partiel → bloc de texte | — | — |
| 4 | **Extraction** — `/api/extraction` appelle le LLM avec schéma JSON forcé, champs *optionnels* (`adresse?`, `nature?`, `nb_victimes?`, `etage?`, `moyens_demandes?`, `danger?`) | texte → JSON structuré | < 5 s | On garde la transcription brute ; l'opérateur extrait à la main |
| 5 | **Géocodage** — `/api/geocodage` interroge l'IGN (`data.geopf.fr/geocodage`) | adresse texte → coordonnées + score 0-1 | < 1 s | Adresse marquée « non localisée » → validation humaine |
| 6 | **Décision** — score ≥ 0,8 : insertion auto (statut `presume`) ; score < 0,8 ou ambigu : file de validation humaine | JSON validé → lignes dans `evenements` | — | — |
| 7 | **Projection** — le serveur met à jour `entites` (l'état courant) | événement → entité créée/mise à jour | < 500 ms | Reconstructible en rejouant le journal |
| 8 | **Diffusion** — Realtime pousse aux navigateurs abonnés | insert SQL → update écran | < 2 s | Le navigateur re-fetch au reconnect |

**Bout en bout : parole → carte en ~5-8 secondes.** (À comparer aux 155-250 s pour tracer une SITAC de 10 symboles à la main — cf. recherche.)

---

## 4. Le modèle de données

### Schéma relationnel

```
interventions (le dossier)
     │ 1
     ├──────< evenements   LE JOURNAL — append-only, la vérité
     │ N       · entity_type/event_type · payload JSONB
     │         · ts_observation ≠ ts_declaration (double horodatage)
     │         · source · fiabilite (Admiralty A1→F6) · statut
     │         · corrige_event_id (une correction POINTE l'ancien, ne l'efface pas)
     │ 1
     └──────< entites      LA PROJECTION — état courant affichable
       N       · type (acteur|moyen|zone) · etat JSONB fusionné
               · geom (point ou polygone PostGIS) · fiabilite · statut
```
> Pas de table « appels » (décision produit) : l'appel est traité en direct, la transcription est éphémère ; chaque fait extrait garde sa phrase source dans `payload.extrait_source`.
*(SQL complet prêt à copier : [TechDesign §4](TechDesign-Athena-MVP.md))*

### Cycle de vie d'une information

```
 presume ──(validation humaine ou 2e source concordante)──▶ confirme
    │                                                          │
    └──(info contradictoire)──▶ corrige (nouvel événement      │
    └──(le temps passe, contexte changé)──▶ perime ◀───────────┘
```
Rien ne s'efface jamais : chaque transition est **un nouvel événement** dans le journal.

### Trace complète d'un appel (exemple concret)

> **14:02:10** — Lecture de l'enregistrement : *« Il y a le feu au 12 rue des Lilas, une dame âgée est bloquée au 3ᵉ étage ! »*
> **14:02:11** — Gladia streame la transcription mot à mot → visible dans `PanneauAppel`
> **14:02:21** — `/api/extraction` → `{adresse: "12 rue des Lilas", nature: "feu_habitation", nb_victimes: 1, etage: 3}`
> **14:02:22** — `/api/geocodage` → IGN répond : score **0,94** → placement automatique
> **14:02:22** — 2 lignes insérées dans `evenements` :
> `SINISTRE_SIGNALE` (zone, presume, source=appel_18, fiabilite=C3)
> `VICTIME_SIGNALEE` (acteur, presume, payload={etage:3}, ts_observation=14:02)
> **14:02:23** — `entites` mises à jour : 1 zone sinistre + 1 victime au 12 rue des Lilas
> **14:02:24** — Realtime pousse → **la victime apparaît sur la carte** avec badge ambre « présumé » ; la main courante affiche les 2 lignes horodatées
> **14:05:40** — Le chef d'agrès confirme sur place → événement `CONFIRMATION` → badge passe au vert
> **Après l'intervention** — Le curseur RETEX rejoue ces événements dans l'ordre : le débriefing est déjà écrit.

---

## 5. Arborescence complète du code

```
athena-app/
├── app/                                # ÉCRANS (Next.js App Router)
│   ├── layout.tsx                      # coquille commune (thème sombre, polices)
│   ├── page.tsx                        # accueil : liste/création d'interventions
│   ├── login/page.tsx                  # connexion (Supabase Auth)
│   ├── intervention/[id]/
│   │   ├── page.tsx                    # ★ LE DASHBOARD (carte + appel + main courante)
│   │   └── retex/page.tsx              # mode rejeu post-intervention
│   └── api/                            # SERVEUR (les secrets vivent ici)
│       ├── extraction/route.ts         # texte → JSON structuré (Claude API)
│       ├── geocodage/route.ts          # adresse → coordonnées + score (IGN)
│       └── stt-token/route.ts          # token éphémère Gladia (la clé reste au serveur)
│
├── components/
│   ├── carte/
│   │   ├── Carte.tsx                   # MapLibre + fonds IGN (tuiles vectorielles)
│   │   ├── CoucheEntites.tsx           # marqueurs acteurs/moyens (badges fiabilité)
│   │   ├── CoucheZones.tsx             # polygones : sinistre, périmètres, points d'eau
│   │   └── OutilDessin.tsx             # tracé de zones (mapbox-gl-draw + Turf.js)
│   ├── appel/
│   │   ├── PanneauAppel.tsx            # conteneur : lecture audio + transcription + fiche
│   │   ├── TranscriptionLive.tsx       # texte au fil de l'eau (websocket Gladia)
│   │   └── FicheExtraction.tsx         # champs extraits + score + bouton VALIDER
│   ├── MainCourante.tsx                # fil chronologique du journal (heure/source/fiabilité)
│   ├── RejeuRetex.tsx                  # curseur temporel → état à l'instant T
│   └── ui/
│       ├── BadgeFiabilite.tsx          # ambre « présumé » / vert « confirmé » / rouge « à valider »
│       └── ...                         # boutons, panneaux repliables
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # client navigateur (clé publique, protégé par RLS)
│   │   └── server.ts                   # client serveur (droits étendus)
│   ├── extraction.ts                   # schéma Zod des champs + appel LLM
│   ├── geocodage.ts                    # appel IGN + logique de seuil (0,8)
│   ├── projection.ts                   # evenements → entites (la logique journal→photo)
│   ├── retex.ts                        # reconstruction de l'état ≤ T (le rejeu)
│   └── types.ts                        # types TypeScript partagés
│
├── supabase/
│   └── migrations/                     # le SQL versionné (tables, index, RLS, realtime)
│
├── public/
│   └── audio-demo/                     # les enregistrements scénarisés (démo RGPD-safe)
│
├── .env.local                          # clés secrètes — JAMAIS commité
├── .env.example                        # le modèle sans les valeurs (commité, lui)
└── package.json
```

**Comment lire cette arborescence :** `app/` = ce que l'utilisateur voit · `app/api/` = ce que le serveur fait en secret · `components/` = les briques d'interface réutilisables · `lib/` = la logique métier pure (extraction, projection, rejeu) · `supabase/` = la base versionnée.

---

## 6. Temps réel & rejeu — comment ça marche

**Temps réel (le direct) :** chaque navigateur ouvert sur une intervention s'abonne au canal Realtime filtré par `intervention_id`. À chaque `INSERT` dans `evenements`/`entites`, Supabase pousse la nouvelle ligne par websocket ; la carte et la main courante se mettent à jour sans recharger. En cas de coupure réseau, le client se réabonne et re-télécharge l'état courant (la projection) — il ne peut rien rater définitivement puisque tout est dans le journal.

**Rejeu RETEX (le rembobinage) :** le mode rejeu ne lit **que** le journal :
```sql
select * from evenements
where intervention_id = :id and ts_declaration <= :T
order by event_id;
```
puis reconstruit l'état en mémoire (même logique que `lib/projection.ts`). Glisser le curseur = changer T. C'est pour ça que le rejeu est « quasi gratuit » : c'est la même mécanique que le direct, appliquée au passé.

---

## 7. Sécurité en couches

```
Couche 1 — NAVIGATEUR      : aucun secret ; clé Supabase publique bridée par RLS
Couche 2 — ROUTES /api/*   : clés Gladia/Claude côté serveur uniquement
Couche 3 — BASE (RLS)      : Row Level Security sur TOUTES les tables —
                             un utilisateur ne voit que les interventions de son SDIS
Couche 4 — MÉTIER          : statut presume/confirme + validation humaine
                             obligatoire sur l'adresse si score < 0,8
Couche 5 — DONNÉES (MVP)   : uniquement des enregistrements FICTIFS
                             → zéro donnée personnelle réelle dans le système
```

| Règle | Application concrète |
|---|---|
| Secrets hors du code | `.env.local` (local) + variables Vercel (prod) ; `.env.example` comme modèle |
| Journal inviolable | Aucun `UPDATE`/`DELETE` sur `evenements` — corrections par ajout |
| Traçabilité totale | Chaque info garde source + horodatage double + fiabilité → défendable juridiquement |
| Pas d'entraînement sur tes données | À vérifier dans les DPA Gladia/Anthropic avant le pilote |
| Migration souveraine prévue | PostgreSQL standard → bascule Scalingo/Clever/OVH sans réécriture (pilote) |

---

## 8. Environnements & cycle de vie du code

```
Ton Mac (dev local)          GitHub                    Vercel
┌──────────────────┐  push  ┌──────────────┐  auto   ┌──────────────────┐
│ npm run dev      │──────▶ │ RebornFlamme │───────▶ │ URL de démo      │
│ + Claude Code    │ (auto- │ /Athena      │ deploy  │ athena.vercel.app│
│                  │  sync) │              │         │                  │
└──────────────────┘        └──────────────┘         └────────┬─────────┘
                                                              │ lit/écrit
                                                     ┌────────▼─────────┐
                                                     │ Supabase          │
                                                     │ (base + realtime  │
                                                     │  + auth + audio)  │
                                                     └───────────────────┘
```

| Variable | Où | Sensible ? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Navigateur (ok : bridées par RLS) | Non |
| `GLADIA_API_KEY` | Serveur uniquement | **Oui** |
| `ANTHROPIC_API_KEY` | Serveur uniquement | **Oui** |
| `SUPABASE_SERVICE_ROLE_KEY` | Serveur uniquement (projection) | **Oui — la plus critique** |

---

## 9. Ce qui change au pilote — et ce qui ne change pas

| | MVP (démo, données fictives) | Pilote (SDIS réel) |
|---|---|---|
| Hébergement app | Vercel | Scalingo / Clever Cloud (France) |
| Base de données | Supabase cloud | PostgreSQL managé français |
| Transcription | Gladia (cloud) | Voxtral self-host ou Speechmatics on-premise |
| Extraction LLM | Claude API | Mistral (UE) ou déploiement dédié |
| Source audio | Fichiers joués | Intégration téléphonie réelle (avec le SDIS et son éditeur) |
| Radio | — | Phase 2 : fine-tuning sur échantillons ANTARES/RRF |
| RGPD | Sans objet (fictif) | DPO + AIPD + DPA fournisseurs + hébergement souverain |

**Ce qui ne change JAMAIS (et c'est le but de cette architecture) :** le modèle de données (journal + projection), le code du dashboard, la logique d'extraction/validation, le rejeu. On change *où ça tourne*, pas *comment ça marche*.

---

*Architecture v1.0 — 4 juillet 2026 · Prochain document : Partie 4 (AGENTS.md / CLAUDE.md, les consignes permanentes de l'assistant IA).*
