"use client";

import {
    FaBook,
    FaEnvelope,
    FaBug,
    FaCircleInfo,
    FaChevronRight,
} from "react-icons/fa6";

const AYUDA = [
    { Icon: FaBook, titulo: "Centro de ayuda", desc: "Guías y preguntas frecuentes" },
    { Icon: FaEnvelope, titulo: "Contactar soporte", desc: "soporte@volleyscan.app" },
    { Icon: FaBug, titulo: "Reportar un problema", desc: "Cuéntanos qué no funciona" },
    { Icon: FaCircleInfo, titulo: "Versión de la app", desc: "VolleyScan v2.4.1 · Build 241" },
];

export default function SeccionAyuda({ showToast }) {
    return (
        <section className="config-section active">
            <h2 className="config-section__title">Ayuda y soporte</h2>

            <ul className="help-list">
                {AYUDA.map(({ Icon, titulo, desc }) => (
                    <li key={titulo} className="help-item"
                        onClick={() => showToast(`Abriendo: ${titulo}…`, "info")}>
                        <div className="help-item__icon"><Icon /></div>

                        <div className="help-item__info">
                            <p className="help-item__title">{titulo}</p>
                            <p className="help-item__desc">{desc}</p>
                        </div>

                        <FaChevronRight className="help-item__arrow" />
                    </li>
                ))}
            </ul>
        </section>
    );
}