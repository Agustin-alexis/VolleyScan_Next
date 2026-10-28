'use client';
import './Analisis.css'
import { enviarMensaje } from '@/app/services/api'

import { useState, useRef, useEffect, useId } from 'react';

// Chips rápidos (solo se muestran dentro del chat)
const SUGERENCIAS = [
    { glifo: '01', texto: 'Rutina de salto' },
    { glifo: '02', texto: 'Mejorar recepción' },
    { glifo: '03', texto: 'Plan semanal' },
    { glifo: '04', texto: 'Errores en remate' },
];

// Tarjetas de la pantalla de bienvenida
const TARJETAS = [
    {
        icono: 'bolt',
        titulo: 'Rutina de salto',
        texto: 'Ejercicios de fuerza y pliometría para ganar altura.',
        pregunta: 'Rutina de salto',
    },
    {
        icono: 'target',
        titulo: 'Análisis técnico',
        texto: 'Detecta errores en remate y recepción, con pasos para corregirlos.',
        pregunta: 'Errores en remate y recepción',
    },
    {
        icono: 'calendar',
        titulo: 'Plan semanal',
        texto: 'Organiza la carga, el descanso y los partidos de tu semana.',
        pregunta: 'Plan semanal',
    },
];

const MAX_CARACTERES = 600;

/* ---------- Iconos SVG (no dependen de Font Awesome) ---------- */
const svgProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
};

function Icono({ nombre }) {
    switch (nombre) {
        case 'plus':
            return (<svg {...svgProps}><path d="M12 5v14M5 12h14" /></svg>);
        case 'chevron':
            return (<svg {...svgProps}><path d="M6 9l6 6 6-6" /></svg>);
        case 'sliders':
            return (<svg {...svgProps}><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>);
        case 'grid':
            return (<svg {...svgProps}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>);
        case 'send':
            return (<svg {...svgProps}><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>);
        case 'spark':
            return (<svg {...svgProps}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>);
        case 'bolt':
            return (<svg {...svgProps}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>);
        case 'target':
            return (<svg {...svgProps}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></svg>);
        case 'calendar':
            return (<svg {...svgProps}><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>);
        case 'arrow':
            return (<svg {...svgProps}><path d="M7 17L17 7M8 7h9v9" /></svg>);
        default:
            return null;
    }
}

function renderMarkdown(texto) {
    return texto
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/### (.*)/g, '<h4>$1</h4>')
        .replace(/## (.*)/g, '<h3>$1</h3>')
        .split(/\n{2,}/)
        .map((parrafo) => `<p>${parrafo.replace(/\n/g, '<br/>')}</p>`)
        .join('');
}

function horaActual() {
    const ahora = new Date();
    return `${ahora.getHours().toString().padStart(2, '0')}:${ahora
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
}

export default function Analisis() {
    const [mensajes, setMensajes] = useState([]);
    const [entrada, setEntrada] = useState('');
    const [escribiendo, setEscribiendo] = useState(false);
    const [copiadoIndex, setCopiadoIndex] = useState(null);

    const finRef = useRef(null);
    const textareaRef = useRef(null);
    const inputId = useId();

    const vacio = mensajes.length === 0 && !escribiendo;
    const ultimoMensajeUsuario = [...mensajes].reverse().find((m) => m.rol === 'user')?.texto;

    useEffect(() => {
        finRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [mensajes, escribiendo]);

    // Al pasar de bienvenida a chat el textarea se vuelve a montar: recuperar el foco
    useEffect(() => {
        textareaRef.current?.focus();
    }, [vacio]);

    async function enviar(texto) {
        const mensaje = texto.trim();
        if (!mensaje) return;

        const hora = horaActual();
        setMensajes((prev) => [...prev, { rol: 'user', texto: mensaje, hora }]);
        setEntrada('');
        setEscribiendo(true);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        try {
            const data = await enviarMensaje(mensaje);
            setMensajes((prev) => [
                ...prev,
                { rol: 'coach', texto: data.respuesta, hora: horaActual() },
            ]);
        } catch (error) {
            console.error(error);
            setMensajes((prev) => [
                ...prev,
                {
                    rol: 'coach',
                    texto: '⚠️ No fue posible conectar con VolleyScan AI.',
                    hora: horaActual(),
                },
            ]);
        } finally {
            setEscribiendo(false);
        }
    }

    function handleSubmit(e) {
        e.preventDefault();
        enviar(entrada);
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            enviar(entrada);
        }
    }

    function handleChangeEntrada(e) {
        setEntrada(e.target.value.slice(0, MAX_CARACTERES));
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
    }

    async function copiarTexto(texto, index) {
        try {
            await navigator.clipboard.writeText(texto.replace(/\*\*/g, ''));
            setCopiadoIndex(index);
            setTimeout(() => setCopiadoIndex((actual) => (actual === index ? null : actual)), 1800);
        } catch (error) {
            console.error('No fue posible copiar el mensaje', error);
        }
    }

    function regenerar() {
        if (ultimoMensajeUsuario) {
            setMensajes((prev) => prev.slice(0, -1));
            enviar(ultimoMensajeUsuario);
        }
    }

    /* ---------- Caja de escritura (se reutiliza en bienvenida y chat) ---------- */
    const composer = (
        <form className="ai-composer" onSubmit={handleSubmit}>
            <label className="ai-sr-only" htmlFor={inputId}>Escribe tu pregunta para el coach</label>
            <div className="ai-composer-field">
                <span className="ai-composer-spark"><Icono nombre="spark" /></span>
                <textarea
                    id={inputId}
                    ref={textareaRef}
                    placeholder="Pregúntame lo que quieras sobre tu entrenamiento..."
                    rows="1"
                    value={entrada}
                    onChange={handleChangeEntrada}
                    onKeyDown={handleKeyDown}
                    maxLength={MAX_CARACTERES}
                ></textarea>
            </div>

            <div className="ai-composer-bar">
                <div className="ai-composer-tools">
                    <button type="button" className="ai-round-btn" aria-label="Adjuntar archivo" title="Adjuntar">
                        <Icono nombre="plus" />
                    </button>
                    <button type="button" className="ai-pill-btn">
                        <Icono nombre="sliders" /> Ajustes <Icono nombre="chevron" />
                    </button>
                    <button type="button" className="ai-pill-btn">
                        <Icono nombre="grid" /> Opciones <Icono nombre="chevron" />
                    </button>
                </div>

                <div className="ai-composer-end">
                    <output htmlFor={inputId} className="ai-char-count">
                        {entrada.length}/{MAX_CARACTERES}
                    </output>
                    <button
                        className="ai-composer-send"
                        type="submit"
                        disabled={escribiendo || !entrada.trim()}
                        aria-label="Enviar mensaje"
                    >
                        <Icono nombre="send" />
                    </button>
                </div>
            </div>
        </form>
    );

    return (
        <main className="ai-panel">
            {/* ============ BARRA SUPERIOR ============ */}
            <header className="ai-header">
                <h1 className="ai-corner-title">Chat IA</h1>
            </header>

            {vacio ? (
                /* ============ VISTA DE BIENVENIDA ============ */
                <section className="ai-welcome" aria-label="Bienvenida">
                    <div className="ai-orb" aria-hidden="true"></div>
                    <p className="ai-eyebrow">Entrenador virtual de voleibol</p>
                    <h2 className="ai-welcome-title">¿Listo para entrenar hoy?</h2>

                    {composer}

                    <ul className="ai-cards">
                        {TARJETAS.map((t) => (
                            <li key={t.titulo}>
                                <button type="button" className="ai-card" onClick={() => enviar(t.pregunta)}>
                                    <span className="ai-card-top">
                                        <span className="ai-card-icon"><Icono nombre={t.icono} /></span>
                                        <span className="ai-card-arrow"><Icono nombre="arrow" /></span>
                                    </span>
                                    <strong className="ai-card-title">{t.titulo}</strong>
                                    <span className="ai-card-text">{t.texto}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : (
                /* ============ VISTA DE CHAT ============ */
                <>
                    <section
                        className="ai-messages"
                        aria-live="polite"
                        aria-label="Historial de la conversación"
                    >
                        <ul className="ai-messages-list">
                            {mensajes.map((m, i) => {
                                const esCoach = m.rol === 'coach';
                                const esUltimoCoach = esCoach && i === mensajes.length - 1 && mensajes.length > 1;

                                return (
                                    <li key={i}>
                                        <article className={`ai-message ${esCoach ? 'ai-message--coach' : 'ai-message--user'}`}>
                                            <span className="ai-bubble-column">
                                                <span className="ai-bubble-wrap">
                                                    <span
                                                        className="ai-bubble"
                                                        dangerouslySetInnerHTML={{ __html: renderMarkdown(m.texto) }}
                                                    ></span>

                                                    {esCoach && (
                                                        <span className="ai-bubble-actions">
                                                            <button
                                                                type="button"
                                                                className={`ai-action-btn ${copiadoIndex === i ? 'is-confirmed' : ''}`}
                                                                onClick={() => copiarTexto(m.texto, i)}
                                                                aria-label="Copiar respuesta"
                                                                title="Copiar"
                                                            ></button>
                                                            {esUltimoCoach && !escribiendo && (
                                                                <button
                                                                    type="button"
                                                                    className="ai-action-btn"
                                                                    onClick={regenerar}
                                                                    aria-label="Regenerar respuesta"
                                                                    title="Regenerar"
                                                                ></button>
                                                            )}
                                                        </span>
                                                    )}
                                                </span>

                                                <span className="ai-bubble-footer">
                                                    <time className="ai-timestamp">{m.hora}</time>
                                                </span>
                                            </span>
                                        </article>
                                    </li>
                                );
                            })}

                            {escribiendo && (
                                <li>
                                    <article className="ai-message ai-message--coach">
                                        <span className="ai-bubble-column">
                                            <span className="ai-thinking" role="status" aria-label="El coach está escribiendo">
                                                <span className="ai-thinking-label">Analizando</span>
                                                <span className="ai-thinking-bar" aria-hidden="true"></span>
                                            </span>
                                        </span>
                                    </article>
                                </li>
                            )}
                        </ul>
                        <span ref={finRef}></span>
                    </section>

                    <footer className="ai-footer">
                        {composer}
                        <ul className="ai-suggestions">
                            {SUGERENCIAS.map((s) => (
                                <li key={s.texto}>
                                    <button className="ai-suggestion-btn" type="button" onClick={() => enviar(s.texto)}>
                                        <span className="ai-suggestion-glyph" aria-hidden="true">{s.glifo}</span>
                                        {s.texto}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </footer>
                </>
            )}
        </main>
    );
}
