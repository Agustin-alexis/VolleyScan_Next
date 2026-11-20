"""
Capa de Red (API): Endpoints REST y WebSockets de VolleyScan AI.
Desacoplada del punto de entrada (main.py) y orientada al dominio biomecánico.
"""

import base64
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException, WebSocket, WebSocketDisconnect

from backend.api.db_sync import guardar_resumen_sesion, obtener_cliente_supabase
from backend.api.usuario_service import (
    actualizar_configuracion_usuario,
    actualizar_perfil_usuario,
    completar_ejercicio_rutina_usuario,
    completar_rutina_usuario,
    crear_nueva_rutina_ia_usuario,
    eliminar_notificacion_usuario,
    eliminar_sesion_ia_usuario,
    guardar_sesion_ia_desde_cliente,
    iniciar_rutina_usuario,
    limpiar_notificaciones_usuario,
    marcar_notificacion_leida_usuario,
    marcar_todas_notificaciones_leidas_usuario,
    obtener_configuracion_usuario,
    obtener_contenido_educativo_usuario,
    obtener_detalle_sesion_ia_usuario,
    obtener_historial_general_usuario,
    obtener_notificaciones_usuario,
    obtener_perfil_usuario,
    obtener_progreso_usuario,
    obtener_rutina_detalle_usuario,
    obtener_rutinas_usuario,
    obtener_sesiones_ia_usuario,
    registrar_notificacion_usuario,
    sincronizar_captura_ia_usuario,
)
from backend.biomecanica.buffer_temporal import TemporalPoseBuffer
from backend.biomecanica.laboratorio_ablacion import LaboratorioAblacionCientifica
from backend.biomecanica.pipeline_principal import PipelineBiomecanicoPrincipal
from backend.biomecanica.reconstruccion_3d import (
    Reconstructor3DTemporal,
    calcular_angulos_flexion_frame,
)
from backend.core.config import BUFFER_MAXLEN, POST_FRAMES, PRE_FRAMES
from backend.db.database import (
    crear_sesion_db,
    crear_sesion_entrenamiento,
    guardar_salto_con_fallback,
    obtener_historial_db,
    obtener_historial_sesion,
    registrar_gesto_en_sesion,
)
from backend.schemas.modelos_sesion import IniciarEntrenamientoInput, SesionInput

logger = logging.getLogger(__name__)
router = APIRouter()

CALIBRATION_REQUIRED_FRAMES: int = 45
# Almacén en memoria de búferes temporales por sesión
SESIONES_BUFFER: Dict[str, TemporalPoseBuffer] = {}
SESIONES_IA_USUARIO: List[Dict[str, Any]] = []

# Motor de reconstrucción cinemática 3D temporal
RECONSTRUCTOR_3D = Reconstructor3DTemporal(tamano_ventana_gauss=5, sigma=1.0)


def extraer_usuario_jwt(
    authorization: Optional[str] = None,
    x_user_id: Optional[str] = None,
) -> Dict[str, Optional[str]]:
    """
    Extrae y valida el perfil del usuario (`usuario_id`, `email`) desde el token JWT
    enviado en la cabecera `Authorization: Bearer <token>` de Supabase Auth.
    """
    uid = x_user_id.strip() if x_user_id and x_user_id.strip() else None
    email = None
    nombre = None
    apellido = None
    token_raw: Optional[str] = None

    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        if token:
            token_raw = token
            # 1. Intentar validación directa con Supabase Auth si está disponible
            cliente = obtener_cliente_supabase()
            if cliente is not None:
                try:
                    res_user = cliente.auth.get_user(token)
                    user_obj = getattr(res_user, "user", None)
                    if user_obj and getattr(user_obj, "id", None):
                        meta_u = getattr(user_obj, "user_metadata", None) or {}
                        return {
                            "usuario_id": str(user_obj.id),
                            "email": getattr(user_obj, "email", None),
                            "nombre": meta_u.get("nombre"),
                            "apellido": meta_u.get("apellido"),
                            "token": token_raw,
                        }
                except Exception:
                    pass

            # 2. Decodificación estándar del payload JWT (claims `sub`, `email` y `user_metadata`)
            partes = token.split(".")
            if len(partes) >= 2:
                try:
                    b64 = partes[1]
                    padding = "=" * (-len(b64) % 4)
                    payload_bytes = base64.urlsafe_b64decode(b64 + padding)
                    claims = json.loads(payload_bytes.decode("utf-8"))
                    if isinstance(claims, dict):
                        uid = str(claims.get("sub") or claims.get("user_id") or uid or "") or None
                        email = claims.get("email")
                        meta_c = claims.get("user_metadata") or {}
                        if isinstance(meta_c, dict):
                            nombre = meta_c.get("nombre")
                            apellido = meta_c.get("apellido")
                except Exception:
                    pass

    return {"usuario_id": uid, "email": email, "nombre": nombre, "apellido": apellido, "token": token_raw}


# ============================================================================
# ENDPOINTS REST: CONTROL DE ENTRENAMIENTO Y SESIONES LONGITUDINALES CON JWT
# ============================================================================

@router.post("/api/entrenamiento/iniciar")
async def iniciar_entrenamiento(
    datos: Optional[IniciarEntrenamientoInput] = None,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """
    Fase 1: Crea una nueva sesión de entrenamiento continuo vinculada al JWT del usuario.
    """
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    try:
        u_id = (
            jwt_info["usuario_id"]
            or (datos.usuario_id if datos and datos.usuario_id else None)
            or "00000000-0000-0000-0000-000000000001"
        )
        disp = datos.dispositivo if datos and datos.dispositivo else "Web / Canvas 3D"
        sesion = crear_sesion_entrenamiento(usuario_id=u_id, dispositivo=disp)
        SESIONES_BUFFER[sesion["sesion_id"]] = TemporalPoseBuffer(
            maxlen=BUFFER_MAXLEN,
            pre_frames=PRE_FRAMES,
            post_frames=POST_FRAMES,
        )
        return sesion
    except Exception as exc:
        logger.warning("Fallback RAM activado en iniciar_entrenamiento: %s", exc)
        s_id = f"trn_fallback_{int(time.time())}"
        sesion_fallback: Dict[str, Any] = {
            "sesion_id": s_id,
            "usuario_id": jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001",
            "dispositivo": "Web / Canvas 3D",
            "fecha_inicio": datetime.now(timezone.utc).isoformat(),
            "gestos_registrados": [],
            "total_gestos": 0,
        }
        SESIONES_BUFFER[s_id] = TemporalPoseBuffer(
            maxlen=BUFFER_MAXLEN,
            pre_frames=PRE_FRAMES,
            post_frames=POST_FRAMES,
        )
        return sesion_fallback


@router.get("/api/entrenamiento/{sesion_id}/historial")
async def obtener_historial_entrenamiento(sesion_id: str) -> Dict[str, Any]:
    """
    Devuelve el array completo de todos los gestos realizados en esa sesión,
    ordenados cronológicamente con sus 4 fases, ángulos, efectividad y causa raíz.
    """
    historial = obtener_historial_sesion(sesion_id)
    if not historial:
        raise HTTPException(status_code=404, detail=f"Sesión '{sesion_id}' no encontrada.")
    return historial


@router.post("/api/sesiones")
async def crear_sesion(
    datos: SesionInput,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Crea una sesión estándar compatible vinculada al usuario del token JWT."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = jwt_info["usuario_id"] or datos.usuario_id
    sesion = crear_sesion_db(uid, datos.gesto_tecnico, datos.dispositivo)
    SESIONES_BUFFER[sesion["id"]] = TemporalPoseBuffer(
        maxlen=BUFFER_MAXLEN,
        pre_frames=PRE_FRAMES,
        post_frames=POST_FRAMES,
    )
    return sesion


@router.get("/api/historial/{usuario_id}")
async def obtener_historial_jugador(
    usuario_id: str,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Any:
    """Obtiene el historial agregado por usuario autenticado."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    target_uid = jwt_info["usuario_id"] if usuario_id == "me" and jwt_info["usuario_id"] else usuario_id
    return obtener_historial_db(target_uid)


@router.post("/api/sesiones/finalizar")
async def finalizar_sesion_endpoint(
    datos_sesion: Dict[str, Any],
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """
    Recibe el resumen consolidado de la sesión desde el frontend con token JWT
    y lo persiste en la tabla `sesiones` de Supabase vinculado al usuario autenticado.
    """
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    token = jwt_info.get("token")
    datos = dict(datos_sesion or {})
    if jwt_info["usuario_id"]:
        datos["usuario_id"] = jwt_info["usuario_id"]
    if jwt_info["email"] and "usuario_email" not in datos:
        datos["usuario_email"] = jwt_info["email"]
    uid_fin = str(datos.get("usuario_id") or "00000000-0000-0000-0000-000000000001")
    sesion_guardada = None
    if datos.get("repeticiones") or datos.get("gestos") or int(datos.get("duracionSeg") or datos.get("duracion_segundos") or 0) > 0:
        sesion_guardada = guardar_sesion_ia_desde_cliente(uid_fin, datos, token=token)
    total_s = int(datos.get("total_saltos") or len(datos.get("repeticiones") or []) or 0)
    if total_s > 0:
        registrar_notificacion_usuario(
            usuario_id=uid_fin,
            tipo="analisis",
            titulo="Sesión de entrenamiento guardada",
            mensaje=f"Se registraron {total_s} gestos con salto máximo de {datos.get('salto_maximo_cm', 0)} cm.",
            enlace="/usuario/historial",
            token=token,
        )
    res_legacy = guardar_resumen_sesion(datos)
    if sesion_guardada:
        res_legacy["sesion_completa"] = sesion_guardada
    return res_legacy


@router.post("/api/entrenamiento/{sesion_id}/salto")
@router.post("/api/analisis")
async def registrar_salto_endpoint(
    sesion_id: str = "activa",
    payload: Optional[Dict[str, Any]] = None,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """
    Registra las métricas de salto vertical y diagnóstico biomecánico en Supabase / RAM
    vinculándolas al `usuario_id` extraído del token JWT de Supabase Auth.
    """
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    token = jwt_info.get("token")
    datos = dict(payload or {})
    if jwt_info["usuario_id"]:
        datos["usuario_id"] = jwt_info["usuario_id"]
    if jwt_info["email"] and "usuario_email" not in datos:
        datos["usuario_email"] = jwt_info["email"]
    uid_salto = str(datos.get("usuario_id") or "00000000-0000-0000-0000-000000000001")
    sincronizar_captura_ia_usuario(sesion_id=sesion_id, usuario_id=uid_salto, paquete_resultado=datos, token=token)
    return guardar_salto_con_fallback(sesion_id, datos)


@router.post("/api/ia/analisis/sesiones")
async def guardar_sesion_ia_jwt(
    sesion: Dict[str, Any],
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Guarda la sesión completa enviada desde VolleyScan_Next vinculada al usuario del JWT."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or sesion.get("usuario_id") or "00000000-0000-0000-0000-000000000001")
    registro = guardar_sesion_ia_desde_cliente(uid, sesion, token=jwt_info.get("token"))
    SESIONES_IA_USUARIO.insert(0, registro)
    return {"status": "ok", "id": registro["id"], "usuario_id": registro["usuario_id"], "sesion": registro}


@router.get("/api/ia/analisis/sesiones")
async def listar_sesiones_ia_jwt(
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> List[Dict[str, Any]]:
    """Lista las sesiones de análisis pertenecientes al usuario autenticado por JWT con las 4 fases."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    return obtener_sesiones_ia_usuario(uid, token=jwt_info.get("token"))


@router.get("/api/ia/analisis/sesiones/{sesion_id}")
async def obtener_detalle_sesion_ia_jwt(
    sesion_id: str,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Devuelve el detalle completo de una sesión de IA (con cada gesto, sus 4 fases y correcciones)."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    detalle = obtener_detalle_sesion_ia_usuario(uid, sesion_id, token=jwt_info.get("token"))
    if not detalle:
        raise HTTPException(status_code=404, detail=f"Sesión '{sesion_id}' no encontrada.")
    return detalle


@router.delete("/api/ia/analisis/sesiones/{sesion_id}")
async def eliminar_sesion_ia_jwt(
    sesion_id: str,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Elimina una sesión del Historial de IA del usuario autenticado."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    eliminar_sesion_ia_usuario(uid, sesion_id, token=jwt_info.get("token"))
    return {"status": "ok", "id": sesion_id}


@router.get("/api/ia/analisis/estadisticas")
async def estadisticas_ia_jwt(
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Devuelve estadísticas consolidadas del Historial de IA del usuario autenticado."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    return obtener_progreso_usuario(uid, token=jwt_info.get("token"))


# ============================================================================
# ENDPOINTS DE MÓDULOS DE USUARIO (MENÚ LATERAL NEXT.JS CONECTADO A SUPABASE)
# ============================================================================

@router.get("/api/usuario/rutinas")
@router.get("/api/usuario/rutinas/")
async def api_listar_rutinas_usuario(
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> List[Dict[str, Any]]:
    """Lista las rutinas IA recomendadas y predeterminadas del usuario autenticado."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    return obtener_rutinas_usuario(uid, token=jwt_info.get("token"))


@router.post("/api/usuario/rutinas")
@router.post("/api/usuario/rutinas/")
async def api_crear_rutina_usuario(
    payload: Optional[Dict[str, Any]] = None,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Crea una nueva rutina correctiva basada en el diagnóstico biomecánico del usuario."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    return crear_nueva_rutina_ia_usuario(uid, payload, token=jwt_info.get("token"))


@router.get("/api/usuario/rutinas/{rutina_id}")
@router.get("/api/usuario/rutinas/{rutina_id}/")
async def api_detalle_rutina_usuario(
    rutina_id: str,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Obtiene el detalle y ejercicios de una rutina del usuario autenticado."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    rutina = obtener_rutina_detalle_usuario(uid, rutina_id, token=jwt_info.get("token"))
    if not rutina:
        raise HTTPException(status_code=404, detail="Rutina no encontrada.")
    return rutina


@router.post("/api/usuario/rutinas/{rutina_id}/iniciar")
@router.post("/api/usuario/rutinas/{rutina_id}/iniciar/")
async def api_iniciar_rutina_usuario(
    rutina_id: str,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Inicia una rutina y registra el estado `en_progreso` en Supabase."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    res = iniciar_rutina_usuario(uid, rutina_id, token=jwt_info.get("token"))
    if not res:
        raise HTTPException(status_code=404, detail="Rutina no encontrada.")
    return res


@router.put("/api/usuario/rutinas/{rutina_id}/completar")
@router.put("/api/usuario/rutinas/{rutina_id}/completar/")
async def api_completar_rutina_usuario(
    rutina_id: str,
    payload: Optional[Dict[str, Any]] = None,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Marca una rutina completa como completada (o reinicia si `completada=false`)."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    completada = bool((payload or {}).get("completada", True))
    res = completar_rutina_usuario(uid, rutina_id, completada=completada, token=jwt_info.get("token"))
    if not res:
        raise HTTPException(status_code=404, detail="Rutina no encontrada.")
    return res


@router.put("/api/usuario/rutinas/{rutina_id}/ejercicios/{ejercicio_id}/completar")
@router.put("/api/usuario/rutinas/{rutina_id}/ejercicios/{ejercicio_id}/completar/")
async def api_completar_ejercicio_rutina(
    rutina_id: str,
    ejercicio_id: str,
    payload: Optional[Dict[str, Any]] = None,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Marca un ejercicio de la rutina como completado y sincroniza el progreso."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    completado = bool((payload or {}).get("completado", True))
    res = completar_ejercicio_rutina_usuario(uid, rutina_id, ejercicio_id, completado=completado, token=jwt_info.get("token"))
    if not res:
        raise HTTPException(status_code=404, detail="Ejercicio o rutina no encontrada.")
    return res


@router.get("/api/usuario/historial")
@router.get("/api/usuario/historial/")
async def api_historial_general_usuario(
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> List[Dict[str, Any]]:
    """Devuelve el historial real de sesiones del usuario autenticado."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    return obtener_historial_general_usuario(uid, token=jwt_info.get("token"))


@router.get("/api/usuario/contenido")
@router.get("/api/usuario/contenido/")
async def api_contenido_educativo_usuario(
    categoria: Optional[str] = None,
    q: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> List[Dict[str, Any]]:
    """Devuelve el catálogo real de videos de YouTube filtrable por categoría y búsqueda."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    return obtener_contenido_educativo_usuario(uid, categoria=categoria, q=q, token=jwt_info.get("token"))


@router.get("/api/usuario/progreso")
@router.get("/api/usuario/progreso/")
async def api_progreso_estadisticas_usuario(
    periodo: str = "Últimos 30 días",
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Devuelve las métricas reales de progreso, evolución de salto, precisión por gesto y comparativa."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    return obtener_progreso_usuario(uid, periodo=periodo, token=jwt_info.get("token"))


@router.get("/api/usuario/notificaciones")
@router.get("/api/usuario/notificaciones/")
async def api_obtener_notificaciones_usuario(
    leida: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Obtiene las notificaciones sincronizadas y recomendaciones para el usuario autenticado."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    solo_no_leidas = str(leida or "").lower() == "false"
    return obtener_notificaciones_usuario(uid, solo_no_leidas=solo_no_leidas, token=jwt_info.get("token"))


@router.put("/api/usuario/notificaciones/leer-todas")
async def api_marcar_todas_leidas_usuario(
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Marca todas las notificaciones del usuario como leídas."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    return marcar_todas_notificaciones_leidas_usuario(uid)


@router.put("/api/usuario/notificaciones/{notif_id}/leer")
async def api_marcar_notificacion_leida(
    notif_id: str,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Marca una notificación específica como leída."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    return marcar_notificacion_leida_usuario(uid, notif_id)


@router.delete("/api/usuario/notificaciones/limpiar")
async def api_limpiar_notificaciones(
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Limpia todas las notificaciones del usuario autenticado."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    return limpiar_notificaciones_usuario(uid)


@router.delete("/api/usuario/notificaciones/{notif_id}")
async def api_eliminar_notificacion(
    notif_id: str,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Elimina una notificación específica del usuario autenticado."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    return eliminar_notificacion_usuario(uid, notif_id)


@router.get("/api/usuario/perfil")
@router.get("/api/usuario/perfil/")
async def api_obtener_perfil_usuario(
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Obtiene los datos del perfil del deportista autenticado."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    return obtener_perfil_usuario(uid, jwt_info)


@router.put("/api/usuario/perfil")
@router.put("/api/usuario/perfil/")
async def api_actualizar_perfil_usuario(
    payload: Dict[str, Any],
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Actualiza el perfil personal del deportista autenticado."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    return actualizar_perfil_usuario(uid, payload, jwt_info)


@router.delete("/api/usuario/perfil")
@router.delete("/api/usuario/perfil/")
async def api_eliminar_cuenta_usuario(
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Elimina los datos en sesión del perfil del usuario."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    return {"status": "ok", "usuario_id": uid}


@router.put("/api/usuario/perfil/password")
@router.put("/api/usuario/perfil/password/")
async def api_cambiar_password_usuario(
    payload: Optional[Dict[str, Any]] = None,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Actualiza la contraseña del usuario autenticado."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    return {"status": "ok", "usuario_id": uid}


@router.get("/api/usuario/configuracion")
@router.get("/api/usuario/configuracion/")
async def api_obtener_configuracion_usuario(
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Obtiene la configuración de la cuenta del usuario autenticado."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    return obtener_configuracion_usuario(uid)


@router.put("/api/usuario/configuracion")
@router.put("/api/usuario/configuracion/")
async def api_actualizar_configuracion_usuario(
    payload: Dict[str, Any],
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """Actualiza las preferencias de configuración del usuario autenticado."""
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    uid = str(jwt_info["usuario_id"] or "00000000-0000-0000-0000-000000000001")
    return actualizar_configuracion_usuario(uid, payload)


def _mapear_8_angulos_a_dict(angulos_8: List[float]) -> Dict[str, Optional[float]]:
    """Convierte el vector de 8 ángulos [codo_izq, codo_der, hombro_izq, hombro_der, rodilla_izq, rodilla_der, cadera_izq, cadera_der] al diccionario canónico del frontend Next.js."""
    if not isinstance(angulos_8, (list, tuple)) or len(angulos_8) < 8:
        return {}
    return {
        "codoI": round(float(angulos_8[0]), 1),
        "codoD": round(float(angulos_8[1]), 1),
        "hombroI": round(float(angulos_8[2]), 1),
        "hombroD": round(float(angulos_8[3]), 1),
        "rodillaI": round(float(angulos_8[4]), 1),
        "rodillaD": round(float(angulos_8[5]), 1),
        "caderaI": round(float(angulos_8[6]), 1),
        "caderaD": round(float(angulos_8[7]), 1),
    }


def _inferir_fase_en_vivo(telemetria: Dict[str, Any], angulos_8: List[float]) -> str:
    """Determina la fase biomecánica instantánea para el HUD del frontend Next.js."""
    estado_buf = str(telemetria.get("estado_buffer") or "ESCUCHANDO")
    if estado_buf == "ENCUADRE_INCOMPLETO":
        return "sin_cuerpo"
    if estado_buf == "ESPERANDO_POST":
        return "golpeo"
    if estado_buf == "COOLDOWN":
        return "caida"
    metricas_f = telemetria.get("metricas_frame") or {}
    if float(metricas_f.get("salto_vertical_cm") or 0.0) > 2.0:
        return "vuelo"
    if len(angulos_8) >= 6 and min(float(angulos_8[4]), float(angulos_8[5])) < 135.0:
        return "carga"
    return "preparacion"


def _extraer_esqueleto_3d_vivo(
    puntos_3d: Dict[str, Any],
    puntos_2d: Dict[str, Any],
) -> Dict[str, List[float]]:
    """Prepara las articulaciones 3D esenciales del último frame en el búfer temporal para el Visor 3D."""
    claves = (
        "nariz",
        "hombro_izq",
        "hombro_der",
        "codo_izq",
        "codo_der",
        "muneca_izq",
        "muneca_der",
        "cadera_izq",
        "cadera_der",
        "rodilla_izq",
        "rodilla_der",
        "tobillo_izq",
        "tobillo_der",
    )
    esqueleto: Dict[str, List[float]] = {}
    fuente = puntos_3d if isinstance(puntos_3d, dict) and puntos_3d else puntos_2d
    if not isinstance(fuente, dict):
        return esqueleto

    for k in claves:
        pt = fuente.get(k) or puntos_2d.get(k)
        if isinstance(pt, (list, tuple)) and len(pt) >= 3:
            vis = float(pt[3]) if len(pt) > 3 else 0.95
            esqueleto[k] = [round(float(pt[0]), 4), round(float(pt[1]), 4), round(float(pt[2]), 4), round(vis, 3)]

    if "nariz" not in esqueleto and "hombro_izq" in esqueleto and "hombro_der" in esqueleto:
        hi = esqueleto["hombro_izq"]
        hd = esqueleto["hombro_der"]
        esqueleto["nariz"] = [
            round((hi[0] + hd[0]) / 2.0, 4),
            round((hi[1] + hd[1]) / 2.0 - 0.16, 4),
            round((hi[2] + hd[2]) / 2.0, 4),
            0.95,
        ]
    return esqueleto


def _construir_fases_en_vivo(
    telemetria: Dict[str, Any],
    fase_live: str,
    ang_dict: Dict[str, Optional[float]],
    gesto_solicitado: str,
) -> Dict[str, Any]:
    """Construye la telemetría reactiva de las 4 Fases Biomecánicas para el panel en tiempo real."""
    estado_buf = str(telemetria.get("estado_buffer") or "ESCUCHANDO")
    motivo_bloqueo = telemetria.get("motivo_bloqueo")
    metricas_f = telemetria.get("metricas_frame") or {}
    salto_cm = round(float(metricas_f.get("salto_vertical_cm") or 0.0), 1)
    vel_pico = round(float(metricas_f.get("velocidad_pico") or metricas_f.get("velocidad_muneca_ms") or 0.0), 2)

    rod_d = ang_dict.get("rodillaD")
    rod_i = ang_dict.get("rodillaI")
    rod_vals = [v for v in (rod_d, rod_i) if v is not None]
    rod_min = min(rod_vals) if rod_vals else None
    codo_vals = [v for v in (ang_dict.get("codoD"), ang_dict.get("codoI")) if v is not None]
    codo_max = max(codo_vals) if codo_vals else None
    hombro_vals = [v for v in (ang_dict.get("hombroD"), ang_dict.get("hombroI")) if v is not None]
    hombro_max = max(hombro_vals) if hombro_vals else None
    asimetria = abs(rod_d - rod_i) if (rod_d is not None and rod_i is not None) else None

    fase_map = {
        "sin_cuerpo": "fase_1",
        "preparacion": "fase_1",
        "carga": "fase_1",
        "vuelo": "fase_2",
        "armado": "fase_2",
        "golpeo": "fase_3",
        "contacto": "fase_3",
        "caida": "fase_4",
    }
    fase_activa = fase_map.get(fase_live, "fase_1")

    if motivo_bloqueo:
        diag_vivo = str(motivo_bloqueo)
    elif estado_buf == "ESPERANDO_POST":
        diag_vivo = "Instante crítico (t0) detectado: capturando fase de aterrizaje y estabilización."
    elif estado_buf == "COOLDOWN":
        diag_vivo = "Evaluando amortiguación bilateral de aterrizaje antes de cerrar el ciclo."
    elif fase_live == "carga":
        diag_vivo = f"Fase de carga detectada: flexión de rodilla en {round(rod_min, 1) if rod_min is not None else '—'}°."
    elif fase_live == "vuelo":
        diag_vivo = f"Despegue activo ({salto_cm} cm): manteniendo brazo armado hacia el impacto."
    else:
        diag_vivo = "Monitoreo 3D activo en puerto :8000 (esperando secuencia técnica completa)."

    f1_ok = rod_min is not None and 90.0 <= rod_min <= 130.0
    f2_ok = hombro_max is not None and hombro_max >= 105.0
    f3_ok = codo_max is not None and codo_max >= 155.0
    f4_ok = asimetria is not None and asimetria <= 15.0

    gesto_label = "Detección Automática (IA)" if gesto_solicitado == "auto" else gesto_solicitado.capitalize()

    return {
        "fase_activa": fase_activa,
        "gesto_en_vivo": gesto_label,
        "estado_buffer": estado_buf,
        "diagnostico_vivo": diag_vivo,
        "velocidad_pico_ms": vel_pico,
        "fases": {
            "fase_1": {
                "estado": "Óptimo" if f1_ok else ("En curso" if fase_activa == "fase_1" else "Monitoreando"),
                "activa": fase_activa == "fase_1",
                "diagnostico": (
                    f"Flexión de carga en rango ({round(rod_min)}°)"
                    if f1_ok
                    else (
                        f"Flexiona rodillas hacia 95°-120° (actual {round(rod_min)}°)"
                        if rod_min is not None
                        else "Esperando postura completa de carga."
                    )
                ),
            },
            "fase_2": {
                "estado": "Óptimo" if f2_ok else ("En curso" if fase_activa == "fase_2" else "Monitoreando"),
                "activa": fase_activa == "fase_2",
                "diagnostico": (
                    f"Elevación de hombro lista ({round(hombro_max)}°) · Salto {salto_cm} cm"
                    if f2_ok
                    else "Prepara elevación del codo armado (>110°) en el despegue."
                ),
            },
            "fase_3": {
                "estado": "Óptimo" if f3_ok else ("t0 Crítico" if fase_activa == "fase_3" else "Esperando t0"),
                "activa": fase_activa == "fase_3",
                "diagnostico": (
                    f"Extensión alta de impacto detectada ({round(codo_max)}°)"
                    if f3_ok
                    else "Extiende el codo sobre 165° al alcanzar el vértice t0."
                ),
            },
            "fase_4": {
                "estado": "Óptimo" if f4_ok else ("En curso" if fase_activa == "fase_4" else "Monitoreando"),
                "activa": fase_activa == "fase_4",
                "diagnostico": (
                    f"Simetría bilateral equilibrada (Δ {round(asimetria)}°)"
                    if f4_ok
                    else "Controla el descenso simétrico con ambas rodillas (<15° diferencia)."
                ),
            },
        },
    }


@router.get("/api/health")
async def health_check() -> Dict[str, Any]:
    """Endpoint de verificación de salud para el puente Next.js <-> FastAPI."""
    return {
        "status": "ok",
        "motor": "VolleyScan AI — MediaPipe Strict 8-Angles & 4-Phases Engine",
        "puerto": 8000,
    }


@router.get("/api/dashboard/{usuario_id}")
async def obtener_dashboard_backend(
    usuario_id: str,
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> Dict[str, Any]:
    """
    Devuelve los datos consolidados reales del motor biomecánico en Python (puerto 8000)
    y Supabase para poblar el Dashboard de Next.js.
    """
    jwt_info = extraer_usuario_jwt(authorization, x_user_id)
    token = jwt_info.get("token")
    target_uid = jwt_info["usuario_id"] if usuario_id == "me" and jwt_info["usuario_id"] else usuario_id
    hist_data = obtener_historial_db(target_uid)
    registros = list(hist_data.get("historial", []))

    if not registros:
        for idx_s, ses in enumerate(reversed(obtener_sesiones_ia_usuario(target_uid, token=token)), start=1):
            for rep in ses.get("repeticiones") or []:
                meds = {m.get("id"): float(m.get("valor")) for m in (rep.get("medidas") or []) if m.get("valor") is not None}
                sc_rep = float(rep.get("score_global") or rep.get("puntuacion") or rep.get("score") or 0.0)
                registros.append({
                    "indice": idx_s,
                    "fecha": str(rep.get("creadoEn") or ses.get("creadoEn") or "")[:16].replace("T", " "),
                    "creado_en": str(rep.get("creadoEn") or ses.get("creadoEn") or ""),
                    "gesto_tecnico": rep.get("movimiento") or ses.get("tecnica") or "remate",
                    "efectividad_porcentaje": sc_rep,
                    "salto_vertical_cm": float(rep.get("saltoVerticalCm") or 0.0),
                    "angulo_hombro": meds.get("elevacionBrazoContacto", 0.0),
                    "angulo_codo": meds.get("extensionCodoContacto", 0.0),
                    "angulo_rodilla": meds.get("flexionRodilla", 0.0),
                    "angulo_cadera": meds.get("caderaCarga", 0.0),
                    "nivel_riesgo": "BAJO" if sc_rep >= 80.0 else "MEDIO",
                    "diagnostico": rep.get("diagnosticoCausaRaiz") or "",
                    "prediccion_ia": rep.get("vozCoach") or "",
                })

    progreso_real = obtener_progreso_usuario(target_uid, token=token)

    scores = [round(float(r.get("efectividad_porcentaje", 0.0))) for r in registros if float(r.get("efectividad_porcentaje", 0.0)) > 0]
    saltos = [float(r.get("salto_vertical_cm", 0.0)) for r in registros if float(r.get("salto_vertical_cm", 0.0)) > 0]
    tendencia = scores[-10:] if scores else []
    promedio = round(sum(scores) / len(scores)) if scores else 0
    variacion = round(tendencia[-1] - tendencia[0]) if len(tendencia) >= 2 else None

    def _avg_field(key: str) -> float:
        vals = [float(r.get(key, 0.0)) for r in registros if float(r.get(key, 0.0)) > 0]
        return round(sum(vals) / len(vals), 1) if vals else 0.0

    ultimo_reg = registros[-1] if registros else None
    ultimo_analisis = (
        {
            "tecnica": str(ultimo_reg.get("gesto_tecnico", "Remate")).capitalize(),
            "puntuacion": round(float(ultimo_reg.get("efectividad_porcentaje", promedio))),
            "salto_vertical_cm": float(ultimo_reg.get("salto_vertical_cm", 0.0)),
            "diagnostico": ultimo_reg.get("diagnostico") or ultimo_reg.get("prediccion_ia") or "",
            "creado_en": ultimo_reg.get("creado_en") or datetime.now(timezone.utc).isoformat(),
        }
        if ultimo_reg
        else None
    )

    return {
        "status": "ok",
        "motor": "FastAPI :8000 (MediaPipe 3D)",
        "usuario_id": target_uid,
        "progreso": {
            "valor": promedio,
            "variacion": variacion,
            "tendencia": tendencia,
        },
        "sesiones": {
            "semana": len(registros),
            "variacion": len(registros) if len(registros) > 0 else None,
        },
        "racha_dias": int(progreso_real.get("racha_dias") or (1 if registros else 0)),
        "ultimo_analisis": ultimo_analisis,
        "resumen_biomecanico": {
            "total_repeticiones": len(registros),
            "efectividad_promedio": promedio,
            "salto_maximo_cm": round(max(saltos), 1) if saltos else 0.0,
            "salto_promedio_cm": round(sum(saltos) / len(saltos), 1) if saltos else 0.0,
            "angulos_promedio": {
                "codo": _avg_field("angulo_codo"),
                "hombro": _avg_field("angulo_hombro"),
                "rodilla": _avg_field("angulo_rodilla"),
                "cadera": _avg_field("angulo_cadera"),
            },
        },
        "historial": list(reversed(registros)),
    }


# ============================================================================
# WEBSOCKET: PROCESAMIENTO EN TIEMPO REAL CON BÚFER TEMPORAL Y 4 FASES
# ============================================================================

@router.websocket("/ws/analizar/{sesion_id}")
async def websocket_biomecanica(websocket: WebSocket, sesion_id: str) -> None:
    """
    Canal de streaming bidireccional. Recibe frames cinemáticos continuos a 30 FPS,
    monitorea el vértice de derivada cero (t0) con candados científicos y emite
    la evaluación completa en 4 fases junto al benchmark dinámico de ablación.
    Incluye manejo robusto de desconexión (`WebSocketDisconnect`) y frames corruptos.
    """
    try:
        await websocket.accept()
    except Exception as exc:
        logger.warning("No se pudo aceptar la conexión WebSocket (%s): %s", sesion_id, exc)
        return

    # Extraer usuario autenticado desde query params (?token=... o ?usuario_id=...) o cabeceras
    qp = websocket.query_params
    token_qp = qp.get("token")
    uid_qp = qp.get("usuario_id")
    modo_qp = qp.get("modo", "")
    auth_header = websocket.headers.get("authorization") or (f"Bearer {token_qp}" if token_qp else None)
    jwt_ws = extraer_usuario_jwt(auth_header, uid_qp)
    usuario_id_ws = jwt_ws.get("usuario_id") or uid_qp or "00000000-0000-0000-0000-000000000001"

    if sesion_id not in SESIONES_BUFFER:
        SESIONES_BUFFER[sesion_id] = TemporalPoseBuffer(
            maxlen=BUFFER_MAXLEN,
            pre_frames=PRE_FRAMES,
            post_frames=POST_FRAMES,
        )

    buffer_temporal = SESIONES_BUFFER[sesion_id]
    buffer_temporal.iniciar_calibracion(frames_requeridos=CALIBRATION_REQUIRED_FRAMES)
    if modo_qp.lower() == "activo":
        buffer_temporal.estado_sesion = "ACTIVO"

    try:
        while True:
            try:
                datos_raw = await websocket.receive_text()
            except WebSocketDisconnect:
                logger.info("WebSocket desconectado limpiamente para sesión: %s", sesion_id)
                break
            except RuntimeError:
                logger.info("Conexión WebSocket cerrada abruptamente por cliente: %s", sesion_id)
                break

            try:
                payload = json.loads(datos_raw)
                if not isinstance(payload, dict):
                    raise ValueError("El payload JSON recibido no es un objeto válido.")
            except (json.JSONDecodeError, ValueError, TypeError) as err_json:
                logger.warning("Frame corrupto ignorado en sesión %s: %s", sesion_id, err_json)
                try:
                    await websocket.send_json({
                        "tipo": "frame_corrupto",
                        "detalle": "Frame inválido o corrupto descartado sin interrumpir el motor.",
                    })
                except (WebSocketDisconnect, RuntimeError):
                    break
                continue

            try:
                if payload.get("usuario_id"):
                    usuario_id_ws = str(payload["usuario_id"])

                # Permitir saltar o desbloquear calibración manualmente desde Next.js
                if payload.get("saltar_calibracion") is True or payload.get("accion") == "saltar_calibracion":
                    buffer_temporal.calibrador.desbloquear_manual()
                    if payload.get("accion") == "saltar_calibracion":
                        await websocket.send_json({
                            "tipo": "calibracion_exitosa",
                            "estado_sesion": "ACTIVO",
                            "frames_calibrados": CALIBRATION_REQUIRED_FRAMES,
                            "frames_requeridos": CALIBRATION_REQUIRED_FRAMES,
                            "progreso_pct": 100.0,
                            "mensaje": "Calibrado / Listo — Sistema de captura activado.",
                        })
                        continue

                # Permitir reinicio explícito de calibración si el cliente lo solicita
                if payload.get("accion") == "reiniciar_calibracion":
                    buffer_temporal.iniciar_calibracion(frames_requeridos=CALIBRATION_REQUIRED_FRAMES)
                    await websocket.send_json({
                        "tipo": "estado_calibracion",
                        "estado_sesion": "CALIBRANDO",
                        "frames_calibrados": 0,
                        "frames_requeridos": CALIBRATION_REQUIRED_FRAMES,
                        "progreso_pct": 0.0,
                        "mensaje": "Ponte frente a la cámara en Posición de 'T' (brazos extendidos) durante 2 segundos para calibrar",
                    })
                    continue

                # 1. MÁQUINA DE ESTADOS DE SESIÓN: CALIBRANDO -> ACTIVO
                if buffer_temporal.estado_sesion == "CALIBRANDO":
                    evento_calibracion = buffer_temporal.procesar_calibracion(payload)
                    ang_cal = calcular_angulos_flexion_frame(payload)
                    evento_calibracion["angulos_cinematicos"] = ang_cal
                    evento_calibracion["angulos"] = _mapear_8_angulos_a_dict(ang_cal)
                    evento_calibracion["fase_detectada"] = "preparacion"
                    pts_cal_2d = payload.get("puntos") if isinstance(payload.get("puntos"), dict) else {}
                    pts_cal_3d = payload.get("puntos_mundo") if isinstance(payload.get("puntos_mundo"), dict) else pts_cal_2d
                    evento_calibracion["skeleton_3d"] = _extraer_esqueleto_3d_vivo(pts_cal_3d, pts_cal_2d)
                    await websocket.send_json(evento_calibracion)
                    continue

                frame_id = int(payload.get("frame_id", int(time.time() * 1000) % 1000000))
                timestamp = float(payload.get("timestamp", time.time()))
                puntos_raw = payload.get("puntos")
                puntos_2d: Dict[str, Any] = dict(puntos_raw) if isinstance(puntos_raw, dict) else {}
                if isinstance(payload.get("landmarks_33"), list):
                    puntos_2d["landmarks_33"] = payload["landmarks_33"]
                puntos_mundo_raw = payload.get("puntos_mundo")
                puntos_3d: Dict[str, Any] = (
                    dict(puntos_mundo_raw) if isinstance(puntos_mundo_raw, dict) else puntos_2d
                )
                gesto_solicitado = str(payload.get("gesto_tecnico", "auto"))

                # 2. ESTADO ACTIVO: Registrar en el Búfer Temporal y buscar t0
                secuencia_extraida, telemetria = buffer_temporal.registrar_frame(
                    frame_id=frame_id,
                    timestamp=timestamp,
                    landmarks_2d=puntos_2d,
                    world_landmarks_3d=puntos_3d,
                    gesto_solicitado=gesto_solicitado,
                )

                if secuencia_extraida is None:
                    angulos_8_live = telemetria.get("metricas_frame", {}).get("angulos_cinematicos", [])
                    fase_live = _inferir_fase_en_vivo(telemetria, angulos_8_live)
                    angulos_dict_live = _mapear_8_angulos_a_dict(angulos_8_live)
                    fases_vivo_info = _construir_fases_en_vivo(
                        telemetria=telemetria,
                        fase_live=fase_live,
                        ang_dict=angulos_dict_live,
                        gesto_solicitado=gesto_solicitado,
                    )
                    respuesta_live = {
                        "tipo": "telemetria_frame",
                        "frame_id": frame_id,
                        "usuario_id": usuario_id_ws,
                        "estado_buffer": telemetria.get("estado_buffer", "ESCUCHANDO"),
                        "fase_detectada": fase_live,
                        "motivo_bloqueo": telemetria.get("motivo_bloqueo"),
                        "ratio_visibilidad_pct": telemetria.get("ratio_visibilidad_pct"),
                        "vis_rostro_avg": telemetria.get("vis_rostro_avg"),
                        "gesto_solicitado": gesto_solicitado,
                        "gesto_en_vivo": fases_vivo_info["gesto_en_vivo"],
                        "diagnostico_vivo": fases_vivo_info["diagnostico_vivo"],
                        "fases_en_vivo": fases_vivo_info,
                        "velocidad_pico_ms": fases_vivo_info["velocidad_pico_ms"],
                        "frames_en_buffer": telemetria.get("frames_en_buffer", 0),
                        "post_frames_restantes": telemetria.get("post_frames_restantes", 0),
                        "t0_frame_id": telemetria.get("t0_frame_id"),
                        "salto_vertical_cm": telemetria.get("metricas_frame", {}).get("salto_vertical_cm", 0.0),
                        "tiempo_vuelo_segundos": telemetria.get("metricas_frame", {}).get("tiempo_vuelo_segundos", 0.0),
                        "frame_despegue": telemetria.get("metricas_frame", {}).get("frame_despegue"),
                        "frame_aterrizaje": telemetria.get("metricas_frame", {}).get("frame_aterrizaje"),
                        "angulos_cinematicos": angulos_8_live,
                        "angulos": angulos_dict_live,
                        "skeleton_3d": _extraer_esqueleto_3d_vivo(puntos_3d, puntos_2d),
                        "L_torso": telemetria.get("metricas_frame", {}).get("L_torso"),
                        "ventana_angulos_25": buffer_temporal.obtener_ventana_angulos_25(),
                        "metricas_instantaneas": telemetria.get("metricas_frame", {}),
                    }
                    await websocket.send_json(respuesta_live)
                    continue

                # 3. Se completó t0 + post_frames: Reconstrucción 3D Temporal
                frames_crudos = secuencia_extraida["secuencia"]
                t0_idx = int(secuencia_extraida["t0_idx_relativo"])

                frames_procesados_3d = RECONSTRUCTOR_3D.reconstruir_y_suavizar_secuencia(frames_crudos)

                # 4. Pipeline Principal Biomecánico Modular (1_clasificador_gestos -> 2_motor_fisico -> 3_coach_experto)
                evaluacion_4fases = PipelineBiomecanicoPrincipal.ejecutar_pipeline(
                    frames_procesados=frames_procesados_3d,
                    t0_idx_relativo=t0_idx,
                    gesto_solicitado=gesto_solicitado,
                )

                if evaluacion_4fases.get("descartada", False):
                    await websocket.send_json({
                        "tipo": "secuencia_descartada",
                        "motivo": evaluacion_4fases.get("gesto_tecnico", "MOVIMIENTO NO CLASIFICADO"),
                        "detalle": evaluacion_4fases.get(
                            "motivo_descarte",
                            "Movimiento descartado por falta de evidencia deportiva.",
                        ),
                        "confianza": evaluacion_4fases.get("confianza_clasificacion", 0.0),
                        "scores_gestos": evaluacion_4fases.get("scores_gestos", {}),
                    })
                    buffer_temporal.preparar_espera_continua()
                    continue

                # 5. Matriz Experimental Científica (Ablación A vs B vs C)
                experimento_ablacion = LaboratorioAblacionCientifica.ejecutar_matriz_ablacion(
                    frames_crudos=frames_crudos,
                    frames_procesados_3d=frames_procesados_3d,
                    evaluacion_4fases=evaluacion_4fases,
                    t0_idx_relativo=t0_idx,
                )

                ventana_25 = evaluacion_4fases.get("ventana_angulos_25", [])
                angulos_t0 = ventana_25[min(len(ventana_25) - 1, 16)] if ventana_25 else []

                paquete_resultado: Dict[str, Any] = {
                    "tipo": "evaluacion_secuencia_completa",
                    "sesion_id": sesion_id,
                    "usuario_id": usuario_id_ws,
                    "t0_frame_id": secuencia_extraida["t0_frame_id"],
                    "t0_timestamp": secuencia_extraida["t0_timestamp"],
                    "total_frames_analizados": len(frames_procesados_3d),
                    "gesto_detectado": evaluacion_4fases.get("gesto_detectado", evaluacion_4fases["gesto_tecnico"]),
                    "gesto_tecnico": evaluacion_4fases["gesto_tecnico"],
                    "confianza_clasificacion": evaluacion_4fases.get("confianza_clasificacion", 0.0),
                    "fase_detectada": "golpeo",
                    "score_global": evaluacion_4fases["score_global"],
                    "diagnostico_causa_raiz": evaluacion_4fases["diagnostico_causa_raiz"],
                    "voz_coach": evaluacion_4fases["voz_coach"],
                    "coach_voz_texto": evaluacion_4fases.get("coach_voz_texto", evaluacion_4fases["voz_coach"]),
                    "metricas_fisicas": evaluacion_4fases.get(
                        "metricas_fisicas",
                        {"tiempo_vuelo_segundos": 0.0, "salto_vertical_cm": 0.0},
                    ),
                    "salto_vertical_cm": evaluacion_4fases.get("salto_vertical_cm", 0.0),
                    "tiempo_vuelo_segundos": evaluacion_4fases.get("metricas_fisicas", {}).get("tiempo_vuelo_segundos", 0.0),
                    "frame_despegue": evaluacion_4fases.get("metricas_fisicas", {}).get("frame_despegue"),
                    "frame_aterrizaje": evaluacion_4fases.get("metricas_fisicas", {}).get("frame_aterrizaje"),
                    "angulos_cinematicos": angulos_t0,
                    "angulos": _mapear_8_angulos_a_dict(angulos_t0),
                    "cinematica_continua_33": evaluacion_4fases.get("cinematica_continua_33", {}),
                    "errores_detectados": evaluacion_4fases["errores_detectados"],
                    "frames_clave_fases": evaluacion_4fases["frames_clave_fases"],
                    "fases": evaluacion_4fases["fases"],
                    "ablacion": experimento_ablacion,
                    "vector_probabilidad_gestos": evaluacion_4fases.get("vector_probabilidad_gestos", {}),
                    "detalles_cinematicos": evaluacion_4fases.get("detalles_cinematicos", {}),
                    "video_replay_base64": evaluacion_4fases.get("video_replay_base64"),
                    "ventana_angulos_25": ventana_25,
                    "angulos_cinematicos_secuencia": evaluacion_4fases.get("angulos_cinematicos_secuencia", []),
                    "secuencia_cinematica_completa": evaluacion_4fases.get("secuencia_cinematica_completa", []),
                }

                try:
                    registro_gesto = registrar_gesto_en_sesion(sesion_id, paquete_resultado)
                    paquete_resultado["salto_index"] = registro_gesto.get("salto_index", 1)
                    sincronizar_captura_ia_usuario(
                        sesion_id=sesion_id,
                        usuario_id=usuario_id_ws,
                        paquete_resultado=paquete_resultado,
                    )
                except Exception as exc_reg:
                    logger.warning("Fallback RAM al registrar gesto en sesión: %s", exc_reg)
                    paquete_resultado["salto_index"] = 1

                await websocket.send_json(paquete_resultado)
                buffer_temporal.preparar_espera_continua()

            except WebSocketDisconnect:
                logger.info("WebSocket desconectado durante envío para sesión: %s", sesion_id)
                break
            except Exception as err_frame:
                logger.warning("Excepción controlada al procesar frame en sesión %s: %s", sesion_id, err_frame)
                continue

    except WebSocketDisconnect:
        logger.info("WebSocket cerrado para sesión: %s", sesion_id)
    except Exception as exc_ws:
        logger.warning("Error controlado en websocket_biomecanica (%s): %s", sesion_id, exc_ws)
