"use client";

/** Mis partidos: resultado de cada partido y MIS cifras (nunca las de mis compañeros ni las notas del entrenador). */
import { useEffect, useState } from "react";
import { mensajeDeError, misPartidos } from "@/lib/partidos/api";
import s from "./partidos.module.css";

const fFecha = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });
const fecha = (iso) => {
    const d = iso ? new Date(`${iso}T00:00:00`) : null;
    return d && !Number.isNaN(d.getTime()) ? fFecha.format(d) : "—";
};
const porc = (v) => (v == null ? "—" : `${v}%`);

function Cifras({ c, clase }) {
    return (
        <div className={clase}>
            <div><b className="verde" style={{ color: "#4ade80" }}>{c.puntosTotales}</b><span>Puntos</span></div>
            <div><b>{c.ataquesExitosos}/{c.ataquesFallidos}</b><span>Ataque +/−</span></div>
            <div><b className="azul" style={{ color: "#60a5fa" }}>{porc(c.efectividadAtaque)}</b><span>% Ataque</span></div>
            <div><b>{c.bloqueos}</b><span>Bloqueos</span></div>
            <div><b>{c.saquesExitosos}</b><span>Aces</span></div>
            <div><b>{c.recepcionesExitosas}/{c.recepcionesFalladas}</b><span>Recep. +/−</span></div>
            <div><b style={{ color: "#60a5fa" }}>{porc(c.efectividadRecepcion)}</b><span>% Recep.</span></div>
            <div><b>{c.erroresNoForzados}</b><span>Errores</span></div>
        </div>
    );
}

export default function MisPartidosPage() {
    const [estado, setEstado] = useState("cargando");
    const [error, setError] = useState("");
    const [datos, setDatos] = useState(null);

    useEffect(() => {
        (async () => {
            const r = await misPartidos();
            if (!r.ok) { setError(mensajeDeError(r)); setEstado("error"); return; }
            setDatos(r.data); setEstado("listo");
        })();
    }, []);

    const a = datos?.acumulado;
    return (
        <div className={s.page}>
            <header className={s.head}>
                <p className={s.eyebrow}>Competencia</p>
                <h1>Mis partidos</h1>
                <p>Tus cifras en cada partido que registró tu entrenador y tu acumulado de la temporada.</p>
            </header>

            {estado === "cargando" && <p className={s.estado}>Cargando tus partidos…</p>}
            {estado === "error" && <p className={s.alerta} role="alert">{error}</p>}

            {estado === "listo" && !a && (
                <div className={s.vacio}>
                    <h2>Todavía no tienes partidos registrados</h2>
                    <p>Cuando tu entrenador registre un partido en el que jugaste, verás aquí tus estadísticas.</p>
                </div>
            )}

            {estado === "listo" && a && (
                <>
                    <section className={s.acum} aria-label="Acumulado">
                        <h2>Mi acumulado<small>{a.partidos} partido{a.partidos === 1 ? "" : "s"}</small></h2>
                        <div className={s.cifras}>
                            <div className={s.cifra}><b className="verde" style={{ color: "#4ade80" }}>{a.puntosTotales}</b><span>Puntos</span></div>
                            <div className={s.cifra}><b className="azul" style={{ color: "#60a5fa" }}>{porc(a.efectividadAtaque)}</b><span>% Ataque</span></div>
                            <div className={s.cifra}><b>{a.bloqueos}</b><span>Bloqueos</span></div>
                            <div className={s.cifra}><b>{a.saquesExitosos}</b><span>Aces</span></div>
                            <div className={s.cifra}><b style={{ color: "#60a5fa" }}>{porc(a.efectividadRecepcion)}</b><span>% Recepción</span></div>
                            <div className={s.cifra}><b>{a.erroresNoForzados}</b><span>Errores</span></div>
                        </div>
                    </section>
                    <ul className={s.lista}>
                        {datos.partidos.map((p) => (
                            <li key={p.id} className={`${s.partido} ${p.resultado === "derrota" ? s.derrota : ""}`}>
                                <div className={s.fila1}>
                                    <span className={s.marcador}><b>{p.setsGanados}–{p.setsPerdidos}</b><small>{p.resultado === "victoria" ? "Victoria" : "Derrota"}</small></span>
                                    <div style={{ minWidth: 0 }}>
                                        <p className={s.titulo}>vs {p.rival}</p>
                                        <p className={s.meta}>
                                            <span>{fecha(p.fecha)}</span>
                                            {p.ubicacion && <span>{p.ubicacion}</span>}
                                            <span className={s.chip}>{p.equipo}</span>
                                        </p>
                                    </div>
                                </div>
                                <Cifras c={p.misCifras} clase={s.mis} />
                                {p.miObservacion && (
                                    <div className={s.obs}>
                                        <b>Observación de tu entrenador</b>
                                        <p>{p.miObservacion}</p>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}
