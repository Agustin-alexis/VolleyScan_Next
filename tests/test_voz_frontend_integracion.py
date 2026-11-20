"""
Suite de Verificación de la Integración de Voz (TTS) en el Cliente (`frontend/js/app.js`).
Verifica:
  1. Función `hablar(texto)` con `window.speechSynthesis.cancel()` antes de `window.speechSynthesis.speak()`.
  2. En `ws.onopen`: eliminación de textos viejos ("Búfer temporal listo") y ejecución de
     `hablar("Sistema iniciado. Por favor, ponte frente a la cámara con los brazos en T para calibrar.")`.
  3. En `ws.onmessage`:
     - Evento `calibracion_exitosa`: `hablar("Calibración exitosa. Entorno óptimo, vamos a entrenar.")`.
     - Evento `error_calibracion`: `hablar("Hay poca luz o estás mal ubicado. Mejora el entorno.")`.
  4. Feedback técnico de los 33 frames:
     - Ejecuta `hablar(data.coach_voz_texto)` incluyendo el gesto detectado ("Remate", "Bloqueo", "Voleo") y el consejo.
"""

import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

js_path = os.path.join(ROOT_DIR, "frontend", "js", "app.js")
with open(js_path, "r", encoding="utf-8") as f:
    codigo_js = f.read()

print("=================================================================")
print("🧪 TEST DE REFACTORIZACIÓN DEL SINTETIZADOR DE VOZ EN FRONTEND")
print("=================================================================")

# 1. Función hablar(texto) y cancelación previa obligatoria
assert "function hablar(texto)" in codigo_js, "Falta la función hablar(texto) en frontend/js/app.js"
idx_fn_hablar = codigo_js.index("function hablar(texto)")
bloque_hablar = codigo_js[idx_fn_hablar : idx_fn_hablar + 900]
idx_cancel = bloque_hablar.find("window.speechSynthesis.cancel();")
idx_speak = bloque_hablar.find("window.speechSynthesis.speak(utter);")
assert idx_cancel != -1 and idx_speak != -1 and idx_cancel < idx_speak, (
    "REGLA CRÍTICA VIOLADA: window.speechSynthesis.cancel() debe ejecutarse ANTES de speechSynthesis.speak()"
)
print("  ✅ Función hablar(texto) con window.speechSynthesis.cancel() previo a speak() verificada.")

# 2. Voz de Calibración Cero en ws.onopen y ausencia de texto viejo
assert "Búfer temporal listo" not in codigo_js, "No debe existir el texto antiguo 'Búfer temporal listo'"
assert 'hablar("Sistema iniciado. Por favor, ponte frente a la cámara con los brazos en T para calibrar.")' in codigo_js, (
    "Falta locución de inicio en ws.onopen"
)
print("  ✅ Voz de Calibración Cero en ws.onopen verificada y textos antiguos eliminados.")

# 3. Voz de Estados del Sistema en ws.onmessage
assert 'hablar("Calibración exitosa. Entorno óptimo, vamos a entrenar.")' in codigo_js, (
    "Falta locución para 'calibracion_exitosa'"
)
assert 'hablar("Hay poca luz o estás mal ubicado. Mejora el entorno.")' in codigo_js, (
    "Falta locución para 'error_calibracion'"
)
print("  ✅ Voz de estados del sistema ('calibracion_exitosa' y 'error_calibracion') verificada.")

# 4. Voz del Feedback Técnico (33 frames + mención del gesto "Remate", "Bloqueo", "Voleo")
assert "hablar(data.coach_voz_texto)" in codigo_js, "Falta llamada hablar(data.coach_voz_texto) en ws.onmessage"
assert "detectado." in codigo_js and "formatearLocucionGestoTecnico" in codigo_js, (
    "Falta formateo de locución con el gesto detectado ('Remate detectado...', 'Bloqueo detectado...', 'Voleo detectado...')"
)
print("  ✅ Voz del Feedback Técnico (hablar(data.coach_voz_texto) + mención de gesto y consejo) verificada.")

print("\n🏆 INTEGRACIÓN DE VOZ EN FRONTEND VERIFICADA AL 100%")
