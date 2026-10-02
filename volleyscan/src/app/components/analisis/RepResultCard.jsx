'use client';

// ─────────────────────────────────────────────────────────────
// RepResultCard.jsx — Resultado de un remate (VolleyScan)
//
// Aparece sobre la cámara al terminar cada remate, con el score en un
// anillo y lo que hay que corregir (o, si salió limpio, lo que salió
// bien). Se oculta sola a los 12 s o con la X.
//
// Usa su propio CSS (RepResultCard.module.css) para no tocar el del
// resto de la pantalla.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import styles from './RepResultCard.module.css';

const VISIBLE_MS = 12000;
const RADIO = 34;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

const tonoDe = (score) => (score >= 80 ? 'alto' : score >= 60 ? 'medio' : 'bajo');

export default function RepResultCard({ rep, numero }) {
    const [visible, setVisible] = useState(false);

    // Cada remate nuevo vuelve a mostrar la tarjeta y reinicia el temporizador
    useEffect(() => {
        if (!rep) return undefined;
        setVisible(true);
        const id = setTimeout(() => setVisible(false), VISIBLE_MS);
        return () => clearTimeout(id);
    }, [rep]);

    if (!rep || !visible) return null;

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

    // Remate que no se pudo evaluar: se explica por qué
    if (!rep.valida) {
        return (
            <div className={styles.card} role="status" aria-live="polite">
                {cerrar}
                <h3 className={styles.title}>Remate {numero}</h3>
                <p className={styles.sub}>No pudimos evaluarlo</p>
                <p className={styles.motivo}>{rep.motivo}</p>
            </div>
        );
    }

    const corregir = rep.errores.slice(0, 3);
    const items = corregir.length
        ? corregir.map((e) => ({ texto: e.mensaje, tipo: e.severidad }))
        : rep.puntosClave.slice(0, 2).map((texto) => ({ texto, tipo: 'bien' }));

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
                    <h3 className={styles.title}>Remate {numero}</h3>
                    <p className={styles.sub}>Brazo {rep.brazo}</p>
                </div>
            </div>

            <p className={styles.label}>{corregir.length ? 'Qué corregir' : 'Qué salió bien'}</p>
            <ul className={styles.list}>
                {items.map((item) => (
                    <li key={item.texto} className={styles.item} data-tipo={item.tipo}>
                        {item.texto}
                    </li>
                ))}
            </ul>
        </div>
    );
}