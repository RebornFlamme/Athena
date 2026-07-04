# POC STT Chirp 3 — Résumé technique complet

> **Dernière mise à jour :** 2026-07-04
> **Version :** 0.3.0 (leviers qualité 1, 2, 3 intégrés)

---

## 1. Objectif

Preuve de concept de transcription live multilingue : capture audio (micro ou fichier) → streaming WebSocket → Google Speech-to-Text V2 (modèle **Chirp 3**) → affichage temps réel dans le navigateur avec :

- Feedback immédiat (interim results)
- Détection automatique de la langue
- Voice Activity Detection (indicateur visuel de parole)
- Découpage automatique en « utterances » (segments prêts pour un futur LLM)
- Sélection manuelle de la langue pour gagner 5-15% de précision (WER)

---

## 2. Architecture

```
┌─────────────────────────────────┐       WebSocket /ws?language=fr-FR
│  Navigateur (index.html)        │◄────── binary audio (Int16 16kHz) ───────►
│                                 │       JSON results                          │
│  Mode Micro :                   │                                          ┌──────────────────────────────┐
│   getUserMedia → AudioContext   │                                          │  FastAPI backend (main.py)   │
│   → ScriptProcessorNode         │                                          │                              │
│   → downsampling 48k→16k       │                                          │  /ws  ──┬── receive_audio   │
│   → Float32→Int16              │                                          │        ├── send_results    │
│                                 │                                          │        └── run_stt_stream ──┼──┐
│  Mode Fichier :                 │                                          │            (thread séparé)   │  │
│   Upload → decodeAudioData     │                                          │                              │  │
│   → setInterval chunks          │                                          │  /upload   (POST multipart)  │  │
│   → downsampling               │                                          │  /audio-files (GET)          │  │
│                                 │                                          │  /health (GET)               │  │
│  Affichage :                    │                                          │  StaticFiles: data/, static/ │  │
│   #interim (provisoire)        │                                          └──────────────────────────────┘  │
│   #final   (définitif)         │                                                                          │
│   ¶ séparateur d'utterance     │                                                               gRPC streaming │
│   dot pulsant VAD              │                                                                          │
│   dropdown langue              │                                          ┌──────────────────────────────┘
└─────────────────────────────────┘                                          │  Google Speech-to-Text V2
                                                                            │  modèle chirp_3
                                                                            │  LINEAR16 16kHz mono
                                                                            │  interim_results + VAD events
                                                                            │  auto-detect ou langue forcée
                                                                            └───────────────────────────────
```

---

## 3. Fichiers — Rôle détaillé

### 3.1 `main.py` (200 lignes) — Serveur FastAPI

**3 endpoints + static files :**

| Route | Méthode | Rôle |
|-------|---------|------|
| `/health` | GET | Health check → `{"status": "ok"}` |
| `/upload` | POST | Upload fichier audio (multipart). Valide l'extension, sauvegarde dans `data/`, gère les collisions (timestamp). |
| `/audio-files` | GET | Liste les fichiers dans `data/`, triés par date décroissante. |
| `/ws?language=fr-FR` | WebSocket | Relais audio bidirectionnel. Query param `language` (défaut `auto`). |

**Architecture interne du WebSocket :**

3 tâches asyncio exécutées en parallèle via `asyncio.gather()` :

1. **`receive_audio()`** — lit les messages binaires du navigateur → `audio_queue` (queue.Queue thread-safe). Log périodique (taille des chunks, moyenne). Au `WebSocketDisconnect`, pousse `None` pour signaler la fin.

2. **`send_results()`** — lit `result_queue` → `websocket.send_json()`. S'arrête quand elle reçoit `None`.

3. **`run_stt_stream()`** — exécutée dans un thread séparé via `asyncio.to_thread()`. Bloquante (gRPC streaming). Reçoit `language` en paramètre.

Les queues sont **locales à chaque session** → isolation entre connexions simultanées.

---

### 3.2 `stt_client.py` (349 lignes) — Client Google STT V2

**Fonctions :**

#### `get_client()` → SpeechClient
Singleton. Initialise un `SpeechClient` pointant vers l'endpoint régional (`{REGION}-speech.googleapis.com`). La région est configurable via `GOOGLE_CLOUD_REGION` (défaut `us`).

#### `build_stt_config(language_code="auto")` → StreamingRecognizeRequest
Construit la configuration de reconnaissance :

| Paramètre | Valeur | Note |
|-----------|--------|------|
| `encoding` | `LINEAR16` | PCM 16-bit signé |
| `sample_rate_hertz` | `16000` | 16 kHz |
| `audio_channel_count` | `1` | Mono |
| `language_codes` | `["auto"]` ou `["fr-FR"]` | Selon le paramètre `language_code` |
| `model` | `"chirp_3"` | Modèle multilingue Google |
| `enable_automatic_punctuation` | `True` | Ponctuation automatique |
| `interim_results` | `True` | Feedback temps réel |
| `enable_voice_activity_events` | `True` | Événements début/fin de parole |

**Features désactivées** (non supportées par l'API V2 en mode StreamingRecognize) :
- `SpeakerDiarizationConfig` → erreur 400, code commenté
- `SpeechAdaptation` → erreur 404, code commenté

#### `run_stt_stream(audio_queue, result_queue, language_code="auto")`
La boucle de streaming, exécutée dans un thread. Logique en 3 phases :

1. **Générateur `request_generator()`** : yield la config puis les chunks audio piochés dans `audio_queue`. S'arrête sur `None`.

2. **Boucle de réponse `for response in responses:`** :
   - **VAD events** (`response.speech_event`) → pousse `{"type": "speech_event", "event": "speech_begin"|"speech_end"}` dans `result_queue`. Utilisé **uniquement** pour l'affichage visuel (dot pulsant).
   - **Transcripts** (`response.results`) → pour chaque alternative :
     - Extrait `language_code` (résultat puis alternative, fallback `"unknown"`)
     - Pousse `{"type": "transcript", "text": ..., "is_final": bool, "language_code": ...}`
     - Si `is_final: true` et texte non vide → ajoute au buffer d'utterance **et reset le timer de silence de 2.5s**

3. **Buffer d'utterance (Levier 3)** :
   - Accumule les `is_final: true` dans `utterance_buffer`
   - Chaque nouveau final **reset** un `threading.Timer(2.5s, _flush_utterance)`
   - Si 2.5s s'écoulent sans nouveau final → flush : pousse `{"type": "utterance", "text": "...", "language_code": "..."}`, vide le buffer
   - Thread-safe : protégé par `threading.Lock`
   - Flush final en fin de stream normale

---

### 3.3 `static/index.html` (1164 lignes) — Frontend vanilla

**Deux modes :**

#### Mode Microphone
1. `getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })`
2. `AudioContext` → `createMediaStreamSource` → `createScriptProcessor(8192, 1, 1)`
   - Buffer = 8192 samples (puissance de 2 obligatoire, ~171ms à 48kHz)
3. Callback `onaudioprocess` :
   - Détection de gain faible (pic < 0.1 → amplification ×4 avec clamp)
   - Downsampling 48kHz→16kHz (ratio 3:1, moyenne glissante anti-aliasing)
   - Conversion Float32→Int16 little-endian
   - Envoi binaire via WebSocket (si `ws.readyState === OPEN`)
4. Graphe audio : `source → scriptProcessor → destination` (destination = silencieuse car buffer vide)

#### Mode Fichier
1. Upload drag & drop ou sélecteur vers `POST /upload`
2. Liste des fichiers via `GET /audio-files`
3. Lecture : `fetch` → `decodeAudioData` → `createBufferSource` (audible) + `setInterval(sendAudioChunk, 140ms)` (STT)
4. Contrôles : Play/Pause/Stop, barre de progression avec seek
5. Chunks de 140ms → ~4480 octets à 16kHz Int16 (cible 3200-6400)

#### Affichage
- **`#interim`** : texte provisoire (`is_final: false`), gris italique, coloré selon `speaker_tag`
- **`#final`** : accumulation des segments définitifs (`is_final: true`), préfixés `[Speaker N]`
- **Badge langue** : affiche le code langue détecté (`fr-FR`, `en-US`, …)
- **Séparateur `¶`** : inséré à chaque fin d'utterance (levier 3)
- **Dot pulsant** : animation CSS `pulse-dot` quand VAD détecte de la parole (levier 2)

#### Dropdown langue (Levier 1)
```html
<select id="languageSelect">
  auto, fr-FR, en-US, it-IT, es-ES, de-DE, ar-SA
</select>
```
- Passé en query param : `/ws?language=fr-FR`
- Changement à chaud : ferme le WebSocket, rouvre avec la nouvelle langue (le micro reste actif)

#### Palette speaker (prête pour la diarization, non active)
| speaker_tag | Couleur | Hex |
|-------------|---------|-----|
| 1 | Bleu | `#60a5fa` |
| 2 | Orange | `#fb923c` |
| 3 | Vert | `#4ade80` |
| 4 | Violet | `#c084fc` |
| 5 | Rose | `#f472b6` |
| 6 | Cyan | `#22d3ee` |
| null | Gris | `#9ca3af` |

---

## 4. Protocole WebSocket

### Client → Serveur
- **Binary** uniquement : chunks audio LINEAR16, 16 kHz, mono, Int16 little-endian
- Aucun message JSON du client vers le serveur

### Serveur → Client
Tous les messages sont JSON. Types supportés :

```json
// Transcription temps réel (existant)
{
  "type": "transcript",
  "text": "bonjour comment ça va",
  "is_final": false,
  "language_code": "fr-FR"
}

// Événement VAD — levier 2 (nouveau)
{
  "type": "speech_event",
  "event": "speech_begin"
}
{
  "type": "speech_event",
  "event": "speech_end"
}

// Utterance complète — levier 3 (nouveau)
{
  "type": "utterance",
  "text": "phrase complète accumulée après 2.5s de silence",
  "language_code": "fr-FR"
}

// Erreur (existant)
{
  "type": "error",
  "message": "description lisible"
}
```

---

## 5. Les 3 leviers de qualité (implémentés)

### Levier 1 — Forçage de langue (gain WER : 5-15%)
- **Dropdown** dans l'UI avec 7 options (auto + 6 langues)
- **Query param** `?language=fr-FR` sur le WebSocket
- **Backend** : `build_stt_config(language_code)` utilise `["fr-FR"]` au lieu de `["auto"]`
- **Changement à chaud** : reconnexion WebSocket sans couper le micro

### Levier 2 — Voice Activity Detection (VAD)
- **Config** : `enable_voice_activity_events=True` (supporté en streaming, contrairement à la diarization)
- **Événements** : `SPEECH_ACTIVITY_BEGIN` / `SPEECH_ACTIVITY_END`
- **Frontend** : animation CSS `pulse-dot` sur le dot vert quand l'utilisateur parle
- **Périmètre** : purement visuel — le VAD ne pilote **pas** le flush d'utterance

### Levier 3 — Buffering d'utterance (préparation pipeline LLM)
- **Buffer** : accumule les `is_final: true` dans `utterance_buffer`
- **Timer** : 2.5s de silence entre deux segments finaux → flush
- **Thread-safe** : `threading.Lock` autour du buffer
- **Frontend** : log console `[UTTERANCE] ✅` + séparateur `¶` dans le texte final
- **Prêt pour F3** : `TODO(F3)` dans le code — envoyer `data.text` + contexte glissant → LLM

---

## 6. Points clés de conception

### Pourquoi `ScriptProcessorNode` (déprécié) plutôt qu'`AudioWorkletNode` ?
- Suffisant pour un POC, supporté partout (Chrome, Firefox, Safari)
- `AudioWorkletNode` nécessite un fichier séparé + build — complexité inutile à ce stade
- Buffer = 8192 (puissance de 2 obligatoire, ~171ms de latence acceptable)

### Pourquoi le flush d'utterance est sur `is_final: true` et pas sur les événements VAD ?
Le VAD (Google) et les segments finaux (Google) ne sont pas parfaitement synchronisés. Un `SPEECH_ACTIVITY_END` peut arriver avant ou après le dernier `is_final: true`. En se basant uniquement sur les finaux, on garantit que l'utterance contient tout le texte validé, sans dépendre d'événements qui peuvent être manquants pour certaines langues (ex: bug connu avec `ja-JP`).

### Pourquoi `threading.Timer` plutôt qu'`asyncio.sleep` ?
`run_stt_stream` est exécutée dans un thread (pas une coroutine). `threading.Timer` est le mécanisme naturel pour planifier un callback différé dans ce contexte. Le callback `_flush_utterance` écrit dans `result_queue` (thread-safe).

### Pourquoi des queues locales à la session ?
Si deux onglets se connectent simultanément, ils ne doivent pas partager leurs flux audio ni leurs résultats. Chaque appel à `websocket_endpoint` crée ses propres `audio_queue` et `result_queue`.

---

## 7. Limitations connues

| Limitation | Cause | Impact |
|------------|-------|--------|
| Diarization indisponible | API V2 : pas de `SpeakerDiarizationConfig` en streaming (erreur 400) | Pas de distinction automatique des locuteurs |
| Speech Adaptation indisponible | API V2 : pas de `SpeechAdaptation` en streaming (erreur 404) | Pas de boost du vocabulaire métier pompier |
| Durée max d'un stream | ~5 minutes (quota Google) | Non géré dans ce POC |
| `ScriptProcessorNode` déprécié | API Web Audio legacy | À migrer vers `AudioWorkletNode` en prod |
| Pas de reconnexion automatique | Hors scope POC | L'utilisateur doit recliquer Start |
| Pas d'auth | Ouvert à tous | À durcir avant prod |
| Pas de persistance | Pas de DB | Les transcriptions sont volatiles |

---

## 8. Lancement

```bash
cd poc-stt/
pip install -r requirements.txt

export GOOGLE_APPLICATION_CREDENTIALS=/chemin/vers/la-cle.json
export GOOGLE_CLOUD_PROJECT=votre-project-id
export GOOGLE_CLOUD_REGION=us

uvicorn main:app --port 8000
```

Puis ouvrir **http://localhost:8000/** (Chrome recommandé — Safari peut suspendre l'AudioContext).

---

## 9. Dépendances

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
google-cloud-speech>=2.27.0
python-dotenv>=1.0.0
python-multipart>=0.0.9
```

---

## 10. Roadmap — Leviers 4 & 5 (F3)

### Levier 4 — Double-passage (correction rétrospective)
Après chaque utterance, envoyer le buffer audio de cette utterance à `client.recognize()` (batch, non-streaming) pour obtenir une transcription plus précise (le modèle batch a tout le contexte de la phrase). Remplacer le texte de l'utterance par le résultat batch.

**Point d'insertion :** `_flush_utterance()` dans `stt_client.py` — le buffer audio de l'utterance n'est pas encore conservé, il faudrait l'accumuler en parallèle du buffer texte.

### Levier 5 — Contexte glissant LLM
Quand une utterance est émise, l'envoyer au LLM avec les 2-3 utterances précédentes comme contexte historique. Permet la résolution d'ambiguïtés, les coréférences, et la détection de contradictions.

**Point d'insertion :** handler `utterance` dans `index.html` (`TODO(F3)`), ou directement dans `_flush_utterance()` côté backend.

---

## 11. Glossaire

| Terme | Définition |
|-------|------------|
| **STT** | Speech-to-Text |
| **WER** | Word Error Rate — taux d'erreur par mot |
| **VAD** | Voice Activity Detection — détection de début/fin de parole |
| **utterance** | Prise de parole cohérente, délimitée par 2.5s de silence |
| **interim** | Résultat partiel, encore susceptible d'être corrigé par Google |
| **final** | Résultat définitif, ne changera plus |
| **diarization** | Distinction automatique des locuteurs dans un flux audio |
| **LINEAR16** | PCM 16-bit signé, encodage audio brut |
| **chirp_3** | Modèle STT multilingue de Google (V2) |
| **BCP-47** | Standard de codes langue (ex: `fr-FR`, `en-US`) |
