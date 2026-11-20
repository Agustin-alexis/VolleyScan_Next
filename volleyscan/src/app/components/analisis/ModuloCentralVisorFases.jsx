'use client';

import GestureDetailView from './GestureDetailView';

export default function ModuloCentralVisorFases({
    historialSesion = [],
    indiceActivo,
    modoHistorico,
    alertaFatigaTecnica,
    secuenciaMostrada,
    secuenciaDescartadaBanner,
    live,
    backendConnected,
    camaraActiva,
    onCargarHistorico,
    onVolverAlDirecto,
    onDescartarAlertaFatiga,
}) {
    const hasReplayGif = Boolean(secuenciaMostrada?.video_replay_base64);
    const replaySrc = hasReplayGif
        ? secuenciaMostrada.video_replay_base64.startsWith('data:')
            ? secuenciaMostrada.video_replay_base64
            : `data:image/gif;base64,${secuenciaMostrada.video_replay_base64}`
        : null;

    const snaps = secuenciaMostrada?.snapshotsFases || null;

    let badgeTsTexto = 'Secuencia #0 • En Vivo';
    let badgeTsClase = 'badge-tag badge-cyan';
    if (secuenciaMostrada) {
        const sLbl = secuenciaMostrada.salto_index ? `Salto #${secuenciaMostrada.salto_index} • ` : '';
        badgeTsTexto = `${sLbl}Secuencia t0 #${secuenciaMostrada.t0_frame_id ?? '--'} • Evaluada`;
        badgeTsClase = 'badge-tag badge-green';
    } else if (secuenciaDescartadaBanner) {
        badgeTsTexto = secuenciaDescartadaBanner;
        badgeTsClase = 'badge-tag badge-yellow';
    }

    return (
        <>
            {/* 1.5. LÍNEA DE TIEMPO INTERACTIVA DEL ENTRENAMIENTO */}
            <section id="seccionTimeline" className="vs-card">
                <div className="vs-card-header">
                    <div>
                        <h2 className="vs-card-title">
                            <span>⏱️</span> Línea de Tiempo de Sesión
                            <span id="badgeTotalSaltos" className="badge-tag badge-cyan">
                                {historialSesion.length}{' '}
                                {historialSesion.length === 1 ? 'Repetición' : 'Repeticiones'}
                            </span>
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                            Carrusel histórico del entrenamiento continuo. Haz clic en cualquier repetición para auditar sus 4 fases biomecánicas y ablación.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {modoHistorico && (
                            <button type="button" id="btnVolverEnVivo" className="btn-live" onClick={onVolverAlDirecto}>
                                <span className="live-pulse-dot" /> 🔴 Volver al Directo
                            </button>
                        )}
                        <span
                            id="badgeModoVisualizacion"
                            className={`badge-tag ${modoHistorico ? 'badge-yellow font-bold' : 'badge-green'}`}
                        >
                            {modoHistorico ? `HISTÓRICO: Rep #${indiceActivo}` : 'En Vivo'}
                        </span>
                    </div>
                </div>

                {alertaFatigaTecnica && (
                    <div id="alertaFatigaContainer" className="vs-fatiga-banner">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">⚠️</span>
                            <div>
                                <div className="font-bold text-sm text-amber-300">
                                    Alerta de Fatiga Técnica Detectada
                                </div>
                                <div id="txtAlertaFatiga" className="text-xs text-amber-100">
                                    {alertaFatigaTecnica}
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="btn-dismiss-fatiga"
                            onClick={onDescartarAlertaFatiga}
                            title="Descartar alerta"
                        >
                            ✕
                        </button>
                    </div>
                )}

                <div id="timelineScrollContainer" className="vs-timeline-scroll">
                    {historialSesion.length === 0 ? (
                        <div id="timelineEmptyPlaceholder" className="vs-timeline-empty">
                            <div className="text-2xl mb-1">🏐</div>
                            <div className="text-xs text-slate-400">
                                Sin repeticiones registradas aún en esta sesión. Ejecuta un remate, saque, bloqueo o recepción frente a la cámara.
                            </div>
                        </div>
                    ) : (
                        <div id="timelineMiniCards" className="vs-timeline-cards-track">
                            {historialSesion.map((salto, idx) => {
                                const repNum = salto.salto_index || idx + 1;
                                const sc = Math.round(salto.score_global || 0);
                                const colorClass = sc >= 85 ? 'rep-green' : sc >= 70 ? 'rep-yellow' : 'rep-red';
                                const labelScore = sc >= 85 ? 'ÓPTIMO' : sc >= 70 ? 'REGULAR' : 'DEFICIENTE';
                                const isActive = modoHistorico && Number(indiceActivo) === Number(repNum);

                                return (
                                    <button
                                        key={`${repNum}-${salto.t0_frame_id || idx}`}
                                        type="button"
                                        onClick={() => onCargarHistorico(repNum)}
                                        className={`vs-rep-card ${colorClass} ${isActive ? 'active-rep-card' : ''}`}
                                        title={`Clic para auditar Salto #${repNum} (${salto.gestoNombre}: ${sc}%)`}
                                    >
                                        <div className="vs-rep-header">
                                            <span className="vs-rep-badge-num">Rep #{repNum}</span>
                                            <span className="vs-rep-time">{salto.timestampLocal}</span>
                                        </div>
                                        <div className="vs-rep-gesto">{salto.gestoNombre || 'Gesto'}</div>
                                        <div className="vs-rep-score-row">
                                            <span className="vs-rep-score-val">{sc}%</span>
                                            <span className={`vs-rep-tag ${colorClass}`}>{labelScore}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* 2. VISOR CINEMÁTICO DE LAS 4 FASES BIOMECÁNICAS + MOTOR REPLAY SLOW-MOTION / 3D */}
            <section id="seccionFases" className="vs-card">
                <div className="vs-card-header">
                    <div>
                        <h2 className="vs-card-title">
                            <span>📸</span> Visor Cinemático de 4 Fases Biomecánicas
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                            Capturas sincronizadas y video replay en cámara lenta de la subsecuencia completa [t0 - 20 : t0 + 12].
                        </p>
                    </div>
                    <div id="badgeSecuenciaTimestamp" className={badgeTsClase}>
                        {badgeTsTexto}
                    </div>
                </div>

                {/* VISOR MODULAR REUTILIZABLE DE 4 FASES (REPRODUCTOR 3D/33f + CAUSA-EFECTO + CORRECCIONES) */}
                <GestureDetailView
                    gesture={secuenciaMostrada}
                    live={live}
                    backendConnected={backendConnected}
                    camaraActiva={camaraActiva}
                    snaps={snaps}
                    replaySrc={replaySrc}
                    modoReproductorInicial={hasReplayGif ? 'gif' : '3d'}
                    mostrarSelectorModo
                    compact
                />
            </section>
        </>
    );
}
