'use client';

import styles from './FasesBiomecanicasGrid.module.css';

const PHASES_DEF = [
    {
        key: 'fase_1',
        num: 1,
        titulo: '1. Preparación',
        subtitulo: 'Carga y flexión de rodillas',
        faseIds: ['sin_cuerpo', 'preparacion', 'carga'],
    },
    {
        key: 'fase_2',
        num: 2,
        titulo: '2. Salto y Armado',
        subtitulo: 'Impulso y retracción',
        faseIds: ['vuelo', 'armado'],
    },
    {
        key: 'fase_3',
        num: 3,
        titulo: '3. Contacto Crítico (t₀)',
        subtitulo: 'Extensión máxima en impacto',
        faseIds: ['golpeo', 'contacto'],
        vertice: true,
    },
    {
        key: 'fase_4',
        num: 4,
        titulo: '4. Finalización',
        subtitulo: 'Amortiguación bilateral',
        faseIds: ['caida'],
    },
];

const fmtDeg = (v) => (v != null && Number.isFinite(Number(v)) ? `${Math.round(Number(v))}°` : '—');

/**
 * Cuadrícula interactiva de las 4 Fases Biomecánicas conectada a la telemetría
 * del backend Python (:8000) y al diagnóstico en tiempo real del gesto detectado.
 */
export default function FasesBiomecanicasGrid({
    running = false,
    live,
    phase = 'sin_cuerpo',
    lastValidRep = null,
    onSelectPhaseFrame,
    onOpenDetail,
    onSpeakCoach,
}) {
    const ang = live?.angles || {};
    const fasesVivo = live?.fasesEnVivo || null;
    const saltoCm =
        (live?.saltoVerticalCm ?? 0) > 0
            ? live.saltoVerticalCm
            : (lastValidRep?.saltoVerticalCm ?? 0);

    const gestoTitulo = lastValidRep?.movimientoNombre
        ? `${lastValidRep.movimientoNombre} · ${lastValidRep.score}/100`
        : fasesVivo?.gesto_en_vivo || 'Esperando gesto técnico';

    const diagPrincipal =
        lastValidRep?.diagnosticoCausaRaiz ||
        fasesVivo?.diagnostico_vivo ||
        live?.diagnosticoVivo ||
        (running
            ? 'Analizando cadena cinética en tiempo real con MediaPipe Pose (:8000)...'
            : 'Activa la cámara para monitorear las 4 fases y el diagnóstico en vivo.');

    const estadoBuffer = live?.backendBuffer?.estadoBuffer || (running ? 'ESCUCHANDO' : 'INACTIVO');

    const metricasEnVivoPorFase = (key) => {
        if (key === 'fase_1') {
            return [
                { label: 'Rodilla 3D', valor: fmtDeg(ang.rodillaD ?? ang.rodillaI) },
                { label: 'Cadera 3D', valor: fmtDeg(ang.caderaD ?? ang.caderaI) },
            ];
        }
        if (key === 'fase_2') {
            return [
                { label: 'Codo Armado', valor: fmtDeg(ang.codoD ?? ang.codoI) },
                { label: 'Hombro', valor: fmtDeg(ang.hombroD ?? ang.hombroI) },
            ];
        }
        if (key === 'fase_3') {
            return [
                { label: 'Extensión Codo', valor: fmtDeg(Math.max(ang.codoD ?? 0, ang.codoI ?? 0) || null) },
                { label: 'Salto', valor: `${Number(saltoCm || 0).toFixed(1)} cm` },
            ];
        }
        const sim =
            ang.rodillaD != null && ang.rodillaI != null
                ? `${Math.round(Math.abs(ang.rodillaD - ang.rodillaI))}° Δ`
                : '—';
        return [
            { label: 'Amortiguación', valor: fmtDeg(ang.rodillaD ?? ang.rodillaI) },
            { label: 'Simetría', valor: sim },
        ];
    };

    return (
        <section className={styles.wrap} aria-label="Las 4 Fases Biomecánicas y diagnóstico en tiempo real">
            <header className={styles.topBar}>
                <div className={styles.diagBlock}>
                    <div className={styles.badgesRow}>
                        <span className={styles.gestureBadge}>🏐 {gestoTitulo}</span>
                        <span className={styles.bufferBadge} data-online={Boolean(live?.backendConnected)}>
                            {live?.backendConnected ? `FastAPI :8000 · ${estadoBuffer}` : 'Modo Local MediaPipe'}
                        </span>
                        {saltoCm > 0 && <span className={styles.jumpBadge}>Salto {Number(saltoCm).toFixed(1)} cm</span>}
                    </div>
                    <p className={styles.diagText}>{diagPrincipal}</p>
                </div>

                <div className={styles.barActions}>
                    {lastValidRep && onSpeakCoach && (
                        <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => onSpeakCoach(lastValidRep)}
                            title="Escuchar diagnóstico del Coach IA"
                        >
                            🔊 Voz Coach
                        </button>
                    )}
                    {lastValidRep && onOpenDetail && (
                        <button
                            type="button"
                            className={styles.actionBtnPrimary}
                            onClick={() => onOpenDetail('ablacion')}
                            title="Abrir Laboratorio de Ablación Científica (Método A/B/C) y Replay GIF"
                        >
                            📊 Ablación &amp; GIF
                        </button>
                    )}
                </div>
            </header>

            <div className={styles.grid}>
                {PHASES_DEF.map((def) => {
                    const infoEval = lastValidRep?.fases4?.[def.key] || null;
                    const infoVivo = fasesVivo?.fases?.[def.key] || null;

                    const isLiveActive =
                        running &&
                        (infoVivo?.activa ||
                            fasesVivo?.fase_activa === def.key ||
                            def.faseIds.includes(phase));

                    // Prioriza la telemetría viva mientras está capturando, y fija el resultado cuando completa una repetición
                    const estadoTexto = infoEval
                        ? `${infoEval.score}% · ${infoEval.estado}`
                        : infoVivo?.estado || (isLiveActive ? 'En curso' : 'Pendiente');

                    const tone = infoEval
                        ? infoEval.estado
                        : infoVivo?.estado === 'Óptimo'
                          ? 'Óptimo'
                          : isLiveActive
                            ? 'En curso'
                            : 'Monitoreando';

                    const metricas =
                        infoEval?.metricas?.length > 0 && !isLiveActive
                            ? infoEval.metricas
                            : metricasEnVivoPorFase(def.key);

                    const diagnosticoTexto =
                        isLiveActive && infoVivo?.diagnostico
                            ? infoVivo.diagnostico
                            : infoEval?.diagnostico ||
                              infoVivo?.diagnostico ||
                              'Esperando detección en esta fase.';

                    const clickable = Boolean(lastValidRep?.fases4?.[def.key] && onSelectPhaseFrame);

                    return (
                        <button
                            key={def.key}
                            type="button"
                            disabled={!clickable}
                            onClick={() =>
                                clickable && onSelectPhaseFrame(lastValidRep.fases4[def.key].frameIdx ?? 0)
                            }
                            className={`${styles.card} ${def.vertice ? styles.cardVertice : ''} ${
                                isLiveActive ? styles.cardActive : ''
                            }`}
                            title={
                                clickable
                                    ? `Ir al frame de ${def.titulo} en el Visor 3D`
                                    : def.titulo
                            }
                        >
                            <div className={styles.cardHead}>
                                <span className={styles.phaseNum}>FASE {def.num}</span>
                                <span className={styles.statePill} data-estado={tone}>
                                    {estadoTexto}
                                </span>
                            </div>

                            <h3 className={styles.cardTitle}>{infoEval?.nombre || def.titulo}</h3>
                            <p className={styles.cardSub}>{infoEval?.subtitulo || def.subtitulo}</p>

                            <div className={styles.metricsRow}>
                                {metricas.map((m) => (
                                    <span key={m.label} className={styles.metricTag}>
                                        {m.label}: <b>{m.valor}</b>
                                    </span>
                                ))}
                            </div>

                            <p className={styles.cardDiag}>{diagnosticoTexto}</p>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
