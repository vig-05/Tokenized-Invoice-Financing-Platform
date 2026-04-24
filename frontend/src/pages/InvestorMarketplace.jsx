import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectWallet, getTotalSupply, getInvoiceData, getExpectedReturnBps, fundInvoice, simulateBuyerPayment, STATUS_LABELS } from '../utils/contract'
import { ethers } from 'ethers'
import { fetchSummary } from '../utils/api'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8001'

const s = {
  page: { minHeight: '100vh', padding: '80px 24px 60px', maxWidth: 960, margin: '0 auto' },
  nav: { position: 'fixed', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', zIndex: 50, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', background: 'linear-gradient(to bottom,rgba(5,8,15,.8),rgba(5,8,15,.3))', borderBottom: '1px solid var(--line)' },
  brand: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textDecoration: 'none', color: 'var(--ink-0)', fontSize: 20, fontWeight: 700 },
  mark: { width: 22, height: 22, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%,#a8c0ff,#3b5fd4 55%,#0a1020 100%)', boxShadow: '0 0 14px rgba(91,140,255,.55)', flexShrink: 0 },
  kicker: { fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 },
  dot: { width: 6, height: 6, borderRadius: '50%', background: '#6ee7a7', boxShadow: '0 0 8px #6ee7a7' },
  h1: { fontSize: 'clamp(28px,4.5vw,52px)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 12, color: 'var(--ink-0)' },
  lead: { color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.6, maxWidth: '54ch', marginBottom: 40 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 },
  card: { padding: '22px 24px', border: '1px solid var(--line)', borderRadius: 16, background: 'rgba(14,23,48,.55)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', gap: 14 },
  btn: { padding: '11px 22px', borderRadius: 999, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 },
  btnSec: { padding: '11px 22px', borderRadius: 999, border: '1px solid var(--line-2)', background: 'rgba(255,255,255,.03)', color: 'var(--ink-1)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 },
  pill: (color) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', background: `${color}18`, color, border: `1px solid ${color}40` }),
  walletPill: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, border: '1px solid var(--line-2)', background: 'rgba(91,140,255,.06)', fontSize: 12, color: 'var(--ink-1)' },
  err: { padding: '14px 18px', borderRadius: 12, border: '1px solid rgba(248,113,113,.3)', background: 'rgba(248,113,113,.06)', color: '#f87171', fontSize: 13, marginTop: 12 },
  success: { padding: '14px 18px', borderRadius: 12, border: '1px solid rgba(110,231,167,.3)', background: 'rgba(110,231,167,.06)', color: '#6ee7a7', fontSize: 13, marginTop: 12 },
}

const STATUS_COLORS = { LISTED: '#7aa2ff', FUNDED: '#fbbf24', SETTLED: '#6ee7a7', DEFAULTED: '#f87171' }
const BUYER_NAMES = { 3: 'Reliance Retail Ltd', 2: 'Tata Consumer Products', 1: 'HCL Technologies', 0: 'Unknown Buyer' }

// Sample invoices for demo when chain has no data or no MetaMask
const DEMO_INVOICES = [
  { tokenId: 'DEMO-0', buyer: 'Reliance Retail Ltd', score: 91, verdict: 'LOW_RISK', invoiceAmountInr: 1000000, advanceAmountInr: 920000, returnPct: 8.7, dueDays: 60, status: 'LISTED', demo: true },
  { tokenId: 'DEMO-1', buyer: 'Tata Consumer Products', score: 78, verdict: 'LOW_RISK', invoiceAmountInr: 500000, advanceAmountInr: 450000, returnPct: 7.2, dueDays: 45, status: 'LISTED', demo: true },
  { tokenId: 'DEMO-2', buyer: 'HCL Technologies', score: 65, verdict: 'MEDIUM_RISK', invoiceAmountInr: 250000, advanceAmountInr: 210000, returnPct: 6.1, dueDays: 30, status: 'FUNDED', demo: true },
]

function fmt(n) { return Number(n).toLocaleString('en-IN') }
function short(addr) { return addr ? addr.slice(0, 6) + '…' + addr.slice(-4) : '' }
function daysUntil(ts) { return Math.max(0, Math.round((Number(ts) * 1000 - Date.now()) / 86400000)) }

export default function InvestorMarketplace() {
  const navigate = useNavigate()
  const [wallet, setWallet] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [invoices, setInvoices] = useState(DEMO_INVOICES)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [txState, setTxState] = useState({})   // tokenId → { busy, error, success }
  const [kiteModal, setKiteModal] = useState(false)
  const [kiteChecking, setKiteChecking] = useState(false)
  const modalRef = useRef(null)

  // Handle Kite OAuth callback: /invest?request_token=XXX&status=success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestToken = params.get('request_token')
    const status = params.get('status')
    if (!requestToken || status !== 'success') return

    fetch(`${API_BASE}/kite/callback?request_token=${requestToken}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          localStorage.setItem('kiteConnected', 'true')
          window.history.replaceState({}, '', '/invest')
          navigate('/portfolio')
        }
      })
      .catch(() => {
        window.history.replaceState({}, '', '/invest')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // close modal on outside click
  useEffect(() => {
    if (!kiteModal) return
    function onDown(e) { if (modalRef.current && !modalRef.current.contains(e.target)) setKiteModal(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [kiteModal])

  async function handleViewPortfolio() {
    setKiteChecking(true)
    try {
      const data = await fetchSummary('demo_user')
      if (data?.summary?.is_live) {
        navigate('/portfolio')
      } else {
        setKiteModal(true)
      }
    } catch {
      setKiteModal(true)
    } finally {
      setKiteChecking(false)
    }
  }

  async function handleConnectKite() {
    try {
      const res = await fetch(`${API_BASE}/kite/login-url`)
      if (!res.ok) throw new Error('no url')
      const { url } = await res.json()
      window.location.href = url
    } catch {
      alert('Could not reach backend to get Kite login URL. Make sure the server is running.')
    }
  }

  const handleConnect = useCallback(async () => {
    setConnecting(true)
    try {
      const w = await connectWallet()
      setWallet(w)
      loadChainInvoices(w.provider)
    } catch (e) {
      alert(e.message)
    } finally {
      setConnecting(false)
    }
  }, [])

  async function loadChainInvoices(provider) {
    setLoading(true); setLoadError('')
    try {
      const total = await getTotalSupply(provider)
      if (total === 0) { setLoading(false); return }
      const items = []
      for (let i = 0; i < total; i++) {
        const { inv, entry } = await getInvoiceData(provider, i)
        let returnBps = 0
        try { returnBps = await getExpectedReturnBps(provider, i) } catch { }
        items.push({
          tokenId: i,
          buyer: BUYER_NAMES[inv.riskScore >= 80 ? 3 : inv.riskScore >= 65 ? 2 : 1] || 'Corporate Buyer',
          score: Number(inv.riskScore),
          verdict: inv.riskScore >= 70 ? 'LOW_RISK' : 'MEDIUM_RISK',
          invoiceAmountWei: inv.invoiceAmount,
          advanceAmountWei: entry.advanceAmount,
          invoiceAmountInr: Math.round(Number(ethers.formatEther(inv.invoiceAmount)) * 10_000_000),
          advanceAmountInr: Math.round(Number(ethers.formatEther(entry.advanceAmount)) * 10_000_000),
          returnPct: (returnBps / 100).toFixed(2),
          dueDate: Number(entry.dueDate),
          dueDays: daysUntil(entry.dueDate),
          status: STATUS_LABELS[Number(inv.status)],
          smeWallet: inv.smeWallet,
          investorWallet: inv.investorWallet,
          demo: false,
        })
      }
      setInvoices(items)
    } catch (e) {
      setLoadError('Could not load invoices from chain — showing demo data')
    } finally {
      setLoading(false)
    }
  }

  async function handleFund(inv) {
    if (!wallet) { alert('Connect MetaMask first'); return }
    if (inv.demo) { alert('This is demo data. Deploy a real invoice from the SME Dashboard first.'); return }
    const id = inv.tokenId
    setTxState(p => ({ ...p, [id]: { busy: true, error: '', success: '' } }))
    try {
      await fundInvoice(wallet.signer, id, inv.advanceAmountWei)
      setTxState(p => ({ ...p, [id]: { busy: false, error: '', success: `Funded! ₹${fmt(inv.advanceAmountInr)} sent to SME.` } }))
      loadChainInvoices(wallet.provider)
    } catch (e) {
      setTxState(p => ({ ...p, [id]: { busy: false, error: e.message || 'Transaction failed', success: '' } }))
    }
  }

  async function handleSettle(inv) {
    if (!wallet) { alert('Connect MetaMask first'); return }
    if (inv.demo) { alert('This is demo data. Use a real on-chain invoice.'); return }
    const id = inv.tokenId
    setTxState(p => ({ ...p, [id]: { busy: true, error: '', success: '' } }))
    try {
      await simulateBuyerPayment(wallet.signer, id, inv.invoiceAmountWei)
      setTxState(p => ({ ...p, [id]: { busy: false, error: '', success: `Settled! ₹${fmt(inv.invoiceAmountInr * 0.99)} paid out.` } }))
      loadChainInvoices(wallet.provider)
    } catch (e) {
      setTxState(p => ({ ...p, [id]: { busy: false, error: e.message || 'Transaction failed', success: '' } }))
    }
  }

  const listed = invoices.filter(i => i.status === 'LISTED')
  const funded = invoices.filter(i => i.status === 'FUNDED')
  const settled = invoices.filter(i => ['SETTLED', 'DEFAULTED'].includes(i.status))

  return (
    <>
      <nav style={s.nav}>
        <div style={s.brand} onClick={() => navigate('/')}>
          <span style={s.mark} />
          Nuvest
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {wallet
            ? <div style={s.walletPill}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6ee7a7', boxShadow: '0 0 6px #6ee7a7' }} />
              {short(wallet.address)}
            </div>
            : <button style={{ ...s.btnSec, fontSize: 12 }} onClick={handleConnect} disabled={connecting}>
              {connecting ? 'Connecting…' : 'Connect MetaMask'}
            </button>
          }
          <div style={{ position: 'relative' }}>
            <button
              style={{ ...s.btnSec, fontSize: 12 }}
              onClick={handleViewPortfolio}
              disabled={kiteChecking}
            >
              {kiteChecking
                ? <><SpinIcon />Checking…</>
                : <><ChartIcon />View Portfolio</>}
            </button>

            {kiteModal && (
              <div
                ref={modalRef}
                style={{
                  position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                  width: 280, zIndex: 100,
                  background: 'rgba(8,14,30,0.98)',
                  border: '1px solid var(--line)',
                  borderRadius: 14,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                  padding: '20px',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-0)', marginBottom: 8, lineHeight: 1.4 }}>
                  Connect your Zerodha account to view live portfolio
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 18 }}>
                  Nuvest fetches your live holdings via Kite Connect to show tax insights and AI rebalancing advice.
                </div>
                <button
                  onClick={handleConnectKite}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}
                >
                  Connect Kite →
                </button>
                <button
                  onClick={() => { setKiteModal(false); navigate('/portfolio') }}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--ink-3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Skip for now (view mock data)
                </button>
              </div>
            )}
          </div>

          <button style={s.btnSec} onClick={() => navigate('/')}>← Home</button>
        </div>
      </nav>

      <div style={s.page}>
        <div style={s.kicker}><span style={s.dot} />Investor Track · Invoice Marketplace</div>
        <h1 style={s.h1}>Browse invoice tokens.<br />Earn 12–18% yield.</h1>
        <p style={s.lead}>
          Fund AI-scored invoices from verified SMEs. Smart contracts hold the advance and release your payout automatically on due date.
        </p>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 40, flexWrap: 'wrap' }}>
          {[
            ['Available', listed.length, '#7aa2ff'],
            ['Funded', funded.length, '#fbbf24'],
            ['Settled', settled.length, '#6ee7a7'],
            ['Min ticket', '₹1,000', 'var(--ink-2)'],
            ['Target yield', '12–18%', 'var(--ink-2)'],
          ].map(([l, v, c]) => (
            <div key={l} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--line)', background: 'rgba(14,23,48,.4)', display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: c }}>{v}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</span>
            </div>
          ))}
          {!wallet && (
            <button style={{ ...s.btn, marginLeft: 'auto' }} onClick={handleConnect} disabled={connecting}>
              {connecting ? <><SpinIcon />Connecting…</> : 'Connect & Load Chain →'}
            </button>
          )}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', color: 'var(--ink-2)', padding: '40px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <SpinIcon /> Loading invoices from Polygon Amoy…
          </div>
        )}
        {loadError && <div style={s.err}>{loadError} — showing sample data below.</div>}

        {/* Available invoices */}
        {listed.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14, fontWeight: 600 }}>
              Available to Fund
            </div>
            <div style={{ ...s.grid, marginBottom: 36 }}>
              {listed.map(inv => (
                <InvoiceCard key={inv.tokenId} inv={inv} tx={txState[inv.tokenId]} onFund={() => handleFund(inv)} />
              ))}
            </div>
          </>
        )}

        {/* Funded invoices */}
        {funded.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14, fontWeight: 600 }}>
              Funded — Awaiting Settlement
            </div>
            <div style={{ ...s.grid, marginBottom: 36 }}>
              {funded.map(inv => (
                <InvoiceCard key={inv.tokenId} inv={inv} tx={txState[inv.tokenId]} onSettle={() => handleSettle(inv)} />
              ))}
            </div>
          </>
        )}

        {/* Settled invoices */}
        {settled.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14, fontWeight: 600 }}>
              Settled / Defaulted
            </div>
            <div style={s.grid}>
              {settled.map(inv => (
                <InvoiceCard key={inv.tokenId} inv={inv} tx={txState[inv.tokenId]} />
              ))}
            </div>
          </>
        )}

        {invoices.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-2)' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📭</div>
            <div style={{ fontSize: 15, marginBottom: 8 }}>No invoices on chain yet.</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 24 }}>List your first invoice from the SME Dashboard.</div>
            <button style={s.btn} onClick={() => navigate('/sme')}>Go to SME Dashboard →</button>
          </div>
        )}

        {/* Portfolio summary (when wallet connected) */}
        {wallet && (
          <div style={{ marginTop: 48, padding: '24px 28px', border: '1px solid var(--line)', borderRadius: 16, background: 'rgba(14,23,48,.4)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16, fontWeight: 600 }}>
              Your wallet
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>ADDRESS</div>
                <div style={{ fontSize: 13, color: 'var(--ink-1)', fontFamily: 'monospace' }}>{wallet.address}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                <a
                  href={`https://amoy.polygonscan.com/address/${wallet.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...s.btnSec, textDecoration: 'none' }}
                >
                  View on Polygonscan →
                </a>
                <button style={s.btnSec} onClick={() => loadChainInvoices(wallet.provider)}>
                  ↻ Refresh
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function InvoiceCard({ inv, tx, onFund, onSettle }) {
  const statusColor = STATUS_COLORS[inv.status] || 'var(--ink-2)'
  const isListed = inv.status === 'LISTED'
  const isFunded = inv.status === 'FUNDED'
  const isSettled = inv.status === 'SETTLED'
  const verdictColor = inv.score >= 70 ? '#6ee7a7' : inv.score >= 50 ? '#fbbf24' : '#f87171'

  return (
    <div style={{ padding: '22px 24px', border: '1px solid var(--line)', borderRadius: 16, background: 'rgba(14,23,48,.55)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-0)', marginBottom: 4 }}>{inv.buyer}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'monospace' }}>
            {inv.demo ? 'DEMO' : `Token #${inv.tokenId}`}
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}40` }}>
          {inv.status}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Stat label="Invoice" value={`₹${fmt(inv.invoiceAmountInr)}`} />
        <Stat label="Advance" value={`₹${fmt(inv.advanceAmountInr)}`} />
        <Stat label="AI Score" value={`${inv.score}/100`} color={verdictColor} />
        <Stat label="Expected return" value={`${inv.returnPct}%`} color="#6ee7a7" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--ink-3)' }}>
        <span>Due in {inv.dueDate ? `${daysUntil(inv.dueDate)} days` : `${inv.dueDays} days`}</span>
        <span style={{ padding: '2px 10px', borderRadius: 999, background: `${verdictColor}15`, color: verdictColor, fontWeight: 600, fontSize: 11 }}>
          {inv.verdict?.replace('_', ' ')}
        </span>
      </div>

      {isListed && onFund && (
        <button
          style={{ ...btnStyle, background: 'var(--accent)' }}
          onClick={onFund}
          disabled={tx?.busy}
        >
          {tx?.busy ? <><SpinIcon />Funding…</> : `Fund ₹${fmt(inv.advanceAmountInr)} →`}
        </button>
      )}

      {isFunded && onSettle && (
        <button
          style={{ ...btnStyle, background: '#6ee7a7', color: '#0a1f14' }}
          onClick={onSettle}
          disabled={tx?.busy}
        >
          {tx?.busy ? <><SpinIcon />Settling…</> : 'Simulate Buyer Payment →'}
        </button>
      )}

      {isSettled && (
        <div style={{ fontSize: 12, color: '#6ee7a7', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>✓</span> Invoice settled — payout released
        </div>
      )}

      {tx?.success && <div style={{ fontSize: 13, color: '#6ee7a7', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(110,231,167,.25)', background: 'rgba(110,231,167,.06)' }}>{tx.success}</div>}
      {tx?.error && <div style={{ fontSize: 12, color: '#f87171', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(248,113,113,.25)', background: 'rgba(248,113,113,.06)', wordBreak: 'break-word' }}>{tx.error}</div>}
    </div>
  )
}

const btnStyle = { width: '100%', padding: '12px', borderRadius: 999, border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }

function Stat({ label, value, color }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid var(--line)' }}>
      <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color || 'var(--ink-0)' }}>{value}</div>
    </div>
  )
}

function SpinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}
