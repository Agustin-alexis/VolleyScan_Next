/**
 * historialService.js
 *
 * Capa de datos del historial de sesiones de VolleyScan.
 *
 * Hoy persiste en localStorage. La pantalla solo conoce las funciones
 * exportadas (todas async), así que migrar a MySQL consiste en reemplazar
 * el cuerpo de estas funciones por llamadas a la API (ver services/api.js)
 * sin tocar ningún componente.
 *
 * Seguridad:
 *  - Todo dato se valida y normaliza al ESCRIBIR y al LEER: localStorage es
 *    editable por el usuario o por cualquier script de la misma origen, por
 *    lo que nunca se confía en lo que hay guardado.
 *  - Solo se guardan métricas numéricas y un texto corto. Nunca video,
 *    imágenes, landmarks crudos, tokens ni datos personales.
 *  - Datos aislados por usuario (clave con namespace) para que dos cuentas
 *    en el mismo navegador no vean el historial de la otra.
 *  - Límites duros de tamaño y cantidad; protección contra prototype pollution.
 */

const VERSION = 1;
const PREFIJO = "volleyscan:historial";

export const USUARIO_LOCAL = "local";

const LIMITES = Object.freeze({
    sesiones: 200,
    repeticiones: 100,
    metricas: 12,
    observaciones: 500,
    errores: 10,
    puntosClave: 5,
    mensaje: 200,
    duracionMaxSeg: 6 * 60 * 60,
    valorMetrica: 1_000_000,
});

const GESTOS_VALIDOS = Object.freeze(["remate"]);
const CLAVES_PROHIBIDAS = new Set(["__proto__", "constructor", "prototype"]);

const RE_ID = /^[a-zA-Z0-9-]{8,64}$/;
const RE_USUARIO = /^[a-zA-Z0-9_-]{1,64}$/;
const RE_METRICA = /^[a-zA-Z0-9_]{1,32}$/;

const UN_DIA_MS = 24 * 60 * 60 * 1000;
const FECHA_MINIMA = Date.UTC(2020, 0, 1);

export class HistorialError extends Error {
    constructor(codigo, mensaje) {
        super(mensaje);
        this.name = "HistorialError";
        this.codigo = codigo;
    }
}

/* ----------------------------- Utilidades ------------------------------ */

function numero(valor, min, max) {
    if (typeof valor !== "number" || !Number.isFinite(valor)) return null;
    return Math.min(max, Math.max(min, valor));
}

const redondear = (n) => Math.round(n * 100) / 100;

function texto(valor, max) {
    if (typeof valor !== "string") return "";
    return valor
        .replace(/\p{Cc}/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max);
}

function generarId() {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
    if (c && typeof c.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        c.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
    throw new HistorialError(
        "SIN_CRYPTO",
        "El navegador no permite generar identificadores seguros."
    );
}

function clave(usuarioId) {
    if (typeof usuarioId !== "string" || !RE_USUARIO.test(usuarioId)) {
        throw new HistorialError("USUARIO_INVALIDO", "Identificador de usuario no válido.");
    }
    return `${PREFIJO}:v${VERSION}:${usuarioId}`;
}

function almacen() {
    try {
        if (typeof window === "undefined" || !window.localStorage) return null;
        return window.localStorage;
    } catch {
        // Acceso bloqueado (modo privado estricto, políticas del navegador).
        return null;
    }
}

/* ---------------------------- Normalización ---------------------------- */

function normalizarMetricas(metricas) {
    if (metricas === null || typeof metricas !== "object" || Array.isArray(metricas)) {
        return {};
    }
    const pares = [];
    for (const [k, v] of Object.entries(metricas)) {
        if (pares.length >= LIMITES.metricas) break;
        if (!RE_METRICA.test(k) || CLAVES_PROHIBIDAS.has(k)) continue;
        const n = numero(v, -LIMITES.valorMetrica, LIMITES.valorMetrica);
        if (n === null) continue;
        pares.push([k, redondear(n)]);
    }
    return Object.fromEntries(pares);
}

function normalizarErrores(lista) {
    if (!Array.isArray(lista)) return [];
    const salida = [];
    for (const e of lista) {
        if (salida.length >= LIMITES.errores) break;
        if (e === null || typeof e !== "object") continue;
        const mensaje = texto(e.mensaje, LIMITES.mensaje);
        if (!mensaje) continue;
        salida.push({
            medidaId: texto(e.medidaId, 48),
            fase: texto(e.fase, 32),
            mensaje,
            severidad: texto(e.severidad, 16),
        });
    }
    return salida;
}

function normalizarFrases(lista, max) {
    if (!Array.isArray(lista)) return [];
    return lista
        .map((f) => texto(f, LIMITES.mensaje))
        .filter(Boolean)
        .slice(0, max);
}

function normalizarRepeticiones(lista) {
    if (!Array.isArray(lista)) return [];
    const salida = [];
    for (const rep of lista) {
        if (salida.length >= LIMITES.repeticiones) break;
        if (rep === null || typeof rep !== "object") continue;
        const puntaje = numero(rep.puntaje, 0, 100);
        if (puntaje === null) continue;
        salida.push({
            numero: salida.length + 1,
            puntaje: redondear(puntaje),
            brazo: texto(rep.brazo, 16),
            errores: normalizarErrores(rep.errores),
            puntosClave: normalizarFrases(rep.puntosClave, LIMITES.puntosClave),
            metricas: normalizarMetricas(rep.metricas),
        });
    }
    return salida;
}

function normalizarFecha(valor) {
    if (typeof valor !== "string" || valor.length > 40) return null;
    const t = Date.parse(valor);
    if (!Number.isFinite(t)) return null;
    if (t < FECHA_MINIMA || t > Date.now() + UN_DIA_MS) return null;
    return new Date(t).toISOString();
}

/** Devuelve una sesión saneada o null si no es válida. Los agregados se recalculan siempre. */
function normalizarSesion(raw) {
    if (raw === null || typeof raw !== "object") return null;
    if (typeof raw.id !== "string" || !RE_ID.test(raw.id)) return null;

    const creadoEn = normalizarFecha(raw.creadoEn);
    if (!creadoEn) return null;

    if (!GESTOS_VALIDOS.includes(raw.gesto)) return null;

    const repeticiones = normalizarRepeticiones(raw.repeticiones);
    if (repeticiones.length === 0) return null;

    const puntajes = repeticiones.map((r) => r.puntaje);
    const suma = puntajes.reduce((a, b) => a + b, 0);

    return {
        id: raw.id,
        creadoEn,
        gesto: raw.gesto,
        duracionSeg: redondear(numero(raw.duracionSeg, 0, LIMITES.duracionMaxSeg) ?? 0),
        repeticiones,
        puntajePromedio: redondear(suma / puntajes.length),
        mejorPuntaje: Math.max(...puntajes),
        observaciones: texto(raw.observaciones, LIMITES.observaciones),
    };
}

/* ----------------------------- Persistencia ---------------------------- */

function leer(usuarioId) {
    const k = clave(usuarioId);
    const ls = almacen();
    if (!ls) {
        throw new HistorialError(
            "SIN_ALMACENAMIENTO",
            "Este navegador no permite guardar el historial localmente."
        );
    }

    let crudo = null;
    try {
        crudo = ls.getItem(k);
    } catch {
        throw new HistorialError("LECTURA", "No se pudo leer el historial.");
    }
    if (!crudo) return [];

    let datos;
    try {
        datos = JSON.parse(crudo);
    } catch {
        return []; // Contenido corrupto: se trata como historial vacío.
    }
    if (!Array.isArray(datos)) return [];

    const vistos = new Set();
    const sesiones = [];
    for (const item of datos) {
        const s = normalizarSesion(item);
        if (!s || vistos.has(s.id)) continue;
        vistos.add(s.id);
        sesiones.push(s);
    }
    sesiones.sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
    return sesiones.slice(0, LIMITES.sesiones);
}

function escribir(usuarioId, sesiones) {
    const k = clave(usuarioId);
    const ls = almacen();
    if (!ls) {
        throw new HistorialError(
            "SIN_ALMACENAMIENTO",
            "Este navegador no permite guardar el historial localmente."
        );
    }
    try {
        ls.setItem(k, JSON.stringify(sesiones));
    } catch (e) {
        const cuota =
            e?.name === "QuotaExceededError" || e?.name === "NS_ERROR_DOM_QUOTA_REACHED";
        throw new HistorialError(
            cuota ? "CUOTA" : "ESCRITURA",
            cuota
                ? "No hay espacio para guardar más sesiones. Exporta y elimina las más antiguas."
                : "No se pudo guardar el historial."
        );
    }
}

/* ------------------------------ API pública ----------------------------- */

/** Lista las sesiones del usuario, de la más reciente a la más antigua. */
export async function listarSesiones(usuarioId = USUARIO_LOCAL) {
    return leer(usuarioId);
}

export async function obtenerSesion(id, usuarioId = USUARIO_LOCAL) {
    if (typeof id !== "string" || !RE_ID.test(id)) return null;
    return leer(usuarioId).find((s) => s.id === id) ?? null;
}

/**
 * Guarda una sesión nueva. Solo se leen estos campos de `datos`:
 *   { gesto?: "remate", duracionSeg?: number, observaciones?: string,
 *     repeticiones: [{ puntaje: 0-100, brazo?: string,
 *       errores?: [{ medidaId, fase, mensaje, severidad }],
 *       puntosClave?: string[], metricas?: { nombre: number } }] }
 * El id, la fecha y los promedios los genera el servicio, nunca el llamador.
 */
export async function guardarSesion(datos, usuarioId = USUARIO_LOCAL) {
    if (datos === null || typeof datos !== "object") {
        throw new HistorialError("DATOS_INVALIDOS", "No hay datos de sesión para guardar.");
    }
    const sesion = normalizarSesion({
        id: generarId(),
        creadoEn: new Date().toISOString(),
        gesto: datos.gesto ?? "remate",
        duracionSeg: datos.duracionSeg,
        repeticiones: datos.repeticiones,
        observaciones: datos.observaciones,
    });
    if (!sesion) {
        throw new HistorialError(
            "DATOS_INVALIDOS",
            "La sesión no contiene repeticiones válidas para guardar."
        );
    }
    const actuales = leer(usuarioId);
    escribir(usuarioId, [sesion, ...actuales].slice(0, LIMITES.sesiones));
    return sesion;
}

export async function eliminarSesion(id, usuarioId = USUARIO_LOCAL) {
    if (typeof id !== "string" || !RE_ID.test(id)) {
        throw new HistorialError("DATOS_INVALIDOS", "Identificador de sesión no válido.");
    }
    const actuales = leer(usuarioId);
    const restantes = actuales.filter((s) => s.id !== id);
    if (restantes.length === actuales.length) return false;
    escribir(usuarioId, restantes);
    return true;
}

export async function limpiarHistorial(usuarioId = USUARIO_LOCAL) {
    const k = clave(usuarioId);
    const ls = almacen();
    if (!ls) return;
    try {
        ls.removeItem(k);
    } catch {
        throw new HistorialError("ESCRITURA", "No se pudo borrar el historial.");
    }
}

/** Devuelve el historial como texto JSON listo para descargar. */
export async function exportarHistorial(usuarioId = USUARIO_LOCAL) {
    const sesiones = leer(usuarioId);
    return JSON.stringify(
        { version: VERSION, exportadoEn: new Date().toISOString(), sesiones },
        null,
        2
    );
}