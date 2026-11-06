/**
 * lib/rutinas/api.js — Rutinas que el entrenador asigna a sus deportistas.
 * Reutiliza `llamar` del historial: mismo token, mismo prefijo /api/ia y nunca lanza.
 */
import { llamar } from "@/lib/historial/api";

export const listarRutinas = () => llamar("/rutinas/entrenador");

/** `datos.atletaIds` es una lista: una sola rutina por cada deportista elegido. */
export const crearRutinas = (datos) => llamar("/rutinas/entrenador", { metodo: "POST", cuerpo: datos });

export const editarRutina = (id, datos) => llamar(`/rutinas/entrenador/${id}`, { metodo: "PUT", cuerpo: datos });

export const eliminarRutina = (id) => llamar(`/rutinas/entrenador/${id}`, { metodo: "DELETE" });
