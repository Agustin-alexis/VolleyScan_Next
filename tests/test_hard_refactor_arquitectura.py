"""
Suite de Validación: Hard Refactor a Arquitectura Limpia y Modular.
Verifica:
  1. Destrucción de los monolitos (`evaluador_fases.py`, `analisis_continuo.py`, `app.js`).
  2. Cerebro Modular del Backend (`1_clasificador_gestos.py`, `2_motor_fisico.py`, `3_coach_experto.py`, `pipeline_principal.py`).
  3. Lógica Desacoplada del Frontend (`red_websocket.js`, `ui_visor3d.js`, `ui_dashboard.js`, `asistente_voz.js`).
  4. Estilos Independientes del Frontend (`layout_grid.css`, `componentes.css`).
"""

import importlib
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.biomecanica.pipeline_principal import (
    PipelineBiomecanicoPrincipal,
    ejecutar_pipeline_principal,
)

mod_1_clasificador = importlib.import_module("backend.biomecanica.1_clasificador_gestos")
mod_2_motor_fisico = importlib.import_module("backend.biomecanica.2_motor_fisico")
mod_3_coach_experto = importlib.import_module("backend.biomecanica.3_coach_experto")


def _crear_buffer_sintetico(
    despegue_norm: float,
    y_muneca_izq_t0: float,
    y_muneca_der_t0: float,
    ang_codo: float = 172.0,
    ang_rodilla: float = 105.0,
):
    """Construye una secuencia sintética de 33 frames procesados para pruebas del pipeline."""
    frames = []
    for idx in range(33):
        en_vuelo = 14 <= idx <= 26
        dy = despegue_norm if en_vuelo else 0.0
        y_tob = 0.85 - dy

        if idx == 20:
            ym_i = y_muneca_izq_t0
            ym_d = y_muneca_der_t0
        else:
            ym_i = 0.45
            ym_d = 0.45

        lm33 = [[0.5, 0.5, 0.0, 0.99] for _ in range(33)]
        lm33[0] = [0.5, 0.15 - dy, 0.0, 0.99]   # nariz
        lm33[11] = [0.4, 0.35 - dy, 0.0, 0.99]  # hombro_izq
        lm33[12] = [0.6, 0.35 - dy, 0.0, 0.99]  # hombro_der
        lm33[13] = [0.38, 0.30 - dy, 0.0, 0.99] # codo_izq
        lm33[14] = [0.62, 0.30 - dy, 0.0, 0.99] # codo_der
        lm33[15] = [0.42, ym_i, 0.0, 0.99]      # muneca_izq
        lm33[16] = [0.58, ym_d, 0.0, 0.99]      # muneca_der
        lm33[23] = [0.45, 0.55 - dy, 0.0, 0.99] # cadera_izq
        lm33[24] = [0.55, 0.55 - dy, 0.0, 0.99] # cadera_der
        lm33[27] = [0.45, y_tob, 0.0, 0.99]     # tobillo_izq
        lm33[28] = [0.55, y_tob, 0.0, 0.99]     # tobillo_der

        frames.append({
            "frame_id": 100 + idx,
            "timestamp": idx / 30.0,
            "index_en_secuencia": idx,
            "L_torso": 0.45,
            "landmarks_33": lm33,
            "puntos_3d_suaves": {
                "nariz": lm33[0][:3],
                "hombro_izq": lm33[11][:3],
                "hombro_der": lm33[12][:3],
                "codo_izq": lm33[13][:3],
                "codo_der": lm33[14][:3],
                "muneca_izq": lm33[15][:3],
                "muneca_der": lm33[16][:3],
                "cadera_izq": lm33[23][:3],
                "cadera_der": lm33[24][:3],
                "tobillo_izq": lm33[27][:3],
                "tobillo_der": lm33[28][:3],
            },
            "landmarks_2d_original": {
                "nariz": lm33[0][:3],
                "hombro_izq": lm33[11][:3],
                "hombro_der": lm33[12][:3],
                "muneca_izq": lm33[15][:3],
                "muneca_der": lm33[16][:3],
                "tobillo_izq": lm33[27][:3],
                "tobillo_der": lm33[28][:3],
            },
            "angulos_3d": {
                "rodilla": ang_rodilla if idx < 10 else 135.0,
                "rodilla_opuesta": 135.0,
                "cadera": 155.0,
                "codo": ang_codo if idx == 20 else 110.0,
                "codo_opuesto": ang_codo,
                "hombro": 155.0,
                "tronco": 8.0,
            },
            "cinematica": {
                "distancia_munecas_3d_m": 0.08 if ym_i > 0.40 and ym_d > 0.40 else 0.22,
                "velocidad_muneca_3d_ms": 2.4,
                "altura_centro_masa_rel": dy,
            },
        })
    return frames


def test_1_destruccion_de_monolitos():
    """Verifica que los monolitos antiguos fueron destruidos y reducidos a delegadores ligeros."""
    lineas_eval = len((ROOT / "backend" / "biomecanica" / "evaluador_fases.py").read_text(encoding="utf-8").splitlines())
    lineas_anal = len((ROOT / "backend" / "biomecanica" / "analisis_continuo.py").read_text(encoding="utf-8").splitlines())
    lineas_app = len((ROOT / "frontend" / "js" / "app.js").read_text(encoding="utf-8").splitlines())

    assert lineas_eval <= 60, f"evaluador_fases.py sigue siendo monolítico ({lineas_eval} líneas)"
    assert lineas_anal <= 50, f"analisis_continuo.py sigue siendo monolítico ({lineas_anal} líneas)"
    assert lineas_app <= 80, f"app.js sigue siendo monolítico ({lineas_app} líneas)"
    print(f"[OK] Monolitos destruidos -> evaluador_fases.py: {lineas_eval}L, analisis_continuo.py: {lineas_anal}L, app.js: {lineas_app}L")


def test_2_cerebro_modular_backend():
    """Verifica `1_clasificador_gestos.py`, `2_motor_fisico.py`, `3_coach_experto.py` y `pipeline_principal.py`."""
    # Caso A: Voleo (muñecas sobre hombros, sin salto significativo) -> 2_motor_fisico se salta y da 0.0 cm
    buf_voleo = _crear_buffer_sintetico(despegue_norm=0.015, y_muneca_izq_t0=0.22, y_muneca_der_t0=0.22)
    gesto_voleo = mod_1_clasificador.clasificar_gesto_t0(buf_voleo, t0_index=20)
    assert gesto_voleo == "Voleo", f"Esperado 'Voleo', obtenido '{gesto_voleo}'"

    salto_voleo = mod_2_motor_fisico.calcular_salto_vertical(buf_voleo, gesto_detectado=gesto_voleo)
    assert salto_voleo["salto_vertical_cm"] == 0.0, f"Voleo debe devolver 0.0 cm: {salto_voleo}"

    res_voleo = ejecutar_pipeline_principal(buf_voleo, t0_idx_relativo=20)
    assert res_voleo["gesto_detectado"] == "Voleo"
    assert res_voleo["metricas_fisicas"]["salto_vertical_cm"] == 0.0
    assert res_voleo["coach_voz_texto"].startswith("Detecté un Voleo.")
    assert "Tu salto fue de" not in res_voleo["coach_voz_texto"]

    # Caso B: Recepción (muñecas bajo hombros, sin salto) -> 0.0 cm
    buf_recep = _crear_buffer_sintetico(despegue_norm=0.01, y_muneca_izq_t0=0.48, y_muneca_der_t0=0.48)
    gesto_recep = mod_1_clasificador.clasificar_gesto_t0(buf_recep, t0_index=20)
    assert gesto_recep == "Recepción", f"Esperado 'Recepción', obtenido '{gesto_recep}'"
    res_recep = ejecutar_pipeline_principal(buf_recep, t0_idx_relativo=20)
    assert res_recep["gesto_detectado"] == "Recepción"
    assert res_recep["metricas_fisicas"]["salto_vertical_cm"] == 0.0
    assert res_recep["coach_voz_texto"].startswith("Detecté un Recepción.")
    assert "Tu salto fue de" not in res_recep["coach_voz_texto"]

    # Caso C: Remate (salto > 5% altura total, muñecas asimétricas) -> salto > 0 cm + 3 oraciones estrictas
    buf_remate = _crear_buffer_sintetico(despegue_norm=0.12, y_muneca_izq_t0=0.48, y_muneca_der_t0=0.08)
    gesto_remate = mod_1_clasificador.clasificar_gesto_t0(buf_remate, t0_index=20)
    assert gesto_remate == "Remate", f"Esperado 'Remate', obtenido '{gesto_remate}'"
    res_remate = ejecutar_pipeline_principal(buf_remate, t0_idx_relativo=20)
    assert res_remate["gesto_detectado"] == "Remate"
    assert res_remate["metricas_fisicas"]["salto_vertical_cm"] > 0.0
    assert res_remate["coach_voz_texto"].startswith("Detecté un Remate. Tu salto fue de ")
    assert "cm." in res_remate["coach_voz_texto"]
    assert len(res_remate["ventana_angulos_25"]) == 25
    assert all(len(fila) == 8 for fila in res_remate["ventana_angulos_25"])

    # Caso D: Verificación directa del deque de 25 frames de ángulos (`collections.deque(maxlen=25)`)
    from backend.biomecanica.buffer_temporal import BufferTemporalAngulos

    buf_ang_25 = BufferTemporalAngulos(maxlen=25)
    for f_item in buf_remate:
        buf_ang_25.agregar_frame(f_item)
    assert buf_ang_25.esta_lleno() and len(buf_ang_25.obtener_ventana_25()) == 25
    gesto_deque_25 = mod_1_clasificador.clasificar_ventana_25_frames(
        buf_ang_25.ventana_angulos,
        salto_vertical_cm=res_remate["metricas_fisicas"]["salto_vertical_cm"],
    )
    assert gesto_deque_25 == "Remate", f"Esperado 'Remate' desde deque(maxlen=25), obtenido '{gesto_deque_25}'"

    # Caso E: Filtros heurísticos de descarte rápido -> 'Gesto no válido'
    # 1) Tobillos tocando el suelo anulan 'Remate' -> 'Gesto no válido'
    buf_remate_en_suelo = _crear_buffer_sintetico(despegue_norm=0.005, y_muneca_izq_t0=0.48, y_muneca_der_t0=0.08)
    gesto_remate_suelo = mod_1_clasificador.clasificar_ventana_25_frames(buf_remate_en_suelo, t0_index=20)
    assert gesto_remate_suelo == "Gesto no válido", f"Esperado 'Gesto no válido' por tobillos en suelo, obtenido '{gesto_remate_suelo}'"

    # 2) Muñecas por debajo de la línea de los hombros anulan 'Voleo' -> 'Gesto no válido'
    gesto_voleo_bajo = mod_1_clasificador.clasificar_ventana_25_frames(
        buf_recep,
        t0_index=20,
        gesto_solicitado="voleo",
    )
    assert gesto_voleo_bajo == "Gesto no válido", f"Esperado 'Gesto no válido' por muñecas bajo hombros en Voleo, obtenido '{gesto_voleo_bajo}'"

    print(f"[OK] Cerebro Modular Backend + Deque 25 Frames + Heurísticas verificado (Voleo=0cm, Recepción=0cm, Remate={res_remate['metricas_fisicas']['salto_vertical_cm']}cm)")


def test_3_estructura_frontend_desacoplada():
    """Verifica la existencia y el contenido de los archivos JS y CSS independientes."""
    archivos_js = [
        ROOT / "frontend" / "js" / "red_websocket.js",
        ROOT / "frontend" / "js" / "ui_visor3d.js",
        ROOT / "frontend" / "js" / "ui_dashboard.js",
        ROOT / "frontend" / "js" / "asistente_voz.js",
    ]
    for ruta in archivos_js:
        assert ruta.exists(), f"Falta archivo JS modular: {ruta}"

    # 1. asistente_voz.js: exclusivo para speechSynthesis con .cancel() obligatorio
    txt_voz = (ROOT / "frontend" / "js" / "asistente_voz.js").read_text(encoding="utf-8")
    assert "window.speechSynthesis.cancel()" in txt_voz
    assert "window.speechSynthesis.speak(" in txt_voz

    # 2. ui_visor3d.js: escalado 640x480 garantizado
    txt_visor = (ROOT / "frontend" / "js" / "ui_visor3d.js").read_text(encoding="utf-8")
    assert "640" in txt_visor and "480" in txt_visor
    assert "dibujarEsqueletoCompleto" in txt_visor

    # 3. ui_dashboard.js: manipulación DOM e insignias de cm
    txt_dash = (ROOT / "frontend" / "js" / "ui_dashboard.js").read_text(encoding="utf-8")
    assert "badgeSaltoVerticalCm" in txt_dash
    assert "actualizarDashboard" in txt_dash

    # 4. red_websocket.js: conexión ws:// y despacho JSON
    txt_ws = (ROOT / "frontend" / "js" / "red_websocket.js").read_text(encoding="utf-8")
    assert "new WebSocket(" in txt_ws
    assert "JSON.parse(" in txt_ws

    # 5. CSS independientes: layout_grid.css y componentes.css
    ruta_grid = ROOT / "frontend" / "css" / "layout_grid.css"
    ruta_comp = ROOT / "frontend" / "css" / "componentes.css"
    assert ruta_grid.exists(), "Falta frontend/css/layout_grid.css"
    assert ruta_comp.exists(), "Falta frontend/css/componentes.css"

    txt_grid = ruta_grid.read_text(encoding="utf-8")
    assert "display: grid" in txt_grid
    assert "grid-template-columns: minmax(300px, 640px) 1fr" in txt_grid

    txt_comp = ruta_comp.read_text(encoding="utf-8")
    assert ".vs-fase-card" in txt_comp
    assert ".btn-primary-cyan" in txt_comp

    # 6. index.html enlaza los nuevos CSS y JS
    txt_html = (ROOT / "frontend" / "index.html").read_text(encoding="utf-8")
    assert "/frontend/css/layout_grid.css" in txt_html
    assert "/frontend/css/componentes.css" in txt_html
    assert "/frontend/js/asistente_voz.js" in txt_html
    assert "/frontend/js/ui_visor3d.js" in txt_html
    assert "/frontend/js/ui_dashboard.js" in txt_html
    assert "/frontend/js/red_websocket.js" in txt_html

    print("[OK] Frontend JS (4 módulos) y CSS (layout_grid.css + componentes.css) verificados al 100%")


if __name__ == "__main__":
    test_1_destruccion_de_monolitos()
    test_2_cerebro_modular_backend()
    test_3_estructura_frontend_desacoplada()
    print("\n=== TODOS LOS TESTS DEL HARD REFACTOR PASARON EXITOSAMENTE ===")
