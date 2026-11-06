"use client";

import { useCallback, useEffect, useState } from "react";
import { miProgreso } from "./api";

/** Carga el progreso una vez. `estado`: "cargando" | "listo" | "error". */
export function useProgreso() {
    const [datos, setDatos] = useState(null);
    const [estado, setEstado] = useState("cargando");

    const cargar = useCallback(async () => {
        const r = await miProgreso();
        if (r.ok) { setDatos(r.data); setEstado("listo"); } else { setEstado("error"); }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const recargar = useCallback(() => { setEstado("cargando"); cargar(); }, [cargar]);

    return { datos, estado, recargar };
}
