'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Logo from "@/app/public/img/Logo.VS.jpg"
import facebook from "@/app/public/img/facebook.jpg"
import google from "@/app/public/img/google.jpg"
import Image from 'next/image'

import "./registro.css"

export default function page() {
  const navigate = useRouter()
  const [form, setForm] = useState({
    nombre:   '',
    apellido: '',
    email:    '',
    password: '',
  })

  const [errors,  setErrors]  = useState({})
  const [loading, setLoading] = useState(false)
  const [toast,   setToast]   = useState(null)

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
    if (!form.nombre.trim())   errs.nombre   = 'El nombre es obligatorio.'
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
      sessionStorage.setItem('vs_rol',    'atleta')
      showToast(`✓ ¡Bienvenido/a, ${form.nombre}! Redirigiendo…`, 'success')
      setTimeout(() => navigate('/usuario'), 1500)
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
              <Image src={Logo} alt="Logo"  width={50} />
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
              <input
                type="password" id="password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                className={errors.password ? 'input-error' : ''}
                autoComplete="new-password"
                minLength={6}
              />
              {errors.password && <p className="field-error-msg">{errors.password}</p>}
            </div>

            <button type="submit" className="boton-principal" disabled={loading}>
              {loading ? 'Registrando…' : 'Completar registro'}
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
              <Image  src={google} alt="Google" /> Google
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