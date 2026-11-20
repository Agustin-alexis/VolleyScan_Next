"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    FaArrowRotateRight,
    FaCamera,
    FaCheck,
    FaChevronLeft,
    FaClock,
    FaFire,
    FaLock,
    FaPause,
    FaPlay,
    FaRotateLeft,
    FaVideo,
    FaWandMagicSparkles,
} from "react-icons/fa6";
import { api } from "@/lib/api";

const FILTROS_RUTINAS = [
    { key: "todas", label: "Todas" },
    { key: "ia", label: "Plan IA" },
    { key: "remate", label: "Saque y Remate" },
    { key: "salto_vertical", label: "Salto Vertical" },
    { key: "recepcion", label: "Recepción" },
    { key: "voleo", label: "Voleo" },
    { key: "movilidad", label: "Movilidad" },
];

const TEMAS_CATEGORIA = {
    remate: {
        iconoBg: "bg-[#123534] border-emerald-500/30 text-emerald-400",
        barraCls: "bg-gradient-to-r from-emerald-500 to-teal-300",
        glowHover: "hover:border-emerald-400/45",
        tipoIcono: "remate",
    },
    salto_vertical: {
        iconoBg: "bg-[#2e2320] border-amber-500/30 text-amber-400",
        barraCls: "bg-gradient-to-r from-amber-500 to-orange-300",
        glowHover: "hover:border-amber-400/45",
        tipoIcono: "salto",
    },
    pliometria: {
        iconoBg: "bg-[#2e2320] border-amber-500/30 text-amber-400",
        barraCls: "bg-gradient-to-r from-amber-500 to-orange-300",
        glowHover: "hover:border-amber-400/45",
        tipoIcono: "salto",
    },
    recepcion: {
        iconoBg: "bg-[#112f42] border-cyan-400/30 text-[#10e2f7]",
        barraCls:
            "bg-gradient-to-r from-cyan-500 to-[#10e2f7] shadow-[0_0_12px_rgba(16,226,247,0.4)]",
        glowHover: "hover:border-cyan-400/50",
        tipoIcono: "recepcion",
    },
    defensa: {
        iconoBg: "bg-[#112f42] border-cyan-400/30 text-[#10e2f7]",
        barraCls:
            "bg-gradient-to-r from-cyan-500 to-[#10e2f7] shadow-[0_0_12px_rgba(16,226,247,0.4)]",
        glowHover: "hover:border-cyan-400/50",
        tipoIcono: "recepcion",
    },
    saque: {
        iconoBg: "bg-[#152847] border-sky-400/30 text-sky-400",
        barraCls: "bg-gradient-to-r from-sky-500 to-cyan-300",
        glowHover: "hover:border-sky-400/45",
        tipoIcono: "saque",
    },
    voleo: {
        iconoBg: "bg-[#222246] border-indigo-400/30 text-indigo-300",
        barraCls: "bg-gradient-to-r from-indigo-400 to-cyan-400",
        glowHover: "hover:border-indigo-400/45",
        tipoIcono: "voleo",
    },
    movilidad: {
        iconoBg: "bg-[#14303a] border-teal-400/30 text-teal-300",
        barraCls: "bg-gradient-to-r from-teal-400 to-emerald-400",
        glowHover: "hover:border-teal-400/45",
        tipoIcono: "movilidad",
    },
};

function temaDeRutina(rutina) {
    const cat = String(rutina?.categoria || "").toLowerCase();
    if (TEMAS_CATEGORIA[cat]) return TEMAS_CATEGORIA[cat];
    if (rutina?.tipo === "ia") return TEMAS_CATEGORIA.recepcion;
    return TEMAS_CATEGORIA.remate;
}

function badgeNivel(nivelRaw) {
    const n = String(nivelRaw || "Intermedio").toLowerCase();
    if (n.includes("bás") || n.includes("bas") || n.includes("principiante") || n.includes("todos")) {
        return {
            label: "Principiante",
            cls: "bg-[#123548] text-[#33e4fa] border-cyan-400/35",
        };
    }
    if (n.includes("avanzado")) {
        return {
            label: "Avanzado",
            cls: "bg-[#2e2426] text-[#e7a97e] border-amber-500/35",
        };
    }
    return {
        label: "Intermedio",
        cls: "bg-[#133331] text-[#3fe0a8] border-emerald-500/35",
    };
}

function acortarTituloTarjeta(tituloRaw) {
    const limpio = String(tituloRaw || "Rutina de Voleibol")
        .replace(/^Plan\s+(Correctivo|Recomendado)\s*(IA)?:\s*/i, "")
        .trim();
    if (limpio.length <= 44) return limpio;
    const primeraParte = limpio.split(":")[0]?.trim();
    if (primeraParte && primeraParte.length >= 12 && primeraParte.length <= 42) {
        return primeraParte;
    }
    return `${limpio.slice(0, 41).trim()}...`;
}

function formatearTituloHero(rutina) {
    const cat = String(rutina?.categoria || "").toLowerCase();
    const raw = String(rutina?.titulo || "").trim();
    if (rutina?.tipo === "ia" || raw.length > 52) {
        if (cat === "remate") return "Plan Recomendado: Mejora tu Remate y Altura de Brazo";
        if (cat === "salto_vertical" || cat === "pliometria") {
            return "Plan Recomendado: Mejora tu Salto Vertical y Potencia";
        }
        if (cat === "saque") return "Plan Recomendado: Saque Más Firme y Preciso";
        if (cat === "voleo") return "Plan Recomendado: Voleo Alto y Control de Dedos";
        if (cat === "recepcion" || cat === "defensa") {
            return "Plan Recomendado: Agilidad y Recepción Segura";
        }
    }
    const corto = acortarTituloTarjeta(raw);
    return corto.toLowerCase().startsWith("plan") ? corto : `Plan Recomendado: ${corto}`;
}

function estimarCalorias(rutina) {
    if (Number.isFinite(Number(rutina?.calorias)) && Number(rutina.calorias) > 0) {
        return Math.round(Number(rutina.calorias));
    }
    if (
        Number.isFinite(Number(rutina?.calorias_estimadas)) &&
        Number(rutina.calorias_estimadas) > 0
    ) {
        return Math.round(Number(rutina.calorias_estimadas));
    }
    const mins = Math.max(10, Number(rutina?.duracion_min) || 20);
    const cat = String(rutina?.categoria || "").toLowerCase();
    let factor = 6.2;
    if (cat === "salto_vertical" || cat === "pliometria") factor = 7.5;
    else if (cat === "remate") factor = 7.0;
    else if (cat === "movilidad") factor = 4.2;
    else if (cat === "recepcion" || cat === "defensa") factor = 5.6;
    return Math.round((mins * factor) / 5) * 5;
}

function calcularProgresoRutina(rutina) {
    const ejercicios = Array.isArray(rutina?.ejercicios) ? rutina.ejercicios : [];
    const total = ejercicios.length;
    const completados = ejercicios.filter((e) => Boolean(e.completado)).length;
    const rawPct =
        rutina?.progreso_pct !== undefined && rutina?.progreso_pct !== null
            ? Number(rutina.progreso_pct)
            : total
              ? Math.round((completados / total) * 100)
              : 0;
    const pct = Math.max(0, Math.min(100, Math.round(rawPct)));
    return { total, completados, pct };
}

function formatearSegundos(segTotal) {
    const seguro = Math.max(0, Math.floor(Number(segTotal) || 0));
    const mins = String(Math.floor(seguro / 60)).padStart(2, "0");
    const segs = String(seguro % 60).padStart(2, "0");
    return `${mins}:${segs}`;
}

function IconoDeportivo({ tipo, className = "w-7 h-7" }) {
    if (tipo === "salto") {
        return (
            <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
                <circle cx="18" cy="7" r="3" fill="currentColor" />
                <path
                    d="M11 6c2 3.5 5 5 7 5.5l6.5-5"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M18 12v8l-4.5 6.5M18 20l5 4.5-1.5 5.5"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        );
    }
    if (tipo === "recepcion") {
        return (
            <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
                <circle cx="20" cy="8.5" r="3" fill="currentColor" />
                <path
                    d="M18 12.5l-5.5 4.5 3.5 5.5-4.5 5M18 13l5 5.5 4.5 2M15 22.5l6.5 1.5 2 5.5"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <circle cx="9.5" cy="14" r="2.6" stroke="currentColor" strokeWidth="1.8" />
            </svg>
        );
    }
    if (tipo === "saque") {
        return (
            <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
                <circle cx="17" cy="9" r="3" fill="currentColor" />
                <circle cx="25.5" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.8" />
                <path
                    d="M16.5 12.5l6-4M16.5 13l-5 4.5M16.5 13v8l-4 7M16.5 21l4.5 7"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        );
    }
    if (tipo === "voleo") {
        return (
            <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
                <circle cx="18" cy="7.5" r="3.4" stroke="currentColor" strokeWidth="1.9" />
                <circle cx="18" cy="16" r="2.8" fill="currentColor" />
                <path
                    d="M11 12.5l4-2M25 12.5l-4-2M18 19v6.5l-4.5 4.5M18 25.5l4.5 4.5"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        );
    }
    if (tipo === "movilidad") {
        return (
            <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
                <circle cx="18" cy="8.5" r="3" fill="currentColor" />
                <path
                    d="M9 17.5c3.5-2.8 6-3.8 9-3.8s5.5 1 9 3.8M18 14v8M18 22l-5 7M18 22l5 7"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        );
    }
    return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
            <circle cx="18" cy="11" r="2.8" fill="currentColor" />
            <circle cx="27" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.8" />
            <path
                d="M10.5 12c2.5 3.5 5 5 7.5 5l5.5-4.5M18 17v7l-4.5 5.5M18 24l4.5 5.5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function VolleyHeroIllustration() {
    return (
        <svg
            viewBox="0 0 320 220"
            fill="none"
            className="w-full h-full select-none"
            aria-hidden="true"
        >
            <defs>
                <radialGradient id="heroGlow" cx="55%" cy="48%" r="50%">
                    <stop offset="0%" stopColor="#10e2f7" stopOpacity="0.28" />
                    <stop offset="65%" stopColor="#0ea5e9" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="bodySuit" x1="120" y1="55" x2="210" y2="195" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#193449" />
                    <stop offset="100%" stopColor="#0e1b2d" />
                </linearGradient>
                <linearGradient id="ballBlue" x1="205" y1="14" x2="235" y2="44" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#fde047" />
                    <stop offset="55%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
            </defs>

            <circle cx="172" cy="108" r="96" fill="url(#heroGlow)" />

            <g stroke="#22d3ee" strokeOpacity="0.45" strokeWidth="1.15">
                <line x1="78" y1="88" x2="112" y2="54" />
                <line x1="112" y1="54" x2="148" y2="80" />
                <line x1="148" y1="80" x2="114" y2="128" />
                <line x1="114" y1="128" x2="78" y2="88" />
                <line x1="78" y1="88" x2="148" y2="80" />
                <line x1="148" y1="80" x2="196" y2="62" />
                <line x1="196" y1="62" x2="246" y2="48" />
                <line x1="246" y1="48" x2="256" y2="96" />
                <line x1="256" y1="96" x2="210" y2="132" />
                <line x1="210" y1="132" x2="168" y2="178" />
                <line x1="168" y1="178" x2="114" y2="128" />
                <line x1="196" y1="62" x2="210" y2="132" />
                <line x1="148" y1="80" x2="210" y2="132" />
            </g>

            {[
                [78, 88],
                [112, 54],
                [148, 80],
                [114, 128],
                [196, 62],
                [246, 48],
                [256, 96],
                [210, 132],
                [168, 178],
            ].map(([cx, cy], idx) => (
                <g key={idx}>
                    <circle cx={cx} cy={cy} r="5" fill="#10e2f7" fillOpacity="0.2" />
                    <circle cx={cx} cy={cy} r="2.6" fill="#67e8f9" />
                </g>
            ))}

            <g strokeLinecap="round" strokeLinejoin="round">
                <path
                    d="M150 86 L120 74 L92 52"
                    stroke="#67e8f9"
                    strokeWidth="6"
                    strokeOpacity="0.9"
                />
                <path d="M178 82 L212 62 L216 38" stroke="#38bdf8" strokeWidth="6.5" />
                <path
                    d="M148 80 L182 78 L174 128 L142 126 Z"
                    fill="url(#bodySuit)"
                    stroke="#22d3ee"
                    strokeWidth="2"
                />
                <circle cx="171" cy="59" r="10.5" fill="#0f2336" stroke="#67e8f9" strokeWidth="2" />
                <path d="M148 126 L134 158 L156 184" stroke="#22d3ee" strokeWidth="7.5" />
                <path d="M170 126 L194 150 L182 192" stroke="#10e2f7" strokeWidth="7.5" />
                <circle cx="134" cy="158" r="4.5" fill="#0f172a" stroke="#67e8f9" strokeWidth="2" />
                <circle cx="194" cy="150" r="4.5" fill="#0f172a" stroke="#67e8f9" strokeWidth="2" />
            </g>

            <g transform="translate(220, 26)">
                <circle cx="0" cy="0" r="16" fill="url(#ballBlue)" stroke="#f8fafc" strokeWidth="1.5" />
                <path
                    d="M-13 -6 C-4 -2 4 -2 13 -6 M-13 6 C-4 2 4 2 13 6 M0 -15 C4 -5 4 5 0 15"
                    stroke="#0f172a"
                    strokeWidth="1.5"
                    strokeOpacity="0.65"
                />
            </g>
        </svg>
    );
}

function SkeletonRutinas() {
    return (
        <div className="space-y-8 animate-pulse">
            <div className="rounded-3xl bg-[#162032] border border-slate-800 p-8 h-56" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                        key={i}
                        className="rounded-2xl bg-[#162032] border border-slate-800 p-6 space-y-5"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-slate-800 shrink-0" />
                            <div className="h-6 w-4/5 rounded bg-slate-800" />
                        </div>
                        <div className="h-6 w-28 rounded-full bg-slate-800" />
                        <div className="h-4 w-44 rounded bg-slate-800/80" />
                        <div className="h-2.5 w-full rounded-full bg-slate-800" />
                    </div>
                ))}
            </div>
        </div>
    );
}

function VistaEjecucionRutina({
    rutina,
    ocupadoKey,
    onVolver,
    onAbrirAsistenteIa,
    onToggleEjercicio,
    onFinalizarRutina,
}) {
    const [duracionBase, setDuracionBase] = useState(45);
    const [segundosRestantes, setSegundosRestantes] = useState(45);
    const [timerActivo, setTimerActivo] = useState(false);

    useEffect(() => {
        if (!timerActivo) return undefined;
        const id = setInterval(() => {
            setSegundosRestantes((prev) => {
                if (prev <= 1) {
                    setTimerActivo(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [timerActivo]);

    const ejercicios = Array.isArray(rutina?.ejercicios) ? rutina.ejercicios : [];
    const { total, completados, pct } = calcularProgresoRutina(rutina);
    const primerPendienteIdx = ejercicios.findIndex((e) => !e.completado);
    const ejActualObjetivo =
        primerPendienteIdx >= 0 ? ejercicios[primerPendienteIdx] : ejercicios[0] || null;

    const elegirPresetDescanso = (seg) => {
        setTimerActivo(false);
        setDuracionBase(seg);
        setSegundosRestantes(seg);
    };

    const reiniciarTimer = () => {
        setTimerActivo(false);
        setSegundosRestantes(duracionBase);
    };

    return (
        <div className="space-y-6">
            {/* CABECERA SUPERIOR: VOLVER + TÍTULO */}
            <header className="flex flex-wrap items-center gap-4">
                <button
                    type="button"
                    onClick={onVolver}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#27364c] hover:bg-[#31445f] text-white text-sm font-semibold transition cursor-pointer shrink-0"
                >
                    <FaChevronLeft className="text-xs" />
                    Volver
                </button>

                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white min-w-0">
                    Ejecutando Rutina: {acortarTituloTarjeta(rutina.titulo)}
                </h1>
            </header>

            {/* FILA SUPERIOR DE ESTADO + BOTÓN ASISTENTE IA EN VIVO */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_310px] gap-6 items-center">
                <div className="rounded-2xl bg-[#162032] border border-slate-700/60 p-5 shadow-lg">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm mb-3">
                        <span className="font-bold text-white">Progreso de la sesión</span>
                        <span className="text-slate-300 font-medium">
                            {completados}/{total} ejercicios completados{" "}
                            <strong className="text-emerald-400 font-bold">({pct}%)</strong>
                        </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-800/95 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-all duration-300"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => onAbrirAsistenteIa(rutina, ejActualObjetivo)}
                    className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-full bg-[#10e2f7] hover:bg-[#49ecfc] text-slate-950 text-base font-bold shadow-[0_0_28px_rgba(16,226,247,0.45)] transition cursor-pointer"
                >
                    <span>Iniciar con IA Guiada</span>
                    <FaVideo className="text-base shrink-0" />
                </button>
            </div>

            {/* CUERPO PRINCIPAL */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_310px] gap-6 items-start">
                {/* COLUMNA IZQUIERDA: EJERCICIOS */}
                <div className="space-y-4 min-w-0">
                    {rutina.error_detectado && (
                        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 px-5 py-3.5 text-sm text-amber-200 leading-relaxed flex flex-wrap items-center justify-between gap-2">
                            <span>
                                <strong className="text-amber-300 mr-1.5">Tip de tu Coach:</strong>
                                {rutina.error_detectado}
                            </span>
                            {rutina.dato_secundario && (
                                <span className="px-2.5 py-0.5 rounded-full bg-slate-900/80 border border-slate-700 text-xs text-slate-400">
                                    {rutina.dato_secundario}
                                </span>
                            )}
                        </div>
                    )}

                    {ejercicios.map((ej, idx) => {
                        const done = Boolean(ej.completado);
                        const esSiguiente = !done && idx === primerPendienteIdx;
                        const toggling = ocupadoKey === `ej_${rutina.id}_${ej.id}`;

                        if (done) {
                            return (
                                <div
                                    key={ej.id}
                                    onClick={() =>
                                        !toggling && onToggleEjercicio(rutina.id, ej.id, done)
                                    }
                                    role="checkbox"
                                    aria-checked="true"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            if (!toggling) onToggleEjercicio(rutina.id, ej.id, done);
                                        }
                                    }}
                                    className="rounded-2xl bg-[#151f30] border border-slate-700/50 p-5 flex items-center justify-between gap-4 transition hover:bg-[#192539] cursor-pointer"
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <span className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center shrink-0">
                                            <FaCheck className="text-base" />
                                        </span>
                                        <div className="space-y-1.5 min-w-0">
                                            <h2 className="text-base sm:text-lg font-semibold text-slate-400">
                                                {ej.nombre}
                                            </h2>
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/70">
                                                    <FaClock className="text-slate-400" />
                                                    {ej.series}
                                                </span>
                                                {ej.descanso && (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/70">
                                                        <FaClock className="text-slate-400" />
                                                        Descanso: {ej.descanso}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 shrink-0">
                                        Completado
                                        <FaCheck className="text-xs" />
                                    </span>
                                </div>
                            );
                        }

                        if (esSiguiente) {
                            return (
                                <div
                                    key={ej.id}
                                    className="rounded-2xl bg-[#162336] border-2 border-[#2dd4e4] p-5 sm:p-6 shadow-[0_0_26px_rgba(16,226,247,0.14)] flex items-start gap-4"
                                >
                                    <button
                                        type="button"
                                        disabled={toggling}
                                        onClick={() => onToggleEjercicio(rutina.id, ej.id, done)}
                                        aria-label={`Marcar como completado: ${ej.nombre}`}
                                        className="mt-1 w-10 h-10 rounded-full border-2 border-[#35e5fa] bg-slate-950/40 hover:bg-cyan-500/15 flex items-center justify-center shrink-0 transition cursor-pointer"
                                    />

                                    <div className="flex-1 space-y-3 min-w-0">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <h2 className="text-lg sm:text-xl font-bold text-white leading-snug">
                                                {ej.nombre}
                                            </h2>
                                            <span className="px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300 text-xs font-semibold shrink-0">
                                                Siguiente Ejercicio
                                            </span>
                                        </div>

                                        <p className="text-sm text-slate-200 leading-relaxed">
                                            {ej.enfoque ||
                                                "Realiza este ejercicio con postura firme y movimientos suaves."}
                                        </p>

                                        <div className="flex flex-wrap items-center gap-3 pt-1">
                                            <button
                                                type="button"
                                                disabled={toggling}
                                                onClick={() =>
                                                    onToggleEjercicio(rutina.id, ej.id, done)
                                                }
                                                className="px-5 py-2 rounded-full bg-[#10e2f7] hover:bg-[#49ecfc] disabled:opacity-60 text-slate-950 text-sm font-bold shadow-[0_0_16px_rgba(16,226,247,0.3)] transition cursor-pointer"
                                            >
                                                {toggling ? "Guardando..." : "Completar Ejercicio"}
                                            </button>

                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-200">
                                                <FaClock className="text-cyan-400" />
                                                {ej.series}
                                            </span>

                                            {ej.descanso && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
                                                    Descanso: {ej.descanso}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={ej.id}
                                onClick={() =>
                                    !toggling && onToggleEjercicio(rutina.id, ej.id, done)
                                }
                                role="checkbox"
                                aria-checked="false"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        if (!toggling) onToggleEjercicio(rutina.id, ej.id, done);
                                    }
                                }}
                                className="rounded-2xl bg-[#131b2c] hover:bg-[#172135] border border-slate-800 p-5 flex items-center justify-between gap-4 transition cursor-pointer"
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <span className="w-10 h-10 rounded-xl bg-slate-800/70 border border-slate-700/60 text-slate-500 flex items-center justify-center shrink-0">
                                        <FaLock className="text-sm" />
                                    </span>

                                    <div className="space-y-1.5 min-w-0">
                                        <h2 className="text-base sm:text-lg font-semibold text-slate-300">
                                            {ej.nombre}
                                        </h2>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                            <span className="inline-flex items-center gap-1.5">
                                                <FaClock />
                                                {ej.series}
                                            </span>
                                            {ej.descanso && <span>· Descanso {ej.descanso}</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                    <span className="px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/35 text-sky-300 text-xs font-semibold">
                                        {ej.series}
                                    </span>
                                    <span className="px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-slate-300 text-xs font-medium">
                                        Por hacer
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* COLUMNA DERECHA: TEMPORIZADOR DE DESCANSO + FINALIZAR RUTINA */}
                <aside className="space-y-5 min-w-0">
                    <div className="rounded-2xl bg-[#162032] border border-slate-700/60 p-6 sm:p-7 flex flex-col items-center text-center space-y-5 shadow-xl">
                        <h2 className="text-lg font-bold text-white leading-snug">
                            Temporizador de
                            <br />
                            Descanso
                        </h2>

                        <div className="text-5xl font-extrabold tracking-tight text-white tabular-nums drop-shadow-[0_0_22px_rgba(16,226,247,0.35)]">
                            {formatearSegundos(segundosRestantes)}
                        </div>

                        {segundosRestantes === 0 && (
                            <p className="text-xs font-semibold text-emerald-400">
                                ¡Listo! Seguimos con el próximo ejercicio
                            </p>
                        )}

                        <div className="flex items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    if (segundosRestantes === 0) setSegundosRestantes(duracionBase);
                                    setTimerActivo(true);
                                }}
                                aria-label="Iniciar temporizador"
                                className={`w-11 h-11 rounded-full flex items-center justify-center transition cursor-pointer ${
                                    timerActivo
                                        ? "bg-[#10e2f7] text-slate-950 shadow-[0_0_16px_rgba(16,226,247,0.4)]"
                                        : "bg-[#2a384f] hover:bg-[#354662] text-white"
                                }`}
                            >
                                <FaPlay className="text-sm ml-0.5" />
                            </button>

                            <button
                                type="button"
                                onClick={() => setTimerActivo(false)}
                                aria-label="Pausar temporizador"
                                className={`w-11 h-11 rounded-full flex items-center justify-center transition cursor-pointer ${
                                    !timerActivo && segundosRestantes !== duracionBase
                                        ? "bg-[#3d4d66] text-white ring-1 ring-slate-400/40"
                                        : "bg-[#2a384f] hover:bg-[#354662] text-white"
                                }`}
                            >
                                <FaPause className="text-sm" />
                            </button>

                            <button
                                type="button"
                                onClick={reiniciarTimer}
                                aria-label="Reiniciar temporizador"
                                className="w-11 h-11 rounded-full bg-[#2a384f] hover:bg-[#354662] text-white flex items-center justify-center transition cursor-pointer"
                            >
                                <FaArrowRotateRight className="text-sm" />
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                            {[30, 45, 60, 90].map((seg) => (
                                <button
                                    key={seg}
                                    type="button"
                                    onClick={() => elegirPresetDescanso(seg)}
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                                        duracionBase === seg
                                            ? "bg-cyan-500/15 border-cyan-400/50 text-cyan-300"
                                            : "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200"
                                    }`}
                                >
                                    {seg}s
                                </button>
                            ))}
                        </div>
                    </div>

                    {rutina.estado !== "completada" ? (
                        <button
                            type="button"
                            disabled={ocupadoKey === `end_${rutina.id}`}
                            onClick={() => onFinalizarRutina(rutina.id, true)}
                            className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-[#24d882] hover:bg-[#3fe798] disabled:opacity-60 text-slate-950 text-base sm:text-lg font-bold shadow-[0_0_24px_rgba(36,216,130,0.3)] transition cursor-pointer"
                        >
                            {ocupadoKey === `end_${rutina.id}`
                                ? "Guardando..."
                                : "Finalizar Rutina"}
                        </button>
                    ) : (
                        <div className="space-y-3">
                            <div className="rounded-2xl bg-emerald-500/15 border border-emerald-400/40 p-4 text-center text-sm font-semibold text-emerald-300">
                                ¡Excelente trabajo! Rutina guardada como completada.
                            </div>
                            <button
                                type="button"
                                disabled={ocupadoKey === `end_${rutina.id}`}
                                onClick={() => onFinalizarRutina(rutina.id, false)}
                                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-sm font-semibold transition cursor-pointer"
                            >
                                <FaRotateLeft />
                                Volver a practicar esta rutina
                            </button>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}

function RutinasContenido() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const rutinaParamId = searchParams.get("rutinaId") || "";

    const [rutinas, setRutinas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [filtro, setFiltro] = useState("todas");
    const [seleccion, setSeleccion] = useState({ param: null, id: undefined });
    const [ocupadoKey, setOcupadoKey] = useState(null);
    const [generando, setGenerando] = useState(false);

    const emitirCambioNotifs = () => {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("notificaciones:cambio"));
        }
    };

    const cargarRutinas = useCallback(async () => {
        setCargando(true);
        try {
            const lista = await api("/usuario/rutinas");
            setRutinas(Array.isArray(lista) ? lista : []);
        } catch {
            setRutinas([]);
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        let cancelado = false;
        api("/usuario/rutinas")
            .then((lista) => {
                if (!cancelado) setRutinas(Array.isArray(lista) ? lista : []);
            })
            .catch(() => {
                if (!cancelado) setRutinas([]);
            })
            .finally(() => {
                if (!cancelado) setCargando(false);
            });
        return () => {
            cancelado = true;
        };
    }, []);

    const rutinaActivaId = useMemo(() => {
        if (seleccion.param === rutinaParamId) {
            return seleccion.id === undefined ? rutinaParamId || null : seleccion.id;
        }
        if (rutinaParamId) return rutinaParamId;
        return seleccion.id ?? null;
    }, [seleccion, rutinaParamId]);

    const rutinasIa = useMemo(() => rutinas.filter((r) => r.tipo === "ia"), [rutinas]);

    const heroRutina = useMemo(() => {
        if (rutinasIa.length > 0) {
            return rutinasIa.find((r) => r.estado !== "completada") || rutinasIa[0];
        }
        return rutinas.find((r) => r.estado !== "completada") || rutinas[0] || null;
    }, [rutinas, rutinasIa]);

    const rutinasGrid = useMemo(() => {
        if (filtro === "ia") return rutinasIa;
        if (filtro === "todas") {
            if (rutinasIa.length > 0 && heroRutina && rutinas.length > 1) {
                return rutinas.filter((r) => r.id !== heroRutina.id);
            }
            return rutinas;
        }
        return rutinas.filter((r) => {
            const cat = String(r.categoria || "").toLowerCase();
            if (filtro === "remate") return cat === "remate" || cat === "saque";
            if (filtro === "salto_vertical") return cat === "salto_vertical" || cat === "pliometria";
            if (filtro === "recepcion") return cat === "recepcion" || cat === "defensa";
            return cat === filtro;
        });
    }, [rutinas, rutinasIa, heroRutina, filtro]);

    const rutinaDetalle = useMemo(() => {
        if (!rutinaActivaId) return null;
        return rutinas.find((r) => r.id === rutinaActivaId) ?? null;
    }, [rutinas, rutinaActivaId]);

    const actualizarRutina = (rutinaActualizada) => {
        if (!rutinaActualizada?.id) return;
        setRutinas((prev) => {
            const existe = prev.some((r) => r.id === rutinaActualizada.id);
            if (!existe) return [rutinaActualizada, ...prev];
            return prev.map((r) => (r.id === rutinaActualizada.id ? rutinaActualizada : r));
        });
    };

    const handleRecalcularIa = async () => {
        setGenerando(true);
        try {
            const nueva = await api("/usuario/rutinas", { method: "POST", body: {} });
            if (nueva?.id) {
                actualizarRutina(nueva);
                emitirCambioNotifs();
            }
            await cargarRutinas();
        } catch {
            /* ignore */
        } finally {
            setGenerando(false);
        }
    };

    const handleAbrirRutina = async (rutina) => {
        if (!rutina?.id) return;
        setSeleccion({ param: rutinaParamId, id: rutina.id });
        if (rutina.estado === "disponible") {
            setOcupadoKey(`start_${rutina.id}`);
            try {
                const res = await api(`/usuario/rutinas/${encodeURIComponent(rutina.id)}/iniciar`, {
                    method: "POST",
                });
                actualizarRutina(res);
                emitirCambioNotifs();
            } catch {
                /* el usuario aún puede ver los ejercicios */
            } finally {
                setOcupadoKey(null);
            }
        }
    };

    const handleFinalizarRutina = async (id, completada) => {
        setOcupadoKey(`end_${id}`);
        try {
            const res = await api(`/usuario/rutinas/${encodeURIComponent(id)}/completar`, {
                method: "PUT",
                body: { completada },
            });
            actualizarRutina(res);
            emitirCambioNotifs();
        } catch {
            /* ignore */
        } finally {
            setOcupadoKey(null);
        }
    };

    const handleToggleEjercicio = async (rutinaId, ejId, actualCompletado) => {
        setOcupadoKey(`ej_${rutinaId}_${ejId}`);
        try {
            const res = await api(
                `/usuario/rutinas/${encodeURIComponent(rutinaId)}/ejercicios/${encodeURIComponent(ejId)}/completar`,
                {
                    method: "PUT",
                    body: { completado: !actualCompletado },
                },
            );
            if (res?.rutina) {
                actualizarRutina(res.rutina);
                emitirCambioNotifs();
            }
        } catch {
            /* ignore */
        } finally {
            setOcupadoKey(null);
        }
    };

    const handleAbrirAsistenteIa = async (rutina, ejercicioObjetivo = null) => {
        if (!rutina?.id) return;
        if (rutina.estado === "disponible") {
            try {
                await api(`/usuario/rutinas/${encodeURIComponent(rutina.id)}/iniciar`, {
                    method: "POST",
                });
                emitirCambioNotifs();
            } catch {
                /* navegar igualmente al modo guiado */
            }
        }
        const params = new URLSearchParams({
            rutinaId: String(rutina.id),
            modo: "guiado",
        });
        if (ejercicioObjetivo?.id) {
            params.set("ejId", String(ejercicioObjetivo.id));
        }
        router.push(`/usuario/analisis?${params.toString()}`);
    };

    return (
        <div className="min-h-screen w-full bg-[#0c1322] text-slate-100">
            <div className="w-full max-w-6xl mx-auto px-6 py-8 overflow-x-hidden">
                {rutinaDetalle ? (
                    <VistaEjecucionRutina
                        key={rutinaDetalle.id}
                        rutina={rutinaDetalle}
                        ocupadoKey={ocupadoKey}
                        onVolver={() => {
                            setSeleccion({ param: rutinaParamId, id: null });
                            if (rutinaParamId) {
                                router.replace("/usuario/rutinas");
                            }
                        }}
                        onAbrirAsistenteIa={handleAbrirAsistenteIa}
                        onToggleEjercicio={handleToggleEjercicio}
                        onFinalizarRutina={handleFinalizarRutina}
                    />
                ) : (
                    <>
                        {/* TÍTULO PRINCIPAL */}
                        <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                                Rutinas de Entrenamiento
                            </h1>

                            <button
                                type="button"
                                disabled={generando}
                                onClick={handleRecalcularIa}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#162032] hover:bg-[#1c2940] disabled:opacity-60 border border-slate-700/70 text-cyan-300 text-sm font-semibold transition cursor-pointer"
                            >
                                <FaWandMagicSparkles className="text-xs" />
                                {generando ? "Actualizando plan..." : "Actualizar Plan IA"}
                            </button>
                        </header>

                        {cargando ? (
                            <SkeletonRutinas />
                        ) : (
                            <>
                                {/* 1. HERO BANNER SUPERIOR */}
                                <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#182336] via-[#1a273c] to-[#112a3a] border border-slate-700/60 p-8 mb-8 shadow-xl">
                                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                                        <div className="flex-1 space-y-4 min-w-0 z-10">
                                            {heroRutina ? (
                                                <>
                                                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight max-w-xl">
                                                        {formatearTituloHero(heroRutina)}
                                                    </h2>

                                                    <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-lg">
                                                        {rutinasIa.length > 0
                                                            ? "Basado en tu análisis de IA más reciente."
                                                            : "Elegido por tu Coach para subir tu nivel hoy."}
                                                    </p>

                                                    <div className="flex flex-wrap items-center gap-3 pt-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAbrirRutina(heroRutina)}
                                                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold bg-[#10e2f7] hover:bg-[#47ecfc] text-slate-950 text-base shadow-[0_0_24px_rgba(16,226,247,0.35)] transition cursor-pointer"
                                                        >
                                                            Iniciar Rutina
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleAbrirAsistenteIa(heroRutina)}
                                                            className="inline-flex items-center gap-2 px-5 py-3 rounded-full font-semibold bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/50 text-[#33e4fa] text-sm transition cursor-pointer"
                                                        >
                                                            <FaVideo className="text-xs" />
                                                            Modo Guiado IA
                                                        </button>

                                                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/75 border border-slate-700/80 text-slate-200 text-sm font-medium">
                                                            <FaClock className="text-slate-300" />
                                                            {heroRutina.duracion_min} min
                                                        </span>

                                                        <span
                                                            className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold border ${
                                                                badgeNivel(heroRutina.nivel).cls
                                                            }`}
                                                        >
                                                            {badgeNivel(heroRutina.nivel).label}
                                                        </span>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight max-w-xl">
                                                        Plan Recomendado: Despierta tu Salto y Técnica
                                                    </h2>
                                                    <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-lg">
                                                        Graba tu primer remate o salto en Análisis IA para crear tu plan ideal.
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-4 pt-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => router.push("/usuario/analisis")}
                                                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold bg-[#10e2f7] hover:bg-[#47ecfc] text-slate-950 text-base shadow-[0_0_24px_rgba(16,226,247,0.35)] transition cursor-pointer"
                                                        >
                                                            <FaCamera />
                                                            Iniciar Análisis IA
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="w-60 sm:w-64 md:w-72 h-44 sm:h-48 shrink-0 hidden sm:flex items-center justify-center z-10">
                                            <VolleyHeroIllustration />
                                        </div>
                                    </div>
                                </section>

                                {/* BARRA DE FILTROS CON AIRE */}
                                <nav
                                    aria-label="Filtrar rutinas"
                                    className="my-6 flex flex-wrap items-center gap-3"
                                >
                                    {FILTROS_RUTINAS.map((item) => {
                                        const activo = filtro === item.key;
                                        return (
                                            <button
                                                key={item.key}
                                                type="button"
                                                onClick={() => setFiltro(item.key)}
                                                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition cursor-pointer ${
                                                    activo
                                                        ? "bg-[#10e2f7]/15 border-[#10e2f7]/65 text-[#33e4fa] shadow-[0_0_14px_rgba(16,226,247,0.16)]"
                                                        : "bg-[#162032] border-slate-700/70 text-slate-300 hover:text-white hover:border-slate-500"
                                                }`}
                                            >
                                                {item.label}
                                            </button>
                                        );
                                    })}
                                </nav>

                                {/* 2. CUADRÍCULA DE RUTINAS (3 COLUMNAS) */}
                                {rutinasGrid.length === 0 ? (
                                    <div className="max-w-xl mx-auto rounded-2xl bg-[#162032] border border-slate-700/60 p-8 md:p-10 text-center space-y-5 mt-4">
                                        <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-[#10e2f7] text-2xl">
                                            <FaWandMagicSparkles />
                                        </div>
                                        <h3 className="text-xl font-bold text-white">
                                            {filtro === "ia"
                                                ? "Aún no tienes rutinas IA personalizadas"
                                                : "No hay rutinas en este filtro"}
                                        </h3>
                                        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                                            {filtro === "ia"
                                                ? "Haz un análisis rápido con tu cámara para que detectemos cómo ayudarte a saltar más alto o rematar más fuerte."
                                                : "Prueba eligiendo otro filtro para ver tus rutinas disponibles."}
                                        </p>
                                        <div className="flex flex-wrap justify-center gap-3">
                                            {filtro === "ia" ? (
                                                <button
                                                    type="button"
                                                    onClick={() => router.push("/usuario/analisis")}
                                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#10e2f7] hover:bg-[#47ecfc] text-slate-950 text-sm font-bold transition cursor-pointer"
                                                >
                                                    <FaCamera />
                                                    Ir a Análisis IA
                                                </button>
                                            ) : null}
                                            <button
                                                type="button"
                                                onClick={() => setFiltro("todas")}
                                                className="px-5 py-3 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold transition cursor-pointer"
                                            >
                                                Ver todas las rutinas
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {rutinasGrid.map((rutina) => {
                                            const tema = temaDeRutina(rutina);
                                            const nivel = badgeNivel(rutina.nivel);
                                            const calorias = estimarCalorias(rutina);
                                            const { pct } = calcularProgresoRutina(rutina);
                                            const esCompletada =
                                                rutina.estado === "completada" || pct === 100;
                                            const esPorIniciar =
                                                rutina.estado === "disponible" && pct === 0;

                                            return (
                                                <div
                                                    key={rutina.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => handleAbrirRutina(rutina)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.preventDefault();
                                                            handleAbrirRutina(rutina);
                                                        }
                                                    }}
                                                    className={`group text-left rounded-2xl bg-[#162032] hover:bg-[#1b273d] border border-slate-700/50 ${tema.glowHover} p-6 flex flex-col justify-between gap-4 shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer`}
                                                >
                                                    <div className="space-y-4 w-full">
                                                        {/* ICONO COLORIDO + TÍTULO CORTO (MAX 2 LÍNEAS) */}
                                                        <div className="flex items-center gap-4">
                                                            <div
                                                                className={`w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0 ${tema.iconoBg}`}
                                                            >
                                                                <IconoDeportivo
                                                                    tipo={tema.tipoIcono}
                                                                    className="w-8 h-8"
                                                                />
                                                            </div>

                                                            <h3 className="text-lg font-bold text-white leading-snug line-clamp-2 group-hover:text-cyan-100 transition-colors">
                                                                {acortarTituloTarjeta(rutina.titulo)}
                                                            </h3>
                                                        </div>

                                                        {/* BADGE DE NIVEL */}
                                                        <div className="flex flex-wrap items-center gap-2.5">
                                                            <span
                                                                className={`inline-flex items-center px-3.5 py-1 rounded-full text-xs font-semibold border ${nivel.cls}`}
                                                            >
                                                                {nivel.label}
                                                            </span>
                                                            {rutina.tipo === "ia" && (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-400/25">
                                                                    <FaWandMagicSparkles className="text-[10px]" />
                                                                    IA
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* DURACIÓN Y CALORÍAS */}
                                                        <div className="flex items-center gap-5 text-sm text-slate-300">
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <FaClock className="text-slate-400" />
                                                                {rutina.duracion_min} min
                                                            </span>
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <FaFire className="text-slate-400" />
                                                                {calorias} kcal
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* BARRA DE PROGRESO + ACCESO DIRECTO A MODO GUIADO */}
                                                    <div className="space-y-3 w-full mt-2 pt-3 border-t border-slate-800/70">
                                                        <div className="h-2 w-full rounded-full bg-slate-800/95 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-300 ${
                                                                    esCompletada
                                                                        ? "bg-emerald-400"
                                                                        : tema.barraCls
                                                                }`}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>

                                                        <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-300">
                                                            <div className="flex items-center gap-2">
                                                                {esPorIniciar ? (
                                                                    <span className="text-slate-400">
                                                                        Por iniciar
                                                                    </span>
                                                                ) : (
                                                                    <>
                                                                        <span>{pct}% completado</span>
                                                                        {esCompletada && (
                                                                            <span className="text-emerald-400 font-semibold">
                                                                                Completada
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleAbrirAsistenteIa(rutina);
                                                                }}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-[#33e4fa] text-xs font-semibold transition cursor-pointer shrink-0"
                                                            >
                                                                <FaVideo className="text-[10px]" />
                                                                Guiado IA
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </section>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default function RutinasPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen w-full bg-[#0c1322]">
                    <div className="w-full max-w-6xl mx-auto px-6 py-8">
                        <SkeletonRutinas />
                    </div>
                </div>
            }
        >
            <RutinasContenido />
        </Suspense>
    );
}
