"use client";

import { useState } from "react";
import {
    FaBook,
    FaEnvelope,
    FaBug,
    FaCircleInfo,
    FaChevronRight,
} from "react-icons/fa6";
import ModalCentroAyuda from "./ModalCentroAyuda";
import ModalSoporte from "./ModalSoporte";
import ModalVersion, { APP_VERSION, APP_BUILD } from "./ModalVersion";
import "./SeccionAyuda.css";

const AYUDA = [
    { id: "centro", Icon: FaBook, titulo: "Centro de ayuda", desc: "Guías y preguntas frecuentes" },
    { id: "contacto", Icon: FaEnvelope, titulo: "Contactar soporte", desc: "soporte@volleyscan.app" },
    { id: "reporte", Icon: FaBug, titulo: "Reportar un problema", desc: "Cuéntanos qué no funciona" },
    { id: "version", Icon: FaCircleInfo, titulo: "Versión de la app", desc: `VolleyScan v${APP_VERSION} · Build ${APP_BUILD}` },
];

export default function SeccionAyuda({ showToast }) {
    const [abierto, setAbierto] = useState(null);
    const cerrar = () => setAbierto(null);

    return (
        <section className="config-section active">
            <h2 className="config-section__title">Ayuda y soporte</h2>

            <ul className="help-list">
                {AYUDA.map(({ id, Icon, titulo, desc }) => (
                    <li
                        key={id}
                        className="help-item"
                        role="button"
                        tabIndex={0}
                        onClick={() => setAbierto(id)}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setAbierto(id)}
                    >
                        <div className="help-item__icon"><Icon /></div>

                        <div className="help-item__info">
                            <p className="help-item__title">{titulo}</p>
                            <p className="help-item__desc">{desc}</p>
                        </div>

                        <FaChevronRight className="help-item__arrow" />
                    </li>
                ))}
            </ul>

            {abierto === "centro" && <ModalCentroAyuda onClose={cerrar} />}
            {abierto === "version" && <ModalVersion onClose={cerrar} />}
            {(abierto === "contacto" || abierto === "reporte") && (
                <ModalSoporte modo={abierto} onClose={cerrar} showToast={showToast} />
            )}
        </section>
    );
}