"use client";

/**
 * BotonGoogle — "Continuar con Google".
 *
 * Flujo (coincide con panel_usuario/google.py):
 *   1. El botón oficial de Google (<GoogleLogin>) devuelve una `credential` (id_token firmado por Google).
 *   2. La mandamos a POST /auth/google como { credential }.
 *   3. El backend verifica la firma y responde con TU sesión ({ access, usuario }), igual que /auth/login.
 *
 * Nota: Google dibuja este botón en un iframe propio, por eso su aspecto se ajusta con las
 * opciones de abajo (tema, texto, forma, ancho) y no con CSS.
 */
import { useEffect, useRef, useState } from "react";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { api, guardarSesion, ApiError } from "@/lib/api";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

const DESTINO_POR_ROL = { atleta: "/usuario", entrenador: "/panel_entrenador", admin: "/admin" };

// Volver a la invitación / panel de donde venías (solo rutas internas conocidas)
function destinoSolicitado() {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && /^\/(invitacion\/[A-Za-z0-9_-]{20,100}|(panel_entrenador|usuario)(\/[A-Za-z0-9_\-\/]*)?)$/.test(next)
        ? next : null;
}

function GoogleAuthButton({ onError }) {
    const router = useRouter();
    const caja = useRef(null);
    const [ancho, setAncho] = useState(320);

    // Google exige el ancho en píxeles (máx. 400): se ajusta al de la tarjeta de login
    useEffect(() => {
        const medir = () => caja.current && setAncho(Math.max(200, Math.min(400, Math.floor(caja.current.clientWidth))));
        medir();
        window.addEventListener("resize", medir);
        return () => window.removeEventListener("resize", medir);
    }, []);

    async function alRecibirCredencial({ credential }) {
        try {
            const data = await api("/auth/google", { method: "POST", body: { credential } });
            guardarSesion(data);
            router.push(destinoSolicitado() ?? DESTINO_POR_ROL[data?.usuario?.rol] ?? "/usuario");
        } catch (err) {
            // La causa real queda en la consola (F12) para poder diagnosticarla
            console.error("Google → /auth/google falló:", err?.status, err?.data ?? err);
            if (err instanceof ApiError && err.data?.detail) onError?.(err.data.detail);   // ej. "Esta cuenta debe iniciar sesión con correo y contraseña."
            else if (err instanceof ApiError && err.status === 429) onError?.("Demasiados intentos. Espera un minuto.");
            else if (err instanceof ApiError) onError?.(`Error del servidor al entrar con Google (código ${err.status}).`);
            else onError?.("No se pudo conectar con el servidor. Revisa que esté encendido y CORS.");
        }
    }

    return (
        <div ref={caja} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
            <GoogleLogin
                onSuccess={alRecibirCredencial}
                onError={() => onError?.("Google no completó el inicio de sesión (revisa los orígenes autorizados).")}
                theme="filled_black"
                size="large"
                shape="pill"
                text="continue_with"
                locale="es"
                width={ancho}
            />
        </div>
    );
}

export default function BotonGoogle({ onError }) {
    if (!CLIENT_ID) return null;
    return (
        <GoogleOAuthProvider clientId={CLIENT_ID}>
            <GoogleAuthButton onError={onError} />
        </GoogleOAuthProvider>
    );
}
