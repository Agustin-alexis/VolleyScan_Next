'use client';

import { useMemo, useState } from 'react';
import { LM } from '@/lib/pose/geometry';
import { REMATE } from '@/lib/movimientos/remate';
import styles from './TecnicaFoto.module.css';

const TABS = [
    { id: 'carga', label: 'Carga', fases: ['carga'] },
    { id: 'contacto', label: 'Contacto', fases: ['vuelo', 'golpeo'] },
    { id: 'caida', label: 'Caída', fases: ['caida'] },
];

const HUESOS = [
    { par: [LM.L_SHOULDER, LM.R_SHOULDER], grupo: 'tronco' },
    { par: [LM.L_HIP, LM.R_HIP], grupo: 'tronco' },
    { par: [LM.L_SHOULDER, LM.L_HIP], grupo: 'tronco' },
    { par: [LM.R_SHOULDER, LM.R_HIP], grupo: 'tronco' },
    { par: [LM.L_SHOULDER, LM.L_ELBOW], grupo: 'brazoI' },
    { par: [LM.L_ELBOW, LM.L_WRIST], grupo: 'brazoI' },
    { par: [LM.R_SHOULDER, LM.R_ELBOW], grupo: 'brazoD' },
    { par: [LM.R_ELBOW, LM.R_WRIST], grupo: 'brazoD' },
    { par: [LM.L_HIP, LM.L_KNEE], grupo: 'piernas' },
    { par: [LM.L_KNEE, LM.L_ANKLE], grupo: 'piernas' },
    { par: [LM.R_HIP, LM.R_KNEE], grupo: 'piernas' },
    { par: [LM.R_KNEE, LM.R_ANKLE], grupo: 'piernas' },
];

// Todo se dibuja en centésimas de torso: con unidades tan pequeñas como 0.2,
// algunos navegadores redondean el texto y los trazos del SVG.
const K = 100;

const COLOR = { ok: '#22c55e', error: '#f97316', casi: '#3b82f6', neutro: '#475569' };

// Estado de una medida: ok, error (cuesta puntos) o casi (fuera del rango, pero cerca)
function estadoDe(m) {
    if (m.puntaje === null) return 'neutro';
    if (m.estado === 'ok') return 'ok';
    return m.puntaje < REMATE.umbralError ? 'error' : 'casi';
}

// El peor estado del grupo: un error pinta todo el tramo de naranja
function estadoGrupo(medidas) {
    const estados = medidas.map(estadoDe);
    if (estados.includes('error')) return 'error';
    if (estados.includes('casi')) return 'casi';
    if (estados.includes('ok')) return 'ok';
    return 'neutro';
}

const formato = (n, unidad) => (unidad === '°' ? `${Math.round(n)}°` : `${n}`);
const unidadCorta = (u) => (u === '°' ? '°' : ` ${u.split(' ')[0]}`);

function Barra({ medida }) {
    const [lo, hi] = medida.ideal;
    const pad = (hi - lo) * 0.5 + 0.001;
    const valor = medida.valor;
    const min = Math.min(lo - pad, valor ?? lo);
    const max = Math.max(hi + pad, valor ?? hi);
    const pos = (n) => `${((n - min) / (max - min)) * 100}%`;
    const estado = estadoDe(medida);

    return (
        <div className={styles.barra} aria-hidden="true">
            <span className={styles.ideal} style={{ left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})` }} />
            {valor !== null && <span className={styles.marca} data-estado={estado} style={{ left: pos(valor) }} />}
        </div>
    );
}

export default function TecnicaFoto({ rep, numero, mirrored = false, onClose }) {
    const [tab, setTab] = useState('contacto');
    const claves = rep?.claves;
    const actual = TABS.find((t) => t.id === tab);
    const marco = claves?.[tab];

    const medidasTab = useMemo(
        () => (rep?.medidas ?? []).filter((m) => actual.fases.includes(m.fase)),
        [rep, actual],
    );

    // Encuadre común a los tres cuadros: la figura no cambia de tamaño al cambiar de pestaña
    const vista = useMemo(() => {
        const xs = [];
        const ys = [];
        for (const id of ['carga', 'contacto', 'caida']) {
            for (const p of Object.values(claves?.[id]?.puntos ?? {})) {
                xs.push(p.x);
                ys.push(p.y);
            }
        }
        if (!xs.length) return { x: -2 * K, y: -3 * K, w: 4 * K, h: 6 * K };
        const x0 = Math.min(...xs) - 0.6;
        const x1 = Math.max(...xs) + 0.6;
        const y0 = Math.min(...ys) - 0.7;
        const y1 = Math.max(...ys) + 0.5;
        const ancho = Math.max(x1 - x0, (y1 - y0) * 0.62);
        // Con el efecto espejo el dibujo se voltea, y el centro también
        const cx = ((x0 + x1) / 2) * (mirrored ? -1 : 1);
        return { x: (cx - ancho / 2) * K, y: y0 * K, w: ancho * K, h: (y1 - y0) * K };
    }, [claves, mirrored]);

    if (!rep?.valida || !claves) return null;

    const lado = claves.lado === 'R' ? 'D' : 'I';
    const punto = (idx) => {
        const p = marco?.puntos?.[idx];
        if (!p || p.v < 0.5) return null;
        return { x: (mirrored ? -p.x : p.x) * K, y: p.y * K };
    };

    // Qué tramo del cuerpo se resalta en cada pestaña, y de qué color
    const colorGrupo = (grupo) => {
        if (tab === 'contacto' && grupo === `brazo${lado}`) return COLOR[estadoGrupo(medidasTab)];
        if (tab !== 'contacto' && grupo === 'piernas') return COLOR[estadoGrupo(medidasTab)];
        return COLOR.neutro;
    };
    const resaltado = (grupo) => colorGrupo(grupo) !== COLOR.neutro;

    // Etiquetas de ángulo sobre las articulaciones de la pestaña
    const etiquetas = [];
    const angulos = marco?.angulos ?? {};
    if (tab === 'contacto') {
        const codo = punto(claves.lado === 'R' ? LM.R_ELBOW : LM.L_ELBOW);
        const hombro = punto(claves.lado === 'R' ? LM.R_SHOULDER : LM.L_SHOULDER);
        if (codo && angulos[`codo${lado}`] != null) etiquetas.push({ ...codo, texto: `${angulos[`codo${lado}`]}°`, dx: 12 });
        if (hombro && angulos[`hombro${lado}`] != null) etiquetas.push({ ...hombro, texto: `${angulos[`hombro${lado}`]}°`, dx: -12 });
    } else {
        for (const [idx, id] of [[LM.L_KNEE, 'rodillaI'], [LM.R_KNEE, 'rodillaD']]) {
            const p = punto(idx);
            if (p && angulos[id] != null) etiquetas.push({ ...p, texto: `${angulos[id]}°`, dx: 12 });
        }
    }

    const nariz = punto(LM.NOSE);
    const sinCuadro = !marco;

    return (
        <section className={styles.panel} aria-label={`Técnica del remate ${numero}`}>
            <header className={styles.top}>
                <div>
                    <h3 className={styles.title}>Tu técnica · Remate {numero}</h3>
                    <p className={styles.sub}>Cuadros clave del remate, con tus ángulos frente a lo ideal.</p>
                </div>

                <div className={styles.tabs} role="tablist" aria-label="Momento del remate">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            role="tab"
                            aria-selected={tab === t.id}
                            className={styles.tab}
                            onClick={() => setTab(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
                    ×
                </button>
            </header>

            <div className={styles.body}>
                <div className={styles.lienzo}>
                    {sinCuadro ? (
                        <p className={styles.vacio}>No se alcanzó a registrar este momento del remate.</p>
                    ) : (
                        <svg viewBox={`${vista.x} ${vista.y} ${vista.w} ${vista.h}`} role="img" aria-label={`Esqueleto en ${actual.label.toLowerCase()}`}>
                            {HUESOS.map(({ par, grupo }) => {
                                const a = punto(par[0]);
                                const b = punto(par[1]);
                                if (!a || !b) return null;
                                return (
                                    <line
                                        key={`${par[0]}-${par[1]}`}
                                        x1={a.x}
                                        y1={a.y}
                                        x2={b.x}
                                        y2={b.y}
                                        stroke={colorGrupo(grupo)}
                                        strokeWidth={resaltado(grupo) ? 9 : 6}
                                        strokeLinecap="round"
                                        opacity={resaltado(grupo) || grupo === 'tronco' ? 1 : 0.7}
                                    />
                                );
                            })}
                            {nariz && <circle cx={nariz.x} cy={nariz.y} r={20} fill="#0b0f1a" stroke={COLOR.neutro} strokeWidth={5} />}
                            {Object.keys(marco.puntos).map((idx) => {
                                const p = punto(Number(idx));
                                if (!p || Number(idx) === LM.NOSE) return null;
                                return <circle key={idx} cx={p.x} cy={p.y} r={7} fill="#cbd5e1" />;
                            })}
                            {etiquetas.map((e) => (
                                <text
                                    key={`${e.x}-${e.y}`}
                                    x={e.x + e.dx}
                                    y={e.y}
                                    className={styles.angulo}
                                    textAnchor={e.dx > 0 ? 'start' : 'end'}
                                    dominantBaseline="middle"
                                >
                                    {e.texto}
                                </text>
                            ))}
                        </svg>
                    )}
                </div>

                <div className={styles.medidas}>
                    {medidasTab.length === 0 && <p className={styles.vacio}>Sin medidas en este momento.</p>}
                    {medidasTab.map((m) => (
                        <div key={m.id} className={styles.medida}>
                            <div className={styles.medidaTop}>
                                <span className={styles.medidaNombre}>{m.nombre}</span>
                                <span className={styles.medidaValor} data-estado={estadoDe(m)}>
                                    {m.valor === null ? 'Sin dato' : `${formato(m.valor, m.unidad)}${m.unidad === '°' ? '' : unidadCorta(m.unidad)}`}
                                </span>
                            </div>
                            <Barra medida={m} />
                            <p className={styles.rango}>
                                Ideal: {m.ideal[0]}–{m.ideal[1]}
                                {m.unidad === '°' ? '°' : ` ${m.unidad}`}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}