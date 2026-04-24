import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectWallet, listInvoice, makeInvoiceHash } from '../utils/contract'
import { scoreInvoice } from '../utils/api'

const s = {
  page:    { minHeight: '100vh', padding: '80px 24px 60px', maxWidth: 820, margin: '0 auto' },
  nav:     { position: 'fixed', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', zIndex: 50, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', background: 'linear-gradient(to bottom,rgba(5,8,15,.8),rgba(5,8,15,.3))', borderBottom: '1px solid var(--line)' },
  brand:   { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textDecoration: 'none', color: 'var(--ink-0)', fontSize: 20, fontWeight: 700 },
  mark:    { width: 22, height: 22, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%,#a8c0ff,#3b5fd4 55%,#0a1020 100%)', boxShadow: '0 0 14px rgba(91,140,255,.55)', flexShrink: 0 },
  kicker:  { fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 },
  dot:     { width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' },
  h1:      { fontSize: 'clamp(28px,4.5vw,52px)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 12, color: 'var(--ink-0)' },
  lead:    { color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.6, maxWidth: '54ch', marginBottom: 40 },
  card:    { padding: '24px 28px', border: '1px solid var(--line)', borderRadius: 16, background: 'rgba(14,23,48,.55)', marginBottom: 24, backdropFilter: 'blur(8px)' },
  label:   { fontSize: 12, color: 'var(--ink-2)', marginBottom: 8, letterSpacing: '0.05em', fontWeight: 500 },
  input:   { width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--line-2)', background: 'rgba(255,255,255,.04)', color: 'var(--ink-0)', fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: 16 },
  row:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  btn:     { padding: '12px 24px', borderRadius: 999, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8 },
  btnSec:  { padding: '12px 24px', borderRadius: 999, border: '1px solid var(--line-2)', background: 'rgba(255,255,255,.03)', color: 'var(--ink-1)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  badge:   (score) => ({ display: 'inline-block', padding: '4px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: score >= 70 ? 'rgba(110,231,167,.15)' : score >= 50 ? 'rgba(251,191,36,.15)' : 'rgba(248,113,113,.15)', color: score >= 70 ? '#6ee7a7' : score >= 50 ? '#fbbf24' : '#f87171', border: `1px solid ${score >= 70 ? 'rgba(110,231,167,.3)' : score >= 50 ? 'rgba(251,191,36,.3)' : 'rgba(248,113,113,.3)'}` }),
  progress:(v, color) => ({ height: 6, borderRadius: 3, background: 'var(--line)', overflow: 'hidden', marginTop: 6, marginBottom: 12 }),
  bar:     (v, color) => ({ height: '100%', width: `${Math.abs(v)}%`, background: color, borderRadius: 3, transition: 'width .6s ease' }),
  walletPill: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, border: '1px solid var(--line-2)', background: 'rgba(91,140,255,.06)', fontSize: 12, color: 'var(--ink-1)', cursor: 'pointer' },
  success: { padding: '20px 24px', borderRadius: 12, border: '1px solid rgba(110,231,167,.3)', background: 'rgba(110,231,167,.06)', marginTop: 20 },
  err:     { padding: '16px 20px', borderRadius: 12, border: '1px solid rgba(248,113,113,.3)', background: 'rgba(248,113,113,.06)', color: '#f87171', fontSize: 14, marginTop: 16 },
}

const BUYERS = ['Reliance Retail Ltd', 'Tata Consumer Products', 'Infosys Ltd', 'HCL Technologies', 'Wipro Ltd', 'HDFC Bank', 'ITC Ltd', 'Maruti Suzuki', 'Other']

export default function SMEDashboard() {
  const navigate = useNavigate()
  const [wallet,       setWallet]       = useState(null)
  const [connecting,   setConnecting]   = useState(false)
  const [form,         setForm]         = useState({ buyer: '', amount: '', dueDays: '60', historyCount: '3', defaultRate: '0' })
  const [scoring,      setScoring]      = useState(false)
  const [scoreResult,  setScoreResult]  = useState(null)
  const [scoreError,   setScoreError]   = useState('')
  const [listing,      setListing]      = useState(false)
  const [listResult,   setListResult]   = useState(null)
  const [listError,    setListError]    = useState('')

  const handleConnect = useCallback(async () => {
    setConnecting(true)
    try {
      const w = await connectWallet()
      setWallet(w)
    } catch (e) {
      alert(e.message)
    } finally {
      setConnecting(false)
    }
  }, [])

  const handleScore = useCallback(async (e) => {
    e.preventDefault()
    setScoring(true); setScoreError(''); setScoreResult(null); setListResult(null)
    try {
      const res = await scoreInvoice({
        buyer_name:          form.buyer,
        invoice_amount:      parseFloat(form.amount),
        due_days:            parseInt(form.dueDays),
        sme_history_count:   parseInt(form.historyCount),
        sme_default_rate:    parseFloat(form.defaultRate),
      })
      setScoreResult(res)
    } catch (e) {
      setScoreError('Backend not reachable — is the FastAPI server running on port 8000?')
    } finally {
      setScoring(false)
    }
  }, [form])

  const handleList = useCallback(async () => {
    if (!wallet) { alert('Connect MetaMask first'); return }
    setListing(true); setListError('')
    try {
      const amountInr  = parseFloat(form.amount)
      // Use 1 MATIC = ₹10,000 proxy; so ₹10L = 0.1 MATIC for testnet demo
      const amountEth  = amountInr / 10_000_000   // ₹1Cr ≈ 0.01 MATIC on testnet
      const dueDate    = Math.floor(Date.now() / 1000) + parseInt(form.dueDays) * 86400
      const hash       = makeInvoiceHash(form.buyer, amountEth, dueDate)
      const riskScore  = Math.round(scoreResult.score)
      // Advance rate from score: 92% for score >= 70, 82% for 50-69
      const advanceRateBps = riskScore >= 70 ? 9200 : 8200

      const result = await listInvoice(wallet.signer, { invoiceAmountEth: amountEth, dueDateUnix: dueDate, invoiceHash: hash, riskScore, advanceRateBps })
      setListResult(result)
    } catch (e) {
      setListError(e.message || 'Transaction failed')
    } finally {
      setListing(false)
    }
  }, [wallet, form, scoreResult])

  const short = (addr) => addr ? addr.slice(0, 6) + '…' + addr.slice(-4) : ''

  const SHAP_COLORS = { buyer_tier: '#6ee7a7', sme_history: '#7aa2ff', due_days: '#f87171', amount_ratio: '#fbbf24' }
  const SHAP_LABELS = { buyer_tier: 'Buyer tier', sme_history: 'SME history', due_days: 'Due days', amount_ratio: 'Amount ratio' }

  return (
    <>
      <nav style={s.nav}>
        <div style={s.brand} onClick={() => navigate('/')}>
          <span style={s.mark} />
          Nuvest
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {wallet
            ? <div style={s.walletPill}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6ee7a7', boxShadow: '0 0 6px #6ee7a7' }} />
                {short(wallet.address)}
              </div>
            : <button style={{ ...s.btnSec, fontSize: 12 }} onClick={handleConnect} disabled={connecting}>
                {connecting ? 'Connecting…' : 'Connect MetaMask'}
              </button>
          }
          <button style={s.btnSec} onClick={() => navigate('/')}>← Home</button>
        </div>
      </nav>

      <div style={s.page}>
        <div style={s.kicker}><span style={s.dot} />SME Track · Invoice Financing</div>
        <h1 style={s.h1}>Get funded against<br />your invoices.</h1>
        <p style={s.lead}>Upload an invoice, get an AI risk score in seconds, and have investors fund you on-chain. No collateral. No bank queues.</p>

        {/* STEP 1 — Invoice form */}
        <div style={s.card}>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 20, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            01 · Invoice details
          </div>
          <form onSubmit={handleScore}>
            <div style={s.label}>Buyer / Corporate name</div>
            <select
              style={{ ...s.input, appearance: 'none', cursor: 'pointer' }}
              value={form.buyer}
              onChange={e => setForm(f => ({ ...f, buyer: e.target.value }))}
              required
            >
              <option value="">Select buyer…</option>
              {BUYERS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            <div style={s.row}>
              <div>
                <div style={s.label}>Invoice amount (₹)</div>
                <input style={s.input} type="number" min="1000" placeholder="e.g. 1000000" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div>
                <div style={s.label}>Due in (days)</div>
                <input style={s.input} type="number" min="7" max="180" value={form.dueDays}
                  onChange={e => setForm(f => ({ ...f, dueDays: e.target.value }))} required />
              </div>
            </div>

            <div style={s.row}>
              <div>
                <div style={s.label}>Past invoices on platform</div>
                <input style={s.input} type="number" min="0" max="50" value={form.historyCount}
                  onChange={e => setForm(f => ({ ...f, historyCount: e.target.value }))} />
              </div>
              <div>
                <div style={s.label}>Historical default rate (0–1)</div>
                <input style={s.input} type="number" min="0" max="1" step="0.01" value={form.defaultRate}
                  onChange={e => setForm(f => ({ ...f, defaultRate: e.target.value }))} />
              </div>
            </div>

            <button type="submit" style={s.btn} disabled={scoring || !form.buyer || !form.amount}>
              {scoring
                ? <><SpinIcon />Scoring…</>
                : <><BrainIcon />Score Invoice</>
              }
            </button>
          </form>
          {scoreError && <div style={s.err}>{scoreError}</div>}
        </div>

        {/* STEP 2 — Score result */}
        {scoreResult && (
          <div style={s.card}>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 20, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              02 · AI Risk Assessment
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 56, fontWeight: 800, color: 'var(--ink-0)', letterSpacing: '-0.04em', lineHeight: 1 }}>
                  {Math.round(scoreResult.score)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Risk score</div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ marginBottom: 8 }}>
                  <span style={s.badge(scoreResult.score)}>{scoreResult.verdict?.replace('_', ' ') || 'LOW RISK'}</span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink-1)', marginBottom: 4 }}>
                  Advance rate: <strong style={{ color: 'var(--ink-0)' }}>{Math.round((scoreResult.advance_rate || 0.92) * 100)}%</strong>
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink-1)' }}>
                  Cash advance: <strong style={{ color: '#6ee7a7' }}>
                    ₹{(scoreResult.advance_amount || 0).toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>
            </div>

            {/* SHAP breakdown */}
            {scoreResult.shap_values && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
                  Score breakdown (SHAP)
                </div>
                {Object.entries(scoreResult.shap_values).map(([k, v]) => (
                  <div key={k} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-1)', marginBottom: 4 }}>
                      <span>{SHAP_LABELS[k] || k}</span>
                      <span style={{ color: v >= 0 ? '#6ee7a7' : '#f87171', fontWeight: 600 }}>
                        {v >= 0 ? '+' : ''}{v}
                      </span>
                    </div>
                    <div style={s.progress(v)}>
                      <div style={s.bar(v, v >= 0 ? SHAP_COLORS[k] || '#6ee7a7' : '#f87171')} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {scoreResult.score >= 50 && !listResult && (
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 16 }}>
                  Invoice qualifies for listing. Connect MetaMask and mint the token on Polygon Amoy.
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {!wallet && (
                    <button style={s.btnSec} onClick={handleConnect} disabled={connecting}>
                      {connecting ? 'Connecting…' : 'Connect MetaMask'}
                    </button>
                  )}
                  <button style={{ ...s.btn, background: '#6ee7a7', color: '#0a1f14' }} onClick={handleList} disabled={listing || !wallet}>
                    {listing
                      ? <><SpinIcon />Listing on Polygon…</>
                      : <><ChainIcon />List Invoice on Chain</>
                    }
                  </button>
                </div>
                {listError && <div style={s.err}>{listError}</div>}
              </div>
            )}

            {scoreResult.score < 50 && (
              <div style={{ ...s.err, marginTop: 20 }}>
                Score below minimum threshold (50). Invoice cannot be listed on the marketplace.
              </div>
            )}
          </div>
        )}

        {/* STEP 3 — Success */}
        {listResult && (
          <div style={s.card}>
            <div style={{ fontSize: 13, color: '#6ee7a7', marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              03 · Token Minted ✓
            </div>
            <div style={s.success}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#6ee7a7', marginBottom: 12 }}>Invoice listed on Polygon Amoy</div>
              <div style={{ fontSize: 13, color: 'var(--ink-1)', marginBottom: 8 }}>
                Token ID: <span style={{ color: 'var(--ink-0)', fontWeight: 600 }}>{listResult.tokenId?.toString() ?? '—'}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-1)', marginBottom: 16 }}>
                Tx hash: <span style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: 12 }}>{listResult.txHash?.slice(0, 30)}…</span>
              </div>
              <a
                href={`https://amoy.polygonscan.com/tx/${listResult.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...s.btn, textDecoration: 'none', fontSize: 13, padding: '10px 20px', display: 'inline-flex' }}
              >
                View on Polygonscan →
              </a>
            </div>
            <div style={{ marginTop: 20, fontSize: 14, color: 'var(--ink-2)' }}>
              Your invoice is now live on the marketplace. Investors can fund it and you will receive the advance instantly.
            </div>
          </div>
        )}

        {/* Flow reminder */}
        {!scoreResult && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
            {[
              ['01', 'Score Invoice', 'AI · XGBoost + SHAP'],
              ['02', 'List on Chain', 'Polygon · ERC-721'],
              ['03', 'Investors Fund', 'Advance sent instantly'],
              ['04', 'Buyer Pays', 'Smart contract settles'],
            ].map(([i, n, d]) => (
              <div key={i} style={{ padding: '18px 20px', border: '1px solid var(--line)', borderRadius: 12, background: 'rgba(14,23,48,.4)' }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6, fontWeight: 600 }}>{i}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-0)', marginBottom: 4 }}>{n}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{d}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function SpinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}

function BrainIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9.5 2a2.5 2.5 0 0 1 5 0v0a2.5 2.5 0 0 1 2.45 2H18a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3h-.05a2.5 2.5 0 0 1-2.45 2H8.5a2.5 2.5 0 0 1-2.45-2H6a3 3 0 0 1-3-3v0a3 3 0 0 1 3-3h.05A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M12 12v10M9 18h6" />
    </svg>
  )
}

function ChainIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}
