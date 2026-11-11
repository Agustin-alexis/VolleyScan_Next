'use client';

import styles from './Dashboard.module.css';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';

function useAnimatedCounter(target, suffix = '') {
    const [val, setVal] = useState('0' + suffix);
    useEffect(() => {
        const numTarget = Number(target) || 0;
        if (numTarget === 0) {
            setVal('0' + suffix);
            return;
        }
        let cur = 0;
        const step = Math.max(numTarget / 30, 1);
        const timer = setInterval(() => {
            cur = Math.min(cur + step, numTarget);
            setVal(Math.floor(cur) + suffix);
            if (cur >= numTarget) clearInterval(timer);
        }, 20);
        return () => clearInterval(timer);
    }, [target, suffix]);
    return val;
}

const COLORES_FILA = [
    { color: '#4f6ef7', bg: '#1e3a8a' },
    { color: '#22c55e', bg: '#14532d' },
    { color: '#eab308', bg: '#713f12' },
    { color: '#a855f7', bg: '#581c87' },
    { color: '#ef4444', bg: '#7f1d1d' },
];

export default function Dashboard() {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    // Datos reales del entrenador logueado
    const [entrenador, setEntrenador] = useState(null);

    // Las 5 variables reales que devuelve DashboardView en Django
    const [equiposActivos, setEquiposActivos] = useState(0);
    const [deportistasActivos, setDeportistasActivos] = useState(0);
    const [analisisPendientes, setAnalisisPendientes] = useState(0);
    const [eventosProximos, setEventosProximos] = useState([]);
    const [ultimosPartidos, setUltimosPartidos] = useState([]);

    // Estados de interfaz y modal de Nueva Sesión
    const [toast, setToast] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const [modal, setModal] = useState(false);
    const [dateDropdown, setDateDropdown] = useState(false);

    const [sessionTitle, setSessionTitle] = useState('Entrenamiento general');
    const [sessionTipo, setSessionTipo] = useState('entrenamiento');
    const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
    const [sessionTime, setSessionTime] = useState('10:00');
    const [sessionDuration, setSessionDuration] = useState(90);
    const [sessionUbicacion, setSessionUbicacion] = useState('');
    const [sessionNotes, setSessionNotes] = useState('');

    // Contadores animados conectados a los datos reales
    const kpiDeportistas = useAnimatedCounter(deportistasActivos);
    const kpiEventosSemana = useAnimatedCounter(eventosProximos.length);
    const kpiEquipos = useAnimatedCounter(equiposActivos);
    const kpiAnalisis = useAnimatedCounter(analisisPendientes);

    function showToast(msg) {
        setToast(msg);
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 2800);
    }

    // 1. Cargar perfil del entrenador y datos reales de /api/panel/dashboard
    async function cargarDatosReales() {
        try {
            const yo = await api('/auth/me');
            setEntrenador(yo);
        } catch {
            // El layout gestiona la redirección si no hay sesión
        }

        try {
            const data = await api('/panel/dashboard');
            setEquiposActivos(data.equipos_activos ?? 0);
            setDeportistasActivos(data.deportistas_activos ?? 0);
            setAnalisisPendientes(data.analisis_pendientes ?? 0);
            setEventosProximos(Array.isArray(data.eventos_proximos) ? data.eventos_proximos : []);
            setUltimosPartidos(Array.isArray(data.ultimos_partidos) ? data.ultimos_partidos : []);
        } catch {
            showToast('No se pudo cargar el resumen del dashboard');
        }
    }

    useEffect(() => {
        cargarDatosReales();
    }, []);

    // 2. Guardar una nueva sesión en MySQL (POST /api/panel/horarios)
    async function saveSession() {
        if (!sessionDate || !sessionTime) {
            showToast('Por favor ingresa fecha y hora');
            return;
        }

        // Calculamos hora_fin sumando la duración en minutos
        const [horas, minutos] = sessionTime.split(':').map(Number);
        const totalMin = horas * 60 + minutos + Number(sessionDuration || 60);
        const horaFin = `${String(Math.floor((totalMin / 60) % 24)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;

        try {
            await api('/panel/horarios', {
                method: 'POST',
                body: {
                    titulo: sessionTitle,
                    tipo_evento: sessionTipo,
                    fecha: sessionDate,
                    hora_inicio: sessionTime,
                    hora_fin: horaFin,
                    ubicacion: sessionUbicacion || null,
                    notas: sessionNotes || null,
                    estado: 'programado',
                },
            });

            setModal(false);
            setSessionNotes('');
            setSessionUbicacion('');
            showToast(`Sesión "${sessionTitle}" guardada en tu horario`);
            // Recargamos el dashboard para que aparezca de inmediato desde MySQL
            cargarDatosReales();
        } catch (err) {
            const detalle =
                err instanceof ApiError && err.data?.detail
                    ? err.data.detail
                    : 'Error al guardar la sesión en el servidor';
            showToast(detalle);
        }
    }

    // 3. Gráfica dinámica basada en los últimos partidos del entrenador (% de sets ganados)
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

            const partidosOrdenados = [...ultimosPartidos].reverse();
            const labels =
                partidosOrdenados.length > 0
                    ? partidosOrdenados.map((p) => `vs ${p.rival}`)
                    : ['Sin partidos registrados'];

            const valores =
                partidosOrdenados.length > 0
                    ? partidosOrdenados.map((p) => {
                        const totalSets = (p.sets_ganados || 0) + (p.sets_perdidos || 0);
                        return totalSets > 0 ? Math.round((p.sets_ganados / totalSets) * 100) : 0;
                    })
                    : [0];

            chartInstance.current = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            data: valores,
                            borderColor: '#4f6ef7',
                            backgroundColor: gradient,
                            borderWidth: 2.5,
                            pointBackgroundColor: '#4f6ef7',
                            pointBorderColor: '#0f1425',
                            pointBorderWidth: 2,
                            pointRadius: 5,
                            fill: true,
                            tension: 0.45,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (c) => `${c.raw}% sets ganados` } },
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255,255,255,0.04)' },
                            ticks: { color: '#8892b0', font: { size: 11 } },
                            border: { display: false },
                        },
                        y: {
                            min: 0,
                            max: 100,
                            ticks: {
                                stepSize: 25,
                                color: '#8892b0',
                                font: { size: 11 },
                                callback: (v) => v + '%',
                            },
                            grid: { color: 'rgba(255,255,255,0.04)' },
                            border: { display: false },
                        },
                    },
                },
            });
        };
        loadChart();
        return () => {
            if (chartInstance.current) chartInstance.current.destroy();
        };
    }, [ultimosPartidos]);

    return (
        <>
            <div className={styles['dash-main']}>
                <header className={styles.topbar}>
                    <section className={styles['page-title-block']}>
                        <h1 className={styles['page-title']}>
                            {entrenador ? `Bienvenido, ${entrenador.nombre} ${entrenador.apellido}` : 'Dashboard'}
                        </h1>
                        <p className={styles['page-subtitle']}>
                            Resumen general de tu equipo • {entrenador?.email || 'Entrenador'}
                        </p>
                    </section>
                    <section className={styles['topbar-actions']}>
                        <div className={styles['date-picker']} onClick={() => setDateDropdown((d) => !d)}>
                            {dateDropdown && (
                                <div className={`${styles['date-dropdown']} ${styles.open}`}>
                                    
                                </div>
                            )}
                        </div>
                        
                    </section>
                </header>

                <section className={styles.content}>
                    {/* Tarjetas superiores con los números reales de la BD */}
                    <section className={styles['kpi-grid']}>
                        {[
                            { color: 'blue', icon: '👥', label: 'Deportistas Activos', value: kpiDeportistas, sub: 'En tus equipos' },
                            { color: 'teal', icon: '📅', label: 'Eventos (Próx. 7 días)', value: kpiEventosSemana, sub: 'Sesiones programadas' },
                            { color: 'green', icon: '🏐', label: 'Equipos Activos', value: kpiEquipos, sub: 'Bajo tu dirección' },
                            { color: 'gold', icon: '📹', label: 'Análisis Pendientes', value: kpiAnalisis, sub: 'Por revisar en IA' },
                        ].map((k, i) => (
                            <article key={i} className={`${styles['kpi-card']} ${styles[k.color]}`}>
                                <span className={`${styles['kpi-icon']} ${styles[k.color]}`}>{k.icon}</span>
                                <section className={styles['kpi-data']}>
                                    <p className={styles['kpi-label']}>{k.label}</p>
                                    <strong className={styles['kpi-value']}>{k.value}</strong>
                                    {k.sub && <p className={styles['kpi-sublabel']}>{k.sub}</p>}
                                </section>
                            </article>
                        ))}
                    </section>

                    <section className={styles['bottom-grid']}>
                        {/* 1. Gráfica de efectividad en últimos partidos */}
                        <article className={styles.panel}>
                            <h3 className={styles['panel-title']}>Efectividad en últimos partidos (% Sets)</h3>
                            <section className={styles['chart-container']}>
                                <canvas ref={chartRef} id="performanceChart" className={styles.performanceChart}></canvas>
                            </section>
                        </article>

                        {/* 2. Últimos partidos registrados */}
                        <article className={styles.panel}>
                            <span className={styles['panel-title']}>Últimos partidos</span>
                            <section className={styles['player-list']}>
                                {ultimosPartidos.length === 0 ? (
                                    <p style={{ color: '#8892b0', fontSize: '0.9rem', padding: '1rem 0' }}>
                                        Aún no has registrado partidos con tus equipos.
                                    </p>
                                ) : (
                                    ultimosPartidos.map((p, i) => {
                                        const paleta = COLORES_FILA[i % COLORES_FILA.length];
                                        const totalSets = (p.sets_ganados || 0) + (p.sets_perdidos || 0);
                                        const pct = totalSets > 0 ? Math.round((p.sets_ganados / totalSets) * 100) : 0;
                                        const iniciales = p.rival ? p.rival.slice(0, 2).toUpperCase() : 'VS';
                                        return (
                                            <div
                                                key={p.id || i}
                                                className={styles['player-row']}
                                                onClick={() => showToast(`Partido vs ${p.rival}: ${p.sets_ganados}-${p.sets_perdidos}`)}
                                            >
                                                <div className={styles['player-rank']}>{i + 1}</div>
                                                <div className={styles['player-avatar']} style={{ background: paleta.bg, color: '#fff' }}>
                                                    {iniciales}
                                                </div>
                                                <div className={styles['player-name']}>
                                                    vs {p.rival} ({p.sets_ganados}-{p.sets_perdidos})
                                                </div>
                                                <div className={styles['player-bar-wrap']}>
                                                    <div className={styles['player-bar']} style={{ width: pct + '%', background: paleta.color }}></div>
                                                </div>
                                                <div className={styles['player-pct']} style={{ color: paleta.color }}>
                                                    {pct}%
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </section>
                        </article>

                        {/* 3. Eventos próximos (Próximos 7 días de la tabla horarios) */}
                        <article className={styles.panel}>
                            <h3 className={styles['panel-title']}>Próximos eventos (7 días)</h3>
                            <section className={styles['activity-list']}>
                                {eventosProximos.length === 0 ? (
                                    <p style={{ color: '#8892b0', fontSize: '0.9rem', padding: '1rem 0' }}>
                                        No tienes sesiones programadas para los próximos 7 días.
                                    </p>
                                ) : (
                                    eventosProximos.map((ev, i) => (
                                        <div key={ev.id || i} className={styles['activity-item']}>
                                            <div
                                                className={styles['activity-avatar']}
                                                style={{ background: '#312e81', color: '#fff', fontSize: '18px' }}
                                            >
                                                📅
                                            </div>
                                            <div className={styles['activity-info']}>
                                                <div className={styles['activity-name']}>{ev.titulo}</div>
                                                <div className={styles['activity-action']}>
                                                    {ev.tipo_evento} {ev.ubicacion ? `• ${ev.ubicacion}` : ''}
                                                </div>
                                            </div>
                                            <div className={styles['activity-time']}>
                                                {ev.fecha} ({String(ev.hora_inicio).slice(0, 5)})
                                            </div>
                                        </div>
                                    ))
                                )}
                            </section>
                        </article>
                    </section>
                </section>

                {/* Modal conectado a POST /api/panel/horarios */}
                {modal && (
                    <section
                        className={`${styles['modal-overlay']} ${styles.open}`}
                        onClick={(e) => e.target === e.currentTarget && setModal(false)}
                    >
                        <section className={styles.modal}>
                            <header className={styles['modal-header']}>
                                <h3 className={styles['modal-title']}>Nueva Sesión</h3>
                                <button className={styles['modal-close']} onClick={() => setModal(false)}>
                                    ✕
                                </button>
                            </header>

                            <section className={styles['form-group']}>
                                <label className={styles['form-label']}>Título de la sesión</label>
                                <input
                                    className={styles['form-input']}
                                    type="text"
                                    value={sessionTitle}
                                    onChange={(e) => setSessionTitle(e.target.value)}
                                    placeholder="Ej. Entrenamiento de recepción"
                                />
                            </section>

                            <section className={styles['form-group']}>
                                <label className={styles['form-label']}>Tipo de evento</label>
                                <select
                                    className={styles['form-select']}
                                    value={sessionTipo}
                                    onChange={(e) => setSessionTipo(e.target.value)}
                                >
                                    <option value="entrenamiento">Entrenamiento</option>
                                    <option value="partido">Partido</option>
                                    <option value="evaluacion">Evaluación</option>
                                    <option value="reunion">Reunión</option>
                                    <option value="otro">Otro</option>
                                </select>
                            </section>

                            <section className={styles['form-row']}>
                                <section className={styles['form-group']}>
                                    <label className={styles['form-label']}>Fecha</label>
                                    <input
                                        className={styles['form-input']}
                                        type="date"
                                        value={sessionDate}
                                        onChange={(e) => setSessionDate(e.target.value)}
                                    />
                                </section>
                                <section className={styles['form-group']}>
                                    <label className={styles['form-label']}>Hora de inicio</label>
                                    <input
                                        className={styles['form-input']}
                                        type="time"
                                        value={sessionTime}
                                        onChange={(e) => setSessionTime(e.target.value)}
                                    />
                                </section>
                            </section>

                            <section className={styles['form-row']}>
                                <section className={styles['form-group']}>
                                    <label className={styles['form-label']}>Duración (minutos)</label>
                                    <input
                                        className={styles['form-input']}
                                        type="number"
                                        value={sessionDuration}
                                        onChange={(e) => setSessionDuration(e.target.value)}
                                    />
                                </section>
                                <section className={styles['form-group']}>
                                    <label className={styles['form-label']}>Ubicación</label>
                                    <input
                                        className={styles['form-input']}
                                        type="text"
                                        value={sessionUbicacion}
                                        onChange={(e) => setSessionUbicacion(e.target.value)}
                                        placeholder="Cancha principal"
                                    />
                                </section>
                            </section>

                            <section className={styles['form-group']}>
                                <label className={styles['form-label']}>Notas</label>
                                <input
                                    className={styles['form-input']}
                                    type="text"
                                    value={sessionNotes}
                                    onChange={(e) => setSessionNotes(e.target.value)}
                                />
                            </section>

                            <footer className={styles['modal-actions']}>
                                <button className={styles['btn-cancel']} onClick={() => setModal(false)}>
                                    Cancelar
                                </button>
                                <button className={styles['btn-save']} onClick={saveSession}>
                                    Crear sesión
                                </button>
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