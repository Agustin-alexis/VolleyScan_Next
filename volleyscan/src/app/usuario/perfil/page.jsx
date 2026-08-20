"use client";

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image';
import './perfil.css'
import {
    FaUserCircle,
    FaBullseye,
    FaSlidersH,
    FaLock,
    FaChevronDown,
} from 'react-icons/fa';

/* ── Íconos SVG para toggle contraseña ── */
const IconEye = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
)
const IconEyeOff = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
)

/* ── Secciones del perfil ── */
const PROFILE_SECTIONS = [
    { id: 'personal', icon: FaUserCircle, label: 'Información personal' },
    { id: 'objetivos', icon: FaBullseye, label: 'Objetivos' },
    { id: 'preferencias', icon: FaSlidersH, label: 'Preferencias' },
    { id: 'seguridad', icon: FaLock, label: 'Cuenta y seguridad' },
]

export default function Perfil() {
    const router = useRouter()

    /* ── Estado activo ── */
    const [activeSection, setActiveSection] = useState('personal')

    /* ── Foto de perfil ── */
    const [photoSrc, setPhotoSrc] = useState(
        'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=200&q=80'
    )
    const photoInputRef = useRef(null)

    /* ── Info personal ── */
    const [personal, setPersonal] = useState({
        nombre: 'Juan Pérez',
        email: 'juanperez@mail.com',
        fechaNac: '2002-05-15',
        nivel: 'intermedio',
        peso: '72',
        estatura: '1.80',
        posicion: 'opuesto',
    })
    const [personalSnapshot, setPersonalSnapshot] = useState({ ...personal })
    const [personalErrors, setPersonalErrors] = useState({})

    /* ── Objetivos ── */
    const [objetivos, setObjetivos] = useState({
        objPrincipal: 'tecnica',
        sesiones: 4,
        duracion: 45,
        areas: { remate: true, recepcion: true, saque: false },
    })

    /* ── Preferencias ── */
    const [preferencias, setPreferencias] = useState({
        notifSesion: true,
        notifAnalisis: true,
        notifContenido: false,
        idioma: 'es',
        unidades: 'metric',
    })

    /* ── Seguridad ── */
    const [passActual, setPassActual] = useState('')
    const [passNueva, setPassNueva] = useState('')
    const [passConfirm, setPassConfirm] = useState('')
    const [showActual, setShowActual] = useState(false)
    const [showNueva, setShowNueva] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [passError, setPassError] = useState('')

    /* ── Modal ── */
    const [modal, setModal] = useState(null)

    /* ── Toast ── */
    const [toast, setToast] = useState(null)

    function showToast(message, type = 'success') {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    /* ── Cambio de foto ── */
    function handlePhotoChange(e) {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = ev => { setPhotoSrc(ev.target.result); showToast('✓ Foto actualizada.') }
        reader.readAsDataURL(file)
    }

    /* ── Guardar info personal ── */
    function handlePersonalSubmit(e) {
        e.preventDefault()
        const errs = {}
        if (!personal.nombre.trim()) errs.nombre = 'El nombre es obligatorio.'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal.email)) errs.email = 'Correo inválido.'
        if (Object.keys(errs).length > 0) { setPersonalErrors(errs); return }
        setPersonalSnapshot({ ...personal })
        setPersonalErrors({})
        showToast('✓ Información personal guardada.')
    }

    function handlePersonalCancel() {
        setPersonal({ ...personalSnapshot })
        setPersonalErrors({})
        showToast('Cambios descartados.', 'info')
    }

    /* ── Fuerza de contraseña ── */
    function calcStrength(val) {
        if (!val) return 0
        let s = 0
        if (val.length >= 8) s++
        if (/[A-Z]/.test(val)) s++
        if (/[0-9]/.test(val)) s++
        if (/[^A-Za-z0-9]/.test(val)) s++
        return s
    }

    const strength = calcStrength(passNueva)
    const strengthLabels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte']
    const strengthColors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e']
    const strengthClasses = ['', 'weak', 'fair', 'good', 'strong']

    /* ── Guardar contraseña ── */
    function handlePasswordSubmit(e) {
        e.preventDefault()
        setPassError('')
        if (!passNueva) { setPassError('Introduce la nueva contraseña.'); return }
        if (passNueva.length < 8) { setPassError('Mínimo 8 caracteres.'); return }
        if (passNueva !== passConfirm) { setPassError('Las contraseñas no coinciden.'); return }
        setPassActual(''); setPassNueva(''); setPassConfirm('')
        showToast('✓ Contraseña actualizada correctamente.')
    }

    /* ── Guardar objetivos ── */
    function handleObjetivosSubmit(e) {
        e.preventDefault()
        showToast('✓ Objetivos guardados correctamente.')
    }

    /* ── Guardar preferencias ── */
    function handlePreferenciasSubmit(e) {
        e.preventDefault()
        showToast('✓ Preferencias guardadas correctamente.')
    }

    const toastColors = { success: '#22c55e', error: '#ef4444', info: '#3b82f6' }

    return (
        <main className="main-content">

            <header className="page-header">
                <h1 className="page-header__title">Perfil de Usuario</h1>
            </header>

            <div className="profile-layout">

                {/* ── Columna izquierda ── */}
                <aside className="profile-sidebar">

                    {/* Tarjeta de identidad */}
                    <div className="identity-card">
                        <div className="avatar-wrap">
                            <Image src={photoSrc} alt="Foto de perfil" width={200} height={200} className="avatar-img" />
                            <button className="avatar-edit-btn" type="button"
                                aria-label="Cambiar foto"
                                onClick={() => photoInputRef.current?.click()}>
                                <i className="fa-solid fa-pen" />
                            </button>
                            <input type="file" accept="image/*" className="visually-hidden"
                                ref={photoInputRef} onChange={handlePhotoChange} />
                        </div>
                        <p className="identity-card__name">{personal.nombre}</p>
                        <p className="identity-card__role">Deportista</p>
                        <span className="badge badge--level">
                            {personal.nivel.charAt(0).toUpperCase() + personal.nivel.slice(1)}
                        </span>
                    </div>

                    {/* Nav de secciones */}
                    <nav className="profile-nav" aria-label="Secciones del perfil">
                        <ul className="profile-nav__list">
                            {PROFILE_SECTIONS.map(({ id, icon: Icon, label }) => (
                                <li key={id}
                                    className={`profile-nav__item${activeSection === id ? ' profile-nav__item--active' : ''}`}>
                                    <button className="profile-nav__btn" type="button" onClick={() => setActiveSection(id)}>
                                        <Icon size={18} />
                                        <span>{label}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </aside>

                {/* ── Columna derecha ── */}
                <div className="profile-content">

                    {/* INFO PERSONAL */}
                    {activeSection === 'personal' && (
                        <section className="profile-section active" aria-labelledby="title-personal">
                            <div className="section-split">
                                <div className="section-form">
                                    <h2 className="section-title" id="title-personal">Información personal</h2>
                                    <form onSubmit={handlePersonalSubmit} noValidate>

                                        <div className="field-group">
                                            <label className="field-label" htmlFor="nombre">Nombre completo</label>
                                            <input className={`field-input-1${personalErrors.nombre ? ' input-error' : ''}`}
                                                type="text" id="nombre"
                                                value={personal.nombre}
                                                onChange={e => { setPersonal(p => ({ ...p, nombre: e.target.value })); setPersonalErrors(p => ({ ...p, nombre: '' })) }}
                                                autoComplete="name" />
                                            {personalErrors.nombre && <span className="field-error">{personalErrors.nombre}</span>}
                                        </div>

                                        <div className="field-group">
                                            <label className="field-label" htmlFor="email">Correo electrónico</label>
                                            <input className={`field-input-1${personalErrors.email ? ' input-error' : ''}`}
                                                type="email" id="email"
                                                value={personal.email}
                                                onChange={e => { setPersonal(p => ({ ...p, email: e.target.value })); setPersonalErrors(p => ({ ...p, email: '' })) }}
                                                autoComplete="email" />
                                            {personalErrors.email && <span className="field-error">{personalErrors.email}</span>}
                                        </div>

                                        <div className="field-row">
                                            <div className="field-group">
                                                <label className="field-label" htmlFor="fechaNac">Fecha de nacimiento</label>
                                                <input className="field-input-1" type="date" id="fechaNac"
                                                    value={personal.fechaNac}
                                                    onChange={e => setPersonal(p => ({ ...p, fechaNac: e.target.value }))} />
                                            </div>
                                            <div className="field-group">
                                                <label className="field-label" htmlFor="nivel">Nivel</label>
                                                <div className="select-wrap">
                                                    <select className="field-select" id="nivel"
                                                        value={personal.nivel}
                                                        onChange={e => setPersonal(p => ({ ...p, nivel: e.target.value }))}>
                                                        <option value="principiante">Principiante</option>
                                                        <option value="intermedio">Intermedio</option>
                                                        <option value="avanzado">Avanzado</option>
                                                        <option value="profesional">Profesional</option>
                                                    </select>
                                                    <i className="fa-solid fa-chevron-down select-icon" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="field-row">
                                            <div className="field-group">
                                                <label className="field-label" htmlFor="peso">Peso</label>
                                                <div className="input-unit-wrap">
                                                    <input className="field-input-1" type="number" id="peso"
                                                        value={personal.peso} min="30" max="200"
                                                        onChange={e => setPersonal(p => ({ ...p, peso: e.target.value }))} />
                                                    <span className="input-unit">kg</span>
                                                </div>
                                            </div>
                                            <div className="field-group">
                                                <label className="field-label" htmlFor="estatura">Estatura</label>
                                                <div className="input-unit-wrap">
                                                    <input className="field-input-1" type="number" id="estatura"
                                                        value={personal.estatura} step="0.01" min="1" max="2.5"
                                                        onChange={e => setPersonal(p => ({ ...p, estatura: e.target.value }))} />
                                                    <span className="input-unit">m</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="field-group">
                                            <label className="field-label" htmlFor="posicion">Posición</label>
                                            <div className="select-wrap">
                                                <select className="field-select" id="posicion"
                                                    value={personal.posicion}
                                                    onChange={e => setPersonal(p => ({ ...p, posicion: e.target.value }))}>
                                                    <option value="opuesto">Opuesto</option>
                                                    <option value="armador">Armador</option>
                                                    <option value="central">Central</option>
                                                    <option value="punta">Punta receptor</option>
                                                    <option value="libero">Líbero</option>
                                                </select>
                                                <i className="fa-solid fa-chevron-down select-icon" />
                                            </div>
                                        </div>

                                        <div className="form-actions">
                                            <button className="btn btn--secondary" type="button" onClick={handlePersonalCancel}>Cancelar</button>
                                            <button className="btn btn--primary" type="submit">Guardar cambios</button>
                                        </div>
                                    </form>
                                </div>

                                {/* Foto de perfil */}
                                <aside className="section-photo">
                                    <p className="section-photo__label">Foto de perfil</p>
                                    <div className="photo-preview">
                                        <img src={photoSrc} alt="Foto de perfil" className="photo-preview__img" />
                                    </div>
                                    <button className="btn btn--primary btn--sm" type="button"
                                        onClick={() => photoInputRef.current?.click()}>
                                        <i className="fa-solid fa-camera" /> Cambiar foto
                                    </button>
                                </aside>
                            </div>
                        </section>
                    )}

                    {/* OBJETIVOS */}
                    {activeSection === 'objetivos' && (
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
                    )}

                    {/* PREFERENCIAS */}
                    {activeSection === 'preferencias' && (
                        <section className="profile-section active" aria-labelledby="title-preferencias">
                            <h2 className="section-title" id="title-preferencias">Preferencias</h2>
                            <form onSubmit={handlePreferenciasSubmit}>

                                <fieldset className="pref-fieldset">
                                    <legend className="pref-legend">Notificaciones</legend>
                                    <div className="toggle-list">
                                        {[
                                            { key: 'notifSesion', label: 'Recordatorio de sesión', desc: '30 min antes del entrenamiento' },
                                            { key: 'notifAnalisis', label: 'Análisis completado', desc: 'Cuando la IA termina un análisis' },
                                            { key: 'notifContenido', label: 'Nuevos contenidos', desc: 'Videos y ejercicios nuevos' },
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
                                                <i className="fa-solid fa-chevron-down select-icon" />
                                            </div>
                                        </div>
                                        <div className="field-group">
                                            <label className="field-label" htmlFor="unidades">Unidades</label>
                                            <div className="select-wrap">
                                                <select className="field-select" id="unidades"
                                                    value={preferencias.unidades}
                                                    onChange={e => setPreferencias(p => ({ ...p, unidades: e.target.value }))}>
                                                    <option value="metric">Métrico (kg, m)</option>
                                                    <option value="imperial">Imperial (lb, ft)</option>
                                                </select>
                                                <i className="fa-solid fa-chevron-down select-icon" />
                                            </div>
                                        </div>
                                    </div>
                                </fieldset>

                                <div className="form-actions">
                                    <button className="btn btn--secondary" type="button"
                                        onClick={() => showToast('Cambios descartados.', 'info')}>Cancelar</button>
                                    <button className="btn btn--primary" type="submit">Guardar cambios</button>
                                </div>
                            </form>
                        </section>
                    )}

                    {/* SEGURIDAD */}
                    {activeSection === 'seguridad' && (
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
                                            value={passConfirm} onChange={e => { setPassConfirm(e.target.value); setPassError('') }} />
                                        <button className="pass-toggle" type="button" onClick={() => setShowConfirm(p => !p)}>
                                            {showConfirm ? <IconEyeOff /> : <IconEye />}
                                        </button>
                                    </div>
                                    {passError && <span className="field-error">{passError}</span>}
                                </div>

                                <div className="form-actions">
                                    <button className="btn btn--secondary" type="button"
                                        onClick={() => { setPassActual(''); setPassNueva(''); setPassConfirm(''); setPassError('') }}>
                                        Cancelar
                                    </button>
                                    <button className="btn btn--primary" type="submit">Actualizar contraseña</button>
                                </div>

                                <hr className="section-divider" />

                                <div className="danger-zone">
                                    <p className="danger-zone__title">Zona de peligro</p>
                                    <p className="danger-zone__desc">Estas acciones son permanentes e irreversibles.</p>
                                    <button className="btn btn--danger-outline" type="button"
                                        onClick={() => setModal({ message: '¿Eliminar cuenta? Esta acción es permanente.', onConfirm: () => { sessionStorage.clear(); router.push('/') } })}>
                                        <i className="fa-solid fa-trash-can" /> Eliminar cuenta
                                    </button>
                                </div>
                            </form>
                        </section>
                    )}

                </div>
            </div>

            {/* Modal */}
            {modal && (
                <div className="modal-overlay" role="dialog" aria-modal="true"
                    onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
                    <div className="modal">
                        <h3 className="modal__title">¿Confirmar acción?</h3>
                        <p className="modal__body">{modal.message}</p>
                        <div className="modal__actions">
                            <button className="btn btn--secondary" type="button" onClick={() => setModal(null)}>Cancelar</button>
                            <button className="btn btn--danger" type="button" onClick={() => { modal.onConfirm(); setModal(null) }}>
                                Sí, eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="toast" role="status" aria-live="polite"
                    style={{ borderColor: toastColors[toast.type] }}>
                    {toast.message}
                </div>
            )}

        </main>
    )
}