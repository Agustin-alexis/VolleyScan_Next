'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Logo from "@/app/public/img/Logo.VS.jpg"

import { api, guardarSesion, ApiError } from '@/lib/api'

import { iniciarSesion, ErrorApi } from '@/app/services/panelApi'
import './page.css'
import BotonGoogle from '../components/BotonGoogle'


// A dónde va cada rol después de iniciar sesión
const DESTINO_POR_ROL = {
  atleta: '/usuario',
  entrenador: '/panel_entrenador',
  admin: '/admin',
  administrador: '/admin',
}

// Si llegaste desde una invitación por correo, al iniciar sesión volvemos a ella.
// Solo se aceptan rutas /invitacion/<token> (evita redirecciones a sitios externos).
function destinoDeInvitacion() {
  if (typeof window === 'undefined') return null
  const next = new URLSearchParams(window.location.search).get('next')
  return next && /^\/(invitacion\/[A-Za-z0-9_-]{20,100}|(panel_entrenador|usuario)(\/[A-Za-z0-9_\-\/]*)?)$/.test(next) ? next : null
}

const IconEye = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
    viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const IconEyeOff = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
    viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [toast, setToast] = useState(null)
  const [siguiente, setSiguiente] = useState(null) // invitación a la que volver (se lee en el navegador)
  useEffect(() => { setSiguiente(destinoDeInvitacion()) }, [])

  // Si ya hay una sesión válida (token sin vencer), no tiene sentido ver el login: vamos a tu panel.
  useEffect(() => {
    try {
      const token = localStorage.getItem('vs_token')
      const usuario = JSON.parse(localStorage.getItem('vs_usuario') || 'null')
      if (!token || !usuario?.rol) return
      const carga = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (carga.exp && carga.exp * 1000 <= Date.now()) return   // vencido: se queda en el login
      router.replace(destinoDeInvitacion() ?? DESTINO_POR_ROL[usuario.rol] ?? '/usuario')
    } catch { /* localStorage bloqueado o token ilegible: se queda en el login */ }
  }, [router])

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  function validate() {
    const errs = {}
    if (!email) {
      errs.email = 'El correo es obligatorio.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Introduce un correo válido.'
    }
    if (!password) {
      errs.password = 'La contraseña es obligatoria.'
    } else if (password.length < 6) {
      errs.password = 'Mínimo 6 caracteres.'
    }
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setLoading(true)
    setErrors({})
    try {
      const usuario = await iniciarSesion(email.trim(), password) // guarda la sesión
      showToast(`✓ Bienvenido/a, ${usuario?.nombre ?? ''}. Redirigiendo…`, 'success')

      // Usa tu constante DESTINO_POR_ROL (redirige a '/admin', '/panel_entrenador' o '/usuario')
      const rol = String(usuario?.rol ?? '').trim().toLowerCase()
      const destino = destinoDeInvitacion() ?? DESTINO_POR_ROL[rol] ?? '/usuario'
      setTimeout(() => router.replace(destino), 600)
    } catch (err) {
      // Queda en la consola del navegador (F12) para poder ver la causa real
      console.error('Login falló:', err?.status, err?.datos ?? err?.data ?? err)

      if (!(err instanceof ErrorApi) || err.status === 0) {
        // El navegador no llegó al servidor (apagado, otra dirección o bloqueo CORS)
        showToast('No se pudo conectar con el servidor. Revisa que esté encendido y que acepte este origen (CORS).', 'error')
      } else if (err.status === 429) {
        showToast('Demasiados intentos. Espera un minuto.', 'error')
      } else if (err.status === 400 || err.status === 401 || err.status === 403) {
        // Solo estos códigos significan "credenciales incorrectas"
        setErrors({
          email: 'Correo o contraseña incorrectos.',
          password: 'Correo o contraseña incorrectos.',
        })
        showToast('Credenciales incorrectas. Inténtalo de nuevo.', 'error')
        setPassword('')
      } else {
        // 404 (ruta que no existe), 500 (falla del servidor)… ya no se disfrazan de "contraseña mal"
        showToast(`Error del servidor (código ${err.status}). Inténtalo más tarde.`, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const toastColors = { success: '#22c55e', error: '#ef4444', info: '#3b82f6' }

  return (
    <div className="login-page">

      <header className="login-header">
        <div className="logo">
          <Link href="/">
            <Image src={Logo} alt="Logo" className='img' width={50} />
          </Link>
          <h2>VolleyScan</h2>
        </div>
      </header>

      <main>
        <section className="login-container" aria-labelledby="tituloLogin">

          <h1 id="tituloLogin">Bienvenido</h1>
          <p className="subtitle">Ingresa tus credenciales para continuar.</p>

          <form onSubmit={handleSubmit} noValidate>

            {/* Email */}
            <div className="form-group">
              <label htmlFor="email">Correo Electrónico</label>
              <input
                type="email" id="email"
                placeholder="usuario@volleyscan.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })) }}
                className={errors.email ? 'input-error' : ''}
                autoComplete="email"
              />
              {errors.email && <p className="field-error-msg">{errors.email}</p>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <div className={`password-container${errors.password ? ' has-error' : ''}`}>
                <input
                  type={showPass ? 'text' : 'password'}
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })) }}
                  className={errors.password ? 'input-error' : ''}
                  autoComplete="current-password"
                  minLength={6}
                />
                <button
                  type="button"
                  className="toggle-pass"
                  onClick={() => setShowPass(p => !p)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPass ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
              {errors.password && <p className="field-error-msg">{errors.password}</p>}
            </div>

            {/* Opciones */}
            <div className="options">
              <label className="remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                />
                Recordarme
              </label>
              <Link href="/recuperacion" className="forgot-password">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? 'VERIFICANDO…' : 'INGRESAR AHORA →'}
            </button>

          </form>

          {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
            <>
              <div className="divider"><span>O CONTINÚA CON</span></div>

              <div className="social-buttons ">
                <BotonGoogle onError={(m) => showToast(m, 'error')} />
              </div>
            </>
          )}

          <footer className="register">
            <p>¿Aún no tienes cuenta?
              <Link href={siguiente ? `/registro?next=${encodeURIComponent(siguiente)}` : '/registro'}>¡Regístrate Gratis!</Link></p>
          </footer>

        </section>
      </main>

      {/* Toast */}
      {toast && (
        <div className="toast" role="status" aria-live="polite"
          style={{ borderColor: toastColors[toast.type] }}>
          {toast.message}
        </div>
      )}

    </div>
  )
}