# Technical Design Document : Athena — MVP

> Définit **COMMENT** construire ce qui est décrit dans [PRD-Athena-MVP.md](PRD-Athena-MVP.md), pour un fondateur non-technique assisté par IA.
> Basé sur la recherche vérifiée : [RECHERCHE_ATHENA.md](RECHERCHE_ATHENA.md).

| | |
|---|---|
| **Projet** | Athena — dashboard de crise pompiers alimenté par IA |
| **Plateforme** | Web (navigateur), responsive desktop + tablette |
| **Approche** | L'IA écrit le code (Claude Code), tu guides et testes |
| **Délai visé** | MVP démontrable en 2-3 mois |
| **Budget** | ~50-200 $/mois en phase MVP |
| **Date** | 4 juillet 2026 |

---

## 1. Comment on va le construire

### Approche recommandée : Next.js + Supabase + MapLibre, codés avec Claude Code

**Pourquoi c'est le bon choix pour toi :**
- **Un seul modèle mental** : tout vit dans Supabase (base de données + temps réel + comptes utilisateurs + fichiers). Pas 5 services à faire dialoguer.
- **L'IA connaît cette stack par cœur** : Next.js + Supabase est la combinaison la mieux documentée du web → Claude Code produit du code fiable dessus, et il existe un tutoriel officiel Supabase quasi identique à ton besoin (« Postgres Realtime location sharing with MapLibre »).
- **Gratuit pour démarrer** : MapLibre (open-source), fonds de carte IGN (gratuits), Supabase et Vercel ont des paliers gratuits suffisants pour la démo.
- **Souveraineté possible plus tard** : PostgreSQL est un standard → migration vers un hébergeur français (Scalingo, Clever Cloud, OVH) sans réécrire l'application.

**Ce que ça coûte :** 0-60 $/mois au début, 50-200 $/mois avec l'usage STT/LLM.
**Temps d'apprentissage :** aucun pré-requis — tu pilotes par prompts ; compte ~1 semaine pour prendre le rythme.
**Limites à connaître :** voir §10 (honnêteté totale : téléphonie réelle, radio, SecNumCloud).

### Alternatives comparées

| Option | Pour | Contre | Coût | Temps → MVP |
|---|---|---|---|---|
| **A. Full no-code** (Lovable/Bolt seuls) | Le plus rapide pour une maquette cliquable | **Impasse technique** : audio streaming + temps réel + journal d'événements dépassent vite les no-code ; dette difficile à reprendre | 20-50 $/mois | 1-2 sem. (maquette), bloqué ensuite |
| **B. Next.js + Supabase + Claude Code** ✅ | Équilibre parfait : vrai code, propre, évolutif, très bien assisté par l'IA | Demande de tester après chaque feature (c'est ton rôle) | 0-200 $/mois | 6-10 semaines |
| **C. Backend sur mesure** (serveur Node + Postgres auto-géré) | Contrôle total | Beaucoup trop de plomberie pour un solo non-dev ; zéro bénéfice au stade MVP | 50-300 $/mois | 3-5 mois |

**Arbitrage assumé :** on choisit B. L'option A reste utile *en complément* pour générer des maquettes d'écrans (v0/Lovable) qu'on recode ensuite proprement.

---

## 2. L'architecture en une image

```
  Enregistrement d'appel (MVP : fichier audio joué — PAS de vraie téléphonie)
        │
        ▼
  ① TRANSCRIPTION temps réel (Gladia — streaming français)
        │  texte au fil de l'eau
        ▼
  ② EXTRACTION structurée (LLM en "structured output" : adresse, nature,
        │  victimes, moyens demandés — schéma JSON forcé)
        ▼
  ③ VALIDATION  ──  géocodage IGN (data.geopf.fr/geocodage)
        │             score faible ? → badge "à confirmer" + validation humaine
        ▼
  ④ JOURNAL D'ÉVÉNEMENTS (Supabase/PostgreSQL — append-only, la vérité)
        │  + PROJECTION "état courant" (la photo pour l'affichage)
        ▼
  ⑤ SUPABASE REALTIME (websocket) pousse chaque nouvel événement
        │
        ▼
  ⑥ DASHBOARD (Next.js) : carte MapLibre+IGN · main courante · rejeu RETEX
```

Chaque numéro = un morceau qu'on construit et teste séparément. Si ① tombe en panne, ④→⑥ continuent de marcher (saisie manuelle possible) : **pas de point de défaillance unique**.

---

## 3. Checklist de démarrage

### Étape 1 — Créer les comptes (Jour 1)
- [x] GitHub — déjà fait (`RebornFlamme/Athena`, autosync actif)
- [ ] Supabase — https://supabase.com (gratuit)
- [ ] Vercel — https://vercel.com (gratuit, hébergement de la démo)
- [ ] Gladia — https://gladia.io (STT français, palier gratuit)
- [ ] Anthropic Console — https://console.anthropic.com (LLM d'extraction)
- [ ] *(rien à créer pour l'IGN : cartes et géocodage sans compte)*

### Étape 2 — Assistant IA (Jour 1)
- [x] Claude Code — déjà opérationnel (cette session)
- [ ] Ranger les clés API dans `.env.local` (jamais dans le code, jamais commitées)

### Étape 3 — Initialiser le projet (Jour 2)
```bash
npx create-next-app@latest athena-app --typescript --tailwind --app
cd athena-app
npm install @supabase/supabase-js maplibre-gl @mapbox/mapbox-gl-draw @turf/turf zod
```
Puis premier déploiement « Hello World » sur Vercel (connexion GitHub → Import → Deploy). **Objectif jour 2 : une URL en ligne.**

### Structure du projet
```
athena-app/
├── app/                    # écrans (Next.js App Router)
│   ├── page.tsx            # accueil / liste des interventions
│   ├── intervention/[id]/  # LE dashboard (carte + appel + main courante)
│   └── api/                # routes serveur (extraction LLM, géocodage)
├── components/
│   ├── Carte.tsx           # MapLibre + fonds IGN
│   ├── PanneauAppel.tsx    # transcription live + champs extraits
│   ├── MainCourante.tsx    # fil chronologique
│   └── RejeuRetex.tsx      # curseur temporel
├── lib/
│   ├── supabase.ts         # client base de données
│   ├── extraction.ts       # appel LLM structured output
│   └── geocodage.ts        # validation adresse IGN
└── .env.local              # clés secrètes (non commité)
```

---

## 4. La base de données — schéma prêt à coder

*C'est le cœur (PRD §modèle). Copie ce SQL dans l'éditeur Supabase (onglet SQL) tel quel.*

```sql
-- 1. L'intervention (le "dossier" global)
create table interventions (
  id uuid primary key default gen_random_uuid(),
  titre text not null,                    -- "Feu d'appartement — 12 rue des Lilas"
  statut text not null default 'active',  -- active | terminee
  adresse text,
  geom_point geometry(point, 4326),       -- position principale (PostGIS)
  cree_le timestamptz not null default now()
);

-- 2. LE JOURNAL D'ÉVÉNEMENTS (append-only : on ajoute, on n'efface JAMAIS)
create table evenements (
  event_id bigint generated always as identity primary key,
  intervention_id uuid not null references interventions(id),
  entity_id uuid,                          -- l'acteur/moyen/zone concerné (si applicable)
  entity_type text not null,               -- acteur | moyen | zone | evenement
  event_type text not null,                -- VICTIME_SIGNALEE | MOYEN_PRESENTE | ORDRE_DONNE | CORRECTION ...
  payload jsonb not null,                  -- le contenu : {"etage": 3, "etat": "consciente", ...}
  ts_observation timestamptz,              -- QUAND ça s'est passé sur le terrain
  ts_declaration timestamptz not null default now(),  -- QUAND on l'a appris
  source text not null,                    -- appel_18 | radio | gps | saisie_operateur
  fiabilite text not null default 'C3',    -- code Admiralty A1(sûr) → F6(douteux)
  statut text not null default 'presume',  -- presume | confirme | corrige | perime
  corrige_event_id bigint references evenements(event_id)  -- si correction, pointe l'ancien
);

-- 3. LA PROJECTION : l'état courant de chaque entité (la "photo" pour l'affichage)
--    Mise à jour par le code serveur à chaque nouvel événement. Peut être
--    entièrement reconstruite en rejouant le journal (= le rejeu RETEX).
create table entites (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references interventions(id),
  type text not null,                      -- acteur | moyen | zone
  sous_type text,                          -- victime | temoin | fpt | vsav | perimetre | point_eau ...
  libelle text not null,                   -- "Victime — 3e étage"
  etat jsonb not null default '{}',        -- état courant fusionné depuis les événements
  geom geometry(geometry, 4326),           -- point (acteur/moyen) ou polygone (zone)
  fiabilite text not null default 'C3',
  statut text not null default 'presume',
  maj_le timestamptz not null default now()
);

-- (Décision produit, juil. 2026 : PAS de table « appels ». L'appel est traité
--  en direct : la transcription est un état éphémère du frontend pendant l'appel,
--  et chaque fait extrait entre dans `evenements` avec, dans son payload, la
--  phrase source qui l'a produit (`payload.extrait_source`) + le score de
--  géocodage le cas échéant. La traçabilité vit dans le journal, pas dans une
--  table à part. Ré-ajoutable plus tard par migration additive si le besoin
--  « réécouter l'appel » apparaît.)

-- Index pour la vitesse
create index idx_evt_intervention on evenements(intervention_id, event_id);
create index idx_entites_intervention on entites(intervention_id);
create index idx_entites_geom on entites using gist(geom);

-- Temps réel : le dashboard s'abonne aux nouveautés
alter publication supabase_realtime add table evenements, entites;

-- Sécurité : activer Row Level Security sur TOUTES les tables
alter table interventions enable row level security;
alter table evenements   enable row level security;
alter table entites      enable row level security;
-- (politiques d'accès : utilisateurs authentifiés du SDIS uniquement — à générer avec Claude Code)
```

**À retenir (en langage simple) :** `evenements` = le livre de bord (la vérité, jamais effacée). `entites` = la photo actuelle (pour afficher vite). Le rejeu RETEX = relire `evenements` jusqu'à l'instant T. Le double horodatage + le code de fiabilité gèrent l'info incertaine.

---

## 5. Construire chaque fonctionnalité (dans l'ordre)

### F0 — Socle : carte + intervention + événements simulés *(Semaines 1-2)*
**Complexité : facile.** Aucune IA — on prouve la boucle ④→⑥ d'abord.
- **Prompt Claude Code :** « Crée une page intervention avec une carte MapLibre plein écran utilisant les tuiles vectorielles IGN (data.geopf.fr), un panneau main courante à droite, connectée à Supabase Realtime sur la table `evenements` : quand j'insère un événement en base, un marqueur apparaît sur la carte et une ligne dans la main courante, en moins de 2 s. »
- **Test :** insérer une ligne à la main dans Supabase → elle apparaît sur la carte sans recharger la page.

### F1 — Extraction des appels *(Semaines 3-5 — le cœur)*
**Complexité : moyenne-difficile.** Astuce MVP décisive : **pas de vraie téléphonie**. On joue des **enregistrements d'appels scénarisés** (écrits par toi, joués par des proches → zéro problème RGPD, démo reproductible).
1. **Banc d'essai STT (à faire en premier) :** petite page où tu déposes un fichier audio → transcriptions Gladia / Voxtral côte à côte → tu juges à l'oreille. *C'est le test « sur TON audio » exigé par la recherche.*
2. **Streaming :** l'audio est envoyé à Gladia en temps réel, la transcription s'affiche au fil de l'eau dans `PanneauAppel.tsx`.
3. **Extraction :** toutes les ~10 s, le texte accumulé part vers une route serveur `/api/extraction` qui appelle le LLM en **structured output** avec ce schéma : `{adresse?, nature_sinistre?, nb_victimes?, etage?, moyens_demandes?, danger?}` — champs *optionnels* pour éviter que l'IA invente ce qui n'a pas été dit.
4. **Validation adresse :** géocodage IGN → score ≥ 0,8 : placement auto (badge « présumé ») ; score < 0,8 ou ambigu : bandeau rouge « ⚠ adresse à confirmer » + bouton de validation. **Règle d'or : l'IA propose, l'humain valide.**
- **Test :** jouer l'enregistrement « feu 3e étage, 12 rue des Lilas, une personne bloquée » → la victime apparaît au bon endroit, sans toucher le clavier.

### F2 — Main courante automatique *(Semaine 5 — quasi gratuite)*
Chaque extraction validée insère des lignes dans `evenements` → la main courante EST le journal affiché (heure, source, fiabilité, contenu). Une correction ajoute une ligne `CORRECTION` reliée à l'ancienne (jamais de suppression).

### F3 — Rejeu RETEX *(Semaine 6)*
Un curseur temporel : on reconstruit l'état en ne gardant que les `evenements` dont `ts_declaration ≤ T`. La carte et la main courante « rembobinent ».
- **Test :** glisser le curseur → les entités apparaissent/disparaissent dans l'ordre chronologique réel.

### F4 — Polish démo *(Semaines 7-8)*
Scénario complet écrit + 3-5 enregistrements, données réalistes (vraies adresses de ta ville de démo), gestion d'erreurs (audio inaudible → message clair), test sur tablette, répétition du « money shot ».

---

## 6. Fonctionnalités IA du produit — choix et garde-fous

| Brique | Choix MVP | Alternatives | Pourquoi |
|---|---|---|---|
| **Transcription (STT)** | **Gladia** (streaming FR, ~100-300 ms, palier gratuit puis ~4 $/1000 min) | **Voxtral/Mistral** (souverain UE, self-host, 0,003-0,006 $/min) · **Speechmatics** (on-premise) | Gladia = le plus simple pour démarrer en français. Voxtral = le chemin souveraineté pour le pilote. **Décision finale après le banc d'essai sur TES enregistrements** — aucun benchmark public ne teste le français téléphonique dégradé. |
| **Extraction (LLM)** | **Claude API** en structured output (< 0,2 % d'erreur de format) | **Mistral** (souveraineté UE — candidat naturel au pilote) · OpenAI | Fiabilité du schéma JSON = critère n°1. Réévaluer pour le pilote selon l'exigence de souveraineté du SDIS. |
| **Validation adresse** | **Géocodage IGN** `data.geopf.fr/geocodage` (gratuit) | — | ⚠ l'ancienne API BAN (`api-adresse.data.gouv.fr`) a migré vers l'IGN début 2026 : utiliser la nouvelle URL. |

**Latences cibles :** transcription partielle < 1 s · extraction < 5 s · affichage carte < 2 s. **Coût par appel de démo :** ~0,01-0,05 $ (négligeable).

**Règles vie privée (dès le MVP, non négociables) :**
- Démo = **uniquement des enregistrements fictifs** (jamais de vrai appel en phase MVP)
- Clés API **côté serveur seulement** (routes `/api/*`), jamais dans le navigateur
- Vérifier dans les contrats (DPA) que Gladia/Mistral/Anthropic **n'entraînent pas leurs modèles sur tes données**
- **Fallback** : si le STT ou le LLM tombe → l'opérateur peut toujours saisir à la main ; le dashboard ne dépend jamais de l'IA pour fonctionner

---

## 7. Design — traduire le vibe « opérationnel, clair, sobre, fiable »

```css
/* Poste de commandement, lisible en 2 s, de nuit comme de jour */
--fond:        #12161c;   /* sombre : salle de crise, pas d'éblouissement */
--panneau:     #1c232c;
--texte:       #e8ecf1;
--accent:      #e05038;   /* rouge intervention — réservé aux urgences/alertes */
--confirme:    #3fa06a;   /* vert = info confirmée */
--presume:     #d8973c;   /* ambre = info présumée, à confirmer */
--trait:       #2c3644;
/* Typo : sans-serif système (net) + monospace pour heures et coordonnées */
```
- **La carte occupe ~70 %** de l'écran ; panneaux latéraux repliables
- **L'état se lit dans la forme** : badge ambre « présumé » / vert « confirmé » / rouge « à valider » sur chaque info
- Gros contrastes, cibles tactiles larges (tablette au PC), pas d'animation décorative
- Maquettes : générables avec v0/Lovable puis recodées proprement dans Next.js

---

## 8. Déploiement

**MVP/démo : Vercel** (git push = déployé, gratuit). Variables d'environnement à configurer dans Vercel :
```
NEXT_PUBLIC_SUPABASE_URL=...        # publique (ok navigateur)
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # publique (protégée par RLS)
GLADIA_API_KEY=...                  # serveur uniquement
ANTHROPIC_API_KEY=...               # serveur uniquement
```

**Pilote avec vraies données : migration souveraine obligatoire.**
| Étape | MVP (démo, données fictives) | Pilote (données réelles) |
|---|---|---|
| App | Vercel | Scalingo / Clever Cloud (France) |
| Base | Supabase cloud | PostgreSQL managé français (Scalingo/Clever/OVH) |
| STT/LLM | Gladia + Claude API | Voxtral self-host ou Speechmatics on-premise + Mistral UE |

⚠ **Ni Supabase cloud ni Vercel ne sont SecNumCloud** → règle simple : **aucune donnée réelle de victime n'y transite, jamais.** La migration est prévue par design (PostgreSQL standard).

---

## 9. Coûts

*Vérifier les tarifs sur les pages officielles au moment de payer — dernière vérification : juillet 2026.*

| Service | Phase démo | Phase active | Notes |
|---|---|---|---|
| Claude Code | 20-100 $/mois | 100-200 $/mois | Ton principal « employé » |
| Supabase | 0 $ | 25 $/mois (Pro) | Gratuit largement suffisant au début |
| Vercel | 0 $ | 0-20 $/mois | Palier gratuit ok pour la démo |
| Gladia (STT) | 0 $ (palier gratuit) | 5-30 $/mois | ~4 $/1000 min |
| Claude API (extraction) | 1-5 $/mois | 5-30 $/mois | Volume démo minuscule |
| MapLibre + IGN + géocodage | **0 $** | **0 $** | Open-source + open data |
| **Total** | **~20-110 $/mois** | **~130-300 $/mois** | Dans le budget PRD |

Poste à part (pilote) : juridique RGPD/DPO ~2-8 k€ one-shot + hébergement souverain ~50-300 €/mois.

---

## 10. Limites honnêtes de cette approche

| Limite | Explication | Parade |
|---|---|---|
| **Pas de vraie téléphonie en MVP** | Se brancher sur le 18/112 réel = intégration avec Systel/NexSIS + accord SDIS. Hors de portée solo. | La démo joue des enregistrements — assumé et suffisant pour convaincre. L'intégration télécom devient un chantier *du pilote, avec* le SDIS. |
| **Radio ANTARES : phase 2** | Audio très dégradé (2 kbit/s) : les modèles s'effondrent sans fine-tuning (~51 % d'erreur constatés sur radio réelle). | Roadmap PRD phase 4 ; collecter des échantillons dès le pilote. |
| **Supabase/Vercel ≠ SecNumCloud** | Confort de dev exceptionnel, mais pas qualifiés ANSSI. | Données fictives only en MVP + plan de migration §8 écrit dès maintenant. |
| **Qualité STT réelle inconnue** | Aucun benchmark ne couvre le français téléphonique bruité. | Le banc d'essai (§5-F1) est un livrable de la semaine 3, avant tout engagement fournisseur. |
| **Realtime : limites du gratuit** | ~200 connexions simultanées sur Supabase free. | Sans objet pour une démo (< 10 connexions) ; palier Pro ensuite. |

**Déclencheurs de mise à niveau :** signature d'un pilote → migration souveraine ; > 5 SDIS → infra dédiée + aide d'un dev senior en renfort ponctuel.

---

## 11. Stratégie d'assistance IA

| Tâche | Outil | Exemple |
|---|---|---|
| Architecture / décisions | Claude (conversation) | « Compare deux façons de stocker les zones dessinées » |
| Écrire le code | **Claude Code** | Prompts ci-dessous |
| Maquettes UI | v0 / Lovable | « Dashboard de crise sombre, carte plein écran, panneau latéral » |
| Debug | Claude Code | Coller l'erreur + le contexte |

**Prompt type — nouvelle fonctionnalité :**
```
Je construis Athena (dashboard de crise pompiers). Stack : Next.js App Router,
Supabase (tables evenements/entites), MapLibre + tuiles IGN, Tailwind.
Fonctionnalité : [nom, ex. F3 rejeu RETEX]
Exigences : [copier les critères du PRD]
Contraintes : clés API côté serveur uniquement ; jamais supprimer d'événement ;
badge de fiabilité sur chaque info affichée.
Explique ton plan en 5 lignes avant de coder, puis implémente et dis-moi comment tester.
```

**Prompt type — debug :**
```
Erreur dans [fichier] : [message d'erreur collé]
Ce que je faisais : [action]. Comportement attendu : [attendu].
Corrige et explique-moi la cause en une phrase simple.
```

**Règles de travail :** 1 fonctionnalité = 1 session · tester après chaque étape · commits fréquents (l'autosync du repo s'en charge) · ne jamais accepter du code que tu ne peux pas tester toi-même.

---

## 12. Checklists

**Avant de commencer** : comptes créés · clés dans `.env.local` · « Hello World » en ligne sur Vercel · budget confirmé.

**Pendant le dev** : uniquement les features du PRD · test après chaque feature · le badge présumé/confirmé partout · aucune clé API dans le navigateur.

**Avant la démo (Definition of Done technique)** :
- [ ] Le parcours complet marche : audio joué → extraction → carte → main courante → rejeu
- [ ] Adresse ambiguë → validation humaine demandée (testé avec un enregistrement piège)
- [ ] STT en panne → saisie manuelle possible (testé en coupant la clé API)
- [ ] Testé sur tablette + vidéoprojecteur
- [ ] ≥ 90 % d'extraction correcte sur les 5 enregistrements test (métrique PRD)
- [ ] Démo répétée 3× sans accroc, données fictives réalistes (zéro « Lorem ipsum »)

---

## 13. Succès technique = 

1. Ça tourne sans planter pendant 20 min de démo devant des pompiers
2. Les 4 features P0 du PRD fonctionnent de bout en bout
3. C'est en ligne, accessible par une URL
4. Tu sais le mettre à jour toi-même (prompt → test → push)
5. Coûts mensuels dans le budget
6. Le plan de migration souveraine est écrit (§8) — prêt à dégainer au premier pilote

---

*Conçu pour : Athena · Approche : vibe-coding structuré (Claude Code) · Délai estimé : 6-10 semaines · Coût : ~20-110 $/mois (démo)*
*Prochaine étape : Partie 4 — AGENTS.md et configuration de l'assistant IA.*
