"use client";

import { useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';

export default function SeccionObjetivos({ showToast }) {
    const [objetivos, setObjetivos] = useState({
        objPrincipal: 'tecnica',
        sesiones: 4,
        duracion: 45,
        areas: { remate: true, recepcion: true, saque: false },
    });

    function handleObjetivosSubmit(e) {
        e.preventDefault();
        showToast('✓ Objetivos guardados correctamente.');
    }

    return (
        <section className="profile-section active" aria-labelledby="title-objetivos">
            <h2 className="section-title" id="title-objetivos">Objetivos</h2>
            <form onSubmit={handleObjetivosSubmit} noValidate>

                <div className="field-group">
                    <label className="field-label" htmlFor="objPrincipal">Objetivo principal</label>
                    <div className="select-wrap">
                        <select className="field-select" id="objPrincipal"
                            value={objetivos.objPrincipal}
                            onChange={e => setObjetivos(p => ({ ...p, objPrincipal: e.target.value }))}>
                            <option value="tecnica">Mejorar técnica de remate</option>
                            <option value="resistencia">Aumentar resistencia</option>
                            <option value="velocidad">Mejorar velocidad de reacción</option>
                            <option value="consistencia">Consistencia en recepción</option>
                        </select>
                        <FaChevronDown className="fa-solid select-icon" />
                    </div>
                </div>

                <div className="field-group">
                    <label className="field-label" htmlFor="sesiones">
                        Sesiones por semana
                    </label>
                    <div className="range-wrap">
                        <input type="range" className="range-input" id="sesiones"
                            min="1" max="7" value={objetivos.sesiones}
                            onChange={e => setObjetivos(p => ({ ...p, sesiones: Number(e.target.value) }))}
                            style={{ background: `linear-gradient(90deg, var(--accent-blue) ${((objetivos.sesiones - 1) / 6) * 100}%, rgba(255,255,255,.1) ${((objetivos.sesiones - 1) / 6) * 100}%)` }}
                        />
                        <span className="range-value">
                            {objetivos.sesiones} sesión{objetivos.sesiones !== 1 ? 'es' : ''}
                        </span>
                    </div>
                </div>

                <div className="field-group">
                    <label className="field-label" htmlFor="duracion">Duración por sesión</label>
                    <div className="range-wrap">
                        <input type="range" className="range-input" id="duracion"
                            min="15" max="120" step="15" value={objetivos.duracion}
                            onChange={e => setObjetivos(p => ({ ...p, duracion: Number(e.target.value) }))}
                            style={{ background: `linear-gradient(90deg, var(--accent-blue) ${((objetivos.duracion - 15) / 105) * 100}%, rgba(255,255,255,.1) ${((objetivos.duracion - 15) / 105) * 100}%)` }}
                        />
                        <span className="range-value">{objetivos.duracion} min</span>
                    </div>
                </div>

                <div className="field-group">
                    <label className="field-label">Áreas de mejora</label>
                    <div className="checkbox-group">
                        {Object.entries(objetivos.areas).map(([key, checked]) => (
                            <label key={key} className="checkbox-item">
                                <input type="checkbox" checked={checked}
                                    onChange={e => setObjetivos(p => ({ ...p, areas: { ...p.areas, [key]: e.target.checked } }))} />
                                <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="form-actions">
                    <button className="btn btn--secondary" type="button"
                        onClick={() => showToast('Cambios descartados.', 'info')}>Cancelar</button>
                    <button className="btn btn--primary" type="submit">Guardar cambios</button>
                </div>
            </form>
        </section>
    );
}