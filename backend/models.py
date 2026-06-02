from datetime import datetime, timezone
from sqlalchemy import String, Float, DateTime, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ticker: Mapped[str] = mapped_column(String(32))
    side: Mapped[str] = mapped_column(String(16))   # long | short | close
    price: Mapped[float] = mapped_column(Float)
    qty: Mapped[float] = mapped_column(Float)
    fee: Mapped[float] = mapped_column(Float)
    realized_pnl: Mapped[float] = mapped_column(Float, default=0.0)
    strategy: Mapped[str | None] = mapped_column(String(64), nullable=True)


class Position(Base):
    __tablename__ = "positions"

    ticker: Mapped[str] = mapped_column(String(32), primary_key=True)
    side: Mapped[str] = mapped_column(String(8), default="long")  # long | short
    qty: Mapped[float] = mapped_column(Float, default=0.0)
    avg_price: Mapped[float] = mapped_column(Float, default=0.0)
    current_price: Mapped[float] = mapped_column(Float, default=0.0)
    unrealized_pnl: Mapped[float] = mapped_column(Float, default=0.0)


class BalanceHistory(Base):
    __tablename__ = "balance_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    cash: Mapped[float] = mapped_column(Float)
    equity: Mapped[float] = mapped_column(Float)


class AlertLog(Base):
    __tablename__ = "alert_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    raw_payload: Mapped[str] = mapped_column(Text)
    parsed_result: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16))  # ok | error | rejected


class AppState(Base):
    """Single-row table that holds the current cash balance."""
    __tablename__ = "app_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    cash: Mapped[float] = mapped_column(Float)
