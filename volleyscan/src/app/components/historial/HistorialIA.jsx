"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import TecnicaFoto from "@/app/components/analisis/TecnicaFoto";
import { eliminarSesion, listarSesiones, obtenerSesion } from "@/lib/historial/api";
import { contarPendientes, reenviarPendientes } from "@/lib/historial/sesionAnalisis";
import { fichaDeportista, revisarSesion, sesionDeDeportista, sesionesDeDeportista } from "@/lib/vinculos/api";
import s from "./historial-ia.module.css";
/* ───────── utilidades ───────── */

const color = (n) => (n >= 80 ? "#22c55e" : n >= 60 ? "#3b82f6" : "#f97316");
const claseNivel = (n) => (n >= 80 ? s.nivelBien : n >= 60 ? s.nivelMedio : s.nivelBajo);
const etiqueta = (n) => (n >= 85 ? "Excelente" : n >= 70 ? "Bueno" : n >= 50 ? "Regular" : "A mejorar");

// Una sesión sin ningún remate medible no cuenta en promedios ni en la gráfica
const evaluada = (x) => x.repeticionesValidas > 0;

const fFecha = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });
const fCorta = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });
const fecha = (iso, f = fFecha) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "Fecha no disponible" : f.format(d);
};

function duracion(seg) {
    if (!seg) return null;
    const t = Math.round(seg);
    const m = Math.floor(t / 60);
    return m > 0 ? `${m} min ${t % 60} s` : `${t} s`;
}

const uni = (u) => (!u ? "" : u === "°" ? u : ` ${u}`);
const rango = (r, u) => (r ? `${r[0]}–${r[1]}${uni(u)}` : "—");

function mensajeDe(r) {
    const { status, data } = r;
    if (status === 0) return "No hay conexión con el servidor.";
    if (status === 401) return "Tu sesión venció. Vuelve a iniciar sesión.";
    if ([400, 403, 404, 409].includes(status) && data?.detail) return data.detail;
    return "Ocurrió un error inesperado.";
}

/* ───────── piezas visuales ───────── */

function Anillo({ valor, size = 46, grosor = 5, sinDato = false }) {
    const r = (size - grosor) / 2;
    const c = 2 * Math.PI * r;
    const pct = sinDato ? 0 : Math.max(0, Math.min(100, valor)) / 100;
    return (
        <span className={s.anillo} style={{ width: size, height: size }}>
            <svg width={size} height={size} aria-hidden="true">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a2233" strokeWidth={grosor} />
                {!sinDato && (
                    <circle
                        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color(valor)} strokeWidth={grosor}
                        strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`}
                    />
                )}
            </svg>
            <span className={s.anilloNum} style={{ fontSize: size * 0.32, color: sinDato ? "#475569" : undefined }}>
                {sinDato ? "—" : valor}
            </span>
        </span>
    );
}

/* Valor medido frente a su rango ideal: la banda verde es lo correcto */
function RangoBarra({ valor, ideal, ok }) {
    if (valor == null || !ideal) return null;
    const [a, b] = ideal;
    const span = Math.max(b - a, 1e-6);
    const lo = a - span * 0.9;
    const hi = b + span * 0.9;
    const pos = (v) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
    return (
        <div className={s.barra} role="img" aria-label={`Valor ${valor}, ideal ${a} a ${b}`}>
            <span className={s.banda} style={{ left: `${pos(a)}%`, width: `${pos(b) - pos(a)}%` }} />
            <span className={`${s.marca} ${ok ? s.marcaOk : s.marcaMal}`} style={{ left: `${pos(valor)}%` }} />
        </div>
    );
}

function Evolucion({ puntos, elegida, onElegir, esCoach = false }) {
    const [hover, setHover] = useState(null);
    if (puntos.length < 1) return null;
    const W = 720, H = 190, PX = 34, PT = 30, PB = 26;
    const x = (i) => (puntos.length === 1 ? W / 2 : PX + (i * (W - PX * 2)) / (puntos.length - 1));
    const y = (v) => PT + ((100 - v) / 100) * (H - PT - PB);
    const linea = puntos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.puntuacion).toFixed(1)}`).join(" ");
    const area = `${linea} L${x(puntos.length - 1)},${H - PB} L${x(0)},${H - PB} Z`;
    const activo = hover ?? puntos.findIndex((p) => p.id === elegida);
    return (
        <section className={s.grafica} aria-label="Evolución del puntaje">
            <header>
                <h2>{esCoach ? "Su evolución" : "Tu evolución"}</h2>
                <small>últimas {puntos.length} sesiones evaluadas</small>
            </header>
            <svg viewBox={`0 0 ${W} ${H}`} className={s.svg} role="img" aria-label="Puntaje por sesión">
                <defs>
                    <linearGradient id="hxArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.38" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="hxLinea" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                </defs>
                {[0, 50, 100].map((v) => (
                    <g key={v}>
                        <line x1={PX} x2={W - PX} y1={y(v)} y2={y(v)} stroke="#1f2634" />
                        <text x={PX - 8} y={y(v) + 4} textAnchor="end" fill="#94a3b8" fontSize="11">{v}</text>
                    </g>
                ))}
                {puntos.length > 1 && <path d={area} fill="url(#hxArea)" />}
                {puntos.length > 1 && (
                    <path d={linea} fill="none" stroke="url(#hxLinea)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                )}
                {puntos.map((p, i) => (
                    <g key={p.id} style={{ cursor: "pointer" }} onClick={() => onElegir(p.id)}
                       onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                        <circle cx={x(i)} cy={y(p.puntuacion)} r="15" fill="transparent" />
                        <circle cx={x(i)} cy={y(p.puntuacion)} r={i === activo ? 7 : 4.5}
                                fill={p.id === elegida ? "#22c55e" : "#3b82f6"} stroke="#0b0f1a" strokeWidth="2.5" />
                    </g>
                ))}
                {[0, puntos.length - 1].filter((v, k, a) => a.indexOf(v) === k).map((i) => (
                    <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : "end"} fill="#94a3b8" fontSize="11">
                        {fecha(puntos[i].creadoEn, fCorta)}
                    </text>
                ))}
                {activo >= 0 && (
                    <text x={Math.min(Math.max(x(activo), 44), W - 44)} y={y(puntos[activo].puntuacion) - 13}
                          textAnchor="middle" fill="#f1f5f9" fontSize="12.5" fontWeight="700">
                        {puntos[activo].puntuacion} · {fecha(puntos[activo].creadoEn, fCorta)}
                    </text>
                )}
            </svg>
        </section>
    );
}

/* ───────── página ───────── */

/** Perfil del deportista (solo en la vista del entrenador). */
function Ficha({ f }) {
    const ini = `${f.nombre?.[0] ?? ""}${f.apellido?.[0] ?? ""}`.toUpperCase();
    const [falla, setFalla] = useState(false);
    return (
        <section className={s.ficha} aria-label="Perfil del deportista">
            {f.fotoUrl && !falla ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={s.fichaFoto} src={f.fotoUrl} alt="" onError={() => setFalla(true)} />
            ) : (
                <span className={`${s.fichaFoto} ${s.fichaIni}`} aria-hidden="true">{ini}</span>
            )}
            <div className={s.fichaInfo}>
                <strong>{f.nombre} {f.apellido}</strong>
                <span className={s.muted}>{f.email}</span>
                <div className={s.chips}>
                    {f.posicion && <span className={s.chip}>{f.posicion}</span>}
                    {f.nivel && <span className={s.chip}>{f.nivel}</span>}
                </div>
            </div>
            <dl className={s.fichaDatos}>
                <div><dt>Edad</dt><dd>{f.edad != null ? `${f.edad} años` : "—"}</dd></div>
                <div><dt>Peso</dt><dd>{f.pesoKg != null ? `${f.pesoKg} kg` : "—"}</dd></div>
                <div><dt>Estatura</dt><dd>{f.estaturaM != null ? `${f.estaturaM} m` : "—"}</dd></div>
            </dl>
        </section>
    );
}

/**
 * Historial de análisis de IA. Una sola pieza para dos pantallas:
 *   modo="atleta"      → el historial del deportista que inició sesión
 *   modo="entrenador"  → la ficha de un deportista suyo (atletaId): sin borrar, con revisión
 */
export default function HistorialIA({ modo = "atleta", atletaId = null }) {
    const esCoach = modo === "entrenador";
    const listar = useCallback(() => (esCoach ? sesionesDeDeportista(atletaId) : listarSesiones()), [esCoach, atletaId]);
    const traer = useCallback((id) => (esCoach ? sesionDeDeportista(atletaId, id) : obtenerSesion(id)), [esCoach, atletaId]);
    const [ficha, setFicha] = useState(null);
    const [revisando, setRevisando] = useState(false);
    const [sesiones, setSesiones] = useState([]);
    const [estado, setEstado] = useState("cargando");
    const [error, setError] = useState("");
    const [seleccionId, setSeleccionId] = useState(null);
    const [detalle, setDetalle] = useState(null);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);
    const [repSel, setRepSel] = useState(null);
    const [confirmando, setConfirmando] = useState(false);
    const [pendientes, setPendientes] = useState(0);
    const [reintentando, setReintentando] = useState(false);
    const [foto, setFoto] = useState(null);

    const abrir = useCallback(async (id) => {
        setSeleccionId(id);
        setConfirmando(false);
        setDetalle(null);
        setRepSel(null);
        setCargandoDetalle(true);
        const r = await traer(id);
        setCargandoDetalle(false);
        if (r.ok) setDetalle(r.data);
        else setError(mensajeDe(r));
    }, [traer]);

    const cargar = useCallback(async () => {
        if (esCoach) {
            const f = await fichaDeportista(atletaId);
            if (!f.ok) {
                setError(mensajeDe(f));
                setEstado("error");
                return;
            }
            setFicha(f.data);
        }
        const r = await listar();
        if (!r.ok) {
            setError(mensajeDe(r));
            setEstado("error");
            return;
        }
        const lista = r.data ?? [];
        setSesiones(lista);
        setError("");
        setEstado("listo");
        if (lista.length) abrir((lista.find(evaluada) ?? lista[0]).id);
    }, [abrir, listar, esCoach, atletaId]);

    useEffect(() => {
        (async () => {
            // Sesiones que no se pudieron enviar antes (sin red, token vencido…)
            if (!esCoach && contarPendientes()) setPendientes(await reenviarPendientes());
            cargar();
        })();
    }, [cargar, esCoach]);

    async function reintentar() {
        setReintentando(true);
        setPendientes(await reenviarPendientes());
        setReintentando(false);
        cargar();
    }

    async function revisar(valor) {
        setRevisando(true);
        const r = await revisarSesion(atletaId, detalle.id, valor);
        setRevisando(false);
        if (!r.ok) return setError(mensajeDe(r));
        setError("");
        setDetalle(r.data);
        setSesiones((prev) =>
            prev.map((x) => (x.id === r.data.id ? { ...x, revisadoPorEntrenador: r.data.revisadoPorEntrenador, fechaRevision: r.data.fechaRevision } : x))
        );
    }

    async function borrar() {
        const r = await eliminarSesion(detalle.id);
        if (!r.ok) return setError(mensajeDe(r));
        setSeleccionId(null);
        setDetalle(null);
        await cargar();
    }

    async function exportar() {
        const todos = await Promise.all(sesiones.map((x) => traer(x.id)));
        const json = JSON.stringify(todos.filter((r) => r.ok).map((r) => r.data), null, 2);
        const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `volleyscan-historial-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    const resumen = useMemo(() => {
        const ev = sesiones.filter(evaluada);
        const cronologicas = [...ev].reverse();
        const media = (arr) => arr.reduce((a, x) => a + x.puntuacion, 0) / arr.length;
        const ult = cronologicas.slice(-3);
        const prev = cronologicas.slice(-6, -3);
        return {
            sesiones: sesiones.length,
            remates: sesiones.reduce((a, x) => a + x.repeticionesValidas, 0),
            promedio: ev.length ? Math.round(media(ev)) : null,
            mejor: ev.length ? Math.max(...ev.map((x) => x.mejorPuntuacion ?? 0)) : null,
            tendencia: ult.length >= 2 && prev.length >= 1 ? Math.round(media(ult) - media(prev)) : null,
            puntos: cronologicas.slice(-20),
        };
    }, [sesiones]);

    const rep =
        detalle?.repeticiones.find((x) => x.numero === repSel) ??
        detalle?.repeticiones.find((x) => x.valida) ??
        detalle?.repeticiones[0];

    return (
        <section className={s.page} aria-label="Historial de remates">
            <header className={s.head}>
                <div>
                    {esCoach && <Link className={s.volver} href="/panel_entrenador/gestion">← Volver a Deportistas</Link>}
                    <span className={s.eyebrow}>Análisis con IA</span>
                    <h1>{esCoach && ficha ? `Análisis de ${ficha.nombre}` : "Historial de remates"}</h1>
                    <p>
                        {esCoach
                            ? "Sus sesiones con lo que debe corregir, por qué y qué ejercicio hacer. Marca cada sesión como revisada."
                            : "Cada sesión con lo que debes corregir, por qué y qué ejercicio hacer."}
                    </p>
                </div>
                {!esCoach && sesiones.length > 0 && (
                    <button type="button" className={s.btn} onClick={exportar}>Exportar JSON</button>
                )}
            </header>

            {esCoach && ficha && <Ficha f={ficha} />}

            {pendientes > 0 && !esCoach && (
                <p className={s.alerta} role="status">
                    {pendientes} {pendientes === 1 ? "sesión sin enviar" : "sesiones sin enviar"} al servidor.
                    <button type="button" className={`${s.btn} ${s.btnMini}`} onClick={reintentar} disabled={reintentando}>
                        {reintentando ? "Enviando…" : "Reintentar"}
                    </button>
                </p>
            )}
            {error && <p className={s.alerta} role="alert">{error}</p>}
            {estado === "cargando" && <p className={s.estado}>Cargando historial…</p>}

            {estado === "listo" && sesiones.length === 0 && (
                <div className={s.vacio}>
                    <h2>{esCoach ? "Este deportista aún no tiene sesiones" : "Aún no tienes sesiones guardadas"}</h2>
                    <p>
                        {esCoach
                            ? "Cuando practique con el análisis de IA, sus sesiones aparecerán aquí."
                            : "Analiza un remate y la sesión aparecerá aquí al terminar."}
                    </p>
                    {!esCoach && <Link className={`${s.btn} ${s.btnPrim}`} href="/usuario/analisis">Ir a analizar</Link>}
                </div>
            )}

            {estado === "listo" && sesiones.length > 0 && (
                <>
                    <div className={s.kpis}>
                        <div className={s.kpi}><small>Sesiones</small><b>{resumen.sesiones}</b></div>
                        <div className={s.kpi}><small>Remates medidos</small><b>{resumen.remates}</b></div>
                        <div className={s.kpi}>
                            <small>Promedio</small>
                            <b>
                                {resumen.promedio ?? "—"}
                                {resumen.tendencia != null && resumen.tendencia !== 0 && (
                                    <span className={`${s.delta} ${resumen.tendencia > 0 ? s.deltaUp : s.deltaDown}`}>
                                        {resumen.tendencia > 0 ? "▲" : "▼"} {Math.abs(resumen.tendencia)}
                                    </span>
                                )}
                            </b>
                        </div>
                        <div className={s.kpi}><small>Mejor sesión</small><b>{resumen.mejor ?? "—"}</b></div>
                    </div>

                    <Evolucion puntos={resumen.puntos} elegida={seleccionId} onElegir={abrir} esCoach={esCoach} />

                    <div className={s.cuerpo}>
                        <nav aria-label="Sesiones guardadas">
                            <ul className={s.lista}>
                                {sesiones.map((x) => (
                                    <li key={x.id}>
                                        <button type="button" onClick={() => abrir(x.id)}
                                                className={`${s.item} ${x.id === seleccionId ? s.itemOn : ""}`}
                                                aria-current={x.id === seleccionId ? "true" : undefined}>
                                            <Anillo valor={x.puntuacion} sinDato={!evaluada(x)} />
                                            <span>
                                                <span className={s.itemFecha}>{fecha(x.creadoEn)}</span>
                                                <span className={`${s.itemMeta} ${evaluada(x) ? "" : s.sinEval}`}>
                                                    {evaluada(x)
                                                        ? `${x.repeticionesValidas} de ${x.totalRepeticiones} remates medidos`
                                                        : "Ningún remate se pudo medir"}
                                                    {x.revisadoPorEntrenador && <span className={s.revisada}> · ✓ Revisada</span>}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </nav>

                        <div>
                            {cargandoDetalle && <p className={s.estado}>Cargando sesión…</p>}
                            {detalle && (
                                <article className={s.detalle} aria-live="polite">
                                    <header className={s.dHead}>
                                        <Anillo valor={detalle.puntuacion} size={84} grosor={8} sinDato={!evaluada(detalle)} />
                                        <div>
                                            <h2>{fecha(detalle.creadoEn)}</h2>
                                            <div className={s.chips}>
                                                {evaluada(detalle) && (
                                                    <span className={`${s.chip} ${s.nivel} ${claseNivel(detalle.puntuacion)}`}>
                                                        {etiqueta(detalle.puntuacion)}
                                                    </span>
                                                )}
                                                <span className={s.chip}>{detalle.repeticionesValidas} de {detalle.totalRepeticiones} remates medidos</span>
                                                {duracion(detalle.duracionSeg) && <span className={s.chip}>{duracion(detalle.duracionSeg)}</span>}
                                                {detalle.nivel && <span className={s.chip}>nivel {detalle.nivel}</span>}
                                                {detalle.revisadoPorEntrenador && (
                                                    <span className={`${s.chip} ${s.chipRevisada}`}>
                                                        ✓ {esCoach ? "Revisada" : "Revisada por tu entrenador"} · {fecha(detalle.fechaRevision, fCorta)}
                                                    </span>
                                                )}
                                            </div>
                                            {esCoach && (
                                                <button type="button" disabled={revisando}
                                                        className={`${s.btn} ${detalle.revisadoPorEntrenador ? "" : s.btnPrim} ${s.btnRevisar}`}
                                                        onClick={() => revisar(!detalle.revisadoPorEntrenador)}>
                                                    {detalle.revisadoPorEntrenador ? "Quitar revisión" : "Marcar como revisada"}
                                                </button>
                                            )}
                                        </div>
                                    </header>

                                    {!evaluada(detalle) && (
                                        <p className={s.muted}>
                                            En esta sesión no se pudo medir ningún remate (poca visibilidad del cuerpo o poca luz).
                                            Revisa el encuadre y vuelve a intentarlo.
                                        </p>
                                    )}

                                    {detalle.errores.length > 0 && (
                                        <section className={s.sec}>
                                            <h3>Trabaja primero</h3>
                                            <p>Ordenado por los puntos que te costó cada error en esta sesión.</p>
                                            <ol className={s.prios}>
                                                {detalle.errores.map((e, i) => (
                                                    <li key={e.medidaId} className={s.prio}>
                                                        <div className={s.prioTop}>
                                                            <span className={s.prioN}>{i + 1}</span>
                                                            <strong>{e.nombre ?? e.medidaId}</strong>
                                                            <span className={`${s.pill} ${e.severidad === "grave" ? s.pillGrave : e.severidad === "moderado" ? s.pillMod : ""}`}>
                                                                {e.severidad}
                                                            </span>
                                                            <span className={s.pill}>{e.ocurrencias} {e.ocurrencias === 1 ? "vez" : "veces"}</span>
                                                        </div>
                                                        <p>{e.mensaje}</p>
                                                        {e.valorPromedio != null && e.ideal && (
                                                            <div className={s.barraWrap}>
                                                                <div className={s.barraTxt}>
                                                                    <span>Tu promedio: <b className={s.mal}>{e.valorPromedio}</b></span>
                                                                    <span>Ideal: {rango(e.ideal)}</span>
                                                                </div>
                                                                <RangoBarra valor={e.valorPromedio} ideal={e.ideal} ok={false} />
                                                            </div>
                                                        )}
                                                        {e.porQue && <p className={s.why}><b>Por qué importa:</b> {e.porQue}</p>}
                                                        {e.ejercicio && <p className={s.ejercicio}><b>Ejercicio:</b> {e.ejercicio}</p>}
                                                    </li>
                                                ))}
                                            </ol>
                                        </section>
                                    )}
                                    {detalle.errores.length === 0 && evaluada(detalle) && (
                                        <p className={s.bien}>Sin errores que corregir en esta sesión. ¡Buen trabajo!</p>
                                    )}

                                    {detalle.fortalezas.length > 0 && (
                                        <section className={s.sec}>
                                            <h3>{esCoach ? "Lo que hizo bien" : "Lo que hiciste bien"}</h3>
                                            <ul className={s.fort}>
                                                {detalle.fortalezas.map((t) => <li key={t}>✓ {t}</li>)}
                                            </ul>
                                        </section>
                                    )}

                                    {detalle.puntos.length > 0 && (
                                        <section className={s.sec}>
                                            <h3>{esCoach ? "Sus medidas frente al ideal" : "Tus medidas frente al ideal"}</h3>
                                            <p>La banda verde es el rango correcto; el punto es {esCoach ? "su" : "tu"} promedio.</p>
                                            <div className={s.medidas}>
                                                {detalle.puntos.map((p) => {
                                                    const v = p.valorPromedio ?? p.anguloGrados;
                                                    return (
                                                        <div key={p.medidaId ?? p.nombre} className={s.medida}>
                                                            <div className={s.medidaTop}>
                                                                <span>{p.nombre}</span>
                                                                <b className={p.aprobado ? s.ok : s.mal}>{v ?? "—"}{uni(p.unidad)}</b>
                                                            </div>
                                                            <RangoBarra valor={v} ideal={p.ideal} ok={p.aprobado} />
                                                            <div className={s.barraTxt}><span>Ideal</span><span>{rango(p.ideal, p.unidad)}</span></div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    )}

                                    <section className={s.sec}>
                                        <h3>Remate por remate</h3>
                                        <div className={s.reps}>
                                            {detalle.repeticiones.map((r) => (
                                                <button key={r.numero} type="button" onClick={() => setRepSel(r.numero)}
                                                        className={`${s.rep} ${r.numero === rep?.numero ? s.repOn : ""} ${r.valida ? "" : s.repNo}`}
                                                        style={r.valida ? { color: color(r.puntuacion) } : undefined}>
                                                    <small>#{r.numero}</small>{r.valida ? r.puntuacion : "—"}
                                                </button>
                                            ))}
                                        </div>
                                        {rep && (
                                            <div className={s.repBox}>
                                                {!rep.valida ? (
                                                    <p className={s.muted}>Remate descartado: {rep.motivo ?? "no se pudo medir"}.</p>
                                                ) : (
                                                    <>
                                                        <p className={s.muted}>
                                                            Remate #{rep.numero}
                                                            {rep.brazo ? ` · brazo ${rep.brazo}` : ""}
                                                            {rep.confianza ? ` · confianza ${rep.confianza}` : ""}
                                                            {rep.fpsMedio ? ` · ${rep.fpsMedio} fps` : ""}
                                                        </p>
                                                        {rep.recomendaciones?.principal && (
                                                            <p className={s.ejercicio}><b>Lo principal:</b> {rep.recomendaciones.principal.mensaje}</p>
                                                        )}
                                                        {(rep.recomendaciones?.errores ?? []).length === 0 &&
                                                            (rep.recomendaciones?.fortalezas ?? []).slice(0, 3).map((t) => (
                                                                <p key={t} className={s.bien}>✓ {t}</p>
                                                            ))}
                                                        <div className={s.medidas}>
                                                            {rep.medidas.map((m) => (
                                                                <div key={m.id} className={s.medida}>
                                                                    <div className={s.medidaTop}>
                                                                        <span>{m.nombre}</span>
                                                                        <b className={m.estado === "ok" ? s.ok : s.mal}>
                                                                            {m.valor == null ? "—" : `${m.valor}${uni(m.unidad)}`}
                                                                        </b>
                                                                    </div>
                                                                    <RangoBarra valor={m.valor} ideal={m.ideal} ok={m.estado === "ok"} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {rep.claves && (
                                                            <div>
                                                                <button type="button" className={`${s.btn} ${s.btnMini}`} onClick={() => setFoto(rep)}>
                                                                    {esCoach ? "Ver su técnica en este remate" : "Ver mi técnica de este remate"}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </section>

                                    {!esCoach && (
                                    <footer className={s.pie}>
                                        {confirmando ? (
                                            <>
                                                <span>¿Eliminar esta sesión? No se puede deshacer.</span>
                                                <button type="button" className={`${s.btn} ${s.btnPeligro}`} onClick={borrar}>Sí, eliminar</button>
                                                <button type="button" className={s.btn} onClick={() => setConfirmando(false)}>Cancelar</button>
                                            </>
                                        ) : (
                                            <button type="button" className={s.link} onClick={() => setConfirmando(true)}>Eliminar sesión</button>
                                        )}
                                    </footer>
                                    )}
                                </article>
                            )}
                        </div>
                    </div>
                </>
            )}

            {foto && (
                <div className={s.modal} role="dialog" aria-modal="true" onClick={() => setFoto(null)}>
                    <div className={s.modalCaja} onClick={(e) => e.stopPropagation()}>
                        <TecnicaFoto rep={foto} numero={foto.numero} onClose={() => setFoto(null)} />
                    </div>
                </div>
            )}
        </section>
    );
}
