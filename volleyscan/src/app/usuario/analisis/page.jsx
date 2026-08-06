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
    FaPause,
    FaExpand,
    FaBolt,
    FaCircleXmark,
    FaCircleExclamation,
    FaCircleCheck,
} from "react-icons/fa6";

import "./analisis.css";

export default function Analisis() {
    return (
        <div className="app-wrapper">


            {/* MAIN */}
            <main className="main-content" id="analisis">

                <header className="page-header">
                    <h1 className="page-header__title">
                        Módulo de Análisis (IA)
                    </h1>
                </header>

                <section className="analysis-panel">

                    <h2 className="analysis-panel__title">
                        Análisis en tiempo real
                    </h2>

                    <div className="analysis-layout">

                        {/* LEFT */}
                        <div className="col-video">

                            {/* VIDEO */}
                            <figure className="video-player">

                                <div className="video-player__overlay">
                                    <span className="rec-badge">
                                        <span className="rec-dot"></span>
                                        REC
                                    </span>
                                </div>

                                <div className="video-player__screen">

                                    <img
                                        src=""
                                        alt=""
                                        className="video-player__img"
                                    />

                                    {/* POSE */}
                                    <svg
                                        className="pose-skeleton"
                                        viewBox="0 0 400 300"
                                    >
                                        <g
                                            className="skeleton-lines"
                                            strokeWidth="2.5"
                                            fill="none"
                                        >

                                            <line
                                                x1="200"
                                                y1="90"
                                                x2="200"
                                                y2="170"
                                                stroke="#00e5ff"
                                            />

                                            <line
                                                x1="160"
                                                y1="100"
                                                x2="240"
                                                y2="100"
                                                stroke="#00e5ff"
                                            />

                                            <line
                                                x1="160"
                                                y1="100"
                                                x2="130"
                                                y2="140"
                                                stroke="#ff4444"
                                            />

                                            <line
                                                x1="130"
                                                y1="140"
                                                x2="110"
                                                y2="115"
                                                stroke="#ff4444"
                                            />

                                            <line
                                                x1="240"
                                                y1="100"
                                                x2="270"
                                                y2="65"
                                                stroke="#00e5ff"
                                            />

                                            <line
                                                x1="270"
                                                y1="65"
                                                x2="295"
                                                y2="42"
                                                stroke="#00e5ff"
                                            />

                                            <line
                                                x1="185"
                                                y1="170"
                                                x2="215"
                                                y2="170"
                                                stroke="#00e5ff"
                                            />

                                            <line
                                                x1="185"
                                                y1="170"
                                                x2="170"
                                                y2="220"
                                                stroke="#4CAF50"
                                            />

                                            <line
                                                x1="170"
                                                y1="220"
                                                x2="160"
                                                y2="265"
                                                stroke="#4CAF50"
                                            />

                                            <line
                                                x1="215"
                                                y1="170"
                                                x2="230"
                                                y2="215"
                                                stroke="#4CAF50"
                                            />

                                            <line
                                                x1="230"
                                                y1="215"
                                                x2="245"
                                                y2="260"
                                                stroke="#4CAF50"
                                            />
                                        </g>

                                        {/* JOINTS */}
                                        <g className="skeleton-joints">

                                            <circle
                                                cx="200"
                                                cy="88"
                                                r="5"
                                                fill="#00e5ff"
                                            />

                                            <circle
                                                cx="160"
                                                cy="100"
                                                r="5"
                                                fill="#00e5ff"
                                            />

                                            <circle
                                                cx="240"
                                                cy="100"
                                                r="5"
                                                fill="#00e5ff"
                                            />

                                            <circle
                                                cx="130"
                                                cy="140"
                                                r="5"
                                                fill="#ff4444"
                                            />

                                            <circle
                                                cx="110"
                                                cy="115"
                                                r="5"
                                                fill="#ff4444"
                                            />

                                            <circle
                                                cx="270"
                                                cy="65"
                                                r="5"
                                                fill="#00e5ff"
                                            />

                                            <circle
                                                cx="295"
                                                cy="42"
                                                r="5"
                                                fill="#ffd700"
                                            />
                                        </g>

                                        {/* BALL */}
                                        <circle
                                            cx="310"
                                            cy="30"
                                            r="14"
                                            fill="none"
                                            stroke="#ffd700"
                                            strokeWidth="2.5"
                                        />
                                    </svg>
                                </div>

                                {/* CONTROLS */}
                                <figcaption className="video-controls">

                                    <button className="ctrl-btn ctrl-btn--play">
                                        <FaPause />
                                    </button>

                                    <span className="ctrl-time">
                                        00:05
                                    </span>

                                    <div className="ctrl-progress">
                                        <div className="ctrl-progress__track">

                                            <div
                                                className="ctrl-progress__fill"
                                                style={{ width: "50%" }}
                                            />

                                            <div
                                                className="ctrl-progress__thumb"
                                                style={{ left: "50%" }}
                                            />
                                        </div>
                                    </div>

                                    <span className="ctrl-time">
                                        00:10
                                    </span>

                                    <button className="ctrl-btn">
                                        <FaExpand />
                                    </button>
                                </figcaption>
                            </figure>

                            {/* RECOMMENDATION */}
                            <aside className="recommendation">

                                <div className="recommendation__text">
                                    <h3 className="recommendation__label">
                                        Recomendación
                                    </h3>

                                    <p className="recommendation__body">
                                        Eleva más el codo y realiza el
                                        contacto con el balón en el punto
                                        más alto del salto.
                                    </p>
                                </div>

                                <div className="recommendation__figures">

                                    <div className="pose-demo wrong"></div>

                                    <div className="pose-demo mid"></div>

                                    <div className="pose-demo correct"></div>

                                </div>
                            </aside>
                        </div>

                        {/* RIGHT */}
                        <aside className="col-controls">

                            {/* SELECT */}
                            <div className="control-group">

                                <label className="control-label">
                                    Ejercicio
                                </label>

                                <div className="select-wrapper">

                                    <select className="custom-select">

                                        <option>Recepción</option>
                                        <option>Bloqueo</option>
                                        <option>Saque</option>

                                    </select>

                                    <FaChevronDown className="select-icon" />
                                </div>
                            </div>

                            {/* SCORE */}
                            <div className="score-widget">

                                <div className="score-widget__donut-wrap">

                                    <svg
                                        className="score-donut"
                                        viewBox="0 0 80 80"
                                    >
                                        <circle
                                            className="score-donut__bg"
                                            cx="40"
                                            cy="40"
                                            r="34"
                                        />

                                        <circle
                                            className="score-donut__fill"
                                            cx="40"
                                            cy="40"
                                            r="34"
                                        />
                                    </svg>

                                    <div className="score-donut__icon">
                                        <FaBolt />
                                    </div>
                                </div>

                                <div className="score-widget__info">

                                    <p className="score-widget__value">
                                        85
                                        <span className="score-widget__max">
                                            /100
                                        </span>
                                    </p>

                                    <p className="score-widget__label">
                                        Puntuación
                                    </p>
                                </div>
                            </div>

                            {/* ERRORS */}
                            <section className="analysis-section">

                                <h3 className="analysis-section__title">
                                    Errores detectados
                                </h3>

                                <ul className="error-list">

                                    <li className="error-item error-item--high">
                                        <FaCircleXmark />
                                        <span>Codo bajo</span>
                                        <span>2</span>
                                    </li>

                                    <li className="error-item error-item--high">
                                        <FaCircleXmark />
                                        <span>Contacto adelantado</span>
                                        <span>3</span>
                                    </li>

                                    <li className="error-item error-item--mid">
                                        <FaCircleExclamation />
                                        <span>Salto no vertical</span>
                                        <span>3</span>
                                    </li>
                                </ul>
                            </section>

                            {/* KEYPOINTS */}
                            <section className="analysis-section">

                                <h3 className="analysis-section__title">
                                    Puntos clave
                                </h3>

                                <ul className="keypoint-list">

                                    <li className="keypoint-item">
                                        <FaCircleCheck />
                                        <span>Aproximación</span>
                                        <FaCircleCheck />
                                    </li>

                                    <li className="keypoint-item">
                                        <FaCircleCheck />
                                        <span>Impulso</span>
                                        <FaCircleCheck />
                                    </li>

                                    <li className="keypoint-item">
                                        <FaCircleCheck />
                                        <span>Extensión del brazo</span>
                                        <FaCircleCheck />
                                    </li>

                                    <li className="keypoint-item">
                                        <FaCircleCheck />
                                        <span>Seguimiento</span>
                                        <FaCircleCheck />
                                    </li>
                                </ul>
                            </section>
                        </aside>
                    </div>
                </section>
            </main>
        </div>
    );
}