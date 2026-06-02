import json
import logging
import re
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import AlertLog
from price_feed import fetch_prices
from schemas import WebhookPayload, _ACTION_ALIASES
from trading_engine import engine, InsufficientFundsError, NoPositionError
from ws_manager import manager

router = APIRouter()
logger = logging.getLogger(__name__)


def _parse_text_body(text: str) -> dict:
    """Extract trading fields from any plain-text TradingView alert message.

    Works with the default strategy message format:
      '오더 buy @ 0.001 필드 온 BTCUSDT. 뉴 스트래티지 포지션은 0.001'
    or a simple keyword like 'buy' / 'sell'.
    """
    result = {}
    # Action: first recognized alias found in the text
    for word in re.findall(r"\b\w+\b", text.lower()):
        if word in _ACTION_ALIASES:
            result["action"] = word
            break
    # Ticker: common crypto/stock pair pattern (BTCUSDT, ETHBTC, etc.)
    m = re.search(r"\b([A-Z]{2,6}(?:USDT|BTC|ETH|BUSD|USD|EUR|GBP|KRW))\b", text.upper())
    if m:
        result["ticker"] = m.group(1)
    # Quantity: number after "@"  ({{strategy.order.contracts}})
    m = re.search(r"@\s*([\d.]+)", text)
    if m:
        try:
            result["quantity"] = float(m.group(1))
        except ValueError:
            pass
    return result


async def _get_exec_price(payload: WebhookPayload) -> float:
    if payload.price:
        return payload.price
    prices = await fetch_prices([payload.ticker])
    if payload.ticker not in prices:
        raise HTTPException(502, f"Could not fetch live price for {payload.ticker}")
    return prices[payload.ticker]


@router.post("/webhook")
async def receive_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    q_action: Optional[str] = Query(None, alias="action"),
    q_ticker: Optional[str] = Query(None, alias="ticker"),
    q_secret: Optional[str] = Query(None, alias="secret"),
):
    # Parse body: try JSON first, then extract fields from plain text
    try:
        payload: dict[str, Any] = await request.json()
        if not isinstance(payload, dict):
            payload = {}
    except Exception:
        try:
            text = (await request.body()).decode().strip()
            payload = _parse_text_body(text) if text else {}
        except Exception:
            payload = {}

    # Normalize Korean JSON keys → English equivalents
    _KR = {"액션": "action", "티커": "ticker", "수량": "quantity",
           "비밀": "secret", "가격": "price", "전략": "strategy",
           "비율": "order_size_pct"}
    payload = {_KR.get(k, k): v for k, v in payload.items()}

    # If action value is a long message string (not a direct alias), extract fields from it.
    # Handles TradingView default message wrapped in JSON, e.g.:
    #   {"action": "오더 sell @ 2 필드 온 BTCUSDT...", "secret": "..."}
    action_val = str(payload.get("action", ""))
    if action_val and action_val.lower().strip() not in _ACTION_ALIASES:
        extracted = _parse_text_body(action_val)
        if "action" in extracted:
            payload["action"] = extracted["action"]
        for k, v in extracted.items():
            if k != "action":
                payload.setdefault(k, v)

    # Query-string parameters override body fields (enables message-free webhook URLs)
    if q_secret is not None: payload["secret"] = q_secret
    if q_action is not None: payload["action"] = q_action
    if q_ticker is not None: payload["ticker"] = q_ticker

    raw = json.dumps(payload)

    try:
        secret = payload.get("secret", "")
        if secret != settings.webhook_secret:
            db.add(AlertLog(raw_payload=raw, status="rejected",
                            parsed_result="invalid secret"))
            await db.commit()
            raise HTTPException(401, "Invalid webhook secret")

        parsed = WebhookPayload(**payload)
        exec_price = await _get_exec_price(parsed)

        if parsed.action == "buy":
            trade = await engine.execute_buy(
                db, parsed.ticker, exec_price,
                parsed.order_size_pct, parsed.quantity, parsed.strategy,
            )
        elif parsed.action == "sell":
            trade = await engine.execute_sell(
                db, parsed.ticker, exec_price,
                parsed.order_size_pct, parsed.quantity, parsed.strategy,
            )
        else:
            trade = await engine.execute_close(
                db, parsed.ticker, exec_price, parsed.strategy
            )

        result = {
            "trade_id": trade.id,
            "side": trade.side,
            "price": trade.price,
            "qty": trade.qty,
            "fee": trade.fee,
            "realized_pnl": trade.realized_pnl,
        }

        # Write alert log in the same transaction as the trade
        db.add(AlertLog(raw_payload=raw, status="ok",
                        parsed_result=json.dumps(result)))
        await db.commit()

        summary = await engine.get_portfolio_summary(db)
        await manager.broadcast({"type": "trade", "summary": summary, "trade": result})

        return {"status": "ok", "trade": result}

    except HTTPException:
        raise
    except (InsufficientFundsError, NoPositionError) as exc:
        await db.rollback()
        db.add(AlertLog(raw_payload=raw, status="error", parsed_result=str(exc)))
        await db.commit()
        raise HTTPException(422, str(exc))
    except Exception as exc:
        await db.rollback()
        logger.exception("Webhook processing error")
        db.add(AlertLog(raw_payload=raw, status="error", parsed_result=str(exc)))
        await db.commit()
        raise HTTPException(500, "Internal server error")
