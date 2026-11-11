/**
 * lib/partidos/api.js — Registro de partidos (resultado + estadísticas por jugador).
 * Reutiliza `llamar` del historial: mismo token (Bearer), prefijo /api/ia y nunca lanza ({ ok, status, data }).
 */
import { llamar } from "@/lib/historial/api";

export { mensajeDeError } from "@/lib/vinculos/api";

// Entrenador
export const listarPartidos = (equipoId = null) => llamar(`/partidos${equipoId ? `?equipo=${equipoId}` : ""}`);
export const detallePartido = (id) => llamar(`/partidos/${id}`);
export const plantillaPartido = (equipoId) => llamar(`/partidos/equipo/${equipoId}/plantilla`);
export const crearPartido = (datos) => llamar("/partidos", { metodo: "POST", cuerpo: datos });
export const editarPartido = (id, datos) => llamar(`/partidos/${id}`, { metodo: "PUT", cuerpo: datos });
export const borrarPartido = (id) => llamar(`/partidos/${id}`, { metodo: "DELETE" });

// Deportista (solo lo suyo)
export const misPartidos = () => llamar("/mis-partidos");

/** Campos numéricos de estadística, en el orden en que se muestran en el formulario. */
export const CAMPOS_STAT = [
    { k: "ataquesExitosos", t: "Ataques +", ayuda: "Ataques que terminaron en punto" },
    { k: "ataquesFallidos", t: "Ataques −", ayuda: "Ataques fallados o bloqueados" },
    { k: "bloqueos", t: "Bloqueos", ayuda: "Bloqueos que suman punto" },
    { k: "saquesExitosos", t: "Aces", ayuda: "Saques directos a punto" },
    { k: "saquesFallidos", t: "Saque ✗", ayuda: "Errores de saque" },
    { k: "recepcionesExitosas", t: "Recep. +", ayuda: "Recepciones buenas" },
    { k: "recepcionesFalladas", t: "Recep. −", ayuda: "Recepciones falladas" },
    { k: "erroresNoForzados", t: "Errores", ayuda: "Errores no forzados" },
];
