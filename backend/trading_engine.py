"""
Core paper-trading engine — Futures mode.
buy  = open / add to LONG
sell = open / add to SHORT
close = close whatever position is open
"""
from __future__ import annotations

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
        # equity = cash + locked margin + unrealized PnL (works for both long and short)
        equity = cash + sum(p.avg_price * p.qty + p.unrealized_pnl for p in positions)
        db.add(BalanceHistory(cash=cash, equity=equity))

    def _apply_slippage(self, price: float, side: str) -> float:
        if side == "buy":
            return price * (1 + self.slippage)
        return price * (1 - self.slippage)

    def _calc_qty(self, cash: float, exec_price: float,
                  order_size_pct: Optional[float], quantity: Optional[float]) -> float:
        if quantity:
            return quantity
        if order_size_pct:
            spend = cash * (order_size_pct / 100.0)
            return spend / exec_price
        # Default: 100% of available cash (reserve exact fee margin)
        return cash / (exec_price * (1 + self.fee_rate))

    async def _close(self, db: AsyncSession, ticker: str, price: float,
                     strategy: Optional[str], *, silent: bool = False) -> Optional[Trade]:
        """Close the full position. silent=True returns None instead of raising when no position."""
        pos = await self._get_position(db, ticker)
        if pos is None or pos.qty <= 0:
            if silent:
                return None
            raise NoPositionError(f"{ticker} 포지션이 없습니다")

        cash = await self._get_cash(db)

        if pos.side == "long":
            exec_price = self._apply_slippage(price, "sell")
            proceeds = exec_price * pos.qty
            fee = proceeds * self.fee_rate
            net = proceeds - fee
            realized_pnl = (exec_price - pos.avg_price) * pos.qty - fee
        else:  # short
            exec_price = self._apply_slippage(price, "buy")
            # Return locked margin + PnL (buying back at current price)
            returned = pos.avg_price * pos.qty + (pos.avg_price - exec_price) * pos.qty
            fee = exec_price * pos.qty * self.fee_rate
            net = returned - fee
            realized_pnl = (pos.avg_price - exec_price) * pos.qty - fee

        new_cash = cash + net
        await self._set_cash(db, new_cash)
        await db.delete(pos)

        trade = Trade(ticker=ticker, side="close", price=exec_price,
                      qty=pos.qty, fee=fee, realized_pnl=realized_pnl, strategy=strategy)
        db.add(trade)
        await db.flush()
        await self._record_balance(db, new_cash)
        return trade

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
        """Open / add to LONG position. Auto-closes any SHORT first."""
        pos = await self._get_position(db, ticker)
        if pos and pos.side == "short" and pos.qty > 0:
            await self._close(db, ticker, price, strategy, silent=True)
            pos = None

        exec_price = self._apply_slippage(price, "buy")
        cash = await self._get_cash(db)
        qty = self._calc_qty(cash, exec_price, order_size_pct, quantity)

        cost = exec_price * qty
        fee = cost * self.fee_rate
        total_cost = cost + fee
        if total_cost > cash:
            raise InsufficientFundsError(
                f"잔고 부족: {total_cost:.2f} 필요, {cash:.2f} 보유")

        if pos is None or pos.qty <= 0:
            pos = Position(ticker=ticker, side="long", qty=0.0, avg_price=0.0,
                           current_price=exec_price, unrealized_pnl=0.0)
            db.add(pos)

        new_qty = pos.qty + qty
        pos.avg_price = (pos.avg_price * pos.qty + exec_price * qty) / new_qty
        pos.qty = new_qty
        pos.side = "long"
        pos.current_price = exec_price
        pos.unrealized_pnl = (exec_price - pos.avg_price) * pos.qty

        new_cash = cash - total_cost
        await self._set_cash(db, new_cash)

        trade = Trade(ticker=ticker, side="long", price=exec_price,
                      qty=qty, fee=fee, realized_pnl=0.0, strategy=strategy)
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
        """Open / add to SHORT position. Auto-closes any LONG first."""
        pos = await self._get_position(db, ticker)
        if pos and pos.side == "long" and pos.qty > 0:
            await self._close(db, ticker, price, strategy, silent=True)
            pos = None

        exec_price = self._apply_slippage(price, "sell")
        cash = await self._get_cash(db)
        qty = self._calc_qty(cash, exec_price, order_size_pct, quantity)

        # Margin = position value (deducted as collateral, returned at close)
        margin = exec_price * qty
        fee = margin * self.fee_rate
        total_cost = margin + fee
        if total_cost > cash:
            raise InsufficientFundsError(
                f"잔고 부족: {total_cost:.2f} 필요, {cash:.2f} 보유")

        if pos is None or pos.qty <= 0:
            pos = Position(ticker=ticker, side="short", qty=0.0, avg_price=0.0,
                           current_price=exec_price, unrealized_pnl=0.0)
            db.add(pos)

        new_qty = pos.qty + qty
        pos.avg_price = (pos.avg_price * pos.qty + exec_price * qty) / new_qty
        pos.qty = new_qty
        pos.side = "short"
        pos.current_price = exec_price
        pos.unrealized_pnl = (pos.avg_price - exec_price) * pos.qty

        new_cash = cash - total_cost
        await self._set_cash(db, new_cash)

        trade = Trade(ticker=ticker, side="short", price=exec_price,
                      qty=qty, fee=fee, realized_pnl=0.0, strategy=strategy)
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
        return await self._close(db, ticker, price, strategy, silent=False)

    async def update_prices(self, db: AsyncSession, prices: dict[str, float]):
        for ticker, price in prices.items():
            pos = await self._get_position(db, ticker)
            if pos and pos.qty > 0:
                pos.current_price = price
                if pos.side == "long":
                    pos.unrealized_pnl = (price - pos.avg_price) * pos.qty
                else:
                    pos.unrealized_pnl = (pos.avg_price - price) * pos.qty

    async def get_portfolio_summary(self, db: AsyncSession) -> dict:
        cash = await self._get_cash(db)
        positions = await self._all_positions(db)
        equity = cash + sum(p.avg_price * p.qty + p.unrealized_pnl for p in positions)

        result = await db.execute(select(Trade))
        trades = result.scalars().all()
        closed = [t for t in trades if t.realized_pnl != 0]
        win_rate = (
            len([t for t in closed if t.realized_pnl > 0]) / len(closed) * 100
            if closed else 0.0
        )

        first = await db.execute(
            select(BalanceHistory).order_by(BalanceHistory.ts.asc()).limit(1)
        )
        first_row = first.scalar_one_or_none()
        baseline = first_row.equity if first_row else settings.initial_capital
        total_return_pct = (equity / baseline - 1) * 100 if baseline else 0.0

        return {
            "cash": cash,
            "equity": equity,
            "total_return_pct": total_return_pct,
            "win_rate": win_rate,
        }

    async def reset(self, db: AsyncSession, initial_capital: Optional[float] = None):
        capital = initial_capital or settings.initial_capital
        await db.execute(delete(Trade))
        await db.execute(delete(Position))
        await db.execute(delete(BalanceHistory))
        await db.execute(delete(AppState))
        db.add(AppState(id=1, cash=capital))
        db.add(BalanceHistory(cash=capital, equity=capital))


engine = TradingEngine()
