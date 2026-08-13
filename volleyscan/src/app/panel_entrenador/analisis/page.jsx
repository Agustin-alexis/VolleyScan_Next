'use client';
import './Analisis.css'
import { enviarMensaje } from '@/app/services/api'

import { useState, useRef, useEffect, useId, useMemo } from 'react';

const PERFIL_DEPORTISTA = [
    { clave: 'Posición', valor: 'Armador' },
    { clave: 'Nivel', valor: 'Intermedio' },
    { clave: 'Objetivo', valor: 'Mejorar salto' },
];

const WELCOME = `¡Hola! 👋 Soy tu entrenador personal de voleibol basado en IA.

Puedo ayudarte con:
✅ Rutinas de entrenamiento personalizadas
✅ Análisis técnico por posición
✅ Recomendaciones para mejorar rendimiento
✅ Respuesta a dudas tácticas

¿En qué puedo ayudarte hoy? 🏐`;

const SUGERENCIAS = [
    { glifo: '01', texto: 'Rutina de salto' },
    { glifo: '02', texto: 'Mejorar recepción' },
    { glifo: '03', texto: 'Plan semanal' },
    { glifo: '04', texto: 'Errores en remate' },
];

const MAX_CARACTERES = 600;

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

function generarCodigoSesion() {
    return Math.random().toString(16).slice(2, 6).toUpperCase();
}

export default function Analisis() {
    const [mensajes, setMensajes] = useState([
        { rol: 'coach', texto: WELCOME, hora: 'Ahora' },
    ]);
    const [entrada, setEntrada] = useState('');
    const [escribiendo, setEscribiendo] = useState(false);
    const [copiadoIndex, setCopiadoIndex] = useState(null);

    const finRef = useRef(null);
    const textareaRef = useRef(null);
    const inputId = useId();

    const codigoSesion = useMemo(generarCodigoSesion, []);
    const intercambios = Math.floor(mensajes.length / 2);
    const ultimoMensajeUsuario = [...mensajes].reverse().find((m) => m.rol === 'user')?.texto;
    const ultimoEsCoach = mensajes[mensajes.length - 1]?.rol === 'coach' && mensajes.length > 1;

    useEffect(() => {
        finRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [mensajes, escribiendo]);

    async function enviar(texto) {
        const mensaje = texto.trim();
        if (!mensaje) return;

        const hora = horaActual();
        setMensajes((prev) => [...prev, { rol: 'user', texto: mensaje, hora }]);
        setEntrada('');
        setEscribiendo(true);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        textareaRef.current?.focus();

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

    return (
        <main className="ai-panel">
            <header className="ai-header">
                <section className="ai-header-top">
                    <hgroup className="ai-header-identity">
                        <p className="ai-header-icon hud-frame" aria-hidden="true">
                            <i className="fa-solid fa-microchip"></i>
                        </p>
                        <span className="ai-header-text">
                            <h1>Análisis IA</h1>
                            <p>Entrenador virtual especializado en voleibol</p>
                        </span>
                    </hgroup>

                    <span className="ai-telemetry">
                        <p className="ai-status">
                            <span className="ai-status-dot" aria-hidden="true"></span>
                            IA conectada
                        </p>
                        
                    </span>
                </section>

                <section className="ai-context" aria-label="Contexto del deportista activo">
                    <p className="ai-context-label">
                        <i className="fa-solid fa-user-check" aria-hidden="true"></i>
                        Perfil activo
                    </p>
                    {PERFIL_DEPORTISTA.map((item) => (
                        <p className="ai-chip" key={item.clave}>
                            <span className="ai-chip-key">{item.clave}</span>
                            <span className="ai-chip-value">{item.valor}</span>
                        </p>
                    ))}
                </section>
            </header>

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
                                    <p className="ai-avatar" aria-hidden="true">
                                        <i className={`fa-solid ${esCoach ? 'fa-microchip' : 'fa-user'}`}></i>
                                    </p>
                                    <span className="ai-bubble-column">
                                        <span className="ai-sender">
                                            {esCoach ? (
                                                <>
                                                    VolleyAI Coach
                                                    <span className="ai-sender-badge">IA</span>
                                                </>
                                            ) : (
                                                'Tú'
                                            )}
                                        </span>

                                        <span className={`ai-bubble-wrap ${esCoach ? 'hud-frame' : ''}`}>
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
                                                    >
                                                        <i className={`fa-solid ${copiadoIndex === i ? 'fa-check' : 'fa-copy'}`}></i>
                                                    </button>
                                                    {esUltimoCoach && !escribiendo && (
                                                        <button
                                                            type="button"
                                                            className="ai-action-btn"
                                                            onClick={regenerar}
                                                            aria-label="Regenerar respuesta"
                                                            title="Regenerar"
                                                        >
                                                            <i className="fa-solid fa-rotate"></i>
                                                        </button>
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
                                <p className="ai-avatar" aria-hidden="true">
                                    <i className="fa-solid fa-microchip"></i>
                                </p>
                                <span className="ai-bubble-column">
                                    <span className="ai-sender">
                                        VolleyAI Coach
                                        <span className="ai-sender-badge">IA</span>
                                    </span>
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
                <form className="ai-input-form hud-frame" onSubmit={handleSubmit}>
                    <span className="ai-prompt-glyph" aria-hidden="true">›</span>
                    <label htmlFor={inputId}>Escribe tu pregunta para el coach</label>
                    <textarea
                        id={inputId}
                        ref={textareaRef}
                        placeholder="Escribe tu pregunta aquí... Ej: 'Cómo mejorar mi recepción'"
                        rows="1"
                        value={entrada}
                        onChange={handleChangeEntrada}
                        onKeyDown={handleKeyDown}
                        maxLength={MAX_CARACTERES}
                    ></textarea>
                    <button className="ai-send-btn" type="submit" disabled={escribiendo || !entrada.trim()}>
                        <i className="fa-solid fa-paper-plane"></i>
                        <span
                            style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
                        >
                            Enviar mensaje
                        </span>
                    </button>
                </form>

                <p className="ai-input-meta">
                    <output htmlFor={inputId} className="ai-char-count">
                        {entrada.length}/{MAX_CARACTERES}
                    </output>
                </p>

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
        </main>
    );
}