import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './LandingPage.css'

const SPHERE_POOL = [
  '12%','18%','60d','₹10L','₹1K','63M','80M','AI','2.4x','0.3%','₹20L','9.3','7.8%','14.2','SME',
  '0x8F','ETH','NSE','BSE','₹5L','4.5%','11.1','25%','₹2K','RBI','NPS','ELSS','SIP','NAV','LTCG',
  '1.8x','3.2','₹50K','8.7','KYC','1.4','6.2%','15%','20d','90d','₹100','50M','0.9','16%','+3.2%',
]

function ChoicePanel({ onPick, onClose }) {
  function mm(e, el) {
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px')
    el.style.setProperty('--my', (e.clientY - r.top) + 'px')
  }
  return (
    <>
      <button className="onboard-close" onClick={onClose} aria-label="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <div className="kicker">Welcome to Nuvest</div>
      <h2 id="onb-title">How would you like to <em>begin?</em></h2>
      <p className="sub">Nuvest powers both sides of the marketplace. Pick the path that fits you — you can always add the other later.</p>
      <div className="choice-grid">
        <button className="choice" onMouseMove={(e) => mm(e, e.currentTarget)} onClick={() => onPick('sme')}>
          <div>
            <div className="icon-wrap">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 21V9l9-6 9 6v12" /><path d="M9 21v-8h6v8" /><path d="M3 13h18" />
              </svg>
            </div>
            <span className="tag">Path · A</span>
            <h3>Get Started as an <em>SME</em></h3>
            <p>Upload an invoice, get an AI risk score, and have investors fund you in minutes — no collateral, no bank queues.</p>
          </div>
          <div>
            <div className="stats-mini">
              <div className="m"><div className="v">~Minutes</div><div className="l">Time to cash</div></div>
              <div className="m"><div className="v">₹0</div><div className="l">Collateral</div></div>
              <div className="m"><div className="v">On-chain</div><div className="l">Credit record</div></div>
            </div>
            <span className="next">Continue as SME <span className="arrow">→</span></span>
          </div>
        </button>
        <button className="choice" onMouseMove={(e) => mm(e, e.currentTarget)} onClick={() => onPick('investor')}>
          <div>
            <div className="icon-wrap">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" />
              </svg>
            </div>
            <span className="tag">Path · B</span>
            <h3>Get Started as a <em>Retail Investor</em></h3>
            <p>Browse risk-scored invoice tokens, fund from ₹1,000, and earn 12–18% annualised yield backed by smart-contract settlement.</p>
          </div>
          <div>
            <div className="stats-mini">
              <div className="m"><div className="v">12–18%</div><div className="l">Target yield</div></div>
              <div className="m"><div className="v">₹1,000</div><div className="l">Min ticket</div></div>
              <div className="m"><div className="v">60 days</div><div className="l">Avg tenor</div></div>
            </div>
            <span className="next">Continue as Investor <span className="arrow">→</span></span>
          </div>
        </button>
      </div>
    </>
  )
}

function SuccessPanel({ kind, onBack, onContinue }) {
  const isSME = kind === 'sme'
  const steps = isSME
    ? [['01','Verify business','GSTIN + PAN'],['02','Upload invoice','PDF · IPFS pinning'],['03','AI risk score','XGBoost + SHAP'],['04','Go live on marketplace','Accept offers']]
    : [['01','KYC + risk profile','2 min'],['02','Connect wallet','MetaMask / UPI'],['03','Pick first token','₹1,000 min'],['04','Earn yield','60 day cycle']]
  return (
    <>
      <button className="onboard-close" onClick={onBack} aria-label="Back">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <div className="kicker">{isSME ? 'SME Track' : 'Investor Track'}</div>
      <h2>{isSME ? <>Let&rsquo;s fund your <em>invoice.</em></> : <>Let&rsquo;s build your <em>yield</em> stack.</>}</h2>
      <p className="sub">
        {isSME
          ? "Next, we'll verify your business, connect your GST, and score your first invoice in under 2 minutes."
          : "Next, we'll set your risk profile, connect MetaMask or UPI, and show you a live feed of available invoice tokens."}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '32px' }}>
        {steps.map(([i, n, d]) => (
          <div key={i} className="flow-step" style={{ minHeight: '110px' }}>
            <div className="idx">{i}</div>
            <div className="name" style={{ fontSize: '16px' }}>{n}</div>
            <div className="desc">{d}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={onContinue}>
          Continue
          <svg className="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
        <button className="btn" onClick={onBack}>← Back</button>
      </div>
    </>
  )
}

export default function LandingPage() {
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [onboardStep, setOnboardStep] = useState('choice')
  const canvasRef = useRef(null)
  const navigate = useNavigate()

  function openOnboard() { setOnboardOpen(true); setOnboardStep('choice') }
  function closeOnboard() { setOnboardOpen(false) }

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = onboardOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [onboardOpen])

  // Nav scrolled state
  useEffect(() => {
    const nav = document.getElementById('nav')
    const handler = () => nav?.classList.toggle('scrolled', window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Scroll reveal
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle('in', e.isIntersecting)
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' })
    document.querySelectorAll('.reveal').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])

  // Hero parallax + word reveal
  useEffect(() => {
    const orbWrap = document.querySelector('.hero-orb-wrap')
    const heroWords = Array.from(document.querySelectorAll('.hero-h1 .w'))
    window.__heroScroll = 0
    function onScrollHero() {
      const y = window.scrollY, vh = window.innerHeight
      const p = Math.min(1.4, Math.max(0, y / (vh * 0.9)))
      window.__heroScroll = p
      if (orbWrap) {
        orbWrap.style.transform = `translateY(${y * 0.18}px)`
        orbWrap.style.opacity = Math.max(0, 1 - p * 0.85)
      }
      const progress = Math.min(1, Math.max(0, y / (vh * 0.75)))
      heroWords.forEach((w, i) => {
        const trigger = 0.04 + (i / Math.max(1, heroWords.length - 1)) * 0.75
        w.classList.toggle('in', progress >= trigger)
      })
    }
    window.addEventListener('scroll', onScrollHero, { passive: true })
    requestAnimationFrame(() => setTimeout(onScrollHero, 60))
    return () => window.removeEventListener('scroll', onScrollHero)
  }, [])

  // Section title split reveal
  useEffect(() => {
    const titles = document.querySelectorAll('.section-title.split')
    if (!titles.length) return
    const timers = new WeakMap()
    const sio = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        const words = e.target.querySelectorAll('.sw')
        ;(timers.get(e.target) || []).forEach(clearTimeout)
        const next = []
        if (e.isIntersecting) {
          words.forEach((w, i) => next.push(setTimeout(() => w.classList.add('in'), i * 90)))
        } else {
          words.forEach(w => w.classList.remove('in'))
        }
        timers.set(e.target, next)
      })
    }, { threshold: 0.25 })
    titles.forEach(t => sio.observe(t))
    return () => sio.disconnect()
  }, [])

  // Stat card spotlight
  useEffect(() => {
    const cards = document.querySelectorAll('.stat-card')
    if (!cards.length) return
    function handler(e) {
      cards.forEach(card => {
        const r = card.getBoundingClientRect()
        if (e.clientX < r.left - 200 || e.clientX > r.right + 200 ||
            e.clientY < r.top - 200 || e.clientY > r.bottom + 200) return
        const x = ((e.clientX - r.left) / r.width) * 100
        const y = ((e.clientY - r.top) / r.height) * 100
        card.style.setProperty('--spot-x', x + '%')
        card.style.setProperty('--spot-y', y + '%')
        card.style.setProperty('--spot-hue', (200 + (x / 100) * 60).toFixed(1))
      })
    }
    document.addEventListener('pointermove', handler, { passive: true })
    return () => document.removeEventListener('pointermove', handler)
  }, [])

  // Number sphere canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const wrap = canvas.parentElement
    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    let W = 0, H = 0, CX = 0, CY = 0, R = 0

    const COUNT = 320
    const particles = []
    function initParticles() {
      particles.length = 0
      const golden = Math.PI * (3 - Math.sqrt(5))
      for (let i = 0; i < COUNT; i++) {
        const y = 1 - (i / (COUNT - 1)) * 2
        const rr = Math.sqrt(1 - y * y)
        const theta = golden * i
        particles.push({
          bx: Math.cos(theta) * rr, by: y, bz: Math.sin(theta) * rr,
          dx: 0, dy: 0, dz: 0, vx: 0, vy: 0, vz: 0,
          phase: Math.random() * Math.PI * 2,
          speed: 0.5 + Math.random() * 0.9,
          label: SPHERE_POOL[i % SPHERE_POOL.length],
          size: 7.5 + Math.random() * 3.5,
          accent: Math.random() < 0.14,
        })
      }
    }
    initParticles()

    function resize() {
      const rect = wrap.getBoundingClientRect()
      W = rect.width; H = rect.height; CX = W / 2; CY = H / 2
      R = Math.min(W, H) * 0.45
      canvas.width = W * DPR; canvas.height = H * DPR
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    let rotY = 0, rotX = 0
    let rotYVel = 0.003, rotXVel = 0.0005
    const targetRotYVel = 0.003, targetRotXVel = 0.0005
    let dragging = false, lastX = 0, lastY = 0
    let mx = -1000, my = -1000, inside = false

    canvas.addEventListener('pointerdown', (e) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY
      canvas.setPointerCapture(e.pointerId)
    })
    canvas.addEventListener('pointerup', () => { dragging = false })
    canvas.addEventListener('pointercancel', () => { dragging = false })
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect()
      mx = e.clientX - r.left; my = e.clientY - r.top; inside = true
      if (dragging) {
        rotY += (e.clientX - lastX) * 0.006
        rotX = Math.max(-1.2, Math.min(1.2, rotX + (e.clientY - lastY) * 0.006))
        lastX = e.clientX; lastY = e.clientY
      }
    })
    canvas.addEventListener('pointerleave', () => { inside = false; mx = my = -1000 })

    const t0 = performance.now()
    let rafId
    function frame(now) {
      const t = (now - t0) / 1000
      const sp = Math.min(1.4, window.__heroScroll || 0)
      const globalAlpha = Math.max(0, 1 - sp * 0.95)

      if (!dragging) {
        rotYVel += (targetRotYVel - rotYVel) * 0.02
        rotXVel += (targetRotXVel - rotXVel) * 0.02
        rotY += rotYVel
        rotX += rotXVel * Math.sin(t * 0.3)
      }

      ctx.globalAlpha = globalAlpha
      ctx.clearRect(0, 0, W, H)

      const cosY = Math.cos(rotY), sinY = Math.sin(rotY)
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX)
      const styles = getComputedStyle(document.documentElement)
      const accent2 = styles.getPropertyValue('--accent-2').trim() || '#7aa2ff'
      const accent  = styles.getPropertyValue('--accent').trim()  || '#5b8cff'

      const halo = ctx.createRadialGradient(CX, CY, 0, CX, CY, R * 1.4)
      halo.addColorStop(0, 'rgba(91,140,255,0.08)')
      halo.addColorStop(1, 'rgba(91,140,255,0)')
      ctx.fillStyle = halo
      ctx.beginPath(); ctx.arc(CX, CY, R * 1.4, 0, Math.PI * 2); ctx.fill()

      const rendered = []
      for (const p of particles) {
        const radial = 1 + Math.sin(t * p.speed + p.phase) * 0.06
        let tx = p.bx * radial, ty = p.by * radial, tz = p.bz * radial
        let wx = tx * cosY + tz * sinY, wz = -tx * sinY + tz * cosY
        let wy = ty * cosX - wz * sinX; wz = ty * sinX + wz * cosX
        const persp = 1 / (1.8 - wz * 0.8)
        const sx = CX + wx * R * persp, sy = CY + wy * R * persp

        if (inside) {
          const d = Math.sqrt((sx - mx) ** 2 + (sy - my) ** 2)
          const inf = Math.max(0, 1 - d / 220)
          if (inf > 0) { const pm = inf * 0.055; p.vx += p.bx * pm; p.vy += p.by * pm; p.vz += p.bz * pm }
        }

        const k = 0.22, damp = 0.72
        p.vx = (p.vx + -p.dx * k) * damp
        p.vy = (p.vy + -p.dy * k) * damp
        p.vz = (p.vz + -p.dz * k) * damp
        p.dx += p.vx; p.dy += p.vy; p.dz += p.vz

        let fx = p.bx * radial + p.dx, fy = p.by * radial + p.dy, fz = p.bz * radial + p.dz
        let rwx = fx * cosY + fz * sinY, rwz = -fx * sinY + fz * cosY
        let rwy = fy * cosX - rwz * sinX; rwz = fy * sinX + rwz * cosX
        const rPersp = 1 / (1.8 - rwz * 0.8)
        rendered.push({ p, sx: CX + rwx * R * rPersp, sy: CY + rwy * R * rPersp, z: rwz, persp: rPersp })
      }

      rendered.sort((a, b) => a.z - b.z)
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      for (const { p, sx, sy, z, persp } of rendered) {
        const alpha = Math.max(0.08, (z + 1) * 0.5)
        ctx.font = `500 ${p.size * persp}px 'Manrope', 'Inter', sans-serif`
        if (p.accent) {
          ctx.fillStyle = `${accent2}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`
          ctx.shadowColor = accent; ctx.shadowBlur = 12 * alpha
        } else {
          const v = Math.round(180 + 75 * alpha)
          ctx.fillStyle = `rgba(${v},${v + 10},255,${alpha})`; ctx.shadowBlur = 0
        }
        ctx.fillText(p.label, sx, sy)
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1
      rafId = requestAnimationFrame(frame)
    }
    rafId = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', resize) }
  }, [])

  const SME_FLOW = [['01','Upload Invoice','SME · Dashboard'],['02','AI Risk Score','XGBoost + SHAP'],['03','Token Minted','Polygon · IPFS'],['04','Investors Fund','Marketplace · Live'],['05','Auto-Settle','Smart contract']]
  const INV_FLOW = [['01','Browse Tokens','Curated feed'],['02','Pick Risk & Yield','12–18% bands'],['03','Fund via Wallet','MetaMask · UPI'],['04','Earn Yield','~60 day tenor'],['05','Reinvest','Compound']]
  const TXS = [
    { dir:'in', name:'Invoice #INV-8842 settled', sub:'From 0x8F3c… · 2h ago', amt:'+0.412 ETH', status:'confirmed' },
    { dir:'out', name:'Funded invoice token NUV-2201', sub:'To marketplace contract · 6h ago', amt:'−1.000 ETH', status:'pending' },
    { dir:'in', name:'Yield payout · Token NUV-1994', sub:'Smart contract auto-settle · 1d ago', amt:'+0.087 ETH', status:'confirmed' },
    { dir:'out', name:'Gas · Approve USDC', sub:'Polygon · 2d ago', amt:'−0.0012 MATIC', status:'confirmed' },
  ]

  return (
    <>
      {/* NAV */}
      <nav className="nav scrolled" id="nav">
        <div className="brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span className="mark" />
          <span>Nuvest</span>
        </div>
        <div className="nav-links">
          <a href="#platform">Platform</a>
          <a href="#flow">How it works</a>
          <a href="#impact">Impact</a>
        </div>
        <button className="nav-cta" onClick={openOnboard}>Get Started →</button>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-orb-wrap" aria-hidden="true">
          <canvas id="numberSphere" ref={canvasRef} />
        </div>
        <div className="eyebrow"><span className="dot" />AI + Blockchain · Trade Finance for India</div>
        <h1 className="hero-h1">
          <span className="w" data-dir="l">AI</span>{' '}
          <span className="w" data-dir="r">investing</span>{' '}
          <span className="w" data-dir="l">meets</span>{' '}
          <em className="w" data-dir="r">SME</em>{' '}
          <span className="w accent" data-dir="l" style={{ color: 'rgb(68,93,153)' }}>liquidity.</span>
        </h1>
        <p className="lead">
          Nuvest is two products in one platform — an AI portfolio copilot for 80M+ Indian retail investors,
          and a blockchain-settled invoice financing marketplace that unlocks working capital for 63M+ MSMEs.
        </p>
        <div className="cta-row">
          <button className="btn primary" onClick={openOnboard} style={{ color: 'rgba(5,5,5,0.95)' }}>
            Get Started
            <svg className="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
          </button>
          <a href="#platform" className="btn">
            Explore platform
            <svg className="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
          </a>
        </div>
      </section>

      {/* STATS */}
      <section id="platform">
        <div className="wrap">
          <div className="section-head reveal in">
            <div className="section-kicker">01 · The opportunity</div>
            <h2 className="section-title split">
              <span className="sw" data-dir="l">A</span>{' '}
              <em className="sw" data-dir="r">20 lakh crore</em>{' '}
              <span className="sw" data-dir="l">capital gap —</span>{' '}
              <span className="sw" data-dir="r">and an 80M-strong</span>{' '}
              <span className="sw" data-dir="l">investor base waiting</span>{' '}
              <span className="sw" data-dir="r">for better tools.</span>
            </h2>
          </div>
          <div className="stats">
            {[
              { label: 'MSMEs in India',      num: '63M',    unit: '+',           cls: '' },
              { label: 'Retail investors',     num: '80M',    unit: '+',           cls: 'd1' },
              { label: 'Working capital gap',  num: '₹20L Cr',unit: 'addressable', cls: 'accent lg d2' },
              { label: 'Avg. invoice wait',    num: '60',     unit: 'days',        cls: '' },
              { label: 'Target investor yield',num: '12–18',  unit: '% p.a.',      cls: 'd1' },
              { label: 'Min ticket size',      num: '₹1,000', unit: 'fractional',  cls: 'd2' },
            ].map(({ label, num, unit, cls }, i) => (
              <div key={i} className={`stat-card reveal in ${cls}`}>
                <div className="stat-label">{label}</div>
                <div className="stat-num">{num}<span className="unit">{unit}</span></div>
              </div>
            ))}
            <div className="stat-card reveal d3 in">
              <div className="stat-label">Settlement layer</div>
              <div className="stat-num" style={{ fontSize: '28px', lineHeight: '1.2', fontFamily: "'Manrope', sans-serif" }}>
                Polygon<br /><span style={{ color: 'var(--ink-3)', fontSize: '14px' }}>+ IPFS</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLATFORM DUO */}
      <section>
        <div className="wrap">
          <div className="section-head reveal in">
            <div className="section-kicker">02 · The platform</div>
            <h2 className="section-title split">
              <span className="sw" data-dir="l">Two products,</span>{' '}
              <em className="sw" data-dir="r">one</em>{' '}
              <span className="sw" data-dir="l">capital flywheel.</span>
            </h2>
          </div>
          <div className="duo">
            <div className="product-card reveal in">
              <span className="badge" />
              <h3>AI Portfolio <em>Copilot</em></h3>
              <p>India-specific AI investment advice with live NSE/BSE data. Tax optimisation, SIP guidance, and natural-language queries for every investor level.</p>
              <div className="feats">
                {['Natural language queries — "How much ELSS for 80C?"','Live NSE/BSE tracking via Zerodha Kite Connect','LTCG / STCG / indexation-aware advice','SIP optimiser + fiscal year-end rebalancing alerts'].map((f, i) => (
                  <div key={i} className="feat"><span className="tick" /><span className="k">0{i+1}</span><span>{f}</span></div>
                ))}
              </div>
            </div>
            <div className="product-card reveal d1 in">
              <span className="badge" />
              <h3>Invoice Financing <em>Marketplace</em></h3>
              <p>SMEs get cash in minutes against unpaid invoices. Tokenised on Polygon, risk-scored by AI, settled by smart contracts. No banks. No collateral.</p>
              <div className="feats">
                {['SME uploads invoice → AI scores risk (XGBoost + SHAP)','Invoice tokenised on Polygon — tamper-proof record','Investors fund invoices at a discount via marketplace','Smart contract auto-settles on due date — trustless'].map((f, i) => (
                  <div key={i} className="feat"><span className="tick" /><span className="k">0{i+1}</span><span>{f}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FLOW */}
      <section id="flow">
        <div className="wrap">
          <div className="section-head reveal in">
            <div className="section-kicker">03 · How it works</div>
            <h2 className="section-title split">
              <span className="sw" data-dir="l">From</span>{' '}
              <em className="sw" data-dir="r">invoice</em>{' '}
              <span className="sw" data-dir="l">to settled yield —</span>{' '}
              <span className="sw" data-dir="r">in five steps.</span>
            </h2>
          </div>
          <div className="flow reveal d1 in">
            <div className="flow-label">SME Flow</div>
            <div className="flow-row">
              {SME_FLOW.map(([idx, name, desc], i) => (
                <div key={idx} className="flow-step">
                  <div className="idx">{idx}</div>
                  <div className="name">{name}</div>
                  <div className="desc">{desc}</div>
                  {i < 4 && <div className="flow-arrow">→</div>}
                </div>
              ))}
            </div>
            <div className="flow-label" style={{ marginTop: '36px' }}>Investor Flow</div>
            <div className="flow-row">
              {INV_FLOW.map(([idx, name, desc], i) => (
                <div key={idx} className="flow-step">
                  <div className="idx">{idx}</div>
                  <div className="name">{name}</div>
                  <div className="desc">{desc}</div>
                  {i < 4 && <div className="flow-arrow">→</div>}
                </div>
              ))}
            </div>
            <div className="example">
              <b>Example ·</b> ₹10L invoice → AI scores it → Investors fund ₹9.3L → SME gets cash today → Smart contract releases ₹10L to investors in 60 days. No banks. No waiting.
            </div>
          </div>
        </div>
      </section>

      {/* IMPACT */}
      <section id="impact">
        <div className="wrap">
          <div className="section-head reveal in">
            <div className="section-kicker">04 · Impact</div>
            <h2 className="section-title split">
              <span className="sw" data-dir="l">Value,</span>{' '}
              <em className="sw" data-dir="r">three ways.</em>
            </h2>
          </div>
          <div className="impact">
            {[
              { kicker: 'For SMEs', title: 'Working capital, on tap.', items: ['Instant liquidity against invoices — no collateral','Cash in minutes, not weeks','Verifiable on-chain credit history','Formal finance for 63M+ MSMEs'], cls: '' },
              { kicker: 'For Investors', title: 'A new yield asset class.', items: ['12–18% annualised on invoice tokens','Low-correlation alternative asset','AI-guided portfolio for Indian market','Fractional investing from ₹1,000'], cls: 'd1' },
              { kicker: 'For India', title: 'Closing the capital gap.', items: ['Addresses ₹20L Cr working capital shortfall','Financial inclusion for 63M+ MSMEs','AI literacy for 80M+ retail investors','Aligned with RBI digital trade finance push'], cls: 'd2' },
            ].map(({ kicker, title, items, cls }) => (
              <div key={kicker} className={`impact-card reveal in ${cls}`}>
                <div>
                  <div className="section-kicker" style={{ marginBottom: '18px' }}>{kicker}</div>
                  <h4>{title}</h4>
                </div>
                <ul>{items.map(item => <li key={item}>{item}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="cta-section" id="start">
        <div className="wrap">
          <div className="reveal in">
            <div className="section-kicker" style={{ justifyContent: 'center', display: 'inline-flex' }}>Ready when you are</div>
            <h2 className="section-title" style={{ textAlign: 'center', maxWidth: '22ch', margin: '24px auto 40px' }}>
              Pick a <em>side</em> of the marketplace.
            </h2>
            <p style={{ color: 'var(--ink-2)', maxWidth: '54ch', margin: '0 auto 44px', fontSize: '16px', lineHeight: '1.6' }}>
              Whether you need working capital today, or you want to earn 12–18% yield on tokenised invoices — Nuvest gets you started in minutes.
            </p>
            <button className="btn primary" onClick={openOnboard} style={{ fontSize: '15px', padding: '16px 30px' }}>
              Get Started
              <svg className="arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </section>

      {/* WALLET PREVIEW */}
      <section id="wallet" style={{ paddingTop: '40px' }}>
        <div className="wrap">
          <div className="section-head reveal">
            <div className="section-kicker">05 · Investor dashboard preview</div>
            <h2 className="section-title split">
              <span className="sw" data-dir="l">Your wallet,</span>{' '}
              <em className="sw" data-dir="r">live.</em>
            </h2>
          </div>
          <div className="wallet-grid reveal d1">
            <div className="wallet-card wallet-main">
              <div className="wc-head">
                <div className="wc-net"><span className="wc-dot" /><span>Polygon Mainnet</span></div>
                <button className="wc-addr">
                  <span>0x8F3c…0xA92d</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
                  </svg>
                </button>
              </div>
              <div className="wc-balance">
                <div className="wc-label">Total balance</div>
                <div className="wc-amt"><span className="wc-num">2.847</span><span className="wc-unit">ETH</span></div>
                <div className="wc-usd">≈ ₹8,42,500 · <span className="wc-delta up">+3.24%</span> today</div>
              </div>
              <div className="wc-actions">
                <button className="wc-btn primary">Connect Wallet</button>
                <button className="wc-btn">Fund Invoice</button>
                <button className="wc-btn ghost">Withdraw</button>
              </div>
              <div className="wc-assets">
                {[
                  { cls: 'eth', sym: 'Ξ', name: 'Ethereum', ticker: 'ETH', amt: '2.847', inr: '₹8.4L' },
                  { cls: 'matic', sym: 'M', name: 'Polygon', ticker: 'MATIC', amt: '1,240.5', inr: '₹1.1L' },
                  { cls: 'usdc', sym: '$', name: 'USD Coin', ticker: 'USDC', amt: '8,420.00', inr: '₹7.0L' },
                ].map(({ cls, sym, name, ticker, amt, inr }) => (
                  <div key={ticker} className="wc-asset">
                    <div className={`wc-asset-icon ${cls}`}>{sym}</div>
                    <div className="wc-asset-meta"><div>{name}</div><div className="k">{ticker}</div></div>
                    <div className="wc-asset-val"><div>{amt}</div><div className="k">{inr}</div></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="wallet-card wallet-tx">
              <div className="wc-head">
                <div className="wc-title">Recent activity</div>
                <span className="wc-link">View all →</span>
              </div>
              <div className="tx-list">
                {TXS.map((tx, i) => (
                  <div key={i} className="tx">
                    <div className={`tx-icon ${tx.dir}`}>
                      {tx.dir === 'in'
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                      }
                    </div>
                    <div className="tx-meta">
                      <div className="tx-name">{tx.name}</div>
                      <div className="tx-sub">{tx.sub}</div>
                    </div>
                    <div className="tx-val">
                      <div className={`tx-amt ${tx.dir === 'in' ? 'up' : 'down'}`}>{tx.amt}</div>
                      <div className={`tx-status ${tx.status}`}>{tx.status[0].toUpperCase() + tx.status.slice(1)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="l"><span>© Nuvest · Team BMSCE</span><span>Athernex 2026</span></div>
        <div className="l"><span>Polygon Testnet</span><span>RBI-aligned</span></div>
      </footer>

      {/* ONBOARDING OVERLAY */}
      <div
        className={`onboard${onboardOpen ? ' open' : ''}`}
        role="dialog" aria-modal="true" aria-labelledby="onb-title"
        onClick={(e) => { if (e.target === e.currentTarget) closeOnboard() }}
      >
        <div className="onboard-panel">
          {onboardStep === 'choice'
            ? <ChoicePanel onPick={setOnboardStep} onClose={closeOnboard} />
            : <SuccessPanel
                kind={onboardStep}
                onBack={() => setOnboardStep('choice')}
                onContinue={() => { closeOnboard(); navigate(onboardStep === 'sme' ? '/sme' : '/invest') }}
              />
          }
        </div>
      </div>
    </>
  )
}
