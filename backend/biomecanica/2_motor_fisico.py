"""
2. Motor Físico de Salto Vertical y Cinemática Continua (`2_motor_fisico.py`).
Responsabilidad Única: Recibir el búfer de 33 frames y calcular el salto vertical
(aplicando el umbral estricto del 5% de la altura total). Si el clasificador indicó
"Voleo" o "Recepción", esta función se salta el cálculo y devuelve 0.0 cm.
"""

from typing import Any, Dict, List, Optional, Sequence
import numpy as np


GESTOS_SIN_SALTO = {"voleo", "colocacion", "colocación", "recepcion", "recepción"}
GESTOS_CON_SALTO = {"remate", "bloqueo", "saque"}
UMBRAL_DERIVADA_BRUSCA_DEG_FRAME: float = 28.0
UMBRAL_DERIVADA_ANGULAR_MAX: float = 25.0
ACELERACION_GRAVEDAD_MS2: float = 9.81
FPS_CAPTURA_POR_DEFECTO: float = 30.0
UMBRAL_DE_DESPEGUE_RELATIVO: float = 0.05
UMBRAL_DE_DESPEGUE: float = UMBRAL_DE_DESPEGUE_RELATIVO


def _extraer_y_pies_frame(frame: Any) -> Optional[float]:
    """Extrae la coordenada Y promedio de tobillos (27, 28) y puntas de pies (31, 32)."""
    try:
        valores_y: List[float] = []
        if isinstance(frame, dict):
            lm33 = frame.get("landmarks_33")
            if isinstance(lm33, (list, tuple)) and len(lm33) >= 33:
                for idx_pie in (27, 28, 31, 32):
                    pt = lm33[idx_pie]
                    if isinstance(pt, dict) and "y" in pt:
                        valores_y.append(float(pt["y"]))
                    elif isinstance(pt, (list, tuple)) and len(pt) >= 2:
                        valores_y.append(float(pt[1]))
                if valores_y:
                    return float(sum(valores_y) / len(valores_y))

            for dict_key in ("landmarks_2d_original", "puntos_2d", "puntos_3d_suaves", "world_landmarks_3d"):
                src = frame.get(dict_key)
                if isinstance(src, dict):
                    for k_pie in (
                        "tobillo_izq",
                        "tobillo_der",
                        "punta_pie_izq",
                        "punta_pie_der",
                        "pie_indice_izq",
                        "pie_indice_der",
                        "left_ankle",
                        "right_ankle",
                        "left_foot_index",
                        "right_foot_index",
                    ):
                        val = src.get(k_pie)
                        if isinstance(val, dict) and "y" in val:
                            valores_y.append(float(val["y"]))
                        elif isinstance(val, (list, tuple)) and len(val) >= 2:
                            valores_y.append(float(val[1]))
                    if valores_y:
                        return float(sum(valores_y) / len(valores_y))
        else:
            for attr in ("landmarks_2d", "world_landmarks_3d"):
                src = getattr(frame, attr, None)
                if isinstance(src, dict):
                    for k_pie in ("tobillo_izq", "tobillo_der", "punta_pie_izq", "punta_pie_der"):
                        val = src.get(k_pie)
                        if isinstance(val, (list, tuple)) and len(val) >= 2:
                            valores_y.append(float(val[1]))
                    if valores_y:
                        return float(sum(valores_y) / len(valores_y))
    except (TypeError, ValueError, KeyError, IndexError):
        return None
    return None


def _extraer_y_tobillos_frame(frame: Any) -> Optional[float]:
    """Extrae el promedio de la coordenada Y de los tobillos (27, 28)."""
    try:
        valores_y: List[float] = []
        if isinstance(frame, dict):
            lm33 = frame.get("landmarks_33")
            if isinstance(lm33, (list, tuple)) and len(lm33) >= 29:
                for idx_tob in (27, 28):
                    pt = lm33[idx_tob]
                    if isinstance(pt, dict) and "y" in pt:
                        valores_y.append(float(pt["y"]))
                    elif isinstance(pt, (list, tuple)) and len(pt) >= 2:
                        valores_y.append(float(pt[1]))
                if valores_y:
                    return float(sum(valores_y) / len(valores_y))

            for dict_key in ("landmarks_2d_original", "puntos_2d", "puntos_3d_suaves", "world_landmarks_3d"):
                src = frame.get(dict_key)
                if isinstance(src, dict):
                    for k_tob in ("tobillo_izq", "tobillo_der", "left_ankle", "right_ankle"):
                        val = src.get(k_tob)
                        if isinstance(val, dict) and "y" in val:
                            valores_y.append(float(val["y"]))
                        elif isinstance(val, (list, tuple)) and len(val) >= 2:
                            valores_y.append(float(val[1]))
                    if valores_y:
                        return float(sum(valores_y) / len(valores_y))
        else:
            for attr in ("landmarks_2d", "world_landmarks_3d"):
                src = getattr(frame, attr, None)
                if isinstance(src, dict):
                    for k_tob in ("tobillo_izq", "tobillo_der"):
                        val = src.get(k_tob)
                        if isinstance(val, (list, tuple)) and len(val) >= 2:
                            valores_y.append(float(val[1]))
                    if valores_y:
                        return float(sum(valores_y) / len(valores_y))
    except (TypeError, ValueError, KeyError, IndexError):
        return None
    return _extraer_y_pies_frame(frame)


def _extraer_y_nariz_frame(frame: Any) -> Optional[float]:
    """Extrae la coordenada Y de la nariz (landmark [0])."""
    try:
        if isinstance(frame, dict):
            lm33 = frame.get("landmarks_33")
            if isinstance(lm33, (list, tuple)) and len(lm33) >= 1:
                pt = lm33[0]
                if isinstance(pt, dict) and "y" in pt:
                    return float(pt["y"])
                if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                    return float(pt[1])

            for dict_key in ("landmarks_2d_original", "puntos_2d", "puntos_3d_suaves", "world_landmarks_3d"):
                src = frame.get(dict_key)
                if isinstance(src, dict):
                    for k_nariz in ("nariz", "nose"):
                        val = src.get(k_nariz)
                        if isinstance(val, dict) and "y" in val:
                            return float(val["y"])
                        if isinstance(val, (list, tuple)) and len(val) >= 2:
                            return float(val[1])
                    h_izq = src.get("hombro_izq")
                    h_der = src.get("hombro_der")
                    t_izq = src.get("tobillo_izq")
                    t_der = src.get("tobillo_der")
                    if (
                        isinstance(h_izq, (list, tuple))
                        and len(h_izq) >= 2
                        and isinstance(h_der, (list, tuple))
                        and len(h_der) >= 2
                    ):
                        y_hombro = (float(h_izq[1]) + float(h_der[1])) / 2.0
                        if (
                            isinstance(t_izq, (list, tuple))
                            and len(t_izq) >= 2
                            and isinstance(t_der, (list, tuple))
                            and len(t_der) >= 2
                        ):
                            y_tob = (float(t_izq[1]) + float(t_der[1])) / 2.0
                            tramo = abs(y_tob - y_hombro)
                            return float(y_hombro - (0.22 * tramo if tramo > 0 else 0.15))
                        return float(y_hombro - 0.15)
        else:
            for attr in ("landmarks_2d", "world_landmarks_3d"):
                src = getattr(frame, attr, None)
                if isinstance(src, dict):
                    val = src.get("nariz") or src.get("nose")
                    if isinstance(val, (list, tuple)) and len(val) >= 2:
                        return float(val[1])
    except (TypeError, ValueError, KeyError, IndexError):
        return None
    return None


def calcular_salto_vertical(
    buffer_frames: Sequence[Any],
    gesto_detectado: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Calcula el salto vertical en cm aplicando el umbral estricto del 5% de la altura total.
    Si el clasificador indicó "Voleo" o "Recepción", se salta el cálculo y devuelve 0.0 cm.
    """
    respuesta_cero: Dict[str, Any] = {
        "tiempo_vuelo_segundos": 0.0,
        "salto_vertical_cm": 0.0,
        "frame_despegue": None,
        "frame_aterrizaje": None,
    }

    if gesto_detectado is not None:
        gesto_norm = str(gesto_detectado).strip().lower()
        if gesto_norm in GESTOS_SIN_SALTO or (gesto_norm and gesto_norm not in GESTOS_CON_SALTO):
            return dict(respuesta_cero)

    if not buffer_frames or len(buffer_frames) < 4:
        return dict(respuesta_cero)

    try:
        ys_pies: List[float] = []
        ys_tobillos: List[float] = []
        timestamps: List[float] = []
        dt_default = 1.0 / FPS_CAPTURA_POR_DEFECTO

        for idx, f in enumerate(buffer_frames):
            y_val = _extraer_y_pies_frame(f)
            y_tob = _extraer_y_tobillos_frame(f)
            ts = f.get("timestamp") if isinstance(f, dict) else getattr(f, "timestamp", None)
            ts_float = float(ts) if ts is not None else float(idx * dt_default)
            if y_val is not None:
                ys_pies.append(y_val)
                ys_tobillos.append(float(y_tob) if y_tob is not None else y_val)
                timestamps.append(ts_float)

        if len(ys_pies) < 4:
            return dict(respuesta_cero)

        diffs_ts = [timestamps[i] - timestamps[i - 1] for i in range(1, len(timestamps))]
        if any(d <= 0 for d in diffs_ts):
            timestamps = [float(i * dt_default) for i in range(len(ys_pies))]
        elif max(timestamps) - min(timestamps) > 100.0:
            t0_ms = timestamps[0]
            timestamps = [(t - t0_ms) / 1000.0 for t in timestamps]

        t0_calibracion = buffer_frames[0]
        y_nariz_t0 = _extraer_y_nariz_frame(t0_calibracion)
        y_tobillos_t0 = ys_tobillos[0]
        if y_nariz_t0 is None:
            y_nariz_t0 = 0.20 if y_tobillos_t0 <= 2.0 else (y_tobillos_t0 * 0.22)

        altura_total_jugador = abs(float(y_tobillos_t0) - float(y_nariz_t0))
        if altura_total_jugador <= 1e-6:
            altura_total_jugador = 0.75 if y_tobillos_t0 <= 2.0 else 360.0

        umbral_despegue = UMBRAL_DE_DESPEGUE_RELATIVO * altura_total_jugador

        n_base = min(6, max(2, len(ys_tobillos) // 5))
        linea_base_y_tob = float(np.median(ys_tobillos[:n_base]))
        elevaciones_tobillos = [linea_base_y_tob - y for y in ys_tobillos]
        max_elevacion = float(max(elevaciones_tobillos)) if elevaciones_tobillos else 0.0
        idx_apex = int(np.argmax(elevaciones_tobillos))

        if max_elevacion <= umbral_despegue:
            return dict(respuesta_cero)

        umbral_cruce_vuelo = max(umbral_despegue * 0.35, max_elevacion * 0.15)
        frame_despegue = 0
        for i in range(idx_apex, -1, -1):
            if elevaciones_tobillos[i] <= umbral_cruce_vuelo:
                frame_despegue = min(idx_apex, i + 1)
                break

        frame_aterrizaje = len(ys_tobillos) - 1
        for i in range(idx_apex, len(ys_tobillos)):
            if elevaciones_tobillos[i] <= umbral_cruce_vuelo:
                frame_aterrizaje = i
                break

        tiempo_vuelo = max(0.0, float(timestamps[frame_aterrizaje] - timestamps[frame_despegue]))
        if tiempo_vuelo < 0.08 or tiempo_vuelo > 1.25:
            return dict(respuesta_cero)

        # Fórmula física de caída libre por Tiempo de Vuelo (Time of Flight):
        # h = 0.5 * 9.81 * (t / 2)^2   -> convertido a centímetros (h * 100)
        h_metros = 0.5 * ACELERACION_GRAVEDAD_MS2 * ((tiempo_vuelo / 2.0) ** 2)
        salto_cm = h_metros * 100.0
        return {
            "tiempo_vuelo_segundos": round(float(tiempo_vuelo), 3),
            "altura_metros": round(float(h_metros), 4),
            "salto_vertical_cm": round(float(salto_cm), 2),
            "frame_despegue": int(frame_despegue),
            "frame_aterrizaje": int(frame_aterrizaje),
        }
    except (TypeError, ValueError, KeyError, IndexError, ZeroDivisionError):
        return dict(respuesta_cero)


def calcular_cm_salto(
    buffer_frames: Sequence[Any],
    gesto_detectado: Optional[str] = None,
) -> float:
    """Devuelve directamente los centímetros de salto vertical (0.0 si es Voleo o Recepción)."""
    res = calcular_salto_vertical(buffer_frames, gesto_detectado=gesto_detectado)
    return float(res.get("salto_vertical_cm", 0.0))


def evaluar_cinematica_continua_33_frames(
    frames_procesados: Sequence[Dict[str, Any]],
    t0_idx_relativo: int = 20,
) -> Dict[str, Any]:
    """
    Evalúa la cinemática articular continua a lo largo de los 33 frames
    (velocidad angular, aceleración angular y suavidad del movimiento).
    """
    cinematica_vacia: Dict[str, Any] = {
        "total_frames_evaluados": 0,
        "angulos_codo_33": [],
        "angulos_rodilla_33": [],
        "vel_angular_codo_deg_s": [],
        "acel_angular_codo_deg_s2": [],
        "vel_angular_rodilla_deg_s": [],
        "acel_angular_rodilla_deg_s2": [],
        "derivada_codo_deg_frame": [],
        "derivada_rodilla_deg_frame": [],
        "max_derivada_angular": 0.0,
        "estado_suavidad": "Movimiento fluido",
        "es_movimiento_brusco": False,
        "max_extension_codo_impacto": 170.0,
        "min_flexion_rodilla_preparacion": 110.0,
    }

    if not frames_procesados:
        return dict(cinematica_vacia)

    try:
        total = len(frames_procesados)
        idx_t0 = max(0, min(total - 1, int(t0_idx_relativo)))

        codos = [float((f.get("angulos_3d") or {}).get("codo", 160.0)) for f in frames_procesados]
        rodillas = [float((f.get("angulos_3d") or {}).get("rodilla", 140.0)) for f in frames_procesados]
        timestamps = [
            float(f.get("timestamp") if isinstance(f.get("timestamp"), (int, float)) else idx * 0.0333)
            for idx, f in enumerate(frames_procesados)
        ]

        derivada_codo_frame: List[float] = [0.0]
        derivada_rodilla_frame: List[float] = [0.0]
        vel_codo_s: List[float] = [0.0]
        vel_rodilla_s: List[float] = [0.0]

        for i in range(1, total):
            dt = timestamps[i] - timestamps[i - 1]
            if dt <= 1e-4:
                dt = 0.0333
            dc = codos[i] - codos[i - 1]
            dr = rodillas[i] - rodillas[i - 1]
            derivada_codo_frame.append(round(abs(dc), 2))
            derivada_rodilla_frame.append(round(abs(dr), 2))
            vel_codo_s.append(round(dc / dt, 2))
            vel_rodilla_s.append(round(dr / dt, 2))

        acel_codo_s2: List[float] = [0.0]
        acel_rodilla_s2: List[float] = [0.0]
        for i in range(1, total):
            dt = timestamps[i] - timestamps[i - 1]
            if dt <= 1e-4:
                dt = 0.0333
            acel_codo_s2.append(round((vel_codo_s[i] - vel_codo_s[i - 1]) / dt, 2))
            acel_rodilla_s2.append(round((vel_rodilla_s[i] - vel_rodilla_s[i - 1]) / dt, 2))

        max_derivada_codo = max(derivada_codo_frame) if derivada_codo_frame else 0.0
        max_derivada_rodilla = max(derivada_rodilla_frame) if derivada_rodilla_frame else 0.0
        max_derivada_global = max(max_derivada_codo, max_derivada_rodilla)

        es_brusco = max_derivada_global > UMBRAL_DERIVADA_BRUSCA_DEG_FRAME
        estado_suavidad = (
            "Movimiento errático/Peligro de lesión"
            if es_brusco
            else "Movimiento fluido"
        )

        ini_imp = max(0, idx_t0 - 2)
        fin_imp = min(total, idx_t0 + 3)
        ventana_impacto = codos[ini_imp:fin_imp] if fin_imp > ini_imp else codos
        max_codo_impacto = max(ventana_impacto) if ventana_impacto else 170.0

        fin_prep = max(1, min(total, idx_t0))
        ventana_prep = rodillas[:fin_prep]
        min_rodilla_prep = min(ventana_prep) if ventana_prep else 110.0

        return {
            "total_frames_evaluados": total,
            "angulos_codo_33": [round(v, 1) for v in codos],
            "angulos_rodilla_33": [round(v, 1) for v in rodillas],
            "vel_angular_codo_deg_s": vel_codo_s,
            "acel_angular_codo_deg_s2": acel_codo_s2,
            "vel_angular_rodilla_deg_s": vel_rodilla_s,
            "acel_angular_rodilla_deg_s2": acel_rodilla_s2,
            "derivada_codo_deg_frame": derivada_codo_frame,
            "derivada_rodilla_deg_frame": derivada_rodilla_frame,
            "max_derivada_angular": round(max_derivada_global, 2),
            "estado_suavidad": estado_suavidad,
            "es_movimiento_brusco": es_brusco,
            "max_extension_codo_impacto": round(max_codo_impacto, 1),
            "min_flexion_rodilla_preparacion": round(min_rodilla_prep, 1),
        }
    except (TypeError, ValueError, KeyError, IndexError, ZeroDivisionError):
        return dict(cinematica_vacia)


class MotorFisicoSalto:
    """Clase contenedora del motor físico de salto vertical y cinemática de 33 frames."""

    calcular_salto_vertical = staticmethod(calcular_salto_vertical)
    calcular_cm_salto = staticmethod(calcular_cm_salto)
    evaluar_cinematica_continua_33_frames = staticmethod(evaluar_cinematica_continua_33_frames)
