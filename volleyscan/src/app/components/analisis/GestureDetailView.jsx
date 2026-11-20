"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    FaBolt,
    FaBrain,
    FaCircleCheck,
    FaCircleExclamation,
    FaCube,
    FaFilm,
    FaStopwatch,
    FaTriangleExclamation,
} from "react-icons/fa6";
import GemeloDigital3D from "@/app/components/analisis/GemeloDigital3D";
import { dibujarEsqueletoEnCanvas } from "@/hooks/useAsistenteBackend";

function FaseSnapshotThumb({ snapshot, errores = [], numFase }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !snapshot?.dataUrl) return undefined;
        const ctx = canvas.getContext("2d");
        let canceled = false;
        const img = new Image();
        img.onload = () => {
            if (canceled) return;
            const w = snapshot.width || img.naturalWidth || 640;
            const h = snapshot.height || img.naturalHeight || 480;
            canvas.width = w;
            canvas.height = h;
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);

            const tieneError = (errores || []).some((e) => Number(e.fase) === Number(numFase));
            dibujarEsqueletoEnCanvas(
                ctx,
                snapshot.landmarks2d,
                w,
                h,
                tieneError ? "#FF3366" : "#00FF99",
                "#00F0FF",
            );
        };
        img.src = snapshot.dataUrl;
        return () => {
            canceled = true;
        };
    }, [snapshot, errores, numFase]);

    if (!snapshot?.dataUrl) return null;
    return (
        <div className="mb-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70">
            <canvas ref={canvasRef} id={`canvasFase${numFase}`} className="w-full h-32 object-cover block" />
        </div>
    );
}

function parseNumero(valor) {
    if (valor == null) return null;
    const num = Number(String(valor).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(num) ? num : null;
}

function obtenerEstadoSemaforo(score) {
    if (score == null || Number.isNaN(Number(score))) {
        return {
            clave: "pendiente",
            etiqueta: "En espera",
            dotCls: "bg-slate-500",
            badgeCls: "bg-slate-800/90 text-slate-300 border-slate-700",
            borderAccent: "border-slate-800",
        };
    }
    const sc = Number(score);
    if (sc >= 82) {
        return {
            clave: "optimo",
            etiqueta: "¡Muy bien!",
            dotCls: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]",
            badgeCls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35",
            borderAccent: "border-emerald-500/30 hover:border-emerald-400/60",
        };
    }
    if (sc >= 68) {
        return {
            clave: "mejorable",
            etiqueta: "Por mejorar",
            dotCls: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.75)]",
            badgeCls: "bg-amber-500/15 text-amber-300 border-amber-500/35",
            borderAccent: "border-amber-500/30 hover:border-amber-400/60",
        };
    }
    return {
        clave: "corregir",
        etiqueta: "A corregir",
        dotCls: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]",
        badgeCls: "bg-rose-500/15 text-rose-300 border-rose-500/35",
        borderAccent: "border-rose-500/35 hover:border-rose-400/65",
    };
}

function generarCorreccionCoach(clave, valNum) {
    if (valNum == null) {
        return {
            texto: "Completa el movimiento frente a cámara para recibir el consejo de tu entrenador.",
            estado: "pendiente",
        };
    }
    const v = Number(valNum);
    switch (clave) {
        case "rodilla_f1": {
            if (v > 120) {
                return {
                    texto: "Flexiona un poco más las rodillas en el impulso para despegar con más fuerza.",
                    estado: v > 130 ? "corregir" : "mejorable",
                };
            }
            if (v < 95) {
                return {
                    texto: "No bajes tanto en la sentadilla para no perder rapidez al despegar.",
                    estado: v < 85 ? "corregir" : "mejorable",
                };
            }
            return { texto: "¡Postura ideal! Buena flexión de piernas para saltar alto.", estado: "optimo" };
        }
        case "cadera_f1": {
            if (v > 155) {
                return {
                    texto: "Inclina ligeramente el pecho y lleva la cadera hacia atrás antes de saltar.",
                    estado: v > 165 ? "corregir" : "mejorable",
                };
            }
            if (v < 130) {
                return {
                    texto: "Levanta un poco más la mirada y el pecho al prepararte para el salto.",
                    estado: "mejorable",
                };
            }
            return { texto: "¡Buen equilibrio del cuerpo listo para impulsarte hacia arriba!", estado: "optimo" };
        }
        case "codo_f2": {
            if (v < 85) {
                return {
                    texto: "Abre un poquito más el codo al preparar el brazo para golpear más cómodo.",
                    estado: "mejorable",
                };
            }
            if (v > 125) {
                return {
                    texto: "Recoge el brazo atrás como arco y flecha antes de lanzar el golpe.",
                    estado: v > 140 ? "corregir" : "mejorable",
                };
            }
            return { texto: "¡Muy buen armado de brazo listo para rematar fuerte!", estado: "optimo" };
        }
        case "hombro_f2": {
            if (v < 110) {
                return {
                    texto: "Sube más el codo antes de golpear para tener mayor alcance.",
                    estado: v < 95 ? "corregir" : "mejorable",
                };
            }
            return { texto: "¡Súper bien! Tu brazo sube alto en el aire.", estado: "optimo" };
        }
        case "codo_f3": {
            if (v < 165) {
                return {
                    texto: "Estira por completo el brazo al golpear el balón en el punto más alto.",
                    estado: v < 152 ? "corregir" : "mejorable",
                };
            }
            return { texto: "¡Excelente golpe alto con el brazo bien estirado!", estado: "optimo" };
        }
        case "hombro_f3": {
            if (v < 145) {
                return {
                    texto: "Sube más el brazo por encima de tu cabeza al impactar el balón.",
                    estado: v < 130 ? "corregir" : "mejorable",
                };
            }
            return { texto: "¡Gran alcance sobre la red cuidando tu hombro!", estado: "optimo" };
        }
        case "rodilla_f4": {
            if (v > 145) {
                return {
                    texto: "Flexiona más las rodillas al caer para aterrizar suave y proteger tus piernas.",
                    estado: v > 158 ? "corregir" : "mejorable",
                };
            }
            if (v < 115) {
                return {
                    texto: "Frena suave la caída sin dejarte hundir demasiado al tocar el suelo.",
                    estado: "mejorable",
                };
            }
            return { texto: "¡Aterrizaje suave y seguro para tus rodillas!", estado: "optimo" };
        }
        case "asimetria_f4": {
            if (v >= 15) {
                return {
                    texto: "Cae apoyando los dos pies al mismo tiempo para mantener el equilibrio.",
                    estado: v >= 22 ? "corregir" : "mejorable",
                };
            }
            return { texto: "¡Caída súper pareja apoyando bien ambos pies!", estado: "optimo" };
        }
        default:
            return { texto: "Movimiento controlado y dentro de lo esperado.", estado: "optimo" };
    }
}

function construirTarjetas4Fases(gesture) {
    const fases = gesture?.fases4 || gesture?.fases || {};
    const f1 = fases.fase_1 || {};
    const f2 = fases.fase_2 || {};
    const f3 = fases.fase_3 || {};
    const f4 = fases.fase_4 || {};

    const m1 = f1.metricas_clave || {};
    const m2 = f2.metricas_clave || {};
    const m3 = f3.metricas_clave || {};
    const m4 = f4.metricas_clave || {};

    const valFromArr = (faseObj, idx) =>
        Array.isArray(faseObj?.metricas) && faseObj.metricas[idx]
            ? parseNumero(faseObj.metricas[idx].valor)
            : null;

    const rodF1 = parseNumero(m1.angulo_rodilla_3d) ?? valFromArr(f1, 0);
    const cadF1 = parseNumero(m1.angulo_cadera_3d) ?? valFromArr(f1, 1);
    const codoF2 = parseNumero(m2.angulo_codo_armado_3d) ?? valFromArr(f2, 0);
    const homF2 = parseNumero(m2.angulo_hombro_elevacion_3d) ?? valFromArr(f2, 1);
    const codoF3 = parseNumero(m3.angulo_codo_contacto_3d) ?? valFromArr(f3, 0);
    const homF3 = parseNumero(m3.angulo_hombro_contacto_3d) ?? valFromArr(f3, 1);
    const rodF4 = parseNumero(m4.angulo_rodilla_aterrizaje_3d) ?? valFromArr(f4, 0);
    const asimF4 = parseNumero(m4.asimetria_bilateral_grados) ?? valFromArr(f4, 1);

    return [
        {
            numero: 1,
            id: "carga",
            domCardId: "cardFase1",
            domScoreId: "scoreFase1",
            domDiagId: "diagFase1",
            titulo: "1. Preparación",
            subtitulo: "Impulso de piernas antes de saltar",
            score: f1.score,
            diagnostico: f1.diagnostico,
            angulos: [
                {
                    domId: "angRodillaF1",
                    label: "Rodillas al arrancar",
                    valor: rodF1,
                    correccion: generarCorreccionCoach("rodilla_f1", rodF1),
                },
                {
                    domId: "angCaderaF1",
                    label: "Postura de cadera",
                    valor: cadF1,
                    correccion: generarCorreccionCoach("cadera_f1", cadF1),
                },
            ],
        },
        {
            numero: 2,
            id: "armado",
            domCardId: "cardFase2",
            domScoreId: "scoreFase2",
            domDiagId: "diagFase2",
            titulo: "2. Salto y Armado",
            subtitulo: "Subida del brazo en el aire",
            score: f2.score,
            diagnostico: f2.diagnostico,
            angulos: [
                {
                    domId: "angCodoF2",
                    label: "Codo al armar",
                    valor: codoF2,
                    correccion: generarCorreccionCoach("codo_f2", codoF2),
                },
                {
                    domId: "angHombroF2",
                    label: "Altura del brazo",
                    valor: homF2,
                    correccion: generarCorreccionCoach("hombro_f2", homF2),
                },
            ],
        },
        {
            numero: 3,
            id: "contacto",
            domCardId: "cardFase3",
            domScoreId: "scoreFase3",
            domDiagId: "diagFase3",
            esCritica: true,
            titulo: "3. Golpe al balón",
            subtitulo: "Contacto en el punto más alto",
            score: f3.score,
            diagnostico: f3.diagnostico,
            angulos: [
                {
                    domId: "angCodoF3",
                    label: "Estiramiento del brazo",
                    valor: codoF3,
                    correccion: generarCorreccionCoach("codo_f3", codoF3),
                },
                {
                    domId: "angHombroF3",
                    label: "Alcance arriba",
                    valor: homF3,
                    correccion: generarCorreccionCoach("hombro_f3", homF3),
                },
            ],
        },
        {
            numero: 4,
            id: "caida",
            domCardId: "cardFase4",
            domScoreId: "scoreFase4",
            domDiagId: "diagFase4",
            titulo: "4. Caída suave",
            subtitulo: "Aterrizaje con ambos pies",
            score: f4.score,
            diagnostico: f4.diagnostico,
            angulos: [
                {
                    domId: "angRodillaF4",
                    label: "Amortiguación al caer",
                    valor: rodF4,
                    correccion: generarCorreccionCoach("rodilla_f4", rodF4),
                },
                {
                    domId: "angAsimetriaF4",
                    label: "Equilibrio de pies",
                    valor: asimF4,
                    correccion: generarCorreccionCoach("asimetria_f4", asimF4),
                },
            ],
        },
    ];
}

export default function GestureDetailView({
    gesture,
    live = null,
    backendConnected = true,
    camaraActiva = false,
    snaps = null,
    replaySrc = null,
    modoReproductorInicial = "3d",
    mostrarSelectorModo = false,
    compact = false,
}) {
    const [modoReproductor, setModoReproductor] = useState(modoReproductorInicial);
    const [jumpRequest, setJumpRequest] = useState(null);

    useEffect(() => {
        setModoReproductor(modoReproductorInicial);
    }, [modoReproductorInicial]);

    const repNormalizado = useMemo(() => {
        if (!gesture) return null;
        const seq = Array.isArray(gesture.secuencia3D)
            ? gesture.secuencia3D
            : Array.isArray(gesture.secuencia_landmarks_3d)
              ? gesture.secuencia_landmarks_3d
              : [];
        return {
            ...gesture,
            secuencia3D: seq,
            indicesFases: gesture.indicesFases ||
                gesture.indices_fases || {
                    carga: 0,
                    armado: Math.floor(seq.length * 0.35),
                    contacto: Math.floor(seq.length * 0.65),
                    caida: Math.max(0, seq.length - 1),
                },
        };
    }, [gesture]);

    const saltoCm =
        repNormalizado?.saltoVerticalCm ??
        repNormalizado?.saltoCm ??
        repNormalizado?.altura_salto_cm ??
        (live?.saltoVerticalCm > 0 ? live.saltoVerticalCm : null);

    const hangTimeSeg =
        repNormalizado?.tiempoVueloSegundos ??
        repNormalizado?.tiempoVueloSeg ??
        repNormalizado?.tiempo_vuelo_seg ??
        (live?.tiempoVueloSeg > 0 ? live.tiempoVueloSeg : null);

    const scoreGlobal =
        repNormalizado?.puntuacion ??
        repNormalizado?.score ??
        repNormalizado?.score_global ??
        null;

    const semGlobal = obtenerEstadoSemaforo(scoreGlobal);
    const tarjetasFases = useMemo(() => construirTarjetas4Fases(repNormalizado), [repNormalizado]);
    const erroresRaw = repNormalizado?.errores_detectados || repNormalizado?.errores || [];
    const puntosClave = repNormalizado?.puntosClave || [];
    const tieneSecuencia3D = (repNormalizado?.secuencia3D?.length || 0) > 0;
    const tieneLiveBuffer = (live?.backend3DBuffer?.length || 0) > 0;

    const handleSeleccionarFase = (fase) => {
        if (!tieneSecuencia3D) return;
        const idxMap = repNormalizado.indicesFases || {};
        const frameIdx = Number(idxMap[fase.id] ?? 0);
        setModoReproductor("3d");
        setJumpRequest({ frameIdx, nonce: Date.now() });
    };

    const textoVozCoach =
        repNormalizado?.vozCoach ||
        repNormalizado?.coach_voz_texto ||
        repNormalizado?.voz_coach ||
        "";

    const textoDiagnostico =
        repNormalizado?.diagnosticoCausaRaiz ||
        repNormalizado?.diagnostico_causa_raiz ||
        "Tu entrenador virtual revisará cómo despegas, cómo subes el brazo y cómo caes para darte consejos claros.";

    return (
        <div className="space-y-6">
            {/* BLOQUE SUPERIOR: REPRODUCTOR 3D (IZQ) + SALTO Y CONSEJO DEL COACH (DER) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div className="lg:col-span-7 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-slate-950/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-cyan-300">
                            <FaCube className="text-cyan-400" />
                            Repetición en 3D
                        </div>
                        {mostrarSelectorModo && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setModoReproductor("gif")}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                                        modoReproductor === "gif"
                                            ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                                            : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white"
                                    }`}
                                >
                                    <FaFilm />
                                    Video rápido
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setModoReproductor("3d")}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                                        modoReproductor === "3d"
                                            ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                                            : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white"
                                    }`}
                                >
                                    <FaCube />
                                    Vista 3D
                                </button>
                            </div>
                        )}
                    </div>

                    {modoReproductor === "gif" && replaySrc ? (
                        <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                            <img
                                id="imgReplayCinematico"
                                src={replaySrc}
                                alt="Replay del movimiento"
                                className="w-full max-h-[380px] object-contain mx-auto"
                            />
                        </div>
                    ) : modoReproductor === "gif" && !replaySrc ? (
                        <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-blue-950/30 p-8 text-center flex flex-col items-center justify-center min-h-[280px] space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-xl">
                                <FaFilm />
                            </div>
                            <h4 className="text-base font-bold text-slate-100">Listo para ver tu jugada</h4>
                            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
                                Haz tu remate, saque, voleo o recepción frente a la cámara para ver aquí tu movimiento en cámara lenta.
                            </p>
                        </div>
                    ) : tieneSecuencia3D || tieneLiveBuffer || camaraActiva ? (
                        <GemeloDigital3D
                            liveBuffer={live?.backend3DBuffer || []}
                            rep={repNormalizado}
                            backendConnected={backendConnected}
                            running={camaraActiva}
                            framesEnBuffer={live?.framesEnBuffer ?? 0}
                            liveSaltoCm={saltoCm ?? 0}
                            jumpRequest={jumpRequest}
                            indicesFases={repNormalizado?.indicesFases}
                            compact={compact}
                        />
                    ) : (
                        <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-indigo-950/30 p-8 text-center flex flex-col items-center justify-center min-h-[280px] space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-300 text-xl">
                                <FaCube />
                            </div>
                            <h4 className="text-base font-bold text-slate-100">
                                Sin animación 3D guardada en esta jugada
                            </h4>
                            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
                                Esta jugada solo guardó tus puntajes y consejos. Las próximas sesiones guardarán también tu muñeco 3D completo.
                            </p>
                        </div>
                    )}
                </div>

                {/* DERECHA: SALTO + TIEMPO EN EL AIRE + RESUMEN DEL COACH */}
                <div className="lg:col-span-5 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-slate-950/90 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between gap-5">
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-200">
                                {repNormalizado?.movimientoNombre || repNormalizado?.gesto_detectado || "Resumen del movimiento"}
                            </span>
                            {scoreGlobal != null && (
                                <span
                                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${semGlobal.badgeCls}`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${semGlobal.dotCls}`} />
                                    {Math.round(Number(scoreGlobal))}/100 · {semGlobal.etiqueta}
                                </span>
                            )}
                        </div>

                        <div id="bannerSaltoVertical" className="grid grid-cols-2 gap-4">
                            <div className="rounded-xl bg-gradient-to-br from-cyan-500/15 via-slate-900/80 to-slate-950 border border-cyan-500/30 p-4">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                                    <FaBolt />
                                    Altura del Salto
                                </div>
                                <div id="badgeSaltoVerticalCm" className="text-xl md:text-2xl font-extrabold text-white mt-1.5">
                                    {saltoCm != null ? `${Number(saltoCm).toFixed(1)} cm` : "-- cm"}
                                </div>
                            </div>

                            <div className="rounded-xl bg-gradient-to-br from-blue-500/15 via-slate-900/80 to-slate-950 border border-blue-500/30 p-4">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-300">
                                    <FaStopwatch />
                                    Tiempo en el Aire
                                </div>
                                <div id="badgeTiempoVueloSeg" className="text-xl md:text-2xl font-extrabold text-white mt-1.5">
                                    {hangTimeSeg != null ? `${Number(hangTimeSeg).toFixed(2)} s` : "-- s"}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300">
                                <FaBrain className="text-cyan-400" />
                                Consejo Principal del Coach
                            </div>
                            <p id="txtDiagnosticoCausaRaiz" className="text-sm text-slate-200 leading-relaxed">
                                {textoDiagnostico}
                            </p>
                            {textoVozCoach && textoVozCoach !== textoDiagnostico && (
                                <p className="text-sm italic text-slate-400 border-t border-slate-800 pt-2">
                                    &ldquo;{textoVozCoach}&rdquo;
                                </p>
                            )}
                        </div>
                    </div>

                    {(erroresRaw.length > 0 || puntosClave.length > 0) && (
                        <div className="space-y-2.5 pt-1">
                            {erroresRaw.slice(0, 2).map((err, i) => (
                                <div
                                    key={`err_${i}`}
                                    className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3.5 py-2.5 text-sm text-amber-200 flex items-start gap-2.5"
                                >
                                    <FaTriangleExclamation className="text-amber-400 mt-0.5 shrink-0" />
                                    <span>{err.mensaje || err.descripcion || err.nombre}</span>
                                </div>
                            ))}
                            {erroresRaw.length === 0 &&
                                puntosClave.slice(0, 2).map((pto, i) => (
                                    <div
                                        key={`pto_${i}`}
                                        className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3.5 py-2.5 text-sm text-emerald-200 flex items-start gap-2.5"
                                    >
                                        <FaCircleCheck className="text-emerald-400 mt-0.5 shrink-0" />
                                        <span>{pto}</span>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 4 TARJETAS DE FASES CON CONSEJOS CLAROS */}
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                        Cómo lo hiciste paso a paso
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> ¡Muy bien!
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Por mejorar
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> A corregir
                        </span>
                        {tieneSecuencia3D && (
                            <span className="text-cyan-400 font-medium">
                                · Toca una tarjeta para ver ese momento en 3D
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                    {tarjetasFases.map((fase) => {
                        const sem = obtenerEstadoSemaforo(fase.score);
                        const snapFase = snaps?.[`fase_${fase.numero}`];
                        return (
                            <div
                                key={fase.numero}
                                id={fase.domCardId}
                                onClick={() => handleSeleccionarFase(fase)}
                                role={tieneSecuencia3D ? "button" : undefined}
                                tabIndex={tieneSecuencia3D ? 0 : undefined}
                                onKeyDown={(e) => {
                                    if (tieneSecuencia3D && (e.key === "Enter" || e.key === " ")) {
                                        e.preventDefault();
                                        handleSeleccionarFase(fase);
                                    }
                                }}
                                className={`rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-slate-950/95 border p-5 flex flex-col justify-between transition ${
                                    sem.borderAccent
                                } ${fase.esCritica ? "ring-1 ring-amber-400/20" : ""} ${
                                    tieneSecuencia3D ? "cursor-pointer" : ""
                                }`}
                            >
                                <div>
                                    <FaseSnapshotThumb
                                        snapshot={snapFase}
                                        errores={erroresRaw}
                                        numFase={fase.numero}
                                    />

                                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800/80">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${sem.dotCls}`} />
                                                <h4 className="text-base font-bold text-white leading-tight">
                                                    {fase.titulo}
                                                </h4>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1">{fase.subtitulo}</p>
                                        </div>

                                        <span
                                            id={fase.domScoreId}
                                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border shrink-0 ${sem.badgeCls}`}
                                        >
                                            {fase.score != null ? `${Math.round(Number(fase.score))}%` : sem.etiqueta}
                                        </span>
                                    </div>

                                    <div className="mt-4 space-y-3">
                                        {fase.angulos.map((ang) => {
                                            const angSem = obtenerEstadoSemaforo(
                                                ang.correccion.estado === "optimo"
                                                    ? 90
                                                    : ang.correccion.estado === "mejorable"
                                                      ? 75
                                                      : ang.correccion.estado === "corregir"
                                                        ? 55
                                                        : null,
                                            );
                                            return (
                                                <div
                                                    key={ang.domId}
                                                    className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 space-y-2"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-bold text-slate-200">
                                                            {ang.label}
                                                        </span>
                                                        <span
                                                            id={ang.domId}
                                                            className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[11px] font-medium text-slate-400"
                                                        >
                                                            {ang.valor != null ? `${ang.valor}°` : "--°"}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-start gap-2">
                                                        <span
                                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border shrink-0 ${angSem.badgeCls}`}
                                                        >
                                                            {ang.correccion.estado === "corregir" && (
                                                                <FaCircleExclamation className="text-[10px]" />
                                                            )}
                                                            {angSem.etiqueta}
                                                        </span>
                                                    </div>

                                                    <p className="text-sm leading-snug text-slate-200">
                                                        {ang.correccion.texto}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {fase.diagnostico && (
                                    <p
                                        id={fase.domDiagId}
                                        className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 leading-relaxed"
                                    >
                                        {fase.diagnostico}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
