from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
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
class FeeCalculationRequest(BaseModel):
    amount: float
    price: float
    side: str  # 'buy' or 'sell'
    isMaker: Optional[bool] = None
    volumeUSD: Optional[float] = None

class FeeResponse(BaseModel):
    feeAmount: float
    feePercentage: float
    totalAmount: float
    netAmount: float

class FeeInfo(BaseModel):
    makerFee: float
    takerFee: float
    volumeUSD: float
    nextTierVolume: Optional[float] = None

# Mock fee data
mock_fee_info = {
    "makerFee": 0.0016,  # 0.16%
    "takerFee": 0.0026,  # 0.26%
    "volumeUSD": 100000.0,
    "nextTierVolume": 500000.0
}

@router.get("/", response_model=FeeInfo)
async def get_fees(volumeUSD: Optional[float] = None, current_user: dict = Depends(get_current_user)):
    """Get current fee information"""
    try:
        fee_info = mock_fee_info.copy()
        if volumeUSD is not None:
            # In a real implementation, calculate tiered fees based on volume
            fee_info["volumeUSD"] = volumeUSD
        return fee_info
    except Exception as e:
        logger.error(f"Failed to get fees: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve fee information")

@router.post("/calculate", response_model=FeeResponse)
async def calculate_fees(request: FeeCalculationRequest, current_user: dict = Depends(get_current_user)):
    """Calculate trading fees for a specific trade"""
    try:
        # Mock fee calculation
        fee_percentage = mock_fee_info["makerFee"] if request.isMaker else mock_fee_info["takerFee"]
        fee_amount = request.amount * request.price * fee_percentage

        total_amount = request.amount * request.price
        net_amount = total_amount - fee_amount if request.side == "sell" else total_amount + fee_amount

        return {
            "feeAmount": fee_amount,
            "feePercentage": fee_percentage,
            "totalAmount": total_amount,
            "netAmount": net_amount
        }
    except Exception as e:
        logger.error(f"Failed to calculate fees: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate fees")
