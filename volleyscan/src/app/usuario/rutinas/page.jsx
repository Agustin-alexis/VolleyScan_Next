"use client";

import { useRef, useState } from "react";

import {
    FaBolt,
    FaBullseye,
    FaCalendarDay,
    FaCheck,
    FaClock,
    FaDumbbell,
    FaRotateLeft,
    FaTrophy,
} from "react-icons/fa6";

import { useApi } from "@/lib/UseApi";
import { api } from "@/lib/api";

import "./rutinas.css"; // tu CSS global (se conserva tal cual)
import s from "./rutinas.module.css"; // estilos del rediseño

const NIVELES = ["principiante", "intermedio", "avanzado"];

const capitalizar = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "");
const cx = (...c) => c.filter(Boolean).join(" ");

/** "2026-10-31" → "sáb, 31 oct" (en hora local, sin desfases de zona horaria) */
function fechaCorta(iso) {
    if (typeof iso !== "string") return null;
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short" }).format(new Date(y, m - 1, d));
}

function duracion(min) {
    if (!Number.isFinite(min) || min <= 0) return null;
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), r = min % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
}

const reducirMovimiento = () =>
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* =========================================
   PÁGINA
   Se vuelve a montar con `intento` para reintentar la carga
========================================= */

export default function Rutinas() {
    const [intento, setIntento] = useState(0);
    return <Contenido key={intento} onReintentar={() => setIntento((n) => n + 1)} />;
}

function Contenido({ onReintentar }) {
    const { data: lista, cargando, error } = useApi("/usuario/rutinas/");
    const [elegida, setElegida] = useState(null);
    const [intentoDetalle, setIntentoDetalle] = useState(0);

    // Si la elegida ya no existe (p. ej. el entrenador la eliminó), vuelve a la primera
    const actual = lista?.find((r) => r.id === elegida) ?? lista?.[0];

    return (
        <main className="main-content" id="rutinas">
            <div className={s.page}>

                <header className={s.top}>
                    <div>
                        <h1 className={s.title}>Mis rutinas</h1>
                        <p className={s.sub}>Entrenamiento personalizado asignado por tu entrenador</p>
                    </div>
                    {lista && lista.length > 0 && (
                        <span className={s.count}>
                            {lista.length} {lista.length === 1 ? "rutina" : "rutinas"}
                        </span>
                    )}
                </header>

                {cargando && <Esqueleto />}

                {error && (
                    <div className={cx(s.msg, s.err)} role="alert">
                        <strong>No se pudieron cargar tus rutinas</strong>
                        Revisa tu conexión e inténtalo de nuevo.{" "}
                        <button type="button" className={s.link} onClick={onReintentar}>Reintentar</button>
                    </div>
                )}

                {lista && lista.length === 0 && (
                    <div className={s.msg}>
                        <strong>Aún no tienes rutinas asignadas</strong>
                        Cuando tu entrenador te asigne una, aparecerá aquí y recibirás un aviso.
                    </div>
                )}

                {lista && lista.length > 1 && (
                    <nav className={s.picker} aria-label="Tus rutinas">
                        {lista.map((r) => {
                            const pct = Number(r.progreso?.porcentaje);
                            const tiene = Number.isFinite(pct);
                            return (
                                <button
                                    key={r.id}
                                    type="button"
                                    className={cx(s.pick, r.id === actual.id && s.on, tiene && pct >= 100 && s.ok)}
                                    aria-pressed={r.id === actual.id}
                                    onClick={() => setElegida(r.id)}
                                >
                                    <span className={s.pickName}>{r.nombre}</span>
                                    <span className={s.pickMeta}>
                                        <span>{capitalizar(r.nivel) || "Rutina"}</span>
                                        {tiene && <span>{pct >= 100 ? "✔ Completada" : `${pct}%`}</span>}
                                    </span>
                                    {tiene && <span className={s.mini}><i style={{ width: `${Math.min(100, pct)}%` }} /></span>}
                                </button>
                            );
                        })}
                    </nav>
                )}

                {actual && (
                    <RutinaDetalle
                        key={`${actual.id}-${intentoDetalle}`}
                        id={actual.id}
                        onReintentar={() => setIntentoDetalle((n) => n + 1)}
                    />
                )}

            </div>
        </main>
    );
}

function Esqueleto() {
    return (
        <div aria-busy="true" aria-label="Cargando rutinas" style={{ display: "grid", gap: 16 }}>
            <div className={s.sk} style={{ height: 210, borderRadius: 22 }} />
            <div className={s.sk} style={{ height: 70 }} />
            <div className={s.sk} style={{ height: 70 }} />
        </div>
    );
}

/* =========================================
   DETALLE DE UNA RUTINA
========================================= */

function RutinaDetalle({ id, onReintentar }) {
    const { data: rutina, cargando, error, setData } = useApi(`/usuario/rutinas/${id}/`);

    const [guardando, setGuardando] = useState(null);
    const [aviso, setAviso] = useState("");
    const botones = useRef({});

    /* Marcar o desmarcar un ejercicio; la verdad la dicta la respuesta del servidor */
    async function cambiar(ejercicio, completado) {
        if (guardando !== null) return;
        setAviso("");
        setGuardando(ejercicio.id);
        try {
            const res = await api(
                `/usuario/rutinas/${id}/ejercicios/${ejercicio.id}/completar/`,
                { method: "PUT", body: { completado } }
            );
            setData((prev) => ({
                ...prev,
                progreso: res.progreso,
                ejercicios: prev.ejercicios.map((e) => (e.id === res.ejercicio.id ? res.ejercicio : e)),
            }));
            if (res.ejercicio.completado !== completado) {
                setAviso("Este ejercicio no se puede desmarcar.");
            }
        } catch {
            setAviso("No se pudo guardar. Inténtalo de nuevo.");
        } finally {
            setGuardando(null);
        }
    }

    if (cargando) return <Esqueleto />;

    if (error || !rutina) {
        return (
            <div className={cx(s.msg, s.err)} role="alert">
                <strong>No se pudo cargar la rutina</strong>
                <button type="button" className={s.link} onClick={onReintentar}>Reintentar</button>
            </div>
        );
    }

    const nivel = NIVELES.includes(rutina.nivel) ? rutina.nivel : "intermedio";
    const idxNivel = NIVELES.indexOf(nivel);
    const ejercicios = rutina.ejercicios ?? [];
    const { total = 0, completados = 0, porcentaje = 0 } = rutina.progreso ?? {};
    const completa = total > 0 && completados >= total;

    const siguiente = ejercicios.find((e) => !e.completado);
    const seriesTotal = ejercicios.reduce((a, e) => a + (e.series || 0), 0);
    const seriesHechas = ejercicios.filter((e) => e.completado).reduce((a, e) => a + (e.series || 0), 0);

    const fecha = fechaCorta(rutina.fechaProgramada);
    const dur = duracion(rutina.duracionMin);

    function irAlSiguiente() {
        if (!siguiente) return;
        const b = botones.current[siguiente.id];
        b?.scrollIntoView({ behavior: reducirMovimiento() ? "auto" : "smooth", block: "center" });
        b?.focus({ preventScroll: true });
    }

    return (
        <>
            {/* PORTADA */}
            <section className={cx(s.hero, completa && s.done)} aria-label={`Rutina ${rutina.nombre}`}>
                <div className={s.heroMain}>
                    <div className={s.badges}>
                        <span className={cx(s.badge, s[`lvl${idxNivel}`])}>{capitalizar(nivel)}</span>
                        {rutina.tipo && <span className={cx(s.badge, s.tipo)}>{rutina.tipo}</span>}
                    </div>

                    <h2 className={s.heroTitle}>{rutina.nombre}</h2>
                    {rutina.descripcion && <p className={s.heroDesc}>{rutina.descripcion}</p>}

                    {(fecha || rutina.horaInicio || dur || rutina.intensidad) && (
                        <div className={s.facts}>
                            {fecha && <span className={s.fact}><FaCalendarDay aria-hidden="true" />{fecha}</span>}
                            {rutina.horaInicio && <span className={s.fact}><FaClock aria-hidden="true" />{rutina.horaInicio}{dur ? ` · ${dur}` : ""}</span>}
                            {!rutina.horaInicio && dur && <span className={s.fact}><FaClock aria-hidden="true" />{dur}</span>}
                            {rutina.intensidad && <span className={s.fact}><FaBolt aria-hidden="true" />Intensidad {rutina.intensidad}/10</span>}
                        </div>
                    )}

                    <div className={s.goal}>
                        <span className={s.goalIcon}><FaBullseye aria-hidden="true" /></span>
                        <div>
                            <div className={s.goalLabel}>Objetivo</div>
                            <div className={cx(s.goalText, !rutina.objetivo && s.none)}>
                                {rutina.objetivo || "Tu entrenador no definió un objetivo."}
                            </div>
                        </div>
                    </div>
                </div>

                <Anillo pct={porcentaje} completa={completa} />
            </section>

            {completa && (
                <div className={s.win} role="status">
                    <FaTrophy aria-hidden="true" />
                    <div>
                        <strong>¡Rutina completada!</strong>
                        <span>Terminaste los {total} ejercicios. Tu entrenador ya puede ver tu avance.</span>
                    </div>
                </div>
            )}

            <div className={s.body}>

                {/* EJERCICIOS */}
                <section className={s.panel} aria-labelledby="vs-ej">
                    <div className={s.panelHead}>
                        <h3 className={s.panelTitle} id="vs-ej">Ejercicios</h3>
                        <span className={s.panelTag} aria-live="polite">{completados} de {total} completados</span>
                    </div>

                    {ejercicios.length === 0 && (
                        <div className={s.msg}>Esta rutina todavía no tiene ejercicios.</div>
                    )}

                    <ol className={s.list}>
                        {ejercicios.map((e, i) => {
                            const hecho = !!e.completado;
                            const esSiguiente = !hecho && siguiente?.id === e.id;
                            const ocupado = guardando === e.id;
                            return (
                                <li key={e.id} className={cx(s.item, hecho && s.hecho, esSiguiente && s.next)}>
                                    <span className={s.num} aria-hidden="true">{hecho ? <FaCheck /> : i + 1}</span>

                                    <div>
                                        <p className={s.name}>{e.nombre}</p>
                                        <div className={s.dose}>
                                            <span className={s.chip}><b>{e.series}</b> series</span>
                                            <span className={s.chip}><b>{e.repeticiones}</b> repeticiones</span>
                                            {esSiguiente && <span className={s.siguiente}>Siguiente</span>}
                                            {hecho && <span className={s.stamp}>✔ Hecho</span>}
                                        </div>
                                    </div>

                                    <div className={s.act}>
                                        {hecho ? (
                                            <button
                                                type="button"
                                                className={cx(s.btn, s.btnUndo)}
                                                disabled={guardando !== null}
                                                onClick={() => cambiar(e, false)}
                                                aria-label={`Deshacer ${e.nombre}`}
                                            >
                                                <FaRotateLeft aria-hidden="true" /> {ocupado ? "Guardando…" : "Deshacer"}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                ref={(el) => { botones.current[e.id] = el; }}
                                                className={cx(s.btn, s.btnDo)}
                                                disabled={guardando !== null}
                                                onClick={() => cambiar(e, true)}
                                                aria-label={`Marcar como hecho: ${e.nombre}`}
                                            >
                                                <FaCheck aria-hidden="true" /> {ocupado ? "Guardando…" : "Marcar hecho"}
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ol>

                    {aviso && <p className={s.aviso} role="alert">{aviso}</p>}
                </section>

                {/* RESUMEN */}
                <aside className={cx(s.panel, s.side)} aria-label="Resumen de la rutina">
                    <div className={s.panelHead}>
                        <h3 className={s.panelTitle}>Resumen</h3>
                    </div>

                    <div className={s.stats}>
                        <div className={cx(s.stat, s.g)}><strong>{completados}</strong><span>Hechos</span></div>
                        <div className={s.stat}><strong>{Math.max(0, total - completados)}</strong><span>Pendientes</span></div>
                        <div className={s.stat}><strong>{seriesHechas}/{seriesTotal}</strong><span>Series</span></div>
                        <div className={s.stat}><strong><FaDumbbell style={{ fontSize: ".95rem", verticalAlign: "-1px" }} aria-hidden="true" /> {ejercicios.length}</strong><span>Ejercicios</span></div>
                    </div>

                    <div className={s.barLabel}><span>Dificultad</span><b>{nivel}</b></div>
                    <div className={s.bars} aria-hidden="true">
                        {NIVELES.map((_, i) => (
                            <span key={i} className={cx(s.bar, i <= idxNivel && s[`b${i}`])} />
                        ))}
                    </div>

                    {siguiente && (
                        <button type="button" className={cx(s.btn, s.btnDo, s.cta)} onClick={irAlSiguiente}>
                            Ir al siguiente ejercicio
                        </button>
                    )}
                </aside>

            </div>
        </>
    );
}

/* Anillo de progreso (SVG: nítido en cualquier pantalla y animado) */
function Anillo({ pct, completa }) {
    const R = 54;
    const C = 2 * Math.PI * R;
    const valor = Math.max(0, Math.min(100, Number(pct) || 0));
    return (
        <div className={s.ring} role="img" aria-label={`${valor}% completado`}>
            <svg viewBox="0 0 128 128" aria-hidden="true">
                <defs>
                    <linearGradient id="vsAnillo" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#3b82f6" />
                        <stop offset="1" stopColor="#22d3ee" />
                    </linearGradient>
                </defs>
                <circle className={s.ringBg} cx="64" cy="64" r={R} />
                <circle
                    className={s.ringFg}
                    cx="64" cy="64" r={R}
                    stroke={completa ? "#22c55e" : "url(#vsAnillo)"}
                    strokeDasharray={C}
                    strokeDashoffset={C * (1 - valor / 100)}
                    transform="rotate(-90 64 64)"
                />
            </svg>
            <div className={s.ringTxt}>
                <strong>{valor}%</strong>
                <span>{completa ? "Completada" : "Progreso"}</span>
            </div>
        </div>
    );
}