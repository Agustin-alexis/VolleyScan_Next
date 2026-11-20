// Página del panel de USUARIO (deportista): /usuario/analisis
// Server Component wrapper con Suspense para lectura segura de searchParams (?rutinaId=&gesto=)

import { Suspense } from 'react';
import GestureAnalyzer from '../../components/analisis/GestureAnalyzer';

export default function AnalisisPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#070a12] flex items-center justify-center text-slate-400 text-sm">
                    Cargando Asistente IA en Vivo...
                </div>
            }
        >
            <GestureAnalyzer />
        </Suspense>
    );
}
