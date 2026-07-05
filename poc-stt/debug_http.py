"""Dernier test : HTTP direct avec la clé AQ en query param."""
import os, json, urllib.request
from dotenv import load_dotenv
load_dotenv()
key = os.getenv("GEMINI_API_KEY")

url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
body = {"contents": [{"parts": [{"text": "Say hi"}]}]}

# Test : API key en query string
print("=== Test HTTP direct (?key=...) ===")
req = urllib.request.Request(
    f"{url}?key={key}",
    data=json.dumps(body).encode(),
    headers={"Content-Type": "application/json"},
)
try:
    resp = urllib.request.urlopen(req)
    print(f"✅ Ça marche ! Statut: {resp.status}")
    data = json.loads(resp.read())
    print(f"Réponse: {data['candidates'][0]['content']['parts'][0]['text']}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"❌ HTTP {e.code}")
    print(f"Réponse: {body[:300]}")
