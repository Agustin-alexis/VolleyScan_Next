'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Logo from "@/app/public/img/Logo.VS.jpg"
import facebook from "@/app/public/img/facebook.jpg"
import google from "@/app/public/img/google.jpg"
import Image from 'next/image'
import { registrarAtleta } from '@/app/services/panelApi'
import "./registro.css"
import BotonGoogle from '../components/BotonGoogle'

function IconoOjo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconoOjoTachado() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.9 10.9 0 0 1 12 19c-7 0-11-7-11-7a19.8 19.8 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A10.9 10.9 0 0 1 12 4c7 0 11 8 11 8a19.5 19.5 0 0 1-3.17 4.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

// Campos del formulario que el servidor puede marcar con error
const CAMPOS = ['nombre', 'apellido', 'email', 'password']

// Convierte la respuesta de error del servidor en { campo: 'mensaje' }
function erroresDelServidor(datos) {
  const errs = {}
  if (datos && typeof datos === 'object') {
    for (const campo of CAMPOS) {
      const valor = datos[campo]
      if (valor) errs[campo] = Array.isArray(valor) ? valor[0] : String(valor)
    }
  }
  return errs
}

export default function RegistroPage() {
  const navigate = useRouter()
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
  })

  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  /* ── Toast ── */
  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  /* ── Actualizar campo ── */
  function handleChange(e) {
    const { id, value } = e.target
    setForm(prev => ({ ...prev, [id]: value }))
    setErrors(prev => ({ ...prev, [id]: '' }))
  }

  /* ── Validación ── */
  function validate() {
    const errs = {}
    if (!form.nombre.trim()) errs.nombre = 'El nombre es obligatorio.'
    if (!form.apellido.trim()) errs.apellido = 'El apellido es obligatorio.'
    if (!form.email.trim()) {
      errs.email = 'El correo es obligatorio.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Introduce un correo válido.'
    }
    if (!form.password) {
      errs.password = 'La contraseña es obligatoria.'
    } else if (form.password.length < 8) {
      errs.password = 'Mínimo 8 caracteres.'
    }
    return errs
  }

  /* ── Submit ── */
  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setLoading(true)
    setErrors({})

    try {
      // Registro real: el servidor crea siempre un ATLETA y deja la sesión iniciada
      const usuario = await registrarAtleta({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      showToast(`✓ ¡Bienvenido/a, ${usuario.nombre}! Redirigiendo…`, 'success')
      setTimeout(() => navigate.push('/usuario'), 1500)
    } catch (error) {
      if (error.status === 400 || error.status === 409) {
        setErrors(erroresDelServidor(error.datos))
        showToast('Revisa los datos del formulario.', 'error')
      } else if (error.status === 429) {
        showToast('Demasiados intentos. Inténtalo de nuevo más tarde.', 'error')
      } else {
        showToast('No se pudo conectar con el servidor. Inténtalo más tarde.', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleSocial(provider) {

    if (provider === 'Google') {
      window.location.href = 'https://accounts.google.com/';
    }

    if (provider === 'Facebook') {
      window.location.href = 'https://www.facebook.com/';
    }

  }
  const toastColors = { success: '#22c55e', error: '#ef4444', info: '#3b82f6' }

  return (
    <main className="pantalla-dividida">

      {/* ── Panel izquierdo: formulario ── */}
      <section className="panel-izquierdo">
        <article className="contenedor-registro" aria-labelledby="tituloRegistro">

          <header className="encabezado-registro">
            <div className="contenedor-logo">
              <Link href='/'>
                <Image src={Logo} alt="Logo" className='img' width={50} />
              </Link>
              <h2>VolleyScan</h2>
            </div>
            <h1 id="tituloRegistro">Crear ID de atleta</h1>
            <p className="subtitulo">Únete para analizar y mejorar tu técnica</p>
          </header>

          <form className="formulario-registro" onSubmit={handleSubmit} noValidate>

            {/* Nombre + Apellido */}
            <div className="fila-formulario">
              <div className="grupo-input">
                <label htmlFor="nombre">Nombre</label>
                <input
                  type="text" id="nombre"
                  placeholder="Tu nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  className={errors.nombre ? 'input-error' : ''}
                  maxLength={100}
                />
                {errors.nombre && <p className="field-error-msg">{errors.nombre}</p>}
              </div>

              <div className="grupo-input">
                <label htmlFor="apellido">Apellido</label>
                <input
                  type="text" id="apellido"
                  placeholder="Tu apellido"
                  value={form.apellido}
                  onChange={handleChange}
                  className={errors.apellido ? 'input-error' : ''}
                  maxLength={100}
                />
                {errors.apellido && <p className="field-error-msg">{errors.apellido}</p>}
              </div>
            </div>

            {/* Email */}
            <div className="grupo-input">
              <label htmlFor="email">Correo electrónico</label>
              <input
                type="email" id="email"
                placeholder="tuemail@ejemplo.com"
                value={form.email}
                onChange={handleChange}
                className={errors.email ? 'input-error' : ''}
                autoComplete="email"
                maxLength={150}
              />
              {errors.email && <p className="field-error-msg">{errors.email}</p>}
            </div>

            {/* Contraseña */}
            <div className="grupo-input">
              <label htmlFor="password">Contraseña</label>
              <div className="input-password">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  className={errors.password ? 'input-error' : ''}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                />
                <button
                  type="button"
                  className="boton-ojo"
                  onClick={() => setShowPassword(prev => !prev)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <IconoOjoTachado /> : <IconoOjo />}
                </button>
              </div>
              {errors.password && <p className="field-error-msg">{errors.password}</p>}
            </div>
            <button type="submit" className="boton-principal" disabled={loading}>
              {loading ? 'Creando cuenta…' : 'Completar registro'}
            </button>
          </form>

          <p className="subtitulo">¿Eres entrenador? Solicita tu cuenta al administrador.</p>

          {/* Redireccion */}
          <div className="redireccion-inicio">
            <p>¿Ya tienes cuenta? <Link className="enlace-primario" href="/login">Inicia sesión aquí</Link></p>
          </div>

          {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
            <>
              <div className="separador"><span>O REGÍSTRATE CON</span></div>

              <div className="social-buttons">
                <BotonGoogle onError={(m) => showToast(m, 'error')} />
              </div>
            </>
          )}

        </article>
      </section>

      {/* ── Panel derecho: imagen ── */}
      <aside className="panel-derecho" aria-hidden="true" />

      {/* Toast */}
      {toast && (
        <div className="toast" role="status" aria-live="polite"
          style={{ borderColor: toastColors[toast.type] }}>
          {toast.message}
        </div>
      )}

    </main>
  )
}