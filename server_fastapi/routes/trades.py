from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
import logging
import jwt
import os

logger = logging.getLogger(__name__)

router = APIRouter()
security = HTTPBearer()

# Environment variables
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Pydantic models
class TradeCreate(BaseModel):
    botId: Optional[str] = None
    pair: str
    side: str  # 'buy' or 'sell'
    amount: float
    price: float
    mode: str = "paper"  # 'paper' or 'live'

class TradeResponse(BaseModel):
    id: str
    botId: Optional[str]
    pair: str
    side: str
    amount: float
    price: float
    timestamp: str
    status: str
    pnl: Optional[float] = None

# Mock data for demonstration
mock_trades = [
    {
        "id": "trade_1",
        "botId": "bot_1",
        "pair": "BTC/USD",
        "side": "buy",
        "amount": 0.01,
        "price": 45000.0,
        "timestamp": "2024-01-01T10:00:00Z",
        "status": "completed",
        "pnl": 100.0
    },
    {
        "id": "trade_2",
        "botId": "bot_2",
        "pair": "ETH/USD",
        "side": "sell",
        "amount": 0.5,
        "price": 3000.0,
        "timestamp": "2024-01-01T11:00:00Z",
        "status": "completed",
        "pnl": -50.0
    }
]

@router.get("/", response_model=List[TradeResponse])
async def get_trades(
    botId: Optional[str] = Query(None),
    mode: Optional[str] = Query(None, regex="^(paper|live)$"),
    current_user: dict = Depends(get_current_user)
):
    """Get trades with optional filtering by bot ID and mode"""
    try:
        trades = mock_trades

        if botId:
            trades = [t for t in trades if t["botId"] == botId]

        if mode:
            # In a real implementation, filter by trading mode
            pass

        return trades
    except Exception as e:
        logger.error(f"Failed to get trades: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve trades")

@router.post("/", response_model=TradeResponse)
async def create_trade(trade: TradeCreate, current_user: dict = Depends(get_current_user)):
    """Create a new trade"""
    try:
        # Mock trade creation
        new_trade = {
            "id": f"trade_{len(mock_trades) + 1}",
            "botId": trade.botId,
            "pair": trade.pair,
            "side": trade.side,
            "amount": trade.amount,
            "price": trade.price,
            "timestamp": "2024-01-01T12:00:00Z",
            "status": "pending",
            "pnl": None
        }

        mock_trades.append(new_trade)
        return new_trade
    except Exception as e:
        logger.error(f"Failed to create trade: {e}")
        raise HTTPException(status_code=500, detail="Failed to create trade")
