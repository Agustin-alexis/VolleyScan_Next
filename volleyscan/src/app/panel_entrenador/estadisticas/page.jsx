'use client';


import { useState, useEffect, useRef } from 'react';


import './Estadisticas.css'


const DATA_ALL = {
    players: [
        { name: 'Juan', perf: 88, color: '#7c5cfc', attendance: 92, gradient: ['#7c5cfc', '#a488ff'] },
        { name: 'María', perf: 82, color: '#f7b731', gradient: ['#f7b731', '#ffd470'] },
        { name: 'Carlos', perf: 74, color: '#26de81', gradient: ['#26de81', '#5ef5a0'] },
        { name: 'Sofía', perf: 65, color: '#00d4ff', gradient: ['#00d4ff', '#7eeeff'] },
        { name: 'Andrés', perf: 60, color: '#ff6b6b', gradient: ['#ff6b6b', '#ff9f9f'] },
    ],
    evolution: {
        dates: ['4 May', '7 May', '10 May', '13 May', '16 May'],
        series: [
            { name: 'Juan', color: '#7c5cfc', values: [72, 80, 78, 85, 90] },
            { name: 'María', color: '#f7b731', values: [65, 70, 68, 72, 69] },
            { name: 'Carlos', color: '#26de81', values: [55, 62, 60, 58, 65] },
        ]
    },
    exercises: [
        { name: 'Saque', pct: 35, color: '#7c5cfc' },
        { name: 'Recepción', pct: 25, color: '#00d4ff' },
        { name: 'Remate', pct: 20, color: '#f7b731' },
        { name: 'Bloqueo', pct: 20, color: '#ff6b6b' },
    ],
    errors: [
        { name: 'Postura incorrecta', pct: 32, color: '#ff6b6b' },
        { name: 'Brazo bajo en saque', pct: 28, color: '#ff6b6b' },
        { name: 'Piernas semiflexionadas', pct: 20, color: '#f7b731' },
        { name: 'Falta de coordinación', pct: 20, color: '#f7b731' },
    ]
};

export default function Estadisticas() {
    const [deportista, setDeportista] = useState('all');
    const [ejercicio, setEjercicio] = useState('all');
    const [searchVal, setSearchVal] = useState('');
    const [hiddenSeries, setHiddenSeries] = useState({});
    const [tooltip, setTooltip] = useState({ show: false, text: '', x: 0, y: 0 });

    function getPlayers() {
        return DATA_ALL.players.filter(p =>
            (deportista === 'all' || p.name === deportista) &&
            (!searchVal || p.name.toLowerCase().includes(searchVal.toLowerCase()))
        );
    }

    function getExercises() {
        const OVERRIDES = {
            Juan: [{ name: 'Saque', pct: 50, color: '#7c5cfc' }, { name: 'Remate', pct: 30, color: '#f7b731' }, { name: 'Recepción', pct: 20, color: '#00d4ff' }],
            María: [{ name: 'Recepción', pct: 45, color: '#00d4ff' }, { name: 'Bloqueo', pct: 35, color: '#ff6b6b' }, { name: 'Saque', pct: 20, color: '#7c5cfc' }],
            Carlos: [{ name: 'Remate', pct: 40, color: '#f7b731' }, { name: 'Bloqueo', pct: 35, color: '#ff6b6b' }, { name: 'Saque', pct: 25, color: '#7c5cfc' }],
        };
        const base = OVERRIDES[deportista] || DATA_ALL.exercises;
        return ejercicio === 'all' ? base : base.filter(e => e.name === ejercicio);
    }

    function getEvolution() {
        return DATA_ALL.evolution.series.filter(s =>
            (deportista === 'all' || s.name === deportista) &&
            (!searchVal || s.name.toLowerCase().includes(searchVal.toLowerCase()))
        );
    }

    const players = getPlayers();
    const exercises = getExercises();
    const series = getEvolution();
    const dates = DATA_ALL.evolution.dates;

    const avgPerf = players.length ? Math.round(players.reduce((a, p) => a + p.perf, 0) / players.length) : 0;
    const avgAtt = players.length ? Math.round(players.reduce((a, p) => a + p.attendance, 0) / players.length) : 0;

    // Donut
    const cx = 80, cy = 80, r = 60, sw = 16, circ = 2 * Math.PI * r;
    const filled = circ * (avgAtt / 100), empty = circ - filled;

    // Line chart
    const W = 460, H = 150, padL = 34, padR = 10, padT = 10, padB = 30;
    const cW = W - padL - padR, cH = H - padT - padB;
    const vals = series.flatMap(s => s.values);
    const minV = vals.length ? Math.min(...vals) - 5 : 0;
    const maxV = vals.length ? Math.max(...vals) + 5 : 100;
    const xPos = i => padL + (i / (dates.length - 1)) * cW;
    const yPos = v => padT + cH - ((v - minV) / (maxV - minV)) * cH;

    function showTip(e, text) {
        setTooltip({ show: true, text, x: e.clientX + 12, y: e.clientY - 28 });
    }

    function reset() {
        setDeportista('all'); setEjercicio('all'); setSearchVal('');
    }

    return (
        <>
            <main className="est-main">
                <div className="page-title">Estadísticas Avanzadas</div>

                <section className="filters-bar">
                    <div className="filter-group">
                        <label className="filter-label">Deportista</label>
                        <select className="filter-select" value={deportista} onChange={e => setDeportista(e.target.value)}>
                            <option value="all">Todos</option>
                            {DATA_ALL.players.map(p => <option key={p.name}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="filter-group">
                        <label className="filter-label">Tipo de ejercicio</label>
                        <select className="filter-select" value={ejercicio} onChange={e => setEjercicio(e.target.value)}>
                            <option value="all">Todos</option>
                            {['Saque', 'Recepción', 'Remate', 'Bloqueo'].map(o => <option key={o}>{o}</option>)}
                        </select>
                    </div>
                    <div className="filter-group">
                        <label className="filter-label">Buscar</label>
                        <input className="filter-input" type="text" placeholder="Nombre..." value={searchVal} onChange={e => setSearchVal(e.target.value)} />
                    </div>
                    <button className="btn-reset" onClick={reset}>↺ Resetear</button>
                </section>

                {/* Mini Cards */}
                <div className="mini-cards">
                    {[
                        { label: 'Rendimiento promedio', value: `${avgPerf}%`, delta: '+3.2%', dir: 'up', color: '#7c5cfc' },
                        { label: 'Asistencia promedio', value: `${avgAtt}%`, delta: '-1.1%', dir: 'down', color: '#00d4ff' },
                        { label: 'Deportistas activos', value: players.length, delta: `${players.length} de 5`, dir: 'up', color: '#26de81' },
                        { label: 'Sesiones registradas', value: 24, delta: '+4 este mes', dir: 'up', color: '#f7b731' },
                    ].map((c, i) => (
                        <div key={i} className="mini-card">
                            <div className="mini-label">{c.label}</div>
                            <div className="mini-value" style={{ color: c.color }}>{c.value}</div>
                            <div className={`mini-delta ${c.dir}`}>{c.dir === 'up' ? '▲' : '▼'} {c.delta}</div>
                        </div>
                    ))}
                </div>

                <div className="grid-top">
                    {/* Bar chart */}
                    <article className="card">
                        <header className="card-title">Rendimiento promedio</header>
                        <div className="bar-chart-wrapper">
                            <div className="y-axis">
                                {['100%', '75%', '50%', '25%', '0%'].map(l => <div key={l} className="y-label">{l}</div>)}
                            </div>
                            <div className="bar-chart">
                                {players.length === 0 ? <div className="no-data"><div className="no-data-icon">📊</div><span>Sin datos</span></div>
                                    : players.map(p => {
                                        const h = Math.round((p.perf / 100) * 110);
                                        return (
                                            <div key={p.name} className="bar-col">
                                                <div className="bar-value">{p.perf}%</div>
                                                <div className="bar-wrap">
                                                    <svg style={{ width: '100%', height: '110px' }} viewBox="0 0 40 110" preserveAspectRatio="none">
                                                        <defs>
                                                            <linearGradient id={`g-${p.name}`} x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="0%" stopColor={p.gradient[0]} />
                                                                <stop offset="100%" stopColor={p.gradient[1]} stopOpacity=".7" />
                                                            </linearGradient>
                                                        </defs>
                                                        <rect x="2" y={110 - h} width="36" rx="4" height={h} fill={`url(#g-${p.name})`}
                                                            onMouseEnter={e => showTip(e, `${p.name}: ${p.perf}%`)}
                                                            onMouseLeave={() => setTooltip(t => ({ ...t, show: false }))}
                                                            style={{ cursor: 'pointer', transition: 'opacity .2s' }}
                                                        />
                                                    </svg>
                                                </div>
                                                <div className="bar-label">{p.name}</div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </article>

                    {/* Line chart */}
                    <article className="card">
                        <header className="card-title">Evolución de rendimiento</header>
                        <div className="line-chart-container">
                            <svg className="line-chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                                <defs>
                                    {series.map(s => (
                                        <linearGradient key={s.name} id={`lg-${s.name}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={s.color} stopOpacity=".25" />
                                            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                                        </linearGradient>
                                    ))}
                                </defs>
                                {[0, .25, .5, .75, 1].map(t => {
                                    const y = padT + cH * (1 - t);
                                    return <g key={t}>
                                        <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                                        <text x={padL - 4} y={y + 4} fill="#7a7f9a" fontSize="9" textAnchor="end">{Math.round(minV + t * (maxV - minV))}%</text>
                                    </g>;
                                })}
                                {dates.map((d, i) => <text key={d} x={xPos(i)} y={H - 4} fill="#7a7f9a" fontSize="9" textAnchor="middle">{d}</text>)}
                                {series.filter(s => !hiddenSeries[s.name]).map(s => {
                                    const pts = s.values.slice(0, dates.length);
                                    const area = `M ${xPos(0)},${yPos(pts[0])} ${pts.map((v, i) => `L ${xPos(i)},${yPos(v)}`).join(' ')} L ${xPos(dates.length - 1)},${padT + cH} L ${xPos(0)},${padT + cH} Z`;
                                    const line = pts.map((v, i) => (i === 0 ? 'M' : 'L') + ` ${xPos(i)} ${yPos(v)}`).join(' ');
                                    return <g key={s.name}>
                                        <path d={area} fill={`url(#lg-${s.name})`} opacity=".7" />
                                        <path d={line} stroke={s.color} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
                                        {pts.map((v, i) => <circle key={i} cx={xPos(i)} cy={yPos(v)} r="4" fill={s.color} stroke="#181c30" strokeWidth="2"
                                            onMouseEnter={e => showTip(e, `${s.name} (${dates[i]}): ${v}%`)}
                                            onMouseLeave={() => setTooltip(t => ({ ...t, show: false }))}
                                            style={{ cursor: 'pointer' }} />)}
                                    </g>;
                                })}
                            </svg>
                            <div className="chart-legend">
                                {series.map(s => (
                                    <div key={s.name} className={`legend-item ${hiddenSeries[s.name] ? 'hidden' : ''}`} onClick={() => setHiddenSeries(h => ({ ...h, [s.name]: !h[s.name] }))}>
                                        <div className="legend-dot" style={{ background: s.color }}></div>{s.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </article>
                </div>

                <div className="grid-bottom">
                    {/* Donut */}
                    <article className="card">
                        <header className="card-title">Asistencia</header>
                        <div className="donut-wrapper">
                            <svg className="donut-svg" viewBox="0 0 160 160">
                                <defs>
                                    <linearGradient id="dg" x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0%" stopColor="#7c5cfc" /><stop offset="100%" stopColor="#26de81" />
                                    </linearGradient>
                                </defs>
                                <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
                                <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#dg)" strokeWidth={sw}
                                    strokeDasharray={`${filled} ${empty}`} strokeDashoffset={circ * 0.25} strokeLinecap="round" />
                            </svg>
                            <div className="donut-label">
                                <div className="donut-value">{avgAtt}%</div>
                                <div className="donut-sub">Promedio</div>
                            </div>
                        </div>
                    </article>

                    {/* Exercises */}
                    <article className="card">
                        <header className="card-title">Tipos de ejercicios</header>
                        <div className="exercise-list">
                            {exercises.length === 0 ? <div className="no-data"><div className="no-data-icon">🏐</div><span>Sin datos</span></div>
                                : exercises.map(e => (
                                    <div key={e.name} className="exercise-item">
                                        <div className="ex-dot" style={{ background: e.color }}></div>
                                        <div className="ex-name">{e.name}</div>
                                        <div className="ex-pct">{e.pct}%</div>
                                    </div>
                                ))}
                        </div>
                    </article>

                    {/* Errors */}
                    <article className="card">
                        <header className="card-title">Errores comunes</header>
                        <div className="error-list">
                            {DATA_ALL.errors.map(e => {
                                const off = { Juan: 5, María: -3, Carlos: 2, Sofía: -5, Andrés: 8 }[deportista] || 0;
                                const pct = Math.max(5, Math.min(99, e.pct + off));
                                return (
                                    <div key={e.name} className="error-item">
                                        <div className="error-header">
                                            <span className="error-name">{e.name}</span>
                                            <span className="error-pct">{pct}%</span>
                                        </div>
                                        <div className="error-track">
                                            <div className="error-fill" style={{ width: `${pct}%`, background: e.color }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </article>
                </div>

                {/* Tooltip */}
                {tooltip.show && (
                    <div className="tooltip show" style={{ left: tooltip.x, top: tooltip.y, position: 'fixed' }}>{tooltip.text}</div>
                )}
            </main>

        </>
    );
}