from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


class WebhookPayload(BaseModel):
    secret: str
    ticker: str
    action: str           # buy | sell | close
    price: Optional[float] = None
    order_size_pct: Optional[float] = None  # % of cash to use
    quantity: Optional[float] = None        # explicit qty override
    strategy: Optional[str] = None
    time: Optional[str] = None

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        allowed = {"buy", "sell", "close"}
        if v.lower() not in allowed:
            raise ValueError(f"action must be one of {allowed}")
        return v.lower()

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
