"""
Suite de Verificación de la Refactorización Modular Estricta:
1. Backend:
   - `backend/biomecanica/clasificador_gestos.py`
   - `backend/biomecanica/motor_salto.py`
   - `backend/biomecanica/orquestador.py` (con Cortafuegos Lógicos: Voleo/Recepción puentea motor_salto -> 0 cm; Remate/Bloqueo invoca motor_salto).
2. Frontend:
   - `frontend/js/modules/voz.js` (`export function reproducirVoz(texto)` con `.cancel()` antes de `.speak()`)
   - `frontend/js/modules/ui_manager.js`
   - `frontend/js/modules/websocket_client.js`
   - Importación como `<script type="module" src="...">` en `frontend/index.html`.
3. CSS Grid Dedicado:
   - `frontend/css/layout.css` con `.top-dashboard { display: grid; grid-template-columns: minmax(300px, 640px) 1fr; gap: 2rem; align-items: start; }`.
"""

import os
import sys
from unittest.mock import patch

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.biomecanica import clasificador_gestos, motor_salto, orquestador
from tests.test_pasos3_4_clasificador_y_voz import _crear_buffer_prueba


def test_modularizacion_completa():
    print("=================================================================")
    print("🧪 VERIFICACIÓN DE ARQUITECTURA MODULAR Y CORTAFUEGOS LÓGICOS")
    print("=================================================================")

    # 1. VERIFICAR BACKEND: clasificador_gestos.py, motor_salto.py, orquestador.py
    print("\n[1] Verificando módulos del Backend y Cortafuegos Lógicos en orquestador.py...")
    buf_voleo = _crear_buffer_prueba(y_muneca_izq_t0=0.18, y_muneca_der_t0=0.19, con_salto=False, dist_munecas=0.20)
    buf_recep = _crear_buffer_prueba(y_muneca_izq_t0=0.52, y_muneca_der_t0=0.52, con_salto=False, dist_munecas=0.08)
    buf_remate = _crear_buffer_prueba(y_muneca_izq_t0=0.52, y_muneca_der_t0=0.12, con_salto=True, dist_munecas=0.45)
    buf_bloqueo = _crear_buffer_prueba(y_muneca_izq_t0=0.14, y_muneca_der_t0=0.16, con_salto=True, dist_munecas=0.24)

    # Verificar clasificador_gestos
    assert clasificador_gestos.clasificar_gesto_tecnico(buf_voleo) == "Voleo"
    assert clasificador_gestos.clasificar_gesto_tecnico(buf_recep) == "Recepción"
    assert clasificador_gestos.clasificar_gesto_tecnico(buf_remate) == "Remate"
    assert clasificador_gestos.clasificar_gesto_tecnico(buf_bloqueo) == "Bloqueo"
    print("  ✅ clasificador_gestos.py clasifica geométricamente Voleo, Recepción, Remate y Bloqueo.")

    # Verificar Cortafuegos Lógico en orquestador.py:
    # Cuando es Voleo o Recepción, NO debe invocar a motor_salto.calcular_salto_vertical y debe asignar 0.0 cm
    with patch.object(motor_salto, "calcular_salto_vertical", wraps=motor_salto.calcular_salto_vertical) as spy_salto:
        res_vol = orquestador.OrquestadorBiomecanico.procesar_secuencia(buf_voleo, t0_idx_relativo=20)
        assert spy_salto.call_count == 0, "ERROR: motor_salto NO debía invocarse para 'Voleo'"
        assert res_vol["gesto_detectado"] == "Voleo"
        assert res_vol["metricas_fisicas"]["salto_vertical_cm"] == 0.0

        res_rec = orquestador.OrquestadorBiomecanico.procesar_secuencia(buf_recep, t0_idx_relativo=20)
        assert spy_salto.call_count == 0, "ERROR: motor_salto NO debía invocarse para 'Recepción'"
        assert res_rec["gesto_detectado"] == "Recepción"
        assert res_rec["metricas_fisicas"]["salto_vertical_cm"] == 0.0
    print("  ✅ Cortafuegos Lógico verificado: 'Voleo' y 'Recepción' puentean motor_salto (0.0 cm).")

    # Cuando es Remate o Bloqueo, SÍ debe invocar a motor_salto.calcular_salto_vertical
    with patch.object(motor_salto, "calcular_salto_vertical", wraps=motor_salto.calcular_salto_vertical) as spy_salto:
        res_rem = orquestador.OrquestadorBiomecanico.procesar_secuencia(buf_remate, t0_idx_relativo=20)
        assert spy_salto.call_count == 1, "ERROR: motor_salto DEBÍA invocarse para 'Remate'"
        assert res_rem["gesto_detectado"] == "Remate"
        assert res_rem["metricas_fisicas"]["salto_vertical_cm"] > 0.0

        res_blk = orquestador.OrquestadorBiomecanico.procesar_secuencia(buf_bloqueo, t0_idx_relativo=20)
        assert spy_salto.call_count == 2, "ERROR: motor_salto DEBÍA invocarse para 'Bloqueo'"
        assert res_blk["gesto_detectado"] == "Bloqueo"
        assert res_blk["metricas_fisicas"]["salto_vertical_cm"] > 0.0
    print(
        f"  ✅ Cortafuegos Lógico verificado: 'Remate' ({res_rem['metricas_fisicas']['salto_vertical_cm']} cm) "
        f"y 'Bloqueo' ({res_blk['metricas_fisicas']['salto_vertical_cm']} cm) invocan motor_salto."
    )

    # 2. VERIFICAR FRONTEND MODULAR (`frontend/js/modules/`)
    print("\n[2] Verificando módulos ES6 en frontend/js/modules/ e index.html...")
    voz_path = os.path.join(ROOT_DIR, "frontend", "js", "modules", "voz.js")
    ui_path = os.path.join(ROOT_DIR, "frontend", "js", "modules", "ui_manager.js")
    ws_path = os.path.join(ROOT_DIR, "frontend", "js", "modules", "websocket_client.js")
    html_path = os.path.join(ROOT_DIR, "frontend", "index.html")

    assert os.path.isfile(voz_path), "Falta frontend/js/modules/voz.js"
    assert os.path.isfile(ui_path), "Falta frontend/js/modules/ui_manager.js"
    assert os.path.isfile(ws_path), "Falta frontend/js/modules/websocket_client.js"

    with open(voz_path, "r", encoding="utf-8") as f:
        voz_js = f.read()
    assert "export function reproducirVoz(" in voz_js, "voz.js debe exportar reproducirVoz(texto)"
    pos_cancel = voz_js.find("window.speechSynthesis.cancel()")
    pos_speak = voz_js.find("window.speechSynthesis.speak(")
    assert pos_cancel != -1 and pos_speak != -1 and pos_cancel < pos_speak
    print("  ✅ frontend/js/modules/voz.js exporta reproducirVoz(texto) con .cancel() antes de .speak().")

    with open(ui_path, "r", encoding="utf-8") as f:
        ui_js = f.read()
    assert "export function renderizarSecuenciaCompleta4Fases" in ui_js
    assert "export function actualizarUICalibracion" in ui_js
    print("  ✅ frontend/js/modules/ui_manager.js encapsula la manipulación del DOM.")

    with open(ws_path, "r", encoding="utf-8") as f:
        ws_js = f.read()
    assert 'from "./ui_manager.js"' in ws_js
    assert 'from "./voz.js"' in ws_js
    assert "export async function conectarWebSocket" in ws_js
    print("  ✅ frontend/js/modules/websocket_client.js invoca desacopladamente a ui_manager.js y voz.js.")

    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()
    assert '<script type="module" src="/frontend/js/modules/voz.js"></script>' in html
    assert '<script type="module" src="/frontend/js/modules/ui_manager.js"></script>' in html
    assert '<script type="module" src="/frontend/js/modules/websocket_client.js"></script>' in html
    print("  ✅ frontend/index.html importa los scripts como módulos ES6 (<script type=\"module\">).")

    # 3. VERIFICAR CSS GRID DEDICADO (`frontend/css/layout.css`)
    print("\n[3] Verificando frontend/css/layout.css y cuadrícula .top-dashboard...")
    layout_path = os.path.join(ROOT_DIR, "frontend", "css", "layout.css")
    assert os.path.isfile(layout_path), "Falta frontend/css/layout.css"
    with open(layout_path, "r", encoding="utf-8") as f:
        layout_css = f.read()

    assert ".top-dashboard" in layout_css
    assert "display: grid;" in layout_css
    assert "grid-template-columns: minmax(300px, 640px) 1fr;" in layout_css
    assert "gap: 2rem;" in layout_css
    assert "align-items: start;" in layout_css
    assert '/frontend/css/layout.css' in html
    assert 'top-dashboard' in html
    print("  ✅ frontend/css/layout.css define .top-dashboard con CSS Grid estricto (minmax(300px, 640px) 1fr).")

    print("\n🏆 REFACTORIZACIÓN MODULAR COMPLETA VERIFICADA AL 100%")


if __name__ == "__main__":
    test_modularizacion_completa()
