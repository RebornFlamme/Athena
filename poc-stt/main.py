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
import threading
import time
from pathlib import Path

from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from agent_job import run_agent
from stt_client import run_stt_stream
from supabase_client import get_supabase
from transcribe_job import transcribe_appel

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

# CORS : le front (Vercel, HTTPS) fait un POST cross-origin vers /transcribe.
# (Contrairement au WebSocket, un POST cross-origin est soumis au CORS.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pool de threads pour les jobs de transcription. Chaque job stream en TEMPS
# RÉEL sur toute la durée de son appel → pour que TOUS les appels soient
# transcrits simultanément (alignés sur la timeline de simulation) et non par
# vagues de 4, on dimensionne large (1 worker par appel + marge).
_transcribe_pool = ThreadPoolExecutor(max_workers=32)

# Pool SÉPARÉ pour les jobs agent LLM (un par appel). Distinct du pool STT : un job
# de transcription occupe son worker toute la durée réelle de l'appel (streaming),
# donc mutualiser les deux affamerait les agents. L'agent sonde `transcriptions` et
# écrit `object_instances` / `agent_journal` au fil de l'eau.
_agent_pool = ThreadPoolExecutor(max_workers=16)

# Suivi du run courant pour l'annuler proprement quand la simulation est relancée
# (« Revenir au début » / re-clic « Lancer ») : on stoppe les jobs en cours et on
# annule les timers encore en attente avant de replanifier.
_pending_timers: list[threading.Timer] = []
_stop_event = threading.Event()

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
    logger.info("WebSocket connecté")

    # Queues thread-safe locales à cette session (isolation entre sessions)
    audio_queue: queue.Queue = queue.Queue()   # bytes reçus du client
    result_queue: queue.Queue = queue.Queue()  # dicts à renvoyer au client
    loop = asyncio.get_running_loop()

    # ------------------------------------------------------------------
    # Tâche 1 : réception audio depuis le client WebSocket
    # ------------------------------------------------------------------
    async def receive_audio():
        """Lit les messages binaires du WebSocket et les pousse dans audio_queue."""
        try:
            while True:
                data = await websocket.receive_bytes()
                logger.debug("Chunk audio reçu : %d octets", len(data))
                await loop.run_in_executor(None, audio_queue.put, data)
        except WebSocketDisconnect:
            logger.info("WebSocket déconnecté — arrêt de la réception audio")
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
        asyncio.to_thread(run_stt_stream, audio_queue, result_queue),
    )

    logger.info("WebSocket fermé proprement")


# ---------------------------------------------------------------------------
# Job de transcription serveur : déclenché au lancement de la simulation
# ---------------------------------------------------------------------------
@app.post("/transcribe")
async def transcribe(payload: dict | None = None):
    """Lance la transcription (streaming live) des appels vers Supabase.

    « À chaque lancement » : supprime d'abord les transcriptions existantes des
    appels ciblés, puis relance un job par appel (pool de threads, non bloquant).
    Répond immédiatement — les segments arrivent ensuite via Realtime.

    Body optionnel : {"appel_ids": [...]}. Sans body → tous les appels.
    """
    sb = get_supabase()

    ids = (payload or {}).get("appel_ids")
    query = sb.table("appels").select("*")
    if ids:
        query = query.in_("id", ids)
    appels = query.execute().data or []

    # Annule le run précédent (relance / retour au début) : stoppe les jobs en
    # cours (via stop_event) et les timers encore en attente, puis repart neuf.
    global _stop_event
    _stop_event.set()
    for timer in _pending_timers:
        timer.cancel()
    _pending_timers.clear()
    _stop_event = threading.Event()
    stop = _stop_event

    appel_ids = [a["id"] for a in appels]
    if appel_ids:
        # Recalcul : on repart d'une ardoise vierge pour ces appels (transcriptions
        # + tout ce que l'agent avait produit : instances d'objets et journal).
        sb.table("transcriptions").delete().in_("appel_id", appel_ids).execute()
        sb.table("agent_journal").delete().in_("appel_id", appel_ids).execute()
        sb.table("object_instances").delete().in_("appel_id", appel_ids).execute()

    # Planification PROGRESSIVE : chaque appel est transcrit à l'instant où il
    # devient actif sur la timeline (délai = ts_debut_ms normalisé sur le plus
    # précoce), en phase avec la lecture audio du navigateur. Un `Timer` léger
    # diffère la soumission → le pool ne réserve un worker qu'au démarrage réel du
    # job, et la charge (mémoire/CPU/streams Google) s'étale au lieu d'exploser
    # d'un coup au lancement.
    # Deux jobs par appel, planifiés au même instant : la transcription (streaming
    # STT → `transcriptions`) et l'agent sémantique (lit `transcriptions` → écrit
    # `object_instances`/`agent_journal`). Ils démarrent ensemble → l'agent sonde
    # les segments dès qu'ils tombent.
    jobs = ((_transcribe_pool, transcribe_appel), (_agent_pool, run_agent))
    min_ts = min((a.get("ts_debut_ms") or 0) for a in appels) if appels else 0
    for appel in appels:
        delai_s = max(0, (appel.get("ts_debut_ms") or 0) - min_ts) / 1000
        for pool, fn in jobs:
            if delai_s <= 0:
                pool.submit(fn, appel, stop)
            else:
                timer = threading.Timer(delai_s, pool.submit, args=(fn, appel, stop))
                timer.daemon = True
                _pending_timers.append(timer)
                timer.start()

    logger.info("Transcription + agent planifiés pour %d appel(s)", len(appels))
    return {"status": "scheduled", "count": len(appels)}


# ---------------------------------------------------------------------------
# Arrêt de la simulation : coupe les jobs serveur en cours
# ---------------------------------------------------------------------------
@app.post("/stop")
async def stop_simulation():
    """Coupe le run courant : stoppe les jobs en cours (transcription + agents) et
    annule les timers encore en attente.

    Appelé quand l'utilisateur coupe la simulation (« Couper »). Sans ça, les jobs
    serveur continueraient de tourner jusqu'à leur fin naturelle même après l'arrêt
    de la lecture navigateur. `_stop_event` est vu par les feeders de transcription
    et par la boucle des agents (`stop_event.is_set()`).
    """
    global _stop_event
    _stop_event.set()
    for timer in _pending_timers:
        timer.cancel()
    _pending_timers.clear()

    # Vide le cache du run : transcriptions + trace/edits de l'agent + instances.
    # Ainsi la prochaine simulation repart d'une ardoise vierge et l'UI se vide
    # tout de suite (le front écoute aussi un resetToken). Ces tables ne
    # contiennent QUE des données de simulation → purge totale (filtre trivial
    # `cree_le >= epoch` car un delete PostgREST exige un filtre).
    sb = get_supabase()
    for table in ("transcriptions", "agent_journal", "object_instances"):
        try:
            sb.table(table).delete().gte("cree_le", "1970-01-01T00:00:00Z").execute()
        except Exception as exc:  # noqa: BLE001
            logger.error("Purge %s au stop KO : %s", table, exc)

    logger.info("Simulation coupée — jobs arrêtés + cache vidé (3 tables)")
    return {"status": "stopped"}


# ---------------------------------------------------------------------------
# Fichiers statiques
# ---------------------------------------------------------------------------
# Montés APRÈS les routes pour que /health, /ws et /upload soient prioritaires.
app.mount("/data", StaticFiles(directory="data"), name="data")
app.mount("/", StaticFiles(directory="static", html=True), name="static")
