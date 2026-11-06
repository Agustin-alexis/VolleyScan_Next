"use client";

import { useCallback, useEffect, useState } from "react";
import { mensajeDeError, misEquipos, misInvitaciones, responderInvitacion } from "@/lib/equipos/api";
import s from "./equipos.module.css";

const fFecha = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });
const fecha = (iso) => {
    const d = iso ? new Date(iso) : null;
    return d && !Number.isNaN(d.getTime()) ? fFecha.format(d) : "—";
};

function Coach({ c }) {
    const iniciales = `${c.nombre?.[0] ?? ""}${c.apellido?.[0] ?? ""}`.toUpperCase();
    return (
        <li className={s.coach}>
            {c.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={s.avatar} src={c.fotoUrl} alt="" />
            ) : (
                <span className={`${s.avatar} ${s.avatarIni}`} aria-hidden="true">{iniciales}</span>
            )}
            <span>{c.nombre} {c.apellido}</span>
            {c.esPropietario && <span className={`${s.chip} ${s.chipAzul}`}>Principal</span>}
        </li>
    );
}

export default function MisEquiposPage() {
    const [estado, setEstado] = useState("cargando");
    const [error, setError] = useState("");
    const [aviso, setAviso] = useState("");
    const [equipos, setEquipos] = useState([]);
    const [recibidas, setRecibidas] = useState([]);
    const [ocupado, setOcupado] = useState(false);

    const cargar = useCallback(async () => {
        const [a, b] = await Promise.all([misEquipos(), misInvitaciones()]);
        if (!a.ok) {
            setError(mensajeDeError(a));
            setEstado("error");
            return;
        }
        setEquipos(a.data);
        setRecibidas(b.ok ? b.data : []);
        setError("");
        setEstado("listo");
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    async function responder(inv, accion) {
        if (ocupado) return;
        setOcupado(true);
        setError("");
        setAviso("");
        const r = await responderInvitacion(inv.id, accion);
        setOcupado(false);
        if (!r.ok) {
            setError(mensajeDeError(r));
            return cargar();
        }
        setAviso(accion === "aceptar" ? `Ya eres parte de «${inv.equipo.nombre}».` : "Invitación rechazada.");
        cargar();
    }

    return (
        <div className={s.page}>
            <header className={s.head}>
                <span className={s.eyebrow}>Mi club</span>
                <h1>Mis equipos</h1>
                <p>Los equipos a los que te invitaron tus entrenadores. Puedes estar en varios a la vez.</p>
            </header>

            {error && <div className={`${s.alerta} ${s.alertaMal}`} role="alert">{error}</div>}
            {aviso && <div className={`${s.alerta} ${s.alertaBien}`} role="status">{aviso}</div>}

            {recibidas.length > 0 && (
                <section className={s.bloque} aria-label="Invitaciones">
                    <h2>Invitaciones pendientes</h2>
                    <div className={s.recibidas}>
                        {recibidas.map((inv) => (
                            <div key={inv.id} className={s.recibida}>
                                <div>
                                    <strong>{inv.equipo.nombre}</strong>
                                    <span className={s.muted}>
                                        Te invita {inv.invitadoPor}
                                        {[inv.equipo.categoria, inv.equipo.temporada].filter(Boolean).length > 0 && ` · ${[inv.equipo.categoria, inv.equipo.temporada].filter(Boolean).join(" · ")}`}
                                        {" · vence "}{fecha(inv.venceEn)}
                                    </span>
                                </div>
                                <div className={s.acciones}>
                                    <button className={`${s.btn} ${s.btnPrim}`} disabled={ocupado} onClick={() => responder(inv, "aceptar")}>Aceptar</button>
                                    <button className={s.btn} disabled={ocupado} onClick={() => responder(inv, "rechazar")}>Rechazar</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {estado === "cargando" && <p className={s.estado}>Cargando tus equipos…</p>}

            {estado === "listo" && equipos.length === 0 && (
                <div className={s.vacio}>
                    <h3>Aún no estás en ningún equipo</h3>
                    <p>Cuando un entrenador te invite por correo, la invitación aparecerá aquí.</p>
                </div>
            )}

            {equipos.length > 0 && (
                <section className={s.bloque}>
                    <h2>Mis equipos</h2>
                    <ul className={s.grid}>
                        {equipos.map((e) => (
                            <li key={e.id} className={s.tarjeta}>
                                <div>
                                    <h3>{e.nombre}</h3>
                                    <div className={s.chips}>
                                        {e.categoria && <span className={`${s.chip} ${s.chipAzul}`}>{e.categoria}</span>}
                                        {e.temporada && <span className={s.chip}>{e.temporada}</span>}
                                        <span className={s.chip}>{e.integrantes} integrantes</span>
                                    </div>
                                </div>
                                <div className={s.mio}>
                                    <span className={`${s.camiseta} ${e.numeroCamiseta == null ? s.camisetaVacia : ""}`}>{e.numeroCamiseta ?? "—"}</span>
                                    <div>
                                        <strong>{e.posicion || "Sin posición asignada"}</strong>
                                        <span className={s.muted}>Desde {fecha(e.desde)}</span>
                                    </div>
                                </div>
                                <div className={s.entrenadores}>
                                    <h4>{e.entrenadores.length > 1 ? "Entrenadores" : "Entrenador"}</h4>
                                    <ul>{e.entrenadores.map((c) => <Coach key={c.id} c={c} />)}</ul>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
