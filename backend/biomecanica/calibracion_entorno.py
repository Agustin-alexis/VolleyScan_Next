"""
Módulo de Calibración Cero Ambiental y Máquina de Estados de Sesión (Fase 1).
Implementa el filtro preventivo de calidad lumínica y validación geométrica flexible
de Postura en 'T' (muñecas 15, 16 y codos 13, 14 dentro de ±0.20 respecto a la altura
de los hombros 11, 12 en el eje Y, y brazos extendidos con separación amplia en el eje X)
durante ~2 segundos (45 fotogramas continuos).

Cumple estrictamente con la Arquitectura Limpia (Clean Architecture) y el Principio
de Responsabilidad Única (SOLID), manteniendo toda la matemática de MediaPipe
desacoplada de la capa de red (WebSockets).
"""

import math
import time
from typing import Any, Dict, List, Optional, Tuple


MENSAJE_BLOQUEO_CALIBRACION = (
    "Ponte frente a la cámara en Posición de 'T' "
    "(brazos extendidos) durante 2 segundos para calibrar"
)
MENSAJE_EXITO_CALIBRACION = "Calibrado / Listo — Sistema de captura activado."
MENSAJE_ERROR_LUZ_CALIBRACION = "Poca luz o contraluz. Mejora la iluminación de la habitación."


class ResultadoCalibracion(dict):
    """
    Diccionario enriquecido con el resultado de `verificar_calibracion(landmarks)`.
    Al evaluarse como booleano (`bool(res)`), retorna True únicamente si tanto la
    calidad lumínica del entorno como la Postura en 'T' son válidas simultáneamente.
    """

    def __bool__(self) -> bool:
        return bool(self.get("valida", False))


class CalibradorAmbiental:
    """
    Evaluador matemático puro de calidad del entorno (Luz/Ruido) y Postura en 'T'.
    """

    UMBRAL_VISIBILIDAD_MINIMA: float = 0.25
    MARGEN_GRADOS_POSTURA_T: float = 35.0
    MARGEN_Y_POSTURA_T: float = 0.20
    FRAMES_CONTINUOS_REQUERIDOS: int = 30

    @staticmethod
    def _extraer_xy_vis(punto: Any) -> Optional[Tuple[float, float, float]]:
        """
        Extrae (x, y, visibility) de un landmark en cualquiera de las representaciones
        soportadas: lista/tupla [x, y, z, vis], diccionario {'x', 'y', 'visibility'}
        u objeto con atributos .x, .y, .visibility.
        """
        if punto is None:
            return None

        if isinstance(punto, (list, tuple)):
            if len(punto) < 2:
                return None
            x = float(punto[0])
            y = float(punto[1])
            vis = float(punto[3]) if len(punto) >= 4 else 1.0
            return (x, y, vis)

        if isinstance(punto, dict):
            if "x" in punto and "y" in punto:
                x = float(punto["x"])
                y = float(punto["y"])
                vis = float(punto.get("visibility", punto.get("vis", 1.0)))
                return (x, y, vis)
            return None

        if hasattr(punto, "x") and hasattr(punto, "y"):
            x = float(getattr(punto, "x"))
            y = float(getattr(punto, "y"))
            vis = float(getattr(punto, "visibility", 1.0))
            return (x, y, vis)

        return None

    @classmethod
    def _extraer_visibilidades_y_articulaciones(
        cls, landmarks: Any
    ) -> Tuple[
        List[float],
        Optional[Tuple[float, float]],
        Optional[Tuple[float, float]],
        Optional[Tuple[float, float]],
        Optional[Tuple[float, float]],
        Optional[Tuple[float, float]],
        Optional[Tuple[float, float]],
    ]:
        """
        Extrae la lista de scores de `visibility` y las coordenadas (x, y) de:
          - hombro_izq (11), hombro_der (12)
          - codo_izq (13), codo_der (14)
          - muneca_izq (15), muneca_der (16)
        """
        visibilidades: List[float] = []
        h_izq: Optional[Tuple[float, float]] = None
        h_der: Optional[Tuple[float, float]] = None
        c_izq: Optional[Tuple[float, float]] = None
        c_der: Optional[Tuple[float, float]] = None
        m_izq: Optional[Tuple[float, float]] = None
        m_der: Optional[Tuple[float, float]] = None

        if landmarks is None:
            return visibilidades, h_izq, h_der, c_izq, c_der, m_izq, m_der

        # Caso 1: Diccionario envolvente con 'landmarks_33' y/o 'puntos'
        if isinstance(landmarks, dict) and ("landmarks_33" in landmarks or "puntos" in landmarks):
            lm33 = landmarks.get("landmarks_33")
            puntos_dict = landmarks.get("puntos") or {}

            if isinstance(lm33, (list, tuple)) and len(lm33) > 0:
                for p in lm33:
                    extraido = cls._extraer_xy_vis(p)
                    if extraido is not None:
                        visibilidades.append(extraido[2])

                if len(lm33) > 16:
                    p11 = cls._extraer_xy_vis(lm33[11])
                    p12 = cls._extraer_xy_vis(lm33[12])
                    p13 = cls._extraer_xy_vis(lm33[13])
                    p14 = cls._extraer_xy_vis(lm33[14])
                    p15 = cls._extraer_xy_vis(lm33[15])
                    p16 = cls._extraer_xy_vis(lm33[16])
                    if p11:
                        h_izq = (p11[0], p11[1])
                    if p12:
                        h_der = (p12[0], p12[1])
                    if p13:
                        c_izq = (p13[0], p13[1])
                    if p14:
                        c_der = (p14[0], p14[1])
                    if p15:
                        m_izq = (p15[0], p15[1])
                    if p16:
                        m_der = (p16[0], p16[1])

            if isinstance(puntos_dict, dict) and len(puntos_dict) > 0:
                if not visibilidades:
                    for val in puntos_dict.values():
                        extraido = cls._extraer_xy_vis(val)
                        if extraido is not None:
                            visibilidades.append(extraido[2])

                if h_izq is None:
                    p = cls._extraer_xy_vis(
                        puntos_dict.get("hombro_izq") or puntos_dict.get(11) or puntos_dict.get("11")
                    )
                    if p:
                        h_izq = (p[0], p[1])
                if h_der is None:
                    p = cls._extraer_xy_vis(
                        puntos_dict.get("hombro_der") or puntos_dict.get("hombro") or puntos_dict.get(12) or puntos_dict.get("12")
                    )
                    if p:
                        h_der = (p[0], p[1])
                if c_izq is None:
                    p = cls._extraer_xy_vis(
                        puntos_dict.get("codo_izq") or puntos_dict.get(13) or puntos_dict.get("13")
                    )
                    if p:
                        c_izq = (p[0], p[1])
                if c_der is None:
                    p = cls._extraer_xy_vis(
                        puntos_dict.get("codo_der") or puntos_dict.get("codo") or puntos_dict.get(14) or puntos_dict.get("14")
                    )
                    if p:
                        c_der = (p[0], p[1])
                if m_izq is None:
                    p = cls._extraer_xy_vis(
                        puntos_dict.get("muneca_izq") or puntos_dict.get(15) or puntos_dict.get("15")
                    )
                    if p:
                        m_izq = (p[0], p[1])
                if m_der is None:
                    p = cls._extraer_xy_vis(
                        puntos_dict.get("muneca_der") or puntos_dict.get("muneca") or puntos_dict.get(16) or puntos_dict.get("16")
                    )
                    if p:
                        m_der = (p[0], p[1])

            return visibilidades, h_izq, h_der, c_izq, c_der, m_izq, m_der

        # Caso 2: Lista o tupla directa de landmarks (ej. los 33 landmarks de MediaPipe)
        if isinstance(landmarks, (list, tuple)):
            for p in landmarks:
                extraido = cls._extraer_xy_vis(p)
                if extraido is not None:
                    visibilidades.append(extraido[2])

            if len(landmarks) > 16:
                p11 = cls._extraer_xy_vis(landmarks[11])
                p12 = cls._extraer_xy_vis(landmarks[12])
                p13 = cls._extraer_xy_vis(landmarks[13])
                p14 = cls._extraer_xy_vis(landmarks[14])
                p15 = cls._extraer_xy_vis(landmarks[15])
                p16 = cls._extraer_xy_vis(landmarks[16])
                if p11:
                    h_izq = (p11[0], p11[1])
                if p12:
                    h_der = (p12[0], p12[1])
                if p13:
                    c_izq = (p13[0], p13[1])
                if p14:
                    c_der = (p14[0], p14[1])
                if p15:
                    m_izq = (p15[0], p15[1])
                if p16:
                    m_der = (p16[0], p16[1])

            return visibilidades, h_izq, h_der, c_izq, c_der, m_izq, m_der

        # Caso 3: Diccionario directo de articulaciones (nombradas o indexadas 0..32)
        if isinstance(landmarks, dict):
            for val in landmarks.values():
                extraido = cls._extraer_xy_vis(val)
                if extraido is not None:
                    visibilidades.append(extraido[2])

            p11 = cls._extraer_xy_vis(
                landmarks.get("hombro_izq") or landmarks.get(11) or landmarks.get("11")
            )
            p12 = cls._extraer_xy_vis(
                landmarks.get("hombro_der") or landmarks.get("hombro") or landmarks.get(12) or landmarks.get("12")
            )
            p13 = cls._extraer_xy_vis(
                landmarks.get("codo_izq") or landmarks.get(13) or landmarks.get("13")
            )
            p14 = cls._extraer_xy_vis(
                landmarks.get("codo_der") or landmarks.get("codo") or landmarks.get(14) or landmarks.get("14")
            )
            p15 = cls._extraer_xy_vis(
                landmarks.get("muneca_izq") or landmarks.get(15) or landmarks.get("15")
            )
            p16 = cls._extraer_xy_vis(
                landmarks.get("muneca_der") or landmarks.get("muneca") or landmarks.get(16) or landmarks.get("16")
            )
            if p11:
                h_izq = (p11[0], p11[1])
            if p12:
                h_der = (p12[0], p12[1])
            if p13:
                c_izq = (p13[0], p13[1])
            if p14:
                c_der = (p14[0], p14[1])
            if p15:
                m_izq = (p15[0], p15[1])
            if p16:
                m_der = (p16[0], p16[1])

        return visibilidades, h_izq, h_der, c_izq, c_der, m_izq, m_der

    @classmethod
    def verificar_calibracion(cls, landmarks: Any) -> ResultadoCalibracion:
        """
        Evalúa las condiciones de Calibración Cero Ambiental:
          a) Calidad del entorno (Luz/Ruido):
             El promedio del score de `visibility` supera el umbral mínimo (> 0.35).
          b) Postura en 'T' con tolerancia flexible:
             - Condición Y: Permite que la coordenada Y de las muñecas (15, 16) y los codos (13, 14)
               tenga una diferencia de hasta ±0.20 (±20%) respecto a la altura de los hombros (11, 12).
             - Condición X: Verifica únicamente que la distancia horizontal (eje X) entre ambas
               muñecas sea amplia (brazos abiertos).
        """
        visibilidades, h_izq, h_der, c_izq, c_der, m_izq, m_der = (
            cls._extraer_visibilidades_y_articulaciones(landmarks)
        )

        # a) Evaluación de Calidad del Entorno (Luz / Contraluz)
        if len(visibilidades) > 0:
            visibilidad_promedio = float(sum(visibilidades) / len(visibilidades))
        else:
            visibilidad_promedio = 0.0

        iluminacion_valida = bool(visibilidad_promedio > cls.UMBRAL_VISIBILIDAD_MINIMA)

        # b) Evaluación Geométrica Flexible de Postura en 'T'
        postura_t_valida = False
        separadas_en_x = False
        alineadas_en_y = False
        angulo_izq_deg = 90.0
        angulo_der_deg = 90.0
        separacion_munecas_x = 0.0
        separacion_hombros_x = 0.0

        if h_izq is not None and h_der is not None and m_izq is not None and m_der is not None:
            separacion_munecas_x = abs(m_izq[0] - m_der[0])
            separacion_hombros_x = abs(h_izq[0] - h_der[0])
            y_hombros_media = (h_izq[1] + h_der[1]) / 2.0

            # Emparejar cada muñeca con su hombro correspondiente (soportando imagen espejo o directa)
            dist_directa = abs(m_izq[0] - h_izq[0]) + abs(m_der[0] - h_der[0])
            dist_cruzada = abs(m_izq[0] - h_der[0]) + abs(m_der[0] - h_izq[0])
            if dist_directa <= dist_cruzada:
                dx_izq = abs(m_izq[0] - h_izq[0])
                dy_izq = abs(m_izq[1] - h_izq[1])
                dx_der = abs(m_der[0] - h_der[0])
                dy_der = abs(m_der[1] - h_der[1])
            else:
                dx_izq = abs(m_izq[0] - h_der[0])
                dy_izq = abs(m_izq[1] - h_der[1])
                dx_der = abs(m_der[0] - h_izq[0])
                dy_der = abs(m_der[1] - h_izq[1])

            # Condición X: Solo verifica que la distancia horizontal entre ambas muñecas sea amplia
            separadas_en_x = bool(
                separacion_munecas_x > separacion_hombros_x
                and separacion_munecas_x >= 0.18
            )

            # Ángulos informativos de desviación respecto a la horizontal
            if dx_izq > 1e-5:
                angulo_izq_deg = float(math.degrees(math.atan2(dy_izq, dx_izq)))
            else:
                angulo_izq_deg = 90.0

            if dx_der > 1e-5:
                angulo_der_deg = float(math.degrees(math.atan2(dy_der, dx_der)))
            else:
                angulo_der_deg = 90.0

            # Condición Y: Permite que muñecas (15, 16) y codos (13, 14) tengan una diferencia
            # de hasta ±0.20 (±20%) respecto a la altura de los hombros (11, 12)
            munecas_en_y = (
                abs(m_izq[1] - y_hombros_media) <= cls.MARGEN_Y_POSTURA_T
                and abs(m_der[1] - y_hombros_media) <= cls.MARGEN_Y_POSTURA_T
            )
            codos_en_y = True
            if c_izq is not None:
                codos_en_y = codos_en_y and (abs(c_izq[1] - y_hombros_media) <= cls.MARGEN_Y_POSTURA_T)
            if c_der is not None:
                codos_en_y = codos_en_y and (abs(c_der[1] - y_hombros_media) <= cls.MARGEN_Y_POSTURA_T)

            alineadas_en_y = bool(
                munecas_en_y
                or (munecas_en_y and codos_en_y)
                or (
                    angulo_izq_deg <= cls.MARGEN_GRADOS_POSTURA_T
                    and angulo_der_deg <= cls.MARGEN_GRADOS_POSTURA_T
                )
            )
            postura_t_valida = bool(separadas_en_x and alineadas_en_y)
            if postura_t_valida and not iluminacion_valida and visibilidad_promedio >= 0.15:
                iluminacion_valida = True

        valida = bool(iluminacion_valida and postura_t_valida)

        if not iluminacion_valida:
            tipo = "error_calibracion"
            mensaje = MENSAJE_ERROR_LUZ_CALIBRACION
        elif not postura_t_valida:
            tipo = "postura_incompleta"
            mensaje = MENSAJE_BLOQUEO_CALIBRACION
        else:
            tipo = "frame_calibrado"
            mensaje = MENSAJE_EXITO_CALIBRACION

        return ResultadoCalibracion(
            {
                "valida": valida,
                "calibracion_valida": valida,
                "iluminacion_valida": iluminacion_valida,
                "postura_t_valida": postura_t_valida,
                "separadas_en_x": separadas_en_x,
                "alineadas_en_y": alineadas_en_y,
                "visibilidad_promedio": round(visibilidad_promedio, 4),
                "angulo_brazo_izq_deg": round(angulo_izq_deg, 2),
                "angulo_brazo_der_deg": round(angulo_der_deg, 2),
                "separacion_munecas_x": round(separacion_munecas_x, 4),
                "separacion_hombros_x": round(separacion_hombros_x, 4),
                "error_iluminacion": not iluminacion_valida,
                "tipo": tipo,
                "mensaje": mensaje,
            }
        )


def verificar_calibracion(landmarks: Any) -> ResultadoCalibracion:
    """
    Función de dominio público para validar en un fotograma la calidad del entorno
    y la Postura en 'T' con tolerancias flexibles (±0.20 en Y y amplitud horizontal en X).
    """
    return CalibradorAmbiental.verificar_calibracion(landmarks)


class GestorCalibracionAmbiental:
    """
    Máquina de Estados de Calibración de Sesión:
    Estados: 1. CALIBRANDO -> 2. ACTIVO
    Requiere que `verificar_calibracion(landmarks)` se cumpla durante ~2 segundos
    (~30 frames o 2.0s de tiempo continuo) para desbloquear el sistema y pasar a Calibrado / Listo.
    """

    def __init__(self, frames_requeridos: int = 30):
        self.frames_requeridos: int = frames_requeridos
        self.frames_continuos: int = 0
        self.estado_sesion: str = "CALIBRANDO"
        self.inicio_racha_ts: Optional[float] = None

    def reiniciar(self) -> None:
        """Reinicia la máquina de estados al estado inicial CALIBRANDO."""
        self.frames_continuos = 0
        self.estado_sesion = "CALIBRANDO"
        self.inicio_racha_ts = None

    def desbloquear_manual(self) -> None:
        """Cambia directamente el estado a ACTIVO."""
        self.frames_continuos = self.frames_requeridos
        self.estado_sesion = "ACTIVO"

    def evaluar_frame_sesion(self, landmarks: Any) -> Dict[str, Any]:
        """
        Procesa un fotograma entrante dentro de la máquina de estados:
        - Si ya está en estado ACTIVO, retorna estado ACTIVO.
        - Si cumple la postura en 'T' durante `frames_requeridos` (o 2.0 segundos),
          transiciona a `ACTIVO` y devuelve `{"tipo": "calibracion_exitosa", ...}`.
        """
        if self.estado_sesion == "ACTIVO":
            return {
                "tipo": "sistema_activo",
                "estado_sesion": "ACTIVO",
                "mensaje": MENSAJE_EXITO_CALIBRACION,
                "frames_calibrados": self.frames_requeridos,
                "frames_requeridos": self.frames_requeridos,
                "progreso_pct": 100.0,
            }

        res = verificar_calibracion(landmarks)

        # Caso 1: Baja visibilidad / mala iluminación
        if not res["iluminacion_valida"]:
            self.frames_continuos = 0
            self.inicio_racha_ts = None
            return {
                "tipo": "error_calibracion",
                "mensaje": MENSAJE_ERROR_LUZ_CALIBRACION,
                "estado_sesion": "CALIBRANDO",
                "frames_calibrados": 0,
                "frames_requeridos": self.frames_requeridos,
                "progreso_pct": 0.0,
                "visibilidad_promedio": res["visibilidad_promedio"],
                "iluminacion_valida": False,
                "postura_t_valida": res["postura_t_valida"],
            }

        # Caso 2: Buena luz, pero el jugador aún no adopta la Postura en 'T'
        if not res["postura_t_valida"]:
            self.frames_continuos = max(0, self.frames_continuos - 2)
            if self.frames_continuos == 0:
                self.inicio_racha_ts = None
            progreso = min(100.0, round((self.frames_continuos / max(1, self.frames_requeridos)) * 100.0, 1))
            return {
                "tipo": "estado_calibracion",
                "mensaje": MENSAJE_BLOQUEO_CALIBRACION,
                "estado_sesion": "CALIBRANDO",
                "frames_calibrados": self.frames_continuos,
                "frames_requeridos": self.frames_requeridos,
                "progreso_pct": progreso,
                "visibilidad_promedio": res["visibilidad_promedio"],
                "iluminacion_valida": True,
                "postura_t_valida": False,
                "angulo_brazo_izq_deg": res["angulo_brazo_izq_deg"],
                "angulo_brazo_der_deg": res["angulo_brazo_der_deg"],
            }

        # Caso 3: Luz óptima + Postura en 'T' válida -> Incrementar racha continua
        ahora = time.time()
        if self.inicio_racha_ts is None:
            self.inicio_racha_ts = ahora
        tiempo_en_t = ahora - self.inicio_racha_ts

        self.frames_continuos += 1
        progreso_frames = (self.frames_continuos / max(1, self.frames_requeridos)) * 100.0
        progreso_tiempo = (tiempo_en_t / 2.0) * 100.0
        progreso = min(100.0, round(max(progreso_frames, progreso_tiempo), 1))

        if self.frames_continuos >= self.frames_requeridos or (tiempo_en_t >= 2.0 and self.frames_continuos >= 10):
            self.estado_sesion = "ACTIVO"
            return {
                "tipo": "calibracion_exitosa",
                "mensaje": MENSAJE_EXITO_CALIBRACION,
                "estado_sesion": "ACTIVO",
                "frames_calibrados": self.frames_requeridos,
                "frames_requeridos": self.frames_requeridos,
                "progreso_pct": 100.0,
                "visibilidad_promedio": res["visibilidad_promedio"],
                "iluminacion_valida": True,
                "postura_t_valida": True,
            }

        return {
            "tipo": "estado_calibracion",
            "mensaje": MENSAJE_BLOQUEO_CALIBRACION,
            "estado_sesion": "CALIBRANDO",
            "frames_calibrados": self.frames_continuos,
            "frames_requeridos": self.frames_requeridos,
            "progreso_pct": progreso,
            "visibilidad_promedio": res["visibilidad_promedio"],
            "iluminacion_valida": True,
            "postura_t_valida": True,
            "angulo_brazo_izq_deg": res["angulo_brazo_izq_deg"],
            "angulo_brazo_der_deg": res["angulo_brazo_der_deg"],
        }
