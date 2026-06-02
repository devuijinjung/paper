from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import Trade, Position, BalanceHistory, AlertLog
from price_feed import fetch_24hr_stats, fetch_prices
from schemas import (
    PortfolioOut, TradeOut, PositionOut, AlertLogOut,
    BalanceHistoryOut, ResetRequest,
)
from trading_engine import engine

router = APIRouter(prefix="/api")


@router.get("/portfolio", response_model=PortfolioOut)
async def get_portfolio(db: AsyncSession = Depends(get_db)):
    summary = await engine.get_portfolio_summary(db)

    positions_res = await db.execute(select(Position).where(Position.qty > 0))
    positions = positions_res.scalars().all()

    history_res = await db.execute(
        select(BalanceHistory).order_by(BalanceHistory.ts.asc()).limit(500)
    )
    history = history_res.scalars().all()

    return PortfolioOut(
        cash=summary["cash"],
        equity=summary["equity"],
        total_return_pct=summary["total_return_pct"],
        win_rate=summary["win_rate"],
        positions=[PositionOut.model_validate(p) for p in positions],
        balance_history=[BalanceHistoryOut.model_validate(h) for h in history],
    )


@router.get("/trades", response_model=list[TradeOut])
async def get_trades(limit: int = 100, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(Trade).order_by(Trade.ts.desc()).limit(limit)
    )
    return [TradeOut.model_validate(t) for t in res.scalars().all()]


@router.get("/positions", response_model=list[PositionOut])
async def get_positions(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Position).where(Position.qty > 0))
    return [PositionOut.model_validate(p) for p in res.scalars().all()]


@router.get("/alerts", response_model=list[AlertLogOut])
async def get_alerts(limit: int = 50, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(AlertLog).order_by(AlertLog.ts.desc()).limit(limit)
    )
    return [AlertLogOut.model_validate(a) for a in res.scalars().all()]


@router.get("/market")
async def get_market():
    """Return live BTC/USDT price + 24h stats directly from Binance."""
    stats = await fetch_24hr_stats("BTCUSDT")
    if stats:
        return stats
    # fallback: at least return a spot price
    prices = await fetch_prices(["BTCUSDT"])
    if prices:
        return {"price": prices["BTCUSDT"]}
    return {}


@router.post("/reset")
async def reset_account(req: ResetRequest, db: AsyncSession = Depends(get_db)):
    if req.fee_rate is not None:
        engine.fee_rate = req.fee_rate
    if req.slippage is not None:
        engine.slippage = req.slippage
    await engine.reset(db, req.initial_capital)
    await db.commit()
    return {"status": "ok", "message": "Account reset"}


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    trades_res  = await db.execute(select(Trade).order_by(Trade.ts))
    trades      = list(trades_res.scalars().all())
    history_res = await db.execute(select(BalanceHistory).order_by(BalanceHistory.ts))
    history     = list(history_res.scalars().all())
    pos_res     = await db.execute(select(Position).where(Position.qty > 0))
    open_pos    = len(pos_res.scalars().all())

    closed       = [t for t in trades if t.realized_pnl != 0]
    wins         = [t for t in closed if t.realized_pnl > 0]
    losses       = [t for t in closed if t.realized_pnl < 0]
    gross_profit = sum(t.realized_pnl for t in wins)
    gross_loss   = abs(sum(t.realized_pnl for t in losses))

    # Max drawdown from equity history
    max_dd, peak = 0.0, 0.0
    for h in history:
        if h.equity > peak:
            peak = h.equity
        if peak > 0:
            dd = (h.equity - peak) / peak * 100
            if dd < max_dd:
                max_dd = dd

    return {
        "total_trades":     len(trades),
        "closed_trades":    len(closed),
        "win_count":        len(wins),
        "loss_count":       len(losses),
        "win_rate":         len(wins) / len(closed) * 100 if closed else 0,
        "total_pnl":        sum(t.realized_pnl for t in closed),
        "avg_win":          gross_profit / len(wins) if wins else 0,
        "avg_loss":         -(gross_loss / len(losses)) if losses else 0,
        "profit_factor":    gross_profit / gross_loss if gross_loss > 0 else 0,
        "max_drawdown_pct": max_dd,
        "total_fees":       sum(t.fee for t in trades),
        "open_positions":   open_pos,
    }
