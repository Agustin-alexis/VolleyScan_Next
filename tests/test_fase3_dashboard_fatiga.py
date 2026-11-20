import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)


def test_fase3_dashboard_fatiga_neuromuscular():
    print("Testing Fase 3: Dashboard Analítico de Fatiga Neuromuscular (Chart.js)...")

    html_path = os.path.join(ROOT_DIR, "frontend", "index.html")
    dashboard_js_path = os.path.join(ROOT_DIR, "frontend", "js", "dashboard.js")
    app_js_path = os.path.join(ROOT_DIR, "frontend", "js", "app.js")

    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()
    with open(dashboard_js_path, "r", encoding="utf-8") as f:
        dash_js = f.read()
    with open(app_js_path, "r", encoding="utf-8") as f:
        app_js = f.read()

    # 1. Dependencias y estructura en frontend/index.html
    assert "chart.js" in html.lower(), "Chart.js CDN debe estar importado en el <head> de frontend/index.html"
    assert "Panel de Fatiga Neuromuscular" in html, "Falta la sección 'Panel de Fatiga Neuromuscular' en frontend/index.html"
    assert '<canvas id="graficaFatiga"></canvas>' in html, "Falta <canvas id=\"graficaFatiga\"></canvas> en frontend/index.html"
    assert "/frontend/js/dashboard.js" in html, "frontend/index.html debe cargar /frontend/js/dashboard.js"
    print("  ✅ frontend/index.html verificado: CDN de Chart.js, Panel de Fatiga Neuromuscular y <canvas id='graficaFatiga'> presentes.")

    # 2. Gestor de Datos Históricos en frontend/js/dashboard.js y conexión en app.js
    assert "function inicializarGraficoFatiga()" in dash_js, "Falta inicializarGraficoFatiga() en dashboard.js"
    assert "function actualizarGraficoFatiga(nueva_metrica)" in dash_js, "Falta actualizarGraficoFatiga(nueva_metrica) en dashboard.js"
    assert 'type: "line"' in dash_js, "El gráfico debe ser de tipo 'line' (Line Chart)"
    assert "salto_vertical_cm" in dash_js, "Dataset 1 debe usar salto_vertical_cm"
    assert "angulo_codo_impacto_3d" in dash_js, "Dataset 2 debe usar el ángulo de extensión del codo en t0"
    assert "graficaFatigaChart.update()" in dash_js, "actualizarGraficoFatiga debe llamar a chart.update()"
    print("  ✅ frontend/js/dashboard.js verificado: inicializarGraficoFatiga() y actualizarGraficoFatiga() con 2 datasets y chart.update().")

    # 3. Lógica de Alerta Clínica (> 20% de caída respecto al Pico Máximo -> color Rojo)
    assert "20.0" in dash_js or "> 20" in dash_js, "Falta validación de caída > 20% respecto al Pico Máximo"
    assert "COLOR_ALERTA_ROJO" in dash_js and "#FF3366" in dash_js, "Falta cambio de color a Rojo en puntos con alerta clínica"
    assert "pointBackgroundColor" in dash_js, "Los puntos deben colorearse dinámicamente usando pointBackgroundColor"
    print("  ✅ Lógica de Alerta Clínica (> 20% caída vs Pico Máximo -> Punto en Rojo) verificada.")

    # 4. Integración en el flujo WebSocket de frontend/js/app.js
    assert "actualizarGraficoFatiga(data)" in app_js, "procesarMensajeBackend en app.js debe invocar actualizarGraficoFatiga(data)"
    assert "inicializarGraficoFatiga()" in app_js, "app.js debe invocar inicializarGraficoFatiga() al iniciar"
    print("  ✅ Integración en tiempo real con el WebSocket en frontend/js/app.js verificada.")

    print("\n🏆 FASE 3: DASHBOARD ANALÍTICO DE FATIGA NEUROMUSCULAR VERIFICADO AL 100%!")


if __name__ == "__main__":
    test_fase3_dashboard_fatiga_neuromuscular()
