import { getToken, getUsuario } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_CHAT_API_URL ?? "http://127.0.0.1:8010";

export async function enviarMensaje(mensaje) {
    const token = getToken();
    const usuario = getUsuario();

    const respuesta = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(usuario?.id ? { "X-User-Id": String(usuario.id) } : {}),
        },
        body: JSON.stringify({
            mensaje,
            usuario_id: usuario?.id ?? null,
        }),
    });

    if (!respuesta.ok) {
        throw new Error("Error al conectar con VolleyScan AI");
    }

    return await respuesta.json();
}
