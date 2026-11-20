"""
Módulo de Clasificación Geométrica Multi-Gesto (`clasificador_gestos.py`).
Responsabilidad Única (SOLID): Recibir el búfer de 33 frames, analizar la geometría
articular y postural, y devolver exclusivamente el string canónico del gesto técnico:
("Remate", "Voleo", "Recepción", "Bloqueo", "Saque").
"""

from typing import Any, List, Optional, Tuple
import numpy as np


MAPA_GESTOS_CANONICOS = {
    "voleo": "Voleo",
    "colocacion": "Voleo",
    "colocación": "Voleo",
    "bloqueo": "Bloqueo",
    "saque": "Saque",
    "remate": "Remate",
    "recepcion": "Recepción",
    "recepción": "Recepción",
}


class ClasificadorGestos:
    """
    Clasificador geométrico puro sobre el búfer de 33 fotogramas.
    Aplica la Regla de Oro:
      a) Si no hay salto vertical (`salto_vertical_cm == 0.0` o desplazamiento de tobillos <= 5%
         de la altura total nariz-tobillos), el gesto NUNCA puede ser "Remate" ni "Bloqueo".
      b) Sin salto vertical, evalúa la altura de las muñecas (15, 16) respecto a los hombros (11, 12) en t0:
         - Muñecas por debajo de los hombros -> "Recepción".
         - Muñecas por encima de los hombros -> "Voleo".
      c) Con salto vertical (> 0.0 cm o despegue > 5%):
         - Ambas muñecas por encima de la cabeza/hombros de forma simétrica (diferencia en Y < 5%) -> "Bloqueo".
         - Clara asimetría (una mano extendida arriba para golpear, la otra abajo o en equilibrio) -> "Remate".
    """

    @staticmethod
    def _extraer_coord_xyz(
        frame: Any,
        idx_mp: int,
        claves_dict: Tuple[str, ...],
        preferir_2d: bool = True,
    ) -> Optional[List[float]]:
        """Extrae coordenadas [x, y, z] de un frame (dict o FramePoseData)."""
        if isinstance(frame, dict):
            lm33 = frame.get("landmarks_33")
            if isinstance(lm33, (list, tuple)) and len(lm33) > idx_mp:
                pt = lm33[idx_mp]
                if isinstance(pt, dict):
                    return [float(pt.get("x", 0.5)), float(pt.get("y", 0.5)), float(pt.get("z", 0.0))]
                if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                    return [float(pt[0]), float(pt[1]), float(pt[2]) if len(pt) >= 3 else 0.0]

            fuentes = (
                ("landmarks_2d_original", "puntos_2d", "puntos", "puntos_3d_suaves", "world_landmarks_3d")
                if preferir_2d
                else ("puntos_3d_suaves", "world_landmarks_3d", "landmarks_2d_original", "puntos_2d", "puntos")
            )
            for src_key in fuentes:
                src = frame.get(src_key)
                if isinstance(src, dict):
                    for k in claves_dict:
                        if k in src and src[k] is not None:
                            val = src[k]
                            if isinstance(val, dict):
                                return [float(val.get("x", 0.5)), float(val.get("y", 0.5)), float(val.get("z", 0.0))]
                            if isinstance(val, (list, tuple)) and len(val) >= 2:
                                return [float(val[0]), float(val[1]), float(val[2]) if len(val) >= 3 else 0.0]
        else:
            for attr in ("landmarks_2d", "world_landmarks_3d"):
                src = getattr(frame, attr, None)
                if isinstance(src, dict):
                    for k in claves_dict:
                        if k in src and src[k] is not None:
                            val = src[k]
                            if isinstance(val, (list, tuple)) and len(val) >= 2:
                                return [float(val[0]), float(val[1]), float(val[2]) if len(val) >= 3 else 0.0]
        return None

    @classmethod
    def _detectar_despegue_geometrico_5pct(cls, buffer_frames: List[Any]) -> bool:
        """
        Evalúa geométricamente si los tobillos (27, 28) superan el 5% de la altura total
        del jugador (distancia en eje Y entre nariz [0] y tobillos [27, 28] en t0_calibracion).
        """
        if not buffer_frames or len(buffer_frames) < 4:
            return False

        f0 = buffer_frames[0]
        nariz_0 = cls._extraer_coord_xyz(f0, 0, ("nariz", "nose"), preferir_2d=True)
        tob_izq_0 = cls._extraer_coord_xyz(f0, 27, ("tobillo_izq", "left_ankle"), preferir_2d=True)
        tob_der_0 = cls._extraer_coord_xyz(f0, 28, ("tobillo_der", "right_ankle"), preferir_2d=True)

        ys_tobillos: List[float] = []
        for f in buffer_frames:
            ti = cls._extraer_coord_xyz(f, 27, ("tobillo_izq", "left_ankle"), preferir_2d=True)
            td = cls._extraer_coord_xyz(f, 28, ("tobillo_der", "right_ankle"), preferir_2d=True)
            vals = [p[1] for p in (ti, td) if p is not None]
            if vals:
                ys_tobillos.append(float(sum(vals) / len(vals)))

        if not ys_tobillos:
            return False

        y_tob_inicial = ys_tobillos[0]
        if nariz_0 is not None:
            y_nariz_0 = float(nariz_0[1])
        else:
            hombro_i = cls._extraer_coord_xyz(f0, 11, ("hombro_izq",), preferir_2d=True)
            hombro_d = cls._extraer_coord_xyz(f0, 12, ("hombro_der",), preferir_2d=True)
            if hombro_i is not None and hombro_d is not None:
                y_hombro = (hombro_i[1] + hombro_d[1]) / 2.0
                tramo = abs(y_tob_inicial - y_hombro)
                y_nariz_0 = y_hombro - (0.22 * tramo if tramo > 0 else 0.15)
            else:
                y_nariz_0 = 0.20 if y_tob_inicial <= 2.0 else y_tob_inicial * 0.22

        altura_total = abs(y_tob_inicial - y_nariz_0)
        if altura_total <= 1e-6:
            altura_total = 0.75 if y_tob_inicial <= 2.0 else 360.0

        umbral_despegue = 0.05 * altura_total
        n_base = min(6, max(2, len(ys_tobillos) // 5))
        linea_base_y = float(np.median(ys_tobillos[:n_base]))
        max_elevacion = float(max(linea_base_y - y for y in ys_tobillos))

        return max_elevacion > umbral_despegue

    @classmethod
    def clasificar_gesto_tecnico(
        cls,
        buffer_frames: List[Any],
        salto_vertical_cm: Optional[float] = None,
        t0_index: int = 20,
    ) -> str:
        """
        Analiza la geometría del búfer de 33 frames y devuelve un string canónico:
        ("Remate", "Voleo", "Recepción", "Bloqueo", "Saque").
        """
        if not buffer_frames:
            return "Recepción"

        total = len(buffer_frames)
        idx_t0 = max(0, min(total - 1, int(t0_index)))
        f_t0 = buffer_frames[idx_t0]

        hombro_izq = cls._extraer_coord_xyz(f_t0, 11, ("hombro_izq",), preferir_2d=True) or [-0.15, 0.38, 0.0]
        hombro_der = cls._extraer_coord_xyz(f_t0, 12, ("hombro_der",), preferir_2d=True) or [0.15, 0.38, 0.0]
        muneca_izq = cls._extraer_coord_xyz(f_t0, 15, ("muneca_izq",), preferir_2d=True) or [-0.15, 0.50, 0.0]
        muneca_der = cls._extraer_coord_xyz(f_t0, 16, ("muneca_der",), preferir_2d=True) or [0.15, 0.50, 0.0]

        y_hombro_izq = float(hombro_izq[1])
        y_hombro_der = float(hombro_der[1])
        y_hombros_avg = (y_hombro_izq + y_hombro_der) / 2.0

        y_muneca_izq = float(muneca_izq[1])
        y_muneca_der = float(muneca_der[1])

        escala_y = 480.0 if max(abs(y_hombros_avg), abs(y_muneca_izq), abs(y_muneca_der)) > 2.0 else 1.0
        diferencia_y_norm = abs(y_muneca_der - y_muneca_izq) / escala_y

        # En MediaPipe (Y=0 arriba, Y=1 abajo): muñeca sobre hombro => y_muneca < y_hombro
        muneca_izq_sobre_hombro = y_muneca_izq < (y_hombro_izq - 0.005 * escala_y)
        muneca_der_sobre_hombro = y_muneca_der < (y_hombro_der - 0.005 * escala_y)
        alguna_muneca_sobre_hombros = muneca_izq_sobre_hombro or muneca_der_sobre_hombro
        ambas_munecas_sobre_hombros = muneca_izq_sobre_hombro and muneca_der_sobre_hombro

        # Determinar si existe salto vertical válido (> 5% de altura del jugador)
        if salto_vertical_cm is not None:
            tiene_salto = float(salto_vertical_cm) > 0.0
        else:
            tiene_salto = cls._detectar_despegue_geometrico_5pct(buffer_frames)

        # REGLA DE ORO (a y b): Sin salto vertical, NUNCA puede ser Remate ni Bloqueo
        if not tiene_salto:
            if alguna_muneca_sobre_hombros:
                return "Voleo"
            return "Recepción"

        # REGLA DE ORO (c): Con salto vertical (> 0 cm):
        # - Ambas muñecas por encima de hombros/cabeza con simetría (diferencia en Y < 5%) -> "Bloqueo"
        # - Una muñeca arriba con carrera de aproximación en cadera -> "Remate"
        # - Una muñeca arriba con varianza horizontal mínima de cadera -> "Saque"
        if ambas_munecas_sobre_hombros and diferencia_y_norm < 0.05:
            return "Bloqueo"

        if len(buffer_frames) >= 12:
            idx_fin = min(len(buffer_frames), idx_t0 + 1)
            idx_ini = max(0, idx_fin - 16)
            xs_c: List[float] = []
            zs_c: List[float] = []
            vels_c: List[float] = []
            for f_item in buffer_frames[idx_ini:idx_fin]:
                if isinstance(f_item, dict):
                    cin_f = f_item.get("cinematica")
                    if isinstance(cin_f, dict) and isinstance(cin_f.get("velocidad_cadera_3d_ms"), (int, float)):
                        vels_c.append(float(cin_f["velocidad_cadera_3d_ms"]))
                ci = cls._extraer_coord_xyz(f_item, 23, ("cadera_izq",), preferir_2d=False)
                cd = cls._extraer_coord_xyz(f_item, 24, ("cadera_der",), preferir_2d=False)
                if ci and cd:
                    xs_c.append((ci[0] + cd[0]) / 2.0)
                    zs_c.append((ci[2] + cd[2]) / 2.0)
            delta_xz = float(np.hypot(max(xs_c) - min(xs_c), max(zs_c) - min(zs_c))) if len(xs_c) >= 2 else 0.0
            vel_cad_pico = max(vels_c) if vels_c else 0.0
            if delta_xz < 0.045 and (
                vel_cad_pico <= 0.25
                or (salto_vertical_cm is not None and float(salto_vertical_cm) < 20.0)
            ):
                return "Saque"

        return "Remate"

    @classmethod
    def clasificar_gesto(
        cls,
        buffer_frames: List[Any],
        salto_vertical_cm: Optional[float] = None,
        t0_index: int = 20,
    ) -> str:
        """Alias directo de `clasificar_gesto_tecnico`."""
        return cls.clasificar_gesto_tecnico(
            buffer_frames=buffer_frames,
            salto_vertical_cm=salto_vertical_cm,
            t0_index=t0_index,
        )


def clasificar_gesto_tecnico(
    buffer_frames: List[Any],
    salto_vertical_cm: Optional[float] = None,
    t0_index: int = 20,
) -> str:
    """Función de nivel de módulo para clasificar el gesto técnico del búfer de 33 frames."""
    return ClasificadorGestos.clasificar_gesto_tecnico(
        buffer_frames=buffer_frames,
        salto_vertical_cm=salto_vertical_cm,
        t0_index=t0_index,
    )


def clasificar_gesto(
    buffer_frames: List[Any],
    salto_vertical_cm: Optional[float] = None,
    t0_index: int = 20,
) -> str:
    """Alias de nivel de módulo para clasificar el gesto técnico del búfer de 33 frames."""
    return ClasificadorGestos.clasificar_gesto_tecnico(
        buffer_frames=buffer_frames,
        salto_vertical_cm=salto_vertical_cm,
        t0_index=t0_index,
    )
