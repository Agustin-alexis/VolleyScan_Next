"use client";

import { useCallback, useEffect, useState } from "react";
import { estadisticasEntrenador } from "./api";

/**
 * Carga las estadísticas del periodo. Al cambiar de periodo conserva los datos anteriores
 * (`refrescando: true`) para que la pantalla no parpadee.
 * `estado`: "cargando" (primera vez) | "listo" | "error".
 */
export function useEstadisticas(dias) {
    const [datos, setDatos] = useState(null);
    const [estado, setEstado] = useState("cargando");
    const [refrescando, setRefrescando] = useState(false);
    const [version, setVersion] = useState(0);

    useEffect(() => {
        let cancelado = false;
        setRefrescando(true);
        estadisticasEntrenador(dias).then((r) => {
            if (cancelado) return;
            if (r.ok) { setDatos(r.data); setEstado("listo"); } else { setEstado((e) => (e === "listo" ? e : "error")); }
            setRefrescando(false);
        });
        return () => { cancelado = true; };
    }, [dias, version]);

    const recargar = useCallback(() => { setEstado("cargando"); setVersion((v) => v + 1); }, []);

    return { datos, estado, refrescando, recargar };
}