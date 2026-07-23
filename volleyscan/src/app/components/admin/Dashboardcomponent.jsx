'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Logo from  "@/app/public/img/Logo.VS.jpg"
import image from '@/app/public/img/image.jpg'


import './style.css'


/* ── DATOS ── */

const STATS = [
  { value: 38, suffix: '%+', label: 'Mejora Promedio', color: 'gold' },
  { value: 120, suffix: '+', label: 'Atletas Analizados', color: 'cyan' },
  { value: 95, suffix: '%', label: 'Satisfacción', color: 'gold' },
  { value: 10000, suffix: '+', label: 'Sesiones Procesadas', color: 'cyan' },
]

const TECH = [
  {
    icon: '⌁',
    color: 'cyan',
    title: 'Mapeo Esquelético Avanzado',
    desc: 'Rastreo en tiempo real de 33 puntos articulares.'
  },

  {
    icon: '▮▮',
    color: 'gold',
    title: 'Comparación Profesional',
    desc: 'Compara métricas con atletas profesionales.'
  },

  {
    icon: '◎',
    color: 'cyan',
    title: 'Retroalimentación Estratégica',
    desc: 'Consejos personalizados generados por IA.'
  },

  {
    icon: '⚡',
    color: 'gold',
    title: 'Análisis en Tiempo Real',
    desc: 'Procesamiento instantáneo de video.'
  },
]

const PLANS = [
  {
    name: 'Novato',
    featured: false,
    desc: 'Perfecto para comenzar.',
    price: 'Gratis',
    priceSuffix: '',
    features: [
      '5 análisis por mes',
      'Detección básica',
      'Historial',
      'Soporte'
    ],
    btn: 'Comenzar Gratis',
    btnClass: 'btn-plan outline',
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
      'Retroalimentación personalizada'
    ],
    btn: 'Elegir Plan',
    btnClass: 'btn-plan gold-btn',
  },

  {
    name: 'Club',
    featured: false,
    desc: 'Ideal para equipos.',
    price: '$49.99',
    priceSuffix: '/ mes',
    features: [
      'Hasta 30 atletas',
      'Panel entrenador',
      'Estadísticas',
      'Soporte dedicado'
    ],
    btn: 'Contactar',
    btnClass: 'btn-plan outline cyan',
  },
]

const FOOTER_LINKS = [
  {
    title: 'Producto',
    links: ['Características', 'Precios', 'Actualizaciones']
  },

  {
    title: 'Recursos',
    links: ['Tutoriales', 'Blog', 'Comunidad']
  },

  {
    title: 'Compañía',
    links: ['Contacto', 'Privacidad', 'Términos']
  },
]

export default function Home() {

  const cursorCoreRef = useRef(null)
  const cursorAuraRef = useRef(null)

  const heroRef = useRef(null)
  const heroImgRef = useRef(null)

  const countersRef = useRef([])

  const resultsSectionRef = useRef(null)

  const countersStarted = useRef(false)



  /* ── SCROLL ── */

  useEffect(() => {

    const hero = heroRef.current
    const heroImg = heroImgRef.current
    const results = resultsSectionRef.current

    function onScroll() {

      const scrollY = window.scrollY
      const trigger = window.innerHeight * 0.85

      if (hero) {
        hero.style.transform =
          `translateY(${scrollY * 0.1}px)`
      }

      if (heroImg) {
        heroImg.style.transform =
          `translateY(${scrollY * -0.1}px)`
      }

      document.querySelectorAll('.reveal').forEach((el) => {

        if (el.getBoundingClientRect().top < trigger) {
          el.classList.add('active')
        }

      })

      /* CONTADORES */

      if (
        !countersStarted.current &&
        results &&
        results.getBoundingClientRect().top <
        window.innerHeight * 0.8
      ) {

        countersStarted.current = true

        countersRef.current.forEach((el, i) => {

          if (!el) return

          const stat = STATS[i]

          const target = stat.value

          let value = 0

          const step = Math.max(1, target / 80)

          function update() {

            value += step

            if (value < target) {

              el.textContent =
                Math.floor(value) + stat.suffix

              requestAnimationFrame(update)

            } else {

              el.textContent =
                target + stat.suffix
            }
          }

          update()
        })
      }
    }

    window.addEventListener('scroll', onScroll)

    onScroll()

    return () =>
      window.removeEventListener('scroll', onScroll)

  }, [])

  /* ── SCRAMBLE ── */

  function handleScramble(e) {

    const el = e.currentTarget

    const original = el.innerText

    const letters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

    let iteration = 0

    clearInterval(el._interval)

    el._interval = setInterval(() => {

      el.innerText = original
        .split('')
        .map((char, i) =>
          i < iteration
            ? char
            : letters[
                Math.floor(
                  Math.random() * letters.length
                )
              ]
        )
        .join('')

      iteration += 1 / 3

      if (iteration >= original.length) {

        el.innerText = original

        clearInterval(el._interval)
      }

    }, 30)
  }

  /* ── GLOW ── */

  function handleCardMove(e) {

    const rect =
      e.currentTarget.getBoundingClientRect()

    e.currentTarget.style.setProperty(
      '--x',
      `${e.clientX - rect.left}px`
    )

    e.currentTarget.style.setProperty(
      '--y',
      `${e.clientY - rect.top}px`
    )
  }

  return (

    <div className="dashboard-page-container">

      {/* CURSOR */}

      <span
        ref={cursorCoreRef}
        className="cursor-core"
      />

      <span
        ref={cursorAuraRef}
        className="cursor-aura"
      />

      {/* NAVBAR */}

      <header className="topbar">

        <nav className="navigation">

          <Link href="/" className="brand">

            <Image
              src={Logo}
              alt="Logo"
              className="logo-1"
              width={40}
              height={40}
            />

            VolleyScan <span>AI</span>

          </Link>

          <ul className="menu">

            <li>
              <a href="#inicio">Inicio</a>
            </li>

            <li>
              <a href="#tecnologia">Tecnología</a>
            </li>

            <li>
              <a href="#metricas">Métricas</a>
            </li>

            <li>
              <a href="#planes">Planes</a>
            </li>

          </ul>

          <div className="nav-actions">

            <a
              className="btn-outline"
              href="#planes"
            >
              Ver Planes
            </a>

            <Link
              className="btn-nav-login"
              href="/login"
            >
              Iniciar sesión
            </Link>

          </div>

        </nav>

      </header>

      <main>

        {/* HERO */}

        <section className="hero" id="inicio">

          <article
            className="hero-text reveal"
            ref={heroRef}
          >

            <h1>

              Transforma tu{' '}

              <span
                className="gold"
                onMouseEnter={handleScramble}
              >
                rendimiento
              </span>

              {' '}en el voleibol con{' '}

              <span
                className="blue"
                onMouseEnter={handleScramble}
              >
                IA
              </span>

            </h1>

            <p>
              Detecta errores técnicos,
              analiza movimientos y mejora
              el rendimiento deportivo.
            </p>

            <div className="hero-actions">

              <Link
                className="btn-primary"
                href="/registro"
              >
                Crear Cuenta Gratis →
              </Link>

            </div>

          </article>

          <div className="img-frame reveal">

            <Image
              className="img-pro"
              src={image}
              alt="Atleta"
              width={500}
              height={500}
              
            />

          </div>

        </section>

        {/* RESULTADOS */}

        <section
          className="results"
          id="metricas"
          ref={resultsSectionRef}
        >

          <article className="results-header reveal">

            <h1>

              Resultados que{' '}

              <span onMouseEnter={handleScramble}>
                Hablan
              </span>

            </h1>

            <p className="subtitle">
              Mejoras significativas
              en atletas profesionales.
            </p>

          </article>

          <div className="stats">

            {STATS.map((stat, i) => (

              <article
                key={stat.label}
                className={`card ${stat.color} glow reveal`}
                onMouseMove={handleCardMove}
              >

                <h2
                  ref={(el) =>
                    (countersRef.current[i] = el)
                  }
                >
                  {stat.value}
                  {stat.suffix}
                </h2>

                <p>{stat.label}</p>

              </article>

            ))}

          </div>

        </section>

        {/* TECNOLOGÍA */}

        <section
          className="tech"
          id="tecnologia"
        >

          <header className="tech-header reveal">

            <h1>

              Tecnología de{' '}

              <span onMouseEnter={handleScramble}>
                Alto Rendimiento
              </span>

            </h1>

            <p>
              Inteligencia artificial aplicada
              al análisis biomecánico.
            </p>

          </header>

          <div className="tech-grid">

            {TECH.map((item, i) => (

              <article
                key={item.title}
                className="tech-card glow reveal"
                onMouseMove={handleCardMove}
                style={{
                  transitionDelay: `${i * 80}ms`
                }}
              >

                <span
                  className={`icon ${item.color}`}
                >
                  {item.icon}
                </span>

                <h3>{item.title}</h3>

                <p>{item.desc}</p>

              </article>

            ))}

          </div>

        </section>

        {/* PLANES */}

        <section
          className="pricing"
          id="planes"
        >

          <header className="pricing-header reveal">

            <h1>

              Elige tu{' '}

              <span onMouseEnter={handleScramble}>
                Plan
              </span>

            </h1>

            <p>
              Planes para atletas y clubes.
            </p>

          </header>

          <div className="pricing-grid">

            {PLANS.map((plan, i) => (

              <article
                key={plan.name}
                className={`plan glow reveal ${
                  plan.featured ? 'featured' : ''
                }`}
                onMouseMove={handleCardMove}
              >

                {plan.featured && (
                  <span className="plan-badge">
                    ⭐ Más popular
                  </span>
                )}

                <h3>{plan.name}</h3>

                <p className="plan-desc">
                  {plan.desc}
                </p>

                <div className="price">

                  {plan.featured ? (
                    <span className="gold">
                      {plan.price}
                    </span>
                  ) : (
                    plan.price
                  )}

                  <small>
                    {plan.priceSuffix}
                  </small>

                </div>

                <ul>

                  {plan.features.map((f) => (

                    <li key={f}>

                      <span className="check">
                        ✓
                      </span>

                      {f}

                    </li>

                  ))}

                </ul>

                <Link
                  href="/registro"
                  className={plan.btnClass}
                >
                  {plan.btn}
                </Link>

              </article>

            ))}

          </div>

        </section>

      </main>

      {/* FOOTER */}

      <footer className="footer">

        <section className="footer-brand">

          <h3>VolleyScan AI</h3>

          <p>
            Plataforma de análisis deportivo
            con inteligencia artificial.
          </p>

          <nav className="socals">

            <a href="#">🔍</a>

            <a href="#">📸</a>

            <a href="#">in</a>

          </nav> 

        </section>
      </footer>

    </div>
  )
}