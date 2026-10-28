'use client';

// Evolución de la puntuación en las últimas sesiones (SVG, sin librerías).
import { useState } from 'react';
import styles from './Historial.module.css';

const W = 640, H = 200, PX = 36, PT = 14, PB = 28;

const fechaCorta = (iso) =>
  new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

export default function EvolucionChart({ puntos, onElegir, elegida }) {
  const [hover, setHover] = useState(null);
  if (!puntos?.length) return null;

  const x = (i) => (puntos.length === 1 ? W / 2 : PX + (i * (W - PX * 2)) / (puntos.length - 1));
  const y = (v) => PT + ((100 - v) / 100) * (H - PT - PB);
  const linea = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.puntuacion)}`).join(' ');
  const area = `${linea} L${x(puntos.length - 1)},${H - PB} L${x(0)},${H - PB} Z`;
  const activo = hover ?? puntos.findIndex((p) => p.id === elegida);

  return (
    <div className={styles.chartWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img"
          aria-label="Evolución de la puntuación por sesión">
        <defs>
          <linearGradient id="evoArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={PX} x2={W - PX} y1={y(v)} y2={y(v)} stroke="#1f2634" strokeWidth="1" />
            <text x={PX - 8} y={y(v) + 4} textAnchor="end" fill="#94a3b8" fontSize="11">{v}</text>
          </g>
        ))}
        {puntos.length > 1 && <path d={area} fill="url(#evoArea)" />}
        {puntos.length > 1 && <path d={linea} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" />}
        {puntos.map((p, i) => (
          <g key={p.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
             onClick={() => onElegir?.(p.id)} style={{ cursor: 'pointer' }}>
            <circle cx={x(i)} cy={y(p.puntuacion)} r="14" fill="transparent" />
            <circle cx={x(i)} cy={y(p.puntuacion)} r={i === activo ? 6 : 4}
                    fill={p.id === elegida ? '#22c55e' : '#3b82f6'} stroke="#0b0f1a" strokeWidth="2" />
          </g>
        ))}
        {[0, puntos.length - 1].filter((i, k, a) => a.indexOf(i) === k).map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : 'end'} fill="#94a3b8" fontSize="11">
            {fechaCorta(puntos[i].creadoEn)}
          </text>
        ))}
        {activo >= 0 && (
          <text x={Math.min(Math.max(x(activo), 40), W - 40)} y={y(puntos[activo].puntuacion) - 12}
                textAnchor="middle" fill="#e2e8f0" fontSize="12" fontWeight="700">
            {puntos[activo].puntuacion} · {fechaCorta(puntos[activo].creadoEn)}
          </text>
        )}
      </svg>
    </div>
  );
}
