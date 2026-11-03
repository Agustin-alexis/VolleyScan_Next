"use client";

import {
    SettingSelect,
    SettingToggle,
    AccionesFormulario,
    VISIBILIDAD,
} from "./ControlesConfig";

export default function SeccionPrivacidad({
    config,
    cambiar,
    onGuardar,
    onDescartar,
    guardando,
}) {
    return (
        <section className="config-section active">
            <h2 className="config-section__title">Privacidad</h2>

            <SettingSelect label="Quién puede ver mis análisis" id="verAnalisis"
                value={config.visibilidad_analisis}
                onChange={(v) => cambiar("visibilidad_analisis", v)}
                options={VISIBILIDAD} />

            <SettingToggle label="Permitir comentarios"
                desc="Otros pueden comentar tus análisis"
                checked={config.permitir_comentarios}
                onChange={(v) => cambiar("permitir_comentarios", v)} />

            <SettingToggle label="Compartir progreso"
                desc="Muestra tu progreso a quien tenga acceso"
                checked={config.compartir_progreso}
                onChange={(v) => cambiar("compartir_progreso", v)} />

            <AccionesFormulario
                onGuardar={onGuardar}
                onDescartar={onDescartar}
                guardando={guardando} />
        </section>
    );
}