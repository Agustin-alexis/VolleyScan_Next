"use client";

import { FaChevronDown } from "react-icons/fa6";
import {
    SettingSelect,
    SettingToggle,
    ToggleSwitch,
    AccionesFormulario,
    VISIBILIDAD,
} from "./ControlesConfig";

export default function SeccionGeneral({
    config,
    cambiar,
    onGuardar,
    onDescartar,
    guardando,
    onPedirCerrarSesion,
}) {
    return (
        <section className="config-section active">
            <div className="config-section__split">

                <div className="config-main-col">
                    <h2 className="config-section__title">General</h2>

                    <SettingSelect label="Unidad de medida" id="unidadMedida"
                        value={config.unidad_medida}
                        onChange={(v) => cambiar("unidad_medida", v)}
                        options={[
                            { value: "metric", label: "Métrico (kg, cm)" },
                            { value: "imperial", label: "Imperial (lb, ft)" },
                        ]} />

                    <SettingSelect label="Idioma" id="idioma"
                        value={config.idioma}
                        onChange={(v) => cambiar("idioma", v)}
                        options={[
                            { value: "es", label: "Español" },
                            { value: "en", label: "English" },
                            { value: "pt", label: "Português" },
                        ]} />

                    <SettingSelect label="Calidad de video para análisis" id="calidadVideo"
                        value={config.calidad_video}
                        onChange={(v) => cambiar("calidad_video", v)}
                        options={[
                            { value: "alta", label: "Alta" },
                            { value: "media", label: "Media" },
                            { value: "baja", label: "Baja" },
                            { value: "auto", label: "Auto" },
                        ]}
                        small />

                    <SettingToggle
                        label="Guardar videos automáticamente"
                        desc="Los videos de análisis se guardan en tu historial"
                        checked={config.guardar_videos}
                        onChange={(v) => cambiar("guardar_videos", v)} />

                    <AccionesFormulario
                        onGuardar={onGuardar}
                        onDescartar={onDescartar}
                        guardando={guardando} />
                </div>

                {/* Privacidad rápida */}
                <aside className="quick-privacy">
                    <h3 className="quick-privacy__title">Privacidad rápida</h3>

                    <div className="qp-group">
                        <p className="setting-label">Quién puede ver mis análisis</p>
                        <div className="select-wrap">
                            <select className="field-select"
                                value={config.visibilidad_analisis}
                                onChange={(e) => cambiar("visibilidad_analisis", e.target.value)}>
                                {VISIBILIDAD.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                            <FaChevronDown className="select-icon" />
                        </div>
                    </div>

                    <div className="qp-toggle">
                        <p className="setting-label">Permitir comentarios</p>
                        <ToggleSwitch label="Permitir comentarios"
                            checked={config.permitir_comentarios}
                            onChange={(v) => cambiar("permitir_comentarios", v)} />
                    </div>

                    <div className="qp-toggle">
                        <p className="setting-label">Compartir progreso</p>
                        <ToggleSwitch label="Compartir progreso"
                            checked={config.compartir_progreso}
                            onChange={(v) => cambiar("compartir_progreso", v)} />
                    </div>

                    <hr className="divider" />

                    <button className="btn--logout" type="button"
                        onClick={onPedirCerrarSesion}>
                        Cerrar sesión
                    </button>
                </aside>

            </div>
        </section>
    );
}