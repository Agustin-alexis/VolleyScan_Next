"""
Modelos Pydantic para Validación de Esquemas de Entrada y Salida (Capa `schemas/`).
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from backend.schemas.analisis_schemas import (
    AnalisisProfundoRequest,
    AnalisisProfundoResponse,
    EventoGestoCompletadoSchema,
    FaseBiomecanicaSchema,
    FasesBiomecanicasSchema,
)


class SesionInput(BaseModel):
    """Esquema para creación de sesiones estándar."""
    usuario_id: str = Field(default="00000000-0000-0000-0000-000000000001", description="UUID del deportista")
    gesto_tecnico: str = Field(default="auto", description="Gesto solicitado o detección automática")
    dispositivo: str = Field(default="Web / Canvas 3D", description="Dispositivo emisor de telemetría")


class IniciarEntrenamientoInput(BaseModel):
    """Esquema para inicio de sesiones de entrenamiento continuo longitudinal (Fase 1)."""
    usuario_id: Optional[str] = Field(default="00000000-0000-0000-0000-000000000001", description="UUID del usuario")
    dispositivo: Optional[str] = Field(default="Web / Canvas 3D", description="Plataforma de captura")


class PayloadFrameInput(BaseModel):
    """Esquema de validación para frames entrantes por WebSocket o REST."""
    frame_id: int
    timestamp: float
    puntos: Dict[str, List[float]]
    puntos_mundo: Optional[Dict[str, List[float]]] = None
    gesto_tecnico: str = "auto"


__all__ = [
    "AnalisisProfundoRequest",
    "AnalisisProfundoResponse",
    "EventoGestoCompletadoSchema",
    "FaseBiomecanicaSchema",
    "FasesBiomecanicasSchema",
    "SesionInput",
    "IniciarEntrenamientoInput",
    "PayloadFrameInput",
]
