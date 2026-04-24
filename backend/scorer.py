"""
Gradient boosted tree invoice scoring model with real SHAP explanations.
Uses sklearn GradientBoostingRegressor (same algorithm family as XGBoost).
Trained at import time on 3,000 synthetic invoices generated from domain rules
(buyer tier, history, due date, default rate). SHAP values are real tree SHAP,
not hand-computed contributions.
"""

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
import shap

PLATFORM_AVG_INVOICE = 400_000  # ₹4L

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

FEATURE_NAMES = [
    "buyer_tier",
    "invoice_amount",
    "due_days",
    "sme_history_count",
    "sme_default_rate",
    "amount_vs_avg_ratio",
]


def lookup_buyer_tier(buyer_name: str) -> int:
    return BUYER_TIER_LOOKUP.get(buyer_name.lower().strip(), 1)


def _synthetic_data(n: int = 3000, seed: int = 42):
    rng = np.random.default_rng(seed)

    buyer_tier        = rng.integers(0, 4, n).astype(float)
    invoice_amount    = rng.uniform(50_000, 10_000_000, n)
    due_days          = rng.integers(7, 180, n).astype(float)
    sme_history_count = rng.integers(0, 40, n).astype(float)
    sme_default_rate  = rng.uniform(0.0, 0.4, n)
    amount_vs_avg     = invoice_amount / PLATFORM_AVG_INVOICE

    scores = (
        50
        + buyer_tier * 15
        + np.minimum(sme_history_count * 3, 15)
        - due_days * 0.1
        - amount_vs_avg * 5
        - sme_default_rate * 25
        + rng.normal(0, 2, n)
    )
    scores = np.clip(scores, 0, 100)

    X = np.column_stack([
        buyer_tier, invoice_amount, due_days,
        sme_history_count, sme_default_rate, amount_vs_avg,
    ])
    return X, scores


def _build_model():
    X, y = _synthetic_data()
    model = GradientBoostingRegressor(
        n_estimators=150,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.8,
        random_state=42,
    )
    model.fit(X, y)
    explainer = shap.TreeExplainer(model)
    return model, explainer


# Trained once at server startup (~1-2 s)
_model, _explainer = _build_model()


def score_invoice(features: dict) -> dict:
    buyer_tier        = int(features["buyer_tier"])
    invoice_amount    = float(features["invoice_amount"])
    due_days          = int(features["due_days"])
    sme_history_count = int(features["sme_history_count"])
    sme_default_rate  = float(features.get("sme_default_rate", 0.0))
    amount_vs_avg     = float(
        features.get("amount_vs_avg_ratio", invoice_amount / PLATFORM_AVG_INVOICE)
    )

    X = np.array([[
        buyer_tier, invoice_amount, due_days,
        sme_history_count, sme_default_rate, amount_vs_avg,
    ]])

    raw = float(_model.predict(X)[0])
    score = int(max(0, min(100, round(raw))))

    # Real tree SHAP — shape (n_samples, n_features) for regressors
    shap_raw = _explainer.shap_values(X)[0]
    shap_by_feature = {
        name: round(float(v), 2)
        for name, v in zip(FEATURE_NAMES, shap_raw)
    }

    if score >= 70:
        verdict      = "LOW_RISK"
        advance_rate = round(0.90 + (score - 70) * 0.001, 2)
    elif score >= 50:
        verdict      = "MEDIUM_RISK"
        advance_rate = round(0.80 + (score - 50) * 0.005, 2)
    else:
        verdict      = "REJECTED"
        advance_rate = 0.0

    advance_amount = int(invoice_amount * advance_rate)

    # Keys match what ScoreBreakdown.jsx expects
    shap_values = {
        "buyer_tier":   shap_by_feature["buyer_tier"],
        "sme_history":  shap_by_feature["sme_history_count"],
        "due_days":     shap_by_feature["due_days"],
        "amount_ratio": shap_by_feature["amount_vs_avg_ratio"],
    }

    return {
        "score":          score,
        "advance_rate":   advance_rate,
        "advance_amount": advance_amount,
        "shap_values":    shap_values,
        "verdict":        verdict,
    }
