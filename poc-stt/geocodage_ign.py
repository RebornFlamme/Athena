"""Géocodage via la Géoplateforme IGN (data.geopf.fr) — API publique, sans clé.

Portage serveur de `frontend/src/data/geocodageIgn.ts`. Utilisé comme outil par
l'extraction LLM : Claude géocode une adresse avant de positionner une entité.
Règle produit : l'IA propose, l'humain valide — un score < SEUIL_FIABLE signale
une adresse « à confirmer ».
"""

import json
import urllib.parse
import urllib.request

SEUIL_FIABLE = 0.8


def geocoder(adresse: str) -> dict | None:
    """Géocode une adresse en coordonnées lon/lat.

    Returns:
        {lon, lat, score, label, fiable} pour le meilleur résultat, ou None si
        introuvable.
    """
    params = urllib.parse.urlencode({"q": adresse, "index": "address", "limit": "1"})
    url = f"https://data.geopf.fr/geocodage/search?{params}"

    with urllib.request.urlopen(url, timeout=15) as resp:  # noqa: S310 (API IGN publique)
        data = json.loads(resp.read())

    feature = (data.get("features") or [None])[0]
    coords = (feature or {}).get("geometry", {}).get("coordinates")
    if not feature or not coords:
        return None

    props = feature.get("properties", {})
    score = props.get("score", 0) or 0
    return {
        "lon": coords[0],
        "lat": coords[1],
        "score": score,
        "label": props.get("label", adresse),
        "fiable": score >= SEUIL_FIABLE,
    }
