from pydantic import BaseModel, Field, field_validator
from typing import Optional
from scorer import score_invoice, lookup_buyer_tier


class InvoiceInput(BaseModel):
    buyer: str
    buyer_tier: Optional[int] = Field(None, ge=0, le=3)
    invoice_amount: float = Field(..., gt=0, description="Invoice face value in INR")
    due_days: int = Field(..., ge=1, le=365)
    sme_name: str
    sme_history_count: int = Field(..., ge=0)
    sme_default_rate: float = Field(0.0, ge=0.0, le=1.0)
    amount_vs_avg_ratio: Optional[float] = Field(None, gt=0)

    @field_validator("buyer_tier", mode="before")
    @classmethod
    def resolve_buyer_tier(cls, v, info):
        if v is not None:
            return v
        buyer = (info.data or {}).get("buyer", "")
        return lookup_buyer_tier(buyer) if buyer else 1

    def to_features(self) -> dict:
        resolved_tier = self.buyer_tier if self.buyer_tier is not None else lookup_buyer_tier(self.buyer)
        d = {
            "buyer_tier": resolved_tier,
            "invoice_amount": self.invoice_amount,
            "due_days": self.due_days,
            "sme_history_count": self.sme_history_count,
            "sme_default_rate": self.sme_default_rate,
        }
        if self.amount_vs_avg_ratio is not None:
            d["amount_vs_avg_ratio"] = self.amount_vs_avg_ratio
        return d


class ScoreResult(BaseModel):
    score: int
    advance_rate: float
    advance_amount: int
    shap_values: dict
    verdict: str


def run_scoring(invoice: InvoiceInput) -> ScoreResult:
    result = score_invoice(invoice.to_features())
    return ScoreResult(**result)
