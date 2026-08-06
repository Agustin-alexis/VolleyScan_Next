"use client";

import { useEffect, useRef, useState } from "react";

import {
    FaBullseye,
    FaCirclePlus,
    FaListCheck
} from "react-icons/fa6";

import './rutinas.css'

const Rutinas = () => {

    const canvasRef = useRef(null);

    const [completed, setCompleted] = useState([]);

    const exercises = [
        {
            id: 0,
            name: "Remate por zona 4",
            meta: "4 series x 8 repeticiones",
            number: 1
        },
        {
            id: 1,
            name: "Recepción alta",
            meta: "4 series x 10 repeticiones",
            number: 2
        },
        {
            id: 2,
            name: "Pase largo a objetivo",
            meta: "3 series x 12 repeticiones",
            number: 3
        }
    ];

    const totalExercises = 5;

    const completedCount = completed.length;

    const percentage = Math.round(
        (completedCount / totalExercises) * 100
    );

    /* =========================================
       DONUT
    ========================================= */

    useEffect(() => {

        const canvas = canvasRef.current;

        if (!canvas) return;

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
            (Math.PI * 2 * percentage / 100);

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

    }, [percentage]);

    /* =========================================
       COMPLETAR EJERCICIO
    ========================================= */

    const completeExercise = (id) => {

        if (completed.includes(id)) return;

        setCompleted([...completed, id]);
    };

    return (
        <main className="main-content" id="rutinas">

            <header className="page-header">
                <h1 className="page-header__title">
                    Rutinas / Entrenamiento Personalizado
                </h1>
            </header>

            <section
                className="routine-panel"
                aria-label="Rutina personalizada de hoy"
            >

                {/* HEADER */}
                <header className="routine-header">

                    <div className="routine-header__title-row">

                        <h2 className="routine-header__title">
                            Rutina personalizada
                        </h2>

                        <span className="badge badge--level">
                            Intermedio
                        </span>

                    </div>

                    <p className="routine-header__subtitle">
                        Rutina recomendada por la IA para ti.
                    </p>

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
                                Mejorar técnica de remate y recepción
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
                            Intermedio
                        </p>

                        <div className="difficulty-bars">

                            <span className="diff-bar diff-bar--active diff-bar--blue"></span>

                            <span className="diff-bar diff-bar--active diff-bar--teal"></span>

                            <span className="diff-bar diff-bar--inactive"></span>

                        </div>

                    </article>

                </div>

                {/* EJERCICIOS */}
                <div className="exercises-row">

                    <section className="exercises-section">

                        <h3 className="exercises-section__title">
                            Ejercicios de hoy
                        </h3>

                        <ol className="exercise-list">

                            {exercises.map((exercise) => {

                                const isCompleted =
                                    completed.includes(exercise.id);

                                return (

                                    <li
                                        key={exercise.id}
                                        className={`exercise-item ${isCompleted ? "completed" : ""
                                            }`}
                                    >

                                        <span
                                            className={`exercise-num exercise-num--${exercise.number}`}
                                        >
                                            {exercise.number}
                                        </span>

                                        <div className="exercise-info">

                                            <p className="exercise-info__name">
                                                {exercise.name}
                                            </p>

                                            <p className="exercise-info__meta">
                                                {exercise.meta}
                                            </p>

                                        </div>

                                        <button
                                            className={`btn-start ${isCompleted ? "btn-completed" : ""
                                                }`}
                                            onClick={() =>
                                                completeExercise(exercise.id)
                                            }
                                            disabled={isCompleted}
                                        >
                                            {isCompleted
                                                ? "Completado"
                                                : "Comenzar"}
                                        </button>

                                    </li>
                                );
                            })}

                        </ol>

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
                                    {percentage}%
                                </span>

                            </div>

                        </div>

                        <p className="progress-aside__count">
                            {completedCount} de {totalExercises} ejercicios completados
                        </p>

                        <button className="btn-full-routine">

                            <FaListCheck />

                            Ver rutina completa

                        </button>

                    </aside>

                </div>

            </section>

        </main>
    );
};

export default Rutinas;