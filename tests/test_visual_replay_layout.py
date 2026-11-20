"""
Suite de Verificación del Reproductor GIF de Cuerpo Completo (640x480 + POSE_CONNECTIONS)
y Corrección del Layout Flex/Grid en el Frontend.
"""

import base64
import io
import os
import sys
from PIL import Image

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.biomecanica.generador_replay import (
    GeneradorReplayCinematico,
    POSE_CONNECTIONS,
    generar_replay_cinematico_gif,
)

print("=================================================================")
print("🧪 TEST DE REPRODUCTOR GIF (640x480 + POSE_CONNECTIONS) Y LAYOUT")
print("=================================================================")

# 1. Verificar que POSE_CONNECTIONS contiene las 35 conexiones oficiales de MediaPipe Pose
print("\n[1] Verificando mp_pose.POSE_CONNECTIONS y escalado 640x480...")
assert len(POSE_CONNECTIONS) >= 35, f"Se esperaban 35 conexiones de MediaPipe Pose, hay {len(POSE_CONNECTIONS)}"

# Construir secuencia de 33 frames con coordenadas 3D centradas en 0.0 (caso que antes partía el torso)
frames_prueba = []
for i in range(33):
    elev = 0.08 if 10 <= i <= 24 else 0.0
    frames_prueba.append({
        "frame_id": 500 + i,
        "timestamp": i * 0.033,
        "puntos_3d_suaves": {
            "hombro_izq": [-0.15, -0.18 - elev, 0.0],
            "hombro_der": [0.15, -0.18 - elev, 0.0],
            "codo_izq": [-0.22, -0.05 - elev, 0.0],
            "codo_der": [0.22, -0.32 - elev, 0.0],
            "muneca_izq": [-0.20, 0.05 - elev, 0.0],
            "muneca_der": [0.20, -0.45 - elev, 0.0],
            "cadera_izq": [-0.10, 0.10 - elev, 0.0],
            "cadera_der": [0.10, 0.10 - elev, 0.0],
            "rodilla_izq": [-0.11, 0.28 - elev, 0.0],
            "rodilla_der": [0.11, 0.28 - elev, 0.0],
            "tobillo_izq": [-0.11, 0.44 - elev, 0.0],
            "tobillo_der": [0.11, 0.44 - elev, 0.0],
        },
    })

lm_33 = GeneradorReplayCinematico._extraer_landmarks_33_normalizados(frames_prueba[20])
assert len(lm_33) == 33, f"Deben reconstruirse los 33 landmarks para POSE_CONNECTIONS, se obtuvieron {len(lm_33)}"
# Verificar que hombro_izq (11) está a la izquierda de hombro_der (12) sin inversión por signo negativo
assert lm_33[11][0] < lm_33[12][0], f"Desconexión bilateral detectada: hombro_izq={lm_33[11]} vs hombro_der={lm_33[12]}"
assert lm_33[23][0] < lm_33[24][0], f"Desconexión de cadera detectada: cadera_izq={lm_33[23]} vs cadera_der={lm_33[24]}"

gif_data_uri = generar_replay_cinematico_gif(frames_prueba, t0_idx_relativo=20, gesto_tecnico="Remate")
assert gif_data_uri is not None and gif_data_uri.startswith("data:image/gif;base64,")
raw_gif = base64.b64decode(gif_data_uri.split(",", 1)[1])
img_gif = Image.open(io.BytesIO(raw_gif))
assert img_gif.size == (640, 480), f"El lienzo del GIF debe ser (640, 480), se obtuvo {img_gif.size}"
assert getattr(img_gif, "n_frames", 1) == 33, f"El GIF debe tener 33 frames, tiene {getattr(img_gif, 'n_frames', 1)}"
print(f"  ✅ GIF generado correctamente: resolución={img_gif.size}, frames={img_gif.n_frames}, conexiones={len(POSE_CONNECTIONS)}.")

# 2. Verificar layout Flex/Grid en frontend/index.html y frontend/css/styles.css
print("\n[2] Verificando estructura Flex/Grid anti-colapso en index.html y styles.css...")
with open(os.path.join(ROOT_DIR, "frontend", "index.html"), "r", encoding="utf-8") as f_html:
    html = f_html.read()
with open(os.path.join(ROOT_DIR, "frontend", "css", "styles.css"), "r", encoding="utf-8") as f_css:
    css = f_css.read()

assert "vs-replay-body-layout" in html and "vs-replay-player-col" in html and "vs-replay-info-col" in html, (
    "Faltan contenedores de columnas flex para el reproductor GIF y el panel descriptivo en index.html"
)
assert ".vs-replay-body-layout" in css and "flex: 0 0 56%" in css and "flex: 1 1 40%" in css, (
    "Faltan reglas de flex-basis proporcional en styles.css"
)
assert "aspect-ratio: 4 / 3" in css, "El contenedor del reproductor debe tener aspect-ratio 4/3 (640x480)"
print("  ✅ Contenedores Flex/Grid con flex-basis proporcionales verificados en index.html y styles.css.")

print("\n🏆 APARTADO VISUAL (GIF 640x480 + LAYOUT FRONTEND) VERIFICADO AL 100%")
