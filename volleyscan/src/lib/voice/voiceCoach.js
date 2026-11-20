// ─────────────────────────────────────────────────────────────
// voiceCoach.js — Síntesis de Voz del Coach Biomecánico (VolleyScan AI)
//
// Gestiona window.speechSynthesis garantizando speechSynthesis.cancel()
// antes de cada locución para evitar colas atrasadas durante el entrenamiento.
// Construye además el feedback hablado de 3 oraciones basado en las métricas
// reales del gesto ejecutado.
// ─────────────────────────────────────────────────────────────

let activeUtterance = null;
let voiceEnabled = true;

function cleanupUtterance() {
    if (activeUtterance) {
        activeUtterance.onend = null;
        activeUtterance.onerror = null;
        activeUtterance = null;
    }
}

/**
 * Reproduce por voz el diagnóstico o instrucción del Coach Biomecánico.
 * Ejecuta siempre window.speechSynthesis.cancel() antes de hablar.
 */
export function speakCoachFeedback(text) {
    if (
        !voiceEnabled ||
        typeof window === 'undefined' ||
        !('speechSynthesis' in window) ||
        !text ||
        !String(text).trim()
    ) {
        return;
    }

    cleanupUtterance();
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(String(text).trim());
    utterance.lang = 'es-ES';
    utterance.rate = 1.04;
    utterance.pitch = 1.0;

    // Seleccionar preferentemente una voz en español natural si está disponible
    const voices = window.speechSynthesis.getVoices?.() ?? [];
    const esVoice =
        voices.find((v) => v.lang?.startsWith('es') && /natural|neural|google|microsoft/i.test(v.name)) ||
        voices.find((v) => v.lang?.startsWith('es'));
    if (esVoice) utterance.voice = esVoice;

    utterance.onend = () => cleanupUtterance();
    utterance.onerror = () => cleanupUtterance();

    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

export function stopVoiceCoach() {
    cleanupUtterance();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
}

export function setVoiceCoachEnabled(enabled) {
    voiceEnabled = Boolean(enabled);
    if (!voiceEnabled) {
        stopVoiceCoach();
    }
}

export function isVoiceCoachEnabled() {
    return voiceEnabled;
}

const NOMBRES_GESTO_VOZ = {
    remate: 'Remate',
    saque: 'Saque',
    bloqueo: 'Bloqueo',
    voleo: 'Voleo',
    colocacion: 'Voleo',
    recepcion: 'Recepción',
};

/**
 * Genera el mensaje de voz de 3 oraciones del Coach Experto:
 *   1. "Detecté un [Gesto] con [Score] puntos."
 *   2. (Solo si saltoVerticalCm > 0 y no es Voleo/Recepción) "Tu salto fue de [X] centímetros."
 *   3. Consejo biomecánico principal o felicitación.
 */
export function generarVozCoachRep(rep) {
    if (!rep) return '';

    const nombreGesto = NOMBRES_GESTO_VOZ[rep.movimiento] ?? rep.movimientoNombre ?? 'movimiento';

    if (!rep.valida) {
        return `${nombreGesto} no válido. ${rep.motivo || 'Ajusta tu posición dentro del encuadre e inténtalo de nuevo.'}`;
    }

    const oracion1 = `Detecté un ${nombreGesto} con ${rep.score} puntos.`;

    const esSinSalto = rep.movimiento === 'voleo' || rep.movimiento === 'colocacion' || rep.movimiento === 'recepcion';
    const saltoCm = !esSinSalto && Number.isFinite(rep.saltoVerticalCm) ? Math.round(rep.saltoVerticalCm) : 0;
    const oracion2 = saltoCm > 0 ? `Tu salto fue de ${saltoCm} centímetros.` : '';

    let oracion3 = 'Excelente extensión articular y coordinación en toda la secuencia.';
    if (rep.principal?.mensaje) {
        oracion3 = rep.principal.mensaje;
    } else if (rep.diagnosticoCausaRaiz) {
        oracion3 = rep.diagnosticoCausaRaiz;
    } else if (rep.puntosClave?.length > 0) {
        oracion3 = rep.puntosClave[0];
    }

    return [oracion1, oracion2, oracion3].filter(Boolean).join(' ');
}
