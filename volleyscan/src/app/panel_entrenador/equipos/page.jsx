"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { crearEquipo, listarEquipos, mensajeDeError, misInvitaciones, responderInvitacion } from "@/lib/equipos/api";
import s from "./equipos.module.css";

const VACIO = { nombre: "", categoria: "", temporada: String(new Date().getFullYear()) };

export default function EquiposPage() {
    const router = useRouter();
    const [estado, setEstado] = useState("cargando");
    const [error, setError] = useState("");
    const [aviso, setAviso] = useState("");
    const [equipos, setEquipos] = useState([]);
    const [recibidas, setRecibidas] = useState([]);
    const [abierto, setAbierto] = useState(false);
    const [form, setForm] = useState(VACIO);
    const [ocupado, setOcupado] = useState(false);

    const cargar = useCallback(async () => {
        const [a, b] = await Promise.all([listarEquipos(), misInvitaciones()]);
        if (!a.ok) {
            setError(mensajeDeError(a));
            setEstado("error");
            return;
        }
        setEquipos(a.data);
        setRecibidas(b.ok ? b.data : []);
        setError("");
        setEstado("listo");
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    async function crear(e) {
        e.preventDefault();
        if (ocupado) return;
        setOcupado(true);
        setError("");
        const r = await crearEquipo(form);
        setOcupado(false);
        if (!r.ok) return setError(mensajeDeError(r));
        router.push(`/panel_entrenador/equipos/${r.data.id}`);
    }

    async function responder(inv, accion) {
        if (ocupado) return;
        setOcupado(true);
        setError("");
        setAviso("");
        const r = await responderInvitacion(inv.id, accion);
        setOcupado(false);
        if (!r.ok) {
            setError(mensajeDeError(r));
            return cargar();
        }
        setAviso(accion === "aceptar" ? `Ahora eres entrenador de «${inv.equipo.nombre}».` : "Invitación rechazada.");
        cargar();
    }

    return (
        <div className={s.page}>
            <header className={s.head}>
                <div>
                    <span className={s.eyebrow}>Mi club</span>
                    <h1>Equipos</h1>
                    <p>Crea tus equipos, invita a deportistas y a otros entrenadores por correo, y lleva el registro de tus aprendices.</p>
                </div>
                <button className={`${s.btn} ${s.btnPrim}`} onClick={() => setAbierto((v) => !v)}>
                    {abierto ? "Cancelar" : "+ Nuevo equipo"}
                </button>
            </header>

            {error && <div className={`${s.alerta} ${s.alertaMal}`} role="alert">{error}</div>}
            {aviso && <div className={`${s.alerta} ${s.alertaBien}`} role="status">{aviso}</div>}

            {abierto && (
                <form className={`${s.panel} ${s.form}`} onSubmit={crear}>
                    <div className={s.campo}>
                        <label htmlFor="eq-nombre">Nombre del equipo</label>
                        <input id="eq-nombre" className={s.input} value={form.nombre} maxLength={100} required autoFocus
                            placeholder="Ej. Sub-17 Femenino" onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                    </div>
                    <div className={s.campo}>
                        <label htmlFor="eq-cat">Categoría</label>
                        <input id="eq-cat" className={s.input} value={form.categoria} maxLength={50}
                            placeholder="Juvenil" onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
                    </div>
                    <div className={s.campo}>
                        <label htmlFor="eq-temp">Temporada</label>
                        <input id="eq-temp" className={s.input} value={form.temporada} maxLength={20}
                            placeholder="2026" onChange={(e) => setForm({ ...form, temporada: e.target.value })} />
                    </div>
                    <button className={`${s.btn} ${s.btnPrim}`} disabled={ocupado || form.nombre.trim().length < 2}>
                        {ocupado ? "Creando…" : "Crear equipo"}
                    </button>
                </form>
            )}

            {recibidas.length > 0 && (
                <section className={s.recibidas} aria-label="Invitaciones recibidas">
                    {recibidas.map((inv) => (
                        <div key={inv.id} className={s.recibida}>
                            <div>
                                <strong>{inv.invitadoPor} te invita a ser entrenador de «{inv.equipo.nombre}»</strong>
                                <span className={s.muted}>{[inv.equipo.categoria, inv.equipo.temporada].filter(Boolean).join(" · ") || "Equipo"}</span>
                            </div>
                            <div className={s.acciones}>
                                <button className={`${s.btn} ${s.btnPrim} ${s.btnMini}`} disabled={ocupado} onClick={() => responder(inv, "aceptar")}>Aceptar</button>
                                <button className={`${s.btn} ${s.btnMini}`} disabled={ocupado} onClick={() => responder(inv, "rechazar")}>Rechazar</button>
                            </div>
                        </div>
                    ))}
                </section>
            )}

            {estado === "cargando" && <p className={s.estado}>Cargando equipos…</p>}

            {estado === "listo" && equipos.length === 0 && (
                <div className={s.vacio}>
                    <h3>Aún no tienes equipos</h3>
                    <p>Crea el primero y empieza a invitar a tus deportistas.</p>
                </div>
            )}

            {equipos.length > 0 && (
                <ul className={s.grid}>
                    {equipos.map((e) => (
                        <li key={e.id}>
                            <Link href={`/panel_entrenador/equipos/${e.id}`} className={s.tarjeta}>
                                <div>
                                    <h3>{e.nombre}</h3>
                                    <div className={s.chips} style={{ marginTop: 8 }}>
                                        <span className={`${s.chip} ${e.esPropietario ? s.chipAzul : s.chipVerde}`}>{e.esPropietario ? "Propietario" : "Co-entrenador"}</span>
                                        {e.categoria && <span className={s.chip}>{e.categoria}</span>}
                                        {e.temporada && <span className={s.chip}>{e.temporada}</span>}
                                    </div>
                                </div>
                                <div className={s.cifras}>
                                    <div><b>{e.deportistas}</b><small>Deportistas</small></div>
                                    <div><b>{e.entrenadores}</b><small>Entrenadores</small></div>
                                    <div><b>{e.invitacionesPendientes}</b><small>Invitaciones</small></div>
                                </div>
                                <span className={s.irA}>Abrir equipo →</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
