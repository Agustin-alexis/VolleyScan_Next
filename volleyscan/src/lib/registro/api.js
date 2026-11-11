/**
 * lib/registro/api.js — Registro de rutinas cumplidas, revisión del entrenador y niveles.
 * Reutiliza `llamar` del historial: mismo token (Bearer), prefijo /api/ia y nunca lanza ({ ok, status, data }).
 * Manda el desfase horario del navegador para que "a tiempo / tarde" se cuente en tu hora local.
 */
import { llamar } from "@/lib/historial/api";

export { mensajeDeError } from "@/lib/vinculos/api";

const tz = () => new Date().getTimezoneOffset();

export const NIVELES = ["principiante", "intermedio", "avanzado", "profesional"];
export const NOMBRE_NIVEL = { principiante: "Principiante", intermedio: "Intermedio", avanzado: "Avanzado", profesional: "Profesional", todos: "Todos los niveles" };

// Entrenador
export function registroRutinas({ estado = "todas", atleta = null, equipo = null, desde = "", hasta = "" } = {}) {
    const p = new URLSearchParams({ estado, tz: String(tz()) });
    if (atleta) p.set("atleta", atleta);
    if (equipo) p.set("equipo", equipo);
    if (desde) p.set("desde", desde);
    if (hasta) p.set("hasta", hasta);
    return llamar(`/registro-rutinas?${p}`);
}
export const detalleRegistro = (id) => llamar(`/registro-rutinas/${id}?tz=${tz()}`);
export const revisarRutina = (id, datos) => llamar(`/registro-rutinas/${id}/revision?tz=${tz()}`, { metodo: "PUT", cuerpo: datos });
export const nivelesDeportistas = (equipo = null) => llamar(`/niveles/deportistas?tz=${tz()}${equipo ? `&equipo=${equipo}` : ""}`);
export const nivelDeDeportista = (id) => llamar(`/niveles/deportistas/${id}?tz=${tz()}`);
export const cambiarNivel = (id, datos) => llamar(`/niveles/deportistas/${id}?tz=${tz()}`, { metodo: "PUT", cuerpo: datos });

// Deportista (solo lo suyo)
export const miNivel = () => llamar(`/mi-nivel?tz=${tz()}`);
