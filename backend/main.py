import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from database import init_db, AsyncSessionLocal
from models import AppState, BalanceHistory, Position
from config import settings
from trading_engine import engine
from price_feed import PriceFeedService
from ws_manager import manager
from routers import webhook, api, ws

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

price_feed: PriceFeedService | None = None
_active_tickers: list[str] = []


async def _on_prices(prices: dict[str, float]):
    """Called by PriceFeedService with fresh prices; updates DB + broadcasts."""
    async with AsyncSessionLocal() as db:
        await engine.update_prices(db, prices)
        await db.commit()
        summary = await engine.get_portfolio_summary(db)
        res = await db.execute(select(Position).where(Position.qty > 0))
        positions = [
            {"ticker": p.ticker, "qty": p.qty, "avg_price": p.avg_price,
             "current_price": p.current_price, "unrealized_pnl": p.unrealized_pnl}
            for p in res.scalars().all()
        ]
    await manager.broadcast({"type": "prices", "summary": summary, "positions": positions})


def _get_active_tickers() -> list[str]:
    return _active_tickers


async def _refresh_tickers():
    global _active_tickers
    async with AsyncSessionLocal() as db:
        from models import Position
        res = await db.execute(select(Position).where(Position.qty > 0))
        _active_tickers = [p.ticker for p in res.scalars().all()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    global price_feed
    await init_db()

    # Seed initial cash if DB is empty
    async with AsyncSessionLocal() as db:
        row = await db.get(AppState, 1)
        if row is None:
            db.add(AppState(id=1, cash=settings.initial_capital))
            db.add(BalanceHistory(cash=settings.initial_capital,
                                   equity=settings.initial_capital))
            await db.commit()

    await _refresh_tickers()

    price_feed = PriceFeedService(
        get_tickers=_get_active_tickers,
        on_prices=_on_prices,
    )
    price_feed.start()

    # Periodically refresh the ticker list so new positions are picked up
    async def _ticker_refresher():
        while True:
            await asyncio.sleep(10)
            await _refresh_tickers()

    asyncio.create_task(_ticker_refresher())

    yield

    if price_feed:
        price_feed.stop()


app = FastAPI(title="Paper Trading", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhook.router)
app.include_router(api.router)
app.include_router(ws.router)
