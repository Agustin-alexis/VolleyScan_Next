// ─────────────────────────────────────────────────────────────
// api.js — Cliente del historial (Django REST)
//
// Usa el mismo token que tu login: localStorage "vs_token", enviado como
// "Authorization: Bearer <token>". Misma dirección por defecto que tu api.js.
// ─────────────────────────────────────────────────────────────

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/api').replace(/\/$/, '');

// Prefijo propio del historial de IA: en Django se monta en path("api/ia/", include("analisis.urls")),
// así no choca con las rutas de tu app `historial`.
const PREFIJO = '/ia';

export function obtenerToken() {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage.getItem('vs_token');
    } catch {
        return null; // almacenamiento bloqueado
    }
}

export function cabeceras(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    const t = obtenerToken();
    if (t) h.Authorization = `Bearer ${t}`;
    return h;
}

/** Llama al backend. Devuelve { ok, status, data }. Nunca lanza. */
export async function llamar(ruta, { metodo = 'GET', cuerpo, keepalive = false } = {}) {
    try {
        const res = await fetch(`${API_URL}${PREFIJO}${ruta}`, {
            method: metodo,
            headers: cabeceras(),
            keepalive,
            body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        });
        let data = null;
        if (res.status !== 204) {
            try { data = await res.json(); } catch { /* sin cuerpo */ }
        }
        return { ok: res.ok, status: res.status, data };
    } catch {
        return { ok: false, status: 0, data: null };
    }
}

export const listarSesiones = () => llamar('/analisis/sesiones');
export const obtenerSesion = (id) => llamar(`/analisis/sesiones/${id}`);
export const obtenerEstadisticas = () => llamar('/analisis/estadisticas');
export const eliminarSesion = (id) => llamar(`/analisis/sesiones/${id}`, { metodo: 'DELETE' });