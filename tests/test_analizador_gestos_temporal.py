"""
Pruebas Unitarias e Integración: Analizador Biomecánico de Voleo con Gatillo de Reposo y Telemetría.
Valida:
1. Método estático GesturesAnalyzer.calcular_angulo(a, b, c):
   - Ángulo recto (90°).
   - Ángulo llano (180°).
   - Ángulo agudo (45°).
   - Manejo seguro de landmarks ausentes o None.
2. GATILLO DE ACTIVACIÓN (Muñecas vs Hombros):
   - Manos abajo (Y_muñecas >= Y_hombros) -> Estado 'En reposo', sin mensajes de voz.
   - Manos arriba (Y_muñecas < Y_hombros) -> Estado 'Analizando voleo'.
3. REGLA 1 (Altura): Muñecas arriba de hombros pero abajo de ojos -> 'Error: Sube las manos por encima de la frente.'
4. REGLA 2 (Flexión de Codos):
   - Ángulo promedio < 85° -> 'Codos muy cerrados, corrijes retención.'
   - Ángulo promedio > 130° -> 'Brazos muy rígidos, flexiona más los codos.'
5. REGLA 3 (Simetría):
   - Diferencia absoluta en Y entre muñecas > 0.05 -> 'Empuje asimétrico, nivela tus manos.'
6. Técnica correcta (manos altas, codos ~100°, simetría) -> None y estado 'Voleo correcto'.
7. Emisión por WebSocket de {"tipo": "telemetria", "estado": ..., "mensaje_voz": ..., "landmarks": ...}.
"""

import sys
import unittest
from pathlib import Path
from typing import List, Optional, Tuple

from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.biomecanica.analizador_gestos import (
    MENSAJE_BRAZOS_RIGIDOS,
    MENSAJE_CODOS_CERRADOS,
    MENSAJE_EMPUJE_ASIMETRICO,
    MENSAJE_ERROR_ALTURA,
    GesturesAnalyzer,
)
from main import app


def _crear_frame_voleo(
    y_muneca_izq: float,
    y_muneca_der: float,
    y_ojos: float = 0.30,
    y_hombros: float = 0.45,
    pt_codo_izq: Optional[Tuple[float, float]] = None,
    pt_codo_der: Optional[Tuple[float, float]] = None,
) -> List[List[float]]:
    """Genera 33 landmarks con control fino de hombros, codos y muñecas."""
    pts = [[0.5, 0.5, 0.0, 0.99] for _ in range(33)]

    # Nariz y Ojos
    pts[0] = [0.50, y_ojos + 0.02, 0.0, 0.99]
    pts[2] = [0.45, y_ojos, 0.0, 0.99]
    pts[5] = [0.55, y_ojos, 0.0, 0.99]

    # Hombros
    pts[11] = [0.40, y_hombros, 0.0, 0.99]
    pts[12] = [0.60, y_hombros, 0.0, 0.99]

    # Codos: posición por defecto para dar ~100° con muñecas elevadas
    codo_izq = pt_codo_izq if pt_codo_izq is not None else (0.34, 0.28)
    codo_der = pt_codo_der if pt_codo_der is not None else (0.66, 0.28)
    pts[13] = [codo_izq[0], codo_izq[1], 0.0, 0.99]
    pts[14] = [codo_der[0], codo_der[1], 0.0, 0.99]

    # Muñecas
    pts[15] = [0.42, y_muneca_izq, 0.0, 0.99]
    pts[16] = [0.58, y_muneca_der, 0.0, 0.99]

    # Caderas y Tobillos
    pts[23] = [0.45, 0.70, 0.0, 0.99]
    pts[24] = [0.55, 0.70, 0.0, 0.99]
    pts[27] = [0.45, 0.90, 0.0, 0.99]
    pts[28] = [0.55, 0.90, 0.0, 0.99]

    return pts


class TestTrigonometriaGesturesAnalyzer(unittest.TestCase):
    """Pruebas del método estático calcular_angulo."""

    def test_angulo_recto_90_grados(self):
        ang = GesturesAnalyzer.calcular_angulo((0.0, 1.0), (0.0, 0.0), (1.0, 0.0))
        self.assertIsNotNone(ang)
        self.assertAlmostEqual(ang, 90.0, places=1)

    def test_angulo_llano_180_grados(self):
        ang = GesturesAnalyzer.calcular_angulo((0.0, 1.0), (0.0, 0.0), (0.0, -1.0))
        self.assertIsNotNone(ang)
        self.assertAlmostEqual(ang, 180.0, places=1)

    def test_angulo_agudo_45_grados(self):
        ang = GesturesAnalyzer.calcular_angulo((1.0, 0.0), (0.0, 0.0), (1.0, 1.0))
        self.assertIsNotNone(ang)
        self.assertAlmostEqual(ang, 45.0, places=1)

    def test_manejo_errores_landmarks_ausentes(self):
        self.assertIsNone(GesturesAnalyzer.calcular_angulo(None, (0.0, 0.0), (1.0, 0.0)))
        self.assertIsNone(GesturesAnalyzer.calcular_angulo((0.0, 0.0), None, (1.0, 0.0)))
        self.assertIsNone(GesturesAnalyzer.calcular_angulo((0.0, 0.0), (1.0, 0.0), None))


class TestGatilloActivacionYReglas(unittest.TestCase):
    """Pruebas del gatillo de activación (reposo vs acción) y las 3 reglas biomecánicas."""

    def setUp(self):
        self.analyzer = GesturesAnalyzer(maxlen=33, cooldown_segundos=0.0)

    def test_gatillo_manos_abajo_estado_en_reposo_sin_voz(self):
        """Si las manos están abajo (Y_muñecas >= Y_hombros), debe marcar 'En reposo' y None."""
        # Hombros en 0.45, Muñecas en 0.65 (manos a los costados)
        buffer = [_crear_frame_voleo(y_muneca_izq=0.65, y_muneca_der=0.65, y_hombros=0.45) for _ in range(33)]
        res = self.analyzer.analizar_voleo(buffer)
        self.assertIsNone(res, "En reposo no debe generar mensaje de voz")
        self.assertEqual(self.analyzer.estado_actual, "En reposo")

    def test_regla_1_altura_manos_arriba_hombros_pero_bajo_ojos(self):
        """
        Manos arriba de hombros (Y=0.38 < Hombros 0.45),
        pero aún por debajo de los ojos (Y=0.38 > Ojos 0.30).
        """
        buffer = [
            _crear_frame_voleo(
                y_muneca_izq=0.38,
                y_muneca_der=0.38,
                y_ojos=0.30,
                y_hombros=0.45,
            )
            for _ in range(33)
        ]
        res = self.analyzer.analizar_voleo(buffer)
        self.assertEqual(res, MENSAJE_ERROR_ALTURA)
        self.assertEqual(res, "Error: Sube las manos por encima de la frente.")
        self.assertEqual(self.analyzer.estado_actual, "Analizando voleo")

    def test_regla_2_codos_muy_cerrados(self):
        """Manos arriba (Y=0.25 < Hombros 0.45 y Ojos 0.30), ángulo de codos < 85°."""
        codo_izq = (0.40, 0.20)
        codo_der = (0.60, 0.20)
        buffer = [
            _crear_frame_voleo(
                y_muneca_izq=0.25,
                y_muneca_der=0.25,
                y_ojos=0.30,
                y_hombros=0.45,
                pt_codo_izq=codo_izq,
                pt_codo_der=codo_der,
            )
            for _ in range(33)
        ]
        for f in buffer:
            f[15] = [0.43, 0.25, 0.0, 0.99]
            f[16] = [0.57, 0.25, 0.0, 0.99]

        res = self.analyzer.analizar_voleo(buffer)
        self.assertEqual(res, MENSAJE_CODOS_CERRADOS)
        self.assertEqual(res, "Codos muy cerrados, corrijes retención.")

    def test_regla_2_brazos_muy_rigidos(self):
        """Manos arriba, pero brazos muy extendidos (ángulo > 130°)."""
        codo_izq = (0.41, 0.25)
        codo_der = (0.59, 0.25)
        buffer = [
            _crear_frame_voleo(
                y_muneca_izq=0.15,
                y_muneca_der=0.15,
                y_ojos=0.30,
                y_hombros=0.45,
                pt_codo_izq=codo_izq,
                pt_codo_der=codo_der,
            )
            for _ in range(33)
        ]
        res = self.analyzer.analizar_voleo(buffer)
        self.assertEqual(res, MENSAJE_BRAZOS_RIGIDOS)
        self.assertEqual(res, "Brazos muy rígidos, flexiona más los codos.")

    def test_regla_3_empuje_asimetrico(self):
        """Manos arriba, codos bien (~100°), pero diferencia Y > 0.05."""
        codo_izq = (0.34, 0.28)
        codo_der = (0.66, 0.32)
        buffer = [
            _crear_frame_voleo(
                y_muneca_izq=0.18,
                y_muneca_der=0.26,
                y_ojos=0.30,
                y_hombros=0.45,
                pt_codo_izq=codo_izq,
                pt_codo_der=codo_der,
            )
            for _ in range(33)
        ]
        res = self.analyzer.analizar_voleo(buffer)
        self.assertEqual(res, MENSAJE_EMPUJE_ASIMETRICO)
        self.assertEqual(res, "Empuje asimétrico, nivela tus manos.")

    def test_voleo_perfecto_retorna_none_y_estado_correcto(self):
        """Técnica correcta completa."""
        buffer = [
            _crear_frame_voleo(
                y_muneca_izq=0.18,
                y_muneca_der=0.18,
                y_ojos=0.30,
                y_hombros=0.45,
            )
            for _ in range(33)
        ]
        res = self.analyzer.analizar_voleo(buffer)
        self.assertIsNone(res)
        self.assertEqual(self.analyzer.estado_actual, "Voleo correcto")


class TestWebSocketTelemetriaConLandmarks(unittest.TestCase):
    """Prueba de integración WebSocket emitiendo el payload telemetría con landmarks."""

    def test_websocket_emite_telemetria_con_landmarks_y_estado(self):
        client = TestClient(app)

        with client.websocket_connect("/ws") as ws:
            # Enviar frame en reposo (manos abajo)
            frame_reposo = _crear_frame_voleo(y_muneca_izq=0.65, y_muneca_der=0.65, y_hombros=0.45)
            ws.send_json({"frame_id": 1, "landmarks_33": frame_reposo})
            resp = ws.receive_json()

            self.assertEqual(resp.get("tipo"), "telemetria")
            self.assertEqual(resp.get("estado"), "En reposo")
            self.assertIsNone(resp.get("mensaje_voz"))
            self.assertTrue(isinstance(resp.get("landmarks"), list))
            self.assertEqual(len(resp["landmarks"]), 33)

            # Verificar que las coordenadas vengan normalizadas con visibilidad
            primer_punto = resp["landmarks"][0]
            self.assertEqual(len(primer_punto), 3)  # [x, y, vis]


if __name__ == "__main__":
    unittest.main(verbosity=2)
