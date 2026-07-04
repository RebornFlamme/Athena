# SPEC TECHNIQUE — POC STT Live Streaming avec Chirp 3 + Diarization native Google
## À destination de l'agent de code (DeepSeek V4 Pro)

---

## 0. Objectif de cette tâche — LIRE EN PREMIER

Construire un **POC (proof of concept)** qui démontre la fonctionnalité suivante :

> Un ou plusieurs utilisateurs parlent dans **un seul micro** (dans **n'importe quelle langue**). Le texte de ce qu'ils disent s'affiche **en temps réel** sur une page web, avec la langue détectée automatiquement, et **chaque locuteur est automatiquement distingué par une couleur unique** via la diarization native de Google Speech-to-Text V2.

**Rien de plus. Rien de moins.**

Ce POC sera intégré plus tard dans un système plus large avec traduction et extraction d'entités, mais **ces parties sont hors périmètre**. Ne pas les implémenter. Ne pas les préparer. Se concentrer uniquement sur : audio micro → transcription live affichée avec distinction automatique des locuteurs par la voix.

### Critères de succès (non négociables)
1. Je démarre le backend, j'ouvre la page web, je clique sur "Start", je parle en français, je vois mon texte s'afficher au fur et à mesure que je parle (avec au maximum ~1 seconde de latence perçue), et mon texte est dans **une couleur** correspondant au speaker détecté.
2. Je parle en italien, en anglais, en arabe — la transcription se fait dans la langue parlée, et le code de langue détecté (ex: `it-IT`, `en-US`, `ar-SA`) s'affiche à l'écran.
3. Deux types de texte sont visuellement distinguables à l'écran : le texte **provisoire** (interim, qui bouge/se corrige) et le texte **définitif** (final, figé).
4. **Si une seule personne parle, tous les blocs ont la même couleur. Si deux personnes parlent en alternance dans le même micro, les blocs alternent automatiquement entre deux couleurs sans intervention manuelle.**

Si ces quatre critères passent, la tâche est terminée. **Ne pas over-engineer.**

---

## 1. Stack technique imposée

- **Langage backend** : **Python 3.11+**
- **Framework backend** : **FastAPI** avec support WebSocket (via `uvicorn[standard]`)
- **API STT** : **Google Cloud Speech-to-Text API V2**, modèle **`chirp_3`**
- **SDK Python** : `google-cloud-speech` (version ≥ 2.27.0 pour avoir Speech V2 stable)
- **Frontend** : **HTML + JavaScript vanilla** (pas de framework, pas de React, pas de build system). Un seul fichier `index.html` servi statiquement par FastAPI.
- **Capture micro** : Web Audio API + `ScriptProcessorNode`

**Interdit** : ne pas utiliser Speech-to-Text API V1 (obsolète), ne pas utiliser de framework frontend, ne pas conteneuriser avec Docker à ce stade.

---

## 2. Prérequis Google Cloud — À CONFIGURER AVANT DE CODER

### 2.1 Projet GCP
- Un projet Google Cloud actif avec facturation activée (Chirp 3 n'est pas dispo sur le tier gratuit uniquement)
- API **Cloud Speech-to-Text API** activée sur ce projet

### 2.2 Authentification
- Créer un **compte de service** avec le rôle `roles/speech.editor` (ou `roles/speech.client`)
- Télécharger la clé JSON du compte de service
- Exposer via la variable d'environnement : `GOOGLE_APPLICATION_CREDENTIALS=/chemin/vers/cle.json`
- Exposer aussi : `GOOGLE_CLOUD_PROJECT=<project_id>`

### 2.3 Région — POINT CRITIQUE

⚠ **La diarization avec chirp_3 n'est supportée que dans la région `eu`** (europe-west4) pour fr-FR et plusieurs autres langues. En `us`, la diarization n'est pas listée comme supportée pour chirp_3.

**Configurer :**
- `GOOGLE_CLOUD_REGION=eu` (variable d'environnement)
- Endpoint API régional : `eu-speech.googleapis.com`

Source : [Table des modèles supportés](https://cloud.google.com/speech-to-text/v2/docs/speech-to-text-supported-languages)

### 2.4 Recognizer
Utiliser le recognizer **inline** (créé à la volée dans la requête) : le chemin est `projects/{PROJECT_ID}/locations/{REGION}/recognizers/_`. Le `_` à la fin signifie "config inline". **Pas besoin de créer un recognizer persistant** via l'API pour ce POC.

---

## 3. Architecture

```
┌──────────────────────────┐       WebSocket /ws             ┌─────────────────────────────┐
│  Navigateur               │◄────── audio chunks ──────────►│   FastAPI backend           │
│  - Capture micro          │       + résultats JSON          │                             │
│  - Affiche transcript     │                                 │   run_stt_stream ──gRPC──►  │
│    avec couleur par       │                                 │   Google STT V2             │
│    speaker_tag (1-6)      │                                 │   (chirp_3 + diarization)   │
└──────────────────────────┘                                 └────────────┬────────────────┘
                                                                           │
                                                               ┌───────────▼─────────────────┐
                                                               │  Google Speech-to-Text API  │
                                                               │  V2 - modèle chirp_3        │
                                                               │  + SpeakerDiarizationConfig │
                                                               │  (min=1, max=6 speakers)    │
                                                               │                             │
                                                               │  speaker_label par mot      │
                                                               │  → agrégé en speaker_tag    │
                                                               └─────────────────────────────┘
```

**Architecture de diarization** : un seul flux audio, une seule connexion WebSocket. Google détecte automatiquement les changements de locuteur via `SpeakerDiarizationConfig`. Chaque mot reçoit un `speaker_label` (string "1", "2", ...). Le backend agrège les labels par résultat et renvoie un `speaker_tag` (int). Le frontend l'utilise pour colorer les transcripts.

**Pourquoi chirp_3 et pas chirp_2/long** : chirp_3 est le seul modèle V2 listé avec support diarization pour fr-FR dans la table officielle des fonctionnalités. chirp_2, long, latest_long ne listent pas la diarization comme supportée.

---

## 4. Backend — Détails d'implémentation

### 4.1 Structure de fichiers

```
poc-stt/
├── main.py              # FastAPI app + endpoint WebSocket unique /ws
├── stt_client.py        # Wrapper autour de google-cloud-speech + diarization
├── static/
│   └── index.html       # Page de démo (voir section 5)
├── data/                # Fichiers audio uploadés
├── requirements.txt
├── .env.example         # Documentation des variables d'environnement
├── README.md            # Instructions de lancement
└── spec-poc-stt-chirp3.md  # Ce fichier
```

### 4.2 `requirements.txt` exact

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
google-cloud-speech>=2.27.0
python-dotenv>=1.0.0
python-multipart>=0.0.9
```

### 4.3 Imports SDK Google — À utiliser tels quels

```python
from google.cloud.speech_v2 import SpeechClient
from google.cloud.speech_v2.types import cloud_speech
from google.api_core.client_options import ClientOptions
```

### 4.4 Initialisation du client Speech

**IMPORTANT** : utiliser la région `eu` pour la diarization avec chirp_3.

```python
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
REGION = os.getenv("GOOGLE_CLOUD_REGION", "eu")  # "eu" requis pour la diarization chirp_3

client = SpeechClient(
    client_options=ClientOptions(
        api_endpoint=f"{REGION}-speech.googleapis.com",
    )
)
```

### 4.5 Configuration de reconnaissance avec diarization — CRITIQUE

```python
recognition_config = cloud_speech.RecognitionConfig(
    explicit_decoding_config=cloud_speech.ExplicitDecodingConfig(
        encoding=cloud_speech.ExplicitDecodingConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        audio_channel_count=1,  # mono
    ),
    language_codes=["auto"],
    model="chirp_3",
    features=cloud_speech.RecognitionFeatures(
        enable_automatic_punctuation=True,
        enable_word_time_offsets=True,  # requis pour récupérer speaker_label par mot
        diarization_config=cloud_speech.SpeakerDiarizationConfig(
            min_speaker_count=1,
            max_speaker_count=6,
        ),
    ),
)

streaming_config = cloud_speech.StreamingRecognitionConfig(
    config=recognition_config,
    streaming_features=cloud_speech.StreamingRecognitionFeatures(
        interim_results=True,
    ),
)

config_request = cloud_speech.StreamingRecognizeRequest(
    recognizer=f"projects/{PROJECT_ID}/locations/{REGION}/recognizers/_",
    streaming_config=streaming_config,
)
```

### 4.6 Endpoint WebSocket — Unique

**Un seul endpoint `WebSocket /ws`** pour tous les modes (micro et fichier). La distinction des locuteurs est entièrement gérée par la diarization Google.

**Flow attendu :**

1. Le client se connecte à `/ws`
2. Le backend accepte la connexion WebSocket
3. Le backend crée des queues locales `audio_queue` et `result_queue`
4. Le backend lance `run_stt_stream()` dans un thread séparé
5. Trois tâches asyncio : `receive_audio`, `send_results`, `run_stt_stream`
6. Chaque résultat est envoyé tel quel en JSON au client (pas d'injection de `speaker_id`)

```python
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    audio_queue: queue.Queue = queue.Queue()
    result_queue: queue.Queue = queue.Queue()
    loop = asyncio.get_running_loop()

    async def receive_audio():
        # Lecture des chunks binaires du WebSocket → audio_queue
        ...

    async def send_results():
        # Lecture de result_queue → websocket.send_json()
        ...

    await asyncio.gather(
        receive_audio(),
        send_results(),
        asyncio.to_thread(run_stt_stream, audio_queue, result_queue),
    )
```

### 4.7 Extraction du `speaker_tag` depuis les mots

Google V2 renvoie un `speaker_label` (string) par mot dans `WordInfo`. On agrège les labels de la première alternative et on retourne le plus fréquent, converti en int :

```python
def _extract_speaker_tag(result) -> int | None:
    if not result.alternatives or not result.alternatives[0].words:
        return None

    speaker_counts: dict[int, int] = {}
    for word_info in result.alternatives[0].words:
        label = getattr(word_info, "speaker_label", None) or ""
        if label:
            try:
                tag = int(label)
                speaker_counts[tag] = speaker_counts.get(tag, 0) + 1
            except (ValueError, TypeError):
                pass

    if not speaker_counts:
        return None
    return max(speaker_counts, key=lambda k: speaker_counts[k])
```

### 4.8 Récupération du code de langue détecté

Inchangé par rapport à V1 : `result.language_code`, fallback sur l'alternative.

### 4.9 Limites Google à connaître — GOTCHAS

1. **Limite de taille par message** : 25 KB max par message dans le stream. Chunks de ~80ms à 16kHz mono LINEAR16 = ~2.6 KB par chunk → ✅ OK.
2. **Durée max d'un stream** : ~5 minutes par session streaming (quota Google).
3. **Premier message** : le premier `StreamingRecognizeRequest` DOIT contenir uniquement `streaming_config`, pas de `audio`.
4. **Diarization en streaming** : Google renvoie tous les mots depuis le début de l'audio dans chaque réponse consécutive (pour améliorer les speaker tags). Les résultats intermédiaires (interim) peuvent ne pas encore avoir de `speaker_label` — dans ce cas, `speaker_tag` sera `null`.

### 4.10 Servir le frontend statique

```python
from fastapi.staticfiles import StaticFiles
app.mount("/data", StaticFiles(directory="data"), name="data")
app.mount("/", StaticFiles(directory="static", html=True), name="static")
```

---

## 5. Frontend — Détails d'implémentation

### 5.1 Choix technique

**Utiliser `ScriptProcessorNode` + downsampling manuel** (déprécié mais toujours supporté partout, suffisant pour un POC).

### 5.2 Aucun choix manuel de speaker

⚠ **Pas de dropdown "Who are you?", pas de sélection manuelle de speaker.** Un seul bouton Start, une seule connexion WebSocket vers `/ws`. La diarization Google détecte automatiquement qui parle.

### 5.3 Palette de couleurs par speaker_tag — FIXE

Mapping en dur dans le code JavaScript :

| speaker_tag | Couleur | Code hex |
|-------------|---------|----------|
| 1 | Bleu | `#60a5fa` |
| 2 | Orange | `#fb923c` |
| 3 | Vert | `#4ade80` |
| 4 | Violet | `#c084fc` |
| 5 | Rose | `#f472b6` |
| 6 | Cyan | `#22d3ee` |
| null/absent | Gris neutre | `#9ca3af` |

### 5.4 Flow côté navigateur

1. L'utilisateur clique "Start" → demander l'accès micro via `navigator.mediaDevices.getUserMedia({ audio: true })`
2. Créer un `AudioContext`
3. Connecter le stream micro à un `ScriptProcessorNode`
4. Dans le callback, à chaque buffer : downsampling 48kHz→16kHz, Float32→Int16, envoi binaire WebSocket
5. Recevoir les messages JSON du backend et les afficher **avec la couleur correspondant au `speaker_tag`**

### 5.5 Structure de la page

```html
<!-- Boutons : Start / Stop / Status / Language -->
<div class="controls">...</div>

<!-- Zone interim -->
<div class="transcript-box">
  <h3>Texte provisoire (interim)</h3>
  <div id="interim"></div>
</div>

<!-- Zone final -->
<div class="transcript-box">
  <h3>Texte définitif (final)</h3>
  <div id="final"></div>
</div>
```

**Comportement d'affichage :**

- Message avec `is_final: false` → **remplace** le contenu de `#interim`. Le texte est affiché dans la couleur du `speaker_tag`. Si `speaker_tag` est null, couleur grise.
- Message avec `is_final: true` → **ajoute** le texte à `#final` (avec un espace), préfixé par `[Speaker N]`, dans la couleur du `speaker_tag`, ET vide `#interim`.
- Chaque message met à jour `#lang` avec le code langue reçu.

**Exemple de rendu final (deux personnes parlant en alternance dans le même micro) :**

```
[Speaker 1] Bonjour, comment ça va ?    ← en bleu
[Speaker 2] I'm doing great, thanks!    ← en orange
[Speaker 1] Tu veux un café ?           ← en bleu
[Speaker 2] Yes, please.                ← en orange
```

### 5.6 Fonction de downsampling

Inchangée par rapport à V1.

### 5.7 Boutons UX

- **Start** : demande le micro, ouvre le WebSocket vers `/ws`, commence à streamer
- **Stop** : ferme le WebSocket proprement, arrête le micro
- Indicateur de statut (connecté / déconnecté / en écoute)
- **Mode tabs** : Microphone / Fichier audio (toggle existant, conservé)
- **Mode fichier** : upload, playlist, player controls (existant, conservé)

### 5.8 Connexion WebSocket — endpoint unique

```javascript
function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/ws`;  // endpoint unique
    ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    // ...
}
```

---

## 6. Protocole WebSocket

### 6.1 Client → Backend
- **Type de message** : binaire uniquement (chunks audio bruts Int16 en little-endian)
- Aucun message texte/JSON à envoyer depuis le client

### 6.2 Backend → Client
- **Type de message** : JSON texte
- **Schéma (avec speaker_tag)** :

```json
{
  "type": "transcript",
  "text": "bonjour comment ça va",
  "is_final": false,
  "language_code": "fr-FR",
  "speaker_tag": 2
}
```

- **speaker_tag** : int (1-6) si la diarization a détecté un locuteur, `null` si pas encore de détection ou si la diarization ne renvoie rien pour ce segment.

- **Message d'erreur** :

```json
{
  "type": "error",
  "message": "description lisible"
}
```

---

## 7. Fichier `README.md` à mettre à jour

Ajouter au README existant :
- La fonctionnalité de diarization automatique : comment Google détecte les locuteurs sans intervention manuelle
- Le nouveau schéma JSON avec `speaker_tag`
- La contrainte de région `eu` pour la diarization

---

## 8. Plan de test — À valider dans cet ordre

### Test 1 : Sanity check backend seul
- Lancer le backend
- Aller sur `http://localhost:8000/health`
- ✅ Attendu : 200 OK

### Test 2 : WebSocket s'ouvre
- Ouvrir la page, ouvrir la console DevTools
- Cliquer Start
- ✅ Attendu : log "WebSocket connected", URL = `/ws`, pas d'erreur

### Test 3 : Audio arrive au backend
- Parler dans le micro
- Côté backend, logger la taille de chaque chunk reçu
- ✅ Attendu : logs `Chunk audio reçu : XXXX octets`

### Test 4 : Google répond avec diarization
- Parler seul dans le micro
- Côté backend, logger chaque réponse de Google
- ✅ Attendu : réponses régulières avec du texte non vide et `speaker_tag` détecté (probablement 1 si une seule personne)

### Test 5 : Affichage temps réel avec couleur
- Regarder la page
- ✅ Attendu : texte apparaît dans la zone "interim" en couleur, puis migre en "final" avec `[Speaker 1]` en couleur, puis texte suivant en même couleur

### Test 6 : Multilingue
- Parler en italien : "Ciao, come stai oggi?"
- ✅ Attendu : le texte italien s'affiche, `language_code` = `it-IT`
- Répéter avec anglais, espagnol, arabe

### Test 7 : Robustesse
- Cliquer Stop en plein milieu d'une phrase → pas de crash backend
- Recharger la page → nouvelle connexion propre
- Laisser tourner en silence pendant 30 secondes → pas de crash

### Test 8 : Diarization — deux locuteurs dans le même micro
- Cliquer Start
- Personne A parle : "Bonjour, je suis la personne A"
- ✅ Attendu : `[Speaker 1] Bonjour, je suis la personne A` en bleu
- Personne B parle (à côté du même micro) : "Hello, I am person B"
- ✅ Attendu : `[Speaker 2] Hello, I am person B` en orange
- Personne A reprend : "Comment ça va ?"
- ✅ Attendu : `[Speaker 1] Comment ça va ?` en bleu (même speaker_tag que le premier message de A)
- ✅ Les couleurs alternent automatiquement, sans intervention manuelle

### Test 9 : Mode fichier (régressif)
- Passer en mode "Fichier audio"
- Uploader un MP3, cliquer Play
- ✅ Attendu : transcription avec speaker_tag (si le fichier contient plusieurs voix), pas de régression

---

## 9. Erreurs probables et comment les diagnostiquer

| Symptôme | Cause probable | Solution |
|---|---|---|
| `PermissionDenied: 403` | Compte de service sans le bon rôle | Vérifier IAM + activer Speech-to-Text API |
| `InvalidArgument: 400 model chirp_3 not supported in region` | Mauvaise région | Utiliser `eu` (pas `us`) pour la diarization |
| `NotFound: 404 recognizer not found` | Mauvais format de chemin | Vérifier `projects/{ID}/locations/{REGION}/recognizers/_` |
| Texte vide mais pas d'erreur | Problème de format audio | Vérifier downsampling 16kHz Int16 mono |
| Rien ne s'affiche | `interim_results=False` | Vérifier `interim_results=True` |
| `speaker_tag` toujours null | Diarization non activée ou région incorrecte | Vérifier `diarization_config` présent, région = `eu`, `enable_word_time_offsets=True` |
| Même couleur pour deux personnes différentes | Google diarization pas encore précise sur voix similaires | Normal en début de stream — Google améliore les tags avec le temps |

---

## 10. Ce qui est HORS PÉRIMÈTRE — Ne pas implémenter

- ❌ Traduction du texte (Gemini viendra plus tard)
- ❌ Extraction d'entités structurées
- ❌ Base de données / persistance
- ❌ Authentification utilisateur
- ❌ **Sélection manuelle de speaker (dropdown "Who are you?")** — remplacé par la diarization native Google
- ❌ **Multiple WebSocket endpoints (`/ws/{speaker_id}`)** — un seul endpoint `/ws`, la diarization fait la distinction
- ❌ Speech adaptation (jargon métier)
- ❌ Interface stylée / design travaillé
- ❌ Tests automatisés
- ❌ Docker / déploiement
- ❌ Gestion de reconnexion automatique
- ❌ Plus de 6 speakers simultanés

**Règle d'or : si un truc n'est pas explicitement demandé ici, ne pas le faire.**

---

## 11. Livrables attendus

À la fin, le repo `poc-stt/` doit contenir exactement :
- `main.py` (endpoint WebSocket unique `/ws`, pas de speaker_id)
- `stt_client.py` (diarization config + extraction speaker_tag)
- `static/index.html` (palette 6 couleurs + affichage par speaker_tag, pas de dropdown)
- `requirements.txt`
- `.env.example`
- `README.md` (mis à jour)
- `spec-poc-stt-chirp3.md` (ce fichier)

Et être **lançable en 3 commandes** :

```bash
pip install -r requirements.txt
export GOOGLE_APPLICATION_CREDENTIALS=... GOOGLE_CLOUD_PROJECT=... GOOGLE_CLOUD_REGION=eu
uvicorn main:app --port 8000
```

Puis `open http://localhost:8000/` → Start → parler → les couleurs changent automatiquement selon le locuteur.

---

## 12. Résumé des changements par rapport à la V2 (approche manuelle speaker_id)

| Section | Changement |
|---------|------------|
| 0. Critères de succès | Critère 4 modifié : alternance automatique de couleurs par voix (pas de sélection manuelle) |
| 2.3 Région | `us` → `eu` (requis pour diarization chirp_3) |
| 3. Architecture | N clients/N WebSockets → 1 client/1 WebSocket, diarization Google native |
| 4.5 Config | Ajout `SpeakerDiarizationConfig` + `enable_word_time_offsets` |
| 4.6 WebSocket | `/ws/{speaker_id}` supprimé → endpoint unique `/ws` |
| 4.7 | Nouveau : extraction `speaker_tag` depuis `WordInfo.speaker_label` |
| 5.2 Frontend | Dropdown "Who are you?" supprimé |
| 5.3 Frontend | Palette 4 couleurs (par speaker_id) → palette 6 couleurs (par speaker_tag) |
| 5.8 Frontend | `connectWebSocket(speakerId)` → `connectWebSocket()` sans paramètre |
| 6. Protocole | `speaker_id` remplacé par `speaker_tag` (int, nullable) |
| 8. Plan de test | Test 8 modifié : deux locuteurs dans le même micro (plus deux onglets séparés) |
| 10. Hors périmètre | Diarization Google n'est PLUS hors périmètre — c'est le cœur de l'approche |
