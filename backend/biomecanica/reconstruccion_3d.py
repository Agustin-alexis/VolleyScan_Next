"""
Módulo de Reconstrucción 3D Temporal y Cinemática Articular.
Aplica suavizado temporal adaptativo sobre la secuencia 3D extraída para eliminar
ambigüedad de profundidad (coordenada Z) y jitter, calculando los 8 ángulos bilaterales
de flexión articular [codo_izq, codo_der, hombro_izq, hombro_der, rodilla_izq, rodilla_der,
cadera_izq, cadera_der], velocidades articulares y trayectoria del centro de masa.
"""

from typing import Any, Dict, List, Optional, Tuple
import numpy as np


ORDEN_ANGULOS_CINEMATICOS: Tuple[str, ...] = (
    "codo_izq",
    "codo_der",
    "hombro_izq",
    "hombro_der",
    "rodilla_izq",
    "rodilla_der",
    "cadera_izq",
    "cadera_der",
)


class Reconstructor3DTemporal:
    """
    Filtro de Reconstrucción Cinemática 3D Temporal.
    Elimina ruido de profundidad en secuencias mediante convolución gaussiana temporal
    y transforma las coordenadas espaciales en un array de 8 ángulos cinemáticos por frame:
    [codo_izq, codo_der, hombro_izq, hombro_der, rodilla_izq, rodilla_der, cadera_izq, cadera_der].
    """

    def __init__(self, tamano_ventana_gauss: int = 5, sigma: float = 1.0) -> None:
        self.tamano_ventana = tamano_ventana_gauss if tamano_ventana_gauss % 2 == 1 else tamano_ventana_gauss + 1
        self.sigma = sigma
        self.kernel = self._crear_kernel_gaussiano(self.tamano_ventana, self.sigma)

    @staticmethod
    def _crear_kernel_gaussiano(tam: int, sigma: float) -> np.ndarray:
        medio = tam // 2
        x = np.arange(-medio, medio + 1)
        k = np.exp(-0.5 * (x / sigma) ** 2)
        return k / np.sum(k)

    def suavizar_serie_temporal(self, serie: List[float]) -> List[float]:
        """Aplica convolución 1D con padding reflejado para evitar retrasos de fase en los extremos."""
        n = len(serie)
        if n < self.tamano_ventana:
            return list(serie)

        medio = self.tamano_ventana // 2
        arr = np.array(serie, dtype=float)
        # Modo 'reflect' para mantener la continuidad en bordes
        suave = np.convolve(arr, self.kernel, mode="same")

        # Refinar extremos para no amortiguar artificialmente vértices de borde
        suave[:medio] = arr[:medio]
        suave[-medio:] = arr[-medio:]
        return [round(float(v), 5) for v in suave]

    @staticmethod
    def calcular_angulo_3d(a: List[float], b: List[float], c: List[float]) -> float:
        """
        Calcula el ángulo biomecánico 3D en el vértice 'b' entre los puntos 'a' y 'c'.
        Retorna el ángulo en grados [0, 180].
        """
        va = np.array(
            [
                float(a[0]) - float(b[0]),
                float(a[1]) - float(b[1]),
                (float(a[2]) if len(a) > 2 else 0.0) - (float(b[2]) if len(b) > 2 else 0.0),
            ],
            dtype=float,
        )
        vc = np.array(
            [
                float(c[0]) - float(b[0]),
                float(c[1]) - float(b[1]),
                (float(c[2]) if len(c) > 2 else 0.0) - (float(b[2]) if len(b) > 2 else 0.0),
            ],
            dtype=float,
        )

        norm_va = np.linalg.norm(va)
        norm_vc = np.linalg.norm(vc)

        if norm_va < 1e-6 or norm_vc < 1e-6:
            return 0.0

        dot = np.dot(va, vc)
        cos_val = np.clip(dot / (norm_va * norm_vc), -1.0, 1.0)
        return round(float(np.degrees(np.arccos(cos_val))), 1)

    @staticmethod
    def _normalizar_punto_3d(p: Any, fallback: Optional[List[float]] = None) -> List[float]:
        """Convierte cualquier representación de landmark (lista, dict u objeto) a [x, y, z]."""
        fb = fallback if fallback is not None else [0.0, 0.0, 0.0]
        if p is None:
            return fb
        try:
            if isinstance(p, (list, tuple)) and len(p) >= 2:
                return [
                    float(p[0]),
                    float(p[1]),
                    float(p[2]) if len(p) > 2 and p[2] is not None else 0.0,
                ]
            if isinstance(p, dict) and "x" in p and "y" in p:
                return [
                    float(p["x"]),
                    float(p["y"]),
                    float(p.get("z", 0.0) or 0.0),
                ]
            if hasattr(p, "x") and hasattr(p, "y"):
                return [
                    float(getattr(p, "x")),
                    float(getattr(p, "y")),
                    float(getattr(p, "z", 0.0) or 0.0),
                ]
        except (TypeError, ValueError):
            return fb
        return fb

    @classmethod
    def calcular_angulos_flexion_frame(cls, landmarks: Any) -> List[float]:
        """
        Extrae y calcula los 8 ángulos cinemáticos bilaterales de flexión articular
        a partir de los landmarks de un fotograma (sin almacenar coordenadas X, Y, Z crudas):
          [codo_izq, codo_der, hombro_izq, hombro_der, rodilla_izq, rodilla_der, cadera_izq, cadera_der]
        """
        # Si ya tiene el array precalculado de 8 ángulos, devolverlo directamente
        if isinstance(landmarks, dict) and isinstance(landmarks.get("angulos_cinematicos"), list):
            arr = landmarks["angulos_cinematicos"]
            if len(arr) == 8:
                return [round(float(v), 1) for v in arr]

        # Resolver diccionario o lista de puntos
        fuente: Any = landmarks
        if hasattr(landmarks, "world_landmarks_3d") and getattr(landmarks, "world_landmarks_3d"):
            fuente = getattr(landmarks, "world_landmarks_3d")
        elif hasattr(landmarks, "landmarks_2d") and getattr(landmarks, "landmarks_2d"):
            fuente = getattr(landmarks, "landmarks_2d")
        elif isinstance(landmarks, dict):
            if isinstance(landmarks.get("puntos_3d_suaves"), dict):
                fuente = landmarks["puntos_3d_suaves"]
            elif isinstance(landmarks.get("puntos_mundo"), dict) and landmarks["puntos_mundo"]:
                fuente = landmarks["puntos_mundo"]
            elif isinstance(landmarks.get("puntos"), dict) and landmarks["puntos"]:
                fuente = landmarks["puntos"]
            elif isinstance(landmarks.get("landmarks_33"), (list, tuple)):
                fuente = landmarks["landmarks_33"]
            elif isinstance(landmarks.get("landmarks_2d_original"), dict):
                fuente = landmarks["landmarks_2d_original"]

        mapa_indices = {
            "hombro_izq": 11,
            "hombro_der": 12,
            "codo_izq": 13,
            "codo_der": 14,
            "muneca_izq": 15,
            "muneca_der": 16,
            "cadera_izq": 23,
            "cadera_der": 24,
            "rodilla_izq": 25,
            "rodilla_der": 26,
            "tobillo_izq": 27,
            "tobillo_der": 28,
        }

        pts: Dict[str, List[float]] = {}
        if isinstance(fuente, (list, tuple)):
            for nombre, idx in mapa_indices.items():
                if len(fuente) > idx:
                    pts[nombre] = cls._normalizar_punto_3d(fuente[idx])
                else:
                    pts[nombre] = [0.0, 0.0, 0.0]
        elif isinstance(fuente, dict):
            lm33 = fuente.get("landmarks_33")
            for nombre, idx in mapa_indices.items():
                raw_pt = fuente.get(nombre) or fuente.get(idx) or fuente.get(str(idx))
                if raw_pt is None and isinstance(lm33, (list, tuple)) and len(lm33) > idx:
                    raw_pt = lm33[idx]
                pts[nombre] = cls._normalizar_punto_3d(raw_pt)
        else:
            return [0.0] * 8

        codo_izq = cls.calcular_angulo_3d(pts["hombro_izq"], pts["codo_izq"], pts["muneca_izq"])
        codo_der = cls.calcular_angulo_3d(pts["hombro_der"], pts["codo_der"], pts["muneca_der"])
        hombro_izq = cls.calcular_angulo_3d(pts["cadera_izq"], pts["hombro_izq"], pts["codo_izq"])
        hombro_der = cls.calcular_angulo_3d(pts["cadera_der"], pts["hombro_der"], pts["codo_der"])
        rodilla_izq = cls.calcular_angulo_3d(pts["cadera_izq"], pts["rodilla_izq"], pts["tobillo_izq"])
        rodilla_der = cls.calcular_angulo_3d(pts["cadera_der"], pts["rodilla_der"], pts["tobillo_der"])
        cadera_izq = cls.calcular_angulo_3d(pts["hombro_izq"], pts["cadera_izq"], pts["rodilla_izq"])
        cadera_der = cls.calcular_angulo_3d(pts["hombro_der"], pts["cadera_der"], pts["rodilla_der"])

        return [
            codo_izq,
            codo_der,
            hombro_izq,
            hombro_der,
            rodilla_izq,
            rodilla_der,
            cadera_izq,
            cadera_der,
        ]

    def reconstruir_y_suavizar_secuencia(self, frames_datos: List[Any]) -> List[Dict[str, Any]]:
        """
        Procesa la secuencia de frames:
        1. Extrae las trayectorias temporales de cada punto 3D.
        2. Aplica suavizado temporal multidimensional.
        3. Calcula el array de 8 ángulos cinemáticos de flexión articular y velocidades para cada fotograma.
        """
        n_frames = len(frames_datos)
        if n_frames == 0:
            return []

        # Puntos clave a suavizar
        articulaciones = [
            "hombro_der", "hombro_izq",
            "codo_der", "codo_izq",
            "muneca_der", "muneca_izq",
            "cadera_der", "cadera_izq",
            "rodilla_der", "rodilla_izq",
            "tobillo_der", "tobillo_izq",
        ]

        # Recopilar series temporales por articulación y eje (x, y, z)
        series_3d: Dict[str, Dict[str, List[float]]] = {
            art: {"x": [], "y": [], "z": []} for art in articulaciones
        }

        timestamps: List[float] = []
        frame_ids: List[int] = []

        for f in frames_datos:
            frame_ids.append(f.frame_id)
            timestamps.append(f.timestamp)
            p3d = f.world_landmarks_3d or {}
            p2d = f.landmarks_2d or {}

            for art in articulaciones:
                # Preferir coordenadas métricas 3D de MediaPipe, respaldo en 2D
                punto = p3d.get(art) or p2d.get(art) or [0.0, 0.0, 0.0]
                series_3d[art]["x"].append(float(punto[0]))
                series_3d[art]["y"].append(float(punto[1]))
                series_3d[art]["z"].append(float(punto[2]) if len(punto) > 2 else 0.0)

        # Suavizar cada serie temporal
        series_suavizadas: Dict[str, Dict[str, List[float]]] = {
            art: {} for art in articulaciones
        }
        for art in articulaciones:
            for eje in ["x", "y", "z"]:
                series_suavizadas[art][eje] = self.suavizar_serie_temporal(series_3d[art][eje])

        # Reconstruir frames enriquecidos con cinemática 3D y array de 8 ángulos
        frames_procesados: List[Dict[str, Any]] = []

        for i in range(n_frames):
            f_original = frames_datos[i]
            fid = frame_ids[i]
            ts = timestamps[i]

            # Reensamblar puntos suavizados (para uso interno de GIF y salto)
            puntos_3d_suaves: Dict[str, List[float]] = {}
            for art in articulaciones:
                puntos_3d_suaves[art] = [
                    series_suavizadas[art]["x"][i],
                    series_suavizadas[art]["y"][i],
                    series_suavizadas[art]["z"][i],
                    1.0,
                ]

            # Calcular el array de 8 ángulos cinemáticos bilaterales:
            # [codo_izq, codo_der, hombro_izq, hombro_der, rodilla_izq, rodilla_der, cadera_izq, cadera_der]
            angulos_cinematicos = self.calcular_angulos_flexion_frame(puntos_3d_suaves)
            (
                ang_codo_izq,
                ang_codo_der,
                ang_hombro_izq,
                ang_hombro_der,
                ang_rodilla_izq,
                ang_rodilla_der,
                ang_cadera_izq,
                ang_cadera_der,
            ) = angulos_cinematicos

            # Seleccionar lado dominante (muñeca que alcanza mayor elevación)
            y_mder = puntos_3d_suaves["muneca_der"][1]
            y_mizq = puntos_3d_suaves["muneca_izq"][1]
            lado = "der" if y_mder <= y_mizq else "izq"
            opuesto = "izq" if lado == "der" else "der"

            hombro_dom = puntos_3d_suaves[f"hombro_{lado}"]
            codo_dom = puntos_3d_suaves[f"codo_{lado}"]
            muneca_dom = puntos_3d_suaves[f"muneca_{lado}"]
            cadera_dom = puntos_3d_suaves[f"cadera_{lado}"]
            rodilla_dom = puntos_3d_suaves[f"rodilla_{lado}"]

            hombro_op = puntos_3d_suaves[f"hombro_{opuesto}"]
            muneca_op = puntos_3d_suaves[f"muneca_{opuesto}"]
            cadera_op = puntos_3d_suaves[f"cadera_{opuesto}"]

            ang_hombro_dom = ang_hombro_der if lado == "der" else ang_hombro_izq
            ang_codo_dom = ang_codo_der if lado == "der" else ang_codo_izq
            ang_cadera_dom = ang_cadera_der if lado == "der" else ang_cadera_izq
            ang_rodilla_dom = ang_rodilla_der if lado == "der" else ang_rodilla_izq
            ang_rodilla_op = ang_rodilla_izq if lado == "der" else ang_rodilla_der
            ang_codo_op = ang_codo_izq if lado == "der" else ang_codo_der

            # Inclinación del tronco respecto a la vertical
            centro_caderas = [
                (cadera_dom[0] + cadera_op[0]) / 2.0,
                (cadera_dom[1] + cadera_op[1]) / 2.0,
                (cadera_dom[2] + cadera_op[2]) / 2.0,
            ]
            centro_hombros = [
                (hombro_dom[0] + hombro_op[0]) / 2.0,
                (hombro_dom[1] + hombro_op[1]) / 2.0,
                (hombro_dom[2] + hombro_op[2]) / 2.0,
            ]
            referencia_vertical = [centro_caderas[0], centro_caderas[1] - 1.0, centro_caderas[2]]
            ang_tronco = self.calcular_angulo_3d(centro_hombros, centro_caderas, referencia_vertical)

            # -------------------------------------------------------------
            # VARIABLE 1: NORMALIZACIÓN ANTROPOMÉTRICA (L_torso)
            # -------------------------------------------------------------
            L_torso = float(np.linalg.norm(np.array(centro_hombros) - np.array(centro_caderas)))
            L_torso = max(0.18, round(L_torso, 4))

            # Distancia 3D entre muñecas métrica y normalizada
            dist_munecas = float(np.linalg.norm(np.array(muneca_dom[:3]) - np.array(muneca_op[:3])))
            dist_munecas_norm = round(dist_munecas / L_torso, 3)

            # Velocidad y aceleración lineal instantáneas
            vel_muneca = 0.0
            vel_cadera = 0.0
            vel_angular_codo_deg_s = 0.0
            if i > 0:
                dt = max(0.001, ts - timestamps[i - 1]) if ts > timestamps[i - 1] else 0.033
                d_muneca = float(
                    np.linalg.norm(
                        np.array(muneca_dom[:3])
                        - np.array(frames_procesados[i - 1]["puntos_3d_suaves"][f"muneca_{lado}"][:3])
                    )
                )
                d_cadera = float(
                    np.linalg.norm(
                        np.array(centro_caderas) - np.array(frames_procesados[i - 1]["centro_caderas"])
                    )
                )
                vel_muneca = round(d_muneca / dt, 2)
                vel_cadera = round(d_cadera / dt, 2)

                # ---------------------------------------------------------
                # VARIABLE 2: VELOCIDAD ANGULAR DEL CODO (grados/segundo)
                # ---------------------------------------------------------
                d_ang_codo = ang_codo_dom - frames_procesados[i - 1]["angulos_3d"]["codo"]
                vel_angular_codo_deg_s = round(d_ang_codo / dt, 1)

            # -------------------------------------------------------------
            # VARIABLE 3: ROTACIÓN TORÁCICA EN PLANO X-Z (Separación Hombros - Caderas)
            # -------------------------------------------------------------
            vec_hombros_xz = np.array([hombro_dom[0] - hombro_op[0], hombro_dom[2] - hombro_op[2]], dtype=float)
            vec_caderas_xz = np.array([cadera_dom[0] - cadera_op[0], cadera_dom[2] - cadera_op[2]], dtype=float)
            norm_h = np.linalg.norm(vec_hombros_xz)
            norm_c = np.linalg.norm(vec_caderas_xz)
            if norm_h > 1e-5 and norm_c > 1e-5:
                cos_rot = np.clip(np.dot(vec_hombros_xz, vec_caderas_xz) / (norm_h * norm_c), -1.0, 1.0)
                rotacion_toracica_deg = round(float(np.degrees(np.arccos(cos_rot))), 1)
            else:
                rotacion_toracica_deg = 0.0

            # -------------------------------------------------------------
            # VARIABLE 4: ESTABILIDAD ÓSEA (Varianza de longitud de huesos últimos 10 frames)
            # -------------------------------------------------------------
            len_brazo_act = float(
                np.linalg.norm(np.array(hombro_dom[:3]) - np.array(codo_dom[:3]))
                + np.linalg.norm(np.array(codo_dom[:3]) - np.array(muneca_dom[:3]))
            )
            len_muslo_act = float(np.linalg.norm(np.array(cadera_dom[:3]) - np.array(rodilla_dom[:3])))

            ini_w = max(0, i - 9)
            lens_brazo = [frames_procesados[k]["longitudes_oseas"]["brazo"] for k in range(ini_w, i)] + [len_brazo_act]
            lens_muslo = [frames_procesados[k]["longitudes_oseas"]["muslo"] for k in range(ini_w, i)] + [len_muslo_act]

            cv_brazo = float(np.std(lens_brazo) / (np.mean(lens_brazo) + 1e-5))
            cv_muslo = float(np.std(lens_muslo) / (np.mean(lens_muslo) + 1e-5))
            cv_prom = (cv_brazo + cv_muslo) / 2.0
            estabilidad_osea_score = round(float(np.clip(100.0 - (cv_prom * 280.0), 30.0, 99.8)), 1)

            # -------------------------------------------------------------
            # VARIABLE 5: CONFIANZA ANATÓMICA PONDERADA (Visibilidad MediaPipe)
            # -------------------------------------------------------------
            orig_p2d = f_original.landmarks_2d or {}

            def get_vis(nombre: str) -> float:
                p = orig_p2d.get(nombre)
                return float(p[3]) if p and len(p) >= 4 else 0.95

            vis_sup = (
                get_vis("hombro_der")
                + get_vis("hombro_izq")
                + get_vis("codo_der")
                + get_vis("codo_izq")
                + get_vis("muneca_der")
                + get_vis("muneca_izq")
            ) / 6.0
            vis_inf = (
                get_vis("rodilla_der")
                + get_vis("rodilla_izq")
                + get_vis("tobillo_der")
                + get_vis("tobillo_izq")
            ) / 4.0
            vis_torso = (get_vis("cadera_der") + get_vis("cadera_izq")) / 2.0
            confianza_anatomica_ponderada = round((0.40 * vis_sup + 0.40 * vis_inf + 0.20 * vis_torso) * 100.0, 1)

            # Altura relativa de centro de masa y elevación de salto normalizada
            altura_cm_rel = round(float(-centro_caderas[1]), 3)
            elevacion_salto_norm = round(altura_cm_rel / L_torso, 3)

            # -------------------------------------------------------------
            # VECTOR DE PROBABILIDAD DE GESTOS INSTANTÁNEO
            # -------------------------------------------------------------
            asimetria_y = abs(muneca_dom[1] - muneca_op[1])
            y_hombros_avg = (hombro_dom[1] + hombro_op[1]) / 2.0
            ambas_arriba = muneca_dom[1] < y_hombros_avg - 0.06 and muneca_op[1] < y_hombros_avg - 0.06
            salto_activo = elevacion_salto_norm > 0.10

            p_atk = min(
                98.0,
                max(
                    5.0,
                    92.0
                    if muneca_dom[1] < y_hombros_avg - 0.12 and asimetria_y > 0.08 and salto_activo
                    else (45.0 if muneca_dom[1] < y_hombros_avg else 15.0),
                ),
            )
            p_rec = min(
                96.0,
                max(
                    5.0,
                    90.0
                    if dist_munecas_norm < 0.45 and muneca_dom[1] > y_hombros_avg
                    else (35.0 if dist_munecas_norm < 0.70 else 10.0),
                ),
            )
            p_set = min(
                94.0,
                max(5.0, 88.0 if ambas_arriba and not salto_activo and dist_munecas_norm < 0.85 else 12.0),
            )
            p_blk = min(
                96.0,
                max(5.0, 91.0 if ambas_arriba and salto_activo and dist_munecas_norm < 1.0 else 14.0),
            )
            p_srv = min(
                94.0,
                max(
                    5.0,
                    86.0
                    if muneca_dom[1] < y_hombros_avg - 0.12 and asimetria_y > 0.08 and not salto_activo
                    else 16.0,
                ),
            )

            vector_probabilidad_gestos = {
                "remate": round(p_atk, 1),
                "recepcion": round(p_rec, 1),
                "colocacion": round(p_set, 1),
                "bloqueo": round(p_blk, 1),
                "saque": round(p_srv, 1),
            }

            frame_proc = {
                "frame_id": fid,
                "timestamp": ts,
                "index_en_secuencia": i,
                "lado_dominante": lado,
                "angulos_cinematicos": angulos_cinematicos,
                "puntos_3d_suaves": puntos_3d_suaves,
                "landmarks_2d_original": f_original.landmarks_2d,
                "centro_caderas": centro_caderas,
                "centro_hombros": centro_hombros,
                "L_torso": L_torso,
                "longitudes_oseas": {
                    "brazo": round(len_brazo_act, 4),
                    "muslo": round(len_muslo_act, 4),
                },
                "angulos_3d": {
                    "codo_izq": ang_codo_izq,
                    "codo_der": ang_codo_der,
                    "hombro_izq": ang_hombro_izq,
                    "hombro_der": ang_hombro_der,
                    "rodilla_izq": ang_rodilla_izq,
                    "rodilla_der": ang_rodilla_der,
                    "cadera_izq": ang_cadera_izq,
                    "cadera_der": ang_cadera_der,
                    "hombro": ang_hombro_dom,
                    "codo": ang_codo_dom,
                    "cadera": ang_cadera_dom,
                    "rodilla": ang_rodilla_dom,
                    "rodilla_opuesta": ang_rodilla_op,
                    "codo_opuesto": ang_codo_op,
                    "hombro_opuesto": ang_hombro_izq if lado == "der" else ang_hombro_der,
                    "tronco": ang_tronco,
                },
                "cinematica": {
                    "velocidad_muneca_3d_ms": vel_muneca,
                    "velocidad_cadera_3d_ms": vel_cadera,
                    "vel_angular_codo_deg_s": vel_angular_codo_deg_s,
                    "rotacion_toracica_deg": rotacion_toracica_deg,
                    "estabilidad_osea_score": estabilidad_osea_score,
                    "confianza_anatomica_ponderada": confianza_anatomica_ponderada,
                    "distancia_munecas_3d_m": round(dist_munecas, 3),
                    "distancia_munecas_norm": dist_munecas_norm,
                    "altura_centro_masa_rel": altura_cm_rel,
                    "elevacion_salto_norm": elevacion_salto_norm,
                    "vector_probabilidad_gestos": vector_probabilidad_gestos,
                },
            }
            frames_procesados.append(frame_proc)

        return frames_procesados


def calcular_angulos_flexion_frame(landmarks: Any) -> List[float]:
    """
    Función pública que recibe los landmarks de un fotograma y devuelve el array
    de 8 ángulos cinemáticos bilaterales:
    [codo_izq, codo_der, hombro_izq, hombro_der, rodilla_izq, rodilla_der, cadera_izq, cadera_der].
    """
    return Reconstructor3DTemporal.calcular_angulos_flexion_frame(landmarks)
