'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Logo from '@/app/public/img/Logo.VS.jpg'
import './restablecer.css'
import { FaCircleCheck, FaLinkSlash } from 'react-icons/fa6'

const API = process.env.NEXT_PUBLIC_API_URL

export default function RestablecerPage() {
    const router = useRouter()

    const [token, setToken] = useState('')
    const [ready, setReady] = useState(false)
    const [tokenRejected, setTokenRejected] = useState(false)
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [done, setDone] = useState(false)

    // El enlace del correo trae el token en el hash: /restablecer#token=...
    // Se lee una vez y se borra de la barra de direcciones.
    useEffect(() => {
        const t = new URLSearchParams(window.location.hash.slice(1)).get('token')
        if (t) {
            setToken(t)
            window.history.replaceState(null, '', window.location.pathname)
        }
        setReady(true)
    }, [])

    const linkInvalid = ready && (!token || tokenRejected)

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')

        if (password.length < 8) {
            setError('La contraseña debe tener al menos 8 caracteres.')
            return
        }
        if (password !== confirm) {
            setError('Las contraseñas no coinciden.')
            return
        }

        setLoading(true)
        try {
            const res = await fetch(`${API}/auth/restablecer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password_nueva: password }),
            })
            const data = await res.json().catch(() => ({}))

            if (res.ok) {
                setDone(true)
                return
            }
            if (res.status === 429) {
                setError('Demasiados intentos. Espera un momento e inténtalo de nuevo.')
                return
            }
            if (data.password_nueva) {
                setError(data.password_nueva[0])
                return
            }
            if (res.status === 400 && data.detail) {
                setTokenRejected(true)
                return
            }
            setError('No pudimos cambiar la contraseña. Inténtalo de nuevo.')
        } catch {
            setError('No hay conexión con el servidor.')
        } finally {
            setLoading(false)
        }
    }

    if (!ready) return null

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
                <section className="login-container" aria-labelledby="tituloRestablecer">

                    {linkInvalid ? (
                        /* Estado: enlace inválido o vencido */
                        <div className="sent-state">
                            <div className="sent-state__icon" aria-hidden="true">
                                <FaLinkSlash className="fa-solid fa-link-slash" />
                            </div>
                            <h1 id="tituloRestablecer" className="sent-state__title">Enlace no válido</h1>
                            <p className="sent-state__msg">
                                El enlace venció o ya se usó. Pide uno nuevo para continuar.
                            </p>
                            <button
                                className="btn-login"
                                type="button"
                                onClick={() => router.push('/recuperar')}
                            >
                                Pedir otro enlace
                            </button>
                        </div>
                    ) : done ? (
                        /* Estado: contraseña cambiada */
                        <div className="sent-state">
                            <div className="sent-state__icon" aria-hidden="true">
                                <FaCircleCheck className="fa-solid" />
                            </div>
                            <h1 id="tituloRestablecer" className="sent-state__title">¡Contraseña actualizada!</h1>
                            <p className="sent-state__msg">Ya puedes iniciar sesión con tu nueva contraseña.</p>
                            <button
                                className="btn-login"
                                type="button"
                                onClick={() => router.push('/login')}
                            >
                                Iniciar sesión
                            </button>
                        </div>
                    ) : (
                        <>
                            <h1 id="tituloRestablecer">Nueva contraseña</h1>
                            <p className="subtitle">Elige una contraseña de al menos 8 caracteres.</p>

                            <form onSubmit={handleSubmit} noValidate>
                                <div className="form-group">
                                    <label htmlFor="passwordNueva">Nueva contraseña</label>
                                    <input
                                        type="password"
                                        id="passwordNueva"
                                        value={password}
                                        onChange={e => { setPassword(e.target.value); setError('') }}
                                        className={error ? 'input-error' : ''}
                                        autoComplete="new-password"
                                        maxLength={72}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="passwordConfirmar">Confirmar contraseña</label>
                                    <input
                                        type="password"
                                        id="passwordConfirmar"
                                        value={confirm}
                                        onChange={e => { setConfirm(e.target.value); setError('') }}
                                        className={error ? 'input-error' : ''}
                                        autoComplete="new-password"
                                        maxLength={72}
                                    />
                                    {error && <p className="field-error-msg">{error}</p>}
                                </div>

                                <button type="submit" className="btn-login" disabled={loading}>
                                    {loading ? 'GUARDANDO…' : 'GUARDAR CONTRASEÑA'}
                                </button>
                            </form>
                        </>
                    )}

                    <footer className="register">
                        <p>
                            <Link href="/login">Volver a iniciar sesión</Link>
                        </p>
                    </footer>
                </section>
            </main>

        </div>
    )
}