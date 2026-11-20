"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/UseApi";
import { api } from "@/lib/api";
import "./notificaciones.css";
import {
    FaBell,
    FaTrophy,
    FaStar,
    FaFire,
    FaLock,
    FaBolt,
    FaCheckDouble,
    FaBellSlash,
    FaClock,
    FaCheck,
    FaArrowRight,
} from "react-icons/fa";
import { FaTrashCan, FaXmark } from "react-icons/fa6";

const DEFAULT_RECOMMENDATIONS = [
    {
        id: 1,
        title: "Enfócate en tu salto vertical",
        desc: "Mejora la altura por Tiempo de Vuelo y la explosividad en Fase 1.",
        img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=75",
        link: "/usuario/rutinas",
    },
    {
        id: 2,
        title: "Revisa tus 4 Fases en Historial IA",
        desc: "Audita cada gesto y sus correcciones técnicas específicas.",
        img: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&q=75",
        link: "/usuario/histtrial",
    },
    {
        id: 3,
        title: "Analiza tu técnica en vivo",
        desc: "Detecta errores con MediaPipe 3D en el puerto 8000 en tiempo real.",
        img: "https://images.unsplash.com/photo-1547347298-4074fc3086f0?w=400&q=75",
        link: "/usuario/analisis",
    },
];

const ICONS = {
    logro: FaTrophy,
    rutina: FaStar,
    racha: FaFire,
    recordatorio: FaLock,
    analisis: FaBolt,
};

const FILTERS = [
    { value: "all", label: "Todas" },
    { value: "unread", label: "Sin leer" },
    { value: "analisis", label: "Análisis IA" },
    { value: "logro", label: "Logros" },
    { value: "rutina", label: "Rutinas" },
    { value: "racha", label: "Rachas" },
    { value: "recordatorio", label: "Recordatorios" },
];

export default function Notificaciones() {
    const { data, cargando, recargar } = useApi("/usuario/notificaciones");
    const [notifications, setNotifications] = useState([]);
    const [recommendations, setRecommendations] = useState(DEFAULT_RECOMMENDATIONS);
    const [currentFilter, setCurrentFilter] = useState("all");
    const [toast, setToast] = useState(null);
    const [dismissing, setDismissing] = useState(new Set());

    useEffect(() => {
        if (data?.notificaciones) {
            setNotifications(data.notificaciones);
        }
        if (Array.isArray(data?.recomendaciones) && data.recomendaciones.length > 0) {
            setRecommendations(data.recomendaciones);
        }
    }, [data]);

    function notificarSidebar() {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("notificaciones:cambio"));
        }
    }

    function showToast(message, type = "success") {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }

    function getFiltered() {
        if (currentFilter === "all") return notifications;
        if (currentFilter === "unread") return notifications.filter((n) => n.unread);
        return notifications.filter((n) => n.type === currentFilter);
    }

    const filtered = getFiltered();
    const unreadCount = notifications.filter((n) => n.unread).length;

    async function markAsRead(id) {
        const notif = notifications.find((n) => n.id === id);
        if (!notif || !notif.unread) return;
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, unread: false, leida: true } : n)),
        );
        try {
            await api(`/usuario/notificaciones/${id}/leer`, { method: "PUT" });
            notificarSidebar();
        } catch {
            /* ignore */
        }
        showToast("Notificación marcada como leída.", "info");
    }

    async function dismissNotif(id) {
        setDismissing((prev) => new Set([...prev, id]));
        try {
            await api(`/usuario/notificaciones/${id}`, { method: "DELETE" });
            notificarSidebar();
        } catch {
            /* ignore */
        }
        setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== id));
            setDismissing((prev) => {
                const s = new Set(prev);
                s.delete(id);
                return s;
            });
        }, 280);
    }

    async function markAllRead() {
        const unread = notifications.filter((n) => n.unread);
        if (unread.length === 0) {
            showToast("No hay notificaciones sin leer.", "info");
            return;
        }
        setNotifications((prev) => prev.map((n) => ({ ...n, unread: false, leida: true })));
        try {
            await api("/usuario/notificaciones/leer-todas", { method: "PUT" });
            notificarSidebar();
            await recargar();
        } catch {
            /* ignore */
        }
        const c = unread.length;
        showToast(
            `✓ ${c} notificación${c > 1 ? "es" : ""} marcada${c > 1 ? "s" : ""} como leída${c > 1 ? "s" : ""}.`,
            "success",
        );
    }

    async function clearAll() {
        if (notifications.length === 0) {
            showToast("No hay notificaciones que limpiar.", "info");
            return;
        }
        const ids = new Set(notifications.map((n) => n.id));
        setDismissing(ids);
        try {
            await api("/usuario/notificaciones/limpiar", { method: "DELETE" });
            notificarSidebar();
        } catch {
            /* ignore */
        }
        setTimeout(() => {
            setNotifications([]);
            setDismissing(new Set());
            showToast("Todas las notificaciones eliminadas.", "success");
        }, 300);
    }

    const toastColors = { success: "#22c55e", error: "#ef4444", info: "#3b82f6" };

    return (
        <main className="main-content">
            <header className="page-header">
                <h1 className="page-header__title">Notificaciones y Feedback</h1>
            </header>

            <div className="notif-layout">
                <section className="notif-panel" aria-label="Notificaciones">
                    <div className="notif-panel__header">
                        <h2 className="notif-panel__title">
                            Notificaciones
                            {unreadCount > 0 && (
                                <span className="notif-count-badge">{unreadCount}</span>
                            )}
                        </h2>
                        <div className="notif-panel__actions">
                            <button className="btn-text" type="button" onClick={markAllRead}>
                                <FaCheckDouble /> Marcar todas como leídas
                            </button>
                            <button
                                className="btn-text btn-text--danger"
                                type="button"
                                onClick={clearAll}
                            >
                                <FaTrashCan /> Limpiar
                            </button>
                        </div>
                    </div>

                    <div
                        className="notif-filters"
                        role="group"
                        aria-label="Filtrar notificaciones"
                    >
                        {FILTERS.map((f) => (
                            <button
                                key={f.value}
                                className={`filter-chip${
                                    currentFilter === f.value ? " filter-chip--active" : ""
                                }`}
                                type="button"
                                onClick={() => setCurrentFilter(f.value)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {cargando && notifications.length === 0 ? (
                        <p style={{ color: "#94a3b8", padding: "1rem 0" }}>
                            Sincronizando alertas de progreso y rutinas…
                        </p>
                    ) : filtered.length === 0 ? (
                        <div className="empty-state">
                            <FaBellSlash />
                            <p>No hay notificaciones aquí.</p>
                        </div>
                    ) : (
                        <ol className="notif-list" aria-label="Lista de notificaciones">
                            {filtered.map((notif, i) => (
                                <li
                                    key={notif.id}
                                    className={`notif-item ${notif.unread ? "unread" : "read"}${
                                        dismissing.has(notif.id) ? " dismissing" : ""
                                    }`}
                                    style={{ animationDelay: `${i * 50}ms` }}
                                    onClick={() => {
                                        if (notif.unread) markAsRead(notif.id);
                                    }}
                                >
                                    <div
                                        className={`notif-icon notif-icon--${notif.type}`}
                                        aria-hidden="true"
                                    >
                                        {(() => {
                                            const Icon = ICONS[notif.type] ?? FaBell;
                                            return <Icon size={22} />;
                                        })()}
                                    </div>
                                    <div className="notif-body">
                                        <p className="notif-body__title">{notif.title}</p>
                                        <p className="notif-body__msg">{notif.msg}</p>
                                        <p className="notif-body__time">
                                            <FaClock aria-hidden="true" /> {notif.time}
                                        </p>
                                    </div>
                                    <div className="notif-item__actions">
                                        {notif.unread && (
                                            <button
                                                className="btn-icon btn-icon--read"
                                                type="button"
                                                title="Marcar como leída"
                                                aria-label="Marcar como leída"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    markAsRead(notif.id);
                                                }}
                                            >
                                                <FaCheck />
                                            </button>
                                        )}
                                        <button
                                            className="btn-icon btn-icon--delete"
                                            type="button"
                                            title="Eliminar"
                                            aria-label="Eliminar notificación"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                dismissNotif(notif.id);
                                            }}
                                        >
                                            <FaXmark />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                </section>

                <aside
                    className="recommendations-panel"
                    aria-label="Recomendaciones personalizadas"
                >
                    <h2 className="recommendations-panel__title">
                        Recomendaciones para ti
                    </h2>
                    <ul className="rec-list">
                        {recommendations.map((rec) => (
                            <li key={rec.id} className="rec-item">
                                <img
                                    className="rec-item__thumb"
                                    src={rec.img}
                                    alt={rec.title}
                                    loading="lazy"
                                />
                                <div className="rec-item__body">
                                    <p className="rec-item__title">{rec.title}</p>
                                    <p className="rec-item__desc">{rec.desc}</p>
                                    <Link className="rec-item__link" href={rec.link}>
                                        Ir ahora <FaArrowRight />
                                    </Link>
                                </div>
                            </li>
                        ))}
                    </ul>
                </aside>
            </div>

            {toast && (
                <div
                    className="toast"
                    role="status"
                    aria-live="polite"
                    style={{ borderColor: toastColors[toast.type] }}
                >
                    {toast.message}
                </div>
            )}
        </main>
    );
}
