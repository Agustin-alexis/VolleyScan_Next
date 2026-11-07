"use client";

// ─────────────────────────────────────────────────────────────
// Estadísticas y reportes del entrenador — datos reales de SUS deportistas.
//   KPIs · evolución de la puntuación · por técnica · ranking · errores frecuentes · alertas
// Exporta el ranking a CSV (se abre en Excel) e imprime un reporte limpio (Guardar como PDF).
// ─────────────────────────────────────────────────────────────

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import {
    FaArrowTrendDown,
    FaBullseye,
    FaChartLine,
    FaClipboardCheck,
    FaClockRotateLeft,
    FaEye,
    FaFileArrowDown,
    FaMagnifyingGlass,
    FaPrint,
    FaTriangleExclamation,
    FaUserCheck,
    FaUserPlus,
    FaUserXmark,
    FaUsers,
} from "react-icons/fa6";
import { useEstadisticas } from "@/lib/estadisticas/useEstadisticas";
import s from "./estadisticas.module.css";

// ── Constantes y utilidades ───────────────────────────────────

const PERIODOS = [
    { dias: 7, corto: "7 días", largo: "los últimos 7 días" },
    { dias: 30, corto: "30 días", largo: "los últimos 30 días" },
    { dias: 90, corto: "90 días", largo: "los últimos 90 días" },
    { dias: 180, corto: "6 meses", largo: "los últimos 6 meses" },
];

const TECNICAS = { remate: "Remate", saque: "Saque", recepcion: "Recepción", bloqueo: "Bloqueo", pase: "Pase" };
const SEVERIDAD = { leve: "Leve", moderado: "Moderado", grave: "Grave" };
const ESTADOS = { activo: "Activo", inactivo: "Inactivo", sin_datos: "Sin datos" };

const fechaCorta = (iso) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" }).replace(".", "");

const fechaLarga = (iso) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });

const sello = (iso) =>
    new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Color de una puntuación 0–100. */
const tono = (p) => (p == null ? "off" : p >= 80 ? "ok" : p >= 60 ? "bien" : p >= 40 ? "medio" : "bajo");

const iniciales = (d) => `${d.nombre?.[0] ?? ""}${d.apellido?.[0] ?? ""}`.toUpperCase();

const haceCuanto = (dias) =>
    dias == null ? "—" : dias === 0 ? "Hoy" : dias === 1 ? "Ayer" : `Hace ${dias} días`;

function signo(n) {
    return n > 0 ? `+${n}` : `${n}`;
}

// ── Piezas pequeñas ───────────────────────────────────────────

/** Variación contra el periodo anterior. `unidad` va pegada al número. */
function Delta({ valor, unidad = "", vacio = "Sin periodo previo" }) {
    if (valor == null) return <span className={`${s.delta} ${s.dNeutro}`}>{vacio}</span>;
    if (valor === 0) return <span className={`${s.delta} ${s.dNeutro}`}>= Igual que antes</span>;
    const sube = valor > 0;
    return (
        <span className={`${s.delta} ${sube ? s.dSube : s.dBaja}`}>
            {sube ? "▲" : "▼"} {signo(valor)}{unidad} <small>vs. periodo anterior</small>
        </span>
    );
}

/** Mini línea de tendencia (omite los huecos sin datos). */
function Spark({ valores, max = 100, color = "var(--blue)" }) {
    const puntos = valores.map((v, i) => [i, v]).filter(([, v]) => v != null);
    if (puntos.length < 2) return <div className={s.sparkVacio} aria-hidden="true" />;
    const W = 96, H = 30, n = valores.length - 1;
    const top = Math.max(max, ...puntos.map(([, v]) => v), 1);
    const d = puntos
        .map(([i, v], k) => `${k ? "L" : "M"}${((i / n) * W).toFixed(1)},${(H - 3 - (v / top) * (H - 6)).toFixed(1)}`)
        .join(" ");
    return (
        <svg className={s.spark} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function Kpi({ icono, color, etiqueta, valor, unidad, pie, extra }) {
    return (
        <div className={s.kpi} style={{ "--k": color }}>
            <div className={s.kpiTop}>
                <span className={s.kpiIcono} aria-hidden="true">{icono}</span>
                <span className={s.kpiEtiqueta}>{etiqueta}</span>
            </div>
            <div className={s.kpiValor}>
                {valor ?? "—"}
                {valor != null && unidad && <small>{unidad}</small>}
            </div>
            <div className={s.kpiPie}>{pie}</div>
            {extra}
        </div>
    );
}

// ── Evolución de la puntuación ────────────────────────────────

const W = 720, H = 268, IZQ = 38, DER = 10, TOP = 12, BASE = 186, VOL_TOP = 216, VOL_BASE = 244;

function Evolucion({ puntos, media }) {
    const uid = useId().replace(/:/g, "");
    const [hover, setHover] = useState(null);
    const n = puntos.length;
    const banda = (W - IZQ - DER) / n;
    const x = (i) => IZQ + (i + 0.5) * banda;
    const y = (p) => BASE - (p / 100) * (BASE - TOP);
    const maxSes = Math.max(1, ...puntos.map((p) => p.sesiones));

    // Tramos continuos (un hueco sin sesiones corta la línea, no se inventa nada)
    const tramos = [];
    puntos.forEach((p, i) => {
        if (p.promedio == null) { tramos.push(null); return; }
        if (tramos.length === 0 || tramos[tramos.length - 1] === null) tramos.push([]);
        tramos[tramos.length - 1].push([i, p.promedio]);
    });
    const lineas = tramos.filter(Boolean);
    const trazo = (t) => t.map(([i, p], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
    const area = (t) => `${trazo(t)} L${x(t[t.length - 1][0]).toFixed(1)},${BASE} L${x(t[0][0]).toFixed(1)},${BASE} Z`;

    const paso = Math.ceil(n / 6);
    // Una fecha cada `paso` puntos; la última solo si no queda pegada a la anterior
    const etiqueta = (i) => i % paso === 0 || (i === n - 1 && (n - 1) % paso >= Math.ceil(paso / 2));
    const conDatos = puntos.some((p) => p.promedio != null);
    const h = hover != null ? puntos[hover] : null;

    function mover(e) {
        const r = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * W;
        setHover(Math.min(n - 1, Math.max(0, Math.floor((px - IZQ) / banda))));
    }

    return (
        <div className={s.chartBox}>
            <svg
                className={s.chart}
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label={conDatos ? "Evolución de la puntuación media del periodo" : "Sin análisis en el periodo"}
                onPointerMove={mover}
                onPointerLeave={() => setHover(null)}
            >
                <defs>
                    <linearGradient id={`a${uid}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--blue)" stopOpacity=".38" />
                        <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {[0, 25, 50, 75, 100].map((v) => (
                    <g key={v}>
                        <line x1={IZQ} x2={W - DER} y1={y(v)} y2={y(v)} className={s.rejilla} />
                        <text x={IZQ - 8} y={y(v) + 3.5} textAnchor="end" className={s.eje}>{v}</text>
                    </g>
                ))}

                {conDatos && media != null && (
                    <line x1={IZQ} x2={W - DER} y1={y(media)} y2={y(media)} className={s.media} />
                )}

                {lineas.filter((t) => t.length > 1).map((t, k) => <path key={`ar${k}`} d={area(t)} fill={`url(#a${uid})`} />)}
                {lineas.filter((t) => t.length > 1).map((t, k) => (
                    <path key={`li${k}`} d={trazo(t)} className={s.linea} />
                ))}
                {puntos.map((p, i) => p.promedio != null && (
                    <circle key={`pt${i}`} cx={x(i)} cy={y(p.promedio)} r={hover === i ? 5.5 : 3.4} className={s.punto} />
                ))}

                {/* Volumen: cuántos análisis hubo en cada punto */}
                <text x={IZQ} y={VOL_TOP - 6} className={s.eje}>Análisis por punto</text>
                {puntos.map((p, i) => {
                    const alto = p.sesiones ? Math.max(3, (p.sesiones / maxSes) * (VOL_BASE - VOL_TOP)) : 0;
                    return p.sesiones > 0 && (
                        <rect key={`v${i}`} x={x(i) - Math.min(banda * 0.28, 9)} width={Math.min(banda * 0.56, 18)}
                              y={VOL_BASE - alto} height={alto} rx="2.5" className={hover === i ? s.volOn : s.vol} />
                    );
                })}
                <line x1={IZQ} x2={W - DER} y1={VOL_BASE + 0.5} y2={VOL_BASE + 0.5} className={s.rejilla} />

                {puntos.map((p, i) => etiqueta(i) && (
                    <text key={`x${i}`} x={x(i)} y={H - 8} textAnchor="middle" className={s.eje}>{fechaCorta(p.hasta)}</text>
                ))}

                {hover != null && <line x1={x(hover)} x2={x(hover)} y1={TOP} y2={VOL_BASE} className={s.guia} />}
            </svg>

            {h && (
                <div className={s.tip} style={{ left: `${(x(hover) / W) * 100}%` }}>
                    <b>{h.desde === h.hasta ? fechaCorta(h.desde) : `${fechaCorta(h.desde)} – ${fechaCorta(h.hasta)}`}</b>
                    <span>{h.promedio != null ? <>Puntuación media <strong>{h.promedio}</strong></> : "Sin análisis"}</span>
                    <span>{h.sesiones} análisis</span>
                </div>
            )}

            {conDatos && (
                <ul className={s.leyenda} aria-hidden="true">
                    <li><i className={s.lgLinea} /> Puntuación media</li>
                    {media != null && <li><i className={s.lgMedia} /> Media del periodo: <b>{media}</b></li>}
                    <li><i className={s.lgVol} /> Cantidad de análisis</li>
                </ul>
            )}

            {!conDatos && (
                <div className={s.vacioSobre}>
                    <b>Aún no hay análisis en este periodo</b>
                    Cuando tus deportistas analicen su técnica con la IA, verás aquí su evolución.
                </div>
            )}
        </div>
    );
}

// ── Por técnica ───────────────────────────────────────────────

function PorTecnica({ lista }) {
    const hay = lista.some((t) => t.sesiones > 0);
    if (!hay) return <div className={s.vacio}><b>Sin análisis por técnica</b>Aparecerán cuando haya sesiones en el periodo.</div>;
    return (
        <ul className={s.tecnicas}>
            {lista.map((t) => (
                <li key={t.tecnica} className={t.sesiones ? "" : s.apagada}>
                    <div className={s.tecTop}>
                        <span className={s.tecNombre}>{TECNICAS[t.tecnica]}</span>
                        <span className={s.tecMeta}>
                            {t.sesiones} análisis
                            {t.delta != null && t.delta !== 0 && (
                                <em className={t.delta > 0 ? s.sube : s.baja}>{t.delta > 0 ? "▲" : "▼"} {Math.abs(t.delta)}</em>
                            )}
                        </span>
                        <span className={`${s.tecNota} ${s[`t_${tono(t.promedio)}`]}`}>{t.promedio ?? "—"}</span>
                    </div>
                    <div className={s.barra} role="img" aria-label={`${TECNICAS[t.tecnica]}: ${t.promedio ?? "sin datos"} de 100`}>
                        <span className={s[`f_${tono(t.promedio)}`]} style={{ width: `${t.promedio ?? 0}%` }} />
                    </div>
                </li>
            ))}
        </ul>
    );
}

// ── Errores frecuentes ────────────────────────────────────────

function Errores({ lista }) {
    if (!lista.length) {
        return <div className={s.vacio}><b>Sin errores registrados</b>Los errores que detecte la IA en los análisis aparecerán aquí.</div>;
    }
    const max = Math.max(...lista.map((e) => e.sesiones));
    return (
        <ol className={s.errores}>
            {lista.map((e, i) => (
                <li key={e.nombre}>
                    <span className={s.errN}>{i + 1}</span>
                    <div className={s.errCuerpo}>
                        <div className={s.errTop}>
                            <b>{e.nombre}</b>
                            <span className={`${s.sev} ${s[`sev_${e.severidad}`]}`}>{SEVERIDAD[e.severidad]}</span>
                        </div>
                        <div className={s.barra}><span className={s.f_err} style={{ width: `${(e.sesiones / max) * 100}%` }} /></div>
                        <div className={s.errMeta}>
                            {e.sesiones} análisis · {e.atletas} {e.atletas === 1 ? "deportista" : "deportistas"} · {e.ocurrencias} {e.ocurrencias === 1 ? "vez" : "veces"}
                        </div>
                    </div>
                </li>
            ))}
        </ol>
    );
}

// ── Alertas ───────────────────────────────────────────────────

const ALERTAS = {
    baja: { orden: 0, icono: <FaArrowTrendDown />, color: "rojo", texto: (a) => <><b>{a.nombre}</b> bajó {Math.abs(a.delta)} puntos de promedio</> },
    inactivo: { orden: 1, icono: <FaClockRotateLeft />, color: "naranja", texto: (a) => <><b>{a.nombre}</b> lleva {a.dias} días sin actividad</> },
    sin_actividad: { orden: 2, icono: <FaClockRotateLeft />, color: "naranja", texto: (a) => <><b>{a.nombre}</b> aún no tiene actividad</> },
    por_revisar: { orden: 3, icono: <FaEye />, color: "azul", texto: (a) => <><b>{a.nombre}</b> tiene {a.cantidad} análisis sin revisar</> },
    inasistencia: { orden: 0, icono: <FaUserXmark />, color: "rojo", texto: (a) => <><b>{a.nombre}</b> faltó a {a.faltas} de sus últimos {a.de} eventos</> },
    asistencia_baja: { orden: 1, icono: <FaUserXmark />, color: "naranja", texto: (a) => <><b>{a.nombre}</b> asiste solo al {a.porcentaje}% de los eventos</> },
    sin_rutina: { orden: 4, icono: <FaClipboardCheck />, color: "gris", texto: (a) => <><b>{a.nombre}</b> no tiene rutinas pendientes</> },
};
const VISIBLES = 6;       // en pantalla, antes de "Ver todas"
const EN_PAPEL = 10;      // en el reporte impreso

function Alertas({ lista }) {
    const [todas, setTodas] = useState(false);
    const ordenadas = useMemo(
        () => [...lista].sort((a, b) => ALERTAS[a.tipo].orden - ALERTAS[b.tipo].orden || a.nombre.localeCompare(b.nombre)),
        [lista],
    );
    if (!ordenadas.length) {
        return <div className={s.vacio}><b>Todo en orden</b>Ningún deportista necesita atención ahora mismo.</div>;
    }
    return (
        <>
            <ul className={s.alertas}>
                {ordenadas.map((a, i) => {
                    const cfg = ALERTAS[a.tipo];
                    return (
                        <li key={`${a.tipo}-${a.atletaId}`} className={`${!todas && i >= VISIBLES ? s.extra : ""} ${i >= EN_PAPEL ? s.sobra : ""}`}>
                            <Link href={`/panel_entrenador/gestion/${a.atletaId}`} className={`${s.alerta} ${s[`al_${cfg.color}`]}`}>
                                <span className={s.alIcono} aria-hidden="true">{cfg.icono}</span>
                                <span className={s.alTexto}>{cfg.texto(a)}</span>
                                <span className={s.alVer}>Ver ficha</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
            {ordenadas.length > EN_PAPEL && (
                <p className={s.soloImp}>Y {ordenadas.length - EN_PAPEL} avisos más, disponibles en la pantalla de Estadísticas.</p>
            )}
            {ordenadas.length > VISIBLES && (
                <button type="button" className={s.verMas} onClick={() => setTodas((v) => !v)}>
                    {todas ? "Ver menos" : `Ver las ${ordenadas.length} alertas`}
                </button>
            )}
        </>
    );
}

// ── Ranking de deportistas ────────────────────────────────────

const COLUMNAS = [
    { id: "nombre", etiqueta: "Deportista" },
    { id: "sesiones", etiqueta: "Análisis" },
    { id: "promedio", etiqueta: "Puntuación" },
    { id: "delta", etiqueta: "Tendencia" },
    { id: "cumplimiento", etiqueta: "Rutinas" },
    { id: "asistencia", etiqueta: "Asistencia" },
    { id: "diasSinActividad", etiqueta: "Actividad" },
];

/** Los valores vacíos siempre van al final, sin importar el sentido. */
function ordenar(lista, col, dir) {
    const valor = (d) => (col === "nombre" ? `${d.nombre} ${d.apellido}`.toLowerCase() : d[col]);
    return [...lista].sort((a, b) => {
        const va = valor(a), vb = valor(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        const c = typeof va === "string" ? va.localeCompare(vb, "es") : va - vb;
        return dir === "asc" ? c : -c;
    });
}

function Ranking({ lista }) {
    const [busca, setBusca] = useState("");
    const [estado, setEstado] = useState("todos");
    const [col, setCol] = useState("promedio");
    const [dir, setDir] = useState("desc");

    const cuenta = useMemo(() => ({
        todos: lista.length,
        activo: lista.filter((d) => d.estado === "activo").length,
        inactivo: lista.filter((d) => d.estado === "inactivo").length,
        sin_datos: lista.filter((d) => d.estado === "sin_datos").length,
    }), [lista]);

    const filas = useMemo(() => {
        const q = busca.trim().toLowerCase();
        const f = lista.filter((d) =>
            (estado === "todos" || d.estado === estado) &&
            (!q || `${d.nombre} ${d.apellido}`.toLowerCase().includes(q)));
        return ordenar(f, col, dir);
    }, [lista, busca, estado, col, dir]);

    function cambiar(id) {
        if (id === col) setDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setCol(id); setDir(id === "nombre" || id === "diasSinActividad" ? "asc" : "desc"); }
    }

    return (
        <div className={s.rank}>
            <div className={s.rankBarra}>
                <label className={s.buscar}>
                    <FaMagnifyingGlass aria-hidden="true" />
                    <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar deportista…" aria-label="Buscar deportista" />
                </label>
                <div className={s.chips} role="group" aria-label="Filtrar por estado">
                    {[["todos", "Todos"], ["activo", "Activos"], ["inactivo", "Inactivos"], ["sin_datos", "Sin datos"]].map(([id, txt]) => (
                        <button key={id} type="button" aria-pressed={estado === id} className={estado === id ? s.chipOn : s.chip} onClick={() => setEstado(id)}>
                            {txt} <span>{cuenta[id]}</span>
                        </button>
                    ))}
                </div>
                <label className={s.ordenMovil}>
                    <span>Ordenar por</span>
                    <select value={`${col}:${dir}`} onChange={(e) => { const [c, d] = e.target.value.split(":"); setCol(c); setDir(d); }}>
                        <option value="promedio:desc">Mejor puntuación</option>
                        <option value="promedio:asc">Menor puntuación</option>
                        <option value="delta:desc">Mayor mejora</option>
                        <option value="delta:asc">Mayor caída</option>
                        <option value="sesiones:desc">Más análisis</option>
                        <option value="cumplimiento:desc">Mejor cumplimiento</option>
                        <option value="asistencia:desc">Mejor asistencia</option>
                        <option value="asistencia:asc">Peor asistencia</option>
                        <option value="diasSinActividad:asc">Actividad reciente</option>
                        <option value="nombre:asc">Nombre (A–Z)</option>
                    </select>
                </label>
            </div>

            <div className={s.tabla} role="table" aria-label="Ranking de deportistas">
                <div className={`${s.fila} ${s.cab}`} role="row">
                    {COLUMNAS.map((c) => (
                        <div key={c.id} role="columnheader" aria-sort={col === c.id ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                            <button type="button" className={col === c.id ? s.thOn : s.th} onClick={() => cambiar(c.id)}>
                                {c.etiqueta}<i aria-hidden="true">{col === c.id ? (dir === "asc" ? "↑" : "↓") : "↕"}</i>
                            </button>
                        </div>
                    ))}
                </div>

                {filas.map((d, i) => (
                    <Link key={d.id} href={`/panel_entrenador/gestion/${d.id}`} className={s.fila} role="row">
                        <div className={s.quien} role="cell">
                            <span className={s.pos}>{i + 1}</span>
                            {d.fotoUrl
                                ? <img className={s.avatar} src={d.fotoUrl} alt="" />
                                : <span className={s.avatar} aria-hidden="true">{iniciales(d)}</span>}
                            <span className={s.quienTxt}>
                                <b>{d.nombre} {d.apellido}</b>
                                <small>
                                    <em className={`${s.estado} ${s[`e_${d.estado}`]}`}>{ESTADOS[d.estado]}</em>
                                    {d.posicion && <span className={s.posicion}>{d.posicion}</span>}
                                </small>
                            </span>
                        </div>
                        <div data-l="Análisis" role="cell" className={s.num}>{d.sesiones}</div>
                        <div data-l="Puntuación" role="cell">
                            {d.promedio != null
                                ? <span className={`${s.nota} ${s[`t_${tono(d.promedio)}`]}`}>{d.promedio}<small>/100</small></span>
                                : <span className={s.sin}>—</span>}
                        </div>
                        <div data-l="Tendencia" role="cell">
                            {d.delta == null ? <span className={s.sin}>—</span>
                                : d.delta === 0 ? <span className={s.sin}>= 0</span>
                                : <span className={d.delta > 0 ? s.sube : s.baja}>{d.delta > 0 ? "▲" : "▼"} {Math.abs(d.delta)}</span>}
                        </div>
                        <div data-l="Rutinas" role="cell">
                            {d.cumplimiento != null ? (
                                <span className={s.cump}>
                                    <span className={s.barra}><span className={s.f_bien} style={{ width: `${d.cumplimiento}%` }} /></span>
                                    <b>{d.cumplimiento}%</b>
                                </span>
                            ) : <span className={s.sin}>Sin rutinas</span>}
                        </div>
                        <div data-l="Asistencia" role="cell">
                            {d.asistencia != null ? (
                                <span className={s.cump} title={`${d.asistio} asistió · ${d.falto} faltó · ${d.justificadas} justificadas`}>
                                    <span className={s.barra}><span className={d.asistencia >= 60 ? s.f_ok : s.f_baja} style={{ width: `${d.asistencia}%` }} /></span>
                                    <b>{d.asistencia}%</b>
                                </span>
                            ) : <span className={s.sin}>{d.eventosConLista ? "Solo justif." : "Sin lista"}</span>}
                        </div>
                        <div data-l="Actividad" role="cell" className={s.act}>{haceCuanto(d.diasSinActividad)}</div>
                    </Link>
                ))}

                {!filas.length && (
                    <div className={s.vacio}><b>Ningún deportista coincide</b>Prueba con otro nombre o quita el filtro.</div>
                )}
            </div>
        </div>
    );
}

// ── Exportar ──────────────────────────────────────────────────

function descargarCsv(datos) {
    const celda = (v) => {
        const t = v == null ? "" : String(v);
        return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const cab = ["Deportista", "Posición", "Nivel", "Análisis", "Puntuación media", "Variación vs. periodo anterior", "Mejor puntuación",
        "Cumplimiento de rutinas (%)", "Ejercicios hechos", "Ejercicios totales",
        "Asistencia (%)", "Asistió", "Faltó", "Justificadas", "Última actividad", "Estado"];
    const filas = datos.ranking.map((d) => [
        `${d.nombre} ${d.apellido}`, d.posicion, d.nivel, d.sesiones, d.promedio, d.delta, d.mejor,
        d.cumplimiento, d.ejerciciosHechos, d.ejerciciosTotales, d.asistencia, d.asistio, d.falto, d.justificadas, d.ultimaActividad ? d.ultimaActividad.slice(0, 10) : "", ESTADOS[d.estado],
    ]);
    // Separador ";" y BOM UTF-8: así Excel en español abre las columnas y las tildes bien
    const texto = "﻿" + [cab, ...filas].map((f) => f.map(celda).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `volleyscan-estadisticas${datos.equipo ? "_" + datos.equipo.nombre.replace(/[^\w-]+/g, "-") : ""}_${datos.periodo.desde}_a_${datos.periodo.hasta}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Página ────────────────────────────────────────────────────

export default function EstadisticasPage() {
    const [dias, setDias] = useState(30);
    const [equipoId, setEquipoId] = useState(null);
    const { datos, estado, refrescando, recargar } = useEstadisticas(dias, equipoId);

    const periodo = PERIODOS.find((p) => p.dias === dias);
    const k = datos?.kpis;

    return (
        <main className={s.wrap} aria-busy={refrescando}>
            <header className={s.head}>
                <div>
                    <h1 className={s.titulo}>Estadísticas</h1>
                    <p className={s.sub}>
                        {datos
                            ? <>Rendimiento {datos.equipo ? <>de <b>{datos.equipo.nombre}</b></> : "de tus deportistas"} en {periodo.largo} · {fechaCorta(datos.periodo.desde)} – {fechaCorta(datos.periodo.hasta)}</>
                            : "Rendimiento de tus deportistas"}
                    </p>
                </div>
                <div className={s.acciones}>
                    {datos?.equipos?.length > 0 && (
                        <label className={s.selEquipo}>
                            <FaUsers aria-hidden="true" />
                            <span className={s.srOnly}>Equipo</span>
                            <select value={equipoId ?? ""} onChange={(e) => setEquipoId(e.target.value ? Number(e.target.value) : null)}>
                                <option value="">Todos mis deportistas</option>
                                {datos.equipos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                            </select>
                        </label>
                    )}
                    <div className={s.periodos} role="radiogroup" aria-label="Periodo">
                        {PERIODOS.map((p) => (
                            <button key={p.dias} type="button" role="radio" aria-checked={dias === p.dias}
                                    className={dias === p.dias ? s.perOn : s.per} onClick={() => setDias(p.dias)}>
                                {p.corto}
                            </button>
                        ))}
                    </div>
                    <button type="button" className={s.btn} disabled={!datos?.ranking.length} onClick={() => descargarCsv(datos)}>
                        <FaFileArrowDown aria-hidden="true" /> <span>Exportar CSV</span>
                    </button>
                    <button type="button" className={s.btnPri} disabled={!datos} onClick={() => window.print()}>
                        <FaPrint aria-hidden="true" /> <span>Imprimir reporte</span>
                    </button>
                </div>
            </header>

            {/* Solo se ve al imprimir */}
            {datos && (
                <div className={s.portada}>
                    <div className={s.portadaMarca}>VolleyScan</div>
                    <h2>Reporte de rendimiento{datos.equipo ? ` · ${datos.equipo.nombre}` : " del equipo"}</h2>
                    <p>
                        {datos.entrenador ? <>Entrenador: <b>{datos.entrenador.nombre} {datos.entrenador.apellido}</b> · </> : null}
                        Periodo: <b>{fechaLarga(datos.periodo.desde)}</b> al <b>{fechaLarga(datos.periodo.hasta)}</b> · Generado el {sello(datos.generado)}
                    </p>
                </div>
            )}

            {estado === "cargando" && (
                <div className={s.esqueleto} aria-label="Cargando estadísticas">
                    <div className={s.skRow}>{[0, 1, 2, 3, 4].map((i) => <span key={i} className={s.sk} style={{ height: 118 }} />)}</div>
                    <span className={s.sk} style={{ height: 320 }} />
                </div>
            )}

            {estado === "error" && (
                <div className={s.error} role="alert">
                    <FaTriangleExclamation aria-hidden="true" />
                    <div><b>No se pudieron cargar las estadísticas</b><p>Revisa tu conexión o que el servidor esté encendido e inténtalo de nuevo.</p></div>
                    <button type="button" className={s.btnPri} onClick={recargar}>Reintentar</button>
                </div>
            )}

            {datos && k && k.deportistas === 0 && datos.equipo && (
                <div className={s.sinEquipo}>
                    <span aria-hidden="true"><FaUsers /></span>
                    <h2>{datos.equipo.nombre} no tiene deportistas vinculados</h2>
                    <p>Aquí solo aparecen los deportistas del equipo con los que tienes vínculo aceptado. Elige otro equipo o invita deportistas.</p>
                    <button type="button" className={s.btnPri} onClick={() => setEquipoId(null)}>Ver todos mis deportistas</button>
                </div>
            )}

            {datos && k && k.deportistas === 0 && !datos.equipo && (
                <div className={s.sinEquipo}>
                    <span aria-hidden="true"><FaUsers /></span>
                    <h2>Aún no tienes deportistas vinculados</h2>
                    <p>Las estadísticas se calculan con los análisis y rutinas de los deportistas que aceptaste. Cuando tengas el primero, verás todo aquí.</p>
                    <Link href="/panel_entrenador/gestion" className={s.btnPri}><FaUserPlus aria-hidden="true" /> Ir a Deportistas</Link>
                </div>
            )}

            {datos && k && k.deportistas > 0 && (
                <div className={refrescando ? s.cargando : ""}>
                    <section className={s.kpis} aria-label="Resumen">
                        <Kpi icono={<FaUsers />} color="var(--blue)" etiqueta="Deportistas activos" valor={k.activos} unidad={`/ ${k.deportistas}`}
                             pie={<span className={`${s.delta} ${s.dNeutro}`}>Con actividad en el periodo</span>} />
                        <Kpi icono={<FaBullseye />} color="var(--teal)" etiqueta="Análisis de IA" valor={k.analisis}
                             pie={<Delta valor={k.analisisDelta} />}
                             extra={<Spark valores={datos.evolucion.map((p) => p.sesiones)} max={1} color="var(--teal)" />} />
                        <Kpi icono={<FaChartLine />} color="var(--green)" etiqueta="Puntuación media" valor={k.puntuacionMedia} unidad="/100"
                             pie={<Delta valor={k.puntuacionDelta} unidad=" pts" />}
                             extra={<Spark valores={datos.evolucion.map((p) => p.promedio)} color="var(--green)" />} />
                        <Kpi icono={<FaClipboardCheck />} color="var(--amber)" etiqueta="Cumplimiento de rutinas" valor={k.cumplimiento} unidad="%"
                             pie={k.ejerciciosTotales
                                 ? <><Delta valor={k.cumplimientoDelta} unidad=" pts" vacio={`${k.ejerciciosHechos} de ${k.ejerciciosTotales} ejercicios`} />
                                     {k.cumplimientoDelta != null && <span className={s.kpiNota}>{k.ejerciciosHechos} de {k.ejerciciosTotales} ejercicios</span>}</>
                                 : <span className={`${s.delta} ${s.dNeutro}`}>Sin rutinas en el periodo</span>} />
                        <Kpi icono={<FaUserCheck />} color="var(--teal)" etiqueta="Asistencia" valor={k.asistencia} unidad="%"
                             pie={k.asistencia != null
                                 ? <><Delta valor={k.asistenciaDelta} unidad=" pts" vacio={`${k.asistenciaPresentes} asistencias`} />
                                     <span className={s.kpiNota}>{k.asistenciaPresentes} asistió · {k.asistenciaAusencias} faltó</span></>
                                 : <span className={`${s.delta} ${s.dNeutro}`}>Sin listas pasadas</span>} />
                        <Kpi icono={<FaEye />} color="var(--orange)" etiqueta="Análisis por revisar" valor={k.porRevisar}
                             pie={<span className={`${s.delta} ${s.dNeutro}`}>{k.porRevisar ? "Esperan tu revisión" : "Estás al día"}</span>} />
                    </section>

                    <div className={s.grid}>
                        <section className={`${s.card} ${s.c8}`}>
                            <div className={s.ct}>
                                <h2 className={s.cardTitulo}>Evolución de la puntuación</h2>
                                <span className={s.tag}>Media de todos tus deportistas</span>
                            </div>
                            <Evolucion puntos={datos.evolucion} media={k.puntuacionMedia} />
                        </section>

                        <section className={`${s.card} ${s.c4}`}>
                            <div className={s.ct}>
                                <h2 className={s.cardTitulo}>Por técnica</h2>
                                <span className={s.tag}>Puntuación media</span>
                            </div>
                            <PorTecnica lista={datos.porTecnica} />
                        </section>

                        <section className={`${s.card} ${s.c12}`}>
                            <div className={s.ct}>
                                <h2 className={s.cardTitulo}>Ranking de deportistas</h2>
                                <span className={s.tag}>{datos.ranking.length} {datos.ranking.length === 1 ? "deportista" : "deportistas"} · toca una fila para abrir su ficha</span>
                            </div>
                            <Ranking lista={datos.ranking} />
                        </section>

                        <section className={`${s.card} ${s.c6}`}>
                            <div className={s.ct}>
                                <h2 className={s.cardTitulo}>Requiere atención</h2>
                                {datos.alertas.length > 0 && <span className={s.contador}>{datos.alertas.length}</span>}
                            </div>
                            <Alertas lista={datos.alertas} />
                        </section>

                        <section className={`${s.card} ${s.c6}`}>
                            <div className={s.ct}>
                                <h2 className={s.cardTitulo}>Errores más frecuentes</h2>
                                <span className={s.tag}>Detectados por la IA</span>
                            </div>
                            <Errores lista={datos.erroresFrecuentes} />
                        </section>
                    </div>
                </div>
            )}
        </main>
    );
}
