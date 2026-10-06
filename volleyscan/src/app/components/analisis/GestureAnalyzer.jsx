'use client';

// ─────────────────────────────────────────────────────────────
// GestureAnalyzer.jsx — Análisis de gestos (VolleyScan)
//
// Una sola pantalla, sin scroll:
//   · Izquierda — cámara en vivo que ocupa todo el alto disponible, con
//     esqueleto, ángulos y estela de las muñecas, más un HUD (estado,
//     fase del remate, remates y promedio, fps, latencia, capas y
//     encuadre). Al terminar cada remate aparece su resultado.
//   · Derecha — panel de medición con los ángulos 3D de codo, hombro,
//     cadera, rodilla y tobillo, más la inclinación del tronco, cada uno
//     con el rango recorrido en la sesión.
//
// La tipografía y los colores salen del CSS y de la app: este componente
// no carga fuentes propias.
//
// Guardado en el historial: cada remate que termina el motor (`onRep`) se
// suma a la sesión; al pulsar "Detener" la sesión se envía al servidor
// (lib/historial/sesionAnalisis.js). Si no se puede enviar, queda en el
// navegador y se reintenta sola.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePoseCamera } from '@/hooks/usePoseCamera';
import { resumirSesion } from '@/lib/engine/session';
import {
    agregarRemate,
    cerrarYEnviar,
    crearSesion,
    reenviarPendientes,
} from '@/lib/historial/sesionAnalisis';
import { ANGLES, ANGLE_ROWS, TRUNK } from '@/lib/pose/geometry';
import { REMATE } from '@/lib/movimientos/remate';
import AngleGauge from './AngleGauge';
import styles from './GestureAnalyzer.module.css';
import RepResultCard from './RepResultCard';

const STATUS_TEXT = {
    idle: 'Cámara apagada',
    loading: 'Cargando el modelo de IA',
    running: 'Análisis en vivo',
    error: 'No se pudo iniciar el análisis',
};

const PHASE_LABEL = Object.fromEntries(REMATE.fases.map((f) => [f.id, f.nombre]));

const LAYER_OPTIONS = [
    { key: 'skeleton', label: 'Esqueleto' },
    { key: 'angles', label: 'Ángulos' },
    { key: 'trails', label: 'Trayectoria' },
];

const TIPS = [
    'Cámara fija, de lado o en diagonal',
    'Cuerpo completo dentro del marco',
    'A 3 o 4 metros, con luz de frente',
];

const MENSAJE_GUARDADO = {
    guardando: 'Guardando la sesión en tu historial…',
    enviada: 'Sesión guardada en tu historial.',
    pendiente: 'Sesión guardada en este dispositivo. Se enviará a tu historial cuando haya conexión.',
    rechazada: 'No se pudo guardar la sesión: los datos no son válidos.',
};

export default function GestureAnalyzer() {
    // Sesión de práctica en curso: vive en un ref para no re-renderizar en cada remate
    const sesionRef = useRef(null);
    const [guardado, setGuardado] = useState(null);

    const alTerminarRemate = useCallback((rep) => {
        if (!sesionRef.current) sesionRef.current = crearSesion();
        agregarRemate(sesionRef.current, rep);
    }, []);

    const {
        videoRef,
        canvasRef,
        status,
        error,
        live,
        camera,
        layers,
        mirrored,
        phase,
        reps,
        start,
        stop,
        switchCamera,
        toggleLayer,
        resetRanges,
    } = usePoseCamera({ model: 'full', targetFps: 60, onRep: alTerminarRemate });

    // Cierra la sesión en curso y la envía; si no hubo remates, no hace nada
    const guardarSesion = useCallback(async () => {
        const sesion = sesionRef.current;
        sesionRef.current = null;
        if (!sesion?.repeticiones.length) return;
        setGuardado('guardando');
        const { estado } = await cerrarYEnviar(sesion);
        setGuardado(estado);
    }, []);

    const iniciar = () => {
        setGuardado(null);
        sesionRef.current = crearSesion();
        start();
    };

    const detener = () => {
        stop();
        guardarSesion();
    };

    // Al abrir la pantalla: reintenta las sesiones que quedaron sin enviar.
    // Al salir de la pantalla con la cámara encendida: no se pierde la sesión.
    useEffect(() => {
        reenviarPendientes();
        return () => {
            const sesion = sesionRef.current;
            sesionRef.current = null;
            if (sesion?.repeticiones.length) cerrarYEnviar(sesion);
        };
    }, []);

    const running = status === 'running';
    const loading = status === 'loading';
    const framing = live.framing;
    const resolution = camera?.width && camera?.height ? `${camera.width}×${camera.height}` : null;

    const resumen = useMemo(() => resumirSesion(reps), [reps]);
    const lastRep = reps.length ? reps[reps.length - 1] : null;

    return (
        <section className={styles.root} aria-label="Análisis de gestos con IA">
            <header className={styles.header}>
                <div className={styles.heading}>
                    <h1 className={styles.title}>Análisis de remate</h1>
                    <p className={styles.subtitle}>
                        Ejecuta el remate completo: carga, salto, golpeo y caída. Al aterrizar verás tu score y
                        qué corregir.
                    </p>
                </div>

                <div className={styles.actions}>
                    {running && (
                        <button type="button" className={styles.btnGhost} onClick={switchCamera}>
                            Cambiar cámara
                        </button>
                    )}
                    {running ? (
                        <button type="button" className={styles.btnGhost} onClick={detener}>
                            Detener
                        </button>
                    ) : (
                        <button type="button" className={styles.btnPrimary} onClick={iniciar} disabled={loading}>
                            {loading ? 'Cargando…' : 'Activar cámara'}
                        </button>
                    )}
                </div>
            </header>

            <p className={styles.srOnly} role="status" aria-live="polite">
                {STATUS_TEXT[status]}
                {running ? `. ${framing.hint}` : ''}
            </p>

            {guardado && (
                <p className={styles.subtitle} role="status" aria-live="polite">
                    {MENSAJE_GUARDADO[guardado]}
                </p>
            )}

            <div className={styles.split}>
                {/* ── Cámara ────────────────────────────────────── */}
                <div
                    className={styles.stage}
                    data-live={running}
                    data-framing={running ? framing.status : 'idle'}
                >
                    <video
                        ref={videoRef}
                        className={`${styles.video} ${mirrored ? styles.mirrored : ''}`}
                        playsInline
                        muted
                    />
                    <canvas ref={canvasRef} className={styles.canvas} />

                    {/* Visor: las esquinas cambian de color según el encuadre */}
                    <div className={styles.frame} aria-hidden="true">
                        <span className={styles.corner} data-pos="tl" />
                        <span className={styles.corner} data-pos="tr" />
                        <span className={styles.corner} data-pos="bl" />
                        <span className={styles.corner} data-pos="br" />
                    </div>

                    {running && (
                        <>
                            <div className={styles.hud}>
                                <span className={styles.pill}>
                                    <span className={styles.liveDot} aria-hidden="true" />
                                    En vivo
                                </span>
                                <span className={styles.pill}>Fase · {PHASE_LABEL[phase]}</span>
                                {resumen.validas > 0 && (
                                    <span className={styles.pill}>
                                        {resumen.validas} {resumen.validas === 1 ? 'remate' : 'remates'} · prom.{' '}
                                        {resumen.scorePromedio}
                                    </span>
                                )}
                                <span className={`${styles.pill} ${styles.metrics}`}>
                                    <span className={styles.metric}>{live.fps} fps</span>
                                    <span className={styles.metric}>{live.latency} ms</span>
                                    {resolution && <span className={styles.metric}>{resolution}</span>}
                                </span>
                            </div>

                            <div className={styles.layers} role="group" aria-label="Capas visibles">
                                {LAYER_OPTIONS.map(({ key, label }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        className={styles.layer}
                                        aria-pressed={layers[key]}
                                        onClick={() => toggleLayer(key)}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            <div className={styles.banner} data-state={framing.status}>
                                {framing.hint}
                            </div>

                            <RepResultCard rep={lastRep} numero={reps.length} />
                        </>
                    )}

                    {!running && (
                        <div className={styles.overlay}>
                            <div className={styles.overlayCopy}>
                                {status === 'error' ? (
                                    <>
                                        <h2 className={styles.overlayTitle}>No pudimos iniciar el análisis</h2>
                                        <p className={styles.overlayText}>{error}</p>
                                    </>
                                ) : (
                                    <>
                                        <h2 className={styles.overlayTitle}>
                                            {loading ? 'Preparando la IA…' : 'Activa la cámara y colócate en el marco'}
                                        </h2>
                                        <ul className={styles.tips}>
                                            {TIPS.map((tip) => (
                                                <li key={tip}>{tip}</li>
                                            ))}
                                        </ul>
                                        <p className={styles.overlayNote}>
                                            El video se procesa en tu dispositivo y no se sube a ningún servidor.
                                        </p>
                                    </>
                                )}
                            </div>

                            <svg className={styles.guide} viewBox="0 0 120 160" aria-hidden="true">
                                <rect x="6" y="6" width="108" height="148" rx="12" className={styles.guideFrame} />
                                <g className={styles.guideBody}>
                                    <line x1="60" y1="44" x2="60" y2="92" />
                                    <line x1="60" y1="56" x2="38" y2="78" />
                                    <line x1="60" y1="56" x2="82" y2="78" />
                                    <line x1="60" y1="92" x2="45" y2="136" />
                                    <line x1="60" y1="92" x2="75" y2="136" />
                                </g>
                                <circle cx="60" cy="33" r="10" className={styles.guideHead} />
                            </svg>
                        </div>
                    )}
                </div>

                {/* ── Panel de medición ─────────────────────────── */}
                <aside className={styles.panel} aria-label="Medición en vivo">
                    <div className={styles.panelHead}>
                        <h2 className={styles.panelTitle}>Medición en vivo</h2>
                        <p className={styles.panelNote}>Ángulos en 3D, en tiempo real.</p>
                    </div>

                    <div className={styles.rows}>
                        {ANGLE_ROWS.map((row) => {
                            const pair = ANGLES.filter((def) => def.joint === row.id);
                            const right = pair.find((def) => def.side === 'D');
                            const left = pair.find((def) => def.side === 'I');
                            // Con el efecto espejo, tu lado derecho se ve a la derecha de la pantalla
                            const ordered = mirrored ? [left, right] : [right, left];

                            return (
                                <div key={row.id} className={styles.row} role="group" aria-label={row.label}>
                                    <h3 className={styles.rowTitle}>{row.label}</h3>
                                    {ordered.map((def) => (
                                        <AngleGauge
                                            key={def.id}
                                            label={def.label}
                                            side={def.side === 'D' ? 'Der' : 'Izq'}
                                            value={live.angles[def.id]}
                                            range={live.ranges[def.id]}
                                        />
                                    ))}
                                </div>
                            );
                        })}

                        {/* Inclinación del tronco: una sola medida, escala de 0° a 90° */}
                        <div className={styles.row} role="group" aria-label={TRUNK.label}>
                            <h3 className={styles.rowTitle}>Tronco</h3>
                            <AngleGauge
                                wide
                                label={TRUNK.label}
                                side="Inclinación · 0° = erguido"
                                value={live.angles[TRUNK.id]}
                                range={live.ranges[TRUNK.id]}
                                max={TRUNK.max}
                            />
                        </div>
                    </div>

                    <footer className={styles.panelFoot}>
                        <ul className={styles.legend}>
                            <li>
                                <span className={styles.swatchNow} aria-hidden="true" />
                                Actual
                            </li>
                            <li>
                                <span className={styles.swatchRange} aria-hidden="true" />
                                Rango de la sesión
                            </li>
                        </ul>
                        <button type="button" className={styles.btnText} onClick={resetRanges} disabled={!running}>
                            Reiniciar rangos
                        </button>
                    </footer>
                </aside>
            </div>
        </section>
    );
}