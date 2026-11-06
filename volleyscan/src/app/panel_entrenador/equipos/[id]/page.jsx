"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
    archivarEquipo,
    detalleEquipo,
    editarDeportistaEquipo,
    editarEquipo,
    invitar,
    mensajeDeError,
    quitarDeportistaEquipo,
    quitarEntrenadorEquipo,
    reenviarInvitacion,
    revocarInvitacion,
} from "@/lib/equipos/api";
import s from "../equipos.module.css";

const fFecha = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });
const fecha = (iso) => {
    const d = iso ? new Date(iso) : null;
    return d && !Number.isNaN(d.getTime()) ? fFecha.format(d) : "—";
};
const NOMBRE_NIVEL = { principiante: "Principiante", intermedio: "Intermedio", avanzado: "Avanzado", profesional: "Profesional" };

function Avatar({ p, size = 44 }) {
    const [falla, setFalla] = useState(false);
    const iniciales = `${p.nombre?.[0] ?? ""}${p.apellido?.[0] ?? ""}`.toUpperCase();
    if (p.fotoUrl && !falla) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img className={s.avatar} style={{ width: size, height: size }} src={p.fotoUrl} alt="" onError={() => setFalla(true)} />;
    }
    return (
        <span className={`${s.avatar} ${s.avatarIni}`} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
            {iniciales}
        </span>
    );
}

/** Enlace listo para copiar (se muestra al crear o reenviar: el sistema no guarda el enlace, solo su huella). */
function CajaEnlace({ resultado }) {
    const [copiado, setCopiado] = useState(false);
    async function copiar() {
        try {
            await navigator.clipboard.writeText(resultado.enlace);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch {
            document.getElementById("caja-enlace")?.select();
        }
    }
    return (
        <div className={`${s.enlace} ${resultado.emailEnviado ? "" : s.enlaceMal}`} role="status">
            <strong>
                {resultado.emailEnviado
                    ? `✓ Correo enviado a ${resultado.email}`
                    : `No se pudo enviar el correo a ${resultado.email}. Copia el enlace y mándaselo por WhatsApp o donde prefieras.`}
            </strong>
            <span className={s.muted}>El enlace funciona 7 días, solo con la cuenta de ese correo.</span>
            <div className={s.enlaceFila}>
                <input id="caja-enlace" className={s.input} readOnly value={resultado.enlace} onFocus={(e) => e.target.select()} />
                <button type="button" className={`${s.btn} ${s.btnMini}`} onClick={copiar}>{copiado ? "¡Copiado!" : "Copiar"}</button>
            </div>
        </div>
    );
}

function FilaDeportista({ d, equipoId, onCambio, onError }) {
    const [pos, setPos] = useState(d.posicion ?? "");
    const [num, setNum] = useState(d.numeroCamiseta ?? "");
    const [guardando, setGuardando] = useState(false);
    const sucio = (pos || "") !== (d.posicion ?? "") || String(num) !== String(d.numeroCamiseta ?? "");

    async function guardar() {
        setGuardando(true);
        const r = await editarDeportistaEquipo(equipoId, d.id, { posicion: pos, numeroCamiseta: num === "" ? null : num });
        setGuardando(false);
        if (!r.ok) return onError(mensajeDeError(r));
        onCambio();
    }
    async function quitar() {
        if (!window.confirm(`¿Sacar a ${d.nombre} ${d.apellido} del equipo?`)) return;
        const r = await quitarDeportistaEquipo(equipoId, d.id);
        if (!r.ok) return onError(mensajeDeError(r));
        onCambio(`${d.nombre} salió del equipo.`);
    }

    return (
        <li className={s.fila}>
            <div className={s.persona}>
                <Avatar p={d} />
                <div>
                    <strong>{d.nombre} {d.apellido}</strong>
                    <span className={s.muted}>{NOMBRE_NIVEL[d.nivel] ?? "—"} · desde {fecha(d.desde)}</span>
                </div>
            </div>
            <div className={s.celda}>
                <label htmlFor={`pos-${d.id}`}>Posición</label>
                <input id={`pos-${d.id}`} className={`${s.input} ${s.inputMini}`} value={pos} maxLength={50} placeholder="Ej. Punta"
                    onChange={(e) => setPos(e.target.value)} />
            </div>
            <div className={s.celda}>
                <label htmlFor={`num-${d.id}`}>N.º</label>
                <input id={`num-${d.id}`} className={`${s.input} ${s.inputMini}`} type="number" min={0} max={99} value={num} placeholder="—"
                    onChange={(e) => setNum(e.target.value)} />
            </div>
            <div className={s.acciones}>
                {sucio && <button className={`${s.btn} ${s.btnPrim} ${s.btnMini}`} disabled={guardando} onClick={guardar}>{guardando ? "…" : "Guardar"}</button>}
                <Link className={`${s.btn} ${s.btnMini}`} href={`/panel_entrenador/gestion/${d.id}`}>Ficha</Link>
                <button className={`${s.btn} ${s.btnPeligro} ${s.btnMini}`} onClick={quitar}>Sacar</button>
            </div>
        </li>
    );
}

export default function EquipoPage() {
    const { id } = useParams();
    const router = useRouter();
    const [estado, setEstado] = useState("cargando");
    const [equipo, setEquipo] = useState(null);
    const [error, setError] = useState("");
    const [aviso, setAviso] = useState("");
    const [tipo, setTipo] = useState("deportista");
    const [email, setEmail] = useState("");
    const [ocupado, setOcupado] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [editando, setEditando] = useState(false);
    const [form, setForm] = useState({ nombre: "", categoria: "", temporada: "" });

    const cargar = useCallback(async () => {
        const r = await detalleEquipo(id);
        if (!r.ok) {
            setError(mensajeDeError(r));
            setEstado(r.status === 404 ? "noexiste" : "error");
            return;
        }
        setEquipo(r.data);
        setEstado("listo");
    }, [id]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const tras = (mensaje) => {
        setError("");
        if (typeof mensaje === "string") setAviso(mensaje);
        cargar();
    };
    const fallo = (m) => {
        setAviso("");
        setError(m);
    };

    async function enviarInvitacion(e) {
        e.preventDefault();
        if (ocupado) return;
        setOcupado(true);
        setError("");
        setAviso("");
        const r = await invitar(id, tipo, email);
        setOcupado(false);
        if (!r.ok) return setError(mensajeDeError(r));
        setResultado(r.data);
        setEmail("");
        cargar();
    }

    async function reenviar(inv) {
        setError("");
        setAviso("");
        const r = await reenviarInvitacion(id, inv.id);
        if (!r.ok) return setError(mensajeDeError(r));
        setResultado(r.data);
        window.scrollTo({ top: 0, behavior: "smooth" });
        cargar();
    }

    async function revocar(inv) {
        if (!window.confirm(`¿Cancelar la invitación a ${inv.email}?`)) return;
        const r = await revocarInvitacion(id, inv.id);
        if (!r.ok) return setError(mensajeDeError(r));
        tras("Invitación cancelada.");
    }

    async function quitarCoach(c) {
        const salir = c.soyYo;
        if (!window.confirm(salir ? "¿Salir de este equipo? Dejarás de ver a sus deportistas." : `¿Quitar a ${c.nombre} del equipo?`)) return;
        const r = await quitarEntrenadorEquipo(id, c.id);
        if (!r.ok) return setError(mensajeDeError(r));
        if (salir) return router.push("/panel_entrenador/equipos");
        tras(`${c.nombre} ya no es entrenador del equipo.`);
    }

    async function guardarEdicion(e) {
        e.preventDefault();
        setOcupado(true);
        const r = await editarEquipo(id, form);
        setOcupado(false);
        if (!r.ok) return setError(mensajeDeError(r));
        setEditando(false);
        tras("Equipo actualizado.");
    }

    async function archivar() {
        if (!window.confirm(`¿Archivar «${equipo.nombre}»? Sus deportistas saldrán del equipo y se cancelarán las invitaciones pendientes.`)) return;
        const r = await archivarEquipo(id);
        if (!r.ok) return setError(mensajeDeError(r));
        router.push("/panel_entrenador/equipos");
    }

    if (estado === "cargando") return <div className={s.page}><p className={s.estado}>Cargando equipo…</p></div>;
    if (estado !== "listo") {
        return (
            <div className={s.page}>
                <Link href="/panel_entrenador/equipos" className={s.volver}>← Equipos</Link>
                <div className={`${s.alerta} ${s.alertaMal}`}>{estado === "noexiste" ? "Este equipo no existe o no formas parte de él." : error}</div>
            </div>
        );
    }

    return (
        <div className={s.page}>
            <Link href="/panel_entrenador/equipos" className={s.volver}>← Equipos</Link>
            <header className={s.head}>
                <div>
                    <span className={s.eyebrow}>{equipo.esPropietario ? "Eres el propietario" : "Eres co-entrenador"}</span>
                    <h1>{equipo.nombre}</h1>
                    <div className={s.chips} style={{ marginTop: 10 }}>
                        {equipo.categoria && <span className={`${s.chip} ${s.chipAzul}`}>{equipo.categoria}</span>}
                        {equipo.temporada && <span className={s.chip}>Temporada {equipo.temporada}</span>}
                        <span className={s.chip}>{equipo.deportistas.length} deportistas</span>
                        <span className={s.chip}>{equipo.entrenadores.length} entrenadores</span>
                    </div>
                </div>
                <div className={s.acciones}>
                    <button className={s.btn} onClick={() => { setForm({ nombre: equipo.nombre, categoria: equipo.categoria ?? "", temporada: equipo.temporada ?? "" }); setEditando((v) => !v); }}>
                        {editando ? "Cancelar" : "Editar"}
                    </button>
                    {equipo.esPropietario && <button className={`${s.btn} ${s.btnPeligro}`} onClick={archivar}>Archivar equipo</button>}
                </div>
            </header>

            {error && <div className={`${s.alerta} ${s.alertaMal}`} role="alert">{error}</div>}
            {aviso && <div className={`${s.alerta} ${s.alertaBien}`} role="status">{aviso}</div>}

            {editando && (
                <form className={`${s.panel} ${s.form}`} onSubmit={guardarEdicion}>
                    <div className={s.campo}>
                        <label htmlFor="ed-nombre">Nombre</label>
                        <input id="ed-nombre" className={s.input} value={form.nombre} maxLength={100} required onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                    </div>
                    <div className={s.campo}>
                        <label htmlFor="ed-cat">Categoría</label>
                        <input id="ed-cat" className={s.input} value={form.categoria} maxLength={50} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
                    </div>
                    <div className={s.campo}>
                        <label htmlFor="ed-temp">Temporada</label>
                        <input id="ed-temp" className={s.input} value={form.temporada} maxLength={20} onChange={(e) => setForm({ ...form, temporada: e.target.value })} />
                    </div>
                    <button className={`${s.btn} ${s.btnPrim}`} disabled={ocupado}>Guardar</button>
                </form>
            )}

            <section className={s.panel} aria-label="Invitar">
                <div className={s.tabs} role="tablist">
                    <button role="tab" aria-selected={tipo === "deportista"} className={`${s.tab} ${tipo === "deportista" ? s.tabOn : ""}`} onClick={() => setTipo("deportista")}>Invitar deportista</button>
                    <button role="tab" aria-selected={tipo === "entrenador"} className={`${s.tab} ${tipo === "entrenador" ? s.tabOn : ""}`} onClick={() => setTipo("entrenador")}>Invitar entrenador</button>
                </div>
                <form className={s.formInv} onSubmit={enviarInvitacion}>
                    <div className={s.campo}>
                        <label htmlFor="inv-email">Correo de {tipo === "deportista" ? "la persona" : "tu colega"}</label>
                        <input id="inv-email" type="email" className={s.input} required value={email} placeholder="nombre@correo.com"
                            onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
                    </div>
                    <button className={`${s.btn} ${s.btnPrim}`} disabled={ocupado || !email.trim()}>{ocupado ? "Enviando…" : "Enviar invitación"}</button>
                </form>
                <p className={s.muted} style={{ marginTop: 10 }}>
                    {tipo === "deportista"
                        ? "Recibirá un correo con un enlace. Al aceptar entra al equipo y tú podrás ver sus rutinas, progreso y estadísticas."
                        : "Tu colega tendrá las mismas competencias dentro del equipo (menos archivarlo o quitar a otros entrenadores)."}
                </p>
                {resultado && <CajaEnlace resultado={resultado} />}
            </section>

            <section className={s.bloque}>
                <div className={s.bloqueHead}><h2>Deportistas</h2><span className={s.sub}>Posición y número de camiseta son de este equipo.</span></div>
                {equipo.deportistas.length === 0 ? (
                    <div className={s.vacio}><h3>Todavía no hay deportistas</h3><p>Invítalos con su correo y aparecerán aquí cuando acepten.</p></div>
                ) : (
                    <ul className={s.lista}>
                        {equipo.deportistas.map((d) => <FilaDeportista key={d.id} d={d} equipoId={id} onCambio={tras} onError={fallo} />)}
                    </ul>
                )}
            </section>

            <section className={s.bloque}>
                <div className={s.bloqueHead}><h2>Entrenadores</h2></div>
                <ul className={s.lista}>
                    {equipo.entrenadores.map((c) => (
                        <li key={c.id} className={`${s.fila} ${s.filaCoach}`}>
                            <div className={s.persona}>
                                <Avatar p={c} />
                                <div>
                                    <strong>{c.nombre} {c.apellido}{c.soyYo ? " (tú)" : ""}</strong>
                                    <span className={s.muted}>{c.email}</span>
                                </div>
                            </div>
                            <div className={s.acciones}>
                                <span className={`${s.chip} ${c.esPropietario ? s.chipAzul : ""}`}>{c.esPropietario ? "Propietario" : "Co-entrenador"}</span>
                                {!c.esPropietario && (c.soyYo || equipo.esPropietario) && (
                                    <button className={`${s.btn} ${s.btnPeligro} ${s.btnMini}`} onClick={() => quitarCoach(c)}>{c.soyYo ? "Salir" : "Quitar"}</button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

            {equipo.invitaciones.length > 0 && (
                <section className={s.bloque}>
                    <div className={s.bloqueHead}>
                        <h2>Invitaciones pendientes</h2>
                        <span className={s.sub}>Para obtener el enlace otra vez, usa «Reenviar».</span>
                    </div>
                    <ul className={s.lista}>
                        {equipo.invitaciones.map((i) => (
                            <li key={i.id} className={`${s.fila} ${s.filaInv}`}>
                                <div className={s.persona}>
                                    <div>
                                        <strong>{i.email}</strong>
                                        <span className={s.muted}>Invitó {i.invitadoPor} · {fecha(i.creadaEn)}</span>
                                    </div>
                                </div>
                                <div className={s.chips}>
                                    <span className={`${s.chip} ${i.tipo === "entrenador" ? s.chipVerde : s.chipAzul}`}>{i.tipo === "entrenador" ? "Entrenador" : "Deportista"}</span>
                                    <span className={`${s.chip} ${i.vencida ? s.chipNaranja : ""}`}>{i.vencida ? "Vencida" : `Vence ${fecha(i.venceEn)}`}</span>
                                </div>
                                <div className={s.acciones}>
                                    <button className={`${s.btn} ${s.btnMini}`} onClick={() => reenviar(i)}>Reenviar</button>
                                    <button className={`${s.btn} ${s.btnPeligro} ${s.btnMini}`} onClick={() => revocar(i)}>Cancelar</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
