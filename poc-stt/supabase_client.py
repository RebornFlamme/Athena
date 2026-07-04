"""Client Supabase pour le job de transcription serveur.

Écrit les segments dans la table `transcriptions` via la clé **service_role**
(bypass RLS). Ces variables doivent être définies côté serveur (Render) :

    SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=eyJ...   (Project Settings → API → service_role, SECRÈTE)
"""

import logging
import os

from supabase import Client, create_client

logger = logging.getLogger("poc-stt.supabase")

_client: Client | None = None


def get_supabase() -> Client:
    """Retourne un client Supabase service_role (initialisé une fois).

    Raises:
        ValueError: si SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquent.
    """
    global _client
    if _client is not None:
        return _client

    url = os.getenv("SUPABASE_URL")
    key_prefix = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "")[:20]
    if not url:
        raise ValueError(
            "SUPABASE_URL n'est pas définie. "
            "Définissez-la dans l'environnement (Render → Environment)."
        )
    if not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        raise ValueError(
            "SUPABASE_SERVICE_ROLE_KEY n'est pas définie. "
            "Définissez-la dans l'environnement (Render → Environment)."
        )

    logger.info("Connexion Supabase : %s (clé service_role : %s...)", url, key_prefix)
    _client = create_client(url, os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    logger.info("Connexion Supabase OK")
    return _client
