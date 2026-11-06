// Cliente del backend Django (login, registro y panel del entrenador).
// El chat con la IA (FastAPI) sigue en api.js.
//
// IMPORTANTE: la sesión se guarda en localStorage con las MISMAS claves que usa
// @/lib/api (vs_token y vs_usuario). Antes se guardaba en sessionStorage y el
// resto de la app (dashboard, rutinas, historial) no encontraba el token.
import { guardarSesion, getToken, cerrarSesion as cerrarSesionBase } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8001/api'

export class ErrorApi extends Error {
    constructor(mensaje, estado, datos) {
        super(mensaje)
        this.name = 'ErrorApi'
        this.status = estado // 0 = no se pudo conectar
        this.datos = datos // cuerpo de la respuesta (errores por campo, etc.)
        this.data = datos // alias, igual que ApiError de @/lib/api
    }
}

export function obtenerToken() {
    return getToken()
}

export function cerrarSesion() {
    cerrarSesionBase()
    if (typeof window === 'undefined') return
    // Limpia también las claves antiguas por si quedaron de versiones anteriores
    ;['vs_token', 'vs_rol', 'vs_nombre'].forEach((k) => sessionStorage.removeItem(k))
}

async function leerRespuesta(respuesta) {
    const texto = await respuesta.text()
    if (!texto) return null
    try {
        return JSON.parse(texto)
    } catch {
        return texto
    }
}

/**
 * Llama al backend. Ejemplos:
 *   await apiFetch('/panel/equipos')
 *   await apiFetch('/panel/equipos', { metodo: 'POST', cuerpo: { nombre: 'Sub-17' } })
 * Si el servidor responde con error lanza ErrorApi (error.status, error.datos).
 */
export async function apiFetch(ruta, { metodo = 'GET', cuerpo, token = obtenerToken() } = {}) {
    const cabeceras = { Accept: 'application/json' }
    if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json'
    if (token) cabeceras.Authorization = `Bearer ${token}`

    let respuesta
    try {
        respuesta = await fetch(`${API_URL}${ruta}`, {
            method: metodo,
            headers: cabeceras,
            body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
        })
    } catch {
        throw new ErrorApi('No se pudo conectar con el servidor.', 0, null)
    }

    const datos = await leerRespuesta(respuesta)
    if (!respuesta.ok) {
        // Token vencido o inválido: se limpia la sesión guardada.
        if (respuesta.status === 401 && token) cerrarSesion()
        const mensaje =
            datos && typeof datos === 'object' && datos.detail ? datos.detail : 'Error en la petición.'
        throw new ErrorApi(mensaje, respuesta.status, datos)
    }
    return datos
}

/** Guarda la sesión (localStorage, formato de @/lib/api) y devuelve el usuario. */
function abrirSesion(datos) {
    guardarSesion(datos) // vs_token + vs_usuario
    return datos.usuario
}

/** Inicia sesión y devuelve el usuario. */
export async function iniciarSesion(email, password) {
    const datos = await apiFetch('/auth/login', {
        metodo: 'POST',
        cuerpo: { email, password },
        token: null,
    })
    return abrirSesion(datos)
}

/** Registra una cuenta nueva, abre la sesión y devuelve el usuario. */
export async function registrarAtleta(campos) {
    const datos = await apiFetch('/auth/registro', {
        metodo: 'POST',
        cuerpo: campos,
        token: null,
    })
    return abrirSesion(datos)
}