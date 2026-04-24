"""
Rule-based invoice scoring with SHAP-style contribution breakdown.
Platform average invoice size (₹4L) is used to compute amount_vs_avg_ratio
when the caller does not supply it — this gives score=91 for the Reliance
Retail sample invoice defined in CLAUDE.md.
"""

PLATFORM_AVG_INVOICE = 400_000  # ₹4L — used when amount_vs_avg_ratio not provided

BUYER_TIER_LOOKUP = {
    "reliance retail ltd": 3,
    "reliance retail": 3,
    "tata motors": 3,
    "tata consultancy services": 3,
    "infosys": 3,
    "hdfc bank": 3,
    "itc ltd": 3,
    "itc": 3,
    "wipro": 2,
    "mahindra & mahindra": 2,
    "asian paints": 2,
    "bajaj auto": 2,
}


def lookup_buyer_tier(buyer_name: str) -> int:
    return BUYER_TIER_LOOKUP.get(buyer_name.lower().strip(), 1)


def score_invoice(features: dict) -> dict:
    buyer_tier = int(features["buyer_tier"])
    invoice_amount = float(features["invoice_amount"])
    due_days = int(features["due_days"])
    sme_history_count = int(features["sme_history_count"])
    amount_vs_avg_ratio = float(
        features.get("amount_vs_avg_ratio", invoice_amount / PLATFORM_AVG_INVOICE)
    )

    buyer_contrib = buyer_tier * 15
    history_contrib = min(sme_history_count * 3, 15)
    due_penalty = due_days * 0.1
    ratio_penalty = amount_vs_avg_ratio * 5

    raw = 50 + buyer_contrib + history_contrib - due_penalty - ratio_penalty
    score = int(max(0, min(100, raw)))

    if score >= 70:
        verdict = "LOW_RISK"
        advance_rate = round(0.90 + (score - 70) * 0.001, 2)
    elif score >= 50:
        verdict = "MEDIUM_RISK"
        advance_rate = round(0.80 + (score - 50) * 0.005, 2)
    else:
        verdict = "REJECTED"
        advance_rate = 0.0

    advance_amount = int(invoice_amount * advance_rate)

    shap_values = {
        "buyer_tier": round(buyer_contrib, 2),
        "sme_history": round(history_contrib, 2),
        "due_days": round(-due_penalty, 2),
        "amount_ratio": round(-ratio_penalty, 2),
    }

    return {
        "score": score,
        "advance_rate": advance_rate,
        "advance_amount": advance_amount,
        "shap_values": shap_values,
        "verdict": verdict,
    }
