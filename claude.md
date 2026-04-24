# Nuvest
## Claude Code Project Guide

---

## Project Overview

Nuvest is two products in one platform — an AI-powered portfolio manager for Indian retail
investors, and a blockchain-based invoice financing marketplace for SMEs.

**Portfolio flow:**
```
Investor logs in → Kite Connect fetches live holdings → AI copilot answers
tax/rebalancing queries → SIP optimiser suggests allocation → FY-end alerts fire
```

**Invoice flow:**
```
SME uploads invoice → AI scores it → Token minted on Polygon →
Investor funds it → SME gets cash instantly → Buyer pays → Investor gets return
```

---

## Repo Structure

```
nuvest/
├── contracts/
│   ├── InvoiceToken.sol        # ERC721 token representing an invoice
│   └── InvoiceEscrow.sol       # Escrow + settlement logic
├── backend/
│   ├── app.py                  # FastAPI server (all routes)
│   ├── model.py                # XGBoost scoring model
│   ├── scorer.py               # Feature engineering + scoring logic
│   ├── portfolio.py            # Kite Connect wrapper + caching layer
│   ├── ai_chat.py              # Grok LLM chat handler (India tax context)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── PortfolioDashboard.jsx   # Live holdings, AI chat, alerts
│       │   ├── SMEDashboard.jsx         # Invoice upload + status
│       │   └── InvestorMarketplace.jsx  # Browse + fund invoices
│       ├── components/
│       │   ├── HoldingsTable.jsx        # Live NSE/BSE holdings
│       │   ├── AllocationBar.jsx        # Equity/debt/gold/pension bars
│       │   ├── TaxSummary.jsx           # LTCG/STCG/80C cards
│       │   ├── AICopilot.jsx            # Chat interface (Grok)
│       │   ├── FYAlerts.jsx             # Rebalancing + deadline alerts
│       │   ├── InvoiceCard.jsx          # Invoice display with score
│       │   ├── ScoreBreakdown.jsx       # SHAP explanation visual
│       │   └── WalletConnect.jsx        # MetaMask integration
│       └── utils/
│           ├── contract.js              # ethers.js contract interactions
│           ├── api.js                   # Backend API calls
│           └── taxCalc.js              # LTCG/STCG/indexation helpers
├── scripts/
│   └── deploy.js               # Hardhat deployment script
├── hardhat.config.js
└── CLAUDE.md                   # This file
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | Solidity 0.8.x on Polygon Mumbai Testnet |
| Contract Dev | Hardhat + ethers.js |
| AI Scoring | Python, XGBoost, SHAP, FastAPI |
| AI Chat | Grok API (xAI) — India tax context injected via system prompt |
| Portfolio Data | Zerodha Kite Connect API (WebSocket for live, REST for holdings) |
| Data Cache | In-memory dict (demo) — Redis in production |
| Frontend | React + Vite + Tailwind CSS |
| Blockchain | Solidity on Polygon Mumbai Testnet + IPFS (Pinata) |
| Wallet | MetaMask |
| Oracle (mocked) | "Simulate Buyer Payment" button — no Chainlink in hackathon build |
| Deployment | Render (backend) + Vercel (frontend) |

---

## Module 1 — AI Portfolio Manager

### What it does
- Fetches live holdings from Zerodha Kite Connect
- Displays portfolio value, XIRR, allocation across equity/debt/gold/pension
- Shows 80C consumption (ELSS + PPF + NPS), LTCG/STCG exposure this FY
- AI copilot answers natural language queries with Indian tax context
- SIP optimiser suggests monthly amounts per fund
- FY-end rebalancing alerts fire when equity is overweight or 80C is underfilled
- Risk profile adapts advice: beginner / moderate / aggressive

### Kite Connect Integration

#### Authentication (do this once before demo)
```python
# backend/portfolio.py
from kiteconnect import KiteConnect

kite = KiteConnect(api_key=KITE_API_KEY)

# Step 1 — generate login URL, open in browser, grab request_token from redirect
login_url = kite.login_url()

# Step 2 — exchange request_token for access_token (valid 1 trading day)
data = kite.generate_session(request_token, api_secret=KITE_API_SECRET)
kite.set_access_token(data["access_token"])
```

**For hackathon:** Pre-authenticate before the demo and hardcode the
`access_token` in `.env`. Do NOT do the OAuth dance live on stage.

#### Key endpoints used
```python
# Holdings (positions in demat)
holdings = kite.holdings()
# Returns: tradingsymbol, quantity, average_price, last_price, pnl, product

# Positions (intraday + short-term)
positions = kite.positions()

# Quote (live price for a list of instruments)
quote = kite.quote(["NSE:NIFTY50", "NSE:RELIANCE"])

# Historical OHLC (for XIRR calculation)
candles = kite.historical_data(instrument_token, from_date, to_date, "day")
```

#### Caching strategy (critical — Kite has rate limits)
```python
# backend/portfolio.py
import time

_cache = {}
CACHE_TTL = 60  # seconds — refresh holdings every 60s, not on every request

def get_holdings(user_id: str):
    now = time.time()
    if user_id in _cache and now - _cache[user_id]["ts"] < CACHE_TTL:
        return _cache[user_id]["data"]
    data = kite.holdings()
    _cache[user_id] = {"data": data, "ts": now}
    return data
```

**Why this matters:** Kite enforces rate limits. Hitting it on every frontend
request will get you throttled mid-demo. Cache aggressively.

#### FastAPI routes
```python
# backend/app.py

@app.get("/portfolio/holdings")
def holdings(user_id: str):
    return get_holdings(user_id)

@app.get("/portfolio/summary")
def summary(user_id: str):
    holdings = get_holdings(user_id)
    return compute_summary(holdings)   # XIRR, allocation, tax exposure

@app.post("/portfolio/chat")
def chat(payload: ChatRequest):
    return run_ai_chat(payload.message, payload.holdings_context)
```

### AI Copilot (Grok)

#### System prompt — inject this on every chat request
```python
INDIA_TAX_SYSTEM_PROMPT = """
You are Nuvest's AI investment copilot for Indian retail investors.
Always answer in the context of Indian tax rules:

- STCG (Short Term Capital Gains): equity held < 12 months, taxed at 20%
- LTCG (Long Term Capital Gains): equity held > 12 months, taxed at 12.5%
  above ₹1 lakh exemption per FY
- ELSS: qualifies for 80C deduction up to ₹1.5L total limit
- PPF: qualifies for 80C, EEE status (exempt-exempt-exempt)
- NPS Tier I: 80CCD(1B) gives additional ₹50K deduction beyond 80C limit
- SGB: capital gains exempt if held to maturity (8 years)
- Indexation: available for debt funds purchased before April 2023

When asked about rebalancing, always consider the March 31 fiscal year-end.
Keep answers concise, under 100 words. Never give specific buy/sell advice on
individual stocks — frame as educational guidance only.
"""

# backend/ai_chat.py
def run_ai_chat(message: str, holdings_context: dict) -> str:
    context_str = f"User holdings summary: {json.dumps(holdings_context)}"
    response = grok_client.chat.completions.create(
        model="grok-beta",
        messages=[
            {"role": "system", "content": INDIA_TAX_SYSTEM_PROMPT},
            {"role": "user",   "content": f"{context_str}\n\nQuestion: {message}"}
        ],
        max_tokens=200
    )
    return response.choices[0].message.content
```

#### Sample queries the copilot handles well
| User query | What AI does |
|---|---|
| "How much ELSS for 80C?" | Reads 80C used from holdings, tells them the gap |
| "Should I sell my Nifty units?" | Checks purchase date, flags STCG vs LTCG timing |
| "Rebalance before March 31?" | Compares current vs target allocation, suggests moves |
| "What's my LTCG this year?" | Sums gains on equity held > 12mo, checks ₹1L exemption |

### Tax Calculation Helpers
```javascript
// frontend/src/utils/taxCalc.js

export function classifyGain(purchaseDate, saleDate, assetType = "equity") {
  const months = monthsDiff(purchaseDate, saleDate);
  if (assetType === "equity") return months >= 12 ? "LTCG" : "STCG";
  if (assetType === "debt")   return months >= 24 ? "LTCG" : "STCG";
  return "LTCG";
}

export function ltcgTax(gain) {
  const exempt = 100000; // ₹1L per FY
  return gain > exempt ? (gain - exempt) * 0.125 : 0;
}

export function stcgTax(gain) {
  return gain * 0.20;
}

export function calc80CRemaining(elss, ppf, nps_tier1) {
  const limit = 150000;
  const used  = elss + ppf + nps_tier1;
  return Math.max(0, limit - used);
}
```

### FY-End Alerts Logic
```python
# backend/portfolio.py

def generate_alerts(holdings_summary):
    alerts = []
    fy_end = "March 31"

    # Alert 1 — 80C underfilled
    remaining_80c = 150000 - holdings_summary["elss_invested"] \
                            - holdings_summary["ppf_invested"]
    if remaining_80c > 0:
        alerts.append({
            "type": "warning",
            "message": f"₹{remaining_80c:,} of 80C limit unused. "
                       f"Invest in ELSS before {fy_end} to save tax."
        })

    # Alert 2 — equity overweight
    equity_pct = holdings_summary["equity_pct"]
    if equity_pct > 0.65:
        overshoot = round((equity_pct - 0.60) * holdings_summary["total_value"])
        alerts.append({
            "type": "warning",
            "message": f"Equity overweight by {round((equity_pct-0.60)*100)}%. "
                       f"Consider moving ₹{overshoot:,} to debt before {fy_end}."
        })

    # Alert 3 — LTCG approaching ₹1L
    if holdings_summary["ltcg_this_fy"] > 80000:
        alerts.append({
            "type": "info",
            "message": f"LTCG at ₹{holdings_summary['ltcg_this_fy']:,} — "
                       f"close to ₹1L exempt limit. Avoid harvesting more gains."
        })

    return alerts
```

---

## Module 2 — Invoice Financing Marketplace

### AI Scoring Model

#### Input features
```python
features = {
    "buyer_tier":           0-3,   # 3=blue chip (Reliance/Tata), 0=unknown
    "invoice_amount":       float, # In lakhs
    "due_days":             int,   # Days until payment due
    "sme_history_count":    int,   # Previous invoices on platform
    "sme_default_rate":     float, # Historical default rate 0–1
    "amount_vs_avg_ratio":  float  # This invoice vs SME historical average
}
```

#### Scoring function (rule-based for hackathon)
```python
def score_invoice(features):
    score = 50
    score += features["buyer_tier"] * 15          # up to +45
    score += min(features["sme_history_count"] * 3, 15)  # up to +15
    score -= features["due_days"] * 0.1            # longer wait = lower
    score -= features["amount_vs_avg_ratio"] * 5   # unusual amount = lower
    return max(0, min(100, score))
```

#### Output
```python
{
    "score":          91,
    "advance_rate":   0.92,
    "advance_amount": 920000,
    "shap_values": {
        "buyer_tier":    +25,
        "sme_history":   +18,
        "due_days":      -8,
        "amount_ratio":  -4
    },
    "verdict": "LOW_RISK"   # LOW_RISK / MEDIUM_RISK / HIGH_RISK / REJECTED
}
```

#### Score thresholds + advance rates
| Score | Verdict | Advance rate |
|---|---|---|
| 70–100 | LOW_RISK | 90–95% |
| 50–69 | MEDIUM_RISK | 80–89% |
| < 50 | REJECTED | Not listed |

### Smart Contracts

#### InvoiceToken.sol — ERC721
Each token stores invoice metadata. See `contracts/InvoiceToken.sol`.

Key struct:
```solidity
struct Invoice {
    uint256 invoiceAmount;
    uint256 advanceAmount;
    uint256 dueDate;
    address smeWallet;
    address investorWallet;
    bytes32 invoiceHash;
    uint8   riskScore;
    InvoiceStatus status;  // LISTED, FUNDED, SETTLED, DEFAULTED
}
```

#### InvoiceEscrow.sol — core logic
See `contracts/InvoiceEscrow.sol`.

Key functions:
```solidity
listInvoice(...)             // SME lists; enforces paymentDest == address(this)
fundInvoice(uint id)         // Investor funds; SME paid instantly
simulateBuyerPayment(uint id) // Demo oracle; owner can trigger early
markDefault(uint id)         // Owner marks overdue invoice defaulted
withdrawFee()                // Owner collects accumulated 1% platform fees
expectedReturnBps(uint id)   // View: investor return in basis points
```

**Critical constraint — payment destination guard:**
`listInvoice` rejects any invoice where `paymentDest != address(this)`.
This ensures buyer payments flow into escrow, not to the SME directly.
Enforce this check in the backend at upload time too — never tokenize
an invoice that fails this check.

**Platform fee:** 1% of `invoiceAmount`, deducted at settlement from
investor payout. Accumulates in contract, owner withdraws via `withdrawFee()`.

**`simulateBuyerPayment` — production upgrade path:**
In the hackathon build, owner or anyone post-dueDate can call this.
In production, replace with a Chainlink Automation job that monitors
an off-chain payment webhook and calls the function after a trusted
backend co-signs. Prepare this answer for judges.

### Frontend Pages

#### SMEDashboard.jsx
1. Connect MetaMask
2. Upload invoice PDF → hash stored on IPFS via Pinata
3. Fill form: buyer name, amount, due date
4. "Score Invoice" → POST `/invoice/score`
5. Show score + SHAP breakdown (`ScoreBreakdown.jsx`)
6. If score ≥ 50: show "List Invoice" button
7. MetaMask signs → token minted → show Polygonscan link
8. Status tracker: LISTED → FUNDED → cash received

#### InvestorMarketplace.jsx
1. Connect MetaMask
2. Browse listed invoice tokens
3. Each `InvoiceCard` shows: buyer, face value, score, advance rate,
   expected return (from `expectedReturnBps`), days remaining
4. "Fund Invoice" → MetaMask popup → confirm
5. SME wallet balance updates in real time (poll every 3s post-funding)
6. Portfolio view: funded invoices, expected returns, due dates
7. "Simulate Buyer Payment" → triggers settlement, investor receives funds

---

## Yield Numbers — Use These Consistently

The whitepaper says "12–18% annualised". The sample data shows 8.7% over
60 days. These are both correct but refer to different things. Use this
framing everywhere — pitch deck, demo, and judge Q&A:

| Metric | Value | How to say it |
|---|---|---|
| Return on sample invoice | 8.7% over 60 days | "8.7% in 60 days on this invoice" |
| Annualised equivalent | ~52% | Never say this — it's misleading |
| Platform range (annualised) | 12–18% | Use for marketing; explain it's the *weighted average across invoices* over a year, not per-invoice |

**Talking point for judges:**
> "The 12–18% figure is the annualised platform yield averaged across invoice
> tenors of 30–90 days. A specific invoice like this one returns 8.7% in 60
> days — which is roughly 52% annualised, but we don't market it that way
> because not every rupee is deployed every day."

---

## Demo Flow (practice until smooth — 4 minutes total)

```
[Minute 0:30] Portfolio side
  → Investor logs in → PortfolioDashboard loads live holdings via Kite Connect
  → Ask AI copilot: "How much ELSS can I still add for 80C?"
  → AI responds with India-specific tax answer
  → Point out FY-end rebalancing alert

[Minute 1:00] SME side
  → SME logs in (switch MetaMask to Ravi's wallet)
  → Upload sample invoice PDF
  → Enter: Buyer = "Reliance Retail", Amount = ₹10,00,000, Due = 60 days
  → Click "Score Invoice" → score: 91/100
  → Show SHAP: "Reliance is tier-3 buyer (+45 pts)"
  → Recommended advance: ₹9,20,000

[Minute 2:00] Blockchain moment ← judges love this
  → Click "List Invoice"
  → MetaMask popup (Ravi signs)
  → Token minted on Polygon Mumbai
  → Show Polygonscan transaction LIVE

[Minute 2:30] Investor funds
  → Switch to Investor wallet
  → Invoice appears in marketplace
  → Click "Fund Invoice" → MetaMask popup → confirm

[Minute 3:00] Settlement
  → Switch back to SME Dashboard
  → Ravi's wallet: +₹9,20,000. Status: FUNDED
  → Click "Simulate Buyer Payment"
  → Smart contract releases ₹10L to investor minus 1% fee
  → Show investor wallet: +₹9,90,000

[Minute 3:30] Closing line
  → "Ravi kept his business running. Investor made 8.7% in 60 days.
     We made a fee. Nobody needed a bank."
```

---

## Environment Setup

### Prerequisites
```bash
node >= 18
python >= 3.10
MetaMask browser extension
Polygon Mumbai testnet configured in MetaMask
Test MATIC from faucet: https://faucet.polygon.technology
Kite Connect API key + secret (pre-authenticated before demo)
Grok API key
```

### Environment variables
```bash
# .env
KITE_API_KEY=
KITE_API_SECRET=
KITE_ACCESS_TOKEN=      # Pre-generate before demo, valid 1 trading day
GROK_API_KEY=
PINATA_API_KEY=
PINATA_SECRET=
ESCROW_CONTRACT_ADDRESS=
TOKEN_CONTRACT_ADDRESS=
```

### Install
```bash
# Smart contracts
npm install
npx hardhat compile

# Backend
cd backend && pip install -r requirements.txt

# Frontend
cd frontend && npm install
```

### requirements.txt
```
fastapi
uvicorn
kiteconnect
xgboost
shap
openai          # Grok uses OpenAI-compatible SDK
python-dotenv
httpx
```

### Deploy contracts
```bash
npx hardhat run scripts/deploy.js --network mumbai
# Copy contract addresses to .env and frontend/src/utils/contract.js
```

### Run locally
```bash
# Terminal 1
cd backend && uvicorn app:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

---

## What to Mock for Hackathon

| Real-world requirement | Hackathon mock |
|---|---|
| Kite Connect OAuth per user | Single pre-authenticated access_token in .env |
| GST invoice verification | Hardcode buyer tier lookup table |
| Real KYC | Name + wallet address form |
| Chainlink oracle | "Simulate Buyer Payment" button |
| IPFS upload | Pinata API call (simple, real, takes 30 min) |
| Stablecoin (USDC/INRC) | Test MATIC as proxy for INR |
| Legal assignment agreement | Checkbox "I agree to payment terms" |
| Redis cache for Kite data | In-memory Python dict with TTL |
| Per-user Kite sessions | Single shared Kite session (demo only) |

---

## Hard Questions from Judges — Prepared Answers

**"How is this different from KredX or M1xchange?"**
> Those are centralised platforms — you trust the company. Here the smart
> contract holds funds, not us. Even we can't touch investor money.
> Fractional ownership also opens it to retail investors from ₹1,000,
> not just institutions.

**"What if the buyer defaults?"**
> The AI score reflects buyer quality — we only list invoices from
> verified, creditworthy buyers. The legal assignment agreement gives
> investors recourse. Future version integrates trade credit insurance.

**"Why Polygon and not Ethereum?"**
> Gas fees. An Ethereum transaction costs $5–50. Polygon costs fractions
> of a cent. For ₹1L invoices, gas must be negligible.

**"Why not just use a database?"**
> A database is controlled by us. Smart contract escrow means nobody —
> including us — can touch funds until conditions are met. That
> trustlessness is the core value proposition.

**"Who calls simulateBuyerPayment in production?"**
> A Chainlink Automation job monitors an off-chain payment webhook.
> Once the buyer's bank transfer is confirmed, the backend co-signs
> and the Automation task calls the settlement function on-chain.

**"What's your business model?"**
> 1% transaction fee per invoice on both sides. At 1,000 invoices/month
> averaging ₹8L each, that's ₹1.6 crore monthly revenue. No lending
> risk — we never hold capital.

**"How does the AI portfolio copilot differ from Groww or Zerodha?"**
> They show you data. We interpret it in your context — your 80C gap,
> your LTCG exposure, your specific FY-end deadline — and answer in
> plain language. It's the difference between a dashboard and an advisor.

**"Isn't the yield inconsistent — you say 12–18% but your demo shows 52%?"**
> The 12–18% is the annualised platform yield averaged across invoice
> tenors of 30–90 days. A specific invoice returns 8.7% in 60 days —
> higher annualised, but not every rupee is deployed every day.
> 12–18% is the realistic blended annual return for an investor
> who keeps capital deployed across multiple invoices.

---

## Sample Data for Demo

```python
sample_invoice = {
    "buyer":              "Reliance Retail Ltd",
    "buyer_tier":         3,
    "amount":             1000000,   # ₹10L
    "due_days":           60,
    "sme_name":           "Sri Lakshmi Textiles",
    "sme_history_count":  6,
    "sme_default_rate":   0.0
}

expected_score    = 91
expected_advance  = 920000    # ₹9.2L (92% advance rate)
investor_payout   = 990000    # ₹9.9L after 1% platform fee
investor_return   = "8.7% over 60 days"
platform_fee      = 10000     # ₹10K (1% of ₹10L)
```

---

## One-Line Pitch

> "Nuvest gives India's 80 million retail investors an AI copilot that
> actually understands Indian taxes — and turns 63 million SMEs' unpaid
> invoices into a new yield asset class, settled on-chain without banks."