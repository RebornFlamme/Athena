# CLAUDE.md — Projet Athena

## Workflow agents — à lire en premier

1. **Plan directeur : [AGENTS.md](Hackathon/RAISE%20Summit/Athena/Athena-carte/AGENTS.md)** — phase courante, roadmap, règles « à ne pas faire ». S'y référer avant toute tâche de build.
2. **Détails à la demande :** `agent_docs/` (brief, stack, patterns, exigences produit, tests).
3. **Docs stratégiques complets :** `vibe-coding-prompt-template-main/docs/` (recherche, PRD, TechDesign, ARCHITECTURE).
4. **Méthode :** plan en 5 lignes → accord → implémenter petit → `cd frontend && npm run build` + test manuel avant d'avancer.

Le reste de ce fichier décrit les conventions de l'existant (éditeur EAV) — elles restent valables.

## Langue de l'UI — ANGLAIS (juil. 2026)
- **Tout le texte visible du front est en anglais** (labels, boutons, titres, placeholders, aria-labels, messages d'erreur affichés, libellés de nav, labels de `DATA_TYPES`/`STATUTS`). Traduction faite en gardant **code, identifiants, noms de fichiers, clés Supabase, valeurs d'enum et commentaires inchangés** (les commentaires restent en français). Toute nouvelle chaîne visible doit être écrite **en anglais**.
- Points de repère du glossaire : appel→call, caserne→station, opérateur→operator, Lancer→Start / Revenir→Reset / Couper→Stop, flux audio→audio feed, écouter→monitor, Objet→Object / Sous-objet→Sub-object, champ→field, Tableau de bord→Dashboard, Transcription→Transcript, Raisonnement→Reasoning, « Semantic Layer » reste tel quel, statuts Présumé/Confirmé/Corrigé/Périmé→Presumed/Confirmed/Corrected/Stale.

## Sous-système carte tactique 3D — page « Vehicles » (mergé depuis `implémentation-de-la-carte`, juil. 2026)
- Travail carte du collègue intégré dans `main` (merge commit). Dossiers : `components/carte/` (carte libre 3D façon Google Earth, `CarteLibre.tsx`, thèmes `mapTheme.ts`, zones `zonesTactiques.ts`), `components/batiment/` (maquette bâtiment/étages 3D three.js), `components/coquille/` (`CarteEngagement` = carte tactique + engagement des engins, `PanneauEngins`, mocks victimes/engins, custom layers). Support : `data/caserneProche.ts` (caserne OSM la plus proche), `data/itineraireIgn.ts` (itinéraire routier IGN), `hooks/useTrajetsEngins.ts` + `lib/trajetEngin.ts` (animation des trajets d'engins).
- **Page `/coquille`** = `CoquillePage` (plein écran), libellé de nav **« Vehicles »** (icône Truck). La **même `CarteEngagement`** est aussi le panneau **Map** du dashboard (remplace l'ancienne `Carte.tsx` dans `DashboardPage`). Deps ajoutées : `three`, `@types/three`.
- **UI traduite en anglais** (même règle : chaînes visibles seulement ; valeurs d'enum/statut `feu|normal|commerce`, façades `haussmann|peletier|cour`, clés `code:`, ids et commentaires **laissés en français**).
- ⚠ **`CarteEngagement` est désormais branchée au RÉEL** (refactor juil. 2026, la démo mock a été supprimée) : elle garde la base `CarteLibre` (belle carte 3D) et y greffe **les vrais objets géolocalisés** (`useInstancesDB` → marqueurs colorés par statut, live Realtime) + **trajets d'engins réels** (`useTrajetsEngins` : caserne réelle la plus proche → interventions géolocalisées) + **caméra qui plonge** sur le 1er objet localisé. **Supprimés** : `PanneauEngins`, `donneesMock`, `victimesMock`, `EnginsCustomLayer`, `VictimesCustomLayer`, `carte/zonesTactiques` (tout le mock). `CarteLibre` (fond 3D + ses contrôles overlay : 2D/3D, thème, Floors, Interactive 3D) reste intacte. ⚠ `CarteLibre` est encore **centrée en dur sur Paris-Peletier** (`batiments_peletier.json`) → les immeubles 3D individuels ne s'affichent qu'à cet endroit ; ailleurs on a le fond + les marqueurs (la caméra suit quand même les vraies données).
- **Bouton « Reset database »** (`DatabasePage`, en-tête, destructif + `AlertDialog`) : `deleteAllInstances()` (`instancesApi`) + `deleteAllJournal()` (`journalAgentApi`) → vide `object_instances` **et** `agent_journal`. Toutes les surfaces se vident en direct via Realtime.

## Thème clair/sombre (juil. 2026)
- Défaut **sombre** (`class="dark"` en dur sur `<html>` d'`index.html`). Un **script inline** dans `<head>` d'`index.html` lit `localStorage.theme` et retire `dark` si `'light'` **avant le paint** (pas de flash).
- **Store partagé `store/useTheme.ts`** (zustand) : `sombre` + `basculer()` (toggle la classe `dark` sur `document.documentElement` + persiste `localStorage.theme`). Pas de provider React — le thème vit dans la classe DOM + localStorage, le store sert à faire **réagir** plusieurs surfaces.
- **Toggle discret** `components/ThemeToggle.tsx` (icône Soleil/Lune, `SidebarMenuButton` muted) dans un `SidebarFooter` d'`AppSidebar.tsx`.
- ⚠ **Dockview suit le thème** : `DashboardPage` lit `useTheme().sombre` → classe de base **`dockview-theme-abyss` (sombre) / `dockview-theme-light` (clair)** (avant : `abyss` codé en dur). **MAIS ça ne suffit pas** : `.dv-athena` (index.css) mappe les variables dockview sur les tokens shadcn de `<html>` (`hsl(var(--muted))`…, donc déjà theme-aware) — sauf que la classe `.dockview-theme-*` pose les mêmes variables à **spécificité égale** et gagnait par ordre de source → onglets restaient sombres en light. **Fix = `!important` sur les déclarations de `.dv-athena`** : elles gagnent la cascade des variables, donc les couleurs dockview suivent TOUJOURS le mode réel de `<html>`, quel que soit le thème dockview de base. Ne pas retirer ces `!important`.

## Données factices (mock) pour travailler l'UI (juil. 2026)
- **Toggle à côté du bouton Play** (`ControleSimulation.tsx`, icône `FlaskConical`) piloté par `store/useMockData.ts` : activé → insère ~12 objets mock dans `object_instances` ; désactivé → les supprime. Remonte via Realtime dans **toutes** les surfaces (Database, carte, panneau Objets, semantic).
- `data/mockInstances.ts` : lignes à **ids fixes** (`aaaa00xx-…`) → suppression exacte au dé-toggle + upsert sans doublon au re-toggle. `appel_id = null` (non purgés par les runs de simulation). `cree_le` étalé sur ~14 min (courbe du graphe Database). Insert/delete en anon key OK (RLS `object_instances` permissive : insert/update/delete `using/with check (true)`, migration `0009`).
- Pas de persistance du toggle : au reload il repart à off (les lignes mock restent en base jusqu'au prochain dé-toggle). Coexiste avec une vraie simulation si activé en même temps.

## Onglet Database (`/ressources`, juil. 2026)
- **Page `components/database/DatabasePage.tsx`** (remplace le `PlaceholderPage` — la route reste `/ressources`, libellé de nav « Database »). Vue base de données des instances d'objets produites par les agents LLM : lecteur pur via `useInstancesDB()` (global + Realtime).
- **Data table = shadcn + `@tanstack/react-table`** (`ui/table.tsx` copié à la main) : colonnes Object/Type/Status/Location/Call/Created, tri (Object, Type, Created), filtre texte global (libellé + type), pagination (12/page). Badge de statut coloré via `STATUTS` (`typesAthena.ts`).
- **Graphe = shadcn chart (`ui/chart.tsx`) + `recharts` (⚠ épinglé v2 : `recharts@^2.15`, la v3 casse les types du composant shadcn)** : `AreaChart` du **nombre d'objets cumulé au cours du temps**, regroupé par minute (`cree_le`). Pas de vars `--chart-*` dans `index.css` → couleur passée explicitement dans `chartConfig` (`color: 'hsl(217 91% 60%)'`). + 3 cartes stat (total / types distincts / géolocalisés).
- Nouvelles deps : `recharts@^2.15`, `@tanstack/react-table`. Nouveaux composants shadcn ajoutés à la main (CLI KO) : `ui/table.tsx`, `ui/chart.tsx`.

## Dashboard Athena — Créateur de simulation (F2, juil. 2026)
- **Contrainte UI (non négociable, cf. `plan_base_webapp.md`) : UI = composants shadcn emboîtés uniquement**, aucun visuel codé à la main. NB : une **timeline** implique du positionnement absolu inévitable (clips en px) — assemblé avec `Button`/`Card` faute des composants dédiés (CLI shadcn KO ici, voir plus bas).
- Domaines séparés du EAV : `typesAthena.ts` (socle F0) et `typesSimulation.ts` (`Appel` : `audio_url`, `ts_debut_ms`, `duree_ms`, `piste`).
- **Créateur `/flux`** (`components/simulation/SimulationPage.tsx`) : glisser des MP3 (1 MP3 = 1 appel) → `sim/audioMeta.ts` lit la durée → `data/storageAudio.ts` upload dans **Supabase Storage** (bucket `appels-audio`, public) → `data/appelsApi.ts` insère une ligne `appels`.
- **Seed scénario PRADO-167** (`frontend/scripts/seedScenario.mjs`, réutilisable) : charge un scénario complet dans `appels` sans passer par l'UI. Réplique l'ingestion (upload bucket `appels-audio` en `<uuid>.mp3` via anon key → insert `appels`). Source = dossier `scenario/` (10 appels 112 `emergency_calls/` + 5 réseaux radio `radio_comms/`). Timeline calée sur `05_MASTER_TIMELINE.md` avec **t0 = 02:47:12** (CALL-01) → `ts_debut_ms` = décalage réel ; `duree_ms` = ffprobe (arrondi ms) ; 1 fichier = 1 `piste` (0-4 radios, 5-14 appels, ordre chronologique) ; `operateur`/`localisation`/`caserne` remplis depuis les README/index. Le script **vide** `appels` d'abord (transcriptions cascadent). Lancer : `cd frontend && node scripts/seedScenario.mjs`.
- **Timeline** `TimelineMontage.tsx` : clips draggables (pointer events, logique pure), position X = `ts_debut_ms`, Y = `piste` (overlap) ; échelle `PX_PER_SEC`. Persiste via `updateAppel` au relâchement.
- **Contrôle flottant** `ControleSimulation.tsx` (bas-droite, monté dans `AppLayout`) piloté par le store `store/useSimulationPlayback.ts` : Lancer/Revenir/Couper. **Aucun panneau** (exigence utilisateur).
- **Moteur Web Audio** (`useSimulationPlayback.ts`) : chaque appel = `<audio crossOrigin=anonymous>` → `MediaElementSource` → `AnalyserNode`. **Muet par défaut** : l'analyser n'est PAS relié à `ctx.destination`. `basculerEcoute(id)` connecte/déconnecte l'analyser à la sortie = toggle écoute. `getAnalyseur(id)` alimente l'histogramme. **Aussi** : `source.connect(dest)` sur un `MediaStreamAudioDestinationNode` (muet, séparé de `ctx.destination`) → `getStream(id)` expose un `MediaStream` par appel pour alimenter un `MediaRecorder` (visualiseur du Live feed, voir plus bas). État réactif : `actifs` (fenêtre temporelle, calculé dans le rAF), `ecoutes`. `AudioContext` créé/resumé dans le geste du clic (avant le fetch) pour l'autoplay. CORS OK (Supabase Storage renvoie `Access-Control-Allow-Origin: *`).
- **Dashboard `/tableau-de-bord`** (`components/dashboard/DashboardPage.tsx`, page directe) = `ResizablePanelGroup` (`ui/resizable.tsx`, dep `react-resizable-panels`) : **carte** (`dashboard/Carte.tsx`, gauche) + **`PanneauFluxAudio.tsx`** (droite). Chaque flux : titre + visualiseur + toggle écoute (`Volume2`/`VolumeX`). **Visualiseur du Live feed = `VisualiseurAudioLive.tsx`** (dep **`react-audio-visualize`** → `LiveAudioVisualizer`, barres FFT) : crée un `MediaRecorder` à partir de `getStream(appelId)`, monté/démonté avec le flux affiché (⚠ le composant crée **1 `AudioContext` par instance** → borner aux appels réellement actifs limite le risque de la limite navigateur ~6 ; repli sur `VisualiseurVoix` si `MediaRecorder` indisponible). `VisualiseurVoix` (histogramme maison piloté par `getByteFrequencyData`) **reste utilisé** dans `FeuilleTranscription`. **Carte en 3D** (`Carte.tsx`) : `maxPitch:70` + `NavigationControl` avec compas/`visualizePitch` ; sur `m.on('load')`, `ajouterBatiments3D` ajoute une source vectorielle **BD TOPO® IGN** (`data.geopf.fr/tms/1.0.0/BDTOPO`, sans clé) et une couche `fill-extrusion` (source-layer `batiment`) dont la **hauteur = champ `hauteur`** réel (poussée entre z14→z15.5, dégradé selon la hauteur, sous les libellés). Le recentrage sur une entité géolocalisée passe en **`flyTo` incliné** (`zoom:16, pitch:55`) → les immeubles apparaissent en volume. ⚠ IGN limite à **1 req/s** : sur une session de dev très sollicitée, le fond peut cesser de tuiler (carte sombre) — indépendant du code, OK en usage normal.
- **Transcription — archi serveur « produce → store → display »** (refactor archi, remplace l'approche STT-navigateur initiale). Flux : le clic **« Lancer »** de la simulation (`store/useSimulationPlayback.lancer()`) fait un **`POST /transcribe`** au backend Render (`data/transcribeApi.ts`, URL HTTP dérivée de `VITE_STT_WS_URL`). Le **backend `poc-stt/`** (job serveur) : lit les appels dans Supabase → **supprime** leurs transcriptions existantes (recalcul « à chaque lancement ») → pour chaque appel, en tâche de fond (`ThreadPoolExecutor`, `transcribe_job.py`) : télécharge le MP3, le **décode en PCM 16 kHz mono via PyAV** (`audio_decode.py`, wheel `av` = ffmpeg embarqué, pas de dépendance OS), le stream **au rythme réel** (chunk 80 ms / 80 ms → live) à travers `stt_client.run_stt_stream` (Chirp 3 streaming), et **`INSERT` chaque segment `final`** dans la table `transcriptions` (via `supabase_client.py`, clé **service_role**). L'`interim` n'est PAS persisté (bruit UI). Le **dashboard est pur lecteur** : `FeuilleTranscription.tsx` (Sheet droite, même carte audio + toggle écoute) lit `transcriptions` via `hooks/useTranscriptionDB.ts` (`data/transcriptionsApi.ts` : `select` initial + abonnement **Realtime** ; un segment `ordinal===0` = nouveau run → reset). **Aucune STT côté front** (les ex-`lib/sttStream.ts` / `hooks/useTranscription.ts` ont été supprimés). Migration **`0004_transcriptions.sql`** (table + Realtime + RLS permissive). Prérequis runtime : migration `0004` appliquée + env Render **`SUPABASE_URL`** & **`SUPABASE_SERVICE_ROLE_KEY`** (en plus des creds GCP). Backend Render existant : `athena-kh52.onrender.com` (voir mémoire projet). `POST /transcribe` cross-origin → **CORS ajouté** dans `main.py`. ⚠ « à chaque lancement » = re-appel Google pour tous les appels à chaque clic Lancer (coût). Le futur service LLM (F3) consommera `transcriptions`. **⚠ Limite Google STT V2 : un `StreamingRecognize` ne peut pas dépasser ~5 min.** `stt_client.run_stt_stream` **rouvre donc un nouveau stream toutes les ~4 min** (`STREAM_LIMIT_BYTES`, pattern « infinite streaming » ; `carryover` reporte le chunk-frontière → aucune perte) pour transcrire en entier les fichiers longs (réseaux radio ~15 min). Le stream se **reconnecte aussi sur erreur transitoire** (RST_STREAM/500, jusqu'à `MAX_ERREURS=5`). ⚠ Feeder **au rythme réel obligatoire** : Google V2 RST le stream si on l'alimente trop vite (nourrir en 8× → `RST_STREAM`). **Planification PROGRESSIVE** (`main.py`) : `POST /transcribe` ne lance pas tout d'un coup — chaque job est différé par un `threading.Timer` de `ts_debut_ms` (normalisé sur le plus précoce) → l'appel est transcrit à l'instant où il devient actif sur la timeline (en phase avec la lecture navigateur) et la charge s'étale. **Relance propre** (« Revenir » / re-Lancer) : un `_stop_event` + annulation des timers en attente coupe le run précédent (jobs en cours via `stop_event.is_set()` dans le feeder) avant de replanifier. **Mémoire** : décodage **au fil de l'eau** (`audio_decode.stream_pcm16k_mono`) — on ne matérialise jamais tout le PCM (un radio de 15 min = 28 Mo PCM évités) → tient sur le plan free 512 Mo même avec ~10 jobs concurrents. Pool `_transcribe_pool` à **`max_workers=32`**. **⚠ Piège corrigé** : `stt_client` lit `GOOGLE_CLOUD_PROJECT`/`REGION` **paresseusement** (à l'usage, pas à l'import) — sinon avec un `.env` chargé après l'import, le projet est `None`. `extraction._get_client()` est aussi paresseux (pas d'`ANTHROPIC_API_KEY` requis à l'import). `language_codes=["auto"]` mésdétecte parfois la langue (finnois/basque sur de l'anglais) — à fiabiliser un jour. **Itération locale** : `poc-stt/.env` + `key.json` (gitignorés) → `uv run uvicorn main:app`, scripts `debug_stt.py` (STT brut, arg speed), `debug_job.py` (job complet + insert ; `STT_STREAM_LIMIT_SEC=60` force les redémarrages), `debug_progressive.mjs` (planif + relance). Déploiement backend = push sur `main` → Render auto-deploy (`render.yaml`, service `athena-stt`). ⚠ **Extraction LLM cassée tant que la migration `0005_extraction_appel.sql` n'est pas appliquée** (`column evenements.appel_id does not exist`) — sans impact sur la transcription (try/except), mais la carte/entités ne se peuplent pas.
- **Couche LLM — agents sémantiques (F3, juil. 2026)** : un **agent LLM par appel**, planifié EXACTEMENT comme les transcriptions (pool dédié `_agent_pool` de `main.py`, `threading.Timer` à `ts_debut_ms` normalisé, annulé par le même `_stop_event` à la relance). `POST /transcribe` planifie désormais **2 jobs par appel** — transcription **et** `agent_job.run_agent` — au même instant. L'agent **sonde `transcriptions`** (`POLL_SEC`=4 s) et, à chaque nouveau lot de segments (ordinal > dernier vu), lance une **boucle d'outils Claude** (tool-use natif, PAS de serveur MCP réseau ; modèle `AGENT_MODEL`, défaut `claude-haiku-4-5`, `MAX_TOURS`=12). **Chaque lot = conversation NEUVE** : l'état (ce qui existe déjà) vient de la base via `query_instances`, pas d'un historique qui gonflerait le contexte → borné + dédup inter-appels gratuite. Fin d'appel = `IDLE_LIMIT` sondages vides d'affilée, ou garde-fou d'horloge `duree_ms+120 s`. **Outils** (`agent_tools.py`) : `query_schema` (lit le méta-schéma EAV `entities`/`attributes` → les types DESSINÉS + leurs champs), `query_instances` (instances récentes **tous appels confondus** → « cette victime existe peut-être déjà »), `create_instance`/`update_instance` (écrit `object_instances`, calcule le `diff` champ par champ), `geocoder` (IGN, portage de `geocodage_ign` → lon/lat sur la carte). **Schema-driven** : l'agent instancie les types que l'utilisateur dessine (Victime, Lieu, Engin…), plus la taxonomie figée acteur/moyen/zone. Chaque bloc-texte de l'agent est journalisé (`journal_raisonnement`) → « stack trace ». **Modèle DB (migration `0009_object_instances.sql`, idempotente : `if not exists` + guards Realtime `when others` + `drop policy if exists`)** : `object_instances` (`id`, `schema_entity_id`→`public.entities` on delete set null, `type_name`, `libelle`, `fields jsonb`, `lon`/`lat`, `appel_id`→`appels`, `statut`, `cree_le`/`maj_le`) + `agent_journal` (append-only, `id bigint identity`, `appel_id`, `instance_id`, `kind`∈`raisonnement|creation|modification|suppression|outil`, `objet`, `texte`, `diff jsonb`). RLS permissive + Realtime (pattern `transcriptions`). **Ardoise vierge** : `/transcribe` purge `transcriptions`+`agent_journal`+`object_instances` des appels ciblés au lancement (une fois, pas par tour). **Front recâblé** (miroir `entites`/`transcriptions`) : `data/instancesApi.ts` (global `listInstances`+Realtime `*`) + `data/journalAgentApi.ts` (`listJournal(appelId)` trace + `listSemanticEdits()` global) ; hooks `useInstancesDB` (global), `useJournalAgentDB(appelId)` (trace Sheet), `useSemanticEditsDB` (global). **4 surfaces branchées** : **carte** (`Carte.tsx` → `useInstancesDB()`, marqueurs des instances avec lon/lat, vue globale — recadre auto sur le 1er objet géoloc), **panneau Objets bas** (`PanneauObjets.tsx` → instances live groupées par `type_name`, filtre par type ; remplace l'ancien affichage des *types* de schéma), **trace de raisonnement** (`SectionRaisonnement` dans le Sheet → `agent_journal` par appel), **Semantic Layer** (`PanneauSemanticLayer.tsx` → edits globaux mappés en `LigneSemantic{objet,texte,t,diff}`, pastille via `genreDe`). ⚠ **Prérequis runtime** : `ANTHROPIC_API_KEY` **sur Render** (sinon l'agent ne démarre pas — log warning, transcription non impactée). **Itération locale** : `poc-stt/debug_agent.py [index]` (lance `run_agent` sur 1 appel hors-STT contre les `transcriptions` en base, insère des segments démo si vide, POLL/IDLE accélérés ; gitignoré). Validé le 5 juil. : CALL-03 → 5 instances (`Bâtiment`/`Lieu`/`Intervention`/`Victime`/`Engin`) géolocalisées + 12 lignes de journal. **Tables héritées `entites`/`evenements` DORMANTES** (plus écrites ; migration `0005` devient sans objet). L'ancienne extraction batch (`extraction.py`) **n'est plus appelée** (retirée de `transcribe_job.py`) mais le fichier reste en place.
- ⚠ **La notion d'« intervention » a été retirée de l'UI** (4 juil.) : supprimés `components/intervention/*`, `store/useInterventionStore.ts`, `hooks/useRealtimeIntervention.ts`. Restent dormants `data/interventionApi.ts` + `typesAthena.ts` (types `Entite`/`Evenement`/`STATUTS` encore utilisés par la carte) comme socle de la future pipeline — le modèle DB (`evenements`/`entites`) est encore ancré sur `intervention_id`, à revoir quand on branchera la pipeline.
- **Extraction LLM — archi serveur « produce → store → display » (branchée bout-en-bout).** Après la transcription d'un appel, `transcribe_job.py` appelle `extraction.extraire_appel()` : Claude (**Haiku 4.5**, `EXTRACTION_MODEL`) pilote une **boucle d'outils** (`lister_entites` → `creer_entite`/`mettre_a_jour_entite`/`lier_entites`/`geocoder`, max `MAX_TOURS=16`) qui lit/écrit le graphe réel `entites`/`evenements` (clé service_role). Claude voit les objets déjà créés (ids stables) → décide coréférence vs nouvel objet, pose les relations (victime `situee_dans` zone, moyen `engage_sur` sinistre) et géocode l'adresse (`geocodage_ign.py`). Chaque écriture laisse une trace `evenements` avec `payload.extrait_source`. **Idempotent par run** (ardoise vierge par `appel_id`). Tous les appels d'un run partagent l'intervention fixe **`SIMULATION_INTERVENTION_ID` (`00000000-…0001`)**. **Le dashboard est pur lecteur, par intervention** : `hooks/useEntitesRun.ts` + `hooks/useEvenementsRun.ts` (select + Realtime filtrés sur `intervention_id`, canaux à nom unique via compteur) → `CarteRun.tsx` alimente `Carte` (marqueurs des entités géolocalisées, recentrage sur la zone) et `SemanticRun.tsx` construit les lignes du **Semantic Layer** via `lib/coucheSemantique.ts` (pur : rejoue le journal dans l'ordre pour un diff avant/après réel, joint `entity_id`→libellé). `PanneauSemanticLayer` est devenu présentationnel (prop `lignes`, plus de mock ; état vide propre). Le clic sur une ligne ouvre `PanneauDiff` (avant/après réel). Les couches d'accès `data/entitesApi.ts` / `data/evenementsApi.ts` exposent `list*/subscribe*` par-appel **et** par-intervention. `AppelDetails.SectionRaisonnement` (volet par appel) lit toujours `useEvenementsDB(appelId)`. **⚠ Prérequis runtime : migration `0005_extraction_appel.sql` appliquée + `ANTHROPIC_API_KEY` sur Render.** Helpers dormants restants : `data/geocodageIgn.ts` (front, IGN sans clé, `SEUIL_FIABLE=0.8`) et `data/interventionApi.ts` (`upsertEntite`, `majCentreIntervention`). Reste à explorer : liaison inter-appels (les jobs tournent en parallèle, résolution d'entités cadrée par appel), validation humaine des adresses < seuil.
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
