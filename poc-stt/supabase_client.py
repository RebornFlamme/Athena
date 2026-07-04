"""Client Supabase pour le job de transcription serveur.

Écrit les segments dans la table `transcriptions` via la clé **service_role**
(bypass RLS). Ces variables doivent être définies côté serveur (Render) :

    SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=eyJ...   (Project Settings → API → service_role, SECRÈTE)
"""

import os

from supabase import Client, create_client

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
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError(
            "SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis "
            "(Render → Environment) pour le job de transcription."
        )

    _client = create_client(url, key)
    return _client
