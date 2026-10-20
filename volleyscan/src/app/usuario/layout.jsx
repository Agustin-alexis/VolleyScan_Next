"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUsuario } from "@/lib/api";
import SidebarUsuario from "../components/SidebarUsuario";

export default function UsuarioLayout({ children }) {
    const router = useRouter();
    const [listo, setListo] = useState(false);

    useEffect(() => {
        // Verifica si NO hay token o si el rol NO es "atleta"
        if (!getToken() || getUsuario()?.rol !== "atleta") {
            router.replace("/login");
            return;
        }
        setListo(true);
    }, [router]);

    // Mientras verifica la sesión, no muestra nada en pantalla
    if (!listo) return null;

    return (
        <div style={{ display: "flex", minHeight: "100vh" }}>
            <SidebarUsuario />

            <main style={{ flex: 1, overflow: "auto" }}>
                {children}
            </main>
        </div>
    );
}