"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    FaGear,
    FaCamera,
    FaBell,
    FaLock,
    FaDisplay,
    FaCircleQuestion,
} from "react-icons/fa6";

import { useApi } from "@/lib/UseApi";
import { api, cerrarSesionCompleta } from "@/lib/api";

import "./configuracion.css";

import SeccionGeneral from "./_components/SeccionGeneral";
import SeccionAnalisis from "./_components/SeccionAnalisis";
import SeccionNotificaciones from "./_components/SeccionNotificaciones";
import SeccionPrivacidad from "./_components/SeccionPrivacidad";
import SeccionDispositivos from "./_components/SeccionDispositivos";
import SeccionAyuda from "./_components/SeccionAyuda";

/* Columnas que existen en la tabla `configuracion` */
const CAMPOS = [
    "unidad_medida", "idioma", "tema", "calidad_video", "guardar_videos",
    "notif_sesion", "notif_analisis", "notif_contenido",
    "compartir_progreso", "permitir_comentarios", "visibilidad_analisis",
];

const SECCIONES = [
    { id: "general", icon: FaGear, label: "General" },
    { id: "analisis", icon: FaCamera, label: "Análisis" },
    { id: "notificaciones", icon: FaBell, label: "Notificaciones" },
    { id: "privacidad", icon: FaLock, label: "Privacidad" },
    { id: "dispositivos", icon: FaDisplay, label: "Dispositivos" },
    { id: "ayuda", icon: FaCircleQuestion, label: "Ayuda" },
];

const toastColors = { success: "#22c55e", error: "#ef4444", info: "#3b82f6" };

export default function Configuracion() {
    const router = useRouter();
    const { data, cargando, error } = useApi("/usuario/configuracion/");

    const [config, setConfig] = useState(null);
    const [snapshot, setSnapshot] = useState(null);
    const [seccion, setSeccion] = useState("general");
    const [guardando, setGuardando] = useState(false);

    /* Solo en pantalla (se mantiene aquí para no perder cambios al cambiar de pestaña) */
    const [analisis, setAnalisis] = useState({
        pose: true,
        alertas: true,
        automatico: false,
        sensibilidad: "media",
    });

    const [modal, setModal] = useState(null);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        if (data) {
            setConfig(data);
            setSnapshot(data);
        }
    }, [data]);

    function showToast(message, type = "success") {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }

    const cambiar = (campo, valor) =>
        setConfig((c) => ({ ...c, [campo]: valor }));

    async function guardar() {
        setGuardando(true);
        try {
            const body = Object.fromEntries(
                CAMPOS.map((campo) => [campo, config[campo]])
            );
            const nuevo = await api("/usuario/configuracion/", {
                method: "PUT",
                body,
            });
            setConfig(nuevo);
            setSnapshot(nuevo);
            showToast("✓ Configuración guardada correctamente.");
        } catch {
            showToast("No se pudo guardar la configuración.", "error");
        } finally {
            setGuardando(false);
        }
    }

    function descartar() {
        setConfig(snapshot);
        showToast("Cambios descartados.", "info");
    }

    function pedirCerrarSesion() {
        setModal({
            message: "¿Seguro que quieres cerrar sesión en VolleyScan?",
            confirmar: "Cerrar sesión",
            onConfirm: async () => {
                await cerrarSesionCompleta();
                router.push("/login");
            },
        });
    }

    if (error) {
        return (
            <main className="main-content">
                <p style={{ color: "#ef4444" }}>No se pudo cargar la configuración.</p>
            </main>
        );
    }

    if (cargando || !config) {
        return (
            <main className="main-content">
                <p style={{ color: "#94a3b8" }}>Cargando…</p>
            </main>
        );
    }

    return (
        <main className="main-content">

            <header className="page-header">
                <h1 className="page-header__title">Configuración</h1>
            </header>

            <div className="config-layout">

                {/* ── Nav lateral ── */}
                <aside className="config-sidebar">
                    <p className="config-sidebar__label">Configuración</p>
                    <ul className="config-nav__list">
                        {SECCIONES.map(({ id, icon: Icon, label }) => (
                            <li key={id}
                                className={`config-nav__item${seccion === id ? " config-nav__item--active" : ""}`}>
                                <button className="config-nav__btn" type="button"
                                    onClick={() => setSeccion(id)}>
                                    <Icon />
                                    <span>{label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>

                {/* ── Contenido ── */}
                <div className="config-content">
                    {seccion === "general" && (
                        <SeccionGeneral
                            config={config}
                            cambiar={cambiar}
                            onGuardar={guardar}
                            onDescartar={descartar}
                            guardando={guardando}
                            onPedirCerrarSesion={pedirCerrarSesion}
                        />
                    )}

                    {seccion === "analisis" && (
                        <SeccionAnalisis
                            analisis={analisis}
                            setAnalisis={setAnalisis}
                        />
                    )}

                    {seccion === "notificaciones" && (
                        <SeccionNotificaciones
                            config={config}
                            cambiar={cambiar}
                            onGuardar={guardar}
                            onDescartar={descartar}
                            guardando={guardando}
                        />
                    )}

                    {seccion === "privacidad" && (
                        <SeccionPrivacidad
                            config={config}
                            cambiar={cambiar}
                            onGuardar={guardar}
                            onDescartar={descartar}
                            guardando={guardando}
                        />
                    )}

                    {seccion === "dispositivos" && (
                        <SeccionDispositivos
                            setModal={setModal}
                            showToast={showToast}
                        />
                    )}

                    {seccion === "ayuda" && (
                        <SeccionAyuda showToast={showToast} />
                    )}
                </div>
            </div>

            {/* Modal */}
            {modal && (
                <div className="modal-overlay"
                    onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
                    <div className="modal">
                        <h3 className="modal__title">¿Confirmar acción?</h3>
                        <p className="modal__body">{modal.message}</p>
                        <div className="modal__actions">
                            <button className="btn btn--secondary" type="button"
                                onClick={() => setModal(null)}>
                                Cancelar
                            </button>
                            <button className="btn btn--danger" type="button"
                                onClick={() => { modal.onConfirm(); setModal(null); }}>
                                {modal.confirmar}
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