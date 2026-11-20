import math
import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.biomecanica.analisis_continuo import (
    AnalizadorContinuo33Frames,
    calcular_salto_vertical,
)
from backend.biomecanica.coach_traductor import (
    CoachTraductorVoz,
    generar_feedback_voz_infantil,
)
from backend.biomecanica.evaluador_fases import EvaluadorFasesBiomecanicas


def _crear_buffer_33_con_salto(dt: float = 0.0333333333):
    """
    Crea un búfer de 33 frames donde:
      - Frames 0..7: pies en el suelo (Y = 0.95)
      - Frames 8..25: vuelo parabólico (Despegue en frame 8, Aterrizaje en frame 26 -> 18 frames = 0.60 s)
      - Frames 26..32: pies de vuelta en el suelo (Y = 0.95)
    Con t = 0.60 s:
      h = (9.81 * (0.60^2) / 8) * 100 = 44.145 cm -> ~44.15 cm (redondeado a entero en voz: 44 cm)
    """
    frames = []
    for i in range(33):
        ts = i * dt
        if 8 <= i < 26:
            # Parábola de ascenso y descenso de tobillos (27, 28) y puntas de pies (31, 32)
            progreso = (i - 8) / 18.0
            elevacion = 0.18 * math.sin(math.pi * progreso)
            y_pie = 0.95 - max(0.02, elevacion)
        else:
            y_pie = 0.95

        muneca_y = 0.65 - (i * 0.025 if i <= 20 else (20 * 0.025) - (i - 20) * 0.02)

        lm33 = [[0.5, 0.5, 0.0, 0.96] for _ in range(33)]
        lm33[27] = [0.46, y_pie, 0.0, 0.96]  # tobillo_izq
        lm33[28] = [0.54, y_pie, 0.0, 0.96]  # tobillo_der
        lm33[31] = [0.45, y_pie + 0.01, 0.0, 0.96]  # punta_pie_izq
        lm33[32] = [0.55, y_pie + 0.01, 0.0, 0.96]  # punta_pie_der

        f = {
            "frame_id": 3000 + i,
            "timestamp": ts,
            "landmarks_33": lm33,
            "landmarks_2d_original": {
                "nariz": [0.50, 0.20, 0.0, 0.96],
                "hombro_der": [0.55, 0.35, 0.0, 0.96],
                "hombro_izq": [0.45, 0.35, 0.0, 0.96],
                "codo_der": [0.62, muneca_y + 0.12, 0.0, 0.96],
                "codo_izq": [0.38, 0.48, 0.0, 0.96],
                "muneca_der": [0.65, muneca_y, 0.0, 0.96],
                "muneca_izq": [0.35, 0.55, 0.0, 0.96],
                "cadera_der": [0.53, y_pie - 0.28, 0.0, 0.96],
                "cadera_izq": [0.47, y_pie - 0.28, 0.0, 0.96],
                "rodilla_der": [0.54, y_pie - 0.14, 0.0, 0.96],
                "rodilla_izq": [0.46, y_pie - 0.14, 0.0, 0.96],
                "tobillo_der": [0.54, y_pie, 0.0, 0.96],
                "tobillo_izq": [0.46, y_pie, 0.0, 0.96],
                "punta_pie_der": [0.55, y_pie + 0.01, 0.0, 0.96],
                "punta_pie_izq": [0.45, y_pie + 0.01, 0.0, 0.96],
            },
            "puntos_3d_suaves": {
                "hombro_der": [0.15, 0.35, 0.0],
                "hombro_izq": [-0.15, 0.35, 0.0],
                "codo_der": [0.22, muneca_y + 0.12, 0.0],
                "codo_izq": [-0.22, 0.48, 0.0],
                "muneca_der": [0.25, muneca_y, 0.0],
                "muneca_izq": [-0.25, 0.55, 0.0],
                "cadera_der": [0.10, y_pie - 0.28, 0.0],
                "cadera_izq": [-0.10, y_pie - 0.28, 0.0],
                "rodilla_der": [0.11, y_pie - 0.14, 0.0],
                "rodilla_izq": [-0.11, y_pie - 0.14, 0.0],
                "tobillo_der": [0.11, y_pie, 0.0],
                "tobillo_izq": [-0.11, y_pie, 0.0],
            },
            "angulos_3d": {
                "rodilla": 110.0,
                "cadera": 160.0,
                "codo": 170.0,
                "hombro": 145.0,
                "tronco": 10.0,
            },
            "cinematica": {
                "velocidad_muneca_3d_ms": 2.5,
                "velocidad_cadera_3d_ms": 1.1,
                "distancia_munecas_3d_m": 0.50,
                "altura_centro_masa_rel": 0.08,
                "confianza_anatomica_ponderada": 97.0,
            },
            "L_torso": 0.45,
        }
        frames.append(f)
    return frames


def test_fase2_motor_salto_vertical():
    print("Testing Fase 2: Motor Físico de Salto Vertical (Hang Time -> cm)...")

    frames = _crear_buffer_33_con_salto()

    # 1. Prueba directa de calcular_salto_vertical en analisis_continuo.py
    res_salto = calcular_salto_vertical(frames)
    t_vuelo = res_salto["tiempo_vuelo_segundos"]
    salto_cm = res_salto["salto_vertical_cm"]

    # Despegue en frame 8, aterrizaje en frame 26 -> 18 * (1/30) = 0.60 s -> h = (9.81 * 0.36 / 8) * 100 = 44.15 cm
    esperado_cm = round(((9.81 * (t_vuelo ** 2)) / 8.0) * 100.0, 2)
    assert abs(t_vuelo - 0.60) < 0.05, f"Tiempo de vuelo esperado ~0.60s, obtenido {t_vuelo}s"
    assert abs(salto_cm - esperado_cm) < 0.01, f"Fórmula h=(9.81*t^2)/8*100 no coincide: {salto_cm} vs {esperado_cm}"
    assert salto_cm > 40.0, f"Salto esperado > 40 cm, obtenido {salto_cm} cm"
    print(f"  ✅ Cálculo físico verificado: Hang Time = {t_vuelo}s -> Salto Vertical = {salto_cm} cm (Despegue={res_salto['frame_despegue']}, Aterrizaje={res_salto['frame_aterrizaje']}).")

    # 2. Prueba de Orquestación en evaluador_fases.py
    eval_completa = EvaluadorFasesBiomecanicas.evaluar_secuencia_completa(
        frames_procesados=frames,
        t0_idx_relativo=20,
        gesto_solicitado="remate",
    )
    assert "metricas_fisicas" in eval_completa, "Falta nodo 'metricas_fisicas' en evaluar_secuencia_completa"
    mf = eval_completa["metricas_fisicas"]
    assert isinstance(mf["tiempo_vuelo_segundos"], float), "tiempo_vuelo_segundos debe ser float"
    assert isinstance(mf["salto_vertical_cm"], float), "salto_vertical_cm debe ser float"
    assert mf["salto_vertical_cm"] == salto_cm
    print(f"  ✅ Orquestación en evaluador_fases.py verificada: metricas_fisicas = {mf}")

    # 3. Prueba de Traductor de Voz en coach_traductor.py
    voz = eval_completa["coach_voz_texto"]
    cm_redondeado = int(round(salto_cm))
    frase_esperada = f"Tu salto fue de {cm_redondeado} cm."
    assert frase_esperada in voz, f"La frase '{frase_esperada}' debe estar en coach_voz_texto: '{voz}'"
    print(f"  ✅ Traductor de Voz con salto verificado: '{voz}'")

    # 4. Prueba de Frontend (index.html y app.js)
    html_path = os.path.join(ROOT_DIR, "frontend", "index.html")
    js_path = os.path.join(ROOT_DIR, "frontend", "js", "app.js")
    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()
    with open(js_path, "r", encoding="utf-8") as f:
        js = f.read()

    assert 'id="badgeSaltoVerticalCm"' in html, "Falta badgeSaltoVerticalCm en frontend/index.html"
    assert "salto_vertical_cm" in js, "frontend/js/app.js no procesa salto_vertical_cm"
    assert "Salto:" in js, "frontend/js/app.js no formatea 'Salto: X cm'"
    print("  ✅ Frontend verificado: badge destacado 'Salto: X cm' encima del reproductor de video/GIF.")
    print("\n🏆 FASE 2: MOTOR FÍSICO DE SALTO VERTICAL VERIFICADO AL 100%!")


if __name__ == "__main__":
    test_fase2_motor_salto_vertical()
