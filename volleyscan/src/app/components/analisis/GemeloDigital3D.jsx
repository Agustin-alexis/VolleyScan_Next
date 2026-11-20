'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LM } from '@/lib/pose/geometry';
import styles from './GemeloDigital3D.module.css';

const HUESOS = [
    { par: [LM.L_SHOULDER, LM.R_SHOULDER], grupo: 'tronco' },
    { par: [LM.L_HIP, LM.R_HIP], grupo: 'tronco' },
    { par: [LM.L_SHOULDER, LM.L_HIP], grupo: 'tronco' },
    { par: [LM.R_SHOULDER, LM.R_HIP], grupo: 'tronco' },
    { par: [LM.L_SHOULDER, LM.L_ELBOW], grupo: 'brazoI' },
    { par: [LM.L_ELBOW, LM.L_WRIST], grupo: 'brazoI' },
    { par: [LM.R_SHOULDER, LM.R_ELBOW], grupo: 'brazoD' },
    { par: [LM.R_ELBOW, LM.R_WRIST], grupo: 'brazoD' },
    { par: [LM.L_HIP, LM.L_KNEE], grupo: 'piernas' },
    { par: [LM.L_KNEE, LM.L_ANKLE], grupo: 'piernas' },
    { par: [LM.R_HIP, LM.R_KNEE], grupo: 'piernas' },
    { par: [LM.R_KNEE, LM.R_ANKLE], grupo: 'piernas' },
];

const ARTICULACIONES_CLAVE = [
    LM.L_ELBOW,
    LM.R_ELBOW,
    LM.L_WRIST,
    LM.R_WRIST,
    LM.L_KNEE,
    LM.R_KNEE,
];

const ETAPAS_HISTORIAL_LABEL = {
    carga: 'PREPARACIÓN',
    armado: 'ARMADO',
    contacto: 'CONTACTO',
    golpeo: 'CONTACTO',
    caida: 'CAÍDA',
};

/**
 * Reproductor Interactivo del Gemelo Digital 3D.
 * Conectado al búfer temporal en vivo y a las secuencias 3D suavizadas del backend FastAPI (:8000).
 * Soporta rotación orbital 360° (yaw/pitch), zoom, cámara lenta 0.5x y saltos por fase.
 */
export default function GemeloDigital3D({
    liveBuffer = [],
    rep = null,
    backendConnected = false,
    running = false,
    framesEnBuffer = 0,
    liveSaltoCm = 0,
    liveAngles = {},
    jumpRequest = null,
    indicesFases = null,
    compact = false,
    variant = 'default',
}) {
    const canvasRef = useRef(null);
    const dragRef = useRef(null);

    const secuenciaReplay = useMemo(
        () => (Array.isArray(rep?.secuencia3D) ? rep.secuencia3D : []),
        [rep],
    );
    const tieneReplay = secuenciaReplay.length > 0;

    // Estado derivado sin efectos en cascada: sincroniza automáticamente ante nuevo rep, running o salto de fase
    const jumpTs = jumpRequest?.ts ?? null;
    const [ctrl, setCtrl] = useState(() => ({
        repRef: rep,
        jumpTs: null,
        runningRef: running,
        modo: tieneReplay ? 'replay' : 'live',
        frameIdx: 0,
        isPlaying: true,
        followLive: true,
    }));
    const [slowMotion, setSlowMotion] = useState(false);
    const [autoOrbit, setAutoOrbit] = useState(false);
    const [orbit, setOrbit] = useState({ yaw: 0.42, pitch: 0.16, zoom: 1.0 });

    const estadoEfectivo = useMemo(() => {
        const haySaltoNuevo = jumpTs != null && ctrl.jumpTs !== jumpTs && tieneReplay;
        const hayRepNuevo = ctrl.repRef !== rep && tieneReplay;
        const inicioLive = ctrl.runningRef !== running && running && !tieneReplay;

        let modoActual = ctrl.modo;
        let idxActual = ctrl.frameIdx;
        let playingActual = ctrl.isPlaying;
        let followActual = ctrl.followLive;

        if (haySaltoNuevo) {
            modoActual = 'replay';
            playingActual = false;
            idxActual = Math.min(secuenciaReplay.length - 1, Math.max(0, jumpRequest?.frameIdx ?? 0));
        } else if (hayRepNuevo) {
            modoActual = 'replay';
            idxActual = 0;
            playingActual = true;
        } else if (inicioLive) {
            modoActual = 'live';
            followActual = true;
        }

        return {
            modo: modoActual,
            frameIdx: idxActual,
            isPlaying: playingActual,
            followLive: followActual,
        };
    }, [ctrl, rep, jumpTs, jumpRequest?.frameIdx, running, tieneReplay, secuenciaReplay.length]);

    const { modo, frameIdx, isPlaying, followLive } = estadoEfectivo;

    const actualizarCtrl = (patch) => {
        setCtrl((prev) => {
            const base = {
                modo: estadoEfectivo.modo,
                frameIdx: estadoEfectivo.frameIdx,
                isPlaying: estadoEfectivo.isPlaying,
                followLive: estadoEfectivo.followLive,
                ...prev,
            };
            const mismoSalto = jumpTs == null || prev.jumpTs === jumpTs;
            const mismoRep = prev.repRef === rep;
            const baseIdx = mismoSalto && mismoRep ? prev.frameIdx : estadoEfectivo.frameIdx;
            const baseModo = mismoSalto && mismoRep ? prev.modo : estadoEfectivo.modo;
            const basePlay = mismoSalto && mismoRep ? prev.isPlaying : estadoEfectivo.isPlaying;
            const baseFollow = prev.runningRef === running ? prev.followLive : estadoEfectivo.followLive;

            const nextVal =
                typeof patch === 'function'
                    ? patch({
                          modo: baseModo,
                          frameIdx: baseIdx,
                          isPlaying: basePlay,
                          followLive: baseFollow,
                      })
                    : patch;

            return {
                ...base,
                repRef: rep,
                jumpTs,
                runningRef: running,
                modo: nextVal.modo !== undefined ? nextVal.modo : baseModo,
                frameIdx: nextVal.frameIdx !== undefined ? nextVal.frameIdx : baseIdx,
                isPlaying: nextVal.isPlaying !== undefined ? nextVal.isPlaying : basePlay,
                followLive: nextVal.followLive !== undefined ? nextVal.followLive : baseFollow,
            };
        });
    };

    const secuenciaActiva = modo === 'replay' && tieneReplay ? secuenciaReplay : liveBuffer;

    // Reproducción automática en modo Replay (0.5x lento / 1x normal)
    useEffect(() => {
        if (modo !== 'replay' || !isPlaying || secuenciaReplay.length <= 1) return undefined;
        const intervalMs = slowMotion ? 140 : 65;
        const id = setInterval(() => {
            setCtrl((prev) => {
                const mismoCtx =
                    prev.repRef === rep && (jumpTs == null || prev.jumpTs === jumpTs);
                const curIdx = mismoCtx ? prev.frameIdx : 0;
                return {
                    ...prev,
                    repRef: rep,
                    jumpTs,
                    runningRef: running,
                    modo: 'replay',
                    isPlaying: true,
                    frameIdx: (curIdx + 1) % secuenciaReplay.length,
                };
            });
        }, intervalMs);
        return () => clearInterval(id);
    }, [modo, isPlaying, slowMotion, secuenciaReplay.length, rep, jumpTs, running]);

    // Auto-órbita suave cuando el usuario activa 'Rotar 360°'
    useEffect(() => {
        if (!autoOrbit) return undefined;
        const id = setInterval(() => {
            setOrbit((prev) => ({ ...prev, yaw: prev.yaw + 0.035 }));
        }, 40);
        return () => clearInterval(id);
    }, [autoOrbit]);

    // Seguimiento del último frame del búfer circular en modo Vivo
    const indiceMostrar =
        modo === 'live' && followLive
            ? Math.max(0, liveBuffer.length - 1)
            : Math.min(frameIdx, Math.max(0, secuenciaActiva.length - 1));

    const frameActual = secuenciaActiva[indiceMostrar] ?? null;

    // Renderizado 3D con proyección perspectiva y ordenación de profundidad Z
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.45, 20, W * 0.5, H * 0.5, W * 0.68);
        bgGrad.addColorStop(0, '#131d31');
        bgGrad.addColorStop(1, '#070b14');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        const cosY = Math.cos(orbit.yaw);
        const sinY = Math.sin(orbit.yaw);
        const cosP = Math.cos(orbit.pitch);
        const sinP = Math.sin(orbit.pitch);
        const fov = (compact ? 290 : 340) * orbit.zoom;
        const camDist = 4.2;

        const project = (x, y, z) => {
            const rx = x * cosY - z * sinY;
            const rz1 = x * sinY + z * cosY;
            const ry = y * cosP - rz1 * sinP;
            const rz = y * sinP + rz1 * cosP + camDist;
            const scale = fov / Math.max(0.8, rz);
            return {
                sx: W * 0.5 + rx * scale,
                sy: H * 0.52 + ry * scale,
                rz,
            };
        };

        // Grilla 3D de suelo de cancha
        const floorY = 1.65;
        ctx.lineWidth = 1;
        for (let g = -2.0; g <= 2.01; g += 0.4) {
            const isCenter = Math.abs(g) < 0.05;
            ctx.strokeStyle = isCenter ? 'rgba(34, 211, 238, 0.45)' : 'rgba(51, 65, 85, 0.42)';

            const p1 = project(g, floorY, -2.0);
            const p2 = project(g, floorY, 2.0);
            ctx.beginPath();
            ctx.moveTo(p1.sx, p1.sy);
            ctx.lineTo(p2.sx, p2.sy);
            ctx.stroke();

            const q1 = project(-2.0, floorY, g);
            const q2 = project(2.0, floorY, g);
            ctx.beginPath();
            ctx.moveTo(q1.sx, q1.sy);
            ctx.lineTo(q2.sx, q2.sy);
            ctx.stroke();
        }

        if (!frameActual?.puntos) return;

        const pts = frameActual.puntos;
        const liftOffset = (frameActual.lift ?? 0) * 0.45;
        const get3D = (idx) => {
            const p = pts[idx];
            if (!p) return null;
            return { x: p.x, y: p.y - liftOffset, z: p.z ?? 0 };
        };

        // Sombra proyectada en la pista
        const sombraCentro = project(0, floorY, 0);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.16)';
        ctx.beginPath();
        ctx.ellipse(
            sombraCentro.sx,
            sombraCentro.sy,
            Math.max(14, 40 * (1 - liftOffset * 0.4) * orbit.zoom),
            Math.max(5, 14 * (1 - liftOffset * 0.4) * orbit.zoom),
            0,
            0,
            Math.PI * 2,
        );
        ctx.fill();

        const esContacto = frameActual.fase === 'contacto' || frameActual.fase === 'golpeo';
        const colorPorGrupo = (grupo) => {
            if (esContacto && (grupo === 'brazoD' || grupo === 'brazoI')) return '#fbbf24';
            if (grupo === 'brazoD' || grupo === 'brazoI') return '#34d399';
            if (grupo === 'piernas') return '#38bdf8';
            return '#cbd5e1';
        };

        const huesosProyectados = HUESOS.map(({ par, grupo }) => {
            const a3 = get3D(par[0]);
            const b3 = get3D(par[1]);
            if (!a3 || !b3) return null;
            const pa = project(a3.x, a3.y, a3.z);
            const pb = project(b3.x, b3.y, b3.z);
            return {
                pa,
                pb,
                zMed: (pa.rz + pb.rz) * 0.5,
                color: colorPorGrupo(grupo),
                destacado: grupo.startsWith('brazo') || grupo === 'piernas',
            };
        })
            .filter(Boolean)
            .sort((a, b) => b.zMed - a.zMed);

        for (const h of huesosProyectados) {
            ctx.save();
            ctx.strokeStyle = h.color;
            ctx.shadowColor = h.color;
            ctx.shadowBlur = esContacto ? 14 : 7;
            ctx.lineWidth = h.destacado ? 6.2 * orbit.zoom : 4.5 * orbit.zoom;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(h.pa.sx, h.pa.sy);
            ctx.lineTo(h.pb.sx, h.pb.sy);
            ctx.stroke();
            ctx.restore();
        }

        for (const idxStr of Object.keys(pts)) {
            const idx = Number(idxStr);
            const p3 = get3D(idx);
            if (!p3) continue;
            const pr = project(p3.x, p3.y, p3.z);
            if (idx === LM.NOSE) {
                ctx.save();
                ctx.fillStyle = '#0f172a';
                ctx.strokeStyle = esContacto ? '#fbbf24' : '#38bdf8';
                ctx.lineWidth = 2.8 * orbit.zoom;
                ctx.beginPath();
                ctx.arc(pr.sx, pr.sy, Math.max(7, 12 * orbit.zoom), 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            } else {
                const esClave = ARTICULACIONES_CLAVE.includes(idx);
                ctx.save();
                ctx.fillStyle = esClave ? (esContacto ? '#fbbf24' : '#22d3ee') : '#f8fafc';
                ctx.beginPath();
                ctx.arc(pr.sx, pr.sy, (esClave ? 4.8 : 3.4) * orbit.zoom, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
    }, [frameActual, orbit, compact]);

    const onPointerDown = (e) => {
        setAutoOrbit(false);
        dragRef.current = { x: e.clientX, y: e.clientY, yaw: orbit.yaw, pitch: orbit.pitch };
    };
    const onPointerMove = (e) => {
        if (!dragRef.current) return;
        const dx = e.clientX - dragRef.current.x;
        const dy = e.clientY - dragRef.current.y;
        setOrbit((prev) => ({
            ...prev,
            yaw: dragRef.current.yaw + dx * 0.01,
            pitch: Math.max(-0.6, Math.min(0.85, dragRef.current.pitch + dy * 0.008)),
        }));
    };
    const onPointerUp = () => {
        dragRef.current = null;
    };

    const resolvedFasesIdx = useMemo(() => {
        if (indicesFases) return indicesFases;
        if (rep?.fases4) {
            return {
                carga: rep.fases4.fase_1?.frameIdx ?? 0,
                armado: rep.fases4.fase_2?.frameIdx ?? Math.floor(secuenciaReplay.length * 0.35),
                contacto: rep.fases4.fase_3?.frameIdx ?? Math.floor(secuenciaReplay.length * 0.6),
                caida: rep.fases4.fase_4?.frameIdx ?? Math.max(0, secuenciaReplay.length - 1),
            };
        }
        return null;
    }, [indicesFases, rep, secuenciaReplay.length]);

    const angAct = frameActual?.angulos ?? liveAngles ?? {};
    const codoAct = angAct.codoD ?? angAct.codoI ?? null;
    const rodillaAct = angAct.rodillaD ?? angAct.rodillaI ?? null;
    const saltoMostrar =
        modo === 'replay' && (rep?.saltoVerticalCm ?? 0) > 0 ? rep.saltoVerticalCm : liveSaltoCm;

    if (variant === 'historial') {
        const faseKey = String(frameActual?.fase || 'armado').toLowerCase();
        const faseEtiqueta = ETAPAS_HISTORIAL_LABEL[faseKey] || faseKey.toUpperCase();

        return (
            <section
                className="rounded-2xl bg-[#11192b] border border-slate-800/90 p-5 flex flex-col justify-between gap-4 h-full shadow-xl"
                aria-label="Reconstrucción 3D Temporal"
            >
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-white">Reconstrucción 3D Temporal</h2>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-[#33e4fa] border border-cyan-400/30">
                        {tieneReplay ? `${secuenciaReplay.length} frames 3D` : 'Sin 3D'}
                    </span>
                </div>

                <div
                    className="relative flex-1 min-h-[370px] rounded-2xl overflow-hidden border border-slate-800 bg-[#070b14] select-none"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerUp}
                >
                    <canvas
                        ref={canvasRef}
                        width={560}
                        height={420}
                        className="w-full h-full block cursor-grab active:cursor-grabbing"
                    />

                    {/* Botón Rotar 360° */}
                    <button
                        type="button"
                        onClick={() => setAutoOrbit((a) => !a)}
                        className={`absolute top-3 left-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                            autoOrbit
                                ? 'bg-[#10e2f7] border-[#10e2f7] text-slate-950 shadow-[0_0_16px_rgba(16,226,247,0.4)]'
                                : 'bg-slate-800/85 hover:bg-slate-700/90 border-slate-600/60 text-slate-100'
                        }`}
                    >
                        <span>↻</span>
                        <span>Rotar 360°</span>
                    </button>

                    {/* Controles de zoom + / - y reinicio */}
                    <div className="absolute top-3 right-3 flex flex-col gap-1.5">
                        <button
                            type="button"
                            onClick={() => setOrbit((o) => ({ ...o, zoom: Math.min(1.6, o.zoom + 0.15) }))}
                            aria-label="Acercar vista 3D"
                            title="Acercar"
                            className="w-9 h-9 rounded-xl bg-slate-800/85 hover:bg-slate-700/90 border border-slate-600/60 text-white text-base font-bold flex items-center justify-center transition cursor-pointer"
                        >
                            +
                        </button>
                        <button
                            type="button"
                            onClick={() => setOrbit((o) => ({ ...o, zoom: Math.max(0.65, o.zoom - 0.15) }))}
                            aria-label="Alejar vista 3D"
                            title="Alejar"
                            className="w-9 h-9 rounded-xl bg-slate-800/85 hover:bg-slate-700/90 border border-slate-600/60 text-white text-base font-bold flex items-center justify-center transition cursor-pointer"
                        >
                            −
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setAutoOrbit(false);
                                setOrbit({ yaw: 0.42, pitch: 0.16, zoom: 1.0 });
                            }}
                            aria-label="Reiniciar cámara 3D"
                            title="Reiniciar vista"
                            className="w-9 h-9 rounded-xl bg-slate-800/85 hover:bg-slate-700/90 border border-slate-600/60 text-slate-200 text-sm font-bold flex items-center justify-center transition cursor-pointer"
                        >
                            ↺
                        </button>
                    </div>

                    {/* Indicador de frame / fase */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
                        <span className="inline-block px-4 py-1 rounded-full bg-slate-900/90 border border-slate-700/80 text-xs font-semibold text-slate-100 tracking-wide whitespace-nowrap">
                            {secuenciaActiva.length > 0
                                ? `F ${indiceMostrar + 1}/${secuenciaActiva.length} - ${faseEtiqueta}`
                                : 'Sin secuencia 3D'}
                        </span>
                    </div>

                    {!frameActual && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-950/60">
                            <p className="text-sm font-semibold text-white">
                                Esta jugada no guardó fotogramas 3D
                            </p>
                            <p className="text-xs text-slate-400 mt-1 max-w-xs">
                                Realiza una nueva sesión en Análisis IA para reproducir tu esqueleto 3D cuadro a cuadro.
                            </p>
                        </div>
                    )}
                </div>

                {/* Controles inferiores: Play, Pausa, Reiniciar y Timeline */}
                <div className="flex items-center gap-2.5 pt-1">
                    <button
                        type="button"
                        disabled={!secuenciaActiva.length}
                        onClick={() => actualizarCtrl({ modo: 'replay', isPlaying: true })}
                        aria-label="Reproducir secuencia 3D"
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer shrink-0 ${
                            isPlaying && secuenciaActiva.length
                                ? 'bg-[#10e2f7] text-slate-950 shadow-[0_0_12px_rgba(16,226,247,0.4)]'
                                : 'bg-[#1b273d] hover:bg-[#253552] text-white border border-slate-700'
                        }`}
                    >
                        ▶
                    </button>

                    <button
                        type="button"
                        disabled={!secuenciaActiva.length}
                        onClick={() => actualizarCtrl({ isPlaying: false })}
                        aria-label="Pausar secuencia 3D"
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer shrink-0 ${
                            !isPlaying && secuenciaActiva.length
                                ? 'bg-[#2a384f] text-white ring-1 ring-cyan-400/50'
                                : 'bg-[#1b273d] hover:bg-[#253552] text-white border border-slate-700'
                        }`}
                    >
                        ⏸
                    </button>

                    <button
                        type="button"
                        disabled={!secuenciaActiva.length}
                        onClick={() => actualizarCtrl({ isPlaying: false, frameIdx: 0 })}
                        aria-label="Ir al inicio de la jugada"
                        title="Reiniciar línea de tiempo"
                        className="w-9 h-9 rounded-full bg-[#1b273d] hover:bg-[#253552] border border-slate-700 text-slate-200 flex items-center justify-center transition cursor-pointer shrink-0"
                    >
                        ↺
                    </button>

                    <input
                        type="range"
                        min={0}
                        max={Math.max(0, secuenciaActiva.length - 1)}
                        value={indiceMostrar}
                        disabled={secuenciaActiva.length <= 1}
                        onChange={(e) => {
                            actualizarCtrl({ isPlaying: false, frameIdx: Number(e.target.value) });
                        }}
                        className="flex-1 min-w-0 accent-[#10e2f7] cursor-pointer"
                        aria-label="Línea de tiempo del Gemelo Digital 3D"
                    />

                    <button
                        type="button"
                        onClick={() => setSlowMotion((s) => !s)}
                        title="Cambiar velocidad de reproducción"
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition cursor-pointer shrink-0 ${
                            slowMotion
                                ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300'
                                : 'bg-[#1b273d] border-slate-700 text-slate-300 hover:text-white'
                        }`}
                    >
                        {slowMotion ? '0.5x' : '1x'}
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section
            className={`${styles.card} ${compact ? styles.cardCompact : ''}`}
            aria-label="Reproductor Gemelo Digital 3D"
        >
            <header className={styles.header}>
                <div className={styles.titleBlock}>
                    <span className={styles.eyebrow}>
                        {backendConnected ? 'Búfer 3D FastAPI :8000' : 'Visor Gemelo Digital 3D'}
                    </span>
                    <h2 className={styles.title}>Reconstrucción 3D Temporal</h2>
                </div>

                <div className={styles.modeTabs} role="tablist" aria-label="Fuente de secuencia 3D">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={modo === 'live'}
                        disabled={!running && liveBuffer.length === 0 && tieneReplay}
                        className={styles.modeTab}
                        onClick={() => actualizarCtrl({ modo: 'live', followLive: true })}
                    >
                        🔴 Búfer Vivo ({liveBuffer.length || framesEnBuffer})
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={modo === 'replay'}
                        disabled={!tieneReplay}
                        className={styles.modeTab}
                        onClick={() => actualizarCtrl({ modo: 'replay', isPlaying: true })}
                    >
                        🎬 Secuencia {tieneReplay ? `${secuenciaReplay.length}f` : '33f'}
                    </button>
                </div>
            </header>

            <div
                className={styles.canvasWrap}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
            >
                <canvas
                    ref={canvasRef}
                    width={compact ? 560 : 640}
                    height={compact ? 320 : 380}
                    className={styles.canvas}
                />

                <div className={styles.hudTop}>
                    <span className={styles.badge3d}>
                        🧊 Rotar 360° ({Math.round((orbit.yaw * 180) / Math.PI)}°)
                    </span>
                    <span className={styles.framePill}>
                        {secuenciaActiva.length > 0
                            ? `F ${indiceMostrar + 1}/${secuenciaActiva.length} · ${(frameActual?.fase ?? 'activo').toUpperCase()}`
                            : 'Esperando stream :8000'}
                    </span>
                </div>

                {!frameActual && (
                    <div className={styles.emptyOverlay}>
                        <p className={styles.emptyTitle}>Gemelo Digital 3D conectado al puerto 8000</p>
                        <p className={styles.emptyDesc}>
                            {running
                                ? 'Esperando frames 3D desde FastAPI… Arrastra para rotar la cancha 3D.'
                                : 'Activa la cámara para transmitir landmarks al búfer temporal y visualizar el esqueleto 3D en vivo.'}
                        </p>
                    </div>
                )}

                <div className={styles.zoomControls}>
                    <button
                        type="button"
                        className={styles.zoomBtn}
                        onClick={() => setOrbit((o) => ({ ...o, zoom: Math.min(1.6, o.zoom + 0.15) }))}
                        title="Acercar vista 3D"
                    >
                        +
                    </button>
                    <button
                        type="button"
                        className={styles.zoomBtn}
                        onClick={() => setOrbit((o) => ({ ...o, zoom: Math.max(0.65, o.zoom - 0.15) }))}
                        title="Alejar vista 3D"
                    >
                        −
                    </button>
                    <button
                        type="button"
                        className={styles.zoomBtn}
                        onClick={() => setOrbit({ yaw: 0.42, pitch: 0.16, zoom: 1.0 })}
                        title="Restablecer ángulo 3D"
                    >
                        ↺
                    </button>
                </div>
            </div>

            <div className={styles.controls}>
                <div className={styles.bar}>
                    {modo === 'replay' ? (
                        <>
                            <button
                                type="button"
                                className={styles.ctrlBtn}
                                onClick={() => actualizarCtrl((p) => ({ isPlaying: !p.isPlaying }))}
                                disabled={!secuenciaActiva.length}
                            >
                                {isPlaying ? '⏸ Pausar' : '▶ Replay'}
                            </button>
                            <button
                                type="button"
                                className={`${styles.ctrlBtn} ${slowMotion ? styles.ctrlBtnActive : ''}`}
                                onClick={() => setSlowMotion((s) => !s)}
                            >
                                {slowMotion ? '🐢 0.5x' : '⚡ 1x'}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            className={`${styles.ctrlBtn} ${followLive ? styles.ctrlBtnActive : ''}`}
                            onClick={() => actualizarCtrl((p) => ({ followLive: !p.followLive }))}
                            disabled={!liveBuffer.length}
                        >
                            {followLive ? '● Siguiendo Vivo' : '▶ Reanudar Vivo'}
                        </button>
                    )}

                    <button
                        type="button"
                        className={styles.ctrlBtn}
                        disabled={secuenciaActiva.length <= 1}
                        onClick={() => {
                            actualizarCtrl((prev) => ({
                                ...(modo === 'live' ? { followLive: false } : { isPlaying: false }),
                                frameIdx: Math.max(0, prev.frameIdx - 1),
                            }));
                        }}
                        title="Fotograma anterior (-1 frame)"
                        aria-label="Fotograma anterior"
                    >
                        ◀
                    </button>

                    <input
                        type="range"
                        min={0}
                        max={Math.max(0, secuenciaActiva.length - 1)}
                        value={indiceMostrar}
                        disabled={secuenciaActiva.length <= 1}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            actualizarCtrl({
                                ...(modo === 'live' ? { followLive: false } : { isPlaying: false }),
                                frameIdx: val,
                            });
                        }}
                        className={styles.scrubber}
                        aria-label="Línea de tiempo del Gemelo Digital 3D"
                    />

                    <button
                        type="button"
                        className={styles.ctrlBtn}
                        disabled={secuenciaActiva.length <= 1}
                        onClick={() => {
                            actualizarCtrl((prev) => ({
                                ...(modo === 'live' ? { followLive: false } : { isPlaying: false }),
                                frameIdx: Math.min(Math.max(0, secuenciaActiva.length - 1), prev.frameIdx + 1),
                            }));
                        }}
                        title="Fotograma siguiente (+1 frame)"
                        aria-label="Fotograma siguiente"
                    >
                        ▶
                    </button>
                </div>

                {modo === 'replay' && resolvedFasesIdx && (
                    <div className={styles.phaseJumpRow}>
                        {[
                            { label: 'F1 · Carga', idx: resolvedFasesIdx.carga },
                            { label: 'F2 · Armado', idx: resolvedFasesIdx.armado },
                            { label: 'F3 · Contacto t₀', idx: resolvedFasesIdx.contacto, highlight: true },
                            { label: 'F4 · Caída', idx: resolvedFasesIdx.caida },
                        ].map((btn) => (
                            <button
                                key={btn.label}
                                type="button"
                                className={`${styles.phaseBtn} ${btn.highlight ? styles.phaseBtnHighlight : ''}`}
                                onClick={() => {
                                    actualizarCtrl({
                                        isPlaying: false,
                                        frameIdx: Math.min(
                                            Math.max(0, secuenciaActiva.length - 1),
                                            Math.max(0, btn.idx ?? 0),
                                        ),
                                    });
                                }}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>
                )}

                <div className={styles.telemetryGrid}>
                    <div className={styles.telemetryCell}>
                        <span>Codo 3D</span>
                        <strong>{codoAct != null ? `${Number(codoAct).toFixed(1)}°` : '—'}</strong>
                    </div>
                    <div className={styles.telemetryCell}>
                        <span>Rodilla 3D</span>
                        <strong>{rodillaAct != null ? `${Number(rodillaAct).toFixed(1)}°` : '—'}</strong>
                    </div>
                    <div className={styles.telemetryCell}>
                        <span>Vel. Articular</span>
                        <strong>
                            {`${Number(frameActual?.speed ?? rep?.velocidadPicoMs ?? 0).toFixed(2)} m/s`}
                        </strong>
                    </div>
                    <div className={styles.telemetryCell}>
                        <span>Salto Vertical</span>
                        <strong>{`${Number(saltoMostrar ?? 0).toFixed(2)} cm`}</strong>
                    </div>
                </div>
            </div>
        </section>
    );
}
