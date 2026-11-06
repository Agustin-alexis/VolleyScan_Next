"use client";

import { useParams } from "next/navigation";
import HistorialIA from "@/app/components/historial/HistorialIA";

// Ficha de un deportista: su análisis de IA visto por su entrenador
export default function FichaDeportistaPage() {
    const { id } = useParams();
    return <HistorialIA modo="entrenador" atletaId={id} />;
}
