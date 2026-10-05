// ─────────────────────────────────────────────────────────────
// renderer.js — Análisis de gestos (VolleyScan)
//
// Dibuja sobre el canvas encima del video, como el telestrador de una
// transmisión deportiva:
//   · estela de las muñecas (trayectoria del brazo de golpeo)
//   · esqueleto con halo (incluye manos y pies)
//   · arcos de ángulo con su valor
//   · articulaciones
//
// Colores (paleta del dashboard):
//   azul    → medición (arcos de ángulo)
//   verde   → articulaciones seguidas correctamente
//   naranja → movimiento (muñecas y su estela)
//
// Es independiente de React: recibe datos y pinta. El hook solo orquesta.
// Todo se dibuja en coordenadas del VIDEO (no de la pantalla); el CSS
// escala el canvas igual que el video, así que quedan alineados.
//
// Nota sobre los arcos: la FORMA del arco es la proyección 2D que ves en
// pantalla, pero el NÚMERO es el ángulo 3D medido. Si el brazo apunta
// hacia la cámara, el arco se ve más cerrado que el número: es correcto.
// ─────────────────────────────────────────────────────────────

import { ANGLES, JOINTS, LM, MINOR_JOINTS, MIN_VISIBILITY, SKELETON } from './geometry';

const COLORS = {
    bone: 'rgba(226, 232, 240, 0.95)', // #e2e8f0
    boneGlow: 'rgba(226, 232, 240, 0.14)',
    joint: '#22c55e',
    wrist: '#f97316',
    jointRing: 'rgba(11, 15, 26, 0.95)', // #0b0f1a
    arc: '#3b82f6',
    arcFill: 'rgba(59, 130, 246, 0.32)',
    label: '#ffffff',
    labelHalo: 'rgba(11, 15, 26, 0.92)',
    trail: '249, 115, 22', // naranja, como "r, g, b" para poder variar el alfa
};

const TRAIL_MS = 650; // cuánto dura visible la estela
const TRAIL_JOINTS = [LM.L_WRIST, LM.R_WRIST];

export function createRenderer() {
    const trails = new Map(); // índice de punto → [{x, y, t}]
    let fontFamily = null; // se lee una vez del CSS para usar la misma fuente que la app

    function updateTrail(idx, p, now, w, h) {
        let points = trails.get(idx);
        if (!points) {
            points = [];
            trails.set(idx, points);
        }

        // Si el punto "salta" (error de tracking), reiniciamos la estela
        // para no dibujar una línea falsa a través de la imagen.
        const last = points[points.length - 1];
        if (last && Math.hypot(p.x - last.x, p.y - last.y) > 0.3 * Math.max(w, h)) {
            points.length = 0;
        }

        points.push({ x: p.x, y: p.y, t: now });
        while (points.length && now - points[0].t > TRAIL_MS) points.shift();
        return points;
    }

    function drawTrail(ctx, points, now, unit) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 1; i < points.length; i += 1) {
            const a = points[i - 1];
            const b = points[i];
            const life = 1 - (now - b.t) / TRAIL_MS; // 1 = recién dibujado, 0 = por desaparecer
            if (life <= 0) continue;

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${COLORS.trail}, ${(life * 0.22).toFixed(3)})`;
            ctx.lineWidth = (6 + 22 * life) * unit; // halo
            ctx.stroke();
            ctx.strokeStyle = `rgba(${COLORS.trail}, ${(life * 0.95).toFixed(3)})`;
            ctx.lineWidth = (2 + 8 * life) * unit; // núcleo
            ctx.stroke();
        }
    }

    function drawArc(ctx, pts, def, deg, sx, unit) {
        const a = pts[def.a];
        const b = pts[def.b];
        const c = pts[def.c];
        if (a.v < MIN_VISIBILITY || b.v < MIN_VISIBILITY || c.v < MIN_VISIBILITY) return;

        const bx = sx(b);
        const a1 = Math.atan2(a.y - b.y, sx(a) - bx);
        const a2 = Math.atan2(c.y - b.y, sx(c) - bx);

        // Elegimos siempre el arco corto entre ambas líneas
        let diff = a2 - a1;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff <= -Math.PI) diff += 2 * Math.PI;
        const counterClockwise = diff < 0;
        const radius = 30 * unit + 8;

        ctx.beginPath();
        ctx.moveTo(bx, b.y);
        ctx.arc(bx, b.y, radius, a1, a2, counterClockwise);
        ctx.closePath();
        ctx.fillStyle = COLORS.arcFill;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(bx, b.y, radius, a1, a2, counterClockwise);
        ctx.strokeStyle = COLORS.arc;
        ctx.lineWidth = 3.5 * unit + 0.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Valor del ángulo (3D) sobre la bisectriz, fuera del arco
        const mid = a1 + diff / 2;
        const dist = radius + 20 * unit + 6;
        const label = `${Math.round(deg)}°`;
        const lx = bx + Math.cos(mid) * dist;
        const ly = b.y + Math.sin(mid) * dist;
        ctx.font = `800 ${Math.round(18 * unit + 8)}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 5;
        ctx.strokeStyle = COLORS.labelHalo;
        ctx.strokeText(label, lx, ly);
        ctx.fillStyle = COLORS.label;
        ctx.fillText(label, lx, ly);
    }

    /**
     * @param pts     puntos de imagen en píxeles [{x, y, v}] o null si no hay cuerpo
     * @param angles  ángulos ya medidos { codoD: 142.3, ... } (en 3D)
     * @param now     tiempo en ms (el mismo que usa el suavizado)
     * @param mirrored  true con la cámara frontal (efecto espejo)
     * @param layers  { skeleton, angles, trails } → qué capas dibujar
     */
    function render(ctx, { pts, angles, w, h, now, mirrored, layers }) {
        ctx.clearRect(0, 0, w, h);

        if (!pts) {
            trails.clear();
            return;
        }

        // El canvas hereda la tipografía de la app: así los números del video
        // se ven con la misma fuente que el resto de la interfaz.
        if (!fontFamily) {
            fontFamily = getComputedStyle(ctx.canvas).fontFamily || 'system-ui, sans-serif';
        }

        const unit = Math.max(w, h) / 1000;
        const sx = mirrored ? (p) => w - p.x : (p) => p.x;
        const visible = (p) => p.v >= MIN_VISIBILITY;

        // 1) Estela de las muñecas (debajo de todo)
        if (layers.trails) {
            for (const idx of TRAIL_JOINTS) {
                const p = pts[idx];
                if (visible(p)) {
                    drawTrail(ctx, updateTrail(idx, { x: sx(p), y: p.y }, now, w, h), now, unit);
                } else {
                    trails.delete(idx);
                }
            }
        } else {
            trails.clear();
        }

        // 2) Huesos
        if (layers.skeleton) {
            ctx.lineCap = 'round';
            for (const [i, j] of SKELETON) {
                const a = pts[i];
                const b = pts[j];
                if (!visible(a) || !visible(b)) continue;
                ctx.beginPath();
                ctx.moveTo(sx(a), a.y);
                ctx.lineTo(sx(b), b.y);
                ctx.strokeStyle = COLORS.boneGlow;
                ctx.lineWidth = 11 * unit;
                ctx.stroke();
                ctx.strokeStyle = COLORS.bone;
                ctx.lineWidth = 3.5 * unit;
                ctx.stroke();
            }
        }

        // 3) Arcos de ángulo (solo los marcados con arc: true y con señal)
        if (layers.angles) {
            for (const def of ANGLES) {
                const deg = angles?.[def.id];
                if (def.arc && typeof deg === 'number') drawArc(ctx, pts, def, deg, sx, unit);
            }
        }

        // 4) Articulaciones (encima); muñecas grandes y naranjas, extremos pequeños
        if (layers.skeleton) {
            for (const i of JOINTS) {
                const p = pts[i];
                if (!visible(p)) continue;
                const isWrist = TRAIL_JOINTS.includes(i);
                const size = isWrist ? 9 : MINOR_JOINTS.has(i) ? 4.5 : 6.5;
                ctx.beginPath();
                ctx.arc(sx(p), p.y, size * unit + 1, 0, Math.PI * 2);
                ctx.fillStyle = isWrist ? COLORS.wrist : COLORS.joint;
                ctx.fill();
                ctx.lineWidth = 2.5 * unit;
                ctx.strokeStyle = COLORS.jointRing;
                ctx.stroke();
            }
        }
    }

    function reset() {
        trails.clear();
        fontFamily = null;
    }

    return { render, reset };
}