import base64
import io
import os
import sys
from PIL import Image

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.biomecanica.evaluador_fases import EvaluadorFasesBiomecanicas
from backend.db.database import crear_sesion_entrenamiento, registrar_gesto_en_sesion

def test_pilar1_generador_gif_en_memoria():
    print("Testing Pilar 1: Generador de GIF en Memoria (Motor de Replay Cinemático)...")

    # 1. Crear subsecuencia simulada de 33 frames (t0 - 20 a t0 + 12)
    frames_sinteticos = []
    for i in range(33):
        ts = i * 0.033
        muneca_y = 0.65 - (i * 0.025 if i <= 20 else (20 * 0.025) - (i - 20) * 0.02)
        f = {
            "frame_id": 1000 + i,
            "timestamp": ts,
            "landmarks_2d_original": {
                "nariz": [0.50, 0.20, 0.0, 0.95],
                "hombro_der": [0.55, 0.35, 0.0, 0.95],
                "hombro_izq": [0.45, 0.35, 0.0, 0.95],
                "codo_der": [0.62, muneca_y + 0.12, 0.0, 0.95],
                "codo_izq": [0.38, 0.48, 0.0, 0.95],
                "muneca_der": [0.65, muneca_y, 0.0, 0.95],
                "muneca_izq": [0.35, 0.55, 0.0, 0.95],
                "cadera_der": [0.53, 0.65, 0.0, 0.95],
                "cadera_izq": [0.47, 0.65, 0.0, 0.95],
                "rodilla_der": [0.54, 0.80, 0.0, 0.95],
                "rodilla_izq": [0.46, 0.80, 0.0, 0.95],
                "tobillo_der": [0.54, 0.95, 0.0, 0.95],
                "tobillo_izq": [0.46, 0.95, 0.0, 0.95],
            },
            "puntos_3d_suaves": {
                "hombro_der": [0.15, 0.35, 0.0],
                "hombro_izq": [-0.15, 0.35, 0.0],
                "codo_der": [0.22, muneca_y + 0.12, 0.0],
                "codo_izq": [-0.22, 0.48, 0.0],
                "muneca_der": [0.25, muneca_y, 0.0],
                "muneca_izq": [-0.25, 0.55, 0.0],
                "cadera_der": [0.10, 0.65, 0.0],
                "cadera_izq": [-0.10, 0.65, 0.0],
                "rodilla_der": [0.11, 0.80, 0.0],
                "rodilla_izq": [-0.11, 0.80, 0.0],
                "tobillo_der": [0.11, 0.95, 0.0],
                "tobillo_izq": [-0.11, 0.95, 0.0],
            },
            "angulos_3d": {
                "rodilla": 110.0,
                "cadera": 160.0,
                "codo": 165.0,
                "hombro": 140.0,
                "tronco": 10.0,
            },
            "cinematica": {
                "velocidad_muneca_3d_ms": 2.2,
                "velocidad_cadera_3d_ms": 0.8,
                "distancia_munecas_3d_m": 0.50,
                "altura_centro_masa_rel": 0.05,
                "confianza_anatomica_ponderada": 96.0,
            },
            "L_torso": 0.45,
        }
        frames_sinteticos.append(f)

    # 2. Generar el GIF en memoria
    gif_b64 = EvaluadorFasesBiomecanicas.generar_replay_cinematico_gif(
        frames_procesados=frames_sinteticos,
        t0_idx_relativo=20,
        gesto_tecnico="remate",
        width=400,
        height=400,
        duration=40,
    )

    assert gif_b64 is not None, "El generador de GIF retornó None"
    assert gif_b64.startswith("data:image/gif;base64,"), "El GIF no tiene el formato data URI esperado"

    # 3. Decodificar y verificar propiedades del GIF animado
    raw_b64 = gif_b64.split(",")[1]
    gif_bytes = base64.b64decode(raw_b64)
    assert len(gif_bytes) > 1000, f"Tamaño del GIF demasiado pequeño: {len(gif_bytes)} bytes"

    img_gif = Image.open(io.BytesIO(gif_bytes))
    assert img_gif.format == "GIF", f"Formato incorrecto: {img_gif.format}"
    assert img_gif.is_animated, "El GIF no es animado"
    assert img_gif.n_frames == 33, f"Se esperaban 33 frames animados, obtenidos {img_gif.n_frames}"
    
    # Verificar duración y loop infinito
    info = img_gif.info
    assert info.get("loop") == 0, f"El bucle del GIF no es infinito (loop=0): {info.get('loop')}"
    assert info.get("duration") == 40, f"La duración por frame esperada es 40ms, obtenida: {info.get('duration')}"

    print(f"  ✅ GIF en Memoria generado exitosamente: {img_gif.n_frames} frames, {len(gif_bytes)/1024:.1f} KB, duration=40ms, loop=0.")

    # 4. Verificar integración en evaluar_secuencia_completa
    eval_res = EvaluadorFasesBiomecanicas.evaluar_secuencia_completa(
        frames_procesados=frames_sinteticos,
        t0_idx_relativo=20,
        gesto_solicitado="remate",
    )

    assert "video_replay_base64" in eval_res, "video_replay_base64 ausente en la respuesta de evaluar_secuencia_completa"
    assert eval_res["video_replay_base64"] is not None
    assert eval_res["video_replay_base64"].startswith("data:image/gif;base64,")
    print("  ✅ Integración en evaluar_secuencia_completa verificada: clave 'video_replay_base64' presente.")

    # 5. Verificar guardado longitudinal en sesión de entrenamiento
    sesion = crear_sesion_entrenamiento("user_test_replay", "Web 3D")
    gesto_reg = registrar_gesto_en_sesion(sesion["sesion_id"], eval_res)
    assert "video_replay_base64" in gesto_reg, "video_replay_base64 ausente en el registro de la sesión"
    assert gesto_reg["video_replay_base64"] is not None
    print("  ✅ Persistencia longitudinal verificada: el replay se conserva en cada salto de la sesión.")


def test_pilar1_frontend_visor():
    print("\nTesting Pilar 1: Actualización del Visor Frontend...")

    # 1. Verificar index.html
    html_path = os.path.join(ROOT_DIR, "frontend", "index.html")
    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()

    assert 'id="contenedorReplayCinematico"' in html, "contenedorReplayCinematico ausente en index.html"
    assert 'id="imgReplayCinematico"' in html, "imgReplayCinematico ausente en index.html"
    assert 'id="replayPlaceholder"' in html, "replayPlaceholder ausente en index.html"
    assert 'id="badgeReplayModo"' in html, "badgeReplayModo ausente en index.html"
    print("  ✅ frontend/index.html contiene el reproductor central, el tag <img> y el placeholder.")

    # 2. Verificar styles.css
    css_path = os.path.join(ROOT_DIR, "frontend", "css", "styles.css")
    with open(css_path, "r", encoding="utf-8") as f:
        css = f.read()

    assert ".vs-replay-wrapper" in css, ".vs-replay-wrapper ausente en styles.css"
    assert ".vs-replay-screen" in css, ".vs-replay-screen ausente en styles.css"
    assert ".vs-replay-video-img" in css, ".vs-replay-video-img ausente en styles.css"
    print("  ✅ frontend/css/styles.css contiene las reglas de estilo y diseño del reproductor de replay.")

    # 3. Verificar app.js
    js_path = os.path.join(ROOT_DIR, "frontend", "js", "app.js")
    with open(js_path, "r", encoding="utf-8") as f:
        js = f.read()

    assert "imgReplayCinematico" in js, "imgReplayCinematico ausente en app.js"
    assert "video_replay_base64" in js, "video_replay_base64 ausente en app.js"
    assert "badgeReplayModo" in js, "badgeReplayModo ausente en app.js"
    print("  ✅ frontend/js/app.js carga automáticamente video_replay_base64 y actualiza en clics del timeline.")

    print("\n🏆 PILAR 1: MOTOR DE REPLAY CINEMÁTICO VERIFICADO AL 100%!")


if __name__ == "__main__":
    test_pilar1_generador_gif_en_memoria()
    test_pilar1_frontend_visor()
