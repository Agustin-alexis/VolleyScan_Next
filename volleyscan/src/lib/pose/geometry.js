// ─────────────────────────────────────────────────────────────
// geometry.js — Análisis de gestos (VolleyScan)
//
// JavaScript puro, sin React ni DOM: se puede probar de forma aislada
// y es la base de las reglas de corrección de las fases siguientes.
//
// Contiene:
//  · los 19 puntos del cuerpo que usamos (MediaPipe entrega 33)
//  · el esqueleto y los ángulos que medimos
//  · calcAngle / measureAngles: matemática de ángulos en 2D o 3D
//  · assessFraming: ¿se ve el cuerpo completo para medir bien?
//
// Convención de coordenadas:
//  · puntos de IMAGEN → píxeles {x, y, v}: sirven para DIBUJAR
//  · puntos del MUNDO → metros {x, y, z, v}: sirven para MEDIR
//    (calcAngle usa z automáticamente si los tres puntos la traen)
// ─────────────────────────────────────────────────────────────

// El lado es el de la PERSONA, no el de la pantalla:
// "derecho" = brazo derecho del deportista.
export const LM = {
    NOSE: 0,
    L_SHOULDER: 11,
    R_SHOULDER: 12,
    L_ELBOW: 13,
    R_ELBOW: 14,
    L_WRIST: 15,
    R_WRIST: 16,
    L_INDEX: 19, // punta del dedo índice: dirección de la mano en el golpeo
    R_INDEX: 20,
    L_HIP: 23,
    R_HIP: 24,
    L_KNEE: 25,
    R_KNEE: 26,
    L_ANKLE: 27,
    R_ANKLE: 28,
    L_HEEL: 29, // talón y punta del pie: despegue y caída del salto
    R_HEEL: 30,
    L_FOOT: 31,
    R_FOOT: 32,
};

export const SKELETON = [
    // tronco
    [LM.L_SHOULDER, LM.R_SHOULDER],
    [LM.L_SHOULDER, LM.L_HIP],
    [LM.R_SHOULDER, LM.R_HIP],
    [LM.L_HIP, LM.R_HIP],
    // brazos
    [LM.L_SHOULDER, LM.L_ELBOW],
    [LM.L_ELBOW, LM.L_WRIST],
    [LM.R_SHOULDER, LM.R_ELBOW],
    [LM.R_ELBOW, LM.R_WRIST],
    // manos
    [LM.L_WRIST, LM.L_INDEX],
    [LM.R_WRIST, LM.R_INDEX],
    // piernas
    [LM.L_HIP, LM.L_KNEE],
    [LM.L_KNEE, LM.L_ANKLE],
    [LM.R_HIP, LM.R_KNEE],
    [LM.R_KNEE, LM.R_ANKLE],
    // pies (triángulo tobillo–talón–punta)
    [LM.L_ANKLE, LM.L_HEEL],
    [LM.L_HEEL, LM.L_FOOT],
    [LM.L_ANKLE, LM.L_FOOT],
    [LM.R_ANKLE, LM.R_HEEL],
    [LM.R_HEEL, LM.R_FOOT],
    [LM.R_ANKLE, LM.R_FOOT],
];

export const JOINTS = Object.values(LM);

// Puntos que se dibujan más pequeños (extremos: cabeza, manos y pies).
export const MINOR_JOINTS = new Set([
    LM.NOSE,
    LM.L_INDEX,
    LM.R_INDEX,
    LM.L_HEEL,
    LM.R_HEEL,
    LM.L_FOOT,
    LM.R_FOOT,
]);

// Visibilidad mínima (0–1) para confiar en un punto.
export const MIN_VISIBILITY = 0.5;

// Cada ángulo se mide EN el punto `b`, entre las líneas b→a y b→c.
// `arc: true` → se dibuja el arco sobre el video (el tobillo se mide
// pero no se dibuja: el arco quedaría diminuto y taparía el pie).
export const ANGLES = [
    {
        id: "codoD",
        joint: "codo",
        side: "D",
        label: "Codo derecho",
        a: LM.R_SHOULDER,
        b: LM.R_ELBOW,
        c: LM.R_WRIST,
        arc: true,
    },
    {
        id: "codoI",
        joint: "codo",
        side: "I",
        label: "Codo izquierdo",
        a: LM.L_SHOULDER,
        b: LM.L_ELBOW,
        c: LM.L_WRIST,
        arc: true,
    },
    {
        id: "hombroD",
        joint: "hombro",
        side: "D",
        label: "Hombro derecho",
        a: LM.R_ELBOW,
        b: LM.R_SHOULDER,
        c: LM.R_HIP,
        arc: true,
    },
    {
        id: "hombroI",
        joint: "hombro",
        side: "I",
        label: "Hombro izquierdo",
        a: LM.L_ELBOW,
        b: LM.L_SHOULDER,
        c: LM.L_HIP,
        arc: true,
    },
    {
        id: "caderaD",
        joint: "cadera",
        side: "D",
        label: "Cadera derecha",
        a: LM.R_SHOULDER,
        b: LM.R_HIP,
        c: LM.R_KNEE,
        arc: true,
    },
    {
        id: "caderaI",
        joint: "cadera",
        side: "I",
        label: "Cadera izquierda",
        a: LM.L_SHOULDER,
        b: LM.L_HIP,
        c: LM.L_KNEE,
        arc: true,
    },
    {
        id: "rodillaD",
        joint: "rodilla",
        side: "D",
        label: "Rodilla derecha",
        a: LM.R_HIP,
        b: LM.R_KNEE,
        c: LM.R_ANKLE,
        arc: true,
    },
    {
        id: "rodillaI",
        joint: "rodilla",
        side: "I",
        label: "Rodilla izquierda",
        a: LM.L_HIP,
        b: LM.L_KNEE,
        c: LM.L_ANKLE,
        arc: true,
    },
    {
        id: "tobilloD",
        joint: "tobillo",
        side: "D",
        label: "Tobillo derecho",
        a: LM.R_KNEE,
        b: LM.R_ANKLE,
        c: LM.R_FOOT,
        arc: false,
    },
    {
        id: "tobilloI",
        joint: "tobillo",
        side: "I",
        label: "Tobillo izquierdo",
        a: LM.L_KNEE,
        b: LM.L_ANKLE,
        c: LM.L_FOOT,
        arc: false,
    },
];

// Filas del panel de instrumentos (pares derecho/izquierdo).
export const ANGLE_ROWS = [
    { id: "codo", label: "Codo" },
    { id: "hombro", label: "Hombro" },
    { id: "cadera", label: "Cadera" },
    { id: "rodilla", label: "Rodilla" },
    { id: "tobillo", label: "Tobillo" },
];

// Inclinación del tronco respecto a la vertical: 0° = erguido, 90° = horizontal.
export const TRUNK = { id: "tronco", label: "Inclinación del tronco", max: 90 };

/**
 * Ángulo (grados, 0–180) en el punto b formado por a-b-c.
 *
 * Si los tres puntos traen `z` (puntos del mundo, en metros) el cálculo
 * es 3D: no se distorsiona cuando giras el cuerpo o el brazo apunta a la
 * cámara. Sin `z` (puntos de imagen en píxeles) es 2D.
 */
export function calcAngle(a, b, c) {
    const is3D = a.z !== undefined && b.z !== undefined && c.z !== undefined;

    const v1x = a.x - b.x;
    const v1y = a.y - b.y;
    const v1z = is3D ? a.z - b.z : 0;
    const v2x = c.x - b.x;
    const v2y = c.y - b.y;
    const v2z = is3D ? c.z - b.z : 0;

    const mag = Math.hypot(v1x, v1y, v1z) * Math.hypot(v2x, v2y, v2z);
    if (mag === 0) return null;

    // clamp evita NaN por redondeo (acos solo acepta -1..1)
    const cos = Math.min(
        1,
        Math.max(-1, (v1x * v2x + v1y * v2y + v1z * v2z) / mag),
    );
    return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Inclinación del tronco respecto a la vertical, en grados.
 * Une el punto medio de las caderas con el de los hombros.
 * Supone la cámara derecha (no inclinada). Usa abs(): no importa si el
 * eje Y apunta hacia arriba o hacia abajo en el sistema de coordenadas.
 */
export function measureTrunkLean(pts) {
    const needed = [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_HIP, LM.R_HIP];
    if (!needed.every((i) => pts[i].v >= MIN_VISIBILITY)) return null;

    const z = (p) => p.z ?? 0;
    const vx =
        (pts[LM.L_SHOULDER].x +
            pts[LM.R_SHOULDER].x -
            pts[LM.L_HIP].x -
            pts[LM.R_HIP].x) /
        2;
    const vy =
        (pts[LM.L_SHOULDER].y +
            pts[LM.R_SHOULDER].y -
            pts[LM.L_HIP].y -
            pts[LM.R_HIP].y) /
        2;
    const vz =
        (z(pts[LM.L_SHOULDER]) +
            z(pts[LM.R_SHOULDER]) -
            z(pts[LM.L_HIP]) -
            z(pts[LM.R_HIP])) /
        2;

    const len = Math.hypot(vx, vy, vz);
    if (len === 0) return null;
    return (Math.acos(Math.min(1, Math.abs(vy) / len)) * 180) / Math.PI;
}

/**
 * Mide todos los ángulos de ANGLES más la inclinación del tronco.
 * Devuelve { codoD: 142.3, codoI: null, ..., tronco: 12.5 }
 * (null = sin señal fiable).
 */
export function measureAngles(pts) {
    const out = {};
    for (const def of ANGLES) {
        const a = pts[def.a];
        const b = pts[def.b];
        const c = pts[def.c];
        const reliable =
            a.v >= MIN_VISIBILITY && b.v >= MIN_VISIBILITY && c.v >= MIN_VISIBILITY;
        out[def.id] = reliable ? calcAngle(a, b, c) : null;
    }
    out[TRUNK.id] = measureTrunkLean(pts);
    return out;
}

// Grupos que deben verse para medir bien, en orden de prioridad del aviso.
const REQUIRED_GROUPS = [
    {
        points: [LM.L_ANKLE, LM.R_ANKLE],
        hint: "Aléjate un poco: no se ven tus pies.",
    },
    {
        points: [LM.L_KNEE, LM.R_KNEE],
        hint: "Aléjate un poco: no se ven tus rodillas.",
    },
    {
        points: [LM.L_HIP, LM.R_HIP],
        hint: "Ajusta el encuadre: no se ven tus caderas.",
    },
    {
        points: [LM.L_SHOULDER, LM.R_SHOULDER],
        hint: "Ajusta el encuadre: no se ven tus hombros.",
    },
];

/**
 * Evalúa si el cuerpo está bien encuadrado (usa los puntos de imagen).
 *  status: 'none' (sin cuerpo) | 'partial' (falta algo) | 'ok'
 */
export function assessFraming(pts, w, h) {
    if (!pts) {
        return {
            status: "none",
            hint: "No detectamos tu cuerpo. Colócate de frente a la cámara.",
        };
    }

    const mx = w * 0.02;
    const my = h * 0.02;
    const inside = (p) =>
        p.x >= mx && p.x <= w - mx && p.y >= my && p.y <= h - my;
    const seen = (i) => pts[i].v >= MIN_VISIBILITY && inside(pts[i]);

    for (const group of REQUIRED_GROUPS) {
        if (!group.points.every(seen))
            return { status: "partial", hint: group.hint };
    }
    return { status: "ok", hint: "Encuadre correcto" };
}
