"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    cancelarOSalir,
    listarEntrenadores,
    mensajeDeError,
    miEntrenador,
    solicitarEntrenador,
} from "@/lib/vinculos/api";
import s from "./entrenador.module.css";

const fFecha = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" });
const fecha = (iso) => {
    const d = iso ? new Date(iso) : null;
    return d && !Number.isNaN(d.getTime()) ? fFecha.format(d) : "—";
};
const sinTildes = (t) => (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Avatar({ p, size = 56 }) {
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

export default function MiEntrenadorPage() {
    const [estado, setEstado] = useState("cargando");
    const [error, setError] = useState("");
    const [mio, setMio] = useState({ vinculo: null, ultimoRechazo: null });
    const [entrenadores, setEntrenadores] = useState([]);
    const [q, setQ] = useState("");
    const [ocupado, setOcupado] = useState(false);
    const [confirmando, setConfirmando] = useState(false);

    const cargar = useCallback(async () => {
        const [m, e] = await Promise.all([miEntrenador(), listarEntrenadores()]);
        if (!m.ok || !e.ok) {
            setError(mensajeDeError(!m.ok ? m : e));
            setEstado("error");
            return;
        }
        setMio(m.data);
        setEntrenadores(e.data ?? []);
        setError("");
        setEstado("listo");
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    async function elegir(p) {
        setOcupado(true);
        const r = await solicitarEntrenador(p.id);
        setOcupado(false);
        if (!r.ok) setError(mensajeDeError(r));
        else setError("");
        await cargar();
    }

    async function cancelar() {
        setOcupado(true);
        const r = await cancelarOSalir();
        setOcupado(false);
        setConfirmando(false);
        if (!r.ok) setError(mensajeDeError(r));
        else setError("");
        await cargar();
    }

    const v = mio.vinculo;
    const visibles = useMemo(() => {
        const t = sinTildes(q.trim());
        return entrenadores.filter((p) => !t || sinTildes(`${p.nombre} ${p.apellido}`).includes(t));
    }, [entrenadores, q]);

    return (
        <section className={s.page} aria-label="Mi entrenador">
            <header className={s.head}>
                <span className={s.eyebrow}>Perfil de atleta</span>
                <h1>Mi entrenador</h1>
                <p>Elige a tu entrenador. Cuando acepte tu solicitud, podrá ver tu perfil y tu práctica con la IA.</p>
            </header>

            {error && <p className={s.alerta} role="alert">{error}</p>}
            {estado === "cargando" && <p className={s.estado}>Cargando…</p>}
            {estado === "error" && <button type="button" className={s.btn} onClick={cargar}>Reintentar</button>}

            {estado === "listo" && v && (
                <article className={`${s.estadoCard} ${v.estado === "aceptado" ? s.ok : s.espera}`}>
                    <Avatar p={v.entrenador} size={72} />
                    <div className={s.estadoInfo}>
                        <span className={s.etiqueta}>{v.estado === "aceptado" ? "Tu entrenador" : "Solicitud enviada"}</span>
                        <strong>{v.entrenador.nombre} {v.entrenador.apellido}</strong>
                        <span className={s.muted}>
                            {v.estado === "aceptado"
                                ? `Entrenan juntos desde el ${fecha(v.respondidoEn)}.`
                                : `La enviaste el ${fecha(v.solicitadoEn)}. Esperando que ${v.entrenador.nombre} la acepte.`}
                        </span>
                    </div>
                    <div className={s.estadoAcciones}>
                        {confirmando ? (
                            <>
                                <span className={s.muted}>
                                    {v.estado === "aceptado" ? "¿Dejar a tu entrenador?" : "¿Cancelar la solicitud?"}
                                </span>
                                <button type="button" className={`${s.btn} ${s.btnPeligro}`} disabled={ocupado} onClick={cancelar}>Sí</button>
                                <button type="button" className={s.btn} onClick={() => setConfirmando(false)}>No</button>
                            </>
                        ) : (
                            <button type="button" className={s.btn} onClick={() => setConfirmando(true)}>
                                {v.estado === "aceptado" ? "Cambiar de entrenador" : "Cancelar solicitud"}
                            </button>
                        )}
                    </div>
                </article>
            )}

            {estado === "listo" && !v && mio.ultimoRechazo && (
                <p className={s.alerta} role="status">
                    {mio.ultimoRechazo.entrenador.nombre} {mio.ultimoRechazo.entrenador.apellido} no aceptó tu solicitud. Puedes elegir a otro entrenador.
                </p>
            )}

            {estado === "listo" && !v && (
                <section aria-label="Entrenadores disponibles">
                    <div className={s.filtros}>
                        <h2>Entrenadores disponibles</h2>
                        <input className={s.buscar} type="search" placeholder="Buscar por nombre…" value={q}
                               onChange={(e) => setQ(e.target.value)} aria-label="Buscar entrenador" />
                    </div>
                    {entrenadores.length === 0 ? (
                        <p className={s.vacio}>Todavía no hay entrenadores registrados.</p>
                    ) : visibles.length === 0 ? (
                        <p className={s.estado}>Ningún entrenador coincide con esa búsqueda.</p>
                    ) : (
                        <ul className={s.grid}>
                            {visibles.map((p) => (
                                <li key={p.id} className={s.card}>
                                    <Avatar p={p} size={64} />
                                    <strong>{p.nombre} {p.apellido}</strong>
                                    <span className={s.muted}>{p.deportistas} {p.deportistas === 1 ? "deportista" : "deportistas"}</span>
                                    <button type="button" className={`${s.btn} ${s.btnPrim}`} disabled={ocupado} onClick={() => elegir(p)}>
                                        Elegir como entrenador
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}
        </section>
    );
}
