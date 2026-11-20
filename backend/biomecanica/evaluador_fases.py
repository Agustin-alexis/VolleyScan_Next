"""
Delegador ligero de compatibilidad (`evaluador_fases.py`).
El monolito fue desacoplado en:
  - `1_clasificador_gestos.py`
  - `2_motor_fisico.py`
  - `3_coach_experto.py`
  - `pipeline_principal.py`
"""

import importlib
from typing import Any, Dict, List, Optional
from backend.biomecanica.pipeline_principal import (
    MAPA_GESTOS_CANONICOS,
    PipelineBiomecanicoPrincipal,
    ejecutar_pipeline_principal,
)
from backend.biomecanica.generador_replay import GeneradorReplayCinematico

_mod_1 = importlib.import_module("backend.biomecanica.1_clasificador_gestos")
_mod_2 = importlib.import_module("backend.biomecanica.2_motor_fisico")
_mod_3 = importlib.import_module("backend.biomecanica.3_coach_experto")


class EvaluadorFasesBiomecanicas(PipelineBiomecanicoPrincipal):
    """Fachada ligera que delega 100% en `pipeline_principal`, `1_clasificador_gestos`, `2_motor_fisico` y `3_coach_experto`."""

    clasificar_gesto_tecnico = staticmethod(_mod_1.clasificar_gesto_tecnico)
    segmentar_en_4_fases_exactas = staticmethod(_mod_3.CoachExpertoBiomecanico.segmentar_en_4_fases_exactas)
    evaluar_secuencia_completa = classmethod(lambda cls, frames_procesados, t0_idx_relativo=20, gesto_solicitado="auto": cls.ejecutar_pipeline(frames_procesados, t0_idx_relativo, gesto_solicitado))
    calcular_salto_vertical = staticmethod(_mod_2.calcular_salto_vertical)
    evaluar_cinematica_continua_33_frames = staticmethod(_mod_2.evaluar_cinematica_continua_33_frames)
    generar_feedback_voz_infantil = staticmethod(_mod_3.generar_feedback_voz_infantil)
    generar_replay_cinematico_gif = staticmethod(GeneradorReplayCinematico.generar_replay_cinematico_gif)


def clasificar_gesto_tecnico(
    buffer_frames: List[Any],
    salto_vertical_cm: Optional[float] = None,
    t0_index: int = 20,
) -> str:
    return _mod_1.clasificar_gesto_tecnico(buffer_frames, salto_vertical_cm=salto_vertical_cm, t0_index=t0_index)
