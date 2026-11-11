"use client";

/**
 * Registro de rutinas del entrenador.
 *
 *  · Pestaña "Registro": las rutinas que mis deportistas YA COMPLETARON, para observarlas y revisarlas
 *    (calificación 1–5, comentario que ve el deportista y nota privada).
 *  · Pestaña "Niveles": el nivel de cada deportista (principiante → intermedio → avanzado → profesional),
 *    el avance hacia el siguiente según sus revisiones y la decisión de subirlo (o bajarlo), con historial.
 *
 * El sistema SUGIERE; la decisión de cambiar de nivel es siempre del entrenador.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    FaArrowDown, FaArrowTrendUp, FaArrowUp, FaCheck, FaClipboardCheck, FaClock, FaFilter, FaLock, FaRegStar, FaStar, FaXmark,
} from "react-icons/fa6";
import { listarEquipos } from "@/lib/equipos/api";
import {
    NIVELES, NOMBRE_NIVEL, cambiarNivel, detalleRegistro, mensajeDeError, nivelDeDeportista,
    nivelesDeportistas, registroRutinas, revisarRutina,
} from "@/lib/registro/api";
import s from "./registro.module.css";

const fFechaHora = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const fFecha = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });
const cuando = (iso) => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d.getTime()) ? fFechaHora.format(d) : "—"; };
const fecha = (iso) => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d.getTime()) ? fFecha.format(d) : "—"; };
const nombreNivel = (n) => NOMBRE_NIVEL[n] ?? "—";
const cx = (...c) => c.filter(Boolean).join(" ");
const dec = (n) => n.toFixed(1).replace(".", ",");
const ETIQUETA_CAL = { 1: "Muy floja", 2: "Mejorable", 3: "Correcta", 4: "Muy buena", 5: "Excelente" };

function Avatar({ p, grande }) {
    const ini = `${p.nombre?.[0] ?? ""}${p.apellido?.[0] ?? ""}`.toUpperCase();
    const clase = cx(s.avatar, grande && s.avatarG);
    // eslint-disable-next-line @next/next/no-img-element
    return p.fotoUrl ? <img className={clase} src={p.fotoUrl} alt="" /> : <span className={clase} aria-hidden="true">{ini}</span>;
}

function Estrellas({ valor, onCambiar, tam }) {
    return (
        <span className={cx(s.estrellas, tam === "g" && s.estrellasG)} role={onCambiar ? "radiogroup" : "img"} aria-label={valor ? `${valor} de 5` : "Sin calificar"}>
            {[1, 2, 3, 4, 5].map((n) => {
                const Icono = n <= (valor || 0) ? FaStar : FaRegStar;
                return onCambiar ? (
                    <button key={n} type="button" role="radio" aria-checked={valor === n} aria-label={`${n} — ${ETIQUETA_CAL[n]}`}
                        className={cx(s.estrella, n <= (valor || 0) && s.estrellaOn)} onClick={() => onCambiar(n)}><Icono /></button>
                ) : (
                    <Icono key={n} className={n <= (valor || 0) ? s.estrellaOn : s.estrellaOff} aria-hidden="true" />
                );
            })}
        </span>
    );
}

const ChipNivel = ({ nivel }) => <span className={cx(s.chipNivel, s[`niv_${nivel}`])}>{nombreNivel(nivel)}</span>;

/* ───────────── Ventana de revisión ───────────── */
function Revision({ id, onCerrar, onGuardado }) {
    const [d, setD] = useState(null);
    const [error, setError] = useState("");
    const [cal, setCal] = useState(0);
    const [comentario, setComentario] = useState("");
    const [nota, setNota] = useState("");
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        let vivo = true;
        (async () => {
            const r = await detalleRegistro(id);
            if (!vivo) return;
            if (!r.ok) { setError(mensajeDeError(r)); return; }
            setD(r.data);
            setCal(r.data.revision?.calificacion ?? 0);
            setComentario(r.data.revision?.comentario ?? "");
            setNota(r.data.revision?.notaPrivada ?? "");
        })();
        return () => { vivo = false; };
    }, [id]);

    async function guardar() {
        if (!cal) { setError("Elige una calificación de 1 a 5 estrellas."); return; }
        setGuardando(true); setError("");
        const r = await revisarRutina(id, { calificacion: cal, comentario: comentario.trim() || null, notaPrivada: nota.trim() || null });
        setGuardando(false);
        if (!r.ok) { setError(mensajeDeError(r)); return; }
        onGuardado(d.revision ? "Revisión actualizada." : "Rutina revisada. El deportista recibió un aviso.");
    }

    return (
        <div className={s.fondo} onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
            <article className={s.ventana} role="dialog" aria-modal="true" aria-label="Revisar rutina">
                <header className={s.vHead}>
                    <div style={{ minWidth: 0 }}>
                        <p className={s.muted}>{d ? `${d.atleta.nombre} ${d.atleta.apellido} · completada ${cuando(d.completadaEn)}` : "Cargando…"}</p>
                        <h2>{d ? d.nombre : "Rutina"}</h2>
                    </div>
                    <button type="button" className={s.cerrar} onClick={onCerrar} aria-label="Cerrar"><FaXmark /></button>
                </header>

                <div className={s.vCuerpo}>
                    {error && <div className={cx(s.alerta, s.alertaMal)} role="alert">{error}</div>}
                    {!d && !error && <p className={s.estado}>Cargando la rutina…</p>}
                    {d && (
                        <>
                            <div className={s.chips}>
                                {d.tipo && <span className={s.chip}>{d.tipo}</span>}
                                <ChipNivel nivel={d.nivel} />
                                {d.intensidad != null && <span className={s.chip}>Intensidad {d.intensidad}/10</span>}
                                {d.aTiempo === true && <span className={cx(s.chip, s.chipVerde)}>Completada a tiempo</span>}
                                {d.aTiempo === false && <span className={cx(s.chip, s.chipNaranja)}>{d.diasRetraso} {d.diasRetraso === 1 ? "día" : "días"} después de lo programado</span>}
                            </div>
                            {d.objetivo && <p className={s.objetivo}><b>Objetivo:</b> {d.objetivo}</p>}

                            <ol className={s.ejercicios}>
                                {d.listaEjercicios.map((e, i) => (
                                    <li key={i}>
                                        <span className={s.check}><FaCheck aria-hidden="true" /></span>
                                        <span className={s.ejNombre}>{e.nombre}</span>
                                        <span className={s.ejMeta}>{e.series}×{e.repeticiones}</span>
                                        <span className={s.ejHora}><FaClock aria-hidden="true" /> {cuando(e.completadoEn)}</span>
                                    </li>
                                ))}
                            </ol>

                            <section className={s.bloque}>
                                <h3>¿Cómo la hizo?</h3>
                                <div className={s.califFila}>
                                    <Estrellas valor={cal} onCambiar={setCal} tam="g" />
                                    <strong className={s.califTexto}>{cal ? ETIQUETA_CAL[cal] : "Elige una calificación"}</strong>
                                </div>
                                <div className={s.campo}>
                                    <label htmlFor="rv-com">Comentario para el deportista</label>
                                    <textarea id="rv-com" className={s.input} rows={3} maxLength={1000} value={comentario}
                                        onChange={(e) => setComentario(e.target.value)} placeholder="Ej: Buen ritmo. Sube más la altura del brazo en el saque." />
                                    <small className={s.ayuda}>Lo verá en «Mi nivel» y recibirá un aviso.</small>
                                </div>
                                <div className={cx(s.campo, s.privado)}>
                                    <label htmlFor="rv-nota"><FaLock aria-hidden="true" /> Nota privada</label>
                                    <textarea id="rv-nota" className={s.input} rows={2} maxLength={1000} value={nota}
                                        onChange={(e) => setNota(e.target.value)} placeholder="Solo tú la ves. Útil para decidir su nivel." />
                                </div>
                            </section>
                        </>
                    )}
                </div>

                <footer className={s.vPie}>
                    <button type="button" className={s.btn} onClick={onCerrar}>Cancelar</button>
                    <button type="button" className={cx(s.btn, s.btnPrim)} disabled={!d || guardando} onClick={guardar}>
                        {guardando ? "Guardando…" : d?.revision ? "Guardar cambios" : "Guardar revisión"}
                    </button>
                </footer>
            </article>
        </div>
    );
}

/* ───────────── Ventana de nivel ───────────── */
function CambioNivel({ atleta, onCerrar, onGuardado }) {
    const [det, setDet] = useState(null);
    const [nuevo, setNuevo] = useState(atleta.avance.siguiente ?? atleta.nivel);
    const [motivo, setMotivo] = useState(atleta.avance.sugerencia ? "Cumplió los criterios de nivel: rutinas revisadas, calificación y cumplimiento." : "");
    const [error, setError] = useState("");
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        let vivo = true;
        (async () => { const r = await nivelDeDeportista(atleta.id); if (vivo && r.ok) setDet(r.data); })();
        return () => { vivo = false; };
    }, [atleta.id]);

    const sube = NIVELES.indexOf(nuevo) > NIVELES.indexOf(atleta.nivel);
    const baja = NIVELES.indexOf(nuevo) < NIVELES.indexOf(atleta.nivel);

    async function guardar() {
        if (nuevo === atleta.nivel) { setError("Elige un nivel distinto al actual."); return; }
        if (baja && motivo.trim().length < 3) { setError("Para bajar el nivel escribe el motivo."); return; }
        setGuardando(true); setError("");
        const r = await cambiarNivel(atleta.id, { nivel: nuevo, motivo: motivo.trim() || null });
        setGuardando(false);
        if (!r.ok) { setError(mensajeDeError(r)); return; }
        onGuardado(`${atleta.nombre} ahora es ${nombreNivel(nuevo)}. Recibió un aviso.`);
    }

    return (
        <div className={s.fondo} onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
            <article className={cx(s.ventana, s.ventanaMedia)} role="dialog" aria-modal="true" aria-label="Cambiar nivel">
                <header className={s.vHead}>
                    <div style={{ minWidth: 0 }}>
                        <p className={s.muted}>Nivel actual: {nombreNivel(atleta.nivel)}</p>
                        <h2>Nivel de {atleta.nombre} {atleta.apellido}</h2>
                    </div>
                    <button type="button" className={s.cerrar} onClick={onCerrar} aria-label="Cerrar"><FaXmark /></button>
                </header>
                <div className={s.vCuerpo}>
                    {error && <div className={cx(s.alerta, s.alertaMal)} role="alert">{error}</div>}
                    {atleta.avance.sugerencia && (
                        <div className={cx(s.alerta, s.alertaBien)}>Cumple los criterios para subir a <b>{nombreNivel(atleta.avance.siguiente)}</b>. La decisión es tuya.</div>
                    )}
                    <div className={s.escalera} role="radiogroup" aria-label="Nuevo nivel">
                        {NIVELES.map((n) => (
                            <button key={n} type="button" role="radio" aria-checked={nuevo === n}
                                className={cx(s.peldano, s[`niv_${n}`], nuevo === n && s.peldanoOn, atleta.nivel === n && s.peldanoActual)} onClick={() => setNuevo(n)}>
                                <b>{nombreNivel(n)}</b>
                                <small>{atleta.nivel === n ? "Actual" : nuevo === n ? (sube ? "Subir aquí" : "Bajar aquí") : ""}</small>
                            </button>
                        ))}
                    </div>
                    <div className={s.campo}>
                        <label htmlFor="nv-motivo">Motivo {baja ? "(obligatorio al bajar)" : "(recomendado)"}</label>
                        <textarea id="nv-motivo" className={s.input} rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)}
                            placeholder="Qué viste para tomar esta decisión…" />
                        <small className={s.ayuda}>El deportista lo verá junto al aviso y en su historial.</small>
                    </div>
                    <section className={s.bloque}>
                        <h3>Historial de niveles</h3>
                        {!det ? <p className={s.muted}>Cargando…</p> : det.historial.length === 0 ? (
                            <p className={s.muted}>Aún no ha cambiado de nivel desde que lo sigues.</p>
                        ) : (
                            <ul className={s.linea}>
                                {det.historial.map((h, i) => (
                                    <li key={i}>
                                        <span className={cx(s.punto, h.sube ? s.puntoSube : s.puntoBaja)}>{h.sube ? <FaArrowUp /> : <FaArrowDown />}</span>
                                        <div>
                                            <b>{nombreNivel(h.anterior)} → {nombreNivel(h.nuevo)}</b>
                                            <small>{fecha(h.fecha)}{h.entrenador ? ` · ${h.entrenador}` : ""}</small>
                                            {h.motivo && <p>{h.motivo}</p>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
                <footer className={s.vPie}>
                    <button type="button" className={s.btn} onClick={onCerrar}>Cancelar</button>
                    <button type="button" className={cx(s.btn, s.btnPrim)} disabled={guardando || nuevo === atleta.nivel} onClick={guardar}>
                        {guardando ? "Guardando…" : sube ? "Subir de nivel" : baja ? "Bajar de nivel" : "Cambiar nivel"}
                    </button>
                </footer>
            </article>
        </div>
    );
}

/* ───────────── Pestaña Registro ───────────── */
function Registro({ equipo, deportistas, atleta, setAtleta, onRevisar, refresco, estadoInicial }) {
    const [estado, setEstado] = useState(estadoInicial);
    const [desde, setDesde] = useState("");
    const [hasta, setHasta] = useState("");
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let vivo = true;
        (async () => {
            setError("");
            const r = await registroRutinas({ estado, atleta, equipo, desde, hasta });
            if (!vivo) return;
            if (!r.ok) { setError(mensajeDeError(r)); setDatos(null); return; }
            setDatos(r.data);
        })();
        return () => { vivo = false; };
    }, [estado, atleta, equipo, desde, hasta, refresco]);

    const r = datos?.resumen;
    const hayFiltro = Boolean(atleta || desde || hasta);

    return (
        <>
            <div className={s.record}>
                <div className={cx(s.cifra, s.cifraNaranja)}><b>{r ? r.pendientes : "–"}</b><span>Por revisar</span></div>
                <div className={cx(s.cifra, s.cifraVerde)}><b>{r ? r.revisadas : "–"}</b><span>Revisadas</span></div>
                <div className={s.cifra}><b>{r?.calificacionPromedio != null ? dec(r.calificacionPromedio) : "–"}</b><span>Calificación promedio</span></div>
                <div className={s.cifra}><b>{r?.aTiempoPct != null ? `${r.aTiempoPct}%` : "–"}</b><span>Completadas a tiempo</span></div>
            </div>

            <div className={s.filtros}>
                <div className={s.seg} role="tablist" aria-label="Estado">
                    {[["pendientes", "Por revisar"], ["revisadas", "Revisadas"], ["todas", "Todas"]].map(([v, t]) => (
                        <button key={v} type="button" role="tab" aria-selected={estado === v} className={cx(s.segBtn, estado === v && s.segOn)} onClick={() => setEstado(v)}>{t}</button>
                    ))}
                </div>
                <label className={s.selector}><FaFilter aria-hidden="true" />
                    <select value={atleta ?? ""} onChange={(e) => setAtleta(e.target.value || null)} aria-label="Deportista">
                        <option value="">Todos los deportistas</option>
                        {deportistas.map((d) => <option key={d.id} value={d.id}>{d.nombre} {d.apellido}</option>)}
                    </select>
                </label>
                <label className={s.selector}><span>Desde</span><input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} /></label>
                <label className={s.selector}><span>Hasta</span><input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} /></label>
                {hayFiltro && <button type="button" className={cx(s.btn, s.btnMini)} onClick={() => { setAtleta(null); setDesde(""); setHasta(""); }}>Quitar filtros</button>}
            </div>

            {error && <div className={cx(s.alerta, s.alertaMal)} role="alert">{error}</div>}
            {!datos && !error && <p className={s.estado}>Cargando el registro…</p>}

            {datos && datos.items.length === 0 && (
                <div className={s.vacio}>
                    <FaClipboardCheck aria-hidden="true" />
                    <h2>{estado === "pendientes" ? "No tienes rutinas por revisar" : estado === "revisadas" ? "Aún no has revisado rutinas" : "Todavía no hay rutinas completadas"}</h2>
                    <p>{r && r.total === 0 && !hayFiltro
                        ? "Cuando un deportista complete todos los ejercicios de una rutina que le asignaste, aparecerá aquí para que la observes."
                        : "Prueba con otro estado o quita los filtros."}</p>
                </div>
            )}

            {datos && datos.items.length > 0 && (
                <ul className={s.lista}>
                    {datos.items.map((i) => (
                        <li key={i.id}>
                            <article className={cx(s.fila, i.revision ? s.filaOk : s.filaPend)}>
                                <Avatar p={i.atleta} grande />
                                <div className={s.filaCuerpo}>
                                    <p className={s.filaQuien}>{i.atleta.nombre} {i.atleta.apellido} <ChipNivel nivel={i.atleta.nivel} /></p>
                                    <h3 className={s.filaTitulo}>{i.nombre}</h3>
                                    <div className={s.chips}>
                                        {i.tipo && <span className={s.chip}>{i.tipo}</span>}
                                        <span className={cx(s.chip, s.chipSutil)}>Rutina {i.nivel === "todos" ? "para todos los niveles" : `de nivel ${nombreNivel(i.nivel).toLowerCase()}`}</span>
                                        <span className={s.chip}>{i.ejercicios} ejercicios</span>
                                        {i.aTiempo === true && <span className={cx(s.chip, s.chipVerde)}>A tiempo</span>}
                                        {i.aTiempo === false && <span className={cx(s.chip, s.chipNaranja)}>{i.diasRetraso} {i.diasRetraso === 1 ? "día" : "días"} tarde</span>}
                                        <span className={s.muted}>Completada {cuando(i.completadaEn)}</span>
                                    </div>
                                    {i.revision?.comentario && <p className={s.filaComentario}>“{i.revision.comentario}”</p>}
                                </div>
                                <div className={s.filaAccion}>
                                    {i.revision ? (
                                        <>
                                            <Estrellas valor={i.revision.calificacion} />
                                            <button type="button" className={cx(s.btn, s.btnMini)} onClick={() => onRevisar(i.id)}>Editar revisión</button>
                                        </>
                                    ) : (
                                        <button type="button" className={cx(s.btn, s.btnPrim)} onClick={() => onRevisar(i.id)}>Revisar</button>
                                    )}
                                </div>
                            </article>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}

/* ───────────── Pestaña Niveles ───────────── */
function Barra({ c }) {
    const valor = c.valor ?? 0;
    const pct = Math.max(0, Math.min(100, Math.round((valor / c.meta) * 100)));
    return (
        <div className={s.criterio}>
            <div className={s.criterioTop}>
                <span>{c.titulo}</span>
                <b className={c.cumple ? s.okTxt : undefined}>
                    {c.valor == null ? "Sin datos" : c.clave === "calificacion" ? dec(c.valor) : `${c.valor}${c.unidad}`}
                    <small> · meta {c.clave === "calificacion" ? dec(c.meta) : `${c.meta}${c.unidad}`}</small>
                </b>
            </div>
            <div className={s.barra}><i className={c.cumple ? s.barraOk : undefined} style={{ width: `${pct}%` }} /></div>
        </div>
    );
}

function Niveles({ lista, error, onCambiar, onVerRegistro }) {
    const orden = useMemo(() => [...(lista ?? [])].sort((a, b) =>
        Number(Boolean(b.avance.sugerencia)) - Number(Boolean(a.avance.sugerencia)) || b.pendientesRevision - a.pendientesRevision
        || a.nombre.localeCompare(b.nombre)), [lista]);
    const conteo = useMemo(() => Object.fromEntries(NIVELES.map((n) => [n, (lista ?? []).filter((d) => d.nivel === n).length])), [lista]);
    const sugeridos = (lista ?? []).filter((d) => d.avance.sugerencia).length;

    if (error) return <div className={cx(s.alerta, s.alertaMal)} role="alert">{error}</div>;
    if (!lista) return <p className={s.estado}>Cargando niveles…</p>;
    if (lista.length === 0) {
        return (
            <div className={s.vacio}>
                <FaArrowTrendUp aria-hidden="true" />
                <h2>Aún no tienes deportistas</h2>
                <p>Cuando acepten tu vínculo o entren a uno de tus equipos, podrás seguir su nivel desde aquí.</p>
            </div>
        );
    }
    return (
        <>
            <div className={s.distribucion}>
                {NIVELES.map((n) => (
                    <div key={n} className={cx(s.distItem, s[`niv_${n}`])}><b>{conteo[n]}</b><span>{nombreNivel(n)}</span></div>
                ))}
                <div className={cx(s.distItem, s.distSug)}><b>{sugeridos}</b><span>Listos para subir</span></div>
            </div>
            <p className={s.reglas}>
                El sistema sugiere subir de nivel cuando, desde el último cambio (máximo 90 días), el deportista tiene al menos
                5 rutinas revisadas a su nivel o superior, calificación promedio de 4,0 o más y cumple el 80 % de sus rutinas.
            </p>
            <ul className={s.grid}>
                {orden.map((d) => {
                    const a = d.avance;
                    const idx = NIVELES.indexOf(d.nivel);
                    return (
                        <li key={d.id}>
                            <article className={cx(s.tarjeta, a.sugerencia && s.tarjetaSug)}>
                                <header className={s.tHead}>
                                    <Avatar p={d} grande />
                                    <div style={{ minWidth: 0 }}>
                                        <h3>{d.nombre} {d.apellido}</h3>
                                        <p className={s.muted}>{d.ultimoCambio ? `Último cambio: ${fecha(d.ultimoCambio)}` : "Sin cambios de nivel"}</p>
                                    </div>
                                    <ChipNivel nivel={d.nivel} />
                                </header>

                                <ol className={s.pasos} aria-label="Escalera de niveles">
                                    {NIVELES.map((n, i) => (
                                        <li key={n} className={cx(s[`niv_${n}`], i < idx && s.pasoHecho, i === idx && s.pasoActual)}>
                                            <i />
                                            <span>{nombreNivel(n)}</span>
                                        </li>
                                    ))}
                                </ol>

                                {a.siguiente ? (
                                    <div className={s.criterios}>
                                        <p className={s.criteriosTitulo}>Avance hacia {nombreNivel(a.siguiente)}</p>
                                        {a.criterios.map((c) => <Barra key={c.clave} c={c} />)}
                                    </div>
                                ) : (
                                    <p className={s.maximo}>Nivel máximo alcanzado.</p>
                                )}

                                {a.sugerencia && (
                                    <div className={s.sugerencia}><FaArrowTrendUp aria-hidden="true" /> Cumple los criterios: listo para {nombreNivel(a.siguiente)}</div>
                                )}

                                <footer className={s.tPie}>
                                    <button type="button" className={cx(s.btn, s.btnMini)} onClick={() => onVerRegistro(d.id)}>
                                        Ver registro{d.pendientesRevision ? ` · ${d.pendientesRevision} por revisar` : ""}
                                    </button>
                                    <button type="button" className={cx(s.btn, s.btnMini, a.sugerencia ? s.btnPrim : undefined)} onClick={() => onCambiar(d)}>
                                        {a.sugerencia ? `Subir a ${nombreNivel(a.siguiente)}` : "Cambiar nivel"}
                                    </button>
                                </footer>
                            </article>
                        </li>
                    );
                })}
            </ul>
        </>
    );
}

/* ───────────── Página ───────────── */
export default function RegistroRutinas() {
    const [pestana, setPestana] = useState("registro");
    const [estadoIni, setEstadoIni] = useState("pendientes");
    const [equipos, setEquipos] = useState([]);
    const [equipo, setEquipo] = useState("");
    const [atleta, setAtleta] = useState(null);
    const [niveles, setNiveles] = useState(null);
    const [errorNiveles, setErrorNiveles] = useState("");
    const [revisando, setRevisando] = useState(null);
    const [cambiando, setCambiando] = useState(null);
    const [refresco, setRefresco] = useState(0);
    const [aviso, setAviso] = useState("");

    useEffect(() => { (async () => { const r = await listarEquipos(); if (r.ok) setEquipos(r.data); })(); }, []);

    const cargarNiveles = useCallback(async () => {
        setErrorNiveles("");
        const r = await nivelesDeportistas(equipo || null);
        if (!r.ok) { setErrorNiveles(mensajeDeError(r)); setNiveles([]); return; }
        setNiveles(r.data);
    }, [equipo]);
    useEffect(() => { cargarNiveles(); }, [cargarNiveles, refresco]);

    useEffect(() => { if (!aviso) return undefined; const t = setTimeout(() => setAviso(""), 5000); return () => clearTimeout(t); }, [aviso]);

    const pendientesTotal = useMemo(() => (niveles ?? []).reduce((n, d) => n + d.pendientesRevision, 0), [niveles]);
    const sugeridos = (niveles ?? []).filter((d) => d.avance.sugerencia).length;

    function terminado(msg) {
        setRevisando(null); setCambiando(null); setAviso(msg); setRefresco((n) => n + 1);
    }

    return (
        <main className={s.page}>
            <header className={s.head}>
                <div>
                    <p className={s.eyebrow}>Seguimiento</p>
                    <h1>Registro de rutinas</h1>
                    <p>Observa las rutinas que tus deportistas ya completaron y decide cuándo suben de nivel.</p>
                </div>
                <div className={s.acciones}>
                    {equipos.length > 0 && (
                        <label className={s.selector}>
                            <select value={equipo} onChange={(e) => { setEquipo(e.target.value); setAtleta(null); }} aria-label="Equipo">
                                <option value="">Todos mis equipos</option>
                                {equipos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                            </select>
                        </label>
                    )}
                </div>
            </header>

            <div className={s.tabs} role="tablist">
                <button type="button" role="tab" aria-selected={pestana === "registro"} className={cx(s.tab, pestana === "registro" && s.tabOn)} onClick={() => { setEstadoIni("pendientes"); setPestana("registro"); }}>
                    Registro {pendientesTotal > 0 && <em>{pendientesTotal}</em>}
                </button>
                <button type="button" role="tab" aria-selected={pestana === "niveles"} className={cx(s.tab, pestana === "niveles" && s.tabOn)} onClick={() => setPestana("niveles")}>
                    Niveles {sugeridos > 0 && <em className={s.emVerde}>{sugeridos}</em>}
                </button>
            </div>

            {aviso && <div className={cx(s.alerta, s.alertaBien)} role="status">{aviso}</div>}

            {pestana === "registro" ? (
                <Registro equipo={equipo || null} deportistas={niveles ?? []} atleta={atleta} setAtleta={setAtleta} onRevisar={setRevisando} refresco={refresco} estadoInicial={estadoIni} />
            ) : (
                <Niveles lista={niveles} error={errorNiveles} onCambiar={setCambiando}
                    onVerRegistro={(id) => { setAtleta(String(id)); setEstadoIni("todas"); setPestana("registro"); }} />
            )}

            {revisando && <Revision id={revisando} onCerrar={() => setRevisando(null)} onGuardado={terminado} />}
            {cambiando && <CambioNivel atleta={cambiando} onCerrar={() => setCambiando(null)} onGuardado={terminado} />}
        </main>
    );
}
