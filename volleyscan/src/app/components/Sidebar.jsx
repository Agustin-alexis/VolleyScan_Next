'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import './Sidebar.css';
import Image from 'next/image';
import logo from '@/app/public/img/Logo.VS.jpg';
import { api } from '@/lib/api';

import {
    FaHome,
    FaUser,
    FaUsers,
    FaCalendarAlt,
    FaChartBar,
    FaDumbbell,
    FaFileAlt,
    FaMicrochip,
    FaCog,
    FaBars
} from 'react-icons/fa';
import { FaXmark } from 'react-icons/fa6';

const nav = [
    {
        group: 'Principal',
        items: [
            {
                to: '/panel_entrenador/dashboard',
                icon: FaHome,
                label: 'Dashboard'
            },
            {
                to: '/panel_entrenador/perfil',
                icon: FaUser,
                label: 'Perfil'
            },
            {
                to: '/panel_entrenador/gestion',
                icon: FaUsers,
                label: 'Deportistas'
            },
            {
                to: '/panel_entrenador/horario',
                icon: FaCalendarAlt,
                label: 'Horario'
            },
        ]
    },
    {
        group: 'Análisis',
        items: [
            {
                to: '/panel_entrenador/estadisticas',
                icon: FaChartBar,
                label: 'Estadísticas'
            },
            {
                to: '/panel_entrenador/rutinas',
                icon: FaDumbbell,
                label: 'Rutinas'
            },
            {
                to: '/panel_entrenador/reportes',
                icon: FaFileAlt,
                label: 'Reportes'
            },
            {
                to: '/panel_entrenador/analisis',
                icon: FaMicrochip,
                label: 'Análisis IA'
            },
        ]
    },
    {
        group: 'Sistema',
        items: [
            {
                to: '/panel_entrenador/configuracion',
                icon: '/panel_entrenador/configuracion' ? FaCog : FaCog,
                label: 'Configuración'
            },
        ]
    },
];

export default function Sidebar({ entrenador: entrenadorProp }) {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [usuario, setUsuario] = useState(entrenadorProp || null);

    // Si el layout le pasa el entrenador, lo usamos; si no, lo consultamos
    useEffect(() => {
        if (entrenadorProp) {
            setUsuario(entrenadorProp);
            return;
        }
        api('/auth/me')
            .then((data) => setUsuario(data))
            .catch(() => { });
    }, [entrenadorProp]);

    // Calculamos las iniciales reales (Ej: "Carlos Ramírez" -> "CR")
    const iniciales = usuario
        ? `${usuario.nombre?.[0] || ''}${usuario.apellido?.[0] || ''}`.toUpperCase()
        : 'EN';

    const nombreCompleto = usuario
        ? `${usuario.nombre} ${usuario.apellido}`.trim()
        : 'Cargando...';

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
                        src={logo}
                        alt="VolleyAI"
                        className="sb-logo-icon"
                        style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '12px',
                            objectFit: 'cover'
                        }}
                    />

                    <div>
                        <div className="sb-logo-name">VolleyAI</div>
                        <div className="sb-logo-role">Entrenador</div>
                    </div>
                </div>

                <nav className="sb-nav">
                    {nav.map(({ group, items }) => (
                        <div key={group}>
                            <div className="sb-group-label">
                                {group}
                            </div>

                            {items.map(({ to, icon: Icon, label }) => (
                                <Link
                                    key={to}
                                    href={to}
                                    onClick={() => setOpen(false)}
                                    className={
                                        pathname === to
                                            ? 'nav-item active'
                                            : 'nav-item'
                                    }
                                >
                                    <Icon className="nav-icon" />
                                    <span>{label}</span>
                                </Link>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="sb-footer">
                    <div className="sb-avatar">
                        {usuario?.foto_url ? (
                            <img
                                src={usuario.foto_url}
                                alt={nombreCompleto}
                                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                            />
                        ) : (
                            iniciales
                        )}
                    </div>

                    <div className="sb-foot-info">
                        <div className="sb-foot-name">
                            {nombreCompleto}
                        </div>

                        <div className="sb-foot-role">
                            Entrenador
                        </div>
                    </div>

                    <span className="sb-online-dot"></span>
                </div>

            </aside>
        </>
    );
}