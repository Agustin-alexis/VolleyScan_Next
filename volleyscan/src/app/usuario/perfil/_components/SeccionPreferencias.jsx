"use client";

import { useState, useEffect } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import { api } from '@/lib/api';

export default function SeccionPreferencias({ configInicial, showToast }) {
    const [preferencias, setPreferencias] = useState({
        notif_sesion: true,
        notif_analisis: true,
        notif_contenido: false,
        idioma: 'es',
        unidad_medida: 'metric',
    });

    useEffect(() => {
        if (configInicial) setPreferencias(configInicial);
    }, [configInicial]);

    async function handlePreferenciasSubmit(e) {
        e.preventDefault();
        const { notif_sesion, notif_analisis, notif_contenido, idioma, unidad_medida } = preferencias;
        try {
            await api('/usuario/configuracion/', {
                method: 'PUT',
                body: { notif_sesion, notif_analisis, notif_contenido, idioma, unidad_medida },
            });
            showToast('✓ Preferencias guardadas correctamente.');
        } catch {
            showToast('No se pudieron guardar las preferencias.', 'error');
        }
    }

    return (
        <section className="profile-section active" aria-labelledby="title-preferencias">
            <h2 className="section-title" id="title-preferencias">Preferencias</h2>
            <form onSubmit={handlePreferenciasSubmit}>

                <fieldset className="pref-fieldset">
                    <legend className="pref-legend">Notificaciones</legend>
                    <div className="toggle-list">
                        {[
                            { key: 'notif_sesion', label: 'Recordatorio de sesión', desc: '30 min antes del entrenamiento' },
                            { key: 'notif_analisis', label: 'Análisis completado', desc: 'Cuando la IA termina un análisis' },
                            { key: 'notif_contenido', label: 'Nuevos contenidos', desc: 'Videos y ejercicios nuevos' },
                        ].map(item => (
                            <div key={item.key} className="toggle-item">
                                <div className="toggle-item__info">
                                    <p className="toggle-item__label">{item.label}</p>
                                    <p className="toggle-item__desc">{item.desc}</p>
                                </div>
                                <label className="toggle-switch">
                                    <input type="checkbox"
                                        checked={preferencias[item.key]}
                                        onChange={e => setPreferencias(p => ({ ...p, [item.key]: e.target.checked }))} />
                                    <span className="toggle-thumb" />
                                </label>
                            </div>
                        ))}
                    </div>
                </fieldset>

                <fieldset className="pref-fieldset">
                    <legend className="pref-legend">Apariencia</legend>
                    <div className="field-row">
                        <div className="field-group">
                            <label className="field-label" htmlFor="idioma">Idioma</label>
                            <div className="select-wrap">
                                <select className="field-select" id="idioma"
                                    value={preferencias.idioma}
                                    onChange={e => setPreferencias(p => ({ ...p, idioma: e.target.value }))}>
                                    <option value="es">Español</option>
                                    <option value="en">English</option>
                                    <option value="pt">Português</option>
                                </select>
                                <FaChevronDown className="fa-solid select-icon" />
                            </div>
                        </div>
                        <div className="field-group">
                            <label className="field-label" htmlFor="unidades">Unidades</label>
                            <div className="select-wrap">
                                <select className="field-select" id="unidades"
                                    value={preferencias.unidad_medida}
                                    onChange={e => setPreferencias(p => ({ ...p, unidad_medida: e.target.value }))}>
                                    <option value="metric">Métrico (kg, m)</option>
                                    <option value="imperial">Imperial (lb, ft)</option>
                                </select>
                                <FaChevronDown className="fa-solid select-icon" />
                            </div>
                        </div>
                    </div>
                </fieldset>

                <div className="form-actions">
                    <button className="btn btn--secondary" type="button"
                        onClick={() => { if (configInicial) setPreferencias(configInicial); showToast('Cambios descartados.', 'info'); }}>
                        Cancelar
                    </button>
                    <button className="btn btn--primary" type="submit">Guardar cambios</button>
                </div>
            </form>
        </section>
    );
}