import type { MarketData, Trade, BacktestConfig, BacktestResult, BotConfig } from "@shared/schema";
import { storage } from "../storage";
import { EnsembleEngine } from "./ensembleEngine";

interface BacktestPosition {
  entryPrice: number;
  amount: number;
  side: 'long' | 'short';
  entryTime: number;
}

export class BacktestingEngine {
  private ensembleEngine: EnsembleEngine;

  constructor() {
    this.ensembleEngine = new EnsembleEngine();
  }

  async runBacktest(config: BacktestConfig, historicalData: MarketData[]): Promise<BacktestResult> {
    if (historicalData.length < 100) {
      throw new Error('Insufficient historical data for backtesting');
    }

    // Initialize ensemble engine with bot's model
    await this.ensembleEngine.initialize(config.botId);

    // Get bot config
    const botConfig = await storage.getBotById(config.botId);
    if (!botConfig) {
      throw new Error('Bot configuration not found');
    }

    // Run backtest
    const result = await this.simulateTrading(historicalData, config, botConfig);

    // Save backtest result
    const backtestResult: Omit<BacktestResult, 'id' | 'createdAt'> = {
      botId: config.botId,
      ...result,
    };

    const savedResult = await storage.saveBacktestResult(backtestResult);

    return savedResult;
  }

  private async simulateTrading(
    marketData: MarketData[],
    config: BacktestConfig,
    botConfig: BotConfig
  ): Promise<Omit<BacktestResult, 'id' | 'botId' | 'createdAt'>> {
    let balance = config.initialBalance;
    let availableBalance = balance;
    const positions: BacktestPosition[] = [];
    const trades: Trade[] = [];
    const equityCurve: { timestamp: number; balance: number }[] = [];

    // Sort market data by timestamp
    marketData.sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 50; i < marketData.length; i++) { // Start after enough data for indicators
      const currentData = marketData[i];
      const currentPrice = currentData.close;

  // Get trading decision from ensemble engine
  const decision = await this.ensembleEngine.predict(marketData.slice(0, i + 1));

      // Execute trades based on decision and risk management
      await this.executeTrade(
        decision.action,
        currentData,
        botConfig,
        balance,
        availableBalance,
        positions,
        trades,
        config.commission
      );

      // Update balances
      const totalPositionValue = positions.reduce((sum, pos) => {
        const currentValue = pos.side === 'long'
          ? pos.amount * currentPrice
          : pos.amount * (2 * pos.entryPrice - currentPrice); // Short position value
        return sum + currentValue;
      }, 0);

      const currentBalance = availableBalance + totalPositionValue;
      balance = currentBalance;

      equityCurve.push({
        timestamp: currentData.timestamp,
        balance: currentBalance,
      });

      // Update ensemble engine with reward (simplified)
      if (i > 0) {
        const prevData = marketData[i - 1];
        const reward = this.ensembleEngine.calculateReward(
          decision.action,
          prevData.close,
          currentPrice,
          positions.length > 0 ? positions[0].side : null
        );
        // Note: In a full implementation, you'd update Q-values here
      }
    }

    // Calculate performance metrics
    const metrics = this.calculatePerformanceMetrics(trades, equityCurve, config.initialBalance);

    return {
      totalReturn: metrics.totalReturn,
      sharpeRatio: metrics.sharpeRatio,
      maxDrawdown: metrics.maxDrawdown,
      winRate: metrics.winRate,
      totalTrades: trades.length,
      profitFactor: metrics.profitFactor,
      trades,
      equityCurve,
    };
  }

  private async executeTrade(
    action: 'buy' | 'sell' | 'hold',
    marketData: MarketData,
    botConfig: BotConfig,
    balance: number,
    availableBalance: number,
    positions: BacktestPosition[],
    trades: Trade[],
    commission: number
  ): Promise<void> {
    const currentPrice = marketData.close;
    const timestamp = marketData.timestamp;

    if (action === 'buy' && positions.length === 0) {
      // Enter long position
      const positionSize = Math.min(
        botConfig.maxPositionSize,
        availableBalance * botConfig.riskPerTrade
      );

      if (positionSize > 10) { // Minimum trade size
        const amount = positionSize / currentPrice;
        const fee = positionSize * commission;

        positions.push({
          entryPrice: currentPrice,
          amount,
          side: 'long',
          entryTime: timestamp,
        });

        availableBalance -= (positionSize + fee);

        trades.push({
          id: `trade_${trades.length + 1}`,
          botId: botConfig.id,
          pair: botConfig.tradingPair,
          side: 'buy',
          type: 'market',
          amount,
          price: currentPrice,
          fee,
          total: positionSize,
          totalWithFee: positionSize + fee,
          status: 'completed',
          mode: 'paper',
          timestamp,
        });
      }
    } else if (action === 'sell' && positions.length > 0) {
      // Exit position
      const position = positions[0];
      positions.splice(0, 1);

      let exitValue: number;
      let profitLoss: number;

      if (position.side === 'long') {
        exitValue = position.amount * currentPrice;
        profitLoss = exitValue - (position.amount * position.entryPrice);
      } else {
        exitValue = position.amount * (2 * position.entryPrice - currentPrice);
        profitLoss = (position.amount * position.entryPrice) - exitValue;
      }

      const fee = exitValue * commission;
      availableBalance += (exitValue - fee);

      trades.push({
        id: `trade_${trades.length + 1}`,
        botId: botConfig.id,
        pair: botConfig.tradingPair,
        side: 'sell',
        type: 'market',
        amount: position.amount,
        price: currentPrice,
        fee,
        total: exitValue,
        totalWithFee: exitValue - fee,
        status: 'completed',
        mode: 'paper',
        timestamp,
      });
    }
  }

  private calculatePerformanceMetrics(
    trades: Trade[],
    equityCurve: { timestamp: number; balance: number }[],
    initialBalance: number
  ) {
    if (trades.length === 0) {
      return {
        totalReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        profitFactor: 0,
      };
    }

    // Calculate returns
    const finalBalance = equityCurve[equityCurve.length - 1].balance;
    const totalReturn = (finalBalance - initialBalance) / initialBalance;

    // Calculate daily returns for Sharpe ratio
    const dailyReturns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const dailyReturn = (equityCurve[i].balance - equityCurve[i - 1].balance) / equityCurve[i - 1].balance;
      dailyReturns.push(dailyReturn);
    }

    const avgReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / dailyReturns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev * Math.sqrt(365) : 0; // Annualized

    // Calculate max drawdown
    let peak = initialBalance;
    let maxDrawdown = 0;

    for (const point of equityCurve) {
      if (point.balance > peak) {
        peak = point.balance;
      }
      const drawdown = (peak - point.balance) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    // Calculate win rate and profit factor
    const winningTrades = trades.filter(t => t.total > 0);
    const losingTrades = trades.filter(t => t.total < 0);
    const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;

    const totalProfit = winningTrades.reduce((sum, t) => sum + t.total, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.total, 0));
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

    return {
      totalReturn,
      sharpeRatio,
      maxDrawdown,
      winRate,
      profitFactor,
    };
  }

  dispose(): void {
    this.ensembleEngine.dispose();
  }
}

export const backtestingEngine = new BacktestingEngine();
