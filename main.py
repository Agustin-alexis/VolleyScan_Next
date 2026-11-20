"""
VolleyScan AI — Punto de Entrada Principal Unificado (Clean Architecture).
Inicializa la aplicación FastAPI en puerto 8000, configura CORS para Next.js (puerto 3000)
y enlaza todas las rutas REST y WebSockets del motor biomecánico MediaPipe.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.api.router import router as api_router
from backend.core.config import (
    APP_DESCRIPTION,
    APP_TITLE,
    APP_VERSION,
    CORS_ALLOW_CREDENTIALS,
    CORS_ALLOW_HEADERS,
    CORS_ALLOW_METHODS,
    CORS_ORIGINS,
    DEBUG,
    FRONTEND_DIR,
    SERVER_HOST,
    SERVER_PORT,
)

# Inicialización de la aplicación FastAPI
app = FastAPI(
    title=APP_TITLE,
    description=APP_DESCRIPTION,
    version=APP_VERSION,
)

# Configuración de Middlewares (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=CORS_ALLOW_CREDENTIALS,
    allow_methods=CORS_ALLOW_METHODS,
    allow_headers=CORS_ALLOW_HEADERS,
)

# Montaje opcional si existe la carpeta estática heredada; en el proyecto unificado
# la interfaz exclusiva corre en Next.js (http://localhost:3000).
if FRONTEND_DIR.exists():
    app.mount("/frontend", StaticFiles(directory=FRONTEND_DIR), name="frontend")
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/", tags=["UI"])
async def index():
    """Devuelve la información del motor biomecánico FastAPI o el HTML heredado si existe."""
    index_html = FRONTEND_DIR / "index.html"
    if index_html.exists():
        return FileResponse(index_html)
    return JSONResponse(
        {
            "status": "ok",
            "motor": "VolleyScan AI — Motor Biomecánico Estricto MediaPipe (8 Ángulos, Calibración T, 4 Fases)",
            "puerto": SERVER_PORT,
            "frontend_exclusive_url": "http://localhost:3000",
        }
    )


# Enlace de las rutas de red (REST y WebSockets)
app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=SERVER_HOST, port=SERVER_PORT, reload=DEBUG)
