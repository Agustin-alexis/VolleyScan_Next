'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from  "@/app/public/img/Logo.VS.jpg"
import Image from 'next/image'
import './recuperacio.css'


export default function page() {
  const [email,   setEmail]   = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [toast,   setToast]   = useState(null)

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!email) {
      setError('El correo es obligatorio.')
      return
    }
    if (!isValidEmail(email)) {
      setError('Introduce un correo válido.')
      return
    }

    setLoading(true)

    // Simula envío del enlace
    setTimeout(() => {
      setLoading(false)
      setSent(true)
      showToast('✓ Enlace enviado. Revisa tu correo.', 'success')
    }, 1200)
  }

  const toastColors = { success: '#22c55e', error: '#ef4444', info: '#3b82f6' }

  return (
    <div className="recover-page">

      {/* Header */}
      <header className="login-header">
        <div className="logo">
          <Link href="/">
            <Image src={Logo} alt="Logo" className='img' width={50} />
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
            /* Estado: enlace enviado */
            <div className="sent-state">
              <div className="sent-state__icon" aria-hidden="true">
                <i className="fa-solid fa-envelope-circle-check" />
              </div>
              <h1 className="sent-state__title">¡Correo enviado!</h1>
              <p className="sent-state__msg">
                Hemos enviado un enlace de recuperación a <strong>{email}</strong>.
                Revisa tu bandeja de entrada y sigue las instrucciones.
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
              <a href="../login">¿Recordaste tu contraseña?</a>
          
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