"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    FaArrowRight,
    FaArrowTrendUp,
    FaBullseye,
    FaCalendarCheck,
    FaCamera,
    FaClock,
    FaFire,
} from "react-icons/fa6";
import { api, getUsuario } from "@/lib/api";
import { leerHistorialLocalUsuario } from "@/lib/historial/sesionAnalisis";
import { LM } from "@/lib/pose/geometry";

const HUESOS_PREVIEW = [
    [LM.L_SHOULDER, LM.R_SHOULDER],
    [LM.L_HIP, LM.R_HIP],
    [LM.L_SHOULDER, LM.L_HIP],
    [LM.R_SHOULDER, LM.R_HIP],
    [LM.L_SHOULDER, LM.L_ELBOW],
    [LM.L_ELBOW, LM.L_WRIST],
    [LM.R_SHOULDER, LM.R_ELBOW],
    [LM.R_ELBOW, LM.R_WRIST],
    [LM.L_HIP, LM.L_KNEE],
    [LM.L_KNEE, LM.L_ANKLE],
    [LM.R_HIP, LM.R_KNEE],
    [LM.R_KNEE, LM.R_ANKLE],
];

function MiniPreview3DCanvas({ secuencia3D = [] }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const frames = Array.isArray(secuencia3D) ? secuencia3D : [];
        if (frames.length === 0) return undefined;

        let idx = 0;
        const dibujar = () => {
            const ctx = canvas.getContext("2d");
            const W = canvas.width;
            const H = canvas.height;
            ctx.clearRect(0, 0, W, H);

            const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.45, 16, W * 0.5, H * 0.5, W * 0.7);
            bgGrad.addColorStop(0, "#122138");
            bgGrad.addColorStop(1, "#070b14");
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, W, H);

            const cosY = Math.cos(0.45);
            const sinY = Math.sin(0.45);
            const cosP = Math.cos(0.2);
            const sinP = Math.sin(0.2);
            const fov = 210;
            const camDist = 4.2;

            const project = (x, y, z) => {
                const rx = x * cosY - z * sinY;
                const rz1 = x * sinY + z * cosY;
                const ry = y * cosP - rz1 * sinP;
                const rz = y * sinP + rz1 * cosP + camDist;
                const scale = fov / Math.max(0.8, rz);
                return { sx: W * 0.5 + rx * scale, sy: H * 0.54 + ry * scale };
            };

            const floorY = 1.65;
            ctx.lineWidth = 1;
            for (let g = -1.6; g <= 1.61; g += 0.4) {
                ctx.strokeStyle = Math.abs(g) < 0.05 ? "rgba(16, 226, 247, 0.4)" : "rgba(51, 65, 85, 0.35)";
                const a = project(g, floorY, -1.6);
                const b = project(g, floorY, 1.6);
                ctx.beginPath();
                ctx.moveTo(a.sx, a.sy);
                ctx.lineTo(b.sx, b.sy);
                ctx.stroke();

                const c = project(-1.6, floorY, g);
                const d = project(1.6, floorY, g);
                ctx.beginPath();
                ctx.moveTo(c.sx, c.sy);
                ctx.lineTo(d.sx, d.sy);
                ctx.stroke();
            }

            const frame = frames[idx % frames.length];
            const pts = frame?.puntos;
            if (!pts) return;

            const lift = (frame.lift ?? 0) * 0.45;
            const get3D = (k) => (pts[k] ? { x: pts[k].x, y: pts[k].y - lift, z: pts[k].z ?? 0 } : null);

            ctx.save();
            ctx.strokeStyle = "#10e2f7";
            ctx.shadowColor = "#10e2f7";
            ctx.shadowBlur = 8;
            ctx.lineWidth = 3.5;
            ctx.lineCap = "round";
            for (const [i, j] of HUESOS_PREVIEW) {
                const pA = get3D(i);
                const pB = get3D(j);
                if (!pA || !pB) continue;
                const pa = project(pA.x, pA.y, pA.z);
                const pb = project(pB.x, pB.y, pB.z);
                ctx.beginPath();
                ctx.moveTo(pa.sx, pa.sy);
                ctx.lineTo(pb.sx, pb.sy);
                ctx.stroke();
            }

            const nose = get3D(LM.NOSE);
            if (nose) {
                const pr = project(nose.x, nose.y, nose.z);
                ctx.fillStyle = "#0f172a";
                ctx.beginPath();
                ctx.arc(pr.sx, pr.sy, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            ctx.restore();
        };

        dibujar();
        if (frames.length <= 1) return undefined;
        const timer = setInterval(() => {
            idx = (idx + 1) % frames.length;
            dibujar();
        }, 70);
        return () => clearInterval(timer);
    }, [secuencia3D]);

    if (!Array.isArray(secuencia3D) || secuencia3D.length === 0) {
        return (
            <div className="h-52 rounded-2xl border border-slate-800 bg-[#080d18] flex flex-col items-center justify-center text-center p-4">
                <p className="text-xs font-semibold text-slate-300">
                    Vista 3D disponible al grabar un nuevo gesto
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                    Usa Análisis IA para guardar los 33 frames
                </p>
            </div>
        );
    }

    return (
        <div className="h-52 rounded-2xl overflow-hidden border border-slate-800 bg-[#080d18]">
            <canvas ref={canvasRef} width={320} height={220} className="w-full h-full block" />
        </div>
    );
}

function VolleyJumpIllustration() {
    return (
        <svg viewBox="0 0 180 150" fill="none" className="w-full h-full select-none" aria-hidden="true">
            <defs>
                <radialGradient id="dashGlow" cx="55%" cy="48%" r="50%">
                    <stop offset="0%" stopColor="#10e2f7" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#10e2f7" stopOpacity="0" />
                </radialGradient>
            </defs>
            <circle cx="95" cy="76" r="64" fill="url(#dashGlow)" />
            <g stroke="#22d3ee" strokeOpacity="0.45" strokeWidth="1">
                <line x1="25" y1="70" x2="60" y2="42" />
                <line x1="60" y1="42" x2="102" y2="56" />
                <line x1="102" y1="56" x2="145" y2="45" />
                <line x1="145" y1="45" x2="142" y2="96" />
                <line x1="142" y1="96" x2="88" y2="122" />
                <line x1="88" y1="122" x2="25" y2="70" />
            </g>
            {[
                [25, 70],
                [60, 42],
                [102, 56],
                [145, 45],
                [142, 96],
                [88, 122],
            ].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="2.5" fill="#67e8f9" />
            ))}
            <g strokeLinecap="round" strokeLinejoin="round">
                <path d="M84 62 L58 46" stroke="#67e8f9" strokeWidth="5" />
                <path d="M104 60 L128 38" stroke="#38bdf8" strokeWidth="5.5" />
                <path d="M84 58 L106 58 L102 90 L80 90 Z" fill="#132c42" stroke="#22d3ee" strokeWidth="1.8" />
                <circle cx="96" cy="44" r="7.5" fill="#0f2336" stroke="#67e8f9" strokeWidth="1.8" />
                <path d="M84 90 L72 114 L90 132" stroke="#22d3ee" strokeWidth="5.5" />
                <path d="M100 90 L118 110 L110 136" stroke="#10e2f7" strokeWidth="5.5" />
            </g>
            <circle cx="130" cy="24" r="10.5" fill="#38bdf8" stroke="#fde047" strokeWidth="2" />
        </svg>
    );
}

function AnilloScoreDashboard({ score }) {
    const val = Math.max(0, Math.min(100, Math.round(Number(score || 0))));
    const radius = 38;
    const circ = 2 * Math.PI * radius;
    const offset = circ * (1 - val / 100);
    const color = val >= 80 ? "#22d38a" : val >= 60 ? "#f59e0b" : "#f43f5e";

    return (
        <div className="relative inline-flex items-center justify-center w-24 h-24 shrink-0">
            <svg width={96} height={96} viewBox="0 0 96 96" className="-rotate-90">
                <circle
                    cx={48}
                    cy={48}
                    r={radius}
                    fill="none"
                    stroke="rgba(51, 65, 85, 0.55)"
                    strokeWidth={7}
                />
                <circle
                    cx={48}
                    cy={48}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={7}
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                />
            </svg>
            <div className="absolute inset-0 flex items-baseline justify-center pt-8 leading-none">
                <span className="text-2xl font-extrabold text-white">{val}</span>
                <span className="text-xs font-medium text-slate-400">/100</span>
            </div>
        </div>
    );
}

function etiquetaNivel(raw) {
    const n = String(raw || "Intermedio").toLowerCase();
    if (n.includes("bás") || n.includes("bas") || n.includes("principiante") || n.includes("todos")) {
        return "Principiante";
    }
    if (n.includes("avanzado")) return "Avanzado";
    return "Intermedio";
}

function consejoJuvenilCorto(raw, score) {
    const txt = String(raw || "").trim();
    if (txt && !/escápulo|escapulo|balística|balistica|cápsula|capsula|lca|valgo|excéntric/i.test(txt)) {
        return txt.length > 130 ? `${txt.slice(0, 127).trim()}...` : txt;
    }
    if (score >= 85) {
        return "¡Muy buena fuerza y estiramiento de brazo! Prueba subir un poquito más el codo al armar el golpe.";
    }
    return "Sube un poco más el codo antes de golpear y dobla suave las rodillas al aterrizar.";
}

export default function DashboardPage() {
    const router = useRouter();
    const [cargando, setCargando] = useState(true);
    const [estado, setEstado] = useState({
        nombre: "Atleta",
        saltoMaxCm: 0,
        precisionMedia: 0,
        deltaPrecision: null,
        rachaDias: 0,
        sesionesMes: 0,
        proximaRutina: null,
        ultimoGesto: null,
    });

    useEffect(() => {
        let cancelado = false;
        const userLocal = getUsuario();
        const uid = userLocal?.id || "me";
        const locales = leerHistorialLocalUsuario();

        Promise.allSettled([
            api("/usuario/perfil/"),
            api(`/dashboard/${encodeURIComponent(uid)}`),
            api("/usuario/progreso", { params: { periodo: "Todo el historial" } }),
            api("/usuario/rutinas"),
            api("/ia/analisis/sesiones"),
        ])
            .then(([resPerfil, resDash, resProg, resRutinas, resSesiones]) => {
                if (cancelado) return;

                const perfil = resPerfil.status === "fulfilled" ? resPerfil.value : null;
                const dash = resDash.status === "fulfilled" ? resDash.value : null;
                const prog = resProg.status === "fulfilled" ? resProg.value : null;
                const rutinas =
                    resRutinas.status === "fulfilled" && Array.isArray(resRutinas.value)
                        ? resRutinas.value
                        : [];
                const sesionesRemotas =
                    resSesiones.status === "fulfilled" && Array.isArray(resSesiones.value)
                        ? resSesiones.value
                        : [];

                const todasSesiones = sesionesRemotas.length > 0 ? sesionesRemotas : locales;

                const nombreCompleto =
                    perfil?.nombre_completo ||
                    `${perfil?.nombre || userLocal?.nombre || "Atleta"}`.trim();
                const primerNombre = nombreCompleto.split(" ")[0] || "Atleta";

                const saltoMaxCm = Number(
                    prog?.salto_maximo_cm ||
                        dash?.resumen_biomecanico?.salto_maximo_cm ||
                        0,
                );
                const precisionMedia = Math.round(
                    Number(
                        prog?.puntuacion_promedio ||
                            dash?.progreso?.valor ||
                            todasSesiones[0]?.puntuacion ||
                            0,
                    ),
                );
                const deltaPrecision =
                    prog?.mejora_total_pct !== undefined && prog?.mejora_total_pct !== null
                        ? Math.round(Number(prog.mejora_total_pct))
                        : dash?.progreso?.variacion ?? null;
                const rachaDias = Number(
                    prog?.racha_dias ?? dash?.racha_dias ?? (todasSesiones.length > 0 ? 1 : 0),
                );

                // Contar sesiones del mes actual (o total disponible)
                const ahora = new Date();
                const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
                const enEsteMes = todasSesiones.filter((s) =>
                    String(s.creadoEn || s.creado_en || s.fecha || "").startsWith(mesActual),
                ).length;
                const sesionesMes = Math.max(
                    enEsteMes,
                    Number(prog?.total_sesiones || 0),
                    todasSesiones.length,
                );

                // Próxima rutina recomendada (prioriza IA activa/disponible)
                const rutinasIa = rutinas.filter((r) => r.tipo === "ia");
                const proximaRutina =
                    rutinasIa.find((r) => r.estado !== "completada") ||
                    rutinas.find((r) => r.estado === "en_progreso") ||
                    rutinas.find((r) => r.estado !== "completada") ||
                    rutinas[0] ||
                    null;

                // Último gesto analizado con su secuencia 3D
                let ultimoGesto = null;
                for (const s of todasSesiones) {
                    const reps = Array.isArray(s.repeticiones) ? s.repeticiones : [];
                    if (reps.length > 0) {
                        const ultRep = reps[reps.length - 1];
                        const localMatch = locales.find((l) => l.id === s.id);
                        const seq3D =
                            (ultRep.secuencia3D?.length ? ultRep.secuencia3D : null) ||
                            (ultRep.secuencia_landmarks_3d?.length
                                ? ultRep.secuencia_landmarks_3d
                                : null) ||
                            localMatch?.repeticiones?.[reps.length - 1]?.secuencia3D ||
                            localMatch?.repeticiones?.[0]?.secuencia3D ||
                            [];
                        ultimoGesto = {
                            nombre: `${ultRep.movimientoNombre || "Remate"} #${ultRep.numero || reps.length}`,
                            score: Math.round(Number(ultRep.puntuacion ?? ultRep.score ?? 0)),
                            consejo: consejoJuvenilCorto(
                                ultRep.diagnosticoCausaRaiz || ultRep.vozCoach,
                                Number(ultRep.puntuacion ?? ultRep.score ?? 0),
                            ),
                            secuencia3D: seq3D,
                        };
                        break;
                    }
                }
                if (!ultimoGesto && dash?.ultimo_analisis) {
                    const sc = Math.round(Number(dash.ultimo_analisis.puntuacion || 0));
                    ultimoGesto = {
                        nombre: `${dash.ultimo_analisis.tecnica || "Remate"} #1`,
                        score: sc,
                        consejo: consejoJuvenilCorto(dash.ultimo_analisis.diagnostico, sc),
                        secuencia3D: locales[0]?.repeticiones?.[0]?.secuencia3D || [],
                    };
                }

                setEstado({
                    nombre: primerNombre,
                    saltoMaxCm: Number(saltoMaxCm.toFixed(1)),
                    precisionMedia,
                    deltaPrecision,
                    rachaDias,
                    sesionesMes,
                    proximaRutina,
                    ultimoGesto,
                });
            })
            .finally(() => {
                if (!cancelado) setCargando(false);
            });

        return () => {
            cancelado = true;
        };
    }, []);

    const progresoRutina = useMemo(() => {
        const r = estado.proximaRutina;
        if (!r) return 0;
        if (r.progreso_pct != null) return Math.round(Number(r.progreso_pct));
        const ej = Array.isArray(r.ejercicios) ? r.ejercicios : [];
        if (!ej.length) return 0;
        return Math.round((ej.filter((e) => e.completado).length / ej.length) * 100);
    }, [estado.proximaRutina]);

    const estadoUltimoTexto = (sc) => {
        if (sc >= 85) return { txt: "Excelente", cls: "text-emerald-400" };
        if (sc >= 70) return { txt: "Muy bien", cls: "text-cyan-400" };
        return { txt: "Por mejorar", cls: "text-amber-400" };
    };

    return (
        <div className="min-h-full w-full bg-[#0c1322] text-slate-100">
            <div className="w-full max-w-6xl mx-auto px-6 py-8 overflow-x-hidden space-y-7">
                {/* ENCABEZADO */}
                <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                            ¡Hola, {estado.nombre}! Listo para entrenar
                        </h1>
                        <p className="text-sm sm:text-base text-slate-300">
                            Hoy es un buen día para superar tus límites.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => router.push("/usuario/analisis")}
                        className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-[#10e2f7] hover:bg-[#49ecfc] text-slate-950 text-sm sm:text-base font-bold shadow-[0_0_24px_rgba(16,226,247,0.35)] transition cursor-pointer shrink-0 self-start md:self-auto"
                    >
                        <FaCamera />
                        Iniciar Análisis IA
                    </button>
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
                ) : (
                    <>
                        {/* FILA DE 4 TARJETAS KPI */}
                        <section
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
                            aria-label="Resumen rápido del deportista"
                        >
                            {/* 1. Mejor Salto */}
                            <article className="rounded-2xl bg-[#162032] border border-slate-700/50 p-5 flex items-center gap-4 shadow-lg">
                                <div className="w-12 h-12 rounded-2xl bg-[#122e42] border border-cyan-400/25 text-[#26d9f4] flex items-center justify-center shrink-0 text-lg">
                                    <FaArrowTrendUp />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-slate-400">Mejor Salto</p>
                                    <p className="text-2xl font-extrabold text-white mt-0.5">
                                        {estado.saltoMaxCm} cm
                                    </p>
                                    <p className="text-xs font-semibold text-cyan-400 mt-0.5">
                                        {estado.saltoMaxCm > 0 ? "¡Nuevo récord!" : "Registra tu primer salto"}
                                    </p>
                                </div>
                            </article>

                            {/* 2. Precisión Media */}
                            <article className="rounded-2xl bg-[#162032] border border-slate-700/50 p-5 flex items-center gap-4 shadow-lg">
                                <div className="w-12 h-12 rounded-2xl bg-[#123331] border border-emerald-400/25 text-[#3fe0a8] flex items-center justify-center shrink-0 text-lg">
                                    <FaBullseye />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-slate-400">Precisión Media</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-2xl font-extrabold text-white">
                                            {estado.precisionMedia}%
                                        </span>
                                        {estado.deltaPrecision != null && estado.deltaPrecision !== 0 && (
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold">
                                                {estado.deltaPrecision > 0 ? `+${estado.deltaPrecision}%` : `${estado.deltaPrecision}%`}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs font-medium text-emerald-400 mt-0.5">
                                        Efectividad técnica
                                    </p>
                                </div>
                            </article>

                            {/* 3. Racha */}
                            <article className="rounded-2xl bg-[#162032] border border-slate-700/50 p-5 flex items-center gap-4 shadow-lg">
                                <div className="w-12 h-12 rounded-2xl bg-[#2c2222] border border-amber-400/25 text-[#f59e0b] flex items-center justify-center shrink-0 text-lg">
                                    <FaFire />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-slate-400">Racha</p>
                                    <p className="text-2xl font-extrabold text-white mt-0.5">
                                        {estado.rachaDias} {estado.rachaDias === 1 ? "día" : "días"}
                                    </p>
                                    <p className="text-xs font-semibold text-amber-400 mt-0.5">
                                        {estado.rachaDias > 0 ? "¡No pares!" : "Entrena hoy"}
                                    </p>
                                </div>
                            </article>

                            {/* 4. Sesiones */}
                            <article className="rounded-2xl bg-[#162032] border border-slate-700/50 p-5 flex items-center gap-4 shadow-lg">
                                <div className="w-12 h-12 rounded-2xl bg-[#28271b] border border-yellow-400/25 text-[#facc15] flex items-center justify-center shrink-0 text-lg">
                                    <FaCalendarCheck />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-slate-400">Sesiones</p>
                                    <p className="text-2xl font-extrabold text-white mt-0.5">
                                        {estado.sesionesMes}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-0.5">este mes</p>
                                </div>
                            </article>
                        </section>

                        {/* 2 TARJETAS GRANDES LADO A LADO */}
                        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                            {/* IZQUIERDA: TU PRÓXIMA RUTINA RECOMENDADA */}
                            <article className="rounded-2xl bg-[#162032] border border-slate-700/50 p-6 flex flex-col justify-between gap-5 shadow-lg">
                                <h2 className="text-lg font-bold text-white">
                                    Tu Próxima Rutina Recomendada
                                </h2>

                                <div className="flex items-center justify-between gap-4">
                                    <div className="space-y-2 min-w-0 flex-1">
                                        <h3 className="text-xl sm:text-2xl font-extrabold text-white leading-snug">
                                            {estado.proximaRutina?.titulo ||
                                                "Mejorar Salto Vertical y Potencia"}
                                        </h3>
                                        <p className="text-sm text-slate-300 leading-relaxed">
                                            {estado.proximaRutina?.enfoque_tecnico ||
                                                estado.proximaRutina?.descripcion ||
                                                "Enfoque en despegue explosivo y caída suave cuidando tus piernas."}
                                        </p>
                                    </div>

                                    <div className="w-32 h-28 shrink-0 hidden sm:flex items-center justify-center">
                                        <VolleyJumpIllustration />
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-all duration-300"
                                            style={{ width: `${progresoRutina}%` }}
                                        />
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 font-medium">
                                            <span>{progresoRutina}% completado</span>
                                            <span className="inline-flex items-center gap-1 text-slate-300">
                                                <FaClock className="text-slate-400" />
                                                {estado.proximaRutina?.duracion_min || 25} min
                                            </span>
                                            <span>
                                                {etiquetaNivel(estado.proximaRutina?.nivel)}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.push(
                                                    estado.proximaRutina?.id
                                                        ? `/usuario/rutinas?rutinaId=${encodeURIComponent(estado.proximaRutina.id)}`
                                                        : "/usuario/rutinas",
                                                )
                                            }
                                            className="px-6 py-2.5 rounded-full bg-[#10e2f7] hover:bg-[#49ecfc] text-slate-950 text-sm font-bold shadow-[0_0_20px_rgba(16,226,247,0.3)] transition cursor-pointer"
                                        >
                                            Empezar
                                        </button>
                                    </div>
                                </div>
                            </article>

                            {/* DERECHA: ÚLTIMO GESTO ANALIZADO */}
                            <article className="rounded-2xl bg-[#162032] border border-slate-700/50 p-6 flex flex-col justify-between gap-5 shadow-lg">
                                <div className="flex items-center justify-between gap-2">
                                    <h2 className="text-lg font-bold text-white">
                                        Último Gesto Analizado
                                    </h2>
                                    <Link
                                        href="/usuario/historial"
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition"
                                    >
                                        Ver en Historial
                                        <FaArrowRight className="text-[10px]" />
                                    </Link>
                                </div>

                                {estado.ultimoGesto ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_1fr] gap-5 items-center flex-1">
                                        <button
                                            type="button"
                                            onClick={() => router.push("/usuario/historial")}
                                            aria-label="Ver reconstrucción 3D completa en historial"
                                            className="w-full text-left cursor-pointer hover:opacity-95 transition"
                                        >
                                            <MiniPreview3DCanvas
                                                secuencia3D={estado.ultimoGesto.secuencia3D}
                                            />
                                        </button>

                                        <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-3">
                                            <AnilloScoreDashboard score={estado.ultimoGesto.score} />

                                            <div className="space-y-1.5">
                                                <p className="text-base font-bold text-white">
                                                    {estado.ultimoGesto.nombre} ·{" "}
                                                    <span
                                                        className={
                                                            estadoUltimoTexto(
                                                                estado.ultimoGesto.score,
                                                            ).cls
                                                        }
                                                    >
                                                        {
                                                            estadoUltimoTexto(
                                                                estado.ultimoGesto.score,
                                                            ).txt
                                                        }
                                                    </span>
                                                </p>
                                                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                                                    {estado.ultimoGesto.consejo}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 rounded-2xl border border-slate-800 bg-[#0d1424] p-6 flex flex-col items-center justify-center text-center space-y-3">
                                        <p className="text-sm font-semibold text-white">
                                            Todavía no hay gestos analizados
                                        </p>
                                        <p className="text-xs text-slate-400 max-w-xs">
                                            Graba tu primer salto o remate para ver tu esqueleto 3D y puntuación aquí.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => router.push("/usuario/analisis")}
                                            className="px-5 py-2 rounded-full bg-[#10e2f7] hover:bg-[#49ecfc] text-slate-950 text-xs font-bold transition cursor-pointer"
                                        >
                                            Hacer mi primer análisis
                                        </button>
                                    </div>
                                )}
                            </article>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
