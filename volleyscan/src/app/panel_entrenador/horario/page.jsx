'use client';

import './Horario.css'

import { useState, useEffect, useCallback, useMemo } from 'react';
import { listarEquipos } from '@/lib/equipos/api';
import { asistenciaDeEvento, borrarEvento, crearEvento, editarEvento, fechaISO, guardarAsistencia, listarEventos, mensajeDeError } from '@/lib/horario/api';
import { listarDeportistas } from '@/lib/vinculos/api';

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6-23
const DAY_NAMES = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Clave de la base de datos → nombre en pantalla e ícono
const TIPOS = [
    { v: 'entrenamiento', t: 'Entrenamiento', icon: 'fa-futbol' },
    { v: 'partido', t: 'Competencia', icon: 'fa-trophy' },
    { v: 'evaluacion', t: 'Evaluación', icon: 'fa-clipboard-check' },
    { v: 'reunion', t: 'Reunión', icon: 'fa-users' },
    { v: 'otro', t: 'Otro', icon: 'fa-calendar-day' },
];
const TIPO = Object.fromEntries(TIPOS.map((t) => [t.v, t]));
const ESTADOS = [
    { v: 'programado', t: 'Programado' },
    { v: 'en_curso', t: 'En curso' },
    { v: 'completado', t: 'Completado' },
    { v: 'cancelado', t: 'Cancelado' },
];

function isSameDay(a, b) {
    return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}
function fmtDate(d) {
    return fechaISO(d);
}
function fmtTime(d) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}

// Evento del servidor → forma que usa el calendario
function aEvento(e) {
    return {
        id: e.id,
        title: e.titulo,
        tipo: e.tipo,
        estado: e.estado,
        marcados: e.asistenciaMarcada || 0,
        conLista: Boolean(e.equipo || e.deportista),
        place: e.ubicacion || '',
        notes: e.notas || '',
        equipo: e.equipo,
        deportista: e.deportista,
        start: new Date(`${e.fecha}T${e.horaInicio}`),
        end: new Date(`${e.fecha}T${e.horaFin}`),
    };
}

const ASISTENCIA = [
    { v: 'presente', t: 'Presente', c: 'p' },
    { v: 'tarde', t: 'Tarde', c: 't' },
    { v: 'ausente', t: 'Ausente', c: 'a' },
    { v: 'justificado', t: 'Justificado', c: 'j' },
];

const claseTipo = (tipo) => 'tipo-' + (tipo || 'otro');
const claseEstado = (estado) => (estado === 'cancelado' ? 'est-cancelado' : estado === 'completado' ? 'est-completado' : '');
const paraQuien = (ev) => (ev.equipo ? ev.equipo.nombre : ev.deportista ? ev.deportista.nombre : '');

const EMPTY_FORM = { title: '', tipo: 'entrenamiento', place: '', fecha: '', horaI: '09:00', horaF: '11:00', notes: '', para: 'personal', estado: 'programado' };

export default function Horario() {
    const [view, setView] = useState('semana');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [proximos, setProximos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState('');
    const [recarga, setRecarga] = useState(0);
    const [equipos, setEquipos] = useState([]);
    const [deportistas, setDeportistas] = useState([]);
    const [modal, setModal] = useState(false);
    const [monthPicker, setMonthPicker] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [guardando, setGuardando] = useState(false);
    const [toast, setToast] = useState({ show: false, msg: '' });
    const [mpYear, setMpYear] = useState(new Date().getFullYear());
    // Asistencia
    const [asis, setAsis] = useState(null); // { evento, deportistas, resumen, puedePasarLista } | 'cargando' | null
    const [asisFilas, setAsisFilas] = useState({});
    const [asisError, setAsisError] = useState('');
    const [asisNota, setAsisNota] = useState({}); // ids con el cuadro de nota abierto

    function showToast(msg) {
        setToast({ show: true, msg });
        setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
    }

    // Week dates
    function getWeekDates() {
        const d = new Date(currentDate);
        const dow = d.getDay();
        const diff = dow === 0 ? -6 : 1 - dow;
        d.setDate(d.getDate() + diff);
        d.setHours(0, 0, 0, 0);
        return Array.from({ length: 7 }, (_, i) => { const dd = new Date(d); dd.setDate(d.getDate() + i); return dd; });
    }

    const weekDays = getWeekDates();

    // Month grid
    function getMonthGrid() {
        const y = currentDate.getFullYear(), m = currentDate.getMonth();
        const first = new Date(y, m, 1);
        const dow = first.getDay();
        const prevDays = dow === 0 ? 6 : dow - 1;
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const cells = [];
        for (let i = 0; i < 42; i++) {
            let date, isCurrentMonth = true;
            if (i < prevDays) {
                const prev = new Date(y, m, 0);
                date = new Date(y, m - 1, prev.getDate() - prevDays + i + 1);
                isCurrentMonth = false;
            } else if (i - prevDays < daysInMonth) {
                date = new Date(y, m, i - prevDays + 1);
            } else {
                date = new Date(y, m + 1, i - prevDays - daysInMonth + 1);
                isCurrentMonth = false;
            }
            cells.push({ date, isCurrentMonth });
        }
        return cells;
    }

    // Rango que se pide al servidor: lo que se ve en pantalla
    const rangoVisible = useMemo(() => {
        if (view === 'semana') {
            const lun = (() => {
                const d = new Date(currentDate);
                const dow = d.getDay();
                d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
                return d;
            })();
            return [fmtDate(lun), fmtDate(addDays(lun, 6))];
        }
        const y = currentDate.getFullYear(), m = currentDate.getMonth();
        const dow = new Date(y, m, 1).getDay();
        const ini = new Date(y, m, 1 - (dow === 0 ? 6 : dow - 1));
        return [fmtDate(ini), fmtDate(addDays(ini, 41))];
    }, [view, currentDate]);

    const [desde, hasta] = rangoVisible;

    // Eventos del rango visible
    useEffect(() => {
        let vivo = true;
        setCargando(true);
        listarEventos(desde, hasta).then((r) => {
            if (!vivo) return;
            setCargando(false);
            if (r.ok) {
                setEvents(r.data.map(aEvento));
                setErrorCarga('');
            } else {
                setErrorCarga(mensajeDeError(r));
            }
        });
        return () => { vivo = false; };
    }, [desde, hasta, recarga]);

    // Próximos eventos (panel derecho): hoy → 60 días
    useEffect(() => {
        let vivo = true;
        const hoy = new Date();
        listarEventos(fmtDate(hoy), fmtDate(addDays(hoy, 60))).then((r) => {
            if (vivo && r.ok) setProximos(r.data.map(aEvento));
        });
        return () => { vivo = false; };
    }, [recarga]);

    // Equipos y deportistas para elegir "para quién" es el evento
    useEffect(() => {
        let vivo = true;
        Promise.all([listarEquipos(), listarDeportistas()]).then(([a, b]) => {
            if (!vivo) return;
            if (a.ok) setEquipos(a.data);
            if (b.ok) setDeportistas(Array.isArray(b.data) ? b.data : b.data?.deportistas ?? []);
        });
        return () => { vivo = false; };
    }, []);

    const refrescar = useCallback(() => setRecarga((n) => n + 1), []);

    function getEventsForDay(date) {
        const s = new Date(date); s.setHours(0, 0, 0, 0);
        const e = new Date(date); e.setHours(23, 59, 59, 999);
        return events.filter(ev => ev.start <= e && ev.end >= s).sort((a, b) => a.start - b.start);
    }

    function openNew(date, hour) {
        const d = date ? fmtDate(date) : fmtDate(new Date());
        const h = hour != null ? `${String(hour).padStart(2, '0')}:00` : '09:00';
        const hf = hour != null ? `${String(Math.min(hour + 2, 23)).padStart(2, '0')}:${hour + 2 > 23 ? '59' : '00'}` : '11:00';
        const para = equipos.length > 0 ? `equipo:${equipos[0].id}` : 'personal';
        setForm({ ...EMPTY_FORM, fecha: d, horaI: h, horaF: hf, para });
        setEditingId(null);
        setModal(true);
    }

    function openEdit(id) {
        const ev = events.find(e => e.id === id) || proximos.find(e => e.id === id);
        if (!ev) return;
        const para = ev.equipo ? `equipo:${ev.equipo.id}` : ev.deportista ? `deportista:${ev.deportista.id}` : 'personal';
        setForm({ title: ev.title, tipo: ev.tipo, place: ev.place, fecha: fmtDate(ev.start), horaI: fmtTime(ev.start), horaF: fmtTime(ev.end), notes: ev.notes, para, estado: ev.estado });
        setEditingId(id);
        setModal(true);
    }

    async function saveEvent() {
        if (guardando) return;
        if (!form.title.trim()) { showToast('El nombre es obligatorio'); return; }
        if (!form.fecha || !form.horaI || !form.horaF) { showToast('Completa fecha y horarios'); return; }
        if (form.horaF <= form.horaI) { showToast('La hora fin debe ser posterior'); return; }
        const [tipoPara, idPara] = form.para.split(':');
        const cuerpo = {
            titulo: form.title.trim(), tipo: form.tipo, fecha: form.fecha, horaInicio: form.horaI, horaFin: form.horaF,
            ubicacion: form.place, notas: form.notes, estado: form.estado,
            equipoId: tipoPara === 'equipo' ? Number(idPara) : null,
            deportistaId: tipoPara === 'deportista' ? Number(idPara) : null,
        };
        setGuardando(true);
        const r = editingId ? await editarEvento(editingId, cuerpo) : await crearEvento(cuerpo);
        setGuardando(false);
        if (!r.ok) { showToast(mensajeDeError(r)); return; }
        showToast(editingId ? 'Evento actualizado' : 'Evento creado');
        setModal(false);
        refrescar();
    }

    async function deleteEvent() {
        if (guardando || !editingId) return;
        if (!window.confirm('¿Eliminar este evento? Si es de un equipo o de un deportista, se les avisará.')) return;
        setGuardando(true);
        const r = await borrarEvento(editingId);
        setGuardando(false);
        if (!r.ok) { showToast(mensajeDeError(r)); return; }
        setModal(false);
        showToast('Evento eliminado');
        refrescar();
    }

    const eventoAsis = asis && asis !== 'cargando' ? asis : null;

    async function abrirAsistencia() {
        if (!editingId) return;
        setModal(false);
        setAsis('cargando');
        setAsisError('');
        setAsisNota({});
        const r = await asistenciaDeEvento(editingId);
        if (!r.ok) { setAsis(null); showToast(mensajeDeError(r)); return; }
        setAsis(r.data);
        setAsisFilas(Object.fromEntries(r.data.deportistas.map(d => [d.id, { estado: d.estado, observacion: d.observacion, observacionVisible: d.observacionVisible }])));
        setAsisNota(Object.fromEntries(r.data.deportistas.filter(d => d.observacion).map(d => [d.id, true])));
    }

    function marcar(id, estado) {
        setAsisFilas(f => ({ ...f, [id]: { ...f[id], estado: f[id].estado === estado ? null : estado } }));
    }
    function marcarTodos(estado) {
        setAsisFilas(f => Object.fromEntries(Object.entries(f).map(([id, v]) => [id, { ...v, estado: eventoAsis.deportistas.find(d => d.id === Number(id))?.activo ? estado : v.estado }])));
    }
    const asisCambios = eventoAsis
        ? eventoAsis.deportistas.filter(d => {
            const f = asisFilas[d.id];
            return f && (f.estado !== d.estado || (f.observacion || '') !== (d.observacion || '') || (f.observacion?.trim() ? f.observacionVisible : false) !== d.observacionVisible);
        })
        : [];

    async function guardarLista() {
        if (guardando || asisCambios.length === 0) return;
        setGuardando(true);
        setAsisError('');
        const registros = asisCambios.map(d => ({ deportistaId: d.id, estado: asisFilas[d.id].estado, observacion: asisFilas[d.id].observacion || '', observacionVisible: asisFilas[d.id].observacionVisible }));
        const r = await guardarAsistencia(eventoAsis.evento.id, registros);
        setGuardando(false);
        if (!r.ok) { setAsisError(mensajeDeError(r)); return; }
        showToast('Asistencia guardada');
        setAsis(null);
        refrescar();
    }

    function cerrarAsistencia() {
        if (asisCambios.length > 0 && !window.confirm('Tienes cambios sin guardar. ¿Salir de todos modos?')) return;
        setAsis(null);
    }

    const futureEvents = proximos.filter(e => e.end > new Date() && e.estado !== 'cancelado').slice(0, 10);

    // Fila de la semana donde se dibuja el evento (los de antes de las 6:00 se dibujan en la primera fila)
    const filaDe = (ev) => Math.min(23, Math.max(6, ev.start.getHours()));

    const avisoPara = form.para.startsWith('equipo:')
        ? 'Los deportistas del equipo verán este evento y recibirán un aviso.'
        : form.para.startsWith('deportista:')
            ? 'Solo ese deportista lo verá y recibirá un aviso.'
            : 'Solo tú verás este evento.';

    return (
        <>
                <main className="hor-main">
            <section className="main">
                <h2 className="page-section-label">Calendario / Horario</h2>

                {errorCarga && (
                    <div className="hor-estado mal" role="alert">
                        {errorCarga} <button onClick={refrescar}>Reintentar</button>
                    </div>
                )}
                {cargando && !errorCarga && <div className="hor-estado" role="status"><span className="hor-pulso" />Cargando horario…</div>}

                <section className="cal-layout">

                    {/* Calendar */}
                    <article className="cal-area">
                        <header className="cal-controls">
                            <section className="ctrl-left">
                                <button className="ctrl-btn" aria-label="Anterior" onClick={() => { const d = new Date(currentDate); view === 'semana' ? d.setDate(d.getDate() - 7) : d.setMonth(d.getMonth() - 1); setCurrentDate(d); }}>
                                    <i className="fa-solid fa-chevron-left"></i>
                                </button>
                                <button className="ctrl-btn" aria-label="Siguiente" onClick={() => { const d = new Date(currentDate); view === 'semana' ? d.setDate(d.getDate() + 7) : d.setMonth(d.getMonth() + 1); setCurrentDate(d); }}>
                                    <i className="fa-solid fa-chevron-right"></i>
                                </button>
                                <button className="ctrl-pill" onClick={() => setCurrentDate(new Date())}>Hoy</button>
                            </section>
                            <section className="ctrl-center">
                                <button className="month-label" onClick={() => { setMpYear(currentDate.getFullYear()); setMonthPicker(true); }}>
                                    {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()} <i className="fa-solid fa-chevron-down" style={{ fontSize: '11px' }}></i>
                                </button>
                            </section>
                            <section className="ctrl-right">
                                <button className={`view-btn ${view === 'semana' ? 'active' : ''}`} onClick={() => setView('semana')}>Semana</button>
                                <button className={`view-btn ${view === 'mes' ? 'active' : ''}`} onClick={() => setView('mes')}>Mes</button>
                            </section>
                        </header>

                        <section className="cal-grid-wrap">
                            {/* SEMANA */}
                            {view === 'semana' && (
                                <section className="cal-view">
                                    <aside className="time-col">
                                        <div style={{ height: '44px' }}></div>
                                        {HOURS.map(h => <div key={h} className="time-slot">{String(h).padStart(2, '0')}:00</div>)}
                                    </aside>
                                    <section className="days-grid">
                                        <div className="days-header" style={{ gridTemplateColumns: 'repeat(7,1fr)' }}>
                                            {weekDays.map((d, i) => (
                                                <div key={i} className={`day-header-cell ${isSameDay(d, new Date()) ? 'today' : ''}`}>
                                                    <span className="day-name">{DAY_NAMES[i]}</span>
                                                    <span className="day-num">{d.getDate()} {MONTH_SHORT[d.getMonth()]}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="days-body">
                                            {HOURS.map(hour => (
                                                <div key={hour} className="hour-row" style={{ gridTemplateColumns: 'repeat(7,1fr)' }}>
                                                    {weekDays.map((day, col) => {
                                                        const dayEvs = getEventsForDay(day).filter(ev => filaDe(ev) === hour);
                                                        return (
                                                            <div key={col} className="hour-cell" onClick={() => openNew(day, hour)}>
                                                                {dayEvs.map(ev => {
                                                                    const dur = (ev.end - ev.start) / 3600000;
                                                                    const mismaFila = ev.start.getHours() === hour;
                                                                    return (
                                                                        <div key={ev.id} className={`event-block ${claseTipo(ev.tipo)} ${claseEstado(ev.estado)}`}
                                                                            style={{ height: `${Math.max(dur * 56, 42)}px`, top: `${mismaFila ? (ev.start.getMinutes() / 60) * 56 : 0}px` }}
                                                                            onClick={e => { e.stopPropagation(); openEdit(ev.id); }}>
                                                                            <div className="ev-title">{ev.title}</div>
                                                                            <div className="ev-time">{fmtTime(ev.start)} - {fmtTime(ev.end)}</div>
                                                                            {ev.place && <div className="ev-place">{ev.place}</div>}
                                                                            {paraQuien(ev) && <div className="ev-team">{paraQuien(ev)}</div>}
                                                                            {ev.marcados > 0 && <div className="ev-lista">✓ Lista · {ev.marcados}</div>}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </section>
                            )}

                            {/* MES */}
                            {view === 'mes' && (
                                <section className="cal-view">
                                    <section className="month-grid">
                                        <div className="month-header-row">
                                            {DAY_NAMES.map(d => <div key={d} className="month-header-cell">{d}</div>)}
                                        </div>
                                        <div className="month-days-grid">
                                            {getMonthGrid().map(({ date, isCurrentMonth }, i) => {
                                                const delDia = getEventsForDay(date);
                                                return (
                                                    <div key={i} className={`month-day ${isSameDay(date, new Date()) ? 'today' : ''} ${!isCurrentMonth ? 'other-month' : ''}`} onClick={() => openNew(date)}>
                                                        <span className="month-day-num">{date.getDate()}</span>
                                                        {delDia.slice(0, 3).map(ev => (
                                                            <div key={ev.id} className={`month-ev-dot ${claseTipo(ev.tipo)} ${claseEstado(ev.estado)}`} onClick={e => { e.stopPropagation(); openEdit(ev.id); }}>
                                                                {fmtTime(ev.start)} {ev.title.slice(0, 12)}{ev.title.length > 12 ? '...' : ''}
                                                            </div>
                                                        ))}
                                                        {delDia.length > 3 && <div className="muted" style={{ fontSize: 10, color: 'var(--t2)' }}>+{delDia.length - 3} más</div>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                </section>
                            )}
                        </section>
                    </article>

                    {/* Sidebar panel */}
                    <aside className="events-panel">
                        <h3 className="ep-title">Próximos eventos</h3>
                        <section className="ep-list">
                            {futureEvents.length === 0
                                ? <div style={{ textAlign: 'center', color: 'var(--t3)', padding: '20px', fontSize: '12px' }}>No hay eventos próximos</div>
                                : futureEvents.map(ev => (
                                    <div key={ev.id} className={`ep-item ${claseEstado(ev.estado)}`} onClick={() => openEdit(ev.id)}>
                                        <div className={`ep-dot ${claseTipo(ev.tipo)}`}>
                                            <i className={`fa-solid ${(TIPO[ev.tipo] ?? TIPO.otro).icon}`} style={{ fontSize: '11px' }}></i>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div className="ep-name">{ev.title}</div>
                                            <div className="ep-when">{ev.start.getDate()} {MONTH_SHORT[ev.start.getMonth()]} • {fmtTime(ev.start)}</div>
                                            {ev.place && <div className="ep-place">{ev.place}</div>}
                                            {paraQuien(ev) && <div className="ep-place">{paraQuien(ev)}</div>}
                                        </div>
                                    </div>
                                ))
                            }
                        </section>
                        <button className="btn-nuevo" onClick={() => openNew()}>
                            <i className="fa-solid fa-plus"></i> Nuevo evento
                        </button>
                    </aside>
                </section>
            </section>

            {/* Month Picker */}
            {monthPicker && (
                <aside className="overlay open" onClick={() => setMonthPicker(false)}>
                    <article className="modal modal-sm" onClick={e => e.stopPropagation()}>
                        <header className="modal-head">
                            <h4 className="modal-title">Seleccionar mes</h4>
                            <button className="modal-close" onClick={() => setMonthPicker(false)}><i className="fa-solid fa-xmark"></i></button>
                        </header>
                        <section className="month-picker-grid">
                            {MONTH_NAMES.map((mn, idx) => (
                                <div key={idx} className={`mp-month ${currentDate.getMonth() === idx && currentDate.getFullYear() === mpYear ? 'selected' : ''}`}
                                    onClick={() => { setCurrentDate(new Date(mpYear, idx, 1)); setMonthPicker(false); }}>
                                    {mn.slice(0, 3)}
                                </div>
                            ))}
                        </section>
                        <footer style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                            <button className="ctrl-btn" onClick={() => setMpYear(y => y - 1)}><i className="fa-solid fa-chevron-left"></i></button>
                            <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--t1)' }}>{mpYear}</span>
                            <button className="ctrl-btn" onClick={() => setMpYear(y => y + 1)}><i className="fa-solid fa-chevron-right"></i></button>
                        </footer>
                    </article>
                </aside>
            )}

            {/* Event Modal */}
            {modal && (
                <aside className="overlay open" onClick={e => e.target === e.currentTarget && setModal(false)}>
                    <article className="modal" onClick={e => e.stopPropagation()}>
                        <header className="modal-head">
                            <h4 className="modal-title">
                                <i className={`fa-solid ${editingId ? 'fa-pen' : 'fa-calendar-plus'}`}></i> {editingId ? 'Editar evento' : 'Nuevo evento'}
                            </h4>
                            <button className="modal-close" onClick={() => setModal(false)}><i className="fa-solid fa-xmark"></i></button>
                        </header>
                        <div className="form-grid">
                            <label className="field form-full">
                                <span className="field-label">Nombre del evento</span>
                                <input className="field-inp" value={form.title} maxLength={150} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej. Entrenamiento técnico" />
                            </label>
                            <label className="field form-full">
                                <span className="field-label">Para</span>
                                <select className="field-sel" value={form.para} onChange={e => setForm(f => ({ ...f, para: e.target.value }))}>
                                    {equipos.length > 0 && (
                                        <optgroup label="Equipos">
                                            {equipos.map(eq => <option key={eq.id} value={`equipo:${eq.id}`}>{eq.nombre}</option>)}
                                        </optgroup>
                                    )}
                                    {deportistas.length > 0 && (
                                        <optgroup label="Un deportista">
                                            {deportistas.map(d => <option key={d.id} value={`deportista:${d.id}`}>{d.nombre} {d.apellido}</option>)}
                                        </optgroup>
                                    )}
                                    <option value="personal">Solo para mí</option>
                                </select>
                                <span className="field-hint">{avisoPara}</span>
                            </label>
                            <label className="field">
                                <span className="field-label">Tipo</span>
                                <select className="field-sel" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                                    {TIPOS.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}
                                </select>
                            </label>
                            <label className="field">
                                <span className="field-label">Lugar</span>
                                <input className="field-inp" value={form.place} maxLength={150} onChange={e => setForm(f => ({ ...f, place: e.target.value }))} placeholder="Cancha 1…" />
                            </label>
                            <label className="field">
                                <span className="field-label">Fecha</span>
                                <input className="field-inp" type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                            </label>
                            <label className="field">
                                <span className="field-label">Hora inicio</span>
                                <input className="field-inp" type="time" value={form.horaI} onChange={e => setForm(f => ({ ...f, horaI: e.target.value }))} />
                            </label>
                            <label className="field">
                                <span className="field-label">Hora fin</span>
                                <input className="field-inp" type="time" value={form.horaF} onChange={e => setForm(f => ({ ...f, horaF: e.target.value }))} />
                            </label>
                            {editingId && (
                                <label className="field">
                                    <span className="field-label">Estado</span>
                                    <select className="field-sel" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                                        {ESTADOS.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}
                                    </select>
                                </label>
                            )}
                            <label className="field form-full">
                                <span className="field-label">Indicaciones</span>
                                <textarea className="field-ta" rows="3" maxLength={2000} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Qué llevar, qué se va a trabajar, punto de encuentro… (los deportistas lo ven)"></textarea>
                            </label>
                        </div>
                        <footer className="modal-foot">
                            {editingId && <button className="btn-danger-sm" disabled={guardando} onClick={deleteEvent}><i className="fa-solid fa-trash"></i> Eliminar</button>}
                            {editingId && events.concat(proximos).find(e => e.id === editingId)?.conLista && form.estado !== 'cancelado' && (
                                <button className="btn-ghost" disabled={guardando} onClick={abrirAsistencia}>
                                    <i className="fa-solid fa-clipboard-user"></i> Asistencia
                                </button>
                            )}
                            <button className="btn-ghost" disabled={guardando} onClick={() => setModal(false)}>Cancelar</button>
                            <button className="btn-primary" disabled={guardando} onClick={saveEvent}>{guardando ? 'Guardando…' : 'Guardar'}</button>
                        </footer>
                    </article>
                </aside>
            )}

            {asis && (
                <aside className="overlay open" onClick={e => e.target === e.currentTarget && eventoAsis && cerrarAsistencia()}>
                    <article className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <header className="modal-head">
                            <h4 className="modal-title"><i className="fa-solid fa-clipboard-user"></i> {eventoAsis ? `Asistencia · ${eventoAsis.evento.titulo}` : 'Asistencia'}</h4>
                            <button className="modal-close" onClick={() => (eventoAsis ? cerrarAsistencia() : setAsis(null))}><i className="fa-solid fa-xmark"></i></button>
                        </header>
                        {!eventoAsis && <div className="hor-estado" role="status"><span className="hor-pulso" />Cargando lista…</div>}
                        {eventoAsis && (
                            <>
                                <p className="as-sub">
                                    {eventoAsis.evento.fecha.split('-').reverse().join('/')} · {eventoAsis.evento.horaInicio} – {eventoAsis.evento.horaFin}
                                    {eventoAsis.evento.equipo ? ` · ${eventoAsis.evento.equipo.nombre}` : ''}
                                </p>
                                {!eventoAsis.puedePasarLista && <div className="hor-estado mal" role="status">Solo puedes pasar lista de eventos que ya llegaron.</div>}
                                {asisError && <div className="hor-estado mal" role="alert">{asisError}</div>}
                                <div className="as-resumen">
                                    {ASISTENCIA.map(o => (
                                        <span key={o.v} className={`as-chip as-${o.c}`}>{o.t} · {Object.values(asisFilas).filter(f => f.estado === o.v).length}</span>
                                    ))}
                                    <span className="as-chip">Sin marcar · {Object.values(asisFilas).filter(f => !f.estado).length}</span>
                                    {eventoAsis.puedePasarLista && <button className="as-todos" onClick={() => marcarTodos('presente')}>Marcar a todos presentes</button>}
                                </div>
                                {eventoAsis.deportistas.length === 0 && <div className="as-vacio">Este evento no tiene deportistas todavía.</div>}
                                <ul className="as-lista">
                                    {eventoAsis.deportistas.map(d => {
                                        const f = asisFilas[d.id] || {};
                                        const notaAbierta = asisNota[d.id] || f.observacion;
                                        return (
                                            <li key={d.id} className={`as-fila ${d.activo ? '' : 'as-inactivo'}`}>
                                                <div className="as-persona">
                                                    <span className="as-avatar">{`${d.nombre?.[0] ?? ''}${d.apellido?.[0] ?? ''}`.toUpperCase()}</span>
                                                    <div>
                                                        <strong>{d.nombre} {d.apellido}</strong>
                                                        <small>{d.activo ? [d.posicion, d.numeroCamiseta != null && `N.º ${d.numeroCamiseta}`].filter(Boolean).join(' · ') || ' ' : 'Ya no está en el equipo'}</small>
                                                    </div>
                                                </div>
                                                <div className="as-botones" role="group" aria-label={`Asistencia de ${d.nombre}`}>
                                                    {ASISTENCIA.map(o => (
                                                        <button key={o.v} type="button" disabled={!eventoAsis.puedePasarLista} aria-pressed={f.estado === o.v}
                                                            className={`as-op as-${o.c} ${f.estado === o.v ? 'on' : ''}`} onClick={() => marcar(d.id, o.v)}>{o.t}</button>
                                                    ))}
                                                    <button type="button" className={`as-nota-btn ${notaAbierta ? 'on' : ''}`} onClick={() => setAsisNota(n => ({ ...n, [d.id]: !n[d.id] }))} title="Observación" aria-label={`Observación de ${d.nombre}`}>
                                                        <i className="fa-solid fa-comment-dots"></i>
                                                    </button>
                                                </div>
                                                {notaAbierta && (
                                                    <div className="as-nota">
                                                        <textarea className="field-ta" rows="2" maxLength={1000} value={f.observacion || ''} placeholder="Observación sobre este deportista en este evento…"
                                                            onChange={e => setAsisFilas(x => ({ ...x, [d.id]: { ...x[d.id], observacion: e.target.value } }))}></textarea>
                                                        <label className="as-visible">
                                                            <input type="checkbox" checked={!!f.observacionVisible} onChange={e => setAsisFilas(x => ({ ...x, [d.id]: { ...x[d.id], observacionVisible: e.target.checked } }))} />
                                                            Visible para el deportista {f.observacionVisible ? '(le llegará un aviso)' : '(solo tú la ves)'}
                                                        </label>
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                                <footer className="modal-foot">
                                    <button className="btn-ghost" disabled={guardando} onClick={cerrarAsistencia}>Cerrar</button>
                                    <button className="btn-primary" disabled={guardando || asisCambios.length === 0} onClick={guardarLista}>
                                        {guardando ? 'Guardando…' : asisCambios.length ? `Guardar (${asisCambios.length})` : 'Guardar'}
                                    </button>
                                </footer>
                            </>
                        )}
                    </article>
                </aside>
            )}

            <aside className={`toast ${toast.show ? 'show' : ''}`}>
                <i className="fa-solid fa-circle-check" id="toastIcon"></i>
                <span>{toast.msg}</span>
            </aside>
        </main>

        </>
    );
}
