from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Dict, Any
import logging
import time
import jwt
import os
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()
security = HTTPBearer()

# Environment variables
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")

class SystemStatus(BaseModel):
    status: str
    timestamp: str
    uptime: float
    version: str
    services: Dict[str, str]

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.get("/")
async def get_status() -> SystemStatus:
    """Get basic system status"""
    try:
        return SystemStatus(
            status="running",
            timestamp=datetime.utcnow().isoformat(),
            uptime=time.time(),  # Would be actual uptime in real implementation
            version="1.0.0",
            services={
                "fastapi": "healthy",
                "database": "healthy",  # Mock
                "redis": "healthy"  # Mock
            }
        )
    except Exception as e:
        logger.error(f"Failed to get status: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve status")

@router.get("/protected")
async def get_protected_status(current_user: dict = Depends(get_current_user)) -> SystemStatus:
    """Get system status (authenticated endpoint)"""
    try:
        return SystemStatus(
            status="running",
            timestamp=datetime.utcnow().isoformat(),
            uptime=time.time(),
            version="1.0.0",
            services={
                "fastapi": "healthy",
                "database": "healthy",
                "redis": "healthy",
                "auth": "healthy"
            }
        )
    except Exception as e:
        logger.error(f"Failed to get protected status: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve protected status")
