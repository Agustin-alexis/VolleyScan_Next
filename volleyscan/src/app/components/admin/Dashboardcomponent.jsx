'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Logo from "@/app/public/img/Logo.VS.jpg"
import image from '@/app/public/img/image.jpg'

import './style.css'

/* ── DATOS ── */

const NAV = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'tecnologia', label: 'Tecnología' },
  { id: 'metricas', label: 'Métricas' },
  { id: 'planes', label: 'Planes' },
]

const STATS = [
  { value: 38, suffix: '%+', label: 'Mejora promedio', color: 'gold' },
  { value: 120, suffix: '+', label: 'Atletas analizados', color: 'cyan' },
  { value: 95, suffix: '%', label: 'Satisfacción', color: 'gold' },
  { value: 10000, suffix: '+', label: 'Sesiones procesadas', color: 'cyan' },
]

const TECH = [
  {
    id: 'esqueleto',
    title: 'Mapeo esquelético avanzado',
    desc: 'Rastreo en tiempo real de 33 puntos articulares.',
  },
  {
    id: 'comparacion',
    title: 'Comparación profesional',
    desc: 'Compara métricas con atletas profesionales.',
  },
  {
    id: 'feedback',
    title: 'Retroalimentación estratégica',
    desc: 'Consejos personalizados generados por IA.',
  },
  {
    id: 'tiempo',
    title: 'Análisis en tiempo real',
    desc: 'Procesamiento instantáneo de video.',
  },
]

const PLANS = [
  {
    name: 'Novato',
    featured: false,
    desc: 'Perfecto para comenzar.',
    price: 'Gratis',
    priceSuffix: '',
    features: ['5 análisis por mes', 'Detección básica', 'Historial', 'Soporte'],
    btn: 'Comenzar Gratis',
    btnClass: 'vs-btn-plan vs-outline',
  },
  {
    name: 'Atleta Profesional',
    featured: true,
    desc: 'Para atletas serios.',
    price: '$19.99',
    priceSuffix: '/ mes',
    features: [
      'Análisis ilimitados',
      'IA avanzada',
      'Comparación con pros',
      'Retroalimentación personalizada',
    ],
    btn: 'Elegir Plan',
    btnClass: 'vs-btn-plan vs-gold-btn',
  },
  {
    name: 'Club',
    featured: false,
    desc: 'Ideal para equipos.',
    price: '$49.99',
    priceSuffix: '/ mes',
    features: ['Hasta 30 atletas', 'Panel entrenador', 'Estadísticas', 'Soporte dedicado'],
    btn: 'Contactar',
    btnClass: 'vs-btn-plan vs-outline vs-cyan',
  },
]

const TICKER = [
  'Biomecánica',
  '33 puntos articulares',
  'Tiempo real',
  'Corrección de gestos',
  'Historial de sesiones',
  'Panel de entrenador',
  'Análisis de remate',
]

const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/* ── ICONOS ── */

function Icono({ name }) {
  const props = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }
  if (name === 'esqueleto')
    return (
      <svg {...props}>
        <circle cx="12" cy="4.5" r="2" />
        <path d="M12 7v6M12 9l-4 3M12 9l4 3M12 13l-3 7M12 13l3 7" />
      </svg>
    )
  if (name === 'comparacion')
    return (
      <svg {...props}>
        <path d="M5 20V10M12 20V4M19 20v-7" />
      </svg>
    )
  if (name === 'feedback')
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3.5" />
      </svg>
    )
  return (
    <svg {...props}>
      <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
    </svg>
  )
}

/* ── VIZ ── */

function VisualEsqueleto() {
  const joints = [
    [100, 22], [100, 44], [76, 54], [124, 54], [64, 80], [136, 76],
    [100, 78], [88, 104], [112, 104], [82, 134], [118, 134],
  ]
  return (
    <svg className="vs-viz" viewBox="0 0 200 150" role="img" aria-label="Esqueleto con articulaciones detectadas">
      <g className="vs-viz-bones">
        <path d="M100 30v48M100 46L76 54L64 80M100 46l24 8 12 22M100 78l-12 26 -6 30M100 78l12 26 6 30" />
      </g>
      {joints.map(([x, y], i) => (
        <circle key={i} className="vs-joint" cx={x} cy={y} r="3" />
      ))}
      <circle cx="100" cy="16" r="7" className="vs-viz-head" />
    </svg>
  )
}

function VisualComparacion() {
  return (
    <div className="vs-viz vs-bars" role="img" aria-label="Comparación entre tu medida y la referencia">
      {[
        ['Codo', 82, 94],
        ['Salto', 64, 88],
        ['Caída', 76, 85],
      ].map(([label, tu, ref]) => (
        <div key={label} className="vs-bar-row">
          <span>{label}</span>
          <div className="vs-bar-track">
            <i className="vs-bar-ref" style={{ width: `${ref}%` }} />
            <i className="vs-bar-you" style={{ width: `${tu}%` }} />
          </div>
        </div>
      ))}
      <p className="vs-bar-legend">
        <span className="vs-dot vs-dot-you" /> Tú
        <span className="vs-dot vs-dot-ref" /> Referencia
      </p>
    </div>
  )
}

function VisualFeedback() {
  return (
    <div className="vs-viz vs-chat" role="img" aria-label="Ejemplo de consejo de la IA">
      <p className="vs-bubble">Estira por completo el brazo en el golpeo: pega arriba, con el codo extendido.</p>
      <p className="vs-bubble vs-bubble-2">Carga las rodillas hasta unos 110° antes de saltar.</p>
    </div>
  )
}

function VisualTiempo() {
  return (
    <div className="vs-viz vs-meter" role="img" aria-label="Medición continua">
      <div className="vs-eq" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <i key={i} style={{ height: `${40 + (i * 15) % 60}%` }} />
        ))}
      </div>
      <p className="vs-meter-read">
        hasta <strong>60</strong> fps
      </p>
    </div>
  )
}

const VISUALES = {
  esqueleto: VisualEsqueleto,
  comparacion: VisualComparacion,
  feedback: VisualFeedback,
  tiempo: VisualTiempo,
}

export default function Home() {
  const countersRef = useRef([])
  const progressRef = useRef(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [activo, setActivo] = useState('inicio')

  /* ── Barra de progreso ── */
  useEffect(() => {
    let raf = 0
    function pintar() {
      raf = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${p})`
    }
    function onScroll() {
      if (!raf) raf = requestAnimationFrame(pintar)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    pintar()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  /* ── Sección activa ── */
  useEffect(() => {
    const secciones = NAV.map((n) => document.getElementById(n.id)).filter(Boolean)
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActivo(e.target.id)
        })
      },
      { rootMargin: '-40% 0px -55% 0px' },
    )
    secciones.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [])

  /* ── Contadores ── */
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          io.unobserve(entry.target)
          const el = entry.target
          const { value, suffix } = STATS[Number(el.dataset.i)]
          const t0 = performance.now()
          const dur = 1200
          const tick = (now) => {
            const p = Math.min(1, (now - t0) / dur)
            const eased = 1 - Math.pow(1 - p, 3)
            el.textContent = miles(Math.round(value * eased)) + suffix
            if (p < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        })
      },
      { threshold: 0.6 },
    )
    countersRef.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div className="dashboard-page-container">
      {/* FONDO */}
      <div className="vs-bg" aria-hidden="true">
        <span className="vs-grid" />
        <span className="vs-aurora vs-aurora-a" />
        <span className="vs-aurora vs-aurora-b" />
      </div>

      <span className="vs-progress" ref={progressRef} aria-hidden="true" />

      {/* NAVBAR */}
      <header className="vs-topbar">
        <nav className="vs-navigation" aria-label="Principal">
          <Link href="/" className="vs-brand">
            <Image src={Logo} alt="Logo" className="vs-logo" width={32} height={32} />
            VolleyScan <span>AI</span>
          </Link>

          <ul className="vs-menu" data-open={menuOpen}>
            {NAV.map((n) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}`}
                  aria-current={activo === n.id ? 'true' : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {n.label}
                </a>
              </li>
            ))}
            <li className="vs-menu-mobile">
              <a href="#planes" onClick={() => setMenuOpen(false)}>
                Ver Planes
              </a>
            </li>
          </ul>

          <div className="vs-nav-actions">
            <a className="vs-btn-outline" href="#planes">
              Ver Planes
            </a>
            <Link className="vs-btn-nav-login" href="/login">
              Iniciar sesión
            </Link>
            <button
              type="button"
              className="vs-burger"
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span />
              <span />
            </button>
          </div>
        </nav>
      </header>

      <main>
        {/* HERO */}
        <section className="vs-hero" id="inicio">
          <article className="vs-hero-text">
            <h1>
              <span className="vs-line vs-line-1">Transforma tu rendimiento</span>
              <span className="vs-line vs-line-2 vs-grad">
                en el voleibol con IA
              </span>
            </h1>

            <p className="vs-hero-lead">
              Detecta errores técnicos, analiza movimientos y mejora el rendimiento deportivo con precisión profesional.
            </p>

            <div className="vs-hero-actions">
              <Link className="vs-btn-primary" href="/registro">
                Crear Cuenta Gratis
              </Link>
              
            </div>

            <ul className="vs-hero-facts">
              <li>
                <strong>33</strong> puntos articulares
              </li>
              <li>
                <strong>3D</strong> ángulos en vivo
              </li>
              <li>
                <strong>0</strong> videos subidos
              </li>
            </ul>
          </article>

          <div className="vs-stage">
            <div className="vs-feed">
              <Image
                className="vs-feed-img"
                src={image}
                alt="Atleta"
                width={460}
                height={575}
                priority
              />

              <span className="vs-corner vs-tl" aria-hidden="true" />
              <span className="vs-corner vs-tr" aria-hidden="true" />
              <span className="vs-corner vs-bl" aria-hidden="true" />
              <span className="vs-corner vs-br" aria-hidden="true" />

              
            </div>
            <p className="vs-demo-note">Vista ilustrativa del análisis</p>
          </div>
        </section>

        {/* CINTA */}
        <div className="vs-ticker" aria-hidden="true">
          <div className="vs-ticker-track">
            {[...TICKER, ...TICKER].map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
        </div>

        {/* TECNOLOGÍA */}
        <section className="vs-section vs-tech" id="tecnologia">
          <header className="vs-section-head">
            <h2>Tecnología de alto rendimiento</h2>
            <p>Inteligencia artificial aplicada al análisis biomecánico.</p>
          </header>

          <div className="vs-bento">
            {TECH.map((item) => {
              const Visual = VISUALES[item.id]
              return (
                <article key={item.id} className={`vs-tile vs-tile-${item.id}`}>
                  <div className="vs-tile-copy">
                    <span className="vs-icon">
                      <Icono name={item.id} />
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.desc}</p>
                  </div>
                  <Visual />
                </article>
              )
            })}
          </div>
        </section>

        {/* RESULTADOS */}
        <section className="vs-section vs-results" id="metricas">
          <header className="vs-section-head">
            <h2>Resultados que hablan</h2>
            <p>Mejoras significativas en atletas profesionales.</p>
          </header>

          <div className="vs-readout">
            {STATS.map((stat, i) => (
              <article key={stat.label} className={`vs-stat vs-${stat.color}`}>
                <h3
                  ref={(el) => (countersRef.current[i] = el)}
                  data-i={i}
                >
                  {miles(stat.value)}
                  {stat.suffix}
                </h3>
                <p>{stat.label}</p>
              </article>
            ))}
          </div>
        </section>

        {/* PLANES */}
        <section className="vs-section vs-pricing" id="planes">
          <header className="vs-section-head">
            <h2>Elige tu plan</h2>
            <p>Planes diseñados para atletas individuales y clubes.</p>
          </header>

          <div className="vs-pricing-grid">
            {PLANS.map((plan) => (
              <article
                key={plan.name}
                className={`vs-plan ${plan.featured ? 'vs-featured' : ''}`}
              >
                {plan.featured && <span className="vs-plan-badge">Más popular</span>}

                <h3>{plan.name}</h3>
                <p className="vs-plan-desc">{plan.desc}</p>

                <div className="vs-price">
                  {plan.featured ? <span className="vs-price-gold">{plan.price}</span> : plan.price}
                  <small>{plan.priceSuffix}</small>
                </div>

                <ul>
                  {plan.features.map((f) => (
                    <li key={f}>
                      <span className="vs-check" aria-hidden="true">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href="/registro" className={plan.btnClass}>
                  {plan.btn}
                </Link>
              </article>
            ))}
          </div>
        </section>

        
      </main>

      {/* FOOTER */}
      <footer className="vs-footer">
        <section className="vs-footer-brand">
          <div>
            <h3>VolleyScan AI</h3>
            <p>Plataforma de análisis deportivo con inteligencia artificial.</p>
          </div>

<<<<<<< Updated upstream
      <footer className="footer">

        <section className="footer-brand">

          <h3>VolleyScan AI</h3>

          <p>
            Plataforma de análisis deportivo
            con inteligencia artificial.
          </p>
          <nav className="socials">

            <a href="https://mail.google.com/mail/?view=cm&fs=1&to=volleyscan@gmail.com&su=Contacto%20desde%20la%20web" target="_blank" rel="noopener noreferrer" aria-label="Gmail">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
=======
          <nav className="vs-socials" aria-label="Redes sociales">
            <a
              href="https://mail.google.com/mail/?view=cm&fs=1&to=volleyscan@gmail.com&su=Contacto%20desde%20la%20web"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Gmail"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
>>>>>>> Stashed changes
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M2 6l10 7 10-7" />
              </svg>
            </a>
<<<<<<< Updated upstream
            <a href="https://www.instagram.com/volleyscan/" target="_blank" aria-label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
=======
            <a
              href="https://www.instagram.com/volleyscan/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
>>>>>>> Stashed changes
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>
<<<<<<< Updated upstream


            <a href="https://web.facebook.com/profile.php?id=61592345852679" target="_blank" aria-label="Facebook">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
=======
            <a
              href="https://web.facebook.com/profile.php?id=61592345852679"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
>>>>>>> Stashed changes
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
          </nav>
        </section>
      </footer>
    </div>
  )
}