"use client";

import { useState } from "react";
import {
    FaMobileScreenButton,
    FaLaptop,
    FaTabletScreenButton,
    FaRightFromBracket,
} from "react-icons/fa6";

/* Simulados: no existe tabla de dispositivos en el backend */
const DISPOSITIVOS_INICIALES = [
    { id: 1, nombre: "iPhone 14 Pro", Icon: FaMobileScreenButton, meta: "hoy, 10:32 a.m. · Bogotá, CO", actual: true },
    { id: 2, nombre: "MacBook Pro", Icon: FaLaptop, meta: "ayer, 08:15 p.m. · Cali, CO", actual: false },
    { id: 3, nombre: "iPad Air", Icon: FaTabletScreenButton, meta: "hace 3 días · Medellín, CO", actual: false },
];

export default function SeccionDispositivos({ setModal, showToast }) {
    const [dispositivos, setDispositivos] = useState(DISPOSITIVOS_INICIALES);

    function cerrarEn(dispositivo) {
        setModal({
            message: `¿Cerrar sesión en ${dispositivo.nombre}?`,
            confirmar: "Cerrar sesión",
            onConfirm: () => {
                setDispositivos((d) => d.filter((x) => x.id !== dispositivo.id));
                showToast(`Sesión cerrada en ${dispositivo.nombre}.`);
            },
        });
    }

    function cerrarEnTodos() {
        setModal({
            message: "¿Cerrar sesión en todos los dispositivos?",
            confirmar: "Cerrar sesión",
            onConfirm: () => {
                setDispositivos((d) => d.filter((x) => x.actual));
                showToast("Sesión cerrada en todos los dispositivos.");
            },
        });
    }

    return (
        <section className="config-section active">
            <h2 className="config-section__title">Dispositivos conectados</h2>

            <ul className="device-list">
                {dispositivos.map(({ id, nombre, Icon, meta, actual }) => (
                    <li key={id} className="device-item">
                        <div className="device-item__icon"><Icon /></div>

                        <div className="device-item__info">
                            <p className="device-item__name">{nombre}</p>
                            <p className="device-item__meta">Último acceso: {meta}</p>
                        </div>

                        {actual ? (
                            <span className="device-badge">Este dispositivo</span>
                        ) : (
                            <button className="btn btn--danger-outline btn--sm" type="button"
                                onClick={() => cerrarEn({ id, nombre })}>
                                Cerrar sesión
                            </button>
                        )}
                    </li>
                ))}
            </ul>

            <div className="form-actions" style={{ marginTop: 20 }}>
                <button className="btn btn--danger-outline" type="button"
                    onClick={cerrarEnTodos}>
                    <FaRightFromBracket /> Cerrar sesión en todos los dispositivos
                </button>
            </div>
        </section>
    );
}