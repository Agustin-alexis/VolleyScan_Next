"""
Configuración Global y Variables de Entorno del Proyecto VolleyScan AI.
"""

import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Cargar variables de entorno desde .env en la raíz del proyecto
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

# Directorios de la aplicación
FRONTEND_DIR = BASE_DIR / "frontend"

# Credenciales de Supabase
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

# Configuración del servidor
SERVER_HOST: str = os.getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT: int = int(os.getenv("SERVER_PORT", "8000"))
DEBUG: bool = os.getenv("DEBUG", "true").lower() in ("true", "1", "t")

# Configuración CORS (Integración estricta con Next.js en Puerto 3000)
CORS_ORIGINS: List[str] = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*",
]
CORS_ALLOW_CREDENTIALS: bool = True
CORS_ALLOW_METHODS: List[str] = ["*"]
CORS_ALLOW_HEADERS: List[str] = ["*"]

# Parámetros Biomecánicos Globales
BUFFER_MAXLEN: int = 60         # 2 segundos a 30 FPS
PRE_FRAMES: int = 20            # Ventana previa a t0
POST_FRAMES: int = 12           # Ventana posterior a t0 (fase de aterrizaje)
TOTAL_VENTANA_FRAMES: int = 33  # pre_frames + 1 (t0) + post_frames
COOLDOWN_SEGUNDOS: float = 3.5

# Metadatos de la API
APP_TITLE: str = "VolleyScan AI — Clean Architecture & Temporal Biomechanics"
APP_DESCRIPTION: str = (
    "Asistente biomecánico de voleibol con detección de fases críticas, "
    "reconstrucción tridimensional temporal y correcciones técnicas fundamentadas en evidencia."
)
APP_VERSION: str = "2.0.0"
