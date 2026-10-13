'use client';

// ─────────────────────────────────────────────────────────────
// usePoseCamera.js — Análisis de gestos (VolleyScan)
//
// Orquesta todo el pipeline en el navegador:
//   cámara (60 fps) → MediaPipe → suavizado One Euro → medir + dibujar
//                                                    → motor de repeticiones
//
// Dos juegos de puntos por cuadro:
//   · IMAGEN (píxeles)  → se dibujan en el canvas y alimentan el motor
//   · MUNDO (metros 3D) → se miden los ángulos, sin distorsión de perspectiva
//
// Reparto de responsabilidades:
//   · lib/pose/smoothing.js        quita el temblor de los puntos
//   · lib/pose/renderer.js         dibuja en el canvas (sin React)
//   · lib/pose/geometry.js         ángulos, tronco y encuadre
//   · lib/pose/engine/*            detecta el remate y lo califica
//   · lib/pose/movimientos/*       estándar técnico de cada movimiento
//   · este hook                    ciclo de vida, bucle y estado para la UI
//
// Guardado: el hook avisa de cada repetición con el callback `onRep`.
// Guardar en la base de datos se conecta ahí, sin tocar el motor.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createRepAnalyzer } from '@/lib/engine/repAnalyzer';
import { assessFraming, measureAngles } from '@/lib/pose/geometry';
import { REMATE } from '@/lib/movimientos/remate';
import { createRenderer } from '@/lib/pose/renderer';
import { PoseSmoother } from '@/lib/pose/smoothing';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URLS = {
    lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
    heavy:
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
};

const PANEL_INTERVAL_MS = 100;
const DEFAULT_LAYERS = { skeleton: true, angles: true, trails: true };
const INITIAL_LIVE = {
    angles: {},
    ranges: {},
    framing: { status: 'none', hint: '' },
    fps: 0,
    latency: 0,
};

// ── Ciclo de vida como máquina de estados ─────────────────
function lifecycleReducer(state, action) {
    switch (action.type) {
        case 'LOADING':
            return { status: 'loading', error: '' };
        case 'RUNNING':
            return { status: 'running', error: '' };
        case 'ERROR':
            return { status: 'error', error: action.error };
        case 'IDLE':
            return { status: 'idle', error: '' };
        default:
            return state;
    }
}

function friendlyError(err) {
    switch (err?.name) {
        case 'NotAllowedError':
            return 'Permiso de cámara denegado. Habilítalo desde el candado de la barra de direcciones y vuelve a intentarlo.';
        case 'NotFoundError':
            return 'No se encontró ninguna cámara. Conecta una y vuelve a intentarlo.';
        case 'NotReadableError':
            return 'La cámara está siendo usada por otra aplicación. Ciérrala y vuelve a intentarlo.';
        default:
            return 'No se pudo iniciar el análisis. Revisa tu conexión y vuelve a intentarlo.';
    }
}

// GPU primero (mucho más rápido); si el equipo no la soporta, CPU.
async function createLandmarker(model) {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);

    const build = (delegate) =>
        PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URLS[model] ?? MODEL_URLS.full, delegate },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

    try {
        return await build('GPU');
    } catch (err) {
        console.warn('[usePoseCamera] GPU no disponible, usando CPU.', err);
        return build('CPU');
    }
}

/**
 * @param {{
 *   model?: 'lite' | 'full' | 'heavy',
 *   targetFps?: number,
 *   standard?: object,
 *   onRep?: (rep: object) => void,
 * }} options
 *   model:     'lite' = más fluido · 'full' = equilibrado · 'heavy' = más preciso
 *   targetFps: cuadros por segundo que se piden a la cámara (el valor real se mide)
 *   standard:  estándar del movimiento a evaluar (por defecto, el remate)
 *   onRep:     se llama al terminar cada repetición, ya calificada
 */
export function usePoseCamera({ model = 'full', targetFps = 60, standard = REMATE, onRep } = {}) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const landmarkerRef = useRef(null);
    const streamRef = useRef(null);
    const rafRef = useRef(0);
    const rvfcRef = useRef(0);
    const runningRef = useRef(false);

    // Un suavizador para la imagen (x, y) y otro para el mundo 3D (x, y, z)
    const imageSmootherRef = useRef(null);
    const worldSmootherRef = useRef(null);
    const rendererRef = useRef(null);
    const analyzerRef = useRef(null);
    if (!imageSmootherRef.current) imageSmootherRef.current = new PoseSmoother(undefined, ['x', 'y']);
    if (!worldSmootherRef.current) worldSmootherRef.current = new PoseSmoother(undefined, ['x', 'y', 'z']);
    if (!rendererRef.current) rendererRef.current = createRenderer();
    if (!analyzerRef.current) analyzerRef.current = createRepAnalyzer(standard);

    const rangesRef = useRef({}); // { codoD: {min, max}, ... }
    const layersRef = useRef(DEFAULT_LAYERS);
    const facingRef = useRef('user');
    const phaseRef = useRef('sin_cuerpo');
    const repsRef = useRef([]);
    const onRepRef = useRef(onRep);

    const [lifecycle, dispatch] = useReducer(lifecycleReducer, { status: 'idle', error: '' });
    const [live, setLive] = useState(INITIAL_LIVE);
    const [layers, setLayers] = useState(DEFAULT_LAYERS);
    const [facing, setFacing] = useState('user');
    const [camera, setCamera] = useState(null); // { width, height, frameRate } reales
    const [phase, setPhase] = useState('sin_cuerpo');
    const [reps, setReps] = useState([]);

    // El bucle lee las capas y el callback desde refs para no depender de re-renders
    useEffect(() => {
        layersRef.current = layers;
    }, [layers]);

    useEffect(() => {
        onRepRef.current = onRep;
    }, [onRep]);

    // ── Programación de cuadros ─────────────────────────────
    // requestVideoFrameCallback se dispara una vez por cada cuadro REAL del
    // video, sin repetir ni saltarse. Si el navegador no lo soporta, usamos
    // requestAnimationFrame y descartamos cuadros repetidos.
    const scheduleFrame = useCallback((callback) => {
        const video = videoRef.current;
        if (video && 'requestVideoFrameCallback' in video) {
            rvfcRef.current = video.requestVideoFrameCallback(callback);
        } else {
            rafRef.current = requestAnimationFrame(callback);
        }
    }, []);

    const cancelFrame = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        const video = videoRef.current;
        if (video && rvfcRef.current && 'cancelVideoFrameCallback' in video) {
            video.cancelVideoFrameCallback(rvfcRef.current);
        }
        rvfcRef.current = 0;
    }, []);

    // ── Cámara ──────────────────────────────────────────────
    const stopStream = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const video = videoRef.current;
        if (video) video.srcObject = null;
    }, []);

    const openStream = useCallback(
        async (mode) => {
            stopStream();
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: mode },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: targetFps },
                },
                audio: false,
            });
            streamRef.current = stream;

            const video = videoRef.current;
            video.srcObject = stream;
            await video.play();

            // Lo que la cámara entregó de verdad (puede ser menos de lo pedido)
            const settings = stream.getVideoTracks()[0]?.getSettings?.() ?? {};
            setCamera({
                width: settings.width,
                height: settings.height,
                frameRate: settings.frameRate,
            });
        },
        [stopStream, targetFps],
    );

    // ── Bucle de detección ──────────────────────────────────
    const runLoop = useCallback(() => {
        cancelFrame();

        let lastVideoTime = -1;
        let lastPanel = 0;
        let frames = 0;
        let fpsStart = performance.now();
        let fps = 0;
        let latency = 0; // media móvil del tiempo de inferencia (ms)

        const publish = (pts, angles, w, h) => {
            for (const [id, deg] of Object.entries(angles)) {
                if (deg === null) continue;
                const r = rangesRef.current[id];
                rangesRef.current[id] = r
                    ? { min: Math.min(r.min, deg), max: Math.max(r.max, deg) }
                    : { min: deg, max: deg };
            }
            setLive({
                angles,
                ranges: { ...rangesRef.current },
                framing: assessFraming(pts, w, h),
                fps,
                latency: Math.round(latency),
            });
        };

        const tick = () => {
            if (!runningRef.current) return;

            const video = videoRef.current;
            const canvas = canvasRef.current;
            const landmarker = landmarkerRef.current;

            if (video && canvas && landmarker && video.readyState >= 2 && video.videoWidth) {
                if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                }

                // Descarta cuadros repetidos (solo ocurre con el respaldo de rAF)
                if (video.currentTime !== lastVideoTime) {
                    lastVideoTime = video.currentTime;

                    const t0 = performance.now();
                    const result = landmarker.detectForVideo(video, t0);
                    const t1 = performance.now();
                    latency = latency * 0.8 + (t1 - t0) * 0.2;

                    const w = canvas.width;
                    const h = canvas.height;
                    const rawImage = result.landmarks?.[0];
                    const rawWorld = result.worldLandmarks?.[0];

                    let pts = null;
                    let angles = {};

                    if (rawImage) {
                        // Imagen: suavizar en coordenadas normalizadas y pasar a píxeles
                        pts = imageSmootherRef.current
                            .apply(rawImage, t1)
                            .map((p) => ({ x: p.x * w, y: p.y * h, v: p.v }));

                        // Mundo: suavizar en 3D (metros) y medir con eso. La visibilidad
                        // se toma de la imagen para que ambos juegos coincidan.
                        const measured = rawWorld
                            ? worldSmootherRef.current.apply(rawWorld, t1).map((p, i) => ({ ...p, v: pts[i].v }))
                            : pts; // respaldo: si faltara el 3D, se mide en 2D
                        angles = measureAngles(measured);
                    } else {
                        imageSmootherRef.current.reset();
                        worldSmootherRef.current.reset();
                    }

                    rendererRef.current.render(canvas.getContext('2d'), {
                        pts,
                        angles,
                        w,
                        h,
                        now: t1,
                        mirrored: facingRef.current === 'user',
                        layers: layersRef.current,
                    });

                    // Motor de repeticiones: fase en vivo y, al terminar, el remate calificado.
                    // La fase solo toca React cuando CAMBIA (unas pocas veces por remate).
                    const out = analyzerRef.current.push({ t: t1, pts, angles });
                    if (out.phase !== phaseRef.current) {
                        phaseRef.current = out.phase;
                        setPhase(out.phase);
                    }
                    if (out.rep) {
                        repsRef.current = [...repsRef.current, out.rep];
                        setReps(repsRef.current);
                        onRepRef.current?.(out.rep);
                    }

                    frames += 1;
                    if (t1 - fpsStart >= 1000) {
                        fps = Math.round((frames * 1000) / (t1 - fpsStart));
                        frames = 0;
                        fpsStart = t1;
                    }

                    if (t1 - lastPanel >= PANEL_INTERVAL_MS) {
                        lastPanel = t1;
                        publish(pts, angles, w, h);
                    }
                }
            }

            scheduleFrame(tick);
        };

        scheduleFrame(tick);
    }, [cancelFrame, scheduleFrame]);

    const resetPipeline = useCallback(() => {
        imageSmootherRef.current.reset();
        worldSmootherRef.current.reset();
        rendererRef.current.reset();
        analyzerRef.current.reset();
        phaseRef.current = 'sin_cuerpo';
        setPhase('sin_cuerpo');
    }, []);

    // ── Controles públicos ──────────────────────────────────
    const stop = useCallback(() => {
        runningRef.current = false;
        cancelFrame();
        stopStream();

        const canvas = canvasRef.current;
        if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

        resetPipeline();
        setLive(INITIAL_LIVE);
        setCamera(null);
        dispatch({ type: 'IDLE' });
        // Los remates de la sesión se conservan en pantalla hasta la próxima sesión
    }, [cancelFrame, resetPipeline, stopStream]);

    const fail = useCallback(
        (err) => {
            console.error('[usePoseCamera]', err);
            runningRef.current = false;
            cancelFrame();
            stopStream();
            setCamera(null);
            dispatch({ type: 'ERROR', error: friendlyError(err) });
        },
        [cancelFrame, stopStream],
    );

    const start = useCallback(async () => {
        if (runningRef.current) return;
        dispatch({ type: 'LOADING' });

        try {
            // El modelo se carga solo la primera vez y solo cuando el usuario lo pide
            if (!landmarkerRef.current) landmarkerRef.current = await createLandmarker(model);
            await openStream(facingRef.current);

            // Sesión nueva: rangos y remates en cero
            rangesRef.current = {};
            repsRef.current = [];
            setReps([]);
            resetPipeline();

            runningRef.current = true;
            dispatch({ type: 'RUNNING' });
            runLoop();
        } catch (err) {
            fail(err);
        }
    }, [fail, model, openStream, resetPipeline, runLoop]);

    const switchCamera = useCallback(async () => {
        const next = facingRef.current === 'user' ? 'environment' : 'user';
        facingRef.current = next;
        setFacing(next);
        if (!runningRef.current) return;

        // Pausamos el bucle mientras cambia el stream
        runningRef.current = false;
        cancelFrame();
        try {
            await openStream(next);
            resetPipeline();
            runningRef.current = true;
            runLoop();
        } catch (err) {
            fail(err);
        }
    }, [cancelFrame, fail, openStream, resetPipeline, runLoop]);

    const toggleLayer = useCallback((key) => {
        setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const resetRanges = useCallback(() => {
        rangesRef.current = {};
        setLive((prev) => ({ ...prev, ranges: {} }));
    }, []);

    // Si el usuario cambia de pestaña, pausamos el bucle (ahorra batería)
    useEffect(() => {
        const onVisibility = () => {
            if (!runningRef.current) return;
            if (document.hidden) cancelFrame();
            else runLoop();
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [cancelFrame, runLoop]);

    // Limpieza al salir de la página: apaga la cámara y libera el modelo
    useEffect(() => {
        return () => {
            runningRef.current = false;
            cancelFrame();
            streamRef.current?.getTracks().forEach((t) => t.stop());
            landmarkerRef.current?.close();
            landmarkerRef.current = null;
        };
    }, [cancelFrame]);

    return {
        videoRef,
        canvasRef,
        status: lifecycle.status,
        error: lifecycle.error,
        live,
        camera,
        layers,
        facing,
        mirrored: facing === 'user',
        phase,
        reps,
        start,
        stop,
        switchCamera,
        toggleLayer,
        resetRanges,
    };
}