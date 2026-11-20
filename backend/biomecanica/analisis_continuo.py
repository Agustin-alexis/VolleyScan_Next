"""
Delegador ligero de compatibilidad (`analisis_continuo.py`).
El monolito fue desacoplado en `2_motor_fisico.py` y `1_clasificador_gestos.py`.
"""

import importlib
from typing import Any, Dict, List, Optional

_mod_1 = importlib.import_module("backend.biomecanica.1_clasificador_gestos")
_mod_2 = importlib.import_module("backend.biomecanica.2_motor_fisico")

UMBRAL_DERIVADA_ANGULAR_MAX = _mod_2.UMBRAL_DERIVADA_ANGULAR_MAX
ACELERACION_GRAVEDAD_MS2 = _mod_2.ACELERACION_GRAVEDAD_MS2
FPS_CAPTURA_POR_DEFECTO = _mod_2.FPS_CAPTURA_POR_DEFECTO
UMBRAL_DE_DESPEGUE_RELATIVO = _mod_2.UMBRAL_DE_DESPEGUE_RELATIVO
UMBRAL_DE_DESPEGUE = _mod_2.UMBRAL_DE_DESPEGUE


class AnalizadorContinuo33Frames(_mod_2.MotorFisicoSalto):
    """Fachada ligera que delega 100% en `2_motor_fisico.py` y `1_clasificador_gestos.py`."""

    clasificar_gesto_tecnico = staticmethod(_mod_1.clasificar_gesto_tecnico)


calcular_salto_vertical = _mod_2.calcular_salto_vertical
evaluar_cinematica_continua_33_frames = _mod_2.evaluar_cinematica_continua_33_frames
clasificar_gesto_tecnico = _mod_1.clasificar_gesto_tecnico
