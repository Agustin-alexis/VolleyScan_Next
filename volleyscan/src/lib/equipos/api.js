/**
 * lib/equipos/api.js — Equipos del entrenador e invitaciones.
 * Reutiliza `llamar` del historial: mismo token (Bearer), prefijo /api/ia y nunca lanza.
 * Todas devuelven { ok, status, data }; en error, data.detail trae el motivo.
 */
import { llamar } from "@/lib/historial/api";

const json = (metodo, cuerpo = {}) => ({ metodo, cuerpo });

// ── Entrenador ──
export const listarEquipos = () => llamar("/equipos");
export const detalleEquipo = (id) => llamar(`/equipos/${id}`);
export const crearEquipo = (datos) => llamar("/equipos", json("POST", datos));
export const editarEquipo = (id, datos) => llamar(`/equipos/${id}`, json("PUT", datos));
export const archivarEquipo = (id) => llamar(`/equipos/${id}`, { metodo: "DELETE" });

export const invitar = (equipoId, tipo, email) =>
    llamar(`/equipos/${equipoId}/invitaciones`, json("POST", { tipo, email }));
export const reenviarInvitacion = (equipoId, invId) =>
    llamar(`/equipos/${equipoId}/invitaciones/${invId}/reenviar`, json("POST"));
export const revocarInvitacion = (equipoId, invId) =>
    llamar(`/equipos/${equipoId}/invitaciones/${invId}`, { metodo: "DELETE" });

export const editarDeportistaEquipo = (equipoId, atletaId, datos) =>
    llamar(`/equipos/${equipoId}/deportistas/${atletaId}`, json("PUT", datos));
export const quitarDeportistaEquipo = (equipoId, atletaId) =>
    llamar(`/equipos/${equipoId}/deportistas/${atletaId}`, { metodo: "DELETE" });
export const quitarEntrenadorEquipo = (equipoId, entrenadorId) =>
    llamar(`/equipos/${equipoId}/entrenadores/${entrenadorId}`, { metodo: "DELETE" });

// ── Deportista ──
export const misEquipos = () => llamar("/mis-equipos");

// ── Cualquier usuario con sesión: invitaciones dirigidas a su correo ──
export const misInvitaciones = () => llamar("/invitaciones/mias");
export const responderInvitacion = (invId, accion) => llamar(`/invitaciones/${invId}/${accion}`, json("POST")); // accion: "aceptar" | "rechazar"

// ── Enlace del correo ──
export const previsualizarInvitacion = (token) => llamar(`/invitaciones/enlace/${token}`);
export const responderPorEnlace = (token, accion) => llamar(`/invitaciones/enlace/${token}/${accion}`, json("POST"));

export { mensajeDeError } from "@/lib/vinculos/api";
