import json
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import AlertLog
from price_feed import fetch_prices
from schemas import WebhookPayload
from trading_engine import engine, InsufficientFundsError, NoPositionError
from ws_manager import manager

router = APIRouter()
logger = logging.getLogger(__name__)


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
    # Parse body as JSON; fall back to {} for empty or non-JSON bodies
    try:
        payload: dict[str, Any] = await request.json()
        if not isinstance(payload, dict):
            payload = {}
    except Exception:
        payload = {}

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
