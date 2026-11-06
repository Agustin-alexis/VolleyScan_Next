// ─────────────────────────────────────────────────────────────
// api.js — Vínculos atleta-entrenador
//
// Reutiliza el cliente del historial (lib/historial/api.js): mismo token
// (localStorage "vs_token", Bearer) y mismo prefijo /ia. No hay nada que ajustar.
// Todas devuelven { ok, status, data }; en error, data.detail trae el motivo.
// ─────────────────────────────────────────────────────────────

import { llamar } from '@/lib/historial/api';

// Atleta
export const listarEntrenadores = (q) =>
  llamar(`/vinculos/entrenadores${q ? `?q=${encodeURIComponent(q)}` : ''}`);
export const miEntrenador = () => llamar('/vinculos/mi-entrenador');
export const solicitarEntrenador = (entrenadorId) =>
  llamar('/vinculos/solicitudes', { metodo: 'POST', cuerpo: { entrenadorId } });
export const cancelarOSalir = () => llamar('/vinculos/mi-entrenador', { metodo: 'DELETE' });

// Entrenador
export const listarDeportistas = () => llamar('/vinculos/deportistas');
export const listarSolicitudes = () => llamar('/vinculos/solicitudes-recibidas');
export const responderSolicitud = (vinculoId, accion) =>
  llamar(`/vinculos/solicitudes/${vinculoId}/responder`, { metodo: 'POST', cuerpo: { accion } });
export const retirarDeportista = (atletaId) =>
  llamar(`/vinculos/deportistas/${atletaId}`, { metodo: 'DELETE' });

// Ficha del deportista (el servidor solo responde si el vínculo está aceptado)
export const fichaDeportista = (atletaId) => llamar(`/vinculos/deportistas/${atletaId}`);
export const sesionesDeDeportista = (atletaId) => llamar(`/vinculos/deportistas/${atletaId}/sesiones`);
export const sesionDeDeportista = (atletaId, sesionId) =>
  llamar(`/vinculos/deportistas/${atletaId}/sesiones/${sesionId}`);
export const revisarSesion = (atletaId, sesionId, revisada) =>
  llamar(`/vinculos/deportistas/${atletaId}/sesiones/${sesionId}/revision`, { metodo: 'POST', cuerpo: { revisada } });

/** Mensaje para mostrar al usuario a partir de una respuesta fallida. */
export function mensajeDeError(r) {
  if (r?.data?.detail) return r.data.detail;
  if (r?.status === 0) return 'No hay conexión con el servidor.';
  if (r?.status === 401) return 'Tu sesión venció. Vuelve a iniciar sesión.';
  return 'Ocurrió un error inesperado.';
}
