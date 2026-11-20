"""
Suite de Pruebas: Arquitectura Empresarial Opción B (Next.js Thin Client + Server-Side Vision).
Valida:
1. Decodificación de fotogramas Base64 (con/sin prefijo data-url, límites de tamaño, tipos de datos).
2. Extractor de Pose MediaPipe Tasks (carga de modelo, inferencia sobre arrays NumPy, mapeo de 33 articulaciones).
3. Endpoint WebSocket de FastAPI (/ws y /ws/analizar/{id}) recibiendo frames Base64 continuos.
"""

import base64
import os
import sys
import unittest
from pathlib import Path

import cv2
import numpy as np
from fastapi.testclient import TestClient

# Asegurar path al proyecto
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from main import app
from backend.vision.decodificador_frames import (
    MAX_LONGITUD_BASE64,
    decodificar_base64_a_imagen,
)
from backend.vision.extractor_pose import (
    ResultadoPose,
    construir_payload_landmarks,
    crear_extractor_pose,
)


def _crear_frame_jpeg_base64(ancho: int = 640, alto: int = 480, con_prefijo: bool = False) -> str:
    """Crea una imagen sintética y la codifica a Base64 en formato JPEG."""
    img = np.zeros((alto, ancho, 3), dtype=np.uint8)
    cv2.circle(img, (ancho // 2, alto // 2), 50, (255, 255, 255), -1)
    cv2.rectangle(img, (100, 100), (200, 300), (0, 255, 0), 2)
    success, encoded = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 60])
    assert success, "Fallo al codificar imagen JPEG"
    b64_str = base64.b64encode(encoded.tobytes()).decode("utf-8")
    if con_prefijo:
        return f"data:image/jpeg;base64,{b64_str}"
    return b64_str


class TestDecodificadorFrames(unittest.TestCase):
    """Pruebas unitarias de decodificación Base64."""

    def test_decodificacion_exitosa_sin_prefijo(self):
        b64 = _crear_frame_jpeg_base64(320, 240, con_prefijo=False)
        img = decodificar_base64_a_imagen(b64)
        self.assertIsNotNone(img)
        self.assertIsInstance(img, np.ndarray)
        self.assertEqual(img.shape, (240, 320, 3))

    def test_decodificacion_exitosa_con_prefijo_data_url(self):
        b64 = _crear_frame_jpeg_base64(640, 480, con_prefijo=True)
        img = decodificar_base64_a_imagen(b64)
        self.assertIsNotNone(img)
        self.assertEqual(img.shape, (480, 640, 3))

    def test_rechazo_datos_vacios_o_corruptos(self):
        self.assertIsNone(decodificar_base64_a_imagen(""))
        self.assertIsNone(decodificar_base64_a_imagen("   "))
        self.assertIsNone(decodificar_base64_a_imagen("esto_no_es_base64_valido!!!"))

    def test_rechazo_supera_limite_maximo(self):
        datos_enormes = "A" * (MAX_LONGITUD_BASE64 + 10)
        self.assertIsNone(decodificar_base64_a_imagen(datos_enormes))


class TestExtractorPose(unittest.TestCase):
    """Pruebas del motor de estimación de pose en el backend."""

    def test_creacion_y_cierre_extractor_pose(self):
        extractor = crear_extractor_pose()
        self.assertIsNotNone(extractor)
        img = np.zeros((480, 640, 3), dtype=np.uint8)
        resultado = extractor.extraer(img, 100)
        self.assertTrue(resultado is None or isinstance(resultado, ResultadoPose))
        extractor.cerrar()

    def test_construir_payload_landmarks(self):
        puntos_2d = [[0.5, 0.5, 0.0, 0.9] for _ in range(33)]
        puntos_mundo = [[0.0, 0.0, 0.0, 0.9] for _ in range(33)]
        pose = ResultadoPose(landmarks_2d=puntos_2d, landmarks_mundo=puntos_mundo)

        payload = construir_payload_landmarks(pose, frame_id=42, timestamp=100.5)
        self.assertEqual(payload["frame_id"], 42)
        self.assertEqual(payload["timestamp"], 100.5)
        self.assertIn("nariz", payload["puntos"])
        self.assertIn("tobillo_der", payload["puntos"])
        self.assertEqual(len(payload["landmarks_33"]), 33)


class TestWebSocketBase64Streaming(unittest.TestCase):
    """Pruebas de integración del WebSocket recibiendo frames en Base64."""

    def test_conexion_ws_y_envio_frames_base64(self):
        client = TestClient(app)
        frame_b64 = _crear_frame_jpeg_base64(640, 480)

        with client.websocket_connect("/ws") as ws:
            ws.send_text(frame_b64)
            data1 = ws.receive_json()
            self.assertIn("tipo", data1)
            self.assertIn(data1["tipo"], ("telemetria", "telemetria_frame", "estado_calibracion"))

            ws.send_text(frame_b64)
            data2 = ws.receive_json()
            self.assertIn("tipo", data2)
            self.assertIn(data2["tipo"], ("telemetria", "telemetria_frame", "estado_calibracion"))

    def test_conexion_ws_ruta_analizar_sesion(self):
        client = TestClient(app)
        frame_b64 = _crear_frame_jpeg_base64(640, 480)

        with client.websocket_connect("/ws/analizar/sesion_test_opt_b") as ws:
            ws.send_text(frame_b64)
            data = ws.receive_json()
            self.assertIn("tipo", data)


if __name__ == "__main__":
    unittest.main(verbosity=2)
