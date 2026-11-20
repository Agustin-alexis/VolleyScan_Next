import math
import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from fastapi.testclient import TestClient
import main
from backend.biomecanica.calibracion_entorno import (
    GestorCalibracionAmbiental,
    verificar_calibracion,
)


def _crear_33_landmarks(visibilidad: float = 0.95, postura_t: bool = True, desviacion_grados: float = 0.0):
    """
    Construye un arreglo de 33 landmarks de MediaPipe con la visibilidad indicada
    y una postura en 'T' configurable.
    """
    landmarks = [[0.5, 0.5, 0.0, visibilidad] for _ in range(33)]
    # Hombros (11: izq, 12: der)
    landmarks[11] = [0.40, 0.40, 0.0, visibilidad]
    landmarks[12] = [0.60, 0.40, 0.0, visibilidad]

    if postura_t:
        dx = 0.25
        dy = dx * math.tan(math.radians(desviacion_grados))
        # Muñecas (15: izq, 16: der) extendidas en X y con desviación dy en Y
        landmarks[15] = [0.40 - dx, 0.40 + dy, 0.0, visibilidad]
        landmarks[16] = [0.60 + dx, 0.40 + dy, 0.0, visibilidad]
    else:
        # Brazos abajo pegados al cuerpo (reposo)
        landmarks[15] = [0.39, 0.72, 0.0, visibilidad]
        landmarks[16] = [0.61, 0.72, 0.0, visibilidad]

    return landmarks


def test_verificar_calibracion_entorno_y_postura():
    print("Testing Fase 1: verificar_calibracion(landmarks) (Luz > 0.85 y Postura en 'T' ±15°)...")

    # 1. Caso óptimo: 33 landmarks con visibility = 0.94 (> 0.85) y Postura en 'T' exacta (0°)
    lm_optimo = _crear_33_landmarks(visibilidad=0.94, postura_t=True, desviacion_grados=4.0)
    res_ok = verificar_calibracion(lm_optimo)
    assert bool(res_ok) is True, f"La calibración óptima debió ser válida: {res_ok}"
    assert res_ok["iluminacion_valida"] is True
    assert res_ok["postura_t_valida"] is True
    assert res_ok["visibilidad_promedio"] > 0.85
    print(f"  ✅ Postura en 'T' con buena luz validada (vis={res_ok['visibilidad_promedio']}, ángulo={res_ok['angulo_brazo_izq_deg']}°).")

    # 2. Caso mala iluminación / contraluz: visibility = 0.78 (<= 0.85)
    lm_poca_luz = _crear_33_landmarks(visibilidad=0.78, postura_t=True, desviacion_grados=0.0)
    res_luz = verificar_calibracion(lm_poca_luz)
    assert bool(res_luz) is False, "Con visibilidad <= 0.85 la calibración debe rechazarse"
    assert res_luz["iluminacion_valida"] is False
    assert res_luz["tipo"] == "error_calibracion"
    assert res_luz["mensaje"] == "Poca luz o contraluz. Mejora la iluminación de la habitación."
    print(f"  ✅ Filtro de Luz (> 0.85) verificado: '{res_luz['mensaje']}'")

    # 3. Caso fuera del margen de ±15° (ej. brazos caídos a 25° o en reposo)
    lm_fuera_angulo = _crear_33_landmarks(visibilidad=0.95, postura_t=True, desviacion_grados=25.0)
    res_ang = verificar_calibracion(lm_fuera_angulo)
    assert bool(res_ang) is False, "Brazos con inclinación > 15° deben ser rechazados"
    assert res_ang["postura_t_valida"] is False

    lm_reposo = _crear_33_landmarks(visibilidad=0.95, postura_t=False)
    res_rep = verificar_calibracion(lm_reposo)
    assert bool(res_rep) is False, "Brazos abajo en reposo deben ser rechazados"
    assert res_rep["postura_t_valida"] is False
    print("  ✅ Validación geométrica de Postura en 'T' (±15° en Y y separación en X) verificada.")


def test_websocket_maquina_estados_calibracion():
    print("\nTesting Máquina de Estados en WebSocket (1. CALIBRANDO -> 2. ACTIVO tras 90 frames)...")
    client = TestClient(main.app)

    with client.websocket_connect("/ws/analizar/test_sesion_calibracion") as ws:
        # 1. Enviar un frame con poca luz (visibility = 0.65 <= 0.85)
        lm_oscuro = _crear_33_landmarks(visibilidad=0.65, postura_t=True)
        ws.send_json({
            "frame_id": 1,
            "timestamp": 0.033,
            "landmarks_33": lm_oscuro,
            "puntos": {
                "hombro_izq": lm_oscuro[11],
                "hombro_der": lm_oscuro[12],
                "muneca_izq": lm_oscuro[15],
                "muneca_der": lm_oscuro[16],
            },
        })
        resp_error = ws.receive_json()
        assert resp_error["tipo"] == "error_calibracion", f"Se esperaba error_calibracion, recibido: {resp_error}"
        assert resp_error["mensaje"] == "Poca luz o contraluz. Mejora la iluminación de la habitación."
        assert resp_error["estado_sesion"] == "CALIBRANDO"
        print(f"  ✅ Señal 'error_calibracion' recibida correctamente: {resp_error['mensaje']}")

        # 2. Enviar 89 frames continuos en Posición de 'T' con buena luz (0.95)
        lm_valido = _crear_33_landmarks(visibilidad=0.95, postura_t=True, desviacion_grados=3.0)
        puntos_validos = {
            "nariz": [0.50, 0.20, -0.1, 0.95],
            "hombro_izq": lm_valido[11],
            "hombro_der": lm_valido[12],
            "codo_izq": [0.28, 0.40, 0.0, 0.95],
            "codo_der": [0.72, 0.40, 0.0, 0.95],
            "muneca_izq": lm_valido[15],
            "muneca_der": lm_valido[16],
            "cadera_izq": [0.46, 0.70, 0.0, 0.95],
            "cadera_der": [0.54, 0.70, 0.0, 0.95],
            "rodilla_izq": [0.46, 0.85, 0.0, 0.95],
            "rodilla_der": [0.54, 0.85, 0.0, 0.95],
            "tobillo_izq": [0.46, 0.98, 0.0, 0.95],
            "tobillo_der": [0.54, 0.98, 0.0, 0.95],
        }

        for f_idx in range(1, 90):
            ws.send_json({
                "frame_id": 10 + f_idx,
                "timestamp": f_idx * 0.033,
                "landmarks_33": lm_valido,
                "puntos": puntos_validos,
            })
            r = ws.receive_json()
            assert r["estado_sesion"] == "CALIBRANDO", f"En el frame {f_idx} aún debía estar CALIBRANDO"
            assert r["frames_calibrados"] == f_idx

        # 3. Frame #90 continuo -> Desbloqueo del sistema a estado ACTIVO
        ws.send_json({
            "frame_id": 100,
            "timestamp": 90 * 0.033,
            "landmarks_33": lm_valido,
            "puntos": puntos_validos,
        })
        resp_exito = ws.receive_json()
        assert resp_exito["tipo"] == "calibracion_exitosa", f"Frame 90 debía emitir calibracion_exitosa: {resp_exito}"
        assert resp_exito["mensaje"] == "Entorno óptimo. Sistema de captura activado."
        assert resp_exito["estado_sesion"] == "ACTIVO"
        print(f"  ✅ Señal 'calibracion_exitosa' tras 90 frames continuos: {resp_exito['mensaje']}")

        # 4. Frame #91 -> El sistema ya está en estado ACTIVO y procesa el búfer temporal buscando t0
        ws.send_json({
            "frame_id": 101,
            "timestamp": 91 * 0.033,
            "landmarks_33": lm_valido,
            "puntos": puntos_validos,
            "gesto_tecnico": "remate",
        })
        resp_telemetria = ws.receive_json()
        assert resp_telemetria["tipo"] == "telemetria_frame", f"En estado ACTIVO debe emitir telemetria_frame: {resp_telemetria}"
        print("  ✅ Transición CALIBRANDO -> ACTIVO completada: el búfer temporal analiza saltos normalmente.")


def test_frontend_overlay_calibracion():
    print("\nTesting Frontend: Mensaje superpuesto de bloqueo y manejo de señales WS...")
    html_path = os.path.join(ROOT_DIR, "frontend", "index.html")
    js_path = os.path.join(ROOT_DIR, "frontend", "js", "app.js")

    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()
    with open(js_path, "r", encoding="utf-8") as f:
        js = f.read()

    msg_esperado = "ALGORITMO BLOQUEADO: Ponte frente a la cámara en Posición de 'T' (brazos extendidos) durante 3 segundos para calibrar"
    assert msg_esperado in html, "El mensaje de bloqueo en 'T' no se encuentra en frontend/index.html"
    assert "calibracion_exitosa" in js, "El evento 'calibracion_exitosa' no se maneja en frontend/js/app.js"
    assert "error_calibracion" in js, "El evento 'error_calibracion' no se maneja en frontend/js/app.js"
    print("  ✅ Frontend verificado con overlay de calibración y escucha de eventos WebSocket.")
    print("\n🏆 FASE 1: CALIBRACIÓN CERO AMBIENTAL VERIFICADA AL 100%!")


if __name__ == "__main__":
    test_verificar_calibracion_entorno_y_postura()
    test_websocket_maquina_estados_calibracion()
    test_frontend_overlay_calibracion()
