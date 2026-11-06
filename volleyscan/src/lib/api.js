const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export function getToken() {
    return typeof window === "undefined" ? null : localStorage.getItem("vs_token");
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
    localStorage.setItem("vs_token", access);
    localStorage.setItem("vs_usuario", JSON.stringify(usuario));
}

export function cerrarSesion() {
    localStorage.removeItem("vs_token");
    localStorage.removeItem("vs_usuario");
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
    const esForm = typeof FormData !== "undefined" && body instanceof FormData;
    const res = await fetch(url, {
        method,
        headers: {
            ...(body && !esForm ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        // 👇 AQUÍ ESTABA EL DETALLE: si es FormData, se envía tal cual
        body: body ? (esForm ? body : JSON.stringify(body)) : undefined,
    });

    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);

    if (res.status === 401 && token) {
        // token vencido o inválido
        cerrarSesion();
        window.location.href = "/login";
    }
    if (!res.ok) throw new ApiError(res.status, data);
    return data;
}

const ORIGEN = new URL(API).origin;

// La base guarda "/media/fotos/x.jpg"; hay que apuntarla al backend, no al front
export function urlFoto(ruta) {
    if (!ruta) return null;
    return /^https?:\/\//.test(ruta) ? ruta : `${ORIGEN}${ruta}`;
}

// Actualiza el usuario guardado al iniciar sesión y avisa al Sidebar
export function actualizarUsuario(parcial) {
    const actual = getUsuario();
    if (!actual) return;
    localStorage.setItem("vs_usuario", JSON.stringify({ ...actual, ...parcial }));
    window.dispatchEvent(new Event("usuario:cambio"));
}

// Cierra la sesión en el servidor (marca el dispositivo como inactivo) y luego en el navegador
export async function cerrarSesionCompleta() {
    try {
        await api("/usuario/dispositivos/cerrar-actual/", { method: "POST" });
    } catch {
        // si falla (token ya vencido, sin red), igual se cierra localmente
    }
    cerrarSesion();
}