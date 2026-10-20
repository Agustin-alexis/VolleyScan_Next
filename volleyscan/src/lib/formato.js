export const mmss = (seg) =>
    `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;

// "contacto_adelantado" -> "Contacto adelantado"
export const humanizar = (slug) => {
    const t = slug.replaceAll("_", " ");
    return t.charAt(0).toUpperCase() + t.slice(1);
};

export function haceCuanto(iso) {
    const min = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (min < 1) return "Hace un momento";
    if (min < 60) return `Hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `Hace ${h} ${h === 1 ? "hora" : "horas"}`;
    const d = Math.floor(h / 24);
    return `Hace ${d} ${d === 1 ? "día" : "días"}`;
}