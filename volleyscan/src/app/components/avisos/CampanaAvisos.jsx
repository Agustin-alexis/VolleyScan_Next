"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { contadorAvisos, listarAvisos, marcarAviso, marcarTodosLosAvisos } from "@/lib/avisos/api";
import s from "./CampanaAvisos.module.css";

const CADA_MS = 30000;

function hace(iso) {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "";
    const seg = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (seg < 60) return "ahora";
    const min = Math.floor(seg / 60);
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `hace ${d} d`;
    return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(new Date(t));
}

const SVG = { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

function Icono({ tipo }) {
    // analisis = gráfica; rutina = lista con check; vinculo = persona con check
    if (tipo === "analisis") return <svg {...SVG}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
    if (tipo === "rutina") return <svg {...SVG}><path d="M9 6h11M9 12h11M9 18h11M3.5 6l1.5 1.5L7 5M3.5 12l1.5 1.5L7 11M3.5 18l1.5 1.5L7 17" /></svg>;
    return <svg {...SVG}><circle cx="9" cy="8" r="4" /><path d="M2 21v-1a6 6 0 0 1 6-6h2M16 17l2 2 4-4" /></svg>;
}

const CLASE_ICONO = { analisis: "icoAnalisis", rutina: "icoRutina" };

/**
 * Campana de avisos. `flotante` (por defecto) la fija arriba a la derecha de la pantalla;
 * con `flotante={false}` queda en línea, para ponerla donde quieras (por ejemplo en un Sidebar).
 */
export default function CampanaAvisos({ flotante = true }) {
    const router = useRouter();
    const raiz = useRef(null);
    const [abierto, setAbierto] = useState(false);
    const [noLeidas, setNoLeidas] = useState(0);
    const [avisos, setAvisos] = useState(null); // null = sin cargar
    const [error, setError] = useState(false);

    const refrescarContador = useCallback(async () => {
        const r = await contadorAvisos();
        if (r.ok) setNoLeidas(r.data.noLeidas ?? 0);
    }, []);

    const cargarLista = useCallback(async () => {
        const r = await listarAvisos();
        if (r.ok) {
            setAvisos(r.data.avisos ?? []);
            setNoLeidas(r.data.noLeidas ?? 0);
            setError(false);
        } else {
            setError(true);
        }
    }, []);

    // Contador: al montar, cada 30 s mientras la pestaña esté visible y al volver a ella
    useEffect(() => {
        refrescarContador();
        const id = setInterval(() => {
            if (document.visibilityState === "visible") refrescarContador();
        }, CADA_MS);
        const alVolver = () => document.visibilityState === "visible" && refrescarContador();
        document.addEventListener("visibilitychange", alVolver);
        return () => {
            clearInterval(id);
            document.removeEventListener("visibilitychange", alVolver);
        };
    }, [refrescarContador]);

    useEffect(() => {
        if (abierto) cargarLista();
    }, [abierto, cargarLista]);

    // Cerrar con Esc o al hacer clic fuera
    useEffect(() => {
        if (!abierto) return undefined;
        const tecla = (e) => e.key === "Escape" && setAbierto(false);
        const fuera = (e) => raiz.current && !raiz.current.contains(e.target) && setAbierto(false);
        document.addEventListener("keydown", tecla);
        document.addEventListener("mousedown", fuera);
        return () => {
            document.removeEventListener("keydown", tecla);
            document.removeEventListener("mousedown", fuera);
        };
    }, [abierto]);

    async function abrirAviso(a) {
        setAbierto(false);
        if (!a.leida) {
            setAvisos((lista) => lista?.map((x) => (x.id === a.id ? { ...x, leida: true } : x)) ?? lista);
            setNoLeidas((n) => Math.max(0, n - 1));
            marcarAviso(a.id).then((r) => r.ok && setNoLeidas(r.data.noLeidas ?? 0));
        }
        if (a.enlace) router.push(a.enlace);
    }

    async function leerTodos() {
        setAvisos((lista) => lista?.map((x) => ({ ...x, leida: true })) ?? lista);
        setNoLeidas(0);
        await marcarTodosLosAvisos();
    }

    return (
        <div ref={raiz} className={`${s.raiz} ${flotante ? s.flotante : ""}`}>
            <button
                type="button"
                className={`${s.campana} ${abierto ? s.campanaAbierta : ""}`}
                onClick={() => setAbierto((v) => !v)}
                aria-label={noLeidas ? `Avisos, ${noLeidas} sin leer` : "Avisos"}
                aria-expanded={abierto}
                aria-haspopup="true"
            >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                {noLeidas > 0 && <span className={s.contador}>{noLeidas > 9 ? "9+" : noLeidas}</span>}
            </button>

            {abierto && (
                <section className={s.panel} aria-label="Avisos">
                    <header className={s.cabecera}>
                        <strong>Avisos</strong>
                        {noLeidas > 0 && (
                            <button type="button" className={s.leerTodos} onClick={leerTodos}>
                                Marcar todos como leídos
                            </button>
                        )}
                    </header>

                    {error && (
                        <p className={s.vacio} role="alert">
                            No se pudieron cargar los avisos.{" "}
                            <button type="button" className={s.leerTodos} onClick={cargarLista}>Reintentar</button>
                        </p>
                    )}
                    {!error && avisos === null && <p className={s.vacio}>Cargando…</p>}
                    {!error && avisos?.length === 0 && <p className={s.vacio}>No tienes avisos todavía.</p>}

                    {!error && avisos?.length > 0 && (
                        <ul className={s.lista}>
                            {avisos.map((a) => (
                                <li key={a.id}>
                                    <button type="button" className={`${s.item} ${a.leida ? "" : s.nuevo}`} onClick={() => abrirAviso(a)}>
                                        <span className={`${s.icono} ${s[CLASE_ICONO[a.tipo] ?? "icoVinculo"]}`}>
                                            <Icono tipo={a.tipo} />
                                        </span>
                                        <span className={s.texto}>
                                            <strong>{a.titulo}</strong>
                                            <span>{a.mensaje}</span>
                                            <small>{hace(a.creadoEn)}</small>
                                        </span>
                                        {!a.leida && <span className={s.punto} aria-label="sin leer" />}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}
        </div>
    );
}
