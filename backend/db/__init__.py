"""
Capa de Persistencia y Base de Datos (Supabase + Local RAM Fallback).
"""

from .database import (
    MEMORIA_ANALISIS,
    MEMORIA_SESIONES,
    SESION_ACTIVA_ID,
    SESIONES_ENTRENAMIENTO,
    crear_sesion_db,
    crear_sesion_entrenamiento,
    disparar_guardado_background,
    escribir_analisis_en_hilo,
    guardar_salto_con_fallback,
    memoria_respaldo_sesion,
    obtener_historial_db,
    obtener_historial_sesion,
    obtener_sesion_entrenamiento,
    registrar_gesto_en_sesion,
    supabase,
)

__all__ = [
    "supabase",
    "SESIONES_ENTRENAMIENTO",
    "SESION_ACTIVA_ID",
    "MEMORIA_SESIONES",
    "MEMORIA_ANALISIS",
    "memoria_respaldo_sesion",
    "crear_sesion_entrenamiento",
    "obtener_sesion_entrenamiento",
    "registrar_gesto_en_sesion",
    "obtener_historial_sesion",
    "crear_sesion_db",
    "escribir_analisis_en_hilo",
    "guardar_salto_con_fallback",
    "disparar_guardado_background",
    "obtener_historial_db",
]
