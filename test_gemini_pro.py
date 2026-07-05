"""Test rapide : gemini-3.1-pro-preview."""
import os
from dotenv import load_dotenv
from google import genai

load_dotenv(dotenv_path="poc-stt/.env")
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

print("Test gemini-3.1-pro-preview...")
response = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents="Réponds juste 'pong'.",
)
print("Réponse:", response.text)
