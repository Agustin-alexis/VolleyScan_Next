// ─────────────────────────────────────────────────────────────
// scorer.js — Calificación de una repetición (VolleyScan)
//
// Recibe los valores medidos en una repetición y un estándar (por ahora
// REMATE) y devuelve el resultado: score 0–100, lista de errores a
// corregir y puntos clave (lo que salió bien).
//
// JavaScript puro: no sabe nada de cámara ni de React. Funciona igual
// con cualquier movimiento que tenga su archivo de estándar.
//
// El objeto que devuelve está pensado para guardarse tal cual:
//   · score, version, brazo, métricas   → sesión
//   · errores                           → errores_detectados
//   · puntosClave                       → puntos_clave
// ─────────────────────────────────────────────────────────────

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const sum = (arr) => arr.reduce((acc, n) => acc + n, 0);
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Puntaje de una medida entre 0 y 1.
 * Dentro del rango ideal = 1; baja linealmente hasta 0 a `margen`
 * unidades de distancia del rango. Devuelve null si no hay dato.
 */
export function puntajeMedida(valor, def) {
    if (valor === null || valor === undefined || !Number.isFinite(valor)) return null;
    const [min, max] = def.ideal;
    if (valor < min) return clamp01(1 - (min - valor) / def.margen);
    if (valor > max) return clamp01(1 - (valor - max) / def.margen);
    return 1;
}

const severidadDe = (puntaje) => (puntaje < 0.4 ? 'alta' : puntaje < 0.65 ? 'media' : 'baja');

/**
 * @param valores  { [idMedida]: número | null } medidos en la repetición
 * @param standard estándar del movimiento (p. ej. REMATE)
 * @param extras   datos adicionales que se copian al resultado
 */
export function evaluarRepeticion(valores, standard, extras = {}) {
    const defs = new Map(standard.medidas.map((def) => [def.id, def]));

    const medidas = standard.medidas.map((def) => {
        const raw = valores[def.id];
        const valor = Number.isFinite(raw) ? raw : null;
        const puntaje = puntajeMedida(valor, def);
        const estado =
            puntaje === null
                ? 'sin_dato'
                : valor < def.ideal[0]
                    ? 'bajo'
                    : valor > def.ideal[1]
                        ? 'alto'
                        : 'ok';

        return {
            id: def.id,
            nombre: def.nombre,
            fase: def.fase,
            unidad: def.unidad,
            valor: valor === null ? null : round(valor),
            ideal: def.ideal,
            peso: def.peso,
            puntaje: puntaje === null ? null : round(puntaje, 3),
            estado,
        };
    });

    const base = { movimiento: standard.id, version: standard.version, ...extras };
    const conDato = medidas.filter((m) => m.puntaje !== null);
    const pesoConDato = sum(conDato.map((m) => m.peso));

    // Si se vio muy poco cuerpo, mejor no calificar que calificar mal
    if (pesoConDato < standard.pesoMinimo) {
        return {
            ...base,
            valida: false,
            motivo: 'No se vieron suficientes articulaciones para evaluar. Revisa el encuadre y la luz.',
            score: null,
            medidas,
            errores: [],
            puntosClave: [],
        };
    }

    // Score: promedio ponderado SOLO de las medidas con dato
    const score = Math.round((sum(conDato.map((m) => m.peso * m.puntaje)) / pesoConDato) * 100);

    const errores = conDato
        .filter((m) => m.estado !== 'ok' && m.puntaje < standard.umbralError)
        .map((m) => ({
            medidaId: m.id,
            fase: m.fase,
            severidad: severidadDe(m.puntaje),
            mensaje: defs.get(m.id).mensajes?.[m.estado] ?? `Ajusta: ${m.nombre.toLowerCase()}.`,
            valor: m.valor,
            // cuántos puntos del score cuesta este error: sirve para ordenar
            impacto: round(m.peso * (1 - m.puntaje)),
        }))
        .sort((a, b) => b.impacto - a.impacto);

    const puntosClave = conDato
        .filter((m) => m.puntaje >= 0.9)
        .sort((a, b) => b.peso - a.peso)
        .map((m) => defs.get(m.id).fortaleza);

    return { ...base, valida: true, motivo: null, score, medidas, errores, puntosClave };
}