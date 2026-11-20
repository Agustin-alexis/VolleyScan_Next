"""
Suite de Auditoría Estricta (Static Analysis y Refinamiento para Producción).
Verifica:
  1. PREVENCIÓN DE COLAPSOS EN BACKEND:
     - Tipado estricto (Type Hints) en todas las funciones principales de `1_clasificador_gestos.py`,
       `2_motor_fisico.py`, `3_coach_experto.py`, `pipeline_principal.py` y `router.py`.
     - Resiliencia ante entradas vacías o corruptas (fuzzing de frames corruptos).
     - Bloques `try/except` robustos para `WebSocketDisconnect` y `JSONDecodeError` en `router.py`.
  2. INTEGRIDAD DEL FRONTEND Y MEMORIA:
     - Resolución exacta de todos los ES Modules (`import { ... } from './...'`) sin errores 404.
     - Liberación explícita de listeners WebSocket, timers y memoria de Canvas/Utterance.
  3. LIMPIEZA DE CÓDIGO (Sanitización):
     - Cero `print()` de depuración en los módulos backend auditados.
     - Cero `console.log()` de depuración en los módulos frontend auditados.
"""

import ast
import importlib
import re
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

mod_1 = importlib.import_module("backend.biomecanica.1_clasificador_gestos")
mod_2 = importlib.import_module("backend.biomecanica.2_motor_fisico")
mod_3 = importlib.import_module("backend.biomecanica.3_coach_experto")
from backend.biomecanica.pipeline_principal import ejecutar_pipeline_principal


def test_1_tipado_estricto_y_resiliencia_backend() -> None:
    """Verifica Type Hints mediante AST y resiliencia ante frames corruptos."""
    archivos_backend = [
        ROOT / "backend" / "biomecanica" / "1_clasificador_gestos.py",
        ROOT / "backend" / "biomecanica" / "2_motor_fisico.py",
        ROOT / "backend" / "biomecanica" / "3_coach_experto.py",
        ROOT / "backend" / "biomecanica" / "pipeline_principal.py",
        ROOT / "backend" / "api" / "router.py",
    ]

    for ruta in archivos_backend:
        codigo = ruta.read_text(encoding="utf-8")
        arbol = ast.parse(codigo, filename=str(ruta))
        for nodo in ast.walk(arbol):
            if isinstance(nodo, (ast.FunctionDef, ast.AsyncFunctionDef)):
                assert nodo.returns is not None, (
                    f"La función '{nodo.name}' en {ruta.name} carece de anotación de retorno (Type Hint)"
                )

    # Verificar manejo robusto de WebSocketDisconnect y JSONDecodeError en router.py
    codigo_router = (ROOT / "backend" / "api" / "router.py").read_text(encoding="utf-8")
    assert "except WebSocketDisconnect:" in codigo_router
    assert "json.JSONDecodeError" in codigo_router

    # Fuzzing de entradas corruptas o vacías: ninguna función debe colapsar
    entradas_corruptas = [
        None,
        [],
        [{}],
        [{"landmarks_33": "corrupto", "angulos_3d": None, "timestamp": "invalido"}],
        [{"puntos": {"muneca_izq": ["x_malo", None]}} for _ in range(10)],
    ]
    for entrada in entradas_corruptas:
        gesto = mod_1.clasificar_gesto_t0(entrada)
        assert gesto in ("Remate", "Voleo", "Recepción", "Bloqueo", "Saque", "Gesto no válido")

        salto = mod_2.calcular_salto_vertical(entrada if isinstance(entrada, list) else [])
        assert isinstance(salto, dict) and salto["salto_vertical_cm"] == 0.0

        res_pipe = ejecutar_pipeline_principal(entrada if isinstance(entrada, list) else [])
        assert isinstance(res_pipe, dict)


def test_2_integridad_es_modules_y_memoria_frontend() -> None:
    """Verifica rutas de importación ES6 y mecanismos anti-Memory-Leak en JS."""
    dir_js = ROOT / "frontend" / "js"
    archivos_js = [
        dir_js / "red_websocket.js",
        dir_js / "ui_visor3d.js",
        dir_js / "ui_dashboard.js",
        dir_js / "asistente_voz.js",
        dir_js / "app.js",
    ]

    patron_import = re.compile(r'from\s+["\'](\./[^"\']+\.js)["\']')

    for ruta_js in archivos_js:
        assert ruta_js.exists(), f"No existe archivo JS: {ruta_js}"
        contenido = ruta_js.read_text(encoding="utf-8")
        for match in patron_import.finditer(contenido):
            rel_path = match.group(1)
            destino = (ruta_js.parent / rel_path).resolve()
            assert destino.exists(), f"Import roto (404) en {ruta_js.name}: '{rel_path}' -> {destino}"

    # Verificar prevención de Memory Leaks en red_websocket.js
    txt_ws = (dir_js / "red_websocket.js").read_text(encoding="utf-8")
    assert "ws.onopen = null" in txt_ws
    assert "ws.onmessage = null" in txt_ws
    assert "clearTimeout(timerReconexion)" in txt_ws

    # Verificar liberación de canvas en ui_visor3d.js
    txt_visor = (dir_js / "ui_visor3d.js").read_text(encoding="utf-8")
    assert "canvasSnapshot.width = 0" in txt_visor

    # Verificar liberación de utterance y .cancel() en asistente_voz.js
    txt_voz = (dir_js / "asistente_voz.js").read_text(encoding="utf-8")
    assert "window.speechSynthesis.cancel()" in txt_voz
    assert "utteranceActual.onend = null" in txt_voz


def test_3_sanitizacion_sin_prints_ni_console_log() -> None:
    """Verifica que no existan print() ni console.log() de depuración residuales."""
    archivos_py = [
        ROOT / "backend" / "biomecanica" / "1_clasificador_gestos.py",
        ROOT / "backend" / "biomecanica" / "2_motor_fisico.py",
        ROOT / "backend" / "biomecanica" / "3_coach_experto.py",
        ROOT / "backend" / "biomecanica" / "pipeline_principal.py",
        ROOT / "backend" / "biomecanica" / "evaluador_fases.py",
        ROOT / "backend" / "biomecanica" / "analisis_continuo.py",
        ROOT / "backend" / "biomecanica" / "orquestador.py",
        ROOT / "backend" / "api" / "router.py",
    ]
    for ruta_py in archivos_py:
        arbol = ast.parse(ruta_py.read_text(encoding="utf-8"), filename=str(ruta_py))
        for nodo in ast.walk(arbol):
            if isinstance(nodo, ast.Call) and isinstance(nodo.func, ast.Name) and nodo.func.id == "print":
                raise AssertionError(f"Se encontró un print() residual en {ruta_py.name} (línea {nodo.lineno})")

    archivos_js = [
        ROOT / "frontend" / "js" / "red_websocket.js",
        ROOT / "frontend" / "js" / "ui_visor3d.js",
        ROOT / "frontend" / "js" / "ui_dashboard.js",
        ROOT / "frontend" / "js" / "asistente_voz.js",
        ROOT / "frontend" / "js" / "app.js",
    ]
    for ruta_js in archivos_js:
        txt = ruta_js.read_text(encoding="utf-8")
        assert "console.log(" not in txt, f"Se encontró console.log() residual en {ruta_js.name}"


if __name__ == "__main__":
    test_1_tipado_estricto_y_resiliencia_backend()
    test_2_integridad_es_modules_y_memoria_frontend()
    test_3_sanitizacion_sin_prints_ni_console_log()
    print("AUDITORIA_PRODUCCION_OK")
