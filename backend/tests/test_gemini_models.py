"""Smoke tests des deux modèles Gemini.

Exécute chaque test l'un après l'autre et affiche un résumé.
Chaque test est isolé : un échec n'empêche pas les suivants de tourner.

Lancement : `python -m backend.tests.test_gemini_models`
"""

import os
import sys
import traceback

from dotenv import load_dotenv
from google import genai
from google.genai import types

from backend.models import GEMINI_MODEL_FLASH, GEMINI_MODEL_PRO

load_dotenv(dotenv_path="poc-stt/.env")


def _client() -> genai.Client:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY absent — pose-la dans .env")
    return genai.Client(api_key=key)


def test_flash_texte() -> None:
    """Flash : appel texte minimal."""
    client = _client()
    response = client.models.generate_content(
        model=GEMINI_MODEL_FLASH,
        contents="Réponds uniquement 'pong'.",
    )
    text = (response.text or "").strip().lower()
    assert "pong" in text, f"Réponse inattendue : {response.text!r}"


def test_pro_texte() -> None:
    """Pro Preview : appel texte minimal."""
    client = _client()
    response = client.models.generate_content(
        model=GEMINI_MODEL_PRO,
        contents="Réponds uniquement 'pong'.",
    )
    text = (response.text or "").strip().lower()
    assert "pong" in text, f"Réponse inattendue : {response.text!r}"


def _tool_declaration() -> types.Tool:
    """Un outil bidon pour valider le function calling."""
    return types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name="get_weather",
                description="Retourne la météo d'une ville.",
                parameters_json_schema={
                    "type": "object",
                    "properties": {
                        "ville": {"type": "string", "description": "Nom de la ville."},
                    },
                    "required": ["ville"],
                },
            )
        ]
    )


def _run_function_calling(model_name: str) -> None:
    """Appelle le modèle avec un outil, vérifie qu'il tente un function call."""
    client = _client()
    config = types.GenerateContentConfig(
        system_instruction="Tu utilises toujours les outils disponibles.",
        tools=[_tool_declaration()],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(
            disable=True,
        ),
        tool_config=types.ToolConfig(
            function_calling_config=types.FunctionCallingConfig(
                mode="ANY",
            ),
        ),
    )
    response = client.models.generate_content(
        model=model_name,
        contents="Quel temps fait-il à Marseille ?",
        config=config,
    )
    fcs = response.function_calls or []
    assert fcs, f"Aucun function_call retourné par {model_name}"
    assert fcs[0].name == "get_weather", f"Outil inattendu : {fcs[0].name}"
    assert "ville" in dict(fcs[0].args), f"Args inattendus : {dict(fcs[0].args)}"


def test_flash_function_calling() -> None:
    """Flash : function calling déclenché correctement."""
    _run_function_calling(GEMINI_MODEL_FLASH)


def test_pro_function_calling() -> None:
    """Pro Preview : function calling déclenché correctement."""
    _run_function_calling(GEMINI_MODEL_PRO)


TESTS = [
    ("Flash — texte simple",         test_flash_texte),
    ("Pro   — texte simple",         test_pro_texte),
    ("Flash — function calling",     test_flash_function_calling),
    ("Pro   — function calling",     test_pro_function_calling),
]


def main() -> int:
    print(f"Flash : {GEMINI_MODEL_FLASH}")
    print(f"Pro   : {GEMINI_MODEL_PRO}")
    print("-" * 60)
    fails = 0
    for label, fn in TESTS:
        try:
            fn()
            print(f"  OK   {label}")
        except Exception as exc:  # noqa: BLE001
            fails += 1
            print(f"  FAIL {label} : {exc}")
            traceback.print_exc()
    print("-" * 60)
    print(f"{len(TESTS) - fails}/{len(TESTS)} tests OK")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
