"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Chart from "chart.js/auto";
import {
    FaArrowRight,
    FaBullseye,
    FaCamera,
    FaCheck,
    FaClock,
    FaTriangleExclamation,
} from "react-icons/fa6";
import { api } from "@/lib/api";
import { leerHistorialLocalUsuario } from "@/lib/historial/sesionAnalisis";

const FILTROS_PERIODO = [
    { label: "7 días", apiValue: "Últimos 7 días" },
    { label: "30 días", apiValue: "Últimos 30 días" },
    { label: "Todo", apiValue: "Todo el historial" },
];

const ORDEN_GESTOS = [
    { key: "remate", label: "Remate" },
    { key: "saque", label: "Saque" },
    { key: "voleo", label: "Voleo" },
    { key: "bloqueo", label: "Bloqueo" },
    { key: "recepcion", label: "Recepción" },
];

function traducirTipJuvenil(txtRaw, fallback) {
    const txt = String(txtRaw || "").trim();
    if (!txt) return fallback;
    if (/escápulo|escapulo|balística|balistica|cápsula|capsula|lca|valgo|excéntric|cinética|desviaciones críticas/i.test(txt)) {
        if (txt.toLowerCase().includes("codo") || txt.toLowerCase().includes("armado")) {
            return "Intenta subir un poco más el codo al armar el brazo antes del remate para ganar mayor potencia.";
        }
        if (txt.toLowerCase().includes("rodilla") || txt.toLowerCase().includes("caída")) {
            return "Dobla suave ambas rodillas al aterrizar para caer con equilibrio y cuidar tus piernas.";
        }
        return "Practica con calma la postura de tus brazos y piernas en tus rutinas recomendadas para subir tu puntaje.";
    }
    return txt;
}

function formatearEtiquetaFechaCorta(item, idx) {
    const iso = String(item?.fecha_iso || "");
    if (iso.length >= 10 && iso.includes("-")) {
        const mm = iso.slice(5, 7);
        const dd = iso.slice(8, 10);
        return `${dd}/${mm}`;
    }
    const etq = String(item?.etiqueta || "");
    const m = etq.match(/(\d{2})-(\d{2})/);
    if (m) return `${m[2]}/${m[1]}`;
    return `S${idx + 1}`;
}

function construirFallbackLocalDesdeSesiones(sesiones, periodoApi) {
    const ahora = Date.now();
    const limiteDias = periodoApi.includes("7") ? 7 : periodoApi.includes("30") ? 30 : 36500;
    const filtradas = (sesiones || []).filter((s) => {
        const ts = new Date(s.creadoEn || 0).getTime();
        if (!Number.isFinite(ts) || ts <= 0) return true;
        return (ahora - ts) / (1000 * 60 * 60 * 24) <= limiteDias;
    });

    if (filtradas.length === 0) {
        return {
            tiene_datos: false,
            total_sesiones: 0,
            analisis_realizados: 0,
            tiempo_total_seg: 0,
            tiempo_entrenando: "0m",
            puntuacion_promedio: 0,
            mejora_total_pct: 0,
            salto_maximo_cm: 0,
            salto_promedio_cm: 0,
            evolucion_salto: [],
            rendimiento_por_tecnica: ORDEN_GESTOS.map((g) => ({
                tecnica: g.key,
                name: g.label,
                valor: 0,
                total: 0,
            })),
            fortalezas: [],
            areas_mejora: [],
        };
    }

    const cron = [...filtradas].sort(
        (a, b) => new Date(a.creadoEn || 0).getTime() - new Date(b.creadoEn || 0).getTime(),
    );
    const tiempoTotalSeg = cron.reduce((acc, s) => acc + Number(s.duracionSeg || 0), 0);
    const repsAll = cron.flatMap((s) => s.repeticiones || []);
    const scores = repsAll.map((r) => Number(r.puntuacion || r.score || 0)).filter((n) => n > 0);
    const saltos = repsAll.map((r) => Number(r.saltoVerticalCm || 0)).filter((n) => n > 0);

    const agrupado = { remate: [], saque: [], voleo: [], bloqueo: [], recepcion: [] };
    const evolucionSalto = cron.map((s, idx) => {
        const reps = s.repeticiones || [];
        const saltosS = reps.map((r) => Number(r.saltoVerticalCm || 0)).filter((n) => n > 0);
        for (const r of reps) {
            const tec = String(r.movimiento || s.tecnica || "remate").toLowerCase();
            const k = tec === "colocacion" ? "voleo" : agrupado[tec] ? tec : "remate";
            const sc = Number(r.puntuacion || r.score || 0);
            if (sc > 0) agrupado[k].push(sc);
        }
        return {
            etiqueta: `S${idx + 1}`,
            fecha_iso: String(s.creadoEn || ""),
            salto_maximo_cm: saltosS.length ? Number(Math.max(...saltosS).toFixed(1)) : 0,
            salto_promedio_cm: saltosS.length
                ? Number((saltosS.reduce((a, b) => a + b, 0) / saltosS.length).toFixed(1))
                : 0,
        };
    });

    const resumenTec = ORDEN_GESTOS.map((g) => {
        const vals = agrupado[g.key];
        const prom = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
        return { tecnica: g.key, name: g.label, valor: prom, total: vals.length };
    });

    const horas = Math.floor(tiempoTotalSeg / 3600);
    const mins = Math.floor((tiempoTotalSeg % 3600) / 60);
    const tiempoTxt = horas > 0 ? `${horas}h ${mins}m` : `${Math.max(1, mins)}m`;

    return {
        tiene_datos: true,
        total_sesiones: cron.length,
        analisis_realizados: repsAll.length,
        tiempo_total_seg: tiempoTotalSeg,
        tiempo_entrenando: tiempoTxt,
        puntuacion_promedio: scores.length
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0,
        mejora_total_pct: scores.length >= 2 ? Math.round(scores[scores.length - 1] - scores[0]) : 0,
        salto_maximo_cm: saltos.length ? Number(Math.max(...saltos).toFixed(1)) : 0,
        salto_promedio_cm: saltos.length
            ? Number((saltos.reduce((a, b) => a + b, 0) / saltos.length).toFixed(1))
            : 0,
        evolucion_salto: evolucionSalto,
        rendimiento_por_tecnica: resumenTec,
        fortalezas: resumenTec
            .filter((t) => t.total > 0 && t.valor >= 80)
            .map((t) => ({
                titulo: `Muy buena técnica en ${t.name}`,
                detalle: `Alcanzaste ${t.valor}% de efectividad promedio. ¡Sigue así!`,
            })),
        areas_mejora: resumenTec
            .filter((t) => t.total > 0 && t.valor < 80)
            .map((t) => ({
                titulo: `Practicar un poco más ${t.name}`,
                detalle: `Hoy estás en ${t.valor}%. Con unas rutinas rápidas subirás muy pronto.`,
            })),
    };
}

export default function ProgresoPage() {
    const router = useRouter();
    const [periodo, setPeriodo] = useState(FILTROS_PERIODO[1]);
    const [respuesta, setRespuesta] = useState({ periodoKey: "", data: null });

    const saltoCanvasRef = useRef(null);

    useEffect(() => {
        let cancelado = false;
        const apiParam = periodo.apiValue;

        api("/usuario/progreso", { params: { periodo: apiParam } })
            .then((res) => {
                if (!cancelado) {
                    setRespuesta({ periodoKey: apiParam, data: res });
                }
            })
            .catch(() => {
                if (!cancelado) {
                    const locales = leerHistorialLocalUsuario();
                    setRespuesta({
                        periodoKey: apiParam,
                        data: construirFallbackLocalDesdeSesiones(locales, apiParam),
                    });
                }
            });

        return () => {
            cancelado = true;
        };
    }, [periodo]);

    const cargando = respuesta.periodoKey !== periodo.apiValue;
    const progreso = useMemo(
        () => respuesta.data || construirFallbackLocalDesdeSesiones([], periodo.apiValue),
        [respuesta.data, periodo.apiValue],
    );

    const barrasGestos = useMemo(() => {
        const rawList = Array.isArray(progreso.rendimiento_por_tecnica)
            ? progreso.rendimiento_por_tecnica
            : [];
        const mapa = new Map(rawList.map((t) => [String(t.tecnica || "").toLowerCase(), t]));
        return ORDEN_GESTOS.map((g) => {
            const match = mapa.get(g.key);
            const valor = Math.max(0, Math.min(100, Math.round(Number(match?.valor || 0))));
            let barCls = "bg-slate-600";
            if (valor >= 85) barCls = "bg-gradient-to-r from-emerald-500 to-teal-300";
            else if (valor >= 80) barCls = "bg-gradient-to-r from-cyan-500 to-[#10e2f7]";
            else if (valor > 0) barCls = "bg-gradient-to-r from-amber-500 to-orange-400";
            return {
                key: g.key,
                label: g.label,
                valor,
                total: Number(match?.total || 0),
                barCls,
            };
        });
    }, [progreso.rendimiento_por_tecnica]);

    // Gráfica suave de línea + área "Evolución de Salto Vertical (cm)"
    useEffect(() => {
        const canvas = saltoCanvasRef.current;
        if (!canvas || !progreso.tiene_datos) return undefined;
        const serieRaw = Array.isArray(progreso.evolucion_salto) ? progreso.evolucion_salto : [];
        if (serieRaw.length === 0) return undefined;

        const serie =
            serieRaw.length === 1
                ? [serieRaw[0], { ...serieRaw[0], etiqueta: "Actual" }]
                : serieRaw;

        const ctx = canvas.getContext("2d");
        const grad = ctx.createLinearGradient(0, 0, 0, 260);
        grad.addColorStop(0, "rgba(16, 226, 247, 0.36)");
        grad.addColorStop(0.7, "rgba(16, 226, 247, 0.08)");
        grad.addColorStop(1, "rgba(16, 226, 247, 0)");

        const chart = new Chart(ctx, {
            type: "line",
            data: {
                labels: serie.map((item, idx) => formatearEtiquetaFechaCorta(item, idx)),
                datasets: [
                    {
                        label: "Altura de Salto",
                        data: serie.map((s) => Number(s.salto_maximo_cm || 0)),
                        borderColor: "#22e5f9",
                        borderWidth: 3,
                        backgroundColor: grad,
                        fill: true,
                        tension: 0.42,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: "#67e8f9",
                        pointBorderColor: "#0c1322",
                        pointBorderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "#0f172a",
                        borderColor: "rgba(16, 226, 247, 0.4)",
                        borderWidth: 1,
                        callbacks: {
                            label: (itemCtx) => `Salto: ${itemCtx.parsed.y} cm`,
                        },
                    },
                },
                scales: {
                    x: {
                        ticks: { color: "#94a3b8", font: { size: 11 } },
                        grid: { display: false },
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: "#94a3b8",
                            font: { size: 11 },
                            callback: (val) => `${val}`,
                        },
                        grid: { color: "rgba(148, 163, 184, 0.1)" },
                    },
                },
            },
        });

        return () => chart.destroy();
    }, [progreso]);

    const textoFortaleza = useMemo(() => {
        if (progreso.fortalezas?.length > 0) {
            return progreso.fortalezas
                .slice(0, 2)
                .map((f) => traducirTipJuvenil(f.detalle || f.titulo, ""))
                .filter(Boolean)
                .join(" ");
        }
        if (progreso.salto_maximo_cm > 0) {
            return `¡Buen trabajo! Ya alcanzaste ${progreso.salto_maximo_cm} cm de salto máximo. Sigue entrenando para subir aún más.`;
        }
        return "A medida que practiques tus gestos con la cámara verás aquí lo que mejor haces.";
    }, [progreso]);

    const textoMejora = useMemo(() => {
        if (progreso.areas_mejora?.length > 0) {
            const first = progreso.areas_mejora[0];
            return traducirTipJuvenil(
                first.detalle || first.titulo,
                "Prueba nuestras rutinas recomendadas para pulir tu brazo y ganar más altura en el salto.",
            );
        }
        return "¡Vas muy parejo en todos tus gestos! Sigue practicando rutinas de agilidad y salto para mantener el ritmo.";
    }, [progreso]);

    const tiempoFormateado = useMemo(() => {
        const seg = Number(progreso.tiempo_total_seg || 0);
        if (seg >= 3600) return `${Math.round(seg / 3600)}h`;
        return progreso.tiempo_entrenando || "0m";
    }, [progreso.tiempo_total_seg, progreso.tiempo_entrenando]);

    return (
        <div className="min-h-full w-full bg-[#0c1322] text-slate-100">
            <div className="w-full max-w-6xl mx-auto px-6 py-8 overflow-x-hidden space-y-6">
                {/* ENCABEZADO + PILLS DE PERIODO */}
                <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                            Progreso y Estadísticas
                        </h1>
                        <p className="text-sm sm:text-base text-slate-300">
                            Analiza tu evolución, precisión de gestos y tiempo de entrenamiento.
                        </p>
                    </div>

                    <div
                        className="inline-flex items-center gap-1 p-1 rounded-full bg-[#162032] border border-slate-700/70 shrink-0 self-start md:self-auto"
                        role="tablist"
                        aria-label="Filtrar periodo de progreso"
                    >
                        {FILTROS_PERIODO.map((f) => {
                            const activo = periodo.label === f.label;
                            return (
                                <button
                                    key={f.label}
                                    type="button"
                                    role="tab"
                                    aria-selected={activo}
                                    onClick={() => setPeriodo(f)}
                                    className={`px-4 py-1.5 rounded-full text-sm transition cursor-pointer ${
                                        activo
                                            ? "bg-[#10e2f7] text-slate-950 font-bold shadow-[0_0_14px_rgba(16,226,247,0.3)]"
                                            : "text-slate-300 hover:text-white font-medium"
                                    }`}
                                >
                                    {f.label}
                                </button>
                            );
                        })}
                    </div>
                </header>

                {cargando ? (
                    <div className="space-y-6 animate-pulse">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {[0, 1, 2, 3].map((i) => (
                                <div key={i} className="h-28 rounded-2xl bg-[#162032] border border-slate-800" />
                            ))}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="h-72 rounded-2xl bg-[#162032] border border-slate-800" />
                            <div className="h-72 rounded-2xl bg-[#162032] border border-slate-800" />
                        </div>
                    </div>
                ) : !progreso.tiene_datos ? (
                    <section className="max-w-xl mx-auto rounded-3xl bg-[#162032] border border-slate-700/60 p-8 sm:p-10 text-center space-y-5 mt-6 shadow-xl">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-[#10e2f7] text-2xl">
                            <FaBullseye />
                        </div>
                        <h2 className="text-xl font-bold text-white">
                            Aún no tienes estadísticas en este periodo
                        </h2>
                        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                            Graba tu primera jugada en Análisis IA para ver tu altura de salto y precisión por cada gesto de voleibol.
                        </p>
                        <button
                            type="button"
                            onClick={() => router.push("/usuario/analisis")}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#10e2f7] hover:bg-[#49ecfc] text-slate-950 font-bold text-sm shadow-[0_0_24px_rgba(16,226,247,0.35)] transition cursor-pointer"
                        >
                            <FaCamera />
                            Comenzar Análisis IA
                        </button>
                    </section>
                ) : (
                    <>
                        {/* 4 TARJETAS KPI */}
                        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {/* Salto Máximo */}
                            <article className="rounded-2xl bg-[#162032] border border-slate-700/50 p-5 flex items-center justify-between gap-3 shadow-lg">
                                <div className="min-w-0 space-y-1.5">
                                    <p className="text-xs font-medium text-slate-300">Salto Máximo</p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-2xl sm:text-3xl font-extrabold text-white">
                                            {progreso.salto_maximo_cm} cm
                                        </span>
                                        {progreso.salto_promedio_cm > 0 && (
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-bold">
                                                prom {progreso.salto_promedio_cm} cm
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <svg viewBox="0 0 36 36" fill="none" className="w-10 h-10 text-emerald-400 shrink-0" aria-hidden="true">
                                    <circle cx="18" cy="7" r="3" fill="currentColor" />
                                    <path d="M12 7c2 3 4.5 4.5 6 5l6-4.5M18 12v8l-4 6M18 20l4.5 4-1.5 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </article>

                            {/* Precisión Técnica */}
                            <article className="rounded-2xl bg-[#162032] border border-slate-700/50 p-5 flex items-center justify-between gap-3 shadow-lg">
                                <div className="min-w-0 space-y-1.5">
                                    <p className="text-xs font-medium text-slate-300">Precisión Técnica</p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-2xl sm:text-3xl font-extrabold text-white">
                                            {progreso.puntuacion_promedio}%
                                        </span>
                                        {progreso.mejora_total_pct !== 0 && (
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                                    progreso.mejora_total_pct > 0
                                                        ? "bg-emerald-500/15 text-emerald-300"
                                                        : "bg-amber-500/15 text-amber-300"
                                                }`}
                                            >
                                                {progreso.mejora_total_pct > 0
                                                    ? `▲ +${progreso.mejora_total_pct}%`
                                                    : `${progreso.mejora_total_pct}%`}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <FaBullseye className="text-3xl text-cyan-400 shrink-0" />
                            </article>

                            {/* Tiempo Entrenado */}
                            <article className="rounded-2xl bg-[#162032] border border-slate-700/50 p-5 flex items-center justify-between gap-3 shadow-lg">
                                <div className="min-w-0 space-y-1.5">
                                    <p className="text-xs font-medium text-slate-300">Tiempo Entrenado</p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-2xl sm:text-3xl font-extrabold text-white">
                                            {tiempoFormateado}
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-semibold">
                                            {progreso.total_sesiones}{" "}
                                            {progreso.total_sesiones === 1 ? "sesión" : "sesiones"}
                                        </span>
                                    </div>
                                </div>
                                <FaClock className="text-3xl text-slate-400 shrink-0" />
                            </article>

                            {/* Gestos Totales */}
                            <article className="rounded-2xl bg-[#162032] border border-slate-700/50 p-5 flex items-center justify-between gap-3 shadow-lg">
                                <div className="min-w-0 space-y-1.5">
                                    <p className="text-xs font-medium text-slate-300">Gestos Totales</p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-2xl sm:text-3xl font-extrabold text-white">
                                            {progreso.analisis_realizados}
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-semibold">
                                            {periodo.label}
                                        </span>
                                    </div>
                                </div>
                                <svg viewBox="0 0 36 36" fill="none" className="w-10 h-10 text-cyan-400 shrink-0" aria-hidden="true">
                                    <circle cx="20" cy="8.5" r="3" fill="currentColor" />
                                    <path d="M18 12.5l-5.5 4.5 3.5 5.5-4.5 5M18 13l5 5.5 4.5 2M15 22.5l6.5 1.5 2 5.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                                    <circle cx="9.5" cy="14" r="2.6" stroke="currentColor" strokeWidth="1.8" />
                                </svg>
                            </article>
                        </section>

                        {/* 2 GRÁFICAS REALES LADO A LADO */}
                        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                            {/* IZQUIERDA: EVOLUCIÓN DE SALTO VERTICAL (CM) */}
                            <article className="rounded-2xl bg-[#162032] border border-slate-700/50 p-6 flex flex-col justify-between gap-4 shadow-lg">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h2 className="text-lg font-bold text-white">
                                        Evolución de Salto Vertical (cm)
                                    </h2>
                                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#22e5f9] shadow-[0_0_8px_#22e5f9]" />
                                        Altura de Salto
                                    </span>
                                </div>

                                <div className="h-64 relative">
                                    <canvas ref={saltoCanvasRef} />
                                </div>
                            </article>

                            {/* DERECHA: PRECISIÓN POR GESTO (BARRAS HORIZONTALES) */}
                            <article className="rounded-2xl bg-[#162032] border border-slate-700/50 p-6 flex flex-col justify-between gap-5 shadow-lg">
                                <h2 className="text-lg font-bold text-white">Precisión por Gesto</h2>

                                <div className="space-y-4 my-auto">
                                    {barrasGestos.map((g) => (
                                        <div key={g.key} className="flex items-center gap-4">
                                            <span className="w-24 text-sm font-medium text-slate-200 shrink-0">
                                                {g.label}
                                            </span>

                                            <div className="flex-1 h-5 rounded-full bg-slate-800/80 overflow-hidden relative">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2.5 ${g.barCls}`}
                                                    style={{ width: `${Math.max(g.valor > 0 ? 18 : 0, g.valor)}%` }}
                                                >
                                                    {g.valor > 0 && (
                                                        <span className="text-xs font-extrabold text-slate-950">
                                                            {g.valor}%
                                                        </span>
                                                    )}
                                                </div>
                                                {g.valor === 0 && (
                                                    <span className="absolute inset-y-0 left-3 flex items-center text-[11px] text-slate-400">
                                                        Sin datos aún
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </article>
                        </section>

                        {/* ABAJO: TUS FORTALEZAS Y QUÉ MEJORAR */}
                        <section className="rounded-2xl bg-[#162032] border border-slate-700/50 p-6 space-y-5 shadow-lg">
                            <h2 className="text-lg font-bold text-white">
                                Tus Fortalezas y Qué Mejorar
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Fortalezas */}
                                <div className="flex items-start gap-4">
                                    <span className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                                        <FaCheck />
                                    </span>
                                    <div className="space-y-1">
                                        <h3 className="text-base font-bold text-white">
                                            Tus Fortalezas
                                        </h3>
                                        <p className="text-sm text-slate-300 leading-relaxed">
                                            {textoFortaleza}
                                        </p>
                                    </div>
                                </div>

                                {/* Qué Mejorar */}
                                <div className="flex items-start gap-4">
                                    <span className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                                        <FaTriangleExclamation />
                                    </span>
                                    <div className="space-y-2">
                                        <h3 className="text-base font-bold text-white">
                                            Qué Mejorar
                                        </h3>
                                        <p className="text-sm text-slate-300 leading-relaxed">
                                            {textoMejora}
                                        </p>
                                        <Link
                                            href="/usuario/rutinas"
                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#33e4fa] hover:text-[#7ff0ff] transition"
                                        >
                                            <span>Practicar en Rutinas</span>
                                            <FaArrowRight className="text-[10px]" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
