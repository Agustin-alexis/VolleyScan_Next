"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getToken, getUsuario } from "@/lib/api";
import { obtenerSesionActivaSupabase, supabase } from "@/lib/supabase";
import SidebarUsuario from "../components/SidebarUsuario";

export default function UsuarioLayout({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const [listo, setListo] = useState(false);

    useEffect(() => {
        let cancelado = false;

        async function verificarSesion() {
            const { token, usuario } = await obtenerSesionActivaSupabase();
            const tokenFinal = token || getToken();
            const usuarioFinal = usuario || getUsuario();

            if (!tokenFinal || !usuarioFinal) {
                if (!cancelado) {
                    router.replace(`/login?next=${encodeURIComponent(pathname || "/usuario/analisis")}`);
                }
                return;
            }

            if (usuarioFinal.rol && usuarioFinal.rol !== "atleta") {
                if (!cancelado) {
                    router.replace(usuarioFinal.rol === "entrenador" ? "/panel_entrenador/dashboard" : "/admin");
                }
                return;
            }

            if (!cancelado) setListo(true);
        }

        verificarSesion();

        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_OUT" && !getToken()) {
                router.replace("/login");
            } else if (session?.access_token) {
                setListo(true);
            }
        });

        return () => {
            cancelado = true;
            listener?.subscription?.unsubscribe();
        };
    }, [router, pathname]);

    if (!listo) {
        return (
            <div
                style={{
                    display: "grid",
                    placeItems: "center",
                    minHeight: "100dvh",
                    background: "#0b0f1a",
                    color: "#94a3b8",
                    fontSize: "0.95rem",
                }}
            >
                Verificando sesión de Supabase Auth…
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full overflow-hidden bg-[#0c1322]">
            <SidebarUsuario />

            <main className="flex-1 min-w-0 h-screen overflow-y-auto overflow-x-hidden">
                {children}
            </main>
        </div>
    );
}
