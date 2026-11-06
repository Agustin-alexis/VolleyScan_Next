"use client";

import Link from "next/link";
import { useId } from "react";
import {
    FaArrowRight, FaArrowTrendDown, FaArrowTrendUp, FaBolt, FaBullseye, FaCamera, FaCheck,
    FaDumbbell, FaFire, FaLock, FaMedal, FaStar, FaTrophy, FaUserGroup,
} from "react-icons/fa6";
import { haceCuanto } from "@/lib/formato";
import s from "./mi-progreso.module.css";

const cx = (...c) => c.filter(Boolean).join(" ");
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

const fechaLocal = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const numerica = (iso) => { const d = fechaLocal(iso); return `${d.getDate()}/${d.getMonth() + 1}`; };
const corta = (iso) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(fechaLocal(iso));

const ICONOS = {
    "primer-analisis": FaCamera, "diez-analisis": FaMedal, "nota-80": FaStar, "racha-3": FaFire,
    "racha-7": FaBolt, "primera-rutina": FaDumbbell, "cinco-rutinas": FaTrophy, "con-entrenador": FaUserGroup,
};

/**
 * Sección "Tu progreso" del dashboard. Recibe lo que carga `useProgreso()`
 * para que la página y la sección compartan una sola petición.
 */
export default function MiProgreso({ datos, estado, onReintentar }) {
    return (
        <section className={s.wrap} aria-label="Tu progreso">
            <div className={s.head}>
                <h2 className={s.h}>Tu progreso</h2>
                {estado === "listo" && datos && <span className={s.stamp}>Actualizado {haceCuanto(datos.generadoEn)}</span>}
            </div>

            {estado === "cargando" && (
                <div className={s.grid} aria-busy="true" aria-label="Cargando tu progreso">
                    {[7, 5, 7, 5].map((c, i) => <div key={i} className={cx(s.sk, c === 7 ? s.c7 : s.c5)} style={{ height: 210 }} />)}
                </div>
            )}

            {estado === "error" && (
                <div className={s.err} role="alert">
                    No se pudo cargar tu progreso. <button type="button" className={s.retry} onClick={onReintentar}>Reintentar</button>
                </div>
            )}

            {estado === "listo" && datos && (
                <div className={s.grid}>
                    <div className={s.c7}><Semana racha={datos.racha} semana={datos.semana} /></div>
                    <div className={s.c5}><Rutinas r={datos.rutinas} /></div>
                    <div className={s.c7}><Evolucion a={datos.analisis} /></div>
                    <div className={s.c5}><Tecnicas a={datos.analisis} /></div>
                    <div className={s.c7}><Semanas semanas={datos.semanas} /></div>
                    <div className={s.c5}><Entrenador e={datos.entrenador} /></div>
                    <div className={s.c7}><Logros logros={datos.logros} /></div>
                    <div className={s.c5}><Reciente eventos={datos.reciente} /></div>
                </div>
            )}
        </section>
    );
}

/* ── Semana y racha ── */
function Semana({ racha, semana }) {
    const mensaje = racha.activoHoy
        ? "¡Hoy ya cuenta! Vuelve mañana para seguir sumando."
        : racha.actual > 0 ? "Entrena hoy para no perder tu racha." : "Haz un análisis o un ejercicio hoy y empieza tu racha.";
    return (
        <article className={s.card}>
            <div className={s.ct}><h3 className={s.title}>Tu semana</h3><span className={s.tag}>Lunes a domingo</span></div>
            <div className={s.streak}>
                <span className={cx(s.flame, racha.actual === 0 && s.off)} aria-hidden="true"><FaFire /></span>
                <div>
                    <div className={s.big}>{racha.actual}<small>{racha.actual === 1 ? "día seguido" : "días seguidos"}</small></div>
                    <div className={s.sub}>{mensaje} Mejor racha: {plural(racha.mejor, "día", "días")}.</div>
                </div>
            </div>
            <ol className={s.days} style={{ listStyle: "none" }}>
                {semana.map((d) => (
                    <li key={d.fecha} className={cx(s.day, d.activo && s.on, d.hoy && s.hoy, d.futuro && s.fut)}
                        aria-label={`${corta(d.fecha)}: ${d.activo ? `${plural(d.sesiones, "análisis", "análisis")} y ${plural(d.ejercicios, "ejercicio", "ejercicios")}` : d.futuro ? "por venir" : "sin actividad"}`}>
                        <span>{d.dia}</span>
                        <b>{fechaLocal(d.fecha).getDate()}</b>
                        <span className={s.dot} aria-hidden="true">{d.activo ? <FaCheck /> : ""}</span>
                    </li>
                ))}
            </ol>
        </article>
    );
}

/* ── Rutinas ── */
function Rutinas({ r }) {
    const R = 36, C = 2 * Math.PI * R;
    const sig = r.siguiente;
    return (
        <article className={s.card}>
            <div className={s.ct}><h3 className={s.title}>Tus rutinas</h3><span className={s.tag}>{plural(r.asignadas, "asignada", "asignadas")}</span></div>
            {r.asignadas === 0 ? (
                <div className={s.empty}><b>Aún no tienes rutinas</b>Cuando tu entrenador te asigne una, verás aquí tu avance.</div>
            ) : (
                <>
                    <div className={s.rutRow}>
                        <div className={s.mini} role="img" aria-label={`${r.porcentaje}% de ejercicios completados`}>
                            <svg viewBox="0 0 84 84" aria-hidden="true">
                                <circle className={s.bg} cx="42" cy="42" r={R} />
                                <circle className={s.fg} cx="42" cy="42" r={R} stroke={r.porcentaje >= 100 ? "#22c55e" : "#3b82f6"}
                                    strokeDasharray={C} strokeDashoffset={C * (1 - r.porcentaje / 100)} transform="rotate(-90 42 42)" />
                            </svg>
                            <span>{r.porcentaje}%</span>
                        </div>
                        <div className={s.facts}>
                            <span><b>{r.ejerciciosHechos}</b> de {r.ejerciciosTotal} ejercicios hechos</span>
                            <span><b>{r.completadas}</b> de {r.asignadas} rutinas completas</span>
                        </div>
                    </div>
                    {sig ? (
                        <Link href="/usuario/rutinas" className={s.next}>
                            <div style={{ minWidth: 0 }}>
                                <div className={s.nextName}>{sig.nombre}</div>
                                <div className={s.nextMeta}>
                                    {sig.hechos}/{sig.total} ejercicios
                                    {sig.fecha && <> · {sig.vencida ? <span className={s.late}>Vencida ({corta(sig.fecha)})</span> : corta(sig.fecha)}</>}
                                </div>
                            </div>
                            <span className={s.go} aria-hidden="true"><FaArrowRight /></span>
                        </Link>
                    ) : (
                        <div className={s.muted}>🎉 Completaste todas tus rutinas asignadas.</div>
                    )}
                </>
            )}
        </article>
    );
}

/* ── Evolución de la puntuación (SVG, sin librerías) ── */
function Evolucion({ a }) {
    const id = useId().replace(/:/g, "");
    const pts = a.evolucion;
    const v = a.variacion;
    return (
        <article className={s.card}>
            <div className={s.ct}><h3 className={s.title}>Evolución de tu técnica</h3><span className={s.tag}>{pts.length ? `Últimas ${pts.length} sesiones` : "Sin sesiones aún"}</span></div>
            <div className={s.kpis}>
                <div className={s.kpi}><strong>{a.promedio ?? "—"}</strong><span>Promedio</span></div>
                <div className={s.kpi}><strong>{a.mejor ?? "—"}</strong><span>Mejor nota</span></div>
                <div className={s.kpi}>
                    <strong>
                        {a.sesiones}
                        {v != null && v !== 0 && (
                            <span className={v > 0 ? s.up : s.down} title="Últimas sesiones frente a las anteriores">
                                {v > 0 ? <FaArrowTrendUp aria-hidden="true" /> : <FaArrowTrendDown aria-hidden="true" />} {v > 0 ? "+" : "−"}{Math.abs(v)}
                            </span>
                        )}
                    </strong>
                    <span>Sesiones</span>
                </div>
            </div>
            {pts.length < 2 ? (
                <div className={s.empty}>
                    <b>{pts.length === 0 ? "Aún no tienes análisis" : "Falta una sesión más"}</b>
                    {pts.length === 0 ? "Haz tu primera sesión con la IA para ver tu evolución." : "Con dos sesiones ya se dibuja tu gráfica."}
                    <div style={{ marginTop: 10 }}><Link href="/usuario/analisis" className={s.link}><FaCamera aria-hidden="true" /> Iniciar análisis</Link></div>
                </div>
            ) : <Grafica pts={pts} id={id} />}
        </article>
    );
}

function Grafica({ pts, id }) {
    const W = 560, H = 190, pl = 32, pr = 12, pt = 14, pb = 26;
    const vals = pts.map((p) => p.puntuacion);
    let hi = Math.min(100, Math.ceil((Math.max(...vals) + 5) / 10) * 10);
    let lo = Math.max(0, Math.floor((Math.min(...vals) - 5) / 10) * 10);
    if (hi - lo < 30) lo = Math.max(0, hi - 30);
    if (hi - lo < 30) hi = lo + 30;
    const x = (i) => pl + (i * (W - pl - pr)) / (pts.length - 1);
    const y = (v) => pt + ((hi - v) / (hi - lo)) * (H - pt - pb);
    const linea = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.puntuacion).toFixed(1)}`).join(" ");
    const area = `${linea} L${x(pts.length - 1).toFixed(1)} ${H - pb} L${x(0).toFixed(1)} ${H - pb} Z`;
    const ticks = [lo, Math.round((lo + hi) / 2), hi];
    const fecha = (p) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(new Date(p.creadoEn));
    return (
        <svg className={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Gráfica de ${pts.length} sesiones. Última nota ${vals[vals.length - 1]}.`}>
            <defs>
                <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#3b82f6" stopOpacity=".35" /><stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
            </defs>
            {ticks.map((t) => (
                <g key={t}><line className={s.grd} x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} /><text className={s.axis} x={pl - 8} y={y(t) + 3} textAnchor="end">{t}</text></g>
            ))}
            <path d={area} fill={`url(#g${id})`} />
            <path className={s.line} d={linea} />
            {pts.map((p, i) => (
                <circle key={i} className={cx(s.pt, i === pts.length - 1 && s.ptLast)} cx={x(i)} cy={y(p.puntuacion)} r={i === pts.length - 1 ? 5 : 3.8}>
                    <title>{`${p.tecnica}: ${p.puntuacion}/100 · ${fecha(p)}`}</title>
                </circle>
            ))}
            <text className={s.axis} x={x(0)} y={H - 6} textAnchor="start">{fecha(pts[0])}</text>
            <text className={s.axis} x={x(pts.length - 1)} y={H - 6} textAnchor="end">{fecha(pts[pts.length - 1])}</text>
        </svg>
    );
}

/* ── Por técnica ── */
function Tecnicas({ a }) {
    return (
        <article className={s.card}>
            <div className={s.ct}><h3 className={s.title}>Por técnica</h3><span className={s.tag}>Promedio</span></div>
            {a.porTecnica.length === 0 ? (
                <div className={s.empty}><b>Sin datos todavía</b>Tus promedios por técnica aparecerán tras tus primeras sesiones.</div>
            ) : (
                <div className={s.tec}>
                    {a.porTecnica.map((t) => (
                        <div key={t.tecnica} className={s.tecRow}>
                            <span className={s.tecName}>{t.tecnica}</span>
                            <div className={s.barTrack} role="img" aria-label={`${t.tecnica}: promedio ${t.promedio ?? "sin nota"}`}>
                                <div className={s.barFill} style={{ width: `${t.promedio ?? 0}%` }} />
                            </div>
                            <span className={s.tecVal}><b>{t.promedio ?? "—"}</b> · {plural(t.sesiones, "sesión", "sesiones")}</span>
                        </div>
                    ))}
                </div>
            )}
        </article>
    );
}

/* ── Actividad de las últimas 8 semanas ── */
function Semanas({ semanas }) {
    const max = Math.max(1, ...semanas.map((w) => w.sesiones + w.ejercicios));
    const total = semanas.reduce((a, w) => a + w.sesiones + w.ejercicios, 0);
    return (
        <article className={s.card}>
            <div className={s.ct}>
                <h3 className={s.title}>Actividad por semana</h3>
                <div className={s.legend}><span><i className={s.bEj} />Ejercicios</span><span><i className={s.bSe} />Análisis</span></div>
            </div>
            {total === 0 ? (
                <div className={s.empty}><b>Sin actividad en las últimas 8 semanas</b>Cada ejercicio que marques y cada análisis suma aquí.</div>
            ) : (
                <div className={s.bars}>
                    {semanas.map((w, i) => {
                        const n = w.sesiones + w.ejercicios;
                        const alto = (n / max) * 100;
                        return (
                            <div key={w.semana} className={cx(s.bcol, i === semanas.length - 1 && s.now)}
                                title={`Semana del ${corta(w.semana)}: ${plural(w.ejercicios, "ejercicio", "ejercicios")} y ${plural(w.sesiones, "análisis", "análisis")}`}>
                                <span className={s.bVal}>{n || ""}</span>
                                <div className={s.stack} style={{ height: `${Math.max(alto, n ? 6 : 3) * 0.95}px` }}>
                                    <div className={cx(s.seg, s.bEj)} style={{ height: n ? `${(w.ejercicios / n) * 100}%` : 0 }} />
                                    <div className={cx(s.seg, s.bSe)} style={{ height: n ? `${(w.sesiones / n) * 100}%` : 0 }} />
                                </div>
                                <span className={s.bLabel}>{i === semanas.length - 1 ? "Esta" : numerica(w.semana)}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </article>
    );
}

/* ── Entrenador ── */
function Entrenador({ e }) {
    const iniciales = e ? e.nombre.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() : "";
    return (
        <article className={s.card}>
            <div className={s.ct}><h3 className={s.title}>Tu entrenador</h3></div>
            {!e ? (
                <>
                    <p className={s.muted}>Vincúlate con un entrenador para que vea tu progreso, revise tus sesiones y te asigne rutinas.</p>
                    <Link href="/usuario/entrenador" className={s.link}><FaUserGroup aria-hidden="true" /> Buscar entrenador</Link>
                </>
            ) : (
                <>
                    <div className={s.coach}>
                        <span className={s.avatar} aria-hidden="true">{iniciales}</span>
                        <div>
                            <div className={s.coachName}>{e.nombre}</div>
                            <span className={cx(s.pill, e.estado === "aceptado" ? s.ok : s.wait)}>{e.estado === "aceptado" ? "Vinculado" : "Solicitud enviada"}</span>
                        </div>
                    </div>
                    <p className={s.muted}>{e.estado === "aceptado"
                        ? "Ve tu progreso, revisa tus sesiones de análisis y te asigna rutinas."
                        : "Esperando que acepte tu solicitud. Te avisaremos cuando responda."}</p>
                    <Link href="/usuario/entrenador" className={cx(s.link, s.ghost)}>Ver mi entrenador <FaArrowRight aria-hidden="true" /></Link>
                </>
            )}
        </article>
    );
}

/* ── Logros ── */
function Logros({ logros }) {
    const hechos = logros.filter((l) => l.conseguido).length;
    return (
        <article className={s.card}>
            <div className={s.ct}><h3 className={s.title}>Logros</h3><span className={s.tag}>{hechos} de {logros.length}</span></div>
            <ul className={s.logros} style={{ listStyle: "none" }}>
                {logros.map((l) => {
                    const Icono = l.conseguido ? (ICONOS[l.id] ?? FaMedal) : FaLock;
                    return (
                        <li key={l.id} className={cx(s.logro, l.conseguido && s.ok)}>
                            <span className={s.lIcon} aria-hidden="true"><Icono /></span>
                            <div className={s.lTitle}>{l.titulo}</div>
                            <div className={s.lDesc}>{l.detalle}</div>
                            <div className={s.lBar} role="img" aria-label={`${l.valor} de ${l.meta}`}><i style={{ width: `${(l.valor / l.meta) * 100}%` }} /></div>
                            <div className={s.lNum}>{l.conseguido ? "¡Conseguido!" : `${l.valor} / ${l.meta}`}</div>
                        </li>
                    );
                })}
            </ul>
        </article>
    );
}

/* ── Actividad reciente ── */
function Reciente({ eventos }) {
    return (
        <article className={s.card}>
            <div className={s.ct}><h3 className={s.title}>Actividad reciente</h3></div>
            {eventos.length === 0 ? (
                <div className={s.empty}><b>Todavía no hay actividad</b>Tus análisis y ejercicios completados aparecerán aquí.</div>
            ) : (
                <ul className={s.tl} style={{ listStyle: "none" }}>
                    {eventos.map((e, i) => (
                        <li key={i} className={s.ev}>
                            <span className={cx(s.evIcon, s[e.tipo])} aria-hidden="true">{e.tipo === "analisis" ? <FaBullseye /> : <FaDumbbell />}</span>
                            <div style={{ minWidth: 0 }}>
                                <div className={s.evT}>{e.titulo}</div>
                                {e.detalle && <div className={s.evD}>{e.detalle}</div>}
                            </div>
                            <span className={s.evWhen}>{haceCuanto(e.creadoEn)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </article>
    );
}
