"""
Delegador de Orquestación Biomecánica (`orquestador.py`).
Delega en `pipeline_principal.py`, que coordina `1_clasificador_gestos`, `2_motor_fisico` y `3_coach_experto`.
"""

from typing import Any, Dict, List
from backend.biomecanica.pipeline_principal import (
    PipelineBiomecanicoPrincipal,
    ejecutar_pipeline_principal,
)


class OrquestadorBiomecanico(PipelineBiomecanicoPrincipal):
    """Orquestador central que delega en `PipelineBiomecanicoPrincipal` (`pipeline_principal.py`)."""

    @classmethod
    def procesar_secuencia(
        cls,
        frames_procesados: List[Dict[str, Any]],
        t0_idx_relativo: int = 20,
        gesto_solicitado: str = "auto",
    ) -> Dict[str, Any]:
        return cls.ejecutar_pipeline(
            frames_procesados=frames_procesados,
            t0_idx_relativo=t0_idx_relativo,
            gesto_solicitado=gesto_solicitado,
        )


def orquestar_secuencia_biomecanica(
    frames_procesados: List[Dict[str, Any]],
    t0_idx_relativo: int = 20,
    gesto_solicitado: str = "auto",
) -> Dict[str, Any]:
    return ejecutar_pipeline_principal(
        frames_procesados=frames_procesados,
        t0_idx_relativo=t0_idx_relativo,
        gesto_solicitado=gesto_solicitado,
    )
