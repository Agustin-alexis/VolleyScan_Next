"use client";

import { useEffect, useRef, useState } from "react";

import {
    FaBullseye,
    FaCirclePlus,
    FaListCheck
} from "react-icons/fa6";

import { useApi } from "@/lib/UseApi";
import { api } from "@/lib/api";

import './rutinas.css'

const NIVELES = ["principiante", "intermedio", "avanzado"];
const COLOR_BARRA = ["diff-bar--blue", "diff-bar--teal", "diff-bar--green"];

const capitalizar = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/* =========================================
   PÁGINA: busca las rutinas y muestra la
   más reciente que esté activa
========================================= */

export default function Rutinas() {

    const { data: lista, cargando, error } = useApi("/usuario/rutinas/");

    return (
        <main className="main-content" id="rutinas">

            <header className="page-header">
                <h1 className="page-header__title">
                    Rutinas / Entrenamiento Personalizado
                </h1>
            </header>

            {cargando && <p style={{ color: "#94a3b8" }}>Cargando…</p>}

            {error && (
                <p style={{ color: "#ef4444" }}>
                    No se pudieron cargar las rutinas.
                </p>
            )}

            {lista && lista.length === 0 && (
                <p style={{ color: "#94a3b8" }}>
                    Aún no tienes rutinas asignadas.
                </p>
            )}

            {/* La API ya las ordena: activas primero, la más nueva arriba */}
            {lista && lista.length > 0 && <RutinaDetalle id={lista[0].id} />}

        </main>
    );
}

/* =========================================
   DETALLE DE UNA RUTINA
========================================= */

function RutinaDetalle({ id }) {

    const { data: rutina, cargando, error, setData } = useApi(`/usuario/rutinas/${id}/`);

    const canvasRef = useRef(null);

    const [guardando, setGuardando] = useState(null);
    const [aviso, setAviso] = useState("");

    /* =========================================
       DONUT
       Depende de `rutina` para dibujarse cuando
       llegan los datos y cada vez que cambian
    ========================================= */

    useEffect(() => {

        const canvas = canvasRef.current;

        if (!canvas || !rutina) return;

        const porcentaje = rutina.progreso.porcentaje;

        const ctx = canvas.getContext("2d");

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        const radius = 50;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Fondo
        ctx.beginPath();

        ctx.arc(
            centerX,
            centerY,
            radius,
            0,
            Math.PI * 2
        );

        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 12;
        ctx.stroke();

        // Progreso
        const endAngle =
            (-Math.PI / 2) +
            (Math.PI * 2 * porcentaje / 100);

        ctx.beginPath();

        ctx.arc(
            centerX,
            centerY,
            radius,
            -Math.PI / 2,
            endAngle
        );

        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 12;
        ctx.lineCap = "round";

        ctx.stroke();

    }, [rutina]);

    /* =========================================
       COMPLETAR EJERCICIO (se guarda en el backend)
    ========================================= */

    async function completeExercise(ejercicio) {

        setAviso("");
        setGuardando(ejercicio.id);

        try {

            const res = await api(
                `/usuario/rutinas/${id}/ejercicios/${ejercicio.id}/completar/`,
                { method: "PUT", body: { completado: true } }
            );

            // La respuesta trae el ejercicio actualizado y el progreso nuevo
            setData((prev) => ({
                ...prev,
                progreso: res.progreso,
                ejercicios: prev.ejercicios.map((e) =>
                    e.id === res.ejercicio.id ? res.ejercicio : e
                ),
            }));

        } catch {

            setAviso("No se pudo guardar. Inténtalo de nuevo.");

        } finally {

            setGuardando(null);

        }
    }

    /* ── Estados de carga (después de todos los hooks) ── */

    if (cargando) return <p style={{ color: "#94a3b8" }}>Cargando…</p>;

    if (error || !rutina) {
        return (
            <p style={{ color: "#ef4444" }}>
                No se pudo cargar la rutina.
            </p>
        );
    }

    const nivel = rutina.nivel ?? "intermedio";
    const nivelesActivos = NIVELES.indexOf(nivel) + 1; // 1, 2 o 3 barras

    const { total, completados, porcentaje } = rutina.progreso;

    return (
        <section
            className="routine-panel"
            aria-label="Rutina personalizada de hoy"
        >

            {/* HEADER */}
            <header className="routine-header">

                <div className="routine-header__title-row">

                    <h2 className="routine-header__title">
                        {rutina.nombre}
                    </h2>

                    <span className="badge badge--level">
                        {capitalizar(nivel)}
                    </span>

                </div>

                {rutina.descripcion && (
                    <p className="routine-header__subtitle">
                        {rutina.descripcion}
                    </p>
                )}

            </header>

            {/* META */}
            <div className="routine-meta-row">

                <article className="meta-card meta-card--objective">

                    <div className="meta-card__icon-wrap meta-icon--green">
                        <FaBullseye />
                    </div>

                    <div className="meta-card__body">

                        <p className="meta-card__label">
                            Objetivo de la semana
                        </p>

                        <p className="meta-card__value">
                            {rutina.objetivo ?? "Sin objetivo definido"}
                        </p>

                    </div>

                </article>

                <article className="meta-card meta-card--difficulty">

                    <header className="meta-card__header">

                        <FaCirclePlus className="meta-card__icon-sm" />

                        <p className="meta-card__label">
                            Nivel de dificultad
                        </p>

                    </header>

                    <p className="meta-card__value">
                        {capitalizar(nivel)}
                    </p>

                    <div className="difficulty-bars">

                        {NIVELES.map((_, i) => (
                            <span
                                key={i}
                                className={`diff-bar ${i < nivelesActivos
                                    ? `diff-bar--active ${COLOR_BARRA[i]}`
                                    : "diff-bar--inactive"
                                    }`}
                            ></span>
                        ))}

                    </div>

                </article>

            </div>

            {/* EJERCICIOS */}
            <div className="exercises-row">

                <section className="exercises-section">

                    <h3 className="exercises-section__title">
                        Ejercicios de hoy
                    </h3>

                    {rutina.ejercicios.length === 0 && (
                        <p style={{ color: "#94a3b8" }}>
                            Esta rutina todavía no tiene ejercicios.
                        </p>
                    )}

                    <ol className="exercise-list">

                        {rutina.ejercicios.map((exercise, i) => {

                            const isCompleted = exercise.completado;

                            return (

                                <li
                                    key={exercise.id}
                                    className={`exercise-item ${isCompleted ? "completed" : ""
                                        }`}
                                >

                                    <span
                                        className={`exercise-num exercise-num--${(i % 3) + 1}`}
                                    >
                                        {i + 1}
                                    </span>

                                    <div className="exercise-info">

                                        <p className="exercise-info__name">
                                            {exercise.nombre}
                                        </p>

                                        <p className="exercise-info__meta">
                                            {exercise.series} series x {exercise.repeticiones} repeticiones
                                        </p>

                                    </div>

                                    <button
                                        className={`btn-start ${isCompleted ? "btn-completed" : ""
                                            }`}
                                        onClick={() =>
                                            completeExercise(exercise)
                                        }
                                        disabled={isCompleted || guardando === exercise.id}
                                    >
                                        {isCompleted
                                            ? "Completado"
                                            : guardando === exercise.id
                                                ? "Guardando…"
                                                : "Comenzar"}
                                    </button>

                                </li>
                            );
                        })}

                    </ol>

                    {aviso && (
                        <p style={{ color: "#ef4444", fontSize: ".85rem" }}>
                            {aviso}
                        </p>
                    )}

                </section>

                {/* PROGRESO */}
                <aside className="progress-aside">

                    <h3 className="progress-aside__title">
                        Progreso de la rutina
                    </h3>

                    <div className="donut-wrap">

                        <canvas
                            ref={canvasRef}
                            width="140"
                            height="140"
                        />

                        <div className="donut-center">

                            <span className="donut-center__pct">
                                {porcentaje}%
                            </span>

                        </div>

                    </div>

                    <p className="progress-aside__count">
                        {completados} de {total} ejercicios completados
                    </p>

                    <button className="btn-full-routine">

                        <FaListCheck />

                        Ver rutina completa

                    </button>

                </aside>

            </div>

        </section>
    );
}