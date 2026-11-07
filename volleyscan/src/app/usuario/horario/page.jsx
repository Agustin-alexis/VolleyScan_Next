"use client";

import { useEffect, useMemo, useState } from "react";
import { fechaISO, mensajeDeError, miAgenda } from "@/lib/horario/api";
import s from "./horario.module.css";

const TIPOS = { entrenamiento: "Entrenamiento", partido: "Competencia", evaluacion: "Evaluación", reunion: "Reunión", otro: "Evento" };
const ASISTENCIA = {
    presente: { texto: "Asististe", clase: "chipPresente" },
    tarde: { texto: "Llegaste tarde", clase: "chipTarde" },
    ausente: { texto: "Faltaste", clase: "chipAusente" },
    justificado: { texto: "Falta justificada", clase: "chipJustificado" },
};
const fMes = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" });
const fDiaLargo = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" });
const fDiaCorto = new Intl.DateTimeFormat("es-CO", { weekday: "short" });

const inicioDe = (e) => new Date(`${e.fecha}T${e.horaInicio}`);
const finDe = (e) => new Date(`${e.fecha}T${e.horaFin}`);

function cuentaRegresiva(fecha) {
    const ms = fecha - new Date();
    if (ms <= 0) return "En curso ahora";
    const min = Math.round(ms / 60000);
    if (min < 60) return `Empieza en ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `Empieza en ${h} h`;
    const d = Math.round(h / 24);
    return d === 1 ? "Es mañana" : `Faltan ${d} días`;
}

function Evento({ e }) {
    const cancelado = e.estado === "cancelado";
    return (
        <li className={`${s.evento} ${s["t_" + e.tipo] ?? ""} ${cancelado ? s.cancelado : ""}`}>
            <div className={s.fila}>
                <span className={`${s.chip} ${s.chipTipo}`}>{TIPOS[e.tipo] ?? "Evento"}</span>
                {cancelado && <span className={`${s.chip} ${s.chipCancelado}`}>Cancelado</span>}
                {e.estado === "completado" && <span className={`${s.chip} ${s.chipHecho}`}>Realizado</span>}
                {e.equipo && <span className={s.chip}>{e.equipo.nombre}</span>}
                {e.miAsistencia && <span className={`${s.chip} ${s[ASISTENCIA[e.miAsistencia].clase]}`}>{ASISTENCIA[e.miAsistencia].texto}</span>}
            </div>
            <h3>{e.titulo}</h3>
            <div className={s.fila}>
                <b>{e.horaInicio} – {e.horaFin}</b>
                {e.ubicacion && <span>· {e.ubicacion}</span>}
                <span>· {e.entrenador}</span>
            </div>
            {e.notas && <p className={s.indicaciones}>{e.notas}</p>}
            {e.miObservacion && (
                <p className={s.observacion}>
                    <b>Observación de tu entrenador</b>
                    {e.miObservacion}
                </p>
            )}
        </li>
    );
}

export default function MiHorarioPage() {
    const [mes, setMes] = useState(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1); });
    const [eventos, setEventos] = useState([]);
    const [proximos, setProximos] = useState([]);
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(true);

    const desde = fechaISO(mes);
    const hasta = fechaISO(new Date(mes.getFullYear(), mes.getMonth() + 1, 0));

    useEffect(() => {
        let vivo = true;
        setCargando(true);
        miAgenda(desde, hasta).then((r) => {
            if (!vivo) return;
            setCargando(false);
            if (r.ok) { setEventos(r.data); setError(""); } else setError(mensajeDeError(r));
        });
        return () => { vivo = false; };
    }, [desde, hasta]);

    useEffect(() => {
        let vivo = true;
        const hoy = new Date();
        const fin = new Date(hoy); fin.setDate(fin.getDate() + 60);
        miAgenda(fechaISO(hoy), fechaISO(fin)).then((r) => { if (vivo && r.ok) setProximos(r.data); });
        return () => { vivo = false; };
    }, []);

    const siguiente = useMemo(
        () => proximos.filter((e) => e.estado !== "cancelado" && finDe(e) > new Date()).sort((a, b) => inicioDe(a) - inicioDe(b))[0],
        [proximos],
    );

    const dias = useMemo(() => {
        const mapa = new Map();
        for (const e of eventos) mapa.set(e.fecha, [...(mapa.get(e.fecha) ?? []), e]);
        return [...mapa.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    }, [eventos]);

    const resumenMes = useMemo(() => {
        const marcados = eventos.filter((e) => e.miAsistencia);
        const fue = marcados.filter((e) => e.miAsistencia === "presente" || e.miAsistencia === "tarde").length;
        return { total: marcados.length, fue };
    }, [eventos]);

    const hoyISO = fechaISO(new Date());
    const cambiarMes = (n) => setMes(new Date(mes.getFullYear(), mes.getMonth() + n, 1));

    return (
        <div className={s.page}>
            <header className={s.head}>
                <span className={s.eyebrow}>Mi agenda</span>
                <h1>Horario</h1>
                <p>Entrenamientos, competencias y reuniones de tus equipos y de tu entrenador.</p>
            </header>

            {error && <div className={s.alerta} role="alert">{error}</div>}

            {siguiente && (
                <section className={s.proximo} aria-label="Próximo evento">
                    <small>Tu próximo evento</small>
                    <h2>{siguiente.titulo}</h2>
                    <span className={s.cuenta}>{cuentaRegresiva(inicioDe(siguiente))}</span>
                    <p className={s.cuando}>
                        {fDiaLargo.format(inicioDe(siguiente))} · {siguiente.horaInicio} – {siguiente.horaFin}
                        {siguiente.ubicacion && ` · ${siguiente.ubicacion}`}
                    </p>
                    <div className={s.fila}>
                        <span className={`${s.chip} ${s.chipTipo}`}>{TIPOS[siguiente.tipo] ?? "Evento"}</span>
                        {siguiente.equipo && <span className={s.chip}>{siguiente.equipo.nombre}</span>}
                        <span>{siguiente.entrenador}</span>
                    </div>
                    {siguiente.notas && <p className={s.notas}>{siguiente.notas}</p>}
                </section>
            )}

            <div className={s.nav}>
                <h2>{fMes.format(mes).replace(/^./, (c) => c.toUpperCase())}</h2>
                <button className={s.btn} onClick={() => cambiarMes(-1)} aria-label="Mes anterior">←</button>
                <button className={s.btn} onClick={() => { const h = new Date(); setMes(new Date(h.getFullYear(), h.getMonth(), 1)); }}>Hoy</button>
                <button className={s.btn} onClick={() => cambiarMes(1)} aria-label="Mes siguiente">→</button>
            </div>

            {resumenMes.total > 0 && (
                <p className={s.resumen}>
                    <b>{resumenMes.fue} de {resumenMes.total}</b> eventos con asistencia este mes ({Math.round((resumenMes.fue / resumenMes.total) * 100)}%)
                </p>
            )}

            {cargando && <p className={s.estado}>Cargando agenda…</p>}

            {!cargando && !error && dias.length === 0 && (
                <div className={s.vacio}>
                    <h3>Sin eventos este mes</h3>
                    <p>Cuando tu entrenador programe algo, lo verás aquí y te llegará un aviso.</p>
                </div>
            )}

            {dias.map(([fecha, lista]) => {
                const d = new Date(`${fecha}T00:00`);
                return (
                    <section key={fecha} className={s.dia}>
                        <div className={`${s.fecha} ${fecha === hoyISO ? s.fechaHoy : ""}`}>
                            <b>{d.getDate()}</b>
                            <span>{fDiaCorto.format(d).replace(".", "")}</span>
                        </div>
                        <ul className={s.eventos}>{lista.map((e) => <Evento key={e.id} e={e} />)}</ul>
                    </section>
                );
            })}
        </div>
    );
}
