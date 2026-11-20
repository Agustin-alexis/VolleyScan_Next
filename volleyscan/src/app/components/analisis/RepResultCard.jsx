'use client';

import { useEffect, useState } from 'react';
import { REMATE } from '@/lib/movimientos/remate';
import { generarVozCoachRep, speakCoachFeedback } from '@/lib/voice/voiceCoach';
import styles from './RepResultCard.module.css';

const VISIBLE_MS = 18000;
const RADIO = 34;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

const tonoDe = (score) => (score >= 80 ? 'alto' : score >= 60 ? 'medio' : 'bajo');

const AVISO_CONFIANZA = {
    media: 'Medición con precisión media. Más luz y buen encuadre la mejoran.',
    baja: 'Medición aproximada: la cámara va lenta. Mejora la luz o baja la calidad del modelo para ganar fps.',
};

const lista = (items) => items.map((i) => i.nombre.toLowerCase()).join(', ');

export default function RepResultCard({ rep, numero, comparacion, onVerTecnica }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!rep) return undefined;
        setVisible(true);
        const id = setTimeout(() => setVisible(false), VISIBLE_MS);
        return () => clearTimeout(id);
    }, [rep]);

    if (!rep || !visible) return null;

    const nombreGesto =
        rep.movimientoNombre ??
        (rep.movimiento ? rep.movimiento.charAt(0).toUpperCase() + rep.movimiento.slice(1) : 'Remate');
    const vozTexto = rep.vozCoach || generarVozCoachRep(rep);

    const cerrar = (
        <button
            type="button"
            className={styles.close}
            onClick={() => setVisible(false)}
            aria-label="Cerrar resultado"
        >
            ×
        </button>
    );

    if (!rep.valida) {
        return (
            <div className={styles.card} role="status" aria-live="polite">
                {cerrar}
                <h3 className={styles.title}>
                    {nombreGesto} #{numero}
                </h3>
                <p className={styles.sub}>No pudimos evaluarlo</p>
                <p className={styles.motivo}>{rep.motivo}</p>
            </div>
        );
    }

    const principal = rep.principal;
    const otras = rep.errores.slice(principal ? 1 : 0, 3);
    const limpias = rep.errores.length === 0 ? rep.puntosClave.slice(0, 2) : [];
    const nivel = REMATE.niveles?.[rep.nivel]?.nombre;
    const delta = comparacion?.deltaScore ?? null;
    const signo = delta === null ? null : delta > 0 ? 'sube' : delta < 0 ? 'baja' : 'igual';

    return (
        <div className={styles.card} role="status" aria-live="polite">
            {cerrar}

            <div className={styles.head}>
                <div className={styles.ring} data-tone={tonoDe(rep.score)}>
                    <svg viewBox="0 0 80 80" aria-hidden="true">
                        <circle className={styles.ringTrack} cx="40" cy="40" r={RADIO} />
                        <circle
                            className={styles.ringFill}
                            cx="40"
                            cy="40"
                            r={RADIO}
                            strokeDasharray={`${(rep.score / 100) * CIRCUNFERENCIA} ${CIRCUNFERENCIA}`}
                        />
                    </svg>
                    <div className={styles.ringText}>
                        <span className={styles.score}>{rep.score}</span>
                        <span className={styles.outOf}>/100</span>
                    </div>
                </div>

                <div>
                    <h3 className={styles.title}>
                        {nombreGesto} #{numero}
                    </h3>
                    <p className={styles.sub}>
                        {rep.brazo === 'ambos brazos' ? 'Ambos brazos' : `Brazo ${rep.brazo}`}
                        {nivel ? ` · ${nivel}` : ''}
                    </p>
                    <div className={styles.metaBadges}>
                        {rep.saltoVerticalCm > 0 && (
                            <span className={styles.jumpPill}>Salto: {rep.saltoVerticalCm} cm</span>
                        )}
                        {rep.velocidadPicoMs > 0 && (
                            <span className={styles.speedPill}>{rep.velocidadPicoMs} m/s</span>
                        )}
                        <button
                            type="button"
                            className={styles.speakMiniBtn}
                            onClick={() => speakCoachFeedback(vozTexto)}
                            title="Escuchar feedback del Coach IA"
                        >
                            🔊 Voz
                        </button>
                    </div>
                    {signo && (
                        <span className={styles.delta} data-signo={signo}>
                            {signo === 'igual'
                                ? 'Igual que el anterior'
                                : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} vs el anterior`}
                        </span>
                    )}
                </div>
            </div>

            {rep.confianza && rep.confianza !== 'alta' && (
                <p className={styles.conf} data-nivel={rep.confianza}>
                    {AVISO_CONFIANZA[rep.confianza]}
                </p>
            )}

            {principal && (
                <>
                    <p className={styles.label}>Lo más importante</p>
                    <div className={styles.principal} data-tipo={principal.severidad}>
                        <p className={styles.principalTexto}>{principal.mensaje}</p>
                        {principal.porQue && <p className={styles.porQue}>{principal.porQue}</p>}
                        {principal.ejercicio && (
                            <p className={styles.ejercicio}>
                                <span className={styles.ejercicioLabel}>Ejercicio</span>
                                {principal.ejercicio}
                            </p>
                        )}
                    </div>
                </>
            )}

            {otras.length > 0 && (
                <>
                    <p className={styles.label}>También corregir</p>
                    <ul className={styles.list}>
                        {otras.map((e) => (
                            <li key={e.medidaId} className={styles.item} data-tipo={e.severidad}>
                                {e.mensaje}
                            </li>
                        ))}
                    </ul>
                </>
            )}

            {limpias.length > 0 && (
                <>
                    <p className={styles.label}>Qué salió bien</p>
                    <ul className={styles.list}>
                        {limpias.map((texto) => (
                            <li key={texto} className={styles.item} data-tipo="bien">
                                {texto}
                            </li>
                        ))}
                    </ul>
                </>
            )}

            {!principal && rep.diagnosticoCausaRaiz && (
                <div className={styles.principal} data-tipo="media">
                    <p className={styles.principalTexto}>{rep.diagnosticoCausaRaiz}</p>
                </div>
            )}

            {comparacion && (comparacion.mejoras.length > 0 || comparacion.retrocesos.length > 0) && (
                <div className={styles.cambios}>
                    {comparacion.mejoras.length > 0 && (
                        <p className={styles.cambio} data-signo="sube">
                            Mejoraste: {lista(comparacion.mejoras.slice(0, 2))}
                        </p>
                    )}
                    {comparacion.retrocesos.length > 0 && (
                        <p className={styles.cambio} data-signo="baja">
                            Empeoró: {lista(comparacion.retrocesos.slice(0, 2))}
                        </p>
                    )}
                </div>
            )}

            {(rep.claves || rep.ablacion || rep.videoReplayBase64) && onVerTecnica && (
                <div className={styles.btnRow}>
                    <button type="button" className={styles.btnFoto} onClick={() => onVerTecnica('fases')}>
                        🔬 Ver 4 Fases
                    </button>
                    <button type="button" className={styles.btn3d} onClick={() => onVerTecnica('3d')}>
                        🧊 Replay 3D
                    </button>
                    {(rep.ablacion || rep.videoReplayBase64) && (
                        <button type="button" className={styles.btn3d} onClick={() => onVerTecnica('ablacion')}>
                            📊 Ablación
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
