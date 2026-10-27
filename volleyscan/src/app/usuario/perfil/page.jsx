"use client";

import { useState, useRef, useEffect } from 'react'
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
import { useApi } from '@/lib/UseApi';
import { api, ApiError, cerrarSesion } from '@/lib/api'

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

/* El backend manda null en los campos vacíos y los inputs no aceptan null */
const aForm = (p) => ({
    nombre: p.nombre ?? '',
    apellido: p.apellido ?? '',
    email: p.email ?? '',
    fecha_nac: p.fecha_nac ?? '',
    nivel: p.nivel ?? 'principiante',
    peso: p.peso ?? '',
    estatura: p.estatura ?? '',
    posicion: p.posicion ?? '',
})

/* { campo: ["mensaje"] } -> { campo: "mensaje" } */
const primerError = (data) =>
    Object.fromEntries(
        Object.entries(data ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)])
    )

export default function Perfil() {
    const router = useRouter()

    /* ── Datos del backend ── */
    const { data: perfil, cargando: cargandoPerfil, error: errorPerfil } = useApi('/usuario/perfil/')
    const { data: config } = useApi('/usuario/configuracion/')

    /* ── Estado activo ── */
    const [activeSection, setActiveSection] = useState('personal')

    /* ── Foto de perfil (solo vista previa: el backend aún no guarda fotos) ── */
    const [photoSrc, setPhotoSrc] = useState(
        'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=200&q=80'
    )
    const photoInputRef = useRef(null)

    /* ── Info personal ── */
    const [personal, setPersonal] = useState(aForm({}))
    const [personalSnapshot, setPersonalSnapshot] = useState(aForm({}))
    const [personalErrors, setPersonalErrors] = useState({})

    /* ── Objetivos (local: no tiene tabla en el backend) ── */
    const [objetivos, setObjetivos] = useState({
        objPrincipal: 'tecnica',
        sesiones: 4,
        duracion: 45,
        areas: { remate: true, recepcion: true, saque: false },
    })

    /* ── Preferencias (nombres iguales a las columnas de configuracion) ── */
    const [preferencias, setPreferencias] = useState({
        notif_sesion: true,
        notif_analisis: true,
        notif_contenido: false,
        idioma: 'es',
        unidad_medida: 'metric',
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

    /* ── Cuando llegan los datos, llenar los formularios ── */
    useEffect(() => {
        if (!perfil) return
        const f = aForm(perfil)
        setPersonal(f)
        setPersonalSnapshot(f)
    }, [perfil])

    useEffect(() => {
        if (config) setPreferencias(config)
    }, [config])

    /* ── Helpers del formulario personal ── */
    const cambiar = (campo) => (e) => {
        setPersonal(p => ({ ...p, [campo]: e.target.value }))
        setPersonalErrors(p => ({ ...p, [campo]: '' }))
    }
    const claseInput = (campo) =>
        `field-input-1${personalErrors[campo] ? ' input-error' : ''}`

    /* ── Cambio de foto ── */
    function handlePhotoChange(e) {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = ev => { setPhotoSrc(ev.target.result); showToast('✓ Foto actualizada.') }
        reader.readAsDataURL(file)
    }

    /* ── Guardar info personal ── */
    async function handlePersonalSubmit(e) {
        e.preventDefault()
        setPersonalErrors({})
        try {
            const datos = await api('/usuario/perfil/', {
                method: 'PUT',
                body: {
                    nombre: personal.nombre.trim(),
                    apellido: personal.apellido.trim(),
                    email: personal.email.trim(),
                    fecha_nac: personal.fecha_nac || null,
                    nivel: personal.nivel,
                    posicion: personal.posicion || null,
                    // la API rechaza "" en campos numéricos: se manda null
                    peso: personal.peso === '' ? null : personal.peso,
                    estatura: personal.estatura === '' ? null : personal.estatura,
                },
            })
            const nuevo = aForm(datos)
            setPersonal(nuevo)
            setPersonalSnapshot(nuevo)
            showToast('✓ Información personal guardada.')
        } catch (err) {
            if (err instanceof ApiError && err.status === 400) {
                setPersonalErrors(primerError(err.data))
            } else {
                showToast('No se pudo guardar. Inténtalo de nuevo.', 'error')
            }
        }
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
    async function handlePasswordSubmit(e) {
        e.preventDefault()
        setPassError('')
        if (!passActual) { setPassError('Introduce tu contraseña actual.'); return }
        if (!passNueva) { setPassError('Introduce la nueva contraseña.'); return }
        if (passNueva.length < 8) { setPassError('Mínimo 8 caracteres.'); return }
        if (passNueva !== passConfirm) { setPassError('Las contraseñas no coinciden.'); return }
        try {
            await api('/usuario/perfil/password/', {
                method: 'PUT',
                body: { password_actual: passActual, password_nueva: passNueva },
            })
            setPassActual(''); setPassNueva(''); setPassConfirm('')
            showToast('✓ Contraseña actualizada correctamente.')
        } catch (err) {
            const d = err instanceof ApiError ? err.data : null
            setPassError(
                d?.password_actual?.[0] ?? d?.password_nueva?.[0] ?? 'No se pudo actualizar la contraseña.'
            )
        }
    }

    /* ── Guardar objetivos (local) ── */
    function handleObjetivosSubmit(e) {
        e.preventDefault()
        showToast('✓ Objetivos guardados correctamente.')
    }

    /* ── Guardar preferencias ── */
    async function handlePreferenciasSubmit(e) {
        e.preventDefault()
        const { notif_sesion, notif_analisis, notif_contenido, idioma, unidad_medida } = preferencias
        try {
            await api('/usuario/configuracion/', {
                method: 'PUT',
                body: { notif_sesion, notif_analisis, notif_contenido, idioma, unidad_medida },
            })
            showToast('✓ Preferencias guardadas correctamente.')
        } catch {
            showToast('No se pudieron guardar las preferencias.', 'error')
        }
    }

    /* ── Eliminar cuenta ── */
    async function eliminarCuenta() {
        try {
            await api('/usuario/perfil/', { method: 'DELETE' })
            cerrarSesion()
            router.push('/')
        } catch {
            showToast('No se pudo eliminar la cuenta.', 'error')
        }
    }

    const toastColors = { success: '#22c55e', error: '#ef4444', info: '#3b82f6' }

    /* ── Estados de carga (después de todos los hooks) ── */
    if (cargandoPerfil) {
        return <main className="main-content"><p style={{ color: '#94a3b8' }}>Cargando…</p></main>
    }
    if (errorPerfil) {
        return <main className="main-content"><p style={{ color: '#ef4444' }}>No se pudo cargar el perfil.</p></main>
    }

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
                        <p className="identity-card__name">{personalSnapshot.nombre} {personalSnapshot.apellido}</p>
                        <p className="identity-card__role">Deportista</p>
                        <span className="badge badge--level">
                            {personalSnapshot.nivel.charAt(0).toUpperCase() + personalSnapshot.nivel.slice(1)}
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

                                        <div className="field-row">
                                            <div className="field-group">
                                                <label className="field-label" htmlFor="nombre">Nombre</label>
                                                <input className={claseInput('nombre')}
                                                    type="text" id="nombre"
                                                    value={personal.nombre}
                                                    onChange={cambiar('nombre')}
                                                    autoComplete="given-name" />
                                                {personalErrors.nombre && <span className="field-error">{personalErrors.nombre}</span>}
                                            </div>
                                            <div className="field-group">
                                                <label className="field-label" htmlFor="apellido">Apellido</label>
                                                <input className={claseInput('apellido')}
                                                    type="text" id="apellido"
                                                    value={personal.apellido}
                                                    onChange={cambiar('apellido')}
                                                    autoComplete="family-name" />
                                                {personalErrors.apellido && <span className="field-error">{personalErrors.apellido}</span>}
                                            </div>
                                        </div>

                                        <div className="field-group">
                                            <label className="field-label" htmlFor="email">Correo electrónico</label>
                                            <input className={claseInput('email')}
                                                type="email" id="email"
                                                value={personal.email}
                                                onChange={cambiar('email')}
                                                autoComplete="email" />
                                            {personalErrors.email && <span className="field-error">{personalErrors.email}</span>}
                                        </div>

                                        <div className="field-row">
                                            <div className="field-group">
                                                <label className="field-label" htmlFor="fechaNac">Fecha de nacimiento</label>
                                                <input className={claseInput('fecha_nac')} type="date" id="fechaNac"
                                                    value={personal.fecha_nac}
                                                    onChange={cambiar('fecha_nac')} />
                                                {personalErrors.fecha_nac && <span className="field-error">{personalErrors.fecha_nac}</span>}
                                            </div>
                                            <div className="field-group">
                                                <label className="field-label" htmlFor="nivel">Nivel</label>
                                                <div className="select-wrap">
                                                    <select className="field-select" id="nivel"
                                                        value={personal.nivel}
                                                        onChange={cambiar('nivel')}>
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
                                                    <input className={claseInput('peso')} type="number" id="peso"
                                                        value={personal.peso} min="30" max="200"
                                                        onChange={cambiar('peso')} />
                                                    <span className="input-unit">kg</span>
                                                </div>
                                                {personalErrors.peso && <span className="field-error">{personalErrors.peso}</span>}
                                            </div>
                                            <div className="field-group">
                                                <label className="field-label" htmlFor="estatura">Estatura</label>
                                                <div className="input-unit-wrap">
                                                    <input className={claseInput('estatura')} type="number" id="estatura"
                                                        value={personal.estatura} step="0.01" min="1" max="2.5"
                                                        onChange={cambiar('estatura')} />
                                                    <span className="input-unit">m</span>
                                                </div>
                                                {personalErrors.estatura && <span className="field-error">{personalErrors.estatura}</span>}
                                            </div>
                                        </div>

                                        <div className="field-group">
                                            <label className="field-label" htmlFor="posicion">Posición</label>
                                            <div className="select-wrap">
                                                <select className="field-select" id="posicion"
                                                    value={personal.posicion}
                                                    onChange={cambiar('posicion')}>
                                                    <option value="">Sin definir</option>
                                                    <option value="opuesto">Opuesto</option>
                                                    <option value="armador">Armador</option>
                                                    <option value="central">Central</option>
                                                    <option value="punta">Punta receptor</option>
                                                    <option value="libero">Líbero</option>
                                                </select>
                                                <FaChevronDown className="fa-solid fa-chevron-down select-icon" />
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
                                        onClick={() => { if (config) setPreferencias(config); showToast('Cambios descartados.', 'info') }}>
                                        Cancelar
                                    </button>
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
                                        onClick={() => setModal({ message: '¿Eliminar cuenta? Esta acción es permanente.', onConfirm: eliminarCuenta })}>
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
                            <button className="btn btn--danger-outline" type="button" onClick={() => { modal.onConfirm(); setModal(null) }}>
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