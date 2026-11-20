'use client';

export default function ModuloSuperiorLaboratorio({
    videoRef,
    canvasRef,
    camStatus,
    camError,
    camaraActiva,
    cargandoIA,
    backendConnected,
    usuarioId,
    setUsuarioId,
    gestoSeleccionado,
    setGestoSeleccionado,
    vozActiva,
    calibracion,
    live,
    secuenciaMostrada,
    fraseCoach,
    secuenciaDescartadaBanner,
    onToggleCamara,
    onToggleVoz,
    onReiniciarBuffer,
    onSaltarCalibracion,
    onFinalizarPDF,
}) {
    const enCalibracion = calibracion.estadoSesion === 'CALIBRANDO';
    const estadoBuf = live.estadoBuffer || 'CALIBRANDO';
    const framesCal = calibracion.framesCalibrados ?? 0;
    const framesReq = calibracion.framesRequeridos ?? 45;

    let hudBadgeText = '🟢 CALIBRADO / LISTO (MONITOREANDO)';
    let hudBadgeColor = 'var(--neon-green)';
    let hudBadgeGlow = 'var(--glow-green)';

    if (!camaraActiva && !backendConnected) {
        hudBadgeText = cargandoIA ? '⏳ CARGANDO MEDIAPIPE...' : '⚪ CÁMARA EN ESPERA';
        hudBadgeColor = 'var(--neon-cyan)';
        hudBadgeGlow = 'var(--glow-cyan)';
    } else if (enCalibracion || estadoBuf === 'CALIBRANDO') {
        hudBadgeText = `🔒 CALIBRANDO POSICIÓN 'T' (${framesCal}/${framesReq})`;
        hudBadgeColor = 'var(--neon-yellow)';
        hudBadgeGlow = 'var(--glow-yellow)';
    } else if (estadoBuf === 'ENCUADRE_INCOMPLETO') {
        hudBadgeText = '⚠️ ENCUADRE INCOMPLETO (CUERPO ENTERO REQUERIDO)';
        hudBadgeColor = 'var(--neon-red)';
        hudBadgeGlow = 'var(--glow-red)';
    } else if (
        estadoBuf === 'USUARIO DE ESPALDAS - ESPERANDO POSICIÓN FRONTAL' ||
        estadoBuf === 'ENCUADRE INVÁLIDO - USUARIO DE ESPALDAS'
    ) {
        hudBadgeText = '⚠️ USUARIO DE ESPALDAS - ESPERANDO POSICIÓN FRONTAL';
        hudBadgeColor = 'var(--neon-red)';
        hudBadgeGlow = 'var(--glow-red)';
    } else if (estadoBuf === 'T0_DETECTADO' || estadoBuf === 'ESPERANDO_POST') {
        hudBadgeText = `CRÍTICO t0 DETECTADO — ESPERANDO POST: ${live.postRestantes ?? 0}`;
        hudBadgeColor = 'var(--neon-yellow)';
        hudBadgeGlow = 'var(--glow-yellow)';
    } else if (estadoBuf === 'COOLDOWN') {
        hudBadgeText = 'PROCESANDO / ENFRIAMIENTO';
        hudBadgeColor = 'var(--neon-purple)';
        hudBadgeGlow = 'none';
    }

    const bufferPct = Math.min(100, Math.round(((live.framesEnBuffer ?? 0) / 60) * 100));

    const gestoHero = secuenciaMostrada
        ? `${secuenciaMostrada.salto_index ? `[Salto #${secuenciaMostrada.salto_index}] ` : ''}${secuenciaMostrada.gestoNombre}`
        : secuenciaDescartadaBanner || 'Esperando gesto...';

    const scoreHero =
        secuenciaMostrada?.scoreGlobal !== undefined ? `${secuenciaMostrada.scoreGlobal}%` : '--%';

    const saltoMostrar =
        secuenciaMostrada?.saltoCm > 0 ? secuenciaMostrada.saltoCm : live.saltoVerticalCm || 0;
    const tvMostrar =
        secuenciaMostrada?.tiempoVueloSeg > 0 ? secuenciaMostrada.tiempoVueloSeg : live.tiempoVueloSeg || 0;

    return (
        <>
            {/* NAVBAR */}
            <nav className="vs-navbar">
                <div className="vs-navbar-inner">
                    <a href="#inicioHero" className="vs-logo">
                        <span className="vs-logo-icon">🏐</span>
                        <span>
                            VolleyScan <span className="vs-logo-ai">AI</span>
                        </span>
                    </a>

                    <ul className="vs-nav-links">
                        <li>
                            <a href="#inicioHero" className="active">
                                Inicio
                            </a>
                        </li>
                        <li>
                            <a href="#laboratorio3D">Laboratorio 3D</a>
                        </li>
                        <li>
                            <a href="#seccionTimeline">⏱️ Timeline</a>
                        </li>
                        <li>
                            <a href="#seccionFases">Visor 4 Fases</a>
                        </li>
                        <li>
                            <a href="#seccionFatigaNeuromuscular">📉 Fatiga</a>
                        </li>
                        <li>
                            <a href="#seccionAblacion">🔬 Validación Científica</a>
                        </li>
                        <li>
                            <a href="#seccionInspector">🛠️ Inspector</a>
                        </li>
                    </ul>

                    <div className="vs-nav-actions">
                        <button
                            type="button"
                            id="btnAudioCoach"
                            onClick={onToggleVoz}
                            className={`btn-pill-outline ${vozActiva ? 'active' : ''}`}
                        >
                            {vozActiva ? '🔊 Coach Voz: ON' : '🔇 Coach Voz: OFF'}
                        </button>
                        <button
                            type="button"
                            id="btnCamaraNav"
                            onClick={onToggleCamara}
                            disabled={cargandoIA}
                            className={camaraActiva ? 'btn-pill-outline active' : 'btn-primary-cyan'}
                        >
                            {cargandoIA
                                ? '⏳ Preparando MediaPipe...'
                                : camaraActiva
                                  ? '⏹ Detener Cámara'
                                  : '⚡ Iniciar Cámara 3D'}
                        </button>
                    </div>
                </div>
            </nav>

            {/* HERO CIENTÍFICO */}
            <header id="inicioHero" className="vs-hero">
                <div className="vs-hero-badge">
                    <span>🔬 Hipótesis de Investigación — Reconstrucción 3D Temporal &amp; Análisis en 4 Fases</span>
                </div>
                <h1 className="vs-hero-title">
                    Asistente de Voleibol con <span className="highlight-cyan">Detección de Fases Críticas</span> y{' '}
                    <span className="highlight-yellow">Evidencia Biomecánica</span>
                </h1>
                <p className="vs-hero-subtitle">
                    Superando la limitación de la captura tradicional de un solo fotograma. Búfer circular temporal continuo de 60 fotogramas, captura dinámica de la ventana crítica [t0 - 20 : t0 + 12] y diagnóstico causal encadenado de la técnica deportiva.
                </p>
            </header>

            {/* MÓDULO SUPERIOR: LABORATORIO DE CÁMARA, CALIBRACIÓN EN 'T' Y TELEMETRÍA HERO */}
            <section id="laboratorio3D" className="vs-card">
                <div className="vs-controls-bar">
                    <div className="vs-control-group">
                        <span className="text-xs uppercase font-bold text-slate-400">Jugador:</span>
                        <input
                            id="usuarioIdInput"
                            type="text"
                            value={usuarioId}
                            onChange={(e) => setUsuarioId(e.target.value)}
                            className="vs-input font-mono text-xs w-64"
                            aria-label="Identificador del atleta en Supabase"
                        />

                        <span className="text-xs uppercase font-bold text-slate-400 ml-2">Gesto Técnico:</span>
                        <select
                            id="gestoSelect"
                            value={gestoSeleccionado}
                            onChange={(e) => setGestoSeleccionado(e.target.value)}
                            className="vs-select"
                            aria-label="Seleccionar gesto técnico"
                        >
                            <option value="auto">⚡ Detección Automática (IA)</option>
                            <option value="remate">💥 Remate (Ataque Aéreo)</option>
                            <option value="saque">🎯 Saque (Servicio en Salto)</option>
                            <option value="voleo">🙌 Voleo (Pase de Dedos)</option>
                            <option value="bloqueo">🧱 Bloqueo Defensivo</option>
                            <option value="recepcion">🛡️ Recepción / Antebrazos</option>
                        </select>
                    </div>

                    <div className="vs-control-group">
                        <button
                            type="button"
                            id="btnControlCamara"
                            onClick={onToggleCamara}
                            disabled={cargandoIA}
                            className={camaraActiva ? 'btn-pill-outline active' : 'btn-primary-cyan'}
                        >
                            {cargandoIA
                                ? '⏳ Iniciando...'
                                : camaraActiva
                                  ? '⏹ Detener Visor 3D'
                                  : '▶ Activar Visor 3D'}
                        </button>
                        <button type="button" onClick={onReiniciarBuffer} className="btn-pill-outline">
                            🔄 Resetear Búfer
                        </button>
                        <button type="button" id="btnExportarPDF" onClick={onFinalizarPDF} className="btn-danger-pdf">
                            📥 Finalizar Sesión y Exportar PDF
                        </button>
                    </div>
                </div>

                {camStatus === 'error' && camError && (
                    <div className="vs-fatigue-clinical-alert" role="alert">
                        <span>⚠️ {camError}</span>
                    </div>
                )}

                <div className="vs-stage-grid top-dashboard">
                    {/* 1. LIENZO DE CÁMARA MEDIAPIPE Y OVERLAY CALIBRACIÓN */}
                    <div className="vs-camera-stage-centered">
                        <div className="vs-viewport-wrap">
                            <video ref={videoRef} id="videoElemento" className="vs-video-hidden" playsInline muted />
                            <canvas ref={canvasRef} id="canvasSalida" className="vs-canvas-main" />

                            {/* HUD Flotante Minimalista */}
                            <div className="vs-hud-overlay">
                                <div className="vs-hud-pill highlight">
                                    <span>FPS:</span> <strong id="hudFps">{live.fps}</strong>
                                </div>
                                <div className="vs-hud-pill">
                                    <span>Frame:</span> <strong id="hudFrameId">#{live.frameId}</strong>
                                </div>
                                <div className="vs-hud-pill">
                                    <span>Brazo:</span> <strong id="hudLadoDominante">{live.ladoDominante}</strong>
                                </div>
                                <div className="vs-hud-pill">
                                    <span>Puerto 8000:</span>{' '}
                                    <strong>{backendConnected ? 'Conectado' : 'En espera'}</strong>
                                </div>
                            </div>

                            {/* Estado del Búfer / Calibración */}
                            <div
                                id="hudEstadoBuffer"
                                className="vs-hud-status-badge"
                                style={{
                                    borderColor: hudBadgeColor,
                                    color: hudBadgeColor,
                                    boxShadow: hudBadgeGlow,
                                }}
                            >
                                {hudBadgeText}
                            </div>

                            {/* BANNER FLOTANTE DE CALIBRACIÓN EN POSICIÓN 'T' (VALIDACIÓN 45 FRAMES) */}
                            {camaraActiva && calibracion.visibleOverlay && (
                                <div id="overlayCalibracion" className="vs-calibration-overlay">
                                    <div
                                        className={`vs-calibration-box ${
                                            calibracion.tipo === 'calibracion_exitosa'
                                                ? 'calibracion-exito'
                                                : calibracion.alertaLuz
                                                  ? 'calibracion-error'
                                                  : ''
                                        }`}
                                    >
                                        <div id="badgeEstadoCalibracion" className="vs-calibration-badge">
                                            {calibracion.tipo === 'calibracion_exitosa'
                                                ? '✅ CALIBRADO / LISTO'
                                                : "🔒 CALIBRANDO POSICIÓN 'T'"}
                                        </div>
                                        <p id="txtMensajeCalibracion" className="vs-calibration-msg">
                                            {calibracion.mensaje}
                                        </p>
                                        {calibracion.alertaLuz && (
                                            <div id="alertaLuzCalibracion" className="vs-calibration-alert">
                                                ⚠️{' '}
                                                <span id="txtAlertaLuzCalibracion">
                                                    {calibracion.mensaje}
                                                </span>
                                            </div>
                                        )}
                                        <div className="vs-calibration-progress-wrap">
                                            <div className="vs-calibration-progress-bar">
                                                <div
                                                    id="barraProgresoCalibracion"
                                                    className="vs-calibration-progress-fill"
                                                    style={{ width: `${calibracion.progresoPct ?? 0}%` }}
                                                />
                                            </div>
                                            <div className="vs-calibration-meta">
                                                <span id="txtProgresoCalibracion">
                                                    {framesCal} / {framesReq} frames (2.0s)
                                                </span>
                                                <span id="txtVisibilidadCalibracion">
                                                    Visibilidad: {calibracion.visibilidadPct}%
                                                </span>
                                            </div>
                                        </div>
                                        {enCalibracion && (
                                            <button
                                                type="button"
                                                onClick={onSaltarCalibracion}
                                                className="vs-skip-calib-btn"
                                            >
                                                ⚡ Saltar calibración (modo activo)
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Barra de progreso del Búfer Circular */}
                            <div className="vs-buffer-bar-wrap">
                                <span id="txtBufferInfo">Búfer Circular: {live.framesEnBuffer ?? 0} / 60 frames</span>
                                <div className="vs-buffer-progress">
                                    <div
                                        id="bufferProgressInner"
                                        className="vs-buffer-progress-inner"
                                        style={{ width: `${bufferPct}%` }}
                                    />
                                </div>
                                <span id="txtBufferVentana">Ventana: 25 Frames [8 Ángulos]</span>
                            </div>
                        </div>
                    </div>

                    {/* 2. PANEL LATERAL CON LAS 3 MÉTRICAS PRINCIPALES */}
                    <aside className="vs-telemetry-panel">
                        {/* TARJETA PRINCIPAL 1: ALTURA DE SALTO (CM) */}
                        <div className="vs-metric-card-pro vs-card-jump-hero">
                            <div className="vs-metric-card-header">
                                <span className="vs-metric-card-label">🚀 Altura de Salto (cm)</span>
                                <span id="metricTiempoVueloHero" className="vs-metric-pill-cyan">
                                    Vuelo: {Number(tvMostrar).toFixed(2)} s
                                </span>
                            </div>
                            <div className="vs-metric-jump-display">
                                <span id="metricAlturaSaltoHero" className="vs-metric-number-giant">
                                    {Number(saltoMostrar).toFixed(1)}
                                </span>
                                <span className="vs-metric-unit-giant">cm</span>
                            </div>
                            <div className="vs-metric-card-footer">
                                <span>
                                    Cálculo físico por Tiempo de Vuelo: <code>h = 0.5 · g · (t/2)²</code>
                                </span>
                            </div>
                        </div>

                        {/* TARJETA PRINCIPAL 2: GESTO DETECTADO + CONFIANZA */}
                        <div className="vs-metric-card-pro vs-card-gesture-hero">
                            <div className="vs-metric-card-header">
                                <span className="vs-metric-card-label">🏐 Gesto Detectado</span>
                                <span id="metricConfianzaGesto" className="vs-metric-pill-emerald">
                                    Confianza: {live.confianzaPct != null ? `${live.confianzaPct}%` : '--%'}
                                </span>
                            </div>
                            <div className="vs-gesture-main-row">
                                <div id="metricGestoDetectado" className="vs-gesture-title-giant">
                                    {gestoHero}
                                </div>
                                <div className="vs-gesture-score-box">
                                    <span className="vs-gesture-score-caption">Efectividad</span>
                                    <span id="metricScoreGlobal" className="vs-gesture-score-val">
                                        {scoreHero}
                                    </span>
                                </div>
                            </div>
                            <div className="vs-metric-card-footer flex items-center justify-between">
                                <span>Secuencia de 25 frames evaluada</span>
                                <span className="text-slate-300 font-mono text-xs">
                                    Vel. Muñeca:{' '}
                                    <strong id="metricVelocidadMuneca" className="text-emerald-400">
                                        {Number(live.velMunecaMs ?? 0).toFixed(1)} m/s
                                    </strong>
                                </span>
                            </div>
                        </div>

                        {/* TARJETA PRINCIPAL 3: DIAGNÓSTICO DE POSTURA EN TIEMPO REAL */}
                        <div className="vs-metric-card-pro vs-card-posture-hero">
                            <div className="vs-metric-card-header">
                                <span className="vs-metric-card-label">🩺 Diagnóstico de Postura</span>
                                <span className="vs-metric-pill-amber">Tiempo Real</span>
                            </div>
                            <div id="metricFaseActual" className={`vs-posture-status-title ${live.faseTone}`}>
                                {live.faseTitulo}
                            </div>
                            <p id="metricDetalleFase" className="vs-posture-detail-text">
                                {live.faseDetalle}
                            </p>
                            <div className="vs-voice-coach-callout">
                                <div className="vs-voice-coach-tag">🗣️ Coach Biomecánico</div>
                                <p id="txtCoachVoiceLive" className="vs-voice-coach-quote">
                                    {fraseCoach}
                                </p>
                            </div>
                        </div>
                    </aside>
                </div>
            </section>
        </>
    );
}
