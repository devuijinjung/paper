"""
Binance public REST API price polling.
No API key required — uses the public ticker endpoint.
"""
import asyncio
import logging
from typing import Callable

import httpx

logger = logging.getLogger(__name__)

BINANCE_TICKER_URL = "https://api.binance.com/api/v3/ticker/price"
BINANCE_24H_URL = "https://api.binance.com/api/v3/ticker/24hr"
POLL_INTERVAL = 5  # seconds


async def fetch_24hr_stats(ticker: str) -> dict | None:
    """Return 24-hour stats for a single ticker (price, change %, high, low, volume)."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(BINANCE_24H_URL, params={"symbol": ticker})
            resp.raise_for_status()
            d = resp.json()
            return {
                "price": float(d["lastPrice"]),
                "change_pct": float(d["priceChangePercent"]),
                "high": float(d["highPrice"]),
                "low": float(d["lowPrice"]),
                "volume": float(d["quoteVolume"]),
            }
        except Exception as exc:
            logger.warning("24hr stats fetch failed for %s: %s", ticker, exc)
            return None


async def fetch_prices(tickers: list[str]) -> dict[str, float]:
    """Return {TICKER: price} for each ticker using Binance public API."""
    if not tickers:
        return {}
    async with httpx.AsyncClient(timeout=10) as client:
        prices: dict[str, float] = {}
        for ticker in tickers:
            try:
                resp = await client.get(BINANCE_TICKER_URL, params={"symbol": ticker})
                resp.raise_for_status()
                data = resp.json()
                prices[ticker] = float(data["price"])
            except Exception as exc:
                logger.warning("Price fetch failed for %s: %s", ticker, exc)
        return prices


class PriceFeedService:
    """Background service that periodically polls Binance prices
    and invokes a callback with the latest price map."""

    def __init__(self, get_tickers: Callable[[], list[str]],
                 on_prices: Callable[[dict[str, float]], None]):
        self._get_tickers = get_tickers
        self._on_prices = on_prices
        self._task: asyncio.Task | None = None

    def start(self):
        self._task = asyncio.create_task(self._run())

    def stop(self):
        if self._task:
            self._task.cancel()

    async def _run(self):
        while True:
            try:
                tickers = self._get_tickers()
                if tickers:
                    prices = await fetch_prices(tickers)
                    if prices:
                        await self._on_prices(prices)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("PriceFeed error: %s", exc)
            await asyncio.sleep(POLL_INTERVAL)
