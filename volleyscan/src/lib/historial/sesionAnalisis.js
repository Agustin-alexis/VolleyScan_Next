// ─────────────────────────────────────────────────────────────
// sesionAnalisis.js — Arma la sesión de práctica y la envía al servidor
//
// Una sesión es todo lo que ocurre entre "Activar cámara" y "Detener".
//   1. crearSesion()              al activar la cámara
//   2. agregarRemate(sesion, rep) cada vez que el motor termina un remate
//   3. cerrarYEnviar(sesion)      al detener: la manda a POST /analisis/sesiones
//
// Si el envío falla (sin red, el servidor aún no tiene la ruta, etc.) la
// sesión queda guardada en el navegador y se reintenta sola la próxima vez
// (reenviarPendientes). El `clienteUuid` evita que un reintento duplique la
// sesión en la base de datos.
//
// ÚNICO PUNTO A ADAPTAR: la función `enviar`, abajo. Hoy manda la cookie de
// sesión (credentials: 'include'). Si tu login usa un token en el header
// Authorization, agrégalo en `headers`.
// ─────────────────────────────────────────────────────────────

const CLAVE_PENDIENTES = 'volleyscan.analisis.pendientes';
const MAX_PENDIENTES = 20;

// Dirección del backend. En .env.local:  NEXT_PUBLIC_API_URL=http://localhost:3001
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    // Respaldo para contextos sin crypto.randomUUID (http en red local)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

function leerPendientes() {
    try {
        return JSON.parse(localStorage.getItem(CLAVE_PENDIENTES) ?? '[]');
    } catch {
        return [];
    }
}

function guardarPendientes(lista) {
    try {
        localStorage.setItem(CLAVE_PENDIENTES, JSON.stringify(lista.slice(-MAX_PENDIENTES)));
    } catch {
        /* sin almacenamiento disponible: no hay nada más que hacer */
    }
}

export function crearSesion({ tecnica = 'remate', modeloIa = 'mediapipe-pose-full' } = {}) {
    return {
        clienteUuid: uuid(),
        tecnica,
        modeloIa,
        inicio: new Date().toISOString(),
        fin: null,
        repeticiones: [],
    };
}

export function agregarRemate(sesion, rep) {
    sesion.repeticiones.push({ ...rep, registradaEn: new Date().toISOString() });
}

/**
 * @returns 'enviada' | 'rechazada' | 'error'
 *   enviada   → el servidor la guardó (o ya la tenía)
 *   rechazada → el servidor dijo que la sesión es inválida (400): reintentar no sirve
 *   error     → sin red / servidor caído / sin sesión iniciada: se reintenta luego
 */
async function enviar(sesion) {
    try {
        const res = await fetch(`${API_URL}/analisis/sesiones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            keepalive: true,
            body: JSON.stringify(sesion),
        });
        if (res.ok) return 'enviada';
        if (res.status === 400) return 'rechazada';
        return 'error';
    } catch {
        return 'error';
    }
}

/**
 * Cierra la sesión y la envía. Una sesión sin remates no se envía.
 * @returns {Promise<{ estado: 'vacia' | 'enviada' | 'pendiente' | 'rechazada', remates: number }>}
 */
export async function cerrarYEnviar(sesion) {
    const remates = sesion?.repeticiones?.length ?? 0;
    if (!remates) return { estado: 'vacia', remates: 0 };

    const cerrada = { ...sesion, fin: new Date().toISOString() };
    const resultado = await enviar(cerrada);

    if (resultado === 'enviada') return { estado: 'enviada', remates };
    if (resultado === 'rechazada') return { estado: 'rechazada', remates };

    guardarPendientes([...leerPendientes(), cerrada]);
    return { estado: 'pendiente', remates };
}

/** Reintenta las sesiones que no se pudieron enviar. Devuelve cuántas quedan. */
export async function reenviarPendientes() {
    const pendientes = leerPendientes();
    if (!pendientes.length) return 0;

    const quedan = [];
    for (const sesion of pendientes) {
        const resultado = await enviar(sesion);
        if (resultado === 'error') quedan.push(sesion);
    }
    guardarPendientes(quedan);
    return quedan.length;
}

export const contarPendientes = () => leerPendientes().length;