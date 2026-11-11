"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import CampanaAvisos from "@/app/components/avisos/CampanaAvisos";
import { api, getToken, actualizarUsuario, cerrarSesion } from "@/lib/api";

// Saca el rol sin importar si viene como rol / role o anidado en user / usuario.
function rolDe(yo) {
  const crudo = yo?.rol ?? yo?.role ?? yo?.user?.rol ?? yo?.usuario?.rol ?? "";
  return String(crudo).trim().toLowerCase();
}

export default function PanelLayout({ children }) {
  const router = useRouter();
  const [entrenador, setEntrenador] = useState(null);
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function verificarEntrenador() {
      if (!getToken()) {
        router.replace("/login");
        return;
      }
      try {
        const yo = await api("/auth/me");
        if (cancelado) return;

        actualizarUsuario(yo);
        const rol = rolDe(yo);

        // Si intenta entrar alguien que no es entrenador, lo redirigimos a su panel
        if (rol !== "entrenador" && rol !== "coach") {
          console.warn("[PanelLayout] /auth/me no devolvió rol de entrenador:", yo);
          if (rol === "admin") {
            router.replace("/admin");
          } else if (rol === "atleta") {
            router.replace("/usuario");
          } else {
            cerrarSesion();
            router.replace("/login");
          }
          return;
        }

        setEntrenador(yo);
        setAutorizado(true);
      } catch {
        if (cancelado) return;
        // Si no ha iniciado sesión o el token venció, lo mandamos al login
        cerrarSesion();
        router.replace("/login");
      }
    }

    verificarEntrenador();
    return () => {
      cancelado = true;
    };
  }, [router]);

  if (!autorizado) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          width: "100%",
          height: "100dvh",
          background: "#0f172a",
          color: "#f8fafc",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <p>Cargando panel del entrenador...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100dvh",
        overflow: "hidden",
      }}
    >
      {/* Le pasamos los datos reales del entrenador al Sidebar */}
      <Sidebar entrenador={entrenador} />

      {/* Campana de avisos: flotante arriba a la derecha */}
      <CampanaAvisos />

      <main
        style={{
          flex: 1,
          minWidth: 0,
          height: "100dvh",
          overflowY: "auto",
          padding: "20px",
          boxSizing: "border-box",
        }}
      >
        {children}
      </main>
    </div>
  );
}
