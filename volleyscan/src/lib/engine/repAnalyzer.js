
import { LM, MIN_VISIBILITY } from '@/lib/pose/geometry';
import { evaluarRepeticion } from '@/lib/engine/scorer';

const BUFFER_MS = 3500; // historial reciente que se conserva para mirar atrás
const SIDES = ['L', 'R'];
const WRIST = { L: LM.L_WRIST, R: LM.R_WRIST };
const SHOULDER = { L: LM.L_SHOULDER, R: LM.R_SHOULDER };

// Puntos que se conservan de cada cuadro para dibujar la "foto de la técnica"
const KEY_IDX = [
    LM.NOSE, LM.L_SHOULDER, LM.R_SHOULDER, LM.L_ELBOW, LM.R_ELBOW, LM.L_WRIST, LM.R_WRIST,
    LM.L_HIP, LM.R_HIP, LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE,
];
const KEY_ANGLES = ['codoD', 'codoI', 'hombroD', 'hombroI', 'rodillaD', 'rodillaI', 'tronco'];
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

// Filtro de mediana de 3 muestras: quita picos sueltos de la estimación de pose.
function medianaMovil3(vals) {
    if (vals.length < 3) return vals;
    return vals.map((v, i) => (i === 0 || i === vals.length - 1 ? v : mediana([vals[i - 1], v, vals[i + 1]])));
}

// Pendiente (por ms) de una serie [{t, v}] en el punto i, por diferencias centrales
function pendiente(pts, i) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    return b.t === a.t ? 0 : (b.v - a.v) / (b.t - a.t);
}

/**
 * Máximo o mínimo de una serie temporal [{t, v}] dentro de [lo, hi].
 * Se comporta distinto según cuántos cuadros haya:
 *   · MUCHOS cuadros (≥ 40 fps): el ruido de la pose es el problema. Se filtra
 *     con mediana de 3; sin filtro el máximo sale 4 a 6° demasiado alto.
 *   · POCOS cuadros: el problema es que el pico cae ENTRE dos cuadros (el golpe
 *     dura ~80 ms y a 12 fps un cuadro dura 83). Filtrar lo aplastaría, así que
 *     se interpola (cúbica de Hermite) y se busca el pico en la curva.
 * La serie puede traer cuadros de más fuera de [lo, hi]: sirven de apoyo.
 */
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
        if (h <= 0 || h > 400) continue; // un hueco largo no se interpola
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

// Qué tan fiable es la medición de un remate, según los fps reales y los datos que faltaron
function confianzaDe(fps, medidas) {
    const sinDato = medidas.filter((m) => m.valor === null).length;
    if (fps >= 30 && sinDato <= 1) return 'alta';
    if (fps >= 20 && sinDato <= 2) return 'media';
    return 'baja';
}

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

/**
 * @param standard estándar del movimiento (p. ej. REMATE)
 * @param opciones { nivel } nivel del deportista; se puede cambiar con setNivel
 */
export function createRepAnalyzer(standard, opciones = {}) {
    const cfg = standard.deteccion;
    let nivel = opciones.nivel;
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

        // Cada cuánto llegan los cuadros durante el vuelo (los fps reales, no los pedidos)
        const dts = [];
        for (let i = 1; i < buf.length; i += 1) {
            if (buf[i - 1].t >= a.takeoffT && buf[i].t <= land.tLand) dts.push(buf[i].t - buf[i - 1].t);
        }
        const dtMed = dts.length ? mediana(dts) : 1000 / 30;
        const fpsMedio = Math.round(1000 / dtMed);
        // Con pocos fps el golpe cae entre dos cuadros: la ventana crece con el periodo
        const ventana = Math.max(cfg.ventanaContactoMs, cfg.ventanaContactoCuadros * dtMed);

        const extras = {
            inicio: a.takeoffT,
            fin: t,
            duracionVueloMs: Math.round(land.tLand - a.t0),
            alturaSalto: a.maxLift, // en torsos
            fpsMedio,
        };

        const invalida = (motivo, brazo = null) => ({
            movimiento: standard.id,
            version: standard.version,
            valida: false,
            motivo,
            score: null,
            medidas: [],
            errores: [],
            puntosClave: [],
            brazo,
            ...extras,
        });

        if (!a.contact) {
            return invalida('No se detectó el golpeo. Lleva el brazo por encima del hombro con un movimiento rápido.');
        }

        // Brazo y instante de contacto, por ALCANCE y no por velocidad: el brazo que
        // golpea es el que llega más alto sobre el hombro durante el vuelo, y el
        // contacto es ese punto más alto. La velocidad no sirve para esto: en el
        // golpe la muñeca va tan rápida que sale borrosa y la cámara la pierde
        // justo ahí, y al armar el brazo también hay mucha velocidad.
        // (La velocidad solo confirma que hubo un golpe: ver `a.contact`.)
        const vuelo = inWindow(a.takeoffT, land.tLand);
        let side = a.contact.side;
        let contactT = a.contact.t;
        let mejorAlcance = -Infinity;
        for (const sd of SIDES) {
            for (const x of vuelo) {
                if (x.wristY[sd] === null) continue;
                const alcance = (x.shoulderY[sd] - x.wristY[sd]) / a.torso;
                if (alcance > mejorAlcance) {
                    mejorAlcance = alcance;
                    side = sd;
                    contactT = x.t;
                }
            }
        }
        const k = side === 'R' ? 'D' : 'I';

        // Serie temporal de una medida, con cuadros de apoyo fuera de [lo, hi] para interpolar
        const serie = (fn, lo, hi) =>
            buf
                .filter((x) => x.t >= lo - 2 * dtMed && x.t <= hi + 2 * dtMed)
                .map((x) => ({ t: x.t, v: fn(x) }));
        const maximo = (fn, lo, hi) => extremo(serie(fn, lo, hi), 'max', dtMed, lo, hi);
        const minimo = (fn, lo, hi) => extremo(serie(fn, lo, hi), 'min', dtMed, lo, hi);
        const codo = (x) => x.angles[`codo${k}`];

        // Golpeo: se toma el mejor valor alrededor del contacto (± la ventana)
        const g0 = contactT - ventana;
        const g1 = contactT + ventana;

        // Armado: codo más cerrado en los ~450 ms previos al golpe
        const armado = minimo(codo, contactT - 450, contactT - 60);

        // Carga: instante de máxima flexión de rodillas antes del despegue. La
        // inclinación del tronco se lee en ese mismo cuadro.
        const c0 = a.takeoffT - cfg.ventanaCargaMs;
        const cargaWin = inWindow(c0, a.takeoffT).filter((x) => x.kneeMean !== null);
        const rodilla = cargaWin.map((x) => x.kneeMean);
        const rodillaRef = dtMed <= 25 ? medianaMovil3(rodilla) : rodilla;
        let cargaIdx = -1;
        rodillaRef.forEach((v, i) => {
            if (cargaIdx < 0 || v < rodillaRef[cargaIdx]) cargaIdx = i;
        });

        // Caída: rodilla más flexionada al aterrizar y simetría de los pies
        const symVals = inWindow(land.tLand, land.tLand + 150).map(
            (x) => Math.abs(x.ayL - x.ayR) / a.torso,
        );

        const valores = {
            flexionRodilla: cargaIdx >= 0 ? minimo((x) => x.kneeMean, c0, a.takeoffT) : null,
            inclinacionTroncoCarga: cargaIdx >= 0 ? cargaWin[cargaIdx].trunk : null,
            codoArmado: armado,
            extensionCodoContacto: maximo(codo, g0, g1),
            elevacionBrazoContacto: maximo((x) => x.angles[`hombro${k}`], g0, g1),
            alturaContacto: maximo(
                (x) => (x.noseY !== null && x.wristY[side] !== null ? (x.noseY - x.wristY[side]) / a.torso : null),
                g0,
                g1,
            ),
            amortiguacionRodilla: minimo((x) => x.kneeMean, land.tLand, land.tLand + cfg.ventanaAmortiguacionMs),
            simetriaAterrizaje: symVals.length ? mean(symVals) : null,
        };

        // ¿Se armó el brazo? Un salto vertical (bloqueo) sube los brazos rectos: el
        // codo nunca se dobla. Sin armado no es un remate. (Si el brazo se armó pero
        // no se extendió al golpear, eso NO invalida el remate: es un error de
        // técnica y lo castiga el score en "extensión del codo".)
        if (armado !== null && armado >= cfg.sinArmadoGrados) {
            return invalida(
                'No se vio el armado del brazo: parece un salto vertical o un bloqueo. En el remate el codo se dobla hacia atrás y se extiende al golpear.',
                side === 'R' ? 'derecho' : 'izquierdo',
            );
        }

        const rep = evaluarRepeticion(
            valores,
            standard,
            {
                ...extras,
                brazo: side === 'R' ? 'derecho' : 'izquierdo',
                velocidadMuneca: a.contact.speed, // torsos/s
            },
            { nivel },
        );
        // Cuadros clave para la foto de la técnica: el esqueleto se guarda centrado
        // en la cadera y en unidades de torso, así se dibuja igual sin importar la
        // distancia a la cámara.
        const cercano = (tt) => buf.reduce((m, x) => (Math.abs(x.t - tt) < Math.abs(m.t - tt) ? x : m), buf[0]);
        const clave = (x) => {
            if (!x?.p) return null;
            const cx = (x.p[LM.L_HIP].x + x.p[LM.R_HIP].x) / 2;
            const cy = (x.p[LM.L_HIP].y + x.p[LM.R_HIP].y) / 2;
            const puntos = {};
            for (const i of KEY_IDX) {
                const p = x.p[i];
                if (p) puntos[i] = { x: r3((p.x - cx) / a.torso), y: r3((p.y - cy) / a.torso), v: r3(p.v) };
            }
            const angulos = {};
            for (const id of KEY_ANGLES) if (isNum(x.angles?.[id])) angulos[id] = Math.round(x.angles[id]);
            return { t: x.t, puntos, angulos };
        };
        const caidaFrame = inWindow(land.tLand, land.tLand + cfg.ventanaAmortiguacionMs)
            .filter((x) => x.kneeMean !== null)
            .reduce((m, x) => (!m || x.kneeMean < m.kneeMean ? x : m), null);
        const claves = {
            lado: side,
            carga: cargaIdx >= 0 ? clave(cargaWin[cargaIdx]) : null,
            contacto: clave(cercano(contactT)),
            caida: clave(caidaFrame),
        };

        return { ...rep, confianza: confianzaDe(fpsMedio, rep.medidas), claves };
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
            return { phase: s.phase, rep: null, debug: { cuerpo: false } };
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
                // Suavizado por tiempo (no por cuadro): igual de suave a 12 que a 60 fps
                s.speed[side] += (inst - s.speed[side]) * emaAlpha(dt, 20);
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
        const claveP = {};
        for (const i of KEY_IDX) claveP[i] = pts[i] ? { x: pts[i].x, y: pts[i].y, v: pts[i].v } : null;
        s.buffer.push({
            t,
            p: claveP,
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

        // Lo que el motor "ve" ahora mismo: alimenta el panel de diagnóstico
        const debug = {
            cuerpo: true,
            lift, // elevación de los pies, en torsos
            speedL: s.speed.L, // velocidad de cada muñeca, en torsos/s
            speedR: s.speed.R,
            kneeMean,
            aire: Boolean(s.airborne),
            enAireMs: s.airborne ? t - s.airborne.t0 : 0,
        };

        return { phase: s.phase, rep, debug };
    }

    const setNivel = (nuevo) => {
        nivel = nuevo;
    };

    return { push, reset, setNivel };
}