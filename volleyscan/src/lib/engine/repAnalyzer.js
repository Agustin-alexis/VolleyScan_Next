import { LM, MIN_VISIBILITY } from '@/lib/pose/geometry';
import { evaluarRepeticion } from '@/lib/engine/scorer';
import { MOVIMIENTOS, obtenerMovimiento } from '@/lib/movimientos/gestos';
import { generarVozCoachRep } from '@/lib/voice/voiceCoach';

const BUFFER_MS = 3800; // historial reciente que se conserva para mirar atrás
const SIDES = ['L', 'R'];
const WRIST = { L: LM.L_WRIST, R: LM.R_WRIST };
const SHOULDER = { L: LM.L_SHOULDER, R: LM.R_SHOULDER };

// Puntos que se conservan de cada cuadro para dibujar la "foto de la técnica" y el Gemelo 3D
const KEY_IDX = [
    LM.NOSE, LM.L_SHOULDER, LM.R_SHOULDER, LM.L_ELBOW, LM.R_ELBOW, LM.L_WRIST, LM.R_WRIST,
    LM.L_HIP, LM.R_HIP, LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE,
];
const KEY_ANGLES = ['codoD', 'codoI', 'hombroD', 'hombroI', 'caderaD', 'caderaI', 'rodillaD', 'rodillaI', 'tronco'];
const r3 = (n) => Math.round(n * 1000) / 1000;

// Factor de una media móvil exponencial con constante de tiempo tauMs
const emaAlpha = (dt, tauMs) => 1 - Math.exp(-dt / tauMs);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const seen = (p) => Boolean(p) && p.v >= MIN_VISIBILITY;
const mean = (arr) => arr.reduce((acc, n) => acc + n, 0) / arr.length;

function mediana(arr) {
    const s = [...arr].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function medianaMovil3(vals) {
    if (vals.length < 3) return vals;
    return vals.map((v, i) => (i === 0 || i === vals.length - 1 ? v : mediana([vals[i - 1], v, vals[i + 1]])));
}

function pendiente(pts, i) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    return b.t === a.t ? 0 : (b.v - a.v) / (b.t - a.t);
}

function extremo(serie, modo, dtMed, lo, hi) {
    const pts = serie.filter((p) => isNum(p.v));
    const dentro = pts.filter((p) => p.t >= lo && p.t <= hi);
    if (!dentro.length) return null;
    const pick = modo === 'max' ? Math.max : Math.min;

    if (dtMed <= 25) return pick(...medianaMovil3(dentro.map((p) => p.v)));

    let mejor = pick(...dentro.map((p) => p.v));
    for (let i = 0; i < pts.length - 1; i += 1) {
        const a = pts[i];
        const b = pts[i + 1];
        const h = b.t - a.t;
        if (h <= 0 || h > 400) continue;
        const ma = pendiente(pts, i);
        const mb = pendiente(pts, i + 1);
        for (const u of [0.25, 0.5, 0.75]) {
            const t = a.t + u * h;
            if (t < lo || t > hi) continue;
            const u2 = u * u;
            const u3 = u2 * u;
            const v =
                (2 * u3 - 3 * u2 + 1) * a.v + (u3 - 2 * u2 + u) * h * ma + (-2 * u3 + 3 * u2) * b.v + (u3 - u2) * h * mb;
            mejor = pick(mejor, v);
        }
    }
    return mejor;
}

function confianzaDe(fps, medidas) {
    const sinDato = medidas.filter((m) => m.valor === null).length;
    if (fps >= 30 && sinDato <= 1) return 'alta';
    if (fps >= 20 && sinDato <= 2) return 'media';
    return 'baja';
}

function readBody(pts) {
    const sL = pts[LM.L_SHOULDER];
    const sR = pts[LM.R_SHOULDER];
    const hL = pts[LM.L_HIP];
    const hR = pts[LM.R_HIP];
    const ankleL = pts[LM.L_ANKLE];
    const ankleR = pts[LM.R_ANKLE];
    if (![sL, sR, hL, hR, ankleL, ankleR].every(seen)) return null;

    const torso = Math.hypot((sL.x + sR.x - hL.x - hR.x) / 2, (sL.y + sR.y - hL.y - hR.y) / 2);
    if (torso < 1) return null;

    const nose = pts[LM.NOSE];
    return { torso, ankleL, ankleR, noseY: seen(nose) ? nose.y : null };
}

function findTakeoff(buffer, t0) {
    for (let i = buffer.length - 1; i >= 0; i -= 1) {
        if (buffer[i].lift < 0.03 || t0 - buffer[i].t > 300) return buffer[i].t;
    }
    return t0;
}

/**
 * Construye el desglose de las 4 Fases Biomecánicas y el Diagnóstico de Causa Raíz
 * integrando la arquitectura científica del Asistente de IA.
 */
function construirFasesYDiagnostico({ gestoId, medidas, valores, indicesFases, velocidadPicoMs, saltoVerticalCm }) {
    const porFase = (fasesIds) => medidas.filter((m) => fasesIds.includes(m.fase) && m.puntaje !== null);
    const scoreFase = (lista, fallback = 88) => {
        if (!lista.length) return fallback;
        return Math.round(mean(lista.map((m) => m.puntaje * 100)));
    };
    const estadoScore = (sc) => (sc >= 82 ? 'Óptimo' : sc >= 65 ? 'Advertencia' : 'Deficiente');

    const mF1 = porFase(['carga', 'preparacion']);
    const mF2 = porFase(['vuelo']);
    const mF3 = porFase(['golpeo']);
    const mF4 = porFase(['caida']);

    const sc1 = scoreFase(mF1, 88);
    const sc2 = scoreFase(mF2, 86);
    const sc3 = scoreFase(mF3, 85);
    const sc4 = scoreFase(mF4, 90);

    const rodillaCarga = valores.flexionRodilla != null ? Math.round(valores.flexionRodilla) : null;
    const troncoCarga = valores.inclinacionTroncoCarga != null ? Math.round(valores.inclinacionTroncoCarga) : null;
    const codoArmado = valores.codoArmado != null ? Math.round(valores.codoArmado) : null;
    const codoContacto = valores.extensionCodoContacto != null ? Math.round(valores.extensionCodoContacto) : null;
    const hombroContacto = valores.elevacionBrazoContacto != null ? Math.round(valores.elevacionBrazoContacto) : null;
    const rodillaCaida = valores.amortiguacionRodilla != null ? Math.round(valores.amortiguacionRodilla) : null;
    const simetria = valores.simetriaAterrizaje != null ? Math.round((1 - Math.min(1, valores.simetriaAterrizaje)) * 100) : 94;

    const esRecepcion = gestoId === 'recepcion';
    const esVoleo = gestoId === 'voleo';

    const fases4 = {
        fase_1: {
            numero: 1,
            id: 'carga',
            nombre: esRecepcion ? 'Postura Base' : 'Preparación y Carga',
            subtitulo: esRecepcion ? 'Centro de gravedad bajo' : 'Aproximación y flexión de rodillas',
            frameIdx: indicesFases.carga,
            score: sc1,
            estado: estadoScore(sc1),
            metricas: [
                { label: 'Rodilla 3D', valor: rodillaCarga != null ? `${rodillaCarga}°` : '—' },
                { label: 'Tronco', valor: troncoCarga != null ? `${troncoCarga}°` : '—' },
            ],
            diagnostico:
                sc1 >= 80
                    ? 'Carga elástica biomecánicamente óptima en tren inferior.'
                    : `Ajustar flexión de rodillas (${rodillaCarga ?? '—'}°) para mejorar la transferencia de energía.`,
        },
        fase_2: {
            numero: 2,
            id: 'armado',
            nombre: esRecepcion ? 'Lectura y Acople' : esVoleo ? 'Armado sobre Frente' : 'Salto y Armado',
            subtitulo: esRecepcion ? 'Alineación de hombros' : 'Transición e impulso',
            frameIdx: indicesFases.armado,
            score: sc2,
            estado: estadoScore(sc2),
            metricas: [
                { label: 'Codo Armado', valor: codoArmado != null ? `${codoArmado}°` : '—' },
                { label: 'Velocidad', valor: `${velocidadPicoMs.toFixed(2)} m/s` },
            ],
            diagnostico:
                sc2 >= 80
                    ? 'Preparación articular y velocidad de ascenso adecuadas.'
                    : 'El armado del brazo puede abrirse/elevarse antes del impacto.',
        },
        fase_3: {
            numero: 3,
            id: 'contacto',
            nombre: esRecepcion ? 'Plataforma de Impacto' : 'Contacto Crítico (t₀)',
            subtitulo: esRecepcion ? 'Bloqueo de codos' : 'Vértice y extensión en impacto',
            frameIdx: indicesFases.contacto,
            score: sc3,
            estado: estadoScore(sc3),
            metricas: [
                { label: 'Extensión Codo', valor: codoContacto != null ? `${codoContacto}°` : '—' },
                { label: 'Elevación Hombro', valor: hombroContacto != null ? `${hombroContacto}°` : '—' },
            ],
            diagnostico:
                sc3 >= 80
                    ? 'Impacto en extensión terminal óptima.'
                    : `Extensión de codo en impacto (${codoContacto ?? '—'}°) por debajo del rango óptimo.`,
        },
        fase_4: {
            numero: 4,
            id: 'caida',
            nombre: esRecepcion || esVoleo ? 'Acompañamiento' : 'Finalización y Caída',
            subtitulo: esRecepcion || esVoleo ? 'Estabilidad post-toque' : 'Amortiguación bilateral',
            frameIdx: indicesFases.caida,
            score: sc4,
            estado: estadoScore(sc4),
            metricas: [
                { label: 'Amortiguación', valor: rodillaCaida != null ? `${rodillaCaida}°` : '—' },
                { label: 'Simetría', valor: `${simetria}%` },
            ],
            diagnostico:
                sc4 >= 80
                    ? 'Absorción cinética equilibrada y segura para rodillas.'
                    : 'Flexiona más ambas rodillas al finalizar para proteger el LCA.',
        },
    };

    let diagnosticoCausaRaiz = 'Técnica fluida y encadenamiento cinemático sin fallas biomecánicas críticas.';
    if (sc1 < 78 && sc3 < 78) {
        diagnosticoCausaRaiz = `La flexión insuficiente en Fase 1 (${rodillaCarga ?? '—'}°) limitó el impulso, obligando a compensar con el codo flexionado en el Contacto Crítico (${codoContacto ?? '—'}°).`;
    } else if (sc2 < 78 && sc3 < 78) {
        diagnosticoCausaRaiz = `El armado tardío en Fase 2 (${codoArmado ?? '—'}°) impidió alcanzar la extensión completa del brazo en Fase 3 (${codoContacto ?? '—'}°).`;
    } else if (sc3 < 78) {
        diagnosticoCausaRaiz = `Pérdida de alcance en Fase 3 (codo a ${codoContacto ?? '—'}°). Busca impactar el balón en el punto más alto de extensión.`;
    } else if (sc4 < 78) {
        diagnosticoCausaRaiz = `Atención preventiva en Fase 4: amortigua flexionando ambas rodillas (${rodillaCaida ?? '—'}°) para reducir el impacto articular.`;
    } else if (sc1 < 78) {
        diagnosticoCausaRaiz = `Mejora la flexión inicial de rodillas en Fase 1 (${rodillaCarga ?? '—'}°) para ganar mayor potencia elástica.`;
    }

    return { fases4, diagnosticoCausaRaiz };
}

/**
 * Extrae hasta 33 frames centrados en el evento para el Gemelo Digital 3D y Replay.
 */
function construirSecuencia3D(buf, tIni, tContact, tFin, torso) {
    const ventana = buf.filter((x) => x.t >= tIni - 120 && x.t <= tFin + 120);
    const fuente = ventana.length >= 4 ? ventana : buf.slice(-33);
    if (!fuente.length) return { frames: [], indicesFases: { carga: 0, armado: 0, contacto: 0, caida: 0 } };

    // Muestrear hasta 33 frames uniformemente asegurando incluir el frame más cercano a tContact
    const maxFrames = 33;
    let seleccionados = [];
    if (fuente.length <= maxFrames) {
        seleccionados = fuente;
    } else {
        for (let i = 0; i < maxFrames; i += 1) {
            const idx = Math.min(fuente.length - 1, Math.round((i * (fuente.length - 1)) / (maxFrames - 1)));
            seleccionados.push(fuente[idx]);
        }
    }

    let idxContacto = 0;
    let menorDiff = Infinity;
    seleccionados.forEach((f, idx) => {
        const d = Math.abs(f.t - tContact);
        if (d < menorDiff) {
            menorDiff = d;
            idxContacto = idx;
        }
    });

    const total = seleccionados.length;
    const idxCarga = Math.max(0, Math.min(idxContacto - 2, Math.floor(idxContacto * 0.35)));
    const idxArmado = Math.max(idxCarga + 1, Math.min(idxContacto - 1, Math.floor(idxContacto * 0.72)));
    const idxCaida = Math.min(total - 1, Math.max(idxContacto + 1, Math.floor((idxContacto + total - 1) * 0.75)));

    const tBase = seleccionados[0].t;
    const frames = seleccionados.map((x, idx) => {
        const cx = (x.p[LM.L_HIP].x + x.p[LM.R_HIP].x) / 2;
        const cy = (x.p[LM.L_HIP].y + x.p[LM.R_HIP].y) / 2;
        const puntos = {};
        for (const i of KEY_IDX) {
            const pt = x.p[i];
            const wPt = x.w?.[i];
            if (pt) {
                puntos[i] = {
                    x: r3((pt.x - cx) / torso),
                    y: r3((pt.y - cy) / torso),
                    z: wPt && isNum(wPt.z) ? r3(wPt.z * 2.2) : 0,
                    v: r3(pt.v),
                };
            }
        }
        const angulos = {};
        for (const id of KEY_ANGLES) {
            if (isNum(x.angles?.[id])) angulos[id] = Math.round(x.angles[id]);
        }
        let fase = 'preparacion';
        if (idx <= idxCarga) fase = 'carga';
        else if (idx < idxContacto) fase = 'armado';
        else if (idx === idxContacto) fase = 'contacto';
        else fase = 'caida';

        return {
            idx,
            t: Math.round(x.t - tBase),
            fase,
            puntos,
            angulos,
            speed: r3(Math.max(x.speed?.L ?? 0, x.speed?.R ?? 0) * 0.55),
            lift: r3(Math.max(0, x.lift ?? 0)),
        };
    });

    return {
        frames,
        indicesFases: {
            carga: Math.max(0, idxCarga),
            armado: Math.max(0, idxArmado),
            contacto: Math.max(0, idxContacto),
            caida: Math.max(0, idxCaida),
        },
    };
}

/**
 * @param standard estándar del movimiento (p. ej. REMATE, SAQUE, BLOQUEO, VOLEO, RECEPCION o AUTO)
 * @param opciones { nivel } nivel del deportista; se puede cambiar con setNivel
 */
export function createRepAnalyzer(standard = MOVIMIENTOS.remate, opciones = {}) {
    let stdActual = standard ?? MOVIMIENTOS.remate;
    let nivel = opciones.nivel;
    let s;

    const fresh = () => ({
        phase: 'sin_cuerpo',
        lastT: null,
        lostSince: null,
        groundY: null,
        torso: null,
        prevWrist: { L: null, R: null },
        speed: { L: 0, R: 0 },
        buffer: [],
        airborne: null,
        landing: null,
        groundAction: null, // para gestos sin salto (voleo, recepcion, saque de pie)
        refractoryUntil: 0,
        hitUntil: 0,
        cargaUntil: 0,
    });
    s = fresh();

    const reset = () => {
        s = fresh();
    };

    const abort = (t) => {
        s.airborne = null;
        s.landing = null;
        s.groundAction = null;
        s.refractoryUntil = t + 500;
    };

    // Construye y califica una repetición completa (con salto o de piso)
    function buildRep({ targetStandard, takeoffT, contactT, landT, endT, maxLift, contactSide, contactSpeed, torso }) {
        const buf = s.buffer;
        const cfg = targetStandard.deteccion;
        const inWindow = (t0, t1) => buf.filter((x) => x.t >= t0 && x.t <= t1);

        const dts = [];
        for (let i = 1; i < buf.length; i += 1) {
            if (buf[i - 1].t >= takeoffT && buf[i].t <= landT) dts.push(buf[i].t - buf[i - 1].t);
        }
        const dtMed = dts.length ? mediana(dts) : 1000 / 30;
        const fpsMedio = Math.round(1000 / dtMed);
        const ventana = Math.max(cfg.ventanaContactoMs, cfg.ventanaContactoCuadros * dtMed);

        const duracionVueloMs = maxLift > 0.08 ? Math.round(landT - takeoffT) : 0;
        const esSinSalto = targetStandard.id === 'voleo' || targetStandard.id === 'recepcion';
        // Estimación física de salto vertical en cm (con cortafuegos 0 cm para Voleo y Recepción)
        const saltoVerticalCm =
            esSinSalto || maxLift <= 0.06
                ? 0
                : Math.round(Math.min(95, Math.max(8, maxLift * 52 * 0.65 + (9.81 * (duracionVueloMs / 1000) ** 2 * 100) / 8 * 0.35)) * 10) / 10;

        const velocidadPicoMs = Math.round(Math.max(1.2, (contactSpeed || 2.5) * 0.55) * 100) / 100;

        const extras = {
            movimientoNombre: targetStandard.nombre,
            inicio: takeoffT,
            fin: endT,
            duracionVueloMs,
            alturaSalto: maxLift,
            saltoVerticalCm,
            velocidadPicoMs,
            fpsMedio,
        };

        const invalida = (motivo, brazo = null) => {
            const repInv = {
                movimiento: targetStandard.id,
                version: targetStandard.version,
                valida: false,
                motivo,
                score: null,
                medidas: [],
                errores: [],
                puntosClave: [],
                brazo,
                ...extras,
            };
            repInv.vozCoach = generarVozCoachRep(repInv);
            return repInv;
        };

        // Determinar lado dominante y momento de contacto
        const vuelo = inWindow(takeoffT, landT);
        let side = contactSide || 'R';
        let mejorT = contactT;
        if (targetStandard.id !== 'recepcion') {
            let mejorAlcance = -Infinity;
            for (const sd of SIDES) {
                for (const x of vuelo) {
                    if (x.wristY[sd] === null) continue;
                    const alcance = (x.shoulderY[sd] - x.wristY[sd]) / torso;
                    if (alcance > mejorAlcance) {
                        mejorAlcance = alcance;
                        side = sd;
                        mejorT = x.t;
                    }
                }
            }
        }
        const k = side === 'R' ? 'D' : 'I';

        const serie = (fn, lo, hi) =>
            buf
                .filter((x) => x.t >= lo - 2 * dtMed && x.t <= hi + 2 * dtMed)
                .map((x) => ({ t: x.t, v: fn(x) }));
        const maximo = (fn, lo, hi) => extremo(serie(fn, lo, hi), 'max', dtMed, lo, hi);
        const minimo = (fn, lo, hi) => extremo(serie(fn, lo, hi), 'min', dtMed, lo, hi);
        const codo = (x) =>
            targetStandard.id === 'bloqueo' || targetStandard.id === 'voleo' || targetStandard.id === 'recepcion'
                ? mean([x.angles.codoD, x.angles.codoI].filter(isNum))
                : x.angles[`codo${k}`];
        const hombro = (x) =>
            targetStandard.id === 'bloqueo' || targetStandard.id === 'voleo' || targetStandard.id === 'recepcion'
                ? mean([x.angles.hombroD, x.angles.hombroI].filter(isNum))
                : x.angles[`hombro${k}`];

        const g0 = mejorT - ventana;
        const g1 = mejorT + ventana;
        const armado = minimo(codo, mejorT - 450, mejorT - 50);

        const c0 = takeoffT - cfg.ventanaCargaMs;
        const cargaWin = inWindow(c0, takeoffT).filter((x) => x.kneeMean !== null);
        const rodilla = cargaWin.map((x) => x.kneeMean);
        const rodillaRef = dtMed <= 25 ? medianaMovil3(rodilla) : rodilla;
        let cargaIdx = -1;
        rodillaRef.forEach((v, i) => {
            if (cargaIdx < 0 || v < rodillaRef[cargaIdx]) cargaIdx = i;
        });

        const symVals = inWindow(landT, landT + 180).map((x) => Math.abs(x.ayL - x.ayR) / torso);

        const valores = {
            flexionRodilla: cargaIdx >= 0 ? minimo((x) => x.kneeMean, c0, takeoffT) : minimo((x) => x.kneeMean, takeoffT - 500, mejorT),
            inclinacionTroncoCarga:
                cargaIdx >= 0 ? cargaWin[cargaIdx].trunk : maximo((x) => x.trunk, takeoffT - 400, mejorT),
            codoArmado: armado,
            extensionCodoContacto: maximo(codo, g0, g1),
            elevacionBrazoContacto: maximo(hombro, g0, g1),
            alturaContacto: maximo(
                (x) => (x.noseY !== null && x.wristY[side] !== null ? (x.noseY - x.wristY[side]) / torso : null),
                g0,
                g1,
            ),
            amortiguacionRodilla: minimo((x) => x.kneeMean, landT, landT + cfg.ventanaAmortiguacionMs),
            simetriaAterrizaje: symVals.length ? mean(symVals) : 0.05,
        };

        // Si el usuario pidió estrictamente REMATE y subió ambos brazos rectos sin armar, avisar
        if (
            stdActual.id === 'remate' &&
            targetStandard.id === 'remate' &&
            armado !== null &&
            armado >= cfg.sinArmadoGrados
        ) {
            return invalida(
                'No se vio el armado del brazo: parece un bloqueo. En el remate el codo se dobla hacia atrás antes de golpear (o cambia el selector a Auto IA / Bloqueo).',
                side === 'R' ? 'derecho' : 'izquierdo',
            );
        }

        const rep = evaluarRepeticion(
            valores,
            targetStandard,
            {
                ...extras,
                brazo:
                    targetStandard.id === 'bloqueo' || targetStandard.id === 'voleo' || targetStandard.id === 'recepcion'
                        ? 'ambos brazos'
                        : side === 'R'
                          ? 'derecho'
                          : 'izquierdo',
                velocidadMuneca: contactSpeed,
            },
            { nivel },
        );

        const cercano = (tt) => buf.reduce((m, x) => (Math.abs(x.t - tt) < Math.abs(m.t - tt) ? x : m), buf[0]);
        const clave = (x) => {
            if (!x?.p) return null;
            const cx = (x.p[LM.L_HIP].x + x.p[LM.R_HIP].x) / 2;
            const cy = (x.p[LM.L_HIP].y + x.p[LM.R_HIP].y) / 2;
            const puntos = {};
            for (const i of KEY_IDX) {
                const p = x.p[i];
                const wPt = x.w?.[i];
                if (p) {
                    puntos[i] = {
                        x: r3((p.x - cx) / torso),
                        y: r3((p.y - cy) / torso),
                        z: wPt && isNum(wPt.z) ? r3(wPt.z * 2.2) : 0,
                        v: r3(p.v),
                    };
                }
            }
            const angulos = {};
            for (const id of KEY_ANGLES) if (isNum(x.angles?.[id])) angulos[id] = Math.round(x.angles[id]);
            return { t: x.t, puntos, angulos };
        };

        const armadoFrame = inWindow(mejorT - 420, mejorT - 40).reduce(
            (m, x) => (!m || (codo(x) ?? 180) < (codo(m) ?? 180) ? x : m),
            cercano(mejorT - 180),
        );
        const caidaFrame = inWindow(landT, landT + cfg.ventanaAmortiguacionMs)
            .filter((x) => x.kneeMean !== null)
            .reduce((m, x) => (!m || x.kneeMean < m.kneeMean ? x : m), cercano(landT + 120));

        const claves = {
            lado: side,
            carga: cargaIdx >= 0 ? clave(cargaWin[cargaIdx]) : clave(cercano(takeoffT - 150)),
            armado: clave(armadoFrame),
            contacto: clave(cercano(mejorT)),
            caida: clave(caidaFrame),
        };

        const { frames: secuencia3D, indicesFases } = construirSecuencia3D(
            buf,
            takeoffT - 250,
            mejorT,
            landT + 250,
            torso,
        );

        const { fases4, diagnosticoCausaRaiz } = construirFasesYDiagnostico({
            gestoId: targetStandard.id,
            medidas: rep.medidas,
            valores,
            indicesFases,
            velocidadPicoMs,
            saltoVerticalCm,
        });

        const resultadoFinal = {
            ...rep,
            confianza: confianzaDe(fpsMedio, rep.medidas),
            claves,
            fases4,
            diagnosticoCausaRaiz,
            secuencia3D,
        };
        resultadoFinal.vozCoach = generarVozCoachRep(resultadoFinal);
        return resultadoFinal;
    }

    // Cierra una repetición aérea (Remate, Bloqueo o Saque en salto)
    function finalizeAerial(land, t) {
        const a = land.air;
        const buf = s.buffer;
        const cfg = stdActual.deteccion;
        const inWindow = (t0, t1) => buf.filter((x) => x.t >= t0 && x.t <= t1);
        const vuelo = inWindow(a.takeoffT, land.tLand);

        // Detectar si ambas muñecas subieron por encima de los hombros (típico de Bloqueo)
        const ambosBrazosArriba = vuelo.some(
            (x) =>
                x.wristY.L !== null &&
                x.wristY.R !== null &&
                x.wristY.L < x.shoulderY.L &&
                x.wristY.R < x.shoulderY.R,
        );

        // Determinar qué estándar aplicar si estamos en modo AUTO
        let targetStandard = stdActual;
        if (stdActual.esAuto) {
            // Revisar flexión mínima de codo antes del punto más alto
            const codosVuelo = vuelo
                .flatMap((x) => [x.angles.codoD, x.angles.codoI])
                .filter(isNum);
            const minCodoVuelo = codosVuelo.length ? Math.min(...codosVuelo) : 160;
            if (ambosBrazosArriba && minCodoVuelo >= 132) {
                targetStandard = MOVIMIENTOS.bloqueo;
            } else {
                targetStandard = MOVIMIENTOS.remate;
            }
        }

        // Si es bloqueo y no hubo `a.contact` por velocidad de látigo, buscar el ápice de altura de manos
        let contact = a.contact;
        if (!contact && (targetStandard.id === 'bloqueo' || ambosBrazosArriba)) {
            let bestFrame = vuelo[Math.floor(vuelo.length / 2)] ?? buf[buf.length - 1];
            let minWristY = Infinity;
            for (const x of vuelo) {
                const wy = Math.min(x.wristY.L ?? Infinity, x.wristY.R ?? Infinity);
                if (wy < minWristY) {
                    minWristY = wy;
                    bestFrame = x;
                }
            }
            if (bestFrame && minWristY < Math.min(bestFrame.shoulderY.L, bestFrame.shoulderY.R)) {
                contact = {
                    t: bestFrame.t,
                    speed: Math.max(bestFrame.speed.L, bestFrame.speed.R, 2.0),
                    side: (bestFrame.wristY.R ?? Infinity) <= (bestFrame.wristY.L ?? Infinity) ? 'R' : 'L',
                };
            }
        }

        if (!contact) {
            const repInv = {
                movimiento: targetStandard.id,
                movimientoNombre: targetStandard.nombre,
                version: targetStandard.version,
                valida: false,
                motivo: 'No se detectó el gesto de brazos en el aire. Eleva los brazos sobre los hombros.',
                score: null,
                medidas: [],
                errores: [],
                puntosClave: [],
                brazo: null,
                inicio: a.takeoffT,
                fin: t,
                duracionVueloMs: Math.round(land.tLand - a.t0),
                alturaSalto: a.maxLift,
                saltoVerticalCm: 0,
                fpsMedio: 30,
            };
            repInv.vozCoach = generarVozCoachRep(repInv);
            return repInv;
        }

        return buildRep({
            targetStandard,
            takeoffT: a.takeoffT,
            contactT: contact.t,
            landT: land.tLand,
            endT: t,
            maxLift: a.maxLift,
            contactSide: contact.side,
            contactSpeed: contact.speed,
            torso: a.torso,
        });
    }

    /**
     * @param frame { t (ms), pts (px, con v) | null, worldPts (3D) | null, angles (3D) }
     * @returns { phase, rep, debug }
     */
    function push({ t, pts, worldPts, angles }) {
        const cfg = stdActual.deteccion;
        const body = pts ? readBody(pts) : null;

        if (!body) {
            if (s.lostSince === null) s.lostSince = t;
            const busy = Boolean(s.airborne || s.landing || s.groundAction);
            if (busy && t - s.lostSince > cfg.perdidaMaxMs) abort(t);
            if (!s.airborne && !s.landing && !s.groundAction) s.phase = 'sin_cuerpo';
            return { phase: s.phase, rep: null, debug: { cuerpo: false } };
        }
        s.lostSince = null;

        const dt = s.lastT === null ? 0 : Math.max(0, t - s.lastT);
        s.lastT = t;
        const busy = Boolean(s.airborne || s.landing || s.groundAction);

        if (s.torso === null) s.torso = body.torso;
        else if (!busy) s.torso += (body.torso - s.torso) * emaAlpha(dt, 1500);
        const torso = s.torso;

        const lowest = Math.max(body.ankleL.y, body.ankleR.y);
        if (s.groundY === null) s.groundY = lowest;
        const lift = (s.groundY - lowest) / torso;
        if (!busy && lift < 0.05) s.groundY += (lowest - s.groundY) * emaAlpha(dt, 1500);

        for (const side of SIDES) {
            const p = pts[WRIST[side]];
            const prev = s.prevWrist[side];
            if (seen(p) && prev && dt > 0) {
                const inst = ((Math.hypot(p.x - prev.x, p.y - prev.y) / dt) * 1000) / torso;
                s.speed[side] += (inst - s.speed[side]) * emaAlpha(dt, 20);
            } else {
                s.speed[side] = 0;
            }
            s.prevWrist[side] = seen(p) ? { x: p.x, y: p.y } : null;
        }

        const knees = [angles?.rodillaD, angles?.rodillaI].filter(isNum);
        const kneeMean = knees.length ? mean(knees) : null;
        if (kneeMean !== null && kneeMean < cfg.cargaRodillaMax) s.cargaUntil = t + 400;

        const wristY = {};
        const wristX = {};
        const shoulderY = {};
        for (const side of SIDES) {
            wristY[side] = seen(pts[WRIST[side]]) ? pts[WRIST[side]].y : null;
            wristX[side] = seen(pts[WRIST[side]]) ? pts[WRIST[side]].x : null;
            shoulderY[side] = pts[SHOULDER[side]].y;
        }

        const claveP = {};
        const claveW = {};
        for (const i of KEY_IDX) {
            claveP[i] = pts[i] ? { x: pts[i].x, y: pts[i].y, v: pts[i].v } : null;
            claveW[i] = worldPts?.[i] ? { x: worldPts[i].x, y: worldPts[i].y, z: worldPts[i].z } : null;
        }
        s.buffer.push({
            t,
            p: claveP,
            w: claveW,
            lift,
            kneeMean,
            trunk: isNum(angles?.tronco) ? angles.tronco : null,
            angles: angles ?? {},
            noseY: body.noseY,
            wristY,
            wristX,
            shoulderY,
            ayL: body.ankleL.y,
            ayR: body.ankleR.y,
            speed: { L: s.speed.L, R: s.speed.R },
        });
        while (s.buffer.length && t - s.buffer[0].t > BUFFER_MS) s.buffer.shift();

        // ── 1. Detección de salto (Remate, Bloqueo, Saque en salto o Auto) ───
        const permiteSalto = stdActual.esAuto || stdActual.id === 'remate' || stdActual.id === 'bloqueo' || stdActual.id === 'saque';
        if (permiteSalto && !s.airborne && !s.landing && t >= s.refractoryUntil && lift > cfg.saltoMinTorsos) {
            s.groundAction = null;
            s.airborne = { t0: t, takeoffT: findTakeoff(s.buffer, t), maxLift: lift, contact: null, torso };
            s.hitUntil = 0;
        }

        let hitNow = false;
        if (s.airborne) {
            const a = s.airborne;
            a.maxLift = Math.max(a.maxLift, lift);

            const minVel = stdActual.id === 'bloqueo' ? 1.4 : cfg.golpeVelocidadMin;
            for (const side of SIDES) {
                const above = wristY[side] !== null && wristY[side] < shoulderY[side];
                if (above && s.speed[side] > minVel) {
                    hitNow = true;
                    if (!a.contact || s.speed[side] > a.contact.speed) {
                        a.contact = { t, speed: s.speed[side], side };
                    }
                }
            }

            if (hitNow) s.hitUntil = t + 250;

            if (t - a.t0 > cfg.vueloMaxMs) {
                abort(t);
            } else if (lift < cfg.aterrizajeTorsos) {
                if (t - a.t0 < cfg.vueloMinMs) {
                    s.airborne = null;
                    s.refractoryUntil = t + 300;
                } else {
                    s.landing = { tLand: t, air: a };
                    s.airborne = null;
                }
            }
        }

        let rep = null;
        if (s.landing && t - s.landing.tLand >= cfg.ventanaAmortiguacionMs) {
            rep = finalizeAerial(s.landing, t);
            s.landing = null;
            s.refractoryUntil = t + cfg.refractarioMs;
        }

        // ── 2. Detección de gestos sin salto (Voleo, Recepción, Saque de pie, o Auto en piso) ──
        if (!s.airborne && !s.landing && !rep && t >= s.refractoryUntil) {
            const maxSpeed = Math.max(s.speed.L, s.speed.R);
            const ambasArribaHombros =
                wristY.L !== null &&
                wristY.R !== null &&
                wristY.L < shoulderY.L &&
                wristY.R < shoulderY.R;
            const algunaArribaHombro =
                (wristY.L !== null && wristY.L < shoulderY.L) ||
                (wristY.R !== null && wristY.R < shoulderY.R);
            const munecasJuntasBajas =
                wristX.L !== null &&
                wristX.R !== null &&
                wristY.L !== null &&
                wristY.R !== null &&
                Math.abs(wristX.L - wristX.R) / torso < 0.62 &&
                wristY.L > shoulderY.L &&
                wristY.R > shoulderY.R &&
                (angles?.codoD ?? 0) >= 145 &&
                (angles?.codoI ?? 0) >= 145 &&
                kneeMean !== null &&
                kneeMean < 142;

            if (!s.groundAction) {
                if ((stdActual.id === 'voleo' || stdActual.esAuto) && ambasArribaHombros && maxSpeed > 1.6) {
                    s.groundAction = {
                        tipo: 'voleo',
                        tStart: Math.max(s.buffer[0]?.t ?? t, t - 420),
                        tContact: t,
                        maxSpeed,
                        side: s.speed.R >= s.speed.L ? 'R' : 'L',
                        torso,
                    };
                    s.hitUntil = t + 260;
                } else if ((stdActual.id === 'recepcion' || stdActual.esAuto) && munecasJuntasBajas && maxSpeed > 1.15) {
                    s.groundAction = {
                        tipo: 'recepcion',
                        tStart: Math.max(s.buffer[0]?.t ?? t, t - 450),
                        tContact: t,
                        maxSpeed,
                        side: 'R',
                        torso,
                    };
                    s.hitUntil = t + 260;
                } else if (stdActual.id === 'saque' && algunaArribaHombro && maxSpeed > 2.6) {
                    s.groundAction = {
                        tipo: 'saque',
                        tStart: Math.max(s.buffer[0]?.t ?? t, t - 480),
                        tContact: t,
                        maxSpeed,
                        side: s.speed.R >= s.speed.L ? 'R' : 'L',
                        torso,
                    };
                    s.hitUntil = t + 260;
                }
            } else {
                // Actualizar pico de contacto durante la ventana activa
                if (maxSpeed > s.groundAction.maxSpeed && t - s.groundAction.tContact < 240) {
                    s.groundAction.maxSpeed = maxSpeed;
                    s.groundAction.tContact = t;
                }
                // Cerrar gesto de piso tras 380 ms de seguimiento post-contacto
                if (t - s.groundAction.tContact >= 380) {
                    const ga = s.groundAction;
                    s.groundAction = null;
                    s.refractoryUntil = t + 950;
                    const stdTarget = obtenerMovimiento(ga.tipo);
                    rep = buildRep({
                        targetStandard: stdTarget,
                        takeoffT: ga.tStart,
                        contactT: ga.tContact,
                        landT: ga.tContact + 160,
                        endT: t,
                        maxLift: Math.max(0, lift),
                        contactSide: ga.side,
                        contactSpeed: ga.maxSpeed,
                        torso: ga.torso,
                    });
                }
            }
        }

        // ── Fase en vivo para el HUD ─────────────────────────────
        if (s.landing) s.phase = 'caida';
        else if (s.airborne || s.groundAction) s.phase = t < s.hitUntil ? 'golpeo' : 'vuelo';
        else s.phase = t < s.cargaUntil ? 'carga' : 'preparacion';

        const debug = {
            cuerpo: true,
            lift,
            speedL: s.speed.L,
            speedR: s.speed.R,
            kneeMean,
            aire: Boolean(s.airborne),
            enAireMs: s.airborne ? t - s.airborne.t0 : 0,
            gestoActivo: stdActual.id,
        };

        return { phase: s.phase, rep, debug };
    }

    const setNivel = (nuevo) => {
        nivel = nuevo;
    };

    const setStandard = (nuevoStd) => {
        if (!nuevoStd) return;
        stdActual = typeof nuevoStd === 'string' ? obtenerMovimiento(nuevoStd) : nuevoStd;
    };

    return { push, reset, setNivel, setStandard };
}
