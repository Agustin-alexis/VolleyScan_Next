"use client";

import { SettingSelect, SettingToggle } from "./ControlesConfig";

export default function SeccionAnalisis({ analisis, setAnalisis }) {
    return (
        <section className="config-section active">
            <h2 className="config-section__title">Análisis</h2>

            <SettingToggle label="Detección de pose en tiempo real"
                desc="Muestra el esqueleto de pose mientras grabas"
                checked={analisis.pose}
                onChange={(v) => setAnalisis((a) => ({ ...a, pose: v }))} />

            <SettingToggle label="Alertas de errores durante el análisis"
                desc="Resalta en rojo las articulaciones con error"
                checked={analisis.alertas}
                onChange={(v) => setAnalisis((a) => ({ ...a, alertas: v }))} />

            <SettingToggle label="Análisis automático al subir video"
                desc="Procesa el video sin confirmación adicional"
                checked={analisis.automatico}
                onChange={(v) => setAnalisis((a) => ({ ...a, automatico: v }))} />

            <SettingSelect label="Sensibilidad de detección" id="sensibilidad"
                value={analisis.sensibilidad}
                onChange={(v) => setAnalisis((a) => ({ ...a, sensibilidad: v }))}
                options={[
                    { value: "alta", label: "Alta (más errores detectados)" },
                    { value: "media", label: "Media (recomendado)" },
                    { value: "baja", label: "Baja (solo errores críticos)" },
                ]} />

            <p className="setting-desc" style={{ marginTop: 16 }}>
                Estos ajustes se aplican mientras la página esté abierta.
            </p>
        </section>
    );
}