"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import './notificaciones.css'
import {
    FaBell,
    FaTrophy,
    FaStar,
    FaFire,
    FaLock,
    FaBolt,
    FaCheckDouble,
    FaBellSlash,
    FaClock,
    FaCheck,
    FaArrowRight,
    FaUserCheck,
} from 'react-icons/fa'
import { FaTrashCan, FaXmark } from 'react-icons/fa6';
import {
    eliminarAviso,
    eliminarTodosLosAvisos,
    listarAvisos,
    marcarAviso,
    marcarTodosLosAvisos,
} from '@/lib/avisos/api';

/* Esta página trabaja sobre TODAS las notificaciones del usuario */
const TODAS = { todas: true }

/* ── Recomendaciones (por ahora fijas) ── */
const RECOMMENDATIONS = [
    { id: 1, title: 'Enfócate en tu salto', desc: 'Mejora la altura y la explosividad.', img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=75', link: '/usuario/rutinas' },
    { id: 2, title: 'Trabaja tu recepción', desc: 'Practica la plataforma más baja.', img: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&q=75', link: '/usuario/rutinas' },
    { id: 3, title: 'Analiza tu saque', desc: 'Detecta errores con la IA en tiempo real.', img: 'https://images.unsplash.com/photo-1547347298-4074fc3086f0?w=400&q=75', link: '/usuario/analisis' },
]

const ICONS = {
    logro: FaTrophy,
    rutina: FaStar,
    racha: FaFire,
    recordatorio: FaLock,
    analisis: FaBolt,
    vinculo: FaUserCheck,
}

const FILTERS = [
    { value: 'all', label: 'Todas' },
    { value: 'unread', label: 'Sin leer' },
    { value: 'logro', label: 'Logros' },
    { value: 'rutina', label: 'Rutinas' },
    { value: 'racha', label: 'Rachas' },
    { value: 'analisis', label: 'Análisis' },
    { value: 'vinculo', label: 'Entrenador' },
    { value: 'recordatorio', label: 'Recordatorios' },
]

/* Segundos → "Hace 2 horas" */
function haceTexto(seg) {
    const plural = (n, uno, varios) => `Hace ${n} ${n === 1 ? uno : varios}`
    if (seg < 60) return 'Hace un momento'
    const min = Math.floor(seg / 60)
    if (min < 60) return plural(min, 'minuto', 'minutos')
    const h = Math.floor(min / 60)
    if (h < 24) return plural(h, 'hora', 'horas')
    const d = Math.floor(h / 24)
    if (d < 7) return plural(d, 'día', 'días')
    const sem = Math.floor(d / 7)
    if (sem < 5) return plural(sem, 'semana', 'semanas')
    return plural(Math.floor(d / 30) || 1, 'mes', 'meses')
}

/* Respuesta de la API → forma que usa la lista */
const aItem = (a) => ({
    id: a.id,
    type: a.tipo,
    unread: !a.leida,
    title: a.titulo,
    msg: a.mensaje,
    time: haceTexto(a.haceSeg ?? 0),
    link: a.enlace || null,
})

export default function Notificaciones() {
    const router = useRouter()
    const [notifications, setNotifications] = useState([])
    const [estado, setEstado] = useState('cargando') // cargando | listo | error
    const [currentFilter, setCurrentFilter] = useState('all')
    const [toast, setToast] = useState(null)
    const [dismissing, setDismissing] = useState(new Set())

    /* ── Toast ── */
    function showToast(message, type = 'success') {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    /* ── Carga ── */
    const cargar = useCallback(async () => {
        const r = await listarAvisos({ ...TODAS, limite: 100 })
        if (r.ok) {
            setNotifications((r.data.avisos ?? []).map(aItem))
            setEstado('listo')
        } else {
            setEstado('error')
        }
    }, [])

    useEffect(() => { cargar() }, [cargar])

    /* ── Filtrado ── */
    function getFiltered() {
        if (currentFilter === 'all') return notifications
        if (currentFilter === 'unread') return notifications.filter(n => n.unread)
        return notifications.filter(n => n.type === currentFilter)
    }

    const filtered = getFiltered()
    const unreadCount = notifications.filter(n => n.unread).length

    /* ── Marcar como leída ── */
    async function markAsRead(id, { aviso = true } = {}) {
        const notif = notifications.find(n => n.id === id)
        if (!notif || !notif.unread) return
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n))
        const r = await marcarAviso(id, TODAS)
        if (!r.ok) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: true } : n))
            showToast('No se pudo marcar como leída.', 'error')
        } else if (aviso) {
            showToast('Notificación marcada como leída.', 'info')
        }
    }

    /* ── Abrir: marca como leída y, si trae enlace, navega ── */
    function abrir(notif) {
        if (notif.unread) markAsRead(notif.id, { aviso: false })
        if (notif.link) router.push(notif.link)
    }

    /* ── Eliminar ── */
    async function dismissNotif(id) {
        const r = await eliminarAviso(id)
        if (!r.ok && r.status !== 404) { showToast('No se pudo eliminar.', 'error'); return }
        setDismissing(prev => new Set([...prev, id]))
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id))
            setDismissing(prev => { const s = new Set(prev); s.delete(id); return s })
        }, 320)
    }

    /* ── Marcar todas como leídas ── */
    async function markAllRead() {
        const unread = notifications.filter(n => n.unread)
        if (unread.length === 0) { showToast('No hay notificaciones sin leer.', 'info'); return }
        const r = await marcarTodosLosAvisos(TODAS)
        if (!r.ok) { showToast('No se pudieron marcar como leídas.', 'error'); return }
        setNotifications(prev => prev.map(n => ({ ...n, unread: false })))
        const c = unread.length
        showToast(`✓ ${c} notificación${c > 1 ? 'es' : ''} marcada${c > 1 ? 's' : ''} como leída${c > 1 ? 's' : ''}.`, 'success')
    }

    /* ── Limpiar todas ── */
    async function clearAll() {
        if (notifications.length === 0) { showToast('No hay notificaciones que limpiar.', 'info'); return }
        const r = await eliminarTodosLosAvisos(TODAS)
        if (!r.ok) { showToast('No se pudieron eliminar.', 'error'); return }
        const ids = new Set(notifications.map(n => n.id))
        setDismissing(ids)
        setTimeout(() => {
            setNotifications([])
            setDismissing(new Set())
            showToast('Todas las notificaciones eliminadas.', 'success')
        }, 340)
    }

    const toastColors = { success: '#22c55e', error: '#ef4444', info: '#3b82f6' }

    return (
        <main className="main-content">

            <header className="page-header">
                <h1 className="page-header__title">Notificaciones y Feedback</h1>
            </header>

            <div className="notif-layout">

                {/* ── Columna izquierda ── */}
                <section className="notif-panel" aria-label="Notificaciones">

                    {/* Header */}
                    <div className="notif-panel__header">
                        <h2 className="notif-panel__title">
                            Notificaciones
                            {unreadCount > 0 && (
                                <span className="notif-count-badge">{unreadCount}</span>
                            )}
                        </h2>
                        <div className="notif-panel__actions">
                            <button className="btn-text" type="button" onClick={markAllRead}>
                                <FaCheckDouble /> Marcar todas como leídas
                            </button>
                            <button className="btn-text btn-text--danger" type="button" onClick={clearAll}>
                                <FaTrashCan /> Limpiar
                            </button>
                        </div>
                    </div>

                    {/* Filtros */}
                    <div className="notif-filters" role="group" aria-label="Filtrar notificaciones">
                        {FILTERS.map(f => (
                            <button
                                key={f.value}
                                className={`filter-chip${currentFilter === f.value ? ' filter-chip--active' : ''}`}
                                type="button"
                                onClick={() => setCurrentFilter(f.value)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* Lista */}
                    {estado === 'cargando' ? (
                        <div className="empty-state" role="status">
                            <FaBell />
                            <p>Cargando notificaciones…</p>
                        </div>
                    ) : estado === 'error' ? (
                        <div className="empty-state" role="alert">
                            <FaBellSlash />
                            <p>No se pudieron cargar las notificaciones.</p>
                            <button className="btn-text" type="button" onClick={() => { setEstado('cargando'); cargar() }}>
                                Reintentar
                            </button>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="empty-state">
                            <FaBellSlash />
                            <p>No hay notificaciones aquí.</p>
                        </div>
                    ) : (
                        <ol className="notif-list" aria-label="Lista de notificaciones">
                            {filtered.map((notif, i) => (
                                <li
                                    key={notif.id}
                                    className={`notif-item ${notif.unread ? 'unread' : 'read'}${dismissing.has(notif.id) ? ' dismissing' : ''}`}
                                    style={{ animationDelay: `${i * 50}ms` }}
                                    onClick={() => abrir(notif)}
                                >
                                    <div className={`notif-icon notif-icon--${notif.type}`} aria-hidden="true">
                                        {(() => {
                                            const Icon = ICONS[notif.type] ?? FaBell;
                                            return <Icon size={22} />;
                                        })()}
                                    </div>
                                    <div className="notif-body">
                                        <p className="notif-body__title">{notif.title}</p>
                                        <p className="notif-body__msg">{notif.msg}</p>
                                        <p className="notif-body__time">
                                            <FaClock aria-hidden="true" /> {notif.time}
                                        </p>
                                    </div>
                                    <div className="notif-item__actions">
                                        {notif.unread && (
                                            <button className="btn-icon btn-icon--read" type="button"
                                                title="Marcar como leída"
                                                aria-label="Marcar como leída"
                                                onClick={e => { e.stopPropagation(); markAsRead(notif.id) }}>
                                                <FaCheck />
                                            </button>
                                        )}
                                        <button className="btn-icon btn-icon--delete" type="button"
                                            title="Eliminar"
                                            aria-label="Eliminar notificación"
                                            onClick={e => { e.stopPropagation(); dismissNotif(notif.id) }}>
                                            <FaXmark />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}

                </section>

                {/* ── Columna derecha: recomendaciones ── */}
                <aside className="recommendations-panel" aria-label="Recomendaciones personalizadas">
                    <h2 className="recommendations-panel__title">Recomendaciones para ti</h2>
                    <ul className="rec-list">
                        {RECOMMENDATIONS.map(rec => (
                            <li key={rec.id} className="rec-item">
                                <img className="rec-item__thumb" src={rec.img} alt={rec.title} loading="lazy" />
                                <div className="rec-item__body">
                                    <p className="rec-item__title">{rec.title}</p>
                                    <p className="rec-item__desc">{rec.desc}</p>
                                    <Link className="rec-item__link" href={rec.link}>
                                        Ver ejercicios <FaArrowRight />
                                    </Link>
                                </div>
                            </li>
                        ))}
                    </ul>
                </aside>

            </div>

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
