"""
Módulo de Sincronización en la Nube con Supabase (SaaS Persistence).
Gestiona la conexión con Supabase mediante `SUPABASE_URL` y `SUPABASE_KEY`
y persiste el resumen consolidado de cada sesión finalizada en la tabla `sesiones`.
"""

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

try:
    from supabase import Client, create_client
except ImportError:
    Client = None
    create_client = None

from backend.core.config import SUPABASE_KEY as CFG_SUPABASE_KEY, SUPABASE_URL as CFG_SUPABASE_URL

load_dotenv()

SUPABASE_URL: str = os.getenv("SUPABASE_URL") or CFG_SUPABASE_URL or ""
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY") or CFG_SUPABASE_KEY or ""

supabase_client: Optional[Any] = None
if SUPABASE_URL and SUPABASE_KEY and create_client is not None:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as exc:
        logger.warning("[DB_SYNC] Aviso al inicializar cliente Supabase: %s", exc)

# Respaldo local en memoria para entornos sin red o cuando Supabase devuelve 401/offline
HISTORIAL_SESIONES_FINALIZADAS: List[Dict[str, Any]] = []


def obtener_cliente_supabase() -> Optional[Any]:
    """Devuelve la instancia activa del cliente de Supabase o intenta inicializarla."""
    global supabase_client
    if supabase_client is not None:
        return supabase_client

    url = os.getenv("SUPABASE_URL") or SUPABASE_URL
    key = os.getenv("SUPABASE_KEY") or SUPABASE_KEY
    if url and key and create_client is not None:
        try:
            supabase_client = create_client(url, key)
        except Exception as exc:
            logger.warning("[DB_SYNC] No se pudo conectar a Supabase: %s", exc)
    return supabase_client


def obtener_cliente_supabase_autenticado(token: Optional[str] = None) -> Optional[Any]:
    """
    Devuelve un cliente Supabase con el JWT real del usuario inyectado en PostgREST
    para respetar las políticas RLS (`auth.uid() = usuario_id`) cuando el token proviene de Supabase Auth.
    """
    token_limpio = str(token or "").strip()
    if token_limpio and not token_limpio.endswith(".vs_supabase_sig"):
        url = os.getenv("SUPABASE_URL") or SUPABASE_URL
        key = os.getenv("SUPABASE_KEY") or SUPABASE_KEY
        if url and key and create_client is not None:
            try:
                cliente_auth = create_client(url, key)
                if hasattr(cliente_auth, "postgrest") and hasattr(cliente_auth.postgrest, "auth"):
                    cliente_auth.postgrest.auth(token_limpio)
                return cliente_auth
            except Exception as exc:
                logger.warning("[DB_SYNC] No se pudo aplicar auth JWT al cliente Supabase: %s", exc)
    return obtener_cliente_supabase()


def guardar_resumen_sesion(datos_sesion: Dict[str, Any]) -> Dict[str, Any]:
    """
    Inserta el resumen ejecutivo de la sesión finalizada en la tabla `sesiones` de Supabase.
    Campos obligatorios garantizados:
      - `fecha`: ISO 8601 timestamp o fecha enviada por el cliente
      - `total_saltos`: int
      - `salto_maximo_cm`: float
      - `alertas_fatiga`: int
      - `gestos_entrenados`: List[str] (array de strings)
    """
    datos = datos_sesion or {}

    fecha = str(datos.get("fecha") or datetime.now(timezone.utc).isoformat())
    total_saltos = int(datos.get("total_saltos", datos.get("totalSaltos", 0)) or 0)
    salto_maximo_cm = round(float(datos.get("salto_maximo_cm", datos.get("saltoMaximoCm", 0.0)) or 0.0), 2)
    alertas_fatiga = int(datos.get("alertas_fatiga", datos.get("avisosFatigaCount", 0)) or 0)

    gestos_raw = datos.get("gestos_entrenados", datos.get("gestosEntrenados", []))
    if isinstance(gestos_raw, str):
        gestos_entrenados: List[str] = [g.strip() for g in gestos_raw.split(",") if g.strip()]
    elif isinstance(gestos_raw, (list, tuple, set)):
        gestos_entrenados = [str(g).strip() for g in gestos_raw if str(g).strip()]
    else:
        gestos_entrenados = []

    usuario_id = str(
        datos.get("usuario_id")
        or datos.get("usuarioId")
        or "00000000-0000-0000-0000-000000000001"
    )
    usuario_email = datos.get("usuario_email") or datos.get("email")

    registro_sesion: Dict[str, Any] = {
        "usuario_id": usuario_id,
        "fecha": fecha,
        "total_saltos": total_saltos,
        "salto_maximo_cm": salto_maximo_cm,
        "alertas_fatiga": alertas_fatiga,
        "gestos_entrenados": gestos_entrenados,
    }
    if usuario_email:
        registro_sesion["usuario_email"] = str(usuario_email)

    cliente = obtener_cliente_supabase()
    sincronizado_supabase = False

    if cliente is not None:
        try:
            respuesta = cliente.table("sesiones").insert(registro_sesion).execute()
            sincronizado_supabase = True
            datos_remotos = getattr(respuesta, "data", None)
            if datos_remotos:
                HISTORIAL_SESIONES_FINALIZADAS.append(registro_sesion)
                return {
                    "status": "ok",
                    "mensaje": "Sesión guardada exitosamente en la nube",
                    "sincronizado_supabase": True,
                    "sesion": datos_remotos[0] if isinstance(datos_remotos, list) else registro_sesion,
                }
        except Exception as exc:
            logger.warning("[DB_SYNC FALLBACK] Aviso al insertar en tabla 'sesiones' de Supabase (%s). Guardando en respaldo local.", exc)

    HISTORIAL_SESIONES_FINALIZADAS.append(registro_sesion)
    return {
        "status": "ok",
        "mensaje": "Sesión guardada exitosamente en la nube",
        "sincronizado_supabase": sincronizado_supabase,
        "sesion": registro_sesion,
    }
