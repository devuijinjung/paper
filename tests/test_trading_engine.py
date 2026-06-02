"""
Unit tests for the paper-trading engine (futures mode).
Run with: pytest tests/ -v
"""
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("WEBHOOK_SECRET", "test")

from database import Base
from models import Trade, Position, BalanceHistory, AppState  # noqa: F401
from trading_engine import TradingEngine, InsufficientFundsError, NoPositionError

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as session:
        session.add(AppState(id=1, cash=10000.0))
        session.add(BalanceHistory(cash=10000.0, equity=10000.0))
        await session.commit()
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
def eng():
    return TradingEngine(fee_rate=0.001, slippage=0.0)


# ── Long (buy) ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_buy_creates_long_position(db, eng):
    trade = await eng.execute_buy(db, "BTCUSDT", 50000.0,
                                   order_size_pct=10, quantity=None, strategy=None)
    await db.commit()

    # 10% of $10 000 = $1 000, qty = 1000 / 50000 = 0.02 BTC
    assert trade.side == "long"
    assert abs(trade.qty - 0.02) < 1e-9
    assert abs(trade.fee - 0.02 * 50000 * 0.001) < 1e-6

    pos = await db.get(Position, "BTCUSDT")
    assert pos is not None
    assert pos.side == "long"
    assert abs(pos.qty - 0.02) < 1e-9
    assert pos.avg_price == 50000.0


@pytest.mark.asyncio
async def test_buy_deducts_cash(db, eng):
    await eng.execute_buy(db, "BTCUSDT", 50000.0,
                           order_size_pct=10, quantity=None, strategy=None)
    await db.commit()

    cash = await eng._get_cash(db)
    cost = 0.02 * 50000 * (1 + 0.001)
    assert abs(cash - (10000.0 - cost)) < 1e-6


@pytest.mark.asyncio
async def test_close_long_realizes_pnl(db, eng):
    await eng.execute_buy(db, "BTCUSDT", 50000.0,
                           order_size_pct=10, quantity=None, strategy=None)
    await db.commit()

    trade = await eng.execute_close(db, "BTCUSDT", 55000.0, strategy=None)
    await db.commit()

    expected_pnl = (55000 - 50000) * 0.02 - (0.02 * 55000 * 0.001)
    assert abs(trade.realized_pnl - expected_pnl) < 1e-4
    assert trade.side == "close"


@pytest.mark.asyncio
async def test_close_long_updates_cash(db, eng):
    await eng.execute_buy(db, "BTCUSDT", 50000.0,
                           order_size_pct=10, quantity=None, strategy=None)
    await db.commit()
    cash_before = await eng._get_cash(db)

    await eng.execute_close(db, "BTCUSDT", 55000.0, strategy=None)
    await db.commit()

    cash_after = await eng._get_cash(db)
    proceeds = 0.02 * 55000 * (1 - 0.001)
    assert abs(cash_after - (cash_before + proceeds)) < 1e-4


# ── Short (sell) ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sell_opens_short_position(db, eng):
    trade = await eng.execute_sell(db, "BTCUSDT", 50000.0,
                                    order_size_pct=10, quantity=None, strategy=None)
    await db.commit()

    assert trade.side == "short"
    pos = await db.get(Position, "BTCUSDT")
    assert pos is not None
    assert pos.side == "short"
    assert abs(pos.qty - 0.02) < 1e-9


@pytest.mark.asyncio
async def test_close_short_profit(db, eng):
    """Short opened at 50000, price drops to 40000 → profit."""
    await eng.execute_sell(db, "BTCUSDT", 50000.0,
                            order_size_pct=10, quantity=None, strategy=None)
    await db.commit()

    trade = await eng.execute_close(db, "BTCUSDT", 40000.0, strategy=None)
    await db.commit()

    expected_pnl = (50000 - 40000) * 0.02 - 0.02 * 40000 * 0.001
    assert abs(trade.realized_pnl - expected_pnl) < 1e-4
    assert trade.realized_pnl > 0


@pytest.mark.asyncio
async def test_close_short_loss(db, eng):
    """Short opened at 50000, price rises to 60000 → loss."""
    await eng.execute_sell(db, "BTCUSDT", 50000.0,
                            order_size_pct=10, quantity=None, strategy=None)
    await db.commit()

    trade = await eng.execute_close(db, "BTCUSDT", 60000.0, strategy=None)
    await db.commit()

    expected_pnl = (50000 - 60000) * 0.02 - 0.02 * 60000 * 0.001
    assert abs(trade.realized_pnl - expected_pnl) < 1e-4
    assert trade.realized_pnl < 0


# ── Auto-reverse ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sell_auto_closes_long(db, eng):
    """Buy then sell: long is auto-closed, short opens."""
    await eng.execute_buy(db, "BTCUSDT", 50000.0,
                           order_size_pct=10, quantity=None, strategy=None)
    await db.commit()

    await eng.execute_sell(db, "BTCUSDT", 55000.0,
                            order_size_pct=10, quantity=None, strategy=None)
    await db.commit()

    pos = await db.get(Position, "BTCUSDT")
    assert pos is not None
    assert pos.side == "short"  # now short, not long


@pytest.mark.asyncio
async def test_buy_auto_closes_short(db, eng):
    """Sell then buy: short is auto-closed, long opens."""
    await eng.execute_sell(db, "BTCUSDT", 50000.0,
                            order_size_pct=10, quantity=None, strategy=None)
    await db.commit()

    await eng.execute_buy(db, "BTCUSDT", 45000.0,
                           order_size_pct=10, quantity=None, strategy=None)
    await db.commit()

    pos = await db.get(Position, "BTCUSDT")
    assert pos is not None
    assert pos.side == "long"


# ── Misc ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_insufficient_funds_raises(db, eng):
    with pytest.raises(InsufficientFundsError):
        await eng.execute_buy(db, "BTCUSDT", 50000.0,
                               order_size_pct=200, quantity=None, strategy=None)


@pytest.mark.asyncio
async def test_close_no_position_raises(db, eng):
    with pytest.raises(NoPositionError):
        await eng.execute_close(db, "ETHUSDT", 3000.0, strategy=None)


@pytest.mark.asyncio
async def test_average_price_update(db, eng):
    await eng.execute_buy(db, "BTCUSDT", 40000.0,
                           quantity=0.01, order_size_pct=None, strategy=None)
    await eng.execute_buy(db, "BTCUSDT", 60000.0,
                           quantity=0.01, order_size_pct=None, strategy=None)
    await db.commit()

    pos = await db.get(Position, "BTCUSDT")
    assert abs(pos.avg_price - 50000.0) < 1e-6
    assert abs(pos.qty - 0.02) < 1e-9


@pytest.mark.asyncio
async def test_close_removes_position(db, eng):
    await eng.execute_buy(db, "BTCUSDT", 50000.0,
                           order_size_pct=10, quantity=None, strategy=None)
    await db.commit()
    await eng.execute_close(db, "BTCUSDT", 50000.0, strategy=None)
    await db.commit()

    pos = await db.get(Position, "BTCUSDT")
    assert pos is None


@pytest.mark.asyncio
async def test_slippage_applied(db):
    eng = TradingEngine(fee_rate=0.0, slippage=0.01)
    trade = await eng.execute_buy(db, "BTCUSDT", 50000.0,
                                   quantity=0.01, order_size_pct=None, strategy=None)
    await db.commit()
    assert abs(trade.price - 50500.0) < 1e-6


@pytest.mark.asyncio
async def test_reset_clears_all(db, eng):
    await eng.execute_buy(db, "BTCUSDT", 50000.0,
                           order_size_pct=10, quantity=None, strategy=None)
    await db.commit()
    await eng.reset(db, initial_capital=5000.0)
    await db.commit()

    cash = await eng._get_cash(db)
    assert cash == 5000.0
    pos = await db.get(Position, "BTCUSDT")
    assert pos is None


@pytest.mark.asyncio
async def test_win_rate_calculation(db, eng):
    # Trade 1: long profit
    await eng.execute_buy(db, "BTCUSDT", 40000.0,
                           quantity=0.01, order_size_pct=None, strategy=None)
    await eng.execute_close(db, "BTCUSDT", 50000.0, strategy=None)
    # Trade 2: long loss
    await eng.execute_buy(db, "ETHUSDT", 3000.0,
                           quantity=1.0, order_size_pct=None, strategy=None)
    await eng.execute_close(db, "ETHUSDT", 2000.0, strategy=None)
    await db.commit()

    summary = await eng.get_portfolio_summary(db)
    assert summary["win_rate"] == 50.0


# ── Action alias tests ────────────────────────────────────────────────────────

def test_action_aliases():
    from schemas import WebhookPayload, _ACTION_ALIASES

    buy_variants   = ["buy", "long", "open_long", "entry_long", "enterlong", "b"]
    sell_variants  = ["sell", "short", "open_short", "entry_short", "entershort", "s"]
    close_variants = ["close", "exit", "flat", "close_long", "close_short",
                      "exit_long", "exit_short", "tp", "sl"]

    base = dict(secret="x", ticker="BTCUSDT", price=50000.0)

    for v in buy_variants:
        p = WebhookPayload(**base, action=v)
        assert p.action == "buy", f"'{v}' should map to 'buy'"

    for v in sell_variants:
        p = WebhookPayload(**base, action=v)
        assert p.action == "sell", f"'{v}' should map to 'sell'"

    for v in close_variants:
        p = WebhookPayload(**base, action=v)
        assert p.action == "close", f"'{v}' should map to 'close'"


def test_unknown_action_raises():
    from schemas import WebhookPayload
    from pydantic import ValidationError
    import pytest

    with pytest.raises(ValidationError):
        WebhookPayload(secret="x", ticker="BTCUSDT", action="unknown_action", price=1.0)


def test_action_case_insensitive():
    from schemas import WebhookPayload
    base = dict(secret="x", ticker="BTCUSDT", price=50000.0)
    assert WebhookPayload(**base, action="BUY").action   == "buy"
    assert WebhookPayload(**base, action="Long").action  == "buy"
    assert WebhookPayload(**base, action="SHORT").action == "sell"
    assert WebhookPayload(**base, action="Exit").action  == "close"
