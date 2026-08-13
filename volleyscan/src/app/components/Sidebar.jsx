'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './Sidebar.css';
import Image from 'next/image';
import logo from '@/app/public/img/Logo.VS.jpg';

import {
    FaHome,
    FaUser,
    FaUsers,
    FaCalendarAlt,
    FaChartBar,
    FaDumbbell,
    FaFileAlt,
    FaMicrochip,
    FaCog
} from 'react-icons/fa';

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
                icon: FaCog,
                label: 'Configuración'
            },
        ]
    },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="sidebar">

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
                <div className="sb-avatar">AL</div>

                <div className="sb-foot-info">
                    <div className="sb-foot-name">
                        Agustín Luligo
                    </div>

                    <div className="sb-foot-role">
                        Entrenador principal
                    </div>
                </div>

                <span className="sb-online-dot"></span>
            </div>

        </aside>
    );
}