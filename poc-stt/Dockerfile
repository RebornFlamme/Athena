# Backend STT — image portable (Cloud Run / Railway / Fly / Render en mode Docker).
# Render utilise plutôt le Blueprint `render.yaml` (runtime python), mais cette
# image permet un déploiement identique sur n'importe quel hébergeur conteneurs.
#
# Cloud Run (déjà sur GCP → pas de fichier clé, le service account fournit les creds) :
#   gcloud run deploy athena-stt --source poc-stt --region us-central1 --allow-unauthenticated
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# $PORT est injecté par l'hébergeur (Cloud Run 8080, Render 10000). Défaut local 8000.
ENV PORT=8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
