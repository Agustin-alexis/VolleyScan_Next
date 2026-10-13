// ─────────────────────────────────────────────────────────────
// repAnalyzer.js — Motor de análisis de repeticiones (VolleyScan)
//
// Recibe, cuadro a cuadro, los puntos del cuerpo y los ángulos ya
// medidos. Detecta cuándo empieza y termina un remate y, al terminar,
// devuelve la repetición calificada.
//
// Cómo detecta las fases (sin pedirle nada al deportista):
//   · DESPEGUE : los dos pies suben por encima de su nivel de suelo
//   · GOLPEO   : dentro del vuelo, el pico de velocidad de la muñeca
//                cuando está por encima del hombro (ese es el brazo
//                de golpeo: se identifica solo)
//   · CAÍDA    : los pies vuelven al suelo
//   · CARGA    : mirando atrás desde el despegue, el momento de máxima
//                flexión de rodillas
//
// Todas las distancias se normalizan por el largo del torso, así el
// resultado no depende de qué tan lejos esté la cámara.
//
// Requisitos de la grabación: cámara fija, deportista de cuerpo
// completo, y que no se acerque o aleje mucho de la cámara durante el
// salto (el suelo se toma como la altura de los pies antes de saltar).
//
// JavaScript puro: se prueba en Node sin cámara ni navegador.
// ─────────────────────────────────────────────────────────────

import { LM, MIN_VISIBILITY } from '@/lib/pose/geometry';
import { evaluarRepeticion } from './scorer';

const BUFFER_MS = 3500; // historial reciente que se conserva para mirar atrás
const SIDES = ['L', 'R'];
const WRIST = { L: LM.L_WRIST, R: LM.R_WRIST };
const SHOULDER = { L: LM.L_SHOULDER, R: LM.R_SHOULDER };

// Factor de una media móvil exponencial con constante de tiempo tauMs
const emaAlpha = (dt, tauMs) => 1 - Math.exp(-dt / tauMs);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const seen = (p) => Boolean(p) && p.v >= MIN_VISIBILITY;
const mean = (arr) => arr.reduce((acc, n) => acc + n, 0) / arr.length;

// Lee del esqueleto lo que el motor necesita; null si no se ve lo básico.
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

// Último instante en que los pies aún estaban en el suelo (para fechar el despegue real)
function findTakeoff(buffer, t0) {
    for (let i = buffer.length - 1; i >= 0; i -= 1) {
        if (buffer[i].lift < 0.03 || t0 - buffer[i].t > 300) return buffer[i].t;
    }
    return t0;
}

export function createRepAnalyzer(standard) {
    const cfg = standard.deteccion;
    let s;

    const fresh = () => ({
        phase: 'sin_cuerpo',
        lastT: null,
        lostSince: null,
        groundY: null, // altura de los pies en el suelo (px)
        torso: null, // largo del torso (px)
        prevWrist: { L: null, R: null },
        speed: { L: 0, R: 0 }, // velocidad de cada muñeca (torsos/s)
        buffer: [],
        airborne: null,
        landing: null,
        refractoryUntil: 0,
        hitUntil: 0, // la etiqueta "golpeo" se mantiene un instante (evita el parpadeo)
        cargaUntil: 0, // ídem para "carga"
    });
    s = fresh();

    const reset = () => {
        s = fresh();
    };

    const abort = (t) => {
        s.airborne = null;
        s.landing = null;
        s.refractoryUntil = t + 500;
    };

    // Cierra la repetición: mide cada fase y la califica
    function finalize(land, t) {
        const a = land.air;
        const buf = s.buffer;
        const inWindow = (t0, t1) => buf.filter((x) => x.t >= t0 && x.t <= t1);

        const extras = {
            inicio: a.takeoffT,
            fin: t,
            duracionVueloMs: Math.round(land.tLand - a.t0),
            alturaSalto: a.maxLift, // en torsos
        };

        if (!a.contact) {
            return {
                movimiento: standard.id,
                version: standard.version,
                valida: false,
                motivo: 'No se detectó el golpeo. Lleva el brazo por encima del hombro con un movimiento rápido.',
                score: null,
                medidas: [],
                errores: [],
                puntosClave: [],
                brazo: null,
                ...extras,
            };
        }

        const side = a.contact.side;
        const k = side === 'R' ? 'D' : 'I';

        // Instante de contacto. El pico de velocidad solo sirve para saber QUÉ
        // brazo golpea: al armar el brazo también hay mucha velocidad. El
        // contacto real es el punto MÁS ALTO de la muñeca (respecto al hombro)
        // entre los cuadros rápidos (≥ 50 % del pico) con la muñeca sobre el hombro.
        const rapido = a.contact.speed * 0.5;
        const altura = (x) => x.shoulderY[side] - x.wristY[side];
        const candidatos = inWindow(a.takeoffT, land.tLand).filter(
            (x) => x.wristY[side] !== null && altura(x) > 0 && x.speed[side] >= rapido,
        );
        const contactT = candidatos.length
            ? candidatos.reduce((mejor, x) => (altura(x) > altura(mejor) ? x : mejor)).t
            : a.contact.t;

        // Golpeo: se toma el mejor valor alrededor del contacto (± ventanaContactoMs)
        const hitWin = inWindow(contactT - cfg.ventanaContactoMs, contactT + cfg.ventanaContactoMs);
        const maxOf = (fn) => {
            const vals = hitWin.map(fn).filter(isNum);
            return vals.length ? Math.max(...vals) : null;
        };

        // Armado: codo más cerrado en los ~450 ms previos al golpe
        const armVals = inWindow(contactT - 450, contactT - 60)
            .map((x) => x.angles[`codo${k}`])
            .filter(isNum);

        // Carga: instante de máxima flexión de rodillas antes del despegue
        const cargaSample = inWindow(a.takeoffT - cfg.ventanaCargaMs, a.takeoffT)
            .filter((x) => x.kneeMean !== null)
            .reduce((best, x) => (!best || x.kneeMean < best.kneeMean ? x : best), null);

        // Caída: rodilla más flexionada al aterrizar y simetría de los pies
        const landVals = inWindow(land.tLand, land.tLand + cfg.ventanaAmortiguacionMs)
            .map((x) => x.kneeMean)
            .filter(isNum);
        const symVals = inWindow(land.tLand, land.tLand + 150).map(
            (x) => Math.abs(x.ayL - x.ayR) / a.torso,
        );

        const valores = {
            flexionRodilla: cargaSample ? cargaSample.kneeMean : null,
            inclinacionTroncoCarga: cargaSample ? cargaSample.trunk : null,
            codoArmado: armVals.length ? Math.min(...armVals) : null,
            extensionCodoContacto: maxOf((x) => x.angles[`codo${k}`]),
            elevacionBrazoContacto: maxOf((x) => x.angles[`hombro${k}`]),
            alturaContacto: maxOf((x) =>
                x.noseY !== null && x.wristY[side] !== null ? (x.noseY - x.wristY[side]) / a.torso : null,
            ),
            amortiguacionRodilla: landVals.length ? Math.min(...landVals) : null,
            simetriaAterrizaje: symVals.length ? mean(symVals) : null,
        };

        return evaluarRepeticion(valores, standard, {
            ...extras,
            brazo: side === 'R' ? 'derecho' : 'izquierdo',
            velocidadMuneca: a.contact.speed, // torsos/s
        });
    }

    /**
     * @param frame { t (ms), pts (px, con v) | null, angles (3D) }
     * @returns { phase, rep }  rep es null salvo cuando termina un remate
     */
    function push({ t, pts, angles }) {
        const body = pts ? readBody(pts) : null;

        // Sin cuerpo visible
        if (!body) {
            if (s.lostSince === null) s.lostSince = t;
            const busy = Boolean(s.airborne || s.landing);
            if (busy && t - s.lostSince > cfg.perdidaMaxMs) abort(t);
            if (!s.airborne && !s.landing) s.phase = 'sin_cuerpo';
            return { phase: s.phase, rep: null };
        }
        s.lostSince = null;

        const dt = s.lastT === null ? 0 : Math.max(0, t - s.lastT);
        s.lastT = t;
        const busy = Boolean(s.airborne || s.landing);

        // Tamaño de referencia (torso) y nivel del suelo: se adaptan despacio
        // y se congelan durante el salto para no "aprender" el salto como suelo.
        if (s.torso === null) s.torso = body.torso;
        else if (!busy) s.torso += (body.torso - s.torso) * emaAlpha(dt, 1500);
        const torso = s.torso;

        const lowest = Math.max(body.ankleL.y, body.ankleR.y); // el pie más cercano al suelo
        if (s.groundY === null) s.groundY = lowest;
        const lift = (s.groundY - lowest) / torso;
        if (!busy && lift < 0.05) s.groundY += (lowest - s.groundY) * emaAlpha(dt, 1500);

        // Velocidad de cada muñeca, en torsos por segundo
        for (const side of SIDES) {
            const p = pts[WRIST[side]];
            const prev = s.prevWrist[side];
            if (seen(p) && prev && dt > 0) {
                const inst = ((Math.hypot(p.x - prev.x, p.y - prev.y) / dt) * 1000) / torso;
                s.speed[side] = s.speed[side] * 0.4 + inst * 0.6;
            } else {
                s.speed[side] = 0;
            }
            s.prevWrist[side] = seen(p) ? { x: p.x, y: p.y } : null;
        }

        // Rodilla media (si solo se ve una pierna, se usa esa)
        const knees = [angles?.rodillaD, angles?.rodillaI].filter(isNum);
        const kneeMean = knees.length ? mean(knees) : null;
        if (kneeMean !== null && kneeMean < cfg.cargaRodillaMax) s.cargaUntil = t + 400;

        const wristY = {};
        const shoulderY = {};
        for (const side of SIDES) {
            wristY[side] = seen(pts[WRIST[side]]) ? pts[WRIST[side]].y : null;
            shoulderY[side] = pts[SHOULDER[side]].y;
        }

        // Se guarda una muestra liviana para poder mirar atrás al cerrar la repetición
        s.buffer.push({
            t,
            lift,
            kneeMean,
            trunk: isNum(angles?.tronco) ? angles.tronco : null,
            angles: angles ?? {},
            noseY: body.noseY,
            wristY,
            shoulderY,
            ayL: body.ankleL.y,
            ayR: body.ankleR.y,
            speed: { L: s.speed.L, R: s.speed.R },
        });
        while (s.buffer.length && t - s.buffer[0].t > BUFFER_MS) s.buffer.shift();

        // ── Despegue ───────────────────────────────────────────
        if (!s.airborne && !s.landing && t >= s.refractoryUntil && lift > cfg.saltoMinTorsos) {
            s.airborne = { t0: t, takeoffT: findTakeoff(s.buffer, t), maxLift: lift, contact: null, torso };
            s.hitUntil = 0;
        }

        // ── En el aire: buscar el golpeo y detectar el aterrizaje ──
        let hitNow = false;
        if (s.airborne) {
            const a = s.airborne;
            a.maxLift = Math.max(a.maxLift, lift);

            for (const side of SIDES) {
                const above = wristY[side] !== null && wristY[side] < shoulderY[side];
                if (above && s.speed[side] > cfg.golpeVelocidadMin) {
                    hitNow = true;
                    if (!a.contact || s.speed[side] > a.contact.speed) {
                        a.contact = { t, speed: s.speed[side], side };
                    }
                }
            }

            if (hitNow) s.hitUntil = t + 250;

            if (t - a.t0 > cfg.vueloMaxMs) {
                abort(t); // vuelo imposible: error de seguimiento
            } else if (lift < cfg.aterrizajeTorsos) {
                if (t - a.t0 < cfg.vueloMinMs) {
                    s.airborne = null; // fue un temblor, no un salto
                    s.refractoryUntil = t + 300;
                } else {
                    s.landing = { tLand: t, air: a };
                    s.airborne = null;
                }
            }
        }

        // ── Cierre: terminó la ventana de amortiguación ────────
        let rep = null;
        if (s.landing && t - s.landing.tLand >= cfg.ventanaAmortiguacionMs) {
            rep = finalize(s.landing, t);
            s.landing = null;
            s.refractoryUntil = t + cfg.refractarioMs;
        }

        // ── Fase en vivo, para mostrar en pantalla ─────────────
        if (s.landing) s.phase = 'caida';
        else if (s.airborne) s.phase = t < s.hitUntil ? 'golpeo' : 'vuelo';
        else s.phase = t < s.cargaUntil ? 'carga' : 'preparacion';

        return { phase: s.phase, rep };
    }

    return { push, reset };
}