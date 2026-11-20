"""
VolleyScan AI — Backend Package (Clean Architecture).
Capas:
  - api: Endpoints REST y WebSockets.
  - core: Configuraciones globales y constantes.
  - db: Persistencia en Supabase y Fallback en RAM.
  - schemas: Validación de modelos con Pydantic.
  - biomecanica: Modelos de dominio y algoritmos científicos temporales.
"""

# Alias para compatibilidad con código existente
from backend.biomecanica.buffer_temporal import FramePoseData, TemporalPoseBuffer
from backend.biomecanica.evaluador_fases import EvaluadorFasesBiomecanicas
from backend.biomecanica.laboratorio_ablacion import LaboratorioAblacionCientifica
from backend.biomecanica.reconstruccion_3d import Reconstructor3DTemporal
from backend.db.database import (
    crear_sesion_db,
    crear_sesion_entrenamiento,
    obtener_historial_db,
    obtener_historial_sesion,
    obtener_sesion_entrenamiento,
    registrar_gesto_en_sesion,
    supabase,
)

__all__ = [
    "TemporalPoseBuffer",
    "FramePoseData",
    "EvaluadorFasesBiomecanicas",
    "Reconstructor3DTemporal",
    "LaboratorioAblacionCientifica",
    "supabase",
    "crear_sesion_entrenamiento",
    "obtener_sesion_entrenamiento",
    "registrar_gesto_en_sesion",
    "obtener_historial_sesion",
    "crear_sesion_db",
    "obtener_historial_db",
]
