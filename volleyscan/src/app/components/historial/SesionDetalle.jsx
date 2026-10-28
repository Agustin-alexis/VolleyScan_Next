'use client';

// Detalle de una sesión: qué corregir primero (con por qué y ejercicio), las
// medidas frente a su rango ideal y cada remate con su "Mi técnica".
import { useState } from 'react';
import TecnicaFoto from '../analisis/TecnicaFoto';
import styles from './Historial.module.css';

const SEV = { grave: 'Grave', moderado: 'Moderado', leve: 'Leve' };
const fmtRango = (r, u) => (r ? `${r[0]}–${r[1]}${u ?? ''}` : '—');
const fmtFecha = (iso) =>
  new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
const claseNota = (n) => (n >= 80 ? styles.notaOk : n >= 60 ? styles.notaMedia : styles.notaBaja);

export default function SesionDetalle({ sesion, onBorrar, borrando }) {
  const [repSel, setRepSel] = useState(null);
  const [foto, setFoto] = useState(null);
  const [confirmar, setConfirmar] = useState(false);

  const reps = sesion.repeticiones ?? [];
  const rep = reps.find((r) => r.numero === repSel) ?? reps.find((r) => r.valida) ?? reps[0];

  return (
    <section className={styles.detalle} aria-label="Detalle de la sesión">
      <header className={styles.detalleHead}>
        <div>
          <h2>Sesión del {fmtFecha(sesion.creadoEn)}</h2>
          <p className={styles.sub}>
            {sesion.repeticionesValidas} de {sesion.totalRepeticiones} remates evaluados
            {sesion.nivel ? ` · nivel ${sesion.nivel}` : ''}
            {sesion.duracionSeg ? ` · ${Math.round(sesion.duracionSeg / 60) || '<1'} min` : ''}
          </p>
        </div>
        <div className={`${styles.notaGrande} ${claseNota(sesion.puntuacion)}`}>{sesion.puntuacion}</div>
      </header>

      {sesion.errores.length > 0 ? (
        <>
          <h3>Qué corregir, en orden</h3>
          <ol className={styles.errores}>
            {sesion.errores.map((e) => (
              <li key={e.medidaId} className={styles.error}>
                <div className={styles.errorTop}>
                  <strong>{e.nombre ?? e.medidaId}</strong>
                  <span className={`${styles.sev} ${styles['sev_' + e.severidad]}`}>{SEV[e.severidad]}</span>
                  <span className={styles.muted}>{e.ocurrencias} {e.ocurrencias === 1 ? 'vez' : 'veces'}</span>
                </div>
                <p>{e.mensaje}</p>
                {e.valorPromedio != null && e.ideal && (
                  <p className={styles.muted}>Tu promedio: <b>{e.valorPromedio}</b> · ideal: <b>{fmtRango(e.ideal)}</b></p>
                )}
                {e.porQue && <p className={styles.porQue}><b>Por qué importa:</b> {e.porQue}</p>}
                {e.ejercicio && <p className={styles.ejercicio}><b>Ejercicio:</b> {e.ejercicio}</p>}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className={styles.bien}>Sin errores que corregir en esta sesión. ¡Buen trabajo!</p>
      )}

      {sesion.fortalezas.length > 0 && (
        <>
          <h3>Lo que hiciste bien</h3>
          <ul className={styles.fortalezas}>{sesion.fortalezas.map((f) => <li key={f}>{f}</li>)}</ul>
        </>
      )}

      {sesion.puntos.length > 0 && (
        <>
          <h3>Medidas de la sesión</h3>
          <div className={styles.tabla} role="table">
            {sesion.puntos.map((p) => (
              <div key={p.medidaId ?? p.nombre} className={styles.fila} role="row">
                <span>{p.nombre}</span>
                <span className={styles.muted}>ideal {fmtRango(p.ideal, p.unidad)}</span>
                <b className={p.aprobado ? styles.txtOk : styles.txtMal}>
                  {p.valorPromedio ?? p.anguloGrados ?? '—'}{p.unidad}
                </b>
              </div>
            ))}
          </div>
        </>
      )}

      <h3>Remate por remate</h3>
      <div className={styles.reps}>
        {reps.map((r) => (
          <button key={r.numero} type="button" onClick={() => setRepSel(r.numero)}
                  className={`${styles.repChip} ${r.numero === rep?.numero ? styles.repOn : ''} ${r.valida ? claseNota(r.puntuacion) : styles.repNo}`}>
            <small>#{r.numero}</small>{r.valida ? r.puntuacion : '—'}
          </button>
        ))}
      </div>

      {rep && (
        <div className={styles.repDetalle}>
          {!rep.valida ? (
            <p className={styles.muted}>Remate descartado: {rep.motivo ?? 'no se pudo medir'}.</p>
          ) : (
            <>
              <p className={styles.sub}>
                Confianza {rep.confianza ?? '—'}{rep.fpsMedio ? ` · ${rep.fpsMedio} fps` : ''}
                {rep.brazo ? ` · brazo ${rep.brazo}` : ''}
              </p>
              {rep.recomendaciones?.principal && (
                <p className={styles.ejercicio}><b>Lo principal:</b> {rep.recomendaciones.principal.mensaje}</p>
              )}
              <div className={styles.tabla}>
                {rep.medidas.map((m) => (
                  <div key={m.id} className={styles.fila}>
                    <span>{m.nombre}</span>
                    <span className={styles.muted}>ideal {fmtRango(m.ideal, m.unidad)}</span>
                    <b className={m.estado === 'ok' ? styles.txtOk : styles.txtMal}>
                      {m.valor == null ? '—' : `${m.valor}${m.unidad ?? ''}`}
                    </b>
                  </div>
                ))}
              </div>
              {rep.claves && (
                <button type="button" className={styles.btnSec} onClick={() => setFoto(rep)}>
                  Ver mi técnica de este remate
                </button>
              )}
            </>
          )}
        </div>
      )}

      <footer className={styles.pie}>
        {confirmar ? (
          <>
            <span>¿Borrar esta sesión y todos sus remates?</span>
            <button type="button" className={styles.btnPeligro} disabled={borrando} onClick={onBorrar}>
              {borrando ? 'Borrando…' : 'Sí, borrar'}
            </button>
            <button type="button" className={styles.btnSec} onClick={() => setConfirmar(false)}>Cancelar</button>
          </>
        ) : (
          <button type="button" className={styles.btnLink} onClick={() => setConfirmar(true)}>Borrar sesión</button>
        )}
      </footer>

      {foto && (
        <div className={styles.modal} role="dialog" aria-modal="true" onClick={() => setFoto(null)}>
          <div className={styles.modalCaja} onClick={(e) => e.stopPropagation()}>
            <TecnicaFoto rep={foto} numero={foto.numero} onClose={() => setFoto(null)} />
          </div>
        </div>
      )}
    </section>
  );
}
