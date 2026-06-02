from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


# Maps every common TradingView action keyword → canonical buy / sell / close
_ACTION_ALIASES: dict[str, str] = {
    # ── buy / long ──────────────────────────────
    "buy":          "buy",
    "long":         "buy",
    "open_long":    "buy",
    "entry_long":   "buy",
    "long_entry":   "buy",
    "enterlong":    "buy",
    "b":            "buy",
    # ── sell / short ────────────────────────────
    "sell":         "sell",
    "short":        "sell",
    "open_short":   "sell",
    "entry_short":  "sell",
    "short_entry":  "sell",
    "entershort":   "sell",
    "s":            "sell",
    # ── close / exit ────────────────────────────
    "close":        "close",
    "exit":         "close",
    "flat":         "close",
    "close_long":   "close",
    "close_short":  "close",
    "exit_long":    "close",
    "exit_short":   "close",
    "closelong":    "close",
    "closeshort":   "close",
    "exitlong":     "close",
    "exitshort":    "close",
    "close_all":    "close",
    "tp":           "close",   # take-profit treated as close
    "sl":           "close",   # stop-loss treated as close
}


class WebhookPayload(BaseModel):
    secret: str
    ticker: str
    action: str           # any alias above — normalised to buy | sell | close
    price: Optional[float] = None
    order_size_pct: Optional[float] = None  # % of cash to use
    quantity: Optional[float] = None        # explicit qty override
    strategy: Optional[str] = None
    time: Optional[str] = None

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        normalised = _ACTION_ALIASES.get(v.lower().strip())
        if normalised is None:
            supported = ", ".join(sorted(_ACTION_ALIASES))
            raise ValueError(f"Unknown action '{v}'. Supported: {supported}")
        return normalised

    @field_validator("ticker")
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        return v.upper().strip()


class TradeOut(BaseModel):
    id: int
    ts: datetime
    ticker: str
    side: str
    price: float
    qty: float
    fee: float
    realized_pnl: float
    strategy: Optional[str]

    class Config:
        from_attributes = True


class PositionOut(BaseModel):
    ticker: str
    qty: float
    avg_price: float
    current_price: float
    unrealized_pnl: float

    class Config:
        from_attributes = True


class BalanceHistoryOut(BaseModel):
    ts: datetime
    cash: float
    equity: float

    class Config:
        from_attributes = True


class AlertLogOut(BaseModel):
    id: int
    ts: datetime
    raw_payload: str
    parsed_result: Optional[str]
    status: str

    class Config:
        from_attributes = True


class PortfolioOut(BaseModel):
    cash: float
    equity: float
    total_return_pct: float
    win_rate: float
    positions: list[PositionOut]
    balance_history: list[BalanceHistoryOut]


class ResetRequest(BaseModel):
    initial_capital: Optional[float] = None
    fee_rate: Optional[float] = None
    slippage: Optional[float] = None
