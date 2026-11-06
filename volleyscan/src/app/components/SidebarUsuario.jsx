'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cerrarSesionCompleta, getUsuario, urlFoto } from '@/lib/api';
import { useApi } from '@/lib/UseApi';
import './SidebarUsuario.css';
import Image from 'next/image';
import Logo from '@/app/public/img/Logo.VS.jpg';
import {
    FaHouseUser,
    FaUser,
    FaMicrochip,
    FaChartLine,
    FaCamera,
    FaBell,
    FaSignOutAlt,
} from 'react-icons/fa';
import {
    FaDumbbell, FaFileLines, FaGear, FaBars, FaXmark,
} from 'react-icons/fa6';

const nav = [
    {
        group: 'Principal', items: [
            { to: '/usuario/dashboard', icon: FaHouseUser, label: 'Dashboard' },
            { to: '/usuario/perfil', icon: FaUser, label: 'Perfil' },
        ]
    },
    {
        group: 'Entrenamiento', items: [
            { to: '/usuario/rutinas', icon: FaDumbbell, label: 'Rutinas' },
            { to: '/usuario/historial', icon: FaFileLines, label: 'Historial' },
            { to: '/usuario/contenido', icon: FaMicrochip, label: 'Contenido' },
        ]
    },
    {
        group: 'Analisis', items: [
            { to: '/usuario/progreso', icon: FaChartLine, label: 'Progreso' },
            { to: '/usuario/analisis', icon: FaCamera, label: 'Analisis IA' },
            { to: '/usuario/histtrial', icon: FaCamera, label: 'Historial de IA' },
            { to: '/usuario/notificaciones', icon: FaBell, label: 'Notificaciones', },
        ]
    },
    {
        group: 'Sistema', items: [
            { to: '/usuario/configuracion', icon: FaGear, label: 'Configuracion' },
        ]
    },
];

export default function SidebarUsuario() {
    const pathname = usePathname();
    const { data: notifs, recargar } = useApi('/usuario/notificaciones', {
        leida: 'false',
        ruta: pathname,
    })
    const sinLeer = notifs?.sin_leer ?? 0;
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [usuario, setUsuario] = useState(null)

    // Para que la página de Notificaciones avise cuando marca o borra
    useEffect(() => {
        window.addEventListener('notificaciones:cambio', recargar);
        return () => window.removeEventListener('notificaciones:cambio', recargar);
    }, [recargar]);

    // Carga los datos del deportista logueado
    useEffect(() => {
        const cargar = () => setUsuario(getUsuario());
        cargar();
        window.addEventListener('usuario:cambio', cargar);
        return () => window.removeEventListener('usuario:cambio', cargar);
    }, []);

    // Cierra el menú al cambiar de página
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    // Función para cerrar sesión y mandar al login
    async function handleLogout() {
        await cerrarSesionCompleta();
        router.replace('/login');
    }

    const nombreCompleto = usuario
        ? `${usuario.nombre} ${usuario.apellido ?? ''}`.trim()
        : 'Usuario';

    // Saca las iniciales del nombre (ej: "Camilo Velasco" -> "CV")
    const iniciales = usuario
        ? `${usuario.nombre?.[0] ?? ''}${usuario.apellido?.[0] ?? ''}`.toUpperCase()
        : 'US';

    return (
        <>
            <button
                className="sb-toggle"
                onClick={() => setOpen(true)}
                aria-label="Abrir menú"
            >
                <FaBars size={18} />
            </button>

            {open && <div className="sb-overlay" onClick={() => setOpen(false)} />}

            <aside className={open ? 'sidebar sidebar--open' : 'sidebar'}>
                <button
                    className="sb-close"
                    onClick={() => setOpen(false)}
                    aria-label="Cerrar menú"
                >
                    <FaXmark size={18} />
                </button>

                <div className="sb-logo">
                    <Image
                        src={Logo}
                        alt="VolleyAI"
                        className="sb-logo-icon"
                        style={{ width: '42px', height: '42px', borderRadius: '12px', objectFit: 'cover' }}
                    />
                    <div>
                        <div className="sb-logo-name">VolleyAI</div>
                        <div className="sb-logo-role">Deportista/Usuario</div>
                    </div>
                </div>

                <nav className="sb-nav">
                    {nav.map(({ group, items }) => (
                        <div key={group}>
                            <div className="sb-group-label">{group}</div>
                            {items.map(({ to, icon: Icon, label }) => {

                                const activo = to === '/usuario'
                                    ? pathname === '/usuario'
                                    : pathname.startsWith(to);

                                return (
                                    <Link
                                        key={to}
                                        href={to}
                                        className={activo ? 'nav-item active' : 'nav-item'}>
                                        <Icon size={15} />
                                        <span>{label}</span>
                                        {to === '/usuario/notificaciones' && sinLeer > 0 && (
                                            <span className="nav-badge">{sinLeer > 99 ? '99+' : sinLeer}</span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                <div className="sb-footer">
                    <div className="sb-avatar">{usuario?.foto_url
                        ? <img src={urlFoto(usuario.foto_url)} alt=""
                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        : iniciales}</div>
                    <div className="sb-foot-info">
                        <div className="sb-foot-name">{nombreCompleto}</div>
                        <div className="sb-foot-role">{usuario?.rol || 'atleta'}</div>
                    </div>
                    <span className="sb-online-dot"></span>

                    {/* Botón para cerrar sesión */}
                    <button
                        onClick={handleLogout}
                        title="Cerrar sesión"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            marginLeft: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '4px'
                        }}
                    >
                        <FaSignOutAlt size={16} />
                    </button>
                </div>
            </aside>
        </>
    );
} 