'use client';

import './Reportes.css'

import { useState, useEffect, useRef } from 'react';


const DATA = {
    'Juan Pérez': { perf: 85, asis: 92, ses: 24, errores: 8, ejercicios: 47, spark: [60, 65, 70, 68, 78, 82, 85] },
    'María González': { perf: 78, asis: 88, ses: 20, errores: 12, ejercicios: 38, spark: [55, 58, 62, 65, 70, 75, 78] },
    'Carlos Ramírez': { perf: 91, asis: 96, ses: 30, errores: 4, ejercicios: 60, spark: [75, 80, 82, 85, 88, 90, 91] },
    'Sofía Ortega': { perf: 62, asis: 70, ses: 12, errores: 20, ejercicios: 25, spark: [45, 48, 50, 55, 57, 60, 62] },
    'Andrés López': { perf: 80, asis: 90, ses: 22, errores: 9, ejercicios: 44, spark: [60, 65, 68, 72, 75, 78, 80] },
};
const RECS = {
    'Juan Pérez': ['Aumentar series de bloqueo', 'Reforzar recepción en diagonal', 'Trabajar posición de ataque Z4'],
    'María González': ['Mejorar velocidad de reacción', 'Consolidar defensa de pipe', 'Ejercicios de salto vertical'],
    'Carlos Ramírez': ['Mantener rutina de fuerza', 'Explorar variantes de saque float', 'Liderazgo en sistema 6-2'],
    'Sofía Ortega': ['Recuperar consistencia en asistencia', 'Repasar fundamentos de armado', 'Sesiones de confianza mental'],
    'Andrés López': ['Mejorar recepción en zona 1', 'Trabajar coordinación con armadora', 'Fortalecer tren superior'],
};

function fmt(d) { return d.toISOString().split('T')[0]; }
function fmtDisp(s) { if (!s) return '—'; const d = new Date(s + 'T00:00'); return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }); }

function Sparkline({ pts, w = 220, h = 56, id }) {
    const pad = 4;
    const min = Math.min(...pts), max = Math.max(...pts);
    const xp = i => pad + i * (w - pad * 2) / (pts.length - 1);
    const yp = v => h - pad - (v - min) / (max - min || 1) * (h - pad * 2);
    let d = `M${xp(0)},${yp(pts[0])}`;
    pts.forEach((v, i) => { if (i > 0) d += ` L${xp(i)},${yp(v)}`; });
    const area = d + ` L${xp(pts.length - 1)},${h} L${xp(0)},${h} Z`;
    return (
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: `${h}px`, overflow: 'visible' }}>
            <defs>
                <linearGradient id={`sg${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity=".4" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={area} fill={`url(#sg${id})`} />
            <path d={d} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((v, i) => <circle key={i} cx={xp(i)} cy={yp(v)} r="3" fill="#60a5fa" />)}
        </svg>
    );
}

export default function Reportes() {
    const today = new Date();
    const from0 = new Date(today); from0.setDate(from0.getDate() - 17);
    const [step, setStep] = useState(1);
    const [tipo, setTipo] = useState('Individual');
    const [dep, setDep] = useState('Juan Pérez');
    const [dateFrom, setDateFrom] = useState(fmt(from0));
    const [dateTo, setDateTo] = useState(fmt(today));
    const [checks, setChecks] = useState({ Rendimiento: true, Asistencia: true, Ejercicios: true, Errores: true, Recomendaciones: true });
    const [fmt2, setFmt2] = useState('pdf');
    const [progress, setProgress] = useState(0);
    const [progressLabel, setProgressLabel] = useState('');
    const [exporting, setExporting] = useState(false);
    const [exportDone, setExportDone] = useState(false);
    const [fullPreview, setFullPreview] = useState(false);
    const [toast, setToast] = useState({ show: false, msg: '' });

    function showToast(msg) { setToast({ show: true, msg }); setTimeout(() => setToast(t => ({ ...t, show: false })), 3200); }

    const d = DATA[dep] || DATA['Juan Pérez'];
    const circ = 2 * Math.PI * 54;
    const offset = circ * (1 - d.perf / 100);
    const circ2 = 2 * Math.PI * 22;
    const offset2 = circ2 * (1 - d.asis / 100);

    function goStep(n) {
        if (n > step) {
            if (step === 1 && (!dateFrom || !dateTo)) { showToast('Selecciona el rango de fechas'); return; }
            if (step === 1 && dateFrom > dateTo) { showToast('La fecha inicio debe ser antes del fin'); return; }
        }
        setStep(n);
        if (n === 3) { setProgress(0); setExporting(false); setExportDone(false); }
    }

    function doExport() {
        setExporting(true); setExportDone(false);
        const steps = ['Recopilando datos...', 'Generando estadísticas...', 'Aplicando formato...', 'Finalizando...'];
        let p = 0, si = 0;
        const iv = setInterval(() => {
            p = Math.min(p + Math.random() * 12 + 3, 100);
            setProgress(Math.round(p));
            const ni = Math.floor(p / 25); if (ni !== si && ni < steps.length) { si = ni; setProgressLabel(steps[si]); }
            if (p >= 100) {
                clearInterval(iv);
                // Real export for CSV/JSON
                if (fmt2 === 'csv' || fmt2 === 'json') {
                    let content = '', mime = '', ext = fmt2;
                    if (fmt2 === 'csv') { content = `Reporte ${tipo},${dep}\nRendimiento,${d.perf}%\nAsistencia,${d.asis}%\nSesiones,${d.ses}\nEjercicios,${d.ejercicios}\nErrores,${d.errores}`; mime = 'text/csv'; }
                    else { content = JSON.stringify({ tipo, deportista: dep, desde: dateFrom, hasta: dateTo, rendimiento: `${d.perf}%`, asistencia: `${d.asis}%`, sesiones: d.ses }, null, 2); mime = 'application/json'; }
                    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: mime }));
                    a.download = `reporte_${dep.replace(' ', '_').toLowerCase()}.${ext}`; a.click();
                }
                setTimeout(() => { setExporting(false); setExportDone(true); showToast('Reporte exportado exitosamente ✓'); }, 400);
            }
        }, 120);
    }

    function reset() {
        setTipo('Individual'); setDep('Juan Pérez');
        setDateFrom(fmt(from0)); setDateTo(fmt(today));
        setChecks({ Rendimiento: true, Asistencia: true, Ejercicios: true, Errores: true, Recomendaciones: true });
        showToast('Filtros restablecidos');
    }

    const stats = [
        checks.Rendimiento && { val: `${d.perf}%`, key: 'Rendimiento promedio', color: 'var(--green)' },
        checks.Asistencia && { val: `${d.asis}%`, key: 'Asistencia', color: 'var(--accent2)' },
        checks.Ejercicios && { val: d.ejercicios, key: 'Ejercicios completados', color: 'var(--purple2)' },
        checks.Errores && { val: d.errores, key: 'Errores registrados', color: 'var(--red)' },
    ].filter(Boolean);

    return (
        <>
            <main className="rep-main">
                <h2 className="page-title">Reportes</h2>

                {/* Stepper */}
                <section className="stepper">
                    {[['1', 'Filtros'], ['2', 'Vista previa'], ['3', 'Exportar']].map(([n, label], i) => (
                        <div key={n} style={{ display: 'contents' }}>
                            <article className={`step ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}`} onClick={() => goStep(i + 1)} style={{ cursor: 'pointer' }}>
                                <span className="step-num">{n}</span>
                                <p className="step-label">{label}</p>
                            </article>
                            {i < 2 && <span className="step-arrow"><i className="fa-solid fa-chevron-right"></i></span>}
                        </div>
                    ))}
                </section>

                {/* STEP 1 */}
                {step === 1 && (
                    <section id="viewStep1">
                        <section className="two-col">
                            <article className="panel">
                                <p className="field-label">Tipo de reporte</p>
                                <section className="radio-group">
                                    {['Individual', 'Grupal', 'Por fechas'].map(t => (
                                        <label key={t} className="radio-opt">
                                            <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} />
                                            <span className="radio-circle"></span>
                                            <span className="radio-text">{t}</span>
                                        </label>
                                    ))}
                                </section>

                                {tipo === 'Individual' && <>
                                    <p className="field-label">Deportista</p>
                                    <select className="styled-sel" value={dep} onChange={e => setDep(e.target.value)}>
                                        {Object.keys(DATA).map(k => <option key={k}>{k}</option>)}
                                    </select>
                                </>}

                                <p className="field-label">Rango de fechas</p>
                                <section className="date-wrap">
                                    <input className="date-inp" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                                    <input className="date-inp" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                                </section>

                                <p className="field-label">Incluir</p>
                                <section className="check-group">
                                    {Object.keys(checks).map(k => (
                                        <label key={k} className="check-opt">
                                            <input type="checkbox" checked={checks[k]} onChange={e => setChecks(c => ({ ...c, [k]: e.target.checked }))} />
                                            <span className="check-box"><i className="fa-solid fa-check"></i></span>
                                            <span className="check-text">{k}</span>
                                        </label>
                                    ))}
                                </section>
                            </article>

                            {/* Preview card */}
                            <article className="preview-card">
                                <p className="preview-title">Reporte {tipo}</p>
                                <p className="preview-sub">{tipo === 'Grupal' ? 'Todos los deportistas' : dep}</p>
                                <p className="preview-date">{dateFrom && dateTo ? `${fmtDisp(dateFrom)} – ${fmtDisp(dateTo)}` : ''}</p>
                                {checks.Rendimiento && (
                                    <section className="donut-wrap">
                                        <svg className="donut" width="140" height="140" viewBox="0 0 140 140">
                                            <defs><linearGradient id="donutGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#22d3a5" /><stop offset="100%" stopColor="#3b82f6" /></linearGradient></defs>
                                            <circle cx="70" cy="70" r="54" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="14" />
                                            <circle cx="70" cy="70" r="54" fill="none" stroke="url(#donutGrad)" strokeWidth="14" strokeLinecap="round" strokeDasharray="339.3" strokeDashoffset={offset} transform="rotate(-90 70 70)" style={{ transition: 'stroke-dashoffset .8s ease' }} />
                                            <text className="donut-pct" x="70" y="67" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '22px', fontWeight: '700', fill: 'white' }}>{d.perf}%</text>
                                            <text x="70" y="84" textAnchor="middle" style={{ fontSize: '9px', fill: '#7a90b8' }}>Rendimiento</text>
                                        </svg>
                                    </section>
                                )}
                                <section className="mini-stats">
                                    {checks.Asistencia && (
                                        <article className="mini-stat">
                                            <p className="mini-label">Asistencia</p>
                                            <svg width="60" height="60" viewBox="0 0 60 60" style={{ display: 'block', margin: '0 auto 4px' }}>
                                                <circle cx="30" cy="30" r="22" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
                                                <circle cx="30" cy="30" r="22" fill="none" stroke="#22d3a5" strokeWidth="7" strokeLinecap="round" strokeDasharray="138.2" strokeDashoffset={offset2} transform="rotate(-90 30 30)" style={{ transition: 'stroke-dashoffset .8s ease' }} />
                                                <text x="30" y="30" textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '10px', fontWeight: '700', fill: 'white' }}>{d.asis}%</text>
                                            </svg>
                                        </article>
                                    )}
                                    <article className="mini-stat">
                                        <p className="mini-label">Sesiones</p>
                                        <p style={{ fontSize: '28px', fontWeight: '700', fontFamily: 'JetBrains Mono,monospace', color: 'white', marginTop: '8px' }}>{d.ses}</p>
                                    </article>
                                </section>
                                <article className="spark-wrap">
                                    <p className="spark-label">Evolución</p>
                                    <Sparkline pts={d.spark} id="pv" />
                                </article>
                            </article>
                        </section>

                        <section className="step-btns">
                            <button className="btn-sec" onClick={reset}><i className="fa-solid fa-rotate-left"></i> Restablecer</button>
                            <button className="btn-pri" onClick={() => goStep(2)}><i className="fa-solid fa-eye"></i> Vista previa</button>
                        </section>
                    </section>
                )}

                {/* STEP 2 */}
                {step === 2 && (
                    <section>
                        <article className="panel" style={{ marginBottom: '16px' }}>
                            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                                <section>
                                    <p style={{ fontSize: '16px', fontWeight: '700' }}>Reporte {tipo}</p>
                                    <p style={{ fontSize: '12px', color: 'var(--t2)' }}>{tipo === 'Grupal' ? 'Equipo completo' : dep} · {fmtDisp(dateFrom)} – {fmtDisp(dateTo)}</p>
                                </section>
                                <button className="btn-sec" onClick={() => setFullPreview(true)}><i className="fa-solid fa-expand"></i> Pantalla completa</button>
                            </header>
                            <section className="fp-grid">
                                {stats.map((s, i) => (
                                    <article key={i} className="fp-stat">
                                        <p className="fp-stat-val" style={{ color: s.color }}>{s.val}</p>
                                        <p className="fp-stat-key">{s.key}</p>
                                    </article>
                                ))}
                            </section>
                            <article className="spark-wrap" style={{ marginTop: '12px' }}>
                                <p className="spark-label">Evolución del rendimiento</p>
                                <Sparkline pts={d.spark} w={460} h={70} id="s2" />
                            </article>
                            {checks.Recomendaciones && (
                                <section style={{ marginTop: '14px' }}>
                                    <p className="field-label" style={{ marginBottom: '10px' }}>Recomendaciones IA</p>
                                    <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {(RECS[dep] || []).map((r, i) => (
                                            <p key={i} style={{ fontSize: '12.5px', color: 'var(--t1)', background: 'var(--hover)', borderRadius: '8px', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <i className="fa-solid fa-circle-check" style={{ color: 'var(--green)', fontSize: '12px' }}></i>{r}
                                            </p>
                                        ))}
                                    </section>
                                </section>
                            )}
                        </article>
                        <section className="step-btns">
                            <button className="btn-sec" onClick={() => goStep(1)}><i className="fa-solid fa-arrow-left"></i> Volver</button>
                            <button className="btn-pri" onClick={() => goStep(3)}><i className="fa-solid fa-file-export"></i> Exportar</button>
                        </section>
                    </section>
                )}

                {/* STEP 3 */}
                {step === 3 && (
                    <section>
                        <article className="panel" style={{ marginBottom: '16px' }}>
                            <p style={{ fontSize: '15px', fontWeight: '700', marginBottom: '6px' }}>Selecciona el formato de exportación</p>
                            <p style={{ fontSize: '12.5px', color: 'var(--t2)', marginBottom: '18px' }}>{tipo} · {dep} · {fmtDisp(dateFrom)} – {fmtDisp(dateTo)}</p>
                            <section className="export-opts">
                                {[{ fmt: 'pdf', icon: 'fa-file-pdf', color: '#f87171', label: 'PDF', sub: 'Documento portátil' },
                                { fmt: 'csv', icon: 'fa-file-csv', color: '#22d3a5', label: 'CSV', sub: 'Hoja de cálculo' },
                                { fmt: 'json', icon: 'fa-file-code', color: '#60a5fa', label: 'JSON', sub: 'Datos estructurados' }].map(o => (
                                    <article key={o.fmt} className={`export-opt ${fmt2 === o.fmt ? 'selected' : ''}`} onClick={() => setFmt2(o.fmt)}>
                                        <i className={`fa-solid ${o.icon}`} style={{ color: o.color }}></i>
                                        <p>{o.label}</p>
                                        <small>{o.sub}</small>
                                    </article>
                                ))}
                            </section>
                            {exporting && (
                                <section className="progress-wrap show">
                                    <p style={{ fontSize: '13px', color: 'var(--t2)' }}>{progressLabel || 'Generando reporte...'}</p>
                                    <section className="progress-bar-bg" style={{ width: '100%' }}>
                                        <section className="progress-bar-fill" style={{ width: `${progress}%` }}></section>
                                    </section>
                                    <p style={{ fontSize: '12px', color: 'var(--t3)' }}>{progress}%</p>
                                </section>
                            )}
                            {exportDone && (
                                <section style={{ textAlign: 'center', padding: '20px 0' }}>
                                    <i className="fa-solid fa-circle-check" style={{ fontSize: '36px', color: 'var(--green)', marginBottom: '10px', display: 'block' }}></i>
                                    <p style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>¡Reporte exportado!</p>
                                    <p style={{ fontSize: '12.5px', color: 'var(--t2)' }}>reporte_{dep.replace(' ', '_').toLowerCase()}.{fmt2} listo</p>
                                </section>
                            )}
                        </article>
                        <section className="step-btns">
                            <button className="btn-sec" onClick={() => goStep(2)}><i className="fa-solid fa-arrow-left"></i> Volver</button>
                            {!exportDone && !exporting && <button className="btn-green" onClick={doExport}><i className="fa-solid fa-download"></i> Exportar ahora</button>}
                            {exportDone && <button className="btn-sec" onClick={() => { setStep(1); setExportDone(false); setExporting(false); }}>+ Nuevo reporte</button>}
                        </section>
                    </section>
                )}

                {/* Full preview modal */}
                {fullPreview && (
                    <section className="full-preview open">
                        <article className="fp-box">
                            <header className="fp-header">
                                <p style={{ fontSize: '15px', fontWeight: '700' }}>Reporte {tipo}</p>
                                <button className="fp-close" onClick={() => setFullPreview(false)}><i className="fa-solid fa-xmark"></i></button>
                            </header>
                            <p style={{ fontSize: '12px', color: 'var(--t2)', marginBottom: '16px' }}>{dep}</p>
                            <section className="fp-grid">
                                {stats.map((s, i) => (
                                    <article key={i} className="fp-stat">
                                        <p className="fp-stat-val" style={{ color: s.color }}>{s.val}</p>
                                        <p className="fp-stat-key">{s.key}</p>
                                    </article>
                                ))}
                            </section>
                            <article className="spark-wrap" style={{ marginTop: '14px' }}>
                                <p className="spark-label">Evolución del rendimiento</p>
                                <Sparkline pts={d.spark} w={460} h={70} id="modal" />
                            </article>
                        </article>
                    </section>
                )}

                <aside className={`toast ${toast.show ? 'show' : ''}`}>
                    <i className="fa-solid fa-circle-check" id="toastIcon"></i>
                    <span>{toast.msg}</span>
                </aside>
            </main>

        </>
    );
}