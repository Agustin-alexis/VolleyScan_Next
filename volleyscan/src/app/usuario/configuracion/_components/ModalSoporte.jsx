"use client";

import { useEffect, useState } from "react";
import { FaXmark, FaPaperPlane, FaChevronDown } from "react-icons/fa6";
import { api } from "@/lib/api";

// true = envío simulado (setTimeout). Cambiar a false cuando exista el endpoint en Django.
const SIMULAR = true;

const CONFIG = {
    contacto: {
        titulo: "Contactar soporte",
        intro: "Escríbenos y te responderemos al correo de tu cuenta.",
        boton: "Enviar mensaje",
        ok: "Mensaje enviado. Te responderemos pronto.",
        tipos: null,
    },
    reporte: {
        titulo: "Reportar un problema",
        intro: "Cuéntanos qué no funciona para poder corregirlo.",
        boton: "Enviar reporte",
        ok: "Reporte enviado. ¡Gracias por avisarnos!",
        tipos: [
            { value: "error", label: "Algo no funciona" },
            { value: "analisis", label: "Problema con el análisis IA" },
            { value: "sugerencia", label: "Sugerencia" },
            { value: "otro", label: "Otro" },
        ],
    },
};

const MAX = 500;

export default function ModalSoporte({ modo, onClose, showToast }) {
    const cfg = CONFIG[modo];
    const [tipo, setTipo] = useState(cfg.tipos ? cfg.tipos[0].value : "contacto");
    const [asunto, setAsunto] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && !enviando && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose, enviando]);

    async function enviar() {
        if (asunto.trim().length < 3) return setError("Escribe un asunto (mínimo 3 caracteres).");
        if (mensaje.trim().length < 10) return setError("Cuéntanos un poco más (mínimo 10 caracteres).");
        setError("");
        setEnviando(true);

        try {
            if (SIMULAR) {
                await new Promise((r) => setTimeout(r, 900));
            } else {
                await api("/usuario/soporte/", {
                    method: "POST",
                    body: {
                        modo,
                        tipo,
                        asunto: asunto.trim(),
                        mensaje: mensaje.trim(),
                        pagina: window.location.pathname,
                        navegador: navigator.userAgent,
                    },
                });
            }
            showToast(cfg.ok, "success");
            onClose();
        } catch {
            setError("No se pudo enviar. Inténtalo de nuevo en un momento.");
            setEnviando(false);
        }
    }

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !enviando && onClose()}>
            <div className="modal modal--lg" role="dialog" aria-modal="true" aria-label={cfg.titulo}>
                <div className="modal__header">
                    <h3 className="modal__title">{cfg.titulo}</h3>
                    <button className="modal__close" type="button" onClick={onClose} disabled={enviando} aria-label="Cerrar">
                        <FaXmark />
                    </button>
                </div>

                <p className="modal__body">{cfg.intro}</p>

                <div className="soporte-form">
                    {cfg.tipos && (
                        <div className="soporte-field">
                            <label className="setting-label" htmlFor="soporte-tipo">Tipo</label>
                            <div className="select-wrap select-wrap--full">
                                <select className="field-select" id="soporte-tipo" value={tipo}
                                    onChange={(e) => setTipo(e.target.value)}>
                                    {cfg.tipos.map((t) => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                                <FaChevronDown className="select-icon" />
                            </div>
                        </div>
                    )}

                    <div className="soporte-field">
                        <label className="setting-label" htmlFor="soporte-asunto">Asunto</label>
                        <input className="field-input soporte-input" id="soporte-asunto" type="text"
                            maxLength={100} value={asunto} onChange={(e) => setAsunto(e.target.value)} />
                    </div>

                    <div className="soporte-field">
                        <label className="setting-label" htmlFor="soporte-mensaje">
                            {modo === "reporte" ? "¿Qué pasó?" : "Mensaje"}
                        </label>
                        <textarea className="field-input soporte-input soporte-textarea" id="soporte-mensaje"
                            rows={5} maxLength={MAX} value={mensaje}
                            onChange={(e) => setMensaje(e.target.value)} />
                        <span className="soporte-count">{mensaje.length}/{MAX}</span>
                    </div>

                    {error && <p className="soporte-error" role="alert">{error}</p>}
                </div>

                <div className="modal__actions">
                    <button className="btn btn--secondary" type="button" onClick={onClose} disabled={enviando}>
                        Cancelar
                    </button>
                    <button className="btn btn--primary" type="button" onClick={enviar} disabled={enviando}>
                        <FaPaperPlane />
                        {enviando ? "Enviando…" : cfg.boton}
                    </button>
                </div>
            </div>
        </div>
    );
}