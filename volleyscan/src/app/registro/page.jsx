'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Logo from "@/app/public/img/Logo.VS.jpg"
import facebook from "@/app/public/img/facebook.jpg"
import google from "@/app/public/img/google.jpg"
import Image from 'next/image'
import "./registro.css"
function IconoEntrenador() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" aria-hidden="true">
      <circle cx="11" cy="7.5" r="4" />
      <path d="M3 21c0-4.4 3.6-8 8-8 1.3 0 2.5.3 3.6.9A5 5 0 0 0 13 18c0 1.1.4 2.2 1 3H3z" />
      <circle cx="18" cy="18" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16.5 18l1.1 1.1 2-2.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconoUsuario() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="8" r="4.5" />
      <path d="M3.5 21c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.5z" />
    </svg>
  )
}

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

export default function page() {
  const navigate = useRouter()
  const [form, setForm] = useState({
    rol: 'entrenador',
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
  function handleRol(rol) {
    setForm(prev => ({ ...prev, rol }))
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
    } else if (form.password.length < 6) {
      errs.password = 'Mínimo 6 caracteres.'
    }
    return errs
  }

  /* ── Submit ── */
  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setLoading(true)

    setTimeout(() => {
      setLoading(false)
      // Guardar datos básicos de sesión
      sessionStorage.setItem('vs_nombre', `${form.nombre} ${form.apellido}`)
      sessionStorage.setItem('vs_rol', form.rol)
      showToast(`✓ ¡Bienvenido/a, ${form.nombre}! Redirigiendo…`, 'success')
      setTimeout(() => navigate.push(form.rol === 'entrenador' ? '/panel_entrenador' : '/usuario'), 1500)
    }, 1200)
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

            {/* Selector de rol */}
            <fieldset className="selector-rol">
              <legend>¿Cómo vas a ingresar?</legend>

              <div className="opciones-rol">
                <label className={`opcion-rol ${form.rol === 'entrenador' ? 'activa' : ''}`}>
                  <input
                    type="radio"
                    name="rol"
                    value="entrenador"
                    checked={form.rol === 'entrenador'}
                    onChange={() => handleRol('entrenador')}
                  />
                  <span className="radio-custom" />
                  <IconoEntrenador />
                  <span className="texto-rol">Entrenador</span>
                </label>

                <label className={`opcion-rol ${form.rol === 'usuario' ? 'activa' : ''}`}>
                  <input
                    type="radio"
                    name="rol"
                    value="usuario"
                    checked={form.rol === 'usuario'}
                    onChange={() => handleRol('usuario')}
                  />
                  <span className="radio-custom" />
                  <IconoUsuario />
                  <span className="texto-rol">Usuario</span>
                </label>
              </div>
            </fieldset>


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
                  minLength={6}
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
            <button type="submit" className="boton-principal">
              Completar registro
            </button>
          </form>



          {/* Redireccion */}
          <div className="redireccion-inicio">
            <p>¿Ya tienes cuenta? <Link className="enlace-primario" href="/login">Inicia sesión aquí</Link></p>
          </div>

          {/* Separador */}
          <div className="separador"><span>O REGÍSTRATE CON</span></div>

          {/* Social */}
          <div className="botones-sociales">
            <button type="button" className="boton-social google" onClick={() => handleSocial('Google')}>
              <Image src={google} alt="Google" /> Google
            </button>
            <button type="button" className="boton-social apple" onClick={() => handleSocial('Facebook')}>
              <Image src={facebook} alt="Facebook" /> Facebook
            </button>
          </div>

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