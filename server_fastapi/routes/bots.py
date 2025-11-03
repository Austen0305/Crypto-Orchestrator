from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, ValidationError
from typing import List, Optional, Dict, Any
import logging
import asyncio
from datetime import datetime

from ..services.enhanced_ml_engine import EnhancedMLEngine, MLPrediction
from ..services.ensemble_engine import EnsembleEngine, EnsemblePrediction
from ..services.neural_network_engine import NeuralNetworkEngine, NeuralNetPrediction
from ..services.advanced_risk_manager import AdvancedRiskManager, RiskProfile
from ..services.trading_orchestrator import TradingOrchestrator
from .auth import get_current_user, storage
import jwt
import os


logger = logging.getLogger(__name__)

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")

def validate_jwt_and_get_user(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())) -> dict:
    """Validate JWT token and return user information."""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user = storage.getUserById(payload['id'])
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"JWT validation error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

# Dependency injection for services
def get_ml_engine() -> EnhancedMLEngine:
    return EnhancedMLEngine()

def get_ensemble_engine() -> EnsembleEngine:
    return EnsembleEngine()

def get_neural_network_engine() -> NeuralNetworkEngine:
    return NeuralNetworkEngine()

def get_risk_manager() -> AdvancedRiskManager:
    return AdvancedRiskManager()

def get_trading_orchestrator() -> TradingOrchestrator:
    return TradingOrchestrator()

router = APIRouter()

# Pydantic models
class BotConfig(BaseModel):
    id: str
    user_id: int
    name: str
    symbol: str
    strategy: str
    is_active: bool
    config: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

class CreateBotRequest(BaseModel):
    name: str
    symbol: str
    strategy: str
    config: Dict[str, Any]

    @staticmethod
    def validate_strategy(strategy: str):
        valid_strategies = ['ml_enhanced', 'ensemble', 'neural_network', 'simple_ma', 'rsi']
        if strategy not in valid_strategies:
            raise ValueError(f"Invalid strategy. Must be one of: {', '.join(valid_strategies)}")

class UpdateBotRequest(BaseModel):
    name: Optional[str] = None
    symbol: Optional[str] = None
    strategy: Optional[str] = None
    is_active: Optional[bool] = None
    config: Optional[Dict[str, Any]] = None

class BotPerformance(BaseModel):
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    total_pnl: float
    max_drawdown: float
    sharpe_ratio: float
    current_balance: float

class MockBotStorage:
    def __init__(self):
        self.bots = {}
        self.next_id = 1
        self._seed_default_bots()

    def _seed_default_bots(self):
        default_bot = {
            'id': 'bot-1',
            'user_id': 1,  # Associate with default user
            'name': 'BTC Trend Follower',
            'symbol': 'BTC/USD',
            'strategy': 'ml_enhanced',
            'is_active': False,
            'config': {
                'max_position_size': 0.1,
                'stop_loss': 0.02,
                'take_profit': 0.05,
                'risk_per_trade': 0.01,
                'ml_config': {
                    'confidence_threshold': 0.7,
                    'features': ['price', 'volume', 'rsi', 'macd']
                }
            },
            'created_at': datetime.now(),
            'updated_at': datetime.now()
        }
        self.bots['bot-1'] = default_bot

    def get_all_bots(self) -> List[BotConfig]:
        return [BotConfig(**bot) for bot in self.bots.values()]

    def get_bot(self, bot_id: str) -> Optional[BotConfig]:
        bot = self.bots.get(bot_id)
        return BotConfig(**bot) if bot else None

    def create_bot(self, bot_data: Dict[str, Any], user_id: int) -> BotConfig:
        bot_id = f"bot-{self.next_id}"
        self.next_id += 1
        bot = {
            'id': bot_id,
            'user_id': user_id,
            'name': bot_data['name'],
            'symbol': bot_data['symbol'],
            'strategy': bot_data['strategy'],
            'is_active': False,
            'config': bot_data['config'],
            'created_at': datetime.now(),
            'updated_at': datetime.now()
        }
        self.bots[bot_id] = bot
        return BotConfig(**bot)

    def get_user_bots(self, user_id: int) -> List[BotConfig]:
        return [BotConfig(**bot) for bot in self.bots.values() if bot['user_id'] == user_id]

    def update_bot(self, bot_id: str, updates: Dict[str, Any]) -> Optional[BotConfig]:
        if bot_id not in self.bots:
            return None

        bot = self.bots[bot_id]
        for key, value in updates.items():
            if value is not None:
                if key == 'config':
                    bot['config'].update(value)
                else:
                    bot[key] = value
        bot['updated_at'] = datetime.now()

        return BotConfig(**bot)

    def delete_bot(self, bot_id: str) -> bool:
        if bot_id in self.bots:
            del self.bots[bot_id]
            return True
        return False

bot_storage = MockBotStorage()

@router.get("/")
async def get_bots(current_user: dict = Depends(validate_jwt_and_get_user)) -> List[BotConfig]:
    """Get all trading bots for the authenticated user"""
    try:
        return bot_storage.get_user_bots(current_user['id'])
    except Exception as e:
        logger.error(f"Error fetching bots for user {current_user['id']}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch bots")

@router.get("/{bot_id}")
async def get_bot(bot_id: str, current_user: dict = Depends(validate_jwt_and_get_user)) -> BotConfig:
    """Get a specific bot by ID"""
    try:
        bot = bot_storage.get_bot(bot_id)
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")
        if bot.user_id != current_user['id']:
            raise HTTPException(status_code=403, detail="Access denied")
        return bot
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching bot {bot_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch bot")

@router.post("/")
async def create_bot(request: CreateBotRequest, current_user: dict = Depends(validate_jwt_and_get_user)) -> BotConfig:
    """Create a new trading bot"""
    try:
        # Validate strategy
        CreateBotRequest.validate_strategy(request.strategy)

        bot = bot_storage.create_bot(request.dict(), current_user['id'])
        logger.info(f"Created new bot: {bot.id} for user {current_user['id']}")
        return bot
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating bot for user {current_user['id']}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create bot")

@router.patch("/{bot_id}")
async def update_bot(bot_id: str, request: UpdateBotRequest, current_user: dict = Depends(validate_jwt_and_get_user)) -> BotConfig:
    """Update an existing bot"""
    try:
        # Check if bot exists and belongs to user
        bot = bot_storage.get_bot(bot_id)
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")
        if bot.user_id != current_user['id']:
            raise HTTPException(status_code=403, detail="Access denied")

        # Validate strategy if being updated
        if request.strategy:
            CreateBotRequest.validate_strategy(request.strategy)

        updates = {k: v for k, v in request.dict().items() if v is not None}
        bot = bot_storage.update_bot(bot_id, updates)
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")
        logger.info(f"Updated bot: {bot_id}")
        return bot
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating bot {bot_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update bot")

@router.delete("/{bot_id}")
async def delete_bot(bot_id: str, current_user: dict = Depends(validate_jwt_and_get_user)):
    """Delete a bot"""
    try:
        # Check if bot exists and belongs to user
        bot = bot_storage.get_bot(bot_id)
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")
        if bot.user_id != current_user['id']:
            raise HTTPException(status_code=403, detail="Access denied")

        if not bot_storage.delete_bot(bot_id):
            raise HTTPException(status_code=404, detail="Bot not found")
        logger.info(f"Deleted bot: {bot_id}")
        return {"message": "Bot deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting bot {bot_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete bot")

@router.post("/{bot_id}/start")
async def start_bot(bot_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(validate_jwt_and_get_user)):
    """Start a trading bot"""
    try:
        # Check if bot exists and belongs to user
        bot = bot_storage.get_bot(bot_id)
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")
        if bot.user_id != current_user['id']:
            raise HTTPException(status_code=403, detail="Access denied")

        if bot.is_active:
            raise HTTPException(status_code=400, detail="Bot is already active")

        # Update bot status
        bot_storage.update_bot(bot_id, {'is_active': True})

        # Start bot in background
        background_tasks.add_task(run_bot_loop, bot_id)

        logger.info(f"Started bot: {bot_id}")
        return {"message": f"Bot {bot_id} started successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting bot {bot_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to start bot")

@router.post("/{bot_id}/stop")
async def stop_bot(bot_id: str, current_user: dict = Depends(validate_jwt_and_get_user)):
    """Stop a trading bot"""
    try:
        # Check if bot exists and belongs to user
        bot = bot_storage.get_bot(bot_id)
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")
        if bot.user_id != current_user['id']:
            raise HTTPException(status_code=403, detail="Access denied")

        if not bot.is_active:
            raise HTTPException(status_code=400, detail="Bot is not active")

        # Update bot status
        bot_storage.update_bot(bot_id, {'is_active': False})

        logger.info(f"Stopped bot: {bot_id}")
        return {"message": f"Bot {bot_id} stopped successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error stopping bot {bot_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to stop bot")

@router.get("/{bot_id}/model")
async def get_bot_model(bot_id: str, current_user: dict = Depends(validate_jwt_and_get_user)) -> Dict[str, Any]:
    """Get bot's ML model status"""
    try:
        # Check if bot exists and belongs to user
        bot = bot_storage.get_bot(bot_id)
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")
        if bot.user_id != current_user['id']:
            raise HTTPException(status_code=403, detail="Access denied")

        # Get appropriate ML engine based on strategy
        ml_engine = None
        if bot.strategy == 'ml_enhanced':
            ml_engine = get_ml_engine()
        elif bot.strategy == 'ensemble':
            ml_engine = get_ensemble_engine()
        elif bot.strategy == 'neural_network':
            ml_engine = get_neural_network_engine()

        if ml_engine:
            # In real implementation, get actual model status
            return {
                "bot_id": bot_id,
                "strategy": bot.strategy,
                "model_trained": True,
                "last_trained": datetime.now().isoformat(),
                "accuracy": 0.65,
                "total_predictions": 150,
                "correct_predictions": 98,
                "model_version": "1.0.0"
            }
        else:
            return {
                "bot_id": bot_id,
                "strategy": bot.strategy,
                "model_trained": False,
                "message": "No ML model required for this strategy"
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting model status for bot {bot_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get model status")

@router.get("/{bot_id}/performance")
async def get_bot_performance(bot_id: str, current_user: dict = Depends(validate_jwt_and_get_user)) -> BotPerformance:
    """Get bot performance metrics"""
    try:
        # Check if bot exists and belongs to user
        bot = bot_storage.get_bot(bot_id)
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")
        if bot.user_id != current_user['id']:
            raise HTTPException(status_code=403, detail="Access denied")

        # Mock performance data - in real implementation, get from trading orchestrator
        return BotPerformance(
            total_trades=45,
            winning_trades=28,
            losing_trades=17,
            win_rate=0.622,
            total_pnl=1250.75,
            max_drawdown=185.50,
            sharpe_ratio=1.85,
            current_balance=101250.75
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting performance for bot {bot_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get performance data")

async def run_bot_loop(bot_id: str):
    """Background task to run bot trading loop"""
    try:
        logger.info(f"Starting trading loop for bot {bot_id}")

        while True:
            # Check if bot is still active
            bot = bot_storage.get_bot(bot_id)
            if not bot or not bot.is_active:
                logger.info(f"Bot {bot_id} is no longer active, stopping loop")
                break

            try:
                # Mock trading logic
                await perform_trading_cycle(bot)
            except Exception as e:
                logger.error(f"Error in trading cycle for bot {bot_id}: {e}")

            # Wait before next cycle (e.g., 5 minutes)
            await asyncio.sleep(300)

    except Exception as e:
        logger.error(f"Critical error in bot loop {bot_id}: {e}")
        # Ensure bot is marked as inactive on error
        try:
            bot_storage.update_bot(bot_id, {'is_active': False})
        except:
            pass

async def perform_trading_cycle(bot: BotConfig):
    """Perform one trading cycle for the bot"""
    try:
        # Mock market data
        market_data = [
            {
                "timestamp": int(datetime.now().timestamp() * 1000),
                "open": 50000,
                "high": 50200,
                "low": 49900,
                "close": 50100,
                "volume": 1.5
            }
        ]

        # Get appropriate ML service based on bot strategy
        prediction = None
        if bot.strategy == 'ml_enhanced':
            ml_engine = get_ml_engine()
            prediction = await ml_engine.predict(market_data)
        elif bot.strategy == 'ensemble':
            ensemble_engine = get_ensemble_engine()
            prediction = await ensemble_engine.predict(market_data)
        elif bot.strategy == 'neural_network':
            neural_engine = get_neural_network_engine()
            prediction = await neural_engine.predict(market_data)
        else:
            # Simple strategy - mock implementation
            prediction = MLPrediction(action='hold', confidence=0.5, reasoning='Simple strategy')

        # Get risk profile
        risk_manager = get_risk_manager()
        risk_profile = await risk_manager.calculate_optimal_risk_profile(
            current_price=50100.0,
            volatility=0.02,
            market_conditions={'regime': 'normal', 'trend': {'strength': 0.6}}
        )

        # Trading decision logic
        confidence_threshold = bot.config.get('ml_config', {}).get('confidence_threshold', 0.6)
        if prediction and prediction.action in ['buy', 'sell'] and prediction.confidence > confidence_threshold:
            logger.info(f"Bot {bot.id} ({bot.strategy}) would execute {prediction.action} trade with confidence {prediction.confidence}")

            # In a real implementation, this would execute the trade via trading orchestrator
            # For now, we'll just log the action
            trade_details = {
                "bot_id": bot.id,
                "symbol": bot.symbol,
                "action": prediction.action,
                "confidence": prediction.confidence,
                "price": market_data[-1]['close'],
                "timestamp": datetime.now().isoformat(),
                "strategy": bot.strategy
            }
            logger.info(f"Trade details: {trade_details}")

        # Record prediction result for accuracy tracking
        if hasattr(prediction, 'action') and bot.strategy in ['ml_enhanced', 'ensemble', 'neural_network']:
            # In real implementation, this would track actual vs predicted performance
            pass

    except Exception as e:
        logger.error(f"Error in trading cycle for bot {bot.id}: {e}")
