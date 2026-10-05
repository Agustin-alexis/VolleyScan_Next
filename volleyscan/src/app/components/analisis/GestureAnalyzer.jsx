'use client';


import { Barlow_Condensed, Public_Sans } from 'next/font/google';
import { usePoseCamera } from '@/hooks/usePoseCamera';
import { ANGLES, ANGLE_ROWS, TRUNK } from '@/lib/pose/geometry';
import AngleGauge from './AngleGauge';
import styles from './GestureAnalyzer.module.css';

// Tipografía: condensada de marcador para títulos y cifras,
// humanista y legible para el texto corrido.

// ─────────────────────────────────────────────────────────────
// GestureAnalyzer.jsx — Análisis de gestos (VolleyScan)
//
// Pantalla dividida:
//   · Izquierda — escenario: cámara en vivo con esqueleto, ángulos y
//     estela de las muñecas, más un HUD de telestrador (estado, fps,
//     latencia, resolución, capas y guía de encuadre).
//   · Derecha — instrumentos: medidores 3D de codo, hombro, cadera,
//     rodilla y tobillo, más la inclinación del tronco, cada uno con el
//     rango recorrido en la sesión.
//
// La corrección técnica del remate (reglas y score) llega en las
// fases siguientes; esta pantalla ya mide todo lo que necesitan.
// ─────────────────────────────────────────────────────────────


// Tipografía: condensada de marcador para títulos y cifras,
// humanista y legible para el texto corrido.

const STATUS_TEXT = {
    idle: 'Cámara apagada',
    loading: 'Cargando el modelo de IA',
    running: 'Análisis en vivo',
    error: 'No se pudo iniciar el análisis',
};

const LAYER_OPTIONS = [
    { key: 'skeleton', label: 'Esqueleto' },
    { key: 'angles', label: 'Ángulos' },
    { key: 'trails', label: 'Trayectoria' },
];

const TIPS = [
    'A 2 o 3 metros de la cámara',
    'Cuerpo completo dentro del marco',
    'Luz de frente, sin contraluz',
];

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
        start,
        stop,
        switchCamera,
        toggleLayer,
        resetRanges,
    } = usePoseCamera({ model: 'full', targetFps: 60 });

    const running = status === 'running';
    const loading = status === 'loading';
    const framing = live.framing;
    const resolution = camera?.width && camera?.height ? `${camera.width}×${camera.height}` : null;

    return (
        <section className={styles.root} aria-label="Análisis de gestos con IA">
            <header className={styles.header}>
                <div className={styles.heading}>
                    <h1 className={styles.title}>Análisis de remate</h1>
                    <p className={styles.subtitle}>
                        Ponte de cuerpo completo frente a la cámara y ejecuta el gesto. La IA mide cada
                        ángulo en 3D mientras te mueves.
                    </p>
                </div>

                <div className={styles.actions}>
                    {running && (
                        <button type="button" className={styles.btnGhost} onClick={switchCamera}>
                            Cambiar cámara
                        </button>
                    )}
                    {running ? (
                        <button type="button" className={styles.btnGhost} onClick={stop}>
                            Detener
                        </button>
                    ) : (
                        <button type="button" className={styles.btnPrimary} onClick={start} disabled={loading}>
                            {loading ? 'Cargando…' : 'Activar cámara'}
                        </button>
                    )}
                </div>
            </header>

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
                        <p className={styles.panelNote}>Ángulos en 3D. El score técnico llega en las próximas fases.</p>
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