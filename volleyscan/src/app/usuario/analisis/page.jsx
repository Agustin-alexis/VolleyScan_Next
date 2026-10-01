// Página del panel de USUARIO (deportista): /usuario/analisis
// Reemplaza el page.jsx actual de esta carpeta (haz una copia antes si
// quieres conservar el contenido anterior).
// Es un Server Component a propósito: toda la lógica de cámara vive dentro
// de GestureAnalyzer, que ya es un Client Component.

import GestureAnalyzer from '../../components/analisis/GestureAnalyzer';

export default function AnalisisPage() {
    return <GestureAnalyzer />;
}