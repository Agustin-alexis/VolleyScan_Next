'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import './Rutinas.css';
import { listarDeportistas, mensajeDeError } from '@/lib/vinculos/api';
import { crearRutinas, editarRutina, eliminarRutina, listarRutinas } from '@/lib/rutinas/api';

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
const DURACIONES = { '30 min': 30, '45 min': 45, '60 min': 60, '90 min': 90, '2 hrs': 120 };
const FORM_VACIO = { athlete: '', type: '', name: '', hour: '08', min: '00', intensity: 6, objetivo: '', notes: '', fecha: '' };

/* ── Utilidades ── */
const iCol = v => v <= 3 ? 'var(--accent5)' : v <= 6 ? 'var(--accent4)' : v <= 8 ? '#ff9f43' : 'var(--accent3)';
const dosDig = n => String(n).padStart(2, '0');
// Fecha local como AAAA-MM-DD (toISOString() usa UTC y de noche daría el día siguiente)
const isoLocal = (d = new Date()) => `${d.getFullYear()}-${dosDig(d.getMonth() + 1)}-${dosDig(d.getDate())}`;
const fechaCorta = iso => {
    if (!iso) return 'Sin fecha';
    const [y, m, d] = iso.split('-').map(Number);
    return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d));
};
const durTexto = min => Object.keys(DURACIONES).find(k => DURACIONES[k] === min) ?? (min ? `${min} min` : '—');
const nombreDe = p => `${p.nombre} ${p.apellido}`.trim();
const ejercicioNuevo = nombre => ({ nombre, series: 3, repeticiones: 10 });
const limitar = (v, min, max) => Math.min(max, Math.max(min, Number.parseInt(v, 10) || min));

export default function Rutinas() {
    const [deportistas, setDeportistas] = useState([]);
    const [routines, setRoutines] = useState([]);
    const [estado, setEstado] = useState('cargando'); // cargando | listo | error
    const [form, setForm] = useState({ ...FORM_VACIO, fecha: isoLocal() });
    const [exs, setExs] = useState([]);
    const [propio, setPropio] = useState('');
    const [selectedDur, setSelectedDur] = useState('60 min');
    const [filter, setFilter] = useState('Todas');
    const [verAtleta, setVerAtleta] = useState(''); // '' = todos; si no, el id del deportista cuyas rutinas se muestran
    const [editingId, setEditingId] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [porBorrar, setPorBorrar] = useState(null);
    const [borrando, setBorrando] = useState(false);
    const [toasts, setToasts] = useState([]);

    const hoy = isoLocal();

    function toast(msg, tipo = 'ok') {
        const id = Date.now() + Math.random();
        setToasts(t => [...t, { id, msg, tipo }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
    }

    /* ── Carga ── */
    const cargar = useCallback(async () => {
        const [d, r] = await Promise.all([listarDeportistas(), listarRutinas()]);
        if (d.ok && r.ok) {
            setDeportistas(d.data);
            setRoutines(r.data);
            setEstado('listo');
        } else {
            setEstado('error');
        }
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    // Esc cierra el cuadro de confirmación
    useEffect(() => {
        if (!porBorrar) return undefined;
        const tecla = e => e.key === 'Escape' && !borrando && setPorBorrar(null);
        document.addEventListener('keydown', tecla);
        return () => document.removeEventListener('keydown', tecla);
    }, [porBorrar, borrando]);

    /* ── Ejercicios elegidos ── */
    const pool = EXERCISES[form.type] || [];
    const nombresElegidos = exs.map(e => e.nombre);

    function toggleEx(nombre) {
        setExs(prev => prev.some(e => e.nombre === nombre) ? prev.filter(e => e.nombre !== nombre) : [...prev, ejercicioNuevo(nombre)]);
    }
    function cambiarEx(nombre, campo, valor) {
        setExs(prev => prev.map(e => e.nombre === nombre ? { ...e, [campo]: valor } : e));
    }
    function agregarPropio() {
        const n = propio.trim();
        if (!n) return;
        if (n.length > 150) { toast('El nombre del ejercicio es demasiado largo.', 'error'); return; }
        if (nombresElegidos.some(x => x.toLowerCase() === n.toLowerCase())) { toast('Ese ejercicio ya está en la lista.', 'error'); return; }
        setExs(prev => [...prev, ejercicioNuevo(n)]);
        setPropio('');
    }

    function limpiarFormulario() {
        setForm({ ...FORM_VACIO, fecha: isoLocal() });
        setExs([]); setSelectedDur('60 min'); setPropio(''); setEditingId(null);
    }

    /* ── Guardar (crear o actualizar) ── */
    async function saveRoutine() {
        if (guardando) return;
        if (!form.athlete || !form.type || !form.name.trim()) { toast('Completa deportista, tipo y nombre.', 'error'); return; }
        if (exs.length === 0) { toast('Agrega al menos un ejercicio.', 'error'); return; }
        const hh = Number(form.hour), mm = Number(form.min);
        if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
            toast('La hora de inicio no es válida.', 'error'); return;
        }
        const datos = {
            nombre: form.name.trim(),
            tipo: form.type,
            objetivo: form.objetivo.trim() || null,
            notas: form.notes.trim() || null,
            horaInicio: `${dosDig(hh)}:${dosDig(mm)}`,
            duracionMin: DURACIONES[selectedDur],
            intensidad: Number(form.intensity),
            fechaProgramada: form.fecha || null,
            ejercicios: exs.map(e => ({ nombre: e.nombre, series: limitar(e.series, 1, 99), repeticiones: limitar(e.repeticiones, 1, 99) })),
        };
        setGuardando(true);
        const r = editingId
            ? await editarRutina(editingId, datos)
            : await crearRutinas({ ...datos, atletaIds: form.athlete === 'todos' ? deportistas.map(d => d.id) : [Number(form.athlete)] });
        setGuardando(false);
        if (!r.ok) { toast(mensajeDeError(r), 'error'); return; }
        const n = editingId ? 1 : r.data.ids.length;
        if (!editingId && form.athlete === 'todos') setVerAtleta('');
        toast(editingId ? `"${datos.nombre}" actualizada` : n > 1 ? `"${datos.nombre}" asignada a ${n} deportistas` : `"${datos.nombre}" asignada`);
        limpiarFormulario();
        cargar();
    }

    /* ── Editar ── */
    function editRoutine(r) {
        if (r.progreso.completados > 0) {
            toast('El deportista ya tiene avance en esta rutina; no se puede editar. Crea una nueva.', 'error');
            return;
        }
        const [hh, mm] = (r.horaInicio ?? '08:00').split(':');
        setForm({
            athlete: String(r.atleta.id), type: r.tipo ?? '', name: r.nombre, hour: hh, min: mm,
            intensity: r.intensidad ?? 6, objetivo: r.objetivo ?? '', notes: r.notas ?? '', fecha: r.fechaProgramada ?? isoLocal(),
        });
        setExs(r.ejercicios.map(e => ({ nombre: e.nombre, series: e.series, repeticiones: e.repeticiones })));
        setSelectedDur(durTexto(r.duracionMin) in DURACIONES ? durTexto(r.duracionMin) : '60 min');
        setEditingId(r.id);
        setVerAtleta(String(r.atleta.id));
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast(`Editando "${r.nombre}"`);
    }

    /* ── Eliminar ── */
    async function confirmarBorrado() {
        if (!porBorrar || borrando) return;
        setBorrando(true);
        const r = await eliminarRutina(porBorrar.id);
        setBorrando(false);
        if (!r.ok && r.status !== 404) { toast(mensajeDeError(r), 'error'); return; }
        toast(`"${porBorrar.nombre}" eliminada`);
        if (editingId === porBorrar.id) limpiarFormulario();
        setPorBorrar(null);
        cargar();
    }

    /* ── Datos derivados ── */
    // Todo lo que se ve (lista, cifras, calendario, anillos) es del deportista elegido; sin elegir, de todos
    const visibles = verAtleta ? routines.filter(r => String(r.atleta.id) === verAtleta) : routines;
    const atletaVisto = verAtleta ? [...deportistas, ...routines.map(r => r.atleta)].find(a => String(a.id) === verAtleta) : null;
    const filtered = filter === 'Todas' ? visibles : visibles.filter(r => r.tipo === filter);
    const completadas = visibles.filter(r => r.completada).length;

    const semana = useMemo(() => {
        const d = new Date();
        const dow = d.getDay();
        const offset = dow === 0 ? -6 : 1 - dow;
        return ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((name, i) => {
            const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset + i);
            return { name, day: dd.getDate(), iso: isoLocal(dd) };
        });
    }, []);

    const enSemana = visibles.filter(r => r.fechaProgramada && r.fechaProgramada >= semana[0].iso && r.fechaProgramada <= semana[6].iso);
    const anillo = tipo => {
        const rs = enSemana.filter(r => r.tipo === tipo);
        const total = rs.reduce((a, r) => a + r.progreso.total, 0);
        const hechos = rs.reduce((a, r) => a + r.progreso.completados, 0);
        return { n: rs.length, pct: total ? Math.round(hechos * 100 / total) : 0 };
    };

    const resumen = (() => {
        if (visibles.length === 0) return atletaVisto ? `${nombreDe(atletaVisto)} aún no tiene rutinas. Crea la primera con el formulario.` : 'Aún no has asignado rutinas. Crea la primera con el formulario.';
        const vencidas = visibles.filter(r => !r.completada && r.fechaProgramada && r.fechaProgramada < hoy);
        if (vencidas.length) {
            const quienes = [...new Set(vencidas.map(r => r.atleta.nombre))];
            const lista = quienes.slice(0, 3).join(', ') + (quienes.length > 3 ? ` y ${quienes.length - 3} más` : '');
            return `${vencidas.length} rutina${vencidas.length > 1 ? 's' : ''} sin completar con fecha vencida (${lista}).`;
        }
        const hechasSemana = enSemana.filter(r => r.completada).length;
        return hechasSemana
            ? `Esta semana se completaron ${hechasSemana} rutina${hechasSemana > 1 ? 's' : ''}. Todo lo demás va al día.`
            : 'Todo va al día: no hay rutinas vencidas.';
    })();

    const editando = routines.find(r => r.id === editingId);
    const sinDeportistas = estado === 'listo' && deportistas.length === 0;

    return (
        <>
            <main className="rut-main">
                <header className="page-header">
                    <div className="page-title">Panel de <span>Rutinas</span></div>
                    <div className="header-badge"><div className="pulse"></div> Sistema activo</div>
                </header>

                {estado === 'cargando' && <div className="state-box" role="status">Cargando rutinas…</div>}
                {estado === 'error' && (
                    <div className="state-box state-box--error" role="alert">
                        No se pudieron cargar las rutinas.{' '}
                        <button className="link-btn" type="button" onClick={() => { setEstado('cargando'); cargar(); }}>Reintentar</button>
                    </div>
                )}

                {estado === 'listo' && (<>

                    {/* Stats */}
                    <div className="stats-row">
                        {[
                            { label: 'Total rutinas', val: visibles.length, sub: 'asignadas', color: 'var(--accent)' },
                            { label: 'Completadas', val: completadas, sub: `${visibles.length ? Math.round(completadas / visibles.length * 100) : 0}% del total`, color: 'var(--accent5)' },
                            { label: 'Hoy programadas', val: visibles.filter(r => r.fechaProgramada === hoy).length, sub: 'sesiones', color: 'var(--accent2)' },
                            { label: 'Deportistas activos', val: deportistas.length, sub: 'vinculados contigo', color: 'var(--accent4)' },
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
                            {semana.map(d => (
                                <div key={d.iso} className="day-col">
                                    <div className="day-name">{d.name}</div>
                                    <div className={`day-dot ${visibles.some(r => r.fechaProgramada === d.iso) ? 'has-routine' : ''} ${d.iso === hoy ? 'today' : ''}`}></div>
                                    <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{d.day}</div>
                                </div>
                            ))}
                        </div>
                    </article>

                    <div className="layout">
                        {/* Form */}
                        <article className="card">
                            <div className="card-glow"></div>
                            <header className="card-title"><span className="card-title-icon">{editingId ? '✏️' : '➕'}</span> {editingId ? 'Editar' : 'Nueva'} rutina</header>

                            {sinDeportistas && !editingId ? (
                                <div className="warn-note">
                                    Aún no tienes deportistas vinculados, así que no hay a quién asignar rutinas.{' '}
                                    <Link className="link-btn" href="/panel_entrenador/gestion">Ir a Gestión</Link>
                                </div>
                            ) : (<>
                                <div className="form-grid" style={{ marginBottom: '10px' }}>
                                    <div className="field">
                                        <label className="field-label" htmlFor="rut-atleta">Deportista</label>
                                        <select id="rut-atleta" className="field-select" value={form.athlete} disabled={!!editingId}
                                            onChange={e => { const v = e.target.value; setForm(f => ({ ...f, athlete: v })); if (v && v !== 'todos') setVerAtleta(v); }}>
                                            <option value="">Seleccionar...</option>
                                            {deportistas.map(d => <option key={d.id} value={d.id}>{nombreDe(d)}</option>)}
                                            {editando && !deportistas.some(d => d.id === editando.atleta.id) && (
                                                <option value={editando.atleta.id}>{nombreDe(editando.atleta)}</option>
                                            )}
                                            {deportistas.length > 1 && !editingId && <option value="todos">Todos mis deportistas ({deportistas.length})</option>}
                                        </select>
                                    </div>
                                    <div className="field">
                                        <label className="field-label" htmlFor="rut-tipo">Tipo de entrenamiento</label>
                                        <select id="rut-tipo" className="field-select" value={form.type}
                                            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                                            <option value="">Seleccionar...</option>
                                            {Object.keys(EXERCISES).map(t => <option key={t}>{t}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="field" style={{ marginBottom: '10px' }}>
                                    <label className="field-label" htmlFor="rut-nombre">Nombre de la rutina</label>
                                    <input id="rut-nombre" className="field-input" maxLength={150} value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Entrenamiento de saque explosivo…" />
                                </div>
                                <div className="field" style={{ marginBottom: '10px' }}>
                                    <label className="field-label" htmlFor="rut-objetivo">Objetivo (lo ve el deportista)</label>
                                    <input id="rut-objetivo" className="field-input" maxLength={255} value={form.objetivo}
                                        onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} placeholder="Ej: Ganar precisión en el saque flotante" />
                                </div>
                                <div className="form-grid" style={{ marginBottom: '10px' }}>
                                    <div className="field">
                                        <label className="field-label">Hora de inicio</label>
                                        <div className="time-picker-row">
                                            <div className="time-block"><label htmlFor="rut-hh">HH</label><input id="rut-hh" className="time-input" type="number" min="0" max="23" value={form.hour} onChange={e => setForm(f => ({ ...f, hour: e.target.value }))} /></div>
                                            <div className="time-separator">:</div>
                                            <div className="time-block"><label htmlFor="rut-mm">MM</label><input id="rut-mm" className="time-input" type="number" min="0" max="59" value={form.min} onChange={e => setForm(f => ({ ...f, min: e.target.value }))} /></div>
                                        </div>
                                    </div>
                                    <div className="field">
                                        <label className="field-label" htmlFor="rut-fecha">Fecha</label>
                                        <input id="rut-fecha" className="field-input" type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="field" style={{ marginBottom: '10px' }}>
                                    <label className="field-label">Duración</label>
                                    <div className="duration-pills">
                                        {Object.keys(DURACIONES).map(d => (
                                            <button type="button" key={d} className={`dur-pill ${selectedDur === d ? 'selected' : ''}`} aria-pressed={selectedDur === d} onClick={() => setSelectedDur(d)}>{d}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="field" style={{ marginBottom: '10px' }}>
                                    <label className="field-label" htmlFor="rut-int">Intensidad</label>
                                    <div className="intensity-wrap">
                                        <input id="rut-int" className="intensity-slider" type="range" min="1" max="10" value={form.intensity} onChange={e => setForm(f => ({ ...f, intensity: e.target.value }))} />
                                        <div className="intensity-labels"><span>Suave</span><span>Moderado</span><span>Máximo</span></div>
                                        <div className="intensity-val" style={{ color: iCol(+form.intensity) }}>{form.intensity} / 10</div>
                                    </div>
                                </div>

                                {pool.length > 0 && (
                                    <div className="field" style={{ marginBottom: '10px' }}>
                                        <label className="field-label">Ejercicios sugeridos</label>
                                        <div className="ex-tags">
                                            {pool.map(ex => (
                                                <button type="button" key={ex} className={`ex-tag ${nombresElegidos.includes(ex) ? 'selected' : ''}`} aria-pressed={nombresElegidos.includes(ex)} onClick={() => toggleEx(ex)}>{ex}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="field" style={{ marginBottom: '10px' }}>
                                    <label className="field-label" htmlFor="rut-propio">Agregar ejercicio propio</label>
                                    <div className="ex-add-row">
                                        <input id="rut-propio" className="field-input" maxLength={150} value={propio} placeholder="Ej: Saque desde zona 5"
                                            onChange={e => setPropio(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarPropio(); } }} />
                                        <button type="button" className="btn-secondary" onClick={agregarPropio}>Agregar</button>
                                    </div>
                                </div>

                                <div className="field" style={{ marginBottom: '10px' }}>
                                    <label className="field-label">Ejercicios de la rutina ({exs.length})</label>
                                    {exs.length === 0 ? (
                                        <p className="ex-vacio">Elige ejercicios de arriba o agrega uno propio.</p>
                                    ) : (
                                        <ol className="ex-sel-list">
                                            {exs.map((e, i) => (
                                                <li key={e.nombre} className="ex-sel-row">
                                                    <span className="ex-sel-n">{i + 1}</span>
                                                    <span className="ex-sel-name">{e.nombre}</span>
                                                    <label className="ex-num"><input type="number" min="1" max="99" aria-label={`Series de ${e.nombre}`} value={e.series} onChange={ev => cambiarEx(e.nombre, 'series', ev.target.value)} /><span>series</span></label>
                                                    <label className="ex-num"><input type="number" min="1" max="99" aria-label={`Repeticiones de ${e.nombre}`} value={e.repeticiones} onChange={ev => cambiarEx(e.nombre, 'repeticiones', ev.target.value)} /><span>reps</span></label>
                                                    <button type="button" className="ex-x" aria-label={`Quitar ${e.nombre}`} onClick={() => toggleEx(e.nombre)}>✕</button>
                                                </li>
                                            ))}
                                        </ol>
                                    )}
                                </div>

                                <div className="field" style={{ marginBottom: '12px' }}>
                                    <label className="field-label" htmlFor="rut-notas">Notas / Observaciones</label>
                                    <textarea id="rut-notas" className="field-textarea" maxLength={2000} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Indicaciones especiales…"></textarea>
                                </div>
                                <button className="btn-primary" type="button" onClick={saveRoutine} disabled={guardando}>
                                    {guardando ? 'GUARDANDO…' : editingId ? '✏️ ACTUALIZAR RUTINA' : '⚡ ASIGNAR RUTINA'}
                                </button>
                                {editingId && <button className="btn-secondary btn-block" type="button" onClick={limpiarFormulario}>Cancelar edición</button>}
                            </>)}
                        </article>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Presets */}
                            <article className="card">
                                <header className="card-title"><span className="card-title-icon">📋</span> Rutinas prediseñadas</header>
                                <div className="presets-scroll">
                                    {PRESETS.map((p, i) => (
                                        <button type="button" key={i} className="preset-card" onClick={() => {
                                            setForm(f => ({ ...f, type: p.type, name: p.name, intensity: p.intensity }));
                                            setExs(p.exs.map(ejercicioNuevo)); setSelectedDur(p.dur); toast(`"${p.name}" cargada`);
                                        }}>
                                            <div className="preset-emoji">{p.emoji}</div>
                                            <div className="preset-name">{p.name}</div>
                                            <div className="preset-desc">{p.desc}</div>
                                            <div className="preset-tags">
                                                <span className="preset-tag" style={{ color: TYPE_COLORS[p.type] }}>{p.type}</span>
                                                <span className="preset-tag">{p.dur}</span>
                                                <span className="preset-tag">⚡ {p.intensity}/10</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </article>

                            {/* Progress rings */}
                            <article className="card">
                                <header className="card-title"><span className="card-title-icon">📊</span> Progreso semanal</header>
                                <div className="progress-rings">
                                    {['Técnico', 'Físico', 'Táctico', 'Recuperación'].map(t => {
                                        const { n, pct } = anillo(t);
                                        const r = 28, cx = 35, cy = 35, sw = 7, circ = 2 * Math.PI * r;
                                        const filled = circ * (pct / 100);
                                        return (
                                            <div key={t} className="ring-wrap" title={n ? `${n} rutina${n > 1 ? 's' : ''} esta semana` : 'Sin rutinas esta semana'} style={{ opacity: n ? 1 : .45 }}>
                                                <svg className="ring-svg" viewBox="0 0 70 70" role="img" aria-label={`${t}: ${pct}%`}>
                                                    <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
                                                    <circle cx={cx} cy={cy} r={r} fill="none" stroke={TYPE_COLORS[t]} strokeWidth={sw}
                                                        strokeDasharray={`${filled} ${circ - filled}`} strokeDashoffset={circ * 0.25} strokeLinecap="round" />
                                                    <text x={cx} y={cy + 5} fill={TYPE_COLORS[t]} fontSize="13" fontFamily="Rajdhani,sans-serif" fontWeight="700" textAnchor="middle">{pct}%</text>
                                                </svg>
                                                <div className="ring-label">{t}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </article>

                            {/* Resumen */}
                            <article className="card" style={{ borderColor: 'rgba(124,92,252,0.25)' }}>
                                <header className="card-title"><span className="card-title-icon">🔔</span> Atención</header>
                                <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6' }}>{resumen}</div>
                            </article>
                        </div>
                    </div>

                    <div className="section-divider"><div className="divider-line"></div><div className="divider-label">{atletaVisto ? `Rutinas de ${nombreDe(atletaVisto)}` : 'Rutinas Asignadas'}</div><div className="divider-line"></div></div>

                    <header className="routines-header">
                        <div className="routines-count">Total: <span>{filtered.length}</span> rutinas</div>
                        <div className="ver-atleta">
                            <label htmlFor="rut-ver" className="field-label">Ver rutinas de</label>
                            <select id="rut-ver" className="field-select" value={verAtleta} onChange={e => setVerAtleta(e.target.value)}>
                                <option value="">Todos mis deportistas</option>
                                {deportistas.map(d => <option key={d.id} value={d.id}>{nombreDe(d)}</option>)}
                                {atletaVisto && !deportistas.some(d => d.id === atletaVisto.id) && <option value={atletaVisto.id}>{nombreDe(atletaVisto)}</option>}
                            </select>
                        </div>
                        <div className="filter-pills">
                            {['Todas', ...Object.keys(TYPE_COLORS)].map(t => (
                                <button key={t} className={`fpill ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>{t}</button>
                            ))}
                        </div>
                    </header>

                    <div className="routines-grid">
                        {filtered.length === 0
                            ? <div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-text">{atletaVisto ? `${nombreDe(atletaVisto)} no tiene rutinas${filter !== 'Todas' ? ` de tipo ${filter}` : ''}` : 'Sin rutinas asignadas'}</div></div>
                            : filtered.map(r => {
                                const col = TYPE_COLORS[r.tipo] || 'var(--accent)';
                                const { total, completados, porcentaje } = r.progreso;
                                const vencida = !r.completada && r.fechaProgramada && r.fechaProgramada < hoy;
                                return (
                                    <div key={r.id} className="routine-card">
                                        <div className="routine-stripe" style={{ background: `linear-gradient(90deg,${col},transparent)` }}></div>
                                        <div className="routine-top">
                                            <div className="routine-badge" style={{ background: `${col}18`, border: `1px solid ${col}40`, color: col }}>{r.tipo}</div>
                                            {r.completada
                                                ? <div style={{ fontSize: '11px', color: 'var(--accent5)' }}>✔ Completada</div>
                                                : <div style={{ fontSize: '11px', color: vencida ? 'var(--accent3)' : 'var(--muted)' }}>{vencida ? 'Vencida · ' : ''}{fechaCorta(r.fechaProgramada)}</div>}
                                        </div>
                                        <div className="routine-name">{r.nombre}</div>
                                        <div className="routine-athlete">👤 {nombreDe(r.atleta)}</div>
                                        <div className="routine-meta">
                                            <div className="meta-item">⏰ {r.horaInicio ?? '—'}</div>
                                            <div className="meta-item">⏱ {durTexto(r.duracionMin)}</div>
                                            <div className="meta-item">⚡ {r.intensidad ?? '—'}/10</div>
                                        </div>
                                        <div className="routine-exercises">
                                            {r.ejercicios.slice(0, 4).map(e => <span key={e.id} className={`re-tag ${e.completado ? 'done' : ''}`}>{e.completado ? '✔ ' : ''}{e.nombre}</span>)}
                                            {r.ejercicios.length > 4 && <span className="re-tag">+{r.ejercicios.length - 4}</span>}
                                        </div>
                                        <div className="progress-line" title={`${completados} de ${total} ejercicios completados`}>
                                            <div className="intensity-bar-label">Avance del deportista · {completados}/{total}</div>
                                            <div className="progress-track"><div className="progress-fill" style={{ width: `${porcentaje}%` }}></div></div>
                                        </div>
                                        <div className="routine-footer">
                                            <div className="intensity-bar-wrap">
                                                <div className="intensity-bar-label">Intensidad</div>
                                                <div className="intensity-bar-track"><div className="intensity-bar-fill" style={{ width: `${(r.intensidad ?? 0) * 10}%`, background: iCol(r.intensidad ?? 0) }}></div></div>
                                            </div>
                                            <div className="routine-actions">
                                                <button className="act-btn edit" type="button" title={completados ? 'Con avance: no se puede editar' : 'Editar'} aria-label={`Editar ${r.nombre}`} aria-disabled={completados > 0} onClick={() => editRoutine(r)}>✏️</button>
                                                <button className="act-btn del" type="button" title="Eliminar" aria-label={`Eliminar ${r.nombre}`} onClick={() => setPorBorrar(r)}>🗑</button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>
                </>)}

                {/* Confirmar eliminación */}
                {porBorrar && (
                    <div className="modal-overlay open" onMouseDown={e => { if (e.target === e.currentTarget && !borrando) setPorBorrar(null); }}>
                        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rut-del-titulo">
                            <div className="modal-title" id="rut-del-titulo">Eliminar rutina</div>
                            <p className="modal-text">
                                {porBorrar.progreso.completados > 0
                                    ? <>«{porBorrar.nombre}» ya tiene {porBorrar.progreso.completados} de {porBorrar.progreso.total} ejercicios completados por {nombreDe(porBorrar.atleta)}. Si la eliminas, <strong>se pierde ese avance</strong>.</>
                                    : <>Se eliminará «{porBorrar.nombre}» de la lista de {nombreDe(porBorrar.atleta)}.</>}
                            </p>
                            <div className="modal-actions">
                                <button className="btn-secondary" type="button" onClick={() => setPorBorrar(null)} disabled={borrando}>Cancelar</button>
                                <button className="btn-danger" type="button" onClick={confirmarBorrado} disabled={borrando}>{borrando ? 'Eliminando…' : 'Eliminar'}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Toasts */}
                <div className="toast-container" aria-live="polite">
                    {toasts.map(t => (
                        <div key={t.id} className={`toast ${t.tipo === 'error' ? 'toast--error' : ''}`} role={t.tipo === 'error' ? 'alert' : 'status'}>
                            <div className="toast-icon">{t.tipo === 'error' ? '⚠️' : '✅'}</div>
                            <div style={{ flex: 1 }}><div className="toast-msg">{t.msg}</div></div>
                        </div>
                    ))}
                </div>
            </main>
        </>
    );
}