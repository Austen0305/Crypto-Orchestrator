from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import logging
import numpy as np

try:
    import tensorflow as tf
    from tensorflow.keras import layers, models, optimizers
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False
    logging.warning("TensorFlow not available, using mock neural network implementations")

logger = logging.getLogger(__name__)

class NeuralNetPrediction(BaseModel):
    action: str  # 'buy', 'sell', 'hold'
    confidence: float

class NeuralNetworkEngine:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = {
            'input_size': 50,  # Lookback period for technical indicators
            'hidden_layers': [128, 64, 32],
            'output_size': 3,  # buy, sell, hold
            'learning_rate': 0.001,
            'epochs': 100,
            'batch_size': 32,
        }
        if config:
            self.config.update(config)

        self.model: Optional[tf.keras.Model] = None
        self.is_trained: bool = False
        self.recent_predictions: List[Dict[str, str]] = []
        self.max_recent_predictions: int = 100

    def get_recent_accuracy(self) -> float:
        """Get recent prediction accuracy"""
        if not self.recent_predictions:
            return 0.5  # Default neutral weight

        correct = sum(1 for p in self.recent_predictions if p['predicted'] == p['actual'])
        return correct / len(self.recent_predictions)

    def record_prediction_result(self, predicted: str, actual: str) -> None:
        """Record prediction result for accuracy tracking"""
        self.recent_predictions.append({'predicted': predicted, 'actual': actual})
        if len(self.recent_predictions) > self.max_recent_predictions:
            self.recent_predictions.pop(0)

    def create_model(self) -> Optional[Any]:
        """Create the neural network model"""
        if not TENSORFLOW_AVAILABLE:
            logging.warning('TensorFlow not available, cannot create model')
            return None

        model = models.Sequential()

        # Input layer
        model.add(layers.Dense(
            self.config['hidden_layers'][0],
            input_shape=(self.config['input_size'],),
            activation='relu',
            kernel_initializer='glorot_uniform'
        ))

        # Hidden layers
        for i in range(1, len(self.config['hidden_layers'])):
            model.add(layers.Dense(
                self.config['hidden_layers'][i],
                activation='relu',
                kernel_initializer='glorot_uniform'
            ))
            model.add(layers.Dropout(0.2))

        # Output layer
        model.add(layers.Dense(
            self.config['output_size'],
            activation='softmax',
            kernel_initializer='glorot_uniform'
        ))

        model.compile(
            optimizer=optimizers.Adam(self.config['learning_rate']),
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )

        return model

    def preprocess_data(self, market_data: List[Dict[str, Any]]) -> tuple:
        """Preprocess market data for training"""
        inputs = []
        labels = []

        for i in range(self.config['input_size'], len(market_data) - 1):
            # Create input features from technical indicators
            input_features = self.extract_features(market_data, i)
            inputs.append(input_features)

            # Create labels based on future price movement
            current_price = market_data[i]['close']
            future_price = market_data[i + 1]['close']
            price_change = (future_price - current_price) / current_price

            # Label: 0=buy, 1=sell, 2=hold
            if price_change > 0.002:
                label = [1, 0, 0]  # Buy signal
            elif price_change < -0.002:
                label = [0, 1, 0]  # Sell signal
            else:
                label = [0, 0, 1]  # Hold signal

            labels.append(label)

        return np.array(inputs), np.array(labels)

    def extract_features(self, market_data: List[Dict[str, Any]], index: int) -> List[float]:
        """Extract features from market data"""
        features = []
        lookback = min(self.config['input_size'], index)

        # Price data (normalized)
        for i in range(index - lookback, index):
            data = market_data[i]
            base_price = market_data[index - lookback]['close']
            features.extend([
                (data['open'] - base_price) / base_price,
                (data['high'] - base_price) / base_price,
                (data['low'] - base_price) / base_price,
                (data['close'] - base_price) / base_price,
                data['volume'] / 1000000  # Normalize volume
            ])

        # Fill remaining features with zeros if not enough data
        while len(features) < self.config['input_size']:
            features.append(0.0)

        return features[:self.config['input_size']]

    async def train(self, market_data: List[Dict[str, Any]]) -> None:
        """Train the neural network"""
        if len(market_data) < self.config['input_size'] + 10:
            raise ValueError('Insufficient data for training')

        if not TENSORFLOW_AVAILABLE:
            logger.warning('TensorFlow not available, using mock training')
            import asyncio
            await asyncio.sleep(1)  # Simulate training time
            self.is_trained = True
            logger.info('Mock neural network training completed')
            return

        self.model = self.create_model()
        if not self.model:
            raise ValueError('Failed to create model')

        inputs, labels = self.preprocess_data(market_data)

        self.model.fit(
            inputs,
            labels,
            epochs=self.config['epochs'],
            batch_size=self.config['batch_size'],
            validation_split=0.2,
            verbose=1,
            callbacks=[
                tf.keras.callbacks.EarlyStopping(
                    monitor='val_loss',
                    patience=10,
                    restore_best_weights=True
                )
            ]
        )

        self.is_trained = True
        logger.info('Neural network training completed')

    def predict(self, market_data: List[Dict[str, Any]]) -> NeuralNetPrediction:
        """Generate prediction from market data"""
        if not TENSORFLOW_AVAILABLE or not self.model or not self.is_trained:
            # Fallback to simple logic-based prediction
            if len(market_data) >= 2:
                current = market_data[-1]['close']
                previous = market_data[-2]['close']
                if current > previous * 1.005:
                    return NeuralNetPrediction(action="buy", confidence=0.6)
                elif current < previous * 0.995:
                    return NeuralNetPrediction(action="sell", confidence=0.6)
            return NeuralNetPrediction(action="hold", confidence=0.5)

        features = self.extract_features(market_data, len(market_data) - 1)
        input_tensor = tf.convert_to_tensor([features])

        prediction = self.model.predict(input_tensor, verbose=0)
        probabilities = prediction.numpy()[0]

        actions = ['buy', 'sell', 'hold']
        max_index = np.argmax(probabilities)

        return NeuralNetPrediction(
            action=actions[max_index],
            confidence=float(probabilities[max_index])
        )

    async def save_model(self, bot_id: str) -> None:
        """Save the trained model"""
        if not self.model:
            return

        model_data = {
            'model_json': self.model.to_json(),
            'model_weights': self.model.get_weights(),
            'format': "layers-model",
            'generated_by': "CryptoOrchestrator",
            'converted_by': None,
            'model_artifacts_info': {
                'date_saved': tf.timestamp(),
                'model_topology_type': "Sequential",
            }
        }

        # Note: This would typically save to a storage system
        # For now, we'll save to disk
        import os
        os.makedirs('./models', exist_ok=True)
        model_path = f'./models/{bot_id}_nn'
        self.model.save(model_path)
        logger.info(f'Neural network model saved for bot {bot_id}')

    async def load_model(self, bot_id: str) -> bool:
        """Load a trained model"""
        try:
            model_path = f'./models/{bot_id}_nn'
            self.model = tf.keras.models.load_model(model_path)
            self.is_trained = True
            logger.info(f'Neural network model loaded for bot {bot_id}')
            return True
        except Exception as error:
            logger.warning(f'Error loading neural network model: {error}')
            return False

    def dispose(self) -> None:
        """Dispose of the model"""
        if self.model:
            del self.model
            self.model = None
            tf.keras.backend.clear_session()

# Global instance
neural_network_engine = NeuralNetworkEngine()
