'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const ModuloFatigaNeuromuscular = forwardRef(function ModuloFatigaNeuromuscular({ fatigaSeries }, ref) {
    const canvasRef = useRef(null);
    const chartRef = useRef(null);

    useImperativeHandle(ref, () => canvasRef.current);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;

        const ctx = canvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Altura del Salto (cm)',
                        data: [],
                        borderColor: '#00F0FF',
                        backgroundColor: 'rgba(0, 240, 255, 0.14)',
                        pointBackgroundColor: [],
                        pointBorderColor: [],
                        pointRadius: [],
                        pointHoverRadius: 8,
                        borderWidth: 3,
                        tension: 0.3,
                        fill: true,
                        yAxisID: 'ySalto',
                    },
                    {
                        label: 'Ángulo Extensión Codo en t0 (°)',
                        data: [],
                        borderColor: '#00FF99',
                        backgroundColor: 'rgba(0, 255, 153, 0.08)',
                        pointBackgroundColor: [],
                        pointBorderColor: [],
                        pointRadius: [],
                        pointHoverRadius: 8,
                        borderWidth: 2.5,
                        borderDash: [5, 4],
                        tension: 0.3,
                        fill: false,
                        yAxisID: 'yCodo',
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        labels: {
                            color: '#F8FAFC',
                            font: { size: 12, weight: 'bold' },
                        },
                    },
                    tooltip: {
                        backgroundColor: 'rgba(9, 14, 26, 0.94)',
                        titleColor: '#00F0FF',
                        bodyColor: '#F8FAFC',
                        borderColor: 'rgba(0, 240, 255, 0.35)',
                        borderWidth: 1,
                    },
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Número de Salto en la Sesión',
                            color: '#94A3B8',
                            font: { size: 11, weight: 'bold' },
                        },
                        ticks: { color: '#CBD5E1' },
                        grid: { color: 'rgba(255, 255, 255, 0.06)' },
                    },
                    ySalto: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Altura del Salto (cm)',
                            color: '#00F0FF',
                            font: { size: 11, weight: 'bold' },
                        },
                        ticks: { color: '#00F0FF' },
                        grid: { color: 'rgba(255, 255, 255, 0.06)' },
                        suggestedMin: 0,
                        suggestedMax: 65,
                    },
                    yCodo: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Ángulo Codo en t0 (°)',
                            color: '#00FF99',
                            font: { size: 11, weight: 'bold' },
                        },
                        ticks: { color: '#00FF99' },
                        grid: { drawOnChartArea: false },
                        suggestedMin: 90,
                        suggestedMax: 180,
                    },
                },
            },
        });

        chartRef.current = chart;
        return () => {
            chart.destroy();
            chartRef.current = null;
        };
    }, []);

    useEffect(() => {
        const chart = chartRef.current;
        if (!chart || !fatigaSeries) return;

        chart.data.labels = [...fatigaSeries.labels];

        chart.data.datasets[0].data = [...fatigaSeries.saltosCm];
        chart.data.datasets[0].pointBackgroundColor = [...fatigaSeries.coloresSalto];
        chart.data.datasets[0].pointBorderColor = fatigaSeries.coloresSalto.map((c) =>
            c === '#FF3366' ? '#FFFFFF' : '#00F0FF',
        );
        chart.data.datasets[0].pointRadius = [...fatigaSeries.radiosSalto];

        chart.data.datasets[1].data = [...fatigaSeries.codosDeg];
        chart.data.datasets[1].pointBackgroundColor = [...fatigaSeries.coloresCodo];
        chart.data.datasets[1].pointBorderColor = fatigaSeries.coloresCodo.map((c) =>
            c === '#FF3366' ? '#FFFFFF' : '#00FF99',
        );
        chart.data.datasets[1].pointRadius = [...fatigaSeries.radiosCodo];

        chart.update();
    }, [fatigaSeries]);

    return (
        <section id="seccionFatigaNeuromuscular" className="vs-card">
            <div className="vs-card-header">
                <div>
                    <h2 className="vs-card-title">
                        <span>📉</span> Panel de Fatiga Neuromuscular
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Monitoreo longitudinal de la degradación del rendimiento físico: Altura del Salto (cm) vs. Ángulo de Extensión del Codo en t0 (°). Alerta clínica en rojo si cae &gt; 20% respecto al Pico Máximo.
                    </p>
                </div>
                <div
                    id="badgeEstadoFatigaPanel"
                    className={`badge-tag ${fatigaSeries.hayAlertaClinica ? 'badge-red' : 'badge-green'}`}
                >
                    {fatigaSeries.hayAlertaClinica
                        ? '🚨 RIESGO DE LESIÓN (>20% CAÍDA)'
                        : fatigaSeries.labels.length > 0
                          ? 'Rendimiento Estable (<20% variación)'
                          : 'Monitoreando Línea Base'}
                </div>
            </div>

            {fatigaSeries.hayAlertaClinica && (
                <div id="alertaClinicaFatigaBox" className="vs-fatigue-clinical-alert">
                    <div>
                        🚨 <span id="txtAlertaClinicaFatiga">{fatigaSeries.mensajeAlertaClinica}</span>
                    </div>
                </div>
            )}

            <div className="vs-ablacion-summary-grid">
                <div className="vs-ablacion-summary-card">
                    <div id="statPicoSaltoCm" className="val val-cyan">
                        {fatigaSeries.picoSaltoCm > 0 ? `${fatigaSeries.picoSaltoCm} cm` : '-- cm'}
                    </div>
                    <div className="lbl">Pico Máximo Salto (Baseline)</div>
                </div>
                <div className="vs-ablacion-summary-card">
                    <div
                        id="statUltimoSaltoCm"
                        className="val val-green"
                        style={{
                            color: fatigaSeries.alertaSalto ? '#FF3366' : '#00F0FF',
                        }}
                    >
                        {fatigaSeries.ultimoSaltoCm != null ? `${fatigaSeries.ultimoSaltoCm} cm` : '-- cm'}
                    </div>
                    <div className="lbl">Último Salto Registrado</div>
                </div>
                <div className="vs-ablacion-summary-card">
                    <div id="statPicoCodoDeg" className="val val-yellow">
                        {fatigaSeries.picoCodoDeg > 0 ? `${fatigaSeries.picoCodoDeg}°` : '--°'}
                    </div>
                    <div className="lbl">Pico Extensión Codo t0 (Baseline)</div>
                </div>
                <div className="vs-ablacion-summary-card">
                    <div
                        id="statUltimoCodoDeg"
                        className="val val-purple"
                        style={{
                            color: fatigaSeries.alertaCodo ? '#FF3366' : '#00FF99',
                        }}
                    >
                        {fatigaSeries.ultimoCodoDeg != null ? `${fatigaSeries.ultimoCodoDeg}°` : '--°'}
                    </div>
                    <div className="lbl">Último Ángulo Codo t0</div>
                </div>
            </div>

            <div className="vs-fatigue-chart-container">
                <canvas ref={canvasRef} id="graficaFatiga" />
            </div>
        </section>
    );
});

export default ModuloFatigaNeuromuscular;
