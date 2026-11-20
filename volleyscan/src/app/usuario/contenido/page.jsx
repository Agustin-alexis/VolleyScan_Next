"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    FaBolt,
    FaCirclePlay,
    FaMagnifyingGlass,
    FaRegClock,
    FaVideo,
    FaXmark,
} from "react-icons/fa6";
import { api } from "@/lib/api";

const CATEGORIAS = [
    { key: "todos", label: "Todos" },
    { key: "remate", label: "Remate" },
    { key: "saque", label: "Saque" },
    { key: "voleo", label: "Voleo" },
    { key: "recepcion", label: "Recepción" },
    { key: "bloqueo", label: "Bloqueo" },
    { key: "salto_vertical", label: "Salto Vertical" },
];

const BADGE_COLOR = {
    remate: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    saque: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    voleo: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    recepcion: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    bloqueo: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    salto_vertical: "bg-purple-500/15 text-purple-300 border-purple-500/30",
};

function normalizarVideo(v) {
    let ytId = v?.youtube_id;
    if (!ytId && v?.video_url) {
        const match = String(v.video_url).match(
            /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        );
        ytId = match ? match[1] : null;
    }
    return {
        ...v,
        youtube_id: ytId,
        embed_url: ytId ? `https://www.youtube.com/embed/${ytId}?rel=0` : v?.embed_url || "",
        miniatura_url:
            v?.miniatura_url || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : ""),
    };
}

export default function ContenidoEducativoPage() {
    const [videos, setVideos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [categoria, setCategoria] = useState("todos");
    const [busqueda, setBusqueda] = useState("");
    const [videoActivo, setVideoActivo] = useState(null);

    const cargarContenido = useCallback(async () => {
        setCargando(true);
        try {
            const data = await api("/usuario/contenido");
            const lista = Array.isArray(data) ? data.map(normalizarVideo) : [];
            setVideos(lista);
        } catch {
            setVideos([]);
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargarContenido();
    }, [cargarContenido]);

    const videosFiltrados = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        return videos.filter((v) => {
            if (categoria !== "todos" && String(v.categoria || "").toLowerCase() !== categoria) {
                return false;
            }
            if (!q) return true;
            const texto = [
                v.titulo,
                v.categoria_label,
                v.descripcion,
                v.fundamento_clave,
                v.autor,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return texto.includes(q);
        });
    }, [videos, categoria, busqueda]);

    return (
        <div className="min-h-screen bg-[#0b0f1a] text-slate-100 w-full overflow-x-hidden">
            <div className="w-full max-w-6xl mx-auto px-6 py-8 overflow-x-hidden space-y-6">
            {/* CABECERA */}
            <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-300 text-xs font-semibold mb-2">
                        <FaVideo className="text-blue-400" />
                        Videoteca Técnica de Voleibol
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                        Contenido Educativo
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Tutoriales técnicos en video seleccionados para perfeccionar cada fundamento y corregir tus métricas.
                    </p>
                </div>

                {/* BARRA DE BÚSQUEDA */}
                <div className="relative w-full lg:w-80">
                    <FaMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                    <input
                        type="search"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar técnica, fundamento o título..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#111827] border border-white/15 focus:border-blue-500 focus:outline-none text-sm text-white placeholder:text-slate-500"
                    />
                </div>
            </header>

            {/* FILTROS POR CATEGORÍA */}
            <nav className="flex flex-wrap items-center gap-2">
                {CATEGORIAS.map((cat) => {
                    const activo = categoria === cat.key;
                    return (
                        <button
                            key={cat.key}
                            type="button"
                            onClick={() => setCategoria(cat.key)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                                activo
                                    ? "bg-blue-600/20 border-blue-500 text-blue-300"
                                    : "bg-[#111827] border-white/10 text-slate-400 hover:text-white hover:border-white/25"
                            }`}
                        >
                            {cat.label}
                        </button>
                    );
                })}
            </nav>

            {/* REPRODUCTOR DESTACADO ACTIVO (RESPONSIVE 16:9 YOUTUBE IFRAME) */}
            {videoActivo && (
                <section className="bg-[#111827] border border-cyan-500/40 rounded-2xl overflow-hidden shadow-2xl shadow-cyan-950/20">
                    <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/10 bg-[#0d1424]">
                        <div className="flex items-center gap-3 min-w-0">
                            <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${
                                    BADGE_COLOR[videoActivo.categoria] || "bg-slate-800 text-slate-300 border-white/10"
                                }`}
                            >
                                {videoActivo.categoria_label || videoActivo.categoria}
                            </span>
                            <h2 className="text-sm md:text-base font-bold text-white truncate">
                                {videoActivo.titulo}
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setVideoActivo(null)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer shrink-0"
                        >
                            <FaXmark />
                            Cerrar
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12">
                        <div className="lg:col-span-8 bg-black">
                            <div className="relative w-full aspect-video">
                                <iframe
                                    src={videoActivo.embed_url}
                                    title={videoActivo.titulo}
                                    className="absolute inset-0 w-full h-full border-0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            </div>
                        </div>

                        <div className="lg:col-span-4 p-5 flex flex-col justify-between space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-xs text-slate-400">
                                    <span className="inline-flex items-center gap-1 text-cyan-300 font-semibold">
                                        <FaRegClock />
                                        {videoActivo.duracion}
                                    </span>
                                    <span>·</span>
                                    <span>{videoActivo.nivel || "Todos los niveles"}</span>
                                    {videoActivo.autor && (
                                        <>
                                            <span>·</span>
                                            <span>{videoActivo.autor}</span>
                                        </>
                                    )}
                                </div>

                                <div className="rounded-xl bg-[#0b0f1a] border border-white/10 p-3.5">
                                    <div className="text-[11px] uppercase tracking-wider text-cyan-400 font-bold">
                                        Fundamento Técnico
                                    </div>
                                    <p className="text-xs text-slate-200 mt-1 font-medium">
                                        {videoActivo.fundamento_clave || videoActivo.descripcion}
                                    </p>
                                </div>

                                <p className="text-sm text-slate-300 leading-relaxed">
                                    {videoActivo.descripcion}
                                </p>
                            </div>

                            {videoActivo.video_url && (
                                <a
                                    href={videoActivo.video_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-semibold text-white transition"
                                >
                                    Abrir en YouTube ↗
                                </a>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {/* CATÁLOGO DE VIDEOS */}
            {cargando ? (
                <div className="bg-[#111827] border border-white/10 rounded-2xl p-12 text-center text-slate-400">
                    Cargando biblioteca educativa...
                </div>
            ) : videosFiltrados.length === 0 ? (
                <div className="bg-[#111827] border border-white/10 rounded-2xl p-10 text-center space-y-3">
                    <h2 className="text-lg font-bold text-white">No se encontraron tutoriales</h2>
                    <p className="text-sm text-slate-400">
                        Prueba limpiando la búsqueda o seleccionando otra categoría técnica.
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            setCategoria("todos");
                            setBusqueda("");
                        }}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer"
                    >
                        Mostrar todos los videos
                    </button>
                </div>
            ) : (
                <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {videosFiltrados.map((vid) => {
                        const esActivo = videoActivo?.id === vid.id;
                        return (
                            <article
                                key={vid.id}
                                className={`group rounded-2xl border overflow-hidden flex flex-col bg-[#111827] transition ${
                                    esActivo
                                        ? "border-cyan-400/70 ring-1 ring-cyan-400/30"
                                        : "border-white/10 hover:border-white/25"
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => setVideoActivo(vid)}
                                    className="relative aspect-video w-full bg-slate-900 overflow-hidden cursor-pointer block"
                                >
                                    {vid.miniatura_url && (
                                        <img
                                            src={vid.miniatura_url}
                                            alt={vid.titulo}
                                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f1a]/90 via-[#0b0f1a]/25 to-transparent" />

                                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                                        <span
                                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border backdrop-blur-sm ${
                                                BADGE_COLOR[vid.categoria] ||
                                                "bg-slate-800/90 text-slate-200 border-white/15"
                                            }`}
                                        >
                                            {vid.categoria_label || vid.categoria}
                                        </span>
                                        {vid.recomendado_ia && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 backdrop-blur-sm">
                                                <FaBolt className="text-[10px]" />
                                                Sugerido IA
                                            </span>
                                        )}
                                    </div>

                                    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/75 text-white text-[11px] font-semibold">
                                        <FaRegClock />
                                        {vid.duracion}
                                    </span>

                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="w-12 h-12 rounded-full bg-blue-600/90 group-hover:bg-blue-500 text-white flex items-center justify-center shadow-xl transition">
                                            <FaCirclePlay className="text-xl" />
                                        </span>
                                    </div>
                                </button>

                                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                    <div className="space-y-2">
                                        <h3 className="text-sm md:text-base font-bold text-white leading-snug">
                                            {vid.titulo}
                                        </h3>
                                        {vid.fundamento_clave && (
                                            <p className="text-xs font-semibold text-cyan-300">
                                                Clave: {vid.fundamento_clave}
                                            </p>
                                        )}
                                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                                            {vid.descripcion}
                                        </p>
                                    </div>

                                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                                        <span className="text-[11px] text-slate-500">
                                            {vid.autor || "VolleyScan"} · {vid.nivel || "Técnica"}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setVideoActivo(vid)}
                                            className="text-xs font-bold text-blue-400 hover:text-blue-300 cursor-pointer"
                                        >
                                            {esActivo ? "Reproduciendo" : "Ver clase ▶"}
                                        </button>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </section>
            )}
            </div>
        </div>
    );
}
