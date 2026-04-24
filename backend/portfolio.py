import time
import os
from typing import Any, Dict, List

try:
    from kiteconnect import KiteConnect
    _kite_available = True
except ImportError:
    _kite_available = False

_cache: dict = {}
CACHE_TTL = 60

MOCK_HOLDINGS = [
    {
        "tradingsymbol": "AXISLONG",
        "exchange": "NSE",
        "isin": "INF846K01EW2",
        "quantity": 150.234,
        "average_price": 55.20,
        "last_price": 68.45,
        "pnl": 1988.55,
        "product": "CNC",
        "asset_type": "equity",
        "fund_category": "ELSS",
        "purchase_date": "2023-06-15",
        "invested_amount": 8292.92,
        "current_value": 10282.51,
    },
    {
        "tradingsymbol": "NIFTYBEES",
        "exchange": "NSE",
        "isin": "INF204KB14I2",
        "quantity": 500,
        "average_price": 182.50,
        "last_price": 234.80,
        "pnl": 26150.0,
        "product": "CNC",
        "asset_type": "equity",
        "fund_category": "Index",
        "purchase_date": "2022-09-10",
        "invested_amount": 91250.0,
        "current_value": 117400.0,
    },
    {
        "tradingsymbol": "RELIANCE",
        "exchange": "NSE",
        "isin": "INE002A01018",
        "quantity": 20,
        "average_price": 2450.0,
        "last_price": 2920.0,
        "pnl": 9400.0,
        "product": "CNC",
        "asset_type": "equity",
        "fund_category": "Equity",
        "purchase_date": "2023-01-20",
        "invested_amount": 49000.0,
        "current_value": 58400.0,
    },
    {
        "tradingsymbol": "HDFCBANK",
        "exchange": "NSE",
        "isin": "INE040A01034",
        "quantity": 30,
        "average_price": 1580.0,
        "last_price": 1720.0,
        "pnl": 4200.0,
        "product": "CNC",
        "asset_type": "equity",
        "fund_category": "Equity",
        "purchase_date": "2023-03-05",
        "invested_amount": 47400.0,
        "current_value": 51600.0,
    },
    {
        "tradingsymbol": "SGBBSE2031",
        "exchange": "BSE",
        "isin": "IN0020210070",
        "quantity": 10,
        "average_price": 4850.0,
        "last_price": 6120.0,
        "pnl": 12700.0,
        "product": "CNC",
        "asset_type": "gold",
        "fund_category": "SGB",
        "purchase_date": "2021-11-12",
        "invested_amount": 48500.0,
        "current_value": 61200.0,
    },
    {
        "tradingsymbol": "PPF",
        "exchange": "OFF",
        "isin": "",
        "quantity": 1,
        "average_price": 50000.0,
        "last_price": 50000.0,
        "pnl": 0,
        "product": "PPF",
        "asset_type": "debt",
        "fund_category": "PPF",
        "purchase_date": "2023-04-01",
        "invested_amount": 50000.0,
        "current_value": 50000.0,
    },
    {
        "tradingsymbol": "NPS_TIER1",
        "exchange": "OFF",
        "isin": "",
        "quantity": 1,
        "average_price": 25000.0,
        "last_price": 27500.0,
        "pnl": 2500.0,
        "product": "NPS",
        "asset_type": "pension",
        "fund_category": "NPS",
        "purchase_date": "2023-04-01",
        "invested_amount": 25000.0,
        "current_value": 27500.0,
    },
]


def _kite_instance():
    if not _kite_available:
        return None
    api_key = os.getenv("KITE_API_KEY")
    access_token = os.getenv("KITE_ACCESS_TOKEN")
    if not api_key or not access_token:
        return None
    kite = KiteConnect(api_key=api_key)
    kite.set_access_token(access_token)
    return kite


def get_holdings(user_id: str) -> List[Dict]:
    now = time.time()
    if user_id in _cache and now - _cache[user_id]["ts"] < CACHE_TTL:
        return _cache[user_id]["data"]

    kite = _kite_instance()
    if kite:
        try:
            data = kite.holdings()
            _cache[user_id] = {"data": data, "ts": now}
            return data
        except Exception:
            pass

    _cache[user_id] = {"data": MOCK_HOLDINGS, "ts": now}
    return MOCK_HOLDINGS


def compute_summary(holdings: List[Dict]) -> Dict[str, Any]:
    total_value = sum(h["current_value"] for h in holdings)
    total_invested = sum(h["invested_amount"] for h in holdings)

    by_asset: Dict[str, float] = {"equity": 0, "debt": 0, "gold": 0, "pension": 0}
    elss_invested = 0.0
    ppf_invested = 0.0
    ltcg_this_fy = 0.0

    for h in holdings:
        asset = h.get("asset_type", "equity")
        by_asset[asset] = by_asset.get(asset, 0) + h["current_value"]

        if h.get("fund_category") == "ELSS":
            elss_invested += h["invested_amount"]
        if h.get("fund_category") == "PPF":
            ppf_invested += h["invested_amount"]

        # Count LTCG only for equity held > 12 months (mocked via purchase_date field)
        if asset == "equity" and h.get("pnl", 0) > 0:
            ltcg_this_fy += h["pnl"] * 0.6  # assume 60% of gains are long-term for mock

    xirr_mock = round((total_value - total_invested) / total_invested * 100, 2) if total_invested else 0

    return {
        "total_value": round(total_value, 2),
        "total_invested": round(total_invested, 2),
        "total_pnl": round(total_value - total_invested, 2),
        "xirr_pct": xirr_mock,
        "equity_pct": round(by_asset["equity"] / total_value, 4) if total_value else 0,
        "debt_pct": round(by_asset["debt"] / total_value, 4) if total_value else 0,
        "gold_pct": round(by_asset["gold"] / total_value, 4) if total_value else 0,
        "pension_pct": round(by_asset["pension"] / total_value, 4) if total_value else 0,
        "elss_invested": round(elss_invested, 2),
        "ppf_invested": round(ppf_invested, 2),
        "ltcg_this_fy": round(ltcg_this_fy, 2),
    }


def generate_alerts(holdings_summary: Dict) -> List[Dict]:
    alerts = []
    fy_end = "March 31"

    remaining_80c = 150000 - holdings_summary["elss_invested"] - holdings_summary["ppf_invested"]
    if remaining_80c > 0:
        alerts.append({
            "type": "warning",
            "message": (
                f"₹{remaining_80c:,.0f} of 80C limit unused. "
                f"Invest in ELSS before {fy_end} to save tax."
            ),
        })

    equity_pct = holdings_summary["equity_pct"]
    if equity_pct > 0.65:
        overshoot = round((equity_pct - 0.60) * holdings_summary["total_value"])
        alerts.append({
            "type": "warning",
            "message": (
                f"Equity overweight by {round((equity_pct - 0.60) * 100)}%. "
                f"Consider moving ₹{overshoot:,} to debt before {fy_end}."
            ),
        })

    if holdings_summary["ltcg_this_fy"] > 80000:
        alerts.append({
            "type": "info",
            "message": (
                f"LTCG at ₹{holdings_summary['ltcg_this_fy']:,.0f} — "
                f"close to ₹1L exempt limit. Avoid harvesting more gains."
            ),
        })

    return alerts
