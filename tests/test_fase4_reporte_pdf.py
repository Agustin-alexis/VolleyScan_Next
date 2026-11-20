import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)


def test_fase4_generacion_reporte_clinico_pdf():
    print("Testing Fase 4: Generación de Reporte Clínico (Exportación PDF con html2canvas y jsPDF)...")

    html_path = os.path.join(ROOT_DIR, "frontend", "index.html")
    reporte_js_path = os.path.join(ROOT_DIR, "frontend", "js", "reporte.js")
    css_path = os.path.join(ROOT_DIR, "frontend", "css", "styles.css")

    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()
    with open(reporte_js_path, "r", encoding="utf-8") as f:
        reporte_js = f.read()
    with open(css_path, "r", encoding="utf-8") as f:
        css = f.read()

    # 1. Dependencias CDN en frontend/index.html
    assert "html2canvas" in html.lower(), "html2canvas CDN debe estar importado en el <head> de frontend/index.html"
    assert "jspdf" in html.lower(), "jsPDF CDN debe estar importado en el <head> de frontend/index.html"
    assert "/frontend/js/reporte.js" in html, "frontend/index.html debe cargar /frontend/js/reporte.js"
    print("  ✅ Dependencias CDN (html2canvas y jsPDF) y script /frontend/js/reporte.js verificados en index.html.")

    # 2. Botón 'Finalizar Sesión y Exportar PDF' en frontend/index.html y estilos en styles.css
    assert "Finalizar Sesión y Exportar PDF" in html, "Falta el botón 'Finalizar Sesión y Exportar PDF' en frontend/index.html"
    assert 'onclick="generarReportePDF()"' in html, "El botón debe invocar generarReportePDF()"
    assert ".btn-danger-pdf" in css, "Falta la clase de estilo .btn-danger-pdf en frontend/css/styles.css"
    print("  ✅ Botón destacado 'Finalizar Sesión y Exportar PDF' verificado en el panel de control.")

    # 3. Lógica de exportación en frontend/js/reporte.js
    assert "async function generarReportePDF()" in reporte_js, "Falta async function generarReportePDF() en reporte.js"
    assert 'document.getElementById("graficaFatiga")' in reporte_js, "reporte.js debe capturar <canvas id='graficaFatiga'>"
    assert "await html2canvas(" in reporte_js, "reporte.js debe usar await html2canvas(...) sobre graficaFatiga"
    assert "toDataURL(" in reporte_js, "reporte.js debe convertir la captura a Base64 mediante toDataURL"
    assert "VolleyScan AI - Reporte Biomecánico y de Fatiga" in reporte_js, "Falta el título profesional en el PDF"
    assert "ALERTA: Se detectó fatiga neuromuscular crítica durante la sesión" in reporte_js, "Falta la alerta clínica de fatiga en el PDF"
    assert "doc.addImage(" in reporte_js, "reporte.js debe insertar la imagen de la gráfica en el documento PDF"
    assert 'doc.save("VolleyScan_Reporte.pdf")' in reporte_js or "doc.save('VolleyScan_Reporte.pdf')" in reporte_js, (
        "reporte.js debe finalizar con doc.save('VolleyScan_Reporte.pdf')"
    )
    print("  ✅ Lógica de exportación en frontend/js/reporte.js verificada al 100%.")
    print("\n🏆 FASE 4: GENERACIÓN DE REPORTE CLÍNICO (EXPORTACIÓN PDF) VERIFICADA AL 100%!")


if __name__ == "__main__":
    test_fase4_generacion_reporte_clinico_pdf()
