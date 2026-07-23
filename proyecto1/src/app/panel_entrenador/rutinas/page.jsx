'use client';

import { useState, useEffect } from 'react';
import './Rutinas.css';

const EXERCISES = {
    Técnico: ['Saque flotante', 'Recepción pasiva', 'Colocación', 'Remate cruzado', 'Bloqueo doble', 'Defensa en W', 'Saque potencia', 'Pase de dedos'],
    Físico: ['Saltos de cajón', 'Sentadillas', 'Plancha lateral', 'Sprint 20m', 'Escaladores', 'Flexiones explosivas', 'Zancadas', 'Banda elástica'],
    Táctico: ['Sistema 6-2', 'Rotación posicional', 'Contraataque', 'Lectura del bloqueo', 'Defensa zona', 'Ataque en diagonal', 'Finta de remate'],
    Potencia: ['Salto vertical', 'Remate con carga', 'Arranque', 'Kettlebell swing', 'Drop jump', 'Banded sprint', 'Cargada olímpica'],
    Resistencia: ['Carrera continua', 'Circuito funcional', 'Remo ergómetro', 'Bicicleta HIIT', 'Natación técnica', 'Escalera de agilidad'],
    Recuperación: ['Foam roller', 'Estiramientos activos', 'Yoga deportivo', 'Movilidad de hombro', 'Crioterapia', 'Respiración diafragmática'],
    Precompetencia: ['Activación neuromuscular', 'Tiro libre', 'Recepción simulada', 'Formación táctica', 'Calentamiento dinámico', 'Visualización'],
};
const TYPE_COLORS = { Técnico: '#7c5cfc', Físico: '#00d4ff', Táctico: '#f7b731', Potencia: '#ff6b6b', Resistencia: '#26de81', Recuperación: '#ff9f43', Precompetencia: '#e056fd' };
const PRESETS = [
    { emoji: '⚡', name: 'Saque Explosivo', type: 'Técnico', desc: 'Dominio del saque flotante y de potencia.', dur: '60 min', intensity: 8, exs: ['Saque flotante', 'Saque potencia', 'Recepción pasiva'] },
    { emoji: '💪', name: 'Fuerza & Salto', type: 'Físico', desc: 'Circuito de potencia para el salto vertical.', dur: '90 min', intensity: 9, exs: ['Saltos de cajón', 'Sentadillas', 'Drop jump'] },
    { emoji: '🧠', name: 'Juego Táctico 6-2', type: 'Táctico', desc: 'Sistema 6-2 con rotaciones.', dur: '60 min', intensity: 6, exs: ['Sistema 6-2', 'Rotación posicional', 'Contraataque'] },
    { emoji: '🔥', name: 'HIIT Voleibol', type: 'Potencia', desc: 'Alta intensidad intervalada.', dur: '45 min', intensity: 10, exs: ['Sprint 20m', 'Remate con carga', 'Drop jump'] },
    { emoji: '🧘', name: 'Regeneración', type: 'Recuperación', desc: 'Post-partido, recuperación muscular.', dur: '30 min', intensity: 3, exs: ['Foam roller', 'Estiramientos activos'] },
];
const AI_TIPS = [
    '🏐 <strong>Juan García</strong> lleva 3 sesiones consecutivas de alta intensidad. Considera agregar recuperación activa mañana.',
    '📈 El equipo mejoró el <strong>saque flotante un 12%</strong> esta semana.',
    '💡 Semana de partido el viernes — Reduce la intensidad al <strong>máximo 60%</strong> desde el miércoles.',
];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const iCol = v => v <= 3 ? 'var(--accent5)' : v <= 6 ? 'var(--accent4)' : v <= 8 ? '#ff9f43' : 'var(--accent3)';

const SEED = [
    { id: uid(), name: 'Saque Explosivo Matutino', athlete: 'Juan García', type: 'Técnico', hour: '08:00', dur: '60 min', intensity: 8, exs: ['Saque flotante', 'Saque potencia'], notes: 'Posición del pie derecho.', date: daysAgo(0), done: false },
    { id: uid(), name: 'Fuerza & Explosividad', athlete: 'María López', type: 'Físico', hour: '10:00', dur: '90 min', intensity: 9, exs: ['Saltos de cajón', 'Sentadillas'], notes: '', date: daysAgo(1), done: true },
    { id: uid(), name: 'Juego Táctico 6-2', athlete: 'Todo el equipo', type: 'Táctico', hour: '16:00', dur: '60 min', intensity: 6, exs: ['Sistema 6-2', 'Contraataque'], notes: 'Llevar pizarrón.', date: daysAgo(1), done: false },
    { id: uid(), name: 'Regeneración Post-Partido', athlete: 'Carlos Ruiz', type: 'Recuperación', hour: '07:00', dur: '30 min', intensity: 3, exs: ['Foam roller'], notes: '', date: daysAgo(2), done: true },
];

export default function Rutinas() {
    const [routines, setRoutines] = useState(SEED);
    const [form, setForm] = useState({ athlete: '', type: '', name: '', hour: '08', min: '00', intensity: 6, notes: '' });
    const [selectedExs, setSelectedExs] = useState([]);
    const [selectedDur, setSelectedDur] = useState('60 min');
    const [filter, setFilter] = useState('Todas');
    const [editingId, setEditingId] = useState(null);
    const [detailModal, setDetailModal] = useState(null);
    const [toasts, setToasts] = useState([]);
    const aiTip = AI_TIPS[0];

    function toast(msg) {
        const id = Date.now();
        setToasts(t => [...t, { id, msg }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
    }

    function toggleEx(ex) {
        setSelectedExs(prev => prev.includes(ex) ? prev.filter(e => e !== ex) : [...prev, ex]);
    }

    const pool = EXERCISES[form.type] || [];

    function saveRoutine() {
        if (!form.athlete || !form.type || !form.name.trim()) { toast('Completa deportista, tipo y nombre'); return; }
        const r = { id: editingId || uid(), ...form, hour: `${form.hour.padStart(2, '0')}:${form.min.padStart(2, '0')}`, dur: selectedDur, exs: [...selectedExs], intensity: +form.intensity, date: new Date().toISOString().slice(0, 10), done: false };
        if (editingId) { setRoutines(prev => prev.map(x => x.id === editingId ? r : x)); toast(`"${r.name}" actualizada`); setEditingId(null); }
        else { setRoutines(prev => [r, ...prev]); toast(`"${r.name}" guardada`); }
        setForm({ athlete: '', type: '', name: '', hour: '08', min: '00', intensity: 6, notes: '' }); setSelectedExs([]); setSelectedDur('60 min');
    }

    function editRoutine(r) {
        const [hh, mm] = r.hour.split(':');
        setForm({ athlete: r.athlete, type: r.type, name: r.name, hour: hh, min: mm, intensity: r.intensity, notes: r.notes });
        setSelectedExs([...r.exs]); setSelectedDur(r.dur); setEditingId(r.id);
        window.scrollTo({ top: 0, behavior: 'smooth' }); toast(`Editando "${r.name}"`);
    }

    const filtered = filter === 'Todas' ? routines : routines.filter(r => r.type === filter);
    const today = new Date().toISOString().slice(0, 10);

    // Week cal
    function getWeekDots() {
        const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        const d = new Date(); const dow = d.getDay();
        const offset = dow === 0 ? -6 : 1 - dow;
        return days.map((name, i) => {
            const dd = new Date(d); dd.setDate(d.getDate() + offset + i);
            const iso = dd.toISOString().slice(0, 10);
            return { name, day: dd.getDate(), iso, hasR: routines.some(r => r.date === iso), isToday: iso === today };
        });
    }

    return (
        <>
            <main className="rut-main">
                <header className="page-header">
                    <div className="page-title">Panel de <span>Rutinas</span></div>
                    <div className="header-badge"><div className="pulse"></div> Sistema activo</div>
                </header>

                {/* Stats */}
                <div className="stats-row">
                    {[
                        { label: 'Total rutinas', val: routines.length, sub: 'registradas', color: 'var(--accent)' },
                        { label: 'Completadas', val: routines.filter(r => r.done).length, sub: `${routines.length ? Math.round(routines.filter(r => r.done).length / routines.length * 100) : 0}% del total`, color: 'var(--accent5)' },
                        { label: 'Hoy programadas', val: routines.filter(r => r.date === today).length, sub: 'sesiones', color: 'var(--accent2)' },
                        { label: 'Deportistas activos', val: 5, sub: 'en el sistema', color: 'var(--accent4)' },
                    ].map((s, i) => (
                        <div key={i} className="stat-mini">
                            <div className="stat-mini-label">{s.label}</div>
                            <div className="stat-mini-val" style={{ color: s.color }}>{s.val}</div>
                            <div className="stat-mini-sub">{s.sub}</div>
                        </div>
                    ))}
                </div>

                {/* Week Cal */}
                <article className="card" style={{ marginBottom: '10px' }}>
                    <header className="card-title"><span className="card-title-icon"></span> Semana actual</header>
                    <div className="week-cal">
                        {getWeekDots().map((d, i) => (
                            <div key={i} className="day-col">
                                <div className="day-name">{d.name}</div>
                                <div className={`day-dot ${d.hasR ? 'has-routine' : ''} ${d.isToday ? 'today' : ''}`}></div>
                                <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{d.day}</div>
                            </div>
                        ))}
                    </div>
                </article>

                <div className="layout">
                    {/* Form */}
                    <article className="card">
                        <div className="card-glow"></div>
                        <header className="card-title"><span className="card-title-icon">➕</span> {editingId ? 'Editar' : 'Nueva'} rutina</header>
                        <div className="form-grid" style={{ marginBottom: '10px' }}>
                            <div className="field">
                                <label className="field-label">Deportista</label>
                                <select className="field-select" value={form.athlete} onChange={e => setForm(f => ({ ...f, athlete: e.target.value }))}>
                                    <option value="">Seleccionar...</option>
                                    {['Juan García', 'María López', 'Carlos Ruiz', 'Sofía Mendez', 'Andrés Mora', 'Todo el equipo'].map(o => <option key={o}>{o}</option>)}
                                </select>
                            </div>
                            <div className="field">
                                <label className="field-label">Tipo de entrenamiento</label>
                                <select className="field-select" value={form.type} onChange={e => { setForm(f => ({ ...f, type: e.target.value })); setSelectedExs([]); }}>
                                    <option value="">Seleccionar...</option>
                                    {Object.keys(EXERCISES).map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="field" style={{ marginBottom: '10px' }}>
                            <label className="field-label">Nombre de la rutina</label>
                            <input className="field-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Entrenamiento de saque explosivo…" />
                        </div>
                        <div className="form-grid" style={{ marginBottom: '10px' }}>
                            <div className="field">
                                <label className="field-label">Hora de inicio</label>
                                <div className="time-picker-row">
                                    <div className="time-block"><label>HH</label><input className="time-input" type="number" min="0" max="23" value={form.hour} onChange={e => setForm(f => ({ ...f, hour: e.target.value }))} /></div>
                                    <div className="time-separator">:</div>
                                    <div className="time-block"><label>MM</label><input className="time-input" type="number" min="0" max="59" value={form.min} onChange={e => setForm(f => ({ ...f, min: e.target.value }))} /></div>
                                </div>
                            </div>
                            <div className="field">
                                <label className="field-label">Duración</label>
                                <div className="duration-pills">
                                    {['30 min', '45 min', '60 min', '90 min', '2 hrs'].map(d => (
                                        <div key={d} className={`dur-pill ${selectedDur === d ? 'selected' : ''}`} onClick={() => setSelectedDur(d)}>{d}</div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="field" style={{ marginBottom: '10px' }}>
                            <label className="field-label">Intensidad</label>
                            <div className="intensity-wrap">
                                <input className="intensity-slider" type="range" min="1" max="10" value={form.intensity} onChange={e => setForm(f => ({ ...f, intensity: e.target.value }))} />
                                <div className="intensity-labels"><span>Suave</span><span>Moderado</span><span>Máximo</span></div>
                                <div className="intensity-val" style={{ color: iCol(+form.intensity) }}>{form.intensity} / 10</div>
                            </div>
                        </div>
                        {pool.length > 0 && (
                            <div className="field" style={{ marginBottom: '10px' }}>
                                <label className="field-label">Ejercicios incluidos</label>
                                <div className="ex-tags">
                                    {pool.map(ex => (
                                        <div key={ex} className={`ex-tag ${selectedExs.includes(ex) ? 'selected' : ''}`} onClick={() => toggleEx(ex)}>{ex}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="field" style={{ marginBottom: '12px' }}>
                            <label className="field-label">Notas / Observaciones</label>
                            <textarea className="field-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Indicaciones especiales…"></textarea>
                        </div>
                        <button className="btn-primary" onClick={saveRoutine}>{editingId ? '✏️ ACTUALIZAR RUTINA' : '⚡ GUARDAR RUTINA'}</button>
                    </article>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Presets */}
                        <article className="card">
                            <header className="card-title"><span className="card-title-icon">📋</span> Rutinas prediseñadas</header>
                            <div className="presets-scroll">
                                {PRESETS.map((p, i) => (
                                    <div key={i} className="preset-card" onClick={() => { setForm(f => ({ ...f, type: p.type, name: p.name, intensity: p.intensity })); setSelectedExs([...p.exs]); setSelectedDur(p.dur); toast(`"${p.name}" cargada`); }}>
                                        <div className="preset-emoji">{p.emoji}</div>
                                        <div className="preset-name">{p.name}</div>
                                        <div className="preset-desc">{p.desc}</div>
                                        <div className="preset-tags">
                                            <span className="preset-tag" style={{ color: TYPE_COLORS[p.type] }}>{p.type}</span>
                                            <span className="preset-tag">{p.dur}</span>
                                            <span className="preset-tag">⚡ {p.intensity}/10</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </article>

                        {/* Progress rings */}
                        <article className="card">
                            <header className="card-title"><span className="card-title-icon">📊</span> Progreso semanal</header>
                            <div className="progress-rings">
                                {['Técnico', 'Físico', 'Táctico', 'Recuperación'].map((t, i) => {
                                    const pcts = [75, 60, 45, 90]; const r = 28, cx = 35, cy = 35, sw = 7, circ = 2 * Math.PI * r;
                                    const filled = circ * (pcts[i] / 100);
                                    return (
                                        <div key={t} className="ring-wrap">
                                            <svg className="ring-svg" viewBox="0 0 70 70">
                                                <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
                                                <circle cx={cx} cy={cy} r={r} fill="none" stroke={TYPE_COLORS[t]} strokeWidth={sw}
                                                    strokeDasharray={`${filled} ${circ - filled}`} strokeDashoffset={circ * 0.25} strokeLinecap="round" />
                                                <text x={cx} y={cy + 5} fill={TYPE_COLORS[t]} fontSize="13" fontFamily="Rajdhani,sans-serif" fontWeight="700" textAnchor="middle">{pcts[i]}%</text>
                                            </svg>
                                            <div className="ring-label">{t}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </article>

                        {/* AI tip */}
                        <article className="card" style={{ borderColor: 'rgba(124,92,252,0.25)' }}>
                            <header className="card-title"><span className="card-title-icon">🤖</span> Sugerencia IA</header>
                            <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: aiTip }}></div>
                        </article>
                    </div>
                </div>

                <div className="section-divider"><div className="divider-line"></div><div className="divider-label">Rutinas Registradas</div><div className="divider-line"></div></div>

                <header className="routines-header">
                    <div className="routines-count">Total: <span>{filtered.length}</span> rutinas</div>
                    <div className="filter-pills">
                        {['Todas', ...Object.keys(TYPE_COLORS)].map(t => (
                            <button key={t} className={`fpill ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>{t}</button>
                        ))}
                    </div>
                </header>

                <div className="routines-grid">
                    {filtered.length === 0
                        ? <div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-text">Sin rutinas registradas</div></div>
                        : filtered.map(r => {
                            const col = TYPE_COLORS[r.type] || 'var(--accent)';
                            return (
                                <div key={r.id} className="routine-card">
                                    <div className="routine-stripe" style={{ background: `linear-gradient(90deg,${col},transparent)` }}></div>
                                    <div className="routine-top">
                                        <div className="routine-badge" style={{ background: `${col}18`, border: `1px solid ${col}40`, color: col }}>{r.type}</div>
                                        {r.done ? <div style={{ fontSize: '11px', color: 'var(--accent5)' }}>✔ Completada</div> : <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{r.date}</div>}
                                    </div>
                                    <div className="routine-name">{r.name}</div>
                                    <div className="routine-athlete">👤 {r.athlete}</div>
                                    <div className="routine-meta">
                                        <div className="meta-item">⏰ {r.hour}</div>
                                        <div className="meta-item">⏱ {r.dur}</div>
                                        <div className="meta-item">⚡ {r.intensity}/10</div>
                                    </div>
                                    <div className="routine-exercises">
                                        {r.exs.slice(0, 4).map(e => <span key={e} className="re-tag">{e}</span>)}
                                        {r.exs.length > 4 && <span className="re-tag">+{r.exs.length - 4}</span>}
                                    </div>
                                    <div className="routine-footer">
                                        <div className="intensity-bar-wrap">
                                            <div className="intensity-bar-label">Intensidad</div>
                                            <div className="intensity-bar-track"><div className="intensity-bar-fill" style={{ width: `${r.intensity * 10}%`, background: iCol(r.intensity) }}></div></div>
                                        </div>
                                        <div className="routine-actions">
                                            <button className="act-btn done" title="Completar" onClick={() => setRoutines(prev => prev.map(x => x.id === r.id ? { ...x, done: !x.done } : x))}>✔</button>
                                            <button className="act-btn edit" title="Editar" onClick={() => editRoutine(r)}>✏️</button>
                                            <button className="act-btn del" title="Eliminar" onClick={() => { setRoutines(prev => prev.filter(x => x.id !== r.id)); toast(`"${r.name}" eliminada`); }}>🗑</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    }
                </div>

                {/* Toasts */}
                <div className="toast-container">
                    {toasts.map(t => (
                        <div key={t.id} className="toast">
                            <div className="toast-icon">✅</div>
                            <div style={{ flex: 1 }}><div className="toast-msg">{t.msg}</div></div>
                        </div>
                    ))}
                </div>
            </main>

        </>
    );
}
