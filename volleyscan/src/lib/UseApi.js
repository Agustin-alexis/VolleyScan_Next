"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

export function useApi(ruta, params) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [cargando, setCargando] = useState(true);
    const ultima = useRef(0);
    const clave = JSON.stringify(params ?? {});

    const cargar = useCallback(async () => {
        const id = ++ultima.current; // descarta respuestas viejas
        setCargando(true);
        try {
            const res = await api(ruta, { params: JSON.parse(clave) });
            if (id === ultima.current) {
                setData(res);
                setError(null);
            }
        } catch (e) {
            if (id === ultima.current) setError(e);
        } finally {
            if (id === ultima.current) setCargando(false);
        }
    }, [ruta, clave]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    return { data, error, cargando, recargar: cargar, setData };
}