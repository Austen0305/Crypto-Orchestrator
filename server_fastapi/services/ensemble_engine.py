from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import logging
import asyncio

logger = logging.getLogger(__name__)

class EnsemblePrediction(BaseModel):
    action: str  # 'buy', 'sell', 'hold'
    confidence: float
    votes: Dict[str, Dict[str, float]]  # votes for qLearning and neuralNetwork

class EnsembleEngine:
    def __init__(self):
        self.q_learning_engine = None  # Will be injected
        self.neural_network_engine = None  # Will be injected
        self.q_table: Dict[str, Dict[str, float]] = {}

    async def initialize(self, bot_id: str) -> None:
        """Initialize the ensemble with loaded models"""
        if self.neural_network_engine:
            success = await self.neural_network_engine.load_model(bot_id)
            if success:
                logger.info(f'Neural network model loaded for bot {bot_id}')
            else:
                logger.warning(f'Failed to load neural network model for bot {bot_id}')

    def set_q_table(self, q_table: Dict[str, Dict[str, float]]) -> None:
        """Set the Q-table for Q-learning component"""
        self.q_table.update(q_table)

    async def train(self, market_data: List[Dict[str, Any]]) -> None:
        """Train the neural network component"""
        try:
            if self.neural_network_engine:
                await self.neural_network_engine.train(market_data)
                logger.info('Neural network training completed')
            else:
                logger.warning('Neural network engine not available for training')
        except Exception as error:
            logger.error(f'Neural network training failed: {error}')
            raise error

    def calculate_q_learning_confidence_from_state_key(self, state_key: str) -> float:
        """Calculate confidence from Q-values"""
        q_values = self.q_table.get(state_key, {"buy": 0, "sell": 0, "hold": 0})
        vals = list(q_values.values())
        if not vals:
            return 0.0
        max_q = max(vals)
        min_q = min(vals)
        return (max_q - min_q) / (abs(max_q) + 1) if (max_q - min_q) != 0 else 0.0

    async def predict(self, market_data: List[Dict[str, Any]]) -> EnsemblePrediction:
        """Generate ensemble prediction from both models"""
        if not self.q_learning_engine or not self.neural_network_engine:
            logger.warning('Engines not initialized, using default prediction')
            return EnsemblePrediction(
                action="hold",
                confidence=0.5,
                votes={
                    "qLearning": {"action": "hold", "confidence": 0.5},
                    "neuralNetwork": {"action": "hold", "confidence": 0.5}
                }
            )

        # Get predictions from both engines
        q_learning_prediction, nn_prediction = await asyncio.gather(
            self.q_learning_engine.predict(market_data),
            self.neural_network_engine.predict(market_data)
        )

        # Derive q-learning confidence from qTable using current state
        state = self.q_learning_engine.derive_state(market_data, max(0, len(market_data) - 1))
        state_key = self.q_learning_engine.get_state_key(state)
        q_learning_confidence = self.calculate_q_learning_confidence_from_state_key(state_key)

        # Get recent accuracies for weighting
        q_learning_weight = self.q_learning_engine.get_recent_accuracy() if hasattr(self.q_learning_engine, 'get_recent_accuracy') else 0.5
        nn_weight = self.neural_network_engine.get_recent_accuracy()
        total_weight = q_learning_weight + nn_weight or 1

        # Weighted voting
        votes: Dict[str, float] = {"buy": 0, "sell": 0, "hold": 0}

        votes[q_learning_prediction.action] += (q_learning_weight / total_weight) * q_learning_confidence
        votes[nn_prediction.action] += (nn_weight / total_weight) * nn_prediction.confidence

        # Determine final action
        max_action = max(votes, key=votes.get)
        max_score = votes[max_action]

        return EnsemblePrediction(
            action=max_action,
            confidence=max_score,
            votes={
                "qLearning": {"action": q_learning_prediction.action, "confidence": q_learning_confidence},
                "neuralNetwork": {"action": nn_prediction.action, "confidence": nn_prediction.confidence}
            }
        )

    def update_q_value(self, state: Any, action: str, reward: float, next_state: Any) -> None:
        """Update Q-value in the Q-learning component"""
        if self.q_learning_engine:
            self.q_learning_engine.update_q_value(self.q_table, state, action, reward, next_state)

    def calculate_reward(self, action: str, entry_price: float, exit_price: float, position: Optional[str]) -> float:
        """Calculate reward for Q-learning"""
        if self.q_learning_engine:
            return self.q_learning_engine.calculate_reward(action, entry_price, exit_price, position)
        return 0.0

    def derive_state(self, market_data: List[Dict[str, Any]], current_index: int) -> Any:
        """Derive state for Q-learning"""
        if self.q_learning_engine:
            return self.q_learning_engine.derive_state(market_data, current_index)
        return {}

    async def save_model(self, bot_id: str) -> None:
        """Save the neural network model"""
        if self.neural_network_engine:
            await self.neural_network_engine.save_model(bot_id)

    def dispose(self) -> None:
        """Dispose of resources"""
        if self.neural_network_engine and hasattr(self.neural_network_engine, 'dispose'):
            self.neural_network_engine.dispose()

# Global instance
ensemble_engine = EnsembleEngine()
