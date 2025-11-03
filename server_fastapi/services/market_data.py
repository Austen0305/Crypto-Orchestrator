import asyncio
import random
from typing import AsyncGenerator, Dict, Any
import logging

logger = logging.getLogger(__name__)

class MarketDataService:
    def __init__(self):
        self.subscribed_symbols = set()
        self.is_streaming = False

    async def stream_market_data(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream real-time market data updates"""
        logger.info("Starting market data stream")

        # Mock market data for demonstration
        symbols = ['BTC/USD', 'ETH/USD', 'ADA/USD', 'SOL/USD', 'DOT/USD']
        self.is_streaming = True

        try:
            while self.is_streaming:
                # Generate mock price updates
                for symbol in symbols:
                    price_change = random.uniform(-0.02, 0.02)  # -2% to +2% change
                    base_price = self._get_base_price(symbol)
                    new_price = base_price * (1 + price_change)

                    update = {
                        'type': 'market_data',
                        'symbol': symbol,
                        'price': round(new_price, 4),
                        'change': round(price_change * 100, 2),  # percentage
                        'volume': random.randint(1000, 10000),
                        'timestamp': asyncio.get_event_loop().time()
                    }

                    yield update

                await asyncio.sleep(1)  # Update every second

        except Exception as e:
            logger.error(f"Error in market data stream: {e}")
            raise
        finally:
            logger.info("Market data stream ended")

    def _get_base_price(self, symbol: str) -> float:
        """Get base price for a symbol (mock implementation)"""
        base_prices = {
            'BTC/USD': 45000,
            'ETH/USD': 2800,
            'ADA/USD': 0.45,
            'SOL/USD': 120,
            'DOT/USD': 8.50
        }
        return base_prices.get(symbol, 100.0)

    def stop_streaming(self):
        """Stop the market data stream"""
        self.is_streaming = False
        logger.info("Market data streaming stopped")