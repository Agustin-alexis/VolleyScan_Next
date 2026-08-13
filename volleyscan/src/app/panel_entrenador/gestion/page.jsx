'use client';

import './Gestion.css'
import {
    FiEye,
    FiEdit2,
    FiTrash2,
    FiSearch,
    FiPlus,
    FiUserX,
    FiAlertTriangle,
    FiCheckCircle,
    FiXCircle
} from 'react-icons/fi';



import { useState } from 'react';

const COLORS = ['#3b82f6', '#7c3aed', '#06b6d4', '#f59e0b', '#22d3a5', '#f43f5e', '#8b5cf6', '#10b981'];
const initials = n => n.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
const colorFor = id => COLORS[(id - 1) % COLORS.length];

const initialAthletes = [
    { id: 1, nombre: 'Juan Pérez', edad: 17, pos: 'Opuesto', cat: 'Juvenil', nivel: 'Avanzado', estado: 'Activo', perf: 85, trend: 12, asis: 92, ses: 24 },
    { id: 2, nombre: 'María González', edad: 16, pos: 'Líbero', cat: 'Juvenil', nivel: 'Intermedio', estado: 'Activo', perf: 78, trend: 8, asis: 88, ses: 20 },
    { id: 3, nombre: 'Carlos Ramírez', edad: 18, pos: 'Central', cat: 'Mayor', nivel: 'Avanzado', estado: 'Activo', perf: 91, trend: 5, asis: 96, ses: 30 },
    { id: 4, nombre: 'Sofía Ortega', edad: 15, pos: 'Armadora', cat: 'Juvenil', nivel: 'Principiante', estado: 'Inactivo', perf: 62, trend: -3, asis: 70, ses: 12 },
    { id: 5, nombre: 'Andrés López', edad: 17, pos: 'Receptor', cat: 'Juvenil', nivel: 'Intermedio', estado: 'Activo', perf: 80, trend: 10, asis: 90, ses: 22 },
];

const emptyForm = { nombre: '', edad: '', pos: '', cat: 'Juvenil', nivel: 'Principiante', estado: 'Activo', perf: '', asis: '', ses: '', trend: '' };

export default function Gestion() {
    const [athletes, setAthletes] = useState(initialAthletes);
    const [nextId, setNextId] = useState(6);
    const [selectedId, setSelectedId] = useState(null);
    const [search, setSearch] = useState('');
    const [catFilter, setCatFilter] = useState('');
    const [stateFilter, setStateFilter] = useState('');
    const [formModal, setFormModal] = useState(false);
    const [confirmModal, setConfirmModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [toast, setToast] = useState({ msg: '', show: false, error: false });

    function showToast(msg, error = false) {
        setToast({ msg, show: true, error });
        setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
    }

    const filtered = athletes.filter(a =>
        (!search || a.nombre.toLowerCase().includes(search.toLowerCase()) || a.pos.toLowerCase().includes(search.toLowerCase())) &&
        (!catFilter || a.cat === catFilter) &&
        (!stateFilter || a.estado === stateFilter)
    );

    const selected = athletes.find(a => a.id === selectedId);

    function openAdd() { setEditingId(null); setForm(emptyForm); setFormModal(true); }
    function openEdit(a, e) { e.stopPropagation(); setEditingId(a.id); setForm({ ...a }); setFormModal(true); }
    function askDelete(id, e) { e.stopPropagation(); setDeletingId(id); setConfirmModal(true); }

    function saveAthlete() {
        if (!form.nombre.trim()) { showToast('El nombre es obligatorio', true); return; }
        if (!form.edad || form.edad < 10 || form.edad > 60) { showToast('Edad inválida (10–60)', true); return; }
        if (!form.pos.trim()) { showToast('La posición es obligatoria', true); return; }
        if (editingId) {
            setAthletes(prev => prev.map(a => a.id === editingId ? { ...a, ...form } : a));
            showToast(`${form.nombre} actualizado correctamente`);
        } else {
            const id = nextId;
            setAthletes(prev => [...prev, { ...form, id, edad: +form.edad, perf: +form.perf || 0, asis: +form.asis || 0, ses: +form.ses || 0, trend: +form.trend || 0 }]);
            setNextId(id + 1);
            showToast(`${form.nombre} agregado correctamente`);
        }
        setFormModal(false);
    }

    function confirmDelete() {
        const a = athletes.find(x => x.id === deletingId);
        setAthletes(prev => prev.filter(x => x.id !== deletingId));
        if (selectedId === deletingId) setSelectedId(null);
        showToast(`${a.nombre} eliminado`);
        setConfirmModal(false);
    }

    return (
        <>
            <section className="app">
                <main className="gest-main">
                    <h2 className="page-title">Gestión de Deportistas</h2>
                    <section className="content-row">
                        <article className="table-panel">
                            <header className="toolbar">
                                <label className="search-wrap">
                                    <i className="fa-solid fa-magnifying-glass"></i>
                                    <input className="search-inp" type="text" placeholder="Buscar deportista..." value={search} onChange={e => setSearch(e.target.value)} />
                                </label>
                                <select className="filter-sel" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                                    <option value="">Categoría</option>
                                    <option>Juvenil</option><option>Mayor</option><option>Infantil</option>
                                </select>
                                <select className="filter-sel" value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
                                    <option value="">Estado</option>
                                    <option>Activo</option><option>Inactivo</option>
                                </select>
                                <button className="btn-add" onClick={openAdd}>
                                    <i className="fa-solid fa-plus"></i> Agregar deportista
                                </button>
                            </header>
                            <section className="table-wrap">
                                <table className="athletes-table">
                                    <thead>
                                        <tr><th>Foto</th><th>Nombre</th><th>Edad</th><th>Categoría</th><th>Nivel</th><th>Estado</th><th>Acciones</th></tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(a => (
                                            <tr key={a.id} className={selectedId === a.id ? 'selected' : ''} onClick={() => setSelectedId(a.id)}>
                                                <td><span className="avatar-circle" style={{ background: colorFor(a.id) }}>{initials(a.nombre)}</span></td>
                                                <td>{a.nombre}</td>
                                                <td>{a.edad}</td>
                                                <td>{a.cat}</td>
                                                <td>{a.nivel}</td>
                                                <td><span className={`badge ${a.estado === 'Activo' ? 'active' : 'inactive'}`}>{a.estado}</span></td>
                                                <td>
                                                    <span className="actions">
                                                        <button
                                                            className="action-btn view"
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                setSelectedId(a.id);
                                                            }}
                                                        >
                                                            <FiEye />
                                                        </button>

                                                        <button
                                                            className="action-btn edit"
                                                            onClick={e => openEdit(a, e)}
                                                        >
                                                            <FiEdit2 />
                                                        </button>

                                                        <button
                                                            className="action-btn del"
                                                            onClick={e => askDelete(a.id, e)}
                                                        >
                                                            <FiTrash2 />
                                                        </button>
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filtered.length === 0 && <p className="empty-msg">No se encontraron deportistas.</p>}
                            </section>
                        </article>

                        <aside className="detail-panel">
                            {!selected ? (
                                <section className="detail-empty">
                                    <i className="fa-solid fa-user-slash" style={{ fontSize: '28px' }}></i>
                                    <p style={{ fontSize: '13px' }}>Selecciona un deportista para ver su información</p>
                                </section>
                            ) : (
                                <section style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                    <header className="detail-header">
                                        <span className="detail-av" style={{ background: colorFor(selected.id) }}>{initials(selected.nombre)}</span>
                                        <p className="detail-name">{selected.nombre}</p>
                                        <p className="detail-pos">{selected.pos}</p>
                                        <p className="detail-meta">{selected.edad} años · Categoría: {selected.cat}</p>
                                    </header>
                                    <section className="detail-stats">
                                        <p className="stat-block-label">Rendimiento promedio</p>
                                        <p className="perf-row">
                                            <span className="perf-big">{selected.perf}%</span>
                                            <span className="perf-up" style={{ color: selected.trend >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                                {selected.trend >= 0 ? '↑' : '↓'} {Math.abs(selected.trend)}%
                                            </span>
                                        </p>
                                        {[['Asistencia', `${selected.asis}%`], ['Sesiones completadas', selected.ses], ['Nivel', selected.nivel]].map(([k, v]) => (
                                            <article key={k} className="stat-line">
                                                <span className="stat-key">{k}</span>
                                                <span className="stat-val">{v}</span>
                                            </article>
                                        ))}
                                    </section>
                                    <button className="btn-profile" onClick={() => showToast(`Perfil de ${selected.nombre} — función próximamente 🚀`)}>Ver perfil completo</button>
                                </section>
                            )}
                        </aside>
                    </section>
                </main>

                {/* Form Modal */}
                {formModal && (
                    <section className="modal-overlay open">
                        <article className="modal">
                            <h3 className="modal-title">{editingId ? 'Editar' : 'Agregar'} Deportista</h3>
                            <section className="form-grid">
                                {[['Nombre completo', 'nombre', 'text', 'full'], ['Edad', 'edad', 'number'], ['Posición', 'pos', 'text'], ['Rendimiento (%)', 'perf', 'number'], ['Asistencia (%)', 'asis', 'number'], ['Sesiones', 'ses', 'number'], ['Tendencia (%)', 'trend', 'number']].map(([label, key, type, cls]) => (
                                    <label key={key} className={`field-label ${cls || ''}`}>
                                        {label}
                                        <input className="field-inp" type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                                    </label>
                                ))}
                                {[['Categoría', 'cat', ['Juvenil', 'Mayor', 'Infantil']], ['Nivel', 'nivel', ['Principiante', 'Intermedio', 'Avanzado']], ['Estado', 'estado', ['Activo', 'Inactivo']]].map(([label, key, opts]) => (
                                    <label key={key} className="field-label">
                                        {label}
                                        <select className="field-sel" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}>
                                            {opts.map(o => <option key={o}>{o}</option>)}
                                        </select>
                                    </label>
                                ))}
                            </section>
                            <footer className="modal-foot">
                                <button className="btn-cancel" onClick={() => setFormModal(false)}>Cancelar</button>
                                <button className="btn-save" onClick={saveAthlete}>Guardar</button>
                            </footer>
                        </article>
                    </section>
                )}

                {/* Confirm Modal */}
                {confirmModal && (
                    <section className="modal-overlay open">
                        <article className="confirm-box">
                            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '28px', color: 'var(--red)', marginBottom: '12px' }}></i>
                            <p className="confirm-msg">¿Eliminar deportista?</p>
                            <p className="confirm-sub">Esta acción eliminará al deportista permanentemente.</p>
                            <footer className="confirm-foot">
                                <button className="btn-cancel" onClick={() => setConfirmModal(false)}>Cancelar</button>
                                <button className="btn-danger" onClick={confirmDelete}>Eliminar</button>
                            </footer>
                        </article>
                    </section>
                )}

                <aside className={`toast ${toast.show ? 'show' : ''} ${toast.error ? 'error' : ''}`}>
                    <i className={`fa-solid ${toast.error ? 'fa-circle-xmark' : 'fa-circle-check'}`}></i>
                    <span>{toast.msg}</span>
                </aside>
            </section>

        </>
    );
}