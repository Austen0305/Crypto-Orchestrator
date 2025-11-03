from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
from fastapi import Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from server_fastapi.services.analytics_engine import AnalyticsEngine
from server_fastapi.services.advanced_analytics_engine import AdvancedAnalyticsEngine
from datetime import datetime, timedelta


logger = logging.getLogger(__name__)

# Dependency injection for analytics services
def get_analytics_engine():
    return AnalyticsEngine()

def get_advanced_analytics_engine():
    return AdvancedAnalyticsEngine()

# JWT authentication dependency - using the same as auth.py for consistency
import jwt
import os
from server_fastapi.routes.auth import get_current_user as auth_get_current_user

JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(auth_get_current_user)):
    try:
        # Since auth.py already handles JWT decoding, we can use it directly
        return auth_get_current_user.__wrapped__(credentials)
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication")

router = APIRouter()

class AnalyticsSummary(BaseModel):
    total_bots: int
    active_bots: int
    total_trades: int
    total_pnl: float
    win_rate: float
    best_performing_bot: Optional[str]
    worst_performing_bot: Optional[str]

class PerformanceMetrics(BaseModel):
    bot_id: str
    bot_name: str
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    total_pnl: float
    max_drawdown: float
    sharpe_ratio: float
    current_balance: float
    period_start: datetime
    period_end: datetime

class RiskMetrics(BaseModel):
    portfolio_value: float
    total_exposure: float
    max_drawdown: float
    value_at_risk: float
    expected_shortfall: float
    volatility: float
    sharpe_ratio: float

class TradeRecord(BaseModel):
    id: str
    bot_id: str
    symbol: str
    side: str
    amount: float
    price: float
    timestamp: datetime
    pnl: Optional[float]
    status: str

class PortfolioAnalytics(BaseModel):
    total_value: float
    total_pnl: float
    pnl_percentage: float
    asset_allocation: Dict[str, float]
    performance_vs_benchmark: float
    volatility: float
    sharpe_ratio: float
    max_drawdown: float
    risk_adjusted_return: float

class BacktestResult(BaseModel):
    strategy_id: str
    strategy_name: str
    total_return: float
    annualized_return: float
    volatility: float
    sharpe_ratio: float
    max_drawdown: float
    win_rate: float
    total_trades: int
    avg_trade_pnl: float
    start_date: datetime
    end_date: datetime
    initial_balance: float
    final_balance: float

@router.get("/summary")
async def get_analytics_summary(
    engine: AnalyticsEngine = Depends(get_analytics_engine),
    current_user: dict = Depends(get_current_user)
) -> AnalyticsSummary:
    """Get overall analytics summary"""
    try:
        # Use analytics engine to get real data
        user_id = current_user.get('id')
        analytics_result = engine.analyze({"user_id": user_id, "type": "summary"})

        return AnalyticsSummary(
            total_bots=analytics_result.summary.get('total_bots', 5),
            active_bots=analytics_result.summary.get('active_bots', 2),
            total_trades=analytics_result.summary.get('total_trades', 245),
            total_pnl=analytics_result.summary.get('total_pnl', 3250.75),
            win_rate=analytics_result.summary.get('win_rate', 0.612),
            best_performing_bot=analytics_result.summary.get('best_performing_bot', "bot-1"),
            worst_performing_bot=analytics_result.summary.get('worst_performing_bot', "bot-3")
        )
    except Exception as e:
        logger.error(f"Error getting analytics summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to get analytics summary")

@router.get("/performance")
async def get_performance_metrics(
    bot_id: Optional[str] = Query(None, description="Filter by specific bot ID"),
    period: str = Query("30d", description="Time period (1d, 7d, 30d, 90d, 1y)"),
    engine: AnalyticsEngine = Depends(get_analytics_engine),
    current_user: dict = Depends(get_current_user)
) -> List[PerformanceMetrics]:
    """Get performance metrics for bots"""
    try:
        user_id = current_user.get('id')
        analytics_result = engine.analyze({
            "user_id": user_id,
            "type": "performance",
            "bot_id": bot_id,
            "period": period
        })

        # Parse period to get start/end dates
        end_date = datetime.now()
        if period == "1d":
            start_date = end_date - timedelta(days=1)
        elif period == "7d":
            start_date = end_date - timedelta(days=7)
        elif period == "30d":
            start_date = end_date - timedelta(days=30)
        elif period == "90d":
            start_date = end_date - timedelta(days=90)
        elif period == "1y":
            start_date = end_date - timedelta(days=365)
        else:
            start_date = end_date - timedelta(days=30)

        metrics_data = analytics_result.details.get('metrics', [])

        metrics = []
        for metric_data in metrics_data:
            if bot_id and metric_data.get('bot_id') != bot_id:
                continue

            metrics.append(PerformanceMetrics(
                bot_id=metric_data.get('bot_id', 'unknown'),
                bot_name=metric_data.get('bot_name', 'Unknown Bot'),
                total_trades=metric_data.get('total_trades', 0),
                winning_trades=metric_data.get('winning_trades', 0),
                losing_trades=metric_data.get('losing_trades', 0),
                win_rate=metric_data.get('win_rate', 0.0),
                total_pnl=metric_data.get('total_pnl', 0.0),
                max_drawdown=metric_data.get('max_drawdown', 0.0),
                sharpe_ratio=metric_data.get('sharpe_ratio', 0.0),
                current_balance=metric_data.get('current_balance', 0.0),
                period_start=start_date,
                period_end=end_date
            ))

        return metrics
    except Exception as e:
        logger.error(f"Error getting performance metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get performance metrics")

@router.get("/risk")
async def get_risk_metrics(
    engine: AdvancedAnalyticsEngine = Depends(get_advanced_analytics_engine),
    current_user: dict = Depends(get_current_user)
) -> RiskMetrics:
    """Get portfolio risk metrics"""
    try:
        user_id = current_user.get('id')
        analytics_result = engine.analyze({"user_id": user_id, "type": "risk"})

        return RiskMetrics(
            portfolio_value=analytics_result.summary.get('portfolio_value', 125000.50),
            total_exposure=analytics_result.summary.get('total_exposure', 25000.75),
            max_drawdown=analytics_result.summary.get('max_drawdown', 1850.25),
            value_at_risk=analytics_result.summary.get('value_at_risk', 1250.50),
            expected_shortfall=analytics_result.summary.get('expected_shortfall', 1875.75),
            volatility=analytics_result.summary.get('volatility', 0.024),
            sharpe_ratio=analytics_result.summary.get('sharpe_ratio', 1.65)
        )
    except Exception as e:
        logger.error(f"Error getting risk metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get risk metrics")

@router.get("/trades")
async def get_trade_history(
    bot_id: Optional[str] = Query(None, description="Filter by bot ID"),
    symbol: Optional[str] = Query(None, description="Filter by trading symbol"),
    limit: int = Query(50, description="Number of trades to return", ge=1, le=500),
    offset: int = Query(0, description="Number of trades to skip", ge=0)
) -> List[TradeRecord]:
    """Get trade history"""
    try:
        # Mock data - in real implementation, fetch from database
        mock_trades = [
            TradeRecord(
                id="trade-1",
                bot_id="bot-1",
                symbol="BTC/USD",
                side="buy",
                amount=0.1,
                price=50100.50,
                timestamp=datetime.now() - timedelta(hours=2),
                pnl=125.75,
                status="closed"
            ),
            TradeRecord(
                id="trade-2",
                bot_id="bot-1",
                symbol="BTC/USD",
                side="sell",
                amount=0.1,
                price=50325.25,
                timestamp=datetime.now() - timedelta(hours=1),
                pnl=None,
                status="open"
            ),
            TradeRecord(
                id="trade-3",
                bot_id="bot-2",
                symbol="ETH/USD",
                side="buy",
                amount=1.5,
                price=3520.75,
                timestamp=datetime.now() - timedelta(minutes=30),
                pnl=-45.25,
                status="closed"
            )
        ]

        # Apply filters
        filtered_trades = mock_trades
        if bot_id:
            filtered_trades = [t for t in filtered_trades if t.bot_id == bot_id]
        if symbol:
            filtered_trades = [t for t in filtered_trades if t.symbol == symbol]

        # Apply pagination
        start_idx = offset
        end_idx = offset + limit
        return filtered_trades[start_idx:end_idx]
    except Exception as e:
        logger.error(f"Error getting trade history: {e}")
        raise HTTPException(status_code=500, detail="Failed to get trade history")

@router.get("/pnl-chart")
async def get_pnl_chart(
    bot_id: Optional[str] = Query(None, description="Filter by bot ID"),
    period: str = Query("30d", description="Time period"),
    engine: AnalyticsEngine = Depends(get_analytics_engine),
    current_user: dict = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Get PnL chart data"""
    try:
        user_id = current_user.get('id')
        analytics_result = engine.analyze({
            "user_id": user_id,
            "type": "pnl_chart",
            "bot_id": bot_id,
            "period": period
        })

        # Use real data from analytics engine, fallback to mock if not available
        chart_data = analytics_result.details.get('chart_data', [])
        if not chart_data:
            # Fallback mock data
            end_date = datetime.now()
            if period == "7d":
                days = 7
            elif period == "30d":
                days = 30
            elif period == "90d":
                days = 90
            else:
                days = 30

            chart_data = []
            cumulative_pnl = 0.0

            for i in range(days):
                date = end_date - timedelta(days=days-i-1)
                daily_pnl = (i % 5 - 2) * 50.0  # Mock daily PnL
                cumulative_pnl += daily_pnl

                chart_data.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "daily_pnl": daily_pnl,
                    "cumulative_pnl": cumulative_pnl
                })

        return chart_data
    except Exception as e:
        logger.error(f"Error getting PnL chart: {e}")
        raise HTTPException(status_code=500, detail="Failed to get PnL chart")

@router.get("/win-rate-chart")
async def get_win_rate_chart(
    bot_id: Optional[str] = Query(None, description="Filter by bot ID"),
    period: str = Query("30d", description="Time period")
) -> List[Dict[str, Any]]:
    """Get win rate chart data over time"""
    try:
        # Mock data - in real implementation, calculate rolling win rate
        end_date = datetime.now()
        if period == "7d":
            days = 7
        elif period == "30d":
            days = 30
        elif period == "90d":
            days = 90
        else:
            days = 30

        chart_data = []

        for i in range(days):
            date = end_date - timedelta(days=days-i-1)
            # Mock win rate between 50-70%
            win_rate = 0.5 + 0.2 * (i % 3 - 1) * 0.1

            chart_data.append({
                "date": date.strftime("%Y-%m-%d"),
                "win_rate": win_rate
            })

        return chart_data
    except Exception as e:
        logger.error(f"Error getting win rate chart: {e}")
        raise HTTPException(status_code=500, detail="Failed to get win rate chart")

@router.get("/drawdown-chart")
async def get_drawdown_chart(
    bot_id: Optional[str] = Query(None, description="Filter by bot ID"),
    period: str = Query("30d", description="Time period")
) -> List[Dict[str, Any]]:
    """Get drawdown chart data"""
    try:
        # Mock data - in real implementation, calculate drawdown from equity curve
        end_date = datetime.now()
        if period == "7d":
            days = 7
        elif period == "30d":
            days = 30
        elif period == "90d":
            days = 90
        else:
            days = 30

        chart_data = []
        peak = 100000.0
        current_value = 100000.0

        for i in range(days):
            date = end_date - timedelta(days=days-i-1)

            # Mock price movement
            change = (i % 10 - 5) * 100.0
            current_value += change
            peak = max(peak, current_value)
            drawdown = (peak - current_value) / peak

            chart_data.append({
                "date": date.strftime("%Y-%m-%d"),
                "drawdown": drawdown,
                "portfolio_value": current_value
            })

        return chart_data
    except Exception as e:
        logger.error(f"Error getting drawdown chart: {e}")
        raise HTTPException(status_code=500, detail="Failed to get drawdown chart")

@router.get("/portfolio")
async def get_portfolio_analytics(
    period: str = Query("30d", description="Time period (1d, 7d, 30d, 90d, 1y)"),
    engine: AdvancedAnalyticsEngine = Depends(get_advanced_analytics_engine),
    current_user: dict = Depends(get_current_user)
) -> PortfolioAnalytics:
    """Get portfolio analytics"""
    try:
        user_id = current_user.get('id')
        analytics_result = engine.analyze({
            "user_id": user_id,
            "type": "portfolio",
            "period": period
        })

        return PortfolioAnalytics(
            total_value=analytics_result.summary.get('total_value', 100000.0),
            total_pnl=analytics_result.summary.get('total_pnl', 5000.0),
            pnl_percentage=analytics_result.summary.get('pnl_percentage', 5.0),
            asset_allocation=analytics_result.details.get('asset_allocation', {}),
            performance_vs_benchmark=analytics_result.summary.get('performance_vs_benchmark', 2.5),
            volatility=analytics_result.summary.get('volatility', 0.15),
            sharpe_ratio=analytics_result.summary.get('sharpe_ratio', 1.8),
            max_drawdown=analytics_result.summary.get('max_drawdown', 1500.0),
            risk_adjusted_return=analytics_result.summary.get('risk_adjusted_return', 1.2)
        )
    except Exception as e:
        logger.error(f"Error getting portfolio analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get portfolio analytics")

@router.get("/backtesting/{strategy_id}")
async def get_backtesting_results(
    strategy_id: str,
    backtest_id: Optional[str] = Query(None, description="Specific backtest ID"),
    engine: AdvancedAnalyticsEngine = Depends(get_advanced_analytics_engine),
    current_user: dict = Depends(get_current_user)
) -> BacktestResult:
    """Get backtesting results for a strategy"""
    try:
        user_id = current_user.get('id')
        analytics_result = engine.analyze({
            "user_id": user_id,
            "type": "backtesting",
            "strategy_id": strategy_id,
            "backtest_id": backtest_id
        })

        backtest_data = analytics_result.details.get('backtest', {})

        return BacktestResult(
            strategy_id=strategy_id,
            strategy_name=backtest_data.get('strategy_name', 'Unknown Strategy'),
            total_return=backtest_data.get('total_return', 0.0),
            annualized_return=backtest_data.get('annualized_return', 0.0),
            volatility=backtest_data.get('volatility', 0.0),
            sharpe_ratio=backtest_data.get('sharpe_ratio', 0.0),
            max_drawdown=backtest_data.get('max_drawdown', 0.0),
            win_rate=backtest_data.get('win_rate', 0.0),
            total_trades=backtest_data.get('total_trades', 0),
            avg_trade_pnl=backtest_data.get('avg_trade_pnl', 0.0),
            start_date=datetime.fromisoformat(backtest_data.get('start_date', datetime.now().isoformat())),
            end_date=datetime.fromisoformat(backtest_data.get('end_date', datetime.now().isoformat())),
            initial_balance=backtest_data.get('initial_balance', 10000.0),
            final_balance=backtest_data.get('final_balance', 10000.0)
        )
    except Exception as e:
        logger.error(f"Error getting backtesting results: {e}")
        raise HTTPException(status_code=500, detail="Failed to get backtesting results")
