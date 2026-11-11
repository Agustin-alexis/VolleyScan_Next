"use client";

/**
 * Partidos del entrenador: récord, lista por equipo, detalle con estadísticas por jugador y
 * formulario para registrar / editar un partido (resultado por sets + cifras de cada jugador).
 *
 * Atajo desde el Horario: /panel_entrenador/partidos?nuevo=1&equipo=ID&horario=ID abre el formulario
 * ya ligado a ese evento de Competencia.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { FaFilter, FaPlus, FaTrophy, FaXmark } from "react-icons/fa6";
import { listarEquipos } from "@/lib/equipos/api";
import {
    CAMPOS_STAT, borrarPartido, crearPartido, detallePartido, editarPartido,
    listarPartidos, mensajeDeError, plantillaPartido,
} from "@/lib/partidos/api";
import s from "./partidos.module.css";

const fFecha = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });
const fecha = (iso) => {
    const d = iso ? new Date(`${iso}T00:00:00`) : null;
    return d && !Number.isNaN(d.getTime()) ? fFecha.format(d) : "—";
};
const hoyISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const pct = (b, m) => (b + m ? `${Math.round((100 * b) / (b + m))}%` : "—");
const num = (v) => (v === "" || v == null ? 0 : Number(v) || 0);
const puntosDe = (f) => num(f.ataquesExitosos) + num(f.bloqueos) + num(f.saquesExitosos);

function Avatar({ j }) {
    const ini = `${j.nombre?.[0] ?? ""}${j.apellido?.[0] ?? ""}`.toUpperCase();
    // eslint-disable-next-line @next/next/no-img-element
    return j.fotoUrl ? <img className={s.avatar} src={j.fotoUrl} alt="" /> : <span className={s.avatar} aria-hidden="true">{ini}</span>;
}

/* ───────────── Detalle ───────────── */
function Detalle({ partido, onCerrar, onEditar, onBorrar, ocupado }) {
    const t = partido.totales;
    return (
        <div className={s.fondo} onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
            <article className={s.ventana} role="dialog" aria-modal="true" aria-label="Detalle del partido">
                <header className={s.vHead}>
                    <div>
                        <p className={s.muted}>{partido.equipo} · {fecha(partido.fecha)}{partido.ubicacion ? ` · ${partido.ubicacion}` : ""}</p>
                        <h2>{partido.resultado === "victoria" ? "Victoria" : "Derrota"} {partido.setsGanados}–{partido.setsPerdidos} vs {partido.rival}</h2>
                    </div>
                    <button type="button" className={s.cerrar} onClick={onCerrar} aria-label="Cerrar"><FaXmark /></button>
                </header>
                <div className={s.vCuerpo}>
                    {partido.notas && (
                        <div className={s.notaPriv}>
                            <h4>Notas del entrenador · privadas</h4>
                            <p>{partido.notas}</p>
                        </div>
                    )}
                    {partido.jugadores.length === 0 ? (
                        <p className={s.muted}>Este partido se registró solo con el resultado, sin estadísticas por jugador.</p>
                    ) : (
                        <div className={s.tablaWrap}>
                            <table className={s.tabla}>
                                <thead>
                                    <tr>
                                        <th>Jugador</th><th>Pts</th><th>Ataque +/−</th><th>% Ataque</th><th>Bloq.</th><th>Aces</th>
                                        <th>Saque ✗</th><th>Recep. +/−</th><th>% Recep.</th><th>Errores</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {partido.jugadores.map((j) => (
                                        <tr key={j.deportistaId}>
                                            <td><div className={s.jugador}><Avatar j={j} /><div style={{ minWidth: 0 }}><b>{j.nombre} {j.apellido}</b>{j.numeroCamiseta != null && <small> #{j.numeroCamiseta}</small>}</div></div></td>
                                            <td className={s.punto}>{j.puntosTotales}</td>
                                            <td>{j.ataquesExitosos}/{j.ataquesFallidos}</td>
                                            <td className={s.pct}>{j.efectividadAtaque != null ? `${j.efectividadAtaque}%` : "—"}</td>
                                            <td>{j.bloqueos}</td>
                                            <td>{j.saquesExitosos}</td>
                                            <td>{j.saquesFallidos}</td>
                                            <td>{j.recepcionesExitosas}/{j.recepcionesFalladas}</td>
                                            <td className={s.pct}>{j.efectividadRecepcion != null ? `${j.efectividadRecepcion}%` : "—"}</td>
                                            <td>{j.erroresNoForzados}</td>
                                        </tr>
                                    ))}
                                    <tr className={s.total}>
                                        <td>Equipo</td><td>{t.puntosTotales}</td><td>{t.ataquesExitosos}/{t.ataquesFallidos}</td>
                                        <td>{t.efectividadAtaque != null ? `${t.efectividadAtaque}%` : "—"}</td><td>{t.bloqueos}</td><td>{t.saquesExitosos}</td>
                                        <td>{t.saquesFallidos}</td><td>{t.recepcionesExitosas}/{t.recepcionesFalladas}</td>
                                        <td>{t.efectividadRecepcion != null ? `${t.efectividadRecepcion}%` : "—"}</td><td>{t.erroresNoForzados}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                    {partido.jugadores.some((j) => j.observacion) && (
                        <div className={s.obsLista}>
                            <h4>Observaciones para los jugadores · ellos las ven</h4>
                            <ul>
                                {partido.jugadores.filter((j) => j.observacion).map((j) => (
                                    <li key={j.deportistaId}><b>{j.nombre} {j.apellido}</b><p>{j.observacion}</p></li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                <footer className={s.vPie}>
                    <button type="button" className={`${s.btn} ${s.btnPeligro} ${s.izq}`} disabled={ocupado} onClick={onBorrar}>Eliminar</button>
                    <button type="button" className={s.btn} onClick={onCerrar}>Cerrar</button>
                    <button type="button" className={`${s.btn} ${s.btnPrim}`} disabled={ocupado} onClick={onEditar}>Editar</button>
                </footer>
            </article>
        </div>
    );
}

/* ───────────── Formulario ───────────── */
const filaVacia = () => Object.fromEntries(CAMPOS_STAT.map((c) => [c.k, 0]));

function Formulario({ equipos, inicial, onCerrar, onGuardado }) {
    const editando = Boolean(inicial?.id);
    const [equipoId, setEquipoId] = useState(inicial?.equipoId ?? equipos[0]?.id ?? "");
    const [plantilla, setPlantilla] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [guardando, setGuardando] = useState(false);
    const [f, setF] = useState({
        rival: inicial?.rival ?? "", fecha: inicial?.fecha ?? hoyISO(), setsGanados: inicial?.setsGanados ?? 3, setsPerdidos: inicial?.setsPerdidos ?? 0,
        ubicacion: inicial?.ubicacion ?? "", notas: inicial?.notas ?? "", horarioId: inicial?.horarioId ?? "",
    });
    // filas: { [deportistaId]: { juega, ...cifras } }
    const [filas, setFilas] = useState({});

    // Jugadores del equipo (y, al editar, los que ya tenían cifras aunque hayan salido del equipo)
    useEffect(() => {
        let vivo = true;
        (async () => {
            if (!equipoId) return;
            setCargando(true);
            const r = await plantillaPartido(equipoId);
            if (!vivo) return;
            if (!r.ok) { setError(mensajeDeError(r)); setCargando(false); return; }
            setPlantilla(r.data);
            const base = {};
            for (const j of r.data.jugadores) base[j.id] = { juega: false, ...filaVacia(), minutosJugados: "", observacion: "" };
            for (const j of inicial?.jugadores ?? []) {
                base[j.deportistaId] = {
                    juega: true, ...Object.fromEntries(CAMPOS_STAT.map((c) => [c.k, j[c.k]])), minutosJugados: j.minutosJugados ?? "", observacion: j.observacion ?? "",
                    _extra: !r.data.jugadores.some((x) => x.id === j.deportistaId) ? j : null,
                };
            }
            setFilas(base);
            setCargando(false);
        })();
        return () => { vivo = false; };
    }, [equipoId, inicial]);

    // Llegaste desde el Horario con un evento: se rellenan fecha, lugar y rival una sola vez
    useEffect(() => {
        if (plantilla && !editando && f.horarioId && !f.rival) elegirEvento(f.horarioId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plantilla]);

    const roster = useMemo(() => {
        if (!plantilla) return [];
        const extra = Object.entries(filas).filter(([, v]) => v._extra).map(([id, v]) => ({
            id: Number(id), nombre: v._extra.nombre, apellido: v._extra.apellido, fotoUrl: v._extra.fotoUrl, numeroCamiseta: v._extra.numeroCamiseta,
        }));
        return [...plantilla.jugadores, ...extra];
    }, [plantilla, filas]);

    const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
    const celda = (id, k, v) => setFilas((x) => ({ ...x, [id]: { ...x[id], [k]: v === "" ? "" : Math.max(0, Math.min(999, Math.trunc(Number(v)) || 0)) } }));
    const observar = (id, v) => setFilas((x) => ({ ...x, [id]: { ...x[id], observacion: v } }));
    const alternar = (id) => setFilas((x) => ({ ...x, [id]: { ...x[id], juega: !x[id].juega } }));

    function elegirEvento(id) {
        set("horarioId", id);
        const ev = plantilla?.eventos.find((e) => String(e.id) === String(id));
        if (ev) setF((x) => ({ ...x, horarioId: id, fecha: ev.fecha, ubicacion: x.ubicacion || ev.ubicacion || "", rival: x.rival || ev.titulo.replace(/^(vs\.?|contra)\s+/i, "") }));
    }

    const jugando = roster.filter((j) => filas[j.id]?.juega);
    const totales = useMemo(() => {
        const t = Object.fromEntries(CAMPOS_STAT.map((c) => [c.k, 0]));
        let pts = 0;
        for (const j of jugando) { const fila = filas[j.id]; for (const c of CAMPOS_STAT) t[c.k] += num(fila[c.k]); pts += puntosDe(fila); }
        return { ...t, pts };
    }, [jugando, filas]);

    async function guardar() {
        setError("");
        const g = Number(f.setsGanados), p = Number(f.setsPerdidos);
        if (!f.rival.trim()) return setError("Escribe el nombre del rival.");
        if (g === p) return setError("El resultado no puede quedar empatado.");
        if (Math.max(g, p) < 2) return setError("Quien gana el partido necesita al menos 2 sets.");
        setGuardando(true);
        const cuerpo = {
            equipoId: Number(equipoId), rival: f.rival.trim(), fecha: f.fecha, setsGanados: g, setsPerdidos: p,
            ubicacion: f.ubicacion.trim(), notas: f.notas.trim(), horarioId: f.horarioId || null,
            jugadores: jugando.map((j) => ({ deportistaId: j.id, ...Object.fromEntries(CAMPOS_STAT.map((c) => [c.k, num(filas[j.id][c.k])])), minutosJugados: filas[j.id].minutosJugados === "" ? null : num(filas[j.id].minutosJugados), observacion: filas[j.id].observacion.trim() || null })),
        };
        const r = editando ? await editarPartido(inicial.id, cuerpo) : await crearPartido(cuerpo);
        setGuardando(false);
        if (!r.ok) return setError(mensajeDeError(r));
        onGuardado(editando ? "Partido actualizado." : jugando.length ? `Partido registrado. Avisamos a ${jugando.length} jugador${jugando.length === 1 ? "" : "es"}.` : "Partido registrado.");
    }

    return (
        <div className={s.fondo} onMouseDown={(e) => e.target === e.currentTarget && !guardando && onCerrar()}>
            <article className={s.ventana} role="dialog" aria-modal="true" aria-label={editando ? "Editar partido" : "Registrar partido"}>
                <header className={s.vHead}>
                    <div>
                        <p className={s.muted}>{editando ? "Editar partido" : "Nuevo partido"}</p>
                        <h2>{editando ? `vs ${inicial.rival}` : "Registrar resultado y estadísticas"}</h2>
                    </div>
                    <button type="button" className={s.cerrar} onClick={onCerrar} aria-label="Cerrar"><FaXmark /></button>
                </header>
                <div className={s.vCuerpo}>
                    {error && <p className={`${s.alerta} ${s.alertaMal}`} role="alert">{error}</p>}
                    <div className={s.campos}>
                        <div className={`${s.campo} ${s.ancho2}`}>
                            <label htmlFor="p-equipo">Equipo</label>
                            <select id="p-equipo" className={s.input} value={equipoId} disabled={editando} onChange={(e) => { setEquipoId(Number(e.target.value)); set("horarioId", ""); }}>
                                {equipos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                            </select>
                        </div>
                        <div className={`${s.campo} ${s.ancho2}`}>
                            <label htmlFor="p-evento">Evento del Horario (opcional)</label>
                            <select id="p-evento" className={s.input} value={f.horarioId} onChange={(e) => elegirEvento(e.target.value)}>
                                <option value="">Sin ligar a un evento</option>
                                {inicial?.horarioId && !plantilla?.eventos.some((e) => e.id === inicial.horarioId) && <option value={inicial.horarioId}>Evento actual</option>}
                                {plantilla?.eventos.map((e) => <option key={e.id} value={e.id}>{e.titulo} · {fecha(e.fecha)}</option>)}
                            </select>
                        </div>
                        <div className={`${s.campo} ${s.ancho2}`}>
                            <label htmlFor="p-rival">Rival</label>
                            <input id="p-rival" className={s.input} maxLength={150} value={f.rival} onChange={(e) => set("rival", e.target.value)} placeholder="Nombre del equipo rival" />
                        </div>
                        <div className={s.campo}>
                            <label htmlFor="p-fecha">Fecha</label>
                            <input id="p-fecha" type="date" className={s.input} max={hoyISO()} value={f.fecha} onChange={(e) => set("fecha", e.target.value)} />
                        </div>
                        <div className={s.campo}>
                            <label>Sets (nosotros – rival)</label>
                            <div className={s.sets}>
                                <input className={s.input} type="number" min={0} max={3} aria-label="Sets ganados" value={f.setsGanados} onChange={(e) => set("setsGanados", e.target.value)} />
                                <span>–</span>
                                <input className={s.input} type="number" min={0} max={3} aria-label="Sets perdidos" value={f.setsPerdidos} onChange={(e) => set("setsPerdidos", e.target.value)} />
                            </div>
                        </div>
                        <div className={`${s.campo} ${s.ancho4}`}>
                            <label htmlFor="p-lugar">Lugar</label>
                            <input id="p-lugar" className={s.input} maxLength={150} value={f.ubicacion} onChange={(e) => set("ubicacion", e.target.value)} placeholder="Cancha o coliseo" />
                        </div>
                    </div>

                    <section>
                        <p className={s.ayudaTabla} style={{ marginBottom: 8 }}>
                            Marca a quienes jugaron y escribe sus cifras. Los <b>puntos</b> se calculan solos (ataques + bloqueos + aces). Cada jugador recibe un aviso y verá solo <b>sus</b> cifras y la <b>observación</b> que le dejes.
                        </p>
                        {cargando ? <p className={s.estado}>Cargando jugadores…</p> : roster.length === 0 ? (
                            <p className={`${s.alerta} ${s.alertaMal}`}>Este equipo no tiene deportistas activos. Puedes guardar solo el resultado.</p>
                        ) : (
                            <div className={s.tablaWrap}>
                                <table className={s.tabla}>
                                    <thead>
                                        <tr>
                                            <th>Jugador</th><th>Jugó</th>
                                            {CAMPOS_STAT.map((c) => <th key={c.k} title={c.ayuda}>{c.t}</th>)}
                                            <th title="Ataques exitosos + bloqueos + aces">Pts</th><th>Min</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {roster.map((j) => {
                                            const fila = filas[j.id]; if (!fila) return null;
                                            return (
                                                <Fragment key={j.id}>
                                                <tr className={`${s.fila} ${fila.juega ? "" : s.fuera}`}>
                                                    <td><div className={s.jugador}><Avatar j={j} /><div style={{ minWidth: 0 }}><b>{j.nombre} {j.apellido}</b>{j.numeroCamiseta != null && <small> #{j.numeroCamiseta}</small>}</div></div></td>
                                                    <td><input type="checkbox" className={s.juega} checked={fila.juega} onChange={() => alternar(j.id)} aria-label={`${j.nombre} jugó`} /></td>
                                                    {CAMPOS_STAT.map((c) => (
                                                        <td key={c.k}><input className={s.celda} type="number" min={0} max={999} inputMode="numeric" disabled={!fila.juega} value={fila[c.k]} onChange={(e) => celda(j.id, c.k, e.target.value)} aria-label={`${c.t} de ${j.nombre}`} /></td>
                                                    ))}
                                                    <td className={s.punto}>{fila.juega ? puntosDe(fila) : "—"}</td>
                                                    <td><input className={s.celda} type="number" min={0} max={300} inputMode="numeric" disabled={!fila.juega} value={fila.minutosJugados} onChange={(e) => celda(j.id, "minutosJugados", e.target.value)} aria-label={`Minutos de ${j.nombre}`} /></td>
                                                </tr>
                                                {fila.juega && (
                                                    <tr className={s.filaObs}>
                                                        <td colSpan={CAMPOS_STAT.length + 4}>
                                                            <label className={s.obs}>
                                                                <span>Observación para {j.nombre} <em>· la verá {j.nombre}</em></span>
                                                                <input className={s.input} maxLength={600} value={fila.observacion} onChange={(e) => observar(j.id, e.target.value)}
                                                                    placeholder="Qué mejorar. Ej: baja el contacto en la recepción y no cruces el pie al sacar." />
                                                            </label>
                                                        </td>
                                                    </tr>
                                                )}
                                                </Fragment>
                                            );
                                        })}
                                        <tr className={s.total}>
                                            <td>Equipo ({jugando.length})</td><td />
                                            {CAMPOS_STAT.map((c) => <td key={c.k}>{totales[c.k]}</td>)}
                                            <td>{totales.pts}</td><td />
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <div className={s.campo}>
                        <label htmlFor="p-notas">Notas del entrenador (privadas)</label>
                        <textarea id="p-notas" className={s.input} maxLength={2000} value={f.notas} onChange={(e) => set("notas", e.target.value)} placeholder="Qué funcionó, qué corregir… Los deportistas no ven esto. Para decirle algo a un jugador usa su campo «Observación»." />
                    </div>
                </div>
                <footer className={s.vPie}>
                    <button type="button" className={s.btn} disabled={guardando} onClick={onCerrar}>Cancelar</button>
                    <button type="button" className={`${s.btn} ${s.btnPrim}`} disabled={guardando || cargando} onClick={guardar}>{guardando ? "Guardando…" : editando ? "Guardar cambios" : "Registrar partido"}</button>
                </footer>
            </article>
        </div>
    );
}

/* ───────────── Página ───────────── */
export default function PartidosPage() {
    const [estado, setEstado] = useState("cargando");
    const [error, setError] = useState("");
    const [aviso, setAviso] = useState("");
    const [equipos, setEquipos] = useState([]);
    const [equipoId, setEquipoId] = useState(null);
    const [datos, setDatos] = useState(null);
    const [detalle, setDetalle] = useState(null);
    const [form, setForm] = useState(null); // null | {} (nuevo) | partido (editar)
    const [ocupado, setOcupado] = useState(false);

    const cargar = useCallback(async () => {
        const r = await listarPartidos(equipoId);
        if (!r.ok) { setError(mensajeDeError(r)); setEstado("error"); return; }
        setDatos(r.data); setError(""); setEstado("listo");
    }, [equipoId]);

    useEffect(() => { cargar(); }, [cargar]);
    useEffect(() => { (async () => { const r = await listarEquipos(); if (r.ok) setEquipos(r.data); })(); }, []);

    // Atajo desde el Horario: ?nuevo=1&equipo=ID&horario=ID
    useEffect(() => {
        const q = new URLSearchParams(window.location.search);
        if (q.get("nuevo") === "1") {
            setForm({ equipoId: Number(q.get("equipo")) || undefined, horarioId: Number(q.get("horario")) || "" });
            window.history.replaceState(null, "", window.location.pathname);
        }
    }, []);

    async function abrir(id) {
        const r = await detallePartido(id);
        if (!r.ok) return setError(mensajeDeError(r));
        setDetalle(r.data);
    }
    async function editar() {
        setForm(detalle); setDetalle(null);
    }
    async function borrar() {
        if (!window.confirm(`¿Eliminar el partido contra ${detalle.rival}? Se borran también las estadísticas de los jugadores.`)) return;
        setOcupado(true);
        const r = await borrarPartido(detalle.id);
        setOcupado(false);
        if (!r.ok) return setError(mensajeDeError(r));
        setDetalle(null); setAviso("Partido eliminado."); cargar();
    }

    const resumen = datos?.resumen;
    return (
        <div className={s.page}>
            <header className={s.head}>
                <div>
                    <p className={s.eyebrow}>Competencia</p>
                    <h1>Partidos</h1>
                    <p>Registra el resultado y las estadísticas de cada jugador. Ellos reciben un aviso y ven solo sus propias cifras.</p>
                </div>
                <div className={s.acciones}>
                    {equipos.length > 1 && (
                        <label className={s.selector}>
                            <FaFilter aria-hidden="true" />
                            <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Equipo</span>
                            <select value={equipoId ?? ""} onChange={(e) => setEquipoId(e.target.value ? Number(e.target.value) : null)}>
                                <option value="">Todos mis equipos</option>
                                {equipos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                            </select>
                        </label>
                    )}
                    <button type="button" className={`${s.btn} ${s.btnPrim}`} disabled={equipos.length === 0} onClick={() => setForm({})}><FaPlus aria-hidden="true" /> Registrar partido</button>
                </div>
            </header>

            {aviso && <p className={`${s.alerta} ${s.alertaBien}`} role="status">{aviso}</p>}
            {error && <p className={`${s.alerta} ${s.alertaMal}`} role="alert">{error}</p>}
            {estado === "cargando" && <p className={s.estado}>Cargando partidos…</p>}

            {estado === "listo" && resumen && (
                <>
                    {resumen.jugados > 0 && (
                        <section className={s.record} aria-label="Resumen de la temporada">
                            <div className={s.cifra}><b>{resumen.jugados}</b><span>Partidos</span></div>
                            <div className={`${s.cifra} ${s.cifraVerde}`}><b>{resumen.ganados}</b><span>Victorias</span></div>
                            <div className={`${s.cifra} ${s.cifraNaranja}`}><b>{resumen.perdidos}</b><span>Derrotas</span></div>
                            <div className={s.cifra}><b>{resumen.porcentajeVictorias}%</b><span>Sets {resumen.setsGanados}–{resumen.setsPerdidos}</span></div>
                        </section>
                    )}
                    {datos.partidos.length === 0 ? (
                        <div className={s.vacio}>
                            <FaTrophy style={{ fontSize: "1.8rem", color: "#60a5fa", marginBottom: 10 }} aria-hidden="true" />
                            <h2>Aún no hay partidos registrados</h2>
                            <p>{equipos.length === 0 ? "Primero crea un equipo y añade deportistas." : "Registra el primero para empezar a ver el récord del equipo y el rendimiento de cada jugador."}</p>
                            {equipos.length > 0 && <button type="button" className={`${s.btn} ${s.btnPrim}`} onClick={() => setForm({})}>Registrar partido</button>}
                        </div>
                    ) : (
                        <ul className={s.lista}>
                            {datos.partidos.map((p) => (
                                <li key={p.id}>
                                    <button type="button" className={`${s.partido} ${p.resultado === "derrota" ? s.derrota : ""}`} onClick={() => abrir(p.id)}>
                                        <span className={s.marcador}><b>{p.setsGanados}–{p.setsPerdidos}</b><small>{p.resultado === "victoria" ? "Victoria" : "Derrota"}</small></span>
                                        <span style={{ minWidth: 0 }}>
                                            <span className={s.pTitulo} style={{ display: "block" }}>vs {p.rival}</span>
                                            <span className={s.pMeta}>
                                                <span>{fecha(p.fecha)}</span>
                                                {p.ubicacion && <span>{p.ubicacion}</span>}
                                                <span className={`${s.chip} ${s.chipAzul}`}>{p.equipo}</span>
                                                <span className={s.chip}>{p.jugadores} jugador{p.jugadores === 1 ? "" : "es"}</span>
                                            </span>
                                        </span>
                                        <span className={s.pPuntos}><b>{p.puntosEquipo}</b><span>puntos</span></span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}

            {detalle && <Detalle partido={detalle} ocupado={ocupado} onCerrar={() => setDetalle(null)} onEditar={editar} onBorrar={borrar} />}
            {form && (
                <Formulario
                    equipos={equipos} inicial={form.id ? form : (form.equipoId || form.horarioId ? form : null)}
                    onCerrar={() => setForm(null)}
                    onGuardado={(msg) => { setForm(null); setAviso(msg); cargar(); }}
                />
            )}
        </div>
    );
}
