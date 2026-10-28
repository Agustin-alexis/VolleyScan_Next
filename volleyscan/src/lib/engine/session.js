// ─────────────────────────────────────────────────────────────
// session.js — Resumen de una sesión de práctica (VolleyScan)
//
// Una sesión es todo lo que ocurre entre "Activar cámara" y "Detener":
// varias repeticiones, cada una con su score. Esta función las resume
// para mostrar en pantalla y, en la fase siguiente, para guardar en el
// historial del deportista.
// ─────────────────────────────────────────────────────────────

/**
 * Compara un remate con el anterior: cuánto cambió el score y qué medidas
 * mejoraron o empeoraron. Solo cuentan los cambios claros (≥ 0.2 de puntaje):
 * la medición tiene un error de unos 2 a 4°, y un cambio menor es ruido.
 *
 * @returns { deltaScore, mejoras[], retrocesos[] } | null si no se pueden comparar
 */
export function compararConAnterior(actual, anterior) {
    if (!actual?.valida || !anterior?.valida) return null;

    const previas = new Map(anterior.medidas.map((m) => [m.id, m]));
    const cambios = [];
    for (const m of actual.medidas) {
        const prev = previas.get(m.id);
        if (m.puntaje == null || prev?.puntaje == null) continue;
        const delta = m.puntaje - prev.puntaje;
        if (Math.abs(delta) >= 0.2) {
            cambios.push({ id: m.id, nombre: m.nombre, delta, peso: m.peso });
        }
    }

    // Lo que más pesa en el score va primero
    const porPeso = (a, b) => b.peso * Math.abs(b.delta) - a.peso * Math.abs(a.delta);
    return {
        deltaScore: actual.score - anterior.score,
        mejoras: cambios.filter((c) => c.delta > 0).sort(porPeso),
        retrocesos: cambios.filter((c) => c.delta < 0).sort(porPeso),
    };
}

/**
 * @param reps repeticiones devueltas por el motor (válidas e inválidas)
 */
export function resumirSesion(reps) {
    const validas = reps.filter((r) => r.valida);
    const scores = validas.map((r) => r.score);

    // Qué error se repite más: es lo que más conviene corregir
    const conteo = new Map();
    for (const rep of validas) {
        for (const error of rep.errores) {
            const actual = conteo.get(error.medidaId) ?? {
                medidaId: error.medidaId,
                fase: error.fase,
                mensaje: error.mensaje,
                veces: 0,
            };
            actual.veces += 1;
            conteo.set(error.medidaId, actual);
        }
    }

    return {
        total: reps.length,
        validas: validas.length,
        scorePromedio: scores.length
            ? Math.round(scores.reduce((acc, n) => acc + n, 0) / scores.length)
            : null,
        mejorScore: scores.length ? Math.max(...scores) : null,
        erroresFrecuentes: [...conteo.values()].sort((a, b) => b.veces - a.veces).slice(0, 3),
    };
}