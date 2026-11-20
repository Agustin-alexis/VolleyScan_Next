// ─────────────────────────────────────────────────────────────
// proxy.js — Protección de Rutas en Next.js 16 (Middleware / Route Guard)
//
// Protege todas las rutas privadas del Visor 3D, Dashboard de Análisis Técnico,
// Historial de IA y Paneles (/usuario/*, /panel_entrenador/*, /admin/*),
// exigiendo sesión activa con token JWT de Supabase Auth.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';

const RUTAS_PRIVADAS = ['/usuario', '/panel_entrenador', '/admin'];
const RUTAS_AUTH = ['/login', '/registro'];

export function proxy(request) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get('vs_token')?.value;
    const rol = request.cookies.get('vs_rol')?.value || 'atleta';

    const esRutaPrivada = RUTAS_PRIVADAS.some(
        (prefijo) => pathname === prefijo || pathname.startsWith(`${prefijo}/`),
    );

    if (esRutaPrivada && !token) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('next', pathname);
        return NextResponse.redirect(loginUrl);
    }

    const esRutaAuth = RUTAS_AUTH.some(
        (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`),
    );

    if (esRutaAuth && token) {
        const destino =
            rol === 'entrenador'
                ? '/panel_entrenador/dashboard'
                : rol === 'admin'
                  ? '/admin'
                  : '/usuario/analisis';
        return NextResponse.redirect(new URL(destino, request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/usuario/:path*',
        '/panel_entrenador/:path*',
        '/admin/:path*',
        '/login',
        '/registro',
    ],
};
