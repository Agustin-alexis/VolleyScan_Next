"use client";

import { FaChevronDown } from "react-icons/fa6";

export const VISIBILIDAD = [
    { value: "solo", label: "Solo yo" },
    { value: "entrenador", label: "Mi entrenador" },
    { value: "equipo", label: "Mi equipo" },
    { value: "todos", label: "Todos" },
];

export function SettingSelect({ label, id, value, onChange, options, small }) {
    return (
        <div className="setting-row">
            <label className="setting-label" htmlFor={id}>{label}</label>
            <div className={`select-wrap${small ? " select-wrap--sm" : ""}`}>
                <select className="field-select" id={id} value={value}
                    onChange={(e) => onChange(e.target.value)}>
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
                <FaChevronDown className="select-icon" />
            </div>
        </div>
    );
}

export function SettingToggle({ label, desc, checked, onChange }) {
    return (
        <div className="setting-row setting-row--toggle">
            <div className="setting-row__info">
                <p className="setting-label">{label}</p>
                {desc && <p className="setting-desc">{desc}</p>}
            </div>
            <ToggleSwitch label={label} checked={checked} onChange={onChange} />
        </div>
    );
}

export function ToggleSwitch({ label, checked, onChange }) {
    return (
        <label className="toggle-switch" aria-label={label}>
            <input type="checkbox" checked={checked}
                onChange={(e) => onChange(e.target.checked)} />
            <span className="toggle-thumb" />
        </label>
    );
}

export function AccionesFormulario({ onGuardar, onDescartar, guardando }) {
    return (
        <div className="form-actions">
            <button className="btn btn--secondary" type="button"
                onClick={onDescartar} disabled={guardando}>
                Cancelar
            </button>
            <button className="btn btn--primary" type="button"
                onClick={onGuardar} disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
        </div>
    );
}