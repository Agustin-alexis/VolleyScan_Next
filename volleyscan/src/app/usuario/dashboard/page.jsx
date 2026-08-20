"use client";

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import './Dashboard.css'

import {
    FaBell,
    FaBullseye,
    FaCamera,
    Fafire,
    FaDumbbell,
} from 'react-icons/fa';
import { FaArrowTrendUp, FaFire, FaClockRotateLeft, FaCalendarCheck } from 'react-icons/fa6';

const STATS = [
    {
        label: 'Progreso general',
        value: '78%',
        delta: '↑ 12%',
        compare: 'vs. semana pasada',
        color: 'stat-icon--blue',
        sparkline: true,
        icon: FaArrowTrendUp,
    },
    {
        label: 'Sesiones completadas',
        value: '12',
        delta: '↑ 2',
        compare: 'esta semana',
        color: 'stat-icon--green',
        icon: FaBullseye,
    },
    {
        label: 'Racha actual',
        value: '5 días',
        delta: null,
        compare: '¡Sigue así!',
        color: 'stat-icon--orange',
        icon: FaFire,
    },
]

const QUICK_BTNS = [
    { label: 'Iniciar análisis', icon: FaCamera, className: 'quick-btn--blue', to: '/usuario/analisis' },
    { label: 'Ver historial', icon: FaClockRotateLeft, className: 'quick-btn--dark', to: '/usuario/historial' },
    { label: 'Rutina del día', icon: FaCalendarCheck, className: 'quick-btn--green', to: '/usuario/rutinas' },
    { label: 'Ejercicios', icon: FaDumbbell, className: 'quick-btn--purple', to: '/usuario/contenido' },
]

export default function Dashboard() {
    const router = useRouter()
    const sparkRef = useRef(null)
    const donutRef = useRef(null)
    const [notifVisible, setNotifVisible] = useState(true)
    const [toast, setToast] = useState(null)

    /* ── Sparkline ── */
    useEffect(() => {
        const canvas = sparkRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        const W = canvas.width, H = canvas.height
        const data = [52, 58, 61, 55, 68, 72, 78]
        const min = Math.min(...data) - 5
        const max = Math.max(...data) + 5
        const stepX = W / (data.length - 1)
        const points = data.map((v, i) => ({
            x: i * stepX,
            y: H - ((v - min) / (max - min)) * H,
        }))
        const grad = ctx.createLinearGradient(0, 0, 0, H)
        grad.addColorStop(0, 'rgba(59,130,246,.5)')
        grad.addColorStop(1, 'rgba(59,130,246,0)')
        ctx.beginPath()
        ctx.moveTo(points[0].x, H)
        points.forEach(p => ctx.lineTo(p.x, p.y))
        ctx.lineTo(points[points.length - 1].x, H)
        ctx.closePath()
        ctx.fillStyle = grad
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        points.forEach(p => ctx.lineTo(p.x, p.y))
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 2
        ctx.lineJoin = 'round'
        ctx.stroke()
    }, [])

    /* ── Donut animado ── */
    useEffect(() => {
        const circle = donutRef.current
        if (!circle) return
        const circ = 2 * Math.PI * 34
        const offset = circ - (85 / 100) * circ
        circle.style.strokeDasharray = circ
        circle.style.strokeDashoffset = circ
        setTimeout(() => {
            circle.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)'
            circle.style.strokeDashoffset = offset
        }, 300)
    }, [])

    /* ── Toast ── */
    function showToast(message) {
        setToast(message)
        setTimeout(() => setToast(null), 2500)
    }

    return (
        <main className="main-content">

            {/* Header */}
            <header className="dashboard__header">
                <div className="welcome">
                    <h1 className="welcome__title">¡Hola, Juan! 👋</h1>
                    <p className="welcome__subtitle">Sigue entrenando y mejora cada día.</p>
                </div>
                <button className="btn-notification" aria-label="Ver notificaciones"
                    onClick={() => { setNotifVisible(false); router.push('/usuario/notificaciones') }}>
                    <FaBell />

                    {notifVisible && <span className="notification-dot" aria-hidden="true">3</span>}
                </button>
            </header>

            {/* Stats */}
            <section className="stats-grid" aria-label="Estadísticas principales">
                {STATS.map(stat => {
                    const Icon = stat.icon;

                    return (
                        <article className="stat-card" key={stat.label}>
                            <div className={`stat-card__icon ${stat.color}`} aria-hidden="true">
                                {Icon && <Icon size={22} />}
                            </div>
                            <div className="stat-card__info">
                                <p className="stat-card__label">{stat.label}</p>
                                <p className="stat-card__value">
                                    {stat.value}
                                    {stat.delta && <span className="stat-card__delta stat-card__delta--up">{stat.delta}</span>}
                                </p>
                                <p className="stat-card__compare">{stat.compare}</p>
                                {stat.sparkline && (
                                    <figure className="stat-card__sparkline" aria-label="Gráfica de tendencia">
                                        <canvas ref={sparkRef} width="120" height="30" />
                                    </figure>
                                )}
                            </div>
                        </article>
                    );
                })}
            </section>

            {/* Mid row */}
            <section className="mid-row" aria-label="Análisis y rutina del día">

                <article className="card1 card--analysis">
                    <header className="card__header-1">
                        <h2 className="card__title-1">Último análisis</h2>
                    </header>
                    <div className="analysis__body">
                        <div className="analysis__info">
                            <p className="analysis__name">Remate por zona 4</p>
                            <p className="analysis__time">Hace 2 horas</p>
                            <figure className="analysis__image">
                                <Image
                                    src=""
                                    alt="Remate de voleibol zona 4"
                                    width={250}
                                />
                            </figure>
                        </div>
                        <div className="analysis__score-wrap" aria-label="Puntuación: 85 de 100">
                            <svg className="donut" viewBox="0 0 80 80" aria-hidden="true">
                                <circle className="donut__bg" cx="40" cy="40" r="34" />
                                <circle className="donut__fill" cx="40" cy="40" r="34" ref={donutRef} />
                            </svg>
                            <div className="donut__label">
                                <span className="donut__value">85</span>
                                <span className="donut__max">/100</span>
                            </div>
                        </div>
                    </div>
                </article>

                <article className="card1 card--routine">
                    <header className="card__header">
                        <h2 className="card__title-1">Rutina del día</h2>
                    </header>
                    <div className="routine__body">
                        <p className="routine__name-1">Recepción + Pase</p>
                        <p className="routine__exercises">3 ejercicios</p>
                        <div className="routine__previews" aria-hidden="true">
                            <span className="routine__thumb" />
                            <span className="routine__thumb" />
                            <span className="routine__thumb" />
                        </div>
                        <button className="btn btn--primary" type="button"
                            onClick={() => router.push('/usuario/rutinas')}>
                            Ver rutina
                        </button>
                    </div>
                </article>

            </section>

            {/* Accesos rápidos */}
            <section className="quick-access" aria-label="Accesos rápidos">
                <h2 className="quick-access__title">Accesos rápidos</h2>
                <div className="quick-access__grid">
                    {QUICK_BTNS.map(btn => {
                        const QuickIcon = btn.icon;

                        return (
                            <button
                                key={btn.label}
                                className={`quick-btn ${btn.className}`}
                                type="button"
                                aria-label={btn.label}
                                onClick={() => { showToast(`Abriendo: ${btn.label}`); router.push(btn.to) }}
                            >
                                <QuickIcon size={22} aria-hidden="true" />
                                <span>{btn.label}</span>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Toast */}
            {toast && (
                <div className="toast" role="status" aria-live="polite">
                    {toast}
                </div>
            )}

        </main>
    )
}