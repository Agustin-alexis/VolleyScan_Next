'use client';
import './Analisis.module.css'


import { useState, useRef, useEffect } from 'react';

const WELCOME = `¡Hola! 👋 Soy tu entrenador personal de voleibol basado en IA.\n\nBasado en tu perfil actual:\n• Posición: **Armador**\n• Nivel: **Intermedio**\n• Objetivo: **Mejorar salto**\n\nPuedo ayudarte con:\n✅ Rutinas de entrenamiento personalizadas\n✅ Análisis técnico por posición\n✅ Recomendaciones para mejorar rendimiento\n✅ Respuesta a dudas tácticas\n\n¿En qué puedo ayudarte hoy? 🏐`;

const SIMULATED = {
    salto: `## 🦿 Rutina para mejorar el salto vertical\n\n### ✅ Recomendación principal\nEnfócate en ejercicios pliométricos y fortalecimiento de piernas 3 veces por semana.\n\n### 📋 Ejercicios específicos\n1. **Sentadillas con salto** - 4 series de 8 reps\n2. **Saltos al cajón** (40-50cm) - 3 series de 6 reps\n3. **Zancadas búlgaras** - 3 series de 10 por pierna\n4. **Saltos continuos en red** - 3 series de 10 toques\n5. **Pesos muertos** - 3 series de 6 reps\n\n### ⚠️ Errores comunes\n- ❌ Caer con las rodillas bloqueadas\n- ❌ No usar los brazos para impulsarse\n- ❌ Entrenar en superficies duras sin amortiguación\n\n### 📈 Métricas de progreso\nMide tu alcance máximo en red cada semana. Busca aumentar 2-3cm por mes.\n\n💪 *¡El salto se construye desde las piernas y el core! Sigue así.*`,
    recepción: `## 🏐 Técnica de recepción\n\n### ✅ Puntos clave\n- Posición base: pies separados al ancho de hombros, rodillas flexionadas\n- Brazos extendidos y firmes, manos entrelazadas\n- Contacto en la parte media del antebrazo\n\n### 📋 Ejercicios prácticos\n1. **Recepción contra pared** - 100 repeticiones diarias\n2. **Recepciones con balón medicinal** (2kg) - 3x15 repeticiones\n3. **Ejercicio del triángulo** (3 jugadores en rotación)\n4. **Recepción de servicio dirigido** - 50 servicios diarios\n\n### ⚠️ Errores comunes\n- ❌ Balancear los brazos\n- ❌ Mirar el balón después del contacto\n- ❌ Posición de piernas muy rígida\n\n🎯 *La recepción es el 80% concentración y 20% técnica. ¡Confía en tus manos!*`,
    remate: `## 💪 Mejora tu remate\n\n### ✅ Fases del remate perfecto\n1. **Carrera de aproximación** (3-4 pasos)\n2. **Batida** (pies juntos al saltar)\n3. **Armado de arco** (brazo dominante atrás)\n4. **Contacto al punto más alto**\n5. **Muñequeo** (golpe seco)\n\n### 📋 Ejercicios para esta semana\n- **Día 1**: Remates sin red: 50 repeticiones\n- **Día 3**: Remates con balón más pesado (+15%)\n- **Día 5**: Remates dirigidos a zonas (1,5,6)\n\n🎯 *Un gran rematador se hace en el gimnasio y se perfecciona en la cancha. ¡Dale con todo!*`,
    default: `## 🤔 Excelente pregunta sobre voleibol\n\nComo tu entrenador IA, analizaré tu consulta basándome en tu perfil:\n\n- **Posición**: Armador\n- **Nivel**: Intermedio\n- **Objetivo**: Mejorar salto\n\n### 💡 Recomendación general\nPara mejorar en voleibol, te sugiero enfocarte en:\n\n1. **Técnica específica por posición** - Cada rol tiene demandas únicas\n2. **Preparación física dirigida** - Fortalece patrones de movimiento específicos\n3. **Análisis táctico** - Estudia 15 minutos diarios de video\n\n¿Puedes ser más específico? Dime exactamente qué aspecto del voleibol te interesa mejorar.\n\n🏐 *¡El conocimiento es el primer paso hacia la maestría!*`
};

function getSimulated(msg) {
    const m = msg.toLowerCase();
    if (m.includes('salto') || m.includes('saltar')) return SIMULATED.salto;
    if (m.includes('recepción') || m.includes('pase')) return SIMULATED.recepción;
    if (m.includes('remate') || m.includes('ataque')) return SIMULATED.remate;
    return SIMULATED.default;
}

function renderMd(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/### (.*)/g, '<h4 style="margin:.8em 0 .3em;font-size:.95em;color:#f0f3ff">$1</h4>')
        .replace(/## (.*)/g, '<h3 style="margin:.5em 0 .4em;font-size:1.05em;color:#f0f3ff">$1</h3>')
        .replace(/\n/g, '<br/>');
}

export default function Analisis() {
    const [messages, setMessages] = useState([{ role: 'ai', text: WELCOME, time: 'Ahora' }]);
    const [input, setInput] = useState('');
    const [typing, setTyping] = useState(false);
    const bottomRef = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

    async function send(msg) {
        if (!msg.trim()) return;
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        setMessages(prev => [...prev, { role: 'user', text: msg, time: timeStr }]);
        setInput('');
        setTyping(true);

        try {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 1000,
                    system: 'Eres "VolleyAI Coach", un asistente experto en voleibol profesional. El deportista es un Armador de nivel Intermedio que quiere mejorar su salto. Responde en español de forma estructurada, usando emojis y formato claro. Sé específico con ejercicios, series y repeticiones.',
                    messages: [{ role: 'user', content: msg }]
                })
            });
            const data = await res.json();
            const reply = data.content?.[0]?.text || getSimulated(msg);
            setMessages(prev => [...prev, { role: 'ai', text: reply, time: timeStr }]);
        } catch {
            setMessages(prev => [...prev, { role: 'ai', text: getSimulated(msg), time: timeStr }]);
        } finally {
            setTyping(false);
        }
    }

    function handleKey(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
    }

    return (
        <>

            <main className="anal-main">
                <header className="chat-header">
                    <div className="chat-header-content">
                        <i className="fa-solid fa-microchip"></i>
                        <div className="chat-header-text">
                            <h1>Análisis IA</h1>
                            <p>Entrenador virtual especializado en voleibol</p>
                        </div>
                    </div>
                    <div className="chat-status">
                        <span className="status-dot online"></span>
                        <span>IA Conectada</span>
                    </div>
                </header>

                <section className="chat-messages">
                    {messages.map((m, i) => (
                        <div key={i} className={`message ${m.role === 'ai' ? 'ai-message' : 'user-message'}`}>
                            <div className="message-avatar">
                                <i className={`fa-solid ${m.role === 'ai' ? 'fa-microchip' : 'fa-user'}`}></i>
                            </div>
                            <div className="message-content">
                                <div className="message-sender">{m.role === 'ai' ? 'VolleyAI Coach' : 'Tú'}</div>
                                <div className="message-text" dangerouslySetInnerHTML={{ __html: renderMd(m.text) }}></div>
                                <div className="message-time">{m.time}</div>
                            </div>
                        </div>
                    ))}
                    {typing && (
                        <div className="message ai-message">
                            <div className="message-avatar"><i className="fa-solid fa-microchip"></i></div>
                            <div className="message-content">
                                <div className="message-sender">VolleyAI Coach</div>
                                <div className="typing-dots"><span></span><span></span><span></span></div>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef}></div>
                </section>

                <footer className="chat-input-area">
                    <div className="input-container">
                        <textarea
                            ref={textareaRef}
                            id="message-input"
                            placeholder="Escribe tu pregunta aquí... Ej: 'Cómo mejorar mi recepción'"
                            rows="1"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKey}
                        ></textarea>
                        <button className="send-btn" onClick={() => send(input)} disabled={typing}>
                            <i className="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                    <div className="input-suggestions">
                        {[['🦿', 'Rutina de salto'], ['🏐', 'Mejorar recepción'], ['📅', 'Plan semanal'], ['⚠️', 'Errores en remate']].map(([icon, label]) => (
                            <button key={label} className="suggestion-chip" onClick={() => send(`${label}`)}>
                                {icon} {label}
                            </button>
                        ))}
                    </div>
                </footer>
            </main>

        </>
    );
}