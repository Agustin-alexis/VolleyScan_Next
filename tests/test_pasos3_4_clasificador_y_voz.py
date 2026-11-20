"""
Suite de Verificación de los Pasos 3 y 4:
3. CLASIFICADOR MULTI-GESTO CON REGLA DE ORO (`clasificar_gesto_tecnico(buffer, salto_vertical_cm)`):
   - a) Si `salto_vertical_cm == 0.0` (el umbral del 5% no se superó), EL GESTO NUNCA PUEDE SER UN REMATE NI UN BLOQUEO.
   - b) Con `salto_vertical_cm == 0.0`, evalúa la altura de las muñecas (15, 16) en `t0`:
        - Muñecas por debajo de los hombros -> "Recepción"
        - Muñecas por encima de los hombros -> "Voleo"
   - c) Con `salto_vertical_cm > 0.0`:
        - Ambas muñecas por encima de la cabeza/hombros de forma simétrica (diferencia en Y < 5%) -> "Bloqueo"
        - Clara asimetría (una mano extendida arriba para golpear, la otra abajo o en equilibrio) -> "Remate"
   - El JSON devuelve siempre `{"gesto_detectado": "Recepción/Voleo/Bloqueo/Remate", ...}`.

4. COACH DE VOZ PROFESIONAL (`backend/biomecanica/coach_traductor.py` y `frontend/js/app.js`):
   - `coach_voz_texto` estructurado en 3 oraciones estrictas:
     "Detecté un [Gesto]." + (Solo si salto > 0) "Tu salto fue de [X] cm." + "[Consejo basado en codo/rodilla]".
   - En `frontend/js/app.js`, antes de llamar a `speechSynthesis.speak()`, se ejecuta `window.speechSynthesis.cancel()`.
"""

import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.biomecanica.evaluador_fases import (
    EvaluadorFasesBiomecanicas,
    clasificar_gesto_tecnico,
)
from backend.biomecanica.coach_traductor import (
    CoachTraductorVoz,
    generar_feedback_voz_infantil,
)


def _crear_buffer_prueba(
    y_muneca_izq_t0: float,
    y_muneca_der_t0: float,
    con_salto: bool = False,
    dist_munecas: float = 0.08,
):
    """
    Construye un búfer de 33 frames con coordenadas normalizadas:
      - Nariz (0) en Y = 0.20, Hombros (11, 12) en Y = 0.36
      - En t0 (frame 20), muñecas (15, 16) en `y_muneca_izq_t0` y `y_muneca_der_t0`.
    """
    frames = []
    for i in range(33):
        ts = i * (1.0 / 30.0)
        en_vuelo = con_salto and (8 <= i < 24)
        elevacion = 0.12 if en_vuelo else 0.0
        y_tobillo = 0.90 - elevacion
        y_hombro = 0.36 - (0.06 if en_vuelo else 0.0)

        if 16 <= i <= 22:
            ym_izq = y_muneca_izq_t0
            ym_der = y_muneca_der_t0
        else:
            ym_izq = 0.50
            ym_der = 0.50

        lm33 = [[0.50, 0.50, 0.0, 0.98] for _ in range(33)]
        lm33[0] = [0.50, 0.20 - (0.06 if en_vuelo else 0.0), 0.0, 0.98]
        lm33[11] = [0.42, y_hombro, 0.0, 0.98]
        lm33[12] = [0.58, y_hombro, 0.0, 0.98]
        lm33[13] = [0.40, (y_hombro + ym_izq) / 2.0, 0.0, 0.98]
        lm33[14] = [0.60, (y_hombro + ym_der) / 2.0, 0.0, 0.98]
        lm33[15] = [0.44, ym_izq, 0.0, 0.98]
        lm33[16] = [0.56, ym_der, 0.0, 0.98]
        lm33[27] = [0.46, y_tobillo, 0.0, 0.98]
        lm33[28] = [0.54, y_tobillo, 0.0, 0.98]
        lm33[31] = [0.46, y_tobillo + 0.01, 0.0, 0.98]
        lm33[32] = [0.54, y_tobillo + 0.01, 0.0, 0.98]

        frames.append({
            "frame_id": 5000 + i,
            "timestamp": ts,
            "landmarks_33": lm33,
            "landmarks_2d_original": {
                "nariz": lm33[0],
                "hombro_izq": lm33[11],
                "hombro_der": lm33[12],
                "codo_izq": lm33[13],
                "codo_der": lm33[14],
                "muneca_izq": lm33[15],
                "muneca_der": lm33[16],
                "cadera_izq": [0.45, 0.62 - elevacion, 0.0, 0.98],
                "cadera_der": [0.55, 0.62 - elevacion, 0.0, 0.98],
                "rodilla_izq": [0.45, 0.76 - elevacion, 0.0, 0.98],
                "rodilla_der": [0.55, 0.76 - elevacion, 0.0, 0.98],
                "tobillo_izq": lm33[27],
                "tobillo_der": lm33[28],
            },
            "puntos_3d_suaves": {
                "nariz": [0.0, 0.20 - (0.06 if en_vuelo else 0.0), 0.0],
                "hombro_izq": [-0.15, y_hombro, 0.0],
                "hombro_der": [0.15, y_hombro, 0.0],
                "codo_izq": [-0.16, (y_hombro + ym_izq) / 2.0, 0.0],
                "codo_der": [0.16, (y_hombro + ym_der) / 2.0, 0.0],
                "muneca_izq": [-0.12, ym_izq, 0.0],
                "muneca_der": [0.12, ym_der, 0.0],
                "cadera_izq": [-0.10, 0.62 - elevacion, 0.0],
                "cadera_der": [0.10, 0.62 - elevacion, 0.0],
                "rodilla_izq": [-0.10, 0.76 - elevacion, 0.0],
                "rodilla_der": [0.10, 0.76 - elevacion, 0.0],
                "tobillo_izq": [-0.10, y_tobillo, 0.0],
                "tobillo_der": [0.10, y_tobillo, 0.0],
            },
            "angulos_3d": {
                "codo": 168.0,
                "codo_opuesto": 168.0,
                "hombro": 150.0,
                "rodilla": 110.0 if i < 10 else 140.0,
                "rodilla_opuesta": 140.0,
                "cadera": 160.0,
                "tronco": 8.0,
            },
            "cinematica": {
                "distancia_munecas_3d_m": dist_munecas,
                "velocidad_muneca_3d_ms": 2.2 if 14 <= i <= 21 else 0.6,
                "velocidad_cadera_3d_ms": 0.5,
                "altura_centro_masa_rel": 0.05 if en_vuelo else 0.0,
                "confianza_anatomica_ponderada": 97.0,
            },
            "L_torso": 0.45,
        })
    return frames


def test_pasos3_4():
    print("=================================================================")
    print("🧪 VERIFICACIÓN DE PASOS 3 Y 4: CLASIFICADOR REGLA DE ORO + VOZ")
    print("=================================================================")

    # 1. Regla de Oro (a y b): salto_vertical_cm == 0.0 -> NUNCA Remate ni Bloqueo
    print("\n[1] Verificando Regla de Oro con salto_vertical_cm == 0.0...")
    buf_recep = _crear_buffer_prueba(y_muneca_izq_t0=0.52, y_muneca_der_t0=0.52, con_salto=False, dist_munecas=0.08)
    g_recep = clasificar_gesto_tecnico(buf_recep, 0.0)
    assert g_recep == "Recepción", f"Con salto=0.0 y muñecas bajo hombros debía ser 'Recepción', obtuvo '{g_recep}'"
    res_recep = EvaluadorFasesBiomecanicas.evaluar_secuencia_completa(buf_recep, 20)
    assert res_recep["gesto_detectado"] == "Recepción"
    assert res_recep["gesto_detectado"] not in ("Remate", "Bloqueo")
    print(f"  ✅ salto=0.0 + muñecas bajo hombros -> gesto_detectado='{res_recep['gesto_detectado']}'")

    buf_voleo = _crear_buffer_prueba(y_muneca_izq_t0=0.18, y_muneca_der_t0=0.19, con_salto=False, dist_munecas=0.20)
    g_voleo = clasificar_gesto_tecnico(buf_voleo, 0.0)
    assert g_voleo == "Voleo", f"Con salto=0.0 y muñecas sobre hombros debía ser 'Voleo', obtuvo '{g_voleo}'"
    res_voleo = EvaluadorFasesBiomecanicas.evaluar_secuencia_completa(buf_voleo, 20)
    assert res_voleo["gesto_detectado"] == "Voleo"
    assert res_voleo["gesto_detectado"] not in ("Remate", "Bloqueo")
    print(f"  ✅ salto=0.0 + muñecas sobre hombros -> gesto_detectado='{res_voleo['gesto_detectado']}'")

    # Incluso con asimetría de brazos arriba pero salto == 0.0, NUNCA puede ser Remate
    buf_asim_sin_salto = _crear_buffer_prueba(y_muneca_izq_t0=0.50, y_muneca_der_t0=0.14, con_salto=False, dist_munecas=0.35)
    g_asim_sin_salto = clasificar_gesto_tecnico(buf_asim_sin_salto, 0.0)
    assert g_asim_sin_salto not in ("Remate", "Bloqueo"), f"Con salto=0.0 NUNCA puede ser Remate/Bloqueo: {g_asim_sin_salto}"
    assert g_asim_sin_salto == "Voleo"
    print(f"  ✅ Candado anti-Remate sin salto verificado: '{g_asim_sin_salto}'")

    # 2. Regla de Oro (c): salto_vertical_cm > 0.0 -> Bloqueo (simétrico < 5%) vs Remate (asimétrico)
    print("\n[2] Verificando Regla de Oro con salto_vertical_cm > 0.0...")
    buf_bloqueo = _crear_buffer_prueba(y_muneca_izq_t0=0.14, y_muneca_der_t0=0.16, con_salto=True, dist_munecas=0.24)
    g_bloqueo = clasificar_gesto_tecnico(buf_bloqueo, 35.0)
    assert g_bloqueo == "Bloqueo", f"Con salto>0 y muñecas simétricas (<5%) debía ser 'Bloqueo', obtuvo '{g_bloqueo}'"
    res_bloqueo = EvaluadorFasesBiomecanicas.evaluar_secuencia_completa(buf_bloqueo, 20)
    assert res_bloqueo["gesto_detectado"] == "Bloqueo"
    print(f"  ✅ salto>0.0 + muñecas simétricas (diff=2% < 5%) -> gesto_detectado='{res_bloqueo['gesto_detectado']}'")

    buf_remate = _crear_buffer_prueba(y_muneca_izq_t0=0.52, y_muneca_der_t0=0.12, con_salto=True, dist_munecas=0.45)
    g_remate = clasificar_gesto_tecnico(buf_remate, 42.0)
    assert g_remate == "Remate", f"Con salto>0 y clara asimetría debía ser 'Remate', obtuvo '{g_remate}'"
    res_remate = EvaluadorFasesBiomecanicas.evaluar_secuencia_completa(buf_remate, 20)
    assert res_remate["gesto_detectado"] == "Remate"
    print(f"  ✅ salto>0.0 + muñecas asimétricas -> gesto_detectado='{res_remate['gesto_detectado']}'")

    # 3. Coach de Voz Profesional en 3 oraciones estrictas
    print("\n[3] Verificando estructura de 3 oraciones en coach_traductor.py...")
    voz_con_salto = generar_feedback_voz_infantil(
        metricas_33_frames={"max_extension_codo_impacto": 140.0, "min_flexion_rodilla_preparacion": 110.0},
        gesto_detectado="Remate",
        metricas_fisicas={"salto_vertical_cm": 38.0},
    )
    assert voz_con_salto.startswith("Detecté un Remate. Tu salto fue de 38 cm."), f"Formato inválido con salto: {voz_con_salto}"
    oraciones_salto = [s.strip() for s in voz_con_salto.split(".") if s.strip()]
    assert len(oraciones_salto) == 3, f"Se esperaban exactamente 3 oraciones cuando salto > 0, obtuvo {len(oraciones_salto)}: {voz_con_salto}"
    print(f"  ✅ Voz con salto (3 oraciones): '{voz_con_salto}'")

    voz_sin_salto = generar_feedback_voz_infantil(
        metricas_33_frames={"max_extension_codo_impacto": 170.0, "min_flexion_rodilla_preparacion": 150.0},
        gesto_detectado="Recepción",
        metricas_fisicas={"salto_vertical_cm": 0.0},
    )
    assert voz_sin_salto.startswith("Detecté un Recepción."), f"Formato inválido sin salto: {voz_sin_salto}"
    assert "Tu salto fue de" not in voz_sin_salto, f"No debe mencionar salto cuando salto == 0: {voz_sin_salto}"
    oraciones_no_salto = [s.strip() for s in voz_sin_salto.split(".") if s.strip()]
    assert len(oraciones_no_salto) == 2, f"Se esperaban exactamente 2 oraciones cuando salto == 0, obtuvo {len(oraciones_no_salto)}: {voz_sin_salto}"
    print(f"  ✅ Voz sin salto (sin frase de salto): '{voz_sin_salto}'")

    # 4. Verificar cancelación obligatoria de cola de voz en frontend/js/app.js
    print("\n[4] Verificando window.speechSynthesis.cancel() en frontend/js/app.js...")
    js_path = os.path.join(ROOT_DIR, "frontend", "js", "app.js")
    with open(js_path, "r", encoding="utf-8") as f:
        js_code = f.read()

    idx_hablar = js_code.find("function hablar(texto)")
    assert idx_hablar != -1
    bloque_hablar = js_code[idx_hablar : idx_hablar + 900]
    pos_cancel = bloque_hablar.find("window.speechSynthesis.cancel()")
    pos_speak = bloque_hablar.find("window.speechSynthesis.speak(")
    assert pos_cancel != -1 and pos_speak != -1 and pos_cancel < pos_speak
    print("  ✅ window.speechSynthesis.cancel() antes de speechSynthesis.speak() verificado.")

    print("\n🏆 PASOS 3 Y 4 VERIFICADOS AL 100%")


if __name__ == "__main__":
    test_pasos3_4()
