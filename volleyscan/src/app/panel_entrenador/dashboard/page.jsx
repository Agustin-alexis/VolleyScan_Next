'use client'
import styles from './Dashboard.module.css'

import { useEffect, useRef, useState } from 'react';


const players = [
    { name: 'Juan Pérez', pct: 85, color: '#4f6ef7', initials: 'JP', bg: '#1e3a8a' },
    { name: 'María González', pct: 78, color: '#ef4444', initials: 'MG', bg: '#7f1d1d' },
    { name: 'Carlos Ramírez', pct: 72, color: '#4f6ef7', initials: 'CR', bg: '#1e40af' },
    { name: 'Sofía Ortega', pct: 68, color: '#22c55e', initials: 'SO', bg: '#14532d' },
    { name: 'Andrés López', pct: 65, color: '#22c55e', initials: 'AL', bg: '#166534' },
];

const activitiesData = [
    { name: 'Juan Pérez', action: 'Completó entrenamiento', time: 'Hoy, 10:30 AM', initials: 'JP', bg: '#1e3a8a' },
    { name: 'María González', action: 'Error técnico detectado', time: 'Hoy, 09:15 AM', initials: 'MG', bg: '#7f1d1d' },
    { name: 'Carlos Ramírez', action: 'Mejora en saque', time: 'Ayer, 07:45 PM', initials: 'CR', bg: '#1e40af' },
    { name: 'Nueva sesión', action: 'Entrenamiento de defensa', time: 'Ayer, 06:30 PM', initials: '📹', bg: '#312e81', icon: true },
];

function useAnimatedCounter(target, suffix = '') {
    const [val, setVal] = useState(0);
    useEffect(() => {
        let cur = 0;
        const step = target / 40;
        const timer = setInterval(() => {
            cur = Math.min(cur + step, target);
            setVal(Math.floor(cur) + suffix);
            if (cur >= target) clearInterval(timer);
        }, 20);
        return () => clearInterval(timer);
    }, [target, suffix]);
    return val;
}

export default function Dashboard() {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);
    const [toast, setToast] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const [modal, setModal] = useState(false);
    const [activities, setActivities] = useState(activitiesData);
    const [sessionCount, setSessionCount] = useState(15);
    const [dateLabel, setDateLabel] = useState('Fechas');
    const [dateDropdown, setDateDropdown] = useState(false);
    const [sessionType, setSessionType] = useState('Entrenamiento general');
    const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
    const [sessionTime, setSessionTime] = useState('10:00');
    const [sessionDuration, setSessionDuration] = useState(90);
    const [sessionNotes, setSessionNotes] = useState('');

    const kpiDeportistas = useAnimatedCounter(24);
    const kpiSesiones = useAnimatedCounter(sessionCount);
    const kpiAsistencia = useAnimatedCounter(87, '%');
    const kpiRendimiento = useAnimatedCounter(78, '%');

    function showToast(msg) {
        setToast(msg);
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 2800);
    }

    function saveSession() {
        if (!sessionDate) { showToast('Por favor ingresa una fecha'); return; }
        const now = new Date();
        const timeStr = `Hoy, ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
        setActivities(prev => [{ name: 'Nueva sesión', action: sessionType, time: timeStr, initials: '📹', bg: '#312e81', icon: true }, ...prev.slice(0, 3)]);
        setSessionCount(c => c + 1);
        setModal(false);
        showToast(`Sesión "${sessionType}" creada exitosamente`);
    }

    useEffect(() => {
        if (!chartRef.current) return;
        const loadChart = async () => {
            const { Chart, registerables } = await import('chart.js');
            Chart.register(...registerables);
            if (chartInstance.current) chartInstance.current.destroy();
            const ctx = chartRef.current.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 180);
            gradient.addColorStop(0, 'rgba(79,110,247,0.35)');
            gradient.addColorStop(1, 'rgba(79,110,247,0.01)');
            chartInstance.current = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['14 Abr', '21 Abr', '28 Abr', '5 May', '12 May'],
                    datasets: [{ data: [48, 55, 62, 68, 78], borderColor: '#4f6ef7', backgroundColor: gradient, borderWidth: 2.5, pointBackgroundColor: '#4f6ef7', pointBorderColor: '#0f1425', pointBorderWidth: 2, pointRadius: 5, fill: true, tension: 0.45 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.raw + '%' } } },
                    scales: {
                        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8892b0', font: { size: 11 } }, border: { display: false } },
                        y: { min: 0, max: 100, ticks: { stepSize: 25, color: '#8892b0', font: { size: 11 }, callback: v => v + '%' }, grid: { color: 'rgba(255,255,255,0.04)' }, border: { display: false } }
                    }
                }
            });
        };
        loadChart();
        return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    }, []);

    return (
        <>
            <div className={styles['dash-main']}>
                <header className={styles.topbar}>
                    <section className={styles['page-title-block']}>
                        <h1 className={styles['page-title']}>Dashboard</h1>
                        <p className={styles['page-subtitle']}>Resumen general de tu equipo</p>
                    </section>
                    <section className={styles['topbar-actions']}>
                        <div className={styles['date-picker']} onClick={() => setDateDropdown(d => !d)}>
                            <span>{dateLabel}</span> ▾
                            {dateDropdown && (
                                <div className={`${styles['date-dropdown']} ${styles.open}`}>
                                    {['12 - 18 Mayo, 2025', '5 - 11 Mayo, 2025', '28 Abr - 4 Mayo, 2025', 'Abril 2025', 'Mayo 2025'].map(d => (
                                        <button key={d} className={styles['date-option']} onClick={e => { e.stopPropagation(); setDateLabel(d); setDateDropdown(false); showToast(`Período: ${d}`); }}>{d}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button className={styles['btn-new-session']} onClick={() => setModal(true)}>Nueva sesión</button>
                    </section>
                </header>

                <section className={styles.content}>
                    <section className={styles['kpi-grid']}>
                        {[
                            { color: 'blue', icon: '👥', label: 'Total Deportistas', value: kpiDeportistas, sub: 'Activos' },
                            { color: 'teal', icon: '✅', label: 'Sesiones esta semana', value: sessionCount, sub: 'Completadas' },
                            { color: 'green', icon: '⏱', label: 'Asistencia promedio', value: kpiAsistencia, delta: '▲ +5% vs semana pasada' },
                            { color: 'gold', icon: '📈', label: 'Rendimiento promedio', value: kpiRendimiento, delta: '▲ +8% vs semana pasada' },
                        ].map((k, i) => (
                            <article key={i} className={`${styles['kpi-card']} ${styles[k.color]}`}>
                                <span className={`${styles['kpi-icon']} ${styles[k.color]}`}>{k.icon}</span>
                                <section className={styles['kpi-data']}>
                                    <p className={styles['kpi-label']}>{k.label}</p>
                                    <strong className={styles['kpi-value']}>{k.value}</strong>
                                    {k.sub && <p className={styles['kpi-sublabel']}>{k.sub}</p>}
                                    {k.delta && <p className={`${styles['kpi-delta']} ${styles.positive}`}>{k.delta}</p>}
                                </section>
                            </article>
                        ))}
                    </section>

                    <section className={styles['bottom-grid']}>
                        <article className={styles.panel}>
                            <h3 className={styles['panel-title']}>Rendimiento por semana</h3>
                            <section className={styles['chart-container']}>
                                <canvas ref={chartRef} id="performanceChart" className={styles.performanceChart}></canvas>
                            </section>
                        </article>

                        <article className={styles.panel}>
                            <span className={styles['panel-title']}>Comparativa de jugadores</span>
                            <section className={styles['player-list']}>
                                {players.map((p, i) => (
                                    <div key={i} className={styles['player-row']} onClick={() => showToast(`Ver estadísticas de ${p.name}`)}>
                                        <div className={styles['player-rank']}>{i + 1}</div>
                                        <div className={styles['player-avatar']} style={{ background: p.bg, color: '#fff' }}>{p.initials}</div>
                                        <div className={styles['player-name']}>{p.name}</div>
                                        <div className={styles['player-bar-wrap']}>
                                            <div className={styles['player-bar']} style={{ width: p.pct + '%', background: p.color }}></div>
                                        </div>
                                        <div className={styles['player-pct']} style={{ color: p.color }}>{p.pct}%</div>
                                    </div>
                                ))}
                            </section>
                        </article>

                        <article className={styles.panel}>
                            <h3 className={styles['panel-title']}>Actividad reciente</h3>
                            <section className={styles['activity-list']}>
                                {activities.map((a, i) => (
                                    <div key={i} className={styles['activity-item']}>
                                        <div className={styles['activity-avatar']} style={{ background: a.bg, color: '#fff', fontSize: a.icon ? '18px' : '13px' }}>{a.initials}</div>
                                        <div className={styles['activity-info']}>
                                            <div className={styles['activity-name']}>{a.name}</div>
                                            <div className={styles['activity-action']}>{a.action}</div>
                                        </div>
                                        <div className={styles['activity-time']}>{a.time}</div>
                                    </div>
                                ))}
                            </section>
                        </article>
                    </section>
                </section>

                {/* Modal */}
                {modal && (
                    <section className={`${styles['modal-overlay']} ${styles.open}`} onClick={e => e.target === e.currentTarget && setModal(false)}>
                        <section className={styles.modal}>
                            <header className={styles['modal-header']}>
                                <h3 className={styles['modal-title']}>Nueva Sesión</h3>
                                <button className={styles['modal-close']} onClick={() => setModal(false)}>✕</button>
                            </header>
                            <section className={styles['form-group']}>
                                <label className={styles['form-label']}>Tipo de sesión</label>
                                <select className={styles['form-select']} value={sessionType} onChange={e => setSessionType(e.target.value)}>
                                    {['Entrenamiento general', 'Entrenamiento de defensa', 'Entrenamiento de ataque', 'Entrenamiento de saque', 'Partido amistoso', 'Análisis táctico'].map(o => <option key={o}>{o}</option>)}
                                </select>
                            </section>
                            <section className={styles['form-row']}>
                                <section className={styles['form-group']}>
                                    <label className={styles['form-label']}>Fecha</label>
                                    <input className={styles['form-input']} type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} />
                                </section>
                                <section className={styles['form-group']}>
                                    <label className={styles['form-label']}>Hora</label>
                                    <input className={styles['form-input']} type="time" value={sessionTime} onChange={e => setSessionTime(e.target.value)} />
                                </section>
                            </section>
                            <section className={styles['form-group']}>
                                <label className={styles['form-label']}>Duración (minutos)</label>
                                <input className={styles['form-input']} type="number" value={sessionDuration} onChange={e => setSessionDuration(e.target.value)} />
                            </section>
                            <section className={styles['form-group']}>
                                <label className={styles['form-label']}>Notas</label>
                                <input className={styles['form-input']} type="text" value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} />
                            </section>
                            <footer className={styles['modal-actions']}>
                                <button className={styles['btn-cancel']} onClick={() => setModal(false)}>Cancelar</button>
                                <button className={styles['btn-save']} onClick={saveSession}>Crear sesión</button>
                            </footer>
                        </section>
                    </section>
                )}

                {/* Toast */}
                <aside className={`${styles.toast} ${toastVisible ? styles.show : ''}`}>
                    <span className={styles['toast-icon']}>✓</span>
                    <span>{toast}</span>
                </aside>
            </div>

        </>
    );
}