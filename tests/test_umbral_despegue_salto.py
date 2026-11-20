"""
Suite de Verificación del Paso 2: Corrección del Motor Físico y Eliminación de Saltos Fantasma.
Verifica en `backend/biomecanica/analisis_continuo.py`:
  a) Cálculo de la altura total del jugador en el frame inicial (`t0_calibracion`) como la distancia
     en el eje Y desde la nariz [0] hasta el promedio de los tobillos [27, 28].
  b) Aplicación del `UMBRAL_DE_DESPEGUE` estricto y dinámico (5% de la altura total).
  c) Rechazo de movimientos en puntillas o temblores de MediaPipe (variación en Y <= 5%) forzando
     `salto_vertical_cm = 0` y `tiempo_vuelo_segundos = 0`.
  d) Aceptación de saltos reales cuya elevación de tobillos supera el 5% de la altura total.
"""

import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.biomecanica.analisis_continuo import calcular_salto_vertical


def _generar_secuencia_prueba(desplazamiento_y_tobillos: float, usar_pixeles: bool = False):
    """
    Genera 33 frames donde:
      - Nariz [0] en Y = 0.20 (o 96 px si usar_pixeles=True en lienzo de 480 px)
      - Tobillos [27, 28] en suelo en Y = 0.90 (o 432 px) -> Altura total = 0.70 (o 336 px)
      - 5% de altura total = 0.035 (o 16.8 px)
    """
    escala = 480.0 if usar_pixeles else 1.0
    y_nariz = 0.20 * escala
    y_suelo = 0.90 * escala
    delta_vuelo = desplazamiento_y_tobillos * escala

    frames = []
    for i in range(33):
        ts = i * (1.0 / 30.0)
        en_aire = 9 <= i < 24  # 15 frames = 0.50 s
        y_tob = (y_suelo - delta_vuelo) if en_aire else y_suelo

        lm33 = [[0.5 * escala, 0.5 * escala, 0.0, 0.98] for _ in range(33)]
        lm33[0] = [0.5 * escala, y_nariz, 0.0, 0.98]     # nariz [0]
        lm33[27] = [0.46 * escala, y_tob, 0.0, 0.98]     # tobillo_izq [27]
        lm33[28] = [0.54 * escala, y_tob, 0.0, 0.98]     # tobillo_der [28]

        frames.append({
            "frame_id": i,
            "timestamp": ts,
            "landmarks_33": lm33,
            "landmarks_2d_original": {
                "nariz": [0.5 * escala, y_nariz, 0.0, 0.98],
                "tobillo_izq": [0.46 * escala, y_tob, 0.0, 0.98],
                "tobillo_der": [0.54 * escala, y_tob, 0.0, 0.98],
            },
        })
    return frames


print("=================================================================")
print("🧪 TEST DE UMBRAL_DE_DESPEGUE DINÁMICO (ANTI-SALTOS FANTASMA)")
print("=================================================================")

# 1. Caso Falso Positivo: Jugador se pone de puntillas o MediaPipe tiembla (3.2% < 5% de altura total)
print("\n[1] Verificando rechazo de puntillas / temblor (< 5% de la altura nariz-tobillos)...")
# Altura total = 0.70 -> 5% = 0.035. Probamos con desplazamiento = 0.022 (3.14% de la altura)
frames_puntillas = _generar_secuencia_prueba(desplazamiento_y_tobillos=0.022, usar_pixeles=False)
res_puntillas = calcular_salto_vertical(frames_puntillas)
assert res_puntillas["salto_vertical_cm"] == 0, f"Debió retornar 0 cm en puntillas, obtuvo {res_puntillas['salto_vertical_cm']}"
assert res_puntillas["tiempo_vuelo_segundos"] == 0, f"Debió retornar 0 s en puntillas, obtuvo {res_puntillas['tiempo_vuelo_segundos']}"
print(f"  ✅ Falso positivo en espacio normalizado bloqueado: {res_puntillas}")

# También verificar en coordenadas en píxeles (ej. 480px de alto -> altura jugador = 336px, 5% = 16.8px, desplazamiento = 10.5px)
frames_puntillas_px = _generar_secuencia_prueba(desplazamiento_y_tobillos=0.022, usar_pixeles=True)
res_puntillas_px = calcular_salto_vertical(frames_puntillas_px)
assert res_puntillas_px["salto_vertical_cm"] == 0
assert res_puntillas_px["tiempo_vuelo_segundos"] == 0
print(f"  ✅ Falso positivo en píxeles bloqueado: {res_puntillas_px}")

# 2. Caso Salto Real: Desplazamiento vertical de tobillos supera el 5% de la altura total (ej. 0.085 > 0.035)
print("\n[2] Verificando aceptación de salto real (> 5% de la altura nariz-tobillos)...")
frames_salto_real = _generar_secuencia_prueba(desplazamiento_y_tobillos=0.085, usar_pixeles=False)
res_real = calcular_salto_vertical(frames_salto_real)
assert res_real["tiempo_vuelo_segundos"] > 0.40, f"Tiempo de vuelo inesperado: {res_real['tiempo_vuelo_segundos']}"
assert res_real["salto_vertical_cm"] > 25.0, f"Altura de salto inesperada: {res_real['salto_vertical_cm']}"
print(f"  ✅ Salto real validado correctamente: {res_real}")

print("\n🏆 MOTOR FÍSICO CON UMBRAL_DE_DESPEGUE (5%) VERIFICADO AL 100%")
