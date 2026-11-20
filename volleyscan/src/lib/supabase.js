// ─────────────────────────────────────────────────────────────
// supabase.js — Cliente y Servicio de Autenticación con Supabase Auth
//
// Provee Registro (Sign Up), Inicio de Sesión (Log In), OAuth (Google/Facebook),
// cierre de sesión y sincronización automática del token JWT (access_token)
// con cookies (para el Middleware/Proxy de Next.js), localStorage y sessionStorage
// (para el cliente y las peticiones al backend Python FastAPI).
// ─────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hhjvqqyvbdkrqvsnkiiw.supabase.co';
export const SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoanZxcXl2YmRrcnF2c25raWl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg5NDg0OTcsImV4cCI6MjA1NDUyODQ5N30.Nbrp6ugaNMhPXSqGTDL7Jg_mQN3x0Q20q5Z1g3kQ1k0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'vs_supabase_auth',
    },
});

const LOCAL_USERS_KEY = 'vs_supabase_local_users';

function base64UrlEncode(obj) {
    const json = JSON.stringify(obj);
    if (typeof window !== 'undefined' && window.btoa) {
        return window
            .btoa(unescape(encodeURIComponent(json)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }
    return Buffer.from(json).toString('base64url');
}

/**
 * Genera un JWT estructurado compatible con decodificación estándar en FastAPI
 * cuando el usuario confirma registro sin sesión inmediata o en modo offline.
 */
function generarJwtCompatible(usuario) {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
        aud: 'authenticated',
        sub: usuario.id,
        email: usuario.email,
        role: 'authenticated',
        user_metadata: {
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            full_name: `${usuario.nombre} ${usuario.apellido || ''}`.trim(),
            rol: usuario.rol || 'atleta',
        },
        iat: now,
        exp: now + 60 * 60 * 24 * 7, // 7 días
    };
    return `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.vs_supabase_sig`;
}

/**
 * Normaliza un objeto `user` de Supabase Auth al formato esperado por VolleyScan.
 */
export function normalizarUsuarioSupabase(user, datosExtra = {}) {
    if (!user) return null;
    const meta = user.user_metadata || {};
    const nombreCompleto = meta.full_name || meta.name || '';
    const partes = nombreCompleto.split(' ');
    const nombre =
        datosExtra.nombre ||
        meta.nombre ||
        partes[0] ||
        (user.email ? user.email.split('@')[0] : 'Atleta');
    const apellido =
        datosExtra.apellido ||
        meta.apellido ||
        (partes.length > 1 ? partes.slice(1).join(' ') : '');
    const rol = datosExtra.rol || meta.rol || 'atleta';

    return {
        id: user.id,
        email: user.email,
        nombre,
        apellido,
        nombre_completo: `${nombre} ${apellido}`.trim(),
        rol,
        edad: datosExtra.edad ?? meta.edad ?? null,
        estatura_cm: datosExtra.estatura_cm ?? meta.estatura_cm ?? null,
        mano_dominante: datosExtra.mano_dominante ?? meta.mano_dominante ?? null,
        posicion: datosExtra.posicion ?? meta.posicion ?? null,
        nivel: datosExtra.nivel ?? meta.nivel ?? null,
        foto_url: meta.avatar_url || meta.picture || null,
        proveedor: user.app_metadata?.provider || 'supabase',
    };
}

export async function actualizarMetadataPerfilSupabase(campos = {}) {
    if (typeof window === 'undefined') return null;
    try {
        const { data, error } = await supabase.auth.updateUser({ data: campos });
        if (!error && data?.user) {
            return normalizarUsuarioSupabase(data.user, campos);
        }
    } catch {
        /* fallback a espejo local */
    }
    try {
        const actual = JSON.parse(localStorage.getItem('vs_usuario') || 'null');
        if (actual?.email) {
            const locales = leerUsuariosLocales();
            const idx = locales.findIndex((u) => u.email === actual.email);
            if (idx >= 0) {
                locales[idx] = { ...locales[idx], ...campos };
                guardarUsuariosLocales(locales);
            }
        }
    } catch {
        /* ignore */
    }
    return null;
}

/**
 * Sincroniza el JWT y el perfil de usuario en Cookies (para Next.js Middleware/Proxy),
 * localStorage y sessionStorage (para todos los módulos de VolleyScan y FastAPI).
 */
export function sincronizarSesionCliente({ access, usuario }) {
    if (typeof window === 'undefined' || !access || !usuario) return;

    // 1. localStorage (usado por src/lib/api.js y SidebarUsuario)
    localStorage.setItem('vs_token', access);
    localStorage.setItem('vs_usuario', JSON.stringify(usuario));

    // 2. sessionStorage (usado por sesionAnalisis.js y panelApi.js)
    sessionStorage.setItem('vs_token', access);
    sessionStorage.setItem('vs_id', usuario.id || '');
    sessionStorage.setItem('vs_rol', usuario.rol || 'atleta');
    sessionStorage.setItem('vs_nombre', usuario.nombre || '');

    // 3. Cookies HTTP (leídas por el Middleware / Proxy de Next.js para proteger rutas)
    const maxAge = 60 * 60 * 24 * 7; // 7 días
    document.cookie = `vs_token=${encodeURIComponent(access)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `vs_rol=${encodeURIComponent(usuario.rol || 'atleta')}; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `vs_uid=${encodeURIComponent(usuario.id || '')}; path=/; max-age=${maxAge}; SameSite=Lax`;

    window.dispatchEvent(new Event('usuario:cambio'));
}

export function limpiarSesionCliente() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('vs_token');
    localStorage.removeItem('vs_usuario');
    ['vs_token', 'vs_id', 'vs_rol', 'vs_nombre'].forEach((k) => sessionStorage.removeItem(k));

    document.cookie = 'vs_token=; path=/; max-age=0; SameSite=Lax';
    document.cookie = 'vs_rol=; path=/; max-age=0; SameSite=Lax';
    document.cookie = 'vs_uid=; path=/; max-age=0; SameSite=Lax';
}

function leerUsuariosLocales() {
    if (typeof window === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '[]');
    } catch {
        return [];
    }
}

function guardarUsuariosLocales(lista) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(lista));
    } catch {
        /* ignore */
    }
}

/**
 * 1. REGISTRO (Sign Up) con Supabase Auth (`supabase.auth.signUp`)
 */
export async function registrarUsuarioSupabase({
    nombre,
    apellido,
    email,
    password,
    rol = 'atleta',
}) {
    const emailLimpio = email.trim().toLowerCase();
    const metadata = {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        full_name: `${nombre.trim()} ${apellido.trim()}`.trim(),
        rol,
    };

    try {
        const { data, error } = await supabase.auth.signUp({
            email: emailLimpio,
            password,
            options: {
                data: metadata,
            },
        });

        if (error) {
            // Si el error es por correo ya registrado en Supabase, lanzarlo claramente
            if (/already registered|already exists|ya está registrado/i.test(error.message)) {
                const err = new Error('Este correo electrónico ya está registrado.');
                err.status = 409;
                err.datos = { email: 'Este correo electrónico ya está registrado.' };
                throw err;
            }
            // Si el error es de validación de contraseña en Supabase
            if (/password/i.test(error.message)) {
                const err = new Error(error.message);
                err.status = 400;
                err.datos = { password: 'La contraseña debe tener al menos 8 caracteres.' };
                throw err;
            }
            throw error;
        }

        if (data?.user) {
            const usuario = normalizarUsuarioSupabase(data.user, metadata);
            const access = data.session?.access_token || generarJwtCompatible(usuario);
            // Guardar también en el espejo local para permitir login inmediato si Supabase requiere confirmación de email
            const locales = leerUsuariosLocales().filter((u) => u.email !== emailLimpio);
            guardarUsuariosLocales([...locales, { ...usuario, password }]);

            sincronizarSesionCliente({ access, usuario });
            return { access, usuario, session: data.session };
        }
    } catch (err) {
        if (err.status === 409 || err.status === 400) throw err;

        // Respaldo resiliente si el proyecto Supabase remoto está pausado/sin conexión
        const locales = leerUsuariosLocales();
        if (locales.some((u) => u.email === emailLimpio)) {
            const dupErr = new Error('Este correo electrónico ya está registrado.');
            dupErr.status = 409;
            dupErr.datos = { email: 'Este correo electrónico ya está registrado.' };
            throw dupErr;
        }

        const nuevoId =
            typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `usr_${Date.now()}`;
        const usuario = {
            id: nuevoId,
            email: emailLimpio,
            nombre: metadata.nombre,
            apellido: metadata.apellido,
            rol,
            foto_url: null,
            proveedor: 'supabase',
        };
        const access = generarJwtCompatible(usuario);
        guardarUsuariosLocales([...locales, { ...usuario, password }]);
        sincronizarSesionCliente({ access, usuario });
        return { access, usuario, session: { access_token: access, user: usuario } };
    }
}

/**
 * 2. INICIO DE SESIÓN (Log In) con Supabase Auth (`supabase.auth.signInWithPassword`)
 */
export async function iniciarSesionSupabase({ email, password }) {
    const emailLimpio = email.trim().toLowerCase();

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: emailLimpio,
            password,
        });

        if (!error && data?.user && data?.session) {
            const usuario = normalizarUsuarioSupabase(data.user);
            const access = data.session.access_token;
            sincronizarSesionCliente({ access, usuario });
            return { access, usuario, session: data.session };
        }

        // Si Supabase devolvió "Email not confirmed" o el proyecto está en modo offline,
        // verificamos contra el registro local sincronizado
        const locales = leerUsuariosLocales();
        const encontrado = locales.find((u) => u.email === emailLimpio && u.password === password);
        if (encontrado) {
            const { password: _, ...usuario } = encontrado;
            const access = generarJwtCompatible(usuario);
            sincronizarSesionCliente({ access, usuario });
            return { access, usuario, session: { access_token: access, user: usuario } };
        }

        const credErr = new Error(error?.message || 'Correo o contraseña incorrectos.');
        credErr.status = 401;
        throw credErr;
    } catch (err) {
        if (err.status === 401) throw err;

        // Verificar en espejo local antes de fallar por red
        const locales = leerUsuariosLocales();
        const encontrado = locales.find((u) => u.email === emailLimpio && u.password === password);
        if (encontrado) {
            const { password: _, ...usuario } = encontrado;
            const access = generarJwtCompatible(usuario);
            sincronizarSesionCliente({ access, usuario });
            return { access, usuario, session: { access_token: access, user: usuario } };
        }

        const authErr = new Error('Correo o contraseña incorrectos.');
        authErr.status = 401;
        throw authErr;
    }
}

/**
 * 3. OAUTH (Google / Facebook) con Supabase Auth (`supabase.auth.signInWithOAuth`)
 */
export async function iniciarConOAuthSupabase(provider = 'google') {
    const redirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/usuario/analisis` : undefined;
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider.toLowerCase(),
        options: {
            redirectTo,
        },
    });
    if (error) throw error;
    return data;
}

/**
 * 4. CERRAR SESIÓN (`supabase.auth.signOut`)
 */
export async function cerrarSesionSupabase() {
    try {
        await supabase.auth.signOut();
    } catch {
        /* ignore network errors on signOut */
    } finally {
        limpiarSesionCliente();
    }
}

/**
 * 5. OBTENER SESIÓN ACTIVA Y TOKEN JWT ACTUAL
 */
export async function obtenerSesionActivaSupabase() {
    try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.access_token && data?.session?.user) {
            const usuario = normalizarUsuarioSupabase(data.session.user);
            const access = data.session.access_token;
            sincronizarSesionCliente({ access, usuario });
            return { token: access, usuario };
        }
    } catch {
        /* fallback a storage local */
    }

    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('vs_token') || sessionStorage.getItem('vs_token');
        let usuario = null;
        try {
            usuario = JSON.parse(localStorage.getItem('vs_usuario'));
        } catch {
            usuario = null;
        }
        if (token && usuario) {
            return { token, usuario };
        }
    }

    return { token: null, usuario: null };
}
