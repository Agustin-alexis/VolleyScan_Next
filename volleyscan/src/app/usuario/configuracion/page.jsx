"use client";

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation';
import './configuracion.css'
import Link from 'next/link'
import { FaBell, FaBook, FaBug, FaCamera, FaChevronRight, FaCircle, FaEnvelope, FaLaptop, FaLock } from 'react-icons/fa'
import { FaChevronDown, FaCircleInfo, FaCircleQuestion, FaDisplay, FaGear, FaMobileScreenButton, FaTabletScreenButton } from 'react-icons/fa6';



/* ── Estado inicial ── */
const INITIAL_STATE = {
    general: {
        unidadMedida: 'metric',
        idioma: 'es',
        tema: 'dark',
        calidadVideo: 'alta',
        guardarVideos: true,
    },
    privacidad: {
        verAnalisis: 'solo',
        permitirComentarios: false,
        compartirProgreso: true,
    },
}

/* ── Dispositivos iniciales ── */
const INITIAL_DEVICES = [
    { id: 1, name: 'iPhone 14 Pro', icon: FaMobileScreenButton, meta: 'Hoy, 10:32 a.m. · Bogotá, CO', current: true },
    { id: 2, name: 'MacBook Pro', icon: FaLaptop, meta: 'Ayer, 08:15 p.m. · Cali, CO', current: false },
    { id: 3, name: 'iPad Air', icon: FaTabletScreenButton, meta: 'Hace 3 días · Medellín, CO', current: false },
]

const CONFIG_NAV = [
    { id: 'general', icon: FaGear, label: 'General' },
    { id: 'analisis', icon: FaCamera, label: 'Análisis' },
    { id: 'notificaciones', icon: FaBell, label: 'Notificaciones' },
    { id: 'privacidad', icon: FaLock, label: 'Privacidad' },
    { id: 'dispositivos', icon: FaDisplay, label: 'Dispositivos' },
    { id: 'ayuda', icon: FaCircleQuestion, label: 'Ayuda' },
]

export default function Configuracion() {
    const navigate = useRouter()

    const [activeSection, setActiveSection] = useState('general')
    const [config, setConfig] = useState(INITIAL_STATE)
    const [snapshot, setSnapshot] = useState(INITIAL_STATE)
    const [devices, setDevices] = useState(INITIAL_DEVICES)
    const [toast, setToast] = useState(null)
    const [modal, setModal] = useState(null) // { message, onConfirm }

    /* ── Toast ── */
    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }, [])

    /* ── Guardar general ── */
    function handleSaveGeneral() {
        setSnapshot(config)
        applyTheme(config.general.tema)
        showToast('✓ Configuración general guardada correctamente.', 'success')
    }

    /* ── Cancelar general ── */
    function handleCancelGeneral() {
        setConfig(snapshot)
        showToast('Cambios descartados.', 'info')
    }

    /* ── Aplicar tema ── */
    function applyTheme(tema) {
        const names = { dark: 'Oscuro', light: 'Claro', auto: 'Automático' }
        showToast(`Tema cambiado a: ${names[tema] ?? tema}`, 'info')
    }

    /* ── Cerrar sesión en dispositivo ── */
    function handleDeviceLogout(device) {
        setModal({
            message: `¿Cerrar sesión en ${device.name}?`,
            onConfirm: () => {
                setDevices(prev => prev.filter(d => d.id !== device.id))
                showToast(`Sesión cerrada en ${device.name}.`, 'success')
                setModal(null)
            },
        })
    }

    /* ── Cerrar sesión en todos ── */
    function handleLogoutAll() {
        setModal({
            message: '¿Cerrar sesión en todos los dispositivos?',
            onConfirm: () => {
                setDevices(prev => prev.filter(d => d.current))
                showToast('Sesión cerrada en todos los dispositivos.', 'success')
                setModal(null)
            },
        })
    }

    /* ── Cerrar sesión global ── */
    function handleGlobalLogout() {
        setModal({
            message: '¿Seguro que quieres cerrar sesión en VolleyScan?',
            onConfirm: () => {
                sessionStorage.clear()
                navigate('/')
            },
        })
    }

    const toastColors = { success: '#22c55e', error: '#ef4444', info: '#3b82f6' }

    return (
        <main className="main-content">

            <header className="page-header">
                <h1 className="page-header__title">Configuración</h1>
            </header>

            <div className="config-layout">

                {/* ── Nav lateral ── */}
                <aside className="config-sidebar">
                    <p className="config-sidebar__label">Configuración</p>
                    <ul className="config-nav__list">
                        {CONFIG_NAV.map(({ id, icon: Icon, label }) => (
                            <li key={id}
                                className={`config-nav__item${activeSection === id ? ' config-nav__item--active' : ''}`}>
                                <button
                                    className="config-nav__btn"
                                    type="button"
                                    onClick={() => setActiveSection(id)}
                                >
                                    <Icon size={18} aria-hidden="true" />
                                    <span>{label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>

                {/* ── Contenido ── */}
                <div className="config-content">

                    {/* GENERAL */}
                    {activeSection === 'general' && (
                        <section className="config-section active">
                            <div className="config-section__split">

                                <div className="config-main-col">
                                    <h2 className="config-section__title">General</h2>

                                    <SettingSelect label="Unidad de medida" id="unidadMedida"
                                        value={config.general.unidadMedida}
                                        onChange={v => setConfig(p => ({ ...p, general: { ...p.general, unidadMedida: v } }))}
                                        options={[{ value: 'metric', label: 'Métrico (kg, cm)' }, { value: 'imperial', label: 'Imperial (lb, ft)' }]}
                                    />

                                    <SettingSelect label="Idioma" id="idioma"
                                        value={config.general.idioma}
                                        onChange={v => setConfig(p => ({ ...p, general: { ...p.general, idioma: v } }))}
                                        options={[{ value: 'es', label: 'Español' }, { value: 'en', label: 'English' }, { value: 'pt', label: 'Português' }]}
                                    />

                                    <SettingSelect label="Tema" id="tema"
                                        value={config.general.tema}
                                        onChange={v => { setConfig(p => ({ ...p, general: { ...p.general, tema: v } })); applyTheme(v) }}
                                        options={[{ value: 'dark', label: 'Oscuro' }, { value: 'light', label: 'Claro' }, { value: 'auto', label: 'Automático' }]}
                                    />

                                    <SettingSelect label="Calidad de video para análisis" id="calidadVideo"
                                        value={config.general.calidadVideo}
                                        onChange={v => setConfig(p => ({ ...p, general: { ...p.general, calidadVideo: v } }))}
                                        options={[{ value: 'alta', label: 'Alta' }, { value: 'media', label: 'Media' }, { value: 'baja', label: 'Baja' }, { value: 'auto', label: 'Auto' }]}
                                        small
                                    />

                                    <SettingToggle
                                        label="Guardar videos automáticamente"
                                        desc="Los videos de análisis se guardan en tu historial"
                                        checked={config.general.guardarVideos}
                                        onChange={v => { setConfig(p => ({ ...p, general: { ...p.general, guardarVideos: v } })); showToast(`Guardar videos: ${v ? 'activado' : 'desactivado'}`, 'info') }}
                                    />

                                    <div className="form-actions">
                                        <button className="btn btn--secondary" type="button" onClick={handleCancelGeneral}>Cancelar</button>
                                        <button className="btn btn--primary" type="button" onClick={handleSaveGeneral}>Guardar cambios</button>
                                    </div>
                                </div>

                                {/* Privacidad rápida */}
                                <aside className="quick-privacy">
                                    <h3 className="quick-privacy__title">Privacidad rápida</h3>

                                    <div className="qp-group">
                                        <p className="setting-label">Quién puede ver mis análisis</p>
                                        <div className="select-wrap">
                                            <select className="field-select"
                                                value={config.privacidad.verAnalisis}
                                                onChange={e => setConfig(p => ({ ...p, privacidad: { ...p.privacidad, verAnalisis: e.target.value } }))}>
                                                <option value="solo">Solo yo</option>
                                                <option value="entrenador">Mi entrenador</option>
                                                <option value="equipo">Mi equipo</option>
                                                <option value="todos">Todos</option>
                                            </select>
                                            < FaChevronDown className="fa-solid select-icon" aria-hidden="true" />
                                        </div>
                                    </div>

                                    <div className="qp-toggle">
                                        <p className="setting-label">Permitir comentarios</p>
                                        <ToggleSwitch
                                            checked={config.privacidad.permitirComentarios}
                                            onChange={v => { setConfig(p => ({ ...p, privacidad: { ...p.privacidad, permitirComentarios: v } })); showToast(`Comentarios: ${v ? 'activados' : 'desactivados'}`, 'info') }}
                                        />
                                    </div>

                                    <div className="qp-toggle">
                                        <p className="setting-label">Compartir progreso</p>
                                        <ToggleSwitch
                                            checked={config.privacidad.compartirProgreso}
                                            onChange={v => { setConfig(p => ({ ...p, privacidad: { ...p.privacidad, compartirProgreso: v } })); showToast(`Compartir progreso: ${v ? 'activado' : 'desactivado'}`, 'info') }}
                                        />
                                    </div>

                                    <hr className="divider" />
                                    <Link href="/login">  <button className="btn--logout" type="button">
                                        Cerrar sesión
                                    </button></Link>
                                </aside>

                            </div>
                        </section>
                    )}

                    {/* ANÁLISIS */}
                    {activeSection === 'analisis' && (
                        <section className="config-section active">
                            <h2 className="config-section__title">Análisis</h2>
                            <SettingToggle label="Detección de pose en tiempo real" desc="Muestra el esqueleto de pose mientras grabas" checked={true} onChange={v => showToast(`Detección de pose: ${v ? 'activada' : 'desactivada'}`, 'info')} />
                            <SettingToggle label="Alertas de errores durante análisis" desc="Resalta en rojo las articulaciones con error" checked={true} onChange={v => showToast(`Alertas: ${v ? 'activadas' : 'desactivadas'}`, 'info')} />
                            <SettingToggle label="Análisis automático al subir video" desc="Procesa el video sin confirmación adicional" checked={false} onChange={v => showToast(`Análisis automático: ${v ? 'activado' : 'desactivado'}`, 'info')} />
                            <SettingSelect label="Sensibilidad de detección" id="sensibilidad" value="media"
                                onChange={v => showToast(`Sensibilidad: ${v}`, 'info')}
                                options={[{ value: 'alta', label: 'Alta (más errores detectados)' }, { value: 'media', label: 'Media (recomendado)' }, { value: 'baja', label: 'Baja (solo errores críticos)' }]}
                            />
                            <div className="form-actions">
                                <button className="btn btn--secondary" type="button">Cancelar</button>
                                <button className="btn btn--primary" type="button" onClick={() => showToast('✓ Configuración de análisis guardada.', 'success')}>Guardar cambios</button>
                            </div>
                        </section>
                    )}

                    {/* NOTIFICACIONES */}
                    {activeSection === 'notificaciones' && (
                        <section className="config-section active">
                            <h2 className="config-section__title">Notificaciones</h2>
                            <SettingToggle label="Notificaciones push" desc="Recibe alertas en tu dispositivo" checked={true} onChange={v => showToast(`Push: ${v ? 'activadas' : 'desactivadas'}`, 'info')} />
                            <SettingToggle label="Recordatorio de entrenamiento" desc="Te avisa cuando es hora de entrenar" checked={true} onChange={v => showToast(`Recordatorio: ${v ? 'activado' : 'desactivado'}`, 'info')} />
                            <SettingToggle label="Resumen semanal" desc="Email con tu progreso de la semana" checked={false} onChange={v => showToast(`Resumen semanal: ${v ? 'activado' : 'desactivado'}`, 'info')} />
                            <SettingToggle label="Logros y medallas" desc="Notificación al desbloquear un logro" checked={true} onChange={v => showToast(`Logros: ${v ? 'activados' : 'desactivados'}`, 'info')} />
                            <div className="setting-row">
                                <label className="setting-label" htmlFor="horaRecordatorio">Hora del recordatorio diario</label>
                                <input className="field-input field-input--sm" type="time" id="horaRecordatorio" defaultValue="08:00" />
                            </div>
                            <div className="form-actions">
                                <button className="btn btn--secondary" type="button">Cancelar</button>
                                <button className="btn btn--primary" type="button" onClick={() => showToast('✓ Notificaciones guardadas.', 'success')}>Guardar cambios</button>
                            </div>
                        </section>
                    )}

                    {/* PRIVACIDAD */}
                    {activeSection === 'privacidad' && (
                        <section className="config-section active">
                            <h2 className="config-section__title">Privacidad</h2>
                            <SettingSelect label="Visibilidad del perfil" id="visibilidadPerfil" value="privado"
                                onChange={v => showToast(`Visibilidad: ${v}`, 'info')}
                                options={[{ value: 'privado', label: 'Privado' }, { value: 'entrenador', label: 'Solo entrenador' }, { value: 'publico', label: 'Público' }]}
                            />
                            <SettingToggle label="Compartir datos para mejorar la IA" desc="Tus datos se usan de forma anónima" checked={true} onChange={v => showToast(`Compartir datos: ${v ? 'activado' : 'desactivado'}`, 'info')} />
                            <SettingToggle label="Análisis de uso de la app" desc="Ayúdanos a mejorar la experiencia" checked={false} onChange={v => showToast(`Análisis de uso: ${v ? 'activado' : 'desactivado'}`, 'info')} />
                            <div className="form-actions">
                                <button className="btn btn--secondary" type="button">Cancelar</button>
                                <button className="btn btn--primary" type="button" onClick={() => showToast('✓ Privacidad guardada.', 'success')}>Guardar cambios</button>
                            </div>
                        </section>
                    )}

                    {/* DISPOSITIVOS */}
                    {activeSection === 'dispositivos' && (
                        <section className="config-section active">
                            <h2 className="config-section__title">Dispositivos conectados</h2>
                            <ul className="device-list">
                                {devices.map(({ id, icon: Icon, name, meta, current }) => (
                                    <li key={id} className="device-item">
                                        <div className="device-item__icon">
                                            <Icon size={22} />
                                        </div>
                                        <div className="device-item__info">
                                            <p className="device-item__name">{name}</p>
                                            <p className="device-item__meta">Último acceso: {meta}</p>
                                        </div>
                                        {current
                                            ? <span className="device-badge">Este dispositivo</span>
                                            : <button className="btn btn--danger-outline btn--sm" type="button" onClick={() => handleDeviceLogout({ id, name, meta, current })}>Cerrar sesión</button>
                                        }
                                    </li>
                                ))}
                            </ul>
                            <div className="form-actions" style={{ marginTop: '20px' }}>
                                <button className="btn btn--danger-outline" type="button" onClick={handleLogoutAll}>
                                    <i className="fa-solid fa-right-from-bracket" /> Cerrar sesión en todos los dispositivos
                                </button>
                            </div>
                        </section>
                    )}

                    {/* AYUDA */}
                    {activeSection === 'ayuda' && (
                        <section className="config-section active">
                            <h2 className="config-section__title">Ayuda y soporte</h2>
                            <ul className="help-list">
                                {[
                                    { icon: FaBook, title: 'Centro de ayuda', desc: 'Guías y preguntas frecuentes' },
                                    { icon: FaEnvelope, title: 'Contactar soporte', desc: 'soporte@volleyscan.app' },
                                    { icon: FaBug, title: 'Reportar un problema', desc: 'Cuéntanos qué no funciona' },
                                    { icon: FaCircleInfo, title: 'Versión de la app', desc: 'VolleyScan v2.4.1 · Build 241' },
                                ].map(item => {
                                    const Icon = item.icon;
                                    <li key={item.title} className="help-item" onClick={() => showToast(`Abriendo: ${item.title}…`, 'info')}>
                                        <div className="help-item__icon"><i className={`fa-solid ${item.icon}`} /></div>
                                        <div className="help-item__info">
                                            <p className="help-item__title">{item.title}</p>
                                            <p className="help-item__desc">{item.desc}</p>
                                        </div>
                                        <FaChevronRight
                                            className="help-item__arrow"
                                            size={16}
                                        />
                                    </li>
                                })}
                            </ul>
                        </section>
                    )}

                </div>
            </div>

            {/* Modal */}
            {modal && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
                    <div className="modal">
                        <h3 className="modal__title">¿Confirmar acción?</h3>
                        <p className="modal__body">{modal.message}</p>
                        <div className="modal__actions">
                            <button className="btn btn--secondary" type="button" onClick={() => setModal(null)}>Cancelar</button>
                            <button className="btn btn--danger" type="button" onClick={modal.onConfirm}>Confirmar</button>
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

/* ── Componentes auxiliares ── */

function SettingSelect({ label, id, value, onChange, options, small }) {
    return (
        <div className="setting-row">
            <label className="setting-label" htmlFor={id}>{label}</label>
            <div className={`select-wrap${small ? ' select-wrap--sm' : ''}`}>
                <select className="field-select" id={id} value={value}
                    onChange={e => onChange(e.target.value)}>
                    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <FaChevronDown className="fa-solid select-icon" aria-hidden="true" />
            </div>
        </div>
    )
}

function SettingToggle({ label, desc, checked, onChange }) {
    return (
        <div className="setting-row setting-row--toggle">
            <div className="setting-row__info">
                <p className="setting-label">{label}</p>
                {desc && <p className="setting-desc">{desc}</p>}
            </div>
            <ToggleSwitch checked={checked} onChange={onChange} />
        </div>
    )
}

function ToggleSwitch({ checked, onChange }) {
    return (
        <label className="toggle-switch">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
            <span className="toggle-thumb" />
        </label>
    )
}