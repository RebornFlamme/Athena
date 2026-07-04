# ATHENA — Dossier de recherche stratégique

> **Le poste de commandement qui se remplit tout seul** : dashboard de crise pour sapeurs-pompiers, alimenté en temps réel par IA depuis les appels et la radio.

| | |
|---|---|
| **Marché** | France · SDIS / sécurité civile |
| **Date** | 4 juillet 2026 |
| **Sources** | ~45 (Sénat, ENSOSP, Cour des comptes, ANSC, IGN…) |
| **Méthode** | Recherche multi-agents + vérification adversariale des chiffres (14 chiffres clés contre-vérifiés en double) |

**Légende fiabilité :** ✅ Confirmé · ⚠️ À reconsulter à la source · ❌ Contradiction entre sources

---

## Sommaire

- [00 — Synthèse express & thèse produit](#00--synthèse-express--thèse-produit)
- [01 — Le statu quo & les points de douleur](#01--le-statu-quo--les-points-de-douleur)
- [02 — Livrable 1 : Tableau des concurrents](#02--livrable-1--tableau-des-concurrents)
- [03 — ⭐ Livrable 2 : Modèle de données de l'état live](#03--⭐-livrable-2--modèle-de-données-de-létat-live)
- [04 — Extraction IA temps réel en français](#04--extraction-ia-temps-réel-en-français)
- [05 — Livrable 3 : Stack technique recommandée](#05--livrable-3--stack-technique-recommandée)
- [06 — Livrable 4 : Priorisation du MVP](#06--livrable-4--priorisation-du-mvp)
- [07 — Livrable 5 : Roadmap de développement](#07--livrable-5--roadmap-de-développement)
- [08 — Livrable 6 : Budget](#08--livrable-6--budget)
- [09 — Vente, adoption & cadre réglementaire](#09--vente-adoption--cadre-réglementaire)
- [10 — Contradictions, incertitudes & limites](#10--contradictions-incertitudes--limites)
- [11 — Sources principales](#11--sources-principales)

---

## 00 — Synthèse express & thèse produit

### 💎 L'insight qui vaut de l'or

Le document officiel de l'école des pompiers (**Mémento Chef de Colonne, ENSOSP**) prouve que le poste de commandement français fonctionne aujourd'hui avec **4 officiers qui tiennent chacun leur propre tableau papier** (Moyens, Renseignements, Actions, Anticipation) et **recopient l'information à la main** de l'un à l'autre pour maintenir la carte tactique (SITAC) à jour.

**Athena supprime cette ressaisie : le PC se dessine tout seul à partir des appels et de la radio.** C'est un argument qu'un pompier ne peut pas contester, puisqu'il vient de sa propre doctrine.

### La thèse en bref

La recherche confirme trois choses : le besoin est réel et documenté officiellement ; le marché est immense mais mal servi ; et **aucun acteur — ni français, ni international — n'occupe frontalement votre angle** (extraction IA automatique depuis appels *et* radio, sans saisie). Votre travail n'est pas d'inventer le besoin, mais d'exécuter proprement et d'entrer par la bonne porte.

### Chiffres d'ancrage

| Indicateur | Valeur | Détail |
|---|---|---|
| Volume marché | **4,75 M** | interventions en France en 2024 — 1 toutes les 7 s, sur 99 services d'incendie ✅ |
| Le concurrent d'État patine | **9 / 99** | SIS raccordés à NexSIS mi-2025 (objectif 78 fin 2027) ✅ |
| Bruit à filtrer | **≈ 80 %** | des appels au CTA-CODIS ne débouchent sur aucune intervention ✅ |
| Porte d'entrée légale | **140 k€** | seuil « achat innovant » de gré à gré, sans appel d'offres (depuis le 1ᵉʳ juil. 2026) ✅ |

### Les 6 décisions que ce dossier recommande

1. **Positionnement : complément, pas remplaçant.** Ne visez pas à remplacer NexSIS, Crimson ou Systel. Vendez une « couche d'alimentation automatique par IA » qui les nourrit et tue la saisie manuelle. Vente plus facile, pilote plus rapide.
2. **Modèle de données (le cœur) : journal d'événements + projection, sur PostgreSQL/Supabase.** Pas de base exotique. Détaillé en [§03](#03--⭐-livrable-2--modèle-de-données-de-létat-live).
3. **MVP : commencez par l'appel, pas la radio.** Le canal 18/112 est le plus propre et le plus spectaculaire à démontrer. La radio (bruitée, 2 kbit/s) est le morceau le plus dur — phase 2. Voir [§06](#06--livrable-4--priorisation-du-mvp).
4. **Carte + temps réel : MapLibre + fonds IGN + Supabase.** Gratuit, souverain, simple pour un non-développeur. Voir [§05](#05--livrable-3--stack-technique-recommandée).
5. **Testez la transcription sur VOTRE audio avant de choisir un fournisseur.** Les modèles « sur étagère » s'effondrent sur de la vraie radio d'urgence. Voir [§04](#04--extraction-ia-temps-réel-en-français).
6. **Hébergez souverain dès le départ** (OVHcloud / Scaleway / Outscale) pour transformer une future obligation (SecNumCloud) en argument de vente immédiat. Voir [§09](#09--vente-adoption--cadre-réglementaire).

---

## 01 — Le statu quo & les points de douleur

Comprendre la chaîne actuelle, c'est comprendre exactement où Athena crée de la valeur — et où elle ne doit surtout pas marcher sur les plates-bandes des systèmes déjà installés.

### La chaîne de l'information, aujourd'hui

Un appel arrive au **CTA** (Centre de Traitement de l'Alerte, le 18/112). L'opérateur qualifie, puis le **CODIS** (centre départemental) coordonne et engage les moyens. Sur le terrain, le **COS** (Commandant des Opérations de Secours) dirige et rend compte depuis son **poste de commandement (PC)**. C'est une chaîne strictement hiérarchique et cloisonnée — donc autant de points où l'information est **re-transmise et re-saisie à la main**. ✅

### La preuve documentaire de la douleur

Le **Mémento Chef de Colonne de l'ENSOSP** (l'école nationale officielle des officiers) décrit un PC organisé en **4 fonctions, chacune tenant son propre support papier** :

- **Officier « Moyens »** → un tableau des moyens engagés ;
- **Officier « Renseignements »** → un tableau des messages + il dessine et actualise la **SITAC** (la carte tactique) ;
- **Officier « Actions »** → transcrit l'ordre en tracé graphique sur la SITAC ;
- **Officier « Anticipation »** → encore 3 tableaux distincts (situations envisageables, idées de manœuvre, tâches).

Chacun recopie l'information de l'autre. **C'est la définition même du problème qu'Athena résout.** ✅ *(source primaire officielle)*

> 💡 **La SITAC** est l'équivalent français du « Common Operational Picture » militaire : un schéma en 4 catégories (zone & caractéristiques · moyens engagés et prévus · actions faites et prévues · organisation du commandement). Ces 4 catégories sont un cadeau : elles vous donnent gratuitement la structure de votre modèle de données (voir [§03](#03--⭐-livrable-2--modèle-de-données-de-létat-live)).

Une étude scientifique (IHM'19, avec 6 officiers du SDIS 31) chiffre même la lenteur : **155 à 250 secondes** pour reproduire une SITAC de seulement 10 symboles sur les meilleurs outils tactiles numériques existants. Un système qui la construit *tout seul* depuis la parole change radicalement l'équation. ✅

### Les autres douleurs, chiffrées

| Point de douleur | Chiffre | Source | Fiabilité |
|---|---|---|---|
| Radio saturée & bas débit | ANTARES plafonne à **~2 kbit/s** par canal (voix + messages courts uniquement) | Sénat r15-365 | ✅ |
| Zones blanches radio | **> 1 SDIS sur 3** a constaté une dégradation de couverture après ANTARES | Sénat r15-365 | ✅ |
| Automatisation qui décharge | La fonction « status » réduirait de **60 %** la sollicitation des opérateurs (≈ 317 postes, 11,1 M€) | Sénat r15-365 | ✅ |
| Bruit d'appels à filtrer | **~75–82 %** des appels ne mènent à aucune intervention (ex. SDIS 71 : 153 930 appels → 36 016 interv. en 2025) | Données SDIS publiques | ✅ (ordre de grandeur) |
| Friction inter-services | **50 %** des SDIS peinent à joindre le SAMU · **66 %** le médecin régulateur | Rapport IGA/IGAS 2018 | ⚠️ |
| Échanges partenaires (ENEDIS, police…) | Quasi **100 % à la voix**, faute de logiciels communs | Mémoire ENSOSP | ✅ |

> 🛰️ **Fenêtre de tir « réseau ».** ANTARES (2G bas débit) est en cours de remplacement par le **Réseau Radio du Futur (RRF)** en 4G/5G, déployé entre 2025 et 2027. Un produit conçu maintenant peut surfer sur l'arrivée de la bande passante (données riches, position GPS, images) au lieu d'en hériter comme d'une contrainte. ⚠️ *(calendrier à confirmer à la source)*

---

## 02 — Livrable 1 : Tableau des concurrents

Le paysage se lit en trois couches : l'incumbent d'État (NexSIS), les éditeurs privés installés (Crimson, Systel), et l'international. **Le fait marquant : personne ne fait de l'extraction IA depuis appels + radio sans saisie.** C'est votre boulevard.

### France

| Acteur | Ce que c'est | Adoption | Prix | Faiblesse exploitable |
|---|---|---|---|---|
| **NexSIS 18-112** *(État / ANSC)* | SI unifié appels + opérations + carto (modules SGA/SGO/SGE/SGC/SGI). Décret 2019-19. | **9/99** SIS mi-2025 → ~23 mi-2026 ; objectif 78 fin 2027 | Financé État, **~300 M€** sur 10 ans | +3 ans de retard, +40 % de budget (Cour des comptes, déc. 2025). **Ne fait aucune extraction IA d'appels/radio.** |
| **Crimson** *(CS Group / Sopra Steria)* | **Le vrai leader du SITAC / gestion de crise** (main courante, carto tactique), interopère avec NexSIS & IGN. | **> 70 %** des SDIS, tous les COZ, le COGIC national | Licence + intégration (public) | Outil de saisie manuelle : il attend qu'on le nourrisse. Athena peut être sa source automatique. |
| **Systel** *(START)* | Traitement de l'alerte / gestion opérationnelle des CTA-CODIS. | **~50 %** des SDIS ; 7,5 M appels/an ⚠️ *(auto-déclaré)* | Bascule abonnement (plan « Systel 2030 ») | Sort d'un **redressement judiciaire (2022→2023)** ; bugs/déconnexions mySTART rapportés sur forums. Confiance fragile. |
| Autres éditeurs | IMPI (GIPSI), Astillia, Berger-Levrault, Blueway (intégration NexSIS)… | Variable, par département | Marchés publics | Aucun ne fait d'IA vocale temps réel. Partenaires d'intégration potentiels. |
| Pilotes IA français *(émergents)* | IAppel (SDIS Ain + 4 dépts, pré-remplit les fiches depuis l'appel), « Petit Camion » (Haute-Garonne), assistant CR sur NexSIS. | Expérimental | Ex. Ain ≈ 480 k€ (Inetum) | Ce sont vos **vrais concurrents directs** — mais encore embryonnaires, souvent mono-département, sans dashboard temps réel complet. |

> ⚠️ Attention : le produit du SDIS de l'Ain s'appelle aussi « Nexsis » — à ne pas confondre avec le NexSIS 18-112 national.

### International

| Acteur | Fonction | Adoption / avis | Prix (indicatif) | Faiblesse exploitable |
|---|---|---|---|---|
| **Tablet Command** *(USA)* | Commandement d'intervention sur iPad, carte ArcGIS. | **71 000+** intervenants, 250 000+ interventions (Cal Fire, LA County, SF) | **~500 $**/iPad/an ⚠️ *(source 2021)* | **Saisie 100 % manuelle** : le chef glisse-dépose les moyens à la main. Pas d'IA vocale. |
| **First Due** *(USA)* | Suite tout-en-un (pré-planification, réponse, RH, rapports). | **4,6/5** (57 avis Capterra) | **~8–25 $**/user/mois + implémentation | Critiques sur fiabilité terrain, onboarding, ressaisie entre modules. |
| **StreetWise CADlink** *(USA)* | Lien données CAD → tablettes engins. | Avis positifs | **180–210 $**/engin/an | Périmètre étroit (mobilité données), pas de COP intelligent. |
| **Genasys Protect** *(ex-Zonehaven)* | Évacuation feux de forêt (zones, alerte population). | **~60 %** de la population californienne | Contrats pluriannuels (comtés) | Spécialisé évacuation, pas conduite d'intervention. |
| **Prepared / Carbyne / RapidSOS** *(→ Axon)* | **IA sur appels 911** : transcription temps réel, extraction, traduction. | Marché US ; Prepared admet ~85–90 % de précision transcription | SaaS agences | **Rachetés par Axon (2025-26) → plateforme fermée « Axon 911 ».** Valide votre thèse, ferme le partenariat, et laisse un boulevard souverain FR/UE. |

> « Prepared/Carbyne prouvent que le marché existe et que la techno marche. Axon vient de les enfermer dans un écosystème américain. La place d'un acteur souverain, conforme RGPD et SITAC français, est vacante. »

---

## 03 — ⭐ Livrable 2 : Modèle de données de l'état live

C'est le cœur d'Athena. La bonne nouvelle : la réponse est **plus simple que ce que la question laisse craindre**. Vous n'avez pas besoin d'une base de données exotique. Vous avez besoin d'un bon *schéma de pensée* posé sur des outils banals et robustes.

### La recommandation en une phrase

**Un journal d'événements horodatés (la vérité) + une « photo » de l'état courant recalculée en continu (le confort de lecture), le tout dans PostgreSQL via Supabase.** On appelle ça un *event sourcing hybride*. C'est exactement l'architecture qui vous donne gratuitement le rejeu post-intervention.

### Le principe, expliqué simplement

```
Sources                 Journal d'événements        Projection              Dashboard COP
(appels, radio,   ──▶   (chaque fait ajouté,   ──▶  (recalcule «l'état ──▶  (le COS voit la
 GPS, saisies)          jamais effacé =              actuel» à partir        situation à jour,
                        source de vérité)            des faits)              en direct)
```

La métaphore : le journal d'événements est le **livre de bord d'un navire** — on n'efface jamais une ligne, on en ajoute une nouvelle qui corrige. À tout moment, on peut « rejouer » le livre pour reconstruire la situation à 14h07 précises. C'est **la main courante automatique et le débriefing (RETEX) offerts par construction.**

> ❌ **Contradiction assumée entre experts.** Fowler et l'écosystème Kafka présentent l'event sourcing comme quasi-universel ; Microsoft Azure et plusieurs praticiens (« Event Sourcing is Hard ») avertissent qu'en tout-event-sourcing, la complexité explose.
> **Notre arbitrage :** event sourcing *uniquement* sur les faits opérationnels (déclarations, observations, actions) ; CRUD classique pour les référentiels stables (liste du personnel, du matériel). Et on garde *toujours* une projection à jour pour ne jamais imposer un rejeu en lecture critique.

### Les 4 familles d'entités (inspirées du COP militaire, sans sa lourdeur)

| Famille | Contenu |
|---|---|
| **Acteurs** | COS, chefs de secteur, équipes, victimes, témoins, appelants, partenaires (SAMU, police, ENEDIS). |
| **Moyens** | Engins, matériel, moyens aériens, avec statut (en route, présenté, disponible) et position. |
| **Zones** | Secteurs, périmètres de sécurité, points d'eau, dangers, sinistre — géométries sur la carte. |
| **Événements** | Le fait horodaté lui-même : « victime signalée au 2ᵉ étage », « ordre donné », « aggravation ». |

> 💡 Le modèle OTAN **JC3IEDM** confirme cette décomposition acteurs/moyens/zones/événements — mais avec 271 entités, il est trop lourd. On s'en inspire, on ne l'adopte pas. La référence industrielle la plus proche de votre besoin est **l'ontologie de Palantir Gotham** (entités + relations + propriétés typées + couche d'actions).

### Gérer l'information incertaine, contradictoire ou périmée

C'est votre différenciateur qualité. Chaque événement porte, en plus de son contenu :

```sql
-- Table « journal d'événements » (le cœur d'Athena)
event_id        -- identifiant unique
entity_id       -- l'acteur/moyen/zone/événement concerné
entity_type     -- acteur | moyen | zone | evenement
event_type      -- ex: VICTIME_SIGNALEE, MOYEN_PRESENTE, ORDRE_DONNE
payload         -- contenu structuré (JSONB) : ce qui a été dit/fait
ts_observation  -- QUAND le fait s'est produit sur le terrain
ts_declaration  -- QUAND l'info est remontée (souvent plus tard)
source_id       -- QUI/QUOI l'a dit (appelant, radio, GPS, opérateur)
canal           -- appel_18 | radio_antares | gps | saisie
fiabilite       -- note Admiralty : A1 (sûr) → F6 (douteux)
statut          -- presume | confirme | corrige | perime
```

Deux idées clés, toutes deux *déjà standardisées* dans le monde du renseignement et de la crise :

- **Double horodatage** : distinguer *quand ça s'est passé* de *quand on l'a appris*. Une victime peut avoir été vue à 14h02 mais l'info n'arriver qu'à 14h11.
- **Note de fiabilité « Admiralty Code » (A1→F6)** : un axe pour la fiabilité de la source (un pompier sur place vs un témoin paniqué), un axe pour la crédibilité de l'info. Simple, éprouvé par l'OTAN, réutilisable tel quel. ✅

Une information contradictoire ne s'écrase pas : on ajoute un nouvel événement `corrige` qui pointe vers l'ancien. On garde la trace de « qui a dit quoi, quand, avec quelle confiance » — précieux pour le COS *et* pour le débriefing juridique.

### Les standards : lesquels adopter, lesquels ignorer

| Standard | Ce que c'est | Verdict pour Athena |
|---|---|---|
| **EMSI (ISO 22351)** | Format de *message* d'échange entre salles de crise. 4 groupes : Context / Event / Resource / Mission. | ✅ **Adopter** — mais seulement comme **format d'export/interopérabilité** (parler à un CODIS voisin, à NexSIS), pas comme base interne. |
| **CAP** | Protocole d'alerte commun (diffusion d'alertes à la population). | ✅ **Adopter** — uniquement pour les **alertes sortantes**. Pas pour l'état interne. |
| **EDXL** | Suite XML de messagerie inter-organisations (OASIS). | ❌ **Ignorer** au stade MVP — lourd, orienté échange, pas stockage. |
| **JC3IEDM** | Modèle de données C2 de l'OTAN (271 entités). | **Inspiration seule** — trop lourd à implémenter. |
| **APP-6 / MIL-STD-2525** | Symbologie tactique OTAN. | ⚠️ **Langage visuel** possible sur la carte — mais la symbologie SITAC française prime pour vos utilisateurs. |

### Quelle base de données ?

| Option | Pour | Contre | Verdict |
|---|---|---|---|
| **PostgreSQL (Supabase)** | Un seul outil : SQL relationnel + JSONB + géo (PostGIS) + temps réel intégré. Un tutoriel officiel colle à votre besoin. | Pas la base « la plus puissante » sur les graphes profonds. | ✅ **Recommandé** |
| Neo4j (graphe) | Excellent sur les relations profondes en temps réel. | Complexité opérationnelle injustifiée à ce stade. | Plus tard, si besoin |
| EventStoreDB | Spécialisé event sourcing. | Une brique de plus à apprendre/maintenir. | Inutile : Postgres suffit |
| MongoDB (documents) | Flexible. | Modèle « flou » mal adapté au géo-relationnel. | À éviter |

**Verdict : PostgreSQL via Supabase couvre 100 % du besoin MVP, avec le moins de pièces mobiles pour un fondateur non-technique.**

---

## 04 — Extraction IA temps réel en français

C'est votre techno-cœur. Le piège n°1 : croire les classements marketing. La réalité mesurée est plus dure — et plus intéressante.

> ❌ **La vérité qui change tout.** Les gros modèles « sur étagère » **s'effondrent sur de la vraie radio d'urgence** : Whisper large-v3 atteint **~51 % de taux d'erreur** sur de la radio de police réelle (contre ~3-5 % sur de l'audio propre). Le bruit + les codecs bas débit dégradent le taux d'erreur de +100 % à +180 %.
> **Conséquence :** aucun benchmark public ne teste le français en conditions radio/téléphonie dégradées. Vous *devez* tester les fournisseurs sur *vos propres* enregistrements avant de choisir, et prévoir du *fine-tuning* pour la radio.

### Découplez les deux canaux

Le canal **18/112 (téléphone)** est relativement propre → commencez par lui. Le canal **radio ANTARES** (2 kbit/s, très dégradé) est le morceau difficile → phase 2, avec fine-tuning.

### Fournisseurs de transcription (speech-to-text) — juillet 2026

| Fournisseur | Français / temps réel | Latence | Prix | Atout pour Athena |
|---|---|---|---|---|
| **Gladia (Solaria-3)** 🇫🇷 | Oui, streaming + diarisation | **~103 ms** partiel / ~270 ms | ≈ 4 $/1000 min | Français + fournisseur français ; très bonne latence. |
| **Mistral Voxtral** 🇫🇷 *(open-weight)* | Oui (Apache 2.0, self-host possible) | < 200 ms configurable | **0,003–0,006 $**/min | **Souveraineté UE + prix + auto-hébergement** = combo SecNumCloud. |
| **Speechmatics (Ursa 2)** | Oui | ~temps réel | 0,005–0,0067 $/min | **Déploiement on-premise complet** (l'audio ne sort pas de chez vous). |
| **Deepgram (Nova-3)** | Oui, multilingue | 200–300 ms | **0,0058 $**/min ✅ | Robuste, bien documenté. |
| **AssemblyAI (Universal)** | Oui, multilingue | ~300 ms | **~0,0025 $**/min | Le moins cher en tarif affiché. |
| **ElevenLabs (Scribe v2)** | Oui | **30–150 ms** (le plus bas) | À l'usage | Latence record — mais qualité très variable selon l'audio. |

*Prix ~$/minute (2025-2026), à vérifier sur les pages officielles au moment du contrat.*

> ❌ **Contradiction entre benchmarks — méfiance.** Chaque fournisseur se classe n°1 sur *son propre* banc d'essai. Sur un test public français (Multilingual LibriSpeech), c'est **AssemblyAI (2,6 %)** et **ElevenLabs (2,9 %)** qui devancent Gladia Solaria-1 (4,8 %) — et non l'inverse. Et un même modèle (ElevenLabs) va de **1,7 % à 55,2 %** d'erreur selon le corpus. Ne décidez jamais sur un chiffre marketing : mesurez sur votre audio.

### De la parole aux données structurées

Une fois le texte obtenu, un LLM le transforme en champs : adresse, nature du sinistre, nombre de victimes, moyens demandés. Utilisez impérativement le **« structured output / function calling » natif** (schéma JSON forcé) et non le simple « mode JSON » : le taux de non-conformité tombe sous **0,2 %** chez les meilleurs fournisseurs, contre 2-5 % en mode JSON basique. ✅

### L'adresse : le champ qui peut tuer

Une adresse mal extraite coûte des vies (cas documentés aux USA : bonne adresse donnée 3 fois, secours 20 min en retard, décès). Stratégie de validation en 3 filets :

1. **Géocodage systématique** contre la **Géoplateforme IGN** (`data.geopf.fr/geocodage`). ⚠️ Important : l'ancienne API BAN `api-adresse.data.gouv.fr` a migré vers l'IGN début 2026 — ciblez la nouvelle URL.
2. **Seuil de confiance** : si le score est bas ou s'il y a plusieurs candidats proches → escalade humaine *obligatoire*.
3. **Validation humaine explicite**, pas un simple « read-back ». L'association internationale des opérateurs (IAED) documente que relire l'adresse à un appelant paniqué est *peu fiable* : il acquiesce par réflexe.

> 🎯 **Repère de réalité :** Prepared, le système IA 911 américain de référence, admet lui-même une précision de transcription de **~85-90 %** — pas 100 %. Positionnez Athena comme une *aide qui propose et que l'humain valide*, jamais comme un système autonome sur les données critiques.

---

## 05 — Livrable 3 : Stack technique recommandée

Objectif : le moins de pièces mobiles possible, un seul « modèle mental », et une compatibilité maximale avec l'assistance IA. Voici la stack unique recommandée.

| Brique | Choix | Coût | Pourquoi (et quoi écarter) |
|---|---|---|---|
| **Carte** | **MapLibre GL JS** + fonds **IGN Géoplateforme** + mapbox-gl-draw + Turf.js | Gratuit | Open-source, tient des milliers d'acteurs mobiles (WebGL). Fonds IGN = argument souveraineté. *Écarter* Google Maps (coût imprévisible), Leaflet (trop lent), deck.gl (utile > 50-100k points seulement). |
| **Base + temps réel** | **Supabase** (PostgreSQL + Realtime + PostGIS + Auth + Storage) | Gratuit → ~25-175 $/mois | Tout-en-un, un tutoriel officiel « carte temps réel + MapLibre » colle au besoin. 3-5× moins cher que Firebase. *Écarter* Firebase (facturation à l'opération imprévisible), Convex (NoSQL peu adapté au géo). |
| **Framework web** | **Next.js (React)** | Gratuit | La **meilleure compatibilité avec les outils d'IA** — critère n°1 pour un non-développeur. (SvelteKit est plus élégant mais moins bien assisté.) |
| **Transcription** | Voir [§04](#04--extraction-ia-temps-réel-en-français) — tester Gladia / Voxtral / Speechmatics sur votre audio | ~0,003-0,008 $/min | Décision après test réel, pas sur benchmark. |
| **Extraction structurée** | LLM avec **structured output** (function calling) | À l'usage (~qq $ / 1000 appels) | Schéma JSON forcé, < 0,2 % d'erreur de format. |
| **Hébergement** | **OVHcloud / Scaleway / Outscale** (souverain) | ~50-300 €/mois | Qualifiable SecNumCloud → argument de vente. ⚠️ Supabase & Vercel ne sont pas qualifiés SecNumCloud — prévoir un Supabase managé en France (Scalingo, Clever Cloud) pour un vrai déploiement SDIS. |

> 🛠️ **Méthode de construction assistée par IA (2026) :** prototypez vite avec un outil no-code IA (**Lovable** ou **Bolt.new**) pour valider l'idée devant des pompiers, puis **durcissez le code avec un agent de développement** (Claude Code, Cursor) une fois le concept prouvé. Ce parcours « prototyper en no-code → durcir en agent » est le chemin le plus rapide pour un fondateur non-technique.

---

## 06 — Livrable 4 : Priorisation du MVP

La question : parmi vos 6 fonctionnalités, par quoi commencer pour une démo qui scotche des pompiers ? Réponse : **le « plan-séquence » de la démo doit être un appel qui construit la carte tout seul.**

| Fonctionnalité | Priorité | Pourquoi |
|---|---|---|
| **1. Extraction des appels** | ✅ **MVP — cœur** | Canal le plus propre, effet « wow » maximal. C'est le moteur de la démo. |
| **4. Main courante automatique** | ✅ **MVP — cœur** | Sous-produit direct du journal d'événements. Presque gratuit une fois §03 en place. |
| **3. Dashboard carte** | ✅ **MVP — cœur** | La scène où tout s'affiche. MapLibre + IGN. C'est ce que le COS regarde. |
| **6. Analyse post-intervention** | ⚠️ **MVP — bonus quasi-gratuit** | Le rejeu du journal d'événements *est* le débriefing (RETEX). Excellent 2ᵉ argument de vente, peu de code en plus. |
| **2. Extraction radio** | ❌ **Phase 2** | Le plus dur (2 kbit/s, bruit, fine-tuning). Ne le mettez pas sur le chemin critique d'une première démo. |
| **5. Gestion du déploiement** | ❌ **Plus tard / éviter frontalement** | Déjà couvert par Systel/NexSIS/Crimson. Ne concurrencez pas l'installé ; interfacez-vous. |

> 🎬 Le « money shot » de la démo : on joue un enregistrement d'appel d'urgence → sous les yeux des pompiers, la fiche se remplit, la victime apparaît à la bonne adresse sur la carte, la main courante s'écrit, la SITAC se dessine. Zéro clavier. **Puis** : « et maintenant, rejouons toute l'intervention pour le débriefing ».

---

## 07 — Livrable 5 : Roadmap de développement

Une progression en 4 phases sur ~12-15 mois, pensée pour un fondateur solo assisté par IA. Chaque phase a un livrable démontrable.

| Phase | Objectif | Ce que vous construisez | Assistance IA |
|---|---|---|---|
| **0 · Prototype** *(Mois 0-2)* | Prouver le « money shot » | Carte MapLibre + faux flux d'appel → événements → main courante. Pas encore de vraie transcription. | Lovable / Bolt pour l'ossature UI ; Claude Code pour la logique. |
| **1 · Extraction appel réelle** *(Mois 2-5)* | Un vrai appel remplit un vrai dashboard | Transcription (fournisseur testé sur audio réel) + extraction structurée + géocodage IGN + validation humaine. | Claude Code pour l'intégration API ; tests de WER sur vos échantillons. |
| **2 · Modèle live + RETEX** *(Mois 4-8)* | Journal d'événements robuste + rejeu | Event sourcing hybride §03, fiabilité Admiralty, projection COP, rejeu temporel (post-intervention). | Agent IA pour le refactor propre du schéma. |
| **3 · Pilote SDIS** *(Mois 6-12)* | Terrain d'essai réel | Hébergement souverain, RGPD/DPO, durcissement, exercice avec 1 SDIS volontaire. | Sécurité/revue de code assistée ; docs générées. |
| **4 · Radio + interop** *(Mois 10-15+)* | Étendre le différenciateur | Extraction radio (fine-tuning), export EMSI vers NexSIS/Crimson. | Pipeline de fine-tuning ASR assisté. |

---

## 08 — Livrable 6 : Budget

Le développement assisté par IA rend les phases 0-2 remarquablement peu coûteuses. Le vrai coût arrive au pilote (souveraineté, juridique).

| Poste | Option gratuite / éco | Option pilote | Note |
|---|---|---|---|
| Outils de code IA | Bolt/Lovable ~20-50 $/mo | Claude Code / Cursor ~20-200 $/mo | Votre principal « employé ». |
| Base + temps réel | Supabase gratuit | Supabase Pro/Team 25-599 $/mo | Managé FR (Scalingo/Clever) pour SDIS. |
| Carte | **0 €** (MapLibre + IGN) | 0 € | Vérifier CGU IGN pour usage commercial. |
| Transcription | Crédits d'essai | ~0,003-0,008 $/min à l'usage | Voxtral auto-hébergé = coût maîtrisé. |
| LLM extraction | Crédits d'essai | Quelques $ / 1000 appels | Structured output. |
| Hébergement souverain | — | OVH/Scaleway/Outscale ~50-300 €/mo | Argument SecNumCloud. |
| Juridique / RGPD / DPO | — | ~2 000-8 000 € (one-shot) | Indispensable avant le pilote (données de victimes). |
| Fine-tuning radio (phase 4) | — | Quelques k€ de calcul | Seulement quand vous attaquez la radio. |

**Ordre de grandeur :** phases 0-2 réalisables pour ~100-500 $/mois ; passage au pilote ~1-4 k€/mois + ~2-8 k€ de juridique. À financer par le contrat pilote (voir §09).

---

## 09 — Vente, adoption & cadre réglementaire

La bonne nouvelle : une porte d'entrée légale existe pour éviter l'enfer des appels d'offres. La vigilance : les données de victimes sont sensibles, et la souveraineté devient obligatoire.

### La porte d'entrée : l'« achat innovant »

Un SDIS peut acheter une solution innovante **de gré à gré, sans publicité ni mise en concurrence**, tant que le montant reste sous **140 000 € HT** (seuil relevé de 100 k€ le 1ᵉʳ juillet 2026, loi SVE). C'est *la* voie pour un premier contrat pilote rapide, si un DDSIS soutient le projet. ✅ *(art. R.2122-9-1)*

### Qui décide, et par où entrer

- **Le SDIS** est un établissement public autonome, sous double autorité (préfet pour l'opérationnel, président du conseil d'administration pour le budget). Le **DDSIS** dirige. Un champion interne (DDSIS ou chef de groupement SI) est indispensable.
- **Atraksis** (association de pompiers pour l'innovation) et **Safe Cluster** (pôle de compétitivité, partenaire ENSOSP) sont deux portes d'entrée réelles vers un SDIS pilote — notamment via l'appel à projets « Innov'up Tech & Secours » (Île-de-France). ⚠️ Correction : Atraksis est une association, pas une startup concurrente.
- **Signal fort :** la DGOS (Santé) a lancé un **AMI doté de 2 M€** pour expérimenter la transcription IA des appels SAMU (résultats fin 2026). Le vent institutionnel souffle dans votre sens.

### Réglementaire : la carte du terrain

| Sujet | État au 4 juil. 2026 | Ce que vous faites |
|---|---|---|
| **SecNumCloud** | **Pas encore obligatoire** pour les SDIS, mais la proposition de loi Latombe (adoptée au Sénat, en cours à l'Assemblée) va probablement l'imposer sous 12-24 mois. | Hébergez souverain *dès maintenant* → « nous anticipons » devient un argument de vente. |
| **HDS (données de santé)** | Référentiel v2.0, hébergement UE exclusif, si vous traitez l'état médical des victimes. | Choisir un hébergeur certifié HDS si le médical entre dans le périmètre. |
| **RGPD données d'appel** | Zone grise (appelants/victimes = données sensibles). Pas de doctrine CNIL claire identifiée. | Traiter avec un DPO/avocat spécialisé, pas en générique. ⚠️ Faible visibilité |

**Modèle économique :** le **SaaS par abonnement** (tout inclus) passe mieux dans le public que licence + maintenance séparée, car il simplifie le budget de fonctionnement.

> ⚠️ **Aucun échec retentissant de startup française sur ce marché n'a été trouvé** — ce qui signifie surtout que peu ont essayé, et que les échecs B2G sont rarement médiatisés. Traitez ce silence comme un signal de risque à ne pas sous-estimer (cycle de vente long, décision collective), pas comme une voie dégagée.

---

## 10 — Contradictions, incertitudes & limites

Honnêteté méthodologique : voici ce qui est solide, ce qui l'est moins, et ce qu'il reste à vérifier avant un pitch investisseur.

| Niveau | Éléments |
|---|---|
| ✅ **Confirmé (double vérif.)** | ANTARES 2 kbit/s · >1 SDIS/3 dégradation · NexSIS 9/99 mi-2025 · Systel redressement 2022-23 · Tablet Command 71k · achat innovant R.2122-9-1 · Voxtral (juil. 2025) · IGN gratuit depuis 2021 · Deepgram 0,0058 $/min. |
| ❌ **Contradiction assumée** | Benchmarks STT : chaque fournisseur se dit n°1 ; sur test public français AssemblyAI & ElevenLabs devancent Gladia. Event sourcing : « universel » (Fowler) vs « survendu & complexe » (Azure, praticiens). |
| ⚠️ **À reconsulter à la source** | Rapport Cour des comptes NexSIS (5 déc. 2025) — PDF non lu directement. Le « 80 % » exact du mémoire ENSOSP (recoupé à 74-82 % via d'autres SDIS). Chiffres IGA/IGAS 2018 (via synthèse syndicale). Prix Tablet Command (source 2021). Calendrier RRF. |
| ⚠️ **Corrections apportées** | Atraksis = *association*, pas startup concurrente. L'API BAN a migré vers l'IGN (nouvelle URL). « artificialanalysis.ai » ne publie pas de classement français isolé. Le vrai leader SITAC est *Crimson* (CS/Sopra), pas Systel. |

---

## 11 — Sources principales

*Toutes consultées le 4 juillet 2026. Sélection des sources les plus structurantes ; la recherche a mobilisé ~45 sources au total.*

### Statu quo & doctrine
- ENSOSP — Mémento Chef de Colonne : `https://enasis.fr/pluginfile.php/6541/mod_resource/content/1/MEMENTO%20CdC.pdf`
- Sénat — rapport ANTARES (Vogel) : `https://www.senat.fr/rap/r15-365/r15-365_mono.html`
- IHM'19 — étude SITAC (temps de tracé) : `http://iihm.imag.fr/IHM19/IHM-2019/C_ResumesEtendus/5_ArticlesIndustriels/i04-berge.pdf`
- Mémoire ENSOSP — flux CTA-CODIS : `https://crd.ensosp.fr/doc_num.php?explnum_id=18622`
- Statistiques DGSCGC 2024 : `https://www.interieur.gouv.fr/documentation/etudes-et-statistiques/statistiques-2024-dgscgc.html`
- Réseau Radio du Futur : `https://fr.wikipedia.org/wiki/R%C3%A9seau_radio_du_futur`

### Concurrence
- Cour des comptes — ANSC & projet NexSIS (5 déc. 2025) : `https://www.ccomptes.fr/fr/publications/lagence-du-numerique-de-la-securite-civile-et-le-projet-nexsis`
- ANSC — NexSIS 18-112 : `https://ansc.interieur.gouv.fr/nexsis-18-112/`
- Crimson (CS Group / Sopra Steria) : `https://www.crimson.eu/fr/solutions/crimson-tactic`
- Systel — plan de continuation 2023 : `https://pressroom.vpstrat.com/2023/10/le-plan-de-continuation-de-systel-accepte-par-le-tribunal-de-la-rochelle-le-leader`
- Tablet Command : `https://www.tabletcommand.com/` · First Due (Capterra) : `https://www.capterra.com/p/179338/First-Due/reviews/`
- StreetWise CADlink : `https://www.streetwisecadlink.com/case-studies/streetwise-vs-first-due-vs-tablet-command-the-integration-advantage`
- Axon → Carbyne / Prepared : `https://www.prnewswire.com/news-releases/axon-to-acquire-carbyne-uniting-cloud-infrastructure-and-ai-to-redefine-the-911-experience-302604614.html`
- Genasys : `https://genasys.com/press-releases/genasys-inc-acquires-emergency-evacuation-saas-provider-zonehaven/`
- Pilote IA SDIS Ain (IAppel) : `https://en-contact.com/les-pompiers-de-lain-et-de-quatre-departements-testent-un-outil-dintelligence-artificielle-pour-mieux-cibler-et-analyser-les-ap`

### Modèle de données
- Martin Fowler — Event Sourcing : `https://martinfowler.com/eaaDev/EventSourcing.html`
- Microsoft Azure — Event Sourcing pattern : `https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing`
- Contre-point « Event Sourcing is Hard » : `https://chriskiehl.com/article/event-sourcing-is-hard`
- Event sourcing sur PostgreSQL : `https://github.com/eugene-khyst/postgresql-event-sourcing`
- JC3IEDM : `https://en.wikipedia.org/wiki/JC3IEDM` · Admiralty Code : `https://en.wikipedia.org/wiki/Admiralty_code`
- EMSI / ISO 22351 : `https://www.iso.org/standard/57384.html`
- Palantir Ontology : `https://www.palantir.com/docs/foundry/ontology/overview`
- Supabase + PostGIS : `https://supabase.com/docs/guides/database/extensions/postgis`

### IA & extraction
- Gladia — benchmarks : `https://www.gladia.io/competitors/benchmarks` · Solaria-3 : `https://www.gladia.io/blog/solaria-3-speech-to-text-model-for-european-languages`
- Mistral Voxtral : `https://mistral.ai/news/voxtral/`
- Deepgram pricing : `https://deepgram.com/pricing` · AssemblyAI multilingue : `https://www.assemblyai.com/blog/introducing-multilingual-universal-streaming`
- Speechmatics pricing : `https://www.speechmatics.com/pricing`
- ASR radio d'urgence (arXiv) : `https://arxiv.org/abs/2409.10858`
- Migration BAN → IGN : `https://adresse.data.gouv.fr/blog/lapi-adresse-de-la-base-adresse-nationale-est-transferee-a-lign`
- Prepared (précision ~85-90 %) : `https://www.police1.com/police-products/dispatch-call-centers-911/up-close-prepared-uses-ai-to-accelerate-911-dispatching`
- IAED — fiabilité du read-back : `https://www.iaedjournal.org/dispatch-danger-zones`

### Stack & go-to-market
- MapLibre : `https://maplibre.org` · IGN Géoplateforme (TMS) : `https://data.geopf.fr/tms/1.0.0`
- Supabase temps réel + MapLibre : `https://supabase.com/blog/postgres-realtime-location-sharing-with-maplibre`
- Achats innovants (DAJ) : `https://www.economie.gouv.fr/daj/le-dispositif-achats-innovants-perennise` · Loi SVE 2026-403 : `https://www.marche-public.fr/contrats-publics/loi-2026-403-sve.htm`
- Article R.2122-9-1 : `https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044490444`
- PPL Latombe / SecNumCloud : `https://www.senat.fr/dossier-legislatif/ppl25-008.html`
- Atraksis : `https://atraksis.fr/` · Safe Cluster : `https://www.safecluster.com/` · ENSOSP / pôle Safe : `https://www.ensosp.fr/les-partenariats/le-pole-national-de-competitivite-safe`
- AMI DGOS 2 M€ transcription SAMU : `https://www.bretagne.ars.sante.fr/system/files/2025-07/2025_81.pdf`

---

*Produit par recherche multi-agents avec vérification adversariale des chiffres. Les mentions ⚠️ « À reconsulter » signalent une source non lue en primaire directe — à confirmer avant tout usage investisseur ou contractuel.*
