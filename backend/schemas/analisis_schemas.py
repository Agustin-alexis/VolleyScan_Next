"""
Esquemas Pydantic de Entrada y Salida para el Análisis Biomecánico (`backend/schemas/analisis_schemas.py`).
Capa `schemas/` de la Arquitectura DDD:
Define los contratos estrictos Request/Response para el motor biomecánico MediaPipe.
Arquitectura Edge-Cloud Ligera: MediaPipe extrae los 33 landmarks en cliente y envía JSON numérico.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class FotogramaItem(BaseModel):
    """Un fotograma con sus coordenadas tridimensionales de MediaPipe Pose (33 landmarks)."""
    frame: int = Field(default=1, description="Índice secuencial del frame (1 a 33)")
    puntos: List[Any] = Field(
        default_factory=list,
        description="Lista de coordenadas articulares {x, y, z} o [x, y, z] del fotograma MediaPipe",
    )


class AnalisisProfundoRequest(BaseModel):
    """Modelo Pydantic de entrada para análisis de secuencia completa con MediaPipe Pose."""
    tipo_gesto: str = Field(default="AUTO", description="Gesto detectado por MediaPipe en cliente")
    jugador: str = Field(default="atleta", description="Identificador del atleta autenticado")
    gesto_detectado_edge: Optional[str] = None
    gesto_tecnico: Optional[str] = None
    fotogramas: Optional[List[FotogramaItem]] = None
    frames_landmarks: Optional[List[List[Any]]] = None


class FaseBiomecanicaSchema(BaseModel):
    """Detalle de una de las 4 fases biomecánicas del gesto."""
    nombre: str
    frame_idx: int
    score: float
    rodilla_3d: Optional[float] = None
    codo_inicial: Optional[float] = None
    codo_armado: Optional[float] = None
    velocidad_ms: Optional[float] = None
    codo_extension: Optional[float] = None
    hombro_impacto: Optional[float] = None
    simetria_piernas: Optional[float] = None
    amortiguacion_rodilla: Optional[float] = None


class FasesBiomecanicasSchema(BaseModel):
    """Estructura completa de las 4 fases biomecánicas."""
    fase_1_preparacion: FaseBiomecanicaSchema
    fase_2_impulso: FaseBiomecanicaSchema
    fase_3_contacto_critico: FaseBiomecanicaSchema
    fase_4_finalizacion: FaseBiomecanicaSchema


class EventoGestoCompletadoSchema(BaseModel):
    """Tarjeta histórica de un gesto completado lista para el historial y Replay 3D."""
    id: str
    numero: int
    tipo_gesto: str
    estado: str
    efectividad: float
    velocidad_articular: float
    angulo_codos: float
    angulo_rodillas: float = 145.0
    distancia_munecas: float
    salto_vertical_cm: float
    mensaje_voz: str
    timestamp: str
    timestamp_iso: str
    total_frames: int
    coordenadas_3d: List[List[Any]]
    fases: Optional[FasesBiomecanicasSchema] = None


class AnalisisProfundoResponse(BaseModel):
    """Modelo Pydantic de salida para evaluaciones de secuencia MediaPipe."""
    status: str = "success"
    motor: str = "MediaPipe Strict 33-Landmarks Precision"
    jugador: str = "atleta"
    gesto_detectado: str = "Sin detección"
    efectividad: float = 0.0
    estado: str = "CALIBRANDO"
    mensaje_voz: str = ""
    feedback_voz: str = ""
    metricas: Dict[str, Any] = Field(default_factory=dict)
    fases: Optional[FasesBiomecanicasSchema] = None
    coordenadas_3d: List[List[Any]] = Field(default_factory=list)
    evento_gesto_completado: Optional[EventoGestoCompletadoSchema] = None
    message: Optional[str] = None
