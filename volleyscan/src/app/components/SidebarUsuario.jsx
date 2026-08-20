'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
} from 'react-icons/fa';
import {
    FaDumbbell, FaFileLines, FaGear,
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
            { to: '/usuario/notificaciones', icon: FaBell, label: 'Notificaciones' },
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

    return (
        <aside className="sidebar">
            <div className="sb-logo">
                <Image src={Logo} alt="VolleyAI" className="sb-logo-icon" style={{ width: '42px', height: '42px', borderRadius: '12px', objectFit: 'cover' }} />
                <div>
                    <div className="sb-logo-name">VolleyAI</div>
                    <div className="sb-logo-role">Deportista/Usuario</div>
                </div>
            </div>

            <nav className="sb-nav">
                {nav.map(({ group, items }) => {
                    return (
                        <div key={group}>
                            <div className="sb-group-label">{group}</div>
                            {items.map(({ to, icon: Icon, label }) => (
                                <Link
                                    key={to}
                                    href={to}
                                    className={pathname === to ? 'nav-item active' : 'nav-item'}
                                >
                                    <Icon size={15} />
                                    <span>{label}</span>
                                </Link>
                            ))}
                        </div>
                    )
                })}
            </nav>

            <div className="sb-footer">
                <div className="sb-avatar">JP</div>
                <div className="sb-foot-info">
                    <div className="sb-foot-name">Juan Perez</div>
                    <div className="sb-foot-role">usuario</div>
                </div>
                <span className="sb-online-dot"></span>
            </div>
        </aside>
    );
}