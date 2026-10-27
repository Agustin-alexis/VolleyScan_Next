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
    FaChevronDown,
    FaChevronRight,
    FaMobileScreenButton,
    FaLaptop,
    FaTabletScreenButton,
    FaRightFromBracket,
    FaBook,
    FaEnvelope,
    FaBug,
    FaCircleInfo,
} from "react-icons/fa6";

import { useApi } from "@/lib/UseApi";
import { api, cerrarSesion } from "@/lib/api";

import "./configuracion.css";

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

const VISIBILIDAD = [
    { value: "solo", label: "Solo yo" },
    { value: "entrenador", label: "Mi entrenador" },
    { value: "equipo", label: "Mi equipo" },
    { value: "todos", label: "Todos" },
];

/* Simulados: no existe tabla de dispositivos en el backend */
const DISPOSITIVOS_INICIALES = [
    { id: 1, nombre: "iPhone 14 Pro", Icon: FaMobileScreenButton, meta: "hoy, 10:32 a.m. · Bogotá, CO", actual: true },
    { id: 2, nombre: "MacBook Pro", Icon: FaLaptop, meta: "ayer, 08:15 p.m. · Cali, CO", actual: false },
    { id: 3, nombre: "iPad Air", Icon: FaTabletScreenButton, meta: "hace 3 días · Medellín, CO", actual: false },
];

const AYUDA = [
    { Icon: FaBook, titulo: "Centro de ayuda", desc: "Guías y preguntas frecuentes" },
    { Icon: FaEnvelope, titulo: "Contactar soporte", desc: "soporte@volleyscan.app" },
    { Icon: FaBug, titulo: "Reportar un problema", desc: "Cuéntanos qué no funciona" },
    { Icon: FaCircleInfo, titulo: "Versión de la app", desc: "VolleyScan v2.4.1 · Build 241" },
];

export default function Configuracion() {

    const router = useRouter();

    const { data, cargando, error } = useApi("/usuario/configuracion/");

    const [config, setConfig] = useState(null);
    const [snapshot, setSnapshot] = useState(null);
    const [seccion, setSeccion] = useState("general");
    const [guardando, setGuardando] = useState(false);

    /* Solo en pantalla (sin columna en la base) */
    const [analisis, setAnalisis] = useState({
        pose: true,
        alertas: true,
        automatico: false,
        sensibilidad: "media",
    });
    const [dispositivos, setDispositivos] = useState(DISPOSITIVOS_INICIALES);

    const [modal, setModal] = useState(null);
    const [toast, setToast] = useState(null);

    /* Cuando llegan los datos, llenar el formulario */
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

    /* =========================================
       GUARDAR / DESCARTAR
       (los tres botones "Guardar" usan lo mismo)
    ========================================= */

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

    /* =========================================
       SESIÓN Y DISPOSITIVOS
    ========================================= */

    function cerrarSesionAqui() {
        cerrarSesion();
        router.push("/login");
    }

    function pedirCerrarSesion() {
        setModal({
            message: "¿Seguro que quieres cerrar sesión en VolleyScan?",
            confirmar: "Cerrar sesión",
            onConfirm: cerrarSesionAqui,
        });
    }

    function cerrarEn(dispositivo) {
        setModal({
            message: `¿Cerrar sesión en ${dispositivo.nombre}?`,
            confirmar: "Cerrar sesión",
            onConfirm: () => {
                setDispositivos((d) => d.filter((x) => x.id !== dispositivo.id));
                showToast(`Sesión cerrada en ${dispositivo.nombre}.`);
            },
        });
    }

    function cerrarEnTodos() {
        setModal({
            message: "¿Cerrar sesión en todos los dispositivos?",
            confirmar: "Cerrar sesión",
            onConfirm: () => {
                setDispositivos((d) => d.filter((x) => x.actual));
                showToast("Sesión cerrada en todos los dispositivos.");
            },
        });
    }

    const toastColors = { success: "#22c55e", error: "#ef4444", info: "#3b82f6" };

    /* ── Estados de carga (después de todos los hooks) ── */

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

    const acciones = (
        <div className="form-actions">
            <button className="btn btn--secondary" type="button"
                onClick={descartar} disabled={guardando}>
                Cancelar
            </button>
            <button className="btn btn--primary" type="button"
                onClick={guardar} disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
        </div>
    );

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

                    {/* GENERAL */}
                    {seccion === "general" && (
                        <section className="config-section active">
                            <div className="config-section__split">

                                <div className="config-main-col">

                                    <h2 className="config-section__title">General</h2>

                                    <SettingSelect label="Unidad de medida" id="unidadMedida"
                                        value={config.unidad_medida}
                                        onChange={(v) => cambiar("unidad_medida", v)}
                                        options={[
                                            { value: "metric", label: "Métrico (kg, cm)" },
                                            { value: "imperial", label: "Imperial (lb, ft)" },
                                        ]} />

                                    <SettingSelect label="Idioma" id="idioma"
                                        value={config.idioma}
                                        onChange={(v) => cambiar("idioma", v)}
                                        options={[
                                            { value: "es", label: "Español" },
                                            { value: "en", label: "English" },
                                            { value: "pt", label: "Português" },
                                        ]} />

                                    <SettingSelect label="Tema" id="tema"
                                        value={config.tema}
                                        onChange={(v) => cambiar("tema", v)}
                                        options={[
                                            { value: "dark", label: "Oscuro" },
                                            { value: "light", label: "Claro" },
                                            { value: "auto", label: "Automático" },
                                        ]} />

                                    <SettingSelect label="Calidad de video para análisis" id="calidadVideo"
                                        value={config.calidad_video}
                                        onChange={(v) => cambiar("calidad_video", v)}
                                        options={[
                                            { value: "alta", label: "Alta" },
                                            { value: "media", label: "Media" },
                                            { value: "baja", label: "Baja" },
                                            { value: "auto", label: "Auto" },
                                        ]}
                                        small />

                                    <SettingToggle
                                        label="Guardar videos automáticamente"
                                        desc="Los videos de análisis se guardan en tu historial"
                                        checked={config.guardar_videos}
                                        onChange={(v) => cambiar("guardar_videos", v)} />

                                    {acciones}

                                </div>

                                {/* Privacidad rápida */}
                                <aside className="quick-privacy">

                                    <h3 className="quick-privacy__title">Privacidad rápida</h3>

                                    <div className="qp-group">
                                        <p className="setting-label">Quién puede ver mis análisis</p>
                                        <div className="select-wrap">
                                            <select className="field-select"
                                                value={config.visibilidad_analisis}
                                                onChange={(e) => cambiar("visibilidad_analisis", e.target.value)}>
                                                {VISIBILIDAD.map((o) => (
                                                    <option key={o.value} value={o.value}>{o.label}</option>
                                                ))}
                                            </select>
                                            <FaChevronDown className="select-icon" />
                                        </div>
                                    </div>

                                    <div className="qp-toggle">
                                        <p className="setting-label">Permitir comentarios</p>
                                        <ToggleSwitch label="Permitir comentarios"
                                            checked={config.permitir_comentarios}
                                            onChange={(v) => cambiar("permitir_comentarios", v)} />
                                    </div>

                                    <div className="qp-toggle">
                                        <p className="setting-label">Compartir progreso</p>
                                        <ToggleSwitch label="Compartir progreso"
                                            checked={config.compartir_progreso}
                                            onChange={(v) => cambiar("compartir_progreso", v)} />
                                    </div>

                                    <hr className="divider" />

                                    <button className="btn--logout" type="button"
                                        onClick={pedirCerrarSesion}>
                                        Cerrar sesión
                                    </button>

                                </aside>

                            </div>
                        </section>
                    )}

                    {/* ANÁLISIS (solo en pantalla) */}
                    {seccion === "analisis" && (
                        <section className="config-section active">

                            <h2 className="config-section__title">Análisis</h2>

                            <SettingToggle label="Detección de pose en tiempo real"
                                desc="Muestra el esqueleto de pose mientras grabas"
                                checked={analisis.pose}
                                onChange={(v) => setAnalisis((a) => ({ ...a, pose: v }))} />

                            <SettingToggle label="Alertas de errores durante el análisis"
                                desc="Resalta en rojo las articulaciones con error"
                                checked={analisis.alertas}
                                onChange={(v) => setAnalisis((a) => ({ ...a, alertas: v }))} />

                            <SettingToggle label="Análisis automático al subir video"
                                desc="Procesa el video sin confirmación adicional"
                                checked={analisis.automatico}
                                onChange={(v) => setAnalisis((a) => ({ ...a, automatico: v }))} />

                            <SettingSelect label="Sensibilidad de detección" id="sensibilidad"
                                value={analisis.sensibilidad}
                                onChange={(v) => setAnalisis((a) => ({ ...a, sensibilidad: v }))}
                                options={[
                                    { value: "alta", label: "Alta (más errores detectados)" },
                                    { value: "media", label: "Media (recomendado)" },
                                    { value: "baja", label: "Baja (solo errores críticos)" },
                                ]} />

                            <p className="setting-desc" style={{ marginTop: 16 }}>
                                Estos ajustes se aplican mientras la página esté abierta.
                            </p>

                        </section>
                    )}

                    {/* NOTIFICACIONES */}
                    {seccion === "notificaciones" && (
                        <section className="config-section active">

                            <h2 className="config-section__title">Notificaciones</h2>

                            <SettingToggle label="Recordatorio de sesión"
                                desc="Te avisa antes del entrenamiento"
                                checked={config.notif_sesion}
                                onChange={(v) => cambiar("notif_sesion", v)} />

                            <SettingToggle label="Análisis completado"
                                desc="Cuando la IA termina un análisis"
                                checked={config.notif_analisis}
                                onChange={(v) => cambiar("notif_analisis", v)} />

                            <SettingToggle label="Nuevos contenidos"
                                desc="Videos y ejercicios nuevos"
                                checked={config.notif_contenido}
                                onChange={(v) => cambiar("notif_contenido", v)} />

                            {acciones}

                        </section>
                    )}

                    {/* PRIVACIDAD */}
                    {seccion === "privacidad" && (
                        <section className="config-section active">

                            <h2 className="config-section__title">Privacidad</h2>

                            <SettingSelect label="Quién puede ver mis análisis" id="verAnalisis"
                                value={config.visibilidad_analisis}
                                onChange={(v) => cambiar("visibilidad_analisis", v)}
                                options={VISIBILIDAD} />

                            <SettingToggle label="Permitir comentarios"
                                desc="Otros pueden comentar tus análisis"
                                checked={config.permitir_comentarios}
                                onChange={(v) => cambiar("permitir_comentarios", v)} />

                            <SettingToggle label="Compartir progreso"
                                desc="Muestra tu progreso a quien tenga acceso"
                                checked={config.compartir_progreso}
                                onChange={(v) => cambiar("compartir_progreso", v)} />

                            {acciones}

                        </section>
                    )}

                    {/* DISPOSITIVOS (simulado) */}
                    {seccion === "dispositivos" && (
                        <section className="config-section active">

                            <h2 className="config-section__title">Dispositivos conectados</h2>

                            <ul className="device-list">

                                {dispositivos.map(({ id, nombre, Icon, meta, actual }) => (
                                    <li key={id} className="device-item">

                                        <div className="device-item__icon"><Icon /></div>

                                        <div className="device-item__info">
                                            <p className="device-item__name">{nombre}</p>
                                            <p className="device-item__meta">Último acceso: {meta}</p>
                                        </div>

                                        {actual
                                            ? <span className="device-badge">Este dispositivo</span>
                                            : (
                                                <button className="btn btn--danger-outline btn--sm" type="button"
                                                    onClick={() => cerrarEn({ id, nombre })}>
                                                    Cerrar sesión
                                                </button>
                                            )}

                                    </li>
                                ))}

                            </ul>

                            <div className="form-actions" style={{ marginTop: 20 }}>
                                <button className="btn btn--danger-outline" type="button"
                                    onClick={cerrarEnTodos}>
                                    <FaRightFromBracket /> Cerrar sesión en todos los dispositivos
                                </button>
                            </div>

                        </section>
                    )}

                    {/* AYUDA */}
                    {seccion === "ayuda" && (
                        <section className="config-section active">

                            <h2 className="config-section__title">Ayuda y soporte</h2>

                            <ul className="help-list">

                                {AYUDA.map(({ Icon, titulo, desc }) => (
                                    <li key={titulo} className="help-item"
                                        onClick={() => showToast(`Abriendo: ${titulo}…`, "info")}>

                                        <div className="help-item__icon"><Icon /></div>

                                        <div className="help-item__info">
                                            <p className="help-item__title">{titulo}</p>
                                            <p className="help-item__desc">{desc}</p>
                                        </div>

                                        <FaChevronRight className="help-item__arrow" />

                                    </li>
                                ))}

                            </ul>

                        </section>
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

/* ── Componentes auxiliares ── */

function SettingSelect({ label, id, value, onChange, options, small }) {
    return (
        <div className="setting-row">
            <label className="setting-label" htmlFor={id}>{label}</label>
            <div className={`select-wrap${small ? " select-wrap--sm" : ""}`}>
                <select className="field-select" id={id} value={value}
                    onChange={(e) => onChange(e.target.value)}>
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
                <FaChevronDown className="select-icon" />
            </div>
        </div>
    );
}

function SettingToggle({ label, desc, checked, onChange }) {
    return (
        <div className="setting-row setting-row--toggle">
            <div className="setting-row__info">
                <p className="setting-label">{label}</p>
                {desc && <p className="setting-desc">{desc}</p>}
            </div>
            <ToggleSwitch label={label} checked={checked} onChange={onChange} />
        </div>
    );
}

function ToggleSwitch({ label, checked, onChange }) {
    return (
        <label className="toggle-switch" aria-label={label}>
            <input type="checkbox" checked={checked}
                onChange={(e) => onChange(e.target.checked)} />
            <span className="toggle-thumb" />
        </label>
    );
}