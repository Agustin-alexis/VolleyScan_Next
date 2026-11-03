"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import './perfil.css';
import {
    FaUserCircle,
    FaBullseye,
    FaSlidersH,
    FaLock,
    FaPen,
} from 'react-icons/fa';
import { useApi } from '@/lib/UseApi';
import { api, ApiError, cerrarSesion, urlFoto, actualizarUsuario } from '@/lib/api';

import SeccionPersonal from './_components/SeccionPersonal';
import SeccionObjetivos from './_components/SeccionObjetivos';
import SeccionPreferencias from './_components/SeccionPreferencias';
import SeccionSeguridad from './_components/SeccionSeguridad';

/* ── Secciones del perfil ── */
const PROFILE_SECTIONS = [
    { id: 'personal', icon: FaUserCircle, label: 'Información personal' },
    { id: 'objetivos', icon: FaBullseye, label: 'Objetivos' },
    { id: 'preferencias', icon: FaSlidersH, label: 'Preferencias' },
    { id: 'seguridad', icon: FaLock, label: 'Cuenta y seguridad' },
];

const FOTO_POR_DEFECTO =
    'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=200&q=80';

const toastColors = { success: '#22c55e', error: '#ef4444', info: '#3b82f6' };

export default function Perfil() {
    const router = useRouter();

    /* ── Datos del backend ── */
    const { data: perfil, cargando: cargandoPerfil, error: errorPerfil } = useApi('/usuario/perfil/');
    const { data: config } = useApi('/usuario/configuracion/');

    /* ── Estado activo y resumen de tarjeta lateral ── */
    const [activeSection, setActiveSection] = useState('personal');
    const [resumen, setResumen] = useState({ nombre: '', apellido: '', nivel: 'principiante' });

    /* ── Estado de Foto ── */
    const [photoSrc, setPhotoSrc] = useState(FOTO_POR_DEFECTO);
    const [tieneFoto, setTieneFoto] = useState(false);
    const [subiendoFoto, setSubiendoFoto] = useState(false);
    const photoInputRef = useRef(null);

    /* ── Modal y Toast ── */
    const [modal, setModal] = useState(null);
    const [toast, setToast] = useState(null);

    function showToast(message, type = 'success') {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }

    /* ── Sincronizar datos iniciales del perfil ── */
    useEffect(() => {
        if (!perfil) return;
        setResumen({
            nombre: perfil.nombre ?? '',
            apellido: perfil.apellido ?? '',
            nivel: perfil.nivel ?? 'principiante',
        });
        setTieneFoto(!!perfil.foto_url);
        if (perfil.foto_url) setPhotoSrc(urlFoto(perfil.foto_url));
    }, [perfil]);

    /* ── Cambio y eliminación de foto ── */
    async function handlePhotoChange(e) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            showToast('Usa una imagen JPG, PNG o WEBP.', 'error');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            showToast('La imagen no puede superar 2 MB.', 'error');
            return;
        }

        const anterior = photoSrc;
        const vistaPrevia = URL.createObjectURL(file);
        setPhotoSrc(vistaPrevia);
        setSubiendoFoto(true);

        try {
            const form = new FormData();
            form.append('foto', file);
            const res = await api('/usuario/perfil/foto/', { method: 'POST', body: form });
            setPhotoSrc(urlFoto(res.foto_url));
            setTieneFoto(true);
            actualizarUsuario({ foto_url: res.foto_url });
            showToast('✓ Foto actualizada.');
        } catch (err) {
            setPhotoSrc(anterior);
            const msg = err instanceof ApiError ? err.data?.foto?.[0] : null;
            showToast(msg || 'No se pudo subir la foto.', 'error');
        } finally {
            URL.revokeObjectURL(vistaPrevia);
            setSubiendoFoto(false);
        }
    }

    async function quitarFoto() {
        try {
            await api('/usuario/perfil/foto/', { method: 'DELETE' });
            setPhotoSrc(FOTO_POR_DEFECTO);
            setTieneFoto(false);
            actualizarUsuario({ foto_url: null });
            showToast('Foto eliminada.', 'info');
        } catch {
            showToast('No se pudo quitar la foto.', 'error');
        }
    }

    /* ── Eliminar cuenta ── */
    async function eliminarCuenta() {
        try {
            await api('/usuario/perfil/', { method: 'DELETE' });
            cerrarSesion();
            router.push('/');
        } catch {
            showToast('No se pudo eliminar la cuenta.', 'error');
        }
    }

    if (cargandoPerfil) {
        return <main className="main-content"><p style={{ color: '#94a3b8' }}>Cargando…</p></main>;
    }
    if (errorPerfil) {
        return <main className="main-content"><p style={{ color: '#ef4444' }}>No se pudo cargar el perfil.</p></main>;
    }

    return (
        <main className="main-content">

            <header className="page-header">
                <h1 className="page-header__title">Perfil de Usuario</h1>
            </header>

            <div className="profile-layout">

                {/* ── Columna izquierda ── */}
                <aside className="profile-sidebar">

                    {/* Tarjeta de identidad */}
                    <div className="identity-card">
                        <div className="avatar-wrap">
                            <Image src={photoSrc} alt="Foto de perfil" width={200} height={200} unoptimized className="avatar-img" />
                            <button className="avatar-edit-btn" type="button"
                                aria-label="Cambiar foto"
                                onClick={() => photoInputRef.current?.click()}>
                                <FaPen size={12} />
                            </button>
                            <input type="file" accept="image/*" className="visually-hidden"
                                ref={photoInputRef} onChange={handlePhotoChange} />
                        </div>
                        <p className="identity-card__name">{resumen.nombre} {resumen.apellido}</p>
                        <p className="identity-card__role">Deportista</p>
                        <span className="badge badge--level">
                            {resumen.nivel.charAt(0).toUpperCase() + resumen.nivel.slice(1)}
                        </span>
                    </div>

                    {/* Nav de secciones */}
                    <nav className="profile-nav" aria-label="Secciones del perfil">
                        <ul className="profile-nav__list">
                            {PROFILE_SECTIONS.map(({ id, icon: Icon, label }) => (
                                <li key={id}
                                    className={`profile-nav__item${activeSection === id ? ' profile-nav__item--active' : ''}`}>
                                    <button className="profile-nav__btn" type="button" onClick={() => setActiveSection(id)}>
                                        <Icon size={18} />
                                        <span>{label}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </aside>

                {/* ── Columna derecha ── */}
                <div className="profile-content">
                    {activeSection === 'personal' && (
                        <SeccionPersonal
                            perfilInicial={perfil}
                            onPerfilActualizado={(nuevo) => setResumen({
                                nombre: nuevo.nombre,
                                apellido: nuevo.apellido,
                                nivel: nuevo.nivel,
                            })}
                            photoSrc={photoSrc}
                            tieneFoto={tieneFoto}
                            subiendoFoto={subiendoFoto}
                            onAbrirSelectorFoto={() => photoInputRef.current?.click()}
                            onQuitarFoto={quitarFoto}
                            showToast={showToast}
                        />
                    )}

                    {activeSection === 'objetivos' && (
                        <SeccionObjetivos showToast={showToast} />
                    )}

                    {activeSection === 'preferencias' && (
                        <SeccionPreferencias configInicial={config} showToast={showToast} />
                    )}

                    {activeSection === 'seguridad' && (
                        <SeccionSeguridad
                            showToast={showToast}
                            onSolicitarEliminarCuenta={() =>
                                setModal({
                                    message: '¿Eliminar cuenta? Esta acción es permanente.',
                                    onConfirm: eliminarCuenta,
                                })
                            }
                        />
                    )}
                </div>
            </div>

            {/* Modal */}
            {modal && (
                <div className="modal-overlay" role="dialog" aria-modal="true"
                    onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
                    <div className="modal">
                        <h3 className="modal__title">¿Confirmar acción?</h3>
                        <p className="modal__body">{modal.message}</p>
                        <div className="modal__actions">
                            <button className="btn btn--secondary" type="button" onClick={() => setModal(null)}>Cancelar</button>
                            <button className="btn btn--danger-outline" type="button" onClick={() => { modal.onConfirm(); setModal(null); }}>
                                Sí, eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="toast" role="status" aria-live="polite"
                    style={{ borderColor: toastColors[toast.type] }}>
                    {toast.message}
                </div>
            )}

        </main>
    );
}