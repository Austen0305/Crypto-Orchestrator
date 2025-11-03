from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
import logging

from server_fastapi.services.exchange_service import ExchangeService, default_exchange, TradingPair, MarketData, OrderBook
from .auth import get_current_user

logger = logging.getLogger(__name__)

# Dependency injection for exchange service
def get_exchange_service() -> ExchangeService:
    return default_exchange

router = APIRouter()

# Pydantic models for requests and responses
class MarketSummary(BaseModel):
    total_pairs: int
    total_volume_24h: float
    top_pairs: List[TradingPair]

class TickerResponse(BaseModel):
    symbol: str
    last_price: float
    change_24h: float
    volume_24h: float
    high_24h: float
    low_24h: float

class OHLCVRequest(BaseModel):
    pair: str
    timeframe: Optional[str] = "1h"
    limit: Optional[int] = 100

class PriceChartResponse(BaseModel):
    pair: str
    timeframe: str
    data: List[MarketData]

# Existing endpoints updated with dependency injection and improved models
@router.get("/", response_model=List[TradingPair])
async def get_markets(exchange: ExchangeService = Depends(get_exchange_service)) -> List[TradingPair]:
    """Get all available trading pairs"""
    try:
        pairs = await exchange.get_all_trading_pairs()
        return pairs
    except Exception as e:
        logger.error(f"Error fetching markets: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch markets")

@router.get("/{pair}/ohlcv", response_model=PriceChartResponse)
async def get_ohlcv(
    pair: str,
    timeframe: str = Query("1h", description="Timeframe (1m, 5m, 15m, 30m, 1h, 4h, 1d, etc.)"),
    limit: int = Query(100, description="Number of candles to return", ge=1, le=1000),
    exchange: ExchangeService = Depends(get_exchange_service)
) -> PriceChartResponse:
    """Get OHLCV data for a trading pair"""
    try:
        # Validate pair format
        if '/' not in pair:
            raise HTTPException(status_code=400, detail="Invalid pair format. Use format: BASE/QUOTE")

        # Validate timeframe
        valid_timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d']
        if timeframe not in valid_timeframes:
            raise HTTPException(status_code=400, detail=f"Invalid timeframe. Must be one of: {', '.join(valid_timeframes)}")

        # Get historical data and convert to MarketData objects
        historical_data = await exchange.get_historical_data(pair, timeframe, limit)

        return PriceChartResponse(
            pair=pair,
            timeframe=timeframe,
            data=historical_data
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching OHLCV for {pair}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch OHLCV data for {pair}")

@router.get("/{pair}/orderbook", response_model=OrderBook)
async def get_order_book(
    pair: str,
    exchange: ExchangeService = Depends(get_exchange_service)
) -> OrderBook:
    """Get order book for a trading pair"""
    try:
        if '/' not in pair:
            raise HTTPException(status_code=400, detail="Invalid pair format. Use format: BASE/QUOTE")

        order_book = await exchange.get_order_book(pair)
        return order_book
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching order book for {pair}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch order book for {pair}")

@router.get("/price/{pair}")
async def get_price(
    pair: str,
    exchange: ExchangeService = Depends(get_exchange_service)
) -> dict:
    """Get current price for a trading pair"""
    try:
        if '/' not in pair:
            raise HTTPException(status_code=400, detail="Invalid pair format. Use format: BASE/QUOTE")

        price = await exchange.get_market_price(pair)
        if price is None:
            raise HTTPException(status_code=404, detail=f"Price not found for {pair}")
        return {"pair": pair, "price": price}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching price for {pair}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch price for {pair}")

# New market data endpoints
@router.get("/tickers", response_model=List[TickerResponse])
async def get_tickers(
    limit: int = Query(50, description="Number of tickers to return", ge=1, le=500),
    exchange: ExchangeService = Depends(get_exchange_service)
) -> List[TickerResponse]:
    """Get ticker data for multiple trading pairs"""
    try:
        pairs = await exchange.get_all_trading_pairs()

        # Sort by volume and limit results
        sorted_pairs = sorted(pairs, key=lambda x: x.volume_24h, reverse=True)[:limit]

        tickers = []
        for pair in sorted_pairs:
            tickers.append(TickerResponse(
                symbol=pair.symbol,
                last_price=pair.current_price,
                change_24h=pair.change_24h,
                volume_24h=pair.volume_24h,
                high_24h=pair.high_24h,
                low_24h=pair.low_24h
            ))

        return tickers
    except Exception as e:
        logger.error(f"Error fetching tickers: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch tickers")

@router.get("/summary", response_model=MarketSummary)
async def get_market_summary(
    top_count: int = Query(10, description="Number of top pairs to include", ge=1, le=50),
    exchange: ExchangeService = Depends(get_exchange_service)
) -> MarketSummary:
    """Get market summary with total statistics and top pairs"""
    try:
        pairs = await exchange.get_all_trading_pairs()

        if not pairs:
            return MarketSummary(
                total_pairs=0,
                total_volume_24h=0.0,
                top_pairs=[]
            )

        # Calculate total volume
        total_volume = sum(pair.volume_24h for pair in pairs)

        # Get top pairs by volume
        top_pairs = sorted(pairs, key=lambda x: x.volume_24h, reverse=True)[:top_count]

        return MarketSummary(
            total_pairs=len(pairs),
            total_volume_24h=total_volume,
            top_pairs=top_pairs
        )
    except Exception as e:
        logger.error(f"Error fetching market summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch market summary")

@router.get("/trading-pairs/search")
async def search_trading_pairs(
    query: str = Query(..., description="Search query for pair symbols"),
    limit: int = Query(20, description="Maximum number of results", ge=1, le=100),
    exchange: ExchangeService = Depends(get_exchange_service)
) -> List[TradingPair]:
    """Search for trading pairs by symbol"""
    try:
        if not query or len(query.strip()) < 1:
            raise HTTPException(status_code=400, detail="Search query must be at least 1 character")

        query_lower = query.lower().strip()
        pairs = await exchange.get_all_trading_pairs()

        # Filter pairs that contain the query in their symbol
        matching_pairs = [
            pair for pair in pairs
            if query_lower in pair.symbol.lower() or
               query_lower in pair.base_asset.lower() or
               query_lower in pair.quote_asset.lower()
        ]

        # Sort by volume and limit results
        return sorted(matching_pairs, key=lambda x: x.volume_24h, reverse=True)[:limit]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching trading pairs: {e}")
        raise HTTPException(status_code=500, detail="Failed to search trading pairs")

# Protected endpoints (require authentication)
@router.get("/favorites", response_model=List[TradingPair])
async def get_favorite_pairs(
    current_user: dict = Depends(get_current_user),
    exchange: ExchangeService = Depends(get_exchange_service)
) -> List[TradingPair]:
    """Get user's favorite trading pairs (requires authentication)"""
    try:
        # In a real implementation, this would fetch from user's preferences
        # For now, return popular pairs as favorites
        pairs = await exchange.get_all_trading_pairs()
        favorites = sorted(pairs, key=lambda x: x.volume_24h, reverse=True)[:5]
        return favorites
    except Exception as e:
        logger.error(f"Error fetching favorite pairs for user {current_user['id']}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch favorite pairs")

@router.get("/watchlist", response_model=List[TradingPair])
async def get_watchlist(
    current_user: dict = Depends(get_current_user),
    exchange: ExchangeService = Depends(get_exchange_service)
) -> List[TradingPair]:
    """Get user's watchlist (requires authentication)"""
    try:
        # In a real implementation, this would fetch from user's watchlist
        # For now, return some pairs as watchlist
        pairs = await exchange.get_all_trading_pairs()
        watchlist = pairs[:10]  # First 10 pairs as mock watchlist
        return watchlist
    except Exception as e:
        logger.error(f"Error fetching watchlist for user {current_user['id']}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch watchlist")

# Rate-limited endpoints with enhanced validation and authentication
@router.get("/advanced/{pair}/analysis")
async def get_advanced_market_analysis(
    pair: str,
    indicators: List[str] = Query(["rsi", "macd", "bollinger"], description="Technical indicators to calculate"),
    period: int = Query(14, description="Period for indicators", ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    exchange: ExchangeService = Depends(get_exchange_service)
) -> dict:
    """Get advanced market analysis with technical indicators (requires authentication)"""
    try:
        # Enhanced validation
        if '/' not in pair:
            raise HTTPException(status_code=400, detail="Invalid pair format. Use format: BASE/QUOTE")

        valid_indicators = ["rsi", "macd", "bollinger", "sma", "ema", "stoch"]
        invalid_indicators = [ind for ind in indicators if ind not in valid_indicators]
        if invalid_indicators:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid indicators: {', '.join(invalid_indicators)}. Valid: {', '.join(valid_indicators)}"
            )

        # Get recent market data
        ohlcv_data = await exchange.get_ohlcv(pair, "1h", 100)

        if not ohlcv_data:
            raise HTTPException(status_code=404, detail=f"No market data available for {pair}")

        # Mock technical analysis (in real implementation, use TA-Lib or similar)
        analysis = {
            "pair": pair,
            "indicators": {},
            "last_updated": None,
            "data_points": len(ohlcv_data)
        }

        # Calculate basic indicators
        closes = [candle[4] for candle in ohlcv_data]  # Close prices

        for indicator in indicators:
            if indicator == "rsi":
                # Simple RSI calculation (mock)
                analysis["indicators"]["rsi"] = {
                    "value": 65.5,
                    "period": period,
                    "signal": "neutral"
                }
            elif indicator == "macd":
                analysis["indicators"]["macd"] = {
                    "macd": 45.23,
                    "signal": 38.91,
                    "histogram": 6.32,
                    "signal": "bullish"
                }
            elif indicator == "bollinger":
                analysis["indicators"]["bollinger"] = {
                    "upper": max(closes[-20:]) if closes else 0,
                    "middle": sum(closes[-20:]) / len(closes[-20:]) if closes else 0,
                    "lower": min(closes[-20:]) if closes else 0,
                    "bandwidth": 0.15
                }

        return analysis

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting advanced analysis for {pair}: {e}")
        raise HTTPException(status_code=500, detail="Failed to perform market analysis")

@router.get("/realtime/{pair}/price-stream")
async def get_realtime_price_stream(
    pair: str,
    current_user: dict = Depends(get_current_user),
    exchange: ExchangeService = Depends(get_exchange_service)
) -> dict:
    """Get realtime price stream info (requires authentication)"""
    try:
        if '/' not in pair:
            raise HTTPException(status_code=400, detail="Invalid pair format. Use format: BASE/QUOTE")

        # Get current price and recent data
        price = await exchange.get_market_price(pair)
        if price is None:
            raise HTTPException(status_code=404, detail=f"Price not found for {pair}")

        # Get recent OHLCV for price movement
        ohlcv = await exchange.get_ohlcv(pair, "1m", 60)  # Last hour in 1-minute intervals

        current_time = None
        if ohlcv:
            current_time = max(candle[0] for candle in ohlcv)

        return {
            "pair": pair,
            "current_price": price,
            "last_update": current_time,
            "data_points_last_hour": len(ohlcv) if ohlcv else 0,
            "stream_available": True,  # In real implementation, check WebSocket availability
            "exchange": exchange.name
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting realtime price stream for {pair}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get realtime price stream")
