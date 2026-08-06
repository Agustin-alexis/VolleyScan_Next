'use client';

import { useState, useEffect } from 'react';
import styles from './Perfil.module.css';

const DEFAULT_ACHIEVEMENTS = [
    { id: 1, icon: '🏆', title: 'Mejor entrenador', description: 'Torneo Regional 2024' },
    { id: 2, icon: '📈', title: '+8% rendimiento', description: 'Esta semana' },
    { id: 3, icon: '🎯', title: '100 sesiones', description: 'Completadas este año' },
];

const DEFAULT_PROFILE = {
    fullName: 'Agustín Luligo', email: 'agustin@volleyai.com',
    phone: '+57 310 000 0000', club: 'Club Atlético Popayán',
    experience: '5', level: 'Nivel 3'
};

export default function Perfil() {
    const [isEditing, setIsEditing] = useState(false);
    const [profile, setProfile] = useState(DEFAULT_PROFILE);
    const [form, setForm] = useState(DEFAULT_PROFILE);
    const [achievements, setAchievements] = useState(DEFAULT_ACHIEVEMENTS);
    const [modal, setModal] = useState(false);
    const [newA, setNewA] = useState({ title: '', description: '', icon: '🏆' });
    const [toast, setToast] = useState({ show: false, msg: '' });

    function showToast(msg) {
        setToast({ show: true, msg });
        setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
    }

    function saveProfile() {
        if (!form.fullName.trim()) { showToast('El nombre no puede estar vacío'); return; }
        if (!form.email.includes('@')) { showToast('Correo electrónico inválido'); return; }
        setProfile(form);
        setIsEditing(false);
        showToast('Perfil actualizado correctamente');
    }

    function cancelEdit() { setForm(profile); setIsEditing(false); showToast('Edición cancelada'); }

    function addAchievement() {
        if (!newA.title.trim()) { showToast('El título es obligatorio'); return; }
        if (!newA.description.trim()) { showToast('La descripción es obligatoria'); return; }
        setAchievements(prev => [{ ...newA, id: Date.now() }, ...prev]);
        setModal(false);
        setNewA({ title: '', description: '', icon: '🏆' });
        showToast(`"${newA.title}" añadido`);
    }

    function deleteAchievement(id) {
        if (window.confirm('¿Eliminar este logro?')) {
            setAchievements(prev => prev.filter(a => a.id !== id));
            showToast('Logro eliminado');
        }
    }

    const initials = profile.fullName.split(' ').map(n => n[0]).join('').toUpperCase();

    return (
        <>
            <div className={styles['perf-main']}>
                <article className={styles['profile-container']}>

                    {/* Header */}
                    <header className={styles['profile-header']}>
                        <figure className={styles['profile-avatar']}><span>{initials}</span></figure>
                        <section className={styles['profile-info']}>
                            <h1 className={styles['profile-name']}>{profile.fullName}</h1>
                            <p className={styles['profile-badge']}>Entrenador principal · {profile.club}</p>
                            <ul className={styles['profile-tags']}>
                                <li className={styles.tag}><i className="fa-solid fa-certificate"></i> {profile.level}</li>
                                <li className={styles.tag}><i className="fa-regular fa-clock"></i> {profile.experience} años de experiencia</li>
                            </ul>
                        </section>
                        <button className={styles['edit-main-btn']} onClick={() => { setForm(profile); setIsEditing(e => !e); }}>
                            <i className={`fa-solid ${isEditing ? 'fa-eye' : 'fa-pen'}`}></i>
                            {isEditing ? ' Ver perfil' : ' Editar perfil'}
                        </button>
                    </header>

                    <section className={styles['profile-grid']}>

                        {/* Info card */}
                        <article className={styles['info-card']}>
                            <header className={styles['card-header']}>
                                <h2 className={styles['card-title']}><i className="fa-solid fa-circle-info"></i> Información personal</h2>
                                {isEditing && <span className={styles['edit-indicator']}>✎ Modo edición</span>}
                            </header>

                            {[
                                ['Nombre completo', 'fullName', 'text'],
                                ['Correo electrónico', 'email', 'email'],
                                ['Teléfono', 'phone', 'tel'],
                                ['Club', 'club', 'text'],
                                ['Años de experiencia', 'experience', 'number'],
                            ].map(([label, key, type]) => (
                                <section key={key} className={styles['form-group']}>
                                    <label>{label}</label>
                                    <section className={styles['form-field']}>
                                        {isEditing
                                            ? <input type={type} className={styles['field-input']} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                                            : <span className={styles['field-value']}>{key === 'experience' ? `${profile[key]} años` : profile[key]}</span>
                                        }
                                    </section>
                                </section>
                            ))}

                            <section className={styles['form-group']}>
                                <label>Nivel</label>
                                <section className={styles['form-field']}>
                                    {isEditing
                                        ? <select className={styles['field-input']} value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}>
                                            {['Nivel 1', 'Nivel 2', 'Nivel 3', 'Nivel 4', 'Nivel 5'].map(o => <option key={o}>{o}</option>)}
                                        </select>
                                        : <span className={styles['field-value']}>{profile.level}</span>
                                    }
                                </section>
                            </section>

                            {isEditing && (
                                <footer className={styles['card-actions']} style={{ display: 'flex' }}>
                                    <button className={styles['btn-save']} onClick={saveProfile}><i className="fa-solid fa-check"></i> Guardar cambios</button>
                                    <button className={styles['btn-cancel']} onClick={cancelEdit}><i className="fa-solid fa-xmark"></i> Cancelar</button>
                                </footer>
                            )}
                        </article>

                        {/* Achievements */}
                        <article className={styles['achievements-card']}>
                            <header className={styles['card-header']}>
                                <h2 className={styles['card-title']}><i className="fa-solid fa-trophy"></i> Logros recientes</h2>
                            </header>
                            <section className={styles['achievement-list']}>
                                {achievements.length === 0
                                    ? <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px' }}>No hay logros aún</div>
                                    : achievements.map(a => (
                                        <div key={a.id} className={styles['achievement-item']}>
                                            <div className={styles['achievement-icon']}>{a.icon}</div>
                                            <div className={styles['achievement-content']}>
                                                <div className={styles['achievement-title']}>{a.title}</div>
                                                <div className={styles['achievement-desc']}>{a.description}</div>
                                            </div>
                                            <button className={styles['delete-achievement']} onClick={() => deleteAchievement(a.id)}>
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    ))
                                }
                            </section>
                            <button className={styles['btn-add-achievement']} onClick={() => { setNewA({ title: '', description: '', icon: '🏆' }); setModal(true); }}>
                                <i className="fa-solid fa-plus"></i> Añadir logro
                            </button>
                        </article>
                    </section>
                </article>

                {/* Modal */}
                {modal && (
                    <aside className={`${styles['modal-overlay']} ${styles.open}`} onClick={e => e.target === e.currentTarget && setModal(false)}>
                        <article className={styles['modal-content']}>
                            <header className={styles['modal-header']}>
                                <h3>Nuevo logro</h3>
                                <button className={styles['modal-close']} onClick={() => setModal(false)}><i className="fa-solid fa-xmark"></i></button>
                            </header>
                            <section className={styles['modal-body']}>
                                {[['Título del logro', 'title', 'text', 'Ej: Campeón invicto'], ['Descripción', 'description', 'text', 'Ej: Liga Departamental 2025'], ['Icono (emoji)', 'icon', 'text', 'Ej: 🏆']].map(([label, key, type, ph]) => (
                                    <section key={key} className={styles['form-group']}>
                                        <label>{label}</label>
                                        <input type={type} className={styles['form-input']} placeholder={ph} value={newA[key]} onChange={e => setNewA(a => ({ ...a, [key]: e.target.value }))} maxLength={key === 'icon' ? 2 : undefined} />
                                    </section>
                                ))}
                            </section>
                            <footer className={styles['modal-footer']}>
                                <button className={styles['btn-cancel-modal']} onClick={() => setModal(false)}>Cancelar</button>
                                <button className={styles['btn-save-modal']} onClick={addAchievement}>Guardar logro</button>
                            </footer>
                        </article>
                    </aside>
                )}

                {/* Toast */}
                <article className={`${styles.toast} ${toast.show ? styles.show : ''}`}>
                    <i className="fa-solid fa-circle-check" style={{ fontSize: '16px' }}></i>
                    <span>{toast.msg}</span>
                </article>
            </div>

        </>
    );
}