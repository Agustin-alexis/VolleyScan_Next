/**
 * lib/avisos/api.js — Cliente de los avisos / notificaciones.
 * Reutiliza `llamar` del historial: mismo token, mismo prefijo /api/ia y nunca lanza.
 *
 * `todas: true` (página usuario/notificaciones) actúa sobre TODAS las notificaciones del
 * usuario; sin él (campana) solo sobre los avisos de vínculos y revisiones.
 */
import { llamar } from "@/lib/historial/api";

const q = (todas) => (todas ? "?todas=1" : "");

export const listarAvisos = ({ soloNoLeidas = false, limite = 30, todas = false } = {}) =>
    llamar(`/avisos?limite=${limite}${soloNoLeidas ? "&soloNoLeidas=1" : ""}${todas ? "&todas=1" : ""}`);

export const contadorAvisos = ({ todas = false } = {}) => llamar(`/avisos/contador${q(todas)}`);

export const marcarAviso = (id, { todas = false } = {}) =>
    llamar(`/avisos/${id}/leida${q(todas)}`, { metodo: "POST", cuerpo: {} });

export const marcarTodosLosAvisos = ({ todas = false } = {}) =>
    llamar(`/avisos/leer-todas${q(todas)}`, { metodo: "POST", cuerpo: {} });

export const eliminarAviso = (id) => llamar(`/avisos/${id}`, { metodo: "DELETE" });

export const eliminarTodosLosAvisos = ({ todas = false } = {}) =>
    llamar(`/avisos${q(todas)}`, { metodo: "DELETE" });
