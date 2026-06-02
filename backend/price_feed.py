"""
Price polling with multi-provider fallback.
Primary: Binance public API (blocked in US/some regions → 451)
Fallback: Coinbase, Kraken
"""
import asyncio
import logging
import re
from typing import Callable

import httpx

logger = logging.getLogger(__name__)

POLL_INTERVAL = 5  # seconds

# ── Provider URLs ─────────────────────────────────────────────────────────────

BINANCE_TICKER_URL = "https://api.binance.com/api/v3/ticker/price"
BINANCE_24H_URL    = "https://api.binance.com/api/v3/ticker/24hr"


def _to_coinbase_pair(ticker: str) -> str | None:
    """BTCUSDT → BTC-USD,  ETHBTC → ETH-BTC"""
    m = re.match(r"^([A-Z]{2,6})(USDT|USDC|USD|BTC|ETH)$", ticker.upper())
    if not m:
        return None
    base, quote = m.group(1), m.group(2)
    quote = "USD" if quote in ("USDT", "USDC") else quote
    return f"{base}-{quote}"


def _to_kraken_pair(ticker: str) -> str | None:
    """BTCUSDT → XBTUSD,  ETHUSDT → ETHUSD"""
    m = re.match(r"^([A-Z]{2,6})(USDT|USDC|USD|BTC|ETH)$", ticker.upper())
    if not m:
        return None
    base, quote = m.group(1), m.group(2)
    base  = "XBT" if base  == "BTC" else base
    quote = "USD" if quote in ("USDT", "USDC") else quote
    return f"{base}{quote}"


async def _fetch_coinbase(client: httpx.AsyncClient, ticker: str) -> float | None:
    pair = _to_coinbase_pair(ticker)
    if not pair:
        return None
    try:
        r = await client.get(f"https://api.coinbase.com/v2/prices/{pair}/spot", timeout=8)
        r.raise_for_status()
        return float(r.json()["data"]["amount"])
    except Exception as exc:
        logger.debug("Coinbase fallback failed for %s: %s", ticker, exc)
        return None


async def _fetch_kraken(client: httpx.AsyncClient, ticker: str) -> float | None:
    pair = _to_kraken_pair(ticker)
    if not pair:
        return None
    try:
        r = await client.get("https://api.kraken.com/0/public/Ticker",
                             params={"pair": pair}, timeout=8)
        r.raise_for_status()
        result = r.json().get("result", {})
        if not result:
            return None
        data = next(iter(result.values()))
        return float(data["c"][0])  # last trade close price
    except Exception as exc:
        logger.debug("Kraken fallback failed for %s: %s", ticker, exc)
        return None


# ── Public API ────────────────────────────────────────────────────────────────

async def fetch_prices(tickers: list[str]) -> dict[str, float]:
    """Return {TICKER: price} trying Coinbase → Binance → Kraken per ticker.
    Coinbase is first because Binance blocks US-region servers (Render)."""
    if not tickers:
        return {}
    prices: dict[str, float] = {}
    async with httpx.AsyncClient(timeout=10) as client:
        for ticker in tickers:
            # 1. Coinbase (works from US/Render)
            price = await _fetch_coinbase(client, ticker)
            if price is not None:
                prices[ticker] = price
                continue
            # 2. Binance (works outside US)
            try:
                r = await client.get(BINANCE_TICKER_URL, params={"symbol": ticker})
                r.raise_for_status()
                prices[ticker] = float(r.json()["price"])
                continue
            except Exception:
                pass
            # 3. Kraken
            price = await _fetch_kraken(client, ticker)
            if price is not None:
                prices[ticker] = price
                continue
            logger.warning("All price sources failed for %s", ticker)
    return prices


async def fetch_24hr_stats(ticker: str) -> dict | None:
    """Return 24-hour stats. Tries Kraken first (reliable globally), then Binance."""
    async with httpx.AsyncClient(timeout=10) as client:
        # 1. Kraken (works globally including US)
        pair = _to_kraken_pair(ticker)
        if pair:
            try:
                r = await client.get("https://api.kraken.com/0/public/Ticker",
                                     params={"pair": pair}, timeout=8)
                r.raise_for_status()
                result = r.json().get("result", {})
                if result:
                    d = next(iter(result.values()))
                    price = float(d["c"][0])
                    open_ = float(d["o"])
                    high  = float(d["h"][1])
                    low   = float(d["l"][1])
                    vol   = float(d["v"][1])
                    change_pct = ((price - open_) / open_ * 100) if open_ else 0
                    return {
                        "price":      price,
                        "change_pct": round(change_pct, 2),
                        "high":       high,
                        "low":        low,
                        "volume":     vol * price,
                    }
            except Exception:
                pass
        # 2. Binance (fallback for non-US regions)
        try:
            r = await client.get(BINANCE_24H_URL, params={"symbol": ticker})
            r.raise_for_status()
            d = r.json()
            return {
                "price":      float(d["lastPrice"]),
                "change_pct": float(d["priceChangePercent"]),
                "high":       float(d["highPrice"]),
                "low":        float(d["lowPrice"]),
                "volume":     float(d["quoteVolume"]),
            }
        except Exception:
            pass
        logger.warning("All 24hr stat sources failed for %s", ticker)
        return None


class PriceFeedService:
    """Background service that polls prices and invokes a callback."""

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
