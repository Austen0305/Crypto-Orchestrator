"""
Binance Testnet Service for Safe Testing
Provides complete testnet integration for validating trading strategies without risk
"""

import ccxt
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import os

logger = logging.getLogger(__name__)


class BinanceTestnetService:
    """
    Binance Testnet integration for safe testing of trading strategies
    
    Features:
    - Testnet order execution
    - Balance management
    - Order history tracking
    - Real-time market data (from production)
    - Paper trading validation
    """
    
    def __init__(self):
        """Initialize Binance Testnet connection"""
        self.testnet_enabled = os.getenv('BINANCE_TESTNET_ENABLED', 'true').lower() == 'true'
        self.api_key = os.getenv('BINANCE_TESTNET_API_KEY', '')
        self.secret_key = os.getenv('BINANCE_TESTNET_SECRET_KEY', '')
        
        if self.testnet_enabled and self.api_key and self.secret_key:
            try:
                self.exchange = ccxt.binance({
                    'apiKey': self.api_key,
                    'secret': self.secret_key,
                    'options': {
                        'defaultType': 'spot',
                        'test': True  # Enable testnet mode
                    }
                })
                logger.info("Binance Testnet Service initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Binance Testnet: {e}")
                self.exchange = None
        else:
            self.exchange = None
            logger.warning("Binance Testnet not configured. Set BINANCE_TESTNET_API_KEY and BINANCE_TESTNET_SECRET_KEY")
    
    async def create_market_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        user_id: str = None,
        bot_id: str = None
    ) -> Dict[str, Any]:
        """
        Create a market order on testnet
        
        Args:
            symbol: Trading pair (e.g., 'BTC/USDT')
            side: 'buy' or 'sell'
            quantity: Amount to trade
            user_id: User identifier
            bot_id: Bot identifier
        
        Returns:
            Order result with execution details
        """
        if not self.exchange:
            return {
                'success': False,
                'error': 'Testnet not configured',
                'message': 'Please configure BINANCE_TESTNET_API_KEY and BINANCE_TESTNET_SECRET_KEY'
            }
        
        try:
            order = self.exchange.create_market_order(
                symbol=symbol,
                side=side,
                amount=quantity
            )
            
            logger.info(f"Testnet market order created: {symbol} {side} {quantity} - Order ID: {order['id']}")
            
            return {
                'success': True,
                'order_id': order['id'],
                'symbol': symbol,
                'side': side,
                'quantity': quantity,
                'price': order.get('average', order.get('price')),
                'status': order['status'],
                'timestamp': order['timestamp'],
                'info': order.get('info', {})
            }
            
        except Exception as e:
            logger.error(f"Testnet order failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'symbol': symbol,
                'side': side,
                'quantity': quantity
            }
    
    async def create_limit_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        price: float,
        user_id: str = None,
        bot_id: str = None
    ) -> Dict[str, Any]:
        """Create a limit order on testnet"""
        if not self.exchange:
            return {'success': False, 'error': 'Testnet not configured'}
        
        try:
            order = self.exchange.create_limit_order(
                symbol=symbol,
                side=side,
                amount=quantity,
                price=price
            )
            
            logger.info(f"Testnet limit order created: {symbol} {side} {quantity} @ {price}")
            
            return {
                'success': True,
                'order_id': order['id'],
                'symbol': symbol,
                'side': side,
                'quantity': quantity,
                'price': price,
                'status': order['status'],
                'timestamp': order['timestamp']
            }
            
        except Exception as e:
            logger.error(f"Testnet limit order failed: {e}")
            return {'success': False, 'error': str(e)}
    
    async def cancel_order(self, order_id: str, symbol: str) -> Dict[str, Any]:
        """Cancel an order on testnet"""
        if not self.exchange:
            return {'success': False, 'error': 'Testnet not configured'}
        
        try:
            result = self.exchange.cancel_order(order_id, symbol)
            logger.info(f"Testnet order cancelled: {order_id}")
            return {'success': True, 'order_id': order_id, 'result': result}
        except Exception as e:
            logger.error(f"Testnet cancel order failed: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_balance(self) -> Dict[str, Any]:
        """Get testnet account balance"""
        if not self.exchange:
            return {'success': False, 'error': 'Testnet not configured'}
        
        try:
            balance = self.exchange.fetch_balance()
            
            # Format balance data
            formatted_balance = {}
            for currency, amounts in balance['total'].items():
                if amounts > 0:
                    formatted_balance[currency] = {
                        'total': amounts,
                        'free': balance['free'].get(currency, 0),
                        'used': balance['used'].get(currency, 0)
                    }
            
            return {
                'success': True,
                'balances': formatted_balance,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Testnet balance fetch failed: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_order_history(
        self,
        symbol: str = None,
        limit: int = 100
    ) -> Dict[str, Any]:
        """Get order history from testnet"""
        if not self.exchange:
            return {'success': False, 'error': 'Testnet not configured'}
        
        try:
            if symbol:
                orders = self.exchange.fetch_orders(symbol, limit=limit)
            else:
                orders = self.exchange.fetch_orders(limit=limit)
            
            return {
                'success': True,
                'orders': orders,
                'count': len(orders)
            }
            
        except Exception as e:
            logger.error(f"Testnet order history fetch failed: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_open_orders(self, symbol: str = None) -> Dict[str, Any]:
        """Get open orders from testnet"""
        if not self.exchange:
            return {'success': False, 'error': 'Testnet not configured'}
        
        try:
            if symbol:
                orders = self.exchange.fetch_open_orders(symbol)
            else:
                orders = self.exchange.fetch_open_orders()
            
            return {
                'success': True,
                'orders': orders,
                'count': len(orders)
            }
            
        except Exception as e:
            logger.error(f"Testnet open orders fetch failed: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_ticker(self, symbol: str) -> Dict[str, Any]:
        """Get current ticker price from testnet (uses production data)"""
        if not self.exchange:
            return {'success': False, 'error': 'Testnet not configured'}
        
        try:
            ticker = self.exchange.fetch_ticker(symbol)
            return {
                'success': True,
                'symbol': symbol,
                'price': ticker['last'],
                'bid': ticker['bid'],
                'ask': ticker['ask'],
                'high': ticker['high'],
                'low': ticker['low'],
                'volume': ticker['quoteVolume'],
                'timestamp': ticker['timestamp']
            }
        except Exception as e:
            logger.error(f"Testnet ticker fetch failed: {e}")
            return {'success': False, 'error': str(e)}
    
    async def validate_connection(self) -> Dict[str, Any]:
        """Validate testnet connection"""
        if not self.exchange:
            return {
                'success': False,
                'connected': False,
                'message': 'Testnet not configured'
            }
        
        try:
            # Test connection by fetching server time
            server_time = self.exchange.fetch_time()
            balance = await self.get_balance()
            
            return {
                'success': True,
                'connected': True,
                'server_time': server_time,
                'balance_check': balance['success'],
                'message': 'Testnet connection validated successfully'
            }
        except Exception as e:
            logger.error(f"Testnet validation failed: {e}")
            return {
                'success': False,
                'connected': False,
                'error': str(e)
            }


# Singleton instance
_binance_testnet_service = None


def get_binance_testnet_service() -> BinanceTestnetService:
    """Get singleton instance of Binance Testnet Service"""
    global _binance_testnet_service
    if _binance_testnet_service is None:
        _binance_testnet_service = BinanceTestnetService()
    return _binance_testnet_service
