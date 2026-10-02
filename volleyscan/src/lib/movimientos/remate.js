// ─────────────────────────────────────────────────────────────
// remate.js — Estándar técnico del remate (VolleyScan)
//
// Este archivo ES el "criterio del entrenador": qué se mide en cada fase
// del remate, qué rango se considera correcto, cuánto pesa cada medida
// en el score y qué corrección se da cuando algo se sale del rango.
//
// Versión 1.0 — definida con los criterios técnicos habituales del
// remate de voleibol. Aún no está validada con deportistas reales:
//   · los márgenes son amplios a propósito (la cámara y la estimación 3D
//     tienen un error de unos 5–10°),
//   · cada sesión guarda la versión con la que se calificó, así que se
//     pueden ajustar los rangos sin perder el historial.
//
// Para ajustar un criterio basta con editar `ideal`, `margen` o `peso`.
// Los pesos deben sumar 100.
//
// Cómo se califica cada medida (ver scorer.js):
//   · dentro de `ideal`                      → puntaje 1.0 (100 %)
//   · fuera, a `margen` unidades del rango   → puntaje 0.0
//   · entre ambos                            → baja de forma lineal
// ─────────────────────────────────────────────────────────────

export const REMATE = {
    id: 'remate',
    nombre: 'Remate',
    version: '1.0',

    // Una medida con puntaje menor a esto se reporta como error a corregir
    umbralError: 0.8,
    // Si las medidas con dato suman menos peso que esto, la repetición
    // no se califica (no se vio suficiente cuerpo)
    pesoMinimo: 60,

    // ── Detección de fases ──────────────────────────────────
    // Las distancias se miden en "torsos" (largo hombros–caderas), así no
    // dependen de qué tan lejos esté la cámara.
    deteccion: {
        saltoMinTorsos: 0.15, // elevación de los pies para considerar que saltó
        aterrizajeTorsos: 0.06, // por debajo de esto vuelve a estar en el suelo
        golpeVelocidadMin: 3.0, // velocidad de muñeca (torsos/s) para contar como golpeo
        cargaRodillaMax: 135, // rodilla por debajo de esto = fase de carga
        vueloMinMs: 150, // un "salto" más corto es ruido
        vueloMaxMs: 1500, // un vuelo más largo es un error de seguimiento
        ventanaContactoMs: 40, // ± alrededor del contacto para medir codo, hombro y altura
        ventanaCargaMs: 900, // cuánto antes del despegue se busca la máxima flexión
        ventanaAmortiguacionMs: 500, // cuánto después de aterrizar se mide la amortiguación
        refractarioMs: 800, // pausa antes de aceptar otro remate
        perdidaMaxMs: 400, // tiempo máximo sin ver el cuerpo en mitad de un remate
    },

    fases: [
        { id: 'sin_cuerpo', nombre: 'Sin cuerpo' },
        { id: 'preparacion', nombre: 'Preparación' },
        { id: 'carga', nombre: 'Carga' },
        { id: 'vuelo', nombre: 'Vuelo' },
        { id: 'golpeo', nombre: 'Golpeo' },
        { id: 'caida', nombre: 'Caída' },
    ],

    // ── Medidas, rangos y correcciones ──────────────────────
    medidas: [
        {
            id: 'flexionRodilla',
            fase: 'carga',
            nombre: 'Flexión de rodillas antes del salto',
            unidad: '°',
            ideal: [95, 125],
            margen: 30,
            peso: 12,
            mensajes: {
                alto: 'Flexiona más las rodillas antes de saltar: una carga de unos 100–120° te da más potencia en el despegue.',
                bajo: 'Te hundes demasiado antes de saltar: una sentadilla muy profunda te hace perder velocidad. Carga hasta unos 110°.',
            },
            fortaleza: 'Buena carga de piernas antes del salto.',
        },
        {
            id: 'inclinacionTroncoCarga',
            fase: 'carga',
            nombre: 'Inclinación del tronco en la carga',
            unidad: '°',
            ideal: [0, 25],
            margen: 20,
            peso: 8,
            mensajes: {
                alto: 'Mantén el tronco más erguido en la carga: inclinarte mucho hacia adelante te desequilibra el despegue.',
            },
            fortaleza: 'Tronco estable y erguido en la carga.',
        },
        {
            id: 'codoArmado',
            fase: 'vuelo',
            nombre: 'Codo al armar el brazo',
            unidad: '°',
            ideal: [70, 120],
            margen: 40,
            peso: 12,
            mensajes: {
                alto: 'Arma el brazo en arco: dobla más el codo y llévalo alto antes de golpear para generar velocidad.',
                bajo: 'Cierras demasiado el codo al armar el brazo: ábrelo un poco para tener un recorrido de golpe más amplio.',
            },
            fortaleza: 'Buen armado del brazo, con el codo alto y flexionado.',
        },
        {
            id: 'extensionCodoContacto',
            fase: 'golpeo',
            nombre: 'Extensión del codo en el golpeo',
            unidad: '°',
            ideal: [155, 180],
            margen: 40,
            peso: 22,
            mensajes: {
                bajo: 'Estira completamente el brazo en el golpeo: pega arriba, con el codo extendido, para ganar altura y potencia.',
            },
            fortaleza: 'Excelente extensión del brazo en el golpeo.',
        },
        {
            id: 'elevacionBrazoContacto',
            fase: 'golpeo',
            nombre: 'Elevación del brazo en el golpeo',
            unidad: '°',
            ideal: [140, 180],
            margen: 40,
            peso: 18,
            mensajes: {
                bajo: 'Lleva el brazo más alto en el golpeo: el contacto debe ser por encima de la cabeza, con el hombro bien abierto.',
            },
            fortaleza: 'Brazo bien elevado en el contacto.',
        },
        {
            id: 'alturaContacto',
            fase: 'golpeo',
            nombre: 'Altura del punto de contacto',
            unidad: 'torsos sobre la cabeza',
            ideal: [0.45, 3],
            margen: 0.45,
            peso: 12,
            mensajes: {
                bajo: 'Golpea el balón en el punto más alto que alcances: tu mano está muy cerca de la cabeza al hacer contacto.',
            },
            fortaleza: 'Contacto alto, con la mano bien por encima de la cabeza.',
        },
        {
            id: 'amortiguacionRodilla',
            fase: 'caida',
            nombre: 'Amortiguación al aterrizar',
            unidad: '°',
            ideal: [100, 150],
            margen: 30,
            peso: 10,
            mensajes: {
                alto: 'Amortigua la caída flexionando las rodillas: aterrizar con las piernas rígidas aumenta el riesgo de lesión.',
                bajo: 'Evita hundirte demasiado al caer: flexiona las rodillas de forma controlada para poder reaccionar rápido.',
            },
            fortaleza: 'Buena amortiguación al aterrizar.',
        },
        {
            id: 'simetriaAterrizaje',
            fase: 'caida',
            nombre: 'Aterrizaje con ambos pies',
            unidad: 'torsos de diferencia',
            ideal: [0, 0.15],
            margen: 0.25,
            peso: 6,
            mensajes: {
                alto: 'Aterriza con los dos pies a la vez: apoyar un pie antes que el otro desequilibra la caída y carga una sola pierna.',
            },
            fortaleza: 'Aterrizaje equilibrado con ambos pies.',
        },
    ],
};