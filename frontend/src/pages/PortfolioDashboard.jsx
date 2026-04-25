import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { fetchSummary, sendChatMessage } from '../utils/api'

const LS_KEY    = 'nuvest_kite_connected'
const API_BASE  = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const POLL_SUM  = 60_000
const POLL_LIVE = 30_000

const C = {
  bg:      '#07080f',
  surface: '#0d1117',
  border:  '#1e2535',
  blue:    '#387ED1',
  green:   '#4ade80',
  red:     '#f87171',
  gold:    '#f59e0b',
  muted:   '#6b7280',
  text:    '#e5e7eb',
  subtext: '#9ca3af',
}

const DONUT_COLORS = { equity: '#387ED1', debt: '#a78bfa', gold: '#f59e0b', pension: '#34d399' }

const EMPTY_SUMMARY = {
  total_value: 0, total_invested: 0, total_pnl: 0, xirr_pct: 0,
  equity_pct: 0, debt_pct: 0, gold_pct: 0, pension_pct: 0,
  allocation: { equity: 0, debt: 0, gold: 0, pension: 0 },
  elss_invested: 0, ppf_invested: 0, remaining_80c: 150000,
  ltcg_this_fy: 0, stcg_exposure: 0, is_live: false,
}

const MOCK_PORTFOLIO = {
  total_value: 428350, total_invested: 380000, total_pnl: 48350, xirr_pct: 12.4,
  equity_pct: 0.56, debt_pct: 0.24, gold_pct: 0.11, pension_pct: 0.09,
  allocation: { equity: 239876, debt: 102804, gold: 47119, pension: 38551 },
  elss_invested: 110000, ppf_invested: 40000, remaining_80c: 0,
  ltcg_this_fy: 18200, stcg_exposure: 9200, is_live: false,
}

const MOCK_HOLDINGS = [
  { tradingsymbol: 'AXISLONG',   exchange: 'NSE', quantity: 150.234, average_price: 55.20, last_price: 68.45, pnl: 1988.55, invested_amount: 8292.92,  current_value: 10282.51, return_pct: 23.96, tag: 'ELSS',   fund_category: 'ELSS',  change: 0.85,  change_percent:  1.26 },
  { tradingsymbol: 'NIFTYBEES',  exchange: 'NSE', quantity: 500,     average_price: 182.50, last_price: 234.80, pnl: 26150, invested_amount: 91250,    current_value: 117400,   return_pct: 28.66, tag: 'Equity', fund_category: 'Index', change: -1.20, change_percent: -0.51 },
  { tradingsymbol: 'SGBBSE2031', exchange: 'BSE', quantity: 10,      average_price: 4850,   last_price: 6120,   pnl: 12700, invested_amount: 48500,    current_value: 61200,    return_pct: 26.19, tag: 'SGB',    fund_category: 'SGB',   change: 42.5,  change_percent:  0.70 },
  { tradingsymbol: 'PPF',        exchange: 'OFF', quantity: 1,       average_price: 50000,  last_price: 50000,  pnl: 0,     invested_amount: 50000,    current_value: 50000,    return_pct: 0,     tag: 'Debt',   fund_category: 'PPF',   change: 0,     change_percent:  0    },
  { tradingsymbol: 'NPS_TIER1',  exchange: 'OFF', quantity: 1,       average_price: 25000,  last_price: 27500,  pnl: 2500,  invested_amount: 25000,    current_value: 27500,    return_pct: 10,    tag: 'Pension',fund_category: 'NPS',   change: 50,    change_percent:  0.18 },
]

function fmt(n) {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e7) return '₹' + (v / 1e7).toFixed(2) + 'Cr'
  if (Math.abs(v) >= 1e5) return '₹' + (v / 1e5).toFixed(2) + 'L'
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}
function fmtPct(n) {
  const v = Number(n) || 0
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}
function fmtNum(n) {
  return (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function generateMockOHLCV(lastPrice, days = 30) {
  const data = []
  let price = lastPrice * (0.88 + Math.random() * 0.06)
  const now = Date.now()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000)
    if (d.getDay() === 0 || d.getDay() === 6) continue
    const open  = price
    const move  = (Math.random() - 0.47) * price * 0.022
    const close = Math.max(open * 0.96, Math.min(open * 1.04, open + move))
    const high  = Math.max(open, close) * (1 + Math.random() * 0.007)
    const low   = Math.min(open, close) * (1 - Math.random() * 0.007)
    data.push({
      date:  d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      open:  +open.toFixed(2),
      high:  +high.toFixed(2),
      low:   +low.toFixed(2),
      close: +close.toFixed(2),
    })
    price = close
  }
  if (data.length) data[data.length - 1].close = lastPrice
  return data
}

function CandlestickChart({ data, height = 230 }) {
  const ref = useRef(null)
  const [width, setWidth] = useState(500)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  if (!data.length) return null
  const pad = { l: 52, r: 8, t: 12, b: 26 }
  const cW  = Math.max(1, width - pad.l - pad.r)
  const cH  = height - pad.t - pad.b
  const minP = Math.min(...data.map(d => d.low))  * 0.9985
  const maxP = Math.max(...data.map(d => d.high)) * 1.0015
  const range = maxP - minP || 1
  const toY  = v => pad.t + cH * (1 - (v - minP) / range)
  const bw   = Math.max(2, cW / data.length * 0.55)
  const n    = data.length
  const showEvery = Math.max(1, Math.floor(n / 7))

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const y = pad.t + cH * t
          const v = maxP - t * range
          return (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke={C.border} />
              <text x={pad.l - 4} y={y + 4} textAnchor="end" fontSize={9} fill={C.muted}>
                {v >= 1000 ? (v / 1000).toFixed(1) + 'K' : v.toFixed(v < 10 ? 2 : 0)}
              </text>
            </g>
          )
        })}
        {data.map((d, i) => {
          const x      = pad.l + (i + 0.5) * (cW / n)
          const isUp   = d.close >= d.open
          const col    = isUp ? C.green : C.red
          const bodyT  = toY(Math.max(d.open, d.close))
          const bodyB  = toY(Math.min(d.open, d.close))
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={toY(d.high)} y2={toY(d.low)} stroke={col} strokeWidth={1} />
              <rect x={x - bw / 2} y={bodyT} width={bw} height={Math.max(1, bodyB - bodyT)} fill={col} rx={0.5} />
            </g>
          )
        })}
        {data.map((d, i) => {
          if (i % showEvery !== 0) return null
          return (
            <text key={i} x={pad.l + (i + 0.5) * (cW / n)} y={height - 6} textAnchor="middle" fontSize={9} fill={C.muted}>
              {d.date}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
.pd-root { font-family:'Inter',sans-serif; background:${C.bg}; min-height:100vh; color:${C.text}; }
.pd-root * { box-sizing:border-box; }
.pd-nav { display:flex; align-items:center; justify-content:space-between; padding:14px 28px; border-bottom:1px solid ${C.border}; background:${C.surface}; position:sticky; top:0; z-index:10; }
.pd-nav-left { display:flex; align-items:center; gap:10px; }
.pd-logo { font-size:18px; font-weight:700; color:${C.blue}; letter-spacing:-.5px; }
.pd-live-dot { width:8px; height:8px; border-radius:50%; background:#4b5563; display:inline-block; }
.pd-live-dot.active { background:${C.green}; animation:pulse-live 2s infinite; }
.pd-live-label { font-size:12px; color:${C.green}; font-weight:600; }
.pd-mock-badge { font-size:11px; background:#422006; color:#fbbf24; padding:2px 8px; border-radius:99px; border:1px solid #92400e; }
.pd-nav-right { display:flex; align-items:center; gap:10px; }
.pd-updated { font-size:12px; color:${C.muted}; }
.pd-btn { padding:6px 14px; border-radius:6px; font-size:13px; font-weight:500; border:none; cursor:pointer; transition:opacity .15s; }
.pd-btn:hover { opacity:.85; }
.pd-btn-ghost { background:transparent; border:1px solid ${C.border}; color:${C.subtext}; }
.pd-btn-ghost.active { border-color:${C.blue}; color:${C.blue}; background:rgba(56,126,209,.08); }
.pd-btn-primary { background:${C.blue}; color:#fff; }
.pd-body { max-width:1280px; margin:0 auto; padding:28px 24px; }
.pd-metric-strip { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:28px; }
.pd-metric { background:${C.surface}; border:1px solid ${C.border}; border-radius:10px; padding:16px 18px; }
.pd-metric-label { font-size:11px; color:${C.muted}; text-transform:uppercase; letter-spacing:.6px; margin-bottom:4px; }
.pd-metric-value { font-size:20px; font-weight:700; }
.pd-metric-sub { font-size:12px; color:${C.muted}; margin-top:2px; }
.pd-grid { display:grid; grid-template-columns:1fr 340px; gap:20px; margin-bottom:20px; }
@media(max-width:960px){ .pd-grid { grid-template-columns:1fr; } }
.pd-bottom-row { display:flex; gap:20px; margin-bottom:28px; }
@media(max-width:960px){ .pd-bottom-row { flex-direction:column; } }
.pd-card { background:${C.surface}; border:1px solid ${C.border}; border-radius:12px; overflow:hidden; }
.pd-card-header { padding:14px 18px; border-bottom:1px solid ${C.border}; display:flex; align-items:center; justify-content:space-between; }
.pd-card-title { font-size:14px; font-weight:600; color:${C.text}; }
.pd-card-body { padding:18px; }
.pd-donut-labels { display:flex; flex-direction:column; gap:8px; margin-top:12px; }
.pd-donut-row { display:flex; align-items:center; justify-content:space-between; font-size:13px; }
.pd-donut-dot { width:8px; height:8px; border-radius:50%; margin-right:6px; display:inline-block; }
.pd-table-wrap { overflow-x:auto; }
.pd-table { width:100%; border-collapse:collapse; font-size:13px; }
.pd-table th { padding:10px 12px; text-align:right; font-size:11px; font-weight:600; color:${C.muted}; text-transform:uppercase; letter-spacing:.5px; border-bottom:1px solid ${C.border}; cursor:pointer; user-select:none; white-space:nowrap; }
.pd-table th:first-child { text-align:left; }
.pd-table th:hover { color:${C.text}; }
.pd-table td { padding:10px 12px; text-align:right; border-bottom:1px solid ${C.border}; color:${C.text}; transition:background .15s; }
.pd-table td:first-child { text-align:left; font-weight:600; }
.pd-table tr:last-child td { border-bottom:none; }
.pd-table tbody tr { cursor:pointer; transition:background .12s; }
.pd-table tbody tr:hover td { background:rgba(255,255,255,.025); }
.pd-table tbody tr.pd-row-sel td { background:rgba(56,126,209,.09); }
.pd-tag { display:inline-block; font-size:10px; padding:1px 6px; border-radius:4px; font-weight:600; margin-left:6px; }
.pd-tag-equity  { background:#1e3a5f; color:#60a5fa; }
.pd-tag-elss    { background:#1a2e05; color:#86efac; }
.pd-tag-sgb     { background:#3b2800; color:#fbbf24; }
.pd-tag-debt    { background:#2d1b69; color:#c4b5fd; }
.pd-tag-pension { background:#064e3b; color:#34d399; }
.pd-pos { color:${C.green}; }
.pd-neg { color:${C.red}; }
.fu { animation:flash-up 1.4s ease; }
.fd { animation:flash-down 1.4s ease; }
@keyframes flash-up   { 0%{background:transparent} 20%{background:rgba(74,222,128,.22)} 100%{background:transparent} }
@keyframes flash-down { 0%{background:transparent} 20%{background:rgba(248,113,113,.22)} 100%{background:transparent} }
@keyframes pulse-live { 0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,.5)} 50%{box-shadow:0 0 0 6px rgba(74,222,128,0)} }
.pd-alerts { display:flex; flex-direction:column; gap:10px; margin-bottom:28px; }
.pd-alert { display:flex; align-items:flex-start; gap:10px; padding:12px 16px; border-radius:10px; font-size:13px; }
.pd-alert-warn { background:#1c1400; border:1px solid #92400e; color:#fde68a; }
.pd-alert-info { background:#0c1a2e; border:1px solid #1e40af; color:#93c5fd; }
.pd-chat-wrap { background:${C.surface}; border:1px solid ${C.border}; border-radius:12px; overflow:hidden; display:flex; flex-direction:column; }
.pd-chat-msgs { padding:16px; min-height:200px; max-height:320px; overflow-y:auto; display:flex; flex-direction:column; gap:10px; flex:1; }
.pd-chat-bubble { max-width:82%; padding:10px 14px; border-radius:10px; font-size:13px; line-height:1.5; }
.pd-chat-user { background:${C.blue}; color:#fff; align-self:flex-end; border-radius:10px 10px 2px 10px; }
.pd-chat-ai { background:#161b22; border:1px solid ${C.border}; color:${C.text}; align-self:flex-start; border-radius:10px 10px 10px 2px; }
.pd-chat-input-row { display:flex; gap:8px; padding:12px 16px; border-top:1px solid ${C.border}; }
.pd-chat-input { flex:1; background:#161b22; border:1px solid ${C.border}; border-radius:8px; padding:8px 12px; color:${C.text}; font-size:13px; font-family:inherit; resize:none; }
.pd-chat-input:focus { outline:none; border-color:${C.blue}; }
.pd-chart-empty { display:flex; align-items:center; justify-content:center; flex-direction:column; gap:10px; min-height:260px; color:${C.muted}; font-size:13px; }
.pd-gate { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; background:${C.bg}; padding:24px; }
.pd-gate-card { background:${C.surface}; border:1px solid ${C.border}; border-radius:16px; padding:40px; max-width:420px; width:100%; text-align:center; }
.pd-gate-logo { font-size:28px; font-weight:800; color:${C.blue}; margin-bottom:8px; }
.pd-gate-subtitle { color:${C.subtext}; font-size:14px; margin-bottom:32px; }
.pd-gate-title { font-size:20px; font-weight:700; margin-bottom:8px; }
.pd-gate-features { text-align:left; margin:24px 0; display:flex; flex-direction:column; gap:10px; }
.pd-gate-feature { display:flex; align-items:center; gap:10px; font-size:13px; color:${C.subtext}; }
.pd-gate-feature span { color:${C.green}; font-size:16px; }
.pd-gate-divider { display:flex; align-items:center; gap:12px; margin:20px 0; color:${C.muted}; font-size:12px; }
.pd-gate-divider::before,.pd-gate-divider::after { content:''; flex:1; height:1px; background:${C.border}; }
.pd-sort-icon { margin-left:4px; opacity:.5; font-size:10px; }
.pd-sort-icon.active { opacity:1; color:${C.blue}; }
.pd-banner-mock { display:flex; align-items:center; gap:10px; padding:10px 24px; background:#1c1200; border-bottom:1px solid #92400e; color:#fde68a; font-size:13px; }
.pd-banner-live { display:flex; align-items:center; gap:8px; padding:10px 24px; background:#042010; border-bottom:1px solid #166534; color:#86efac; font-size:13px; }
.pd-alloc-bar { height:6px; border-radius:3px; margin-top:4px; margin-bottom:12px; transition:width .4s ease; }
`

function ConnectScreen({ onMock }) {
  const [loading, setLoading] = useState(false)
  async function handleConnect() {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/kite/login-url`)
      const data = await res.json()
      if (data.url) { window.location.href = data.url; return }
    } catch {}
    setLoading(false)
    onMock()
  }
  return (
    <div className="pd-gate">
      <style>{CSS}</style>
      <div className="pd-gate-card">
        <div className="pd-gate-logo">Nuvest</div>
        <div className="pd-gate-subtitle">AI Portfolio Manager</div>
        <div className="pd-gate-title">Connect your Zerodha account</div>
        <p style={{ fontSize: 13, color: C.subtext, marginBottom: 0 }}>
          Link Kite Connect to view live holdings, tax analysis, and AI-powered rebalancing advice.
        </p>
        <div className="pd-gate-features">
          <div className="pd-gate-feature"><span>✓</span> Live NSE/BSE holdings via Kite</div>
          <div className="pd-gate-feature"><span>✓</span> LTCG/STCG tax breakdown for FY</div>
          <div className="pd-gate-feature"><span>✓</span> 80C optimisation alerts</div>
          <div className="pd-gate-feature"><span>✓</span> AI copilot with Indian tax context</div>
        </div>
        <button className="pd-btn pd-btn-primary" style={{ width: '100%', padding: '12px', fontSize: 15 }} onClick={handleConnect} disabled={loading}>
          {loading ? 'Redirecting…' : 'Connect Kite →'}
        </button>
        <div className="pd-gate-divider">or</div>
        <button className="pd-btn pd-btn-ghost" style={{ width: '100%', padding: '10px' }} onClick={onMock}>
          View demo with mock data
        </button>
      </div>
    </div>
  )
}

export default function PortfolioDashboard() {
  const navigate = useNavigate()
  const location = useLocation()

  const [authState,      setAuthState]      = useState('checking')
  const [useMockData,    setUseMockData]    = useState(false)
  const [summary,        setSummary]        = useState(EMPTY_SUMMARY)
  const [holdings,       setHoldings]       = useState([])
  const [alerts,         setAlerts]         = useState([])
  const [loading,        setLoading]        = useState(true)
  const [refreshing,     setRefreshing]     = useState(false)
  const [flashMap,       setFlashMap]       = useState({})
  const prevPricesRef                       = useRef({})
  const [sortKey,        setSortKey]        = useState('current_value')
  const [sortDir,        setSortDir]        = useState(-1)
  const [lastUpdated,    setLastUpdated]    = useState(null)
  const [secondsAgo,     setSecondsAgo]     = useState('')
  const [isPolling,      setIsPolling]      = useState(false)
  const [selectedHolding,setSelectedHolding]= useState(null)
  const [chartType,      setChartType]      = useState('candle')
  const [chartData,      setChartData]      = useState([])
  const [chartLoading,   setChartLoading]   = useState(false)
  const [chatHistory,    setChatHistory]    = useState([
    { role: 'assistant', content: "Hi! I'm your AI portfolio copilot. Ask me about your holdings, tax strategy, or rebalancing." }
  ])
  const [chatInput,      setChatInput]      = useState('')
  const [chatLoading,    setChatLoading]    = useState(false)
  const chatEndRef                          = useRef(null)

  // Auth gate
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const rt     = params.get('request_token')
    const status = params.get('status')

    if (params.get('kite') === 'connected') {
      localStorage.setItem(LS_KEY, '1')
      window.history.replaceState({}, '', '/portfolio')
      setAuthState('connected')
      return
    }

    if (rt && status === 'success') {
      fetch(`${API_BASE}/kite/callback?request_token=${rt}`)
        .then(r => r.json())
        .then(d => {
          window.history.replaceState({}, '', '/portfolio')
          if (d.success) { localStorage.setItem(LS_KEY, '1'); setAuthState('connected') }
          else setAuthState('gate')
        })
        .catch(() => { window.history.replaceState({}, '', '/portfolio'); setAuthState('gate') })
      return
    }

    if (location.state?.kiteConnected) {
      localStorage.setItem(LS_KEY, '1')
      setAuthState('connected')
      return
    }

    fetch(`${API_BASE}/portfolio/summary?user_id=demo_user`)
      .then(r => r.json())
      .then(d => {
        if (d?.summary?.is_live) {
          localStorage.setItem(LS_KEY, '1')
          setAuthState('connected')
        } else if (localStorage.getItem(LS_KEY) === '1' || localStorage.getItem('kiteConnected') === 'true') {
          setAuthState('connected')
        } else {
          setAuthState('gate')
        }
      })
      .catch(() => {
        if (localStorage.getItem(LS_KEY) === '1') setAuthState('connected')
        else setAuthState('gate')
      })
  }, [])

  const applyHoldings = useCallback((raw) => {
    const newFlash = {}
    raw.forEach(h => {
      const prev = prevPricesRef.current[h.tradingsymbol]
      const curr = Number(h.last_price) || 0
      if (prev !== undefined && curr !== prev)
        newFlash[h.tradingsymbol] = curr > prev ? 'up' : 'down'
      prevPricesRef.current[h.tradingsymbol] = curr
    })
    if (Object.keys(newFlash).length) {
      setFlashMap(newFlash)
      setTimeout(() => setFlashMap({}), 1400)
    }
    setHoldings(raw)
    setLastUpdated(Date.now())
  }, [])

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    try {
      if (useMockData) {
        setSummary(MOCK_PORTFOLIO)
        setAlerts([
          { type: 'warning', text: '₹0 of 80C limit unused — fully invested this FY.' },
          { type: 'info',    text: 'LTCG at ₹18,200 — well within ₹1L exempt limit.' },
        ])
        setIsPolling(false)
        applyHoldings(MOCK_HOLDINGS)
      } else {
        const data = await fetchSummary()
        const s    = data.summary || data
        const remaining_80c = s.remaining_80c != null
          ? s.remaining_80c
          : Math.max(0, 150000 - (s.elss_invested || 0) - (s.ppf_invested || 0))
        const allocation = s.allocation || {
          equity:  (s.equity_pct  || 0) * (s.total_value || 0),
          debt:    (s.debt_pct    || 0) * (s.total_value || 0),
          gold:    (s.gold_pct    || 0) * (s.total_value || 0),
          pension: (s.pension_pct || 0) * (s.total_value || 0),
        }
        setSummary({ ...EMPTY_SUMMARY, ...s, remaining_80c, allocation })
        setAlerts(data.alerts || [])
        setIsPolling(s.is_live || false)
        applyHoldings(data.holdings || [])
      }
    } catch { /* keep stale */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [applyHoldings, useMockData])

  const active = authState === 'connected' || useMockData

  useEffect(() => { if (active) loadData(false) }, [active])

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => loadData(true), POLL_SUM)
    return () => clearInterval(id)
  }, [active, loadData])

  useEffect(() => {
    if (!isPolling) return
    const id = setInterval(async () => {
      try {
        const res  = await fetch(`${API_BASE}/portfolio/holdings?user_id=demo_user`)
        const data = await res.json()
        applyHoldings(data.holdings || [])
      } catch {}
    }, POLL_LIVE)
    return () => clearInterval(id)
  }, [isPolling, applyHoldings])

  useEffect(() => {
    if (!lastUpdated) return
    const id = setInterval(() => {
      const s = Math.round((Date.now() - lastUpdated) / 1000)
      setSecondsAgo(s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`)
    }, 1000)
    return () => clearInterval(id)
  }, [lastUpdated])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatHistory])

  async function handleSelectHolding(h) {
    setSelectedHolding(h)
    setChartLoading(true)
    try {
      if (isPolling) {
        const res = await fetch(`${API_BASE}/portfolio/historical?symbol=${h.tradingsymbol}&exchange=${h.exchange}&days=30`)
        if (res.ok) {
          const d = await res.json()
          if (d.candles?.length) { setChartData(d.candles); setChartLoading(false); return }
        }
      }
      setChartData(generateMockOHLCV(Number(h.last_price)))
    } catch {
      setChartData(generateMockOHLCV(Number(h.last_price)))
    } finally {
      setChartLoading(false)
    }
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => -d)
    else { setSortKey(key); setSortDir(-1) }
  }

  const sorted = [...holdings].sort((a, b) => {
    if (sortKey === 'tradingsymbol') return sortDir * a.tradingsymbol.localeCompare(b.tradingsymbol)
    return sortDir * ((Number(a[sortKey]) || 0) - (Number(b[sortKey]) || 0))
  })

  async function handleChat(e) {
    e?.preventDefault()
    if (!chatInput.trim() || chatLoading) return
    const userMsg = chatInput.trim()
    setChatInput('')
    const newHistory = [...chatHistory, { role: 'user', content: userMsg }]
    setChatHistory(newHistory)
    setChatLoading(true)
    try {
      const data = await sendChatMessage(userMsg, 'demo_user', newHistory.slice(-6))
      setChatHistory(h => [...h, { role: 'assistant', content: data.response || data.reply || 'No response.' }])
    } catch {
      setChatHistory(h => [...h, { role: 'assistant', content: 'Connection error — please retry.' }])
    } finally {
      setChatLoading(false)
    }
  }

  const alloc        = summary.allocation || {}
  const allocTotal   = Object.values(alloc).reduce((s, v) => s + (Number(v) || 0), 0) || 1
  const donutData    = Object.entries(alloc).filter(([, v]) => (Number(v) || 0) > 0).map(([k, v]) => ({ name: k, value: Number(v) || 0 }))
  const totalPnlPos  = (summary.total_pnl || 0) >= 0
  const totalPnlColor = totalPnlPos ? C.green : C.red

  function tagClass(tag) {
    const t = (tag || '').toLowerCase()
    if (t === 'elss') return 'pd-tag pd-tag-elss'
    if (t === 'sgb')  return 'pd-tag pd-tag-sgb'
    if (t === 'debt' || t === 'ppf')    return 'pd-tag pd-tag-debt'
    if (t === 'pension' || t === 'nps') return 'pd-tag pd-tag-pension'
    return 'pd-tag pd-tag-equity'
  }

  function Th({ k, label }) {
    const isActive = sortKey === k
    return (
      <th onClick={() => toggleSort(k)}>
        {label}
        <span className={`pd-sort-icon ${isActive ? 'active' : ''}`}>
          {isActive ? (sortDir === -1 ? ' ↓' : ' ↑') : ' ⇅'}
        </span>
      </th>
    )
  }

  // Chart title color based on selected holding's day change
  const selDayChg = selectedHolding ? (Number(selectedHolding.change_percent) || 0) : 0
  const selDayCol = selDayChg >= 0 ? C.green : C.red

  if (authState === 'checking') {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{CSS}</style>
        <div style={{ color: C.muted, fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  if (authState === 'gate' && !useMockData) {
    return <ConnectScreen onMock={() => { setUseMockData(true); setAuthState('connected') }} />
  }

  return (
    <div className="pd-root">
      <style>{CSS}</style>

      {/* Nav */}
      <nav className="pd-nav">
        <div className="pd-nav-left">
          <span className="pd-logo">Nuvest</span>
          <span className={`pd-live-dot ${isPolling ? 'active' : ''}`} />
          {isPolling && <span className="pd-live-label">Live</span>}
          {useMockData && <span className="pd-mock-badge">Demo data</span>}
        </div>
        <div className="pd-nav-right">
          {secondsAgo && <span className="pd-updated">Updated {secondsAgo}</span>}
          <button className="pd-btn pd-btn-ghost" onClick={() => loadData(true)} disabled={refreshing}>
            {refreshing ? '⟳ Refreshing…' : '⟳ Refresh'}
          </button>
          <button className="pd-btn pd-btn-ghost" onClick={() => navigate('/invest')}>Marketplace</button>
          {!useMockData && (
            <button className="pd-btn pd-btn-ghost" onClick={() => {
              localStorage.removeItem(LS_KEY); localStorage.removeItem('kiteConnected'); setAuthState('gate')
            }}>Disconnect</button>
          )}
        </div>
      </nav>

      {/* Mode banner */}
      {useMockData ? (
        <div className="pd-banner-mock">
          <span>⚠</span> Showing demo data — connect Kite for your live portfolio
          <button className="pd-btn pd-btn-primary" style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 12 }}
            onClick={async () => { try { const r = await fetch(`${API_BASE}/kite/login-url`); const d = await r.json(); if (d.url) window.location.href = d.url } catch {} }}>
            Connect Kite →
          </button>
        </div>
      ) : isPolling ? (
        <div className="pd-banner-live">
          <span className="pd-live-dot active" style={{ width: 7, height: 7 }} />
          Live · {secondsAgo ? `Last updated ${secondsAgo}` : 'Fetching live prices…'}
        </div>
      ) : null}

      <div className="pd-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: C.muted }}>Loading portfolio…</div>
        ) : (
          <>
            {/* ── Metric Strip ── */}
            <div className="pd-metric-strip">
              <div className="pd-metric">
                <div className="pd-metric-label">Portfolio Value</div>
                <div className="pd-metric-value">{fmt(summary.total_value)}</div>
                <div className="pd-metric-sub">Invested: {fmt(summary.total_invested)}</div>
              </div>
              <div className="pd-metric">
                <div className="pd-metric-label">Total P&L</div>
                <div className="pd-metric-value" style={{ color: totalPnlColor }}>
                  {totalPnlPos ? '▲ ' : '▼ '}{fmt(Math.abs(summary.total_pnl))}
                </div>
                <div className="pd-metric-sub" style={{ color: totalPnlColor }}>{fmtPct(summary.xirr_pct)} overall</div>
              </div>
              <div className="pd-metric">
                <div className="pd-metric-label">LTCG This FY</div>
                <div className="pd-metric-value" style={{ color: (summary.ltcg_this_fy || 0) > 80000 ? C.red : C.text }}>
                  {fmt(summary.ltcg_this_fy)}
                </div>
                <div className="pd-metric-sub">₹1L exempt limit</div>
              </div>
              <div className="pd-metric">
                <div className="pd-metric-label">80C Remaining</div>
                <div className="pd-metric-value" style={{ color: (summary.remaining_80c || 0) > 0 ? C.gold : C.green }}>
                  {fmt(summary.remaining_80c)}
                </div>
                <div className="pd-metric-sub">of ₹1.5L limit</div>
              </div>
              <div className="pd-metric">
                <div className="pd-metric-label">Equity Weight</div>
                <div className="pd-metric-value" style={{ color: (summary.equity_pct || 0) > 0.65 ? C.red : C.text }}>
                  {((summary.equity_pct || 0) * 100).toFixed(1)}%
                </div>
                <div className="pd-metric-sub">Target ≤ 65%</div>
              </div>
            </div>

            {/* ── Alerts ── */}
            {alerts.length > 0 && (
              <div className="pd-alerts">
                {alerts.map((a, i) => (
                  <div key={i} className={`pd-alert ${a.type === 'warning' ? 'pd-alert-warn' : 'pd-alert-info'}`}>
                    <span>{a.type === 'warning' ? '⚠' : 'ℹ'}</span>
                    <span>{a.text || a.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Main Grid: Holdings | Chart ── */}
            <div className="pd-grid">
              {/* Holdings Table */}
              <div className="pd-card">
                <div className="pd-card-header">
                  <span className="pd-card-title">Holdings ({sorted.length})</span>
                  <span style={{ fontSize: 12, color: C.muted }}>Click a row to view chart</span>
                </div>
                <div className="pd-table-wrap">
                  <table className="pd-table">
                    <thead>
                      <tr>
                        <Th k="tradingsymbol" label="Symbol" />
                        <Th k="quantity"      label="Qty" />
                        <Th k="last_price"    label="LTP" />
                        <Th k="change_percent"label="Day %" />
                        <Th k="current_value" label="Value" />
                        <Th k="pnl"           label="P&L" />
                        <Th k="return_pct"    label="Return" />
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map(h => {
                        const sym      = h.tradingsymbol
                        const flash    = flashMap[sym]
                        const pnl      = Number(h.pnl) || 0
                        const ret      = Number(h.return_pct) || 0
                        const dayChg   = Number(h.change_percent) || 0
                        const isSelected = selectedHolding?.tradingsymbol === sym
                        return (
                          <tr
                            key={sym}
                            className={isSelected ? 'pd-row-sel' : ''}
                            onClick={() => handleSelectHolding(h)}
                          >
                            <td>
                              {sym}
                              {h.tag && <span className={tagClass(h.tag)}>{h.tag}</span>}
                            </td>
                            <td>{fmtNum(h.quantity)}</td>
                            <td className={flash === 'up' ? 'fu' : flash === 'down' ? 'fd' : ''}>
                              {fmt(h.last_price)}
                            </td>
                            <td className={dayChg >= 0 ? 'pd-pos' : 'pd-neg'}>
                              {dayChg >= 0 ? '▲' : '▼'} {Math.abs(dayChg).toFixed(2)}%
                            </td>
                            <td>{fmt(h.current_value)}</td>
                            <td className={pnl >= 0 ? 'pd-pos' : 'pd-neg'}>
                              {pnl >= 0 ? '▲' : '▼'} {fmt(Math.abs(pnl))}
                            </td>
                            <td className={ret >= 0 ? 'pd-pos' : 'pd-neg'}>{fmtPct(ret)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Chart Panel */}
              <div className="pd-card">
                {selectedHolding ? (
                  <>
                    <div className="pd-card-header">
                      <div>
                        <span className="pd-card-title">{selectedHolding.tradingsymbol}</span>
                        <span style={{ marginLeft: 10, fontSize: 13, color: selDayCol, fontWeight: 600 }}>
                          {selDayChg >= 0 ? '▲' : '▼'} {fmt(selectedHolding.last_price)}
                          {'  '}{fmtPct(selDayChg)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className={`pd-btn pd-btn-ghost ${chartType === 'candle' ? 'active' : ''}`} style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setChartType('candle')}>
                          Candlestick
                        </button>
                        <button className={`pd-btn pd-btn-ghost ${chartType === 'line' ? 'active' : ''}`} style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setChartType('line')}>
                          Line
                        </button>
                      </div>
                    </div>
                    <div style={{ padding: '12px 8px 8px' }}>
                      {chartLoading ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted, fontSize: 13 }}>Loading chart…</div>
                      ) : chartType === 'candle' ? (
                        <CandlestickChart data={chartData} height={230} />
                      ) : (
                        <ResponsiveContainer width="100%" height={230}>
                          <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                            <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.muted }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 9, fill: C.muted }} domain={['auto', 'auto']} tickFormatter={v => v >= 1000 ? (v/1000).toFixed(1)+'K' : v} width={44} />
                            <Tooltip
                              contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}
                              formatter={v => [fmt(v), 'Close']}
                            />
                            <Line type="monotone" dataKey="close" stroke={selDayChg >= 0 ? C.green : C.red} dot={false} strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                      <div style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 4 }}>Last 30 days</div>
                    </div>
                  </>
                ) : (
                  <div className="pd-chart-empty">
                    <span style={{ fontSize: 28 }}>📈</span>
                    <span>Click any holding to view its chart</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Bottom Row: AI Copilot + Allocation ── */}
            <div className="pd-bottom-row">
              {/* AI Copilot — 60% */}
              <div className="pd-chat-wrap" style={{ flex: '0 0 60%', minWidth: 0 }}>
                <div className="pd-card-header">
                  <span className="pd-card-title">AI Copilot</span>
                  <span style={{ fontSize: 12, color: C.muted }}>India tax context</span>
                </div>
                <div className="pd-chat-msgs">
                  {chatHistory.map((m, i) => (
                    <div key={i} className={`pd-chat-bubble ${m.role === 'user' ? 'pd-chat-user' : 'pd-chat-ai'}`}>
                      {m.content}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="pd-chat-bubble pd-chat-ai" style={{ color: C.muted }}>Thinking…</div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <form className="pd-chat-input-row" onSubmit={handleChat}>
                  <textarea
                    className="pd-chat-input"
                    rows={1}
                    placeholder="Ask about LTCG, 80C, rebalancing…"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat() } }}
                  />
                  <button type="submit" className="pd-btn pd-btn-primary" disabled={chatLoading || !chatInput.trim()}>Send</button>
                </form>
              </div>

              {/* Allocation — 40% */}
              <div className="pd-card" style={{ flex: '1 1 0', minWidth: 0 }}>
                <div className="pd-card-header">
                  <span className="pd-card-title">Allocation</span>
                </div>
                <div className="pd-card-body">
                  {donutData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={donutData} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2}>
                            {donutData.map(entry => (
                              <Cell key={entry.name} fill={DONUT_COLORS[entry.name] || '#555'} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={v => fmt(v)}
                            contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                        {donutData.map(d => {
                          const pct = ((d.value / allocTotal) * 100).toFixed(1)
                          const col = DONUT_COLORS[d.name] || '#555'
                          return (
                            <div key={d.name}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, display: 'inline-block' }} />
                                  {d.name.charAt(0).toUpperCase() + d.name.slice(1)}
                                </span>
                                <span style={{ color: C.subtext }}>{pct}% · {fmt(d.value)}</span>
                              </div>
                              <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 3, transition: 'width .4s ease' }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', color: C.muted, padding: '40px 0', fontSize: 13 }}>No allocation data</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
