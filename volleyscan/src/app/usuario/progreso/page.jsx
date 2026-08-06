"use client";

import "./progreso.css";
import { useEffect, useRef, useState } from "react";
import {
    FaHouse,
    FaUser,
    FaCalendarDays,
    FaClockRotateLeft,
    FaBookOpen,
    FaChartBar,
    FaCamera,
    FaBell,
    FaGear,
    FaChevronDown,
    FaBullseye,
    FaArrowTrendUp,
} from "react-icons/fa6";

export default function Progreso() {
    const [periodo, setPeriodo] = useState("Últimos 30 días");
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const lineChartRef = useRef(null);
    const donutChartRef = useRef(null);

    // ===== LINE CHART =====
    useEffect(() => {
        drawLineChart();
        drawDonutChart();
    }, []);

    const drawLineChart = () => {
        const canvas = lineChartRef.current;

        if (!canvas) return;

        const ctx = canvas.getContext("2d");

        canvas.width = 600;
        canvas.height = 260;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const data = [40, 55, 48, 70, 66, 82, 90];

        const padding = 40;
        const width = canvas.width - padding * 2;
        const height = canvas.height - padding * 2;

        // fondo
        ctx.strokeStyle = "rgba(255,255,255,.08)";
        ctx.lineWidth = 1;

        for (let i = 0; i < 5; i++) {
            const y = padding + (height / 4) * i;

            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(canvas.width - padding, y);
            ctx.stroke();
        }

        // línea
        ctx.beginPath();

        data.forEach((value, index) => {
            const x = padding + (width / (data.length - 1)) * index;
            const y = canvas.height - padding - (value / 100) * height;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 4;
        ctx.stroke();

        // puntos
        data.forEach((value, index) => {
            const x = padding + (width / (data.length - 1)) * index;
            const y = canvas.height - padding - (value / 100) * height;

            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fillStyle = "#22c55e";
            ctx.fill();
        });
    };

    // ===== DONUT CHART =====
    const drawDonutChart = () => {
        const canvas = donutChartRef.current;

        if (!canvas) return;

        const ctx = canvas.getContext("2d");

        const values = [86, 75, 70, 66];
        const colors = ["#22c55e", "#f97316", "#eab308", "#3b82f6"];

        const total = values.reduce((a, b) => a + b, 0);

        let startAngle = -Math.PI / 2;

        values.forEach((value, index) => {
            const slice = (value / total) * Math.PI * 2;

            ctx.beginPath();
            ctx.arc(55, 55, 40, startAngle, startAngle + slice);
            ctx.lineWidth = 16;
            ctx.strokeStyle = colors[index];
            ctx.stroke();

            startAngle += slice;
        });
    };

    return (
        <div className="app-wrapper">

            {/* ===== MAIN ===== */}

            <main className="main-content" id="progreso">
                <header className="page-header">
                    <h1 className="page-header__title">
                        Progreso y Estadísticas Personales
                    </h1>
                </header>

                <section className="progress-panel">
                    {/* TOP */}

                    <div className="panel-top">
                        <h2 className="panel-top__title">Resumen de progreso</h2>

                        <div className="period-select-wrap">
                            <button
                                className="period-btn"
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                            >
                                <span>{periodo}</span>
                                <FaChevronDown />
                            </button>

                            {dropdownOpen && (
                                <ul className="period-dropdown">
                                    {[
                                        "Últimos 7 días",
                                        "Últimos 30 días",
                                        "Últimos 3 meses",
                                    ].map((item) => (
                                        <li
                                            key={item}
                                            className="period-option"
                                            onClick={() => {
                                                setPeriodo(item);
                                                setDropdownOpen(false);
                                            }}
                                        >
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* METRICS */}

                    <div className="metrics-grid">
                        <article className="metric-card">
                            <p className="metric-card__label">Puntuación promedio</p>

                            <div className="metric-card__value-row">
                                <span className="metric-icon metric-icon--green">
                                    <FaBullseye />
                                </span>

                                <p className="metric-card__value">
                                    82<span className="metric-card__unit">/100</span>
                                </p>
                            </div>
                        </article>

                        <article className="metric-card">
                            <p className="metric-card__label">Mejora total</p>

                            <div className="metric-card__value-row">
                                <span className="metric-icon metric-icon--green">
                                    <FaArrowTrendUp />
                                </span>

                                <p className="metric-card__value metric-card__value--positive">
                                    +15%
                                </p>
                            </div>
                        </article>

                        <article className="metric-card">
                            <p className="metric-card__label">Análisis realizados</p>

                            <p className="metric-card__value metric-card__value--plain">
                                24
                            </p>
                        </article>

                        <article className="metric-card">
                            <p className="metric-card__label">Tiempo entrenando</p>

                            <p className="metric-card__value metric-card__value--plain">
                                12h 30m
                            </p>
                        </article>
                    </div>

                    {/* CHARTS */}

                    <div className="charts-row">
                        {/* LINE */}

                        <article className="chart-card chart-card--line">
                            <h3 className="chart-card__title">
                                Evolución de rendimiento
                            </h3>

                            <div className="chart-wrap">
                                <canvas ref={lineChartRef}></canvas>
                            </div>
                        </article>

                        {/* RIGHT */}

                        <div className="charts-col-right">
                            {/* ERRORES */}

                            <article className="chart-card chart-card--errors">
                                <h3 className="chart-card__title">
                                    Errores más frecuentes
                                </h3>

                                <ol className="error-bars">
                                    {[
                                        {
                                            name: "Contacto adelantado",
                                            value: "35%",
                                            width: "35%",
                                        },
                                        {
                                            name: "Codo bajo",
                                            value: "26%",
                                            width: "26%",
                                        },
                                        {
                                            name: "Salto no vertical",
                                            value: "20%",
                                            width: "20%",
                                        },
                                        {
                                            name: "Rotación del hombro",
                                            value: "10%",
                                            width: "10%",
                                        },
                                    ].map((item, index) => (
                                        <li className="error-bar-item" key={index}>
                                            <span className="error-bar-item__rank">
                                                {index + 1}
                                            </span>

                                            <div className="error-bar-item__info">
                                                <span className="error-bar-item__name">
                                                    {item.name}
                                                </span>

                                                <div className="error-bar-item__track">
                                                    <div
                                                        className="error-bar-item__fill"
                                                        style={{
                                                            width: item.width,
                                                        }}
                                                    ></div>
                                                </div>
                                            </div>

                                            <span className="error-bar-item__pct">
                                                {item.value}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            </article>

                            {/* DONUT */}

                            <article className="chart-card chart-card--donut">
                                <h3 className="chart-card__title">
                                    Rendimiento por técnica
                                </h3>

                                <div className="donut-section">
                                    <div className="donut-wrap">
                                        <canvas
                                            ref={donutChartRef}
                                            width="110"
                                            height="110"
                                        ></canvas>
                                    </div>

                                    <ul className="donut-legend">
                                        <li className="donut-legend__item">
                                            <span
                                                className="donut-legend__dot"
                                                style={{ background: "#22c55e" }}
                                            ></span>

                                            <span className="donut-legend__name">Remate</span>

                                            <span className="donut-legend__val">86%</span>
                                        </li>

                                        <li className="donut-legend__item">
                                            <span
                                                className="donut-legend__dot"
                                                style={{ background: "#f97316" }}
                                            ></span>

                                            <span className="donut-legend__name">Saque</span>

                                            <span className="donut-legend__val">75%</span>
                                        </li>

                                        <li className="donut-legend__item">
                                            <span
                                                className="donut-legend__dot"
                                                style={{ background: "#eab308" }}
                                            ></span>

                                            <span className="donut-legend__name">
                                                Recepción
                                            </span>

                                            <span className="donut-legend__val">70%</span>
                                        </li>

                                        <li className="donut-legend__item">
                                            <span
                                                className="donut-legend__dot"
                                                style={{ background: "#3b82f6" }}
                                            ></span>

                                            <span className="donut-legend__name">Bloqueo</span>

                                            <span className="donut-legend__val">66%</span>
                                        </li>
                                    </ul>
                                </div>
                            </article>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}