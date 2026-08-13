'use client';

import './Horario.css'

import { useState, useEffect, useRef } from 'react';

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6-23
const DAY_NAMES = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function isSameDay(a, b) {
    return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}
function fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtTime(d) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getSampleEvents() {
    const today = new Date();
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
    return [
        { id: 1, title: 'Entrenamiento técnico', type: 'Entrenamiento', place: 'Cancha Principal', notes: 'Técnica de recepción y saque', start: new Date(y, m, d, 8, 0), end: new Date(y, m, d, 10, 0) },
        { id: 2, title: 'Partido vs Tigres', type: 'Competencia', place: 'Estadio Municipal', notes: 'Uniforme completo', start: new Date(y, m, d + 1, 15, 0), end: new Date(y, m, d + 1, 17, 30) },
        { id: 3, title: 'Reunión táctica', type: 'Reunión', place: 'Sala de conferencias', notes: 'Revisión de videos', start: new Date(y, m, d + 3, 19, 0), end: new Date(y, m, d + 3, 20, 30) },
    ];
}

const EMPTY_FORM = { title: '', type: 'Entrenamiento', place: '', fecha: '', horaI: '09:00', horaF: '11:00', notes: '' };

export default function Horario() {
    const [view, setView] = useState('semana');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState(getSampleEvents);
    const [modal, setModal] = useState(false);
    const [monthPicker, setMonthPicker] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [toast, setToast] = useState({ show: false, msg: '' });
    const [mpYear, setMpYear] = useState(new Date().getFullYear());

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

    function getEventsForDay(date) {
        const s = new Date(date); s.setHours(0, 0, 0, 0);
        const e = new Date(date); e.setHours(23, 59, 59, 999);
        return events.filter(ev => ev.start <= e && ev.end >= s).sort((a, b) => a.start - b.start);
    }

    function openNew(date, hour) {
        const d = date ? fmtDate(date) : fmtDate(new Date());
        const h = hour != null ? `${String(hour).padStart(2, '0')}:00` : '09:00';
        const hf = hour != null ? `${String(hour + 2).padStart(2, '0')}:00` : '11:00';
        setForm({ ...EMPTY_FORM, fecha: d, horaI: h, horaF: hf });
        setEditingId(null);
        setModal(true);
    }

    function openEdit(id) {
        const ev = events.find(e => e.id === id);
        if (!ev) return;
        setForm({ title: ev.title, type: ev.type, place: ev.place || '', fecha: fmtDate(ev.start), horaI: fmtTime(ev.start), horaF: fmtTime(ev.end), notes: ev.notes || '' });
        setEditingId(id);
        setModal(true);
    }

    function saveEvent() {
        if (!form.title.trim()) { showToast('El nombre es obligatorio'); return; }
        if (!form.fecha || !form.horaI || !form.horaF) { showToast('Completa fecha y horarios'); return; }
        const start = new Date(`${form.fecha}T${form.horaI}`);
        const end = new Date(`${form.fecha}T${form.horaF}`);
        if (end <= start) { showToast('La hora fin debe ser posterior'); return; }
        const ev = { id: editingId || Date.now(), title: form.title, type: form.type, place: form.place, notes: form.notes, start, end };
        if (editingId) {
            setEvents(prev => prev.map(e => e.id === editingId ? ev : e));
            showToast('Evento actualizado');
        } else {
            setEvents(prev => [...prev, ev]);
            showToast('Evento creado');
        }
        setModal(false);
    }

    function deleteEvent() {
        setEvents(prev => prev.filter(e => e.id !== editingId));
        setModal(false);
        showToast('Evento eliminado');
    }

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

    const futureEvents = events.filter(e => e.end > new Date()).sort((a, b) => a.start - b.start).slice(0, 10);

    function typeClass(type) { return 'tipo-' + (type || '').replace(/[^a-zA-Z]/g, ''); }

    return (
        <>
                <main className="hor-main">
            <section className="main">
                <h2 className="page-section-label">Calendario / Horario</h2>
                <section className="cal-layout">

                    {/* Calendar */}
                    <article className="cal-area">
                        <header className="cal-controls">
                            <section className="ctrl-left">
                                <button className="ctrl-btn" onClick={() => { const d = new Date(currentDate); view === 'semana' ? d.setDate(d.getDate() - 7) : d.setMonth(d.getMonth() - 1); setCurrentDate(d); }}>
                                    <i className="fa-solid fa-chevron-left"></i>
                                </button>
                                <button className="ctrl-btn" onClick={() => { const d = new Date(currentDate); view === 'semana' ? d.setDate(d.getDate() + 7) : d.setMonth(d.getMonth() + 1); setCurrentDate(d); }}>
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
                                                        const dayEvs = getEventsForDay(day).filter(ev => ev.start.getHours() === hour);
                                                        return (
                                                            <div key={col} className="hour-cell" onClick={() => openNew(day, hour)}>
                                                                {dayEvs.map(ev => {
                                                                    const dur = (ev.end - ev.start) / 3600000;
                                                                    return (
                                                                        <div key={ev.id} className={`event-block ${typeClass(ev.type)}`}
                                                                            style={{ height: `${Math.max(dur * 56, 42)}px`, top: `${(ev.start.getMinutes() / 60) * 56}px` }}
                                                                            onClick={e => { e.stopPropagation(); openEdit(ev.id); }}>
                                                                            <div className="ev-title">{ev.title}</div>
                                                                            <div className="ev-time">{fmtTime(ev.start)} - {fmtTime(ev.end)}</div>
                                                                            {ev.place && <div className="ev-place">{ev.place}</div>}
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
                                            {getMonthGrid().map(({ date, isCurrentMonth }, i) => (
                                                <div key={i} className={`month-day ${isSameDay(date, new Date()) ? 'today' : ''} ${!isCurrentMonth ? 'other-month' : ''}`} onClick={() => openNew(date)}>
                                                    <span className="month-day-num">{date.getDate()}</span>
                                                    {getEventsForDay(date).slice(0, 3).map(ev => (
                                                        <div key={ev.id} className={`month-ev-dot ${typeClass(ev.type)}`} onClick={e => { e.stopPropagation(); openEdit(ev.id); }}>
                                                            {String(ev.start.getHours()).padStart(2, '0')}:{String(ev.start.getMinutes()).padStart(2, '0')} {ev.title.slice(0, 12)}{ev.title.length > 12 ? '...' : ''}
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
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
                                    <div key={ev.id} className="ep-item" onClick={() => openEdit(ev.id)}>
                                        <div className={`ep-dot ${typeClass(ev.type)}`}>
                                            <i className={`fa-solid ${ev.type === 'Competencia' ? 'fa-trophy' : ev.type === 'Reunión' ? 'fa-users' : 'fa-futbol'}`} style={{ fontSize: '11px' }}></i>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div className="ep-name">{ev.title}</div>
                                            <div className="ep-when">{ev.start.getDate()} {MONTH_SHORT[ev.start.getMonth()]} • {fmtTime(ev.start)}</div>
                                            {ev.place && <div className="ep-place">{ev.place}</div>}
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
                                <input className="field-inp" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej. Entrenamiento técnico" />
                            </label>
                            <label className="field">
                                <span className="field-label">Tipo</span>
                                <select className="field-sel" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                                    {['Entrenamiento', 'Competencia', 'Reunión', 'Otro'].map(o => <option key={o}>{o}</option>)}
                                </select>
                            </label>
                            <label className="field">
                                <span className="field-label">Lugar</span>
                                <input className="field-inp" value={form.place} onChange={e => setForm(f => ({ ...f, place: e.target.value }))} placeholder="Cancha 1…" />
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
                            <label className="field form-full">
                                <span className="field-label">Notas</span>
                                <textarea className="field-ta" rows="2" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Detalles adicionales…"></textarea>
                            </label>
                        </div>
                        <footer className="modal-foot">
                            {editingId && <button className="btn-danger-sm" onClick={deleteEvent}><i className="fa-solid fa-trash"></i> Eliminar</button>}
                            <button className="btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                            <button className="btn-primary" onClick={saveEvent}>Guardar</button>
                        </footer>
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