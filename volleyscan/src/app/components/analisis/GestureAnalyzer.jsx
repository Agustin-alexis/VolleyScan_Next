'use client';


import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePoseCamera } from '@/hooks/usePoseCamera';
import { resumirSesion } from '@/lib/engine/session';
import { ANGLES, ANGLE_ROWS, TRUNK } from '@/lib/pose/geometry';
import { REMATE } from '@/lib/movimientos/remate';
import { HistorialError, guardarSesion } from '@/app/services/historialService';
import AngleGauge from './AngleGauge';
import styles from './GestureAnalyzer.module.css';
import RepResultCard from './RepResultCard';

// Debe coincidir con el nombre real de la carpeta del historial en src/app/usuario
const RUTA_HISTORIAL = '/usuario/histtrial';

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

const AVISO_STYLE = {
    margin: 0,
    padding: '0.75rem 1rem',
    border: '1px solid currentColor',
    borderRadius: 8,
};

export default function GestureAnalyzer() {
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
    } = usePoseCamera({ model: 'lite', targetFps: 60 });

    const [aviso, setAviso] = useState(null);
    const inicioRef = useRef(null);
    const guardandoRef = useRef(false);

    const running = status === 'running';
    const loading = status === 'loading';
    const framing = live.framing;
    const resolution = camera?.width && camera?.height ? `${camera.width}×${camera.height}` : null;

    const resumen = useMemo(() => resumirSesion(reps), [reps]);
    const lastRep = reps?.length ? reps[reps.length - 1] : null;

    // Marca el inicio real de la sesión: cuando la cámara ya está analizando
    useEffect(() => {
        if (status === 'running' && inicioRef.current === null) {
            inicioRef.current = Date.now();
        }
    }, [status]);

    const handleStart = useCallback(() => {
        setAviso(null);
        start();
    }, [start]);

    // Detener = terminar la sesión: se guarda en el historial y se apaga la cámara.
    const handleStop = useCallback(async () => {
        if (guardandoRef.current) return;
        guardandoRef.current = true;

        // Se captura ANTES de detener, por si stop() limpia las repeticiones.
        const validas = (reps ?? []).filter((r) => r?.valida && typeof r.score === 'number');
        const duracionSeg = inicioRef.current ? (Date.now() - inicioRef.current) / 1000 : 0;
        inicioRef.current = null;

        stop();

        try {
            if (validas.length === 0) {
                setAviso({ tipo: 'vacio', texto: 'No se guardó la sesión: no hubo remates válidos.' });
                return;
            }

            await guardarSesion({
                gesto: 'remate',
                duracionSeg,
                repeticiones: validas.map((r) => ({
                    puntaje: r.score,
                    brazo: r.brazo,
                    errores: r.errores,
                    puntosClave: r.puntosClave,
                })),
            });

            setAviso({
                tipo: 'ok',
                texto: `Sesión guardada: ${validas.length} ${validas.length === 1 ? 'remate' : 'remates'}.`,
            });
        } catch (e) {
            setAviso({
                tipo: 'error',
                texto: e instanceof HistorialError ? e.message : 'No se pudo guardar la sesión.',
            });
        } finally {
            guardandoRef.current = false;
        }
    }, [reps, stop]);

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
                        <button type="button" className={styles.btnGhost} onClick={handleStop}>
                            Detener y guardar
                        </button>
                    ) : (
                        <button type="button" className={styles.btnPrimary} onClick={handleStart} disabled={loading}>
                            {loading ? 'Cargando…' : 'Activar cámara'}
                        </button>
                    )}
                </div>
            </header>

            {aviso && (
                <p role="status" aria-live="polite" style={AVISO_STYLE}>
                    {aviso.texto}{' '}
                    {aviso.tipo === 'ok' && <Link href={RUTA_HISTORIAL}>Ver historial</Link>}
                </p>
            )}

            <p className={styles.srOnly} role="status" aria-live="polite">
                {STATUS_TEXT[status]}
                {running ? `. ${framing.hint}` : ''}
            </p>

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

                            <RepResultCard rep={lastRep} numero={reps?.length ?? 0} />
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