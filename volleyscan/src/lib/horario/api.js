/**
 * lib/horario/api.js — Horario del entrenador y agenda del deportista.
 * Reutiliza `llamar` del historial: mismo token (Bearer), prefijo /api/ia y nunca lanza.
 * Todas devuelven { ok, status, data }; en error, data.detail trae el motivo.
 * Las fechas son "AAAA-MM-DD" y las horas "HH:MM" en hora local del evento (sin zonas horarias).
 */
import { llamar } from "@/lib/historial/api";

export { mensajeDeError } from "@/lib/vinculos/api";

const rango = (desde, hasta) => `?desde=${desde}&hasta=${hasta}`;

// Entrenador
export const listarEventos = (desde, hasta) => llamar(`/horario${rango(desde, hasta)}`);
export const crearEvento = (datos) => llamar("/horario", { metodo: "POST", cuerpo: datos });
export const editarEvento = (id, datos) => llamar(`/horario/${id}`, { metodo: "PUT", cuerpo: datos });
export const borrarEvento = (id) => llamar(`/horario/${id}`, { metodo: "DELETE" });

// Asistencia (entrenador)
export const asistenciaDeEvento = (id) => llamar(`/horario/${id}/asistencia`);
export const guardarAsistencia = (id, registros) => llamar(`/horario/${id}/asistencia`, { metodo: "PUT", cuerpo: { registros } });

// Deportista
export const miAgenda = (desde, hasta) => llamar(`/mi-horario${rango(desde, hasta)}`);

/** Fecha local → "AAAA-MM-DD" */
export const fechaISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
