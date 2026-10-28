"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import { api } from "@/lib/api";

export default function PanelLayout({ children }) {
  const router = useRouter();
  const [entrenador, setEntrenador] = useState(null);
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    async function verificarEntrenador() {
      try {
        const yo = await api("/auth/me");

        // Si intenta entrar alguien que no es entrenador, lo redirigimos a su panel
        if (yo.rol !== "entrenador") {
          router.replace(yo.rol === "admin" ? "/admin" : "/usuario");
          return;
        }

        setEntrenador(yo);
        setAutorizado(true);
      } catch {
        // Si no ha iniciado sesión o el token venció, lo mandamos al login
        router.replace("/login");
      }
    }

    verificarEntrenador();
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