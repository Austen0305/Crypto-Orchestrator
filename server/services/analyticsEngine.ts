import type { Trade, PerformanceMetrics, BotConfig } from "@shared/schema";
import { storage } from "../storage";

export class AnalyticsEngine {
  async calculatePerformanceMetrics(botId: string, period: string = 'all'): Promise<PerformanceMetrics> {
    const trades = await storage.getTrades(botId);
    const bot = await storage.getBotById(botId);

    if (!bot || trades.length === 0) {
      return {
        botId,
        period,
        totalReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 0,
        totalTrades: 0,
      };
    }

    // Filter trades by period
    const filteredTrades = this.filterTradesByPeriod(trades, period);

    if (filteredTrades.length === 0) {
      return {
        botId,
        period,
        totalReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 0,
        totalTrades: 0,
      };
    }

    // Calculate metrics
    const totalReturn = this.calculateTotalReturn(filteredTrades);
    const sharpeRatio = this.calculateSharpeRatio(filteredTrades);
    const maxDrawdown = this.calculateMaxDrawdown(filteredTrades);
    const winRate = this.calculateWinRate(filteredTrades);
    const averageWin = this.calculateAverageWin(filteredTrades);
    const averageLoss = this.calculateAverageLoss(filteredTrades);
    const profitFactor = this.calculateProfitFactor(filteredTrades);

    const metrics: PerformanceMetrics = {
      botId,
      period,
      totalReturn,
      sharpeRatio,
      maxDrawdown,
      winRate,
      averageWin,
      averageLoss,
      profitFactor,
      totalTrades: filteredTrades.length,
    };

    // Save to storage
    await storage.savePerformanceMetrics(metrics);

    return metrics;
  }

  private filterTradesByPeriod(trades: Trade[], period: string): Trade[] {
    const now = Date.now();
    let startTime: number;

    switch (period) {
      case '1d':
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case '90d':
        startTime = now - 90 * 24 * 60 * 60 * 1000;
        break;
      case '1y':
        startTime = now - 365 * 24 * 60 * 60 * 1000;
        break;
      default:
        return trades; // 'all' period
    }

    return trades.filter(trade => trade.timestamp >= startTime);
  }

  private calculateTotalReturn(trades: Trade[]): number {
    const initialInvestment = 100000; // Assume starting balance
    let currentBalance = initialInvestment;

    trades.forEach(trade => {
      if (trade.side === 'buy') {
        currentBalance -= trade.totalWithFee;
      } else {
        currentBalance += trade.total - trade.fee;
      }
    });

    return (currentBalance - initialInvestment) / initialInvestment;
  }

  private calculateSharpeRatio(trades: Trade[]): number {
    if (trades.length < 2) return 0;

    // Group trades by day
    const dailyReturns = this.calculateDailyReturns(trades);

    if (dailyReturns.length === 0) return 0;

    const avgReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / dailyReturns.length;
    const stdDev = Math.sqrt(variance);

    // Assume risk-free rate of 0.02 (2%)
    const riskFreeRate = 0.02 / 365; // Daily risk-free rate

    if (stdDev === 0) return 0;

    return (avgReturn - riskFreeRate) / stdDev * Math.sqrt(365); // Annualized
  }

  private calculateMaxDrawdown(trades: Trade[]): number {
    if (trades.length === 0) return 0;

    const equityCurve = this.calculateEquityCurve(trades);
    let peak = equityCurve[0];
    let maxDrawdown = 0;

    for (const equity of equityCurve) {
      if (equity > peak) {
        peak = equity;
      }

      const drawdown = (peak - equity) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    return maxDrawdown;
  }

  private calculateWinRate(trades: Trade[]): number {
    if (trades.length === 0) return 0;

    const winningTrades = trades.filter(trade => {
      // Consider a trade winning if it resulted in profit
      return trade.side === 'sell' && trade.total > 0;
    });

    return winningTrades.length / trades.length;
  }

  private calculateAverageWin(trades: Trade[]): number {
    const winningTrades = trades.filter(trade =>
      trade.side === 'sell' && trade.total > 0
    );

    if (winningTrades.length === 0) return 0;

    const totalWins = winningTrades.reduce((sum, trade) => sum + trade.total, 0);
    return totalWins / winningTrades.length;
  }

  private calculateAverageLoss(trades: Trade[]): number {
    const losingTrades = trades.filter(trade =>
      trade.side === 'sell' && trade.total < 0
    );

    if (losingTrades.length === 0) return 0;

    const totalLosses = losingTrades.reduce((sum, trade) => sum + Math.abs(trade.total), 0);
    return totalLosses / losingTrades.length;
  }

  private calculateProfitFactor(trades: Trade[]): number {
    const grossProfit = trades
      .filter(trade => trade.side === 'sell' && trade.total > 0)
      .reduce((sum, trade) => sum + trade.total, 0);

    const grossLoss = Math.abs(trades
      .filter(trade => trade.side === 'sell' && trade.total < 0)
      .reduce((sum, trade) => sum + trade.total, 0));

    return grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  }

  private calculateDailyReturns(trades: Trade[]): number[] {
    const dailyPnL = new Map<number, number>();

    trades.forEach(trade => {
      const day = Math.floor(trade.timestamp / (24 * 60 * 60 * 1000));
      const pnl = trade.side === 'buy' ? -trade.totalWithFee : trade.total - trade.fee;

      dailyPnL.set(day, (dailyPnL.get(day) || 0) + pnl);
    });

    const dailyReturns: number[] = [];
    const initialBalance = 100000;

    Array.from(dailyPnL.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([day, pnl]) => {
        const dailyReturn = pnl / initialBalance;
        dailyReturns.push(dailyReturn);
      });

    return dailyReturns;
  }

  private calculateEquityCurve(trades: Trade[]): number[] {
    const initialBalance = 100000;
    let balance = initialBalance;
    const equity: number[] = [balance];

    // Sort trades by timestamp
    const sortedTrades = trades.sort((a, b) => a.timestamp - b.timestamp);

    sortedTrades.forEach(trade => {
      if (trade.side === 'buy') {
        balance -= trade.totalWithFee;
      } else {
        balance += trade.total - trade.fee;
      }
      equity.push(balance);
    });

    return equity;
  }

  async getPerformanceComparison(botIds: string[], period: string = '30d'): Promise<Record<string, PerformanceMetrics>> {
    const comparisons: Record<string, PerformanceMetrics> = {};

    for (const botId of botIds) {
      comparisons[botId] = await this.calculatePerformanceMetrics(botId, period);
    }

    return comparisons;
  }

  async generatePerformanceReport(botId: string, period: string = '30d'): Promise<string> {
    const metrics = await this.calculatePerformanceMetrics(botId, period);
    const bot = await storage.getBotById(botId);

    if (!bot) {
      return 'Bot not found';
    }

    return `
Performance Report for ${bot.name} (${period})

Total Return: ${(metrics.totalReturn * 100).toFixed(2)}%
Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}
Max Drawdown: ${(metrics.maxDrawdown * 100).toFixed(2)}%
Win Rate: ${(metrics.winRate * 100).toFixed(2)}%
Average Win: $${metrics.averageWin.toFixed(2)}
Average Loss: $${metrics.averageLoss.toFixed(2)}
Profit Factor: ${metrics.profitFactor.toFixed(2)}
Total Trades: ${metrics.totalTrades}
    `.trim();
  }
}

export const analyticsEngine = new AnalyticsEngine();
