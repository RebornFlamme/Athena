"""
POC STT Live Streaming — Backend FastAPI.

Relais WebSocket entre le navigateur (audio micro ou fichier) et Google
Speech-to-Text V2 (modèle chirp_3). Pas de diarization — l'API V2 ne la
supporte pas en mode StreamingRecognize.

Lancer avec :
    uvicorn main:app --port 8000
"""

import asyncio
import logging
import os
import queue
import time
from pathlib import Path

from fastapi import FastAPI, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from stt_client import run_stt_stream

# Charger .env si présent (pratique en dev local)
load_dotenv()

# ---------------------------------------------------------------------------
# Configuration du logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("poc-stt")

# ---------------------------------------------------------------------------
# Application FastAPI
# ---------------------------------------------------------------------------
app = FastAPI(title="POC STT Chirp 3", version="0.2.0")

# S'assurer que le dossier data/ existe
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    """Endpoint de santé — retourne 200 si le serveur tourne."""
    return {"status": "ok"}


ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".webm"}


# ---------------------------------------------------------------------------
# Upload de fichier audio
# ---------------------------------------------------------------------------
@app.post("/upload")
async def upload_audio(file: UploadFile):
    """Reçoit un fichier audio et le sauvegarde dans data/."""
    if not file.filename:
        return {"status": "error", "message": "No filename provided"}

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        return {"status": "error", "message": f"Unsupported format: {ext}"}

    safe_name = os.path.basename(file.filename)
    dest = os.path.join(DATA_DIR, safe_name)

    # Gestion des collisions : ajouter un timestamp si le fichier existe déjà
    if os.path.exists(dest):
        stem = Path(safe_name).stem
        dest = os.path.join(DATA_DIR, f"{stem}_{int(time.time())}{ext}")
        safe_name = os.path.basename(dest)

    contents = await file.read()
    with open(dest, "wb") as f:
        f.write(contents)

    logger.info("Fichier uploadé : %s (%d octets)", safe_name, len(contents))
    return {
        "status": "ok",
        "filename": safe_name,
        "size": len(contents),
        "url": f"/data/{safe_name}",
    }


# ---------------------------------------------------------------------------
# Liste des fichiers audio uploadés
# ---------------------------------------------------------------------------
@app.get("/audio-files")
async def list_audio_files():
    """Liste les fichiers audio présents dans data/, triés par date (plus récent d'abord)."""
    files = []
    for f in sorted(Path(DATA_DIR).iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if f.is_file() and f.suffix.lower() in ALLOWED_AUDIO_EXTENSIONS:
            files.append({
                "filename": f.name,
                "size": f.stat().st_size,
                "url": f"/data/{f.name}",
            })
    return {"files": files}


# ---------------------------------------------------------------------------
# WebSocket : relais audio → Google STT (single endpoint, diarization native)
# ---------------------------------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Endpoint WebSocket unique pour le streaming audio (micro ou fichier).

    La diarization (distinction des locuteurs) est gérée nativement par
    Google Speech-to-Text V2 via SpeakerDiarizationConfig. Chaque résultat
    contient un champ `speaker_tag` (int) extrait des `speaker_label` par mot.
    Aucun paramètre manuel de speaker_id — c'est Google qui distingue
    automatiquement les voix dans le flux audio.
    """
    await websocket.accept()

    # Extraire la langue du query param (levier 1)
    language = websocket.query_params.get("language", "auto")
    logger.info("WebSocket connecté — langue=%s", language)

    # Queues thread-safe locales à cette session (isolation entre sessions)
    audio_queue: queue.Queue = queue.Queue()   # bytes reçus du client
    result_queue: queue.Queue = queue.Queue()  # dicts à renvoyer au client
    loop = asyncio.get_running_loop()

    # ------------------------------------------------------------------
    # Tâche 1 : réception audio depuis le client WebSocket
    # ------------------------------------------------------------------
    async def receive_audio():
        """Lit les messages binaires du WebSocket et les pousse dans audio_queue."""
        chunk_count = 0
        total_bytes = 0
        try:
            while True:
                data = await websocket.receive_bytes()
                chunk_count += 1
                total_bytes += len(data)
                # Log périodique toutes les ~50 chunks (~6s) pour vérifier la taille
                if chunk_count % 50 == 1:
                    avg_size = total_bytes / chunk_count
                    logger.info(
                        "Chunk audio #%d : %d octets (moyenne: %d, cible: 3200-6400)",
                        chunk_count, len(data), int(avg_size),
                    )
                else:
                    logger.debug("Chunk audio reçu : %d octets", len(data))
                await loop.run_in_executor(None, audio_queue.put, data)
        except WebSocketDisconnect:
            logger.info(
                "WebSocket déconnecté — %d chunks reçus, %d octets au total, "
                "moyenne %d octets/chunk",
                chunk_count, total_bytes,
                total_bytes // max(chunk_count, 1),
            )
            await loop.run_in_executor(None, audio_queue.put, None)

    # ------------------------------------------------------------------
    # Tâche 2 : envoi des résultats Google vers le client WebSocket
    # ------------------------------------------------------------------
    async def send_results():
        """Lit result_queue et envoie chaque dict en JSON au client."""
        try:
            while True:
                result = await loop.run_in_executor(None, result_queue.get)
                if result is None:
                    logger.info("Fin du flux de résultats")
                    break
                await websocket.send_json(result)
        except WebSocketDisconnect:
            logger.info("WebSocket déconnecté pendant l'envoi")

    # ------------------------------------------------------------------
    # Tâche 3 : streaming Google STT (bloquant → exécuté dans un thread)
    # ------------------------------------------------------------------
    await asyncio.gather(
        receive_audio(),
        send_results(),
        asyncio.to_thread(run_stt_stream, audio_queue, result_queue, language),
    )

    logger.info("WebSocket fermé proprement")


# ---------------------------------------------------------------------------
# Fichiers statiques
# ---------------------------------------------------------------------------
# Montés APRÈS les routes pour que /health, /ws et /upload soient prioritaires.
app.mount("/data", StaticFiles(directory="data"), name="data")
app.mount("/", StaticFiles(directory="static", html=True), name="static")
