// ─────────────────────────────────────────────────────────────
// backendBridge.js — Puente de Datos en Tiempo Real (WebSocket + REST)
// entre el componente Analisis IA de Next.js (puerto 3000) y el
// Motor Biomecánico en Python FastAPI (puerto 8000).
//
// Consume los módulos originales del backend Python:
//   - Calibración Cero Ambiental (calibracion_entorno.py: luz + Postura en 'T')
//   - Búfer Circular Temporal 60f y 4 Candados (buffer_temporal.py)
//   - Pipeline Modular 33f: 1_clasificador_gestos -> 2_motor_fisico -> 3_coach_experto
//   - Laboratorio de Ablación Científica (laboratorio_ablacion.py)
//   - Persistencia en Supabase vinculada al usuario autenticado por JWT
// ─────────────────────────────────────────────────────────────

import { getToken, getUsuario } from '@/lib/api';
import { cabecerasAuthJwt, registrarSaltoConJwt } from '@/lib/historial/sesionAnalisis';
import { LM } from '@/lib/pose/geometry';

const FASTAPI_HTTP = (process.env.NEXT_PUBLIC_FASTAPI_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');
const FASTAPI_WS = FASTAPI_HTTP.replace(/^http/, 'ws');

const INDICES_MAPA = {
    nariz: 0,
    ojo_1: 1,
    ojo_2: 2,
    ojo_3: 3,
    ojo_4: 4,
    ojo_5: 5,
    ojo_6: 6,
    hombro_izq: 11,
    hombro_der: 12,
    codo_izq: 13,
    codo_der: 14,
    muneca_izq: 15,
    muneca_der: 16,
    cadera_izq: 23,
    cadera_der: 24,
    rodilla_izq: 25,
    rodilla_der: 26,
    tobillo_izq: 27,
    tobillo_der: 28,
    punta_pie_izq: 31,
    punta_pie_der: 32,
};

const roundN = (n, d = 5) => Number((Number(n) || 0).toFixed(d));

const NOMBRE_A_LM = {
    nariz: LM.NOSE,
    hombro_izq: LM.L_SHOULDER,
    hombro_der: LM.R_SHOULDER,
    codo_izq: LM.L_ELBOW,
    codo_der: LM.R_ELBOW,
    muneca_izq: LM.L_WRIST,
    muneca_der: LM.R_WRIST,
    cadera_izq: LM.L_HIP,
    cadera_der: LM.R_HIP,
    rodilla_izq: LM.L_KNEE,
    rodilla_der: LM.R_KNEE,
    tobillo_izq: LM.L_ANKLE,
    tobillo_der: LM.R_ANKLE,
};

function _mapearVector8ADict(ang8) {
    if (!Array.isArray(ang8) || ang8.length < 8) return {};
    return {
        codoI: roundN(ang8[0], 2),
        codoD: roundN(ang8[1], 2),
        hombroI: roundN(ang8[2], 2),
        hombroD: roundN(ang8[3], 2),
        rodillaI: roundN(ang8[4], 2),
        rodillaD: roundN(ang8[5], 2),
        caderaI: roundN(ang8[6], 2),
        caderaD: roundN(ang8[7], 2),
    };
}

/**
 * Convierte el esqueleto 3D emitido por el backend Python (puerto 8000) al formato
 * normalizado por longitud de torso compatible con GemeloDigital3D.
 */
export function normalizarPuntos3DBackend(puntos3d, lTorsoOpt = null) {
    if (!puntos3d || typeof puntos3d !== 'object') return null;

    const hi = puntos3d.cadera_izq;
    const hd = puntos3d.cadera_der;
    const si = puntos3d.hombro_izq;
    const sd = puntos3d.hombro_der;
    if (!Array.isArray(hi) || !Array.isArray(hd)) return null;

    const cx = (Number(hi[0]) + Number(hd[0])) / 2;
    const cy = (Number(hi[1]) + Number(hd[1])) / 2;
    const cz = ((Number(hi[2]) || 0) + (Number(hd[2]) || 0)) / 2;

    let torso = Number(lTorsoOpt) || 0;
    if (!torso && Array.isArray(si) && Array.isArray(sd)) {
        const sx = (Number(si[0]) + Number(sd[0])) / 2;
        const sy = (Number(si[1]) + Number(sd[1])) / 2;
        const sz = ((Number(si[2]) || 0) + (Number(sd[2]) || 0)) / 2;
        torso = Math.hypot(sx - cx, sy - cy, sz - cz);
    }
    torso = Math.max(0.18, torso || 0.42);

    const out = {};
    for (const [nombre, idx] of Object.entries(NOMBRE_A_LM)) {
        const pt = puntos3d[nombre];
        if (!Array.isArray(pt) || pt.length < 2) continue;
        out[idx] = {
            x: roundN((Number(pt[0]) - cx) / torso, 3),
            y: roundN((Number(pt[1]) - cy) / torso, 3),
            z: roundN(((Number(pt[2]) || 0) - cz) / torso, 3),
            v: roundN(pt[3] ?? 0.95, 3),
        };
    }
    return Object.keys(out).length >= 6 ? out : null;
}

/**
 * Empaqueta los 33 landmarks extraídos exclusivamente por MediaPipe Pose (2D y 3D)
 * en el formato exacto esperado por FastAPI (`/ws/analizar/{sesion_id}`).
 */
export function empaquetarFrameParaBackend({ frameId, timestampMs, rawImage, rawWorld, gestoId, usuarioId }) {
    const puntos2d = {};
    const puntos3d = {};

    for (const [nombre, idx] of Object.entries(INDICES_MAPA)) {
        const p2 = rawImage?.[idx];
        if (p2) {
            puntos2d[nombre] = [
                roundN(p2.x, 5),
                roundN(p2.y, 5),
                roundN(p2.z ?? 0, 5),
                roundN(p2.visibility ?? p2.v ?? 0.95, 3),
            ];
        }
        const p3 = rawWorld?.[idx] ?? p2;
        if (p3) {
            puntos3d[nombre] = [
                roundN(p3.x, 5),
                roundN(p3.y, 5),
                roundN(p3.z ?? 0, 5),
                roundN(p2?.visibility ?? p2?.v ?? 0.95, 3),
            ];
        }
    }

    const landmarks33 = Array.isArray(rawImage)
        ? rawImage.map((p) => [
              roundN(p?.x ?? 0, 5),
              roundN(p?.y ?? 0, 5),
              roundN(p?.z ?? 0, 5),
              roundN(p?.visibility ?? p?.v ?? 0.95, 3),
          ])
        : [];

    return {
        frame_id: frameId,
        timestamp: timestampMs / 1000.0,
        puntos: puntos2d,
        puntos_mundo: puntos3d,
        landmarks_33: landmarks33,
        gesto_tecnico: gestoId || 'auto',
        usuario_id: usuarioId || undefined,
    };
}

export function calcularScoreGlobalDesdeFases(fases) {
    if (!fases || typeof fases !== 'object') return null;
    const pesos = [
        ['fase_1', 0.2],
        ['fase_2', 0.25],
        ['fase_3', 0.35],
        ['fase_4', 0.2],
    ];
    let suma = 0;
    let totalPesos = 0;
    for (const [k, w] of pesos) {
        const s = fases[k]?.score;
        if (s !== undefined && s !== null && Number.isFinite(Number(s))) {
            suma += Number(s) * w;
            totalPesos += w;
        }
    }
    if (totalPesos <= 0) return null;
    return roundN(Math.max(0, Math.min(100, suma / totalPesos)), 1);
}

/**
 * Convierte el paquete completo `evaluacion_secuencia_completa` devuelto por el motor
 * de Python (puerto 8000) al formato unificado de repetición del frontend Next.js.
 */
export function adaptarEvaluacionBackendARep(datosBackend, nivel = 'intermedio', ultimaSecuenciaLocal = null) {
    if (!datosBackend) return null;

    const gestoRawRaw = String(datosBackend.gesto_tecnico || datosBackend.gesto_detectado || 'remate').toLowerCase();
    const gestoRaw = gestoRawRaw === 'colocacion' ? 'voleo' : gestoRawRaw;
    const ang8 = Array.isArray(datosBackend.angulos_cinematicos) ? datosBackend.angulos_cinematicos : [];
    const fasesBackend = datosBackend.fases || {};

    const f1 = fasesBackend.fase_1 || {};
    const f2 = fasesBackend.fase_2 || {};
    const f3 = fasesBackend.fase_3 || {};
    const f4 = fasesBackend.fase_4 || {};

    const scoreFases = calcularScoreGlobalDesdeFases(fasesBackend);
    const score =
        datosBackend.score_global !== undefined && datosBackend.score_global !== null
            ? roundN(datosBackend.score_global, 1)
            : (scoreFases ?? 0);
    const saltoCm = roundN(
        datosBackend.salto_vertical_cm ?? datosBackend.metricas_fisicas?.salto_vertical_cm ?? 0,
        2,
    );
    const tiempoVueloSeg = roundN(
        datosBackend.tiempo_vuelo_segundos ?? datosBackend.metricas_fisicas?.tiempo_vuelo_segundos ?? 0,
        3,
    );

    const rodillaCarga = roundN(f1.metricas_clave?.angulo_rodilla_3d ?? ang8[5] ?? 0, 1);
    const caderaCarga = roundN(f1.metricas_clave?.angulo_cadera_3d ?? ang8[7] ?? 0, 1);
    const codoArmado = roundN(f2.metricas_clave?.angulo_codo_armado_3d ?? ang8[1] ?? 0, 1);
    const hombroArmado = roundN(f2.metricas_clave?.angulo_hombro_elevacion_3d ?? ang8[3] ?? 0, 1);
    const codoContacto = roundN(f3.metricas_clave?.angulo_codo_contacto_3d ?? ang8[1] ?? 0, 1);
    const hombroContacto = roundN(f3.metricas_clave?.angulo_hombro_contacto_3d ?? ang8[3] ?? 0, 1);
    const rodillaCaida = roundN(f4.metricas_clave?.angulo_rodilla_aterrizaje_3d ?? ang8[5] ?? 0, 1);
    const asimetriaCaida = roundN(f4.metricas_clave?.asimetria_bilateral_grados ?? 0, 1);
    const velImpacto = f3.metricas_clave?.velocidad_impacto_ms ?? f2.metricas_clave?.velocidad_ascenso_ms ?? 0;

    // Secuencia 3D suavizada devuelta directamente por FastAPI (:8000)
    const secuencia3DBackend = Array.isArray(datosBackend.secuencia_cinematica_completa)
        ? datosBackend.secuencia_cinematica_completa
              .map((f, idx) => {
                  const puntos = normalizarPuntos3DBackend(f?.puntos_3d, f?.L_torso);
                  if (!puntos) return null;
                  const faseFrame =
                      f.fase || (idx === 20 ? 'contacto' : idx < 10 ? 'carga' : idx < 20 ? 'armado' : 'caida');
                  return {
                      idx,
                      frameId: f.frame_id ?? idx,
                      t: Math.round(Number(f.timestamp ?? idx * 0.033) * 1000),
                      fase: faseFrame,
                      puntos,
                      angulos: _mapearVector8ADict(f.angulos_cinematicos),
                      speed: Number(f.cinematica?.velocidad_muneca_3d_ms ?? velImpacto ?? 1.8),
                      lift: Number(f.cinematica?.elevacion_salto_norm ?? (faseFrame === 'contacto' ? 0.22 : 0)),
                      fromBackend: true,
                  };
              })
              .filter(Boolean)
        : [];

    const secuencia3DFinal =
        secuencia3DBackend.length > 0 ? secuencia3DBackend : (ultimaSecuenciaLocal?.secuencia3D ?? []);

    const buscarIndicePorFrameOFase = (frameIdClave, faseNombre, fallbackIdx) => {
        if (!secuencia3DFinal.length) return 0;
        if (frameIdClave != null) {
            const byId = secuencia3DFinal.findIndex((f) => f.frameId === frameIdClave);
            if (byId >= 0) return byId;
        }
        const byPhase = secuencia3DFinal.findIndex((f) => f.fase === faseNombre);
        if (byPhase >= 0) return byPhase;
        return Math.min(secuencia3DFinal.length - 1, Math.max(0, fallbackIdx));
    };

    const idxF1 = buscarIndicePorFrameOFase(datosBackend.frames_clave_fases?.fase_1 ?? f1.frame_id, 'carga', 4);
    const idxF2 = buscarIndicePorFrameOFase(datosBackend.frames_clave_fases?.fase_2 ?? f2.frame_id, 'armado', 12);
    const idxF3 = buscarIndicePorFrameOFase(datosBackend.frames_clave_fases?.fase_3 ?? f3.frame_id, 'contacto', 20);
    const idxF4 = buscarIndicePorFrameOFase(datosBackend.frames_clave_fases?.fase_4 ?? f4.frame_id, 'caida', 26);

    const clavesFinal =
        ultimaSecuenciaLocal?.claves ??
        (secuencia3DFinal.length > 0
            ? {
                  lado: 'R',
                  carga: secuencia3DFinal[idxF1],
                  armado: secuencia3DFinal[idxF2],
                  contacto: secuencia3DFinal[idxF3],
                  caida: secuencia3DFinal[idxF4],
              }
            : null);

    const medidas = [
        {
            id: 'flexionRodilla',
            nombre: 'Flexión de rodillas en carga (Fase 1)',
            fase: 'carga',
            unidad: '°',
            valor: rodillaCarga,
            ideal: [95, 125],
            peso: 20,
            puntaje: (f1.score ?? score) / 100,
            estado: (f1.score ?? score) >= 80 ? 'ok' : 'alto',
        },
        {
            id: 'codoArmado',
            nombre: 'Codo al armar el brazo (Fase 2)',
            fase: 'vuelo',
            unidad: '°',
            valor: codoArmado,
            ideal: [75, 125],
            peso: 20,
            puntaje: (f2.score ?? score) / 100,
            estado: (f2.score ?? score) >= 80 ? 'ok' : 'alto',
        },
        {
            id: 'extensionCodoContacto',
            nombre: 'Extensión del codo en contacto (Fase 3 · t0)',
            fase: 'golpeo',
            unidad: '°',
            valor: codoContacto,
            ideal: [155, 180],
            peso: 30,
            puntaje: (f3.score ?? score) / 100,
            estado: (f3.score ?? score) >= 80 ? 'ok' : 'bajo',
        },
        {
            id: 'elevacionBrazoContacto',
            nombre: 'Elevación del hombro en contacto (Fase 3 · t0)',
            fase: 'golpeo',
            unidad: '°',
            valor: hombroContacto,
            ideal: [140, 180],
            peso: 15,
            puntaje: (f3.score ?? score) / 100,
            estado: (f3.score ?? score) >= 80 ? 'ok' : 'bajo',
        },
        {
            id: 'amortiguacionRodilla',
            nombre: 'Amortiguación al aterrizar (Fase 4)',
            fase: 'caida',
            unidad: '°',
            valor: rodillaCaida,
            ideal: [100, 150],
            peso: 15,
            puntaje: (f4.score ?? score) / 100,
            estado: (f4.score ?? score) >= 80 ? 'ok' : 'alto',
        },
    ];

    const errores = (datosBackend.errores_detectados || []).map((e, idx) => ({
        medidaId: `err_backend_${idx}`,
        fase: e.fase === 1 ? 'carga' : e.fase === 2 ? 'vuelo' : e.fase === 3 ? 'golpeo' : 'caida',
        severidad: score < 65 ? 'alta' : 'media',
        nombre: e.articulacion || 'Ajuste biomecánico',
        mensaje: e.descripcion || datosBackend.diagnostico_causa_raiz,
        porQue: datosBackend.diagnostico_causa_raiz,
        ejercicio: 'Revisa las 4 fases y la Matriz de Ablación 3D para corregir este ángulo.',
        impacto: 10,
    }));

    return {
        fromBackend: true,
        sesionIdBackend: datosBackend.sesion_id,
        saltoIndex: datosBackend.salto_index ?? null,
        movimiento: gestoRaw,
        movimientoNombre:
            datosBackend.gesto_detectado || gestoRaw.charAt(0).toUpperCase() + gestoRaw.slice(1),
        version: '2.0-fastapi',
        nivel,
        valida: true,
        motivo: null,
        score: Math.round(score),
        puntuacion: Math.round(score),
        puntaje: Math.round(score),
        score_global: score,
        scoreExacto: score,
        saltoVerticalCm: saltoCm,
        tiempoVueloSegundos: tiempoVueloSeg,
        frameDespegue: datosBackend.frame_despegue ?? datosBackend.metricas_fisicas?.frame_despegue ?? null,
        frameAterrizaje: datosBackend.frame_aterrizaje ?? datosBackend.metricas_fisicas?.frame_aterrizaje ?? null,
        velocidadPicoMs: roundN(velImpacto, 2),
        angulos8: ang8,
        ventanaAngulos25: datosBackend.ventana_angulos_25 || [],
        faseDetectada: datosBackend.fase_detectada || 'golpeo',
        diagnosticoCausaRaiz: datosBackend.diagnostico_causa_raiz || '',
        vozCoach: datosBackend.coach_voz_texto || datosBackend.voz_coach || '',
        ablacion: datosBackend.ablacion || null,
        videoReplayBase64: datosBackend.video_replay_base64 || null,
        vectorProbabilidadGestos: datosBackend.vector_probabilidad_gestos || null,
        framesClaveFases: datosBackend.frames_clave_fases || null,
        medidas,
        errores,
        principal: errores[0] || null,
        puntosClave:
            errores.length === 0 ? ['Ejecución biomecánica óptima validada en las 4 fases (3D Temporal).'] : [],
        brazo: 'derecho',
        confianza: 'alta',
        fpsMedio: 30,
        claves: clavesFinal,
        secuencia3D: secuencia3DFinal,
        indicesFases: {
            carga: idxF1,
            armado: idxF2,
            contacto: idxF3,
            caida: idxF4,
        },
        fases4: {
            fase_1: {
                numero: 1,
                id: 'carga',
                nombre: f1.nombre || 'Preparación',
                subtitulo: f1.subtitulo || 'Flexión de rodillas',
                frameId: datosBackend.frames_clave_fases?.fase_1 ?? f1.frame_id,
                frameIdx: idxF1,
                score: roundN(f1.score ?? score, 1),
                estado: f1.estado || 'Óptimo',
                metricas: [
                    { label: 'Rodilla 3D', valor: `${rodillaCarga}°` },
                    { label: 'Cadera 3D', valor: `${caderaCarga}°` },
                ],
                diagnostico: f1.diagnostico || '',
            },
            fase_2: {
                numero: 2,
                id: 'armado',
                nombre: f2.nombre || 'Salto y Armado',
                subtitulo: f2.subtitulo || 'Impulso y armado',
                frameId: datosBackend.frames_clave_fases?.fase_2 ?? f2.frame_id,
                frameIdx: idxF2,
                score: roundN(f2.score ?? score, 1),
                estado: f2.estado || 'Óptimo',
                metricas: [
                    { label: 'Codo Armado', valor: `${codoArmado}°` },
                    { label: 'Hombro Elevación', valor: `${hombroArmado}°` },
                ],
                diagnostico: f2.diagnostico || '',
            },
            fase_3: {
                numero: 3,
                id: 'contacto',
                nombre: f3.nombre || 'Contacto Crítico (t₀)',
                subtitulo: f3.subtitulo || 'Extensión en impacto',
                frameId: datosBackend.frames_clave_fases?.fase_3 ?? f3.frame_id,
                frameIdx: idxF3,
                score: roundN(f3.score ?? score, 1),
                estado: f3.estado || 'Óptimo',
                metricas: [
                    { label: 'Extensión Codo', valor: `${codoContacto}°` },
                    { label: 'Hombro', valor: `${hombroContacto}°` },
                ],
                diagnostico: f3.diagnostico || '',
            },
            fase_4: {
                numero: 4,
                id: 'caida',
                nombre: f4.nombre || 'Finalización',
                subtitulo: f4.subtitulo || 'Amortiguación bilateral',
                frameId: datosBackend.frames_clave_fases?.fase_4 ?? f4.frame_id,
                frameIdx: idxF4,
                score: roundN(f4.score ?? score, 1),
                estado: f4.estado || 'Óptimo',
                metricas: [
                    { label: 'Amortiguación', valor: `${rodillaCaida}°` },
                    { label: 'Asimetría', valor: `${asimetriaCaida}°` },
                ],
                diagnostico: f4.diagnostico || '',
            },
        },
    };
}

/**
 * Crea el puente WebSocket + REST contra FastAPI en el puerto 8000.
 */
export function createBackendBridge({
    onCalibration,
    onTelemetry,
    onSequenceEvaluated,
    onSequenceDiscarded,
    onStatusChange,
} = {}) {
    let ws = null;
    let sesionId = null;
    let connected = false;
    let closedByUser = false;
    let reconnectTimer = null;
    let frameCounter = 0;
    let lastSentMs = 0;

    function notifyStatus(state) {
        connected = state === 'connected';
        onStatusChange?.({
            connected,
            status: state,
            sesionId,
            backendUrl: FASTAPI_HTTP,
        });
    }

    function cleanupSocket() {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (ws) {
            ws.onopen = null;
            ws.onmessage = null;
            ws.onclose = null;
            ws.onerror = null;
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
            ws = null;
        }
    }

    async function connect() {
        closedByUser = false;
        cleanupSocket();
        notifyStatus('connecting');

        const token = getToken();
        const usuario = getUsuario();
        const uid = usuario?.id || '00000000-0000-0000-0000-000000000001';

        try {
            const res = await fetch(`${FASTAPI_HTTP}/api/entrenamiento/iniciar`, {
                method: 'POST',
                headers: cabecerasAuthJwt(),
                body: JSON.stringify({
                    usuario_id: String(uid),
                    dispositivo: 'VolleyScan Next.js Analisis IA 3D',
                }),
            });
            if (res.ok) {
                const data = await res.json();
                sesionId = data.sesion_id || `trn_${Date.now()}`;
            } else {
                sesionId = `trn_${Date.now()}`;
            }
        } catch {
            sesionId = `trn_${Date.now()}`;
        }

        const params = new URLSearchParams({
            usuario_id: String(uid),
        });
        if (token) params.set('token', token);

        const wsUrl = `${FASTAPI_WS}/ws/analizar/${encodeURIComponent(sesionId)}?${params.toString()}`;
        try {
            ws = new WebSocket(wsUrl);
        } catch {
            notifyStatus('disconnected');
            return;
        }

        ws.onopen = () => {
            notifyStatus('connected');
            onCalibration?.({
                estado: 'CALIBRANDO',
                tipo: 'estado_calibracion',
                progresoPct: 0,
                framesCalibrados: 0,
                framesRequeridos: 45,
                visibilidadPromedio: null,
                mensaje:
                    "Ponte frente a la cámara en Posición de 'T' (brazos extendidos) durante 2 segundos para calibrar",
                iluminacionValida: true,
                posturaTValida: false,
            });
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (!data || typeof data !== 'object') return;

                if (
                    data.tipo === 'estado_calibracion' ||
                    data.tipo === 'error_calibracion' ||
                    data.tipo === 'calibracion_exitosa' ||
                    data.tipo === 'sistema_activo'
                ) {
                    onCalibration?.({
                        estado: data.estado_sesion || (data.tipo === 'calibracion_exitosa' ? 'ACTIVO' : 'CALIBRANDO'),
                        tipo: data.tipo,
                        progresoPct: Number(data.progreso_pct ?? (data.tipo === 'calibracion_exitosa' ? 100 : 0)),
                        framesCalibrados: Number(data.frames_calibrados ?? 0),
                        framesRequeridos: Number(data.frames_requeridos ?? 45),
                        visibilidadPromedio: data.visibilidad_promedio ?? null,
                        mensaje: data.mensaje || '',
                        iluminacionValida: data.iluminacion_valida !== false,
                        posturaTValida: Boolean(data.postura_t_valida),
                        anguloBrazoIzq: data.angulo_brazo_izq_deg ?? null,
                        anguloBrazoDer: data.angulo_brazo_der_deg ?? null,
                        angulos8: data.angulos_cinematicos || [],
                        angulos: data.angulos || {},
                        skeleton3d: normalizarPuntos3DBackend(data.skeleton_3d, data.L_torso),
                    });
                } else if (data.tipo === 'telemetria_frame') {
                    onTelemetry?.({
                        frameId: data.frame_id,
                        angulos8: data.angulos_cinematicos || [],
                        angulos: data.angulos || {},
                        faseDetectada: data.fase_detectada || 'preparacion',
                        gestoEnVivo: data.gesto_en_vivo || null,
                        diagnosticoVivo: data.diagnostico_vivo || '',
                        fasesEnVivo: data.fases_en_vivo || null,
                        velocidadPicoMs: Number(data.velocidad_pico_ms || 0),
                        saltoVerticalCm: Number(data.salto_vertical_cm || 0),
                        tiempoVueloSeg: Number(data.tiempo_vuelo_segundos || 0),
                        estadoBuffer: data.estado_buffer || 'ESCUCHANDO',
                        motivoBloqueo: data.motivo_bloqueo || null,
                        ratioVisibilidad: data.ratio_visibilidad_pct ?? null,
                        framesEnBuffer: Number(data.frames_en_buffer || 0),
                        postFramesRestantes: Number(data.post_frames_restantes || 0),
                        ventanaAngulos25: data.ventana_angulos_25 || [],
                        metricasInstantaneas: data.metricas_instantaneas || {},
                        skeleton3d: normalizarPuntos3DBackend(data.skeleton_3d, data.L_torso),
                    });
                } else if (data.tipo === 'evaluacion_secuencia_completa') {
                    onSequenceEvaluated?.(data);
                } else if (data.tipo === 'secuencia_descartada') {
                    onSequenceDiscarded?.(data);
                }
            } catch {
                /* ignore malformed frame */
            }
        };

        ws.onclose = () => {
            notifyStatus('disconnected');
            if (!closedByUser) {
                reconnectTimer = setTimeout(() => {
                    if (!closedByUser) connect();
                }, 2500);
            }
        };

        ws.onerror = () => {
            /* handled by onclose */
        };
    }

    function sendFrame({ t, rawImage, rawWorld, gestoId }) {
        if (!ws || ws.readyState !== WebSocket.OPEN || !rawImage) return null;
        if (t - lastSentMs < 30) return null;
        lastSentMs = t;
        frameCounter += 1;
        const sentId = frameCounter;

        const usuario = getUsuario();
        const payload = empaquetarFrameParaBackend({
            frameId: sentId,
            timestampMs: t,
            rawImage,
            rawWorld,
            gestoId,
            usuarioId: usuario?.id ? String(usuario.id) : undefined,
        });

        try {
            ws.send(JSON.stringify(payload));
            return sentId;
        } catch {
            return null;
        }
    }

    function sendAction(accion) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return false;
        try {
            ws.send(JSON.stringify({ accion }));
            return true;
        } catch {
            return false;
        }
    }

    function disconnect() {
        closedByUser = true;
        cleanupSocket();
        notifyStatus('idle');
    }

    function getSesionId() {
        return sesionId || 'activa';
    }

    async function saveRepetition(rep) {
        return registrarSaltoConJwt(rep, getSesionId());
    }

    return {
        connect,
        sendFrame,
        sendAction,
        disconnect,
        getSesionId,
        saveRepetition,
    };
}
