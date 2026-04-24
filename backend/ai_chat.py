import json
import os
from openai import OpenAI

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

_grok_client = None  # OpenAI | None


def _get_client():
    global _grok_client
    if _grok_client is not None:
        return _grok_client
    api_key = os.getenv("GROK_API_KEY")
    if not api_key:
        return None
    _grok_client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1")
    return _grok_client


def run_ai_chat(message: str, holdings_context: dict) -> str:
    client = _get_client()
    if client is None:
        return _mock_response(message, holdings_context)

    context_str = f"User holdings summary: {json.dumps(holdings_context)}"
    response = client.chat.completions.create(
        model="grok-beta",
        messages=[
            {"role": "system", "content": INDIA_TAX_SYSTEM_PROMPT},
            {"role": "user", "content": f"{context_str}\n\nQuestion: {message}"},
        ],
        max_tokens=200,
    )
    return response.choices[0].message.content


def _mock_response(message: str, holdings_context: dict) -> str:
    msg = message.lower()
    elss = holdings_context.get("elss_invested", 0)
    ppf = holdings_context.get("ppf_invested", 0)
    ltcg = holdings_context.get("ltcg_this_fy", 0)
    remaining_80c = max(0, 150000 - elss - ppf)

    if "elss" in msg or "80c" in msg:
        if remaining_80c > 0:
            return (
                f"You've used ₹{elss + ppf:,} of your ₹1.5L 80C limit. "
                f"You can still invest ₹{remaining_80c:,} in ELSS before March 31 "
                f"to maximise your deduction and save up to ₹{int(remaining_80c * 0.30):,} in tax."
            )
        return "Your ₹1.5L 80C limit is fully utilised. Consider NPS Tier I for an additional ₹50K deduction under 80CCD(1B)."

    if "ltcg" in msg or "long term" in msg:
        exempt = 100000
        taxable = max(0, ltcg - exempt)
        return (
            f"Your LTCG this FY is ₹{ltcg:,}. "
            f"₹1L is exempt — taxable gain is ₹{taxable:,}, "
            f"tax liability ₹{int(taxable * 0.125):,} at 12.5%."
        )

    if "rebalanc" in msg:
        equity_pct = holdings_context.get("equity_pct", 0.6)
        if equity_pct > 0.65:
            overshoot = round((equity_pct - 0.60) * 100)
            return (
                f"Your equity allocation is {round(equity_pct*100)}% — {overshoot}pp above target. "
                f"Consider moving some equity to debt before March 31 to rebalance and lock in LTCG within the ₹1L exempt limit."
            )
        return "Your allocation looks balanced. No urgent rebalancing needed before March 31."

    if "sell" in msg or "nifty" in msg or "sip" in msg:
        return (
            "Check the purchase date before selling. If held > 12 months, gains are taxed as LTCG at 12.5% "
            "(₹1L exempt per FY). If < 12 months, STCG applies at 20%. "
            "Consider timing the sale after crossing the 12-month mark if you're close."
        )

    return (
        "I'm your Nuvest tax copilot. Ask me about your 80C gap, LTCG exposure, "
        "rebalancing before March 31, or SIP allocation. "
        "(Note: GROK_API_KEY not set — running in demo mode.)"
    )
