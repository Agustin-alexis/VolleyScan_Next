'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './SidebarUsuario.css';
import Image from 'next/image';
import Logo from '@/app/public/img/Logo.VS.jpg'

const nav = [
    {
        group: 'Principal', items: [
            { to: '/usuario/dashboard', icon: 'fa-house', label: 'Dashboard' },
            { to: '/usuario/perfil', icon: 'fa-user', label: 'Perfil' },
        ]
    },
    {
        group: 'Entrenamiento', items: [
            { to: '/usuario/rutinas', icon: 'fa-dumbbell', label: 'Rutinas' },
            { to: '/usuario/historial', icon: 'fa-file-lines', label: 'Historial' },
            { to: '/usuario/contenido', icon: 'fa-microchip', label: 'Contenido' },
        ]
    },
    {
        group: 'Analisis', items: [
            { to: '/usuario/progreso', icon: 'fa-dumbbell', label: 'Progreso' },
            { to: '/usuario/analisis', icon: 'fa-file-lines', label: 'Analisis IA' },
            { to: '/usuario/notificaciones', icon: 'fa-microchip', label: 'Notificaciones' },
        ]
    },
    {
        group: 'Sistema', items: [
            { to: '/usuario/configuracion', icon: 'fa-gear', label: 'Configuracion' },
        ]
    },
];

export default function Sidebar() {
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
                {nav.map(({ group, items }) => (
                    <div key={group}>
                        <div className="sb-group-label">{group}</div>
                        {items.map(({ to, icon, label }) => (
                            <Link
                                key={to}
                                href={to}
                                className={pathname === to ? 'nav-item active' : 'nav-item'}
                            >
                                <i className={`fa-solid ${icon}`}></i>
                                <span>{label}</span>
                            </Link>
                        ))}
                    </div>
                ))}
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