# CryptoML Trading Platform

## Overview
A machine learning-powered cryptocurrency trading platform that integrates with Kraken exchange. The system uses reinforcement learning (Q-learning) to train trading bots in paper trading mode before allowing real trading.

## Project Goals
- Build ML-powered trading bots that learn from paper trading outcomes (profit = reward, loss = penalty)
- Support ALL Kraken cryptocurrency pairs (not just USD pairs)
- Accurately calculate and include all Kraken trading fees
- Train bots safely with paper trading before risking real money
- Persist ML models across sessions for continuous learning

## Architecture

### Backend Services
- **Kraken API Service** (`server/services/krakenService.ts`): Integration with Kraken exchange
  - Fetches all trading pairs (BTC/EUR, ETH/BTC, etc.)
  - Gets real-time market data (OHLCV, order books)
  - Calculates maker/taker fees with volume-based discounts
  - Supports order placement (paper and live modes)

- **ML Engine** (`server/services/mlEngine.ts`): Q-learning reinforcement learning
  - Derives market state from price movements, RSI, volume, and portfolio position
  - Decides actions: BUY, SELL, or HOLD using epsilon-greedy strategy
  - Calculates rewards: profit trades get positive rewards, losses get negative rewards
  - Updates Q-table for continuous learning
  - Persists model state to storage

- **Paper Trading Service** (`server/services/paperTradingService.ts`): Simulated trading
  - Maintains separate paper portfolio with $100,000 initial balance
  - Executes trades without real money risk
  - Applies realistic Kraken fees to simulate real trading
  - Updates portfolio values based on live market prices

- **Bot Runner** (`server/services/botRunner.ts`): Automated bot execution
  - Runs ML training cycles every 60 seconds
  - Fetches market data and derives state
  - Uses ML engine to decide and execute trades
  - Tracks performance metrics (win rate, total profit, Sharpe ratio)

- **Storage Layer** (`server/storage.ts`): In-memory data persistence
  - Trading pairs, market data (OHLCV history)
  - Portfolio holdings (paper and live modes)
  - Trade history
  - Bot configurations and status
  - ML model states (Q-tables, training episodes, rewards)
  - Performance metrics

### Frontend
- Trading dashboard with market overview
- Portfolio tracking (paper and live modes)
- Bot management (create, configure, start/stop)
- Order entry with fee calculations
- Performance analytics and charts
- Dark/light mode support

### API Endpoints
- `GET /api/markets` - All Kraken trading pairs
- `GET /api/markets/:pair/ohlcv` - Historical price data
- `GET /api/markets/:pair/orderbook` - Order book depth
- `GET /api/portfolio/:mode` - Portfolio holdings (paper/live)
- `POST /api/trades` - Execute trade (with fee calculations)
- `GET /api/bots` - All bot configurations
- `POST /api/bots` - Create new bot
- `POST /api/bots/:id/start` - Start bot trading
- `POST /api/bots/:id/stop` - Stop bot trading
- `GET /api/bots/:id/model` - ML model state
- `GET /api/bots/:id/performance` - Performance metrics
- `GET /api/fees` - Kraken fee structure
- `POST /api/fees/calculate` - Calculate total cost with fees

### WebSocket
- Real-time market data updates (every 30 seconds)
- Portfolio value updates
- Trade execution notifications
- Bot status changes

## Data Flow

### Market Data Ingestion
1. Every 60 seconds, fetch latest prices for top 20 trading pairs
2. Save OHLCV data to storage via `storage.saveMarketData()`
3. Update trading pair list via `storage.updateTradingPairs()`
4. Update paper portfolio values via `paperTradingService.updatePortfolioPrices()`
5. Broadcast updates to all WebSocket clients

### ML Training Loop (when bot is running)
1. Bot runner executes every 60 seconds
2. Fetch last 20 market data points from storage
3. Derive market state (price movement, RSI, volume, position)
4. ML engine decides action using Q-learning (epsilon-greedy)
5. Execute trade via paper trading service
6. Calculate reward based on profit/loss
7. Update Q-table with new experience
8. Save updated model state to storage
9. Update performance metrics

## Key Features

### Reinforcement Learning
- **Algorithm**: Q-learning with epsilon-greedy exploration
- **State Space**: 4-dimensional (price movement, RSI, volume change, position)
- **Action Space**: BUY, SELL, HOLD
- **Reward Function**: 
  - Profitable trade = positive reward (scaled by profit %)
  - Losing trade = negative reward (scaled by loss %)
  - Holding = small negative reward (opportunity cost)
- **Exploration**: Epsilon starts at 0.2, decays to 0.01 over 1000 episodes
- **Learning Rate**: 0.1 (10% weight to new experiences)
- **Discount Factor**: 0.95 (prioritize near-term rewards)

### Fee Calculations
Kraken uses volume-based fee tiers:
- Under $50k: 0.26% maker / 0.40% taker
- $50k-$100k: 0.24% maker / 0.40% taker
- $100k-$250k: 0.22% maker / 0.35% taker
- (and higher tiers...)

All trades include fees in total cost calculations.

### Paper Trading
- Separate portfolio with $100,000 initial balance
- Realistic fee calculations
- No real money at risk
- Bots must achieve profitable paper trading before live trading

## Recent Changes
- **2025-10-30**: Complete backend implementation with ML engine, paper trading, and Kraken integration
- **2025-10-30**: Fixed market data ingestion to save OHLCV history for ML training
- **2025-10-30**: Removed USD-only filter to support all Kraken pairs
- **2025-10-30**: Added WebSocket for real-time updates

## Technical Notes
- Market data ingestion currently limited to top 20 pairs (runs every 60 seconds)
- Bots on less-liquid pairs may need longer to accumulate training data
- ML models persist to storage and reload on bot restart for continuous learning
- Paper trading mode is required before live trading

## User Preferences
- None specified yet

## Next Steps
- Connect frontend to backend APIs
- Display real market data in UI
- Show ML training progress (episodes, rewards, win rate)
- Add bot performance charts
- Implement live trading mode (after paper trading success)
