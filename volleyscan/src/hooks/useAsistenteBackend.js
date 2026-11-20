'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { getUsuario } from '@/lib/api';
import {
    adaptarEvaluacionBackendARep,
    calcularScoreGlobalDesdeFases,
    createBackendBridge,
    normalizarPuntos3DBackend,
} from '@/lib/engine/backendBridge';
import {
    agregarRemate,
    cabecerasAuthJwt,
    crearSesion,
    guardarSesionEnHistorialLocal,
    registrarSaltoConJwt,
} from '@/lib/historial/sesionAnalisis';
import {
    setVoiceCoachEnabled,
    speakCoachFeedback,
    stopVoiceCoach,
} from '@/lib/voice/voiceCoach';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const POSE_MODEL_URL =
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
const FASTAPI_HTTP = (process.env.NEXT_PUBLIC_FASTAPI_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');

const BUFFER_SNAPSHOT_MAX = 120;
const MAX_HISTORIAL_SESION = 150;
const COLOR_SALTO_CYAN = '#00F0FF';
const COLOR_CODO_GREEN = '#00FF99';
const COLOR_ALERTA_ROJO = '#FF3366';

const CONEXIONES_OSEAS = [
    [11, 12],
    [11, 13],
    [13, 15],
    [12, 14],
    [14, 16],
    [11, 23],
    [12, 24],
    [23, 24],
    [23, 25],
    [25, 27],
    [24, 26],
    [26, 28],
];

const NODOS_CLAVE = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

const MAPA_NOMBRES_GESTO = {
    voleo: 'Voleo',
    colocacion: 'Voleo',
    bloqueo: 'Bloqueo',
    saque: 'Saque',
    remate: 'Remate',
    recepcion: 'Recepción',
    'recepción': 'Recepción',
};

export function dibujarEsqueletoEnCanvas(
    ctx,
    lm,
    width = 640,
    height = 480,
    colorArt = '#00FF99',
    colorHueso = '#00F0FF',
) {
    if (!ctx || !Array.isArray(lm) || lm.length === 0) return;
    const w = Number(width) > 0 ? Number(width) : 640;
    const h = Number(height) > 0 ? Number(height) : 480;

    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = colorHueso || '#00F0FF';
    ctx.fillStyle = colorArt || '#00FF99';

    for (const [i, j] of CONEXIONES_OSEAS) {
        const p1 = lm[i];
        const p2 = lm[j];
        if (p1 && p2 && (p1.visibility ?? 1) > 0.4 && (p2.visibility ?? 1) > 0.4) {
            ctx.beginPath();
            ctx.moveTo(p1.x * w, p1.y * h);
            ctx.lineTo(p2.x * w, p2.y * h);
            ctx.stroke();
        }
    }

    for (const idx of NODOS_CLAVE) {
        const p = lm[idx];
        if (p && (p.visibility ?? 1) > 0.4) {
            ctx.beginPath();
            ctx.arc(p.x * w, p.y * h, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#FFFFFF';
            ctx.stroke();
        }
    }
    ctx.restore();
}

function formatearLocucionGesto(data) {
    if (!data) return '';
    const consejoBase = String(data.coach_voz_texto || data.voz_coach || '').trim();
    if (!consejoBase) return '';

    const rawGesto = String(data.gesto_detectado || data.gesto_tecnico || '').trim();
    const nombreGesto = MAPA_NOMBRES_GESTO[rawGesto.toLowerCase()] || rawGesto;
    const consejoLower = consejoBase.toLowerCase();

    if (
        consejoLower.startsWith('detecté un') ||
        (nombreGesto && consejoLower.startsWith(`${nombreGesto.toLowerCase()} detectado`))
    ) {
        return consejoBase;
    }
    if (nombreGesto && nombreGesto !== 'MOVIMIENTO NO CLASIFICADO') {
        return `Detecté un ${nombreGesto}. ${consejoBase}`;
    }
    return consejoBase;
}

function liberarSnapshot(item) {
    if (!item) return;
    if (item.canvasSnapshot) {
        item.canvasSnapshot.width = 0;
        item.canvasSnapshot.height = 0;
        item.canvasSnapshot = null;
    }
    item.landmarks2d = null;
}

function buscarFrameSnapshot(bufferMap, targetFrameId) {
    if (!targetFrameId || !bufferMap || bufferMap.size === 0) return null;
    if (bufferMap.has(targetFrameId)) return bufferMap.get(targetFrameId);

    let masCercano = null;
    let distMin = Infinity;
    for (const [fid, item] of bufferMap.entries()) {
        const d = Math.abs(fid - targetFrameId);
        if (d < distMin) {
            distMin = d;
            masCercano = item;
        }
    }
    return masCercano;
}

function convertirSecuencia3DDesdeBackend(datos) {
    if (!Array.isArray(datos?.secuencia_cinematica_completa)) return [];
    return datos.secuencia_cinematica_completa
        .map((f, idx) => {
            const puntos = normalizarPuntos3DBackend(f?.puntos_3d, f?.L_torso);
            if (!puntos) return null;
            const ang8 = Array.isArray(f.angulos_cinematicos) ? f.angulos_cinematicos : [];
            return {
                idx,
                frameId: f.frame_id ?? idx,
                t: Math.round(Number(f.timestamp ?? idx * 0.033) * 1000),
                fase: f.fase || (idx === 20 ? 'contacto' : idx < 10 ? 'carga' : idx < 20 ? 'armado' : 'caida'),
                puntos,
                angulos:
                    ang8.length >= 8
                        ? {
                              codoI: Number(Number(ang8[0] || 0).toFixed(2)),
                              codoD: Number(Number(ang8[1] || 0).toFixed(2)),
                              hombroI: Number(Number(ang8[2] || 0).toFixed(2)),
                              hombroD: Number(Number(ang8[3] || 0).toFixed(2)),
                              rodillaI: Number(Number(ang8[4] || 0).toFixed(2)),
                              rodillaD: Number(Number(ang8[5] || 0).toFixed(2)),
                              caderaI: Number(Number(ang8[6] || 0).toFixed(2)),
                              caderaD: Number(Number(ang8[7] || 0).toFixed(2)),
                          }
                        : {},
                speed: Number(f.cinematica?.velocidad_muneca_3d_ms ?? 1.8),
                lift: Number(f.cinematica?.elevacion_salto_norm ?? (f.fase === 'contacto' ? 0.22 : 0)),
                fromBackend: true,
            };
        })
        .filter(Boolean);
}

const INITIAL_CALIBRACION = {
    estadoSesion: 'CALIBRANDO', // 'CALIBRANDO' | 'ACTIVO'
    visibleOverlay: true,
    tipo: 'estado_calibracion',
    framesCalibrados: 0,
    framesRequeridos: 45,
    progresoPct: 0,
    visibilidadPct: '--',
    alertaLuz: false,
    mensaje:
        "Ponte frente a la cámara en Posición de 'T' (brazos extendidos) durante 2 segundos para calibrar",
};

const INITIAL_LIVE = {
    fps: 0,
    frameId: 0,
    ladoDominante: 'Auto',
    estadoBuffer: 'CALIBRANDO',
    framesEnBuffer: 0,
    postRestantes: 0,
    ratioVisibilidadPct: null,
    saltoVerticalCm: 0,
    tiempoVueloSeg: 0,
    velMunecaMs: 0,
    confianzaPct: null,
    faseTitulo: '🔒 Calibrando Entorno (Posición \'T\')',
    faseTone: 'text-yellow-400',
    faseDetalle: 'Mantén los brazos abiertos en \'T\' por 2 segundos',
    metricasInstantaneas: {},
    backend3DBuffer: [],
};

const INITIAL_FATIGA = {
    labels: [],
    saltosCm: [],
    codosDeg: [],
    coloresSalto: [],
    coloresCodo: [],
    radiosSalto: [],
    radiosCodo: [],
    picoSaltoCm: 0,
    picoCodoDeg: 0,
    ultimoSaltoCm: null,
    ultimoCodoDeg: null,
    alertaSalto: false,
    alertaCodo: false,
    hayAlertaClinica: false,
    mensajeAlertaClinica:
        'Alerta Clínica: Caída mayor al 20% respecto al Pico Máximo de la sesión.',
};

function cameraReducer(state, action) {
    switch (action.type) {
        case 'LOADING':
            return { status: 'loading', error: '' };
        case 'RUNNING':
            return { status: 'running', error: '' };
        case 'ERROR':
            return { status: 'error', error: action.error };
        case 'IDLE':
        default:
            return { status: 'idle', error: '' };
    }
}

async function createMediaPipeLandmarker() {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    const build = (delegate) =>
        PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.65,
            minPosePresenceConfidence: 0.65,
            minTrackingConfidence: 0.65,
        });
    try {
        return await build('GPU');
    } catch {
        return build('CPU');
    }
}

/**
 * Hook dedicado para el clon exacto de la UI de Asistente de IA conectado exclusivamente
 * al motor biomecánico MediaPipe + FastAPI (puerto 8000).
 */
export function useAsistenteBackend({ onEvaluacionCompletada, onSecuenciaDescartada } = {}) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const landmarkerRef = useRef(null);
    const streamRef = useRef(null);
    const rafRef = useRef(0);
    const rvfcRef = useRef(0);
    const runningRef = useRef(false);
    const onEvalCbRef = useRef(onEvaluacionCompletada);
    const onDiscCbRef = useRef(onSecuenciaDescartada);
    useEffect(() => {
        onEvalCbRef.current = onEvaluacionCompletada;
    }, [onEvaluacionCompletada]);
    useEffect(() => {
        onDiscCbRef.current = onSecuenciaDescartada;
    }, [onSecuenciaDescartada]);

    const bridgeRef = useRef(null);
    const sesionIaRef = useRef(null);
    const sessionStartMsRef = useRef(0);
    const sesionPersistidaRef = useRef(false);
    const persistirFinSesionRef = useRef(null);
    const gestoIdRef = useRef('auto');
    const usuarioIdRef = useRef('');
    const modoHistoricoRef = useRef(false);
    const snapshotsMapRef = useRef(new Map());
    const canvasPoolRef = useRef([]);
    const fpsLiveRef = useRef(30);
    const frameIdLiveRef = useRef(0);
    const buffer3DRef = useRef([]);
    const ultimaFraseRef = useRef('');
    const ultimoErrorLuzTsRef = useRef(0);
    const timerOcultarCalibRef = useRef(null);

    const [camLifecycle, dispatchCam] = useReducer(cameraReducer, { status: 'idle', error: '' });
    const [backendConnected, setBackendConnected] = useState(false);
    const [sesionId, setSesionId] = useState('pendiente');
    const [usuarioId, setUsuarioId] = useState('00000000-0000-0000-0000-000000000001');
    const [gestoSeleccionado, setGestoSeleccionado] = useState('auto');
    const [vozActiva, setVozActiva] = useState(true);
    const [fraseCoach, setFraseCoach] = useState('"Inicia tu carrera de aproximación con flexión de piernas..."');
    const [fraseCoachBar, setFraseCoachBar] = useState('"Listo para iniciar la sesión de entrenamiento."');
    const [toastMsg, setToastMsg] = useState(null);

    const [calibracion, setCalibracion] = useState(INITIAL_CALIBRACION);
    const [live, setLive] = useState(INITIAL_LIVE);

    const [historialSesion, setHistorialSesion] = useState([]);
    const [indiceActivo, setIndiceActivo] = useState(null); // null => en vivo
    const [secuenciaMostrada, setSecuenciaMostrada] = useState(null);
    const [ultimaSecuenciaLive, setUltimaSecuenciaLive] = useState(null);
    const [secuenciaDescartadaBanner, setSecuenciaDescartadaBanner] = useState(null);
    const [alertaFatigaTecnica, setAlertaFatigaTecnica] = useState(null);
    const [fatigaSeries, setFatigaSeries] = useState(INITIAL_FATIGA);

    // Sincronizar usuario autenticado de Supabase de forma asíncrona tras hidratar
    useEffect(() => {
        const timer = setTimeout(() => {
            const u = getUsuario();
            if (u?.id) {
                const uid = String(u.id);
                setUsuarioId(uid);
                usuarioIdRef.current = uid;
            }
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        gestoIdRef.current = gestoSeleccionado;
    }, [gestoSeleccionado]);

    useEffect(() => {
        usuarioIdRef.current = usuarioId;
    }, [usuarioId]);

    const mostrarToast = useCallback((msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(null), 4200);
    }, []);

    const hablarTexto = useCallback((texto) => {
        if (!texto) return;
        ultimaFraseRef.current = texto;
        setFraseCoach(`"${texto}"`);
        setFraseCoachBar(`"${texto}"`);
        speakCoachFeedback(texto);
    }, []);

    const limpiarSnapshotsBuffer = useCallback(() => {
        for (const item of snapshotsMapRef.current.values()) {
            liberarSnapshot(item);
        }
        snapshotsMapRef.current.clear();
        buffer3DRef.current = [];
    }, []);

    // Puente WebSocket contra puerto 8000 inicializado fuera de render
    useEffect(() => {
        bridgeRef.current = createBackendBridge({
            onStatusChange: ({ connected, sesionId: sid }) => {
                setBackendConnected(connected);
                if (sid) {
                    setSesionId(sid);
                    if (sesionIaRef.current) {
                        sesionIaRef.current.clienteUuid = String(sid);
                    }
                }
                if (connected) {
                    setCalibracion({ ...INITIAL_CALIBRACION, visibleOverlay: true });
                    hablarTexto(
                        'Sistema iniciado. Por favor, ponte frente a la cámara con los brazos en T para calibrar.',
                    );
                }
            },
            onCalibration: (cal) => {
                if (timerOcultarCalibRef.current) {
                    clearTimeout(timerOcultarCalibRef.current);
                    timerOcultarCalibRef.current = null;
                }

                const visPct =
                    cal.visibilidadPromedio != null
                        ? Math.round(Number(cal.visibilidadPromedio) * 100)
                        : '--';
                const framesCal = cal.framesCalibrados ?? 0;
                const framesReq = cal.framesRequeridos ?? 45;
                const pct =
                    cal.progresoPct != null
                        ? Math.min(100, Math.round(Number(cal.progresoPct)))
                        : Math.min(100, Math.round((framesCal / Math.max(1, framesReq)) * 100));

                if (cal.tipo === 'error_calibracion') {
                    setCalibracion({
                        estadoSesion: 'CALIBRANDO',
                        visibleOverlay: true,
                        tipo: 'error_calibracion',
                        framesCalibrados: 0,
                        framesRequeridos: framesReq,
                        progresoPct: 0,
                        visibilidadPct: visPct,
                        alertaLuz: true,
                        mensaje: cal.mensaje || 'Poca luz o contraluz. Mejora la iluminación de la habitación.',
                    });
                    setLive((prev) => ({
                        ...prev,
                        estadoBuffer: 'CALIBRANDO',
                        framesEnBuffer: 0,
                        faseTitulo: '⚠️ Error de Calibración (Luz)',
                        faseTone: 'text-red-400',
                        faseDetalle:
                            cal.mensaje || 'Poca luz o contraluz. Mejora la iluminación de la habitación.',
                    }));
                    const nowTs = performance.now();
                    if (nowTs - ultimoErrorLuzTsRef.current > 4500) {
                        ultimoErrorLuzTsRef.current = nowTs;
                        hablarTexto('Hay poca luz o estás mal ubicado. Mejora el entorno.');
                    }
                    return;
                }

                if (cal.tipo === 'calibracion_exitosa' || cal.estado === 'ACTIVO') {
                    setCalibracion({
                        estadoSesion: 'ACTIVO',
                        visibleOverlay: cal.tipo === 'calibracion_exitosa',
                        tipo: 'calibracion_exitosa',
                        framesCalibrados: framesReq,
                        framesRequeridos: framesReq,
                        progresoPct: 100,
                        visibilidadPct: visPct,
                        alertaLuz: false,
                        mensaje: cal.mensaje || 'Calibrado / Listo — Sistema de captura activado.',
                    });
                    setLive((prev) => ({
                        ...prev,
                        estadoBuffer: 'ESCUCHANDO',
                        faseTitulo: '✅ Calibrado / Listo',
                        faseTone: 'text-emerald-400',
                        faseDetalle: cal.mensaje || 'Calibrado / Listo — Sistema de captura activado.',
                    }));
                    if (cal.tipo === 'calibracion_exitosa') {
                        hablarTexto('Calibración exitosa. Entorno óptimo, vamos a entrenar.');
                        timerOcultarCalibRef.current = setTimeout(() => {
                            setCalibracion((c) => (c.estadoSesion === 'ACTIVO' ? { ...c, visibleOverlay: false } : c));
                            timerOcultarCalibRef.current = null;
                        }, 650);
                    }
                    return;
                }

                // estado_calibracion
                if (cal.skeleton3d) {
                    buffer3DRef.current = [
                        ...buffer3DRef.current.slice(-59),
                        {
                            idx: buffer3DRef.current.length,
                            frameId: Date.now(),
                            t: Math.round(performance.now()),
                            fase: 'preparacion',
                            puntos: cal.skeleton3d,
                            angulos: cal.angulos || {},
                            speed: 0,
                            lift: 0,
                        },
                    ];
                }

                setCalibracion({
                    estadoSesion: 'CALIBRANDO',
                    visibleOverlay: true,
                    tipo: 'estado_calibracion',
                    framesCalibrados: framesCal,
                    framesRequeridos: framesReq,
                    progresoPct: pct,
                    visibilidadPct: visPct,
                    alertaLuz: false,
                    mensaje:
                        cal.mensaje ||
                        "Ponte frente a la cámara en Posición de 'T' (brazos extendidos) durante 2 segundos para calibrar",
                });
                setLive((prev) => ({
                    ...prev,
                    estadoBuffer: 'CALIBRANDO',
                    framesEnBuffer: framesCal,
                    faseTitulo: '🔒 Calibrando Entorno (Posición \'T\')',
                    faseTone: 'text-yellow-400',
                    faseDetalle: 'Mantén los brazos abiertos en \'T\' por 2 segundos',
                    backend3DBuffer: buffer3DRef.current,
                }));
            },
            onTelemetry: (tel) => {
                setCalibracion((c) =>
                    c.estadoSesion !== 'ACTIVO' || c.visibleOverlay
                        ? { ...c, estadoSesion: 'ACTIVO', visibleOverlay: false, progresoPct: 100 }
                        : c,
                );

                const m = tel.metricasInstantaneas || {};
                const estado = tel.estadoBuffer || 'ESCUCHANDO';

                if (estado === 'T0_DETECTADO') {
                    stopVoiceCoach();
                }

                if (tel.skeleton3d) {
                    buffer3DRef.current = [
                        ...buffer3DRef.current.slice(-59),
                        {
                            idx: buffer3DRef.current.length,
                            frameId: tel.frameId,
                            t: Math.round(performance.now()),
                            fase: tel.faseDetectada || 'preparacion',
                            puntos: tel.skeleton3d,
                            angulos: tel.angulos || {},
                            speed: Number(m.velocidad_muneca_3d_ms ?? tel.velocidadPicoMs ?? 0),
                            lift: Math.min(0.6, Number(tel.saltoVerticalCm || 0) / 100),
                        },
                    ];
                }

                if (modoHistoricoRef.current) {
                    setLive((prev) => ({
                        ...prev,
                        estadoBuffer: estado,
                        framesEnBuffer: tel.framesEnBuffer ?? 0,
                        postRestantes: tel.postFramesRestantes ?? 0,
                        backend3DBuffer: buffer3DRef.current,
                    }));
                    return;
                }

                let faseTitulo = estado === 'ESCUCHANDO' ? 'Calibrado / Listo' : estado;
                let faseTone = 'text-cyan-400';
                let faseDetalle = 'Monitoreando vértice de derivada cero';

                if (estado === 'ENCUADRE_INCOMPLETO') {
                    faseTitulo = '⚠️ Encuadre Incompleto (Ponte de pie)';
                    faseTone = 'text-red-400';
                    faseDetalle = 'Caderas, rodillas y tobillos deben ser visibles';
                } else if (
                    estado === 'USUARIO DE ESPALDAS - ESPERANDO POSICIÓN FRONTAL' ||
                    estado === 'ENCUADRE INVÁLIDO - USUARIO DE ESPALDAS'
                ) {
                    faseTitulo = '⚠️ Usuario de Espaldas (Gira al Frente)';
                    faseTone = 'text-red-400';
                    faseDetalle = 'Ponte de frente a la cámara (rostro y ojos visibles)';
                } else if (m.en_el_aire) {
                    faseTitulo = 'Fase Aérea / Salto Activo';
                    faseTone = 'text-yellow-400';
                    faseDetalle = 'Monitoreando vértice de derivada cero';
                }

                const velMunecaReal =
                    m.velocidad_muneca_y !== undefined
                        ? Math.abs(Number(m.velocidad_muneca_y) * 10)
                        : Number(m.velocidad_muneca_3d_ms ?? tel.velocidadPicoMs ?? 0);

                const saltoLive = Number(m.salto_vertical_cm ?? tel.saltoVerticalCm ?? 0);
                const tvLive = Number(m.tiempo_vuelo_segundos ?? tel.tiempoVueloSeg ?? 0);

                setLive((prev) => ({
                    ...prev,
                    fps: fpsLiveRef.current || prev.fps,
                    frameId: tel.frameId ?? frameIdLiveRef.current ?? prev.frameId,
                    ladoDominante:
                        m.muneca_dominante === 'der'
                            ? 'Derecho'
                            : m.muneca_dominante === 'izq'
                              ? 'Izquierdo'
                              : prev.ladoDominante,
                    estadoBuffer: estado,
                    framesEnBuffer: tel.framesEnBuffer ?? 0,
                    postRestantes: tel.postFramesRestantes ?? 0,
                    ratioVisibilidadPct: tel.ratioVisibilidad,
                    saltoVerticalCm: saltoLive > 0 ? Number(saltoLive.toFixed(2)) : prev.saltoVerticalCm,
                    tiempoVueloSeg: saltoLive > 0 ? Number(tvLive.toFixed(3)) : prev.tiempoVueloSeg,
                    velMunecaMs: Number(velMunecaReal.toFixed(2)),
                    confianzaPct:
                        m.confianza_anatomica_ponderada !== undefined
                            ? Number(Number(m.confianza_anatomica_ponderada).toFixed(1))
                            : prev.confianzaPct,
                    faseTitulo,
                    faseTone,
                    faseDetalle,
                    angulos: tel.angulos || {},
                    angulos8: tel.angulos8 || [],
                    ventanaAngulos25: tel.ventanaAngulos25 || [],
                    metricasInstantaneas: m,
                    backend3DBuffer: buffer3DRef.current,
                }));
            },
            onSequenceDiscarded: (desc) => {
                const motivo = desc?.motivo || 'MOVIMIENTO NO CLASIFICADO';
                const detalle = desc?.detalle || 'No alcanza el 80% de una firma técnica oficial.';
                setSecuenciaDescartadaBanner(motivo);
                setLive((prev) => ({
                    ...prev,
                    faseTitulo: motivo,
                    faseTone: 'text-amber-400',
                    faseDetalle: detalle,
                }));
                setFraseCoach(`"[Filtro Biomecánico] ${detalle}"`);
                onDiscCbRef.current?.(desc);
            },
            onSequenceEvaluated: (datos) => {
                if (!datos || typeof datos !== 'object') return;
                setSecuenciaDescartadaBanner(null);

                // Extraer los 4 snapshots exactos del búfer de imágenes (con landmarks para superponer esqueleto)
                const snapshotsFases = {};
                for (const [keyFase, fid] of Object.entries(datos.frames_clave_fases || {})) {
                    const snap = buscarFrameSnapshot(snapshotsMapRef.current, fid);
                    if (snap && snap.canvasSnapshot) {
                        snapshotsFases[keyFase] = {
                            dataUrl: snap.canvasSnapshot.toDataURL('image/jpeg', 0.88),
                            width: snap.canvasSnapshot.width,
                            height: snap.canvasSnapshot.height,
                            landmarks2d: snap.landmarks2d,
                            frameId: fid,
                        };
                    }
                }

                const saltoNum =
                    datos.metricas_fisicas?.salto_vertical_cm !== undefined
                        ? Number(datos.metricas_fisicas.salto_vertical_cm)
                        : Number(datos.salto_vertical_cm || 0);
                const tvNum = Number(
                    datos.metricas_fisicas?.tiempo_vuelo_segundos ?? datos.tiempo_vuelo_segundos ?? 0,
                );
                const gestoRaw = String(datos.gesto_detectado || datos.gesto_tecnico || 'Remate').trim();
                const gestoNombre = MAPA_NOMBRES_GESTO[gestoRaw.toLowerCase()] || gestoRaw;
                const scoreFasesCalc = calcularScoreGlobalDesdeFases(datos.fases);
                const scoreRawNum =
                    datos.score_global !== undefined && datos.score_global !== null
                        ? Number(datos.score_global)
                        : (scoreFasesCalc ?? 0);
                const scoreGlobal = Math.round(scoreRawNum);

                const seqItem = {
                    ...datos,
                    gestoNombre,
                    scoreGlobal,
                    scoreExacto: Number(scoreRawNum.toFixed(1)),
                    saltoCm: Number(saltoNum.toFixed(2)),
                    tiempoVueloSeg: Number(tvNum.toFixed(3)),
                    snapshotsFases,
                    secuencia3D: convertirSecuencia3DDesdeBackend(datos),
                    timestampLocal: new Date().toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                    }),
                };

                // Actualizar historial (circular max 150) y evaluar fatiga técnica (>=15% caída respecto Rep #1 del mismo gesto)
                setHistorialSesion((prev) => {
                    const idxRep = seqItem.salto_index || prev.length + 1;
                    seqItem.salto_index = idxRep;
                    const next = [...prev.slice(-(MAX_HISTORIAL_SESION - 1)), seqItem];

                    const delGesto = next.filter(
                        (s) => (s.gesto_tecnico || '').toLowerCase() === gestoRaw.toLowerCase(),
                    );
                    if (delGesto.length >= 3) {
                        const primero = delGesto[0];
                        const drop = Number(primero.score_global || 0) - scoreGlobal;
                        if (drop >= 15) {
                            setAlertaFatigaTecnica(
                                `⚠️ Fatiga Técnica: Caída de ${Math.round(drop)}% en efectividad (${Math.round(
                                    primero.score_global || 0,
                                )}% ➔ ${scoreGlobal}%) en ${gestoRaw.toUpperCase()} respecto al inicio de la sesión (Rep #${
                                    primero.salto_index
                                }).`,
                            );
                        }
                    }
                    return next;
                });

                // Actualizar gráfica de Fatiga Neuromuscular (Chart.js): salto (cm) vs codo t0 (°), alerta >20% caída
                const f3m = datos.fases?.fase_3?.metricas_clave || {};
                const cin33 = datos.cinematica_continua_33 || {};
                const angCodoT0 = Number(
                    f3m.angulo_codo_contacto_3d ??
                        f3m.angulo_codo_impacto_3d ??
                        cin33.max_extension_codo_impacto ??
                        datos.angulos?.codoD ??
                        165.0,
                );

                setFatigaSeries((prev) => {
                    const numSalto = seqItem.salto_index || prev.labels.length + 1;
                    const picoSalto = Math.max(prev.picoSaltoCm, saltoNum);
                    const picoCodo = Math.max(prev.picoCodoDeg, angCodoT0);

                    const caidaSaltoPct = picoSalto > 0 ? ((picoSalto - saltoNum) / picoSalto) * 100 : 0;
                    const caidaCodoPct = picoCodo > 0 ? ((picoCodo - angCodoT0) / picoCodo) * 100 : 0;
                    const alSalto = caidaSaltoPct > 20;
                    const alCodo = caidaCodoPct > 20;
                    const hayAlerta = alSalto || alCodo || prev.hayAlertaClinica;

                    let msgClinico = prev.mensajeAlertaClinica;
                    if (alSalto || alCodo) {
                        const motivos = [];
                        if (alSalto) {
                            motivos.push(
                                `Caída del ${caidaSaltoPct.toFixed(1)}% en altura de salto (${saltoNum.toFixed(1)} cm vs Pico ${picoSalto.toFixed(1)} cm)`,
                            );
                        }
                        if (alCodo) {
                            motivos.push(
                                `Caída del ${caidaCodoPct.toFixed(1)}% en extensión de codo en t0 (${angCodoT0.toFixed(1)}° vs Pico ${picoCodo.toFixed(1)}°)`,
                            );
                        }
                        msgClinico = `Alerta en Salto #${numSalto}: ${motivos.join(' | ')}. Punto marcado en ROJO.`;
                    }

                    return {
                        labels: [...prev.labels, `Salto #${numSalto}`],
                        saltosCm: [...prev.saltosCm, Number(saltoNum.toFixed(2))],
                        codosDeg: [...prev.codosDeg, Number(angCodoT0.toFixed(1))],
                        coloresSalto: [...prev.coloresSalto, alSalto ? COLOR_ALERTA_ROJO : COLOR_SALTO_CYAN],
                        coloresCodo: [...prev.coloresCodo, alCodo ? COLOR_ALERTA_ROJO : COLOR_CODO_GREEN],
                        radiosSalto: [...prev.radiosSalto, alSalto ? 7 : 5],
                        radiosCodo: [...prev.radiosCodo, alCodo ? 7 : 5],
                        picoSaltoCm: Number(picoSalto.toFixed(1)),
                        picoCodoDeg: Number(picoCodo.toFixed(1)),
                        ultimoSaltoCm: Number(saltoNum.toFixed(1)),
                        ultimoCodoDeg: Number(angCodoT0.toFixed(1)),
                        alertaSalto: alSalto,
                        alertaCodo: alCodo,
                        hayAlertaClinica: hayAlerta,
                        mensajeAlertaClinica: msgClinico,
                    };
                });

                setUltimaSecuenciaLive(seqItem);
                if (!modoHistoricoRef.current) {
                    setSecuenciaMostrada(seqItem);
                }

                // Sincronizar cada captura completada con el Historial de IA (local + Supabase :8000) y Notificaciones
                try {
                    const repUnificada = adaptarEvaluacionBackendARep(datos, 'intermedio', seqItem);
                    if (repUnificada) {
                        const {
                            videoReplayBase64: _dropGif,
                            snapshotsFases: _dropSnaps,
                            ...repSinBinarios
                        } = repUnificada;
                        const repPersistible = {
                            ...repSinBinarios,
                            secuencia3D:
                                repSinBinarios.secuencia3D?.length > 0
                                    ? repSinBinarios.secuencia3D
                                    : seqItem.secuencia3D || [],
                        };

                        if (!sesionIaRef.current) {
                            sesionIaRef.current = crearSesion({
                                tecnica: gestoRaw.toLowerCase(),
                                modeloIa: 'mediapipe-3d-4fases',
                            });
                        }
                        if (datos.sesion_id) {
                            sesionIaRef.current.clienteUuid = String(datos.sesion_id);
                        }
                        sesionIaRef.current.tecnica = gestoRaw.toLowerCase();
                        sesionIaRef.current.fin = new Date().toISOString();
                        sesionIaRef.current.duracionSeg = sessionStartMsRef.current
                            ? Math.max(1, Math.round((Date.now() - sessionStartMsRef.current) / 1000))
                            : Number(sesionIaRef.current.duracionSeg || 1);
                        sesionPersistidaRef.current = false;
                        agregarRemate(sesionIaRef.current, repPersistible);
                        guardarSesionEnHistorialLocal(sesionIaRef.current);
                        registrarSaltoConJwt(repPersistible, datos.sesion_id || 'activa').catch(() => {});

                        fetch(`${FASTAPI_HTTP}/api/ia/analisis/sesiones`, {
                            method: 'POST',
                            headers: cabecerasAuthJwt(),
                            body: JSON.stringify(sesionIaRef.current),
                        }).catch(() => {});
                    }
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new Event('notificaciones:cambio'));
                    }
                } catch {
                    /* garantizar continuidad del loop de cámara */
                }

                // Notificar al modo guiado (si está activo) y gestionar locución sin colisión
                const guiadoFeedback = onEvalCbRef.current?.({ seqItem, datos });

                // Locución de voz del Coach Biomecánico
                if (!guiadoFeedback?.manejadoVoz) {
                    const textoVoz = formatearLocucionGesto(seqItem);
                    if (textoVoz && ultimaFraseRef.current !== textoVoz) {
                        hablarTexto(textoVoz);
                    }
                }

                // Sincronizar cabecera principal con métricas finales si estamos en vivo
                if (!modoHistoricoRef.current) {
                    let confEval = datos.confianza_clasificacion;
                    if (confEval === undefined && datos.vector_probabilidad_gestos) {
                        const vals = Object.values(datos.vector_probabilidad_gestos).map(Number);
                        if (vals.length) confEval = Math.max(...vals);
                    }
                    setLive((prev) => ({
                        ...prev,
                        saltoVerticalCm: saltoNum,
                        tiempoVueloSeg: tvNum,
                        confianzaPct: confEval !== undefined && confEval !== null ? Math.round(Number(confEval)) : null,
                        faseTitulo: `Postura Evaluada: ${gestoNombre}`,
                        faseTone: 'text-emerald-400',
                        faseDetalle: datos.diagnostico_causa_raiz || prev.faseDetalle,
                    }));
                }
            },
        });
    }, [hablarTexto]);

    const cancelFrameLoop = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        const video = videoRef.current;
        if (video && rvfcRef.current && 'cancelVideoFrameCallback' in video) {
            video.cancelVideoFrameCallback(rvfcRef.current);
        }
        rvfcRef.current = 0;
    }, []);

    const stopMediaStream = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const video = videoRef.current;
        if (video) video.srcObject = null;
    }, []);

    const runDetectionLoop = useCallback(() => {
        cancelFrameLoop();
        let lastVideoTime = -1;
        let fpsFrames = 0;
        let fpsStart = performance.now();
        let fpsVal = 0;

        const schedule = (fn) => {
            const video = videoRef.current;
            if (video && 'requestVideoFrameCallback' in video) {
                rvfcRef.current = video.requestVideoFrameCallback(fn);
            } else {
                rafRef.current = requestAnimationFrame(fn);
            }
        };

        const tick = () => {
            if (!runningRef.current) return;
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const landmarker = landmarkerRef.current;

            if (video && canvas && landmarker && video.readyState >= 2 && video.videoWidth) {
                if (video.currentTime !== lastVideoTime) {
                    lastVideoTime = video.currentTime;
                    const w = video.videoWidth || 640;
                    const h = video.videoHeight || 480;
                    if (canvas.width !== w || canvas.height !== h) {
                        canvas.width = w;
                        canvas.height = h;
                    }

                    const ahora = performance.now();
                    const res = landmarker.detectForVideo(video, ahora);
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, w, h);
                    ctx.drawImage(video, 0, 0, w, h);

                    const rawImage = res.landmarks?.[0];
                    const rawWorld = res.worldLandmarks?.[0];

                    if (rawImage) {
                        dibujarEsqueletoEnCanvas(ctx, rawImage, w, h, '#00FF99', '#00F0FF');

                        const sentFrameId = bridgeRef.current?.sendFrame({
                            t: ahora,
                            rawImage,
                            rawWorld,
                            gestoId: gestoIdRef.current,
                        });

                        if (sentFrameId != null) {
                            frameIdLiveRef.current = sentFrameId;
                            if ( snapshotsMapRef.current.size >= BUFFER_SNAPSHOT_MAX ) {
                                const firstKey = snapshotsMapRef.current.keys().next().value;
                                const evicted = snapshotsMapRef.current.get(firstKey);
                                snapshotsMapRef.current.delete(firstKey);
                                if (evicted?.canvasSnapshot && canvasPoolRef.current.length < BUFFER_SNAPSHOT_MAX) {
                                    canvasPoolRef.current.push(evicted.canvasSnapshot);
                                    evicted.canvasSnapshot = null;
                                } else {
                                    liberarSnapshot(evicted);
                                }
                            }

                            const off = canvasPoolRef.current.pop() || document.createElement('canvas');
                            if (off.width !== 640) off.width = 640;
                            if (off.height !== 480) off.height = 480;
                            off.getContext('2d').drawImage(canvas, 0, 0, 640, 480);

                            snapshotsMapRef.current.set(sentFrameId, {
                                canvasSnapshot: off,
                                landmarks2d: rawImage.map((p) => ({
                                    x: p.x,
                                    y: p.y,
                                    z: p.z ?? 0,
                                    visibility: p.visibility ?? 1,
                                })),
                                frameId: sentFrameId,
                            });
                        }
                    }

                    fpsFrames += 1;
                    if (ahora - fpsStart >= 1000) {
                        fpsVal = Math.round((fpsFrames * 1000) / (ahora - fpsStart));
                        fpsLiveRef.current = fpsVal;
                        fpsFrames = 0;
                        fpsStart = ahora;
                        setLive((prev) => (prev.fps === fpsVal ? prev : { ...prev, fps: fpsVal }));
                    }
                }
            }
            schedule(tick);
        };

        schedule(tick);
    }, [cancelFrameLoop]);

    const persistirFinSesion = useCallback(
        async ({ forzar = false } = {}) => {
            const sesActual = sesionIaRef.current;
            const reps = sesActual?.repeticiones || [];
            const totalSaltos = Math.max(reps.length, historialSesion.length);
            if (!forzar && totalSaltos === 0) return null;
            if (sesionPersistidaRef.current && !forzar) return null;

            const finIso = new Date().toISOString();
            const duracionRealSeg = sessionStartMsRef.current
                ? Math.max(1, Math.round((Date.now() - sessionStartMsRef.current) / 1000))
                : Number(sesActual?.duracionSeg || 0);

            if (sesActual) {
                sesActual.fin = finIso;
                sesActual.duracionSeg = duracionRealSeg;
                guardarSesionEnHistorialLocal(sesActual);
            }

            const efectividadPromedio =
                historialSesion.length > 0
                    ? Number(
                          (
                              historialSesion.reduce((acc, s) => acc + Number(s.score_global || 0), 0) /
                              historialSesion.length
                          ).toFixed(1),
                      )
                    : 0;
            const gestosSet = new Set(historialSesion.map((s) => s.gesto_tecnico).filter(Boolean));
            if (gestosSet.size === 0 && sesActual?.tecnica) {
                gestosSet.add(sesActual.tecnica);
            }
            if (gestosSet.size === 0) {
                gestosSet.add(gestoSeleccionado === 'auto' ? 'remate' : gestoSeleccionado);
            }

            const payloadSesion = {
                id: sesActual?.clienteUuid || (sesionId !== 'pendiente' ? sesionId : undefined),
                sesion_id: sesActual?.clienteUuid || (sesionId !== 'pendiente' ? sesionId : undefined),
                inicio: sesActual?.inicio || finIso,
                fin: finIso,
                fecha: sesActual?.inicio || finIso,
                duracionSeg: duracionRealSeg,
                duracion_segundos: duracionRealSeg,
                usuario_id: usuarioIdRef.current || undefined,
                tecnica: sesActual?.tecnica || Array.from(gestosSet)[0] || 'remate',
                total_saltos: totalSaltos,
                salto_maximo_cm: fatigaSeries.picoSaltoCm,
                codo_maximo_deg: fatigaSeries.picoCodoDeg,
                efectividad_promedio: efectividadPromedio,
                alertas_fatiga: fatigaSeries.hayAlertaClinica ? 1 : 0,
                gestos_entrenados: Array.from(gestosSet),
                repeticiones: reps,
            };

            sesionPersistidaRef.current = true;
            try {
                const cuerpoStr = JSON.stringify(payloadSesion);
                await fetch(`${FASTAPI_HTTP}/api/sesiones/finalizar`, {
                    method: 'POST',
                    headers: cabecerasAuthJwt(),
                    keepalive: cuerpoStr.length < 60000,
                    body: cuerpoStr,
                });
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new Event('notificaciones:cambio'));
                }
            } catch {
                /* respaldo local ya guardado en guardarSesionEnHistorialLocal */
            }
            return payloadSesion;
        },
        [historialSesion, gestoSeleccionado, fatigaSeries, sesionId],
    );

    useEffect(() => {
        persistirFinSesionRef.current = persistirFinSesion;
    }, [persistirFinSesion]);

    const detenerCamara = useCallback(() => {
        runningRef.current = false;
        cancelFrameLoop();
        stopMediaStream();
        bridgeRef.current?.disconnect();
        const canvas = canvasRef.current;
        if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        dispatchCam({ type: 'IDLE' });
        setLive((prev) => ({ ...prev, estadoBuffer: 'DETENIDO', framesEnBuffer: 0, postRestantes: 0 }));

        if ((sesionIaRef.current?.repeticiones?.length || historialSesion.length) > 0 && !sesionPersistidaRef.current) {
            persistirFinSesion().then((saved) => {
                if (saved) mostrarToast('Sesión guardada automáticamente en Supabase');
            });
        }
    }, [cancelFrameLoop, stopMediaStream, historialSesion.length, persistirFinSesion, mostrarToast]);

    const iniciarCamara = useCallback(async () => {
        if (runningRef.current) return;
        dispatchCam({ type: 'LOADING' });
        try {
            if (!landmarkerRef.current) {
                landmarkerRef.current = await createMediaPipeLandmarker();
            }
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
                audio: false,
            });
            streamRef.current = stream;
            const video = videoRef.current;
            video.srcObject = stream;
            await video.play();

            sessionStartMsRef.current = Date.now();
            sesionPersistidaRef.current = false;
            sesionIaRef.current = crearSesion({
                tecnica: gestoIdRef.current === 'auto' ? 'remate' : gestoIdRef.current,
                modeloIa: 'mediapipe-3d-4fases',
            });

            bridgeRef.current?.connect();
            runningRef.current = true;
            dispatchCam({ type: 'RUNNING' });
            runDetectionLoop();
        } catch (err) {
            dispatchCam({ type: 'ERROR', error: err?.message || 'No se pudo iniciar la cámara.' });
        }
    }, [runDetectionLoop]);

    const toggleCamara = useCallback(() => {
        if (runningRef.current) detenerCamara();
        else iniciarCamara();
    }, [detenerCamara, iniciarCamara]);

    const reiniciarBuffer = useCallback(() => {
        limpiarSnapshotsBuffer();
        setSecuenciaDescartadaBanner(null);
        setLive((prev) => ({
            ...prev,
            estadoBuffer: 'REINICIADO',
            framesEnBuffer: 0,
            postRestantes: 0,
            backend3DBuffer: [],
        }));
        bridgeRef.current?.sendAction('reiniciar_calibracion');
        setCalibracion({ ...INITIAL_CALIBRACION, visibleOverlay: true });
    }, [limpiarSnapshotsBuffer]);

    const saltarCalibracion = useCallback(() => {
        bridgeRef.current?.sendAction('saltar_calibracion');
    }, []);

    const toggleVozCoach = useCallback(() => {
        setVozActiva((prev) => {
            const next = !prev;
            setVoiceCoachEnabled(next);
            if (!next) stopVoiceCoach();
            return next;
        });
    }, []);

    const repetirAudioCoach = useCallback(() => {
        const txt =
            ultimaFraseRef.current ||
            'Sistema iniciado. Por favor, ponte frente a la cámara con los brazos en T para calibrar.';
        hablarTexto(txt);
    }, [hablarTexto]);

    const cargarSaltoHistorico = useCallback((saltoIndex) => {
        setHistorialSesion((prev) => {
            const found =
                prev.find((s) => Number(s.salto_index) === Number(saltoIndex)) || prev[Number(saltoIndex) - 1];
            if (found) {
                modoHistoricoRef.current = true;
                setIndiceActivo(Number(saltoIndex));
                setSecuenciaMostrada(found);
            }
            return prev;
        });
    }, []);

    const volverAlDirecto = useCallback(() => {
        modoHistoricoRef.current = false;
        setIndiceActivo(null);
        if (ultimaSecuenciaLive) {
            setSecuenciaMostrada(ultimaSecuenciaLive);
        }
    }, [ultimaSecuenciaLive]);

    const descartarAlertaFatiga = useCallback(() => {
        setAlertaFatigaTecnica(null);
    }, []);

    const exportarLogJson = useCallback(() => {
        const target = secuenciaMostrada || ultimaSecuenciaLive;
        if (!target) {
            mostrarToast('Realiza una jugada primero para exportar el log JSON.');
            return;
        }
        const copia = { ...target, snapshotsFases: undefined };
        const jsonStr = JSON.stringify(copia, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        a.href = url;
        a.download = `volleyscan_telemetria_t0_${target.t0_frame_id || 'eval'}_${ts}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [secuenciaMostrada, ultimaSecuenciaLive, mostrarToast]);

    const finalizarYExportarReporte = useCallback(
        async (graficaCanvasElem) => {
            if (runningRef.current) detenerCamara();

            const totalSaltos = historialSesion.length;
            const efectividadPromedio =
                totalSaltos > 0
                    ? Number(
                          (
                              historialSesion.reduce((acc, s) => acc + Number(s.score_global || 0), 0) /
                              totalSaltos
                          ).toFixed(1),
                      )
                    : 0;
            const gestosSet = new Set(historialSesion.map((s) => s.gesto_tecnico).filter(Boolean));
            if (gestosSet.size === 0) {
                gestosSet.add(gestoSeleccionado === 'auto' ? 'Remate' : gestoSeleccionado);
            }

            await persistirFinSesion({ forzar: true });

            // Generar reporte HTML imprimible/PDF con la gráfica Base64
            let graficaBase64 = null;
            if (graficaCanvasElem && typeof graficaCanvasElem.toDataURL === 'function') {
                graficaBase64 = graficaCanvasElem.toDataURL('image/png');
            }

            const win = window.open('', '_blank', 'width=860,height=960');
            if (win) {
                win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>VolleyScan_Reporte</title>
                <style>
                    body{font-family:Arial,sans-serif;background:#fff;color:#0f172a;padding:28px;}
                    .hdr{background:#0b1120;color:#00F0FF;padding:20px;border-radius:10px;text-align:center;}
                    .hdr p{color:#e2e8f0;font-size:12px;margin:6px 0 0;}
                    .box{margin-top:20px;padding:16px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;}
                    .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:14px;}
                    .chart{margin-top:20px;text-align:center;}
                    .chart img{max-width:100%;border-radius:8px;background:#080d1a;}
                </style></head><body>
                <div class="hdr"><h1>VolleyScan AI — Reporte Biomecánico y de Fatiga</h1>
                <p>Sesión: ${sesionId} | Jugador: ${usuarioId} | ${new Date().toLocaleString('es-ES')}</p></div>
                <div class="box"><h3>Resumen Ejecutivo</h3><div class="grid">
                    <div>Total de Saltos: <strong>${totalSaltos}</strong></div>
                    <div>Efectividad Promedio: <strong>${efectividadPromedio}%</strong></div>
                    <div>Salto Máximo: <strong>${fatigaSeries.picoSaltoCm} cm</strong></div>
                    <div>Pico Codo (t0): <strong>${fatigaSeries.picoCodoDeg}°</strong></div>
                    <div>Alertas de Fatiga (&gt;20%): <strong>${fatigaSeries.hayAlertaClinica ? 'Detectada' : 'Sin alertas'}</strong></div>
                    <div>Gestos: <strong>${Array.from(gestosSet).join(', ')}</strong></div>
                </div></div>
                ${graficaBase64 ? `<div class="chart"><h3>Curva Analítica de Fatiga Neuromuscular</h3><img src="${graficaBase64}" alt="Gráfica Fatiga" /></div>` : ''}
                <script>window.onload=function(){window.print();}</script></body></html>`);
                win.document.close();
            }

            mostrarToast('Sesión guardada exitosamente en la nube');
        },
        [detenerCamara, historialSesion, gestoSeleccionado, fatigaSeries, sesionId, usuarioId, persistirFinSesion, mostrarToast],
    );

    useEffect(() => {
        return () => {
            if ((sesionIaRef.current?.repeticiones?.length || 0) > 0 && !sesionPersistidaRef.current) {
                persistirFinSesionRef.current?.().catch(() => {});
            }
            runningRef.current = false;
            cancelFrameLoop();
            stopMediaStream();
            bridgeRef.current?.disconnect();
            limpiarSnapshotsBuffer();
            stopVoiceCoach();
            if (timerOcultarCalibRef.current) clearTimeout(timerOcultarCalibRef.current);
            landmarkerRef.current?.close();
            landmarkerRef.current = null;
        };
    }, [cancelFrameLoop, stopMediaStream, limpiarSnapshotsBuffer]);

    return {
        videoRef,
        canvasRef,
        camStatus: camLifecycle.status,
        camError: camLifecycle.error,
        camaraActiva: camLifecycle.status === 'running',
        cargandoIA: camLifecycle.status === 'loading',
        backendConnected,
        sesionId,
        usuarioId,
        setUsuarioId,
        gestoSeleccionado,
        setGestoSeleccionado,
        vozActiva,
        fraseCoach,
        fraseCoachBar,
        toastMsg,
        calibracion,
        live,
        historialSesion,
        indiceActivo,
        modoHistorico: indiceActivo !== null,
        secuenciaMostrada,
        secuenciaDescartadaBanner,
        alertaFatigaTecnica,
        fatigaSeries,
        toggleCamara,
        reiniciarBuffer,
        saltarCalibracion,
        toggleVozCoach,
        repetirAudioCoach,
        cargarSaltoHistorico,
        volverAlDirecto,
        descartarAlertaFatiga,
        exportarLogJson,
        finalizarYExportarReporte,
        persistirFinSesion,
        hablarTexto,
    };
}
