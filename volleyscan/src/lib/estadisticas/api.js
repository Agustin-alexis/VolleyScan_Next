/**
 * lib/estadisticas/api.js — Estadísticas del entrenador (KPIs, evolución, ranking, alertas).
 * Reutiliza `llamar` del historial: mismo token, prefijo /api/ia y nunca lanza.
 * Manda el desfase horario del navegador para que los "días" se cuenten en tu hora local.
 *
 * @param {7|30|90|180} dias  periodo que termina hoy
 */
import { llamar } from "@/lib/historial/api";

export const estadisticasEntrenador = (dias = 30) =>
    llamar(`/estadisticas/entrenador?dias=${dias}&tz=${new Date().getTimezoneOffset()}`);