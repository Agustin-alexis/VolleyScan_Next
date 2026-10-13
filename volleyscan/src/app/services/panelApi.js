// Cliente del backend Django (login con token y panel del entrenador).
// El chat con la IA (FastAPI) sigue en api.js.

import { guardarSesion } from "./historialService"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8001/api'

const CLAVE_TOKEN = 'vs_token'
const CLAVES_SESION = [CLAVE_TOKEN, 'vs_rol', 'vs_nombre']

export class ErrorApi extends Error {
    constructor(mensaje, estado, datos) {
        super(mensaje)
        this.name = 'ErrorApi'
        this.status = estado // 0 = no se pudo conectar
        this.datos = datos // cuerpo de la respuesta (errores por campo, etc.)
    }
}

export function obtenerToken() {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem(CLAVE_TOKEN)
}

export function cerrarSesion() {
    if (typeof window === 'undefined') return
    CLAVES_SESION.forEach((clave) => sessionStorage.removeItem(clave))
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

/** Inicia sesión, guarda el token en sessionStorage y devuelve el usuario. */
export async function iniciarSesion(email, password) {
    const datos = await apiFetch('/auth/login', {
        metodo: 'POST',
        cuerpo: { email, password },
        token: null,
    })
    sessionStorage.setItem(CLAVE_TOKEN, datos.access)
    sessionStorage.setItem('vs_rol', datos.usuario.rol)
    sessionStorage.setItem('vs_nombre', datos.usuario.nombre)
    return datos.usuario
}

export async function registrarAtleta(campos) {
    const datos = await apiFetch ('/auth/registro', {
        metodo: 'POST',
        cuerpo: campos,
        token: null,
    })
    guardarSesion(datos)
    return datos.usuario
    
}