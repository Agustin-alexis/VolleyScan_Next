"use client";

import { useEffect, useState } from "react";
import {
    FaChevronDown,
    FaCirclePlay,
    FaFilm,
    FaPlay,
    FaRegClock,
    FaSpinner,
    FaXmark,
} from "react-icons/fa6";

import { useApi } from "@/lib/UseApi";

import "./contenido.css";

const BADGE_CLASS = {
    saque: "badge-saque",
    recepcion: "badge-recepcion",
    bloqueo: "badge-bloqueo",
    pose: "badge-pose",
    preparacion: "badge-preparacion",
};

const CAT_LABEL = {
    saque: "Saque",
    recepcion: "Recepción",
    bloqueo: "Bloqueo",
    pose: "Pose",
    preparacion: "Preparación física",
};

const TABS = [
    { value: "all", label: "Todos" },
    { value: "saque", label: "Saque" },
    { value: "recepcion", label: "Recepción" },
    { value: "bloqueo", label: "Bloqueo" },
    { value: "pose", label: "Pose" },
    { value: "preparacion", label: "Preparación física" },
];

const PAGE_SIZE = 6;

// Extrae el ID de 11 caracteres de cualquier link de YouTube
function extraerYoutubeId(url) {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

// Normaliza cada video para que siempre tenga youtube_id, miniatura_url y embed_url
function normalizarVideo(v) {
    const ytId = v.youtube_id || extraerYoutubeId(v.video_url);
    return {
        ...v,
        youtube_id: ytId,
        miniatura_url: v.miniatura_url || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null),
        embed_url: v.embed_url || (ytId ? `https://www.youtube-nocookie.com/embed/${ytId}?rel=0` : null),
    };
}

export default function Contenido() {

    // El catálogo es pequeño: se trae completo y se filtra en pantalla
    const { data, cargando, error } = useApi("/usuario/contenido/");

    const [categoria, setCategoria] = useState("all");
    const [pagina, setPagina] = useState(1);
    const [cargandoMas, setCargandoMas] = useState(false);
    const [abierto, setAbierto] = useState(false);
    const [modal, setModal] = useState(null);

    /* Cerrar el dropdown al hacer clic fuera */
    useEffect(() => {
        const fuera = (e) => {
            if (!e.target.closest(".filter-wrap")) setAbierto(false);
        };
        document.addEventListener("click", fuera);
        return () => document.removeEventListener("click", fuera);
    }, []);

    /* Cerrar el modal con Escape */
    useEffect(() => {
        const tecla = (e) => {
            if (e.key === "Escape") setModal(null);
        };
        document.addEventListener("keydown", tecla);
        return () => document.removeEventListener("keydown", tecla);
    }, []);

    function cambiarCategoria(valor) {
        setCategoria(valor);
        setPagina(1);
        setAbierto(false);
    }

    function verMas() {
        setCargandoMas(true);
        setTimeout(() => {
            setPagina((p) => p + 1);
            setCargandoMas(false);
        }, 400);
    }

    const listaCruda = Array.isArray(data)
        ? data
        : (data?.results ?? data?.items ?? data?.contenido ?? []);

    const videos = listaCruda.map(normalizarVideo);

    const filtrados = categoria === "all"
        ? videos
        : videos.filter((v) => v.categoria === categoria);
    const visibles = filtrados.slice(0, pagina * PAGE_SIZE);
    const hayMas = visibles.length < filtrados.length;

    const etiquetaActual = categoria === "all"
        ? "Todos los temas"
        : CAT_LABEL[categoria];

    return (
        <main className="main-content">

            <header className="page-header">
                <h1 className="page-header__title">Contenido Educativo</h1>
            </header>

            <section className="content-panel" aria-label="Biblioteca de contenido educativo">

                {/* Top bar */}
                <div className="content-panel__topbar">

                    <h2 className="content-panel__title">Contenido educativo</h2>

                    <div className="filter-wrap">

                        <button className="filter-btn" type="button"
                            aria-haspopup="listbox" aria-expanded={abierto}
                            onClick={() => setAbierto((a) => !a)}>
                            <span>{etiquetaActual}</span>
                            <FaChevronDown className={abierto ? "rotated" : ""} />
                        </button>

                        {abierto && (
                            <ul className="filter-dropdown open" role="listbox">
                                {TABS.map((tab) => (
                                    <li key={tab.value} role="option"
                                        className={`filter-option${categoria === tab.value ? " filter-option--active" : ""}`}
                                        onClick={() => cambiarCategoria(tab.value)}>
                                        {tab.value === "all" ? "Todos los temas" : tab.label}
                                    </li>
                                ))}
                            </ul>
                        )}

                    </div>

                </div>

                {/* Tabs */}
                <nav className="category-tabs" aria-label="Filtrar por categoría">
                    <ul className="category-tabs__list">
                        {TABS.map((tab) => (
                            <li key={tab.value}>
                                <button
                                    className={`tab-btn${categoria === tab.value ? " tab-btn--active" : ""}`}
                                    type="button"
                                    onClick={() => cambiarCategoria(tab.value)}>
                                    {tab.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>

                {cargando && <p style={{ color: "#94a3b8" }}>Cargando…</p>}

                {error && (
                    <p style={{ color: "#ef4444" }}>No se pudo cargar el contenido.</p>
                )}

                {/* Vacío */}
                {data && filtrados.length === 0 && (
                    <div className="empty-state">
                        <FaFilm />
                        <p>No hay videos para esta categoría.</p>
                    </div>
                )}

                {/* Grid */}
                {visibles.length > 0 && (
                    <div className="video-grid" aria-label="Videos educativos">

                        {visibles.map((video, i) => (
                            <article key={video.id} className="video-card"
                                style={{ animationDelay: `${(i % PAGE_SIZE) * 50}ms` }}
                                role="button" tabIndex={0}
                                aria-label={`Reproducir: ${video.titulo}`}
                                onClick={() => setModal(video)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setModal(video);
                                    }
                                }}>

                                <div className="video-card__thumb">

                                    {video.miniatura_url && (
                                        <img className="video-card__img"
                                            src={video.miniatura_url}
                                            alt={video.titulo}
                                            loading="lazy" />
                                    )}

                                    <div className="video-card__overlay">
                                        <div className="video-card__play" aria-hidden="true">
                                            <FaPlay />
                                        </div>
                                    </div>

                                    <span className={`video-card__cat-badge ${BADGE_CLASS[video.categoria] ?? ""}`}>
                                        {CAT_LABEL[video.categoria] ?? video.categoria}
                                    </span>

                                </div>

                                <div className="video-card__info">
                                    <p className="video-card__title">{video.titulo}</p>
                                    {video.duracion && (
                                        <p className="video-card__meta">
                                            <FaRegClock /> {video.duracion}
                                        </p>
                                    )}
                                </div>

                            </article>
                        ))}

                    </div>
                )}

                {/* Ver más */}
                {hayMas && (
                    <div className="load-more-wrap">
                        <button className={`btn-load-more${cargandoMas ? " loading" : ""}`}
                            type="button" onClick={verMas} disabled={cargandoMas}>
                            {cargandoMas
                                ? <><FaSpinner className="girar" /> Cargando…</>
                                : <><FaCirclePlay /> Ver más contenido</>}
                        </button>
                    </div>
                )}

            </section>

            {/* Modal de reproducción */}
            {modal && (
                <div className="modal-overlay" role="dialog" aria-modal="true"
                    aria-labelledby="modalVideoTitle"
                    onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>

                    <div className="video-modal">

                        <button className="video-modal__close" type="button"
                            aria-label="Cerrar video" onClick={() => setModal(null)}>
                            <FaXmark />
                        </button>

                        <div className="video-modal__screen">

                            {modal.youtube_id ? (
                                // Al cerrar el modal el iframe se desmonta y el video se detiene
                                <iframe
                                    className="video-modal__frame"
                                    src={`${modal.embed_url}&autoplay=1`}
                                    title={modal.titulo}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    referrerPolicy="strict-origin-when-cross-origin"
                                    allowFullScreen
                                />
                            ) : (
                                <>
                                    {modal.miniatura_url && (
                                        <img className="video-modal__thumb"
                                            src={modal.miniatura_url} alt={modal.titulo} />
                                    )}
                                    <div className="video-modal__play-icon" aria-hidden="true">
                                        <FaPlay />
                                    </div>
                                </>
                            )}

                        </div>

                        <div className="video-modal__info">

                            <span className={`video-modal__cat ${BADGE_CLASS[modal.categoria] ?? ""}`}>
                                {CAT_LABEL[modal.categoria] ?? modal.categoria}
                            </span>

                            <h3 className="video-modal__title" id="modalVideoTitle">
                                {modal.titulo}
                            </h3>

                            <p className="video-modal__meta">
                                {CAT_LABEL[modal.categoria]}
                                {modal.duracion ? ` · ${modal.duracion}` : ""}
                            </p>

                            {modal.descripcion && (
                                <p className="video-modal__desc">{modal.descripcion}</p>
                            )}

                            {modal.youtube_id ? (
                                <a className="video-modal__link"
                                    href={`https://www.youtube.com/watch?v=${modal.youtube_id}`}
                                    target="_blank" rel="noopener noreferrer">
                                    Ver en YouTube
                                </a>
                            ) : (
                                <p className="video-modal__desc">Video próximamente.</p>
                            )}

                        </div>

                    </div>

                </div>
            )}

        </main>
    );
}