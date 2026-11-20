"""
Servicio de Módulos de Usuario y Persistencia Integral con Supabase (Clean Architecture).
Conecta Rutinas (IA + Predeterminadas), Historial / Historial IA (con Replay 3D JSONB),
Contenido Educativo (YouTube), Progreso Analítico y Notificaciones reactivas vinculadas
al `usuario_id` autenticado mediante JWT.
"""

import json
import logging
import math
import os
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from backend.api.db_sync import (
    HISTORIAL_SESIONES_FINALIZADAS,
    obtener_cliente_supabase,
    obtener_cliente_supabase_autenticado,
)
from backend.core.config import BASE_DIR
from backend.db.database import (
    MEMORIA_ANALISIS,
    SESIONES_ENTRENAMIENTO,
    memoria_respaldo_sesion,
    obtener_historial_db,
)

logger = logging.getLogger(__name__)

# Almacén persistente local de respaldo (cero sesiones ficticias; solo datos reales del usuario)
STORE_LOCAL_PATH = os.path.join(BASE_DIR, "backend", "db", "volleyscan_local_store.json")
STORE_LOCK = threading.Lock()

SESIONES_IA_POR_USUARIO: Dict[str, List[Dict[str, Any]]] = {}
RUTINAS_POR_USUARIO: Dict[str, Dict[str, Dict[str, Any]]] = {}
NOTIFICACIONES_POR_USUARIO: Dict[str, List[Dict[str, Any]]] = {}
PERFILES_POR_USUARIO: Dict[str, Dict[str, Any]] = {}
CONFIG_POR_USUARIO: Dict[str, Dict[str, Any]] = {}
_STORE_CARGADO = False

NOMBRES_TECNICA: Dict[str, str] = {
    "remate": "Remate Aéreo (Ataque)",
    "saque": "Saque en Salto / Flotante",
    "recepcion": "Recepción de Antebrazos",
    "voleo": "Voleo (Pase de Dedos)",
    "colocacion": "Voleo (Pase de Dedos)",
    "bloqueo": "Bloqueo Defensivo",
    "salto_vertical": "Salto Vertical / Pliometría",
}

IMAGENES_TECNICA: Dict[str, str] = {
    "remate": "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=240&q=80",
    "saque": "https://images.unsplash.com/photo-1547347298-4074fc3086f0?w=240&q=80",
    "recepcion": "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=240&q=80",
    "voleo": "https://images.unsplash.com/photo-1592656094267-764a45160876?w=240&q=80",
    "colocacion": "https://images.unsplash.com/photo-1592656094267-764a45160876?w=240&q=80",
    "bloqueo": "https://images.unsplash.com/photo-1561014990-82a765a3e7e5?w=240&q=80",
}

COLORES_TECNICA: Dict[str, str] = {
    "remate": "#22c55e",
    "saque": "#f97316",
    "recepcion": "#eab308",
    "bloqueo": "#3b82f6",
    "voleo": "#06b6d4",
}


def _crear_video_item(
    vid_id: str,
    titulo: str,
    categoria: str,
    categoria_label: str,
    duracion: str,
    youtube_id: str,
    nivel: str,
    autor: str,
    fundamento_clave: str,
    descripcion: str,
) -> Dict[str, Any]:
    return {
        "id": vid_id,
        "titulo": titulo,
        "categoria": categoria,
        "categoria_label": categoria_label,
        "duracion": duracion,
        "nivel": nivel,
        "autor": autor,
        "youtube_id": youtube_id,
        "video_url": f"https://www.youtube.com/watch?v={youtube_id}",
        "embed_url": f"https://www.youtube.com/embed/{youtube_id}?rel=0",
        "miniatura_url": f"https://i.ytimg.com/vi/{youtube_id}/hqdefault.jpg",
        "fundamento_clave": fundamento_clave,
        "descripcion": descripcion,
    }


CATALOGO_CONTENIDO_BASE: List[Dict[str, Any]] = [
    _crear_video_item(
        "vid_remate_aproximacion",
        "Aproximación en 3 Pasos y Salto Explosivo de Remate",
        "remate",
        "Remate",
        "08:15",
        "WgDCGN5n8uI",
        "Intermedio",
        "Elevate Yourself",
        "Últimos 2 pasos de freno-impulso y balanceo posterior de brazos.",
        "Desglose biomecánico de la carrera de ataque en 3 pasos (izquierda-derecha-izquierda), frenado del talón y conversión horizontal a vertical.",
    ),
    _crear_video_item(
        "vid_remate_armado",
        "Mecánica del Swing de Brazo en 3 Movimientos (Parte 1)",
        "remate",
        "Remate",
        "09:42",
        "R97i9lWKX6s",
        "Todos los niveles",
        "Elevate Yourself",
        "Apertura torácica Bow-and-Arrow manteniendo el codo alto sobre el hombro.",
        "Aprende la secuencia de armado de hombro y codo para prevenir lesiones en el manguito rotador y maximizar el torque rotacional.",
    ),
    _crear_video_item(
        "vid_remate_contacto",
        "Topspin y Contacto Sólido en el Vértice del Remate (Parte 2)",
        "remate",
        "Remate",
        "07:50",
        "Kt88q_J89q8",
        "Intermedio",
        "Elevate Yourself",
        "Extensión terminal de codo (>=165°) y golpeo con muñeca flexible.",
        "Cómo impactar el balón en el punto más alto (instante t0) envolviendo la parte superior para generar efecto topspin descendente.",
    ),
    _crear_video_item(
        "vid_saque_flotante",
        "Fundamentos del Saque Flotante (Float Serve)",
        "saque",
        "Saque",
        "06:48",
        "NRV0rMeSOBI",
        "Principiante",
        "Elevate Yourself",
        "Lanzamiento compacto sin rotación y golpeo seco con el centro de la palma.",
        "Guía paso a paso para dominar el toss frente al hombro ejecutor y golpear el balón sin spin logrando una trayectoria impredecible.",
    ),
    _crear_video_item(
        "vid_saque_jump_float",
        "Saque Flotante en Salto (Jump Float Serve)",
        "saque",
        "Saque",
        "08:30",
        "tAZOhm_Y1Fs",
        "Intermedio",
        "Elevate Yourself",
        "Ritmo de 2-3 pasos manteniendo el balón alineado frente al eje visual.",
        "Coordina la elevación con salto hacia adelante para atacar el balón por encima del borde superior de la red.",
    ),
    _crear_video_item(
        "vid_saque_topspin",
        "Saque Potente en Salto con Topspin",
        "saque",
        "Saque",
        "10:15",
        "qRE1PCvb0-0",
        "Avanzado",
        "Elevate Yourself",
        "Toss alto dentro de cancha, armado completo y contacto en extensión máxima.",
        "Transferencia de impulso desde la línea de fondo con aproximación explosiva, arqueo lumbar controlado y latigazo de muñeca.",
    ),
    _crear_video_item(
        "vid_voleo_base",
        "Fundamentos del Voleo / Pase de Dedos de Alta Precisión",
        "voleo",
        "Voleo",
        "07:35",
        "h5mpBCRK_yk",
        "Principiante",
        "Elevate Yourself",
        "Triángulo de manos sobre la frente y extensión simultánea de codos y rodillas.",
        "Posición anatómica de los pulgares e índices, absorción elástica de muñecas y empuje limpio para evitar dobles faltas.",
    ),
    _crear_video_item(
        "vid_voleo_salto",
        "Técnica de Voleo en Salto (Jump Set)",
        "voleo",
        "Voleo",
        "08:05",
        "mtWZCggcxtE",
        "Avanzado",
        "Elevate Yourself",
        "Contacto en el punto más alto del ascenso manteniendo hombros neutrales.",
        "Cómo acelerar la lectura táctica del armador interceptando pases altos en el aire sin telegrafiar la dirección de ataque.",
    ),
    _crear_video_item(
        "vid_recepcion_float",
        "Recepción de Saque Flotante y Plataforma Estable",
        "recepcion",
        "Recepción",
        "09:12",
        "xfCoHL6HvdQ",
        "Todos los niveles",
        "Elevate Yourself",
        "Rotación temprana de hombros al frente y ángulos constantes de plataforma.",
        "Ajuste rápido de pies, bloqueo de codos por encima de 165° y control de cadera entre 95° y 120° para dirigir el primer pase.",
    ),
    _crear_video_item(
        "vid_bloqueo_exterior",
        "Técnica de Bloqueo Exterior y Desplazamiento Lateral",
        "bloqueo",
        "Bloqueo",
        "08:20",
        "u-V5R4pDkIE",
        "Intermedio",
        "Elevate Yourself",
        "Paso shuffle/cruzado manteniendo caderas paralelas a la red y manos listas.",
        "Secuencia de pies para cerrar el bloqueo hacia las puntas sin derivar lateralmente en el aire.",
    ),
    _crear_video_item(
        "vid_bloqueo_manos",
        "Posicionamiento de Manos e Invasión sobre la Red",
        "bloqueo",
        "Bloqueo",
        "07:45",
        "yBLbBsdOj7s",
        "Intermedio",
        "Elevate Yourself",
        "Dedos separados y penetración de muñecas más allá del plano vertical.",
        "Elimina huecos entre brazos y sella el campo contrario con activación escapular y aterrizaje bilateral equilibrado.",
    ),
    _crear_video_item(
        "vid_bloqueo_opuesto",
        "Lectura de Armador y Bloqueo por Punta Opuesta",
        "bloqueo",
        "Bloqueo",
        "08:10",
        "ptSEGSByIh0",
        "Intermedio",
        "Elevate Yourself",
        "Secuencia visual balón -> armador -> hombro atacante antes del salto.",
        "Timing correcto de salto para evitar bloqueos tardíos y alinear las manos exteriores protegiendo la línea.",
    ),
    _crear_video_item(
        "vid_salto_pliometria",
        "Rutina Pliométrica para Potenciar el Salto Vertical",
        "salto_vertical",
        "Salto Vertical",
        "10:40",
        "1-PqvHEqXUM",
        "Intermedio",
        "VolleyJump",
        "Ciclo estiramiento-acortamiento y máxima triple extensión tobillo-rodilla-cadera.",
        "Progresión de saltos reactivos y sentadillas explosivas orientadas a elevar el tiempo de vuelo y la altura de remate.",
    ),
    _crear_video_item(
        "vid_salto_reactividad",
        "Entrenamiento de Salto Vertical y Reactividad de Tendón",
        "salto_vertical",
        "Salto Vertical",
        "09:25",
        "midzdI8EG8k",
        "Intermedio",
        "Reid Hall",
        "Reducción del tiempo de contacto en suelo y absorción segura en aterrizaje.",
        "Cómo transformar la fuerza excéntrica de frenado en despegue vertical sin sobrecargar el tendón rotuliano.",
    ),
    _crear_video_item(
        "vid_salto_excentrico",
        "Fundamentos de Fuerza Excéntrica y Pliometría para Voleibol",
        "salto_vertical",
        "Salto Vertical",
        "08:55",
        "JUGvlyd88bk",
        "Todos los niveles",
        "Reid Hall & Martin Reader",
        "Control de rodilla y cadera en la fase excéntrica de desaceleración.",
        "Bases científicas para aterrizar con seguridad bilateral (<15° de asimetría) y construir altura vertical sostenible.",
    ),
]


BIBLIOTECA_RUTINAS_PREDETERMINADAS: List[Dict[str, Any]] = [
    {
        "id": "rut_pred_pliometria",
        "titulo": "Salto Explosivo para Llegar Más Alto",
        "descripcion": "Entrena tus piernas para despegar más rápido del suelo y aterrizar suave cuidando tus rodillas.",
        "tipo": "predeterminada",
        "categoria": "salto_vertical",
        "categoria_label": "Salto Vertical",
        "nivel": "Intermedio",
        "duracion_min": 25,
        "enfoque_muscular": "Piernas, glúteos y tobillos",
        "enfoque_tecnico": "Despega rápido hacia arriba y cae amortiguando suave con ambos pies",
        "error_detectado": "",
        "ejercicios": [
            {"id": "ej_plio_1", "nombre": "Saltos verticales con pausa abajo (CMJ)", "series": "4 x 6 reps", "descanso": "90 s", "enfoque": "Flexiona las rodillas antes de saltar y empuja fuerte hacia arriba", "completado": False},
            {"id": "ej_plio_2", "nombre": "Rebotes rápidos desde escalón bajo", "series": "3 x 5 reps", "descanso": "120 s", "enfoque": "Toca el suelo lo más breve posible y cae suave sin hacer ruido", "completado": False},
            {"id": "ej_plio_3", "nombre": "Saltos con carrera de 3 pasos hacia la red", "series": "4 x 5 reps", "descanso": "90 s", "enfoque": "Frena el último paso para transformar tu carrera en altura", "completado": False},
        ],
    },
    {
        "id": "rut_pred_remate",
        "titulo": "Remate Potente: Brazo Alto y Golpe Firme",
        "descripcion": "Prepara bien el brazo atrás como un arco y golpea el balón en el punto más alto del salto.",
        "tipo": "predeterminada",
        "categoria": "remate",
        "categoria_label": "Potencia de Remate",
        "nivel": "Intermedio",
        "duracion_min": 30,
        "enfoque_muscular": "Hombros, espalda y abdomen",
        "enfoque_tecnico": "Sube más el codo al armar y estira el brazo completo al golpear",
        "error_detectado": "",
        "ejercicios": [
            {"id": "ej_rem_1", "nombre": "Armado de brazo en 'arco y flecha' frente a la pared", "series": "3 x 12 reps", "descanso": "45 s", "enfoque": "Mantén el codo arriba antes de lanzar la mano hacia adelante", "completado": False},
            {"id": "ej_rem_2", "nombre": "Remate con auto-lanzamiento buscando altura máxima", "series": "4 x 8 reps", "descanso": "60 s", "enfoque": "Golpea el balón bien arriba con el brazo completamente estirado", "completado": False},
            {"id": "ej_rem_3", "nombre": "Caída controlada con dos pies después de rematar", "series": "3 x 8 reps", "descanso": "60 s", "enfoque": "Flexiona suave las rodillas al caer manteniendo las piernas alineadas", "completado": False},
        ],
    },
    {
        "id": "rut_pred_saque",
        "titulo": "Saque Seguro y con Puntería",
        "descripcion": "Aprende a lanzar el balón siempre a la misma altura para sacar fuerte y con precisión.",
        "tipo": "predeterminada",
        "categoria": "saque",
        "categoria_label": "Saque",
        "nivel": "Básico",
        "duracion_min": 20,
        "enfoque_muscular": "Hombros, brazos y piernas",
        "enfoque_tecnico": "Lanza el balón frente a tu hombro y golpea seco con la mano firme",
        "error_detectado": "",
        "ejercicios": [
            {"id": "ej_saq_1", "nombre": "Práctica de lanzamiento frente a una marca en el suelo", "series": "3 x 12 reps", "descanso": "30 s", "enfoque": "Lanza el balón recto y sin que gire frente a tu brazo de golpeo", "completado": False},
            {"id": "ej_saq_2", "nombre": "Saques cortos frente a la pared", "series": "4 x 10 reps", "descanso": "45 s", "enfoque": "Golpea el centro del balón con la palma abierta y muñeca firme", "completado": False},
            {"id": "ej_saq_3", "nombre": "Saque con paso adelante hacia zona objetivo", "series": "3 x 8 reps", "descanso": "60 s", "enfoque": "Da un paso firme hacia adelante mientras acompañas el golpe", "completado": False},
        ],
    },
    {
        "id": "rut_pred_voleo",
        "titulo": "Voleo Limpio: Manos Suaves sobre la Frente",
        "descripcion": "Forma un triángulo cómodo con tus dedos y empuja el balón con las piernas y brazos al mismo tiempo.",
        "tipo": "predeterminada",
        "categoria": "voleo",
        "categoria_label": "Voleo",
        "nivel": "Básico",
        "duracion_min": 20,
        "enfoque_muscular": "Manos, antebrazos y hombros",
        "enfoque_tecnico": "Recibe sobre la frente y extiende brazos y piernas de manera pareja",
        "error_detectado": "",
        "ejercicios": [
            {"id": "ej_vol_1", "nombre": "Toques rápidos contra la pared formando triángulo", "series": "4 x 20 toques", "descanso": "40 s", "enfoque": "Coloca los pulgares apuntando hacia tus ojos justo sobre la frente", "completado": False},
            {"id": "ej_vol_2", "nombre": "Desplazamiento lateral, frenado y voleo", "series": "3 x 10 reps", "descanso": "60 s", "enfoque": "Acomoda tus hombros hacia tu compañero antes de pasar el balón", "completado": False},
            {"id": "ej_vol_3", "nombre": "Voleo en pequeño salto con balón ligero", "series": "3 x 8 reps", "descanso": "60 s", "enfoque": "Empuja el balón suavemente con ambos brazos parejos", "completado": False},
        ],
    },
    {
        "id": "rut_pred_defensa",
        "titulo": "Defensa Rápida y Recepción Segura",
        "descripcion": "Baja tu centro de gravedad y forma una plataforma firme con tus antebrazos para salvar más balones.",
        "tipo": "predeterminada",
        "categoria": "recepcion",
        "categoria_label": "Recepción",
        "nivel": "Intermedio",
        "duracion_min": 25,
        "enfoque_muscular": "Piernas, cadera y antebrazos",
        "enfoque_tecnico": "Mantén la cadera baja y los brazos extendidos al frente sin doblar codos",
        "error_detectado": "",
        "ejercicios": [
            {"id": "ej_def_1", "nombre": "Desplazamientos laterales en postura baja de defensa", "series": "4 x 30 s", "descanso": "45 s", "enfoque": "Mantén las rodillas flexionadas y la espalda cómoda sin encorvarte", "completado": False},
            {"id": "ej_def_2", "nombre": "Armado rápido de plataforma de antebrazos", "series": "3 x 12 reps", "descanso": "40 s", "enfoque": "Junta tus muñecas y dirige tus brazos hacia abajo antes del impacto", "completado": False},
            {"id": "ej_def_3", "nombre": "Salto vertical de bloqueo con manos firmes", "series": "3 x 8 reps", "descanso": "60 s", "enfoque": "Pasa las manos firmes por encima de la red sin tocarla", "completado": False},
        ],
    },
    {
        "id": "rut_pred_movilidad",
        "titulo": "Movilidad y Cuidado de Hombros y Piernas",
        "descripcion": "Ejercicios suaves de estiramiento y equilibrio para sentirte ligero y prevenir molestias.",
        "tipo": "predeterminada",
        "categoria": "movilidad",
        "categoria_label": "Movilidad",
        "nivel": "Básico",
        "duracion_min": 18,
        "enfoque_muscular": "Hombros, espalda, tobillos y caderas",
        "enfoque_tecnico": "Gana soltura en hombros y tobillos para saltar y caer cómodo",
        "error_detectado": "",
        "ejercicios": [
            {"id": "ej_mov_1", "nombre": "Estiramiento suave de hombro y giros de espalda", "series": "2 x 10 reps/lado", "descanso": "30 s", "enfoque": "Mantén los hombros sueltos y sin tensión después de rematar", "completado": False},
            {"id": "ej_mov_2", "nombre": "Flexibilidad de tobillo apoyado contra la pared", "series": "3 x 10 reps/lado", "descanso": "30 s", "enfoque": "Ayuda a que tus rodillas amortigüen mucho mejor al aterrizar", "completado": False},
            {"id": "ej_mov_3", "nombre": "Equilibrio en un pie con toques suaves alrededor", "series": "3 x 8 reps/pierna", "descanso": "40 s", "enfoque": "Fortalece la rodilla para que no se meta hacia adentro al saltar", "completado": False},
        ],
    },
]


# ============================================================================
# UTILIDADES DE PERSISTENCIA LOCAL + SUPABASE
# ============================================================================

def _uid_canonico(uid: Optional[str]) -> str:
    limpio = str(uid or "").strip()
    if not limpio or limpio in ("me", "default_user", "anon"):
        return "00000000-0000-0000-0000-000000000001"
    return limpio


def _es_uuid_valido(valor: Optional[str]) -> bool:
    if not valor:
        return False
    try:
        uuid.UUID(str(valor).strip())
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def _asegurar_store_cargado() -> None:
    global _STORE_CARGADO
    if _STORE_CARGADO:
        return
    with STORE_LOCK:
        if _STORE_CARGADO:
            return
        if os.path.exists(STORE_LOCAL_PATH):
            try:
                with open(STORE_LOCAL_PATH, "r", encoding="utf-8") as fh:
                    data = json.load(fh)
                if isinstance(data, dict):
                    SESIONES_IA_POR_USUARIO.update(data.get("sesiones_ia") or {})
                    RUTINAS_POR_USUARIO.update(data.get("rutinas") or {})
                    NOTIFICACIONES_POR_USUARIO.update(data.get("notificaciones") or {})
                    PERFILES_POR_USUARIO.update(data.get("perfiles") or {})
                    CONFIG_POR_USUARIO.update(data.get("config") or {})
                    # Recalcular y sanear puntajes de sesiones desde sus 4 fases reales al cargar
                    hubo_saneamiento = False
                    for lista_ses in SESIONES_IA_POR_USUARIO.values():
                        if isinstance(lista_ses, list):
                            for ses_item in lista_ses:
                                if isinstance(ses_item, dict):
                                    prev_sc = ses_item.get("puntuacion")
                                    _recalcular_resumen_sesion_ia(ses_item)
                                    if ses_item.get("puntuacion") != prev_sc:
                                        hubo_saneamiento = True
                    if hubo_saneamiento:
                        try:
                            payload_san = {
                                "sesiones_ia": SESIONES_IA_POR_USUARIO,
                                "rutinas": RUTINAS_POR_USUARIO,
                                "notificaciones": NOTIFICACIONES_POR_USUARIO,
                                "perfiles": PERFILES_POR_USUARIO,
                                "config": CONFIG_POR_USUARIO,
                            }
                            with open(STORE_LOCAL_PATH, "w", encoding="utf-8") as fh_out:
                                json.dump(payload_san, fh_out, ensure_ascii=False)
                        except Exception:
                            pass
            except Exception as exc:
                logger.warning("No se pudo cargar volleyscan_local_store.json: %s", exc)
        _STORE_CARGADO = True


def _guardar_store_local() -> None:
    try:
        os.makedirs(os.path.dirname(STORE_LOCAL_PATH), exist_ok=True)
        payload = {
            "sesiones_ia": SESIONES_IA_POR_USUARIO,
            "rutinas": RUTINAS_POR_USUARIO,
            "notificaciones": NOTIFICACIONES_POR_USUARIO,
            "perfiles": PERFILES_POR_USUARIO,
            "config": CONFIG_POR_USUARIO,
        }
        tmp_path = f"{STORE_LOCAL_PATH}.tmp"
        with STORE_LOCK:
            with open(tmp_path, "w", encoding="utf-8") as fh:
                json.dump(payload, fh, ensure_ascii=False)
            os.replace(tmp_path, STORE_LOCAL_PATH)
    except Exception as exc:
        logger.warning("No se pudo escribir respaldo local JSON: %s", exc)


def _formatear_tiempo_relativo(iso_str: Optional[str]) -> str:
    if not iso_str:
        return "Hace unos momentos"
    try:
        dt = datetime.fromisoformat(str(iso_str).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        diff = datetime.now(timezone.utc) - dt
        seg = max(0, int(diff.total_seconds()))
        if seg < 60:
            return "Hace unos segundos"
        if seg < 3600:
            m = seg // 60
            return f"Hace {m} min"
        if seg < 86400:
            h = seg // 3600
            return f"Hace {h} {'hora' if h == 1 else 'horas'}"
        d = seg // 86400
        return f"Hace {d} {'día' if d == 1 else 'días'}"
    except Exception:
        return "Reciente"


def _formatear_duracion(seg_raw: Any) -> str:
    seg = max(0, int(round(float(seg_raw or 0))))
    h = seg // 3600
    m = (seg % 3600) // 60
    s = seg % 60
    if h > 0:
        return f"{h}h {m:02d}m {s:02d}s"
    return f"{m:02d}:{s:02d}"


def _parse_fecha_iso(iso_str: Optional[str]) -> datetime:
    if not iso_str:
        return datetime.now(timezone.utc)
    try:
        dt = datetime.fromisoformat(str(iso_str).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return datetime.now(timezone.utc)


NOMBRE_A_LM_STR: Dict[str, str] = {
    "nariz": "0",
    "hombro_izq": "11",
    "hombro_der": "12",
    "codo_izq": "13",
    "codo_der": "14",
    "muneca_izq": "15",
    "muneca_der": "16",
    "cadera_izq": "23",
    "cadera_der": "24",
    "rodilla_izq": "25",
    "rodilla_der": "26",
    "tobillo_izq": "27",
    "tobillo_der": "28",
    "punta_pie_izq": "31",
    "punta_pie_der": "32",
}


def _normalizar_puntos_3d_visor(puntos_raw: Any, l_torso_opt: Optional[float] = None) -> Optional[Dict[str, Dict[str, float]]]:
    """
    Convierte `puntos_3d` del backend (con nombres anatómicos o índices MediaPipe) o del frontend
    al formato normalizado por torso exacto que consume `GemeloDigital3D.jsx`.
    """
    if not isinstance(puntos_raw, dict) or not puntos_raw:
        return None

    # Si ya está en formato visor ({ "0": {x, y, z, v}, ... } con valores dict)
    primer_val = next(iter(puntos_raw.values()), None)
    if isinstance(primer_val, dict) and "x" in primer_val and "y" in primer_val:
        res_direct: Dict[str, Dict[str, float]] = {}
        for k, p in puntos_raw.items():
            if isinstance(p, dict):
                idx_dest = NOMBRE_A_LM_STR.get(str(k), str(k))
                res_direct[idx_dest] = {
                    "x": round(float(p.get("x", 0.0) or 0.0), 4),
                    "y": round(float(p.get("y", 0.0) or 0.0), 4),
                    "z": round(float(p.get("z", 0.0) or 0.0), 4),
                    "v": round(float(p.get("v", p.get("visibility", 0.9)) or 0.9), 3),
                }
        return res_direct or None

    # Formato backend pipeline_principal ([x, y, z] o [x, y, z, v] indexado por nombre o índice)
    def _extraer_pt(clave_a: str, clave_b: Optional[str] = None) -> Optional[List[float]]:
        val = puntos_raw.get(clave_a)
        if val is None and clave_a.isdigit():
            val = puntos_raw.get(int(clave_a))
        if val is None and clave_b is not None:
            val = puntos_raw.get(clave_b)
        if isinstance(val, (list, tuple)) and len(val) >= 2:
            z_val = float(val[2]) if len(val) >= 3 else 0.0
            v_val = float(val[3]) if len(val) >= 4 else 0.95
            return [float(val[0] or 0.0), float(val[1] or 0.0), z_val, v_val]
        return None

    c_i = _extraer_pt("23", "cadera_izq")
    c_d = _extraer_pt("24", "cadera_der")
    h_i = _extraer_pt("11", "hombro_izq")
    h_d = _extraer_pt("12", "hombro_der")
    if not (c_i and c_d):
        return None

    hip_x = (c_i[0] + c_d[0]) * 0.5
    hip_y = (c_i[1] + c_d[1]) * 0.5
    hip_z = (c_i[2] + c_d[2]) * 0.5

    span_torso = float(l_torso_opt) if l_torso_opt and float(l_torso_opt) > 0.05 else 0.0
    if not span_torso and h_i and h_d:
        sho_x = (h_i[0] + h_d[0]) * 0.5
        sho_y = (h_i[1] + h_d[1]) * 0.5
        sho_z = (h_i[2] + h_d[2]) * 0.5
        span_torso = math.sqrt((sho_x - hip_x) ** 2 + (sho_y - hip_y) ** 2 + (sho_z - hip_z) ** 2)

    torso = max(0.18, span_torso or 0.42)

    normalizado: Dict[str, Dict[str, float]] = {}
    for raw_key in list(puntos_raw.keys()):
        raw_str = str(raw_key)
        dest_idx = NOMBRE_A_LM_STR.get(raw_str, raw_str)
        pt = _extraer_pt(raw_str)
        if pt is None:
            continue
        normalizado[dest_idx] = {
            "x": round((pt[0] - hip_x) / torso, 4),
            "y": round((pt[1] - hip_y) / torso, 4),
            "z": round((pt[2] - hip_z) / torso, 4),
            "v": round(pt[3], 3),
        }
    return normalizado if len(normalizado) >= 4 else None


def _normalizar_secuencia_3d_para_replay(evaluacion: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    """
    Extrae y compacta la secuencia de landmarks 3D para almacenar en JSONB (`secuencia_landmarks_3d`)
    y garantizar el Replay 3D exacto en `GemeloDigital3D.jsx`.
    """
    sec_raw = (
        evaluacion.get("secuencia3D")
        or evaluacion.get("secuencia_landmarks_3d")
        or evaluacion.get("secuencia_cinematica_completa")
        or []
    )
    if not isinstance(sec_raw, list):
        sec_raw = []

    frames_out: List[Dict[str, Any]] = []
    # Conservar hasta 60 fotogramas para preservar íntegras las secuencias de 33 frames [t0-20 : t0+12]
    if len(sec_raw) > 60:
        paso = len(sec_raw) / 60.0
        sec_muestreada = [sec_raw[min(len(sec_raw) - 1, int(i * paso))] for i in range(60)]
    else:
        sec_muestreada = sec_raw

    for idx, f in enumerate(sec_muestreada):
        if not isinstance(f, dict):
            continue
        puntos_norm = _normalizar_puntos_3d_visor(
            f.get("puntos") if f.get("puntos") is not None else f.get("puntos_3d"),
            f.get("L_torso"),
        )
        if not puntos_norm:
            continue

        fase_frame = str(
            f.get("fase")
            or ("contacto" if idx == 20 else ("carga" if idx < 10 else ("armado" if idx < 20 else "caida")))
        ).lower()
        t_ms = int(f.get("t") if f.get("t") is not None else round(float(f.get("timestamp") or idx * 0.033) * 1000))
        angulos_f = f.get("angulos")
        if not isinstance(angulos_f, dict) or not ("codoD" in angulos_f or "codoI" in angulos_f):
            ang8 = f.get("angulos_cinematicos") or []
            if len(ang8) >= 6:
                angulos_f = {
                    "codoI": round(float(ang8[0]), 2) if ang8[0] is not None else None,
                    "codoD": round(float(ang8[1]), 2) if ang8[1] is not None else None,
                    "hombroI": round(float(ang8[2]), 2) if len(ang8) > 2 and ang8[2] is not None else None,
                    "hombroD": round(float(ang8[3]), 2) if len(ang8) > 3 and ang8[3] is not None else None,
                    "rodillaI": round(float(ang8[4]), 2) if ang8[4] is not None else None,
                    "rodillaD": round(float(ang8[5]), 2) if ang8[5] is not None else None,
                    "caderaI": round(float(ang8[6]), 2) if len(ang8) > 6 and ang8[6] is not None else None,
                    "caderaD": round(float(ang8[7]), 2) if len(ang8) > 7 and ang8[7] is not None else None,
                }
            else:
                angulos_f = angulos_f if isinstance(angulos_f, dict) else {}

        frames_out.append({
            "idx": idx,
            "frameId": f.get("frameId") if f.get("frameId") is not None else f.get("frame_id", idx),
            "t": t_ms,
            "fase": fase_frame,
            "puntos": puntos_norm,
            "angulos": angulos_f,
            "speed": round(float(f.get("speed") or (f.get("cinematica") or {}).get("velocidad_muneca_3d_ms") or 0.0), 3),
            "lift": round(float(f.get("lift") or (f.get("cinematica") or {}).get("elevacion_salto_norm") or 0.0), 3),
        })

    fases_evaluacion = evaluacion.get("fases4") or evaluacion.get("fases") or {}
    indices_raw = evaluacion.get("indicesFases") or evaluacion.get("indices_fases") or {}
    if (not indices_raw or indices_raw.get("contacto") is None) and isinstance(fases_evaluacion, dict):
        f1_idx = (fases_evaluacion.get("fase_1") or {}).get("frameIdx")
        f2_idx = (fases_evaluacion.get("fase_2") or {}).get("frameIdx")
        f3_idx = (fases_evaluacion.get("fase_3") or {}).get("frameIdx")
        f4_idx = (fases_evaluacion.get("fase_4") or {}).get("frameIdx")
        if f3_idx is not None:
            indices_raw = {"carga": f1_idx or 0, "armado": f2_idx or 0, "contacto": f3_idx, "caida": f4_idx or 0}
    if isinstance(indices_raw, dict) and indices_raw.get("contacto") is not None and frames_out:
        n_max = len(frames_out) - 1
        indices = {
            "carga": min(n_max, max(0, int(indices_raw.get("carga", 0)))),
            "armado": min(n_max, max(0, int(indices_raw.get("armado", 0)))),
            "contacto": min(n_max, max(0, int(indices_raw.get("contacto", 0)))),
            "caida": min(n_max, max(0, int(indices_raw.get("caida", n_max)))),
        }
    elif frames_out:
        def _buscar_fase(clave: str, fallback: int) -> int:
            for i_f, fr in enumerate(frames_out):
                if fr.get("fase") == clave:
                    return i_f
            return min(len(frames_out) - 1, max(0, fallback))

        indices = {
            "carga": _buscar_fase("carga", int(len(frames_out) * 0.15)),
            "armado": _buscar_fase("armado", int(len(frames_out) * 0.42)),
            "contacto": _buscar_fase("contacto", int(len(frames_out) * 0.65)),
            "caida": _buscar_fase("caida", int(len(frames_out) * 0.88)),
        }
    else:
        indices = {"carga": 0, "armado": 0, "contacto": 0, "caida": 0}

    return frames_out, indices


# ============================================================================
# NOTIFICACIONES REACTIVAS
# ============================================================================

def registrar_notificacion_usuario(
    usuario_id: str,
    tipo: str,
    titulo: str,
    mensaje: str,
    enlace: str = "/usuario/histtrial",
    token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Crea y sincroniza una notificación automática para el usuario autenticado
    en memoria, almacenamiento local y tabla `notificaciones` de Supabase.
    """
    _asegurar_store_cargado()
    uid = _uid_canonico(usuario_id)
    ahora_iso = datetime.now(timezone.utc).isoformat()
    notif: Dict[str, Any] = {
        "id": f"ntf_{uuid.uuid4().hex[:10]}",
        "usuario_id": uid,
        "type": tipo,
        "unread": True,
        "leida": False,
        "title": titulo,
        "msg": mensaje,
        "time": "Hace unos segundos",
        "creado_en": ahora_iso,
        "link": enlace,
    }

    lista = NOTIFICACIONES_POR_USUARIO.setdefault(uid, [])
    if not any(n.get("title") == titulo and n.get("msg") == mensaje for n in lista[:3]):
        lista.insert(0, notif)
        del lista[40:]
        _guardar_store_local()

    cliente = obtener_cliente_supabase_autenticado(token)
    if cliente is not None and _es_uuid_valido(uid):
        try:
            cliente.table("notificaciones").insert({
                "id": notif["id"],
                "usuario_id": uid,
                "tipo": tipo,
                "titulo": titulo,
                "mensaje": mensaje,
                "leida": False,
                "ruta_destino": enlace,
                "creado_en": ahora_iso,
            }).execute()
        except Exception:
            pass

    return notif


# ============================================================================
# FASES BIOMECÁNICAS Y REPETICIONES (4 FASES + SECUENCIA LANDMARKS 3D)
# ============================================================================

def _construir_fases4_normalizadas(
    fases_raw: Dict[str, Any],
    score_global: float,
    ang_rodilla: float = 112.0,
    ang_codo: float = 168.0,
    ang_hombro: float = 158.0,
    ang_cadera: float = 142.0,
) -> Dict[str, Any]:
    """
    Garantiza que cada gesto registrado tenga la estructura completa de las 4 Fases
    Biomecánicas con sus métricas angulares, puntajes y diagnósticos técnicos.
    """
    raw = fases_raw or {}
    # Si ya está en formato normalizado de cliente (`fase_1.metricas`)
    if isinstance(raw.get("fase_1"), dict) and isinstance(raw["fase_1"].get("metricas"), list):
        return raw

    f1 = raw.get("fase_1") or {}
    f2 = raw.get("fase_2") or {}
    f3 = raw.get("fase_3") or {}
    f4 = raw.get("fase_4") or {}

    m1 = f1.get("metricas_clave") or {}
    m2 = f2.get("metricas_clave") or {}
    m3 = f3.get("metricas_clave") or {}
    m4 = f4.get("metricas_clave") or {}

    rod_f1 = round(float(m1.get("angulo_rodilla_3d") or ang_rodilla or 112.0), 1)
    cad_f1 = round(float(m1.get("angulo_cadera_3d") or ang_cadera or 142.0), 1)
    codo_f2 = round(float(m2.get("angulo_codo_armado_3d") or 102.0), 1)
    hom_f2 = round(float(m2.get("angulo_hombro_elevacion_3d") or max(115.0, ang_hombro - 15.0)), 1)
    codo_f3 = round(float(m3.get("angulo_codo_contacto_3d") or ang_codo or 168.0), 1)
    hom_f3 = round(float(m3.get("angulo_hombro_contacto_3d") or ang_hombro or 158.0), 1)
    rod_f4 = round(float(m4.get("angulo_rodilla_aterrizaje_3d") or max(122.0, rod_f1 + 12.0)), 1)
    asim_f4 = round(float(m4.get("asimetria_bilateral_grados") or 6.4), 1)

    sc1 = round(float(f1.get("score") if f1.get("score") is not None else score_global))
    sc2 = round(float(f2.get("score") if f2.get("score") is not None else score_global))
    sc3 = round(float(f3.get("score") if f3.get("score") is not None else score_global))
    sc4 = round(float(f4.get("score") if f4.get("score") is not None else score_global))

    return {
        "fase_1": {
            "numero": 1,
            "id": "carga",
            "nombre": f1.get("nombre") or "Fase 1: Preparación",
            "subtitulo": f1.get("subtitulo") or "Aproximación y Flexión de Rodillas",
            "score": sc1,
            "estado": f1.get("estado") or ("Óptimo" if sc1 >= 80 else "Por mejorar"),
            "metricas": [
                {"label": "Rodilla 3D", "valor": f"{rod_f1}°", "ideal": "95°–120°"},
                {"label": "Cadera 3D", "valor": f"{cad_f1}°", "ideal": "130°–155°"},
            ],
            "diagnostico": f1.get("diagnostico")
            or (
                "¡Muy buen arranque! Tus rodillas se flexionaron lo justo para impulsarte fuerte hacia arriba."
                if 95.0 <= rod_f1 <= 125.0
                else "Flexiona un poco más las rodillas antes de saltar para despegar con más potencia."
            ),
        },
        "fase_2": {
            "numero": 2,
            "id": "armado",
            "nombre": f2.get("nombre") or "Fase 2: Salto y Armado",
            "subtitulo": f2.get("subtitulo") or "Subida y preparación del brazo",
            "score": sc2,
            "estado": f2.get("estado") or ("Óptimo" if sc2 >= 80 else "Por mejorar"),
            "metricas": [
                {"label": "Codo Armado", "valor": f"{codo_f2}°", "ideal": "85°–120°"},
                {"label": "Elevación Hombro", "valor": f"{hom_f2}°", "ideal": ">110°"},
            ],
            "diagnostico": f2.get("diagnostico")
            or (
                "Excelente preparación del brazo en el aire como arco y flecha."
                if 80.0 <= codo_f2 <= 125.0 and hom_f2 >= 110.0
                else "Sube un poco más el codo antes de golpear para tener mayor alcance."
            ),
        },
        "fase_3": {
            "numero": 3,
            "id": "contacto",
            "nombre": f3.get("nombre") or "Fase 3: Contacto Crítico (t0)",
            "subtitulo": f3.get("subtitulo") or "Golpe en el punto más alto",
            "score": sc3,
            "estado": f3.get("estado") or ("Óptimo" if sc3 >= 80 else "Por mejorar"),
            "metricas": [
                {"label": "Extensión Codo (t0)", "valor": f"{codo_f3}°", "ideal": "165°–180°"},
                {"label": "Hombro Impacto", "valor": f"{hom_f3}°", "ideal": ">145°"},
            ],
            "diagnostico": f3.get("diagnostico")
            or (
                "¡Golpe alto y limpio! Estiraste bien el brazo en el punto más alto."
                if codo_f3 >= 162.0
                else "Estira un poco más el brazo al golpear para rematar más alto sobre la red."
            ),
        },
        "fase_4": {
            "numero": 4,
            "id": "caida",
            "nombre": f4.get("nombre") or "Fase 4: Finalización",
            "subtitulo": f4.get("subtitulo") or "Caída suave y equilibrada",
            "score": sc4,
            "estado": f4.get("estado") or ("Seguro" if asim_f4 < 15.0 else "Por mejorar"),
            "metricas": [
                {"label": "Rodilla Aterrizaje", "valor": f"{rod_f4}°", "ideal": "120°–145°"},
                {"label": "Simetría Piernas", "valor": f"{asim_f4}°", "ideal": "<15°"},
            ],
            "diagnostico": f4.get("diagnostico")
            or (
                "¡Aterrizaje súper suave y parejo! Cuidaste muy bien tus piernas al caer."
                if asim_f4 < 15.0
                else "Flexiona las rodillas al caer y apoya ambos pies al mismo tiempo para proteger tus piernas."
            ),
        },
    }


def _calcular_score_global_desde_fases(fases_raw: Optional[Dict[str, Any]]) -> Optional[float]:
    """
    Calcula con precisión matemática el puntaje global (0-100) a partir de los puntajes
    reales de las 4 fases biomecánicas emitidas por el motor de MediaPipe:
      0.20 * F1 + 0.25 * F2 + 0.35 * F3 + 0.20 * F4
    """
    if not isinstance(fases_raw, dict):
        return None
    pesos = (("fase_1", 0.20), ("fase_2", 0.25), ("fase_3", 0.35), ("fase_4", 0.20))
    suma_pond = 0.0
    suma_pesos = 0.0
    for key, peso in pesos:
        fase_obj = fases_raw.get(key)
        if isinstance(fase_obj, dict) and fase_obj.get("score") is not None:
            try:
                val = float(fase_obj["score"])
                suma_pond += val * peso
                suma_pesos += peso
            except (TypeError, ValueError):
                pass
    if suma_pesos <= 0.0:
        return None
    return round(max(0.0, min(100.0, suma_pond / suma_pesos)), 1)


def _convertir_evaluacion_a_repeticion_ia(
    evaluacion: Dict[str, Any],
    numero: int = 1,
) -> Dict[str, Any]:
    """
    Convierte un paquete `evaluacion_secuencia_completa`, un registro de `gestos_sesion`
    o de `analisis_biomecanicos` en un objeto de repetición con las 4 fases y `secuencia3D`.
    """
    gesto_raw = str(
        evaluacion.get("gesto_tecnico")
        or evaluacion.get("tipo_gesto")
        or evaluacion.get("gesto_detectado")
        or evaluacion.get("movimiento")
        or "remate"
    ).lower()
    if gesto_raw == "colocacion":
        gesto_raw = "voleo"
    gesto_nombre = NOMBRES_TECNICA.get(gesto_raw, gesto_raw.capitalize())

    fases_raw = evaluacion.get("fases") or evaluacion.get("fases4") or (evaluacion.get("correcciones_por_fase") or {}).get("fases4") or {}
    score_exp: Optional[float] = None
    for clave_sc in ("score_global", "scoreExacto", "score", "puntaje", "efectividad_porcentaje", "puntuacion"):
        val_sc = evaluacion.get(clave_sc)
        if val_sc is not None:
            try:
                score_exp = float(val_sc)
                break
            except (TypeError, ValueError):
                pass

    score_fases = _calcular_score_global_desde_fases(fases_raw)
    if score_fases is not None:
        if score_exp is None or score_exp <= 0.0 or round(score_exp) != round(score_fases) or abs(score_exp - score_fases) >= 1.0:
            score_exacto = score_fases
        else:
            score_exacto = round(score_exp, 1)
    elif score_exp is not None:
        score_exacto = round(max(0.0, min(100.0, score_exp)), 1)
    else:
        score_exacto = 0.0
    score = round(score_exacto)
    salto_cm = round(
        float(
            evaluacion.get("altura_salto_cm")
            or evaluacion.get("salto_vertical_cm")
            or evaluacion.get("saltoVerticalCm")
            or (evaluacion.get("metricas_fisicas") or {}).get("salto_vertical_cm")
            or 0.0
        ),
        2,
    )
    tiempo_vuelo = round(
        float(
            evaluacion.get("tiempo_vuelo_seg")
            or evaluacion.get("tiempo_vuelo_segundos")
            or evaluacion.get("tiempoVueloSegundos")
            or (evaluacion.get("metricas_fisicas") or {}).get("tiempo_vuelo_segundos")
            or 0.0
        ),
        3,
    )

    medidas_in = {str(m.get("id")): m.get("valor") for m in (evaluacion.get("medidas") or evaluacion.get("metricas_angulares") or []) if isinstance(m, dict) and m.get("valor") is not None}

    def _num_metrica(fase_k: str, idx_m: int, medida_k: str, m_dict: Dict[str, Any], m_clave: str, top_k: str, default_v: float) -> float:
        if evaluacion.get(top_k) is not None:
            return float(evaluacion[top_k])
        if medidas_in.get(medida_k) is not None:
            return float(medidas_in[medida_k])
        if m_dict.get(m_clave) is not None:
            return float(m_dict[m_clave])
        arr_m = (fases_raw.get(fase_k) or {}).get("metricas") or []
        if len(arr_m) > idx_m and isinstance(arr_m[idx_m], dict) and arr_m[idx_m].get("valor") is not None:
            try:
                return float(str(arr_m[idx_m]["valor"]).replace("°", "").strip())
            except Exception:
                pass
        return default_v

    f3_m = (fases_raw.get("fase_3") or {}).get("metricas_clave") or {}
    f1_m = (fases_raw.get("fase_1") or {}).get("metricas_clave") or {}
    ang_hombro = _num_metrica("fase_3", 1, "elevacionBrazoContacto", f3_m, "angulo_hombro_contacto_3d", "angulo_hombro", 0.0)
    ang_codo = _num_metrica("fase_3", 0, "extensionCodoContacto", f3_m, "angulo_codo_contacto_3d", "angulo_codo", 0.0)
    ang_rodilla = _num_metrica("fase_1", 0, "flexionRodilla", f1_m, "angulo_rodilla_3d", "angulo_rodilla", 0.0)
    ang_cadera = _num_metrica("fase_1", 1, "caderaCarga", f1_m, "angulo_cadera_3d", "angulo_cadera", 0.0)

    fases4 = _construir_fases4_normalizadas(
        fases_raw=fases_raw,
        score_global=score_exacto,
        ang_rodilla=ang_rodilla,
        ang_codo=ang_codo,
        ang_hombro=ang_hombro,
        ang_cadera=ang_cadera,
    )

    diag_raiz = str(
        evaluacion.get("diagnostico_causa_raiz")
        or evaluacion.get("diagnosticoCausaRaiz")
        or evaluacion.get("diagnostico")
        or (evaluacion.get("correcciones") or [""])[0]
        or "Secuencia biomecánica evaluada en 4 fases con reconstrucción 3D."
    )
    voz_coach = str(
        evaluacion.get("coach_voz_texto")
        or evaluacion.get("voz_coach")
        or evaluacion.get("vozCoach")
        or evaluacion.get("prediccion_ia")
        or diag_raiz
    )

    errores_raw = (
        evaluacion.get("errores_detectados")
        or (evaluacion.get("correcciones_por_fase") or {}).get("errores")
        or evaluacion.get("errores")
        or []
    )
    errores_norm: List[Dict[str, Any]] = []
    for idx_e, err in enumerate(errores_raw):
        if isinstance(err, dict):
            fase_num = int(err.get("fase") if isinstance(err.get("fase"), (int, float)) else 3)
            art = str(err.get("articulacion") or err.get("nombre") or f"Ajuste en Fase {fase_num}")
            desc = str(err.get("descripcion") or err.get("mensaje") or diag_raiz)
            errores_norm.append({
                "medidaId": str(err.get("medidaId") or f"fase_{fase_num}_{idx_e}"),
                "fase": fase_num,
                "nombre": art if "Fase" in art else f"Fase {fase_num} · {art}",
                "severidad": err.get("severidad") or ("grave" if score < 68 else "moderado"),
                "mensaje": desc,
                "porQue": err.get("porQue") or diag_raiz,
                "ejercicio": err.get("ejercicio") or "Ejecuta drills correctivos enfocados en el rango angular objetivo.",
                "ideal": err.get("ideal") or ([95, 120] if fase_num == 1 else ([165, 180] if fase_num == 3 else [120, 145])),
                "valor": err.get("valor") if err.get("valor") is not None else round(ang_rodilla if fase_num == 1 else (ang_codo if fase_num == 3 else ang_hombro), 1),
            })

    if not errores_norm and score < 85:
        if ang_codo < 165.0:
            errores_norm.append({
                "medidaId": "extensionCodoContacto",
                "fase": 3,
                "nombre": "Fase 3 (t0) · Extensión del codo en impacto",
                "severidad": "moderado",
                "mensaje": diag_raiz,
                "porQue": "Un ángulo de codo menor a 165° reduce el alcance y sobrecarga el hombro.",
                "ejercicio": "Ataque asistido buscando golpear con máxima extensión vertical (4x10).",
                "ideal": [165, 180],
                "valor": round(ang_codo, 1),
            })
        elif ang_rodilla > 125.0 or ang_rodilla < 90.0:
            errores_norm.append({
                "medidaId": "flexionRodilla",
                "fase": 1,
                "nombre": "Fase 1 · Flexión de rodillas en preparación",
                "severidad": "moderado",
                "mensaje": diag_raiz,
                "porQue": "Una carga superficial limita la potencia reactiva de despegue.",
                "ejercicio": "Sentadilla pliométrica con pausa a 105° de rodilla (3x10).",
                "ideal": [95, 120],
                "valor": round(ang_rodilla, 1),
            })

    def _extraer_valor_metrica(fase_k: str, fallback: float) -> float:
        try:
            txt = str(fases4[fase_k]["metricas"][0]["valor"]).replace("°", "").strip()
            return round(float(txt), 1)
        except Exception:
            return round(fallback, 1)

    medidas = [
        {
            "id": "flexionRodilla",
            "nombre": "Fase 1 · Flexión de rodillas en carga",
            "unidad": "°",
            "valor": _extraer_valor_metrica("fase_1", ang_rodilla),
            "ideal": [95, 125],
            "estado": "ok" if 95.0 <= ang_rodilla <= 125.0 else "mal",
        },
        {
            "id": "codoArmado",
            "nombre": "Fase 2 · Codo en armado aéreo",
            "unidad": "°",
            "valor": _extraer_valor_metrica("fase_2", 102.0),
            "ideal": [80, 125],
            "estado": "ok" if fases4["fase_2"]["score"] >= 75 else "mal",
        },
        {
            "id": "extensionCodoContacto",
            "nombre": "Fase 3 (t0) · Extensión de codo en contacto",
            "unidad": "°",
            "valor": _extraer_valor_metrica("fase_3", ang_codo),
            "ideal": [165, 180],
            "estado": "ok" if ang_codo >= 162.0 else "mal",
        },
        {
            "id": "elevacionBrazoContacto",
            "nombre": "Fase 3 (t0) · Elevación de hombro en impacto",
            "unidad": "°",
            "valor": round(ang_hombro, 1),
            "ideal": [145, 180],
            "estado": "ok" if ang_hombro >= 142.0 else "mal",
        },
        {
            "id": "amortiguacionRodilla",
            "nombre": "Fase 4 · Amortiguación bilateral al aterrizar",
            "unidad": "°",
            "valor": _extraer_valor_metrica("fase_4", 128.0),
            "ideal": [115, 148],
            "estado": "ok" if fases4["fase_4"]["score"] >= 75 else "mal",
        },
    ]

    fortalezas: List[str] = []
    if fases4["fase_1"]["score"] >= 80:
        fortalezas.append(f"Fase 1 (Preparación): Buena flexión de carga en rodillas ({round(ang_rodilla)}°).")
    if fases4["fase_3"]["score"] >= 80:
        fortalezas.append(f"Fase 3 (Contacto t0): Excelente extensión de codo ({round(ang_codo)}°) y alcance vertical.")
    if fases4["fase_4"]["score"] >= 80:
        fortalezas.append("Fase 4 (Finalización): Aterrizaje simétrico con baja carga sobre el LCA.")
    if salto_cm > 0:
        fortalezas.append(f"Física de Salto: {salto_cm} cm ({tiempo_vuelo} s en el aire).")

    correcciones_esp: List[str] = []
    for txt in [diag_raiz, voz_coach, *[e["mensaje"] for e in errores_norm]]:
        if txt and txt not in correcciones_esp:
            correcciones_esp.append(txt)

    secuencia_3d, indices_fases = _normalizar_secuencia_3d_para_replay(evaluacion)

    return {
        "numero": numero,
        "valida": True,
        "movimiento": gesto_raw,
        "movimientoNombre": gesto_nombre,
        "gesto_tecnico": gesto_raw,
        "puntuacion": score,
        "score": score,
        "score_global": score_exacto,
        "puntaje": score,
        "saltoVerticalCm": salto_cm,
        "tiempoVueloSegundos": tiempo_vuelo,
        "diagnosticoCausaRaiz": diag_raiz,
        "vozCoach": voz_coach,
        "correccionesEspecificas": correcciones_esp,
        "brazo": "derecho",
        "confianza": f"{round(float(evaluacion.get('confianza_clasificacion', 95.0)))}%",
        "fpsMedio": 30,
        "fases4": fases4,
        "fases": fases4,
        "medidas": medidas,
        "errores": errores_norm,
        "puntosClave": fortalezas,
        "secuencia3D": secuencia_3d,
        "secuencia_landmarks_3d": secuencia_3d,
        "indicesFases": indices_fases,
        "recomendaciones": {
            "principal": {
                "mensaje": voz_coach or diag_raiz,
                "causaRaiz": diag_raiz,
            },
            "errores": errores_norm,
            "fortalezas": fortalezas,
        },
        "creadoEn": evaluacion.get("fecha") or evaluacion.get("creado_en") or evaluacion.get("creadoEn") or datetime.now(timezone.utc).isoformat(),
    }


def _recalcular_resumen_sesion_ia(sesion: Dict[str, Any]) -> Dict[str, Any]:
    """Recalcula promedios, duración formateada, salto máximo, errores y fortalezas de una sesión."""
    reps = sesion.get("repeticiones") or []
    for rep in reps:
        if isinstance(rep, dict):
            score_fases = _calcular_score_global_desde_fases(rep.get("fases4") or rep.get("fases"))
            if score_fases is not None:
                sc_act = rep.get("puntuacion") if rep.get("puntuacion") is not None else rep.get("score")
                if sc_act is None or float(sc_act) <= 0.0 or round(float(sc_act)) != round(score_fases) or abs(float(sc_act) - score_fases) >= 1.0:
                    rep["puntuacion"] = round(score_fases)
                    rep["score"] = round(score_fases)
                    rep["score_global"] = score_fases
                    rep["puntaje"] = round(score_fases)
    validas = [r for r in reps if r.get("valida", True)]
    scores = [int(r.get("puntuacion") or r.get("score") or 0) for r in validas if (r.get("puntuacion") or r.get("score")) is not None and int(r.get("puntuacion") or r.get("score") or 0) > 0]
    puntuacion = round(sum(scores) / len(scores)) if scores else 0
    mejor = max(scores) if scores else 0

    mapa_errores: Dict[str, Dict[str, Any]] = {}
    fortalezas_set: List[str] = []
    mapa_medidas: Dict[str, Dict[str, Any]] = {}

    for r in validas:
        for f in r.get("puntosClave") or []:
            if f not in fortalezas_set:
                fortalezas_set.append(f)
        for e in r.get("errores") or []:
            mid = str(e.get("medidaId") or e.get("nombre") or "ajuste")
            item_e = mapa_errores.setdefault(
                mid,
                {
                    "medidaId": mid,
                    "nombre": e.get("nombre") or mid,
                    "severidad": e.get("severidad") or "moderado",
                    "mensaje": e.get("mensaje") or "",
                    "porQue": e.get("porQue") or "",
                    "ejercicio": e.get("ejercicio") or "",
                    "ideal": e.get("ideal"),
                    "valores": [],
                    "ocurrencias": 0,
                },
            )
            item_e["ocurrencias"] += 1
            if e.get("valor") is not None:
                item_e["valores"].append(float(e["valor"]))

        for m in r.get("medidas") or []:
            if m.get("valor") is None:
                continue
            mid_m = str(m.get("id") or m.get("nombre"))
            item_m = mapa_medidas.setdefault(
                mid_m,
                {
                    "medidaId": mid_m,
                    "nombre": m.get("nombre") or mid_m,
                    "unidad": m.get("unidad") or "°",
                    "ideal": m.get("ideal"),
                    "valores": [],
                },
            )
            item_m["valores"].append(float(m["valor"]))

    errores_consolidados = []
    for e in mapa_errores.values():
        vals = e.pop("valores", [])
        e["valorPromedio"] = round(sum(vals) / len(vals), 1) if vals else None
        errores_consolidados.append(e)

    puntos_consolidados = []
    for m in mapa_medidas.values():
        vals = m.pop("valores", [])
        prom = round(sum(vals) / len(vals), 1) if vals else 0.0
        ideal = m.get("ideal")
        aprobado = (ideal[0] <= prom <= ideal[1]) if isinstance(ideal, list) and len(ideal) == 2 else True
        puntos_consolidados.append({**m, "valorPromedio": prom, "aprobado": aprobado})

    gestos_unicos = list(dict.fromkeys(str(r.get("movimientoNombre") or r.get("movimiento") or "Remate") for r in validas))
    saltos_cm = [float(r.get("saltoVerticalCm") or 0.0) for r in validas if float(r.get("saltoVerticalCm") or 0.0) > 0]
    dur_s = max(0, int(round(float(sesion.get("duracionSeg") or sesion.get("duracion_segundos") or 0))))

    sesion["duracionSeg"] = dur_s
    sesion["duracion_segundos"] = dur_s
    sesion["duracionFormateada"] = _formatear_duracion(dur_s)
    sesion["puntuacion"] = puntuacion
    sesion["mejorPuntuacion"] = mejor
    sesion["totalRepeticiones"] = len(reps)
    sesion["total_gestos"] = len(reps)
    sesion["repeticionesValidas"] = len(validas)
    sesion["gestosEntrenados"] = gestos_unicos
    sesion["saltoMaximoCm"] = round(max(saltos_cm), 1) if saltos_cm else 0.0
    sesion["errores"] = errores_consolidados
    sesion["fortalezas"] = fortalezas_set[:8]
    sesion["puntos"] = puntos_consolidados
    return sesion


def _persistir_sesion_en_supabase(
    uid: str,
    sesion_obj: Dict[str, Any],
    token: Optional[str] = None,
) -> bool:
    """
    Guarda la sesión completa en `sesiones_entrenamiento` + `gestos_sesion` (incluyendo JSONB
    `secuencia_landmarks_3d` y `correcciones_por_fase`) y actualiza `progreso_usuario`.
    """
    cliente = obtener_cliente_supabase_autenticado(token)
    if cliente is None or not _es_uuid_valido(uid):
        return False

    sid_codigo = str(sesion_obj.get("id") or "")
    fecha_inicio = str(sesion_obj.get("creadoEn") or datetime.now(timezone.utc).isoformat())
    fecha_fin = str(sesion_obj.get("fechaFin") or datetime.now(timezone.utc).isoformat())
    dur_s = int(sesion_obj.get("duracionSeg") or sesion_obj.get("duracion_segundos") or 0)
    reps = sesion_obj.get("repeticiones") or []

    resumen_jsonb = {
        "gestosEntrenados": sesion_obj.get("gestosEntrenados") or [],
        "errores": sesion_obj.get("errores") or [],
        "fortalezas": sesion_obj.get("fortalezas") or [],
        "puntos": sesion_obj.get("puntos") or [],
        "mejorPuntuacion": sesion_obj.get("mejorPuntuacion") or 0,
    }

    payload_ses = {
        "codigo_sesion": sid_codigo,
        "usuario_id": uid,
        "fecha": fecha_inicio,
        "fecha_fin": fecha_fin,
        "duracion_segundos": dur_s,
        "gesto_tecnico": str(sesion_obj.get("tecnica") or "remate"),
        "dispositivo": "VolleyScan Next.js 3D",
        "total_gestos": len(reps),
        "puntaje_promedio": round(float(sesion_obj.get("puntuacion") or 0), 2),
        "salto_maximo_cm": round(float(sesion_obj.get("saltoMaximoCm") or 0), 2),
        "resumen": resumen_jsonb,
    }

    supa_uuid: Optional[str] = None
    try:
        if _es_uuid_valido(sid_codigo):
            payload_ses["id"] = sid_codigo
            res = cliente.table("sesiones_entrenamiento").upsert(payload_ses, on_conflict="id").execute()
        else:
            res = cliente.table("sesiones_entrenamiento").upsert(payload_ses, on_conflict="codigo_sesion").execute()
        filas = getattr(res, "data", None) or []
        if filas:
            supa_uuid = str(filas[0].get("id") or "")
    except Exception as exc:
        logger.warning("Aviso al guardar en sesiones_entrenamiento Supabase: %s", exc)
        return False

    if not supa_uuid or not reps:
        return bool(supa_uuid)

    try:
        cliente.table("gestos_sesion").delete().eq("sesion_id", supa_uuid).execute()
        filas_gestos: List[Dict[str, Any]] = []
        for idx, rep in enumerate(reps, start=1):
            filas_gestos.append({
                "sesion_id": supa_uuid,
                "usuario_id": uid,
                "salto_index": int(rep.get("numero") or idx),
                "tipo_gesto": str(rep.get("gesto_tecnico") or rep.get("movimiento") or "remate"),
                "puntaje": round(float(rep.get("puntuacion") or rep.get("score") or 0), 2),
                "altura_salto_cm": round(float(rep.get("saltoVerticalCm") or 0), 2),
                "tiempo_vuelo_seg": round(float(rep.get("tiempoVueloSegundos") or 0), 4),
                "diagnostico_causa_raiz": str(rep.get("diagnosticoCausaRaiz") or ""),
                "voz_coach": str(rep.get("vozCoach") or ""),
                "correcciones_por_fase": {
                    "fases4": rep.get("fases4") or {},
                    "errores": rep.get("errores") or [],
                    "fortalezas": rep.get("puntosClave") or [],
                    "correcciones": rep.get("correccionesEspecificas") or [],
                },
                "secuencia_landmarks_3d": rep.get("secuencia3D") or rep.get("secuencia_landmarks_3d") or [],
                "indices_fases": rep.get("indicesFases") or {},
                "metricas_angulares": rep.get("medidas") or [],
                "creado_en": str(rep.get("creadoEn") or fecha_fin),
            })
        if filas_gestos:
            cliente.table("gestos_sesion").insert(filas_gestos).execute()
    except Exception as exc:
        logger.warning("Aviso al guardar gestos_sesion Supabase: %s", exc)

    return True


def _sincronizar_progreso_supabase(uid: str, token: Optional[str] = None) -> None:
    """Actualiza la fila agregada del usuario en la tabla `progreso_usuario`."""
    cliente = obtener_cliente_supabase_autenticado(token)
    if cliente is None or not _es_uuid_valido(uid):
        return
    try:
        prog = calcular_progreso_usuario_desde_sesiones(uid, obtener_sesiones_ia_usuario(uid, token=token))
        precision_dict = {
            item["tecnica"]: item["valor"]
            for item in prog.get("rendimiento_por_tecnica") or []
            if item.get("total", 0) > 0
        }
        ultima_fecha = None
        if prog.get("evolucion_salto"):
            ultima_fecha = str(prog["evolucion_salto"][-1].get("fecha_iso") or "")[:10] or None
        cliente.table("progreso_usuario").upsert(
            {
                "usuario_id": uid,
                "total_sesiones": int(prog.get("total_sesiones") or 0),
                "total_gestos": int(prog.get("analisis_realizados") or 0),
                "tiempo_total_seg": int(prog.get("tiempo_total_seg") or 0),
                "racha_dias": int(prog.get("racha_dias") or 0),
                "mejor_racha_dias": int(prog.get("mejor_racha_dias") or 0),
                "ultima_fecha_sesion": ultima_fecha,
                "salto_maximo_cm": float(prog.get("salto_maximo_cm") or 0),
                "salto_promedio_cm": float(prog.get("salto_promedio_cm") or 0),
                "puntaje_promedio": float(prog.get("puntuacion_promedio") or 0),
                "precision_por_gesto": precision_dict,
                "evolucion_salto": prog.get("evolucion_salto") or [],
                "fortalezas": prog.get("fortalezas") or [],
                "areas_mejora": prog.get("areas_mejora") or [],
                "actualizado_en": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="usuario_id",
        ).execute()
    except Exception as exc:
        logger.warning("Aviso al sincronizar progreso_usuario Supabase: %s", exc)


def sincronizar_captura_ia_usuario(
    sesion_id: str,
    usuario_id: str,
    paquete_resultado: Dict[str, Any],
    token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Se invoca automáticamente al completarse la evaluación de un gesto.
    Actualiza la sesión del usuario con las 4 fases, correcciones y landmarks 3D,
    dispara notificaciones y persiste en disco/Supabase.
    """
    _asegurar_store_cargado()
    uid = _uid_canonico(usuario_id)
    lista_sesiones = SESIONES_IA_POR_USUARIO.setdefault(uid, [])
    sesion_existente = next((s for s in lista_sesiones if str(s.get("id")) == str(sesion_id)), None)
    ahora_iso = datetime.now(timezone.utc).isoformat()

    if sesion_existente is None:
        sesion_existente = {
            "id": str(sesion_id),
            "usuario_id": uid,
            "tecnica": str(paquete_resultado.get("gesto_tecnico") or "remate").lower(),
            "creadoEn": ahora_iso,
            "duracionSeg": int(paquete_resultado.get("duracion_segundos") or 0),
            "nivel": "intermedio",
            "puntuacion": 0,
            "mejorPuntuacion": 0,
            "totalRepeticiones": 0,
            "repeticionesValidas": 0,
            "errores": [],
            "fortalezas": [],
            "puntos": [],
            "repeticiones": [],
        }
        lista_sesiones.insert(0, sesion_existente)

    num_rep = len(sesion_existente["repeticiones"]) + 1
    rep_ia = _convertir_evaluacion_a_repeticion_ia(paquete_resultado, numero=num_rep)
    sesion_existente["repeticiones"].append(rep_ia)
    if paquete_resultado.get("duracion_segundos") is not None:
        sesion_existente["duracionSeg"] = max(
            int(sesion_existente.get("duracionSeg") or 0),
            int(paquete_resultado.get("duracion_segundos") or 0),
        )
    elif int(sesion_existente.get("duracionSeg") or 0) <= 0:
        dt_ini = _parse_fecha_iso(sesion_existente.get("creadoEn"))
        elapsed = max(1, int((datetime.now(timezone.utc) - dt_ini).total_seconds()))
        sesion_existente["duracionSeg"] = elapsed

    _recalcular_resumen_sesion_ia(sesion_existente)
    _guardar_store_local()
    _persistir_sesion_en_supabase(uid, sesion_existente, token=token)

    score = rep_ia["puntuacion"]
    gesto_nom = rep_ia["movimientoNombre"]
    salto_txt = f" · Salto: {rep_ia['saltoVerticalCm']} cm" if rep_ia["saltoVerticalCm"] > 0 else ""
    registrar_notificacion_usuario(
        usuario_id=uid,
        tipo="analisis",
        titulo=f"Análisis IA completado: {gesto_nom}",
        mensaje=f"Efectividad: {score}/100{salto_txt}. {rep_ia['diagnosticoCausaRaiz']}",
        enlace="/usuario/histtrial",
        token=token,
    )
    if score >= 88:
        registrar_notificacion_usuario(
            usuario_id=uid,
            tipo="logro",
            titulo="¡Ejecución de Nivel Élite!",
            mensaje=f"Lograste {score}/100 en {gesto_nom} validando las 4 fases biomecánicas.",
            enlace="/usuario/progreso",
            token=token,
        )
    return sesion_existente


def _hidratar_sesiones_desde_supabase(uid: str, token: Optional[str] = None) -> List[Dict[str, Any]]:
    """Consulta `sesiones_entrenamiento` y `gestos_sesion` en Supabase para el usuario."""
    cliente = obtener_cliente_supabase_autenticado(token)
    if cliente is None or not _es_uuid_valido(uid):
        return []

    sesiones_supa: List[Dict[str, Any]] = []
    try:
        res_ses = (
            cliente.table("sesiones_entrenamiento")
            .select("*")
            .eq("usuario_id", uid)
            .order("fecha", desc=True)
            .limit(40)
            .execute()
        )
        filas_ses = getattr(res_ses, "data", None) or []
        if not filas_ses:
            return []

        supa_ids = [str(f["id"]) for f in filas_ses if f.get("id")]
        gestos_por_sesion: Dict[str, List[Dict[str, Any]]] = {}
        if supa_ids:
            try:
                res_gestos = (
                    cliente.table("gestos_sesion")
                    .select("*")
                    .in_("sesion_id", supa_ids)
                    .order("salto_index", desc=False)
                    .execute()
                )
                for g in getattr(res_gestos, "data", None) or []:
                    gestos_por_sesion.setdefault(str(g["sesion_id"]), []).append(g)
            except Exception as exc_g:
                logger.warning("Aviso al leer gestos_sesion Supabase: %s", exc_g)

        for fs in filas_ses:
            sid_supa = str(fs.get("id") or "")
            codigo = str(fs.get("codigo_sesion") or sid_supa)
            raw_gestos = gestos_por_sesion.get(sid_supa, [])
            reps = [_convertir_evaluacion_a_repeticion_ia(g, idx + 1) for idx, g in enumerate(raw_gestos)]
            if not reps and int(fs.get("total_gestos") or 0) == 0:
                continue

            ses_dict: Dict[str, Any] = {
                "id": codigo,
                "supabase_id": sid_supa,
                "usuario_id": uid,
                "tecnica": str(fs.get("gesto_tecnico") or (reps[0]["movimiento"] if reps else "remate")).lower(),
                "creadoEn": str(fs.get("fecha") or fs.get("created_at") or datetime.now(timezone.utc).isoformat()),
                "fechaFin": fs.get("fecha_fin"),
                "duracionSeg": int(fs.get("duracion_segundos") or 0),
                "nivel": "intermedio",
                "repeticiones": reps,
            }
            _recalcular_resumen_sesion_ia(ses_dict)
            sesiones_supa.append(ses_dict)
    except Exception as exc:
        logger.warning("Aviso al hidratar sesiones_entrenamiento Supabase: %s", exc)

    return sesiones_supa


def obtener_sesiones_ia_usuario(
    usuario_id: str,
    token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Devuelve únicamente las sesiones reales del usuario autenticado (memoria, disco local y Supabase).
    No genera ni inyecta datos de demostración falsos cuando el historial está vacío.
    """
    _asegurar_store_cargado()
    uid = _uid_canonico(usuario_id)
    sesiones_mem = list(SESIONES_IA_POR_USUARIO.get(uid, []))
    ids_vistos = {str(s.get("id")) for s in sesiones_mem}

    # 1. Incorporar sesiones activas registradas en RAM por WebSocket
    for sid, ses_raw in list(SESIONES_ENTRENAMIENTO.items()):
        if str(ses_raw.get("usuario_id")) == uid and str(sid) not in ids_vistos:
            gestos = ses_raw.get("gestos_registrados") or []
            if gestos:
                reps = [_convertir_evaluacion_a_repeticion_ia(g, idx + 1) for idx, g in enumerate(gestos)]
                dt_ini = _parse_fecha_iso(ses_raw.get("fecha_inicio"))
                dur_real = max(1, int((datetime.now(timezone.utc) - dt_ini).total_seconds()))
                nueva_s: Dict[str, Any] = {
                    "id": str(sid),
                    "usuario_id": uid,
                    "tecnica": str(gestos[-1].get("gesto_tecnico") or "remate").lower(),
                    "creadoEn": ses_raw.get("fecha_inicio") or datetime.now(timezone.utc).isoformat(),
                    "duracionSeg": dur_real,
                    "nivel": "intermedio",
                    "repeticiones": reps,
                }
                _recalcular_resumen_sesion_ia(nueva_s)
                sesiones_mem.append(nueva_s)
                ids_vistos.add(str(sid))

    # 2. Hidratar sesiones guardadas en Supabase (`sesiones_entrenamiento` + `gestos_sesion`)
    for s_supa in _hidratar_sesiones_desde_supabase(uid, token=token):
        if str(s_supa.get("id")) not in ids_vistos and str(s_supa.get("supabase_id") or "") not in ids_vistos:
            sesiones_mem.append(s_supa)
            ids_vistos.add(str(s_supa.get("id")))

    # 3. Compatibilidad con registros históricos en `analisis_biomecanicos` (solo reales)
    if not sesiones_mem:
        hist_db = obtener_historial_db(uid).get("historial") or []
        grupos: Dict[str, List[Dict[str, Any]]] = {}
        for reg in hist_db:
            clave_s = str(reg.get("sesion_id") or (reg.get("fecha") or "sesion_supabase")[:13])
            grupos.setdefault(clave_s, []).append(reg)
        for clave_s, items in reversed(list(grupos.items())):
            sid_supa = f"supa_{clave_s}"
            if sid_supa in ids_vistos:
                continue
            reps_db = [_convertir_evaluacion_a_repeticion_ia(it, i + 1) for i, it in enumerate(items)]
            fecha_iso = str(items[-1].get("creado_en") or datetime.now(timezone.utc).isoformat())
            ses_supa: Dict[str, Any] = {
                "id": sid_supa,
                "usuario_id": uid,
                "tecnica": str(items[-1].get("gesto_tecnico") or "remate").lower(),
                "creadoEn": fecha_iso,
                "duracionSeg": max(10, len(reps_db) * 15),
                "nivel": "intermedio",
                "repeticiones": reps_db,
            }
            _recalcular_resumen_sesion_ia(ses_supa)
            sesiones_mem.append(ses_supa)
            ids_vistos.add(sid_supa)

    # Normalizar duracionFormateada en todas las sesiones
    for s in sesiones_mem:
        _recalcular_resumen_sesion_ia(s)

    sesiones_mem.sort(key=lambda x: str(x.get("creadoEn") or ""), reverse=True)
    if sesiones_mem:
        SESIONES_IA_POR_USUARIO[uid] = sesiones_mem
    return sesiones_mem


def obtener_detalle_sesion_ia_usuario(
    usuario_id: str,
    sesion_id: str,
    token: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Devuelve el detalle completo de una sesión específica (incluyendo `secuencia3D` por gesto)."""
    sesiones = obtener_sesiones_ia_usuario(usuario_id, token=token)
    for s in sesiones:
        if str(s.get("id")) == str(sesion_id) or str(s.get("supabase_id") or "") == str(sesion_id):
            return s
    for lista in SESIONES_IA_POR_USUARIO.values():
        for s in lista:
            if str(s.get("id")) == str(sesion_id):
                return s
    return None


def guardar_sesion_ia_desde_cliente(
    usuario_id: str,
    payload: Dict[str, Any],
    token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Guarda o actualiza una sesión enviada por el frontend al terminar un análisis,
    preservando duración exacta en segundos y secuencias `secuencia3D` / `secuencia_landmarks_3d`.
    """
    _asegurar_store_cargado()
    uid = _uid_canonico(usuario_id or payload.get("usuario_id"))
    sid = str(payload.get("id") or payload.get("clienteUuid") or payload.get("sesion_id") or f"ses_{int(time.time())}")

    reps_in = payload.get("repeticiones") or payload.get("gestos") or []
    reps_norm: List[Dict[str, Any]] = []
    for i, r in enumerate(reps_in):
        if isinstance(r, dict):
            reps_norm.append(_convertir_evaluacion_a_repeticion_ia(r, numero=i + 1))

    dur_explicit = payload.get("duracion_segundos") if payload.get("duracion_segundos") is not None else payload.get("duracionSeg")
    if dur_explicit is not None and float(dur_explicit) >= 0:
        dur_s = int(round(float(dur_explicit)))
    else:
        dt_ini = _parse_fecha_iso(payload.get("inicio") or payload.get("creadoEn") or payload.get("fecha"))
        dt_fin = _parse_fecha_iso(payload.get("fin") or payload.get("fecha_fin"))
        dur_s = max(1, int((dt_fin - dt_ini).total_seconds()))

    fecha_ini = str(payload.get("inicio") or payload.get("creadoEn") or payload.get("fecha") or datetime.now(timezone.utc).isoformat())
    fecha_fin = str(payload.get("fin") or payload.get("fecha_fin") or datetime.now(timezone.utc).isoformat())

    sesion_obj: Dict[str, Any] = {
        "id": sid,
        "usuario_id": uid,
        "tecnica": str(payload.get("tecnica") or (reps_norm[0]["movimiento"] if reps_norm else "remate")).lower(),
        "creadoEn": fecha_ini,
        "fechaFin": fecha_fin,
        "duracionSeg": dur_s,
        "duracion_segundos": dur_s,
        "nivel": str(payload.get("nivel") or "intermedio"),
        "repeticiones": reps_norm,
    }
    _recalcular_resumen_sesion_ia(sesion_obj)

    lista = SESIONES_IA_POR_USUARIO.setdefault(uid, [])
    SESIONES_IA_POR_USUARIO[uid] = [sesion_obj] + [x for x in lista if str(x.get("id")) != sid]
    _guardar_store_local()

    _persistir_sesion_en_supabase(uid, sesion_obj, token=token)
    _sincronizar_progreso_supabase(uid, token=token)
    return sesion_obj


def eliminar_sesion_ia_usuario(
    usuario_id: str,
    sesion_id: str,
    token: Optional[str] = None,
) -> bool:
    """Elimina una sesión real del usuario en memoria, almacenamiento local y Supabase."""
    _asegurar_store_cargado()
    uid = _uid_canonico(usuario_id)
    sid_str = str(sesion_id)
    sid_sin_pref = sid_str[5:] if sid_str.startswith("supa_") else sid_str
    ids_borrar = {sid_str, sid_sin_pref}

    lista = SESIONES_IA_POR_USUARIO.get(uid, [])
    SESIONES_IA_POR_USUARIO[uid] = [s for s in lista if str(s.get("id")) not in ids_borrar]
    for clave_ram in ids_borrar:
        SESIONES_ENTRENAMIENTO.pop(clave_ram, None)
    MEMORIA_ANALISIS[:] = [
        m for m in MEMORIA_ANALISIS if str(m.get("sesion_id") or "") not in ids_borrar
    ]
    memoria_respaldo_sesion[:] = [
        m for m in memoria_respaldo_sesion if str(m.get("sesion_id") or "") not in ids_borrar
    ]
    _guardar_store_local()

    cliente = obtener_cliente_supabase_autenticado(token)
    if cliente is not None and _es_uuid_valido(uid):
        try:
            if _es_uuid_valido(sesion_id):
                cliente.table("sesiones_entrenamiento").delete().eq("id", sesion_id).eq("usuario_id", uid).execute()
            else:
                cliente.table("sesiones_entrenamiento").delete().eq("codigo_sesion", sesion_id).eq("usuario_id", uid).execute()
        except Exception as exc:
            logger.warning("Aviso al eliminar sesión en Supabase: %s", exc)

    _sincronizar_progreso_supabase(uid, token=token)
    return True


# ============================================================================
# 1. MÓDULO DE RUTINAS (INTELIGENTES IA + PREDETERMINADAS)
# ============================================================================

def _normalizar_rutina_salida(raw: Dict[str, Any], uid: str) -> Dict[str, Any]:
    ejercicios = [dict(e) for e in (raw.get("ejercicios") or [])]
    total = len(ejercicios)
    completados = sum(1 for e in ejercicios if e.get("completado"))
    porcentaje = round((completados / total) * 100) if total > 0 else 0
    estado = str(raw.get("estado") or "disponible")
    if estado == "completada":
        porcentaje = 100
    elif completados == total and total > 0:
        estado = "completada"
    elif completados > 0 and estado == "disponible":
        estado = "en_progreso"

    titulo = str(raw.get("titulo") or raw.get("nombre") or "Rutina VolleyScan")
    enfoque = str(raw.get("enfoque_tecnico") or raw.get("objetivo") or "")

    return {
        "id": str(raw.get("id")),
        "codigo_base": str(raw.get("codigo_base") or raw.get("id")),
        "usuario_id": uid,
        "titulo": titulo,
        "nombre": titulo,
        "descripcion": str(raw.get("descripcion") or ""),
        "tipo": str(raw.get("tipo") or "predeterminada"),
        "categoria": str(raw.get("categoria") or "pliometria"),
        "categoria_label": str(raw.get("categoria_label") or str(raw.get("categoria") or "Voleibol").capitalize()),
        "nivel": str(raw.get("nivel") or "Intermedio"),
        "duracion_min": int(raw.get("duracion_min") or 20),
        "enfoque_muscular": str(raw.get("enfoque_muscular") or enfoque or "Cuerpo completo"),
        "enfoque_tecnico": enfoque,
        "objetivo": enfoque,
        "error_detectado": str(raw.get("error_detectado") or ""),
        "dato_secundario": str(raw.get("dato_secundario") or ""),
        "fase_objetivo": str(raw.get("fase_objetivo") or ""),
        "estado": estado,
        "progreso_pct": porcentaje,
        "iniciada_en": raw.get("iniciada_en"),
        "completada_en": raw.get("completada_en"),
        "creado_en": raw.get("creado_en") or raw.get("creada_en") or datetime.now(timezone.utc).isoformat(),
        "ejercicios": ejercicios,
        "progreso": {
            "total": total,
            "completados": completados if estado != "completada" else total,
            "porcentaje": porcentaje,
        },
    }


def _persistir_rutina_supabase(uid: str, rutina: Dict[str, Any], token: Optional[str] = None) -> None:
    cliente = obtener_cliente_supabase_autenticado(token)
    if cliente is None or not _es_uuid_valido(uid):
        return
    try:
        rid_supa = str(rutina.get("id") or "")
        if rid_supa.startswith("rut_pred_"):
            rid_supa = f"usr_{uid[:8]}_{rid_supa}"
        cliente.table("rutinas").upsert(
            {
                "id": rid_supa,
                "usuario_id": uid,
                "titulo": rutina["titulo"],
                "descripcion": rutina["descripcion"],
                "tipo": rutina["tipo"],
                "categoria": rutina["categoria"],
                "nivel": rutina["nivel"],
                "duracion_min": rutina["duracion_min"],
                "enfoque_tecnico": rutina["enfoque_tecnico"],
                "error_detectado": rutina.get("error_detectado") or "",
                "estado": rutina["estado"],
                "progreso_pct": rutina["progreso_pct"],
                "ejercicios": rutina["ejercicios"],
                "iniciada_en": rutina.get("iniciada_en"),
                "completada_en": rutina.get("completada_en"),
                "actualizada_en": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="id",
        ).execute()
    except Exception as exc:
        logger.warning("Aviso al guardar rutina en Supabase: %s", exc)


def _analizar_errores_historial_para_ia(uid: str, sesiones: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Analiza las sesiones reales del usuario y genera rutinas correctivas automáticas
    cuando detecta salto bajo, codo caído/incompleto, flexión insuficiente de rodillas o puntaje bajo.
    """
    if not sesiones:
        return []

    saltos: List[float] = []
    codos_f2: List[float] = []
    codos: List[float] = []
    rodillas: List[float] = []
    hombros: List[float] = []
    asim_f4: List[float] = []
    scores_por_tec: Dict[str, List[int]] = {}
    fallos_fase: Dict[int, int] = {1: 0, 2: 0, 3: 0, 4: 0}
    errores_texto: List[str] = []

    for s in sesiones:
        for rep in s.get("repeticiones") or []:
            tec = str(rep.get("gesto_tecnico") or rep.get("movimiento") or "remate").lower()
            sc = int(rep.get("puntuacion") or rep.get("score") or 0)
            if sc > 0:
                scores_por_tec.setdefault(tec, []).append(sc)
            salto_v = float(rep.get("saltoVerticalCm") or 0.0)
            if salto_v > 0:
                saltos.append(salto_v)
            f4_dict = rep.get("fases4") or rep.get("fases") or {}
            for fn in (1, 2, 3, 4):
                sc_f = (f4_dict.get(f"fase_{fn}") or {}).get("score")
                if sc_f is not None and float(sc_f) < 78.0:
                    fallos_fase[fn] += 1
            for m in rep.get("medidas") or []:
                mid = m.get("id")
                val = m.get("valor")
                if val is None:
                    continue
                if mid == "codoArmado":
                    codos_f2.append(float(val))
                elif mid == "extensionCodoContacto":
                    codos.append(float(val))
                elif mid == "flexionRodilla":
                    rodillas.append(float(val))
                elif mid == "elevacionBrazoContacto":
                    hombros.append(float(val))
            errores_texto.append(str(rep.get("diagnosticoCausaRaiz") or "").lower())

    rutinas_generadas: List[Dict[str, Any]] = []
    texto_unido = " ".join(errores_texto)

    prom_salto = round(sum(saltos) / len(saltos), 1) if saltos else 0.0
    prom_codo_f2 = round(sum(codos_f2) / len(codos_f2), 1) if codos_f2 else 102.0
    prom_codo = round(sum(codos) / len(codos), 1) if codos else 170.0
    prom_rodilla = round(sum(rodillas) / len(rodillas), 1) if rodillas else 110.0
    prom_hombro = round(sum(hombros) / len(hombros), 1) if hombros else 155.0

    # 1. Codo en Fase 2 (Armado) o Fase 3 (Contacto alto)
    if prom_codo < 165.0 or prom_codo_f2 < 85.0 or prom_codo_f2 > 125.0 or "codo" in texto_unido or "armado" in texto_unido:
        es_f2 = prom_codo_f2 < 85.0 or prom_codo_f2 > 125.0 or "armado" in texto_unido or fallos_fase[2] > fallos_fase[3]
        fase_lbl = "Fase 2: Armado del brazo" if es_f2 else "Fase 3: Golpe alto"
        rep_cnt = max(fallos_fase[2] if es_f2 else fallos_fase[3], 1)
        rutinas_generadas.append({
            "id": f"rut_ia_codo_{uid[:8]}",
            "titulo": "Sube más el codo y estira el brazo al golpear",
            "descripcion": "En tus últimos remates notamos que el brazo queda un poco bajo al prepararte o al golpear. Con estos ejercicios vas a llegar más alto.",
            "tipo": "ia",
            "categoria": "remate",
            "categoria_label": f"Coach IA · {fase_lbl}",
            "nivel": "Intermedio",
            "duracion_min": 22,
            "enfoque_muscular": "Hombros, espalda y brazo",
            "enfoque_tecnico": "Levanta el codo antes de golpear y alcanza el balón lo más arriba posible",
            "fase_objetivo": fase_lbl,
            "error_detectado": f"Para mejorar tu {fase_lbl}: sube más el codo antes de golpear ({rep_cnt} veces detectado)",
            "dato_secundario": f"Codo: {prom_codo}°",
            "estado": "disponible",
            "ejercicios": [
                {"id": "ia_codo_1", "nombre": "Prepara el brazo con liga elástica en posición 'arco y flecha'", "series": "3 x 12 reps", "descanso": "45 s", "enfoque": "Mantén el codo arriba del hombro antes de soltar el golpe", "completado": False},
                {"id": "ia_codo_2", "nombre": "Remate suave contra pared estirando el brazo al máximo", "series": "4 x 10 reps", "descanso": "60 s", "enfoque": "Intenta tocar lo más arriba posible sin encoger el codo", "completado": False},
                {"id": "ia_codo_3", "nombre": "Lanzamiento con balón ligero por encima de la cabeza", "series": "3 x 8 reps", "descanso": "60 s", "enfoque": "Acompaña todo el movimiento usando cintura y brazo", "completado": False},
            ],
        })

    # 2. Salto vertical bajo
    if (prom_salto > 0 and prom_salto < 38.0) or "salto" in texto_unido or "vuelo" in texto_unido:
        rutinas_generadas.append({
            "id": f"rut_ia_salto_{uid[:8]}",
            "titulo": "Impulsa más fuerte para saltar más alto",
            "descripcion": "Vamos a darle más fuerza y rapidez a tus piernas para ganar altura en la red sin cansarte tan rápido.",
            "tipo": "ia",
            "categoria": "salto_vertical",
            "categoria_label": "Coach IA · Salto Vertical",
            "nivel": "Intermedio",
            "duracion_min": 25,
            "enfoque_muscular": "Piernas, glúteos y tobillos",
            "enfoque_tecnico": "Flexiona las piernas al arrancar y salta explosivo hacia arriba",
            "fase_objetivo": "Fase 1: Impulso del salto",
            "error_detectado": "Para ganar más altura: empuja el suelo con más fuerza desde las piernas",
            "dato_secundario": f"Salto: {prom_salto} cm" if prom_salto else "",
            "estado": "disponible",
            "ejercicios": [
                {"id": "ia_sal_1", "nombre": "Sentadilla con salto explosivo hacia arriba", "series": "4 x 6 reps", "descanso": "90 s", "enfoque": "Haz una pequeña pausa abajo y sube lo más rápido posible", "completado": False},
                {"id": "ia_sal_2", "nombre": "Saltitos rápidos de tobillo sin doblar casi las rodillas", "series": "3 x 12 reps", "descanso": "60 s", "enfoque": "Imagina que el suelo quema y rebota ágil hacia arriba", "completado": False},
                {"id": "ia_sal_3", "nombre": "Carrera de 3 pasos y salto tocando lo más alto", "series": "4 x 5 reps", "descanso": "90 s", "enfoque": "Usa el impulso de tus brazos hacia atrás y arriba", "completado": False},
            ],
        })

    # 3. Flexión de rodillas / aterrizaje
    if prom_rodilla > 122.0 or prom_rodilla < 90.0 or "rodilla" in texto_unido or "aterrizaje" in texto_unido:
        es_f4 = "aterrizaje" in texto_unido or fallos_fase[4] > fallos_fase[1]
        fase_lbl_r = "Fase 4: Caída suave" if es_f4 else "Fase 1: Preparación de piernas"
        rutinas_generadas.append({
            "id": f"rut_ia_rodillas_{uid[:8]}",
            "titulo": "Cuida tus rodillas al impulsar y caer",
            "descripcion": "Tus piernas necesitan doblarse un poco más como un resorte para despegar fuerte y caer sin golpear las rodillas.",
            "tipo": "ia",
            "categoria": "recepcion",
            "categoria_label": f"Coach IA · {fase_lbl_r}",
            "nivel": "Básico",
            "duracion_min": 20,
            "enfoque_muscular": "Muslos, caderas y tobillos",
            "enfoque_tecnico": "Flexiona las rodillas al arrancar y cae amortiguando con los dos pies",
            "fase_objetivo": fase_lbl_r,
            "error_detectado": "Flexiona más las rodillas en el impulso y al caer para proteger tus piernas",
            "dato_secundario": f"Rodilla: {prom_rodilla}°",
            "estado": "disponible",
            "ejercicios": [
                {"id": "ia_rod_1", "nombre": "Sentadilla controlada hasta tocar una silla y subir rápido", "series": "3 x 10 reps", "descanso": "75 s", "enfoque": "Baja cómodo doblando cadera y rodillas sin irte de frente", "completado": False},
                {"id": "ia_rod_2", "nombre": "Saltos desde escalón cayendo suave en dos pies", "series": "3 x 8 reps", "descanso": "60 s", "enfoque": "Cae parejo con los dos pies y quédate quieto 2 segundos", "completado": False},
            ],
        })

    # 4. Técnica con puntaje más bajo o mantenimiento
    tecnica_debil: Optional[Tuple[str, float]] = None
    for tec_k, lista_sc in scores_por_tec.items():
        if lista_sc:
            prom_t = sum(lista_sc) / len(lista_sc)
            if prom_t < 80.0 and (tecnica_debil is None or prom_t < tecnica_debil[1]):
                tecnica_debil = (tec_k, prom_t)

    if tecnica_debil is not None and len(rutinas_generadas) < 3:
        tec_k, prom_t = tecnica_debil
        nombre_tec = NOMBRES_TECNICA.get(tec_k, tec_k.capitalize())
        rutinas_generadas.append({
            "id": f"rut_ia_tec_{tec_k}_{uid[:8]}",
            "titulo": f"Mejora tu {nombre_tec} paso a paso",
            "descripcion": f"Vimos oportunidad de mejorar tu técnica de {nombre_tec}. Practica despacio frente a la cámara hasta que salga fluido.",
            "tipo": "ia",
            "categoria": tec_k if tec_k in ("remate", "saque", "voleo", "recepcion") else "remate",
            "categoria_label": f"Coach IA · {tec_k.capitalize()}",
            "nivel": "Intermedio",
            "duracion_min": 20,
            "enfoque_muscular": "Coordinación de brazos y piernas",
            "enfoque_tecnico": f"Haz cada movimiento de {nombre_tec} con calma y buena postura",
            "fase_objetivo": "Movimiento completo",
            "error_detectado": f"Para subir tu nivel en {nombre_tec} practicando con buena postura",
            "dato_secundario": f"Promedio: {round(prom_t)}%",
            "estado": "disponible",
            "ejercicios": [
                {"id": "ia_tec_1", "nombre": f"Repeticiones despacio de {nombre_tec} frente a la cámara", "series": "3 x 8 reps", "descanso": "45 s", "enfoque": "Haz cada parte sin apuro cuidando brazos y piernas", "completado": False},
                {"id": "ia_tec_2", "nombre": f"Práctica de {nombre_tec} a ritmo normal de juego", "series": "4 x 6 reps", "descanso": "60 s", "enfoque": "Mantén el brazo arriba y cae siempre bien equilibrado", "completado": False},
            ],
        })
    elif not rutinas_generadas:
        rutinas_generadas.append({
            "id": f"rut_ia_elite_{uid[:8]}",
            "titulo": "Mantén tu potencia hasta el final del partido",
            "descripcion": "¡Muy buena técnica! Estos ejercicios te ayudan a conservar la altura de salto y la fuerza aunque estés cansado.",
            "tipo": "ia",
            "categoria": "salto_vertical",
            "categoria_label": "Coach IA · Alto Nivel",
            "nivel": "Avanzado",
            "duracion_min": 22,
            "enfoque_muscular": "Piernas rápidas y hombros fuertes",
            "enfoque_tecnico": "Conserva la altura de salto y el brazo arriba cuando estés cansado",
            "fase_objetivo": "Resistencia y potencia",
            "error_detectado": "Para conservar tu mejor técnica hasta el último punto del set",
            "dato_secundario": "",
            "estado": "disponible",
            "ejercicios": [
                {"id": "ia_opt_1", "nombre": "Bloqueos seguidos con paso rápido y remate simulado", "series": "4 x 4 reps", "descanso": "75 s", "enfoque": "Intenta saltar igual de alto en el último salto que en el primero", "completado": False},
                {"id": "ia_opt_2", "nombre": "Estiramiento y soltura de hombros después de entrenar", "series": "2 x 10 reps", "descanso": "30 s", "enfoque": "Cuida tus hombros para estar listo en el siguiente entrenamiento", "completado": False},
            ],
        })

    return rutinas_generadas


def obtener_rutinas_usuario(
    usuario_id: str,
    token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Devuelve todas las rutinas del usuario:
      - `tipo == 'ia'`: Recomendadas generadas automáticamente desde su historial real + personalizadas.
      - `tipo == 'predeterminada'`: Biblioteca estructurada de voleibol con estado real por usuario.
    """
    _asegurar_store_cargado()
    uid = _uid_canonico(usuario_id)
    mapa_usuario = RUTINAS_POR_USUARIO.setdefault(uid, {})

    # 1. Hidratar estado remoto de Supabase si existe
    cliente = obtener_cliente_supabase_autenticado(token)
    if cliente is not None and _es_uuid_valido(uid):
        try:
            res_u = cliente.table("rutinas").select("*").eq("usuario_id", uid).execute()
            for row in getattr(res_u, "data", None) or []:
                rid = str(row.get("id") or "")
                prefix = f"usr_{uid[:8]}_"
                clean_id = rid[len(prefix):] if rid.startswith(prefix) else rid
                mapa_usuario[clean_id] = {**row, "id": clean_id}
        except Exception:
            pass

    # 2. Analizar historial real y generar/actualizar rutinas IA sin sobreescribir avances ya marcados
    sesiones = obtener_sesiones_ia_usuario(uid, token=token)
    ia_candidatas = _analizar_errores_historial_para_ia(uid, sesiones)
    resultado_ia: List[Dict[str, Any]] = []

    for r_ia in ia_candidatas:
        rid = str(r_ia["id"])
        guardada = mapa_usuario.get(rid)
        if guardada:
            # Fusionar estado de ejercicios ya completados
            ejs_map = {str(e.get("id")): bool(e.get("completado")) for e in (guardada.get("ejercicios") or [])}
            for ej in r_ia["ejercicios"]:
                if str(ej["id"]) in ejs_map:
                    ej["completado"] = ejs_map[str(ej["id"])]
            r_ia["estado"] = guardada.get("estado", "disponible")
            r_ia["iniciada_en"] = guardada.get("iniciada_en")
            r_ia["completada_en"] = guardada.get("completada_en")
        mapa_usuario[rid] = r_ia
        resultado_ia.append(_normalizar_rutina_salida(r_ia, uid))

    # Incluir rutinas IA adicionales creadas manualmente por el usuario
    ids_ia_gen = {r["id"] for r in resultado_ia}
    for rid, r_extra in mapa_usuario.items():
        if r_extra.get("tipo") == "ia" and rid not in ids_ia_gen:
            resultado_ia.append(_normalizar_rutina_salida(r_extra, uid))

    # 3. Combinar biblioteca predeterminada con el estado personal del usuario
    resultado_pred: List[Dict[str, Any]] = []
    for base_pred in BIBLIOTECA_RUTINAS_PREDETERMINADAS:
        pid = base_pred["id"]
        guardada = mapa_usuario.get(pid)
        item = {
            **base_pred,
            "ejercicios": [dict(e) for e in base_pred["ejercicios"]],
        }
        if guardada:
            ejs_map = {str(e.get("id")): bool(e.get("completado")) for e in (guardada.get("ejercicios") or [])}
            for ej in item["ejercicios"]:
                if str(ej["id"]) in ejs_map:
                    ej["completado"] = ejs_map[str(ej["id"])]
            item["estado"] = guardada.get("estado", "disponible")
            item["iniciada_en"] = guardada.get("iniciada_en")
            item["completada_en"] = guardada.get("completada_en")
        resultado_pred.append(_normalizar_rutina_salida(item, uid))

    _guardar_store_local()
    return resultado_ia + resultado_pred


def obtener_rutina_detalle_usuario(
    usuario_id: str,
    rutina_id: Any,
    token: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    rutinas = obtener_rutinas_usuario(usuario_id, token=token)
    for r in rutinas:
        if str(r.get("id")) == str(rutina_id):
            return r
    return None


def iniciar_rutina_usuario(
    usuario_id: str,
    rutina_id: str,
    token: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Marca una rutina (predeterminada o IA) como `en_progreso` para el usuario."""
    _asegurar_store_cargado()
    uid = _uid_canonico(usuario_id)
    rutina = obtener_rutina_detalle_usuario(uid, rutina_id, token=token)
    if not rutina:
        return None

    ahora_iso = datetime.now(timezone.utc).isoformat()
    if rutina.get("estado") != "completada":
        rutina["estado"] = "en_progreso"
    rutina["iniciada_en"] = rutina.get("iniciada_en") or ahora_iso

    RUTINAS_POR_USUARIO.setdefault(uid, {})[str(rutina["id"])] = dict(rutina)
    _guardar_store_local()
    _persistir_rutina_supabase(uid, rutina, token=token)

    registrar_notificacion_usuario(
        usuario_id=uid,
        tipo="rutina",
        titulo=f"Rutina iniciada: {rutina['titulo']}",
        mensaje=f"Comenzaste '{rutina['titulo']}' ({rutina['duracion_min']} min).",
        enlace="/usuario/rutinas",
        token=token,
    )
    return _normalizar_rutina_salida(rutina, uid)


def completar_ejercicio_rutina_usuario(
    usuario_id: str,
    rutina_id: Any,
    ejercicio_id: Any,
    completado: bool = True,
    token: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Marca/desmarca un ejercicio de una rutina y actualiza progreso en Supabase."""
    _asegurar_store_cargado()
    uid = _uid_canonico(usuario_id)
    rutina = obtener_rutina_detalle_usuario(uid, rutina_id, token=token)
    if not rutina:
        return None

    ej_actualizado = None
    for ej in rutina.get("ejercicios", []):
        if str(ej.get("id")) == str(ejercicio_id):
            ej["completado"] = bool(completado)
            ej_actualizado = ej
            break
    if ej_actualizado is None:
        return None

    total = len(rutina["ejercicios"])
    completados = sum(1 for e in rutina["ejercicios"] if e.get("completado"))
    porcentaje = round((completados / total) * 100) if total > 0 else 0
    ahora_iso = datetime.now(timezone.utc).isoformat()
    if completados == total and total > 0:
        rutina["estado"] = "completada"
        rutina["completada_en"] = ahora_iso
    elif completados > 0:
        rutina["estado"] = "en_progreso"
        rutina["iniciada_en"] = rutina.get("iniciada_en") or ahora_iso
        rutina["completada_en"] = None
    else:
        rutina["estado"] = "en_progreso" if rutina.get("iniciada_en") else "disponible"
        rutina["completada_en"] = None

    norm = _normalizar_rutina_salida(rutina, uid)
    RUTINAS_POR_USUARIO.setdefault(uid, {})[str(norm["id"])] = norm
    _guardar_store_local()
    _persistir_rutina_supabase(uid, norm, token=token)

    if completados == total and total > 0:
        registrar_notificacion_usuario(
            usuario_id=uid,
            tipo="logro",
            titulo="¡Rutina completada al 100%!",
            mensaje=f"Finalizaste todos los ejercicios de '{norm['titulo']}'.",
            enlace="/usuario/rutinas",
            token=token,
        )

    return {"ejercicio": ej_actualizado, "progreso": norm["progreso"], "rutina": norm}


def completar_rutina_usuario(
    usuario_id: str,
    rutina_id: str,
    completada: bool = True,
    token: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Marca una rutina completa como `completada` (o reinicia si `completada=False`)."""
    _asegurar_store_cargado()
    uid = _uid_canonico(usuario_id)
    rutina = obtener_rutina_detalle_usuario(uid, rutina_id, token=token)
    if not rutina:
        return None

    ahora_iso = datetime.now(timezone.utc).isoformat()
    for ej in rutina.get("ejercicios", []):
        ej["completado"] = bool(completada)

    if completada:
        rutina["estado"] = "completada"
        rutina["iniciada_en"] = rutina.get("iniciada_en") or ahora_iso
        rutina["completada_en"] = ahora_iso
    else:
        rutina["estado"] = "disponible"
        rutina["iniciada_en"] = None
        rutina["completada_en"] = None

    norm = _normalizar_rutina_salida(rutina, uid)
    RUTINAS_POR_USUARIO.setdefault(uid, {})[str(norm["id"])] = norm
    _guardar_store_local()
    _persistir_rutina_supabase(uid, norm, token=token)

    if completada:
        registrar_notificacion_usuario(
            usuario_id=uid,
            tipo="logro",
            titulo="¡Rutina completada!",
            mensaje=f"Marcaste como completada la rutina '{norm['titulo']}'.",
            enlace="/usuario/rutinas",
            token=token,
        )
    return norm


def crear_nueva_rutina_ia_usuario(
    usuario_id: str,
    datos: Optional[Dict[str, Any]] = None,
    token: Optional[str] = None,
) -> Dict[str, Any]:
    """Crea o recalcula una rutina correctiva IA personalizada vinculada al usuario."""
    _asegurar_store_cargado()
    uid = _uid_canonico(usuario_id)
    sesiones = obtener_sesiones_ia_usuario(uid, token=token)
    ia_list = _analizar_errores_historial_para_ia(uid, sesiones)

    if datos and (datos.get("titulo") or datos.get("nombre")):
        rid = f"rut_ia_custom_{uuid.uuid4().hex[:8]}"
        nueva = _normalizar_rutina_salida(
            {
                "id": rid,
                "titulo": str(datos.get("titulo") or datos.get("nombre")),
                "descripcion": str(datos.get("descripcion") or "Rutina correctiva personalizada generada en VolleyScan."),
                "tipo": "ia",
                "categoria": str(datos.get("categoria") or "remate"),
                "categoria_label": "Personalizada IA",
                "nivel": str(datos.get("nivel") or "Personalizado"),
                "duracion_min": int(datos.get("duracion_min") or 20),
                "enfoque_tecnico": str(datos.get("objetivo") or datos.get("enfoque_tecnico") or "Corrección técnica biomecánica"),
                "error_detectado": str(datos.get("error_detectado") or "Solicitud personalizada del deportista"),
                "estado": "disponible",
                "ejercicios": datos.get("ejercicios") or [
                    {"id": f"{rid}_1", "nombre": "Calentamiento articular específico y activación de hombro/rodilla", "series": "2 x 10 reps", "descanso": "30 s", "enfoque": "Preparación neuromuscular", "completado": False},
                    {"id": f"{rid}_2", "nombre": "Bloque técnico bajo control de cámara en 4 fases", "series": "4 x 6 reps", "descanso": "60 s", "enfoque": "Validar ángulos objetivo en t0", "completado": False},
                ],
            },
            uid,
        )
    elif ia_list:
        nueva = _normalizar_rutina_salida(ia_list[0], uid)
    else:
        rid = f"rut_ia_base_{uid[:8]}"
        nueva = _normalizar_rutina_salida(
            {
                **BIBLIOTECA_RUTINAS_PREDETERMINADAS[0],
                "id": rid,
                "tipo": "ia",
                "titulo": "Evaluación Inicial IA: Potencia y Control de Salto",
                "error_detectado": "Aún sin sesiones registradas — rutina diagnóstica inicial",
                "estado": "disponible",
            },
            uid,
        )

    RUTINAS_POR_USUARIO.setdefault(uid, {})[str(nueva["id"])] = nueva
    _guardar_store_local()
    _persistir_rutina_supabase(uid, nueva, token=token)

    registrar_notificacion_usuario(
        usuario_id=uid,
        tipo="rutina",
        titulo="Nueva rutina IA asignada",
        mensaje=f"Se generó '{nueva['titulo']}' enfocada en: {nueva['enfoque_tecnico']}.",
        enlace="/usuario/rutinas",
        token=token,
    )
    return nueva


# ============================================================================
# 2. MÓDULO DE HISTORIAL GENERAL DE SESIONES (/api/usuario/historial)
# ============================================================================

def obtener_historial_general_usuario(
    usuario_id: str,
    token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Devuelve las sesiones reales guardadas del usuario (fecha, duración exacta,
    cantidad de gestos y detalle completo con `secuencia3D` / `secuencia_landmarks_3d`).
    """
    sesiones = obtener_sesiones_ia_usuario(usuario_id, token=token)
    salida: List[Dict[str, Any]] = []
    for ses in sesiones:
        reps = ses.get("repeticiones") or []
        creado = str(ses.get("creadoEn") or datetime.now(timezone.utc).isoformat())
        dur_s = int(ses.get("duracionSeg") or 0)
        tec = str(ses.get("tecnica") or (reps[0]["movimiento"] if reps else "remate")).lower()
        sc = int(ses.get("puntuacion") or 0)
        salida.append({
            "id": str(ses.get("id")),
            "sesion_id": str(ses.get("id")),
            "tecnica": tec,
            "nombre": NOMBRES_TECNICA.get(tec, tec.capitalize()),
            "fecha": creado[:16].replace("T", " · "),
            "creado_en": creado,
            "creadoEn": creado,
            "duracion_segundos": dur_s,
            "duracionSeg": dur_s,
            "duration": _formatear_duracion(dur_s),
            "total_gestos": len(reps),
            "score": sc,
            "puntuacion": sc,
            "salto_maximo_cm": float(ses.get("saltoMaximoCm") or 0.0),
            "gestos_entrenados": ses.get("gestosEntrenados") or [],
            "gestos": reps,
            "repeticiones": reps,
            "errores": ses.get("errores") or [],
            "fortalezas": ses.get("fortalezas") or [],
            "image": IMAGENES_TECNICA.get(tec, IMAGENES_TECNICA["remate"]),
            "color": "#22c55e" if sc >= 80 else ("#3b82f6" if sc >= 68 else "#f97316"),
        })
    return salida


# ============================================================================
# 3. MÓDULO DE CONTENIDO EDUCATIVO YOUTUBE (/api/usuario/contenido)
# ============================================================================

def obtener_contenido_educativo_usuario(
    usuario_id: str,
    categoria: Optional[str] = None,
    q: Optional[str] = None,
    token: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Devuelve la biblioteca real de tutoriales técnicos de YouTube filtrable por categoría y búsqueda,
    priorizando recomendaciones acordes al historial real del usuario.
    """
    uid = _uid_canonico(usuario_id)
    sesiones = obtener_sesiones_ia_usuario(uid, token=token)
    areas_usuario = set()
    for s in sesiones[:5]:
        for rep in s.get("repeticiones") or []:
            if int(rep.get("puntuacion") or 100) < 82:
                areas_usuario.add(str(rep.get("movimiento") or "remate").lower())
            if float(rep.get("saltoVerticalCm") or 0.0) > 0 and float(rep.get("saltoVerticalCm") or 0.0) < 38.0:
                areas_usuario.add("salto_vertical")

    cat_norm = str(categoria or "").strip().lower()
    busq_norm = str(q or "").strip().lower()

    catalogo: List[Dict[str, Any]] = []
    for item in CATALOGO_CONTENIDO_BASE:
        copia = dict(item)
        copia["recomendado_ia"] = copia["categoria"] in areas_usuario
        if cat_norm and cat_norm not in ("todos", "all"):
            if copia["categoria"] != cat_norm:
                continue
        if busq_norm:
            haystack = " ".join([
                copia["titulo"],
                copia["categoria_label"],
                copia["descripcion"],
                copia["fundamento_clave"],
                copia["autor"],
            ]).lower()
            if busq_norm not in haystack:
                continue
        catalogo.append(copia)

    catalogo.sort(key=lambda v: 0 if v.get("recomendado_ia") else 1)
    return catalogo


# ============================================================================
# 4. MÓDULO DE PROGRESO DETALLADO (/api/usuario/progreso)
# ============================================================================

def _filtrar_sesiones_por_periodo(sesiones: List[Dict[str, Any]], periodo: str) -> List[Dict[str, Any]]:
    ahora = datetime.now(timezone.utc)
    p_low = str(periodo or "").lower()
    dias = 3650
    if "7" in p_low:
        dias = 7
    elif "30" in p_low:
        dias = 30
    elif "90" in p_low or "3 mes" in p_low:
        dias = 90
    corte = ahora - timedelta(days=dias)
    return [s for s in sesiones if _parse_fecha_iso(s.get("creadoEn")) >= corte]


def _calcular_rachas_sesiones(sesiones: List[Dict[str, Any]]) -> Tuple[int, int]:
    if not sesiones:
        return 0, 0
    fechas_unicas = sorted({_parse_fecha_iso(s.get("creadoEn")).date() for s in sesiones})
    if not fechas_unicas:
        return 0, 0

    mejor = 1
    actual_tmp = 1
    for i in range(1, len(fechas_unicas)):
        if (fechas_unicas[i] - fechas_unicas[i - 1]).days == 1:
            actual_tmp += 1
            mejor = max(mejor, actual_tmp)
        else:
            actual_tmp = 1

    hoy = datetime.now(timezone.utc).date()
    ultima = fechas_unicas[-1]
    if (hoy - ultima).days > 1:
        racha_actual = 0
    else:
        racha_actual = 1
        for i in range(len(fechas_unicas) - 1, 0, -1):
            if (fechas_unicas[i] - fechas_unicas[i - 1]).days == 1:
                racha_actual += 1
            else:
                break
    return racha_actual, mejor


def calcular_progreso_usuario_desde_sesiones(
    uid: str,
    sesiones: List[Dict[str, Any]],
    periodo: str = "Últimos 30 días",
) -> Dict[str, Any]:
    sesiones_filtradas = _filtrar_sesiones_por_periodo(sesiones, periodo)
    # Orden cronológico ascendente para series temporales de gráficas
    sesiones_cron = sorted(sesiones_filtradas, key=lambda s: str(s.get("creadoEn") or ""))

    evaluaciones: List[Dict[str, Any]] = []
    evolucion_salto: List[Dict[str, Any]] = []
    tiempo_total_seg = 0

    etiquetas_ses: List[str] = []
    agrupado_tec: Dict[str, List[int]] = {"remate": [], "saque": [], "recepcion": [], "bloqueo": [], "voleo": []}
    series_tec_por_sesion: Dict[str, List[Optional[int]]] = {k: [] for k in agrupado_tec}

    conteo_errores: Dict[str, int] = {
        "Extensión incompleta de codo en contacto (t0)": 0,
        "Flexión superficial o rígida de rodillas (Fase 1)": 0,
        "Elevación baja de hombro en armado (Fase 2)": 0,
        "Asimetría o carga en aterrizaje (Fase 4)": 0,
    }

    for idx_s, ses in enumerate(sesiones_cron, start=1):
        reps = ses.get("repeticiones") or []
        dur_s = int(ses.get("duracionSeg") or 0)
        tiempo_total_seg += dur_s
        fecha_iso = str(ses.get("creadoEn") or "")
        etiqueta = fecha_iso[5:10] if len(fecha_iso) >= 10 else f"S{idx_s}"
        etiquetas_ses.append(f"S{idx_s} ({etiqueta})")

        saltos_s = [float(r.get("saltoVerticalCm") or 0.0) for r in reps if float(r.get("saltoVerticalCm") or 0.0) > 0]
        scores_s = [int(r.get("puntuacion") or r.get("score") or 0) for r in reps if int(r.get("puntuacion") or r.get("score") or 0) > 0]

        evolucion_salto.append({
            "sesion_id": str(ses.get("id")),
            "etiqueta": f"S{idx_s} · {etiqueta}",
            "fecha_iso": fecha_iso,
            "salto_maximo_cm": round(max(saltos_s), 1) if saltos_s else 0.0,
            "salto_promedio_cm": round(sum(saltos_s) / len(saltos_s), 1) if saltos_s else 0.0,
            "puntaje_promedio": round(sum(scores_s) / len(scores_s)) if scores_s else 0,
            "duracion_seg": dur_s,
            "total_gestos": len(reps),
        })

        scores_ses_tec: Dict[str, List[int]] = {k: [] for k in agrupado_tec}
        for rep in reps:
            t_raw = str(rep.get("gesto_tecnico") or rep.get("movimiento") or "remate").lower()
            if t_raw == "colocacion":
                t_raw = "voleo"
            if t_raw not in agrupado_tec:
                t_raw = "remate"

            sc_r = int(rep.get("puntuacion") or rep.get("score") or 0)
            if sc_r > 0:
                agrupado_tec[t_raw].append(sc_r)
                scores_ses_tec[t_raw].append(sc_r)

            salto_r = float(rep.get("saltoVerticalCm") or 0.0)
            diag_l = str(rep.get("diagnosticoCausaRaiz") or "").lower()
            medidas_map = {m.get("id"): float(m.get("valor")) for m in (rep.get("medidas") or []) if m.get("valor") is not None}
            codo_v = medidas_map.get("extensionCodoContacto", 170.0)
            rod_v = medidas_map.get("flexionRodilla", 110.0)
            hom_v = medidas_map.get("elevacionBrazoContacto", 155.0)

            evaluaciones.append({"score": sc_r, "salto_cm": salto_r, "codo": codo_v, "rodilla": rod_v, "hombro": hom_v})

            if codo_v < 165.0 or "codo" in diag_l:
                conteo_errores["Extensión incompleta de codo en contacto (t0)"] += 1
            if rod_v > 122.0 or rod_v < 90.0 or "rodilla" in diag_l or "carga" in diag_l:
                conteo_errores["Flexión superficial o rígida de rodillas (Fase 1)"] += 1
            if hom_v < 145.0 or "hombro" in diag_l:
                conteo_errores["Elevación baja de hombro en armado (Fase 2)"] += 1
            if "asimetr" in diag_l or "aterrizaje" in diag_l or (0 < sc_r < 75):
                conteo_errores["Asimetría o carga en aterrizaje (Fase 4)"] += 1

        for tec_k in agrupado_tec:
            vals_k = scores_ses_tec[tec_k]
            series_tec_por_sesion[tec_k].append(round(sum(vals_k) / len(vals_k)) if vals_k else None)

    scores_todos = [e["score"] for e in evaluaciones if e["score"] > 0]
    puntuacion_promedio = round(sum(scores_todos) / len(scores_todos)) if scores_todos else 0
    mejora_total = (scores_todos[-1] - scores_todos[0]) if len(scores_todos) >= 2 else 0

    saltos_validos = [e["salto_cm"] for e in evaluaciones if e["salto_cm"] > 0]
    salto_max = round(max(saltos_validos), 1) if saltos_validos else 0.0
    salto_prom = round(sum(saltos_validos) / len(saltos_validos), 1) if saltos_validos else 0.0

    racha_actual, mejor_racha = _calcular_rachas_sesiones(sesiones)
    total_err = sum(conteo_errores.values())
    errores_frecuentes = []
    for nombre_err, cnt in sorted(conteo_errores.items(), key=lambda x: x[1], reverse=True):
        pct = round((cnt / total_err) * 100) if total_err > 0 else 0
        errores_frecuentes.append({
            "name": nombre_err,
            "count": cnt,
            "value": f"{pct}%",
            "width": f"{max(6, pct)}%" if pct > 0 else "0%",
            "pct": pct,
        })

    rendimiento_por_tecnica = []
    for tec_key, label_tec in [
        ("remate", "Remate"),
        ("saque", "Saque"),
        ("recepcion", "Recepción"),
        ("bloqueo", "Bloqueo"),
        ("voleo", "Voleo"),
    ]:
        vals_t = agrupado_tec[tec_key]
        prom_t = round(sum(vals_t) / len(vals_t)) if vals_t else 0
        delta_t = (vals_t[-1] - vals_t[0]) if len(vals_t) >= 2 else 0
        rendimiento_por_tecnica.append({
            "tecnica": tec_key,
            "name": label_tec,
            "valor": prom_t,
            "delta": delta_t,
            "total": len(vals_t),
            "color": COLORES_TECNICA[tec_key],
        })

    # Comparativa Fortalezas vs Áreas a Mejorar (basada exclusivamente en datos reales)
    fortalezas: List[Dict[str, str]] = []
    areas_mejora: List[Dict[str, str]] = []

    if evaluaciones:
        for tec_item in sorted(rendimiento_por_tecnica, key=lambda x: x["valor"], reverse=True):
            if tec_item["total"] > 0 and tec_item["valor"] >= 80:
                fortalezas.append({
                    "titulo": f"Dominio en {tec_item['name']}",
                    "detalle": f"Precisión media de {tec_item['valor']}% en {tec_item['total']} gestos evaluados.",
                    "metrica": f"{tec_item['valor']}%",
                })
            elif tec_item["total"] > 0 and tec_item["valor"] < 78:
                areas_mejora.append({
                    "titulo": f"Reforzar {tec_item['name']}",
                    "detalle": f"Efectividad media en {tec_item['valor']}% — aplica la rutina correctiva asignada.",
                    "metrica": f"{tec_item['valor']}%",
                })

        if salto_max >= 40.0:
            fortalezas.append({
                "titulo": "Impulso Vertical Destacado",
                "detalle": f"Altura pico verificada por tiempo de vuelo de {salto_max} cm.",
                "metrica": f"{salto_max} cm",
            })
        elif 0 < salto_prom < 36.0:
            areas_mejora.append({
                "titulo": "Potencia de Salto Vertical",
                "detalle": f"Salto promedio de {salto_prom} cm — prioriza pliometría en Fase 1.",
                "metrica": f"{salto_prom} cm",
            })

        for err_i in errores_frecuentes:
            if err_i["count"] > 0 and len(areas_mejora) < 4:
                areas_mejora.append({
                    "titulo": err_i["name"],
                    "detalle": f"Presente en {err_i['count']} evaluación(es) ({err_i['pct']}% de incidencias).",
                    "metrica": f"{err_i['count']}x",
                })

    horas = tiempo_total_seg // 3600
    mins = (tiempo_total_seg % 3600) // 60
    segs = tiempo_total_seg % 60
    if horas > 0:
        tiempo_str = f"{horas}h {mins:02d}m"
    elif mins > 0:
        tiempo_str = f"{mins}m {segs:02d}s"
    else:
        tiempo_str = f"{segs}s" if tiempo_total_seg > 0 else "0m"

    return {
        "usuario_id": uid,
        "periodo": periodo,
        "tiene_datos": len(sesiones_cron) > 0,
        "total_sesiones": len(sesiones_cron),
        "analisis_realizados": len(evaluaciones),
        "tiempo_total_seg": tiempo_total_seg,
        "tiempo_entrenando": tiempo_str,
        "racha_dias": racha_actual,
        "mejor_racha_dias": mejor_racha,
        "puntuacion_promedio": puntuacion_promedio,
        "mejora_total_pct": mejora_total,
        "salto_maximo_cm": salto_max,
        "salto_promedio_cm": salto_prom,
        "evolucion_salto": evolucion_salto,
        "tendencia_precision_por_gesto": {
            "labels": etiquetas_ses,
            "series": series_tec_por_sesion,
            "resumen": rendimiento_por_tecnica,
        },
        "fortalezas": fortalezas[:4],
        "areas_mejora": areas_mejora[:4],
        "evolucion_rendimiento": scores_todos[-12:],
        "errores_frecuentes": errores_frecuentes,
        "rendimiento_por_tecnica": rendimiento_por_tecnica,
    }


def obtener_progreso_usuario(
    usuario_id: str,
    periodo: str = "Últimos 30 días",
    token: Optional[str] = None,
) -> Dict[str, Any]:
    """Devuelve métricas y series analíticas reales del usuario autenticado."""
    uid = _uid_canonico(usuario_id)
    sesiones = obtener_sesiones_ia_usuario(uid, token=token)
    return calcular_progreso_usuario_desde_sesiones(uid, sesiones, periodo=periodo)


# ============================================================================
# 5. MÓDULO DE NOTIFICACIONES (/api/usuario/notificaciones)
# ============================================================================

def obtener_notificaciones_usuario(
    usuario_id: str,
    solo_no_leidas: bool = False,
    token: Optional[str] = None,
) -> Dict[str, Any]:
    _asegurar_store_cargado()
    uid = _uid_canonico(usuario_id)
    lista = NOTIFICACIONES_POR_USUARIO.setdefault(uid, [])

    if not lista:
        progreso = obtener_progreso_usuario(uid, token=token)
        rutinas = obtener_rutinas_usuario(uid, token=token)
        total_an = progreso.get("analisis_realizados", 0)
        prom = progreso.get("puntuacion_promedio", 0)
        salto_max = progreso.get("salto_maximo_cm", 0.0)

        if total_an > 0:
            lista.append({
                "id": f"ntf_prog_{uid[:6]}",
                "usuario_id": uid,
                "type": "analisis",
                "unread": True,
                "leida": False,
                "title": "Historial IA sincronizado",
                "msg": (
                    f"Tienes {total_an} evaluaciones registradas con promedio {prom}/100"
                    + (f" y salto máximo de {salto_max} cm." if salto_max > 0 else ".")
                ),
                "time": "Sincronizado hoy",
                "creado_en": datetime.now(timezone.utc).isoformat(),
                "link": "/usuario/histtrial",
            })
        else:
            lista.append({
                "id": f"ntf_welcome_{uid[:6]}",
                "usuario_id": uid,
                "type": "recordatorio",
                "unread": True,
                "leida": False,
                "title": "Bienvenido a VolleyScan 3D",
                "msg": "Completa tu primera sesión en 'Análisis IA' para generar tus gráficas de progreso y rutinas correctivas.",
                "time": "Ahora",
                "creado_en": datetime.now(timezone.utc).isoformat(),
                "link": "/usuario/analisis",
            })

        rutinas_ia = [r for r in rutinas if r.get("tipo") == "ia"]
        if rutinas_ia:
            r0 = rutinas_ia[0]
            lista.append({
                "id": f"ntf_rut_{r0['id']}",
                "usuario_id": uid,
                "type": "rutina",
                "unread": True,
                "leida": False,
                "title": f"Rutina IA recomendada: {r0['titulo']}",
                "msg": f"Objetivo: {r0['enfoque_tecnico']} ({r0['progreso']['completados']}/{r0['progreso']['total']} ejercicios).",
                "time": "Activa hoy",
                "creado_en": datetime.now(timezone.utc).isoformat(),
                "link": "/usuario/rutinas",
            })

    for n in lista:
        n["time"] = _formatear_tiempo_relativo(n.get("creado_en"))

    sin_leer = sum(1 for n in lista if n.get("unread", True))
    notifs_filtradas = [n for n in lista if n.get("unread", True)] if solo_no_leidas else lista

    recomendaciones = [
        {
            "id": 1,
            "title": "Maximiza tu Tiempo de Vuelo",
            "desc": "Optimiza la flexión de rodillas (95°–120°) en la Fase 1 para ganar centímetros de salto vertical.",
            "img": "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=75",
            "link": "/usuario/rutinas",
        },
        {
            "id": 2,
            "title": "Reproduce tu Replay 3D en Historial",
            "desc": "Audita ángulo por ángulo el instante crítico (t0) y el esqueleto 3D guardado de cada gesto.",
            "img": "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400&q=75",
            "link": "/usuario/historial",
        },
        {
            "id": 3,
            "title": "Laboratorio en Vivo (Puerto 8000)",
            "desc": "Inicia una nueva captura para registrar altura de salto, ángulos 3D y diagnóstico automático.",
            "img": "https://images.unsplash.com/photo-1547347298-4074fc3086f0?w=400&q=75",
            "link": "/usuario/analisis",
        },
    ]

    return {
        "usuario_id": uid,
        "sin_leer": sin_leer,
        "total": len(lista),
        "notificaciones": notifs_filtradas,
        "recomendaciones": recomendaciones,
    }


def marcar_notificacion_leida_usuario(usuario_id: str, notif_id: str) -> Dict[str, Any]:
    _asegurar_store_cargado()
    uid = _uid_canonico(usuario_id)
    for n in NOTIFICACIONES_POR_USUARIO.get(uid, []):
        if str(n.get("id")) == str(notif_id):
            n["unread"] = False
            n["leida"] = True
    _guardar_store_local()
    return obtener_notificaciones_usuario(uid)


def marcar_todas_notificaciones_leidas_usuario(usuario_id: str) -> Dict[str, Any]:
    _asegurar_store_cargado()
    uid = _uid_canonico(usuario_id)
    for n in NOTIFICACIONES_POR_USUARIO.get(uid, []):
        n["unread"] = False
        n["leida"] = True
    _guardar_store_local()
    return obtener_notificaciones_usuario(uid)


def eliminar_notificacion_usuario(usuario_id: str, notif_id: str) -> Dict[str, Any]:
    _asegurar_store_cargado()
    uid = _uid_canonico(usuario_id)
    NOTIFICACIONES_POR_USUARIO[uid] = [
        n for n in NOTIFICACIONES_POR_USUARIO.get(uid, []) if str(n.get("id")) != str(notif_id)
    ]
    _guardar_store_local()
    return obtener_notificaciones_usuario(uid)


def limpiar_notificaciones_usuario(usuario_id: str) -> Dict[str, Any]:
    _asegurar_store_cargado()
    uid = _uid_canonico(usuario_id)
    NOTIFICACIONES_POR_USUARIO[uid] = []
    _guardar_store_local()
    return {
        "usuario_id": uid,
        "sin_leer": 0,
        "total": 0,
        "notificaciones": [],
        "recomendaciones": [],
    }


# ============================================================================
# 6. PERFIL Y CONFIGURACIÓN DEL USUARIO AUTENTICADO
# ============================================================================

def obtener_perfil_usuario(
    usuario_id: str,
    jwt_info: Optional[Dict[str, Optional[str]]] = None,
) -> Dict[str, Any]:
    _asegurar_store_cargado()
    uid = _uid_canonico(usuario_id)
    info = jwt_info or {}
    if uid not in PERFILES_POR_USUARIO:
        email = info.get("email") or "atleta@volleyscan.app"
        nombre = info.get("nombre") or (email.split("@")[0].capitalize() if email else "Atleta")
        apellido = info.get("apellido") or ""
        PERFILES_POR_USUARIO[uid] = {
            "id": uid,
            "nombre": nombre,
            "apellido": apellido,
            "nombre_completo": f"{nombre} {apellido}".strip(),
            "email": email,
            "edad": 16,
            "fecha_nac": "2010-05-14",
            "nivel": "intermedio",
            "peso": 65,
            "estatura": 1.74,
            "estatura_cm": 174,
            "mano_dominante": "Derecha",
            "posicion": "punta",
            "foto_url": None,
        }
    perfil = PERFILES_POR_USUARIO[uid]
    # Asegurar consistencia bidireccional entre nombre_completo / estatura_cm / defaults
    if not perfil.get("nombre_completo"):
        perfil["nombre_completo"] = f"{perfil.get('nombre') or ''} {perfil.get('apellido') or ''}".strip() or "Atleta"
    if not perfil.get("estatura_cm") and perfil.get("estatura"):
        try:
            est_val = float(perfil["estatura"])
            perfil["estatura_cm"] = round(est_val * 100) if est_val < 3 else round(est_val)
        except Exception:
            perfil["estatura_cm"] = 170
    perfil.setdefault("mano_dominante", "Derecha")
    perfil.setdefault("edad", 16)
    return perfil


def actualizar_perfil_usuario(
    usuario_id: str,
    datos: Dict[str, Any],
    jwt_info: Optional[Dict[str, Optional[str]]] = None,
) -> Dict[str, Any]:
    actual = obtener_perfil_usuario(usuario_id, jwt_info)
    if datos.get("nombre_completo") and not datos.get("nombre"):
        partes = str(datos["nombre_completo"]).strip().split()
        actual["nombre"] = partes[0] if partes else actual.get("nombre", "Atleta")
        actual["apellido"] = " ".join(partes[1:]) if len(partes) > 1 else ""
    for k in (
        "nombre",
        "apellido",
        "nombre_completo",
        "email",
        "edad",
        "fecha_nac",
        "nivel",
        "peso",
        "estatura",
        "estatura_cm",
        "mano_dominante",
        "posicion",
        "foto_url",
    ):
        if k in datos and datos[k] is not None:
            actual[k] = datos[k]
    if datos.get("estatura_cm") is not None:
        try:
            cm = float(datos["estatura_cm"])
            actual["estatura_cm"] = round(cm)
            actual["estatura"] = round(cm / 100.0, 2)
        except Exception:
            pass
    elif datos.get("estatura") is not None:
        try:
            est_v = float(datos["estatura"])
            cm = round(est_v * 100) if est_v < 3 else round(est_v)
            actual["estatura_cm"] = cm
            actual["estatura"] = round(cm / 100.0, 2)
        except Exception:
            pass
    actual["nombre_completo"] = (
        str(actual.get("nombre_completo") or "").strip()
        or f"{actual.get('nombre') or ''} {actual.get('apellido') or ''}".strip()
        or "Atleta"
    )
    _guardar_store_local()
    return actual


def obtener_configuracion_usuario(usuario_id: str) -> Dict[str, Any]:
    _asegurar_store_cargado()
    uid = _uid_canonico(usuario_id)
    if uid not in CONFIG_POR_USUARIO:
        CONFIG_POR_USUARIO[uid] = {
            "usuario_id": uid,
            "unidad_medida": "metric",
            "idioma": "es",
            "tema": "dark",
            "calidad_video": "hd",
            "guardar_videos": True,
            "notif_sesion": True,
            "notif_analisis": True,
            "notif_contenido": True,
            "compartir_progreso": True,
            "permitir_comentarios": True,
            "visibilidad_analisis": "entrenador",
        }
    return CONFIG_POR_USUARIO[uid]


def actualizar_configuracion_usuario(usuario_id: str, datos: Dict[str, Any]) -> Dict[str, Any]:
    actual = obtener_configuracion_usuario(usuario_id)
    for k, v in (datos or {}).items():
        if v is not None:
            actual[k] = v
    _guardar_store_local()
    return actual
