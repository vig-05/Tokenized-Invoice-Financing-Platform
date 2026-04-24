from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Optional

from model import InvoiceInput, run_scoring
from portfolio import get_holdings, compute_summary, generate_alerts
from ai_chat import run_ai_chat

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


# ── Portfolio ─────────────────────────────────────────────────────────────────

@app.get("/portfolio/holdings")
def portfolio_holdings(user_id: str = "demo_user"):
    holdings = get_holdings(user_id)
    return {"user_id": user_id, "holdings": holdings}


@app.get("/portfolio/summary")
def portfolio_summary(user_id: str = "demo_user"):
    holdings = get_holdings(user_id)
    summary = compute_summary(holdings)
    alerts = generate_alerts(summary)
    return {"summary": summary, "alerts": alerts}


# ── AI Chat ───────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    holdings_context: Optional[dict[str, Any]] = {}


@app.post("/portfolio/chat")
def portfolio_chat(payload: ChatRequest):
    context = payload.holdings_context or {}
    if not context:
        from portfolio import get_holdings, compute_summary
        holdings = get_holdings("demo_user")
        context = compute_summary(holdings)

    reply = run_ai_chat(payload.message, context)
    return {"reply": reply}
