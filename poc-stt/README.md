# POC STT — Transcription Live avec Google Chirp 3

Preuve de concept : capture audio micro → streaming WebSocket → Google Speech-to-Text V2 (Chirp 3) → affichage temps réel multilingue.

## Prérequis Google Cloud

1. **Projet GCP** avec facturation activée (Chirp 3 n'est pas gratuit).
2. **API Cloud Speech-to-Text** activée : https://console.cloud.google.com/apis/library/speech.googleapis.com
3. **Compte de service** avec le rôle `roles/speech.editor` (ou `roles/speech.client`).
4. **Clé JSON** du compte de service téléchargée localement.

## Installation

```bash
cd poc-stt/
pip install -r requirements.txt
```

## Lancement

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/chemin/vers/la-cle.json
export GOOGLE_CLOUD_PROJECT=votre-gcp-project-id
export GOOGLE_CLOUD_REGION=us-central1

uvicorn main:app --port 8000
```

Puis ouvrir **http://localhost:8000/** dans Chrome (⚠ Safari peut avoir des soucis avec Web Audio).

Cliquer **Start**, autoriser le micro, parler.

## Tests manuels (section 8 du cahier des charges)

| # | Test | Vérification attendue |
|---|------|-----------------------|
| 1 | `curl http://localhost:8000/health` | `{"status":"ok"}` |
| 2 | Ouvrir la page → Start → console DevTools | Log "WebSocket connected", pas d'erreur |
| 3 | Parler → logs backend | Chunks audio ~2-3 KB reçus en continu |
| 4 | Parler → logs backend | Réponses Google avec texte non vide |
| 5 | Regarder la page en parlant | Texte interim qui bouge puis se fige en final |
| 6 | Parler en italien, anglais, arabe | Transcription dans la langue + code langue détecté |
| 7 | Stop en milieu de phrase → recharger → silence 30s | Pas de crash backend, reconnexion propre |

## Protocole WebSocket

- **Client → Serveur** : messages binaires (chunks audio LINEAR16, 16 kHz, mono, Int16 little-endian)
- **Serveur → Client** : messages JSON

```json
{
  "type": "transcript",
  "text": "bonjour comment ça va",
  "is_final": false,
  "language_code": "fr-FR"
}
```

Erreur :
```json
{
  "type": "error",
  "message": "description lisible"
}
```

## Architecture

```
Navigateur (Web Audio API) ──binary audio──▶ FastAPI /ws ──gRPC streaming──▶ Google Chirp 3
                        ◀──JSON results───            ◀──responses────────
```

## Troubleshooting

| Symptôme | Cause probable | Solution |
|----------|---------------|----------|
| `PermissionDenied: 403` | Compte de service sans le bon rôle ou API non activée | Vérifier IAM + activer l'API Speech-to-Text |
| `InvalidArgument: 400 model chirp_3 not supported in region` | Mauvaise région | Utiliser `us` (multi-région) |
| `NotFound: 404 recognizer not found` | Chemin du recognizer incorrect | Vérifier le format `projects/{ID}/locations/{REGION}/recognizers/_` |
| Texte vide retourné par Google | Format audio incorrect (sample rate, encodage) | Vérifier le downsampling 16 kHz Int16 mono |
| Rien à l'écran mais backend reçoit l'audio | `interim_results` désactivé | Vérifier `interim_results=True` dans `StreamingRecognitionFeatures` |
| `Exceeded maximum allowed stream duration` | Session > 5 min | Normal, pas géré dans ce POC |
| Latence > 3s | Chunks audio trop gros ou downsampling lent | Vérifier ~100ms par chunk |
| Chrome refuse le micro | Site pas en HTTPS ni localhost | Utiliser `localhost`, jamais une IP sans HTTPS |
| `ModuleNotFoundError: No module named 'google.cloud'` | Dépendance manquante | `pip install google-cloud-speech>=2.27.0` |
| Safari : pas d'audio | Safari suspend l'AudioContext | Utiliser Chrome pour ce POC |

## Limites Google connues

- **Taille max par message** : 25 KB → chunks de ~100 ms à 16 kHz LINEAR16 = ~3.2 KB ✅
- **Durée max d'un stream** : ~5 minutes (quota Google, pas géré dans ce POC)
- **Premier message** : doit contenir uniquement la config, pas d'audio
- **Ordre** : config d'abord, audio ensuite — ne pas mélanger

## Hors périmètre

Ce POC ne couvre pas : traduction, extraction d'entités, base de données, auth, multi-sessions, speech adaptation, design UI avancé, tests automatisés, Docker, reconnexion automatique.
