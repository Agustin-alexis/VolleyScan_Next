'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  api,
  actualizarUsuario,
  getUsuario,
  urlFoto,
} from '@/lib/api';
import {
  actualizarMetadataPerfilSupabase,
  supabase,
} from '@/lib/supabase';

const MANOS = [
  { id: 'derecha', label: 'Derecha', helper: 'Brazo de ataque derecho' },
  { id: 'izquierda', label: 'Izquierda', helper: 'Brazo de ataque izquierdo' },
];

const POSICIONES = [
  { id: 'punta', label: 'Punta', tag: 'Ataque y recepción' },
  { id: 'opuesto', label: 'Opuesto', tag: 'Remate por zona 2' },
  { id: 'central', label: 'Central', tag: 'Bloqueo y ataque rápido' },
  { id: 'armador', label: 'Armador', tag: 'Pase y dirección de juego' },
  { id: 'libero', label: 'Líbero', tag: 'Defensa y primera línea' },
];

const NIVELES = [
  {
    id: 'principiante',
    label: 'Principiante',
    desc: 'Construyendo bases de postura, saque y control.',
  },
  {
    id: 'intermedio',
    label: 'Intermedio',
    desc: 'Mejorando salto, ritmo de remate y precisión.',
  },
  {
    id: 'avanzado',
    label: 'Avanzado',
    desc: 'Afinando potencia, táctica y consistencia máxima.',
  },
];

function normalizarClave(valor, permitidos, fallback) {
  const limpio = String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return permitidos.includes(limpio) ? limpio : fallback;
}

function construirNombreCompleto(p, meta, localUser) {
  const directo =
    p?.nombre_completo ||
    meta?.full_name ||
    meta?.nombre_completo ||
    localUser?.nombre_completo;
  if (directo && String(directo).trim()) {
    return String(directo).trim();
  }
  const nombre = p?.nombre || meta?.nombre || localUser?.nombre || '';
  const apellido = p?.apellido || meta?.apellido || localUser?.apellido || '';
  const unido = `${nombre} ${apellido}`.trim();
  return unido || 'Atleta VolleyScan';
}

function dividirNombre(nombreCompleto) {
  const partes = String(nombreCompleto || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) {
    return { nombre: 'Atleta', apellido: '' };
  }
  if (partes.length === 1) {
    return { nombre: partes[0], apellido: '' };
  }
  return {
    nombre: partes[0],
    apellido: partes.slice(1).join(' '),
  };
}

function inicialesDe(nombreCompleto) {
  const partes = String(nombreCompleto || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return 'VS';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

function calcularEdadDesdeFecha(fechaNac) {
  if (!fechaNac) return '';
  const nac = new Date(fechaNac);
  if (Number.isNaN(nac.getTime())) return '';
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const mesDiff = hoy.getMonth() - nac.getMonth();
  if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < nac.getDate())) {
    edad -= 1;
  }
  return edad >= 6 && edad <= 90 ? String(edad) : '';
}

function nivelBadgeEstilo(nivel) {
  if (nivel === 'avanzado') {
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30';
  }
  if (nivel === 'intermedio') {
    return 'bg-[#10e2f7]/15 text-[#10e2f7] border-[#10e2f7]/35';
  }
  return 'bg-amber-500/15 text-amber-300 border-amber-400/30';
}

export default function PerfilUsuarioPage() {
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [email, setEmail] = useState('');
  const [fotoUrl, setFotoUrl] = useState(null);
  const [origenDatos, setOrigenDatos] = useState('Supabase');
  const [bannerEstado, setBannerEstado] = useState(null);

  const [form, setForm] = useState({
    nombre_completo: 'Atleta VolleyScan',
    edad: '',
    estatura_cm: '',
    mano_dominante: 'derecha',
    posicion: 'punta',
    nivel: 'intermedio',
  });

  const fileInputRef = useRef(null);
  const bannerTimerRef = useRef(null);

  const mostrarBanner = (tipo, titulo, detalle = '') => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
    }
    setBannerEstado({ tipo, titulo, detalle });
    bannerTimerRef.current = setTimeout(() => {
      setBannerEstado(null);
    }, 5000);
  };

  useEffect(() => {
    let activo = true;

    async function cargarPerfil() {
      const localUser = getUsuario();
      const [apiRes, supaRes] = await Promise.allSettled([
        api('/usuario/perfil/'),
        supabase.auth.getUser(),
      ]);

      if (!activo) return;

      const p = apiRes.status === 'fulfilled' ? apiRes.value || {} : {};
      const supaUser =
        supaRes.status === 'fulfilled' ? supaRes.value?.data?.user || null : null;
      const meta = supaUser?.user_metadata || {};

      const nombreCompleto = construirNombreCompleto(p, meta, localUser);
      const edadCruda =
        meta.edad ??
        p.edad ??
        localUser?.edad ??
        calcularEdadDesdeFecha(p.fecha_nac);
      const estaturaCruda =
        meta.estatura_cm ??
        p.estatura_cm ??
        p.estatura ??
        localUser?.estatura_cm ??
        localUser?.estatura ??
        '';

      const mano = normalizarClave(
        meta.mano_dominante || p.mano_dominante || localUser?.mano_dominante,
        ['derecha', 'izquierda'],
        'derecha'
      );
      const pos = normalizarClave(
        meta.posicion || p.posicion || localUser?.posicion,
        ['punta', 'opuesto', 'central', 'armador', 'libero'],
        'punta'
      );
      const niv = normalizarClave(
        meta.nivel || p.nivel || localUser?.nivel,
        ['principiante', 'intermedio', 'avanzado'],
        'intermedio'
      );

      setEmail(supaUser?.email || p.email || localUser?.email || '');
      setFotoUrl(
        p.foto_url
          ? urlFoto(p.foto_url)
          : localUser?.foto_url
            ? urlFoto(localUser.foto_url)
            : null
      );
      setOrigenDatos(supaUser ? 'Supabase Auth + VolleyScan' : 'Perfil local');

      setForm({
        nombre_completo: nombreCompleto,
        edad:
          edadCruda !== null && edadCruda !== undefined && edadCruda !== ''
            ? String(edadCruda)
            : '',
        estatura_cm:
          estaturaCruda !== null &&
          estaturaCruda !== undefined &&
          estaturaCruda !== ''
            ? String(estaturaCruda)
            : '',
        mano_dominante: mano,
        posicion: pos,
        nivel: niv,
      });

      setCargando(false);
    }

    cargarPerfil().catch(() => {
      if (activo) setCargando(false);
    });

    return () => {
      activo = false;
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const iniciales = useMemo(
    () => inicialesDe(form.nombre_completo),
    [form.nombre_completo]
  );

  const posicionLabel = useMemo(() => {
    const match = POSICIONES.find((item) => item.id === form.posicion);
    return match ? match.label : 'Punta';
  }, [form.posicion]);

  const nivelObj = useMemo(() => {
    return NIVELES.find((item) => item.id === form.nivel) || NIVELES[1];
  }, [form.nivel]);

  const manoLabel = form.mano_dominante === 'izquierda' ? 'Zurda' : 'Diestra';

  const camposCompletos = useMemo(() => {
    const checks = [
      Boolean(form.nombre_completo.trim()),
      Boolean(String(form.edad).trim()),
      Boolean(String(form.estatura_cm).trim()),
      Boolean(form.mano_dominante),
      Boolean(form.posicion),
      Boolean(form.nivel),
    ];
    const done = checks.filter(Boolean).length;
    return { done, total: checks.length, pct: Math.round((done / checks.length) * 100) };
  }, [form]);

  const actualizarCampo = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    const nombreLimpio = form.nombre_completo.trim();
    if (!nombreLimpio) {
      mostrarBanner(
        'error',
        'Falta tu nombre completo',
        'Escribe cómo quieres que te llame tu Coach IA.'
      );
      return;
    }

    const edadNum = form.edad !== '' ? Number(form.edad) : null;
    if (edadNum !== null && (Number.isNaN(edadNum) || edadNum < 6 || edadNum > 90)) {
      mostrarBanner(
        'error',
        'Revisa tu edad',
        'Ingresa un valor entre 6 y 90 años.'
      );
      return;
    }

    const estaturaNum =
      form.estatura_cm !== '' ? Number(form.estatura_cm) : null;
    if (
      estaturaNum !== null &&
      (Number.isNaN(estaturaNum) || estaturaNum < 100 || estaturaNum > 240)
    ) {
      mostrarBanner(
        'error',
        'Revisa tu estatura',
        'Ingresa tu estatura en centímetros (entre 100 y 240 cm).'
      );
      return;
    }

    setGuardando(true);
    const { nombre, apellido } = dividirNombre(nombreLimpio);

    const payloadPerfil = {
      nombre_completo: nombreLimpio,
      nombre,
      apellido,
      edad: edadNum,
      estatura_cm: estaturaNum,
      estatura: estaturaNum,
      mano_dominante: form.mano_dominante,
      posicion: form.posicion,
      nivel: form.nivel,
    };

    const payloadSupabase = {
      full_name: nombreLimpio,
      nombre_completo: nombreLimpio,
      nombre,
      apellido,
      edad: edadNum,
      estatura_cm: estaturaNum,
      mano_dominante: form.mano_dominante,
      posicion: form.posicion,
      nivel: form.nivel,
    };

    const [supaOutcome, apiOutcome] = await Promise.allSettled([
      actualizarMetadataPerfilSupabase(payloadSupabase),
      api('/usuario/perfil/', { method: 'PUT', body: payloadPerfil }),
    ]);

    actualizarUsuario(payloadPerfil);
    setGuardando(false);

    const supaOk =
      supaOutcome.status === 'fulfilled' && supaOutcome.value?.ok !== false;
    const apiOk = apiOutcome.status === 'fulfilled';

    if (supaOk || apiOk) {
      mostrarBanner(
        'success',
        '¡Cambios guardados en tu perfil!',
        supaOk
          ? 'Tu ficha deportiva ya está sincronizada con Supabase y lista para tus análisis IA.'
          : 'Tus datos quedaron guardados en tu perfil deportivo de VolleyScan.'
      );
    } else {
      mostrarBanner(
        'warning',
        'Guardado en este dispositivo',
        'No se pudo conectar a la nube ahora mismo, pero tus cambios siguen activos en la app.'
      );
    }
  };

  const handleFotoSeleccionada = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      mostrarBanner('error', 'Archivo no válido', 'Selecciona una foto JPG o PNG.');
      return;
    }

    setSubiendoFoto(true);
    const localPreview = URL.createObjectURL(file);
    setFotoUrl(localPreview);

    const fd = new FormData();
    fd.append('foto', file);

    try {
      const resp = await api('/usuario/perfil/foto/', {
        method: 'POST',
        body: fd,
      });
      if (resp?.foto_url) {
        setFotoUrl(urlFoto(resp.foto_url));
        actualizarUsuario({ foto_url: resp.foto_url });
      }
      mostrarBanner(
        'success',
        'Foto actualizada',
        'Tu imagen de atleta ya aparece en el menú.'
      );
    } catch {
      mostrarBanner(
        'warning',
        'Vista previa aplicada',
        'La foto se muestra localmente; vuelve a intentarlo cuando tengas conexión.'
      );
    } finally {
      setSubiendoFoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleQuitarFoto = async () => {
    setSubiendoFoto(true);
    try {
      await api('/usuario/perfil/foto/', { method: 'DELETE' });
    } catch {
      // Silencioso: limpiar localmente si backend no está disponible
    }
    setFotoUrl(null);
    actualizarUsuario({ foto_url: null });
    setSubiendoFoto(false);
    mostrarBanner('success', 'Foto eliminada', 'Ahora se muestran tus iniciales.');
  };

  return (
    <div className="min-h-full w-full bg-[#0c1322] text-slate-100">
      <div className="w-full max-w-5xl mx-auto px-6 py-8 overflow-x-hidden space-y-6">
        {/* Encabezado */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#10e2f7]">
              Ficha del Jugador
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Tu Perfil Deportivo
            </h1>
            <p className="text-sm text-slate-400">
              Ajusta tus datos para que la IA calibre mejor tu altura de salto, alcance y rutinas.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/usuario/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-[#162032] px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800/80 transition"
            >
              Volver al Dashboard
            </Link>
            <Link
              href="/usuario/progreso"
              className="inline-flex items-center gap-2 rounded-full bg-[#10e2f7]/15 border border-[#10e2f7]/35 px-4 py-2 text-sm font-semibold text-[#10e2f7] hover:bg-[#10e2f7]/25 transition"
            >
              Ver Progreso
            </Link>
          </div>
        </header>

        {/* Banner de confirmación */}
        {bannerEstado && (
          <div
            role="status"
            aria-live="polite"
            className={`flex items-start justify-between gap-4 rounded-2xl border p-4 transition-all ${
              bannerEstado.tipo === 'success'
                ? 'bg-emerald-500/12 border-emerald-400/35 text-emerald-200'
                : bannerEstado.tipo === 'error'
                  ? 'bg-rose-500/12 border-rose-400/35 text-rose-200'
                  : 'bg-amber-500/12 border-amber-400/35 text-amber-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  bannerEstado.tipo === 'success'
                    ? 'bg-emerald-500/25 text-emerald-300'
                    : bannerEstado.tipo === 'error'
                      ? 'bg-rose-500/25 text-rose-300'
                      : 'bg-amber-500/25 text-amber-300'
                }`}
              >
                {bannerEstado.tipo === 'success' ? '✓' : '!'}
              </span>
              <div>
                <p className="text-sm font-semibold text-white">
                  {bannerEstado.titulo}
                </p>
                {bannerEstado.detalle && (
                  <p className="text-xs opacity-90 mt-0.5">{bannerEstado.detalle}</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setBannerEstado(null)}
              className="text-xs text-slate-300 hover:text-white px-2 py-1"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Tarjeta superior de identidad atlética */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-br from-[#162032] via-[#131c2e] to-[#0f172a] p-6 shadow-xl">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#10e2f7]/10 blur-3xl" />

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              {/* Avatar con controles */}
              <div className="relative shrink-0 self-start sm:self-auto">
                <div className="h-24 w-24 rounded-2xl overflow-hidden border-2 border-[#10e2f7]/40 bg-[#0c1322] flex items-center justify-center shadow-lg shadow-[#10e2f7]/10">
                  {fotoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={fotoUrl}
                      alt={form.nombre_completo || 'Avatar del jugador'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-extrabold tracking-wide text-[#10e2f7]">
                      {iniciales}
                    </span>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFotoSeleccionada}
                  className="hidden"
                />

                <button
                  type="button"
                  disabled={subiendoFoto}
                  onClick={() => fileInputRef.current?.click()}
                  title="Cambiar foto"
                  className="absolute -bottom-2 -right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-[#162032] text-[#10e2f7] shadow-md hover:bg-[#10e2f7] hover:text-[#04101d] transition disabled:opacity-50"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </button>
              </div>

              {/* Resumen del jugador */}
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-xl sm:text-2xl font-bold text-white truncate">
                    {form.nombre_completo || 'Atleta VolleyScan'}
                  </h2>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold ${nivelBadgeEstilo(form.nivel)}`}
                  >
                    {nivelObj.label}
                  </span>
                </div>

                {email && (
                  <p className="text-xs sm:text-sm text-slate-400 truncate">
                    {email}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 border border-slate-700/70 px-3 py-1 text-xs font-medium text-slate-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#10e2f7]" />
                    {posicionLabel}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 border border-slate-700/70 px-3 py-1 text-xs font-medium text-slate-200">
                    Mano {manoLabel}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 border border-slate-700/70 px-3 py-1 text-xs font-medium text-slate-200">
                    {form.estatura_cm ? `${form.estatura_cm} cm` : 'Estatura por definir'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 border border-slate-700/70 px-3 py-1 text-xs font-medium text-slate-200">
                    {form.edad ? `${form.edad} años` : 'Edad por definir'}
                  </span>
                </div>

                {fotoUrl && (
                  <button
                    type="button"
                    onClick={handleQuitarFoto}
                    disabled={subiendoFoto}
                    className="text-xs font-medium text-slate-400 hover:text-rose-300 transition pt-1"
                  >
                    Quitar foto actual
                  </button>
                )}
              </div>
            </div>

            {/* Indicador de ficha completa */}
            <div className="w-full md:w-56 rounded-2xl border border-slate-800 bg-[#0c1322]/70 p-4 space-y-2 shrink-0">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">Ficha completa</span>
                <span className="font-bold text-[#10e2f7]">{camposCompletos.pct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#10e2f7] to-emerald-400 transition-all duration-300"
                  style={{ width: `${camposCompletos.pct}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                {camposCompletos.done}/{camposCompletos.total} datos listos · {origenDatos}
              </p>
            </div>
          </div>
        </section>

        {/* Formulario principal */}
        <form
          onSubmit={handleGuardar}
          className="rounded-2xl border border-slate-800/80 bg-[#162032] p-6 space-y-6 shadow-lg"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white">
                Datos de Entrenamiento
              </h3>
              <p className="text-sm text-slate-400">
                Tu Coach IA usa tu estatura y posición para darte consejos más reales.
              </p>
            </div>
            {cargando && (
              <span className="text-xs font-medium text-[#10e2f7]">
                Cargando datos desde Supabase...
              </span>
            )}
          </div>

          {/* Fila 1: Nombre completo, Edad, Estatura */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            <div className="md:col-span-6 space-y-2">
              <label
                htmlFor="nombre_completo"
                className="block text-sm font-semibold text-slate-200"
              >
                Nombre completo
              </label>
              <input
                id="nombre_completo"
                type="text"
                value={form.nombre_completo}
                onChange={(e) => actualizarCampo('nombre_completo', e.target.value)}
                placeholder="Ej. Sebastián Gómez"
                className="w-full rounded-xl border border-slate-700/80 bg-[#0c1322] px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-[#10e2f7] focus:outline-none focus:ring-2 focus:ring-[#10e2f7]/25 transition"
                required
              />
            </div>

            <div className="md:col-span-3 space-y-2">
              <label
                htmlFor="edad"
                className="block text-sm font-semibold text-slate-200"
              >
                Edad
              </label>
              <div className="relative">
                <input
                  id="edad"
                  type="number"
                  min={6}
                  max={90}
                  value={form.edad}
                  onChange={(e) => actualizarCampo('edad', e.target.value)}
                  placeholder="15"
                  className="w-full rounded-xl border border-slate-700/80 bg-[#0c1322] px-4 py-3 pr-14 text-sm text-white placeholder-slate-500 focus:border-[#10e2f7] focus:outline-none focus:ring-2 focus:ring-[#10e2f7]/25 transition"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                  años
                </span>
              </div>
            </div>

            <div className="md:col-span-3 space-y-2">
              <label
                htmlFor="estatura_cm"
                className="block text-sm font-semibold text-slate-200"
              >
                Estatura (cm)
              </label>
              <div className="relative">
                <input
                  id="estatura_cm"
                  type="number"
                  min={100}
                  max={240}
                  value={form.estatura_cm}
                  onChange={(e) => actualizarCampo('estatura_cm', e.target.value)}
                  placeholder="174"
                  className="w-full rounded-xl border border-slate-700/80 bg-[#0c1322] px-4 py-3 pr-12 text-sm text-white placeholder-slate-500 focus:border-[#10e2f7] focus:outline-none focus:ring-2 focus:ring-[#10e2f7]/25 transition"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                  cm
                </span>
              </div>
            </div>
          </div>

          {/* Fila 2: Mano dominante y Posición en cancha */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            <div className="md:col-span-5 space-y-2">
              <span className="block text-sm font-semibold text-slate-200">
                Mano dominante
              </span>
              <div className="grid grid-cols-2 gap-3">
                {MANOS.map((mano) => {
                  const activa = form.mano_dominante === mano.id;
                  return (
                    <button
                      key={mano.id}
                      type="button"
                      onClick={() => actualizarCampo('mano_dominante', mano.id)}
                      className={`rounded-xl border px-4 py-3 text-left transition ${
                        activa
                          ? 'border-[#10e2f7] bg-[#10e2f7]/15 text-white shadow-sm shadow-[#10e2f7]/15'
                          : 'border-slate-700/80 bg-[#0c1322] text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <p className="text-sm font-bold">{mano.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {mano.helper}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-7 space-y-2">
              <label
                htmlFor="posicion"
                className="block text-sm font-semibold text-slate-200"
              >
                Posición en cancha
              </label>
              <select
                id="posicion"
                value={form.posicion}
                onChange={(e) => actualizarCampo('posicion', e.target.value)}
                className="w-full rounded-xl border border-slate-700/80 bg-[#0c1322] px-4 py-3 text-sm font-medium text-white focus:border-[#10e2f7] focus:outline-none focus:ring-2 focus:ring-[#10e2f7]/25 transition"
              >
                {POSICIONES.map((pos) => (
                  <option key={pos.id} value={pos.id}>
                    {pos.label} — {pos.tag}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400">
                La cámara priorizará ángulos y consejos clave para tu rol de {posicionLabel.toLowerCase()}.
              </p>
            </div>
          </div>

          {/* Fila 3: Nivel */}
          <div className="space-y-2.5">
            <span className="block text-sm font-semibold text-slate-200">
              Nivel actual
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {NIVELES.map((niv) => {
                const activo = form.nivel === niv.id;
                return (
                  <button
                    key={niv.id}
                    type="button"
                    onClick={() => actualizarCampo('nivel', niv.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      activo
                        ? 'border-[#10e2f7] bg-[#10e2f7]/12 text-white shadow-sm shadow-[#10e2f7]/15'
                        : 'border-slate-700/80 bg-[#0c1322] text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{niv.label}</span>
                      {activo && (
                        <span className="h-2.5 w-2.5 rounded-full bg-[#10e2f7]" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {niv.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer de acciones */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-slate-800 pt-5">
            <p className="text-xs text-slate-400">
              ¿Listo para probar tus datos en la cancha? Después de guardar puedes iniciar un análisis en vivo.
            </p>

            <button
              type="submit"
              disabled={guardando}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#10e2f7] px-7 py-3 text-sm font-bold text-[#04101d] shadow-lg shadow-[#10e2f7]/25 hover:bg-[#38eafc] active:scale-[0.99] transition disabled:opacity-60 cursor-pointer shrink-0"
            >
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
