"use client";

/**
 * Mi nivel (deportista): en qué nivel estoy, qué me falta para el siguiente, el historial de mis cambios de nivel
 * y lo que mi entrenador observó de mis rutinas completadas (calificación y comentario).
 * Solo ve lo suyo; la nota privada del entrenador nunca llega aquí.
 */
import { useEffect, useState } from "react";
import { FaArrowDown, FaArrowUp, FaCheck, FaRegStar, FaStar } from "react-icons/fa6";
import { NIVELES, NOMBRE_NIVEL, mensajeDeError, miNivel } from "@/lib/registro/api";
import s from "./mi-nivel.module.css";

const fFecha = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });
const fecha = (iso) => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d.getTime()) ? fFecha.format(d) : "—"; };
const nombre = (n) => NOMBRE_NIVEL[n] ?? "—";
const cx = (...c) => c.filter(Boolean).join(" ");
const dec = (n) => n.toFixed(1).replace(".", ",");

function Estrellas({ valor }) {
    return (
        <span className={s.estrellas} role="img" aria-label={`${valor} de 5`}>
            {[1, 2, 3, 4, 5].map((n) => (n <= valor ? <FaStar key={n} className={s.on} aria-hidden="true" /> : <FaRegStar key={n} aria-hidden="true" />))}
        </span>
    );
}

export default function MiNivelPage() {
    const [estado, setEstado] = useState("cargando");
    const [error, setError] = useState("");
    const [d, setD] = useState(null);

    useEffect(() => {
        (async () => {
            const r = await miNivel();
            if (!r.ok) { setError(mensajeDeError(r)); setEstado("error"); return; }
            setD(r.data); setEstado("listo");
        })();
    }, []);

    if (estado === "cargando") return <main className={s.page}><p className={s.estado}>Cargando tu nivel…</p></main>;
    if (estado === "error") return <main className={s.page}><div className={s.alerta} role="alert">{error}</div></main>;

    const idx = NIVELES.indexOf(d.nivel);
    const av = d.avance;

    return (
        <main className={s.page}>
            <header className={s.head}>
                <p className={s.eyebrow}>Mi progreso</p>
                <h1>Mi nivel</h1>
                <p>Tu entrenador decide cuándo subes de nivel según cómo cumples y ejecutas tus rutinas.</p>
            </header>

            <section className={cx(s.hero, s[`niv_${d.nivel}`])}>
                <div className={s.heroTop}>
                    <div>
                        <span className={s.etiqueta}>Nivel actual</span>
                        <h2>{nombre(d.nivel)}</h2>
                        {d.entrenador && <p className={s.muted}>Entrenador: {d.entrenador}</p>}
                    </div>
                    <div className={s.heroCifras}>
                        <div><b>{d.totalRevisadas}</b><span>Rutinas revisadas</span></div>
                        <div><b>{d.calificacionPromedio != null ? dec(d.calificacionPromedio) : "–"}</b><span>Promedio</span></div>
                    </div>
                </div>

                <ol className={s.pasos} aria-label="Escalera de niveles">
                    {NIVELES.map((n, i) => (
                        <li key={n} className={cx(s[`niv_${n}`], i < idx && s.hecho, i === idx && s.actual)}>
                            <i>{i < idx ? <FaCheck aria-hidden="true" /> : null}</i>
                            <span>{nombre(n)}</span>
                        </li>
                    ))}
                </ol>
            </section>

            <section className={s.tarjeta}>
                {av && av.siguiente ? (
                    <>
                        <h2>Qué te falta para ser {nombre(av.siguiente)}</h2>
                        <ul className={s.criterios}>
                            {av.criterios.map((c) => {
                                const pct = Math.max(0, Math.min(100, Math.round(((c.valor ?? 0) / c.meta) * 100)));
                                return (
                                    <li key={c.clave}>
                                        <div className={s.criterioTop}>
                                            <span>{c.titulo}</span>
                                            <b className={c.cumple ? s.ok : undefined}>
                                                {c.valor == null ? "Sin datos" : c.clave === "calificacion" ? dec(c.valor) : `${c.valor}${c.unidad}`}
                                                <small> · meta {c.clave === "calificacion" ? dec(c.meta) : `${c.meta}${c.unidad}`}</small>
                                            </b>
                                        </div>
                                        <div className={s.barra}><i className={c.cumple ? s.barraOk : undefined} style={{ width: `${pct}%` }} /></div>
                                    </li>
                                );
                            })}
                        </ul>
                        <p className={s.nota}>
                            {av.sugerencia
                                ? "¡Cumples todos los criterios! Tu entrenador evaluará tu ascenso."
                                : "Cuenta desde tu último cambio de nivel. La decisión final siempre es de tu entrenador."}
                        </p>
                    </>
                ) : av ? (
                    <><h2>Nivel máximo</h2><p className={s.muted}>Llegaste al nivel más alto de la plataforma. ¡Sigue así!</p></>
                ) : (
                    <><h2>Aún no tienes entrenador</h2><p className={s.muted}>Cuando tu entrenador acepte tu solicitud y te asigne rutinas, aquí verás tu avance hacia el siguiente nivel.</p></>
                )}
            </section>

            <div className={s.dos}>
                <section className={s.tarjeta}>
                    <h2>Lo que observó tu entrenador</h2>
                    {d.revisiones.length === 0 ? (
                        <p className={s.muted}>Todavía no hay rutinas revisadas. Completa tus rutinas: tu entrenador las revisará y dejará su comentario aquí.</p>
                    ) : (
                        <ul className={s.revisiones}>
                            {d.revisiones.map((r) => (
                                <li key={r.id}>
                                    <div className={s.revTop}>
                                        <b>{r.rutina}</b>
                                        <Estrellas valor={r.calificacion} />
                                    </div>
                                    <small>{fecha(r.fecha)}{r.entrenador ? ` · ${r.entrenador}` : ""}</small>
                                    {r.comentario && <p>“{r.comentario}”</p>}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className={s.tarjeta}>
                    <h2>Historial de niveles</h2>
                    {d.historial.length === 0 ? (
                        <p className={s.muted}>Aún no has cambiado de nivel. Cuando suceda, quedará registrado aquí.</p>
                    ) : (
                        <ul className={s.linea}>
                            {d.historial.map((h, i) => (
                                <li key={i}>
                                    <span className={cx(s.punto, h.sube ? s.sube : s.baja)}>{h.sube ? <FaArrowUp /> : <FaArrowDown />}</span>
                                    <div>
                                        <b>{nombre(h.anterior)} → {nombre(h.nuevo)}</b>
                                        <small>{fecha(h.fecha)}{h.entrenador ? ` · ${h.entrenador}` : ""}</small>
                                        {h.motivo && <p>{h.motivo}</p>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </main>
    );
}
