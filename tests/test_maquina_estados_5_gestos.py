"""
Suite de Pruebas: Motor Biomecánico de 5 Fundamentos y YOLOv8-Pose.
Valida:
1. Módulo matematicas.py (calcular_angulo y distancia).
2. Motor YoloBiomechanics (instanciación e inferencia segura).
3. Máquina de Estados GesturesAnalyzer (detectar_intencion para los 5 fundamentos + reposo).
4. Submétodos de evaluación biomecánica (recepción, voleo, remate, bloqueo).
5. Integración WebSocket con payload unificado de telemetría.
"""

import sys
import unittest
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.biomecanica.analizador_gestos import (
    MENSAJE_ERROR_BLOQUEO_ASIMETRICO,
    MENSAJE_ERROR_BLOQUEO_CODOS,
    MENSAJE_ERROR_RECEPCION_CODOS,
    MENSAJE_ERROR_RECEPCION_RODILLAS,
    MENSAJE_ERROR_REMATE_EXTENSION,
    GesturesAnalyzer,
)
from backend.biomecanica.matematicas import CalculadoraTrigonometrica, calcular_angulo, distancia
from backend.biomecanica.motor_yolo import YoloBiomechanics
from main import app


def _crear_landmarks_coco(
    y_muneca_izq: float,
    y_muneca_der: float,
    x_muneca_izq: float = 0.30,
    x_muneca_der: float = 0.70,
    y_codo_izq: float = 0.35,
    y_codo_der: float = 0.35,
    x_codo_izq: float = 0.35,
    x_codo_der: float = 0.65,
    y_hombros: float = 0.40,
    y_cabeza: float = 0.25,
    y_rodillas: float = 0.70,
    y_tobillos: float = 0.90,
    x_tobillo_izq: float = 0.45,
    x_tobillo_der: float = 0.55,
) -> List[List[float]]:
    """Genera 17 keypoints formato YOLO COCO [x, y, conf]."""
    pts = [[0.5, 0.5, 0.99] for _ in range(17)]

    # 0: nariz, 1: ojo_izq, 2: ojo_der
    pts[0] = [0.50, y_cabeza, 0.99]
    pts[1] = [0.47, y_cabeza - 0.02, 0.99]
    pts[2] = [0.53, y_cabeza - 0.02, 0.99]

    # 5, 6: hombros
    pts[5] = [0.40, y_hombros, 0.99]
    pts[6] = [0.60, y_hombros, 0.99]

    # 7, 8: codos
    pts[7] = [x_codo_izq, y_codo_izq, 0.99]
    pts[8] = [x_codo_der, y_codo_der, 0.99]

    # 9, 10: muñecas
    pts[9] = [x_muneca_izq, y_muneca_izq, 0.99]
    pts[10] = [x_muneca_der, y_muneca_der, 0.99]

    # 11, 12: caderas
    pts[11] = [0.42, 0.55, 0.99]
    pts[12] = [0.58, 0.55, 0.99]

    # 13, 14: rodillas
    pts[13] = [0.43, y_rodillas, 0.99]
    pts[14] = [0.57, y_rodillas, 0.99]

    # 15, 16: tobillos
    pts[15] = [x_tobillo_izq, y_tobillos, 0.99]
    pts[16] = [x_tobillo_der, y_tobillos, 0.99]

    return pts


class TestMatematicasTrigonometria(unittest.TestCase):
    """Pruebas del módulo matematicas.py."""

    def test_calcular_angulo_recto(self):
        ang = calcular_angulo((0.0, 1.0), (0.0, 0.0), (1.0, 0.0))
        self.assertAlmostEqual(ang, 90.0, places=1)

    def test_distancia_euclidiana(self):
        dist = distancia((0.0, 0.0), (3.0, 4.0))
        self.assertAlmostEqual(dist, 5.0, places=2)

    def test_tolerancia_valores_nulos(self):
        self.assertIsNone(calcular_angulo(None, (0, 0), (1, 1)))
        self.assertIsNone(distancia(None, (1, 1)))


class TestYoloBiomechanics(unittest.TestCase):
    """Pruebas del motor YOLOv8."""

    def test_instanciacion_yolo(self):
        motor = YoloBiomechanics("yolov8n-pose.pt")
        self.assertIsNotNone(motor)
        # Inferencia con frame sintético no debe colapsar
        frame_vacio = np.zeros((480, 640, 3), dtype=np.uint8)
        res = motor.extraer_landmarks(frame_vacio)
        self.assertTrue(res is None or len(res) == 17)


class TestMaquinaEstados5Gestos(unittest.TestCase):
    """Pruebas de la máquina de estados y detección de los 5 fundamentos."""

    def setUp(self):
        self.analyzer = GesturesAnalyzer(cooldown_segundos=0.0)

    def test_deteccion_recepcion(self):
        # Muñecas juntas (x=0.49 y 0.51 -> dist=0.02) y por debajo de los hombros (Y=0.65 > Hombros 0.40)
        kpts = _crear_landmarks_coco(
            y_muneca_izq=0.65,
            y_muneca_der=0.65,
            x_muneca_izq=0.49,
            x_muneca_der=0.51,
            y_hombros=0.40,
        )
        gesto = self.analyzer.detectar_intencion(kpts)
        self.assertEqual(gesto, "RECEPCIÓN")

    def test_deteccion_voleo(self):
        # Muñecas separadas (x=0.40 y 0.60) y por encima de los hombros (Y=0.25 < Hombros 0.40)
        # Codos flexionados (~100°)
        kpts = _crear_landmarks_coco(
            y_muneca_izq=0.22,
            y_muneca_der=0.22,
            x_muneca_izq=0.42,
            x_muneca_der=0.58,
            y_codo_izq=0.28,
            y_codo_der=0.28,
            x_codo_izq=0.34,
            x_codo_der=0.66,
            y_hombros=0.40,
            y_cabeza=0.30,
        )
        gesto = self.analyzer.detectar_intencion(kpts)
        self.assertEqual(gesto, "VOLEO")

    def test_deteccion_bloqueo(self):
        # Ambas manos por encima de la cabeza y codos extendidos (>150°)
        kpts = _crear_landmarks_coco(
            y_muneca_izq=0.10,
            y_muneca_der=0.10,
            x_muneca_izq=0.44,
            x_muneca_der=0.56,
            y_codo_izq=0.24,
            y_codo_der=0.24,
            x_codo_izq=0.42,
            x_codo_der=0.58,
            y_hombros=0.40,
            y_cabeza=0.25,
        )
        gesto = self.analyzer.detectar_intencion(kpts)
        self.assertEqual(gesto, "BLOQUEO")

    def test_deteccion_remate(self):
        # Un brazo arriba (Y=0.10 < cabeza 0.25) y el otro abajo (Y=0.55)
        kpts = _crear_landmarks_coco(
            y_muneca_izq=0.55,
            y_muneca_der=0.10,
            y_cabeza=0.25,
            y_hombros=0.40,
        )
        gesto = self.analyzer.detectar_intencion(kpts)
        self.assertEqual(gesto, "REMATE")

    def test_deteccion_reposo(self):
        # Manos abajo a los lados
        kpts = _crear_landmarks_coco(
            y_muneca_izq=0.70,
            y_muneca_der=0.70,
            x_muneca_izq=0.30,
            x_muneca_der=0.70,
            y_hombros=0.40,
        )
        gesto = self.analyzer.detectar_intencion(kpts)
        self.assertEqual(gesto, "REPOSO")

    # -------------------------------------------------------------------------
    # Pruebas de Submétodos de Evaluación y Corrección
    # -------------------------------------------------------------------------
    def test_evaluar_recepcion_codos_doblados(self):
        # Codo a 90° (< 165°)
        # Hombro (0.40, 0.40), Codo (0.40, 0.55), Muñeca (0.50, 0.55)
        kpts = _crear_landmarks_coco(
            y_muneca_izq=0.55,
            y_muneca_der=0.55,
            x_muneca_izq=0.49,
            x_muneca_der=0.51,
            y_codo_izq=0.55,
            y_codo_der=0.55,
            x_codo_izq=0.40,
            x_codo_der=0.60,
            y_hombros=0.40,
        )
        corr = self.analyzer.evaluar_recepcion(kpts)
        self.assertEqual(corr, MENSAJE_ERROR_RECEPCION_CODOS)

    def test_evaluar_remate_codo_sin_extension(self):
        # Brazo derecho de ataque con codo flexionado (~90° < 160°)
        # Hombro der (0.60, 0.40), Codo der (0.60, 0.25), Muñeca der (0.70, 0.25)
        kpts = _crear_landmarks_coco(
            y_muneca_izq=0.55,
            y_muneca_der=0.25,
            x_muneca_der=0.70,
            y_codo_der=0.25,
            x_codo_der=0.60,
            y_cabeza=0.30,
            y_hombros=0.40,
        )
        corr = self.analyzer.evaluar_remate(kpts)
        self.assertEqual(corr, MENSAJE_ERROR_REMATE_EXTENSION)

    def test_evaluar_bloqueo_asimetrico(self):
        # Muñeca izq en 0.10, Muñeca der en 0.18 (diff = 0.08 > 0.06)
        kpts = _crear_landmarks_coco(
            y_muneca_izq=0.10,
            y_muneca_der=0.18,
            y_cabeza=0.25,
            y_codo_izq=0.20,
            y_codo_der=0.25,
        )
        corr = self.analyzer.evaluar_bloqueo(kpts)
        self.assertEqual(corr, MENSAJE_ERROR_BLOQUEO_ASIMETRICO)


class TestWebSocketIntegracion5Gestos(unittest.TestCase):
    """Prueba del WebSocket devolviendo el payload unificado."""

    def test_websocket_telemetria_payload_completo(self):
        client = TestClient(app)

        with client.websocket_connect("/ws") as ws:
            kpts = _crear_landmarks_coco(y_muneca_izq=0.70, y_muneca_der=0.70)
            ws.send_json({"frame_id": 1, "landmarks_33": kpts})
            resp = ws.receive_json()

            self.assertEqual(resp.get("tipo"), "telemetria")
            self.assertEqual(resp.get("estado"), "En reposo")
            self.assertIsNone(resp.get("mensaje_voz"))
            self.assertEqual(len(resp["landmarks"]), 17)


if __name__ == "__main__":
    unittest.main(verbosity=2)
