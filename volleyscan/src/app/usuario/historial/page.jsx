"use client";

import { useEffect, useRef, useState } from "react";

import {
    FaChevronDown,
    FaChevronRight,
    FaCalendar,
    FaPlay
} from "react-icons/fa6";

import './historial.css'

const Historial = () => {

    const [filter, setFilter] = useState("all");
    const [showDropdown, setShowDropdown] =
        useState(false);

    const sessions = [
        {
            id: 1,
            tecnica: "remate",
            nombre: "Remate por zona 4",
            fecha: "18 Mayo 2025 · 10:30 a.m.",
            score: 85,
            duration: "00:45",
            image:
                "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=120&q=75",
            color: "#22c55e"
        },
        {
            id: 2,
            tecnica: "saque",
            nombre: "Saque flotante",
            fecha: "17 Mayo 2025 · 08:15 a.m.",
            score: 78,
            duration: "00:40",
            image:
                "https://images.unsplash.com/photo-1547347298-4074fc3086f0?w=120&q=75",
            color: "#22c55e"
        },
        {
            id: 3,
            tecnica: "recepcion",
            nombre: "Recepción y pase",
            fecha: "16 Mayo 2025 · 08:30 a.m.",
            score: 82,
            duration: "00:38",
            image:
                "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=120&q=75",
            color: "#22c55e"
        },
        {
            id: 4,
            tecnica: "bloqueo",
            nombre: "Bloqueo frontal",
            fecha: "15 Mayo 2025 · 07:30 p.m.",
            score: 75,
            duration: "00:35",
            image:
                "https://images.unsplash.com/photo-1561014990-82a765a3e7e5?w=120&q=75",
            color: "#f97316"
        }
    ];

    const filters = [
        {
            label: "Todas las técnicas",
            value: "all"
        },
        {
            label: "Saque",
            value: "saque"
        },
        {
            label: "Recepción",
            value: "recepcion"
        },
        {
            label: "Bloqueo",
            value: "bloqueo"
        }
    ];

    const filteredSessions =
        filter === "all"
            ? sessions
            : sessions.filter(
                (session) =>
                    session.tecnica === filter
            );

    /* =========================================
       SCORE RINGS
    ========================================= */

    useEffect(() => {

        const canvases =
            document.querySelectorAll(".score-ring");

        canvases.forEach((canvas, index) => {

            const session =
                filteredSessions[index];

            if (!session) return;

            const ctx = canvas.getContext("2d");

            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            const radius = 16;

            ctx.clearRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

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
            ctx.lineWidth = 4;

            ctx.stroke();

            // Score
            const endAngle =
                (-Math.PI / 2) +
                (Math.PI * 2 * session.score / 100);

            ctx.beginPath();

            ctx.arc(
                centerX,
                centerY,
                radius,
                -Math.PI / 2,
                endAngle
            );

            ctx.strokeStyle = session.color;
            ctx.lineWidth = 4;
            ctx.lineCap = "round";

            ctx.stroke();

        });

    }, [filteredSessions]);

    return (
        <main
            className="main-content"
            id="historial"
        >

            <header className="page-header">

                <h1 className="page-header__title">
                    Historial de Sesiones
                </h1>

            </header>

            <section className="history-panel">

                {/* TOPBAR */}
                <div className="history-panel__topbar">

                    <h2 className="history-panel__title">
                        Historial de sesiones
                    </h2>

                    <div className="filter-wrap">

                        <button
                            className="filter-btn"
                            onClick={() =>
                                setShowDropdown(!showDropdown)
                            }
                        >

                            <span>
                                {
                                    filters.find(
                                        (f) => f.value === filter
                                    )?.label
                                }
                            </span>

                            <FaChevronDown />

                        </button>

                        {showDropdown && (

                            <ul className="filter-dropdown">

                                {filters.map((item) => (

                                    <li
                                        key={item.value}
                                        className={`filter-option ${filter === item.value
                                                ? "filter-option--active"
                                                : ""
                                            }`}
                                        onClick={() => {
                                            setFilter(item.value);
                                            setShowDropdown(false);
                                        }}
                                    >
                                        {item.label}
                                    </li>

                                ))}

                            </ul>

                        )}

                    </div>

                </div>

                {/* LISTA */}
                <ol className="session-list">

                    {filteredSessions.map((session) => (

                        <li
                            key={session.id}
                            className="session-item"
                        >

                            {/* THUMB */}
                            <div className="session-item__thumb">

                                <img
                                    src={session.image}
                                    alt={session.nombre}
                                />

                                <div className="thumb-overlay">

                                    <FaPlay className="thumb-play" />

                                </div>

                            </div>

                            {/* INFO */}
                            <div className="session-item__info">

                                <p className="session-item__name">
                                    {session.nombre}
                                </p>

                                <p className="session-item__date">

                                    <FaCalendar />

                                    {session.fecha}

                                </p>

                            </div>

                            {/* SCORE */}
                            <div className="session-item__score">

                                <div className="score-wrap">

                                    <canvas
                                        className="score-ring"
                                        width="44"
                                        height="44"
                                    />

                                    <span
                                        className={`score-ring__label ${session.score >= 80
                                                ? "score-ring__label--green"
                                                : "score-ring__label--orange"
                                            }`}
                                    >

                                        {session.score}

                                        <span className="score-ring__max">
                                            /100
                                        </span>

                                    </span>

                                </div>

                            </div>

                            {/* DURACIÓN */}
                            <time className="session-item__duration">

                                {session.duration}

                            </time>

                            {/* ARROW */}
                            <button
                                className="session-item__arrow"
                            >

                                <FaChevronRight />

                            </button>

                        </li>

                    ))}

                </ol>

            </section>

        </main>
    );
};

export default Historial;