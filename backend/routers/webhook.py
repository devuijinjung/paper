import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
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
async def receive_webhook(payload: dict[str, Any], db: AsyncSession = Depends(get_db)):
    raw = json.dumps(payload)
    status = "ok"
    parsed_result = None

    try:
        # Validate secret first to avoid logging payload on auth failure
        secret = payload.get("secret", "")
        if secret != settings.webhook_secret:
            log = AlertLog(raw_payload=raw, status="rejected",
                           parsed_result="invalid secret")
            db.add(log)
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
        else:  # close
            trade = await engine.execute_close(
                db, parsed.ticker, exec_price, parsed.strategy
            )

        parsed_result = json.dumps({
            "trade_id": trade.id,
            "side": trade.side,
            "price": trade.price,
            "qty": trade.qty,
            "fee": trade.fee,
            "realized_pnl": trade.realized_pnl,
        })

        await db.commit()

        # Push live update to WebSocket clients
        summary = await engine.get_portfolio_summary(db)
        await manager.broadcast({"type": "trade", "summary": summary,
                                  "trade": json.loads(parsed_result)})

        return {"status": "ok", "trade": json.loads(parsed_result)}

    except HTTPException:
        raise
    except (InsufficientFundsError, NoPositionError) as exc:
        status = "error"
        parsed_result = str(exc)
        await db.rollback()
        log = AlertLog(raw_payload=raw, status=status, parsed_result=parsed_result)
        db.add(log)
        await db.commit()
        raise HTTPException(422, str(exc))
    except Exception as exc:
        status = "error"
        parsed_result = str(exc)
        await db.rollback()
        logger.exception("Webhook processing error")
        log = AlertLog(raw_payload=raw, status=status, parsed_result=parsed_result)
        db.add(log)
        await db.commit()
        raise HTTPException(500, "Internal server error")
    finally:
        if status == "ok":
            log = AlertLog(raw_payload=raw, status=status, parsed_result=parsed_result)
            db.add(log)
            try:
                await db.commit()
            except Exception:
                pass
