import time
import os
from typing import Any, Dict, List

from typing import Optional

try:
    from kiteconnect import KiteConnect
    _kite_available = True
except ImportError:
    _kite_available = False

_cache: dict = {}
CACHE_TTL = 60
_kite_client: Optional["KiteConnect"] = None  # module-level singleton

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


def _tag(holding: dict) -> str:
    cat = holding.get("fund_category", "")
    asset = holding.get("asset_type", "equity")
    if cat == "ELSS":
        return "ELSS"
    if cat == "SGB":
        return "SGB"
    if asset == "pension" or cat == "NPS":
        return "Pension"
    if asset == "debt" or cat in ("PPF", "Debt"):
        return "Debt"
    return "Equity"


def _enrich(holdings: List[Dict]) -> List[Dict]:
    enriched = []
    for raw in holdings:
        h = dict(raw)
        qty = float(h.get("quantity", 0))
        avg = float(h.get("average_price", 0))
        last = float(h.get("last_price", 0))
        invested = h.get("invested_amount", avg * qty)
        current = h.get("current_value", last * qty)
        h["invested_amount"] = round(float(invested), 2)
        h["current_value"] = round(float(current), 2)
        h["return_pct"] = round((float(current) - float(invested)) / float(invested) * 100, 2) if float(invested) else 0
        h["tag"] = _tag(h)
        enriched.append(h)
    return enriched


def _ensure_kite() -> Optional["KiteConnect"]:
    """Return the singleton KiteConnect instance, initialising it if needed."""
    global _kite_client
    if not _kite_available:
        return None
    api_key = os.getenv("KITE_API_KEY", "").strip()
    if not api_key:
        return None
    if _kite_client is None:
        _kite_client = KiteConnect(api_key=api_key)
        token = os.getenv("KITE_ACCESS_TOKEN", "").strip()
        if token:
            _kite_client.set_access_token(token)
    return _kite_client


def set_kite_access_token(token: str) -> None:
    """Persist a freshly-exchanged access token and invalidate the data cache."""
    global _kite_client
    kite = _ensure_kite()
    if kite:
        kite.set_access_token(token)
        _cache.clear()


def get_kite_access_token(request_token: str) -> dict:
    """Exchange a Kite request_token for an access_token dict."""
    kite = _ensure_kite()
    if not kite:
        raise ValueError("KITE_API_KEY not configured")
    api_secret = os.getenv("KITE_API_SECRET", "").strip()
    return kite.generate_session(request_token, api_secret=api_secret)


def get_holdings(user_id: str) -> List[Dict]:
    now = time.time()
    if user_id in _cache and now - _cache[user_id]["ts"] < CACHE_TTL:
        return _cache[user_id]["data"]

    kite = _ensure_kite()
    if kite:
        try:
            raw = kite.holdings()
            data = _enrich(raw)
            _cache[user_id] = {"data": data, "ts": now, "live": True}
            return data
        except Exception:
            pass

    data = _enrich(MOCK_HOLDINGS)
    _cache[user_id] = {"data": data, "ts": now, "live": False}
    return data


def get_summary(user_id: str) -> Dict[str, Any]:
    holdings = get_holdings(user_id)
    is_live = _cache.get(user_id, {}).get("live", False)

    total_value = sum(h["current_value"] for h in holdings)
    total_invested = sum(h["invested_amount"] for h in holdings)

    by_asset: Dict[str, float] = {"equity": 0.0, "debt": 0.0, "gold": 0.0, "pension": 0.0}
    elss_invested = 0.0
    ppf_invested = 0.0
    ltcg_this_fy = 0.0
    stcg_exposure = 0.0

    for h in holdings:
        tag = h.get("tag", "Equity")
        cv = h["current_value"]

        if tag in ("Equity", "ELSS"):
            by_asset["equity"] += cv
        elif tag == "SGB":
            by_asset["gold"] += cv
        elif tag in ("Debt", "PPF"):
            by_asset["debt"] += cv
        elif tag == "Pension":
            by_asset["pension"] += cv

        if tag == "ELSS":
            elss_invested += h["invested_amount"]
        if tag in ("Debt", "PPF"):
            ppf_invested += h["invested_amount"]

        pnl = float(h.get("pnl", 0))
        if tag in ("Equity", "ELSS") and pnl > 0:
            ltcg_this_fy += pnl * 0.6
            stcg_exposure += pnl * 0.4

    xirr_proxy = round((total_value - total_invested) / total_invested * 100, 2) if total_invested else 0
    remaining_80c = max(0.0, 150000 - elss_invested - ppf_invested)

    return {
        "total_value": round(total_value, 2),
        "total_invested": round(total_invested, 2),
        "total_pnl": round(total_value - total_invested, 2),
        "xirr_pct": xirr_proxy,
        "equity_pct": round(by_asset["equity"] / total_value, 4) if total_value else 0,
        "debt_pct": round(by_asset["debt"] / total_value, 4) if total_value else 0,
        "gold_pct": round(by_asset["gold"] / total_value, 4) if total_value else 0,
        "pension_pct": round(by_asset["pension"] / total_value, 4) if total_value else 0,
        "allocation": {
            "equity": round(by_asset["equity"], 2),
            "debt": round(by_asset["debt"], 2),
            "gold": round(by_asset["gold"], 2),
            "pension": round(by_asset["pension"], 2),
        },
        "elss_invested": round(elss_invested, 2),
        "ppf_invested": round(ppf_invested, 2),
        "remaining_80c": round(remaining_80c, 2),
        "ltcg_this_fy": round(ltcg_this_fy, 2),
        "stcg_exposure": round(stcg_exposure, 2),
        "is_live": is_live,
    }


def get_alerts(summary: Dict) -> List[Dict]:
    alerts = []
    fy_end = "March 31"

    remaining_80c = summary.get("remaining_80c", 0)
    if remaining_80c > 0:
        alerts.append({
            "type": "warning",
            "text": (
                f"₹{remaining_80c:,.0f} of 80C limit unused. "
                f"Invest in ELSS before {fy_end} to save up to ₹{int(remaining_80c * 0.30):,} in tax."
            ),
        })

    equity_pct = summary.get("equity_pct", 0)
    if equity_pct > 0.65:
        overshoot = round((equity_pct - 0.60) * summary["total_value"])
        alerts.append({
            "type": "warning",
            "text": (
                f"Equity overweight by {round((equity_pct - 0.60) * 100)}pp. "
                f"Consider moving ₹{overshoot:,} to debt before {fy_end}."
            ),
        })

    ltcg = summary.get("ltcg_this_fy", 0)
    if ltcg > 80000:
        alerts.append({
            "type": "info",
            "text": (
                f"LTCG at ₹{ltcg:,.0f} — "
                f"close to ₹1L exempt limit. Avoid harvesting more gains this FY."
            ),
        })

    return alerts


def get_kite_login_url() -> str:
    kite = _ensure_kite()
    if not kite:
        return ""
    return kite.login_url()


# kept for backward compatibility with any imports
def compute_summary(holdings: List[Dict]) -> Dict[str, Any]:
    total_value = sum(h.get("current_value", 0) for h in holdings)
    total_invested = sum(h.get("invested_amount", 0) for h in holdings)
    by_asset: Dict[str, float] = {"equity": 0.0, "debt": 0.0, "gold": 0.0, "pension": 0.0}
    elss_invested = 0.0
    ppf_invested = 0.0
    ltcg_this_fy = 0.0
    for h in holdings:
        asset = h.get("asset_type", "equity")
        by_asset[asset] = by_asset.get(asset, 0.0) + h.get("current_value", 0)
        if h.get("fund_category") == "ELSS":
            elss_invested += h.get("invested_amount", 0)
        if h.get("fund_category") == "PPF":
            ppf_invested += h.get("invested_amount", 0)
        if asset == "equity" and h.get("pnl", 0) > 0:
            ltcg_this_fy += h["pnl"] * 0.6
    xirr = round((total_value - total_invested) / total_invested * 100, 2) if total_invested else 0
    return {
        "total_value": round(total_value, 2),
        "total_invested": round(total_invested, 2),
        "total_pnl": round(total_value - total_invested, 2),
        "xirr_pct": xirr,
        "equity_pct": round(by_asset["equity"] / total_value, 4) if total_value else 0,
        "debt_pct": round(by_asset["debt"] / total_value, 4) if total_value else 0,
        "gold_pct": round(by_asset["gold"] / total_value, 4) if total_value else 0,
        "pension_pct": round(by_asset["pension"] / total_value, 4) if total_value else 0,
        "elss_invested": round(elss_invested, 2),
        "ppf_invested": round(ppf_invested, 2),
        "ltcg_this_fy": round(ltcg_this_fy, 2),
        "remaining_80c": round(max(0, 150000 - elss_invested - ppf_invested), 2),
    }


def generate_alerts(holdings_summary: Dict) -> List[Dict]:
    return get_alerts(holdings_summary)


def get_historical(symbol: str, exchange: str, days: int = 30) -> List[Dict]:
    """Return OHLCV candles for a symbol using Kite historical_data API."""
    kite = _ensure_kite()
    if not kite:
        return []

    # Find instrument_token from cached holdings
    instrument_token = None
    for user_cache in _cache.values():
        for h in user_cache.get("data", []):
            if h.get("tradingsymbol") == symbol and h.get("exchange", "NSE") == exchange:
                instrument_token = h.get("instrument_token")
                break
        if instrument_token:
            break

    if not instrument_token:
        return []

    try:
        import datetime
        to_date   = datetime.date.today()
        from_date = to_date - datetime.timedelta(days=days + 14)  # extra for weekends
        raw = kite.historical_data(instrument_token, from_date, to_date, "day")
        candles = []
        for c in raw[-(days):]:
            d = c["date"]
            date_str = (f"{d.day} {d.strftime('%b')}") if hasattr(d, "strftime") else str(d)[:10]
            candles.append({
                "date":  date_str,
                "open":  round(float(c["open"]),  2),
                "high":  round(float(c["high"]),  2),
                "low":   round(float(c["low"]),   2),
                "close": round(float(c["close"]), 2),
            })
        return candles
    except Exception:
        return []
