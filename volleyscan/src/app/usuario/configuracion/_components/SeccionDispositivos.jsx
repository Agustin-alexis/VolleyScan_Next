"use client";

import { useCallback, useEffect, useState } from "react";
import {
    FaMobileScreenButton,
    FaLaptop,
    FaTabletScreenButton,
    FaRightFromBracket,
} from "react-icons/fa6";
import { api } from "@/lib/api";
import "./SeccionDispositvos.css";

const ICONOS = {
    movil: FaMobileScreenButton,
    tablet: FaTabletScreenButton,
    escritorio: FaLaptop,
};

function hace(iso) {
    if (!iso) return "—";
    const f = new Date(iso);
    const min = Math.floor((Date.now() - f.getTime()) / 60000);
    if (min < 2) return "ahora mismo";
    if (min < 60) return `hace ${min} min`;
    if (min < 60 * 24) return `hace ${Math.floor(min / 60)} h`;
    return f.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export default function SeccionDispositivos({ setModal, showToast }) {
    const [dispositivos, setDispositivos] = useState([]);
    const [estado, setEstado] = useState("cargando"); // cargando | listo | error

    const cargar = useCallback(async () => {
        setEstado("cargando");
        try {
            const data = await api("/usuario/dispositivos/");
            setDispositivos(Array.isArray(data) ? data : data?.results ?? []);
            setEstado("listo");
        } catch {
            setEstado("error");
        }
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    function cerrarEn(d) {
        setModal({
            message: `¿Cerrar sesión en ${d.nombre}?`,
            confirmar: "Cerrar sesión",
            onConfirm: async () => {
                try {
                    await api(`/usuario/dispositivos/${d.id}/`, { method: "DELETE" });
                    setDispositivos((l) => l.filter((x) => x.id !== d.id));
                    showToast(`Sesión cerrada en ${d.nombre}.`, "success");
                } catch {
                    showToast("No se pudo cerrar la sesión. Inténtalo de nuevo.", "error");
                }
            },
        });
    }

    function cerrarEnOtros() {
        setModal({
            message: "¿Cerrar sesión en todos los demás dispositivos?",
            confirmar: "Cerrar sesión",
            onConfirm: async () => {
                try {
                    await api("/usuario/dispositivos/cerrar-otros/", { method: "POST" });
                    setDispositivos((l) => l.filter((x) => x.actual));
                    showToast("Sesión cerrada en los demás dispositivos.", "success");
                } catch {
                    showToast("No se pudo completar la acción. Inténtalo de nuevo.", "error");
                }
            },
        });
    }

    const hayOtros = dispositivos.some((d) => !d.actual);

    return (
        <section className="config-section active">
            <h2 className="config-section__title">Dispositivos conectados</h2>

            {estado === "cargando" && <p className="device-state">Cargando dispositivos…</p>}

            {estado === "error" && (
                <div className="device-state device-state--error">
                    <p>No se pudieron cargar los dispositivos.</p>
                    <button className="btn btn--secondary btn--sm" type="button" onClick={cargar}>
                        Reintentar
                    </button>
                </div>
            )}

            {estado === "listo" && dispositivos.length === 0 && (
                <p className="device-state">No hay dispositivos con sesión activa.</p>
            )}

            {estado === "listo" && dispositivos.length > 0 && (
                <ul className="device-list">
                    {dispositivos.map((d) => {
                        const Icon = ICONOS[d.tipo] ?? FaLaptop;
                        return (
                            <li key={d.id} className="device-item">
                                <div className="device-item__icon"><Icon /></div>

                                <div className="device-item__info">
                                    <p className="device-item__name">{d.nombre}</p>
                                    <p className="device-item__meta">
                                        Último acceso: {hace(d.ultimo_acceso)}
                                        {d.ip ? ` · IP ${d.ip}` : ""}
                                    </p>
                                </div>

                                {d.actual ? (
                                    <span className="device-badge">Este dispositivo</span>
                                ) : (
                                    <button className="btn btn--danger-outline btn--sm" type="button"
                                        onClick={() => cerrarEn(d)}>
                                        Cerrar sesión
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {estado === "listo" && hayOtros && (
                <div className="form-actions" style={{ marginTop: 20 }}>
                    <button className="btn btn--danger-outline" type="button" onClick={cerrarEnOtros}>
                        <FaRightFromBracket /> Cerrar sesión en los demás dispositivos
                    </button>
                </div>
            )}
        </section>
    );
}