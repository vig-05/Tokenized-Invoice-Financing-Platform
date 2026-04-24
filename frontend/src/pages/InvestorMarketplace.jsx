import { useNavigate } from 'react-router-dom'

export default function InvestorMarketplace() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center' }}>
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/')}>
        <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #a8c0ff, #3b5fd4 55%, #0a1020 100%)', boxShadow: '0 0 14px rgba(91,140,255,0.55)', display: 'inline-block' }} />
        <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink-0)' }}>Nuvest</span>
      </div>

      <div style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-2)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6ee7a7', boxShadow: '0 0 8px #6ee7a7', display: 'inline-block' }} />
        Investor Track
      </div>

      <h1 style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: '16px', color: 'var(--ink-0)' }}>
        Investor Marketplace
      </h1>
      <p style={{ color: 'var(--ink-2)', fontSize: '16px', lineHeight: '1.6', maxWidth: '48ch', marginBottom: '40px' }}>
        Browse AI-scored invoice tokens, fund from ₹1,000, and earn 12–18% annualised yield.
        The marketplace is being built — check back soon.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', width: '100%', maxWidth: '640px', marginBottom: '40px' }}>
        {[
          ['Browse Tokens', 'AI-scored · Risk bands'],
          ['Fund Invoice', 'MetaMask · UPI'],
          ['Earn Yield', '12–18% p.a.'],
          ['Auto-Settle', 'Smart contract'],
        ].map(([title, sub]) => (
          <div key={title} style={{ padding: '20px', border: '1px solid var(--line)', borderRadius: '14px', background: 'rgba(14,23,48,0.5)', textAlign: 'left' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink-0)', marginBottom: '4px' }}>{title}</div>
            <div style={{ fontSize: '11px', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{sub}</div>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate('/')}
        style={{ padding: '12px 24px', borderRadius: '999px', border: '1px solid var(--line-2)', background: 'rgba(255,255,255,0.03)', color: 'var(--ink-0)', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}
      >
        ← Back to home
      </button>
    </div>
  )
}
