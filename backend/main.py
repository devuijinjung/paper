import asyncio
import logging
import os
import time as _time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import select

from database import init_db, AsyncSessionLocal
from models import AppState, BalanceHistory, Position
from config import settings
from trading_engine import engine
from price_feed import PriceFeedService, fetch_24hr_stats
from ws_manager import manager
from routers import webhook, api, ws

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

price_feed: PriceFeedService | None = None
_active_tickers: list[str] = []

# 24-hour market stats cache (refresh every 60 s to avoid API hammering)
_market_cache: dict = {}
_market_cache_ts: float = 0.0
_MARKET_TTL = 60.0
_ALWAYS_POLL = ["BTCUSDT"]   # always in the ticker list regardless of positions


async def _get_market_stats() -> dict:
    global _market_cache, _market_cache_ts
    if _time.monotonic() - _market_cache_ts > _MARKET_TTL:
        data = await fetch_24hr_stats("BTCUSDT")
        if data:
            _market_cache = data
            _market_cache_ts = _time.monotonic()
    return _market_cache


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

    # Merge live price into cached 24h stats so the ticker always has current price
    market = dict(await _get_market_stats())
    if "BTCUSDT" in prices:
        market["price"] = prices["BTCUSDT"]

    await manager.broadcast({
        "type": "prices",
        "summary": summary,
        "positions": positions,
        "market": market,
    })


def _get_active_tickers() -> list[str]:
    seen = set(_active_tickers) | set(_ALWAYS_POLL)
    return list(seen)


async def _refresh_tickers():
    global _active_tickers
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Position).where(Position.qty > 0))
        _active_tickers = [p.ticker for p in res.scalars().all()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    global price_feed
    await init_db()

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

_FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str):
    if not os.path.isdir(_FRONTEND_DIST):
        return {"detail": "Frontend not built. Run: npm run build inside frontend/"}
    target = os.path.join(_FRONTEND_DIST, full_path) if full_path else ""
    if target and os.path.isfile(target):
        return FileResponse(target)
    return FileResponse(os.path.join(_FRONTEND_DIST, "index.html"))
