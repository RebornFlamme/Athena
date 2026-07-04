"""Géocodage via la Géoplateforme IGN (data.geopf.fr) — API publique, sans clé.

Portage serveur de `frontend/src/data/geocodageIgn.ts`. Utilisé comme outil par
l'extraction LLM : Claude géocode une adresse avant de positionner une entité.
Règle produit : l'IA propose, l'humain valide — un score < SEUIL_FIABLE signale
une adresse « à confirmer ».
"""

import json
import logging
import urllib.parse
import urllib.request

logger = logging.getLogger("poc-stt.geocodage")

SEUIL_FIABLE = 0.8


def geocoder(adresse: str) -> dict | None:
    """Géocode une adresse en coordonnées lon/lat.

    Returns:
        {lon, lat, score, label, fiable} pour le meilleur résultat, ou None si
        introuvable.
    """
    logger.info("Géocodage IGN : « %s »", adresse)
    params = urllib.parse.urlencode({"q": adresse, "index": "address", "limit": "1"})
    url = f"https://data.geopf.fr/geocodage/search?{params}"

    try:
        with urllib.request.urlopen(url, timeout=15) as resp:  # noqa: S310 (API IGN publique)
            data = json.loads(resp.read())
    except Exception as exc:  # noqa: BLE001
        logger.error("Géocodage IGN échoué (réseau/API) : %s", exc)
        raise

    feature = (data.get("features") or [None])[0]
    coords = (feature or {}).get("geometry", {}).get("coordinates")
    if not feature or not coords:
        logger.info("Géocodage IGN : « %s » → introuvable", adresse)
        return None

    props = feature.get("properties", {})
    score = props.get("score", 0) or 0
    result = {
        "lon": coords[0],
        "lat": coords[1],
        "score": score,
        "label": props.get("label", adresse),
        "fiable": score >= SEUIL_FIABLE,
    }
    logger.info("Géocodage IGN : « %s » → %s (score=%.2f, fiable=%s)",
                adresse, result["label"], score, result["fiable"])
    return result
