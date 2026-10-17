'use client';


import styles from '@/app/components/analisis/GestureAnalyzer.module.css'

export default function AngleGauge({ value, range, side, label, max = 180, wide = false }) {
    const hasValue = typeof value === 'number';

    // Convierte grados a porcentaje de la barra (acotado a 0–100)
    const pct = (deg) => Math.min(100, Math.max(0, (deg / max) * 100));

    const hasRange = Boolean(range) && range.max - range.min > 1;

    return (
        <div
            className={`${styles.meter} ${wide ? styles.meterWide : ''}`}
            role="img"
            aria-label={hasValue ? `${label}: ${Math.round(value)} grados` : `${label}: sin señal`}
        >
            <div className={styles.meterTop}>
                <span className={styles.side}>{side}</span>
                <span className={`${styles.value} ${hasValue ? '' : styles.valueOff}`}>
                    {hasValue ? `${Math.round(value)}°` : '—'}
                </span>
            </div>

            <div className={styles.track} data-scale={max}>
                {hasRange && (
                    <span
                        className={styles.range}
                        style={{
                            left: `${pct(range.min)}%`,
                            width: `${pct(range.max) - pct(range.min)}%`,
                        }}
                    />
                )}
                <span className={styles.fill} style={{ width: hasValue ? `${pct(value)}%` : '0%' }} />
            </div>
        </div>
    );
}