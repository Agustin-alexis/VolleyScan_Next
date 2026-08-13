"use client";

import { useState } from 'react';
import Link from 'next/link';
import './notificaciones.css'

/* ── Datos ── */
const INITIAL_NOTIFICATIONS = [
    { id: 1, type: 'logro', unread: true, title: '¡Buen trabajo! 🏆', msg: 'Has mejorado tu puntuación promedio en un 15% esta semana.', time: 'Hace 2 horas' },
    { id: 2, type: 'rutina', unread: true, title: 'Nueva rutina disponible', msg: 'Tu entrenador ha creado una nueva rutina para ti.', time: 'Hace 1 día' },
    { id: 3, type: 'racha', unread: true, title: 'Racha en progreso 🔥', msg: 'Llevas 5 días entrenando seguidos. ¡Sigue así!', time: 'Hace 1 día' },
    { id: 4, type: 'recordatorio', unread: false, title: 'Recordatorio', msg: 'No olvides realizar tu rutina diaria.', time: 'Hace 2 días' },
    { id: 5, type: 'analisis', unread: false, title: 'Análisis completado ⚡', msg: 'Tu análisis de "Remate por zona 4" ya está listo. Puntuación: 85/100.', time: 'Hace 3 días' },
    { id: 6, type: 'logro', unread: false, title: 'Nuevo logro desbloqueado 🎖️', msg: 'Has completado 10 sesiones de análisis. ¡Eres constante!', time: 'Hace 4 días' },
]

const RECOMMENDATIONS = [
    { id: 1, title: 'Enfócate en tu salto', desc: 'Mejora la altura y la explosividad.', img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=75', link: '/usuario/rutinas' },
    { id: 2, title: 'Trabaja tu recepción', desc: 'Practica la plataforma más baja.', img: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&q=75', link: '/usuario/rutinas' },
    { id: 3, title: 'Analiza tu saque', desc: 'Detecta errores con la IA en tiempo real.', img: 'https://images.unsplash.com/photo-1547347298-4074fc3086f0?w=400&q=75', link: '/usuario/analisis' },
]

const ICONS = {
    logro: 'fa-trophy',
    rutina: 'fa-star',
    racha: 'fa-fire',
    recordatorio: 'fa-lock',
    analisis: 'fa-bolt',
}

const FILTERS = [
    { value: 'all', label: 'Todas' },
    { value: 'unread', label: 'Sin leer' },
    { value: 'logro', label: 'Logros' },
    { value: 'rutina', label: 'Rutinas' },
    { value: 'racha', label: 'Rachas' },
    { value: 'recordatorio', label: 'Recordatorios' },
]

export default function Notificaciones() {
    const [notifications, setNotifications] = useState(
        INITIAL_NOTIFICATIONS.map(n => ({ ...n }))
    )
    const [currentFilter, setCurrentFilter] = useState('all')
    const [toast, setToast] = useState(null)
    const [dismissing, setDismissing] = useState(new Set())

    /* ── Toast ── */
    function showToast(message, type = 'success') {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    /* ── Filtrado ── */
    function getFiltered() {
        if (currentFilter === 'all') return notifications
        if (currentFilter === 'unread') return notifications.filter(n => n.unread)
        return notifications.filter(n => n.type === currentFilter)
    }

    const filtered = getFiltered()
    const unreadCount = notifications.filter(n => n.unread).length

    /* ── Marcar como leída ── */
    function markAsRead(id) {
        const notif = notifications.find(n => n.id === id)
        if (!notif || !notif.unread) return
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n))
        showToast('Notificación marcada como leída.', 'info')
    }

    /* ── Eliminar ── */
    function dismissNotif(id) {
        setDismissing(prev => new Set([...prev, id]))
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id))
            setDismissing(prev => { const s = new Set(prev); s.delete(id); return s })
        }, 320)
    }

    /* ── Marcar todas como leídas ── */
    function markAllRead() {
        const unread = notifications.filter(n => n.unread)
        if (unread.length === 0) { showToast('No hay notificaciones sin leer.', 'info'); return }
        setNotifications(prev => prev.map(n => ({ ...n, unread: false })))
        const c = unread.length
        showToast(`✓ ${c} notificación${c > 1 ? 'es' : ''} marcada${c > 1 ? 's' : ''} como leída${c > 1 ? 's' : ''}.`, 'success')
    }

    /* ── Limpiar todas ── */
    function clearAll() {
        if (notifications.length === 0) { showToast('No hay notificaciones que limpiar.', 'info'); return }
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
                                <i className="fa-solid fa-check-double" /> Marcar todas como leídas
                            </button>
                            <button className="btn-text btn-text--danger" type="button" onClick={clearAll}>
                                <i className="fa-solid fa-trash-can" /> Limpiar
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
                    {filtered.length === 0 ? (
                        <div className="empty-state">
                            <i className="fa-solid fa-bell-slash" />
                            <p>No hay notificaciones aquí.</p>
                        </div>
                    ) : (
                        <ol className="notif-list" aria-label="Lista de notificaciones">
                            {filtered.map((notif, i) => (
                                <li
                                    key={notif.id}
                                    className={`notif-item ${notif.unread ? 'unread' : 'read'}${dismissing.has(notif.id) ? ' dismissing' : ''}`}
                                    style={{ animationDelay: `${i * 50}ms` }}
                                    onClick={() => { if (notif.unread) markAsRead(notif.id) }}
                                >
                                    <div className={`notif-icon notif-icon--${notif.type}`} aria-hidden="true">
                                        <i className={`fa-solid ${ICONS[notif.type] ?? 'fa-bell'}`} />
                                    </div>
                                    <div className="notif-body">
                                        <p className="notif-body__title">{notif.title}</p>
                                        <p className="notif-body__msg">{notif.msg}</p>
                                        <p className="notif-body__time">
                                            <i className="fa-regular fa-clock" aria-hidden="true" /> {notif.time}
                                        </p>
                                    </div>
                                    <div className="notif-item__actions">
                                        {notif.unread && (
                                            <button className="btn-icon btn-icon--read" type="button"
                                                title="Marcar como leída"
                                                aria-label="Marcar como leída"
                                                onClick={e => { e.stopPropagation(); markAsRead(notif.id) }}>
                                                <i className="fa-solid fa-check" />
                                            </button>
                                        )}
                                        <button className="btn-icon btn-icon--delete" type="button"
                                            title="Eliminar"
                                            aria-label="Eliminar notificación"
                                            onClick={e => { e.stopPropagation(); dismissNotif(notif.id) }}>
                                            <i className="fa-solid fa-xmark" />
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
                                        Ver ejercicios <i className="fa-solid fa-arrow-right" />
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