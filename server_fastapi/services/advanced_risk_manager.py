import asyncio
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import logging
from datetime import datetime
import numpy as np

logger = logging.getLogger(__name__)

class RiskProfile(BaseModel):
    max_position_size: float
    stop_loss_distance: float
    take_profit_distance: float
    entry_confidence: float

class RiskMetrics(BaseModel):
    current_risk: float
    historical_volatility: float
    expected_drawdown: float
    optimal_leverage: float
    kelly_fraction: float

class Trade(BaseModel):
    id: str
    symbol: str
    side: str  # 'buy' or 'sell'
    amount: float
    price: float
    timestamp: int
    pnl: Optional[float] = None

class MarketData(BaseModel):
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float

class AdvancedRiskManager:
    _instance: Optional['AdvancedRiskManager'] = None

    def __init__(self):
        if AdvancedRiskManager._instance is not None:
            raise Exception("AdvancedRiskManager is a singleton class")

        self.historical_data: List[MarketData] = []
        self.recent_trades: List[Trade] = []
        self.risk_metrics = RiskMetrics(
            current_risk=0.0,
            historical_volatility=0.0,
            expected_drawdown=0.0,
            optimal_leverage=1.0,
            kelly_fraction=0.5
        )

        self.max_trades_history = 1000
        self.risk_update_interval = 5 * 60  # 5 minutes in seconds
        self.update_task: Optional[asyncio.Task] = None

        AdvancedRiskManager._instance = self

    @classmethod
    def get_instance(cls) -> 'AdvancedRiskManager':
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def start_risk_updates(self):
        """Start periodic risk assessment updates"""
        if self.update_task is None:
            self.update_task = asyncio.create_task(self._periodic_risk_update())

    async def stop_risk_updates(self):
        """Stop periodic risk assessment updates"""
        if self.update_task:
            self.update_task.cancel()
            try:
                await self.update_task
            except asyncio.CancelledError:
                pass
            self.update_task = None

    async def _periodic_risk_update(self):
        """Periodic risk assessment update"""
        while True:
            try:
                await self.update_risk_assessment()
                await asyncio.sleep(self.risk_update_interval)
            except asyncio.CancelledError:
                break
            except Exception as error:
                logger.error(f"Error in periodic risk update: {error}")
                await asyncio.sleep(self.risk_update_interval)

    async def calculate_optimal_risk_profile(
        self,
        current_price: float,
        volatility: float,
        market_conditions: Dict[str, Any]
    ) -> RiskProfile:
        """Calculate optimal risk profile based on current market conditions"""
        metrics = self.risk_metrics
        kelly_fraction = self.calculate_kelly_fraction()

        # Base position size on Kelly Criterion and current market conditions
        max_position_size = kelly_fraction * metrics.optimal_leverage

        # Adjust for market volatility
        max_position_size *= (1 - min(volatility, 0.5))

        # Calculate dynamic stop loss based on volatility and market conditions
        stop_loss_distance = self.calculate_dynamic_stop_loss(volatility, market_conditions)

        # Calculate take profit based on risk:reward ratio
        take_profit_distance = stop_loss_distance * self.calculate_risk_reward_ratio(market_conditions)

        # Calculate entry confidence score
        entry_confidence = self.calculate_entry_confidence(market_conditions)

        return RiskProfile(
            max_position_size=min(max_position_size, 0.1),  # Cap at 10%
            stop_loss_distance=stop_loss_distance,
            take_profit_distance=take_profit_distance,
            entry_confidence=entry_confidence
        )

    def calculate_kelly_fraction(self) -> float:
        """Calculate Kelly fraction based on trading performance"""
        # Mock performance metrics - in real implementation, get from performance monitor
        win_rate = 0.55  # 55% win rate
        average_win = 0.02  # 2% average win
        average_loss = 0.015  # 1.5% average loss

        if average_loss == 0 or not win_rate:
            return 0.0

        probability = win_rate
        odds = average_win / average_loss

        kelly_fraction = (probability * (odds + 1) - 1) / odds

        # Limit kelly fraction to reasonable bounds
        kelly_fraction = max(0.0, min(kelly_fraction, 0.5))

        return kelly_fraction

    def calculate_dynamic_stop_loss(self, volatility: float, market_conditions: Dict[str, Any]) -> float:
        """Calculate dynamic stop loss based on volatility and market conditions"""
        # Base stop loss on volatility (simplified ATR)
        stop_loss = volatility * 2

        # Adjust for market conditions
        regime = market_conditions.get('regime', 'normal')
        if regime == 'volatile':
            stop_loss *= 1.5

        # Ensure minimum stop loss
        return max(stop_loss, 0.01)

    def calculate_risk_reward_ratio(self, market_conditions: Dict[str, Any]) -> float:
        """Calculate risk-reward ratio based on market regime"""
        regime = market_conditions.get('regime', 'normal')

        # Base RR ratio on market regime
        if regime == 'trending':
            return 3.0  # Higher reward target in trending markets
        elif regime == 'ranging':
            return 2.0  # Lower targets in ranging markets
        elif regime == 'volatile':
            return 2.5  # Balanced in volatile markets
        else:
            return 2.0

    def calculate_entry_confidence(self, market_conditions: Dict[str, Any]) -> float:
        """Calculate entry confidence score"""
        confidence = 0.5  # Base confidence

        # Adjust for market conditions
        trend_strength = market_conditions.get('trend', {}).get('strength', 0.5)
        if trend_strength > 0.7:
            confidence += 0.2

        volume_level = market_conditions.get('volume', {}).get('level', 'medium')
        if volume_level == 'high':
            confidence += 0.1

        liquidity_sufficient = market_conditions.get('liquidity', {}).get('sufficient', True)
        if not liquidity_sufficient:
            confidence -= 0.3

        # Ensure bounds
        return max(0.0, min(confidence, 1.0))

    async def update_risk_assessment(self):
        """Update comprehensive risk assessment"""
        try:
            # Mock market conditions - in real implementation, get from market analyzer
            market_conditions = {
                'regime': 'normal',
                'volatility': 0.02,
                'trend': {'strength': 0.6},
                'volume': {'level': 'medium'},
                'liquidity': {'sufficient': True}
            }

            # Update risk metrics
            self.risk_metrics = RiskMetrics(
                current_risk=self.calculate_current_risk(),
                historical_volatility=market_conditions['volatility'],
                expected_drawdown=self.calculate_expected_drawdown(),
                optimal_leverage=self.calculate_optimal_leverage(),
                kelly_fraction=self.calculate_kelly_fraction()
            )

            logger.info('Risk metrics updated', extra={
                'current_risk': self.risk_metrics.current_risk,
                'historical_volatility': self.risk_metrics.historical_volatility,
                'expected_drawdown': self.risk_metrics.expected_drawdown,
                'optimal_leverage': self.risk_metrics.optimal_leverage,
                'kelly_fraction': self.risk_metrics.kelly_fraction
            })
        except Exception as error:
            logger.error(f'Error updating risk assessment: {error}')

    def calculate_current_risk(self) -> float:
        """Calculate current risk exposure"""
        if not self.recent_trades:
            return 0.0

        # Simple risk calculation based on recent trades
        total_exposure = sum(abs(trade.amount * trade.price) for trade in self.recent_trades[-10:])
        return min(total_exposure / 10000, 1.0)  # Normalize to 0-1 scale

    def calculate_expected_drawdown(self) -> float:
        """Calculate expected maximum drawdown"""
        if len(self.recent_trades) < 10:
            return 0.05  # Default 5%

        # Calculate drawdown from recent trades
        cumulative_pnl = 0.0
        peak = 0.0
        max_drawdown = 0.0

        for trade in self.recent_trades[-50:]:  # Last 50 trades
            if trade.pnl is not None:
                cumulative_pnl += trade.pnl
                peak = max(peak, cumulative_pnl)
                drawdown = peak - cumulative_pnl
                max_drawdown = max(max_drawdown, drawdown)

        return max_drawdown if self.recent_trades else 0.05

    def calculate_optimal_leverage(self) -> float:
        """Calculate optimal leverage based on risk metrics"""
        base_leverage = 1.0

        # Reduce leverage in high volatility
        if self.risk_metrics.historical_volatility > 0.03:
            base_leverage *= 0.8

        # Reduce leverage if recent drawdown is high
        if self.risk_metrics.expected_drawdown > 0.1:
            base_leverage *= 0.9

        return max(base_leverage, 0.5)

    def update_risk_metrics(self, market_conditions: Dict[str, Any]):
        """Update risk metrics based on market conditions"""
        volatility = market_conditions.get('volatility', 0.02)
        regime = market_conditions.get('regime', 'normal')

        if volatility > 0.3 or regime == 'volatile':
            logger.warning('High risk alert triggered', extra={
                'volatility': volatility,
                'regime': regime
            })

    def adjust_risk_parameters(self, performance_metrics: Dict[str, Any]):
        """Adjust risk parameters based on performance"""
        consecutive_losses = performance_metrics.get('consecutive_losses', 0)

        if consecutive_losses > 3:
            self.reduce_risk_exposure()

    def reduce_risk_exposure(self):
        """Reduce risk exposure after consecutive losses"""
        self.risk_metrics.optimal_leverage *= 0.8
        logger.info('Risk exposure reduced due to consecutive losses', extra={
            'new_leverage': self.risk_metrics.optimal_leverage
        })

    def add_trade(self, trade: Trade):
        """Add a trade to the recent trades history"""
        self.recent_trades.append(trade)
        if len(self.recent_trades) > self.max_trades_history:
            self.recent_trades.pop(0)

    def get_risk_metrics(self) -> RiskMetrics:
        """Get current risk metrics"""
        return self.risk_metrics.copy()

    async def dispose(self):
        """Clean up resources"""
        await self.stop_risk_updates()

# Global instance
advanced_risk_manager = AdvancedRiskManager.get_instance()
