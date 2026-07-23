'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './Sidebar.css';

const nav = [
    {
        group: 'Principal', items: [
            { to: '/panel_entrenador/dashboard', icon: 'fa-house', label: 'Dashboard' },
            { to: '/panel_entrenador/perfil', icon: 'fa-user', label: 'Perfil' },
            { to: '/panel_entrenador/gestion', icon: 'fa-people-group', label: 'Deportistas' },
            { to: '/panel_entrenador/horario', icon: 'fa-calendar-days', label: 'Horario' },
        ]
    },
    {
        group: 'Análisis', items: [
            { to: '/panel_entrenador/estadisticas', icon: 'fa-chart-bar', label: 'Estadísticas' },
            { to: '/panel_entrenador/rutinas', icon: 'fa-dumbbell', label: 'Rutinas' },
            { to: '/panel_entrenador/reportes', icon: 'fa-file-lines', label: 'Reportes' },
            { to: '/panel_entrenador/analisis', icon: 'fa-microchip', label: 'Análisis IA' },
        ]
    },
    {
        group: 'Sistema', items: [
            { to: '/panel_entrenador/configuracion', icon: 'fa-gear', label: 'Configuración' },
        ]
    },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="sidebar">
            <div className="sb-logo">
                <img src="/Vollei.jpeg" alt="VolleyAI" className="sb-logo-icon" style={{ width: '42px', height: '42px', borderRadius: '12px', objectFit: 'cover' }} />
                <div>
                    <div className="sb-logo-name">VolleyAI</div>
                    <div className="sb-logo-role">Entrenador</div>
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
                <div className="sb-avatar">AL</div>
                <div className="sb-foot-info">
                    <div className="sb-foot-name">Agustín Luligo</div>
                    <div className="sb-foot-role">Entrenador principal</div>
                </div>
                <span className="sb-online-dot"></span>
            </div>
        </aside>
    );
}