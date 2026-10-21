"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import voleibol from '@/app/public/img/voleibol.jpg';
import { useApi } from '@/lib/UseApi';
import { haceCuanto } from '@/lib/formato';
import './Dashboard.css';

import {
    FaBell,
    FaBullseye,
    FaCamera,
    FaDumbbell,
} from 'react-icons/fa';
import { FaArrowTrendUp, FaFire, FaClockRotateLeft, FaCalendarCheck } from 'react-icons/fa6';

const QUICK_BTNS = [
    { label: 'Iniciar análisis', icon: FaCamera, className: 'quick-btn--blue', to: '/usuario/analisis' },
    { label: 'Ver historial', icon: FaClockRotateLeft, className: 'quick-btn--dark', to: '/usuario/historial' },
    { label: 'Rutina del día', icon: FaCalendarCheck, className: 'quick-btn--green', to: '/usuario/rutinas' },
    { label: 'Ejercicios', icon: FaDumbbell, className: 'quick-btn--purple', to: '/usuario/contenido' },
];

export default function Dashboard() {
    const router = useRouter();
    const sparkRef = useRef(null);
    const donutRef = useRef(null);
    const [notifVisible, setNotifVisible] = useState(true);
    const [toast, setToast] = useState(null);

    // 1. Petición al backend
    const { data, cargando, error } = useApi("/usuario/dashboard/");

    /* ── Sparkline conectado a progreso.tendencia ── */
    useEffect(() => {
        if (!data) return;
        const canvas = sparkRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;

        // Usa la lista de números del backend, o una por defecto si aún tiene menos de 2 datos
        const tendencia = data.progreso?.tendencia?.length > 1
            ? data.progreso.tendencia
            : [52, 58, 61, 55, 68, 72, data.progreso?.valor ?? 78];

        ctx.clearRect(0, 0, W, H);
        const min = Math.min(...tendencia) - 5;
        const max = Math.max(...tendencia) + 5;
        const stepX = W / (tendencia.length - 1);
        const points = tendencia.map((v, i) => ({
            x: i * stepX,
            y: H - ((v - min) / (max - min || 1)) * H,
        }));

        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, 'rgba(59,130,246,.5)');
        grad.addColorStop(1, 'rgba(59,130,246,0)');

        ctx.beginPath();
        ctx.moveTo(points[0].x, H);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, H);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();
    }, [data]);

    /* ── Donut animado conectado a ultimo_analisis.puntuacion ── */
    useEffect(() => {
        if (!data?.ultimo_analisis) return;
        const circle = donutRef.current;
        if (!circle) return;
        const puntuacion = data.ultimo_analisis.puntuacion ?? 0;
        const circ = 2 * Math.PI * 34;
        const offset = circ - (puntuacion / 100) * circ;
        circle.style.strokeDasharray = circ;
        circle.style.strokeDashoffset = circ;
        setTimeout(() => {
            circle.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)';
            circle.style.strokeDashoffset = offset;
        }, 300);
    }, [data]);

    /* ── Toast ── */
    function showToast(message) {
        setToast(message);
        setTimeout(() => setToast(null), 2500);
    }

    // Estados de carga y error mientras responde la API
    if (cargando) {
        return (
            <main className="main-content">
                <p style={{ padding: '2rem', color: '#94a3b8' }}>Cargando…</p>
            </main>
        );
    }

    if (error || !data) {
        return (
            <main className="main-content">
                <p style={{ padding: '2rem', color: '#f87171' }}>No se pudo cargar el dashboard.</p>
            </main>
        );
    }

    // 2. Desestructuramos los datos que llegan de la API
    const { usuario, progreso, sesiones, racha_dias, ultimo_analisis, rutina_del_dia } = data;

    // 3. Armamos las tarjetas de estadísticas con los datos reales
    const statsDinamicos = [
        {
            label: 'Progreso general',
            value: `${progreso?.valor ?? '—'}%`,
            delta: progreso?.variacion != null ? `↑ ${progreso.variacion}%` : null,
            compare: 'vs. semana pasada',
            color: 'stat-icon--blue',
            sparkline: true,
            icon: FaArrowTrendUp,
        },
        {
            label: 'Sesiones completadas',
            value: `${sesiones?.semana ?? 0}`,
            delta: sesiones?.variacion != null ? `↑ ${sesiones.variacion}` : null,
            compare: 'esta semana',
            color: 'stat-icon--green',
            icon: FaBullseye,
        },
        {
            label: 'Racha actual',
            value: `${racha_dias ?? 0} días`,
            delta: null,
            compare: '¡Sigue así!',
            color: 'stat-icon--orange',
            icon: FaFire,
        },
    ];

    return (
        <main className="main-content">

            {/* Header */}
            <header className="dashboard__header">
                <div className="welcome">
<<<<<<< Updated upstream
                    <h1 className="welcome__title">¡Hola, {usuario?.nombre || 'Atleta'}! 👋</h1>
=======
                    <h1 className="welcome__title">¡Hola!</h1>
>>>>>>> Stashed changes
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
                {statsDinamicos.map(stat => {
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
                    {ultimo_analisis ? (
                        <div className="analysis__body">
                            <div className="analysis__info">
                                <p className="analysis__name">{ultimo_analisis.tecnica}</p>
                                <p className="analysis__time">{haceCuanto(ultimo_analisis.creado_en)}</p>
                                <figure className="analysis__image">
                                    <Image
                                        src={voleibol}
                                        alt={ultimo_analisis.tecnica || "Análisis de voleibol"}
                                        width={250}
                                    />
                                </figure>
                            </div>
                            <div className="analysis__score-wrap" aria-label={`Puntuación: ${ultimo_analisis.puntuacion} de 100`}>
                                <svg className="donut" viewBox="0 0 80 80" aria-hidden="true">
                                    <circle className="donut__bg" cx="40" cy="40" r="34" />
                                    <circle className="donut__fill" cx="40" cy="40" r="34" ref={donutRef} />
                                </svg>
                                <div className="donut__label">
                                    <span className="donut__value">{ultimo_analisis.puntuacion}</span>
                                    <span className="donut__max">/100</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="analysis__body">
                            <p className="analysis__time">Aún no has realizado ningún análisis.</p>
                        </div>
                    )}
                </article>

                <article className="card1 card--routine">
                    <header className="card__header">
                        <h2 className="card__title-1">Rutina del día</h2>
                    </header>
                    {rutina_del_dia ? (
                        <div className="routine__body">
                            <p className="routine__name-1">{rutina_del_dia.nombre}</p>
                            <p className="routine__exercises">
                                {rutina_del_dia.completados}/{rutina_del_dia.total_ejercicios} ejercicios
                            </p>
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
                    ) : (
                        <div className="routine__body">
                            <p className="routine__exercises">No tienes rutina asignada para hoy.</p>
                            <button className="btn btn--primary" type="button"
                                onClick={() => router.push('/usuario/rutinas')}>
                                Explorar rutinas
                            </button>
                        </div>
                    )}
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
    );
}