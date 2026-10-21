'use client';


import { REMATE } from '@/lib/movimientos/remate'
import styles from './DiagnosticoPanel.module.css';

const DET = REMATE.deteccion;
const MAX_LIFT = 0.6; // torsos: fin de escala de la barra de pies
const MAX_SPEED = 12; // torsos/s: fin de escala de la barra de muñeca
const MAX_KNEE = 180; // grados

function Medidor({ etiqueta, valor, umbral, max, unidad, invertido = false, ayuda }) {
    const hay = valor !== null && valor !== undefined;
    const cumple = hay && (invertido ? valor < umbral : valor > umbral);
    const pos = (n) => `${Math.min(100, Math.max(0, (n / max) * 100))}%`;

    return (
        <div className={styles.medidor}>
            <div className={styles.medidorTop}>
                <span className={styles.etiqueta}>{etiqueta}</span>
                <span className={styles.valor} data-cumple={cumple}>
                    {hay ? `${valor.toFixed(unidad === '°' ? 0 : 2)}${unidad === '°' ? '°' : ''}` : '–'}
                    <span className={styles.umbral}>
                        {invertido ? ' < ' : ' > '}
                        {umbral}
                        {unidad === '°' ? '°' : ''}
                    </span>
                </span>
            </div>
            <div className={styles.barra} aria-hidden="true">
                {hay && <span className={styles.relleno} data-cumple={cumple} style={{ width: pos(valor) }} />}
                <span className={styles.tick} style={{ left: pos(umbral) }} />
            </div>
            <p className={styles.ayuda}>{ayuda}</p>
        </div>
    );
}

function Historia({ datos, clave, max, umbral, titulo }) {
    const W = 100;
    const H = 30;
    const puntos = datos.map((d, i) => {
        const x = datos.length > 1 ? (i / (datos.length - 1)) * W : W;
        const y = H - Math.min(1, Math.max(0, d[clave] / max)) * H;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const yUmbral = H - (umbral / max) * H;

    return (
        <figure className={styles.historia}>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={titulo}>
                <line x1="0" x2={W} y1={yUmbral} y2={yUmbral} className={styles.lineaUmbral} />
                {puntos.length > 1 && <polyline points={puntos.join(' ')} className={styles.curva} />}
            </svg>
            <figcaption>{titulo}</figcaption>
        </figure>
    );
}

// Qué le falta al motor para detectar un remate en este instante
function queFalta(d) {
    if (!d) return 'Activa la cámara para ver el diagnóstico.';
    if (!d.cuerpo) return 'No veo tu cuerpo completo. Necesito hombros, caderas y pies dentro del marco.';
    if (d.aire) {
        const v = Math.max(d.speedL, d.speedR);
        return v > DET.golpeVelocidadMin
            ? 'En el aire y con golpe detectado. Aterriza para ver tu resultado.'
            : `En el aire. Golpea con el brazo por encima del hombro: la muñeca debe pasar de ${DET.golpeVelocidadMin} torsos/s.`;
    }
    if (d.lift < DET.saltoMinTorsos) {
        return `Salta: tus pies deben subir más de ${DET.saltoMinTorsos} torsos (ahora ${d.lift.toFixed(2)}).`;
    }
    return 'Listo. Salta y golpea.';
}

function ultimoRemate(rep) {
    if (!rep) return 'Aún no hay remates en esta sesión.';
    if (!rep.valida) return `Rechazado: ${rep.motivo}`;
    return `${rep.score}/100 · confianza ${rep.confianza} · ${rep.fpsMedio} fps durante el vuelo.`;
}

export default function DiagnosticoPanel({ live, phase, fasesNombre, rep, onClose }) {
    const d = live.diag?.actual ?? null;
    const historia = live.diag?.historia ?? [];
    const lenta = live.fps > 0 && live.fps < 20;
    const velocidad = d?.cuerpo ? Math.max(d.speedL, d.speedR) : null;

    return (
        <aside className={styles.panel} aria-label="Diagnóstico del motor">
            <header className={styles.top}>
                <div>
                    <h3 className={styles.title}>Diagnóstico del motor</h3>
                    <p className={styles.sub}>
                        Fase: <strong>{fasesNombre[phase]}</strong> · {live.fps} fps
                    </p>
                </div>
                <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar diagnóstico">
                    ×
                </button>
            </header>

            {lenta && (
                <p className={styles.alerta}>
                    La cámara va a {live.fps} fps. Con menos de 20 la medición del golpe es aproximada: mejora la luz o usa el
                    modelo liviano.
                </p>
            )}

            <p className={styles.estado} data-listo={d?.cuerpo && !d.aire && d.lift >= DET.saltoMinTorsos ? 'no' : 'si'}>
                {queFalta(d)}
            </p>

            <Medidor
                etiqueta="Pies elevados"
                valor={d?.cuerpo ? d.lift : null}
                umbral={DET.saltoMinTorsos}
                max={MAX_LIFT}
                unidad="torsos"
                ayuda="Cuánto suben tus pies del suelo. Pasa el umbral = salto."
            />
            <Medidor
                etiqueta="Velocidad de la muñeca"
                valor={velocidad}
                umbral={DET.golpeVelocidadMin}
                max={MAX_SPEED}
                unidad="torsos/s"
                ayuda="La del brazo más rápido. Pasa el umbral sobre el hombro = golpe."
            />
            <Medidor
                etiqueta="Rodilla"
                valor={d?.cuerpo ? d.kneeMean : null}
                umbral={DET.cargaRodillaMax}
                max={MAX_KNEE}
                unidad="°"
                invertido
                ayuda="Promedio de ambas rodillas. Bajo el umbral = fase de carga."
            />

            {historia.length > 1 && (
                <div className={styles.historias}>
                    <Historia datos={historia} clave="lift" max={MAX_LIFT} umbral={DET.saltoMinTorsos} titulo="Pies · 5 s" />
                    <Historia datos={historia} clave="speed" max={MAX_SPEED} umbral={DET.golpeVelocidadMin} titulo="Muñeca · 5 s" />
                </div>
            )}

            <p className={styles.ultimo} data-valido={rep ? (rep.valida ? 'si' : 'no') : 'ninguno'}>
                <span className={styles.ultimoLabel}>Último remate</span>
                {ultimoRemate(rep)}
            </p>
        </aside>
    );
}