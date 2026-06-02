"""
Core paper-trading engine.
All order execution is purely virtual — no real exchange calls.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models import Trade, Position, BalanceHistory, AppState


class InsufficientFundsError(Exception):
    pass


class NoPositionError(Exception):
    pass


class TradingEngine:
    def __init__(self, fee_rate: float = settings.fee_rate,
                 slippage: float = settings.slippage):
        self.fee_rate = fee_rate
        self.slippage = slippage

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_cash(self, db: AsyncSession) -> float:
        row = await db.get(AppState, 1)
        return row.cash if row else settings.initial_capital

    async def _set_cash(self, db: AsyncSession, cash: float):
        row = await db.get(AppState, 1)
        if row is None:
            row = AppState(id=1, cash=cash)
            db.add(row)
        else:
            row.cash = cash

    async def _get_position(self, db: AsyncSession, ticker: str) -> Optional[Position]:
        return await db.get(Position, ticker)

    async def _all_positions(self, db: AsyncSession) -> list[Position]:
        result = await db.execute(select(Position).where(Position.qty > 0))
        return list(result.scalars().all())

    async def _record_balance(self, db: AsyncSession, cash: float):
        positions = await self._all_positions(db)
        equity = cash + sum(p.qty * p.current_price for p in positions)
        db.add(BalanceHistory(cash=cash, equity=equity))

    # Apply slippage: buy pays more, sell receives less
    def _apply_slippage(self, price: float, side: str) -> float:
        if side == "buy":
            return price * (1 + self.slippage)
        return price * (1 - self.slippage)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def execute_buy(
        self,
        db: AsyncSession,
        ticker: str,
        price: float,
        order_size_pct: Optional[float],
        quantity: Optional[float],
        strategy: Optional[str],
    ) -> Trade:
        cash = await self._get_cash(db)
        exec_price = self._apply_slippage(price, "buy")

        if quantity:
            qty = quantity
        elif order_size_pct:
            spend = cash * (order_size_pct / 100.0)
            qty = spend / exec_price
        else:
            # Default: use 10 % of cash
            qty = (cash * 0.10) / exec_price

        cost = exec_price * qty
        fee = cost * self.fee_rate
        total_cost = cost + fee

        if total_cost > cash:
            raise InsufficientFundsError(
                f"Need {total_cost:.2f} but only {cash:.2f} available"
            )

        # Update position (average price calculation)
        pos = await self._get_position(db, ticker)
        if pos is None:
            pos = Position(ticker=ticker, qty=0.0, avg_price=0.0,
                           current_price=exec_price, unrealized_pnl=0.0)
            db.add(pos)
        new_total_qty = pos.qty + qty
        pos.avg_price = (pos.avg_price * pos.qty + exec_price * qty) / new_total_qty
        pos.qty = new_total_qty
        pos.current_price = exec_price
        pos.unrealized_pnl = (pos.current_price - pos.avg_price) * pos.qty

        new_cash = cash - total_cost
        await self._set_cash(db, new_cash)

        trade = Trade(
            ticker=ticker, side="buy", price=exec_price,
            qty=qty, fee=fee, realized_pnl=0.0, strategy=strategy,
        )
        db.add(trade)
        await db.flush()
        await self._record_balance(db, new_cash)
        return trade

    async def execute_sell(
        self,
        db: AsyncSession,
        ticker: str,
        price: float,
        order_size_pct: Optional[float],
        quantity: Optional[float],
        strategy: Optional[str],
    ) -> Trade:
        pos = await self._get_position(db, ticker)
        if pos is None or pos.qty <= 0:
            raise NoPositionError(f"No open position for {ticker}")

        exec_price = self._apply_slippage(price, "sell")

        if quantity:
            qty = min(quantity, pos.qty)
        elif order_size_pct:
            qty = pos.qty * (order_size_pct / 100.0)
        else:
            qty = pos.qty  # sell entire position

        proceeds = exec_price * qty
        fee = proceeds * self.fee_rate
        net_proceeds = proceeds - fee

        realized_pnl = (exec_price - pos.avg_price) * qty - fee

        pos.qty -= qty
        if pos.qty <= 1e-10:
            await db.delete(pos)
        else:
            pos.current_price = exec_price
            pos.unrealized_pnl = (exec_price - pos.avg_price) * pos.qty

        cash = await self._get_cash(db)
        new_cash = cash + net_proceeds
        await self._set_cash(db, new_cash)

        trade = Trade(
            ticker=ticker, side="sell", price=exec_price,
            qty=qty, fee=fee, realized_pnl=realized_pnl, strategy=strategy,
        )
        db.add(trade)
        await db.flush()
        await self._record_balance(db, new_cash)
        return trade

    async def execute_close(
        self,
        db: AsyncSession,
        ticker: str,
        price: float,
        strategy: Optional[str],
    ) -> Trade:
        """Close the entire position for ticker."""
        return await self.execute_sell(
            db, ticker, price, order_size_pct=None,
            quantity=None, strategy=strategy
        )

    async def update_prices(self, db: AsyncSession, prices: dict[str, float]):
        """Refresh unrealized PnL for all open positions with latest prices."""
        for ticker, price in prices.items():
            pos = await self._get_position(db, ticker)
            if pos and pos.qty > 0:
                pos.current_price = price
                pos.unrealized_pnl = (price - pos.avg_price) * pos.qty

    async def get_portfolio_summary(self, db: AsyncSession) -> dict:
        cash = await self._get_cash(db)
        positions = await self._all_positions(db)
        equity = cash + sum(p.qty * p.current_price for p in positions)

        # Win rate: % of closed trades with realized_pnl > 0
        result = await db.execute(select(Trade))
        trades = result.scalars().all()
        closed = [t for t in trades if t.realized_pnl != 0]
        win_rate = (
            len([t for t in closed if t.realized_pnl > 0]) / len(closed) * 100
            if closed else 0.0
        )
        total_return_pct = (equity / settings.initial_capital - 1) * 100

        return {
            "cash": cash,
            "equity": equity,
            "total_return_pct": total_return_pct,
            "win_rate": win_rate,
        }

    async def reset(self, db: AsyncSession, initial_capital: Optional[float] = None):
        """Wipe all state and restart with fresh capital."""
        capital = initial_capital or settings.initial_capital
        await db.execute(delete(Trade))
        await db.execute(delete(Position))
        await db.execute(delete(BalanceHistory))
        await db.execute(delete(AppState))
        db.add(AppState(id=1, cash=capital))
        db.add(BalanceHistory(cash=capital, equity=capital))


engine = TradingEngine()
