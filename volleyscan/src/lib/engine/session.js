/**
 * @param {Array} reps repeticiones devueltas por el motor
 */
export function resumirSesion(reps = []) {
    const validas = reps.filter((r) => r?.valida);

    const scores = validas
        .map((r) => r?.score)
        .filter((score) => typeof score === "number");

    // Qué error se repite más: es lo que más conviene corregir
    const conteo = new Map();

    for (const rep of validas) {
        for (const error of rep?.errores ?? []) {
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
            ? Math.round(
                scores.reduce((acc, n) => acc + n, 0) / scores.length
            )
            : null,

        mejorScore: scores.length
            ? Math.max(...scores)
            : null,

        erroresFrecuentes: [...conteo.values()]
            .sort((a, b) => b.veces - a.veces)
            .slice(0, 3),
    };
}