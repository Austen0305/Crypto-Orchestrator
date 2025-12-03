"""
Binance Testnet API Routes
Safe testing environment for trading strategies
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import logging

from server_fastapi.services.exchange.binance_testnet_service import (
    get_binance_testnet_service,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class MarketOrderRequest(BaseModel):
    """Market order request model"""

    symbol: str = Field(..., description="Trading pair (e.g., 'BTC/USDT')")
    side: str = Field(..., description="'buy' or 'sell'")
    quantity: float = Field(..., gt=0, description="Amount to trade")
    user_id: Optional[str] = Field(None, description="User identifier")
    bot_id: Optional[str] = Field(None, description="Bot identifier")


class LimitOrderRequest(BaseModel):
    """Limit order request model"""

    symbol: str = Field(..., description="Trading pair (e.g., 'BTC/USDT')")
    side: str = Field(..., description="'buy' or 'sell'")
    quantity: float = Field(..., gt=0, description="Amount to trade")
    price: float = Field(..., gt=0, description="Limit price")
    user_id: Optional[str] = Field(None, description="User identifier")
    bot_id: Optional[str] = Field(None, description="Bot identifier")


class CancelOrderRequest(BaseModel):
    """Cancel order request model"""

    order_id: str = Field(..., description="Order ID to cancel")
    symbol: str = Field(..., description="Trading pair")


@router.post("/market-order", summary="Create Market Order on Testnet")
async def create_market_order(request: MarketOrderRequest):
    """
    Create a market order on Binance testnet

    - Safe testing environment
    - No real money at risk
    - Validates trading logic
    """
    service = get_binance_testnet_service()
    result = await service.create_market_order(
        symbol=request.symbol,
        side=request.side,
        quantity=request.quantity,
        user_id=request.user_id,
        bot_id=request.bot_id,
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Order failed"))

    return result


@router.post("/limit-order", summary="Create Limit Order on Testnet")
async def create_limit_order(request: LimitOrderRequest):
    """
    Create a limit order on Binance testnet

    - Specify exact price
    - Test advanced order types
    """
    service = get_binance_testnet_service()
    result = await service.create_limit_order(
        symbol=request.symbol,
        side=request.side,
        quantity=request.quantity,
        price=request.price,
        user_id=request.user_id,
        bot_id=request.bot_id,
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Order failed"))

    return result


@router.post("/cancel-order", summary="Cancel Order on Testnet")
async def cancel_order(request: CancelOrderRequest):
    """Cancel an order on Binance testnet"""
    service = get_binance_testnet_service()
    result = await service.cancel_order(
        order_id=request.order_id, symbol=request.symbol
    )

    if not result["success"]:
        raise HTTPException(
            status_code=400, detail=result.get("error", "Cancel failed")
        )

    return result


@router.get("/balance", summary="Get Testnet Balance")
async def get_balance():
    """
    Get current testnet account balance

    Returns all currencies with non-zero balances
    """
    service = get_binance_testnet_service()
    result = await service.get_balance()

    if not result["success"]:
        raise HTTPException(
            status_code=500, detail=result.get("error", "Balance fetch failed")
        )

    return result


@router.get("/orders", summary="Get Order History")
async def get_order_history(
    symbol: Optional[str] = Query(None, description="Filter by symbol"),
    limit: int = Query(100, ge=1, le=1000, description="Max number of orders"),
):
    """
    Get order history from testnet

    - Filter by symbol (optional)
    - Limit results
    """
    service = get_binance_testnet_service()
    result = await service.get_order_history(symbol=symbol, limit=limit)

    if not result["success"]:
        raise HTTPException(
            status_code=500, detail=result.get("error", "Order history fetch failed")
        )

    return result


@router.get("/open-orders", summary="Get Open Orders")
async def get_open_orders(
    symbol: Optional[str] = Query(None, description="Filter by symbol")
):
    """Get all open orders from testnet"""
    service = get_binance_testnet_service()
    result = await service.get_open_orders(symbol=symbol)

    if not result["success"]:
        raise HTTPException(
            status_code=500, detail=result.get("error", "Open orders fetch failed")
        )

    return result


@router.get("/ticker/{symbol}", summary="Get Current Price")
async def get_ticker(symbol: str):
    """
    Get current ticker price for a symbol

    Uses production market data
    """
    service = get_binance_testnet_service()
    result = await service.get_ticker(symbol)

    if not result["success"]:
        raise HTTPException(
            status_code=500, detail=result.get("error", "Ticker fetch failed")
        )

    return result


@router.get("/validate", summary="Validate Testnet Connection")
async def validate_connection():
    """
    Validate Binance testnet connection

    Checks:
    - API credentials
    - Network connectivity
    - Balance access
    """
    service = get_binance_testnet_service()
    result = await service.validate_connection()

    return result


@router.get("/health", summary="Testnet Health Check")
async def health_check():
    """Health check for Binance testnet service"""
    service = get_binance_testnet_service()

    if not service.exchange:
        return {
            "status": "not_configured",
            "message": "Testnet API keys not configured",
        }

    validation = await service.validate_connection()

    return {
        "status": "healthy" if validation["success"] else "unhealthy",
        "connected": validation.get("connected", False),
        "message": validation.get("message", "Unknown status"),
    }
