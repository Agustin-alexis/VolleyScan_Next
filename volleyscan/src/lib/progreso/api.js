/**
 * lib/progreso/api.js — Progreso del deportista (racha, semana, análisis, rutinas, logros).
 * Reutiliza `llamar` del historial: mismo token, prefijo /api/ia y nunca lanza.
 * Manda el desfase horario del navegador para que los "días" se cuenten en tu hora local.
 */
import { llamar } from "@/lib/historial/api";

export const miProgreso = () => llamar(`/progreso?tz=${new Date().getTimezoneOffset()}`);
