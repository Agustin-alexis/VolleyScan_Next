"use client";

import { useState } from 'react';
import { FaTrashAlt } from 'react-icons/fa';
import { api, ApiError } from '@/lib/api';

/* ── Íconos SVG para toggle contraseña ── */
const IconEye = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const IconEyeOff = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
);

function calcStrength(val) {
    if (!val) return 0;
    let s = 0;
    if (val.length >= 8) s++;
    if (/[A-Z]/.test(val)) s++;
    if (/[0-9]/.test(val)) s++;
    if (/[^A-Za-z0-9]/.test(val)) s++;
    return s;
}

const strengthLabels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];
const strengthColors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];
const strengthClasses = ['', 'weak', 'fair', 'good', 'strong'];

export default function SeccionSeguridad({ showToast, onSolicitarEliminarCuenta }) {
    const [passActual, setPassActual] = useState('');
    const [passNueva, setPassNueva] = useState('');
    const [passConfirm, setPassConfirm] = useState('');
    const [showActual, setShowActual] = useState(false);
    const [showNueva, setShowNueva] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [passError, setPassError] = useState('');

    const strength = calcStrength(passNueva);

    async function handlePasswordSubmit(e) {
        e.preventDefault();
        setPassError('');
        if (!passActual) { setPassError('Introduce tu contraseña actual.'); return; }
        if (!passNueva) { setPassError('Introduce la nueva contraseña.'); return; }
        if (passNueva.length < 8) { setPassError('Mínimo 8 caracteres.'); return; }
        if (passNueva !== passConfirm) { setPassError('Las contraseñas no coinciden.'); return; }
        try {
            await api('/usuario/perfil/password/', {
                method: 'PUT',
                body: { password_actual: passActual, password_nueva: passNueva },
            });
            setPassActual(''); setPassNueva(''); setPassConfirm('');
            showToast('✓ Contraseña actualizada correctamente.');
        } catch (err) {
            const d = err instanceof ApiError ? err.data : null;
            setPassError(
                d?.password_actual?.[0] ?? d?.password_nueva?.[0] ?? 'No se pudo actualizar la contraseña.'
            );
        }
    }

    return (
        <section className="profile-section active" aria-labelledby="title-seguridad">
            <h2 className="section-title" id="title-seguridad">Cuenta y seguridad</h2>
            <form onSubmit={handlePasswordSubmit} noValidate>

                {/* Contraseña actual */}
                <div className="field-group">
                    <label className="field-label" htmlFor="passActual">Contraseña actual</label>
                    <div className="input-pass-wrap">
                        <input className="field-input-1" type={showActual ? 'text' : 'password'}
                            id="passActual" placeholder="••••••••"
                            value={passActual} onChange={e => setPassActual(e.target.value)} />
                        <button className="pass-toggle" type="button" onClick={() => setShowActual(p => !p)}>
                            {showActual ? <IconEyeOff /> : <IconEye />}
                        </button>
                    </div>
                </div>

                {/* Nueva contraseña */}
                <div className="field-group">
                    <label className="field-label" htmlFor="passNueva">Nueva contraseña</label>
                    <div className="input-pass-wrap">
                        <input className="field-input-1" type={showNueva ? 'text' : 'password'}
                            id="passNueva" placeholder="Mín. 8 caracteres"
                            value={passNueva} onChange={e => setPassNueva(e.target.value)} />
                        <button className="pass-toggle" type="button" onClick={() => setShowNueva(p => !p)}>
                            {showNueva ? <IconEyeOff /> : <IconEye />}
                        </button>
                    </div>
                    {passNueva && (
                        <div className="password-strength">
                            <div className="strength-bars">
                                {[1, 2, 3, 4].map(i => (
                                    <span key={i} className={`strength-bar${i <= strength ? ` ${strengthClasses[strength]}` : ''}`} />
                                ))}
                            </div>
                            <span className="strength-label" style={{ color: strengthColors[strength] }}>
                                {strengthLabels[strength]}
                            </span>
                        </div>
                    )}
                </div>

                {/* Confirmar contraseña */}
                <div className="field-group">
                    <label className="field-label" htmlFor="passConfirm">Confirmar contraseña</label>
                    <div className="input-pass-wrap">
                        <input className={`field-input-1${passError ? ' input-error' : ''}`}
                            type={showConfirm ? 'text' : 'password'}
                            id="passConfirm" placeholder="Repite la nueva contraseña"
                            value={passConfirm} onChange={e => { setPassConfirm(e.target.value); setPassError(''); }} />
                        <button className="pass-toggle" type="button" onClick={() => setShowConfirm(p => !p)}>
                            {showConfirm ? <IconEyeOff /> : <IconEye />}
                        </button>
                    </div>
                    {passError && <span className="field-error">{passError}</span>}
                </div>

                <div className="form-actions">
                    <button className="btn btn--secondary" type="button"
                        onClick={() => { setPassActual(''); setPassNueva(''); setPassConfirm(''); setPassError(''); }}>
                        Cancelar
                    </button>
                    <button className="btn btn--primary" type="submit">Actualizar contraseña</button>
                </div>

                <hr className="section-divider" />

                <div className="danger-zone">
                    <p className="danger-zone__title">Zona de peligro</p>
                    <p className="danger-zone__desc">Estas acciones son permanentes e irreversibles.</p>
                    <button className="btn btn--danger-outline" type="button"
                        onClick={onSolicitarEliminarCuenta}>
                        <FaTrashAlt /> Eliminar cuenta
                    </button>
                </div>
            </form>
        </section>
    );
}