const BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`)
  return res.json()
}

async function get(path, params = {}) {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${BASE}${path}${qs ? '?' + qs : ''}`)
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`)
  return res.json()
}

export async function scoreInvoice({ buyer_name, invoice_amount, due_days, sme_history_count = 3, sme_default_rate = 0 }) {
  return post('/invoice/score', {
    buyer: buyer_name,
    sme_name: 'SME',
    invoice_amount,
    due_days,
    sme_history_count,
    sme_default_rate,
  })
}

export async function getHoldings(userId = 'demo_user') {
  return get('/portfolio/holdings', { user_id: userId })
}

export async function fetchSummary(userId = 'demo_user') {
  return get('/portfolio/summary', { user_id: userId })
}

// alias kept for existing callers
export const getPortfolioSummary = fetchSummary

export async function sendChatMessage(message, userId = 'demo_user', history = []) {
  return post('/portfolio/chat', { message, user_id: userId, history })
}

// alias kept for existing callers
export async function chatWithCopilot(message, holdingsContext = {}) {
  return post('/portfolio/chat', { message, holdings_context: holdingsContext })
}

export async function postSettlement({ invoice_id, investor_address, payout_wei, invoice_amount_inr }) {
  return post('/invoice/settlement', { invoice_id, investor_address, payout_wei, invoice_amount_inr })
}

export async function healthCheck() {
  return get('/health')
}
