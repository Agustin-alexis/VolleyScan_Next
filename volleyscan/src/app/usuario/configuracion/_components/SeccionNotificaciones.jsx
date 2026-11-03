"use client";

import { SettingToggle, AccionesFormulario } from "./ControlesConfig";

export default function SeccionNotificaciones({
    config,
    cambiar,
    onGuardar,
    onDescartar,
    guardando,
}) {
    return (
        <section className="config-section active">
            <h2 className="config-section__title">Notificaciones</h2>

            <SettingToggle label="Recordatorio de sesión"
                desc="Te avisa antes del entrenamiento"
                checked={config.notif_sesion}
                onChange={(v) => cambiar("notif_sesion", v)} />

            <SettingToggle label="Análisis completado"
                desc="Cuando la IA termina un análisis"
                checked={config.notif_analisis}
                onChange={(v) => cambiar("notif_analisis", v)} />

            <SettingToggle label="Nuevos contenidos"
                desc="Videos y ejercicios nuevos"
                checked={config.notif_contenido}
                onChange={(v) => cambiar("notif_contenido", v)} />

            <AccionesFormulario
                onGuardar={onGuardar}
                onDescartar={onDescartar}
                guardando={guardando} />
        </section>
    );
}