"""
Suite de Pruebas Unitarias y de Integración para el Gatillo Dinámico (Delta Y)
y el Lock de Estado `ENFRIAMIENTO` (`test_clean_architecture_solid.py`).
Verifica:
1. `backend/vision/motor_yolo.py` (`MotorYolo`).
2. `backend/biomecanica/buffer_circular.py` (`BufferCircularBiomecanico` con `deque(maxlen=33)`).
3. `backend/biomecanica/analizador_gestos.py` y `maquina_estados.py`:
   - Cero falsos positivos ante posturas estáticas (sin aceleración Delta Y).
   - Gatillo de Aceleración (Delta Y en los últimos 15 frames) para Recepción.
   - Lock de Estado `ENFRIAMIENTO` estricto de 3 segundos post-gesto (ignorando nuevas evaluaciones
     pero devolviendo las coordenadas para pintar el esqueleto).
4. `backend/api/ws_handler.py` (`websocket_rolling_endpoint` en `/ws`).
"""

import unittest
import numpy as np
from fastapi.testclient import TestClient

from main import app
from backend.vision.motor_yolo import MotorYolo
from backend.biomecanica.buffer_circular import BufferCircularBiomecanico
from backend.biomecanica.analizador_gestos import AnalizadorGestosVentana


def _generar_17_landmarks_mock(
    conf_general: float = 0.95,
    y_munecas: float = 0.70,
    dist_munecas: float = 0.40,
) -> list:
    """Genera 17 puntos COCO válidos [x, y, z, conf] para simulación."""
    return [
        [0.50, 0.20, -0.06, conf_general],
        [0.48, 0.18, -0.06, conf_general],
        [0.52, 0.18, -0.06, conf_general],
        [0.45, 0.20, 0.00, conf_general],
        [0.55, 0.20, 0.00, conf_general],
        [0.40, 0.35, 0.00, conf_general],
        [0.60, 0.35, 0.00, conf_general],
        [0.35, 0.50, -0.10, conf_general],
        [0.65, 0.50, -0.10, conf_general],
        [0.50 - dist_munecas / 2.0, y_munecas, -0.18, conf_general],
        [0.50 + dist_munecas / 2.0, y_munecas, -0.18, conf_general],
        [0.42, 0.65, 0.00, conf_general],
        [0.58, 0.65, 0.00, conf_general],
        [0.42, 0.80, -0.05, conf_general],
        [0.58, 0.80, -0.05, conf_general],
        [0.42, 0.95, 0.00, conf_general],
        [0.58, 0.95, 0.00, conf_general],
    ]


class TestArquitecturaVentanaDeslizante(unittest.TestCase):
    """Verifica todos los módulos SOLID del backend con Gatillo Dinámico y Lock de 3s."""

    def test_1_motor_yolo(self):
        motor = MotorYolo()
        self.assertIsNotNone(motor)
        self.assertIsNone(motor.extraer_landmarks(None))
        self.assertIsNone(motor.extraer_landmarks(np.array([])))

    def test_2_buffer_circular_deque_33(self):
        buf = BufferCircularBiomecanico(maxlen=33, ventana_suavizado=2)
        self.assertEqual(buf.maxlen, 33)
        self.assertEqual(buf.frames_acumulados, 0)

        for i in range(40):
            lms = _generar_17_landmarks_mock(y_munecas=0.65 - (i % 5) * 0.02)
            suav = buf.agregar_frame(lms, timestamp=1000.0 + i * 0.1)
            self.assertIsNotNone(suav)
            self.assertEqual(len(suav), 17)

        self.assertEqual(buf.frames_acumulados, 33)
        cinematica = buf.analizar_cinematica_ventana()
        self.assertIn("velocidad_articular_ms", cinematica)
        self.assertGreater(cinematica["velocidad_articular_ms"], 0.0)

    def test_3_gatillo_aceleracion_delta_y_y_lock_enfriamiento_3s(self):
        analizador = AnalizadorGestosVentana(
            maxlen=33,
            cooldown_voz_segundos=3.0,
            duracion_enfriamiento=3.0,
        )

        # A) Postura estática (muñecas juntas pero quietas sin aceleración Delta Y):
        # NO debe disparar falsos positivos en el Timeline.
        for i in range(10):
            lms_estatico = _generar_17_landmarks_mock(y_munecas=0.55, dist_munecas=0.06)
            res_est = analizador.procesar_frame_en_ventana(lms_estatico, timestamp=100.0 + i * 0.1)
            self.assertEqual(res_est.estado, "REPOSO")
            self.assertIsNone(res_est.evento_gesto_completado)

        # B) Gatillo Dinámico de Recepción (muñecas inician abajo en Y=0.78 y suben rápido a Y=0.52)
        alturas_subida = [0.78, 0.76, 0.72, 0.65, 0.58, 0.52]
        ultimo_res = None
        for idx, y_val in enumerate(alturas_subida):
            lms_din = _generar_17_landmarks_mock(y_munecas=y_val, dist_munecas=0.06)
            # Codos doblados para probar corrección técnica
            lms_din[7] = [0.22, 0.48, -0.10, 0.95]
            lms_din[8] = [0.78, 0.48, -0.10, 0.95]
            ultimo_res = analizador.procesar_frame_en_ventana(lms_din, timestamp=200.0 + idx * 0.1)
            if ultimo_res.evento_gesto_completado is not None:
                break

        self.assertIsNotNone(ultimo_res)
        self.assertEqual(ultimo_res.gesto, "Recepción")
        self.assertIsNotNone(ultimo_res.evento_gesto_completado)
        self.assertEqual(len(ultimo_res.evento_gesto_completado["coordenadas_3d"]), 33)

        # C) Lock de Estado ENFRIAMIENTO (3 segundos):
        # Durante los siguientes 3 segundos, ignora evaluaciones y devuelve estado="ENFRIAMIENTO"
        # pero sigue entregando los 17 landmarks para pintar el esqueleto.
        lms_post = _generar_17_landmarks_mock(y_munecas=0.50, dist_munecas=0.06)
        res_enfriamiento = analizador.procesar_frame_en_ventana(lms_post, timestamp=201.5)
        self.assertEqual(res_enfriamiento.estado, "ENFRIAMIENTO")
        self.assertIsNone(res_enfriamiento.evento_gesto_completado)
        self.assertIsNone(res_enfriamiento.mensaje_voz)
        self.assertEqual(len(res_enfriamiento.landmarks), 17)

        # D) Pasados los 3 segundos (t = 204.0), se desbloquea el ENFRIAMIENTO y vuelve a REPOSO
        res_desbloqueado = analizador.procesar_frame_en_ventana(lms_post, timestamp=204.5)
        self.assertEqual(res_desbloqueado.estado, "REPOSO")

    def test_4_ws_handler_rolling_stream_con_gatillo(self):
        client = TestClient(app)
        with client.websocket_connect("/ws") as ws:
            # Simular trayectoria ascendente de Voleo (inicia abajo en Y=0.55 y sube a Y=0.14)
            trayectoria_y = [0.55, 0.50, 0.42, 0.30, 0.14]
            evento_capturado = None

            for y_val in trayectoria_y:
                lms_v = _generar_17_landmarks_mock(y_munecas=y_val, dist_munecas=0.20)
                lms_v[7] = [0.30, min(0.50, y_val + 0.11), -0.10, 0.95]
                lms_v[8] = [0.70, min(0.50, y_val + 0.11), -0.10, 0.95]
                ws.send_json({"landmarks": lms_v})
                resp = ws.receive_json()
                self.assertEqual(resp["tipo"], "telemetria")
                self.assertEqual(len(resp["landmarks"]), 17)
                if resp.get("evento_gesto_completado"):
                    evento_capturado = resp["evento_gesto_completado"]
                    break

            self.assertIsNotNone(evento_capturado)
            self.assertEqual(evento_capturado["tipo_gesto"], "Voleo")
            self.assertEqual(len(evento_capturado["coordenadas_3d"]), 33)

            # El siguiente frame inmediato por WebSocket debe estar en estado ENFRIAMIENTO
            ws.send_json({"landmarks": _generar_17_landmarks_mock(y_munecas=0.14, dist_munecas=0.20)})
            resp_lock = ws.receive_json()
            self.assertEqual(resp_lock["estado"], "ENFRIAMIENTO")
            self.assertIsNone(resp_lock["evento_gesto_completado"])
            self.assertEqual(len(resp_lock["landmarks"]), 17)

    def test_5_post_api_analisis_profundo_hibrido_edge_cloud(self):
        client = TestClient(app)

        # Verificar que el puerto 8000 es una API REST pura (JSONResponse, cero HTML)
        resp_root = client.get("/")
        self.assertEqual(resp_root.status_code, 200)
        self.assertIn("application/json", resp_root.headers.get("content-type", ""))
        self.assertEqual(resp_root.json().get("frontend_exclusive_url"), "http://localhost:3000")

        # A) VOLEO sin flexión previa de piernas en el frame inicial -> Penaliza y exige impulso de piernas
        secuencia_voleo_33 = [
            _generar_17_landmarks_mock(y_munecas=max(0.14, 0.55 - i * 0.015), dist_munecas=0.20)
            for i in range(33)
        ]
        resp = client.post(
            "/api/analisis-profundo",
            json={
                "jugador": "mateo_silva",
                "gesto_detectado_edge": "Voleo",
                "frames_landmarks": secuencia_voleo_33,
            },
        )
        self.assertEqual(resp.status_code, 200)
        datos = resp.json()
        self.assertEqual(datos["status"], "success")
        self.assertEqual(datos["gesto_detectado"], "Voleo")
        self.assertEqual(
            datos["mensaje_voz"],
            "Error: Usa las piernas para impulsar el voleo, no solo los brazos",
        )
        self.assertIn("efectividad", datos)
        self.assertIn("fases", datos)
        self.assertIn("fase_3_contacto_critico", datos["fases"])
        self.assertEqual(len(datos["coordenadas_3d"]), 33)

        # B) RECEPCIÓN con codos flexionados (< 155°) en el vértice -> "Error: Estira completamente los codos al recibir"
        secuencia_rec_codos = []
        for i in range(33):
            lms = _generar_17_landmarks_mock(y_munecas=max(0.48, 0.76 - i * 0.01), dist_munecas=0.06)
            lms[7] = [0.22, 0.46, -0.10, 0.95]
            lms[8] = [0.78, 0.46, -0.10, 0.95]
            secuencia_rec_codos.append(lms)

        resp_rec = client.post(
            "/api/analisis-profundo",
            json={
                "jugador": "mateo_silva",
                "gesto_detectado_edge": "Recepción",
                "frames_landmarks": secuencia_rec_codos,
            },
        )
        datos_rec = resp_rec.json()
        self.assertEqual(datos_rec["gesto_detectado"], "Recepción")
        self.assertEqual(
            datos_rec["mensaje_voz"],
            "Error: Estira completamente los codos al recibir",
        )

        # C) RECEPCIÓN con codos estirados (>= 155°) pero hombros desnivelados respecto a caderas
        secuencia_rec_hombros = []
        for i in range(33):
            lms = _generar_17_landmarks_mock(y_munecas=max(0.55, 0.76 - i * 0.008), dist_munecas=0.06)
            # Codos colineales (>= 165°) pero hombro izquierdo muy elevado respecto al derecho
            lms[5] = [0.40, 0.28, 0.00, 0.95]
            lms[6] = [0.60, 0.39, 0.00, 0.95]
            lms[7] = [0.43, 0.42, -0.10, 0.95]
            lms[8] = [0.57, 0.47, -0.10, 0.95]
            secuencia_rec_hombros.append(lms)

        resp_hom = client.post(
            "/api/analisis-profundo",
            json={
                "jugador": "mateo_silva",
                "gesto_detectado_edge": "Recepción",
                "frames_landmarks": secuencia_rec_hombros,
            },
        )
        datos_hom = resp_hom.json()
        self.assertEqual(
            datos_hom["mensaje_voz"],
            "Error: Alinea tus hombros con la trayectoria del balón",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
