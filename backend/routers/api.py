from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import Trade, Position, BalanceHistory, AlertLog
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


@router.post("/reset")
async def reset_account(req: ResetRequest, db: AsyncSession = Depends(get_db)):
    if req.fee_rate is not None:
        engine.fee_rate = req.fee_rate
    if req.slippage is not None:
        engine.slippage = req.slippage
    await engine.reset(db, req.initial_capital)
    await db.commit()
    return {"status": "ok", "message": "Account reset"}
