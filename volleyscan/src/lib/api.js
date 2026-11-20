import {
    cerrarSesionSupabase,
    sincronizarSesionCliente,
} from '@/lib/supabase';

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export function getToken() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("vs_token") || sessionStorage.getItem("vs_token");
}

export function getUsuario() {
    if (typeof window === "undefined") return null;
    try {
        return JSON.parse(localStorage.getItem("vs_usuario"));
    } catch {
        return null;
    }
}

export function guardarSesion({ access, usuario }) {
    sincronizarSesionCliente({ access, usuario });
}

export function cerrarSesion() {
    cerrarSesionSupabase();
}

export class ApiError extends Error {
    constructor(status, data) {
        super(data?.detail ?? "Error en la solicitud");
        this.status = status;
        this.data = data; // errores por campo: { campo: ["mensaje"] }
    }
}

export async function api(ruta, { method = "GET", body, params } = {}) {
    const url = new URL(`${API}${ruta}`);
    Object.entries(params ?? {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    });

    const token = getToken();
    const usuario = getUsuario();
    const esForm = typeof FormData !== "undefined" && body instanceof FormData;
    const res = await fetch(url, {
        method,
        headers: {
            ...(body && !esForm ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(usuario?.id ? { "X-User-Id": String(usuario.id) } : {}),
        },
        body: body ? (esForm ? body : JSON.stringify(body)) : undefined,
    });

    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);

    if (res.status === 401 && token) {
        cerrarSesion();
        window.location.href = "/login";
    }
    if (!res.ok) throw new ApiError(res.status, data);
    return data;
}

const ORIGEN = new URL(API).origin;

export function urlFoto(ruta) {
    if (!ruta) return null;
    return /^https?:\/\//.test(ruta) ? ruta : `${ORIGEN}${ruta}`;
}

export function actualizarUsuario(parcial) {
    const actual = getUsuario();
    if (!actual) return;
    const actualizado = { ...actual, ...parcial };
    localStorage.setItem("vs_usuario", JSON.stringify(actualizado));
    window.dispatchEvent(new Event("usuario:cambio"));
}
