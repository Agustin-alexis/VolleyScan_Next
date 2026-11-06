"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    listarDeportistas,
    listarSolicitudes,
    mensajeDeError,
    responderSolicitud,
    retirarDeportista,
} from "@/lib/vinculos/api";
import s from "./deportistas.module.css";

/* ───────── utilidades ───────── */

const POSICIONES = [
    { v: "todas", t: "Todas" },
    { v: "armador", t: "Armador" },
    { v: "punta", t: "Punta" },
    { v: "central", t: "Central" },
    { v: "opuesto", t: "Opuesto" },
    { v: "libero", t: "Líbero" },
];
const NOMBRE_POS = { armador: "Armador", punta: "Punta", central: "Central", opuesto: "Opuesto", libero: "Líbero" };
const NOMBRE_NIVEL = { principiante: "Principiante", intermedio: "Intermedio", avanzado: "Avanzado", profesional: "Profesional" };

const fCorta = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });
const fecha = (iso) => {
    const d = iso ? new Date(iso) : null;
    return d && !Number.isNaN(d.getTime()) ? fCorta.format(d) : "—";
};
const sinTildes = (t) => (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const colorNota = (n) => (n >= 80 ? "#22c55e" : n >= 60 ? "#3b82f6" : "#f97316");

function Avatar({ a, size = 56 }) {
    const [falla, setFalla] = useState(false);
    const iniciales = `${a.nombre?.[0] ?? ""}${a.apellido?.[0] ?? ""}`.toUpperCase();
    if (a.fotoUrl && !falla) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img className={s.avatar} style={{ width: size, height: size }} src={a.fotoUrl} alt="" onError={() => setFalla(true)} />;
    }
    return (
        <span className={`${s.avatar} ${s.avatarIni}`} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
            {iniciales}
        </span>
    );
}

function Anillo({ valor, size = 48 }) {
    const g = 5;
    const r = (size - g) / 2;
    const c = 2 * Math.PI * r;
    return (
        <span className={s.anillo} style={{ width: size, height: size }}>
            <svg width={size} height={size} aria-hidden="true">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a2233" strokeWidth={g} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colorNota(valor)} strokeWidth={g}
                        strokeLinecap="round" strokeDasharray={`${(c * Math.min(valor, 100)) / 100} ${c}`} />
            </svg>
            <b style={{ fontSize: size * 0.3 }}>{valor}</b>
        </span>
    );
}

function Perfil({ a }) {
    return (
        <dl className={s.datos}>
            <div><dt>Edad</dt><dd>{a.edad != null ? `${a.edad} años` : "—"}</dd></div>
            <div><dt>Peso</dt><dd>{a.pesoKg != null ? `${a.pesoKg} kg` : "—"}</dd></div>
            <div><dt>Estatura</dt><dd>{a.estaturaM != null ? `${a.estaturaM} m` : "—"}</dd></div>
        </dl>
    );
}

function Chips({ a }) {
    return (
        <div className={s.chips}>
            {a.posicion && <span className={`${s.chip} ${s.chipPos}`}>{NOMBRE_POS[a.posicion] ?? a.posicion}</span>}
            {a.nivel && <span className={`${s.chip} ${s[`nivel_${a.nivel}`]}`}>{NOMBRE_NIVEL[a.nivel] ?? a.nivel}</span>}
        </div>
    );
}

/* ───────── página ───────── */

export default function DeportistasPage() {
    const [deportistas, setDeportistas] = useState([]);
    const [solicitudes, setSolicitudes] = useState([]);
    const [estado, setEstado] = useState("cargando");
    const [error, setError] = useState("");
    const [aviso, setAviso] = useState("");
    const [q, setQ] = useState("");
    const [pos, setPos] = useState("todas");
    const [ocupado, setOcupado] = useState(null);
    const [retirando, setRetirando] = useState(null);

    const cargar = useCallback(async () => {
        const [d, sol] = await Promise.all([listarDeportistas(), listarSolicitudes()]);
        if (!d.ok || !sol.ok) {
            setError(mensajeDeError(!d.ok ? d : sol));
            setEstado("error");
            return;
        }
        setDeportistas(d.data ?? []);
        setSolicitudes(sol.data ?? []);
        setError("");
        setEstado("listo");
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    async function responder(a, accion) {
        setOcupado(a.vinculoId);
        setAviso("");
        const r = await responderSolicitud(a.vinculoId, accion);
        setOcupado(null);
        if (!r.ok) {
            setError(mensajeDeError(r));
            await cargar();
            return;
        }
        await cargar();
        setAviso(accion === "aceptar" ? `${a.nombre} ya es parte de tus deportistas.` : `Rechazaste la solicitud de ${a.nombre}.`);
    }

    async function retirar(a) {
        setOcupado(a.vinculoId);
        const r = await retirarDeportista(a.id);
        setOcupado(null);
        setRetirando(null);
        if (!r.ok) return setError(mensajeDeError(r));
        await cargar();
        setAviso(`${a.nombre} ${a.apellido} ya no está en tu lista.`);
    }

    const visibles = useMemo(() => {
        const t = sinTildes(q.trim());
        return deportistas.filter(
            (a) => (pos === "todas" || a.posicion === pos) && (!t || sinTildes(`${a.nombre} ${a.apellido}`).includes(t))
        );
    }, [deportistas, q, pos]);

    return (
        <section className={s.page} aria-label="Deportistas">
            <header className={s.head}>
                <div>
                    <span className={s.eyebrow}>Panel del entrenador</span>
                    <h1>Deportistas</h1>
                    <p>Los atletas que te eligieron como entrenador, con su perfil y su práctica con la IA.</p>
                </div>
                {estado === "listo" && (
                    <div className={s.contadores}>
                        <div><b>{deportistas.length}</b><small>deportistas</small></div>
                        <div className={solicitudes.length ? s.contadorAviso : ""}><b>{solicitudes.length}</b><small>solicitudes</small></div>
                    </div>
                )}
            </header>

            {error && <p className={`${s.alerta} ${s.alertaMal}`} role="alert">{error}</p>}
            {aviso && <p className={`${s.alerta} ${s.alertaBien}`} role="status">{aviso}</p>}
            {estado === "cargando" && <p className={s.estado}>Cargando deportistas…</p>}
            {estado === "error" && (
                <button type="button" className={s.btn} onClick={cargar}>Reintentar</button>
            )}

            {estado === "listo" && solicitudes.length > 0 && (
                <section className={s.bloque} aria-label="Solicitudes pendientes">
                    <h2>Solicitudes pendientes <span className={s.badge}>{solicitudes.length}</span></h2>
                    <p className={s.sub}>Estos atletas te eligieron. Acepta para que aparezcan en tu lista.</p>
                    <ul className={s.solicitudes}>
                        {solicitudes.map((a) => (
                            <li key={a.vinculoId} className={s.solicitud}>
                                <Avatar a={a} />
                                <div className={s.solInfo}>
                                    <strong>{a.nombre} {a.apellido}</strong>
                                    <span className={s.muted}>{a.email} · pidió el {fecha(a.solicitadoEn)}</span>
                                    <Chips a={a} />
                                    <Perfil a={a} />
                                </div>
                                <div className={s.solAcciones}>
                                    <button type="button" className={`${s.btn} ${s.btnPrim}`} disabled={ocupado === a.vinculoId}
                                            onClick={() => responder(a, "aceptar")}>Aceptar</button>
                                    <button type="button" className={s.btn} disabled={ocupado === a.vinculoId}
                                            onClick={() => responder(a, "rechazar")}>Rechazar</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {estado === "listo" && (
                <section className={s.bloque} aria-label="Mis deportistas">
                    <div className={s.filtros}>
                        <h2>Mis deportistas</h2>
                        <input className={s.buscar} type="search" placeholder="Buscar por nombre…" value={q}
                            onChange={(e) => setQ(e.target.value)} aria-label="Buscar deportista" />
                    </div>
                    <div className={s.pills} role="group" aria-label="Filtrar por posición">
                        {POSICIONES.map((p) => (
                            <button key={p.v} type="button" onClick={() => setPos(p.v)}
                                    className={`${s.pill} ${pos === p.v ? s.pillOn : ""}`} aria-pressed={pos === p.v}>
                                {p.t}
                            </button>
                        ))}
                    </div>

                    {deportistas.length === 0 ? (
                        <div className={s.vacio}>
                            <h3>Aún no tienes deportistas</h3>
                            <p>Cuando un atleta te elija como entrenador, su solicitud aparecerá arriba. Al aceptarla, entrará en esta lista con todo su perfil.</p>
                        </div>
                    ) : visibles.length === 0 ? (
                        <p className={s.estado}>Ningún deportista coincide con ese filtro.</p>
                    ) : (
                        <ul className={s.grid}>
                            {visibles.map((a) => (
                                <li key={a.id} className={s.card}>
                                    <header className={s.cardHead}>
                                        <Avatar a={a} size={60} />
                                        <div>
                                            <strong>{a.nombre} {a.apellido}</strong>
                                            <span className={s.muted}>{a.email}</span>
                                        </div>
                                    </header>
                                    <Chips a={a} />
                                    <Perfil a={a} />
                                    <div className={s.ia}>
                                        {a.ia ? (
                                            <>
                                                {a.ia.promedio != null ? <Anillo valor={a.ia.promedio} /> : <span className={s.sinNota}>—</span>}
                                                <div>
                                                    <strong>Práctica con IA</strong>
                                                    <span className={s.muted}>
                                                        {a.ia.sesiones} {a.ia.sesiones === 1 ? "sesión" : "sesiones"}
                                                        {a.ia.mejor != null && a.ia.promedio != null ? ` · mejor ${a.ia.mejor}` : ""}
                                                    </span>
                                                    <span className={s.muted}>Última: {fecha(a.ia.ultimaSesion)}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <span className={s.muted}>Aún no ha practicado con la IA.</span>
                                        )}
                                    </div>
                                    <Link className={`${s.btn} ${s.btnPrim} ${s.btnAncho}`} href={`/panel_entrenador/gestion/${a.id}`}>
                                        Ver análisis{a.ia?.sinRevisar > 0 ? ` · ${a.ia.sinRevisar} sin revisar` : ""}
                                    </Link>
                                    <footer className={s.cardPie}>
                                        <span className={s.muted}>Contigo desde {fecha(a.desde)}</span>
                                        {retirando === a.id ? (
                                            <span className={s.confirma}>
                                                ¿Retirar?
                                                <button type="button" className={`${s.btn} ${s.btnPeligro}`} disabled={ocupado === a.vinculoId}
                                                        onClick={() => retirar(a)}>Sí</button>
                                                <button type="button" className={s.btn} onClick={() => setRetirando(null)}>No</button>
                                            </span>
                                        ) : (
                                            <button type="button" className={s.link} onClick={() => setRetirando(a.id)}>Retirar</button>
                                        )}
                                    </footer>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}
        </section>
    );
}
