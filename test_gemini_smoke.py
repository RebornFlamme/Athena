"""Smoke test : vérifie que GEMINI_API_KEY + google-genai marchent."""
import os
from dotenv import load_dotenv
from google import genai

load_dotenv(dotenv_path="poc-stt/.env")
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

response = client.models.generate_content(
    model="gemini-3.5-flash",
    contents="Réponds juste 'pong'.",
)
print("Réponse:", response.text)
