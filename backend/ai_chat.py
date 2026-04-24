import json
import os
from typing import Any, Dict, List

try:
    from groq import Groq
    _groq_available = True
except ImportError:
    _groq_available = False

GROQ_MODEL = "llama3-70b-8192"

INDIA_TAX_SYSTEM_PROMPT = """You are Nuvest's AI investment copilot for Indian retail investors.
Always answer with Indian tax rules in mind:

- STCG: equity held < 12 months, taxed at 20%
- LTCG: equity held > 12 months, taxed at 12.5% above ₹1 lakh exemption per FY
- ELSS: 80C deduction up to ₹1.5L total limit (lock-in 3 years)
- PPF: 80C, EEE status (all three stages tax-exempt)
- NPS Tier I: 80CCD(1B) gives additional ₹50K deduction beyond 80C limit
- SGB: capital gains exempt if held to maturity (8 years)
- Indexation: available for debt funds purchased before April 2023

FY runs April 1 – March 31. When answering, always use rupee amounts (₹) and
be specific to the user's portfolio context provided. Keep answers under 120 words.
Never give specific buy/sell advice on individual stocks — frame as educational guidance only."""

SETTLEMENT_SYSTEM_PROMPT = """You are Nuvest's post-settlement investment advisor.
A user just received funds from an invoice settlement on the Nuvest platform.
Suggest how they should redeploy the funds across:
1. More invoice tokens on Nuvest (12–18% annualised yield)
2. ELSS SIP top-up if 80C limit is unfilled
3. Debt fund or liquid fund for emergency buffer
4. NPS if 80CCD(1B) ₹50K limit is unused

Keep the suggestion under 100 words. Use rupee amounts. Be specific and actionable."""

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    if not _groq_available:
        return None
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return None
    _client = Groq(api_key=api_key)
    return _client


def run_chat(message: str, portfolio_summary: Dict[str, Any], history: List[Dict]) -> str:
    client = _get_client()
    if client is None:
        return _mock_chat_response(message, portfolio_summary)

    context_str = (
        f"User portfolio summary: {json.dumps(portfolio_summary, default=str)}"
    )
    system_with_context = f"{INDIA_TAX_SYSTEM_PROMPT}\n\n{context_str}"

    recent_history = history[-6:] if len(history) > 6 else history
    messages = [{"role": "system", "content": system_with_context}]
    for turn in recent_history:
        role = turn.get("role", "user")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": message})

    resp = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        max_tokens=250,
        temperature=0.4,
    )
    return resp.choices[0].message.content


def settlement_advice(
    payout_amount: float,
    investor_address: str,
    invoice_id: int,
    portfolio_summary: Dict[str, Any],
) -> Dict[str, Any]:
    payout_inr = round(payout_amount)
    client = _get_client()

    if client is None:
        advice_text = (
            f"₹{payout_inr:,} credited. Consider reinvesting ₹{int(payout_inr * 0.6):,} "
            f"in new invoice tokens for continued 12–18% yield, and ₹{int(payout_inr * 0.4):,} "
            f"in an ELSS SIP to fill any remaining 80C gap."
        )
    else:
        remaining_80c = portfolio_summary.get("remaining_80c", 0)
        context_str = (
            f"Investor received ₹{payout_inr:,} from invoice #{invoice_id} settlement. "
            f"Investor wallet: {investor_address}. "
            f"Remaining 80C capacity: ₹{remaining_80c:,}. "
            f"Portfolio summary: {json.dumps(portfolio_summary, default=str)}"
        )
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SETTLEMENT_SYSTEM_PROMPT},
                {"role": "user", "content": context_str},
            ],
            max_tokens=200,
            temperature=0.4,
        )
        advice_text = resp.choices[0].message.content

    return {
        "notification": f"Invoice #{invoice_id} settled — ₹{payout_inr:,} credited to your wallet.",
        "advice": advice_text,
        "invoice_id": invoice_id,
        "payout_inr": payout_inr,
    }


# kept for backward compatibility
def run_ai_chat(message: str, holdings_context: dict) -> str:
    return run_chat(message, holdings_context, [])


def _mock_chat_response(message: str, portfolio_summary: dict) -> str:
    msg = message.lower()
    elss = portfolio_summary.get("elss_invested", 0)
    ppf = portfolio_summary.get("ppf_invested", 0)
    ltcg = portfolio_summary.get("ltcg_this_fy", 0)
    remaining_80c = portfolio_summary.get("remaining_80c", max(0, 150000 - elss - ppf))

    if "elss" in msg or "80c" in msg:
        if remaining_80c > 0:
            return (
                f"You've used ₹{elss + ppf:,.0f} of your ₹1.5L 80C limit. "
                f"Invest ₹{remaining_80c:,.0f} in ELSS before March 31 "
                f"to save up to ₹{int(remaining_80c * 0.30):,} in tax."
            )
        return "Your ₹1.5L 80C limit is fully utilised. Consider NPS Tier I for an additional ₹50K deduction under 80CCD(1B)."

    if "ltcg" in msg or "long term" in msg:
        taxable = max(0, ltcg - 100000)
        return (
            f"Your LTCG this FY is ₹{ltcg:,.0f}. "
            f"₹1L is exempt — taxable gain ₹{taxable:,.0f}, "
            f"tax liability ₹{int(taxable * 0.125):,} at 12.5%."
        )

    if "rebalanc" in msg:
        eq = portfolio_summary.get("equity_pct", 0.6)
        if eq > 0.65:
            return (
                f"Equity at {round(eq * 100)}% — {round((eq - 0.60) * 100)}pp above target. "
                f"Move some to debt before March 31 to rebalance and stay within LTCG exemption."
            )
        return "Allocation looks balanced. No urgent rebalancing needed before March 31."

    return (
        "I'm your Nuvest tax copilot. Ask me about your 80C gap, LTCG exposure, "
        "rebalancing, or SIP allocation. (Demo mode — set GROQ_API_KEY for live AI.)"
    )
