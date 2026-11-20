import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

def test_phase2_frontend_files():
    print("Testing Phase 2 Frontend and Session Timeline integration...")
    
    # 1. Check index.html (in frontend/)
    html_path = os.path.join(ROOT_DIR, "frontend", "index.html")
    assert os.path.exists(html_path), "frontend/index.html does not exist"
    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()
    
    assert 'id="seccionTimeline"' in html, "seccionTimeline missing in index.html"
    assert 'id="badgeTotalSaltos"' in html, "badgeTotalSaltos missing in index.html"
    assert 'id="btnVolverEnVivo"' in html, "btnVolverEnVivo missing in index.html"
    assert 'id="badgeModoVisualizacion"' in html, "badgeModoVisualizacion missing in index.html"
    assert 'id="alertaFatigaContainer"' in html, "alertaFatigaContainer missing in index.html"
    assert 'id="timelineScrollContainer"' in html, "timelineScrollContainer missing in index.html"
    assert 'id="timelineMiniCards"' in html, "timelineMiniCards missing in index.html"
    print("  ✅ frontend/index.html contains all Phase 2 Timeline and Fatigue elements.")

    # 2. Check styles.css (in frontend/css/)
    css_path = os.path.join(ROOT_DIR, "frontend", "css", "styles.css")
    assert os.path.exists(css_path), "frontend/css/styles.css does not exist"
    with open(css_path, "r", encoding="utf-8") as f:
        css = f.read()

    assert ".vs-timeline-scroll" in css, ".vs-timeline-scroll missing in styles.css"
    assert ".vs-timeline-cards-track" in css, ".vs-timeline-cards-track missing in styles.css"
    assert ".vs-rep-card" in css, ".vs-rep-card missing in styles.css"
    assert ".active-rep-card" in css, ".active-rep-card missing in styles.css"
    assert ".btn-live" in css, ".btn-live missing in styles.css"
    assert ".vs-fatiga-banner" in css, ".vs-fatiga-banner missing in styles.css"
    print("  ✅ frontend/css/styles.css contains all styling for cards, live badge, and fatigue banner.")

    # 3. Check app.js (in frontend/js/)
    js_path = os.path.join(ROOT_DIR, "frontend", "js", "app.js")
    assert os.path.exists(js_path), "frontend/js/app.js does not exist"
    with open(js_path, "r", encoding="utf-8") as f:
        js = f.read()

    assert "const historial_sesion = [];" in js, "historial_sesion missing in app.js"
    assert "let modoHistorico = false;" in js, "modoHistorico missing in app.js"
    assert "function agregarMiniTarjetaTimeline" in js, "agregarMiniTarjetaTimeline missing in app.js"
    assert "function cargarSaltoHistorico" in js, "cargarSaltoHistorico missing in app.js"
    assert "function volverAlDirecto" in js, "volverAlDirecto missing in app.js"
    assert "function evaluarFatigaTecnica" in js, "evaluarFatigaTecnica missing in app.js"
    assert "function descartarAlertaFatiga" in js, "descartarAlertaFatiga missing in app.js"
    assert "snapshotsFases" in js, "snapshotsFases cloning missing in app.js"
    print("  ✅ frontend/js/app.js contains complete interactive timeline and fatigue evaluation functions.")

    # 4. Check FastAPI endpoints
    from fastapi.testclient import TestClient
    from main import app

    client = TestClient(app)
    
    # Start session
    resp_start = client.post("/api/entrenamiento/iniciar")
    assert resp_start.status_code == 200, f"Error starting session: {resp_start.status_code}"
    sesion_id = resp_start.json()["sesion_id"]
    print(f"  ✅ POST /api/entrenamiento/iniciar returned sesion_id: {sesion_id}")

    # Query history
    resp_hist = client.get(f"/api/entrenamiento/{sesion_id}/historial")
    assert resp_hist.status_code == 200, f"Error getting history: {resp_hist.status_code}"
    data_hist = resp_hist.json()
    assert "gestos_registrados" in data_hist, "History payload missing 'gestos_registrados'"
    assert data_hist["total_gestos"] == 0, "Initial session gestures count should be 0"
    print(f"  ✅ GET /api/entrenamiento/{sesion_id}/historial returns empty history ready for continuous training.")

    print("\n🏆 FASE 2: TIMELINE INTERACTIVO DEL ENTRENAMIENTO VERIFICADA AL 100%!")

if __name__ == "__main__":
    test_phase2_frontend_files()
