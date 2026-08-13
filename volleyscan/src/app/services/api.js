const API_URL = "http://127.0.0.1:8000";

export async function enviarMensaje(mensaje) {

    const respuesta = await fetch(`${API_URL}/chat`, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            mensaje
        })

    });

    if (!respuesta.ok) {
        throw new Error("Error al conectar con VolleyScan AI");
    }

    return await respuesta.json();

}