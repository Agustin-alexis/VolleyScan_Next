'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Logo from "@/app/public/img/Logo.VS.jpg"

import { api, guardarSesion } from '@/lib/api'
import {
  iniciarSesionSupabase,
  iniciarConOAuthSupabase,
} from '@/lib/supabase'
import './page.css'
import BotonGoogle from '../components/BotonGoogle'

// A dónde va cada rol después de iniciar sesión
const DESTINO_POR_ROL = {
  atleta: '/usuario/analisis',
  entrenador: '/panel_entrenador/dashboard',
  admin: '/admin',
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

function LoginFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get('next')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [toast, setToast] = useState(null)

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
      // 1. Autenticación principal mediante Supabase Auth (genera JWT access_token)
      let resultado = null
      try {
        resultado = await iniciarSesionSupabase({
          email: email.trim(),
          password,
        })
      } catch (supaErr) {
        // 2. Respaldo opcional contra API secundaria si la cuenta proviene del backend local
        try {
          const dataApi = await api('/auth/login', {
            method: 'POST',
            body: { email: email.trim(), password },
          })
          guardarSesion(dataApi)
          resultado = dataApi
        } catch {
          throw supaErr
        }
      }

      const usuario = resultado.usuario
      showToast(`✓ Bienvenido/a, ${usuario.nombre}. Redirigiendo…`, 'success')

      const destino = nextUrl || DESTINO_POR_ROL[usuario.rol] || '/usuario/analisis'
      setTimeout(() => router.push(destino), 800)
    } catch {
      setErrors({
        email: 'Correo o contraseña incorrectos.',
        password: 'Correo o contraseña incorrectos.',
      })
      showToast('Credenciales incorrectas. Verifica tu correo y contraseña.', 'error')
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  async function handleSocial(provider) {
    try {
      await iniciarConOAuthSupabase(provider)
    } catch {
      showToast(`No se pudo iniciar con ${provider} en Supabase.`, 'error')
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
          <p className="subtitle">Ingresa con tu cuenta de Supabase para acceder al Visor 3D y Análisis IA.</p>

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
              {loading ? 'AUTENTICANDO EN SUPABASE…' : 'INGRESAR AHORA →'}
            </button>

          </form>

          <div className="divider"><span>O CONTINÚA CON</span></div>

          <div className="social-buttons">
            {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? (
              <BotonGoogle onError={(m) => showToast(m, 'error')} />
            ) : (
              <button
                type="button"
                className="btn-social"
                onClick={() => handleSocial('google')}
              >
                <span>Continuar con Google (Supabase OAuth)</span>
              </button>
            )}
          </div>

          <footer className="register">
            <p>¿Aún no tienes cuenta?
              <Link href="/registro">  ¡Regístrate Gratis!</Link></p>
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginFormContent />
    </Suspense>
  )
}
