import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SettlementNotification({ advice, onDismiss }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => handleDismiss(), 30000)
    return () => clearTimeout(timer)
  }, [])

  function handleDismiss() {
    setVisible(false)
    setTimeout(() => onDismiss?.(), 300)
  }

  if (!advice) return null

  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 999,
      width: '340px',
      background: 'rgba(10,18,40,0.97)',
      border: '1px solid rgba(110,231,167,0.35)',
      borderRadius: '16px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(110,231,167,0.1)',
      overflow: 'hidden',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(12px)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: '10px',
        borderBottom: expanded ? '1px solid rgba(255,255,255,0.06)' : 'none',
      }}>
        <span style={{
          width: 10, height: 10, borderRadius: '50%',
          background: '#6ee7a7',
          boxShadow: '0 0 10px #6ee7a7',
          flexShrink: 0,
          animation: 'pulse-green 2s infinite',
        }} />
        <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--ink-0)', lineHeight: 1.4 }}>
          {advice.notification}
        </span>
        <button
          onClick={handleDismiss}
          style={{
            background: 'none', border: 'none', color: 'var(--ink-3)',
            cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '2px 4px',
          }}
        >×</button>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 16px' }}>
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            style={{
              width: '100%', padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(110,231,167,0.3)',
              background: 'rgba(110,231,167,0.06)',
              color: '#6ee7a7',
              cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              fontFamily: 'inherit', letterSpacing: '0.02em',
              transition: 'background 0.2s',
            }}
          >
            Show AI redeployment advice
          </button>
        )}

        {expanded && (
          <div>
            <p style={{
              fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.65,
              marginBottom: '14px',
            }}>
              {advice.advice}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => navigate('/invest')}
                style={{
                  flex: 1, padding: '9px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #3b5fd4, #5b8cff)',
                  color: '#fff',
                  cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                  fontFamily: 'inherit',
                }}
              >
                Reinvest on Nuvest
              </button>
              <button
                onClick={handleDismiss}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--line-2)',
                  background: 'transparent',
                  color: 'var(--ink-2)',
                  cursor: 'pointer', fontSize: '12px',
                  fontFamily: 'inherit',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse-green {
          0%, 100% { box-shadow: 0 0 6px #6ee7a7; }
          50% { box-shadow: 0 0 14px #6ee7a7, 0 0 24px rgba(110,231,167,0.4); }
        }
      `}</style>
    </div>
  )
}
