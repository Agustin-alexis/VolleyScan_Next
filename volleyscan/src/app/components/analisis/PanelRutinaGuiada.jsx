'use client';

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
    FaArrowLeft,
    FaArrowRight,
    FaBullseye,
    FaCamera,
    FaCheck,
    FaClock,
    FaDumbbell,
    FaForwardStep,
    FaPause,
    FaPlay,
    FaTrophy,
    FaVolumeHigh,
} from 'react-icons/fa6';

export const NOMBRES_GESTOS_GUIA = {
    remate: 'Remate',
    saque: 'Saque',
    voleo: 'Voleo',
    bloqueo: 'Bloqueo',
    recepcion: 'Recepción',
};

export function normalizarGestoCanonicoGuia(raw) {
    const v = String(raw || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    if (!v) return '';
    if (v.includes('bloq')) return 'bloqueo';
    if (v.includes('saque') || v.includes('serv')) return 'saque';
    if (v.includes('voleo') || v.includes('coloc') || v.includes('dedo')) return 'voleo';
    if (v.includes('recep') || v.includes('defen') || v.includes('antebraz')) return 'recepcion';
    if (v.includes('remate') || v.includes('ataque') || v.includes('salto')) return 'remate';
    return '';
}

export function inferirGestoObjetivoEjercicio(ej, categoriaRutina = '') {
    const textoEj = `${ej?.nombre || ''} ${ej?.enfoque || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (textoEj.includes('bloqueo')) return 'bloqueo';
    if (textoEj.includes('saque') || textoEj.includes('lanzamiento')) return 'saque';
    if (textoEj.includes('voleo') || textoEj.includes('toques') || textoEj.includes('triangulo') || textoEj.includes('dedos')) {
        return 'voleo';
    }
    if (textoEj.includes('recep') || textoEj.includes('antebraz') || textoEj.includes('plataforma') || textoEj.includes('defensa')) {
        return 'recepcion';
    }
    if (textoEj.includes('remate') || textoEj.includes('arco y flecha')) return 'remate';

    const catNorm = normalizarGestoCanonicoGuia(categoriaRutina);
    return catNorm || 'remate';
}

export function parsearSeriesYReps(seriesRaw) {
    const txt = String(seriesRaw || '').toLowerCase();
    const matchX = txt.match(/(\d+)\s*[x×]\s*(\d+)/);
    if (matchX) {
        const series = Math.max(1, Math.min(8, Number(matchX[1])));
        const num2 = Math.max(1, Number(matchX[2]));
        const esTiempo = /\b(\d+)\s*s\b/.test(txt);
        return {
            series,
            repsPorSerie: esTiempo ? 8 : Math.min(30, num2),
            unidad: txt.includes('toque') ? 'toques' : 'reps',
        };
    }
    const soloNum = txt.match(/(\d+)/);
    return {
        series: 3,
        repsPorSerie: soloNum ? Math.max(3, Math.min(25, Number(soloNum[1]))) : 8,
        unidad: 'reps',
    };
}

export function parsearDescansoSeg(descansoRaw) {
    const txt = String(descansoRaw || '').toLowerCase();
    const m = txt.match(/(\d+)/);
    if (!m) return 45;
    const n = Number(m[1]);
    if (txt.includes('min')) return Math.min(180, Math.max(20, n * 60));
    return Math.min(180, Math.max(15, n));
}

export function esGestoCompatibleGuia(gestoDetectadoRaw, gestoObjetivo, categoriaRutina = '', ejNombre = '') {
    const det = normalizarGestoCanonicoGuia(gestoDetectadoRaw);
    const obj = normalizarGestoCanonicoGuia(gestoObjetivo);
    if (!det || !obj) return false;
    if (det === obj) return true;

    const catLow = String(categoriaRutina || '').toLowerCase();
    const nomLow = String(ejNombre || '').toLowerCase();
    const esPlioOSalto =
        catLow.includes('salto') ||
        catLow.includes('plio') ||
        nomLow.includes('salto') ||
        nomLow.includes('rebote');
    if (esPlioOSalto && obj === 'remate' && (det === 'bloqueo' || det === 'saque')) {
        return true;
    }
    return false;
}

export function construirCorreccionSiguienteRep(seqItem, gestoObjetivo) {
    const fases = seqItem?.fases || seqItem?.fases4 || {};
    const entradas = [
        ['fase_1', fases?.fase_1?.score],
        ['fase_2', fases?.fase_2?.score],
        ['fase_3', fases?.fase_3?.score],
        ['fase_4', fases?.fase_4?.score],
    ].filter(([, s]) => s !== undefined && s !== null && Number.isFinite(Number(s)));

    if (entradas.length === 0) {
        return 'Bien hecho. Mantén postura firme y movimiento fluido en la siguiente repetición.';
    }

    entradas.sort((a, b) => Number(a[1]) - Number(b[1]));
    const [peorFase, peorScore] = entradas[0];

    if (Number(peorScore) >= 82 && Number(seqItem?.scoreGlobal || 0) >= 82) {
        return '¡Excelente técnica! Repite exactamente este mismo ritmo en la siguiente.';
    }

    if (gestoObjetivo === 'recepcion') {
        if (peorFase === 'fase_1') return 'Baja un poquito más las rodillas en la siguiente antes de recibir.';
        if (peorFase === 'fase_2' || peorFase === 'fase_3') {
            return 'Sella las muñecas y estira bien los codos al formar la plataforma.';
        }
        return 'Mantén ambos pies firmes y equilibrados al dirigir el pase.';
    }

    if (gestoObjetivo === 'voleo') {
        if (peorFase === 'fase_1') return 'Flexiona suave las rodillas para ayudarte desde las piernas.';
        if (peorFase === 'fase_2') return 'Ubica tus manos arriba de la frente formando el triángulo.';
        if (peorFase === 'fase_3') return 'Empuja más parejo con ambos codos al mismo tiempo.';
        return 'Termina estable acompañando el balón hacia adelante.';
    }

    if (peorFase === 'fase_1') {
        return 'Para la siguiente rep: dobla un poco más las rodillas antes de saltar.';
    }
    if (peorFase === 'fase_2') {
        return gestoObjetivo === 'bloqueo'
            ? 'Para la siguiente rep: sube ambos brazos al mismo tiempo sobre la red.'
            : 'Para la siguiente rep: levanta más el codo detrás de la cabeza al armar.';
    }
    if (peorFase === 'fase_3') {
        return 'Para la siguiente rep: estira el brazo completo en el punto más alto.';
    }
    return 'Para la siguiente rep: amortigua suave cayendo con los dos pies parejos.';
}

function formatearMmSs(seg) {
    const s = Math.max(0, Math.floor(Number(seg) || 0));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function PanelRutinaGuiada({
    rutina,
    ejerciciosPlan,
    indiceEjercicio,
    serieActual,
    repsActuales,
    estadoGuia, // 'entrenando' | 'descanso' | 'completada'
    segundosDescanso,
    descansoPausado,
    instruccionSiguiente,
    ultimaRepFeedback,
    camaraActiva,
    resumenFinal,
    guardandoCierre,
    onToggleCamara,
    onTogglePausaDescanso,
    onSaltarDescanso,
    onAvanzarEjercicio,
    onFinalizarRutina,
    onVolverRutina,
}) {
    const ejActual = ejerciciosPlan[indiceEjercicio] || null;
    const totalEjercicios = ejerciciosPlan.length;
    const completadosCount = useMemo(
        () => ejerciciosPlan.filter((e) => e.completado).length,
        [ejerciciosPlan],
    );
    const pctRutina = totalEjercicios > 0 ? Math.round((completadosCount / totalEjercicios) * 100) : 0;

    const repsTarget = ejActual?.repsPorSerie || 8;
    const seriesTotal = ejActual?.seriesTotal || 3;
    const pctReps = Math.min(100, Math.round((repsActuales / Math.max(1, repsTarget)) * 100));
    const gestoLabel = NOMBRES_GESTOS_GUIA[ejActual?.gestoObjetivo] || 'Remate';

    const ringRef = useRef(null);
    useEffect(() => {
        if (ringRef.current) {
            ringRef.current.dataset.pct = String(pctReps);
        }
    }, [pctReps]);

    if (!rutina) {
        return null;
    }

    if (estadoGuia === 'completada') {
        return (
            <div className="max-w-[1520px] mx-auto px-4 sm:px-7 pt-4">
                <section className="rounded-3xl bg-gradient-to-br from-[#0f292b] via-[#132238] to-[#0f172a] border border-emerald-400/50 p-6 sm:p-8 shadow-[0_0_32px_rgba(16,185,129,0.18)] space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                        <div className="flex items-start gap-4">
                            <span className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/45 text-emerald-300 flex items-center justify-center text-2xl shrink-0">
                                <FaTrophy />
                            </span>
                            <div className="space-y-1.5">
                                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/35">
                                    Rutina Completada al 100%
                                </span>
                                <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                                    ¡Excelente entrenamiento en {rutina.titulo}!
                                </h2>
                                <p className="text-sm text-slate-300">
                                    Tu cumplimiento y las secuencias 3D ya quedaron guardados en Supabase.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                            <Link
                                href="/usuario/historial"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#10e2f7] hover:bg-[#49ecfc] text-slate-950 text-sm font-bold transition"
                            >
                                Ver en Historial 3D
                                <FaArrowRight className="text-xs" />
                            </Link>
                            <Link
                                href="/usuario/progreso"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm font-semibold transition"
                            >
                                Ver Progreso
                            </Link>
                            <button
                                type="button"
                                onClick={onVolverRutina}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 text-sm font-semibold transition cursor-pointer"
                            >
                                Volver a Rutinas
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="rounded-2xl bg-slate-900/75 border border-slate-800 p-4">
                            <p className="text-xs text-slate-400">Ejercicios cumplidos</p>
                            <p className="text-2xl font-extrabold text-emerald-400 mt-1">
                                {totalEjercicios} / {totalEjercicios}
                            </p>
                        </div>
                        <div className="rounded-2xl bg-slate-900/75 border border-slate-800 p-4">
                            <p className="text-xs text-slate-400">Repeticiones detectadas</p>
                            <p className="text-2xl font-extrabold text-white mt-1">
                                {resumenFinal.totalReps} reps
                            </p>
                        </div>
                        <div className="rounded-2xl bg-slate-900/75 border border-slate-800 p-4">
                            <p className="text-xs text-slate-400">Precisión promedio</p>
                            <p className="text-2xl font-extrabold text-[#10e2f7] mt-1">
                                {resumenFinal.promedioScore}%
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="max-w-[1520px] mx-auto px-4 sm:px-7 pt-4">
            <section
                aria-label="Modo Guiado por Asistente IA"
                className="rounded-3xl bg-gradient-to-br from-[#122035] via-[#15253c] to-[#0f1d30] border border-cyan-400/45 p-5 sm:p-6 shadow-[0_0_28px_rgba(16,226,247,0.14)] space-y-5"
            >
                {/* Fila superior: Título de rutina, progreso general y botón volver */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-4">
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                        <span className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-400/40 text-[#10e2f7] flex items-center justify-center shrink-0">
                            <FaDumbbell />
                        </span>
                        <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#10e2f7]/15 text-[#33e4fa] border border-cyan-400/35">
                                    Modo Guiado IA
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-900/80 text-slate-200 border border-slate-700">
                                    Ejercicio {Math.min(totalEjercicios, indiceEjercicio + 1)} de {totalEjercicios}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                                    {pctRutina}% completado
                                </span>
                            </div>
                            <h2 className="text-base sm:text-lg font-bold text-white truncate">
                                {rutina.titulo}
                            </h2>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        {!camaraActiva && (
                            <button
                                type="button"
                                onClick={onToggleCamara}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#10e2f7] hover:bg-[#49ecfc] text-slate-950 text-xs sm:text-sm font-bold shadow-[0_0_18px_rgba(16,226,247,0.35)] transition cursor-pointer"
                            >
                                <FaCamera />
                                Activar Cámara
                            </button>
                        )}
                        <button
                            type="button"
                            disabled={guardandoCierre}
                            onClick={onFinalizarRutina}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-xs sm:text-sm font-semibold transition cursor-pointer disabled:opacity-60"
                        >
                            <FaCheck />
                            {guardandoCierre ? 'Guardando...' : 'Finalizar Rutina'}
                        </button>
                        <button
                            type="button"
                            onClick={onVolverRutina}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs sm:text-sm font-semibold transition cursor-pointer"
                        >
                            <FaArrowLeft className="text-xs" />
                            Volver
                        </button>
                    </div>
                </div>

                {/* Barra de progreso visual de ejercicios */}
                <div className="flex flex-wrap items-center gap-2">
                    {ejerciciosPlan.map((ej, idx) => {
                        const actual = idx === indiceEjercicio && estadoGuia !== 'completada';
                        return (
                            <div
                                key={ej.id || idx}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition ${
                                    ej.completado
                                        ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                                        : actual
                                          ? 'bg-cyan-500/20 border-cyan-400/70 text-white font-bold'
                                          : 'bg-slate-900/70 border-slate-700/70 text-slate-400'
                                }`}
                            >
                                {ej.completado ? (
                                    <FaCheck className="text-[10px] text-emerald-400" />
                                ) : (
                                    <span className="text-[10px] font-bold">{idx + 1}.</span>
                                )}
                                <span className="max-w-[180px] truncate">{ej.nombre}</span>
                            </div>
                        );
                    })}
                </div>

                {estadoGuia === 'descanso' ? (
                    /* PANEL DE DESCANSO ENTRE SERIES / EJERCICIOS */
                    <div className="rounded-2xl bg-slate-900/85 border border-cyan-400/40 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-cyan-500/15 border border-cyan-400/40 flex flex-col items-center justify-center text-[#10e2f7] shrink-0">
                                <FaClock className="text-sm mb-0.5" />
                                <span className="text-lg font-extrabold tabular-nums">
                                    {formatearMmSs(segundosDescanso)}
                                </span>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-[#10e2f7]">
                                    Descanso Activo
                                </p>
                                <h3 className="text-lg font-bold text-white">
                                    ¡Bien hecho! Respira y prepárate para continuar
                                </h3>
                                <p className="text-sm text-slate-300">
                                    Siguiente paso:{' '}
                                    <strong className="text-white">{ejActual?.nombre}</strong> · Gesto:{' '}
                                    <strong className="text-cyan-300">{gestoLabel}</strong>
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={onTogglePausaDescanso}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-sm font-semibold transition cursor-pointer"
                            >
                                {descansoPausado ? <FaPlay className="text-xs" /> : <FaPause className="text-xs" />}
                                {descansoPausado ? 'Reanudar' : 'Pausar'}
                            </button>
                            <button
                                type="button"
                                onClick={onSaltarDescanso}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#10e2f7] hover:bg-[#49ecfc] text-slate-950 text-sm font-bold shadow-[0_0_20px_rgba(16,226,247,0.35)] transition cursor-pointer"
                            >
                                <FaForwardStep />
                                Saltar descanso y seguir
                            </button>
                        </div>
                    </div>
                ) : (
                    /* PANEL DE EJECUCIÓN EN VIVO CON CONTADOR DE REPS Y FEEDBACK */
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-5 items-center">
                        <div className="space-y-3 min-w-0">
                            <div className="flex flex-wrap items-center gap-2.5">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-[#33e4fa] text-xs font-bold">
                                    <FaBullseye />
                                    Gesto objetivo: {gestoLabel} (Preseleccionado)
                                </span>
                                <span className="px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-xs font-semibold text-slate-300">
                                    Serie {serieActual} de {seriesTotal}
                                </span>
                                <span className="px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-xs text-slate-400">
                                    {ejActual?.series || `${seriesTotal} x ${repsTarget} reps`}
                                </span>
                            </div>

                            <div>
                                <h3 className="text-xl font-extrabold text-white leading-snug">
                                    {ejActual?.nombre}
                                </h3>
                                {ejActual?.enfoque && (
                                    <p className="text-sm text-slate-300 mt-1">{ejActual.enfoque}</p>
                                )}
                            </div>

                            {/* Instrucción en vivo por texto/voz para la siguiente repetición */}
                            <div className="rounded-2xl bg-slate-900/80 border border-slate-700/70 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex items-start gap-2.5 min-w-0">
                                    <span className="mt-0.5 text-[#10e2f7] shrink-0">
                                        <FaVolumeHigh />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                            Coach IA · Siguiente Repetición
                                        </p>
                                        <p className="text-sm font-medium text-white leading-snug">
                                            {instruccionSiguiente}
                                        </p>
                                    </div>
                                </div>

                                {ultimaRepFeedback && (
                                    <span
                                        className={`px-3 py-1 rounded-full text-xs font-bold border shrink-0 ${
                                            ultimaRepFeedback.valido
                                                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                                                : 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                                        }`}
                                    >
                                        {ultimaRepFeedback.texto}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Tarjeta de contador en vivo de repeticiones */}
                        <div
                            ref={ringRef}
                            className="rounded-2xl bg-slate-900/85 border border-cyan-400/40 p-5 flex flex-col justify-between gap-3"
                        >
                            <div className="flex items-center justify-between text-xs text-slate-400">
                                <span className="font-semibold uppercase tracking-wider">
                                    Repeticiones en vivo
                                </span>
                                <span className="font-bold text-[#10e2f7]">{pctReps}%</span>
                            </div>

                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-extrabold text-white tabular-nums">
                                    {repsActuales}
                                </span>
                                <span className="text-lg font-bold text-slate-400">
                                    / {repsTarget} {ejActual?.unidad || 'reps'}
                                </span>
                            </div>

                            <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-[#10e2f7] to-emerald-400 transition-all duration-300"
                                    style={{ width: `${pctReps}%` }}
                                />
                            </div>

                            <button
                                type="button"
                                onClick={onAvanzarEjercicio}
                                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer mt-1"
                            >
                                <FaCheck className="text-[10px] text-emerald-400" />
                                Completar y pasar al siguiente
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
