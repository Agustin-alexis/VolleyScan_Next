'use client';

import { useMemo, useState } from 'react';
import { LM } from '@/lib/pose/geometry';
import { REMATE } from '@/lib/movimientos/remate';
import { generarVozCoachRep, speakCoachFeedback } from '@/lib/voice/voiceCoach';
import GemeloDigital3D from './GemeloDigital3D';
import styles from './TecnicaFoto.module.css';

const TABS = [
    { id: 'carga', num: 1, label: 'F1 · Preparación', corto: 'Carga', fases: ['carga', 'preparacion'], faseKey: 'fase_1' },
    { id: 'armado', num: 2, label: 'F2 · Armado', corto: 'Armado', fases: ['vuelo'], faseKey: 'fase_2' },
    { id: 'contacto', num: 3, label: 'F3 · Contacto (t₀)', corto: 'Contacto', fases: ['golpeo', 'vuelo'], faseKey: 'fase_3' },
    { id: 'caida', num: 4, label: 'F4 · Finalización', corto: 'Caída', fases: ['caida'], faseKey: 'fase_4' },
];

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

const K = 100;
const COLOR = { ok: '#22c55e', error: '#f97316', casi: '#3b82f6', neutro: '#475569' };

function estadoDe(m) {
    if (m.puntaje === null) return 'neutro';
    if (m.estado === 'ok') return 'ok';
    return m.puntaje < REMATE.umbralError ? 'error' : 'casi';
}

function estadoGrupo(medidas) {
    const estados = medidas.map(estadoDe);
    if (estados.includes('error')) return 'error';
    if (estados.includes('casi')) return 'casi';
    if (estados.includes('ok')) return 'ok';
    return 'neutro';
}

const formato = (n, unidad) => (unidad === '°' ? `${Math.round(n)}°` : `${n}`);
const unidadCorta = (u) => (u === '°' ? '°' : ` ${u.split(' ')[0]}`);

function Barra({ medida }) {
    const [lo, hi] = medida.ideal;
    const pad = (hi - lo) * 0.5 + 0.001;
    const valor = medida.valor;
    const min = Math.min(lo - pad, valor ?? lo);
    const max = Math.max(hi + pad, valor ?? hi);
    const pos = (n) => `${((n - min) / (max - min)) * 100}%`;
    const estado = estadoDe(medida);

    return (
        <div className={styles.barra} aria-hidden="true">
            <span className={styles.ideal} style={{ left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})` }} />
            {valor !== null && <span className={styles.marca} data-estado={estado} style={{ left: pos(valor) }} />}
        </div>
    );
}

function PanelAblacionReplay({ rep }) {
    const ablacion = rep?.ablacion;
    const tabla = Array.isArray(ablacion?.tabla_comparativa) ? ablacion.tabla_comparativa : [];
    const resumen = ablacion?.resumen_cientifico || null;
    const replaySrc = rep?.videoReplayBase64
        ? rep.videoReplayBase64.startsWith('data:')
            ? rep.videoReplayBase64
            : `data:image/gif;base64,${rep.videoReplayBase64}`
        : null;
    const probs = rep?.vectorProbabilidadGestos || null;

    return (
        <div className={styles.ablationWrap}>
            <div className={styles.ablationReplayCol}>
                <div className={styles.replayCard}>
                    <div className={styles.replayHead}>
                        <strong>Replay Cinemático MediaPipe (FastAPI)</strong>
                        {rep?.saltoVerticalCm > 0 && (
                            <span className={styles.jumpInline}>Salto {rep.saltoVerticalCm} cm</span>
                        )}
                    </div>
                    {replaySrc ? (
                        <img
                            src={replaySrc}
                            alt="Replay GIF de la ejecución biomecánica generado por MediaPipe"
                            className={styles.replayGif}
                        />
                    ) : (
                        <p className={styles.vacio}>
                            Replay GIF no adjunto en esta repetición (usa &ldquo;Replay 3D&rdquo; para inspeccionar la secuencia).
                        </p>
                    )}
                </div>

                {probs && Object.keys(probs).length > 0 && (
                    <div className={styles.probsCard}>
                        <strong className={styles.subCardTitle}>Vector de clasificación de gestos</strong>
                        <div className={styles.probsList}>
                            {Object.entries(probs).map(([gesto, pct]) => (
                                <div key={gesto} className={styles.probItem}>
                                    <span>{gesto}</span>
                                    <b>{Math.round(Number(pct) <= 1 ? Number(pct) * 100 : Number(pct))}%</b>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className={styles.ablationTableCol}>
                <div className={styles.replayCard}>
                    <div className={styles.replayHead}>
                        <strong>Laboratorio de Ablación Científica (Método A vs B vs C)</strong>
                    </div>

                    {resumen && (
                        <div className={styles.ablationHighlights}>
                            <div className={styles.ablationKpi}>
                                <span>Ganancia vs 2D</span>
                                <strong>+{resumen.ganancia_confianza_vs_2d_pct ?? 0}%</strong>
                            </div>
                            <div className={styles.ablationKpi}>
                                <span>Ganancia vs 3D estático</span>
                                <strong>+{resumen.ganancia_confianza_vs_3d_estatico_pct ?? 0}%</strong>
                            </div>
                            <div className={styles.ablationKpi}>
                                <span>Escorzo Codo 2D/3D</span>
                                <strong>{resumen.discrepancia_angular_codo_2d_vs_3d ?? 0}°</strong>
                            </div>
                            <div className={styles.ablationKpi}>
                                <span>Escorzo Hombro 2D/3D</span>
                                <strong>{resumen.discrepancia_angular_hombro_2d_vs_3d ?? 0}°</strong>
                            </div>
                        </div>
                    )}

                    {tabla.length > 0 ? (
                        <div className={styles.ablationTableScroll}>
                            <table className={styles.ablationTable}>
                                <thead>
                                    <tr>
                                        <th>Método</th>
                                        <th>Frames</th>
                                        <th>Confianza</th>
                                        <th>Discrepancia</th>
                                        <th>Latencia</th>
                                        <th>Diagnóstico</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tabla.map((row) => (
                                        <tr
                                            key={row.metodo_id}
                                            className={row.metodo_id === 'metodo_c' ? styles.ablationRowBest : ''}
                                        >
                                            <td>
                                                <strong>{row.nombre}</strong>
                                                <small>{row.tipo_analisis}</small>
                                            </td>
                                            <td>{row.frames_analizados}</td>
                                            <td>{row.confianza_diagnostica_pct}%</td>
                                            <td>{row.discrepancia_media_grados}°</td>
                                            <td>{row.latencia_ms} ms</td>
                                            <td>{row.veredicto}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className={styles.vacio}>Sin matriz de ablación disponible para esta repetición.</p>
                    )}

                    {resumen?.conclusion_experimental && (
                        <p className={styles.ablationConclusion}>{resumen.conclusion_experimental}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function TecnicaFoto({ rep, numero, mirrored = false, modoInicial = 'fases', onClose }) {
    const tieneBackendExtras = Boolean(rep?.ablacion || rep?.videoReplayBase64);
    const modoResuelto = !rep?.claves && tieneBackendExtras && modoInicial === 'fases' ? 'ablacion' : modoInicial;
    const [modoVista, setModoVista] = useState(modoResuelto); // 'fases' | '3d' | 'ablacion'
    const [tab, setTab] = useState('contacto');
    const [jumpRequest, setJumpRequest] = useState(null);

    const claves = rep?.claves;
    const actual = TABS.find((t) => t.id === tab) ?? TABS[2];
    // Respaldo por si es una sesión antigua sin `armado` separado
    const marco = claves?.[tab] ?? (tab === 'armado' ? claves?.contacto ?? claves?.carga : null);

    // Secuencia 3D: usa `rep.secuencia3D` o construye una secuencia a partir de los cuadros clave
    const secuencia3D = useMemo(() => {
        if (Array.isArray(rep?.secuencia3D) && rep.secuencia3D.length > 0) {
            return rep.secuencia3D;
        }
        const fallback = [];
        for (const [id, fase] of [
            ['carga', 'carga'],
            ['armado', 'armado'],
            ['contacto', 'contacto'],
            ['caida', 'caida'],
        ]) {
            const c = claves?.[id];
            if (c?.puntos) {
                fallback.push({
                    idx: fallback.length,
                    t: c.t ?? fallback.length * 120,
                    fase,
                    puntos: c.puntos,
                    angulos: c.angulos ?? {},
                    speed: 2.1,
                    lift: fase === 'contacto' ? 0.22 : 0,
                });
            }
        }
        return fallback;
    }, [rep, claves]);

    const indicesFases = useMemo(() => {
        if (rep?.fases4) {
            return {
                carga: rep.fases4.fase_1?.frameIdx ?? 0,
                armado: rep.fases4.fase_2?.frameIdx ?? Math.floor(secuencia3D.length * 0.35),
                contacto: rep.fases4.fase_3?.frameIdx ?? Math.floor(secuencia3D.length * 0.6),
                caida: rep.fases4.fase_4?.frameIdx ?? Math.max(0, secuencia3D.length - 1),
            };
        }
        return {
            carga: 0,
            armado: Math.min(1, secuencia3D.length - 1),
            contacto: Math.min(2, secuencia3D.length - 1),
            caida: Math.max(0, secuencia3D.length - 1),
        };
    }, [rep, secuencia3D.length]);

    const medidasTab = useMemo(() => {
        const todas = rep?.medidas ?? [];
        const filtradas = todas.filter((m) => actual.fases.includes(m.fase));
        return filtradas.length ? filtradas : todas;
    }, [rep, actual]);

    const vista = useMemo(() => {
        const xs = [];
        const ys = [];
        for (const id of ['carga', 'armado', 'contacto', 'caida']) {
            for (const p of Object.values(claves?.[id]?.puntos ?? {})) {
                xs.push(p.x);
                ys.push(p.y);
            }
        }
        if (!xs.length) return { x: -2 * K, y: -3 * K, w: 4 * K, h: 6 * K };
        const x0 = Math.min(...xs) - 0.6;
        const x1 = Math.max(...xs) + 0.6;
        const y0 = Math.min(...ys) - 0.7;
        const y1 = Math.max(...ys) + 0.5;
        const ancho = Math.max(x1 - x0, (y1 - y0) * 0.62);
        const cx = ((x0 + x1) / 2) * (mirrored ? -1 : 1);
        return { x: (cx - ancho / 2) * K, y: y0 * K, w: ancho * K, h: (y1 - y0) * K };
    }, [claves, mirrored]);

    if (!rep?.valida || (!claves && !tieneBackendExtras && secuencia3D.length === 0)) return null;

    const nombreGesto = rep.movimientoNombre ?? (rep.movimiento ? rep.movimiento.charAt(0).toUpperCase() + rep.movimiento.slice(1) : 'Remate');
    const vozTexto = rep.vozCoach || generarVozCoachRep(rep);

    const lado = claves?.lado === 'R' ? 'D' : 'I';
    const punto = (idx) => {
        const p = marco?.puntos?.[idx];
        if (!p || p.v < 0.5) return null;
        return { x: (mirrored ? -p.x : p.x) * K, y: p.y * K };
    };

    const colorGrupo = (grupo) => {
        if ((tab === 'contacto' || tab === 'armado') && grupo === `brazo${lado}`) return COLOR[estadoGrupo(medidasTab)];
        if ((tab === 'carga' || tab === 'caida') && grupo === 'piernas') return COLOR[estadoGrupo(medidasTab)];
        return COLOR.neutro;
    };
    const resaltado = (grupo) => colorGrupo(grupo) !== COLOR.neutro;

    const etiquetas = [];
    const angulos = marco?.angulos ?? {};
    if (tab === 'contacto' || tab === 'armado') {
        const codo = punto(claves?.lado === 'R' ? LM.R_ELBOW : LM.L_ELBOW);
        const hombro = punto(claves?.lado === 'R' ? LM.R_SHOULDER : LM.L_SHOULDER);
        if (codo && angulos[`codo${lado}`] != null) etiquetas.push({ ...codo, texto: `${angulos[`codo${lado}`]}°`, dx: 12 });
        if (hombro && angulos[`hombro${lado}`] != null) etiquetas.push({ ...hombro, texto: `${angulos[`hombro${lado}`]}°`, dx: -12 });
    } else {
        for (const [idx, id] of [[LM.L_KNEE, 'rodillaI'], [LM.R_KNEE, 'rodillaD']]) {
            const p = punto(idx);
            if (p && angulos[id] != null) etiquetas.push({ ...p, texto: `${angulos[id]}°`, dx: 12 });
        }
    }

    const nariz = punto(LM.NOSE);
    const sinCuadro = !marco;

    const seleccionarFase = (tabObj) => {
        setTab(tabObj.id);
        const fIdx = indicesFases[tabObj.id];
        if (fIdx !== undefined) {
            setJumpRequest({ frameIdx: fIdx, ts: Date.now() });
        }
    };

    return (
        <section className={styles.panel} aria-label={`Técnica de ${nombreGesto} ${numero}`}>
            <header className={styles.top}>
                <div>
                    <div className={styles.titleRow}>
                        <h3 className={styles.title}>
                            {nombreGesto} #{numero} · {rep.score}/100
                        </h3>
                        {rep.saltoVerticalCm > 0 && (
                            <span className={styles.JumpBadge}>Salto: {rep.saltoVerticalCm} cm</span>
                        )}
                        <button
                            type="button"
                            className={styles.voiceBtn}
                            onClick={() => speakCoachFeedback(vozTexto)}
                            title="Escuchar evaluación del Coach IA"
                        >
                            🔊 Escuchar Coach
                        </button>
                    </div>
                    <p className={styles.sub}>
                        {rep.diagnosticoCausaRaiz || 'Análisis en 4 fases biomecánicas y reconstrucción 3D temporal.'}
                    </p>
                </div>

                <div className={styles.modeSwitch} role="tablist" aria-label="Modo de visualización">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={modoVista === 'fases'}
                        className={styles.modeBtn}
                        onClick={() => setModoVista('fases')}
                    >
                        🔬 4 Fases
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={modoVista === '3d'}
                        className={styles.modeBtn}
                        onClick={() => setModoVista('3d')}
                    >
                        🧊 Replay 3D ({secuencia3D.length}f)
                    </button>
                    {tieneBackendExtras && (
                        <button
                            type="button"
                            role="tab"
                            aria-selected={modoVista === 'ablacion'}
                            className={styles.modeBtn}
                            onClick={() => setModoVista('ablacion')}
                        >
                            📊 Ablación &amp; GIF
                        </button>
                    )}
                </div>

                <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
                    ×
                </button>
            </header>

            {/* Tarjetas resumen de las 4 Fases Biomecánicas */}
            <div className={styles.fasesGrid} role="tablist" aria-label="Las 4 fases biomecánicas">
                {TABS.map((t) => {
                    const infoFase = rep.fases4?.[t.faseKey];
                    const sc = infoFase?.score ?? rep.score;
                    const est = infoFase?.estado ?? (sc >= 80 ? 'Óptimo' : sc >= 65 ? 'Advertencia' : 'Deficiente');
                    const activa = tab === t.id;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            role="tab"
                            aria-selected={activa}
                            className={`${styles.faseCard} ${activa ? styles.faseCardActiva : ''} ${t.id === 'contacto' ? styles.faseCardVertice : ''}`}
                            onClick={() => seleccionarFase(t)}
                        >
                            <div className={styles.faseCardHead}>
                                <span className={styles.faseNum}>FASE {t.num}</span>
                                <span className={styles.faseScore} data-estado={est}>
                                    {sc}% · {est}
                                </span>
                            </div>
                            <strong className={styles.faseTitle}>{infoFase?.nombre ?? t.label}</strong>
                            {infoFase?.metricas && (
                                <div className={styles.faseMetrics}>
                                    {infoFase.metricas.map((m) => (
                                        <span key={m.label}>
                                            {m.label}: <b>{m.valor}</b>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {modoVista === 'ablacion' ? (
                <PanelAblacionReplay rep={rep} />
            ) : modoVista === '3d' ? (
                <GemeloDigital3D
                    liveBuffer={secuencia3D}
                    rep={{ ...rep, secuencia3D }}
                    backendConnected={Boolean(rep?.fromBackend)}
                    jumpRequest={jumpRequest}
                    indicesFases={indicesFases}
                />
            ) : (
                <div className={styles.body}>
                    <div className={styles.lienzo}>
                        {sinCuadro ? (
                            <p className={styles.vacio}>No se alcanzó a registrar este momento del gesto.</p>
                        ) : (
                            <svg
                                viewBox={`${vista.x} ${vista.y} ${vista.w} ${vista.h}`}
                                role="img"
                                aria-label={`Esqueleto en ${actual.label.toLowerCase()}`}
                            >
                                {HUESOS.map(({ par, grupo }) => {
                                    const a = punto(par[0]);
                                    const b = punto(par[1]);
                                    if (!a || !b) return null;
                                    return (
                                        <line
                                            key={`${par[0]}-${par[1]}`}
                                            x1={a.x}
                                            y1={a.y}
                                            x2={b.x}
                                            y2={b.y}
                                            stroke={colorGrupo(grupo)}
                                            strokeWidth={resaltado(grupo) ? 9 : 6}
                                            strokeLinecap="round"
                                            opacity={resaltado(grupo) || grupo === 'tronco' ? 1 : 0.7}
                                        />
                                    );
                                })}
                                {nariz && (
                                    <circle
                                        cx={nariz.x}
                                        cy={nariz.y}
                                        r={20}
                                        fill="#0b0f1a"
                                        stroke={COLOR.neutro}
                                        strokeWidth={5}
                                    />
                                )}
                                {Object.keys(marco.puntos).map((idx) => {
                                    const p = punto(Number(idx));
                                    if (!p || Number(idx) === LM.NOSE) return null;
                                    return <circle key={idx} cx={p.x} cy={p.y} r={7} fill="#cbd5e1" />;
                                })}
                                {etiquetas.map((e, idx) => (
                                    <text
                                        key={`${e.x}-${e.y}-${idx}`}
                                        x={e.x + e.dx}
                                        y={e.y}
                                        className={styles.angulo}
                                        textAnchor={e.dx > 0 ? 'start' : 'end'}
                                        dominantBaseline="middle"
                                    >
                                        {e.texto}
                                    </text>
                                ))}
                            </svg>
                        )}
                    </div>

                    <div className={styles.medidas}>
                        {rep.fases4?.[actual.faseKey]?.diagnostico && (
                            <div className={styles.diagFaseBox}>
                                <strong>Diagnóstico Fase {actual.num}:</strong> {rep.fases4[actual.faseKey].diagnostico}
                            </div>
                        )}
                        {medidasTab.length === 0 && <p className={styles.vacio}>Sin medidas en este momento.</p>}
                        {medidasTab.map((m) => (
                            <div key={m.id} className={styles.medida}>
                                <div className={styles.medidaTop}>
                                    <span className={styles.medidaNombre}>{m.nombre}</span>
                                    <span className={styles.medidaValor} data-estado={estadoDe(m)}>
                                        {m.valor === null
                                            ? 'Sin dato'
                                            : `${formato(m.valor, m.unidad)}${m.unidad === '°' ? '' : unidadCorta(m.unidad)}`}
                                    </span>
                                </div>
                                <Barra medida={m} />
                                <p className={styles.rango}>
                                    Ideal: {m.ideal[0]}–{m.ideal[1]}
                                    {m.unidad === '°' ? '°' : ` ${m.unidad}`}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
