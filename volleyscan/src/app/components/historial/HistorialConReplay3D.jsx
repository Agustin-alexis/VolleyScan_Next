"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    FaArrowRight,
    FaClock,
    FaCube,
    FaDumbbell,
    FaRotateRight,
    FaTrashCan,
    FaVideo,
} from "react-icons/fa6";
import GemeloDigital3D from "@/app/components/analisis/GemeloDigital3D";
import { api } from "@/lib/api";
import { leerHistorialLocalUsuario } from "@/lib/historial/sesionAnalisis";

function formatearDuracion(segRaw) {
    const seg = Math.max(0, Math.round(Number(segRaw || 0)));
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} min`;
}

function formatearFechaHistorial(iso) {
    if (!iso) return "Sesión reciente";
    try {
        const dt = new Date(iso);
        if (Number.isNaN(dt.getTime())) return String(iso);
        const fechaTxt = dt.toLocaleDateString("es-CO", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
        const horaTxt = dt.toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
        });
        return `${fechaTxt} · ${horaTxt}`;
    } catch {
        return String(iso);
    }
}

function coloresPorPuntaje(scoreRaw) {
    const sc = Math.max(0, Math.min(100, Math.round(Number(scoreRaw || 0))));
    if (sc >= 80) {
        return {
            stroke: "#22d38a",
            textCls: "text-emerald-400",
            cardCls: "bg-emerald-500/10 border-emerald-500/45 text-emerald-300",
            estado: "Óptimo",
            nivel: "Óptimo",
        };
    }
    if (sc >= 60) {
        return {
            stroke: "#f59e0b",
            textCls: "text-amber-400",
            cardCls: "bg-amber-500/10 border-amber-500/45 text-amber-300",
            estado: "Bueno",
            nivel: "Intermedio",
        };
    }
    return {
        stroke: "#f43f5e",
        textCls: "text-rose-400",
        cardCls: "bg-rose-500/10 border-rose-500/45 text-rose-300",
        estado: "A mejorar",
        nivel: "Inicial",
    };
}

function traducirTextoJuvenil(raw, fallback) {
    const txt = String(raw || "").trim();
    if (!txt) return fallback;
    const lower = txt.toLowerCase();
    if (
        lower.includes("escápulo") ||
        lower.includes("escapulo") ||
        lower.includes("balística") ||
        lower.includes("balistica") ||
        lower.includes("cápsula") ||
        lower.includes("capsula") ||
        lower.includes("valgo") ||
        lower.includes("lca") ||
        lower.includes("excéntric") ||
        lower.includes("excentric") ||
        lower.includes("cinética") ||
        lower.includes("cinetica")
    ) {
        if (lower.includes("codo") || lower.includes("armado") || lower.includes("fase 2")) {
            return "Tu codo bajó un poquito al preparar el golpe. Súbelo un poco más atrás antes de rematar para alcanzar más alto.";
        }
        if (lower.includes("extensión") || lower.includes("extension") || lower.includes("contacto") || lower.includes("fase 3")) {
            return "Estira por completo el brazo arriba cuando golpees el balón para pasar la red con más potencia.";
        }
        if (lower.includes("rodilla") || lower.includes("aterrizaje") || lower.includes("caída") || lower.includes("fase 4")) {
            return "Dobla suave las rodillas apoyando ambos pies al caer para cuidar tus piernas y mantener el equilibrio.";
        }
        return "Flexiona bien las piernas antes de despegar y sube el brazo con calma para lograr un golpe más alto y firme.";
    }
    return txt;
}

function construirConsejoYEjercicio(rep) {
    const score = Math.round(Number(rep?.puntuacion ?? rep?.score ?? 0));
    const fases = rep?.fases4 || rep?.fases || {};
    const f1 = Math.round(Number(fases.fase_1?.score ?? score));
    const f2 = Math.round(Number(fases.fase_2?.score ?? score));
    const f3 = Math.round(Number(fases.fase_3?.score ?? score));
    const f4 = Math.round(Number(fases.fase_4?.score ?? score));

    const minFase = [
        { num: 1, s: f1 },
        { num: 2, s: f2 },
        { num: 3, s: f3 },
        { num: 4, s: f4 },
    ].sort((a, b) => a.s - b.s)[0];

    const fallbackMensaje =
        score >= 85
            ? "¡Gran jugada! Mantuviste buena postura, buen salto y una caída muy segura. Sigue practicando para hacerlo todavía más constante."
            : minFase.num === 1
              ? "Flexiona un poquito más las rodillas antes de saltar para despegar con mucha más fuerza."
              : minFase.num === 2
                ? "Tu codo bajó un poco al preparar el brazo. Súbelo más alto detrás de la cabeza antes de golpear."
                : minFase.num === 3
                  ? "Estira el brazo completo en el punto más alto al golpear el balón para tener mayor alcance."
                  : "Aterriza doblando suave ambas rodillas al mismo tiempo para proteger tus piernas.";

    const principalRaw =
        rep?.diagnosticoCausaRaiz ||
        rep?.correccionesEspecificas?.[0] ||
        rep?.vozCoach ||
        "";

    const explicacion = traducirTextoJuvenil(principalRaw, fallbackMensaje);

    let ejercicioSugerido =
        "Ejercicio sugerido: Practica 3 series de 8 saltos suaves cayendo con ambos pies en equilibrio.";
    if (minFase.num === 1) {
        ejercicioSugerido =
            "Ejercicio sugerido: Sentadillas con pausa corta y salto explosivo (3 series de 8 repeticiones).";
    } else if (minFase.num === 2) {
        ejercicioSugerido =
            "Ejercicio sugerido: Armado de brazo alto tipo arco y flecha frente a la pared (3 series de 10).";
    } else if (minFase.num === 3) {
        ejercicioSugerido =
            "Ejercicio sugerido: Toques altos al balón contra la pared estirando todo el brazo (3 series de 10).";
    } else if (score >= 85) {
        ejercicioSugerido =
            "Ejercicio sugerido: Repite 3 series de tu gesto manteniendo el mismo ritmo y control al caer.";
    }

    return { explicacion, ejercicioSugerido };
}

function normalizarNombreGesto(movRaw) {
    const m = String(movRaw || "remate")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    if (m.includes("saque")) return "Saque";
    if (m.includes("voleo") || m.includes("coloc")) return "Voleo";
    if (m.includes("recep") || m.includes("defen")) return "Recepción";
    if (m.includes("bloq")) return "Bloqueo";
    return "Remate";
}

function calcularScoreMatematicoDesdeFases(fases) {
    if (!fases || typeof fases !== "object") return null;
    const pesos = [
        ["fase_1", 0.2],
        ["fase_2", 0.25],
        ["fase_3", 0.35],
        ["fase_4", 0.2],
    ];
    let sumaPond = 0;
    let sumaPesos = 0;
    for (const [k, peso] of pesos) {
        const scRaw = fases[k]?.score;
        if (scRaw !== undefined && scRaw !== null && Number.isFinite(Number(scRaw))) {
            sumaPond += Number(scRaw) * peso;
            sumaPesos += peso;
        }
    }
    if (sumaPesos <= 0) return null;
    return Math.max(0, Math.min(100, Math.round(sumaPond / sumaPesos)));
}

function normalizarRepeticion(rep, idx) {
    const seq = Array.isArray(rep?.secuencia3D)
        ? rep.secuencia3D
        : Array.isArray(rep?.secuencia_landmarks_3d)
          ? rep.secuencia_landmarks_3d
          : [];
    const fases = rep?.fases4 || rep?.fases || {};
    const scoreRawNum =
        rep?.score_global ?? rep?.scoreExacto ?? rep?.puntuacion ?? rep?.score ?? rep?.puntaje ?? null;
    const scoreRaw =
        scoreRawNum !== null && scoreRawNum !== undefined && Number.isFinite(Number(scoreRawNum))
            ? Math.round(Number(scoreRawNum))
            : null;
    const scoreFases = calcularScoreMatematicoDesdeFases(fases);
    const score =
        scoreFases !== null &&
        (scoreRaw === null || scoreRaw === 0 || Math.abs(scoreRaw - scoreFases) >= 1)
            ? scoreFases
            : (scoreRaw ?? 0);
    const movimiento = String(rep?.movimiento || rep?.gesto_tecnico || "remate").toLowerCase();
    const movimientoNombre = rep?.movimientoNombre || normalizarNombreGesto(movimiento);

    return {
        ...rep,
        numero: rep?.numero ?? idx + 1,
        movimiento: movimiento === "colocacion" ? "voleo" : movimiento,
        movimientoNombre,
        puntuacion: score,
        score,
        saltoVerticalCm: Number(rep?.saltoVerticalCm ?? rep?.altura_salto_cm ?? 0),
        tiempoVueloSegundos: Number(rep?.tiempoVueloSegundos ?? rep?.tiempo_vuelo_seg ?? 0),
        diagnosticoCausaRaiz: rep?.diagnosticoCausaRaiz || rep?.diagnostico_causa_raiz || "",
        vozCoach: rep?.vozCoach || rep?.voz_coach || "",
        correccionesEspecificas: Array.isArray(rep?.correccionesEspecificas)
            ? rep.correccionesEspecificas
            : [rep?.diagnosticoCausaRaiz, rep?.vozCoach].filter(Boolean),
        fases4: fases,
        secuencia3D: seq,
        indicesFases: rep?.indicesFases ||
            rep?.indices_fases || {
                carga: 0,
                armado: Math.floor(seq.length * 0.35),
                contacto: Math.floor(seq.length * 0.65),
                caida: Math.max(0, seq.length - 1),
            },
    };
}

function normalizarSesion(ses) {
    const repsRaw = Array.isArray(ses?.repeticiones)
        ? ses.repeticiones
        : Array.isArray(ses?.gestos)
          ? ses.gestos
          : [];
    const repeticiones = repsRaw.map((r, i) => normalizarRepeticion(r, i));
    const durSeg = Number(ses?.duracionSeg ?? ses?.duracion_segundos ?? 0);
    const scoresReps = repeticiones.map((r) => Number(r.puntuacion || 0)).filter((n) => n > 0);
    const promReal = scoresReps.length
        ? Math.round(scoresReps.reduce((a, b) => a + b, 0) / scoresReps.length)
        : Math.round(Number(ses?.puntuacion ?? ses?.score ?? 0));

    return {
        ...ses,
        id: String(ses?.id || ses?.sesion_id || ""),
        creadoEn: ses?.creadoEn || ses?.creado_en || ses?.fecha || new Date().toISOString(),
        duracionSeg: durSeg,
        duracionFormateada:
            ses?.duracionFormateada || ses?.duration || formatearDuracion(durSeg),
        tecnica: String(ses?.tecnica || repeticiones[0]?.movimiento || "remate").toLowerCase(),
        puntuacion: promReal,
        repeticiones,
    };
}

function AnilloPuntajeSVG({ score, size = "sm" }) {
    const valor = Math.max(0, Math.min(100, Math.round(Number(score || 0))));
    const pal = coloresPorPuntaje(valor);
    const dim = size === "md" ? 68 : 58;
    const radius = size === "md" ? 27 : 23;
    const strokeW = size === "md" ? 5.5 : 4.5;
    const circ = 2 * Math.PI * radius;
    const dashOffset = circ * (1 - valor / 100);

    return (
        <div
            className="relative inline-flex items-center justify-center shrink-0"
            style={{ width: dim, height: dim }}
        >
            <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} className="-rotate-90">
                <circle
                    cx={dim / 2}
                    cy={dim / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(51, 65, 85, 0.55)"
                    strokeWidth={strokeW}
                />
                <circle
                    cx={dim / 2}
                    cy={dim / 2}
                    r={radius}
                    fill="none"
                    stroke={pal.stroke}
                    strokeWidth={strokeW}
                    strokeDasharray={circ}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                {size === "md" ? (
                    <span className={`text-lg font-extrabold ${pal.textCls}`}>{valor}</span>
                ) : (
                    <span className="text-[11px] font-bold text-slate-200">
                        <strong className={`text-sm font-extrabold ${pal.textCls}`}>{valor}</strong>
                        <span className="text-[10px] text-slate-400">/100</span>
                    </span>
                )}
            </div>
        </div>
    );
}

function SkeletonTresColumnas() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-[315px_minmax(0,1fr)_345px] gap-6 animate-pulse">
            <div className="rounded-2xl bg-[#11192b] border border-slate-800 p-5 h-[600px] space-y-4">
                <div className="h-6 w-40 rounded bg-slate-800" />
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-24 rounded-2xl bg-slate-800/70" />
                ))}
            </div>
            <div className="rounded-2xl bg-[#11192b] border border-slate-800 p-5 h-[600px]" />
            <div className="rounded-2xl bg-[#11192b] border border-slate-800 p-5 h-[600px] space-y-5">
                <div className="h-6 w-44 rounded bg-slate-800" />
                <div className="h-16 w-48 rounded-xl bg-slate-800/80" />
                <div className="h-44 rounded-2xl bg-slate-800/70" />
                <div className="grid grid-cols-2 gap-3">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-20 rounded-xl bg-slate-800/70" />
                    ))}
                </div>
            </div>
        </div>
    );
}

async function obtenerSesionesMerged() {
    let lista = [];
    const localesNorm = (leerHistorialLocalUsuario() || []).map(normalizarSesion);
    const mapaLocales = new Map(localesNorm.map((s) => [s.id, s]));

    try {
        const remotas = await api("/ia/analisis/sesiones");
        if (Array.isArray(remotas) && remotas.length > 0) {
            lista = remotas.map(normalizarSesion);
        } else {
            const histGen = await api("/usuario/historial");
            if (Array.isArray(histGen) && histGen.length > 0) {
                lista = histGen.map(normalizarSesion);
            }
        }
        lista = lista.map((s) => {
            const loc = mapaLocales.get(s.id);
            if (!loc) return s;
            return {
                ...s,
                repeticiones: s.repeticiones.map((r, i) => {
                    if (r.secuencia3D?.length > 0) return r;
                    const locRep = loc.repeticiones?.[i];
                    return locRep?.secuencia3D?.length > 0
                        ? {
                              ...r,
                              secuencia3D: locRep.secuencia3D,
                              indicesFases: locRep.indicesFases || r.indicesFases,
                          }
                        : r;
                }),
            };
        });
        const idsRemotos = new Set(lista.map((s) => s.id));
        for (const locSes of localesNorm) {
            if (locSes.id && !idsRemotos.has(locSes.id) && locSes.repeticiones.length > 0) {
                lista.push(locSes);
            }
        }
    } catch {
        if (localesNorm.length > 0) {
            lista = localesNorm;
        }
    }
    lista.sort((a, b) => String(b.creadoEn || "").localeCompare(String(a.creadoEn || "")));
    return lista;
}

export default function HistorialConReplay3D({
    titulo = "Historial de Entrenamientos",
    subtitulo = "Consulta tus sesiones pasadas, puntajes y visualiza la reconstrucción 3D de tus gestos.",
}) {
    const router = useRouter();
    const [sesiones, setSesiones] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [seleccionKey, setSeleccionKey] = useState(null);
    const [jumpRequest, setJumpRequest] = useState(null);
    const [confirmarEliminarSid, setConfirmarEliminarSid] = useState(null);
    const [eliminandoSid, setEliminandoSid] = useState(null);

    const cargarSesiones = useCallback(async () => {
        setCargando(true);
        const lista = await obtenerSesionesMerged();
        setSesiones(lista);
        setCargando(false);
    }, []);

    useEffect(() => {
        let cancelado = false;
        obtenerSesionesMerged()
            .then((lista) => {
                if (!cancelado) setSesiones(lista);
            })
            .finally(() => {
                if (!cancelado) setCargando(false);
            });
        return () => {
            cancelado = true;
        };
    }, []);

    // Aplanar gestos guardados de cada sesión en lista cronológica limpia
    const gestosLista = useMemo(() => {
        const items = [];
        for (const ses of sesiones) {
            const reps = Array.isArray(ses.repeticiones) ? ses.repeticiones : [];
            if (reps.length > 0) {
                reps.forEach((rep, idx) => {
                    const num = rep.numero || idx + 1;
                    items.push({
                        key: `${ses.id}::${idx}`,
                        sesionId: ses.id,
                        repIdx: idx,
                        tituloGesto: `${rep.movimientoNombre || "Remate"} #${num}`,
                        fechaLabel: formatearFechaHistorial(rep.creadoEn || ses.creadoEn),
                        duracionLabel: ses.duracionFormateada || formatearDuracion(ses.duracionSeg),
                        framesCount: Array.isArray(rep.secuencia3D) ? rep.secuencia3D.length : 0,
                        tiene3D: (rep.secuencia3D?.length || 0) > 0,
                        score: Math.round(Number(rep.puntuacion ?? rep.score ?? 0)),
                        rep,
                        sesion: ses,
                    });
                });
            } else {
                const repFallback = normalizarRepeticion(
                    {
                        movimiento: ses.tecnica,
                        puntuacion: ses.puntuacion,
                        saltoVerticalCm: ses.saltoMaximoCm,
                    },
                    0,
                );
                items.push({
                    key: `${ses.id}::0`,
                    sesionId: ses.id,
                    repIdx: 0,
                    tituloGesto: `${normalizarNombreGesto(ses.tecnica)} #1`,
                    fechaLabel: formatearFechaHistorial(ses.creadoEn),
                    duracionLabel: ses.duracionFormateada || formatearDuracion(ses.duracionSeg),
                    framesCount: 0,
                    tiene3D: false,
                    score: Math.round(Number(ses.puntuacion || 0)),
                    rep: repFallback,
                    sesion: ses,
                });
            }
        }
        return items;
    }, [sesiones]);

    const itemActivo = useMemo(() => {
        if (gestosLista.length === 0) return null;
        if (seleccionKey) {
            const match = gestosLista.find((g) => g.key === seleccionKey);
            if (match) return match;
        }
        return gestosLista[0];
    }, [gestosLista, seleccionKey]);

    const handleSeleccionarItem = (item) => {
        setSeleccionKey(item.key);
        setConfirmarEliminarSid(null);
        setJumpRequest(null);

        if (!item.tiene3D && item.sesionId) {
            api(`/ia/analisis/sesiones/${encodeURIComponent(item.sesionId)}`)
                .then((det) => {
                    if (!det) return;
                    const norm = normalizarSesion(det);
                    setSesiones((prev) => prev.map((s) => (s.id === item.sesionId ? norm : s)));
                })
                .catch(() => {});
        }
    };

    const handleEliminarSesion = async (sesionId) => {
        setEliminandoSid(sesionId);
        try {
            await api(`/ia/analisis/sesiones/${encodeURIComponent(sesionId)}`, { method: "DELETE" });
            setConfirmarEliminarSid(null);
            await cargarSesiones();
        } catch {
            setConfirmarEliminarSid(null);
        } finally {
            setEliminandoSid(null);
        }
    };

    const diagnosticoActivo = useMemo(
        () => (itemActivo ? construirConsejoYEjercicio(itemActivo.rep) : null),
        [itemActivo],
    );

    const tarjetasFases = useMemo(() => {
        if (!itemActivo?.rep) return [];
        const rep = itemActivo.rep;
        const fases = rep.fases4 || rep.fases || {};
        const seqLen = rep.secuencia3D?.length || 33;
        const idxMap = rep.indicesFases || {
            carga: 0,
            armado: Math.floor(seqLen * 0.35),
            contacto: Math.floor(seqLen * 0.65),
            caida: Math.max(0, seqLen - 1),
        };
        const scGlobal = itemActivo.score;

        return [
            {
                key: "f1",
                titulo: "Fase 1:",
                subtitulo: "Preparación",
                score: Math.round(Number(fases.fase_1?.score ?? scGlobal)),
                frameIdx: idxMap.carga ?? 0,
            },
            {
                key: "f2",
                titulo: "Fase 2:",
                subtitulo: "Salto y Armado",
                score: Math.round(Number(fases.fase_2?.score ?? scGlobal)),
                frameIdx: idxMap.armado ?? Math.floor(seqLen * 0.35),
            },
            {
                key: "f3",
                titulo: "Fase 3:",
                subtitulo: "Contacto Crítico",
                score: Math.round(Number(fases.fase_3?.score ?? scGlobal)),
                frameIdx: idxMap.contacto ?? Math.floor(seqLen * 0.65),
            },
            {
                key: "f4",
                titulo: "Fase 4:",
                subtitulo: "Finalización / Caída",
                score: Math.round(Number(fases.fase_4?.score ?? scGlobal)),
                frameIdx: idxMap.caida ?? Math.max(0, seqLen - 1),
            },
        ];
    }, [itemActivo]);

    return (
        <div className="min-h-screen w-full bg-[#0c1322] text-slate-100">
            <div className="w-full max-w-7xl mx-auto px-6 py-8 overflow-x-hidden space-y-6">
                {/* 1. ENCABEZADO LIMPIO */}
                <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                            {titulo}
                        </h1>
                        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                            {subtitulo}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={() => router.push("/usuario/analisis")}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#10e2f7] hover:bg-[#49ecfc] text-slate-950 text-sm font-bold shadow-[0_0_24px_rgba(16,226,247,0.35)] transition cursor-pointer"
                        >
                            <FaVideo className="text-sm" />
                            Nueva Sesión IA
                        </button>

                        <button
                            type="button"
                            disabled={cargando}
                            onClick={cargarSesiones}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#162032] hover:bg-[#1e2c44] disabled:opacity-60 border border-slate-700/80 text-slate-200 text-sm font-semibold transition cursor-pointer"
                        >
                            <FaRotateRight className={cargando ? "animate-spin text-xs" : "text-xs"} />
                            Actualizar
                        </button>
                    </div>
                </header>

                {/* CONTENIDO PRINCIPAL */}
                {cargando ? (
                    <SkeletonTresColumnas />
                ) : gestosLista.length === 0 || !itemActivo ? (
                    /* ESTADO VACÍO LIMPIO Y CENTRADO */
                    <section className="max-w-xl mx-auto rounded-3xl bg-[#162032] border border-slate-700/60 p-8 sm:p-10 text-center space-y-5 mt-6 shadow-xl">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-[#10e2f7] text-2xl">
                            <FaCube />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl sm:text-2xl font-bold text-white">
                                Aún no tienes entrenamientos guardados
                            </h2>
                            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                                Graba tu primer salto, remate o saque en Análisis IA para ver aquí la reconstrucción 3D de tu cuerpo y los consejos de tu entrenador.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => router.push("/usuario/analisis")}
                            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-[#10e2f7] hover:bg-[#49ecfc] text-slate-950 text-base font-bold shadow-[0_0_24px_rgba(16,226,247,0.35)] transition cursor-pointer"
                        >
                            <FaVideo />
                            Hacer mi primer análisis IA
                        </button>
                    </section>
                ) : (
                    /* MAQUETACIÓN DE 3 COLUMNAS */
                    <main className="grid grid-cols-1 lg:grid-cols-[315px_minmax(0,1fr)_345px] xl:grid-cols-[335px_minmax(0,1fr)_365px] gap-6 items-stretch">
                        {/* 2. COLUMNA IZQUIERDA: SESIONES RECIENTES */}
                        <section
                            className="rounded-2xl bg-[#11192b] border border-slate-800/90 p-5 flex flex-col gap-4 lg:h-[620px] shadow-xl min-w-0"
                            aria-label="Sesiones Recientes"
                        >
                            <div className="flex items-center justify-between gap-2 shrink-0">
                                <h2 className="text-lg font-bold text-white">Sesiones Recientes</h2>
                                <span className="px-2.5 py-0.5 rounded-full bg-slate-800/90 text-xs font-semibold text-slate-300 border border-slate-700/70">
                                    {gestosLista.length}
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
                                {gestosLista.map((item) => {
                                    const activo = item.key === itemActivo.key;
                                    const enConfirm = confirmarEliminarSid === item.sesionId;

                                    return (
                                        <div
                                            key={item.key}
                                            className={`group rounded-2xl border p-4 transition-all ${
                                                activo
                                                    ? "border-cyan-400/70 bg-slate-800/90 shadow-[0_0_20px_rgba(16,226,247,0.12)]"
                                                    : "bg-slate-900/70 hover:bg-slate-800/80 border-slate-700/60"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSeleccionarItem(item)}
                                                    className="flex-1 text-left min-w-0 space-y-1.5 bg-transparent border-0 p-0 appearance-none cursor-pointer"
                                                >
                                                    <h3 className="text-base font-bold text-white leading-snug truncate">
                                                        {item.tituloGesto}
                                                    </h3>
                                                    <p className="text-xs text-slate-400 truncate">
                                                        {item.fechaLabel}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
                                                        <span className="inline-flex items-center gap-1 text-slate-300">
                                                            <FaClock className="text-slate-400 text-[11px]" />
                                                            {item.duracionLabel}
                                                        </span>
                                                        <span className="px-2.5 py-0.5 rounded-full bg-slate-800/95 border border-slate-700/70 text-[11px] font-medium text-slate-300">
                                                            {item.framesCount} frames
                                                        </span>
                                                    </div>
                                                </button>

                                                <div className="flex flex-col items-center gap-1.5 shrink-0 bg-transparent">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSeleccionarItem(item)}
                                                        aria-label={`Abrir ${item.tituloGesto}`}
                                                        className="bg-transparent border-0 p-0 appearance-none cursor-pointer"
                                                    >
                                                        <AnilloPuntajeSVG score={item.score} size="sm" />
                                                    </button>

                                                    {!enConfirm ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setConfirmarEliminarSid(item.sesionId)
                                                            }
                                                            aria-label="Eliminar sesión"
                                                            title="Eliminar sesión"
                                                            className="bg-transparent border-0 p-1 rounded-lg appearance-none opacity-65 group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 text-xs transition cursor-pointer"
                                                        >
                                                            <FaTrashCan />
                                                        </button>
                                                    ) : (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                disabled={eliminandoSid === item.sesionId}
                                                                onClick={() =>
                                                                    handleEliminarSesion(item.sesionId)
                                                                }
                                                                className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
                                                            >
                                                                {eliminandoSid === item.sesionId ? "..." : "Borrar"}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setConfirmarEliminarSid(null)}
                                                                className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 text-[10px] cursor-pointer"
                                                            >
                                                                No
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* 3. COLUMNA CENTRAL: RECONSTRUCCIÓN 3D TEMPORAL */}
                        <div className="min-w-0 lg:min-h-[620px] flex flex-col">
                            <GemeloDigital3D
                                variant="historial"
                                rep={itemActivo.rep}
                                jumpRequest={jumpRequest}
                                indicesFases={itemActivo.rep?.indicesFases}
                            />
                        </div>

                        {/* 4. COLUMNA DERECHA: DIAGNÓSTICO DE LA IA */}
                        <section
                            className="rounded-2xl bg-[#11192b] border border-slate-800/90 p-5 flex flex-col justify-between gap-4 lg:min-h-[620px] shadow-xl min-w-0"
                            aria-label="Diagnóstico de la IA"
                        >
                            <div className="space-y-4">
                                <h2 className="text-lg font-bold text-white">Diagnóstico de la IA</h2>

                                {/* PUNTAJE GLOBAL + NIVEL */}
                                {(() => {
                                    const pal = coloresPorPuntaje(itemActivo.score);
                                    return (
                                        <div className="flex items-center gap-4">
                                            <AnilloPuntajeSVG score={itemActivo.score} size="md" />
                                            <div>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-3xl font-extrabold text-white">
                                                        {itemActivo.score}
                                                    </span>
                                                    <span className="text-sm font-medium text-slate-400">
                                                        /100
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium text-slate-300">
                                                    Nivel {pal.nivel}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* BLOQUE CENTRAL: LO MÁS IMPORTANTE */}
                                {diagnosticoActivo && (
                                    <div className="rounded-2xl bg-[#182235] border border-slate-700/60 p-4 space-y-3">
                                        <h3 className="text-sm font-bold text-white">
                                            Lo más importante
                                        </h3>

                                        <p className="text-sm text-slate-200 leading-relaxed">
                                            {diagnosticoActivo.explicacion}
                                        </p>

                                        <div className="pt-2 border-t border-slate-700/60 space-y-2">
                                            <p className="text-xs text-slate-300 leading-relaxed">
                                                {diagnosticoActivo.ejercicioSugerido}
                                            </p>
                                            <Link
                                                href="/usuario/rutinas"
                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#33e4fa] hover:text-[#7ff0ff] transition"
                                            >
                                                <FaDumbbell className="text-[11px]" />
                                                <span>Ejercicios sugeridos</span>
                                                <FaArrowRight className="text-[10px]" />
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* CUADRÍCULA 2x2: LAS 4 FASES BIOMECÁNICAS */}
                            <div className="grid grid-cols-2 gap-3 pt-1">
                                {tarjetasFases.map((f) => {
                                    const pal = coloresPorPuntaje(f.score);
                                    return (
                                        <button
                                            key={f.key}
                                            type="button"
                                            onClick={() =>
                                                setJumpRequest({
                                                    frameIdx: f.frameIdx,
                                                    ts: Date.now(),
                                                })
                                            }
                                            title="Ver esta fase en el muñeco 3D"
                                            className={`rounded-xl border p-3.5 text-center space-y-0.5 transition hover:brightness-110 cursor-pointer ${pal.cardCls}`}
                                        >
                                            <div className="text-xs font-bold text-white leading-tight">
                                                {f.titulo}
                                            </div>
                                            <div className="text-xs font-semibold text-slate-200 leading-tight">
                                                {f.subtitulo}
                                            </div>
                                            <div className={`text-xs font-bold pt-1 ${pal.textCls}`}>
                                                ({f.score}% {pal.estado})
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    </main>
                )}
            </div>
        </div>
    );
}
