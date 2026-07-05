"""Constantes des modèles Gemini utilisés dans le back-end.

Un seul endroit pour changer un ID de modèle. Chaque module importe
la constante correspondant à son cas d'usage.
"""

import os

# Modèle Flash : bas coût, faible latence.
# Cas d'usage : agents temps réel qui tournent en continu pendant un appel.
GEMINI_MODEL_FLASH: str = os.getenv("GEMINI_MODEL_FLASH", "gemini-3.5-flash")

# Modèle Pro Preview : raisonnement profond, plus lent, plus cher.
# Cas d'usage : passes ponctuelles où la qualité prime sur la latence.
GEMINI_MODEL_PRO: str = os.getenv("GEMINI_MODEL_PRO", "gemini-3.1-pro-preview")
