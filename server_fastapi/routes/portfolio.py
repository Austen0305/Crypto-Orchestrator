from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Dict, List, Optional
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

class Position(BaseModel):
    asset: str
    amount: float
    averagePrice: float
    currentPrice: float
    totalValue: float
    profitLoss: float
    profitLossPercent: float

class Portfolio(BaseModel):
    totalBalance: float
    availableBalance: float
    positions: Dict[str, Position]
    profitLoss24h: float
    profitLossTotal: float
    successfulTrades: Optional[int] = None
    failedTrades: Optional[int] = None
    totalTrades: Optional[int] = None
    winRate: Optional[float] = None
    averageWin: Optional[float] = None
    averageLoss: Optional[float] = None

@router.get("/{mode}")
async def get_portfolio(mode: str, current_user: dict = Depends(get_current_user)) -> Portfolio:
    """Get portfolio for paper or live trading mode"""
    try:
        if mode not in ["paper", "live"]:
            raise HTTPException(status_code=400, detail="Mode must be 'paper' or 'live'")

        # Mock data - in real implementation, fetch from database based on user
        if mode == "paper":
            return Portfolio(
                totalBalance=100000.0,
                availableBalance=95000.0,
                positions={
                    "BTC": Position(
                        asset="BTC",
                        amount=1.2,
                        averagePrice=48000.0,
                        currentPrice=50000.0,
                        totalValue=60000.0,
                        profitLoss=4800.0,
                        profitLossPercent=8.0
                    ),
                    "ETH": Position(
                        asset="ETH",
                        amount=10.0,
                        averagePrice=3200.0,
                        currentPrice=3500.0,
                        totalValue=35000.0,
                        profitLoss=3000.0,
                        profitLossPercent=9.4
                    )
                },
                profitLoss24h=1250.50,
                profitLossTotal=7800.0,
                successfulTrades=45,
                failedTrades=12,
                totalTrades=57,
                winRate=0.789,
                averageWin=215.50,
                averageLoss=-180.25
            )
        else:  # live mode
            return Portfolio(
                totalBalance=50000.0,
                availableBalance=48000.0,
                positions={
                    "BTC": Position(
                        asset="BTC",
                        amount=0.5,
                        averagePrice=49000.0,
                        currentPrice=50000.0,
                        totalValue=25000.0,
                        profitLoss=500.0,
                        profitLossPercent=2.0
                    )
                },
                profitLoss24h=320.75,
                profitLossTotal=1820.0,
                successfulTrades=23,
                failedTrades=8,
                totalTrades=31,
                winRate=0.742,
                averageWin=145.25,
                averageLoss=-125.50
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting portfolio for mode {mode}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get portfolio")
