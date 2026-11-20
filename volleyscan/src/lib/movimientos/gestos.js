// ─────────────────────────────────────────────────────────────
// gestos.js — Estándares biomecánicos multi-gesto de VolleyScan AI
//
// Integra los 5 gestos canónicos del proyecto Asistente de IA:
//   1. Remate (remate)
//   2. Saque (saque)
//   3. Bloqueo (bloqueo)
//   4. Voleo / Colocación (voleo)
//   5. Recepción de antebrazos (recepcion)
// Además del modo 'auto' (Detección Automática IA sobre la ventana temporal).
// ─────────────────────────────────────────────────────────────

import { REMATE } from './remate';

const NIVELES_COMUNES = {
    principiante: { nombre: 'Principiante', tolerancia: 1.4 },
    intermedio: { nombre: 'Intermedio', tolerancia: 1.15 },
    avanzado: { nombre: 'Avanzado', tolerancia: 1.0 },
    profesional: { nombre: 'Profesional', tolerancia: 0.85 },
};

const FASES_COMUNES = [
    { id: 'sin_cuerpo', nombre: 'Sin cuerpo' },
    { id: 'preparacion', nombre: 'Preparación' },
    { id: 'carga', nombre: 'Carga / Impulso' },
    { id: 'vuelo', nombre: 'Armado / Elevación' },
    { id: 'golpeo', nombre: 'Contacto Crítico (t₀)' },
    { id: 'caida', nombre: 'Finalización' },
];

export const SAQUE = {
    id: 'saque',
    nombre: 'Saque',
    descripcion: 'Evalúa tu preparación, armado del brazo, altura e impacto en el saque (en salto o flotante).',
    version: '1.1',
    requiereSalto: false, // Puede ser saque en salto o de pie
    nivelPorDefecto: 'intermedio',
    niveles: NIVELES_COMUNES,
    umbralError: 0.8,
    pesoMinimo: 60,
    deteccion: {
        ...REMATE.deteccion,
        saltoMinTorsos: 0.11,
        golpeVelocidadMin: 2.4,
        sinArmadoGrados: 150,
    },
    fases: FASES_COMUNES,
    medidas: [
        {
            id: 'flexionRodilla',
            fase: 'carga',
            nombre: 'Flexión de rodillas en preparación',
            unidad: '°',
            ideal: [105, 145],
            margen: 30,
            peso: 12,
            mensajes: {
                alto: 'Flexiona ligeramente las rodillas al preparar el saque para transferir impulso desde las piernas.',
                bajo: 'No bajes demasiado las caderas en el saque: mantén una base ágil y estable.',
            },
            fortaleza: 'Base de piernas estable y equilibrada en la preparación.',
            porQue: 'El impulso del saque nace en el empuje del suelo hacia el tronco y el hombro.',
            ejercicio: 'Lanzamiento de balón y transferencia de peso pie trasero a delantero: 3 series de 10.',
        },
        {
            id: 'inclinacionTroncoCarga',
            fase: 'carga',
            nombre: 'Estabilidad del tronco',
            unidad: '°',
            ideal: [0, 22],
            margen: 20,
            peso: 10,
            mensajes: {
                alto: 'Mantén el pecho alto al lanzar el balón: inclinar el tronco baja el punto de impacto.',
            },
            fortaleza: 'Tronco erguido y alineado durante el lanzamiento.',
            porQue: 'Un tronco estable garantiza un lanzamiento consistente delante del hombro ejecutor.',
            ejercicio: 'Práctica de lanzamiento vertical frente a una pared sin golpear: 3 series de 12.',
        },
        {
            id: 'codoArmado',
            fase: 'vuelo',
            nombre: 'Armado del codo (arco de saque)',
            unidad: '°',
            ideal: [75, 125],
            margen: 38,
            peso: 18,
            mensajes: {
                alto: 'Lleva el codo hacia atrás y arriba (posición de arquero) antes de impactar el balón.',
                bajo: 'Evita cerrar en exceso el codo al armar para no trabar la salida rápida de la mano.',
            },
            fortaleza: 'Armado en arco limpio con codo alto.',
            porQue: 'La retracción escapular y flexión del codo generan el efecto látigo necesario para un saque potente.',
            ejercicio: 'Saque contra pared enfatizando codo alto a la altura de la oreja: 3 series de 10.',
        },
        {
            id: 'extensionCodoContacto',
            fase: 'golpeo',
            nombre: 'Extensión del codo en el impacto',
            unidad: '°',
            ideal: [158, 180],
            margen: 35,
            peso: 24,
            mensajes: {
                bajo: 'Extiende completamente el codo al golpear el balón para lograr una trayectoria tensa sobre la red.',
            },
            fortaleza: 'Impacto con brazo totalmente extendido en el punto alto.',
            porQue: 'Golpear con el codo flexionado reduce la palanca y hace que el balón caiga en la red.',
            ejercicio: 'Saque a zonas largas buscando extensión máxima de brazo en el contacto: 3 series de 8.',
        },
        {
            id: 'elevacionBrazoContacto',
            fase: 'golpeo',
            nombre: 'Elevación del hombro en contacto',
            unidad: '°',
            ideal: [140, 180],
            margen: 35,
            peso: 20,
            mensajes: {
                bajo: 'Eleva más el hombro al impactar: golpea el balón bien arriba y ligeramente delante de ti.',
            },
            fortaleza: 'Excelente apertura de hombro en el contacto.',
            porQue: 'Un hombro elevado mejora el ángulo de entrada del balón a la cancha rival.',
            ejercicio: 'Movilidad escapular con banda elástica y golpe alto controlado: 3 series de 10.',
        },
        {
            id: 'amortiguacionRodilla',
            fase: 'caida',
            nombre: 'Equilibrio y absorción final',
            unidad: '°',
            ideal: [110, 160],
            margen: 30,
            peso: 16,
            mensajes: {
                alto: 'Acompaña el final del saque flexionando suavemente las rodillas para entrar rápido en defensa.',
                bajo: 'Controla el descenso tras el saque para recuperar tu posición defensiva.',
            },
            fortaleza: 'Finalización equilibrada lista para defender.',
            porQue: 'Terminar equilibrado te permite incorporarte de inmediato al sistema defensivo.',
            ejercicio: 'Saque seguido de sprint de 3 pasos a posición defensiva 6: 3 series de 6.',
        },
    ],
};

export const BLOQUEO = {
    id: 'bloqueo',
    nombre: 'Bloqueo',
    descripcion: 'Evalúa tu carga de piernas, salto vertical explosivo, extensión simétrica de brazos sobre la red y caída segura.',
    version: '1.1',
    requiereSalto: true,
    nivelPorDefecto: 'intermedio',
    niveles: NIVELES_COMUNES,
    umbralError: 0.8,
    pesoMinimo: 60,
    deteccion: {
        ...REMATE.deteccion,
        saltoMinTorsos: 0.13,
        golpeVelocidadMin: 1.5,
        sinArmadoGrados: 185, // En el bloqueo los brazos suben extendidos sin armado de remate
    },
    fases: FASES_COMUNES,
    medidas: [
        {
            id: 'flexionRodilla',
            fase: 'carga',
            nombre: 'Flexión de rodillas en carga',
            unidad: '°',
            ideal: [95, 125],
            margen: 28,
            peso: 18,
            mensajes: {
                alto: 'Flexiona más las rodillas antes de saltar al bloqueo (100–120°) para despegar con potencia.',
                bajo: 'No bajes tanto en la preparación del bloqueo: pierdes tiempo de reacción frente al colocador.',
            },
            fortaleza: 'Carga de piernas rápida y potente para el bloqueo.',
            porQue: 'En el bloqueo necesitas despegar rápido sin hundirte demasiado para llegar a tiempo al ataque rival.',
            ejercicio: 'Saltos de bloqueo desde media sentadilla (110°) con manos arriba del pecho: 3 series de 8.',
        },
        {
            id: 'inclinacionTroncoCarga',
            fase: 'carga',
            nombre: 'Postura vertical del tronco',
            unidad: '°',
            ideal: [0, 20],
            margen: 18,
            peso: 10,
            mensajes: {
                alto: 'Sube el tronco recto: inclinarte hacia adelante te hará tocar la red.',
            },
            fortaleza: 'Tronco vertical sin riesgo de invasión de red.',
            porQue: 'Mantener el eje vertical evita faltas de toque de red y dirige toda la fuerza hacia arriba.',
            ejercicio: 'Saltos de bloqueo a 15 cm de una pared sin rozarla con el pecho: 3 series de 8.',
        },
        {
            id: 'extensionCodoContacto',
            fase: 'golpeo',
            nombre: 'Extensión de brazos sobre la red',
            unidad: '°',
            ideal: [155, 180],
            margen: 32,
            peso: 24,
            mensajes: {
                bajo: 'Estira ambos codos por completo en el punto más alto para invadir el espacio rival sobre la red.',
            },
            fortaleza: 'Brazos firmes y completamente extendidos en el bloqueo.',
            porQue: 'Unos codos firmes y extendidos cierran el ángulo del atacante y evitan que el balón doble tus brazos.',
            ejercicio: 'Saltos en red pasando las manos al otro lado y tensando hombros y abdomen: 3 series de 8.',
        },
        {
            id: 'elevacionBrazoContacto',
            fase: 'golpeo',
            nombre: 'Elevación de hombros en el vértice',
            unidad: '°',
            ideal: [145, 180],
            margen: 32,
            peso: 20,
            mensajes: {
                bajo: 'Eleva los hombros pegados a las orejas en el aire para ganar centímetros extra de bloqueo.',
            },
            fortaleza: 'Máxima elevación escapular en el vértice del bloqueo.',
            porQue: 'Encoger y proyectar los hombros hacia arriba sella el hueco entre tus brazos y la red.',
            ejercicio: 'Bloqueo estático sobre cajón empujando balón medicinal hacia el techo: 3 series de 10.',
        },
        {
            id: 'amortiguacionRodilla',
            fase: 'caida',
            nombre: 'Amortiguación al aterrizar',
            unidad: '°',
            ideal: [105, 148],
            margen: 28,
            peso: 16,
            mensajes: {
                alto: 'Flexiona las rodillas al aterrizar del bloqueo: caer rígido sobrecarga el tendón rotuliano y el LCA.',
                bajo: 'Controla la flexión al caer para poder volver a saltar o girar a defensa.',
            },
            fortaleza: 'Aterrizaje suave y controlado tras el bloqueo.',
            porQue: 'El central y los bloqueadores realizan decenas de saltos por set; amortiguar protege tus rodillas.',
            ejercicio: 'Desplazamiento lateral + salto de bloqueo + aterrizaje silencioso en 2 tiempos: 3 series de 6.',
        },
        {
            id: 'simetriaAterrizaje',
            fase: 'caida',
            nombre: 'Simetría bilateral de caída',
            unidad: 'torsos de diferencia',
            ideal: [0, 0.14],
            margen: 0.22,
            peso: 12,
            mensajes: {
                alto: 'Aterriza con ambos pies al mismo tiempo para evitar esguinces y sobrecarga unilateral.',
            },
            fortaleza: 'Caída simétrica sobre ambos apoyos.',
            porQue: 'Caer sobre un solo pie cerca de la línea central es la principal causa de lesiones de tobillo en bloqueo.',
            ejercicio: 'Bloqueo con desplazamiento lateral frenando en doble apoyo antes de subir: 3 series de 8.',
        },
    ],
};

export const VOLEO = {
    id: 'voleo',
    nombre: 'Voleo / Colocación',
    descripcion: 'Evalúa tu postura de piernas, armado de manos sobre la frente y extensión simétrica de codos y muñecas.',
    version: '1.1',
    requiereSalto: false,
    nivelPorDefecto: 'intermedio',
    niveles: NIVELES_COMUNES,
    umbralError: 0.8,
    pesoMinimo: 60,
    deteccion: {
        ...REMATE.deteccion,
        saltoMinTorsos: 0.12,
        golpeVelocidadMin: 1.4,
    },
    fases: FASES_COMUNES,
    medidas: [
        {
            id: 'flexionRodilla',
            fase: 'carga',
            nombre: 'Flexión de rodillas en base',
            unidad: '°',
            ideal: [105, 140],
            margen: 30,
            peso: 18,
            mensajes: {
                alto: 'Flexiona más las rodillas antes del toque de dedos: el voleo se impulsa con las piernas, no solo con los brazos.',
                bajo: 'Mantén una flexión media y cómoda bajo el balón para empujar con fluidez.',
            },
            fortaleza: 'Excelente base y empuje de piernas en la colocación.',
            porQue: 'Extender rodillas y codos al unísono da precisión y alcance largo sin esfuerzo brusco.',
            ejercicio: 'Voleo vertical iniciando en media sentadilla y extendiendo todo el cuerpo: 3 series de 12.',
        },
        {
            id: 'inclinacionTroncoCarga',
            fase: 'carga',
            nombre: 'Alineación del tronco bajo el balón',
            unidad: '°',
            ideal: [0, 20],
            margen: 18,
            peso: 12,
            mensajes: {
                alto: 'Ubícate debajo del balón con el tronco erguido en lugar de inclinarte hacia adelante.',
            },
            fortaleza: 'Cuerpo bien ubicado debajo del eje del balón.',
            porQue: 'Estar equilibrado debajo del balón permite colocar hacia adelante o hacia atrás sin delatar la jugada.',
            ejercicio: 'Desplazamiento rápido, parada en equilibrio y captura sobre la frente: 3 series de 10.',
        },
        {
            id: 'codoArmado',
            fase: 'vuelo',
            nombre: 'Ángulo de codos sobre la frente (recepción alta)',
            unidad: '°',
            ideal: [80, 125],
            margen: 32,
            peso: 22,
            mensajes: {
                alto: 'Flexiona los codos al recibir el balón sobre la frente (90–115°) para amortiguar y acompañar el toque.',
                bajo: 'No cierres demasiado los codos ni bajes las manos a la altura de la cara: recibe arriba de la frente.',
            },
            fortaleza: 'Manos armadas arriba de la frente con buena flexión de codos.',
            porQue: 'Armar el triángulo de dedos sobre la frente con codos flexionados evita retenciones y da control total.',
            ejercicio: 'Toques continuos cortos sobre la frente frente a una pared a 1 metro: 3 series de 20.',
        },
        {
            id: 'extensionCodoContacto',
            fase: 'golpeo',
            nombre: 'Extensión de codos en la salida del pase',
            unidad: '°',
            ideal: [145, 178],
            margen: 32,
            peso: 26,
            mensajes: {
                bajo: 'Completa la extensión de los brazos hacia el objetivo al soltar el balón.',
            },
            fortaleza: 'Extensión limpia y fluida de ambos brazos en el voleo.',
            porQue: 'Acompañar el balón hasta extender los codos estabiliza la parábola del pase.',
            ejercicio: 'Colocación hacia diana alta manteniendo los brazos extendidos 1 segundo al final: 3 series de 10.',
        },
        {
            id: 'elevacionBrazoContacto',
            fase: 'golpeo',
            nombre: 'Elevación de hombros en el toque',
            unidad: '°',
            ideal: [115, 165],
            margen: 32,
            peso: 22,
            mensajes: {
                bajo: 'Contacta el balón más alto, por encima de la frente y no a la altura del pecho.',
            },
            fortaleza: 'Punto de toque alto por encima de la frente.',
            porQue: 'Un punto de contacto alto acelera el juego y dificulta la lectura del bloqueo rival.',
            ejercicio: 'Voleo sentado en el suelo hacia arriba obligando a elevar hombros y codos: 3 series de 12.',
        },
    ],
};

export const RECEPCION = {
    id: 'recepcion',
    nombre: 'Recepción',
    descripcion: 'Evalúa tu postura baja de defensa, ángulo de inclinación del torso y plataforma firme de antebrazos extendidos.',
    version: '1.1',
    requiereSalto: false,
    nivelPorDefecto: 'intermedio',
    niveles: NIVELES_COMUNES,
    umbralError: 0.8,
    pesoMinimo: 60,
    deteccion: {
        ...REMATE.deteccion,
        saltoMinTorsos: 0.12,
        golpeVelocidadMin: 1.1,
    },
    fases: FASES_COMUNES,
    medidas: [
        {
            id: 'flexionRodilla',
            fase: 'carga',
            nombre: 'Flexión de rodillas (centro de gravedad bajo)',
            unidad: '°',
            ideal: [90, 130],
            margen: 28,
            peso: 26,
            mensajes: {
                alto: 'Baja más las caderas flexionando las rodillas (100–125°): recibir con piernas rectas quita control.',
                bajo: 'Evita sentarte demasiado en los talones; mantén el peso en la punta de los pies.',
            },
            fortaleza: 'Centro de gravedad bajo y estable en recepción.',
            porQue: 'Una base baja te permite amortiguar saques potentes y dirigir el balón con el empuje suave de las piernas.',
            ejercicio: 'Postura isométrica de recepción y desplazamientos cortos sin subir la cadera: 3 series de 30 s.',
        },
        {
            id: 'inclinacionTroncoCarga',
            fase: 'carga',
            nombre: 'Inclinación del tronco hacia adelante',
            unidad: '°',
            ideal: [15, 42],
            margen: 22,
            peso: 18,
            mensajes: {
                bajo: 'Inclina ligeramente los hombros hacia adelante para que el balón salga hacia el colocador y no hacia atrás.',
                alto: 'No dobles la espalda en exceso: baja con las rodillas manteniendo el pecho orientado al objetivo.',
            },
            fortaleza: 'Buena inclinación de hombros y torso para orientar la plataforma.',
            porQue: 'El ángulo del torso junto con los hombros adelantados define el ángulo de rebote hacia la zona de colocación.',
            ejercicio: 'Recepción de balones lanzados manteniendo hombros por delante de las rodillas: 3 series de 10.',
        },
        {
            id: 'extensionCodoContacto',
            fase: 'golpeo',
            nombre: 'Bloqueo y extensión de codos (plataforma plana)',
            unidad: '°',
            ideal: [158, 180],
            margen: 28,
            peso: 34,
            mensajes: {
                bajo: 'Estira y bloquea ambos codos al recibir: doblar los codos en el impacto descontrola el balón.',
            },
            fortaleza: 'Plataforma de antebrazos firme con codos completamente extendidos.',
            porQue: 'Los antebrazos deben formar una tabla plana y sólida; cualquier flexión de codo desvía el pase.',
            ejercicio: 'Recepción con banda o balón sujetado entre antebrazos sin doblar los codos: 3 series de 12.',
        },
        {
            id: 'elevacionBrazoContacto',
            fase: 'golpeo',
            nombre: 'Ángulo de la plataforma respecto al torso',
            unidad: '°',
            ideal: [45, 95],
            margen: 30,
            peso: 22,
            mensajes: {
                alto: 'No subas los brazos por encima de los hombros al recibir: amortigua y acompaña con las piernas.',
                bajo: 'Separa ligeramente los brazos del cuerpo para presentar la plataforma delante de tus caderas.',
            },
            fortaleza: 'Ángulo de plataforma controlado frente al cuerpo.',
            porQue: 'Presentar la plataforma entre 60° y 85° sin abanicar los brazos absorbe la velocidad del saque.',
            ejercicio: 'Recepción dirigida a canasta o aro sin levantar los brazos más allá del pecho: 3 series de 10.',
        },
    ],
};

export const AUTO = {
    ...REMATE,
    id: 'auto',
    nombre: 'Auto IA (5 Gestos)',
    descripcion: 'El asistente detecta automáticamente si realizaste un Remate, Saque, Bloqueo, Voleo o Recepción.',
    esAuto: true,
};

export const MOVIMIENTOS = {
    auto: AUTO,
    remate: REMATE,
    saque: SAQUE,
    bloqueo: BLOQUEO,
    voleo: VOLEO,
    colocacion: VOLEO,
    recepcion: RECEPCION,
};

export const LISTA_MOVIMIENTOS = [
    { id: 'auto', nombre: 'Auto IA (5 Gestos)', corto: 'Auto IA', icono: '✨' },
    { id: 'remate', nombre: 'Remate', corto: 'Remate', icono: '🏐' },
    { id: 'saque', nombre: 'Saque', corto: 'Saque', icono: '🎯' },
    { id: 'bloqueo', nombre: 'Bloqueo', corto: 'Bloqueo', icono: '🛡️' },
    { id: 'voleo', nombre: 'Voleo / Colocación', corto: 'Voleo', icono: '🙌' },
    { id: 'recepcion', nombre: 'Recepción', corto: 'Recepción', icono: '🛡️' },
];

export function obtenerMovimiento(id) {
    return MOVIMIENTOS[id] ?? REMATE;
}
