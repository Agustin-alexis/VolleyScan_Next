"use client";

import { useEffect } from "react";
import { FaXmark } from "react-icons/fa6";

// Define NEXT_PUBLIC_APP_VERSION y NEXT_PUBLIC_APP_BUILD en .env.local
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "2.4.1";
export const APP_BUILD = process.env.NEXT_PUBLIC_APP_BUILD || "241";

const FILAS = [
    ["Aplicación", "VolleyScan"],
    ["Versión", APP_VERSION],
    ["Build", APP_BUILD],
    ["Entorno", process.env.NODE_ENV === "production" ? "Producción" : "Desarrollo"],
];

export default function ModalVersion({ onClose }) {
    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal" role="dialog" aria-modal="true" aria-label="Versión de la app">
                <div className="modal__header">
                    <h3 className="modal__title">Versión de la app</h3>
                    <button className="modal__close" type="button" onClick={onClose} aria-label="Cerrar">
                        <FaXmark />
                    </button>
                </div>

                <dl className="version-list">
                    {FILAS.map(([k, v]) => (
                        <div key={k} className="version-row">
                            <dt>{k}</dt>
                            <dd>{v}</dd>
                        </div>
                    ))}
                </dl>

                <div className="modal__actions">
                    <button className="btn btn--primary" type="button" onClick={onClose}>Cerrar</button>
                </div>
            </div>
        </div>
    );
}