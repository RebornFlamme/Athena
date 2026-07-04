"""
config.py — Settings via pydantic-settings.

Toutes les variables d'environnement nécessaires au module memory_agent.
Chargement depuis un fichier .env (si présent) + override par l'environnement.
"""

import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration centralisée du memory_agent.

    Les variables sont lues depuis l'environnement ou un fichier .env.
    Préfixe commun : MEMORY_AGENT_ pour les réglages propres à l'agent.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Supabase ──────────────────────────────────────────────────────
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_project_ref: str = ""
    supabase_access_token: str = ""

    # ── Google / Gemini ───────────────────────────────────────────────
    google_api_key: str = ""

    # ── Agent settings ────────────────────────────────────────────────
    memory_agent_model: str = "gemini-3.5-flash"
    memory_agent_log_level: str = "INFO"

    # ── Propriétés calculées ──────────────────────────────────────────

    @property
    def mcp_server_url(self) -> str:
        """URL du serveur MCP Supabase hosté (HTTP, pas npx local).

        Format: https://mcp.supabase.com/mcp?project_ref=<PROJECT_REF>
        Doc: https://supabase.com/docs/guides/ai-tools/mcp
        """
        if not self.supabase_project_ref:
            raise ValueError(
                "SUPABASE_PROJECT_REF must be set to construct the MCP server URL. "
                "Find it in your Supabase dashboard: Project Settings > General > Reference ID."
            )
        return f"https://mcp.supabase.com/mcp?project_ref={self.supabase_project_ref}"

    @property
    def is_configured(self) -> bool:
        """True si toutes les variables critiques sont renseignées."""
        return all([
            self.supabase_url,
            self.supabase_anon_key,
            self.supabase_project_ref,
            self.supabase_access_token,
            self.google_api_key,
        ])


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Retourne le singleton Settings (caché)."""
    return Settings()


# Singleton importable directement
settings = get_settings()
