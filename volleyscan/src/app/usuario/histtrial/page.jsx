"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    HistorialError,
    eliminarSesion,
    exportarHistorial,
    listarSesiones,
} from "@/app/services/historialService";
import "./historial.css";

const NIVELES = [
    { min: 85, clave: "excelente", etiqueta: "Excelente" },
    { min: 70, clave: "bueno", etiqueta: "Bueno" },
    { min: 50, clave: "regular", etiqueta: "Regular" },
    { min: 0, clave: "bajo", etiqueta: "A mejorar" },
];

const nivelDe = (puntaje) =>
    NIVELES.find((n) => puntaje >= n.min) ?? NIVELES[NIVELES.length - 1];

const formatoFecha = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
});

function fmtFecha(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "Fecha no disponible" : formatoFecha.format(d);
}

function fmtDuracion(seg) {
    const total = Math.round(seg);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

/* Errores que más se repiten en una sesión: lo que más conviene corregir. */
function erroresFrecuentes(repeticiones) {
    const conteo = new Map();
    for (const r of repeticiones) {
        for (const e of r.errores) {
            const clave = e.medidaId || e.mensaje;
            const actual = conteo.get(clave) ?? { clave, mensaje: e.mensaje, veces: 0 };
            actual.veces += 1;
            conteo.set(clave, actual);
        }
    }
    return [...conteo.values()].sort((a, b) => b.veces - a.veces).slice(0, 3);
}

const mensajeDe = (e) =>
    e instanceof HistorialError ? e.message : "Ocurrió un error inesperado.";

/* Línea de progreso: promedio de cada sesión, de la más antigua a la más reciente. */
function Tendencia({ sesiones }) {
    const puntos = [...sesiones].reverse().slice(-20);
    if (puntos.length < 2) return null;

    const W = 320;
    const H = 84;
    const P = 10;
    const coords = puntos.map((s, i) => [
        P + (i * (W - 2 * P)) / (puntos.length - 1),
        H - P - (s.puntajePromedio / 100) * (H - 2 * P),
    ]);
    const d = coords
        .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
        .join(" ");
    const [ux, uy] = coords[coords.length - 1];

    return (
        <figure className="hist__tendencia">
            <svg
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label={`Progreso del puntaje promedio en las últimas ${puntos.length} sesiones`}
            >
                <path className="hist__linea" d={d} />
                <circle className="hist__punto" cx={ux} cy={uy} r="4" />
            </svg>
            <figcaption>Promedio por sesión, últimas {puntos.length}</figcaption>
        </figure>
    );
}

export default function HistorialPage() {
    const [sesiones, setSesiones] = useState([]);
    const [estado, setEstado] = useState("cargando");
    const [error, setError] = useState("");
    const [seleccionId, setSeleccionId] = useState(null);
    const [confirmandoId, setConfirmandoId] = useState(null);

    const cargar = useCallback(async () => {
        try {
            const datos = await listarSesiones();
            setSesiones(datos);
            setError("");
            setEstado("listo");
        } catch (e) {
            setError(mensajeDe(e));
            setEstado("error");
        }
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const seleccionada = useMemo(
        () => sesiones.find((s) => s.id === seleccionId) ?? sesiones[0] ?? null,
        [sesiones, seleccionId]
    );

    const frecuentes = useMemo(
        () => (seleccionada ? erroresFrecuentes(seleccionada.repeticiones) : []),
        [seleccionada]
    );

    const resumen = useMemo(() => {
        const repeticiones = sesiones.reduce((a, s) => a + s.repeticiones.length, 0);
        const promedio = sesiones.length
            ? Math.round(sesiones.reduce((a, s) => a + s.puntajePromedio, 0) / sesiones.length)
            : 0;
        const mejor = sesiones.reduce((m, s) => Math.max(m, s.mejorPuntaje), 0);
        return { total: sesiones.length, repeticiones, promedio, mejor: Math.round(mejor) };
    }, [sesiones]);

    async function onEliminar(id) {
        try {
            await eliminarSesion(id);
            setConfirmandoId(null);
            setSeleccionId(null);
            await cargar();
        } catch (e) {
            setError(mensajeDe(e));
        }
    }

    async function onExportar() {
        try {
            const json = await exportarHistorial();
            const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
            const enlace = document.createElement("a");
            enlace.href = url;
            enlace.download = `volleyscan-historial-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(enlace);
            enlace.click();
            enlace.remove();
            setTimeout(() => URL.revokeObjectURL(url), 0);
        } catch (e) {
            setError(mensajeDe(e));
        }
    }

    return (
        <section className="hist" aria-label="Historial de remates">
            <header className="hist__cabecera">
                <div>
                    <h1>Historial de remates</h1>
                    <p>Tus sesiones de análisis, de la más reciente a la más antigua.</p>
                </div>
                {sesiones.length > 0 && (
                    <button type="button" className="hist__btn" onClick={onExportar}>
                        Exportar JSON
                    </button>
                )}
            </header>

            {error && (
                <p className="hist__alerta" role="alert">
                    {error}
                </p>
            )}

            {estado === "cargando" && <p className="hist__estado">Cargando historial…</p>}

            {estado === "listo" && sesiones.length === 0 && (
                <section className="hist__vacio">
                    <h2>Aún no tienes sesiones guardadas</h2>
                    <p>Analiza un remate y la sesión aparecerá aquí al terminar.</p>
                    <Link className="hist__btn hist__btn--primario" href="/usuario/analisis">
                        Ir a analizar
                    </Link>
                </section>
            )}

            {estado === "listo" && sesiones.length > 0 && (
                <>
                    <section className="hist__resumen" aria-label="Resumen general">
                        <dl>
                            <div>
                                <dt>Sesiones</dt>
                                <dd>{resumen.total}</dd>
                            </div>
                            <div>
                                <dt>Repeticiones</dt>
                                <dd>{resumen.repeticiones}</dd>
                            </div>
                            <div>
                                <dt>Promedio</dt>
                                <dd>{resumen.promedio}</dd>
                            </div>
                            <div>
                                <dt>Mejor remate</dt>
                                <dd>{resumen.mejor}</dd>
                            </div>
                        </dl>
                        <Tendencia sesiones={sesiones} />
                    </section>

                    <div className="hist__cuerpo">
                        <nav aria-label="Sesiones guardadas">
                            <ul className="hist__lista">
                                {sesiones.map((s) => {
                                    const activa = seleccionada?.id === s.id;
                                    const nivel = nivelDe(s.puntajePromedio);
                                    return (
                                        <li key={s.id}>
                                            <button
                                                type="button"
                                                className="hist__item"
                                                aria-current={activa ? "true" : undefined}
                                                onClick={() => {
                                                    setSeleccionId(s.id);
                                                    setConfirmandoId(null);
                                                }}
                                            >
                                                <span className="hist__item-fecha">{fmtFecha(s.creadoEn)}</span>
                                                <span className="hist__item-meta">
                                                    {s.repeticiones.length}{" "}
                                                    {s.repeticiones.length === 1 ? "repetición" : "repeticiones"}
                                                </span>
                                                <span className="hist__nota" data-nivel={nivel.clave}>
                                                    {Math.round(s.puntajePromedio)}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </nav>

                        {seleccionada && (
                            <article className="hist__detalle" aria-live="polite">
                                <header>
                                    <h2>{fmtFecha(seleccionada.creadoEn)}</h2>
                                    <p>
                                        Remate, {seleccionada.repeticiones.length}{" "}
                                        {seleccionada.repeticiones.length === 1 ? "repetición" : "repeticiones"},{" "}
                                        {fmtDuracion(seleccionada.duracionSeg)}
                                    </p>
                                    <p className="hist__nivel" data-nivel={nivelDe(seleccionada.puntajePromedio).clave}>
                                        {Math.round(seleccionada.puntajePromedio)}
                                        <span>{nivelDe(seleccionada.puntajePromedio).etiqueta}</span>
                                    </p>
                                </header>

                                {frecuentes.length > 0 && (
                                    <section className="hist__frecuentes" aria-label="Errores más repetidos">
                                        <h3>Lo que más conviene corregir</h3>
                                        <ul>
                                            {frecuentes.map((f) => (
                                                <li key={f.clave}>
                                                    {f.mensaje}{" "}
                                                    <span className="hist__suave">
                                                        ({f.veces} {f.veces === 1 ? "vez" : "veces"})
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                )}

                                <div className="hist__tabla-wrap">
                                    <table className="hist__tabla">
                                        <thead>
                                            <tr>
                                                <th scope="col">Rep.</th>
                                                <th scope="col">Puntaje</th>
                                                <th scope="col">Brazo</th>
                                                <th scope="col">Detalle</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {seleccionada.repeticiones.map((r) => (
                                                <tr key={r.numero}>
                                                    <th scope="row">{r.numero}</th>
                                                    <td>
                                                        <span className="hist__nota" data-nivel={nivelDe(r.puntaje).clave}>
                                                            {Math.round(r.puntaje)}
                                                        </span>
                                                    </td>
                                                    <td>{r.brazo || "—"}</td>
                                                    <td>
                                                        {r.errores.length > 0 ? (
                                                            <ul className="hist__metricas">
                                                                {r.errores.map((e, i) => (
                                                                    <li key={`${e.medidaId}-${i}`}>{e.mensaje}</li>
                                                                ))}
                                                            </ul>
                                                        ) : r.puntosClave.length > 0 ? (
                                                            <ul className="hist__metricas">
                                                                {r.puntosClave.map((t, i) => (
                                                                    <li key={i} className="hist__bien">
                                                                        ✓ {t}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        ) : (
                                                            <span className="hist__suave">Sin detalle</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {seleccionada.observaciones && (
                                    <p className="hist__obs">{seleccionada.observaciones}</p>
                                )}

                                <footer className="hist__acciones">
                                    {confirmandoId === seleccionada.id ? (
                                        <>
                                            <span>¿Eliminar esta sesión? No se puede deshacer.</span>
                                            <button
                                                type="button"
                                                className="hist__btn hist__btn--peligro"
                                                onClick={() => onEliminar(seleccionada.id)}
                                            >
                                                Sí, eliminar
                                            </button>
                                            <button
                                                type="button"
                                                className="hist__btn"
                                                onClick={() => setConfirmandoId(null)}
                                            >
                                                Cancelar
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            className="hist__btn"
                                            onClick={() => setConfirmandoId(seleccionada.id)}
                                        >
                                            Eliminar sesión
                                        </button>
                                    )}
                                </footer>
                            </article>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}