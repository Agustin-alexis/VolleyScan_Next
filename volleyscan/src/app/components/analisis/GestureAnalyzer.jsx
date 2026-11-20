'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaArrowLeft, FaCheck, FaDumbbell } from 'react-icons/fa6';
import { api } from '@/lib/api';
import { useAsistenteBackend } from '@/hooks/useAsistenteBackend';
import './AsistenteOriginal.css';
import ModuloCentralVisorFases from './ModuloCentralVisorFases';
import ModuloFatigaNeuromuscular from './ModuloFatigaNeuromuscular';
import ModuloInferiorValidacionInspector from './ModuloInferiorValidacionInspector';
import ModuloSuperiorLaboratorio from './ModuloSuperiorLaboratorio';
import PanelRutinaGuiada, {
    NOMBRES_GESTOS_GUIA,
    construirCorreccionSiguienteRep,
    esGestoCompatibleGuia,
    inferirGestoObjetivoEjercicio,
    parsearDescansoSeg,
    parsearSeriesYReps,
} from './PanelRutinaGuiada';

function normalizarParamGesto(raw) {
    const v = String(raw || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    if (!v) return '';
    if (v.includes('remate') || v.includes('ataque') || v.includes('salto')) return 'remate';
    if (v.includes('saque') || v.includes('serv')) return 'saque';
    if (v.includes('voleo') || v.includes('dedo') || v.includes('coloc')) return 'voleo';
    if (v.includes('recep') || v.includes('defen') || v.includes('antebraz')) return 'recepcion';
    if (v.includes('bloq')) return 'bloqueo';
    return '';
}

/**
 * Análisis IA — Dashboard de Diagnóstico en 4 Fases conectado a MediaPipe + FastAPI (puerto 8000)
 * y al Modo Guiado paso a paso cuando se inicia desde /usuario/rutinas.
 */
export default function GestureAnalyzer() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const chartCanvasRef = useRef(null);
    const prefillAplicadoRef = useRef('');

    const rutinaIdParam = searchParams.get('rutinaId') || '';
    const modoParam = (searchParams.get('modo') || '').toLowerCase();
    const gestoParam = searchParams.get('gesto') || '';
    const ejIdParam = searchParams.get('ejId') || '';
    const esModoGuiado = Boolean(rutinaIdParam && (modoParam === 'guiado' || modoParam === 'guided'));

    const [rutinaCargada, setRutinaCargada] = useState(null);
    const [volviendoRutina, setVolviendoRutina] = useState(false);

    // Estado del Modo Guiado
    const [ejerciciosPlan, setEjerciciosPlan] = useState([]);
    const [indiceEjercicio, setIndiceEjercicio] = useState(0);
    const [serieActual, setSerieActual] = useState(1);
    const [repsActuales, setRepsActuales] = useState(0);
    const [estadoGuia, setEstadoGuia] = useState('entrenando'); // 'entrenando' | 'descanso' | 'completada'
    const [segundosDescanso, setSegundosDescanso] = useState(45);
    const [descansoPausado, setDescansoPausado] = useState(false);
    const [instruccionSiguiente, setInstruccionSiguiente] = useState(
        'Activa tu cámara en cuerpo completo y realiza el primer movimiento cuando estés listo.',
    );
    const [ultimaRepFeedback, setUltimaRepFeedback] = useState(null);
    const [guardandoCierre, setGuardandoCierre] = useState(false);
    const [resumenFinal, setResumenFinal] = useState({ totalReps: 0, promedioScore: 0 });

    const pendingStepRef = useRef(null);
    const guiaStatsRef = useRef({ totalReps: 0, scores: [] });
    const asistenteRef = useRef(null);
    const avanzarTrasDescansoRef = useRef(null);

    const rutinaActiva = useMemo(() => {
        if (!rutinaIdParam || !rutinaCargada) return null;
        return String(rutinaCargada.id) === String(rutinaIdParam) ? rutinaCargada : null;
    }, [rutinaIdParam, rutinaCargada]);

    const guiaRef = useRef({
        esModoGuiado: false,
        rutinaActiva: null,
        ejerciciosPlan: [],
        indiceEjercicio: 0,
        serieActual: 1,
        repsActuales: 0,
        estadoGuia: 'entrenando',
    });

    useEffect(() => {
        guiaRef.current = {
            esModoGuiado,
            rutinaActiva,
            ejerciciosPlan,
            indiceEjercicio,
            serieActual,
            repsActuales,
            estadoGuia,
        };
    }, [esModoGuiado, rutinaActiva, ejerciciosPlan, indiceEjercicio, serieActual, repsActuales, estadoGuia]);

    const marcarEjercicioCompletado = useCallback(async (rutinaId, ejId) => {
        if (!rutinaId || !ejId) return;
        try {
            await api(
                `/usuario/rutinas/${encodeURIComponent(rutinaId)}/ejercicios/${encodeURIComponent(ejId)}/completar`,
                {
                    method: 'PUT',
                    body: { completado: true },
                },
            );
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('notificaciones:cambio'));
            }
        } catch {
            /* mantener continuidad en vivo */
        }
    }, []);

    const finalizarRutinaCompleta = useCallback(async () => {
        const g = guiaRef.current;
        if (!g.rutinaActiva?.id) return;
        setGuardandoCierre(true);
        try {
            await Promise.allSettled([
                api(`/usuario/rutinas/${encodeURIComponent(g.rutinaActiva.id)}/completar`, {
                    method: 'PUT',
                    body: { completado: true },
                }),
                asistenteRef.current?.persistirFinSesion?.({ forzar: true }),
            ]);
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('notificaciones:cambio'));
            }
        } finally {
            setGuardandoCierre(false);
        }

        const scores = guiaStatsRef.current.scores;
        const prom = scores.length
            ? Math.round(scores.reduce((acc, v) => acc + v, 0) / scores.length)
            : 0;
        setResumenFinal({ totalReps: guiaStatsRef.current.totalReps, promedioScore: prom });
        setEjerciciosPlan((prev) => prev.map((e) => ({ ...e, completado: true })));
        setEstadoGuia('completada');
        asistenteRef.current?.hablarTexto(
            '¡Felicidades! Completaste toda la rutina y ya guardamos tu avance en Supabase.',
        );
    }, []);

    const pasarAlSiguienteEjercicio = useCallback(
        async (marcarActualComoHecho = true) => {
            const g = guiaRef.current;
            const lista = g.ejerciciosPlan;
            const ejActual = lista[g.indiceEjercicio];
            const listaActualizada = lista.map((item, idx) =>
                marcarActualComoHecho && idx === g.indiceEjercicio ? { ...item, completado: true } : item,
            );
            setEjerciciosPlan(listaActualizada);

            if (marcarActualComoHecho && g.rutinaActiva?.id && ejActual?.id) {
                marcarEjercicioCompletado(g.rutinaActiva.id, ejActual.id);
            }

            const siguienteIdx = listaActualizada.findIndex(
                (item, idx) => idx > g.indiceEjercicio && !item.completado,
            );
            const fallbackPendienteIdx =
                siguienteIdx >= 0 ? siguienteIdx : listaActualizada.findIndex((item) => !item.completado);

            if (fallbackPendienteIdx < 0) {
                await finalizarRutinaCompleta();
                return;
            }

            const siguienteEj = listaActualizada[fallbackPendienteIdx];
            setIndiceEjercicio(fallbackPendienteIdx);
            setSerieActual(1);
            setRepsActuales(0);
            setEstadoGuia('entrenando');
            setUltimaRepFeedback(null);
            setInstruccionSiguiente(
                siguienteEj.enfoque ||
                    `Realiza ${siguienteEj.nombre} manteniendo postura firme y control.`,
            );
            asistenteRef.current?.setGestoSeleccionado?.(siguienteEj.gestoObjetivo);
            asistenteRef.current?.hablarTexto(
                `Siguiente ejercicio: ${siguienteEj.nombre}. Gesto objetivo: ${NOMBRES_GESTOS_GUIA[siguienteEj.gestoObjetivo] || 'Remate'}.`,
            );
        },
        [marcarEjercicioCompletado, finalizarRutinaCompleta],
    );

    const avanzarTrasDescanso = useCallback(() => {
        const pending = pendingStepRef.current;
        pendingStepRef.current = null;
        if (!pending) {
            setEstadoGuia('entrenando');
            return;
        }
        if (pending.tipo === 'next_set') {
            setEstadoGuia('entrenando');
            const ej = guiaRef.current.ejerciciosPlan[guiaRef.current.indiceEjercicio];
            if (ej) {
                asistenteRef.current?.hablarTexto(
                    `¡Descanso terminado! Comienza la serie ${pending.serie} de ${ej.nombre}.`,
                );
            }
            return;
        }
        if (pending.tipo === 'next_exercise') {
            const lista = guiaRef.current.ejerciciosPlan;
            const ejSig = lista[pending.idx];
            if (!ejSig) {
                finalizarRutinaCompleta();
                return;
            }
            setIndiceEjercicio(pending.idx);
            setSerieActual(1);
            setRepsActuales(0);
            setEstadoGuia('entrenando');
            setUltimaRepFeedback(null);
            setInstruccionSiguiente(
                ejSig.enfoque || `Realiza ${ejSig.nombre} manteniendo buena postura.`,
            );
            asistenteRef.current?.setGestoSeleccionado?.(ejSig.gestoObjetivo);
            asistenteRef.current?.hablarTexto(
                `Seguimos con ${ejSig.nombre}. Realiza ${ejSig.repsPorSerie} repeticiones de ${NOMBRES_GESTOS_GUIA[ejSig.gestoObjetivo] || 'Remate'}.`,
            );
        }
    }, [finalizarRutinaCompleta]);

    useEffect(() => {
        avanzarTrasDescansoRef.current = avanzarTrasDescanso;
    }, [avanzarTrasDescanso]);

    const handleEvaluacionGuiada = useCallback(
        ({ seqItem, datos }) => {
            const g = guiaRef.current;
            if (!g.esModoGuiado || !g.rutinaActiva || g.estadoGuia !== 'entrenando') {
                return undefined;
            }
            const ejActual = g.ejerciciosPlan[g.indiceEjercicio];
            if (!ejActual) return undefined;

            const gestoDetRaw = datos?.gesto_detectado || datos?.gesto_tecnico || seqItem?.gestoNombre;
            const esCompatible = esGestoCompatibleGuia(
                gestoDetRaw,
                ejActual.gestoObjetivo,
                g.rutinaActiva.categoria,
                ejActual.nombre,
            );

            if (!esCompatible) {
                const esperadoLbl = NOMBRES_GESTOS_GUIA[ejActual.gestoObjetivo] || 'el gesto objetivo';
                const detLbl = seqItem?.gestoNombre || 'otro gesto';
                setUltimaRepFeedback({
                    valido: false,
                    texto: `Detectado ${detLbl} · Esperado: ${esperadoLbl}`,
                });
                asistenteRef.current?.hablarTexto(
                    `Detecté ${detLbl}. Para sumar a este ejercicio ejecuta ${esperadoLbl}.`,
                );
                return { manejadoVoz: true };
            }

            const nuevasReps = g.repsActuales + 1;
            const targetReps = ejActual.repsPorSerie;
            const tipSig = construirCorreccionSiguienteRep(seqItem, ejActual.gestoObjetivo);

            guiaStatsRef.current.totalReps += 1;
            guiaStatsRef.current.scores.push(Number(seqItem?.scoreGlobal || 0));

            setInstruccionSiguiente(tipSig);
            setUltimaRepFeedback({
                valido: true,
                texto: `+1 Rep · ${seqItem.scoreGlobal}/100${seqItem.saltoCm > 0 ? ` · ${seqItem.saltoCm} cm` : ''}`,
            });

            if (nuevasReps < targetReps) {
                setRepsActuales(nuevasReps);
                asistenteRef.current?.hablarTexto(`${nuevasReps} de ${targetReps}. ${tipSig}`);
                return { manejadoVoz: true };
            }

            // Completó las repeticiones de esta serie
            if (g.serieActual < ejActual.seriesTotal) {
                const sigSerie = g.serieActual + 1;
                setRepsActuales(0);
                setSerieActual(sigSerie);
                setSegundosDescanso(ejActual.descansoSeg);
                setDescansoPausado(false);
                pendingStepRef.current = { tipo: 'next_set', serie: sigSerie };
                setEstadoGuia('descanso');
                asistenteRef.current?.hablarTexto(
                    `¡Serie ${g.serieActual} completada! Descansa ${ejActual.descansoSeg} segundos para la serie ${sigSerie}.`,
                );
                return { manejadoVoz: true };
            }

            // Completó todas las series del ejercicio actual -> marcar en Supabase
            const nuevaLista = g.ejerciciosPlan.map((it, idx) =>
                idx === g.indiceEjercicio ? { ...it, completado: true } : it,
            );
            setEjerciciosPlan(nuevaLista);
            if (ejActual.id) {
                marcarEjercicioCompletado(g.rutinaActiva.id, ejActual.id);
            }

            const nextIdx = nuevaLista.findIndex(
                (it, idx) => idx > g.indiceEjercicio && !it.completado,
            );
            const fallbackIdx =
                nextIdx >= 0 ? nextIdx : nuevaLista.findIndex((it) => !it.completado);

            if (fallbackIdx < 0) {
                finalizarRutinaCompleta();
                return { manejadoVoz: true };
            }

            const ejSig = nuevaLista[fallbackIdx];
            setSegundosDescanso(ejActual.descansoSeg);
            setDescansoPausado(false);
            pendingStepRef.current = { tipo: 'next_exercise', idx: fallbackIdx };
            setEstadoGuia('descanso');
            asistenteRef.current?.hablarTexto(
                `¡Ejercicio completado! Descansa ${ejActual.descansoSeg} segundos antes de pasar a ${ejSig.nombre}.`,
            );
            return { manejadoVoz: true };
        },
        [marcarEjercicioCompletado, finalizarRutinaCompleta],
    );

    const asistente = useAsistenteBackend({
        onEvaluacionCompletada: handleEvaluacionGuiada,
    });
    const { setGestoSeleccionado } = asistente;

    useEffect(() => {
        asistenteRef.current = asistente;
    }, [asistente]);

    // Temporizador de descanso automático en modo guiado
    useEffect(() => {
        if (!esModoGuiado || estadoGuia !== 'descanso' || descansoPausado) {
            return undefined;
        }
        const id = setInterval(() => {
            setSegundosDescanso((prev) => {
                if (prev <= 1) {
                    avanzarTrasDescansoRef.current?.();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [esModoGuiado, estadoGuia, descansoPausado]);

    // Preseleccionar gesto desde ?gesto=... cuando NO es modo guiado
    useEffect(() => {
        if (esModoGuiado) return;
        const key = `${rutinaIdParam}|${gestoParam}`;
        if (!gestoParam || prefillAplicadoRef.current === key) return;
        const gestoNorm = normalizarParamGesto(gestoParam);
        if (gestoNorm) {
            prefillAplicadoRef.current = key;
            setGestoSeleccionado(gestoNorm);
        }
    }, [esModoGuiado, rutinaIdParam, gestoParam, setGestoSeleccionado]);

    // Cargar rutina y secuencia de ejercicios desde Supabase cuando ?rutinaId=... viene en la URL
    useEffect(() => {
        let cancelado = false;
        if (!rutinaIdParam) {
            return undefined;
        }
        api('/usuario/rutinas')
            .then((lista) => {
                if (cancelado || !Array.isArray(lista)) return;
                const encontrada = lista.find((r) => String(r.id) === String(rutinaIdParam)) || null;
                setRutinaCargada(encontrada);
                if (!encontrada) return;

                const ejs = Array.isArray(encontrada.ejercicios) ? encontrada.ejercicios : [];
                const plan = ejs.map((ej) => {
                    const parsed = parsearSeriesYReps(ej.series);
                    return {
                        ...ej,
                        seriesTotal: parsed.series,
                        repsPorSerie: parsed.repsPorSerie,
                        unidad: parsed.unidad,
                        descansoSeg: parsearDescansoSeg(ej.descanso),
                        gestoObjetivo: inferirGestoObjetivoEjercicio(ej, encontrada.categoria),
                    };
                });

                let idxIni = 0;
                if (ejIdParam) {
                    const exIdx = plan.findIndex((e) => String(e.id) === String(ejIdParam));
                    if (exIdx >= 0) idxIni = exIdx;
                } else {
                    const pendIdx = plan.findIndex((e) => !e.completado);
                    idxIni = pendIdx >= 0 ? pendIdx : 0;
                }

                if (esModoGuiado) {
                    setEjerciciosPlan(plan);
                    setIndiceEjercicio(idxIni);
                    setSerieActual(1);
                    setRepsActuales(0);
                    const yaCompleta = plan.length > 0 && plan.every((e) => e.completado);
                    setEstadoGuia(yaCompleta ? 'completada' : 'entrenando');
                    const ejIni = plan[idxIni];
                    if (ejIni) {
                        setGestoSeleccionado(ejIni.gestoObjetivo);
                        setInstruccionSiguiente(
                            ejIni.enfoque ||
                                `Ejecuta ${ejIni.nombre} frente a la cámara en cuerpo completo.`,
                        );
                    }
                } else if (!gestoParam) {
                    const fallbackGesto =
                        plan[idxIni]?.gestoObjetivo || normalizarParamGesto(encontrada.categoria);
                    if (fallbackGesto) {
                        setGestoSeleccionado(fallbackGesto);
                    }
                }
            })
            .catch(() => {
                if (!cancelado) setRutinaCargada(null);
            });
        return () => {
            cancelado = true;
        };
    }, [rutinaIdParam, gestoParam, ejIdParam, esModoGuiado, setGestoSeleccionado]);

    const ejercicioObjetivo = useMemo(() => {
        const ejercicios = Array.isArray(rutinaActiva?.ejercicios) ? rutinaActiva.ejercicios : [];
        if (ejercicios.length === 0) return null;
        if (ejIdParam) {
            const exacto = ejercicios.find((e) => String(e.id) === String(ejIdParam));
            if (exacto) return exacto;
        }
        return ejercicios.find((e) => !e.completado) || ejercicios[0];
    }, [rutinaActiva, ejIdParam]);

    const gestosRealizados = asistente.historialSesion.length;

    const handleVolverARutina = async () => {
        if (!rutinaIdParam) {
            router.push('/usuario/rutinas');
            return;
        }
        setVolviendoRutina(true);
        try {
            if (
                !esModoGuiado &&
                gestosRealizados > 0 &&
                rutinaActiva?.id &&
                ejercicioObjetivo?.id &&
                !ejercicioObjetivo.completado
            ) {
                await marcarEjercicioCompletado(rutinaActiva.id, ejercicioObjetivo.id);
            }
        } finally {
            setVolviendoRutina(false);
            router.push(`/usuario/rutinas?rutinaId=${encodeURIComponent(rutinaIdParam)}`);
        }
    };

    return (
        <div className="vs-original-root">
            {/* PANEL MODO GUIADO EN VIVO O BANNER DE RUTINA */}
            {esModoGuiado && rutinaActiva ? (
                <PanelRutinaGuiada
                    rutina={rutinaActiva}
                    ejerciciosPlan={ejerciciosPlan}
                    indiceEjercicio={indiceEjercicio}
                    serieActual={serieActual}
                    repsActuales={repsActuales}
                    estadoGuia={estadoGuia}
                    segundosDescanso={segundosDescanso}
                    descansoPausado={descansoPausado}
                    instruccionSiguiente={instruccionSiguiente}
                    ultimaRepFeedback={ultimaRepFeedback}
                    camaraActiva={asistente.camaraActiva}
                    resumenFinal={resumenFinal}
                    guardandoCierre={guardandoCierre}
                    onToggleCamara={asistente.toggleCamara}
                    onTogglePausaDescanso={() => setDescansoPausado((p) => !p)}
                    onSaltarDescanso={() => avanzarTrasDescanso()}
                    onAvanzarEjercicio={() => pasarAlSiguienteEjercicio(true)}
                    onFinalizarRutina={() => finalizarRutinaCompleta()}
                    onVolverRutina={handleVolverARutina}
                />
            ) : rutinaIdParam ? (
                <div className="max-w-[1520px] mx-auto px-4 sm:px-7 pt-4">
                    <div className="rounded-2xl bg-gradient-to-r from-[#132238] via-[#152840] to-[#0f2b3c] border border-cyan-400/45 px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-[0_0_24px_rgba(16,226,247,0.12)]">
                        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                            <span className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/35 text-[#10e2f7] flex items-center justify-center shrink-0">
                                <FaDumbbell />
                            </span>

                            <div className="space-y-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-cyan-500/15 text-[#33e4fa] border border-cyan-400/30">
                                        Entrenando Rutina
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-900/80 text-slate-300 border border-slate-700">
                                        {gestosRealizados} {gestosRealizados === 1 ? 'gesto' : 'gestos'} en sesión
                                    </span>
                                    {gestosRealizados > 0 && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-400/35">
                                            <FaCheck className="text-[10px]" />
                                            Listo para guardar avance
                                        </span>
                                    )}
                                </div>

                                <p className="text-sm sm:text-base font-semibold text-white leading-snug">
                                    Entrenando Rutina:{' '}
                                    <span className="text-[#33e4fa]">
                                        {rutinaActiva?.titulo || 'Rutina Activa'}
                                    </span>{' '}
                                    — Objetivo:{' '}
                                    <span className="text-slate-200">
                                        {ejercicioObjetivo?.nombre ||
                                            `Practicar ${gestoParam || 'técnica con cámara'}`}
                                    </span>
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            disabled={volviendoRutina}
                            onClick={handleVolverARutina}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#10e2f7] hover:bg-[#49ecfc] disabled:opacity-60 text-slate-950 text-sm font-bold shadow-[0_0_18px_rgba(16,226,247,0.3)] transition cursor-pointer shrink-0"
                        >
                            <FaArrowLeft className="text-xs" />
                            {volviendoRutina
                                ? 'Guardando avance...'
                                : gestosRealizados > 0
                                  ? 'Volver a la Rutina (Guardar Avance)'
                                  : 'Volver a la Rutina'}
                        </button>
                    </div>
                </div>
            ) : null}

            {/* Módulo 1: Navbar, Hero Científico, Cámara MediaPipe, Calibración en 'T' (45f), Salto y Gesto */}
            <ModuloSuperiorLaboratorio
                videoRef={asistente.videoRef}
                canvasRef={asistente.canvasRef}
                camStatus={asistente.camStatus}
                camError={asistente.camError}
                camaraActiva={asistente.camaraActiva}
                cargandoIA={asistente.cargandoIA}
                backendConnected={asistente.backendConnected}
                usuarioId={asistente.usuarioId}
                setUsuarioId={asistente.setUsuarioId}
                gestoSeleccionado={asistente.gestoSeleccionado}
                setGestoSeleccionado={asistente.setGestoSeleccionado}
                vozActiva={asistente.vozActiva}
                calibracion={asistente.calibracion}
                live={asistente.live}
                secuenciaMostrada={asistente.secuenciaMostrada}
                fraseCoach={asistente.fraseCoach}
                secuenciaDescartadaBanner={asistente.secuenciaDescartadaBanner}
                onToggleCamara={asistente.toggleCamara}
                onToggleVoz={asistente.toggleVozCoach}
                onReiniciarBuffer={asistente.reiniciarBuffer}
                onSaltarCalibracion={asistente.saltarCalibracion}
                onFinalizarPDF={() => asistente.finalizarYExportarReporte(chartCanvasRef.current)}
            />

            <main className="vs-container">
                {/* Módulo 2 (Central 1): Línea de Tiempo de Sesión + Visor Cinemático 4 Fases & Replay 3D */}
                <ModuloCentralVisorFases
                    historialSesion={asistente.historialSesion}
                    indiceActivo={asistente.indiceActivo}
                    modoHistorico={asistente.modoHistorico}
                    alertaFatigaTecnica={asistente.alertaFatigaTecnica}
                    secuenciaMostrada={asistente.secuenciaMostrada}
                    secuenciaDescartadaBanner={asistente.secuenciaDescartadaBanner}
                    live={asistente.live}
                    backendConnected={asistente.backendConnected}
                    camaraActiva={asistente.camaraActiva}
                    onCargarHistorico={asistente.cargarSaltoHistorico}
                    onVolverAlDirecto={asistente.volverAlDirecto}
                    onDescartarAlertaFatiga={asistente.descartarAlertaFatiga}
                />

                {/* Módulo 3 (Central 2): Panel de Fatiga Neuromuscular (Gráfica Salto cm vs Ángulo Codo t0) */}
                <ModuloFatigaNeuromuscular ref={chartCanvasRef} fatigaSeries={asistente.fatigaSeries} />

                {/* Módulo 4 (Inferior): Matriz A vs B vs C + Inspector de Variables y Telemetría Cruda */}
                <ModuloInferiorValidacionInspector
                    secuenciaMostrada={asistente.secuenciaMostrada}
                    live={asistente.live}
                    fraseCoachBar={asistente.fraseCoachBar}
                    onExportarJson={asistente.exportarLogJson}
                    onRepetirAudio={asistente.repetirAudioCoach}
                />
            </main>

            {asistente.toastMsg && (
                <div className="vs-toast-notification" role="status" aria-live="polite">
                    <span className="vs-toast-icon">☁️</span>
                    <span className="vs-toast-text">{asistente.toastMsg}</span>
                </div>
            )}
        </div>
    );
}
