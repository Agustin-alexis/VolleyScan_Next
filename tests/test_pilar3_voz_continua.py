import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.biomecanica.evaluador_fases import (
    EvaluadorFasesBiomecanicas,
    generar_feedback_voz_infantil,
)
from backend.db.database import crear_sesion_entrenamiento, registrar_gesto_en_sesion


def _crear_secuencia_base_33_frames(codo_vals, rodilla_vals):
    frames = []
    for i in range(33):
        ts = i * 0.033
        muneca_y = 0.65 - (i * 0.025 if i <= 20 else (20 * 0.025) - (i - 20) * 0.02)
        f = {
            "frame_id": 2000 + i,
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
                "rodilla": rodilla_vals[i],
                "cadera": 160.0,
                "codo": codo_vals[i],
                "hombro": 145.0,
                "tronco": 10.0,
            },
            "cinematica": {
                "velocidad_muneca_3d_ms": 2.4,
                "velocidad_cadera_3d_ms": 0.9,
                "distancia_munecas_3d_m": 0.50,
                "altura_centro_masa_rel": 0.05,
                "confianza_anatomica_ponderada": 96.0,
            },
            "L_torso": 0.45,
        }
        frames.append(f)
    return frames


def test_pilar3_cinematica_continua_33_frames():
    print("Testing Pilar 3: Evaluación Continua de 33 Frames y Suavidad...")

    # 1. Caso Movimiento Brusco / Errático (pico en la derivada de los 33 frames)
    codo_brusco = [130.0] * 33
    codo_brusco[15] = 90.0
    codo_brusco[16] = 172.0  # Salto brusco de +82 grados en 1 frame
    rodilla_normal = [110.0] * 33
    frames_bruscos = _crear_secuencia_base_33_frames(codo_brusco, rodilla_normal)

    cin_brusca = EvaluadorFasesBiomecanicas.evaluar_cinematica_continua_33_frames(frames_bruscos, 20)
    assert len(cin_brusca["angulos_codo_33"]) == 33, "Deben evaluarse los 33 frames de codo"
    assert len(cin_brusca["angulos_rodilla_33"]) == 33, "Deben evaluarse los 33 frames de rodilla"
    assert cin_brusca["es_movimiento_brusco"] is True, "Debe detectar el pico brusco en la derivada"
    assert cin_brusca["estado_suavidad"] == "Movimiento errático/Peligro de lesión", (
        f"Estado inesperado: {cin_brusca['estado_suavidad']}"
    )

    msg_brusco = generar_feedback_voz_infantil(cin_brusca, "remate")
    assert msg_brusco == "¡Cuidado! Ese movimiento fue muy de golpe. Intenta que tu brazo sea un látigo suave, no un robot.", (
        f"Mensaje inesperado para movimiento brusco: {msg_brusco}"
    )
    print(f"  ✅ Caso Movimiento Brusco detectado: '{cin_brusca['estado_suavidad']}' -> '{msg_brusco}'")

    # 2. Caso Brazo Encogido (Tiranosaurio Rex)
    codo_encogido = [125.0] * 33  # Nunca supera 155° en la ventana de impacto
    rodilla_resorte = [110.0] * 33
    frames_t_rex = _crear_secuencia_base_33_frames(codo_encogido, rodilla_resorte)

    eval_t_rex = EvaluadorFasesBiomecanicas.evaluar_secuencia_completa(frames_t_rex, 20, "remate")
    assert "coach_voz_texto" in eval_t_rex, "Falta clave 'coach_voz_texto' en respuesta"
    assert eval_t_rex["coach_voz_texto"] == (
        "¡Uy! Dejaste el brazo encogido como un tiranosaurio rex. ¡Estíralo bien alto como si quisieras tocar el techo la próxima vez!"
    ), f"Mensaje inesperado para brazo encogido: {eval_t_rex['coach_voz_texto']}"
    print(f"  ✅ Caso Brazo Encogido (T-Rex) verificado: '{eval_t_rex['coach_voz_texto']}'")

    # 3. Caso Rodilla sin Flexión (Piernas de Palo)
    codo_estirado = [170.0] * 33
    rodilla_palo = [165.0] * 33  # Nunca baja de 140° en la preparación
    frames_palo = _crear_secuencia_base_33_frames(codo_estirado, rodilla_palo)

    eval_palo = EvaluadorFasesBiomecanicas.evaluar_secuencia_completa(frames_palo, 20, "remate")
    assert eval_palo["coach_voz_texto"] == (
        "¡Saltaste con las piernas de palo! Acuérdate de agacharte como un resorte antes de saltar."
    ), f"Mensaje inesperado para piernas de palo: {eval_palo['coach_voz_texto']}"
    print(f"  ✅ Caso Piernas de Palo verificado: '{eval_palo['coach_voz_texto']}'")

    # 4. Verificar integración en base de datos y frontend
    sesion = crear_sesion_entrenamiento("user_test_pilar3", "Web 3D")
    reg = registrar_gesto_en_sesion(sesion["sesion_id"], eval_t_rex)
    assert "coach_voz_texto" in reg, "Falta coach_voz_texto en registro de sesión"
    assert reg["coach_voz_texto"] == eval_t_rex["coach_voz_texto"]

    js_path = os.path.join(ROOT_DIR, "frontend", "js", "app.js")
    with open(js_path, "r", encoding="utf-8") as f:
        js = f.read()
    assert "res.coach_voz_texto" in js, "frontend/js/app.js debe consumir res.coach_voz_texto"
    assert "window.speechSynthesis.cancel()" in js, "frontend/js/app.js debe vaciar la cola de SpeechSynthesis"
    print("  ✅ Integración en JSON, sesión y SpeechSynthesis del frontend verificada al 100%.")
    print("\n🏆 PILAR 3: ASISTENTE DE VOZ CONTINUO DE 33 FRAMES VERIFICADO AL 100%!")


if __name__ == "__main__":
    test_pilar3_cinematica_continua_33_frames()
