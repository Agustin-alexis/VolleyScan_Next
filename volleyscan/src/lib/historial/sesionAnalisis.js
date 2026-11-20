// ─────────────────────────────────────────────────────────────
// sesionAnalisis.js — Sincronización de Sesiones y Saltos con JWT (FastAPI + Supabase)
//
// Envía el token JWT de Supabase Auth en la cabecera `Authorization: Bearer <token>`
// y vincula cada salto, métrica biomecánica y diagnóstico al `usuario_id` autenticado.
// Conserva además una copia local por usuario para que el Historial de IA funcione
// incluso si el servidor está temporalmente desconectado.
// ─────────────────────────────────────────────────────────────

import { getToken, getUsuario } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const CLAVE_PENDIENTES = 'volleyscan.analisis.pendientes';
const CLAVE_HISTORIAL_LOCAL = 'volleyscan.analisis.historial_local';
const MAX_PENDIENTES = 20;
const MAX_BYTES_KEEPALIVE = 60000;

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/api').replace(/\/$/, '');
const FASTAPI_URL = (process.env.NEXT_PUBLIC_FASTAPI_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');

function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

export const tokenActual = () => getToken();
export const usuarioActual = () => {
    const u = getUsuario();
    if (u?.id) return String(u.id);
    try {
        return sessionStorage.getItem('vs_id') || null;
    } catch {
        return null;
    }
};

export function cabecerasAuthJwt(extra = {}) {
    const token = tokenActual();
    const usuario = getUsuario();
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(usuario?.id ? { 'X-User-Id': String(usuario.id) } : {}),
        ...extra,
    };
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
        /* ignore */
    }
}

/**
 * Guarda una copia normalizada de la sesión en el almacenamiento del usuario autenticado
 * para consulta inmediata en /usuario/histtrial.
 */
export function guardarSesionEnHistorialLocal(sesion) {
    if (typeof window === 'undefined') return null;
    try {
        const uid = usuarioActual() || sesion.usuario_id || 'anon';
        const todas = JSON.parse(localStorage.getItem(CLAVE_HISTORIAL_LOCAL) ?? '[]');
        const reps = sesion.repeticiones ?? [];
        const validas = reps.filter((r) => r.valida);
        const scores = validas.map((r) => r.score).filter((n) => typeof n === 'number');
        const puntuacion = scores.length
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0;
        const mejorPuntuacion = scores.length ? Math.max(...scores) : 0;

        // Consolidar errores y fortalezas
        const mapaErrores = new Map();
        const setFortalezas = new Set();
        const mapaMedidas = new Map();

        for (const r of validas) {
            for (const f of r.puntosClave ?? []) setFortalezas.add(f);
            for (const e of r.errores ?? []) {
                const prev = mapaErrores.get(e.medidaId) ?? {
                    medidaId: e.medidaId,
                    nombre: e.nombre,
                    severidad: e.severidad === 'alta' ? 'grave' : e.severidad === 'media' ? 'moderado' : 'leve',
                    mensaje: e.mensaje,
                    porQue: e.porQue,
                    ejercicio: e.ejercicio,
                    ideal: e.ideal,
                    valores: [],
                    ocurrencias: 0,
                };
                prev.ocurrencias += 1;
                if (e.valor != null) prev.valores.push(e.valor);
                mapaErrores.set(e.medidaId, prev);
            }
            for (const m of r.medidas ?? []) {
                if (m.valor == null) continue;
                const prevM = mapaMedidas.get(m.id) ?? {
                    medidaId: m.id,
                    nombre: m.nombre,
                    unidad: m.unidad,
                    ideal: m.ideal,
                    valores: [],
                };
                prevM.valores.push(m.valor);
                mapaMedidas.set(m.id, prevM);
            }
        }

        const erroresConsolidados = [...mapaErrores.values()].map((e) => ({
            ...e,
            valorPromedio: e.valores.length
                ? Math.round((e.valores.reduce((a, b) => a + b, 0) / e.valores.length) * 10) / 10
                : null,
        }));

        const puntosConsolidados = [...mapaMedidas.values()].map((m) => {
            const prom =
                Math.round((m.valores.reduce((a, b) => a + b, 0) / m.valores.length) * 10) / 10;
            const aprobado = m.ideal ? prom >= m.ideal[0] && prom <= m.ideal[1] : true;
            return {
                medidaId: m.medidaId,
                nombre: m.nombre,
                unidad: m.unidad,
                ideal: m.ideal,
                valorPromedio: prom,
                aprobado,
            };
        });

        const tIni = new Date(sesion.inicio).getTime();
        const tFin = new Date(sesion.fin || Date.now()).getTime();
        const duracionCalculada =
            Number.isFinite(tIni) && Number.isFinite(tFin) ? Math.max(1, Math.round((tFin - tIni) / 1000)) : 15;
        const duracionSeg =
            sesion.duracionSeg != null && Number(sesion.duracionSeg) > 0
                ? Math.round(Number(sesion.duracionSeg))
                : duracionCalculada;

        const registroDetalle = {
            id: sesion.clienteUuid || sesion.id || uuid(),
            usuario_id: uid,
            tecnica: sesion.tecnica || 'remate',
            creadoEn: sesion.inicio || sesion.fin || new Date().toISOString(),
            fechaFin: sesion.fin || new Date().toISOString(),
            duracionSeg,
            duracion_segundos: duracionSeg,
            nivel: validas[0]?.nivel ?? 'intermedio',
            puntuacion,
            mejorPuntuacion,
            totalRepeticiones: reps.length,
            repeticionesValidas: validas.length,
            errores: erroresConsolidados,
            fortalezas: [...setFortalezas],
            puntos: puntosConsolidados,
            repeticiones: reps.map(({ videoReplayBase64: _v, video_replay_base64: _vb, snapshotsFases: _sf, ...r }, i) => ({
                ...r,
                numero: i + 1,
                puntuacion: r.score,
                recomendaciones: {
                    principal: r.principal ?? null,
                    errores: r.errores ?? [],
                    fortalezas: r.puntosClave ?? [],
                },
            })),
        };

        const sinDuplicado = todas.filter((x) => x.id !== registroDetalle.id);
        localStorage.setItem(CLAVE_HISTORIAL_LOCAL, JSON.stringify([registroDetalle, ...sinDuplicado].slice(0, 40)));
        return registroDetalle;
    } catch {
        return null;
    }
}

function calcularScoreDesdeFasesLocal(fases) {
    if (!fases || typeof fases !== 'object') return null;
    const pesos = [
        ['fase_1', 0.2],
        ['fase_2', 0.25],
        ['fase_3', 0.35],
        ['fase_4', 0.2],
    ];
    let suma = 0;
    let totalW = 0;
    for (const [k, w] of pesos) {
        const s = fases[k]?.score;
        if (s !== undefined && s !== null && Number.isFinite(Number(s))) {
            suma += Number(s) * w;
            totalW += w;
        }
    }
    if (totalW <= 0) return null;
    return Math.round(Math.max(0, Math.min(100, suma / totalW)));
}

export function leerHistorialLocalUsuario() {
    if (typeof window === 'undefined') return [];
    try {
        const uid = usuarioActual();
        const todasRaw = JSON.parse(localStorage.getItem(CLAVE_HISTORIAL_LOCAL) ?? '[]');
        let huboSaneamiento = false;
        const todas = todasRaw.map((ses) => {
            if (!ses || typeof ses !== 'object') return ses;
            const reps = Array.isArray(ses.repeticiones)
                ? ses.repeticiones.map((r) => {
                      const scFases = calcularScoreDesdeFasesLocal(r?.fases4 || r?.fases);
                      const scAct = Number(r?.puntuacion ?? r?.score ?? 0);
                      if (scFases !== null && (scAct <= 0 || Math.abs(scAct - scFases) >= 1)) {
                          huboSaneamiento = true;
                          return { ...r, score: scFases, puntuacion: scFases, score_global: scFases };
                      }
                      return r;
                  })
                : [];
            const validScores = reps.map((r) => Number(r?.puntuacion ?? r?.score ?? 0)).filter((n) => n > 0);
            const promReal = validScores.length
                ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
                : ses.puntuacion;
            return { ...ses, puntuacion: promReal, repeticiones: reps };
        });
        if (huboSaneamiento) {
            localStorage.setItem(CLAVE_HISTORIAL_LOCAL, JSON.stringify(todas));
        }
        if (!uid) return todas;
        return todas.filter((s) => !s.usuario_id || String(s.usuario_id) === String(uid));
    } catch {
        return [];
    }
}

export function eliminarSesionLocalUsuario(id) {
    if (typeof window === 'undefined') return;
    try {
        const todas = JSON.parse(localStorage.getItem(CLAVE_HISTORIAL_LOCAL) ?? '[]');
        localStorage.setItem(CLAVE_HISTORIAL_LOCAL, JSON.stringify(todas.filter((s) => s.id !== id)));
    } catch {
        /* ignore */
    }
}

export function crearSesion({ tecnica = 'remate', modeloIa = 'mediapipe-pose-full' } = {}) {
    const usuario = getUsuario();
    return {
        clienteUuid: uuid(),
        usuario_id: usuario?.id ?? usuarioActual() ?? null,
        usuario_email: usuario?.email ?? null,
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
 * Envía en tiempo real cada salto / gesto evaluado al backend FastAPI con el token JWT
 * y lo registra vinculado al perfil del usuario autenticado.
 */
export async function registrarSaltoConJwt(rep, sesionId = 'activa') {
    const token = tokenActual();
    const usuario = getUsuario();
    const uid = usuario?.id ?? usuarioActual() ?? '00000000-0000-0000-0000-000000000001';

    if (!rep || !rep.valida) return null;

    const ang8 = Array.isArray(rep.angulos8) ? rep.angulos8 : [];
    const scoreReal = Number(rep.scoreExacto ?? rep.score_global ?? rep.puntuacion ?? rep.score ?? 0);
    const payloadSalto = {
        sesion_id: sesionId,
        usuario_id: String(uid),
        usuario_email: usuario?.email ?? null,
        gesto_tecnico: rep.movimiento || 'remate',
        puntuacion: Math.round(scoreReal),
        score_global: scoreReal,
        efectividad_porcentaje: scoreReal,
        salto_vertical_cm: Number(Number(rep.saltoVerticalCm ?? 0).toFixed(2)),
        tiempo_vuelo_segundos: Number(Number(rep.tiempoVueloSegundos ?? 0).toFixed(3)),
        frame_despegue: rep.frameDespegue ?? null,
        frame_aterrizaje: rep.frameAterrizaje ?? null,
        velocidad_pico_ms: Number(Number(rep.velocidadPicoMs ?? 0).toFixed(2)),
        angulos_cinematicos: ang8,
        ventana_angulos_25: rep.ventanaAngulos25 || [],
        angulo_hombro: Number(
            Number(
                rep.medidas?.find((m) => m.id === 'elevacionBrazoContacto')?.valor ??
                    ang8[3] ??
                    0,
            ).toFixed(2),
        ),
        angulo_codo: Number(
            Number(
                rep.medidas?.find((m) => m.id === 'extensionCodoContacto')?.valor ??
                    ang8[1] ??
                    0,
            ).toFixed(2),
        ),
        angulo_rodilla: Number(
            Number(
                rep.medidas?.find((m) => m.id === 'flexionRodilla')?.valor ??
                    ang8[5] ??
                    0,
            ).toFixed(2),
        ),
        angulo_cadera: Number(Number(ang8[7] ?? 0).toFixed(2)),
        riesgo_lesion_porcentaje: Number(Math.max(0, 100 - scoreReal).toFixed(1)),
        nivel_riesgo: scoreReal >= 80 ? 'BAJO' : 'MEDIO',
        zona_riesgo: 'Cadena Cinética Integral',
        correcciones: rep.errores?.map((e) => e.mensaje) ?? [],
        diagnostico_causa_raiz: rep.diagnosticoCausaRaiz ?? '',
        prediccion_ia: rep.vozCoach ?? '',
        fases: rep.fases4 ?? {},
        fases4: rep.fases4 ?? {},
        medidas: rep.medidas ?? [],
        secuencia3D: Array.isArray(rep.secuencia3D) ? rep.secuencia3D : [],
        indicesFases: rep.indicesFases ?? null,
        creado_en: new Date().toISOString(),
    };

    try {
        const res = await fetch(`${FASTAPI_URL}/api/entrenamiento/${encodeURIComponent(sesionId)}/salto`, {
            method: 'POST',
            headers: cabecerasAuthJwt(),
            body: JSON.stringify(payloadSalto),
        });
        if (res.ok) return await res.json();
    } catch {
        /* Fallback si FastAPI no está corriendo en ese instante */
    }

    // Intentar inserción directa en Supabase con la sesión autenticada si está disponible
    if (token && supabase) {
        try {
            await supabase.from('analisis_biomecanicos').insert({
                usuario_id: String(uid),
                gesto_tecnico: payloadSalto.gesto_tecnico,
                angulo_hombro: payloadSalto.angulo_hombro,
                angulo_codo: payloadSalto.angulo_codo,
                angulo_rodilla: payloadSalto.angulo_rodilla,
                angulo_cadera: payloadSalto.angulo_cadera,
                efectividad_porcentaje: payloadSalto.efectividad_porcentaje,
                riesgo_lesion_porcentaje: payloadSalto.riesgo_lesion_porcentaje,
                nivel_riesgo: payloadSalto.nivel_riesgo,
                zona_riesgo: payloadSalto.zona_riesgo,
                correcciones: payloadSalto.correcciones,
                prediccion_ia: payloadSalto.prediccion_ia,
            });
        } catch {
            /* ignore schema mismatch */
        }
    }

    return payloadSalto;
}

/**
 * Envía la sesión consolidada al backend FastAPI y al endpoint de sesiones con el JWT.
 */
async function enviar(sesion) {
    const token = tokenActual();
    const usuario = getUsuario();
    const uid = usuario?.id ?? usuarioActual();

    if (!token) return 'error';

    const { propietario: _dropProp, ...datos } = sesion;
    const payload = {
        ...datos,
        usuario_id: uid ? String(uid) : datos.usuario_id,
        usuario_email: usuario?.email ?? datos.usuario_email,
    };
    const cuerpo = JSON.stringify(payload);

    // 1. Enviar resumen ejecutivo a FastAPI (/api/sesiones/finalizar) con Authorization: Bearer <JWT>
    const validas = (sesion.repeticiones ?? []).filter((r) => r.valida);
    const saltoMax = validas.reduce((max, r) => Math.max(max, r.saltoVerticalCm ?? 0), 0);
    const gestosSet = [...new Set(validas.map((r) => r.movimiento || sesion.tecnica || 'remate'))];
    const tIni = new Date(sesion.inicio || Date.now()).getTime();
    const tFin = new Date(sesion.fin || Date.now()).getTime();
    const duracionSeg =
        sesion.duracion_segundos ??
        sesion.duracionSeg ??
        (Number.isFinite(tIni) && Number.isFinite(tFin) ? Math.max(1, Math.round((tFin - tIni) / 1000)) : 0);

    const cuerpoFinalizar = JSON.stringify({
        id: sesion.clienteUuid || sesion.id,
        sesion_id: sesion.clienteUuid || sesion.id,
        usuario_id: uid ? String(uid) : '00000000-0000-0000-0000-000000000001',
        usuario_email: usuario?.email ?? null,
        inicio: sesion.inicio || new Date().toISOString(),
        fin: sesion.fin || new Date().toISOString(),
        fecha: sesion.inicio || sesion.fin || new Date().toISOString(),
        duracionSeg,
        duracion_segundos: duracionSeg,
        tecnica: sesion.tecnica || gestosSet[0] || 'remate',
        total_saltos: validas.length,
        salto_maximo_cm: saltoMax,
        alertas_fatiga: validas.filter((r) => (r.score ?? 100) < 65).length,
        gestos_entrenados: gestosSet,
        repeticiones: sesion.repeticiones,
    });

    let guardadoFastApi = false;
    try {
        const resFastApi = await fetch(`${FASTAPI_URL}/api/sesiones/finalizar`, {
            method: 'POST',
            headers: cabecerasAuthJwt(),
            keepalive: cuerpoFinalizar.length < MAX_BYTES_KEEPALIVE,
            body: cuerpoFinalizar,
        });
        if (resFastApi.ok) guardadoFastApi = true;
    } catch {
        /* continue to secondary endpoint */
    }

    // 2. Enviar también a API_URL/ia/analisis/sesiones o API_URL/analisis/sesiones
    if (API_URL) {
        try {
            const res = await fetch(`${API_URL}/ia/analisis/sesiones`, {
                method: 'POST',
                headers: cabecerasAuthJwt(),
                keepalive: cuerpo.length < MAX_BYTES_KEEPALIVE,
                body: cuerpo,
            });
            if (res.ok) return 'enviada';
            if (res.status === 400 || res.status === 409) return guardadoFastApi ? 'enviada' : 'rechazada';
        } catch {
            /* fallback */
        }
    }

    return guardadoFastApi ? 'enviada' : 'error';
}

export async function cerrarYEnviar(sesion) {
    const remates = sesion?.repeticiones?.length ?? 0;
    if (!remates) return { estado: 'vacia', remates: 0 };

    const usuario = getUsuario();
    const cerrada = {
        ...sesion,
        usuario_id: usuario?.id ?? usuarioActual() ?? sesion.usuario_id,
        usuario_email: usuario?.email ?? sesion.usuario_email,
        fin: new Date().toISOString(),
    };

    // Guardar siempre en el historial local del usuario autenticado
    guardarSesionEnHistorialLocal(cerrada);

    const resultado = await enviar(cerrada);

    if (resultado === 'enviada') return { estado: 'enviada', remates };
    if (resultado === 'rechazada') return { estado: 'rechazada', remates };

    guardarPendientes([...leerPendientes(), { ...cerrada, propietario: usuarioActual() }]);
    return { estado: 'pendiente', remates };
}

export async function reenviarPendientes() {
    const actual = usuarioActual();
    const pendientes = leerPendientes();
    if (!actual || !pendientes.length) return contarPendientes();

    const quedan = [];
    for (const sesion of pendientes) {
        if (sesion.propietario !== actual) {
            quedan.push(sesion);
            continue;
        }
        const resultado = await enviar(sesion);
        if (resultado === 'error') quedan.push(sesion);
    }
    guardarPendientes(quedan);
    return contarPendientes();
}

export const contarPendientes = () => {
    const actual = usuarioActual();
    return actual ? leerPendientes().filter((s) => s.propietario === actual).length : 0;
};
