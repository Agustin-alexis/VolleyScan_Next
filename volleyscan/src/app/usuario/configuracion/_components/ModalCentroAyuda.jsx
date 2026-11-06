"use client";

import { useEffect, useMemo, useState } from "react";
import { FaXmark, FaMagnifyingGlass } from "react-icons/fa6";

// Edita este arreglo con tus propias preguntas
const FAQ = [
    {
        q: "¿Cómo hago mi primer análisis con IA?",
        a: "Entra a Análisis IA, permite el acceso a la cámara, ubícate de cuerpo completo frente a ella y pulsa Iniciar. Al terminar, el resultado queda guardado en tu historial de sesiones.",
    },
    {
        q: "La cámara no se activa, ¿qué hago?",
        a: "Revisa que el navegador tenga permiso para usar la cámara (ícono del candado junto a la URL) y que ninguna otra aplicación la esté usando. También puedes revisar tus dispositivos en Configuración → Dispositivos.",
    },
    {
        q: "¿Dónde veo mi progreso?",
        a: "En la sección Progreso encuentras tus estadísticas y la evolución de tus sesiones. Los datos se actualizan cada vez que finalizas un análisis.",
    },
    {
        q: "¿Quién puede ver mis datos?",
        a: "Tú decides en Configuración → Privacidad. Puedes mostrarlos solo a ti, a tu entrenador, a tu equipo o a todos.",
    },
    {
        q: "Mi entrenador no ve mis sesiones",
        a: "Verifica que tu visibilidad esté en “Mi entrenador” o “Mi equipo”. Si el problema continúa, repórtalo desde esta misma sección.",
    },
    {
        q: "Olvidé mi contraseña",
        a: "En la pantalla de inicio de sesión pulsa “¿Olvidaste tu contraseña?”. Te enviaremos un enlace al correo para crear una nueva.",
    },
];

export default function ModalCentroAyuda({ onClose }) {
    const [busqueda, setBusqueda] = useState("");

    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const resultados = useMemo(() => {
        const t = busqueda.trim().toLowerCase();
        if (!t) return FAQ;
        return FAQ.filter((f) => f.q.toLowerCase().includes(t) || f.a.toLowerCase().includes(t));
    }, [busqueda]);

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal modal--lg" role="dialog" aria-modal="true" aria-label="Centro de ayuda">
                <div className="modal__header">
                    <h3 className="modal__title">Centro de ayuda</h3>
                    <button className="modal__close" type="button" onClick={onClose} aria-label="Cerrar">
                        <FaXmark />
                    </button>
                </div>

                <div className="faq-search">
                    <FaMagnifyingGlass className="faq-search__icon" />
                    <input
                        className="field-input soporte-input faq-search__input"
                        type="text"
                        placeholder="Buscar en preguntas frecuentes…"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                    />
                </div>

                <div className="faq-list">
                    {resultados.length === 0 && (
                        <p className="faq-empty">No encontramos resultados. Prueba con otra palabra o contacta a soporte.</p>
                    )}
                    {resultados.map((f) => (
                        <details key={f.q} className="faq-item">
                            <summary className="faq-item__q">{f.q}</summary>
                            <p className="faq-item__a">{f.a}</p>
                        </details>
                    ))}
                </div>
            </div>
        </div>
    );
}