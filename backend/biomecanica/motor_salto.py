"""
Módulo del Motor Físico de Salto Vertical (`motor_salto.py`).
Responsabilidad Única (SOLID): Recibir el búfer de 33 frames y, SOLO si el gesto
implica salto ("Remate", "Bloqueo", "Saque"), calcular la matemática del despegue
(UMBRAL_DE_DESPEGUE del 5% de la altura total del jugador y ecuación cinemática
h = (9.81 * t^2) / 8 * 100) y devolver los centímetros de salto vertical.
"""

from typing import Any, Dict, List, Optional
import numpy as np


class MotorSaltoVertical:
    """
    Motor físico exclusivo para el cálculo de tiempo de vuelo (Hang Time)
    y altura de salto vertical en centímetros.
    """

    GESTOS_CON_SALTO = {"remate", "bloqueo", "saque"}
    GESTOS_SIN_SALTO = {"voleo", "colocacion", "colocación", "recepcion", "recepción"}

    @staticmethod
    def _extraer_y_pies_frame(frame: Any) -> Optional[float]:
        """
        Extrae la coordenada vertical Y representativa de los pies para un frame dado,
        promediando tobillos (27, 28) y puntas de los pies (31, 32).
        """
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

        return None

    @staticmethod
    def _extraer_y_nariz_frame(frame: Any) -> Optional[float]:
        """Extrae la coordenada vertical Y de la nariz (landmark [0])."""
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

        return None

    @staticmethod
    def _extraer_y_tobillos_frame(frame: Any) -> Optional[float]:
        """Extrae el promedio de la coordenada vertical Y de los tobillos (27, 28)."""
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

        return MotorSaltoVertical._extraer_y_pies_frame(frame)

    @classmethod
    def calcular_salto_vertical(
        cls,
        buffer_frames: List[Any],
        gesto_detectado: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Recibe el búfer de 33 frames y, SOLO si el gesto implica salto, calcula la
        matemática del despegue y devuelve el diccionario con `salto_vertical_cm` y `tiempo_vuelo_segundos`.
        Si el gesto es "Voleo" o "Recepción", puentea el cálculo y devuelve 0.0 cm inmediatamente.
        """
        if gesto_detectado is not None:
            gesto_norm = str(gesto_detectado).strip().lower()
            if gesto_norm in cls.GESTOS_SIN_SALTO or (
                gesto_norm and gesto_norm not in cls.GESTOS_CON_SALTO
            ):
                return {
                    "tiempo_vuelo_segundos": 0.0,
                    "salto_vertical_cm": 0.0,
                    "frame_despegue": None,
                    "frame_aterrizaje": None,
                }

        if not buffer_frames or len(buffer_frames) < 4:
            return {
                "tiempo_vuelo_segundos": 0.0,
                "salto_vertical_cm": 0.0,
                "frame_despegue": None,
                "frame_aterrizaje": None,
            }

        ys_pies: List[float] = []
        ys_tobillos: List[float] = []
        timestamps: List[float] = []
        dt_default = 1.0 / 30.0

        for idx, f in enumerate(buffer_frames):
            y_val = cls._extraer_y_pies_frame(f)
            y_tob = cls._extraer_y_tobillos_frame(f)
            if isinstance(f, dict):
                ts = f.get("timestamp")
            else:
                ts = getattr(f, "timestamp", None)

            ts_float = float(ts) if ts is not None else float(idx * dt_default)
            if y_val is not None:
                ys_pies.append(y_val)
                ys_tobillos.append(float(y_tob) if y_tob is not None else y_val)
                timestamps.append(ts_float)

        if len(ys_pies) < 4:
            return {
                "tiempo_vuelo_segundos": 0.0,
                "salto_vertical_cm": 0.0,
                "frame_despegue": None,
                "frame_aterrizaje": None,
            }

        diffs_ts = [timestamps[i] - timestamps[i - 1] for i in range(1, len(timestamps))]
        if any(d <= 0 for d in diffs_ts):
            timestamps = [float(i * dt_default) for i in range(len(ys_pies))]
        elif max(timestamps) - min(timestamps) > 100.0:
            t0_ms = timestamps[0]
            timestamps = [(t - t0_ms) / 1000.0 for t in timestamps]

        # Altura total del jugador en t0_calibracion (distancia eje Y nariz [0] a tobillos [27, 28])
        t0_calibracion = buffer_frames[0]
        y_nariz_t0 = cls._extraer_y_nariz_frame(t0_calibracion)
        y_tobillos_t0 = ys_tobillos[0]
        if y_nariz_t0 is None:
            y_nariz_t0 = 0.20 if y_tobillos_t0 <= 2.0 else (y_tobillos_t0 * 0.22)

        altura_total_jugador = abs(float(y_tobillos_t0) - float(y_nariz_t0))
        if altura_total_jugador <= 1e-6:
            altura_total_jugador = 0.75 if y_tobillos_t0 <= 2.0 else 360.0

        UMBRAL_DE_DESPEGUE = 0.05 * altura_total_jugador

        n_base = min(6, max(2, len(ys_tobillos) // 5))
        muestras_base_tob = ys_tobillos[:n_base]
        linea_base_y_tob = float(np.median(muestras_base_tob))

        elevaciones_tobillos = [linea_base_y_tob - y for y in ys_tobillos]
        max_elevacion = float(max(elevaciones_tobillos)) if elevaciones_tobillos else 0.0
        idx_apex = int(np.argmax(elevaciones_tobillos))

        # Si el desplazamiento vertical no supera el 5% de la altura total -> 0.0 cm
        if max_elevacion <= UMBRAL_DE_DESPEGUE:
            return {
                "tiempo_vuelo_segundos": 0.0,
                "salto_vertical_cm": 0.0,
                "frame_despegue": None,
                "frame_aterrizaje": None,
            }

        umbral_cruce_vuelo = max(UMBRAL_DE_DESPEGUE * 0.35, max_elevacion * 0.15)

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

        t_despegue = timestamps[frame_despegue]
        t_aterrizaje = timestamps[frame_aterrizaje]
        tiempo_vuelo = max(0.0, float(t_aterrizaje - t_despegue))

        if tiempo_vuelo < 0.08 or tiempo_vuelo > 1.25:
            return {
                "tiempo_vuelo_segundos": 0.0,
                "salto_vertical_cm": 0.0,
                "frame_despegue": None,
                "frame_aterrizaje": None,
            }

        # Fórmula física de caída libre por Tiempo de Vuelo (Time of Flight):
        # h = 0.5 * 9.81 * (t / 2)^2   -> convertido a centímetros (h * 100)
        gravedad = 9.81
        altura_metros = 0.5 * gravedad * ((tiempo_vuelo / 2.0) ** 2)
        salto_cm = altura_metros * 100.0

        return {
            "tiempo_vuelo_segundos": round(float(tiempo_vuelo), 3),
            "altura_metros": round(float(altura_metros), 4),
            "salto_vertical_cm": round(float(salto_cm), 2),
            "frame_despegue": int(frame_despegue),
            "frame_aterrizaje": int(frame_aterrizaje),
        }

    @classmethod
    def calcular_cm_salto(
        cls,
        buffer_frames: List[Any],
        gesto_detectado: Optional[str] = None,
    ) -> float:
        """Devuelve directamente los centímetros de salto vertical (0.0 si no aplica)."""
        res = cls.calcular_salto_vertical(buffer_frames, gesto_detectado=gesto_detectado)
        return float(res.get("salto_vertical_cm", 0.0))


def calcular_salto_vertical(
    buffer_frames: List[Any],
    gesto_detectado: Optional[str] = None,
) -> Dict[str, Any]:
    """Función de nivel de módulo para calcular tiempo de vuelo y salto vertical en cm."""
    return MotorSaltoVertical.calcular_salto_vertical(
        buffer_frames=buffer_frames,
        gesto_detectado=gesto_detectado,
    )


def calcular_cm_salto(
    buffer_frames: List[Any],
    gesto_detectado: Optional[str] = None,
) -> float:
    """Función de nivel de módulo que devuelve directamente los cm de salto vertical."""
    return MotorSaltoVertical.calcular_cm_salto(
        buffer_frames=buffer_frames,
        gesto_detectado=gesto_detectado,
    )
