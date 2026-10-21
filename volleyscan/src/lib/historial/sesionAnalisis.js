const CLAVE_PENDIENTES = 'volleyscan.analisis.pendientes';
const MAX_PENDIENTES = 20;
// fetch con keepalive solo admite cuerpos de hasta ~64 KB
const MAX_BYTES_KEEPALIVE = 60000;

// Dirección del backend. En .env.local:  NEXT_PUBLIC_API_URL=http://127.0.0.1:8001/api
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    // Respaldo para contextos sin crypto.randomUUID (http en red local)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

// Sesión de login (la guarda panelApi.js al iniciar sesión)
function leerDeSesion(clave) {
    try {
        return sessionStorage.getItem(clave);
    } catch {
        return null;
    }
}
const tokenActual = () => leerDeSesion('vs_token');
const usuarioActual = () => leerDeSesion('vs_id');

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
 *   rechazada → el servidor dijo que la sesión es inválida (400) o que su UUID es de otro
 *               usuario (409): reintentar no sirve
 *   error     → sin red / servidor caído / sesión vencida (401): se reintenta luego
 */
async function enviar(sesion) {
    const token = tokenActual();
    if (!token || !API_URL) return 'error'; // sin sesión iniciada: se reintenta luego

    // "propietario" es solo de uso local (cola de pendientes); no se envía al servidor
    // eslint-disable-next-line no-unused-vars
    const { propietario, ...datos } = sesion;
    const cuerpo = JSON.stringify(datos);

    try {
        const res = await fetch(`${API_URL}/analisis/sesiones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            keepalive: cuerpo.length < MAX_BYTES_KEEPALIVE,
            body: cuerpo,
        });
        if (res.ok) return 'enviada';
        if (res.status === 400 || res.status === 409) return 'rechazada';
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

    // Queda pendiente, marcada con su dueño: otra persona que inicie sesión en este
    // mismo navegador no debe enviarla con su cuenta.
    guardarPendientes([...leerPendientes(), { ...cerrada, propietario: usuarioActual() }]);
    return { estado: 'pendiente', remates };
}

/** Reintenta las sesiones pendientes de ESTE usuario. Devuelve cuántas le quedan. */
export async function reenviarPendientes() {
    const actual = usuarioActual();
    const pendientes = leerPendientes();
    if (!actual || !pendientes.length) return contarPendientes();

    const quedan = [];
    for (const sesion of pendientes) {
        if (sesion.propietario !== actual) {
            quedan.push(sesion); // de otro usuario (o sin dueño): no se toca
            continue;
        }
        const resultado = await enviar(sesion);
        if (resultado === 'error') quedan.push(sesion);
    }
    guardarPendientes(quedan);
    return contarPendientes();
}

/** Cuántas sesiones pendientes tiene el usuario actual. */
export const contarPendientes = () => {
    const actual = usuarioActual();
    return actual ? leerPendientes().filter((s) => s.propietario === actual).length : 0;
};