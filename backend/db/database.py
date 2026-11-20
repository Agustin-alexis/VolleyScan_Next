"""
Módulo de Persistencia y Base de Datos (Supabase + Local Fallback).
Permite registrar sesiones de entrenamiento, reportes semanales y secuencias analizadas.
"""

import os
import re
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import numpy as np
from dotenv import load_dotenv
from fastapi import HTTPException

try:
    from supabase import Client, create_client
except ImportError:
    Client = None
    create_client = None

from backend.core.config import SUPABASE_KEY, SUPABASE_URL

supabase: Optional[Any] = None
if SUPABASE_URL and SUPABASE_KEY and create_client:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Aviso al inicializar Supabase: {e}")

# ============================================================================
# MOTOR DE SESIONES LONGITUDINALES Y REGISTRO INDIVIDUAL CONTINUO
# ============================================================================
SESIONES_ENTRENAMIENTO: Dict[str, Dict[str, Any]] = {}
SESION_ACTIVA_ID: Optional[str] = None
LOCK_SESIONES = threading.Lock()

# Almacén en memoria de respaldo para funcionamiento sin conexión y fallback 401
MEMORIA_SESIONES: List[Dict[str, Any]] = []
MEMORIA_ANALISIS: List[Dict[str, Any]] = []
memoria_respaldo_sesion: List[Dict[str, Any]] = []


def crear_sesion_entrenamiento(
    usuario_id: str = "00000000-0000-0000-0000-000000000001",
    dispositivo: str = "Web / Canvas 3D",
) -> Dict[str, Any]:
    """
    Crea una nueva sesión de entrenamiento longitudinal vinculada al `usuario_id` autenticado.
    Estructura: sesion_id (UUID o timestamp), fecha_inicio, y gestos_registrados = [].
    """
    global SESION_ACTIVA_ID
    sesion_id = f"trn_{uuid.uuid4().hex[:8]}_{int(time.time())}"
    supabase_sesion_id: Optional[str] = None

    # Si Supabase está conectado, registrar en base de datos externa y capturar el UUID de la sesión
    if supabase:
        try:
            res_s = supabase.table("sesiones_entrenamiento").insert({
                "usuario_id": usuario_id,
                "gesto_tecnico": "entrenamiento_continuo",
                "dispositivo": dispositivo,
            }).execute()
            if getattr(res_s, "data", None) and len(res_s.data) > 0:
                supabase_sesion_id = str(res_s.data[0].get("id") or "")
        except Exception as e:
            print(f"[FALLBACK RAM ACTIVO] Aviso Supabase 401/offline ({e}). Sesión guardada 100% en memoria RAM.")

    nueva_sesion = {
        "sesion_id": sesion_id,
        "supabase_sesion_id": supabase_sesion_id,
        "usuario_id": usuario_id,
        "dispositivo": dispositivo,
        "fecha_inicio": datetime.now(timezone.utc).isoformat(),
        "gestos_registrados": [],
        "total_gestos": 0,
    }

    with LOCK_SESIONES:
        SESIONES_ENTRENAMIENTO[sesion_id] = nueva_sesion
        SESION_ACTIVA_ID = sesion_id

    MEMORIA_SESIONES.append({
        "id": sesion_id,
        "supabase_sesion_id": supabase_sesion_id,
        "usuario_id": usuario_id,
        "dispositivo": dispositivo,
        "fecha": nueva_sesion["fecha_inicio"],
    })

    return nueva_sesion


def obtener_sesion_entrenamiento(sesion_id: str) -> Optional[Dict[str, Any]]:
    """Devuelve la sesión activa o registrada."""
    with LOCK_SESIONES:
        return SESIONES_ENTRENAMIENTO.get(sesion_id)


def registrar_gesto_en_sesion(
    sesion_id: str,
    evaluacion_completa: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Inyecta automáticamente el JSON completo de las 4 Fases de un movimiento evaluado
    (fotogramas clave, ángulos, error de escorzo corregido, efectividad y causa raíz)
    en la lista 'gestos_registrados' de la sesión activa ANTES de enviarlo por WebSocket.
    Asigna un 'salto_index' correlativo.
    """
    global SESION_ACTIVA_ID
    with LOCK_SESIONES:
        target_id = sesion_id
        if not target_id or target_id not in SESIONES_ENTRENAMIENTO:
            if SESION_ACTIVA_ID and SESION_ACTIVA_ID in SESIONES_ENTRENAMIENTO:
                target_id = SESION_ACTIVA_ID
            else:
                # Inicializar sesión automática al vuelo si no existe
                target_id = f"trn_{uuid.uuid4().hex[:8]}_{int(time.time())}"
                SESIONES_ENTRENAMIENTO[target_id] = {
                    "sesion_id": target_id,
                    "usuario_id": "00000000-0000-0000-0000-000000000001",
                    "dispositivo": "Web / Canvas 3D",
                    "fecha_inicio": datetime.now(timezone.utc).isoformat(),
                    "gestos_registrados": [],
                    "total_gestos": 0,
                }
                SESION_ACTIVA_ID = target_id

        sesion = SESIONES_ENTRENAMIENTO[target_id]
        salto_index = len(sesion["gestos_registrados"]) + 1

        # Error de escorzo 2D vs 3D corregido obtenido de la ablación
        resumen_abl = evaluacion_completa.get("ablacion", {}).get("resumen_cientifico", {})
        error_escorzo_corregido = resumen_abl.get("discrepancia_angular_codo_2d_vs_3d", 0.0)

        # Ángulos clave extraídos de las 4 fases
        fases = evaluacion_completa.get("fases", {})
        angulos_fases = {
            "fase_1": fases.get("fase_1", {}).get("metricas_clave", {}),
            "fase_2": fases.get("fase_2", {}).get("metricas_clave", {}),
            "fase_3": fases.get("fase_3", {}).get("metricas_clave", {}),
            "fase_4": fases.get("fase_4", {}).get("metricas_clave", {}),
        }

        gesto_item = {
            "salto_index": salto_index,
            "t0_frame_id": evaluacion_completa.get("t0_frame_id"),
            "timestamp": evaluacion_completa.get("t0_timestamp", time.time()),
            "fecha": datetime.now(timezone.utc).isoformat(),
            "gesto_tecnico": evaluacion_completa.get("gesto_tecnico", "remate"),
            "efectividad": evaluacion_completa.get("score_global", 0.0),
            "score_global": evaluacion_completa.get("score_global", 0.0),
            "causa_raiz": evaluacion_completa.get("diagnostico_causa_raiz", ""),
            "diagnostico_causa_raiz": evaluacion_completa.get("diagnostico_causa_raiz", ""),
            "voz_coach": evaluacion_completa.get("voz_coach", ""),
            "coach_voz_texto": evaluacion_completa.get("coach_voz_texto", evaluacion_completa.get("voz_coach", "")),
            "metricas_fisicas": evaluacion_completa.get("metricas_fisicas", {"tiempo_vuelo_segundos": 0.0, "salto_vertical_cm": 0.0}),
            "cinematica_continua_33": evaluacion_completa.get("cinematica_continua_33", {}),
            "error_escorzo_corregido": error_escorzo_corregido,
            "fotogramas_clave": evaluacion_completa.get("frames_clave_fases", {}),
            "frames_clave_fases": evaluacion_completa.get("frames_clave_fases", {}),
            "angulos": angulos_fases,
            "fases": fases,
            "ablacion": evaluacion_completa.get("ablacion", {}),
            "detalles_cinematicos": evaluacion_completa.get("detalles_cinematicos", {}),
            "video_replay_base64": evaluacion_completa.get("video_replay_base64"),
            "angulos_cinematicos_secuencia": evaluacion_completa.get("angulos_cinematicos_secuencia", []),
            "secuencia_cinematica_completa": evaluacion_completa.get("secuencia_cinematica_completa", []),
        }

        sesion["gestos_registrados"].append(gesto_item)
        sesion["total_gestos"] = len(sesion["gestos_registrados"])
        memoria_respaldo_sesion.append(gesto_item)

        # Enlazar salto_index y sesion_id en el paquete saliente
        evaluacion_completa["salto_index"] = salto_index
        evaluacion_completa["sesion_id"] = target_id

    # Disparar guardado en segundo plano
    disparar_guardado_background(target_id, evaluacion_completa)
    return gesto_item


def obtener_historial_sesion(sesion_id: str) -> Optional[Dict[str, Any]]:
    """Devuelve la lista ordenada cronológicamente de todos los gestos registrados en esa sesión."""
    with LOCK_SESIONES:
        sesion = SESIONES_ENTRENAMIENTO.get(sesion_id)
        if not sesion:
            # Buscar en almacén secundario si coincide
            for s in MEMORIA_SESIONES:
                if s.get("id") == sesion_id:
                    return {
                        "sesion_id": sesion_id,
                        "fecha_inicio": s.get("fecha", datetime.now(timezone.utc).isoformat()),
                        "usuario_id": s.get("usuario_id", "default_user"),
                        "total_gestos": 0,
                        "gestos_registrados": [],
                    }
            return None

        # Ordenar cronológicamente por timestamp / salto_index
        gestos_ordenados = sorted(sesion["gestos_registrados"], key=lambda g: g.get("salto_index", 0))

        return {
            "sesion_id": sesion["sesion_id"],
            "fecha_inicio": sesion["fecha_inicio"],
            "usuario_id": sesion.get("usuario_id", "default_user"),
            "dispositivo": sesion.get("dispositivo", "Web / Canvas 3D"),
            "total_gestos": len(gestos_ordenados),
            "gestos_registrados": gestos_ordenados,
        }


def crear_sesion_db(usuario_id: str, gesto_tecnico: str, dispositivo: str) -> Dict[str, Any]:
    nueva_sesion = crear_sesion_entrenamiento(usuario_id=usuario_id, dispositivo=dispositivo)
    return {
        "id": nueva_sesion["sesion_id"],
        "usuario_id": nueva_sesion["usuario_id"],
        "gesto_tecnico": gesto_tecnico,
        "dispositivo": dispositivo,
        "fecha": nueva_sesion["fecha_inicio"],
    }


def _asegurar_sesion_supabase(
    sesion_id: Optional[str],
    usuario_id: str,
    gesto_tecnico: str = "remate",
) -> Optional[str]:
    """
    Resuelve o crea en Supabase (`sesiones_entrenamiento`) un UUID de sesión válido
    vinculado al `usuario_id` autenticado para que `analisis_biomecanicos` siempre tenga FK válida.
    """
    if not supabase:
        return None

    with LOCK_SESIONES:
        if sesion_id and sesion_id in SESIONES_ENTRENAMIENTO:
            supa_id = SESIONES_ENTRENAMIENTO[sesion_id].get("supabase_sesion_id")
            if supa_id:
                return str(supa_id)

    # Si sesion_id ya tiene formato UUID estándar, podemos intentar usarlo o crear uno para el usuario
    try:
        res_s = supabase.table("sesiones_entrenamiento").insert({
            "usuario_id": usuario_id or "00000000-0000-0000-0000-000000000001",
            "gesto_tecnico": gesto_tecnico,
            "dispositivo": "VolleyScan Next.js 3D",
        }).execute()
        if getattr(res_s, "data", None) and len(res_s.data) > 0:
            nuevo_supa_id = str(res_s.data[0].get("id") or "")
            if nuevo_supa_id and sesion_id:
                with LOCK_SESIONES:
                    if sesion_id in SESIONES_ENTRENAMIENTO:
                        SESIONES_ENTRENAMIENTO[sesion_id]["supabase_sesion_id"] = nuevo_supa_id
            return nuevo_supa_id or None
    except Exception:
        pass
    return None


def escribir_analisis_en_hilo(sesion_id: str, resultado: Dict[str, Any]) -> None:
    """Guarda el análisis biomecánico temporal (con los 8 ángulos, fase y salto) en Supabase bajo el usuario autenticado."""
    if not sesion_id or sesion_id == "demo":
        return

    usuario_id = str(
        resultado.get("usuario_id")
        or (SESIONES_ENTRENAMIENTO.get(sesion_id) or {}).get("usuario_id")
        or "00000000-0000-0000-0000-000000000001"
    )
    salto_cm = float(
        resultado.get("salto_vertical_cm")
        or (resultado.get("metricas_fisicas") or {}).get("salto_vertical_cm", 0.0)
        or 0.0
    )
    angulos_8 = resultado.get("angulos_cinematicos") or []

    registro = {
        "sesion_id": sesion_id,
        "usuario_id": usuario_id,
        "gesto_tecnico": resultado.get("gesto_tecnico", "remate"),
        "fase_detectada": resultado.get("fase_detectada", "contacto"),
        "salto_vertical_cm": salto_cm,
        "angulos_cinematicos": angulos_8,
        "score_global": resultado.get("score_global", 0.0),
        "diagnostico_causa_raiz": resultado.get("diagnostico_causa_raiz", ""),
        "voz_coach": resultado.get("voz_coach", ""),
        "fases": resultado.get("fases", {}),
        "ablacion": resultado.get("ablacion", {}),
        "creado_en": datetime.now(timezone.utc).isoformat(),
    }

    # Guardar SIEMPRE en memoria RAM primero como respaldo garantizado
    MEMORIA_ANALISIS.append(registro)
    memoria_respaldo_sesion.append(registro)

    if supabase:
        try:
            f3 = resultado.get("fases", {}).get("fase_3", {}).get("metricas_clave", {})
            f1 = resultado.get("fases", {}).get("fase_1", {}).get("metricas_clave", {})
            supa_sesion_id = _asegurar_sesion_supabase(
                sesion_id,
                usuario_id=usuario_id,
                gesto_tecnico=str(resultado.get("gesto_tecnico", "remate")),
            ) or sesion_id

            correcciones_lista = [resultado.get("diagnostico_causa_raiz", "")]
            if salto_cm > 0:
                correcciones_lista.append(f"Altura de salto vertical: {salto_cm:.1f} cm")

            score_real = resultado.get("score_global")
            if score_real is None:
                fases_r = resultado.get("fases") or {}
                pesos_r = (("fase_1", 0.20), ("fase_2", 0.25), ("fase_3", 0.35), ("fase_4", 0.20))
                vals_r = [
                    (float(fases_r[k]["score"]), w)
                    for k, w in pesos_r
                    if isinstance(fases_r.get(k), dict) and fases_r[k].get("score") is not None
                ]
                score_real = round(sum(v * w for v, w in vals_r) / sum(w for _, w in vals_r), 1) if vals_r else 0.0
            score_real_f = float(score_real)

            datos_supabase = {
                "sesion_id": supa_sesion_id,
                "gesto_tecnico": resultado.get("gesto_tecnico", "remate"),
                "angulo_hombro": f3.get("angulo_hombro_contacto_3d", 0.0),
                "angulo_codo": f3.get("angulo_codo_contacto_3d", 0.0),
                "angulo_rodilla": f1.get("angulo_rodilla_3d", 0.0),
                "angulo_cadera": f1.get("angulo_cadera_3d", 0.0),
                "efectividad_porcentaje": score_real_f,
                "riesgo_lesion_porcentaje": round(max(0.0, 100.0 - score_real_f), 1),
                "nivel_riesgo": "BAJO" if score_real_f >= 80.0 else "MEDIO",
                "zona_riesgo": "Cadena Cinética Integral",
                "correcciones": [c for c in correcciones_lista if c],
                "prediccion_ia": resultado.get("voz_coach", ""),
            }
            supabase.table("analisis_biomecanicos").insert(datos_supabase).execute()
            return
        except Exception as e:
            print(f"[FALLBACK RAM ACTIVO] Enmascarando error 401 de Supabase al guardar análisis ({e}). Guardado en memoria_respaldo_sesion.")


def guardar_salto_con_fallback(sesion_id: str, salto_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    Persiste las métricas de salto, 8 ángulos y diagnóstico en Supabase vinculadas al `usuario_id`
    autenticado (vía `sesiones_entrenamiento` -> `analisis_biomecanicos`) y en memoria local RAM.
    """
    usuario_id = str(salto_json.get("usuario_id") or "00000000-0000-0000-0000-000000000001")
    gesto_tecnico = str(salto_json.get("gesto_tecnico") or "remate")
    salto_cm = float(salto_json.get("salto_vertical_cm") or 0.0)
    sincronizado_supabase = False

    try:
        if supabase:
            supa_sesion_id = _asegurar_sesion_supabase(sesion_id, usuario_id, gesto_tecnico) or sesion_id
            correcciones_raw = salto_json.get("correcciones")
            correcciones_list = list(correcciones_raw) if isinstance(correcciones_raw, list) else []
            if salto_json.get("diagnostico_causa_raiz") and salto_json["diagnostico_causa_raiz"] not in correcciones_list:
                correcciones_list.insert(0, str(salto_json["diagnostico_causa_raiz"]))
            if salto_cm > 0:
                correcciones_list.append(f"Salto vertical: {salto_cm:.1f} cm")

            sc_salto = salto_json.get("efectividad_porcentaje")
            if sc_salto is None:
                sc_salto = salto_json.get("score_global")
            if sc_salto is None:
                sc_salto = salto_json.get("puntuacion")
            sc_salto_f = float(sc_salto) if sc_salto is not None else 0.0
            fila_limpia = {
                "sesion_id": supa_sesion_id,
                "gesto_tecnico": gesto_tecnico,
                "angulo_hombro": float(salto_json.get("angulo_hombro") or 0.0),
                "angulo_codo": float(salto_json.get("angulo_codo") or 0.0),
                "angulo_rodilla": float(salto_json.get("angulo_rodilla") or 0.0),
                "angulo_cadera": float(salto_json.get("angulo_cadera") or 0.0),
                "efectividad_porcentaje": sc_salto_f,
                "riesgo_lesion_porcentaje": float(salto_json.get("riesgo_lesion_porcentaje") if salto_json.get("riesgo_lesion_porcentaje") is not None else round(max(0.0, 100.0 - sc_salto_f), 1)),
                "nivel_riesgo": str(salto_json.get("nivel_riesgo") or ("BAJO" if sc_salto_f >= 80.0 else "MEDIO")),
                "zona_riesgo": str(salto_json.get("zona_riesgo") or "Cadena Cinética Integral"),
                "correcciones": correcciones_list,
                "prediccion_ia": str(salto_json.get("prediccion_ia") or salto_json.get("voz_coach") or ""),
            }
            supabase.table("analisis_biomecanicos").insert(fila_limpia).execute()
            sincronizado_supabase = True
    except Exception as e:
        print(f"[FALLBACK RAM ACTIVO] Enmascarando error 401 en Supabase ({e}). Guardado en memoria_respaldo_sesion.")
    finally:
        memoria_respaldo_sesion.append(salto_json)
        MEMORIA_ANALISIS.append(salto_json)

    return {
        "status": "ok",
        "codigo": 200,
        "sincronizado_supabase": sincronizado_supabase,
        "usuario_id": usuario_id,
        "modo": "supabase" if sincronizado_supabase else "fallback_ram",
        "salto": salto_json,
    }


def disparar_guardado_background(sesion_id: str, resultado: Dict[str, Any]) -> None:
    copia = dict(resultado)
    hilo = threading.Thread(target=escribir_analisis_en_hilo, args=(sesion_id, copia), daemon=True)
    hilo.start()


def obtener_historial_db(usuario_id: str) -> Dict[str, Any]:
    """
    Consulta en Supabase (`sesiones_entrenamiento` + `analisis_biomecanicos`) o RAM
    el historial biomecánico completo perteneciente al `usuario_id` autenticado.
    """
    uid_str = str(usuario_id or "").strip()
    if supabase:
        try:
            registros: List[Dict[str, Any]] = []
            ids_sesiones: List[str] = []
            if uid_str and uid_str not in ("me", "default_user"):
                res_ses = (
                    supabase.table("sesiones_entrenamiento")
                    .select("id")
                    .eq("usuario_id", uid_str)
                    .order("fecha", desc=True)
                    .limit(30)
                    .execute()
                )
                ids_sesiones = [str(s["id"]) for s in (res_ses.data or []) if s.get("id")]

            if ids_sesiones:
                res_analisis = (
                    supabase.table("analisis_biomecanicos")
                    .select(
                        "id, sesion_id, gesto_tecnico, angulo_hombro, angulo_codo, "
                        "angulo_rodilla, angulo_cadera, efectividad_porcentaje, "
                        "riesgo_lesion_porcentaje, nivel_riesgo, correcciones, prediccion_ia, creado_en"
                    )
                    .in_("sesion_id", ids_sesiones)
                    .order("creado_en", desc=True)
                    .limit(20)
                    .execute()
                )
                registros = res_analisis.data or []
            elif not uid_str or uid_str == "00000000-0000-0000-0000-000000000001":
                res_analisis = (
                    supabase.table("analisis_biomecanicos")
                    .select(
                        "id, sesion_id, gesto_tecnico, angulo_hombro, angulo_codo, "
                        "angulo_rodilla, angulo_cadera, efectividad_porcentaje, "
                        "riesgo_lesion_porcentaje, nivel_riesgo, correcciones, prediccion_ia, creado_en"
                    )
                    .order("creado_en", desc=True)
                    .limit(20)
                    .execute()
                )
                registros = res_analisis.data or []

            if registros:
                historial = []
                for idx, r in enumerate(reversed(registros), start=1):
                    corrs = r.get("correcciones") or []
                    salto_extraido = 0.0
                    for c in corrs:
                        if isinstance(c, str) and ("salto" in c.lower()) and "cm" in c.lower():
                            m = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*cm", c)
                            if m:
                                salto_extraido = float(m.group(1))
                    historial.append({
                        "indice": idx,
                        "fecha": (r.get("creado_en") or "")[:16].replace("T", " "),
                        "creado_en": r.get("creado_en") or "",
                        "gesto_tecnico": r.get("gesto_tecnico", "remate"),
                        "angulo_hombro": float(r.get("angulo_hombro") or 0.0),
                        "angulo_codo": float(r.get("angulo_codo") or 0.0),
                        "angulo_rodilla": float(r.get("angulo_rodilla") or 0.0),
                        "angulo_cadera": float(r.get("angulo_cadera") or 0.0),
                        "efectividad_porcentaje": float(r.get("efectividad_porcentaje") or 0.0),
                        "riesgo_lesion_porcentaje": float(r.get("riesgo_lesion_porcentaje") or 0.0),
                        "nivel_riesgo": r.get("nivel_riesgo", "BAJO"),
                        "salto_vertical_cm": salto_extraido,
                        "correcciones": corrs,
                        "diagnostico": corrs[0] if corrs else "",
                        "prediccion_ia": r.get("prediccion_ia", ""),
                    })
                return {"usuario_id": usuario_id, "total": len(historial), "historial": historial}
        except Exception as e:
            print(f"[FALLBACK RAM ACTIVO] Error 401 o fallo en Supabase al obtener historial ({e}). Usando memoria RAM.")

    # Respaldo memoria local filtrada por usuario_id cuando aplica
    filtrados = [
        r for r in MEMORIA_ANALISIS
        if not uid_str or uid_str in ("me", "default_user") or str(r.get("usuario_id", "")) == uid_str
    ]
    historial = []
    for idx, r in enumerate(filtrados[-20:], start=1):
        f3 = (r.get("fases") or {}).get("fase_3", {}).get("metricas_clave", {})
        f1 = (r.get("fases") or {}).get("fase_1", {}).get("metricas_clave", {})
        eff = float(r.get("score_global") if r.get("score_global") is not None else (r.get("efectividad_porcentaje") if r.get("efectividad_porcentaje") is not None else 0.0))
        historial.append({
            "indice": idx,
            "fecha": (r.get("creado_en") or "")[:16].replace("T", " "),
            "creado_en": r.get("creado_en") or "",
            "gesto_tecnico": r.get("gesto_tecnico", "remate"),
            "angulo_hombro": float(r.get("angulo_hombro") or f3.get("angulo_hombro_contacto_3d") or 0.0),
            "angulo_codo": float(r.get("angulo_codo") or f3.get("angulo_codo_contacto_3d") or 0.0),
            "angulo_rodilla": float(r.get("angulo_rodilla") or f1.get("angulo_rodilla_3d") or 0.0),
            "angulo_cadera": float(r.get("angulo_cadera") or f1.get("angulo_cadera_3d") or 0.0),
            "efectividad_porcentaje": eff,
            "riesgo_lesion_porcentaje": round(100.0 - eff, 1),
            "nivel_riesgo": "BAJO" if eff >= 80 else "MEDIO",
            "salto_vertical_cm": float(r.get("salto_vertical_cm") or 0.0),
            "diagnostico": r.get("diagnostico_causa_raiz") or "",
            "prediccion_ia": r.get("voz_coach") or r.get("prediccion_ia") or "",
        })
    return {"usuario_id": usuario_id, "total": len(historial), "historial": historial}
