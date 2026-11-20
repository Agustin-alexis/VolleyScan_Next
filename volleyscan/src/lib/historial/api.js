// ─────────────────────────────────────────────────────────────
// api.js — Cliente del historial de IA con JWT de Supabase Auth
//
// Envía el token JWT ("Authorization: Bearer <token>") y el ID del usuario
// autenticado ("X-User-Id"), combinando la respuesta del backend FastAPI/Django
// con el historial sincronizado del usuario.
// ─────────────────────────────────────────────────────────────

import { getToken, getUsuario } from '@/lib/api';
import {
    eliminarSesionLocalUsuario,
    leerHistorialLocalUsuario,
} from './sesionAnalisis';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/api').replace(/\/$/, '');
const PREFIJO = '/ia';

export function obtenerToken() {
    return getToken();
}

export function cabeceras(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    const t = obtenerToken();
    const u = getUsuario();
    if (t) h.Authorization = `Bearer ${t}`;
    if (u?.id) h['X-User-Id'] = String(u.id);
    return h;
}

/** Llama al backend enviando el JWT de Supabase Auth. Devuelve { ok, status, data }. */
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
            try {
                data = await res.json();
            } catch {
                /* sin cuerpo */
            }
        }
        return { ok: res.ok, status: res.status, data };
    } catch {
        return { ok: false, status: 0, data: null };
    }
}

export async function listarSesiones() {
    const r = await llamar('/analisis/sesiones');
    const locales = leerHistorialLocalUsuario();
    if (r.ok && Array.isArray(r.data)) {
        const idsRemotos = new Set(r.data.map((x) => x.id));
        const combinadas = [...r.data, ...locales.filter((x) => !idsRemotos.has(x.id))];
        return { ok: true, status: 200, data: combinadas };
    }
    return { ok: true, status: 200, data: locales };
}

export async function obtenerSesion(id) {
    const r = await llamar(`/analisis/sesiones/${id}`);
    if (r.ok && r.data) return r;
    const local = leerHistorialLocalUsuario().find((x) => String(x.id) === String(id));
    if (local) return { ok: true, status: 200, data: local };
    return r;
}

export const obtenerEstadisticas = () => llamar('/analisis/estadisticas');

export async function eliminarSesion(id) {
    eliminarSesionLocalUsuario(id);
    const r = await llamar(`/analisis/sesiones/${id}`, { metodo: 'DELETE' });
    if (r.ok) return r;
    return { ok: true, status: 204, data: null };
}
