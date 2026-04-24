from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Optional, List

from model import InvoiceInput, run_scoring
from portfolio import (
    get_holdings, get_summary, get_alerts,
    get_kite_login_url, get_kite_access_token, set_kite_access_token,
)
from ai_chat import run_chat, settlement_advice

app = FastAPI(title="Nuvest API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ── Invoice scoring ───────────────────────────────────────────────────────────

@app.post("/invoice/score")
def score_invoice_endpoint(invoice: InvoiceInput):
    try:
        result = run_scoring(invoice)
        return result.model_dump()
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── Kite Connect OAuth ────────────────────────────────────────────────────────

@app.get("/kite/login-url")
def kite_login_url():
    url = get_kite_login_url()
    if not url:
        raise HTTPException(status_code=503, detail="KITE_API_KEY not configured")
    return {"url": url}


@app.get("/kite/callback")
def kite_callback(request_token: str):
    try:
        token_data = get_kite_access_token(request_token)
        set_kite_access_token(token_data["access_token"])
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Portfolio ─────────────────────────────────────────────────────────────────

@app.get("/portfolio/holdings")
def portfolio_holdings(user_id: str = "demo_user"):
    holdings = get_holdings(user_id)
    return {"user_id": user_id, "holdings": holdings}


@app.get("/portfolio/summary")
def portfolio_summary(user_id: str = "demo_user"):
    summary = get_summary(user_id)
    alerts = get_alerts(summary)
    holdings = get_holdings(user_id)
    return {"summary": summary, "alerts": alerts, "holdings": holdings}


# ── AI Chat ───────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    user_id: str = "demo_user"
    history: Optional[List[ChatMessage]] = []
    holdings_context: Optional[dict[str, Any]] = None


@app.post("/portfolio/chat")
def portfolio_chat(payload: ChatRequest):
    summary = payload.holdings_context
    if not summary:
        summary = get_summary(payload.user_id)

    history = [{"role": m.role, "content": m.content} for m in (payload.history or [])]
    reply = run_chat(payload.message, summary, history)
    return {"response": reply}


# ── Invoice settlement advice ─────────────────────────────────────────────────

class SettlementRequest(BaseModel):
    invoice_id: int
    investor_address: str
    payout_wei: int
    invoice_amount_inr: float


@app.post("/invoice/settlement")
def invoice_settlement(payload: SettlementRequest):
    payout_inr = payload.invoice_amount_inr * 0.99
    summary = get_summary("demo_user")
    result = settlement_advice(
        payout_amount=payout_inr,
        investor_address=payload.investor_address,
        invoice_id=payload.invoice_id,
        portfolio_summary=summary,
    )
    return result
