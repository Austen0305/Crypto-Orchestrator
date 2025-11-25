"""
Performance metrics endpoint for monitoring API performance.
"""

from fastapi import APIRouter, Request, Depends
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/stats")
async def get_performance_stats(request: Request) -> Dict[str, Any]:
    """
    Get current performance statistics.
    
    Returns:
        - Total requests processed
        - Average response time
        - Per-endpoint statistics
    """
    if hasattr(request.app.state, "performance_monitor"):
        monitor = request.app.state.performance_monitor
        return monitor.get_stats()
    else:
        return {
            "error": "Performance monitoring not available",
            "total_requests": 0,
            "average_response_time": 0.0,
            "endpoints": {}
        }


@router.get("/slow-requests")
async def get_slow_requests(
    request: Request,
    threshold_ms: float = 1000.0,
    limit: int = 10
) -> Dict[str, Any]:
    """
    Get slowest requests above threshold.
    
    Args:
        threshold_ms: Minimum duration in milliseconds
        limit: Maximum number of requests to return
    
    Returns:
        List of slow requests with details
    """
    if hasattr(request.app.state, "performance_monitor"):
        monitor = request.app.state.performance_monitor
        slow_requests = monitor.get_slow_requests(threshold_ms, limit)
        
        return {
            "threshold_ms": threshold_ms,
            "count": len(slow_requests),
            "requests": slow_requests
        }
    else:
        return {
            "error": "Performance monitoring not available",
            "threshold_ms": threshold_ms,
            "count": 0,
            "requests": []
        }

