# Tokenized Invoice Financing Platform
## Claude Code Project Guide

---

## Project Overview

A 24-hour hackathon project combining AI-powered invoice risk scoring with blockchain-based settlement to give Indian SMEs instant liquidity against unpaid invoices.

**Core flow:**
```
SME uploads invoice → AI scores it → Token minted on blockchain → 
Investor funds it → SME gets cash instantly → Buyer pays → Investor gets return
```

---

## Repo Structure

```
invoice-finance/
├── contracts/                  # Solidity smart contracts
│   ├── InvoiceToken.sol        # ERC721 token representing invoice
│   └── InvoiceEscrow.sol       # Escrow + settlement logic
├── backend/                    # AI scoring API
│   ├── app.py                  # FastAPI server
│   ├── model.py                # XGBoost scoring model
│   ├── scorer.py               # Feature engineering + scoring logic
│   └── requirements.txt
├── frontend/                   # React app
│   ├── src/
│   │   ├── pages/
│   │   │   ├── SMEDashboard.jsx        # Invoice upload + status
│   │   │   └── InvestorMarketplace.jsx # Browse + fund invoices
│   │   ├── components/
│   │   │   ├── InvoiceCard.jsx         # Invoice display with score
│   │   │   ├── ScoreBreakdown.jsx      # SHAP explanation visual
│   │   │   └── WalletConnect.jsx       # MetaMask integration
│   │   └── utils/
│   │       ├── contract.js             # ethers.js contract interactions
│   │       └── api.js                  # Backend API calls
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
| Frontend | React, ethers.js, TailwindCSS |
| Invoice Storage | IPFS via web3.storage or Pinata |
| Wallet | MetaMask |
| Oracle (simulated) | Button trigger in demo (not Chainlink — saves time) |

---

## Smart Contracts

### InvoiceToken.sol
ERC721 token representing ownership of an invoice.

```solidity
// Each token stores:
struct Invoice {
    uint256 invoiceAmount;      // Face value in wei (use stablecoin or mock INR)
    uint256 advanceAmount;      // What investor pays upfront
    uint256 dueDate;            // Unix timestamp
    address smeWallet;          // Ravi's wallet
    address investorWallet;     // Funder's wallet
    bytes32 invoiceHash;        // Hash of invoice PDF
    uint8 riskScore;            // AI score 0-100
    InvoiceStatus status;       // LISTED, FUNDED, SETTLED, DEFAULTED
}
```

### InvoiceEscrow.sol
Core logic contract. Handles:
- Receiving investor funds
- Instantly releasing advance to SME
- Holding remainder until due date
- Releasing to investor on simulated buyer payment
- Deducting platform fee (1%)

**Key functions:**
```solidity
function listInvoice(...)        // SME lists invoice, stores hash
function fundInvoice(uint id)    // Investor sends funds, SME gets paid instantly
function simulateBuyerPayment(uint id)  // Demo: triggers final settlement
function withdrawFee()           // Platform owner collects fees
```

**Critical constraint:**
Invoice can only be listed if `paymentDestination == escrowAddress`. Enforce this on-chain.

---

## AI Scoring Model

### Input Features
```python
features = {
    "buyer_tier": 0-3,          # 3=blue chip (Reliance/Tata), 0=unknown
    "invoice_amount": float,     # In lakhs
    "due_days": int,             # Days until payment due
    "sme_history_count": int,    # Previous invoices on platform
    "sme_default_rate": float,   # Historical default rate 0-1
    "amount_vs_avg_ratio": float # This invoice vs SME's historical average
}
```

### Output
```python
{
    "score": 91,                 # 0-100 risk score
    "advance_rate": 0.92,        # Recommended advance as % of face value
    "advance_amount": 920000,    # In rupees
    "shap_values": {             # Why this score
        "buyer_tier": +25,
        "sme_history": +18,
        "due_days": -8,
        "amount_ratio": -4
    },
    "verdict": "LOW_RISK"        # LOW_RISK / MEDIUM_RISK / HIGH_RISK / REJECTED
}
```

### For hackathon — keep model simple
Don't overthink the ML. A rule-based scoring function works fine for the demo:
```python
def score_invoice(features):
    score = 50  # base
    score += features["buyer_tier"] * 15      # up to +45
    score += min(features["sme_history_count"] * 3, 15)  # up to +15
    score -= features["due_days"] * 0.1       # longer wait = lower score
    score -= features["amount_vs_avg_ratio"] * 5  # unusual amount = lower score
    return max(0, min(100, score))
```

Wrap this in FastAPI. Done in 1 hour.

---

## Frontend Pages

### SME Dashboard
1. Connect MetaMask wallet
2. Upload invoice PDF
3. Fill form: buyer name, amount, due date
4. Hit "Score Invoice" → calls backend API
5. Show score + SHAP breakdown
6. If score > 50: show "List Invoice" button
7. Invoice minted as token → show Polygonscan link
8. Show status: LISTED → FUNDED → cash received

### Investor Marketplace
1. Connect MetaMask wallet
2. Browse listed invoice tokens
3. Each card shows: buyer, amount, score, advance rate, expected return, days remaining
4. Click "Fund Invoice" → MetaMask popup
5. Confirm transaction → show Ravi receiving cash in real time
6. Portfolio view: funded invoices, expected returns, due dates
7. "Simulate Buyer Payment" button → triggers settlement, investor receives funds

---

## Demo Flow (practice this until smooth)

```
1. Open SME Dashboard
   → Connect MetaMask (Ravi's wallet)
   → Upload sample invoice PDF
   → Enter: Buyer = "Reliance Retail", Amount = ₹10,00,000, Due = 60 days

2. Click "Score Invoice"
   → Show score: 91/100
   → Show breakdown: "Reliance is tier-3 buyer (+45 pts)"
   → Show recommended advance: ₹9,20,000

3. Click "List Invoice"
   → MetaMask popup (Ravi signs transaction)
   → Token minted on Polygon Mumbai
   → Show Polygonscan transaction LIVE ← judges love this moment

4. Switch to Investor Dashboard
   → Connect MetaMask (investor wallet)
   → Invoice appears in marketplace
   → Click "Fund Invoice"
   → MetaMask popup (investor sends ₹9.2L)
   → Confirm

5. Switch back to SME Dashboard
   → Ravi's wallet balance updated: +₹9,20,000
   → Status: FUNDED

6. Click "Simulate Buyer Payment" (60 day skip)
   → Smart contract releases ₹10L to investor
   → Platform fee deducted automatically
   → Show investor wallet: +₹10,00,000

7. Pitch closing line:
   "Ravi kept his business running. Investor made 8.7% in 60 days.
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
```

### Install
```bash
# Smart contracts
npm install
npx hardhat compile

# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### Deploy contracts
```bash
npx hardhat run scripts/deploy.js --network mumbai
# Copy contract addresses to frontend/src/utils/contract.js
```

### Run locally
```bash
# Terminal 1 - Backend
cd backend && uvicorn app:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend && npm start
```

---

## Key Constraints and Guardrails

**Invoice validation (enforce this on-chain + backend):**
- Invoice payment destination MUST match platform escrow address
- If it doesn't match → reject at upload, never tokenize
- This prevents Ravi from redirecting Reliance's payment

**Score thresholds:**
- Score >= 70 → LOW_RISK → advance rate 90-95%
- Score 50-69 → MEDIUM_RISK → advance rate 80-89%
- Score < 50 → REJECTED → not listed on marketplace

**Platform fee:**
- Deducted automatically at settlement
- 1% of invoice face value from investor payout
- Stored in contract, withdrawable by owner wallet only

---

## What to Mock for Hackathon

Don't waste time building these — mock them cleanly:

| Real world requirement | Hackathon mock |
|---|---|
| Actual GST verification | Hardcode buyer tier lookup table |
| Real KYC | Simple name + wallet address form |
| Chainlink oracle | "Simulate Buyer Payment" button |
| IPFS upload | Store invoice hash locally or use simple Pinata call |
| Stablecoin (USDC/INRC) | Use test MATIC as proxy for INR |
| Legal assignment agreement | Checkbox "I agree to payment terms" |

---

## Hard Questions from Judges — Prepared Answers

**"How is this different from KredX or M1xchange?"**
> Those are centralized platforms — you trust the company. Here the smart contract holds funds, not us. Even we can't touch investor money. Plus fractional ownership opens it to retail investors, not just institutions.

**"What if the buyer defaults?"**
> The AI score reflects buyer quality — we only list invoices from verified, creditworthy buyers. For defaults, the legal assignment agreement gives investors recourse. Future version integrates trade credit insurance as an additional layer.

**"Why Polygon and not Ethereum?"**
> Transaction fees. An Ethereum transaction costs $5-50. Polygon costs fractions of a cent. For ₹1L invoices, gas fees need to be negligible.

**"Why not just use a database?"**
> A database is controlled by us. If we shut down or get hacked, investor funds are at risk. Smart contract escrow means nobody — including us — can touch funds until conditions are met. That trustlessness is the core value proposition.

**"What's your business model?"**
> 1% transaction fee on both sides per invoice. At 1000 invoices/month averaging ₹8L each, that's ₹1.6 crore monthly revenue. No lending risk — we never hold capital.

---

## Sample Data for Demo

```python
# Use these in your demo to avoid live data entry
sample_invoice = {
    "buyer": "Reliance Retail Ltd",
    "buyer_tier": 3,
    "amount": 1000000,  # ₹10L
    "due_days": 60,
    "sme_name": "Sri Lakshmi Textiles",
    "sme_history_count": 6,
    "sme_default_rate": 0.0
}

# Expected output
expected_score = 91
expected_advance = 920000  # ₹9.2L
expected_investor_return = "8.7% over 60 days (~52% annualized)"
```

---

## Pitch Deck Structure (5 slides max)

1. **Problem** — Ravi's story. 63M SMEs. ₹20L crore gap.
2. **Solution** — Cut the wait. AI scores. Blockchain settles.
3. **Demo** — Live walkthrough (3 minutes)
4. **Market** — Size, why now, why India
5. **Team** — Who you are, why you can build this

---

## One Line Pitch

> "We cut the 60-day wait between SMEs doing the work and getting paid — by connecting them with investors through AI-powered risk scoring and blockchain-settled escrow."
