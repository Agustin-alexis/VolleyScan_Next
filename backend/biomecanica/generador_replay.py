"""
Módulo Generador de Replay Cinemático en Cámara Lenta (Principio de Responsabilidad Única - SOLID).
Dedicado exclusivamente a recibir el búfer de ~33 frames, renderizar el esqueleto completo
de MediaPipe iterando sobre TODOS los `mp_pose.POSE_CONNECTIONS` con PIL (Pillow), escalar las
coordenadas normalizadas (x, y) por el ancho y alto real del lienzo (640x480) centrando el cuerpo
completo, y compilar en memoria el archivo GIF animado codificado en Base64.
"""

import base64
import io
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from PIL import Image, ImageDraw

try:
    import mediapipe as mp
    mp_pose = getattr(mp, "solutions", None) and getattr(mp.solutions, "pose", None)
except Exception:
    mp = None
    mp_pose = None


# Conjunto oficial completo de 35 conexiones anatómicas de MediaPipe Pose (33 landmarks: 0..32)
FALLBACK_POSE_CONNECTIONS: List[Tuple[int, int]] = [
    (0, 1), (1, 2), (2, 3), (3, 7),
    (0, 4), (4, 5), (5, 6), (6, 8),
    (9, 10),
    (11, 12),
    (11, 13), (13, 15), (15, 17), (15, 19), (15, 21), (17, 19),
    (12, 14), (14, 16), (16, 18), (16, 20), (16, 22), (18, 20),
    (11, 23), (12, 24), (23, 24),
    (23, 25), (25, 27), (27, 29), (27, 31), (29, 31),
    (24, 26), (26, 28), (28, 30), (28, 32), (30, 32),
]

POSE_CONNECTIONS: List[Tuple[int, int]] = list(
    getattr(mp_pose, "POSE_CONNECTIONS", None) or FALLBACK_POSE_CONNECTIONS
)


class GeneradorReplayCinematico:
    """
    Motor de renderizado visual de cuerpo completo y compilación de GIF en memoria
    para la ventana continua de 33 frames (640x480).
    """

    POSE_CONNECTIONS: List[Tuple[int, int]] = POSE_CONNECTIONS

    MAPA_NOMBRES_A_INDICES: Dict[str, int] = {
        "nariz": 0,
        "ojo_1": 1,
        "ojo_2": 2,
        "ojo_3": 3,
        "ojo_4": 4,
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
        "talon_izq": 29,
        "talon_der": 30,
        "punta_pie_izq": 31,
        "punta_pie_der": 32,
    }

    @classmethod
    def _extraer_landmarks_33_normalizados(cls, frame: Dict[str, Any]) -> Dict[int, Tuple[float, float]]:
        """
        Extrae y reconstruye los 33 landmarks de MediaPipe (índices 0..32) en coordenadas
        normalizadas [0.0, 1.0]. Si el frame proviene de coordenadas 3D centradas en el origen
        ([-0.5, 0.5]), traslada todo el esqueleto de manera uniforme para evitar desconexiones
        entre extremidades izquierdas y derechas.
        """
        pts_2d_raw: Dict[int, Tuple[float, float]] = {}
        pts_3d_raw: Dict[int, Tuple[float, float]] = {}

        p2d = frame.get("landmarks_2d_original") or frame.get("landmarks_2d") or {}
        p3d = frame.get("puntos_3d_suaves") or frame.get("world_landmarks_3d") or {}

        # 1. Revisar si existe el array completo de 33 puntos (landmarks_33)
        lm33 = frame.get("landmarks_33") or (p2d.get("landmarks_33") if isinstance(p2d, dict) else None)
        if isinstance(lm33, (list, tuple)):
            for idx, pt in enumerate(lm33[:33]):
                if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                    pts_2d_raw[idx] = (float(pt[0]), float(pt[1]))
                elif isinstance(pt, dict) and "x" in pt and "y" in pt:
                    pts_2d_raw[idx] = (float(pt["x"]), float(pt["y"]))

        # 2. Extraer desde diccionario 2D por nombre o índice
        if isinstance(p2d, dict):
            for nombre, idx_mp in cls.MAPA_NOMBRES_A_INDICES.items():
                if idx_mp not in pts_2d_raw and nombre in p2d:
                    val = p2d[nombre]
                    if isinstance(val, (list, tuple)) and len(val) >= 2:
                        pts_2d_raw[idx_mp] = (float(val[0]), float(val[1]))
            for idx_mp in range(33):
                for key_var in (idx_mp, str(idx_mp)):
                    if idx_mp not in pts_2d_raw and key_var in p2d:
                        val = p2d[key_var]
                        if isinstance(val, (list, tuple)) and len(val) >= 2:
                            pts_2d_raw[idx_mp] = (float(val[0]), float(val[1]))

        # 3. Extraer desde diccionario 3D suave como respaldo si faltan puntos en 2D
        if isinstance(p3d, dict):
            for nombre, idx_mp in cls.MAPA_NOMBRES_A_INDICES.items():
                if nombre in p3d:
                    val = p3d[nombre]
                    if isinstance(val, (list, tuple)) and len(val) >= 2:
                        pts_3d_raw[idx_mp] = (float(val[0]), float(val[1]))

        # Seleccionar fuente coherente para todo el cuerpo (evitando mezclar sistemas de coordenadas distintos)
        fuente = dict(pts_2d_raw) if len(pts_2d_raw) >= 6 else dict(pts_3d_raw)
        if not fuente:
            return {}

        # Si el sistema de coordenadas de la fuente tiene valores negativos (centrado en 0.0),
        # trasladar TODOS los puntos uniformemente (+0.5) para mantener intacta la anatomía
        xs_f = [p[0] for p in fuente.values()]
        ys_f = [p[1] for p in fuente.values()]
        shift_x = 0.5 if min(xs_f) < 0.0 else 0.0
        shift_y = 0.5 if min(ys_f) < 0.0 else 0.0

        pts: Dict[int, Tuple[float, float]] = {
            idx: (x + shift_x, y + shift_y) for idx, (x, y) in fuente.items()
        }

        # Completar puntos anatómicos derivados si la fuente solo contenía las articulaciones principales
        if 11 in pts and 12 in pts:
            hx_mid = (pts[11][0] + pts[12][0]) / 2.0
            hy_mid = (pts[11][1] + pts[12][1]) / 2.0
            ancho_hombros = max(0.08, abs(pts[12][0] - pts[11][0]))
            if 0 not in pts:
                pts[0] = (hx_mid, hy_mid - ancho_hombros * 0.65)

        if 0 in pts:
            nx, ny = pts[0]
            # Ojos, orejas y comisura bucal (1..10) proporcionales a la cabeza
            pts.setdefault(1, (nx - 0.012, ny - 0.012))
            pts.setdefault(2, (nx - 0.018, ny - 0.012))
            pts.setdefault(3, (nx - 0.024, ny - 0.012))
            pts.setdefault(4, (nx + 0.012, ny - 0.012))
            pts.setdefault(5, (nx + 0.018, ny - 0.012))
            pts.setdefault(6, (nx + 0.024, ny - 0.012))
            pts.setdefault(7, (nx - 0.032, ny - 0.005))
            pts.setdefault(8, (nx + 0.032, ny - 0.005))
            pts.setdefault(9, (nx - 0.010, ny + 0.012))
            pts.setdefault(10, (nx + 0.010, ny + 0.012))

        # Manos (17, 19, 21 izquierda; 18, 20, 22 derecha) proyectadas desde codo -> muñeca
        if 15 in pts:
            wx, wy = pts[15]
            dx = (wx - pts[13][0]) * 0.22 if 13 in pts else -0.015
            dy = (wy - pts[13][1]) * 0.22 if 13 in pts else 0.015
            pts.setdefault(17, (wx + dx - 0.008, wy + dy))
            pts.setdefault(19, (wx + dx + 0.008, wy + dy))
            pts.setdefault(21, (wx + dx * 0.7, wy + dy * 0.7))

        if 16 in pts:
            wx, wy = pts[16]
            dx = (wx - pts[14][0]) * 0.22 if 14 in pts else 0.015
            dy = (wy - pts[14][1]) * 0.22 if 14 in pts else 0.015
            pts.setdefault(18, (wx + dx + 0.008, wy + dy))
            pts.setdefault(20, (wx + dx - 0.008, wy + dy))
            pts.setdefault(22, (wx + dx * 0.7, wy + dy * 0.7))

        # Pies: talones (29, 30) y puntas (31, 32) a partir de tobillos (27, 28)
        if 27 in pts:
            ax, ay = pts[27]
            pts.setdefault(29, (ax - 0.018, ay + 0.018))
            pts.setdefault(31, (ax + 0.022, ay + 0.022))

        if 28 in pts:
            ax, ay = pts[28]
            pts.setdefault(30, (ax + 0.018, ay + 0.018))
            pts.setdefault(32, (ax - 0.022, ay + 0.022))

        return pts

    @classmethod
    def generar_replay_cinematico_gif(
        cls,
        frames_procesados: List[Dict[str, Any]],
        t0_idx_relativo: int = 20,
        gesto_tecnico: str = "remate",
        width: int = 640,
        height: int = 480,
        duration: int = 40,
    ) -> Optional[str]:
        """
        Extrae la subsecuencia completa (desde t0 - 20 hasta t0 + 12),
        itera sobre TODOS los `mp_pose.POSE_CONNECTIONS` en cada uno de los ~33 frames,
        multiplica las coordenadas normalizadas (x, y) por el ancho y alto real del lienzo
        (por defecto 640x480) centrando el cuerpo completo, y compila el GIF animado en memoria
        con duration=40 ms (Slow-Motion) y loop=0 (bucle infinito).
        """
        if not frames_procesados:
            return None

        try:
            width = max(320, int(width or 640))
            height = max(240, int(height or 480))
            total_frames = len(frames_procesados)

            # 1. Extraer los 33 landmarks normalizados de todos los frames de la secuencia
            secuencia_landmarks: List[Dict[int, Tuple[float, float]]] = [
                cls._extraer_landmarks_33_normalizados(f) for f in frames_procesados
            ]

            # 2. Calcular el encuadre global de la secuencia de 33 frames para centrar
            # el cuerpo completo sin distorsionar el movimiento real del salto
            todos_x = [pt[0] for fmap in secuencia_landmarks for pt in fmap.values()]
            todos_y = [pt[1] for fmap in secuencia_landmarks for pt in fmap.values()]

            if todos_x and todos_y:
                min_x, max_x = min(todos_x), max(todos_x)
                min_y, max_y = min(todos_y), max(todos_y)
                span_x = max(0.15, max_x - min_x)
                span_y = max(0.25, max_y - min_y)
                cx_seq = (min_x + max_x) / 2.0
                cy_seq = (min_y + max_y) / 2.0
                # Escala uniforme para que el esqueleto completo ocupe ~72% del lienzo y nunca se recorte
                escala_uniforme = min(0.72 / span_x, 0.72 / span_y)
                escala_uniforme = float(np.clip(escala_uniforme, 0.65, 1.35))
            else:
                cx_seq, cy_seq, escala_uniforme = 0.5, 0.5, 1.0

            frames_pil: List[Image.Image] = []

            for i, pts_norm in enumerate(secuencia_landmarks):
                img = Image.new("RGB", (width, height), (8, 12, 24))
                draw = ImageDraw.Draw(img)

                # Cuadrícula biomecánica de referencia y línea de suelo
                y_suelo = int(height * 0.90)
                for gx in range(60, width - 40, 80):
                    draw.line([(gx, 32), (gx, y_suelo)], fill=(14, 22, 38), width=1)
                for gy in range(60, y_suelo, 60):
                    draw.line([(20, gy), (width - 20, gy)], fill=(16, 25, 42), width=1)
                draw.line([(20, y_suelo), (width - 20, y_suelo)], fill=(34, 56, 88), width=2)

                # Multiplicar coordenadas normalizadas (x, y) por el ancho y alto real del lienzo (ej. 640x480)
                coords_pixel: Dict[int, Tuple[int, int]] = {}
                for idx_mp, (x_raw, y_raw) in pts_norm.items():
                    x_norm = 0.5 + (x_raw - cx_seq) * escala_uniforme
                    y_norm = 0.50 + (y_raw - cy_seq) * escala_uniforme
                    px = int(np.clip(x_norm, 0.04, 0.96) * width)
                    py = int(np.clip(y_norm, 0.08, 0.91) * height)
                    coords_pixel[idx_mp] = (px, py)

                # Iterar sobre TODOS los mp_pose.POSE_CONNECTIONS para dibujar el esqueleto completo
                for idx_a, idx_b in cls.POSE_CONNECTIONS:
                    if idx_a in coords_pixel and idx_b in coords_pixel:
                        pA = coords_pixel[idx_a]
                        pB = coords_pixel[idx_b]
                        # Diferenciar color por segmento anatómico para máxima claridad visual
                        if idx_a <= 10 and idx_b <= 10:
                            color_hueso = (0, 255, 153)
                            grosor = 2
                        elif idx_a in (11, 12, 23, 24) and idx_b in (11, 12, 23, 24):
                            color_hueso = (0, 240, 255)
                            grosor = 4
                        elif max(idx_a, idx_b) >= 25:
                            color_hueso = (56, 189, 248)
                            grosor = 4
                        else:
                            color_hueso = (0, 255, 180)
                            grosor = 4
                        draw.line([pA, pB], fill=color_hueso, width=grosor)

                # Conectar el centro de los hombros con la cabeza (nariz) para consolidar el eje cervical
                if 0 in coords_pixel and 11 in coords_pixel and 12 in coords_pixel:
                    cuello_px = (
                        (coords_pixel[11][0] + coords_pixel[12][0]) // 2,
                        (coords_pixel[11][1] + coords_pixel[12][1]) // 2,
                    )
                    draw.line([coords_pixel[0], cuello_px], fill=(0, 240, 255), width=3)

                # Dibujar los nodos articulares sobre el lienzo
                for idx_mp, (px, py) in coords_pixel.items():
                    if 1 <= idx_mp <= 10:
                        r = 2
                        color_nodo = (0, 255, 153)
                    elif idx_mp in (15, 16):
                        r = 6
                        color_nodo = (254, 229, 0)
                    elif idx_mp == 0:
                        r = 6
                        color_nodo = (0, 240, 255)
                    else:
                        r = 4
                        color_nodo = (0, 255, 153)

                    draw.ellipse(
                        [px - r, py - r, px + r, py + r],
                        fill=color_nodo,
                        outline=(255, 255, 255),
                        width=1,
                    )

                # Etiqueta de Fase Cinemática
                if i <= 10:
                    fase_txt = "FASE 1: PREPARACION"
                    fase_col = (0, 240, 255)
                elif i <= 18:
                    fase_txt = "FASE 2: SALTO Y ARMADO"
                    fase_col = (0, 255, 153)
                elif i <= 24:
                    fase_txt = "FASE 3: CONTACTO CRITICO (t0)"
                    fase_col = (255, 230, 0)
                else:
                    fase_txt = "FASE 4: FINALIZACION"
                    fase_col = (255, 51, 102)

                # Banner Superior
                draw.rectangle([0, 0, width, 28], fill=(13, 19, 33))
                draw.text((14, 7), f"VOLLEYSCAN AI • {str(gesto_tecnico).upper()} SLOW-MO (33 FRAMES)", fill=(0, 240, 255))
                draw.text((width - 110, 7), f"Frame {i + 1}/{total_frames}", fill=(200, 215, 235))

                # Banner Inferior
                draw.rectangle([0, height - 28, width, height], fill=(13, 19, 33))
                draw.text((14, height - 20), fase_txt, fill=fase_col)
                draw.text((width - 135, height - 20), f"{width}x{height} • 40ms", fill=(148, 163, 184))

                frames_pil.append(img)

            # Compilar GIF animado en memoria usando io.BytesIO()
            buffer_bytes = io.BytesIO()
            frames_pil[0].save(
                buffer_bytes,
                format="GIF",
                save_all=True,
                append_images=frames_pil[1:],
                duration=duration,
                loop=0,
                optimize=True,
            )
            gif_bytes = buffer_bytes.getvalue()
            b64_str = base64.b64encode(gif_bytes).decode("ascii")
            return f"data:image/gif;base64,{b64_str}"

        except Exception as e:
            print(f"[REPLAY GIF] Error generando GIF animado: {e}")
            return None


def generar_replay_cinematico_gif(
    frames_procesados: List[Dict[str, Any]],
    t0_idx_relativo: int = 20,
    gesto_tecnico: str = "remate",
    width: int = 640,
    height: int = 480,
    duration: int = 40,
) -> Optional[str]:
    """Función delegada para generar el replay cinemático en Base64."""
    return GeneradorReplayCinematico.generar_replay_cinematico_gif(
        frames_procesados=frames_procesados,
        t0_idx_relativo=t0_idx_relativo,
        gesto_tecnico=gesto_tecnico,
        width=width,
        height=height,
        duration=duration,
    )
