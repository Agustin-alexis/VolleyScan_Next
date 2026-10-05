// ─────────────────────────────────────────────────────────────
// smoothing.js — Análisis de gestos (VolleyScan)
//
// Filtro One Euro (Casiez, Roussel y Vogel, CHI 2012).
//
// Problema: los puntos que entrega el modelo "tiemblan" de un cuadro a
// otro, y ese temblor hace saltar los ángulos aunque estés quieto.
//
// Por qué no un promedio simple: si promedias los últimos N cuadros,
// el esqueleto se queda atrás cuando te mueves rápido (justo en el
// remate). El filtro One Euro ajusta la fuerza del suavizado según la
// velocidad:
//   · movimiento lento  → suaviza mucho (adiós al temblor)
//   · movimiento rápido → casi no suaviza (sin retraso)
//
// Parámetros:
//   minCutoff  ↓ más suave en reposo, pero más lento al arrancar
//   beta       ↑ menos retraso en movimientos rápidos, pero más temblor
//   dCutoff    suavizado de la velocidad estimada (rara vez se toca)
//
// Se usa con dos instancias: una para los puntos de imagen (ejes x, y)
// y otra para los puntos del mundo en metros (ejes x, y, z).
// ─────────────────────────────────────────────────────────────

const TWO_PI = 2 * Math.PI;

// Factor de mezcla (0–1) para una frecuencia de corte y un intervalo dt.
const smoothingFactor = (cutoff, dt) => {
    const r = TWO_PI * cutoff * dt;
    return r / (r + 1);
};

class LowPass {
    constructor() {
        this.y = null;
    }

    filter(x, alpha) {
        this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y;
        return this.y;
    }

    reset() {
        this.y = null;
    }
}

export class OneEuroFilter {
    constructor({ minCutoff = 1.2, beta = 8, dCutoff = 1 } = {}) {
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;
        this.position = new LowPass();
        this.velocity = new LowPass();
        this.lastTime = null;
        this.lastRaw = null;
    }

    /** @param value valor crudo  @param tMs marca de tiempo en milisegundos */
    filter(value, tMs) {
        if (this.lastTime === null) {
            this.lastTime = tMs;
            this.lastRaw = value;
            return this.position.filter(value, 1);
        }

        // dt mínimo de 1 ms: evita dividir entre cero con cuadros repetidos
        const dt = Math.max((tMs - this.lastTime) / 1000, 0.001);
        const rawVelocity = (value - this.lastRaw) / dt;
        const velocity = this.velocity.filter(rawVelocity, smoothingFactor(this.dCutoff, dt));

        const cutoff = this.minCutoff + this.beta * Math.abs(velocity);
        const out = this.position.filter(value, smoothingFactor(cutoff, dt));

        this.lastTime = tMs;
        this.lastRaw = value;
        return out;
    }

    reset() {
        this.position.reset();
        this.velocity.reset();
        this.lastTime = null;
        this.lastRaw = null;
    }
}

/** Suaviza los 33 puntos del cuerpo (un filtro por punto y por eje). */
export class PoseSmoother {
    /**
     * @param options  parámetros del filtro One Euro
     * @param axes     ejes a suavizar: ['x','y'] (imagen) o ['x','y','z'] (mundo)
     */
    constructor(options, axes = ['x', 'y']) {
        this.options = options;
        this.axes = axes;
        this.filters = [];
    }

    /**
     * @param landmarks arreglo crudo de MediaPipe ({x, y, z?, visibility})
     * @returns arreglo de {x, y, z?, v} suavizado
     */
    apply(landmarks, tMs) {
        return landmarks.map((p, i) => {
            let bank = this.filters[i];
            if (!bank) {
                bank = {};
                for (const axis of this.axes) bank[axis] = new OneEuroFilter(this.options);
                this.filters[i] = bank;
            }

            const out = { v: p.visibility ?? 0 };
            for (const axis of this.axes) out[axis] = bank[axis].filter(p[axis], tMs);
            return out;
        });
    }

    reset() {
        this.filters = [];
    }
}