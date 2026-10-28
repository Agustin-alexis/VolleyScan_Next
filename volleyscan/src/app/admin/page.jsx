"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import "./page.css";

export default function AdminEntrenadoresPage() {
    const router = useRouter();
    const [autorizado, setAutorizado] = useState(false);
    const [adminInfo, setAdminInfo] = useState(null);

    // Lista de entrenadores
    const [entrenadores, setEntrenadores] = useState([]);
    const [cargandoLista, setCargandoLista] = useState(true);

    // Estados del formulario
    const [nombre, setNombre] = useState("");
    const [apellido, setApellido] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [mensaje, setMensaje] = useState(null);
    const [errores, setErrores] = useState({});

    useEffect(() => {
        async function verificarAcceso() {
            try {
                const yo = await api("/auth/me");
                if (yo.rol !== "admin") {
                    router.replace(yo.rol === "entrenador" ? "/panel_entrenador" : "/usuario");
                    return;
                }
                setAdminInfo(yo);
                setAutorizado(true);
                cargarEntrenadores();
            } catch {
                router.replace("/login");
            }
        }
        verificarAcceso();
    }, [router]);

    async function cargarEntrenadores() {
        setCargandoLista(true);
        try {
            const lista = await api("/admin/entrenadores");
            setEntrenadores(lista);
        } catch {
            setMensaje({ tipo: "error", texto: "No se pudo cargar la lista de entrenadores." });
        } finally {
            setCargandoLista(false);
        }
    }

    async function handleCrearEntrenador(e) {
        e.preventDefault();
        setErrores({});
        setMensaje(null);

        if (!nombre.trim() || !apellido.trim() || !email.trim() || !password) {
            setMensaje({ tipo: "error", texto: "Todos los campos son obligatorios." });
            return;
        }

        setEnviando(true);
        try {
            const res = await api("/admin/entrenadores", {
                method: "POST",
                body: {
                    nombre: nombre.trim(),
                    apellido: apellido.trim(),
                    email: email.trim(),
                    password,
                },
            });

            setMensaje({
                tipo: "exito",
                texto: `✓ Entrenador ${res.entrenador.nombre} registrado correctamente.`,
            });
            setNombre("");
            setApellido("");
            setEmail("");
            setPassword("");
            setEntrenadores((prev) => [res.entrenador, ...prev]);
        } catch (err) {
            if (err instanceof ApiError && err.data) {
                setErrores(err.data);
                setMensaje({ tipo: "error", texto: "Revisa los errores en el formulario." });
            } else {
                setMensaje({ tipo: "error", texto: "Error de conexión con el servidor." });
            }
        } finally {
            setEnviando(false);
        }
    }

    // Activar o desactivar entrenador
    async function handleToggleActivo(ent) {
        try {
            const actualizado = await api(`/admin/entrenadores/${ent.id}`, {
                method: "PATCH",
            });
            setEntrenadores((prev) =>
                prev.map((item) => (item.id === ent.id ? actualizado : item))
            );
        } catch {
            setMensaje({ tipo: "error", texto: "No se pudo cambiar el estado del entrenador." });
        }
    }

    // Eliminar entrenador definitivamente
    async function handleEliminar(ent) {
        const confirmar = window.confirm(
            `¿Seguro que deseas eliminar a ${ent.nombre} ${ent.apellido}? Esta acción no se puede deshacer.`
        );
        if (!confirmar) return;

        try {
            await api(`/admin/entrenadores/${ent.id}`, {
                method: "DELETE",
            });
            setEntrenadores((prev) => prev.filter((item) => item.id !== ent.id));
            setMensaje({ tipo: "exito", texto: `Entrenador ${ent.nombre} eliminado.` });
        } catch (err) {
            const detalle = err instanceof ApiError && err.data?.detail
                ? err.data.detail
                : "No se pudo eliminar el entrenador.";
            setMensaje({ tipo: "error", texto: detalle });
        }
    }

    function cerrarSesion() {
        localStorage.clear();
        router.push("/login");
    }

    if (!autorizado) {
        return (
            <div className="admin-loading">
                <p>Verificando permisos de administrador...</p>
            </div>
        );
    }

    return (
        <div className="admin-page">
            <div className="admin-wrapper">

                <header className="admin-header">
                    <div>
                        <h1 className="admin-title">Panel de Administración — VolleyScan</h1>
                        <p className="admin-subtitle">
                            Sesión iniciada como: <strong>{adminInfo?.nombre} {adminInfo?.apellido}</strong> ({adminInfo?.email})
                        </p>
                    </div>
                    <button onClick={cerrarSesion} className="btn-logout">
                        Cerrar sesión
                    </button>
                </header>

                <div className="admin-grid">

                    {/* Columna Izquierda: Formulario */}
                    <section className="admin-card">
                        <h2 className="card-title">Registrar Nuevo Entrenador</h2>
                        <p className="card-desc">
                            Las cuentas creadas aquí tendrán acceso directo al Panel de Entrenador.
                        </p>

                        {mensaje && (
                            <div className={`admin-alert ${mensaje.tipo === "exito" ? "alert-success" : "alert-error"}`}>
                                {mensaje.texto}
                            </div>
                        )}

                        <form onSubmit={handleCrearEntrenador} className="admin-form">
                            <div className="form-field">
                                <label htmlFor="nombre">Nombre</label>
                                <input
                                    id="nombre"
                                    type="text"
                                    value={nombre}
                                    onChange={(e) => setNombre(e.target.value)}
                                    placeholder="Ej. Carlos"
                                    className={errores.nombre ? "input-error" : ""}
                                />
                                {errores.nombre && <small className="error-msg">{errores.nombre}</small>}
                            </div>

                            <div className="form-field">
                                <label htmlFor="apellido">Apellido</label>
                                <input
                                    id="apellido"
                                    type="text"
                                    value={apellido}
                                    onChange={(e) => setApellido(e.target.value)}
                                    placeholder="Ej. Ramírez"
                                    className={errores.apellido ? "input-error" : ""}
                                />
                                {errores.apellido && <small className="error-msg">{errores.apellido}</small>}
                            </div>

                            <div className="form-field">
                                <label htmlFor="email">Correo Electrónico</label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="entrenador@volleyscan.com"
                                    className={errores.email ? "input-error" : ""}
                                />
                                {errores.email && (
                                    <small className="error-msg">
                                        {Array.isArray(errores.email) ? errores.email[0] : errores.email}
                                    </small>
                                )}
                            </div>

                            <div className="form-field">
                                <label htmlFor="password">Contraseña Temporal (Mín. 8 caracteres)</label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className={errores.password ? "input-error" : ""}
                                />
                                {errores.password && (
                                    <small className="error-msg">
                                        {Array.isArray(errores.password) ? errores.password.join(" ") : errores.password}
                                    </small>
                                )}
                            </div>

                            <button type="submit" disabled={enviando} className="btn-submit">
                                {enviando ? "Creando cuenta..." : "Crear Cuenta de Entrenador"}
                            </button>
                        </form>
                    </section>

                    {/* Columna Derecha: Lista de Entrenadores */}
                    <section className="admin-card">
                        <h2 className="card-title">
                            Entrenadores Registrados ({entrenadores.length})
                        </h2>

                        {cargandoLista ? (
                            <p className="empty-text">Cargando entrenadores...</p>
                        ) : entrenadores.length === 0 ? (
                            <p className="empty-text">Aún no hay entrenadores registrados.</p>
                        ) : (
                            <div className="coach-list">
                                {entrenadores.map((ent) => {
                                    const estaActivo = ent.activo !== false;
                                    return (
                                        <div key={ent.id} className={`coach-item ${!estaActivo ? "coach-inactive" : ""}`}>
                                            <div>
                                                <div className="coach-name">
                                                    {ent.nombre} {ent.apellido}{" "}
                                                    <span className={estaActivo ? "coach-badge" : "coach-badge-off"}>
                                                        {estaActivo ? "Activo" : "Inactivo"}
                                                    </span>
                                                </div>
                                                <div className="coach-email">{ent.email}</div>
                                            </div>

                                            <div className="coach-actions">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleActivo(ent)}
                                                    className="btn-action btn-toggle"
                                                >
                                                    {estaActivo ? "Desactivar" : "Activar"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleEliminar(ent)}
                                                    className="btn-action btn-delete"
                                                >
                                                    Eliminar
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                </div>
            </div>
        </div>
    );
}