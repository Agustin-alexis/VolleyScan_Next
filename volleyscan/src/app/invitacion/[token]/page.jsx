"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cerrarSesion, getToken, getUsuario } from "@/lib/api";
import { mensajeDeError, previsualizarInvitacion, responderPorEnlace } from "@/lib/equipos/api";
import s from "./invitacion.module.css";

const fFecha = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" });
const fecha = (iso) => {
    const d = iso ? new Date(iso) : null;
    return d && !Number.isNaN(d.getTime()) ? fFecha.format(d) : "";
};

const MOTIVO = {
    aceptada: "Esta invitación ya fue aceptada.",
    rechazada: "Esta invitación fue rechazada.",
    revocada: "El entrenador canceló esta invitación.",
    vencida: "Esta invitación venció. Pídele al entrenador que te la reenvíe.",
};

export default function InvitacionPage() {
    const { token } = useParams();
    const router = useRouter();
    const [vista, setVista] = useState(null); // respuesta de la vista previa
    const [fallo, setFallo] = useState("");
    const [yo, setYo] = useState(undefined); // undefined = aún no sé; null = sin sesión
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState("");
    const [hecho, setHecho] = useState(null); // "aceptada" | "rechazada"

    useEffect(() => {
        let vivo = true;
        const u = getToken() ? getUsuario() : null;
        setYo(u && u.rol ? u : null);
        previsualizarInvitacion(token).then((r) => {
            if (!vivo) return;
            if (r.ok) setVista(r.data);
            else setFallo(r.status === 404 ? "Esta invitación no existe o el enlace está incompleto." : mensajeDeError(r));
        });
        return () => {
            vivo = false;
        };
    }, [token]);

    const volver = encodeURIComponent(`/invitacion/${token}`);
    const esEntrenador = vista?.tipo === "entrenador";
    const rolEsperado = esEntrenador ? "entrenador" : "atleta";
    const rolIncorrecto = yo && yo.rol !== rolEsperado;

    async function responder(accion) {
        if (ocupado) return;
        setOcupado(true);
        setError("");
        const r = await responderPorEnlace(token, accion);
        setOcupado(false);
        if (!r.ok) return setError(mensajeDeError(r));
        setHecho(r.data.estado);
        if (r.data.estado === "aceptada") {
            const destino = esEntrenador ? `/panel_entrenador/equipos/${r.data.equipoId}` : "/usuario/equipos";
            setTimeout(() => router.push(destino), 1600);
        }
    }

    function cambiarCuenta() {
        cerrarSesion();
        setYo(null);
        setError("");
    }

    const Marco = ({ icono, mal, children }) => (
        <main className={s.pagina}>
            <section className={s.tarjeta}>
                <span className={s.marca}>VolleyScan</span>
                <div className={`${s.icono} ${mal ? s.iconoMal : ""}`} aria-hidden="true">{icono}</div>
                {children}
            </section>
        </main>
    );

    if (fallo) {
        return (
            <Marco icono="✕" mal>
                <h1>Invitación no disponible</h1>
                <p className={s.texto}>{fallo}</p>
                <div className={s.botones}><Link className={s.btn} href="/login">Ir a iniciar sesión</Link></div>
            </Marco>
        );
    }
    if (!vista || yo === undefined) {
        return <main className={s.pagina}><p className={s.cargando}>Cargando invitación…</p></main>;
    }

    if (hecho === "aceptada") {
        return (
            <Marco icono="✓">
                <h1>¡Bienvenido a <span className={s.equipo}>{vista.equipo}</span>!</h1>
                <p className={s.texto}>Te estamos llevando a tu equipo…</p>
            </Marco>
        );
    }
    if (hecho === "rechazada") {
        return (
            <Marco icono="✓" mal>
                <h1>Invitación rechazada</h1>
                <p className={s.texto}>Le avisamos a {vista.invitadoPor}. Puedes cerrar esta página.</p>
            </Marco>
        );
    }

    if (vista.estado !== "pendiente") {
        return (
            <Marco icono="⏳" mal>
                <h1>{vista.equipo}</h1>
                <p className={s.texto}>{MOTIVO[vista.estado] ?? "Esta invitación ya no está disponible."}</p>
                <div className={s.botones}><Link className={s.btn} href="/login">Ir a VolleyScan</Link></div>
            </Marco>
        );
    }

    const detalle = [vista.categoria, vista.temporada && `Temporada ${vista.temporada}`].filter(Boolean);

    return (
        <Marco icono={esEntrenador ? "🎓" : "🏐"}>
            <h1>
                {vista.invitadoPor} te invita {esEntrenador ? "a entrenar" : "a unirte"} a <span className={s.equipo}>{vista.equipo}</span>
            </h1>
            {detalle.length > 0 && <div className={s.chips}>{detalle.map((d) => <span key={d} className={s.chip}>{d}</span>)}</div>}
            <p className={s.texto}>
                Invitación para <b>{vista.emailPista}</b>
                {vista.venceEn && <> · vence el {fecha(vista.venceEn)}</>}.
                {esEntrenador
                    ? " Tendrás las mismas competencias que los demás entrenadores del equipo."
                    : " Al aceptar, tu entrenador podrá ver tus rutinas, progreso y estadísticas."}
            </p>

            {error && <p className={s.error} role="alert">{error}</p>}

            {!yo && (
                <div className={s.botones}>
                    <Link className={`${s.btn} ${s.btnPrim}`} href={`/login?next=${volver}`}>Iniciar sesión para responder</Link>
                    {!esEntrenador && <Link className={s.btn} href={`/registro?next=${volver}`}>Crear mi cuenta</Link>}
                    <p className={s.texto}>Usa la cuenta del correo {vista.emailPista}.</p>
                </div>
            )}

            {yo && rolIncorrecto && (
                <div className={s.botones}>
                    <p className={s.error} role="alert">
                        Esta invitación es para {esEntrenador ? "un entrenador" : "un deportista"} y tu sesión es de {yo.rol === "entrenador" ? "entrenador" : "deportista"}.
                    </p>
                    <button className={s.btn} onClick={cambiarCuenta}>Cerrar sesión y usar otra cuenta</button>
                </div>
            )}

            {yo && !rolIncorrecto && (
                <div className={s.botones}>
                    <button className={`${s.btn} ${s.btnPrim}`} disabled={ocupado} onClick={() => responder("aceptar")}>
                        {ocupado ? "Un momento…" : "Aceptar invitación"}
                    </button>
                    <button className={s.btn} disabled={ocupado} onClick={() => responder("rechazar")}>Rechazar</button>
                    <p className={s.texto}>Sesión iniciada como <b>{yo.email ?? yo.nombre}</b>.</p>
                    <button className={s.link} onClick={cambiarCuenta}>No soy yo, usar otra cuenta</button>
                </div>
            )}
        </Marco>
    );
}
