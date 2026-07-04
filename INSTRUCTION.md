# SPEC TECHNIQUE — POC STT Live Streaming avec Chirp 3
## À destination de l'agent de code (DeepSeek V4 Pro)

---

## 0. Objectif de cette tâche — LIRE EN PREMIER

Construire un **POC (proof of concept) minimal** qui démontre la fonctionnalité suivante :

> Un utilisateur parle dans son micro (dans **n'importe quelle langue**). Le texte de ce qu'il dit s'affiche **en temps réel** sur une page web, avec la langue détectée automatiquement.

**Rien de plus. Rien de moins.**

Ce POC sera intégré plus tard dans un système plus large avec traduction et extraction d'entités, mais **ces parties sont hors périmètre**. Ne pas les implémenter. Ne pas les préparer. Se concentrer uniquement sur : audio micro → transcription live affichée.

### Critères de succès (non négociables)
1. Je démarre le backend, j'ouvre la page web, je clique sur "Start", je parle en français, je vois mon texte s'afficher au fur et à mesure que je parle (avec au maximum ~1 seconde de latence perçue).
2. Je parle en italien, en anglais, en arabe — la transcription se fait dans la langue parlée, et le code de langue détecté (ex: `it-IT`, `en-US`, `ar-SA`) s'affiche à l'écran.
3. Deux types de texte sont visuellement distinguables à l'écran : le texte **provisoire** (interim, qui bouge/se corrige) et le texte **définitif** (final, figé).

Si ces trois critères passent, la tâche est terminée. **Ne pas over-engineer.**

---

## 1. Stack technique imposée

- **Langage backend** : **Python 3.11+**
- **Framework backend** : **FastAPI** avec support WebSocket (via `uvicorn[standard]`)
- **API STT** : **Google Cloud Speech-to-Text API V2**, modèle **`chirp_3`**
- **SDK Python** : `google-cloud-speech` (version ≥ 2.27.0 pour avoir Speech V2 stable)
- **Frontend** : **HTML + JavaScript vanilla** (pas de framework, pas de React, pas de build system). Un seul fichier `index.html` servi statiquement par FastAPI.
- **Capture micro** : Web Audio API + `MediaRecorder` ou `AudioWorklet` (voir section 5 pour le choix)

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
**Chirp 3 n'est PAS disponible dans toutes les régions.** Utiliser une région supportée. Au moment de la rédaction, `us-central1` fonctionne. Vérifier avec la doc actuelle si problème.

**Configurer :**
- `GOOGLE_CLOUD_REGION=us-central1` (variable d'environnement)
- Endpoint API régional : `us-central1-speech.googleapis.com` (voir section 4.2)

**Ne pas utiliser `global` comme location avec Chirp 3 en streaming** — ça peut fonctionner selon la période mais est moins fiable. Toujours utiliser un endpoint régional explicite pour ce POC.

### 2.4 Recognizer
Utiliser le recognizer **inline** (créé à la volée dans la requête) : le chemin est `projects/{PROJECT_ID}/locations/{REGION}/recognizers/_`. Le `_` à la fin signifie "config inline". **Pas besoin de créer un recognizer persistant** via l'API pour ce POC.

---

## 3. Architecture

```
┌─────────────────────────┐         WebSocket          ┌─────────────────────────┐
│  Navigateur (index.html)│ ◄────── audio chunks ────► │   FastAPI backend       │
│  - Capture micro        │         + résultats        │   - endpoint /ws        │
│  - Affiche transcript   │                            │   - relais vers Google  │
└─────────────────────────┘                            └────────────┬────────────┘
                                                                    │
                                                                    │ gRPC bidirectionnel
                                                                    │ StreamingRecognize
                                                                    ▼
                                                       ┌─────────────────────────┐
                                                       │  Google Speech-to-Text  │
                                                       │  API V2 - modèle chirp_3│
                                                       └─────────────────────────┘
```

**Un seul client à la fois pour ce POC.** Pas besoin de gérer N sessions parallèles — ça viendra plus tard. Juste : un navigateur, une connexion WebSocket, une session StreamingRecognize.

---

## 4. Backend — Détails d'implémentation

### 4.1 Structure de fichiers

```
poc-stt/
├── main.py              # FastAPI app + endpoint WebSocket
├── stt_client.py        # Wrapper autour de google-cloud-speech
├── static/
│   └── index.html       # Page de démo (voir section 5)
├── requirements.txt
├── .env.example         # Documentation des variables d'environnement
└── README.md            # Instructions de lancement
```

### 4.2 `requirements.txt` exact

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
google-cloud-speech>=2.27.0
python-dotenv>=1.0.0
```

### 4.3 Imports SDK Google — À utiliser tels quels

```python
from google.cloud.speech_v2 import SpeechClient
from google.cloud.speech_v2.types import cloud_speech
from google.api_core.client_options import ClientOptions
```

### 4.4 Initialisation du client Speech

**IMPORTANT** : utiliser un endpoint régional, pas le global.

```python
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
REGION = os.getenv("GOOGLE_CLOUD_REGION", "us-central1")

client = SpeechClient(
    client_options=ClientOptions(
        api_endpoint=f"{REGION}-speech.googleapis.com",
    )
)
```

### 4.5 Configuration de reconnaissance — CRITIQUE

C'est ici qu'on définit tout le comportement de Chirp 3. **Chaque paramètre a une raison, ne pas en omettre.**

```python
recognition_config = cloud_speech.RecognitionConfig(
    # LINEAR16 = PCM 16-bit signé, format standard. On force le format
    # explicitement plutôt que d'utiliser AutoDetectDecodingConfig,
    # parce qu'on sait exactement ce que le frontend va envoyer.
    explicit_decoding_config=cloud_speech.ExplicitDecodingConfig(
        encoding=cloud_speech.ExplicitDecodingConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        audio_channel_count=1,  # mono
    ),
    # "auto" = détection automatique de la langue dominante.
    # C'est LE point clé de ce POC. Ne pas mettre une langue en dur.
    language_codes=["auto"],
    model="chirp_3",
    features=cloud_speech.RecognitionFeatures(
        enable_automatic_punctuation=True,
    ),
)

streaming_config = cloud_speech.StreamingRecognitionConfig(
    config=recognition_config,
    streaming_features=cloud_speech.StreamingRecognitionFeatures(
        # OBLIGATOIRE : sinon on n'a que le texte final,
        # pas le feedback temps réel qui bouge à l'écran.
        interim_results=True,
    ),
)

config_request = cloud_speech.StreamingRecognizeRequest(
    recognizer=f"projects/{PROJECT_ID}/locations/{REGION}/recognizers/_",
    streaming_config=streaming_config,
)
```

### 4.6 Endpoint WebSocket — Logique

**Flow attendu :**

1. Le client se connecte à `/ws`
2. Le backend accepte la connexion WebSocket
3. Le backend ouvre une session `streaming_recognize` vers Google
4. Le backend crée un **générateur** qui yield d'abord la config, puis les chunks audio reçus du WebSocket
5. Le backend itère sur les réponses de Google et les renvoie au client au fur et à mesure

**Point technique important** : `client.streaming_recognize()` de Google est **bloquant/itérable** (pas natif async). Il faut donc l'exécuter dans un **thread** via `asyncio.to_thread()` ou `run_in_executor()`, et utiliser une **queue** (`asyncio.Queue`) pour passer les chunks audio du WebSocket vers le thread Google, et une autre pour remonter les résultats.

**Pattern recommandé :**

```python
# Pseudo-code de structure — l'agent doit implémenter proprement
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    audio_queue = asyncio.Queue()      # chunks audio depuis le client
    result_queue = asyncio.Queue()     # résultats à renvoyer au client
    
    # Tâche 1 : recevoir les chunks audio du client et les mettre en queue
    async def receive_audio():
        try:
            while True:
                data = await websocket.receive_bytes()
                await audio_queue.put(data)
        except WebSocketDisconnect:
            await audio_queue.put(None)  # signal de fin
    
    # Tâche 2 : envoyer les résultats de Google au client
    async def send_results():
        while True:
            result = await result_queue.get()
            if result is None:
                break
            await websocket.send_json(result)
    
    # Tâche 3 : le générateur qui alimente streaming_recognize
    # Doit tourner dans un thread parce que le SDK Google est sync
    def google_stt_thread():
        def request_generator():
            yield config_request  # premier message = config
            while True:
                chunk = asyncio.run_coroutine_threadsafe(
                    audio_queue.get(), loop
                ).result()
                if chunk is None:
                    break
                yield cloud_speech.StreamingRecognizeRequest(audio=chunk)
        
        responses = client.streaming_recognize(requests=request_generator())
        for response in responses:
            for result in response.results:
                if not result.alternatives:
                    continue
                payload = {
                    "type": "transcript",
                    "text": result.alternatives[0].transcript,
                    "is_final": result.is_final,
                    "language_code": result.language_code,  # ⚠ voir 4.7
                }
                asyncio.run_coroutine_threadsafe(
                    result_queue.put(payload), loop
                )
        asyncio.run_coroutine_threadsafe(result_queue.put(None), loop)
    
    loop = asyncio.get_running_loop()
    await asyncio.gather(
        receive_audio(),
        send_results(),
        asyncio.to_thread(google_stt_thread),
    )
```

⚠ **Ce pseudo-code montre la structure, pas la version finale.** L'agent doit :
- Bien gérer la fermeture propre (disconnect côté client, exception côté Google)
- Logger les erreurs Google (par ex. `google.api_core.exceptions.InvalidArgument` si config invalide)
- Ne pas laisser de threads/queues zombies au disconnect

### 4.7 Récupération du code de langue détecté

Selon la version du SDK, le champ peut être `result.language_code` ou dans un attribut différent. **À vérifier au runtime** :
- Premier essai : `result.language_code`
- Si vide : chercher dans `result.alternatives[0]` s'il y a une métadonnée
- Si toujours rien : logger l'objet `result` complet avec `MessageToDict` pour debug

En cas d'absence, renvoyer `"unknown"` au client, ne pas planter.

### 4.8 Limites Google à connaître — GOTCHAS

1. **Limite de taille par message** : There is a 25 KB limit on audio sent in the requests of a stream. This limit applies to to both the initial StreamingRecognize request and the size of each individual message in the stream. Exceeding this limit will throw an error. → chunks de 100ms à 16kHz mono LINEAR16 = ~3.2 KB par chunk, largement sous la limite. ✅ OK.

2. **Durée max d'un stream** : ~5 minutes par session streaming (à vérifier dans les quotas). Pour un POC de démo, on s'en fout. Pour prod, il faudrait redémarrer la session avant expiration.

3. **Premier message** : le premier `StreamingRecognizeRequest` DOIT contenir uniquement `streaming_config`, pas de `audio`. Les suivants contiennent uniquement `audio`. Ne pas mélanger.

4. **Ordre** : la config est envoyée en premier, sans exception. Le SDK plante si on envoie de l'audio avant.

### 4.9 Servir le frontend statique

```python
from fastapi.staticfiles import StaticFiles
app.mount("/", StaticFiles(directory="static", html=True), name="static")
```

Comme ça, aller sur `http://localhost:8000/` sert `index.html` directement.

---

## 5. Frontend — Détails d'implémentation

### 5.1 Choix technique : AudioWorklet vs MediaRecorder

**Utiliser AudioWorklet + downsampling manuel.** Pourquoi :
- `MediaRecorder` produit des formats compressés (WebM/Opus) que Chirp 3 en streaming ne consomme pas facilement en LINEAR16
- On veut du PCM brut 16kHz mono → il faut de toute façon downsampler depuis le taux natif du micro (souvent 48kHz)
- AudioWorklet donne accès aux samples bruts

**Alternative acceptable si trop compliqué** : utiliser `ScriptProcessorNode` (déprécié mais toujours supporté partout, plus simple). Pour un POC de hackathon, c'est OK.

### 5.2 Flow côté navigateur

1. Bouton "Start" → demander l'accès micro via `navigator.mediaDevices.getUserMedia({ audio: true })`
2. Créer un `AudioContext` (le sample rate natif sera probablement 48000 Hz)
3. Connecter le stream micro à un `ScriptProcessorNode` (ou AudioWorklet)
4. Dans le callback, à chaque buffer :
   - Downsampler de 48kHz vers 16kHz (ratio 3:1 : prendre 1 sample sur 3, ou faire une moyenne — la moyenne est plus propre)
   - Convertir de Float32 (-1.0 à 1.0) en Int16 (−32768 à 32767)
   - Envoyer les bytes en binary WebSocket : `ws.send(int16Buffer.buffer)`
5. Recevoir les messages JSON du backend et les afficher

### 5.3 Structure de la page

Deux zones d'affichage clairement distinctes :

```html
<div id="interim" style="color: gray; font-style: italic;">
  <!-- Texte provisoire, se réécrit à chaque nouveau message interim -->
</div>

<div id="final">
  <!-- Texte final, s'accumule à chaque message is_final: true -->
</div>

<div id="language-badge">
  Langue détectée : <span id="lang">–</span>
</div>
```

**Comportement :**
- Message avec `is_final: false` → **remplace** le contenu de `#interim`
- Message avec `is_final: true` → **ajoute** le texte à `#final` (avec un espace) ET vide `#interim`
- Chaque message met à jour `#lang` avec le code langue reçu

### 5.4 Fonction de downsampling (à fournir dans le code)

```javascript
function downsampleTo16k(float32Buffer, inputSampleRate) {
  if (inputSampleRate === 16000) {
    return float32ToInt16(float32Buffer);
  }
  const ratio = inputSampleRate / 16000;
  const outLength = Math.floor(float32Buffer.length / ratio);
  const output = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    // Moyenne des samples pour un downsampling propre
    const start = Math.floor(i * ratio);
    const end = Math.floor((i + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < float32Buffer.length; j++) {
      sum += float32Buffer[j];
      count++;
    }
    const avg = count > 0 ? sum / count : 0;
    // Clamp puis conversion Float32 → Int16
    const clamped = Math.max(-1, Math.min(1, avg));
    output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
  }
  return output;
}
```

### 5.5 Boutons UX minimum

- **Start** : demande le micro, ouvre le WebSocket, commence à streamer
- **Stop** : ferme le WebSocket proprement, arrête le micro
- Indicateur de statut (connecté / déconnecté / en écoute)

---

## 6. Protocole WebSocket

### 6.1 Client → Backend
- **Type de message** : binaire uniquement (les chunks audio bruts Int16 en little-endian)
- Aucun message texte/JSON à envoyer depuis le client dans ce POC
- La déconnexion se fait juste en fermant le WebSocket

### 6.2 Backend → Client
- **Type de message** : JSON texte
- **Schéma** :

```json
{
  "type": "transcript",
  "text": "bonjour comment ça va",
  "is_final": false,
  "language_code": "fr-FR"
}
```

- **Message d'erreur** (si problème côté Google ou backend) :

```json
{
  "type": "error",
  "message": "description lisible"
}
```

---

## 7. Fichier `README.md` à produire

Doit contenir :
1. Comment configurer GCP (lien vers la doc, pas besoin de tout réécrire)
2. Comment installer les dépendances (`pip install -r requirements.txt`)
3. Comment lancer : les 3 variables d'environnement à définir + `uvicorn main:app --reload --port 8000`
4. Comment tester : ouvrir `http://localhost:8000/` dans Chrome (Safari peut avoir des soucis avec Web Audio, prévenir), cliquer Start, parler
5. Section "Troubleshooting" listant les erreurs les plus probables (voir section 9)

---

## 8. Plan de test — À valider dans cet ordre

### Test 1 : Sanity check backend seul
- Lancer le backend
- Aller sur `http://localhost:8000/health` (ajouter cet endpoint qui renvoie juste `{"status": "ok"}`)
- ✅ Attendu : 200 OK

### Test 2 : WebSocket s'ouvre
- Ouvrir la page dans le navigateur
- Ouvrir la console DevTools
- Cliquer Start
- ✅ Attendu : log "WebSocket connected", pas d'erreur

### Test 3 : Audio arrive au backend
- Parler dans le micro
- Côté backend, logger la taille de chaque chunk reçu
- ✅ Attendu : logs continus, chunks ~3-6 KB chacun

### Test 4 : Google répond
- Continuer à parler
- Côté backend, logger chaque réponse de Google avant de l'envoyer au client
- ✅ Attendu : réponses régulières avec du texte non vide

### Test 5 : Affichage temps réel
- Regarder la page
- ✅ Attendu : texte apparaît dans la zone "interim" au fur et à mesure, puis migre en "final" à la fin d'une phrase

### Test 6 : Multilingue
- Cliquer Stop, cliquer Start
- Parler en italien : "Ciao, come stai oggi?"
- ✅ Attendu : le texte italien s'affiche, `language_code` = `it-IT` (ou proche)
- Répéter avec anglais, espagnol, arabe

### Test 7 : Robustesse
- Cliquer Stop en plein milieu d'une phrase → pas de crash backend
- Recharger la page → nouvelle connexion propre
- Laisser tourner en silence pendant 30 secondes → pas de crash

---

## 9. Erreurs probables et comment les diagnostiquer

| Symptôme | Cause probable | Solution |
|---|---|---|
| `PermissionDenied: 403` sur Google | Compte de service sans le bon rôle, ou API pas activée | Vérifier IAM + activer Speech-to-Text API |
| `InvalidArgument: 400 model chirp_3 not supported in region` | Mauvaise région | Passer sur `us-central1` |
| `NotFound: 404 recognizer not found` | Mauvais format de chemin recognizer | Vérifier que le path est bien `projects/{ID}/locations/{REGION}/recognizers/_` avec `_` final |
| Texte vide en retour de Google mais pas d'erreur | Problème de format audio (mauvais sample rate ou format) | Vérifier côté client que le downsampling produit bien 16kHz Int16 mono little-endian |
| Rien ne s'affiche à l'écran, mais backend reçoit bien de l'audio | Probablement `interim_results=False` ou WebSocket qui ne renvoie pas | Vérifier `interim_results=True` dans `StreamingRecognitionFeatures` |
| `Exceeded maximum allowed stream duration` | Session > 5 min | Normal, pas à gérer dans ce POC |
| Latence énorme (>3s) | Chunks trop gros ou downsampling qui bloque le thread audio | Vérifier taille chunk ~100ms, faire le downsampling léger |
| Chrome refuse le micro | Site pas en HTTPS ou pas en localhost | Utiliser `localhost` en dev, jamais un IP réseau sans HTTPS |

---

## 10. Ce qui est HORS PÉRIMÈTRE — Ne pas implémenter

- ❌ Traduction du texte (Gemini viendra plus tard)
- ❌ Extraction d'entités structurées
- ❌ Base de données / persistance
- ❌ Authentification utilisateur
- ❌ Multi-sessions parallèles (un seul client à la fois suffit)
- ❌ Speech adaptation (jargon métier) — sera ajouté plus tard
- ❌ Interface stylée / design travaillé — HTML brut suffit, une pincée de CSS pour lisibilité maximum
- ❌ Tests automatisés — les tests manuels de la section 8 suffisent
- ❌ Docker / déploiement
- ❌ Gestion de reconnexion automatique du WebSocket

**Règle d'or : si un truc n'est pas explicitement demandé ici, ne pas le faire.** Le POC doit être livrable en une session de code, pas en trois jours.

---

## 11. Livrables attendus

À la fin, le repo `poc-stt/` doit contenir exactement :
- `main.py`
- `stt_client.py` (peut être fusionné avec `main.py` si simple)
- `static/index.html` (autonome, tout inline : HTML + CSS + JS)
- `requirements.txt`
- `.env.example`
- `README.md`

Et être **lançable en 3 commandes** :

```bash
pip install -r requirements.txt
export GOOGLE_APPLICATION_CREDENTIALS=... GOOGLE_CLOUD_PROJECT=... GOOGLE_CLOUD_REGION=us-central1
uvicorn main:app --port 8000
```

Puis `open http://localhost:8000/` → ça marche.

---

## 12. Rappel final

**Une seule chose compte** : que je puisse parler dans mon micro dans plusieurs langues et voir le texte s'afficher en temps réel avec la langue détectée. Tout le reste est du bruit. En cas de doute sur un choix de design, choisir **l'option la plus simple qui fait passer les critères de succès de la section 0**.