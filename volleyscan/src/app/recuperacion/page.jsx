'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Logo from '@/app/public/img/Logo.VS.jpg'
import './recuperacio.css'
import { FaEnvelopeCircleCheck } from 'react-icons/fa6'

const API = process.env.NEXT_PUBLIC_API_URL

export default function RecuperarPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [toast, setToast] = useState(null)

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const correo = email.trim()
    if (!correo) {
      setError('El correo es obligatorio.')
      return
    }
    if (!isValidEmail(correo)) {
      setError('Introduce un correo válido.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/recuperar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: correo }),
      })

      if (res.status === 429) {
        setError('Demasiados intentos. Espera un momento e inténtalo de nuevo.')
        return
      }
      if (!res.ok) {
        setError('No pudimos procesar la solicitud. Inténtalo de nuevo.')
        return
      }

      setSent(true)
      showToast('✓ Solicitud enviada. Revisa tu correo.', 'success')
    } catch {
      setError('No hay conexión con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  const toastColors = { success: '#22c55e', error: '#ef4444', info: '#3b82f6' }

  return (
    <div className="recover-page">

      {/* Header */}
      <header className="login-header">
        <div className="logo">
          <Link href="/">
            <Image src={Logo} alt="Logo" className="img" width={50} />
          </Link>
          <h2>VolleyScan</h2>
        </div>
      </header>

      {/* Card */}
      <main>
        <section className="login-container" aria-labelledby="tituloRecuperar">

          {!sent ? (
            <>
              <h1 id="tituloRecuperar">Recuperar contraseña</h1>
              <p className="subtitle">
                Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
              </p>

              <form onSubmit={handleSubmit} noValidate>
                <div className="form-group">
                  <label htmlFor="emailRecover">Correo Electrónico</label>
                  <input
                    type="email"
                    id="emailRecover"
                    placeholder="usuario@volleyscan.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError('') }}
                    className={error ? 'input-error' : ''}
                    autoComplete="email"
                  />
                  {error && <p className="field-error-msg">{error}</p>}
                </div>

                <button type="submit" className="btn-login" disabled={loading}>
                  {loading ? 'ENVIANDO…' : 'ENVIAR ENLACE →'}
                </button>
              </form>
            </>
          ) : (
            /* Estado: solicitud enviada */
            <div className="sent-state">
              <div className="sent-state__icon" aria-hidden="true">
                <FaEnvelopeCircleCheck className="fa-solid fa-envelope-circle-check" />
              </div>
              <h1 className="sent-state__title">Revisa tu correo</h1>
              <p className="sent-state__msg">
                Si <strong>{email.trim()}</strong> está registrado, recibirás un enlace para
                restablecer tu contraseña. El enlace vale 30 minutos.
              </p>
              <button
                className="btn-login"
                type="button"
                onClick={() => { setSent(false); setEmail('') }}
              >
                Enviar de nuevo
              </button>
            </div>
          )}

          {/* Volver */}
          <footer className="register">
            <p>
              <Link href="/login">¿Recordaste tu contraseña?</Link>
            </p>
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