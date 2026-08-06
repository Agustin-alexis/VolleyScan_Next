"use client";

import { useState, useEffect } from 'react'
import './contenido.css'

const ALL_VIDEOS = [
    { id: 2, cat: 'saque', title: 'Errores comunes en el saque', duration: '6:30 min', img: 'https://images.unsplash.com/photo-1547347298-4074fc3086f0?w=400&q=75', desc: 'Análisis detallado de los 5 errores más frecuentes al sacar y cómo corregirlos con ejercicios específicos.' },
    { id: 3, cat: 'recepcion', title: 'Mejora tu recepción', duration: '7:15 min', img: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&q=75', desc: 'Postura, lectura del rival y técnica de plataforma para una recepción consistente bajo presión.' },
    { id: 4, cat: 'recepcion', title: 'Posición de manos en el pase', duration: '4:10 min', img: 'https://images.unsplash.com/photo-1543347218-9c47e4b8d9b3?w=400&q=75', desc: 'Guía práctica sobre la posición óptima de manos para el pase de dedos: errores, correcciones y ejercicios.' },
    { id: 5, cat: 'bloqueo', title: 'Bloqueo efectivo', duration: '6:45 min', img: 'https://images.unsplash.com/photo-1561014990-82a765a3e7e5?w=400&q=75', desc: 'Timing, lectura del armador y técnica de manos para un bloqueo que genere puntos directos.' },
    { id: 6, cat: 'preparacion', title: 'Entrenamiento de salto', duration: '5:00 días', img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=75', desc: 'Plan de 5 días para aumentar tu altura de salto con ejercicios pliométricos y de fuerza específicos.' },
    { id: 7, cat: 'pose', title: 'Postura base del voleibolista', duration: '3:50 min', img: 'https://images.unsplash.com/photo-1599058917765-a780eda07a3e?w=400&q=75', desc: 'La postura base es el fundamento de todo movimiento. Aprende la posición correcta para reaccionar más rápido.' },
    { id: 8, cat: 'saque', title: 'Saque flotante con efecto', duration: '8:00 min', img: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400&q=75', desc: 'Domina el saque flotante: grip, contacto y trayectoria para crear un balón imparable.' },
    { id: 9, cat: 'preparacion', title: 'Resistencia para voleibol', duration: '10:20 min', img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=75', desc: 'Circuito de alta intensidad diseñado para mejorar la resistencia específica de voleibolistas.' },
    { id: 11, cat: 'bloqueo', title: 'Comunicación en el bloqueo', duration: '4:30 min', img: 'https://images.unsplash.com/photo-1561014990-82a765a3e7e5?w=400&q=75', desc: 'La coordinación entre centrales y puntas es clave. Aprende las señas y comunicación táctica en el bloqueo.' },
    { id: 12, cat: 'pose', title: 'Análisis de postura con IA', duration: '6:10 min', img: 'https://images.unsplash.com/photo-1599058917765-a780eda07a3e?w=400&q=75', desc: 'Cómo interpretar los resultados del análisis de pose de VolleyScan y aplicarlos en tu entrenamiento.' },
]

const BADGE_CLASS = { saque: 'badge-saque', recepcion: 'badge-recepcion', bloqueo: 'badge-bloqueo', pose: 'badge-pose', preparacion: 'badge-preparacion' }
const CAT_LABEL = { saque: 'Saque', recepcion: 'Recepción', bloqueo: 'Bloqueo', pose: 'Pose', preparacion: 'Preparación física' }
const TABS = [
    { value: 'all', label: 'Todos' },
    { value: 'saque', label: 'Saque' },
    { value: 'recepcion', label: 'Recepción' },
    { value: 'bloqueo', label: 'Bloqueo' },
    { value: 'pose', label: 'Pose' },
    { value: 'preparacion', label: 'Preparación física' },
]
const PAGE_SIZE = 6

export default function Contenido() {
    const [currentCat, setCat] = useState('all')
    const [currentPage, setPage] = useState(1)
    const [loadingMore, setLoadingMore] = useState(false)
    const [modal, setModal] = useState(null)
    const [dropOpen, setDropOpen] = useState(false)

    const filtered = currentCat === 'all' ? ALL_VIDEOS : ALL_VIDEOS.filter(v => v.cat === currentCat)
    const visible = filtered.slice(0, currentPage * PAGE_SIZE)
    const hasMore = visible.length < filtered.length

    function handleCatChange(cat) { setCat(cat); setPage(1); setDropOpen(false) }

    function handleLoadMore() {
        setLoadingMore(true)
        setTimeout(() => { setPage(p => p + 1); setLoadingMore(false) }, 700)
    }

    useEffect(() => {
        const fn = e => { if (!e.target.closest('.filter-wrap')) setDropOpen(false) }
        document.addEventListener('click', fn)
        return () => document.removeEventListener('click', fn)
    }, [])

    useEffect(() => {
        const fn = e => { if (e.key === 'Escape') setModal(null) }
        document.addEventListener('keydown', fn)
        return () => document.removeEventListener('keydown', fn)
    }, [])

    const currentLabel = currentCat === 'all' ? 'Todos los temas' : (CAT_LABEL[currentCat] ?? currentCat)

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
                            aria-haspopup="listbox" aria-expanded={dropOpen}
                            onClick={() => setDropOpen(p => !p)}>
                            <span>{currentLabel}</span>
                            <i className={`fa-solid fa-chevron-down${dropOpen ? ' rotated' : ''}`} />
                        </button>
                        {dropOpen && (
                            <ul className="filter-dropdown open" role="listbox">
                                {TABS.map(tab => (
                                    <li key={tab.value} role="option"
                                        className={`filter-option${currentCat === tab.value ? ' filter-option--active' : ''}`}
                                        onClick={() => handleCatChange(tab.value)}>
                                        {tab.value === 'all' ? 'Todos los temas' : tab.label}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <nav className="category-tabs" aria-label="Filtrar por categoría">
                    <ul className="category-tabs__list">
                        {TABS.map(tab => (
                            <li key={tab.value}>
                                <button
                                    className={`tab-btn${currentCat === tab.value ? ' tab-btn--active' : ''}`}
                                    type="button" onClick={() => handleCatChange(tab.value)}>
                                    {tab.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Grid o vacío */}
                {filtered.length === 0 ? (
                    <div className="empty-state">
                        <i className="fa-solid fa-film" />
                        <p>No hay videos para esta categoría.</p>
                    </div>
                ) : (
                    <div className="video-grid" aria-label="Videos educativos">
                        {visible.map((video, i) => (
                            <article key={video.id} className="video-card"
                                style={{ animationDelay: `${(i % PAGE_SIZE) * 50}ms` }}
                                role="button" tabIndex={0}
                                aria-label={`Reproducir: ${video.title}`}
                                onClick={() => setModal(video)}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setModal(video) } }}>
                                <div className="video-card__thumb">
                                    <img className="video-card__img" src={video.img} alt={video.title} loading="lazy" />
                                    <div className="video-card__overlay">
                                        <div className="video-card__play" aria-hidden="true"><i className="fa-solid fa-play" /></div>
                                    </div>
                                    <span className={`video-card__cat-badge ${BADGE_CLASS[video.cat] ?? ''}`}>
                                        {CAT_LABEL[video.cat] ?? video.cat}
                                    </span>
                                </div>
                                <div className="video-card__info">
                                    <p className="video-card__title">{video.title}</p>
                                    <p className="video-card__meta"><i className="fa-regular fa-clock" /> {video.duration}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {/* Ver más */}
                {hasMore && (
                    <div className="load-more-wrap">
                        <button className={`btn-load-more${loadingMore ? ' loading' : ''}`}
                            type="button" onClick={handleLoadMore} disabled={loadingMore}>
                            {loadingMore
                                ? <><i className="fa-solid fa-spinner fa-spin" /> Cargando…</>
                                : <><i className="fa-solid fa-circle-play" /> Ver más contenido</>}
                        </button>
                    </div>
                )}

            </section>

            {/* Modal */}
            {modal && (
                <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modalVideoTitle"
                    onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
                    <div className="video-modal">
                        <button className="video-modal__close" type="button" aria-label="Cerrar video" onClick={() => setModal(null)}>
                            <i className="fa-solid fa-xmark" />
                        </button>
                        <div className="video-modal__screen">
                            <img className="video-modal__thumb" src={modal.img} alt={modal.title} />
                            <div className="video-modal__play-icon" aria-hidden="true"><i className="fa-solid fa-play" /></div>
                        </div>
                        <div className="video-modal__info">
                            <span className={`video-modal__cat ${BADGE_CLASS[modal.cat] ?? ''}`}>{CAT_LABEL[modal.cat]}</span>
                            <h3 className="video-modal__title" id="modalVideoTitle">{modal.title}</h3>
                            <p className="video-modal__meta">{CAT_LABEL[modal.cat]} · {modal.duration}</p>
                            <p className="video-modal__desc">{modal.desc}</p>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}