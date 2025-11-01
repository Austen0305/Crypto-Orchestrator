import { EventEmitter } from 'events';
import logger from './logger';
import { safetyMonitor } from './safetyMonitor';
import { circuitBreaker } from './circuitBreaker';

interface PerformanceMetrics {
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  successfulTrades: number;
  failedTrades: number;
  totalTrades: number;
  consecutiveLosses: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

interface TradeMetrics {
  profit: number;
  duration: number;
  entryPrice: number;
  exitPrice: number;
  timestamp: number;
}

export class PerformanceMonitor extends EventEmitter {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics;
  private recentTrades: TradeMetrics[] = [];
  private readonly MAX_TRADES_HISTORY = 1000;
  private readonly METRICS_UPDATE_INTERVAL = 60000; // 1 minute
  private readonly ALERT_THRESHOLDS = {
    minWinRate: 0.4,            // 40% minimum win rate
    minProfitFactor: 1.2,       // 1.2 minimum profit factor
    maxConsecutiveLosses: 5,    // Maximum consecutive losses
    maxDrawdown: 0.15,          // 15% maximum drawdown
    minSharpeRatio: 0.5         // Minimum Sharpe ratio
  };

  private constructor() {
    super();
    this.metrics = this.initializeMetrics();
    setInterval(() => this.updateMetrics(), this.METRICS_UPDATE_INTERVAL);
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      winRate: 0,
      profitFactor: 0,
      averageWin: 0,
      averageLoss: 0,
      successfulTrades: 0,
      failedTrades: 0,
      totalTrades: 0,
      consecutiveLosses: 0,
      maxDrawdown: 0,
      sharpeRatio: 0
    };
  }

  public recordTrade(trade: TradeMetrics): void {
    this.recentTrades.push(trade);
    if (this.recentTrades.length > this.MAX_TRADES_HISTORY) {
      this.recentTrades.shift();
    }

    // Update consecutive losses
    if (trade.profit < 0) {
      this.metrics.consecutiveLosses++;
      if (this.metrics.consecutiveLosses >= this.ALERT_THRESHOLDS.maxConsecutiveLosses) {
        this.emit('consecutiveLossesAlert', this.metrics.consecutiveLosses);
        logger.warn(`Consecutive losses alert: ${this.metrics.consecutiveLosses} losses in a row`);
      }
    } else {
      this.metrics.consecutiveLosses = 0;
    }

    this.updateMetrics();
  }

  private updateMetrics(): void {
    if (this.recentTrades.length === 0) return;

    const winningTrades = this.recentTrades.filter(t => t.profit > 0);
    const losingTrades = this.recentTrades.filter(t => t.profit < 0);

    this.metrics.successfulTrades = winningTrades.length;
    this.metrics.failedTrades = losingTrades.length;
    this.metrics.totalTrades = this.recentTrades.length;
    this.metrics.winRate = winningTrades.length / this.recentTrades.length;

    // Calculate average win/loss
    this.metrics.averageWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.profit, 0) / winningTrades.length
      : 0;

    this.metrics.averageLoss = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0) / losingTrades.length)
      : 0;

    // Calculate profit factor
    const totalProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));
    this.metrics.profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

    // Calculate Sharpe ratio
    const returns = this.recentTrades.map(t => t.profit);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    this.metrics.sharpeRatio = stdDev > 0 ? avgReturn / stdDev * Math.sqrt(252) : 0; // Annualized

    // Check performance alerts
    this.checkPerformanceAlerts();

    logger.info('Performance metrics updated', { metrics: this.metrics });
    this.emit('metricsUpdated', this.metrics);
  }

  private checkPerformanceAlerts(): void {
    if (this.metrics.winRate < this.ALERT_THRESHOLDS.minWinRate) {
      this.emit('lowWinRateAlert', this.metrics.winRate);
      logger.warn(`Low win rate alert: ${(this.metrics.winRate * 100).toFixed(2)}%`);
    }

    if (this.metrics.profitFactor < this.ALERT_THRESHOLDS.minProfitFactor) {
      this.emit('lowProfitFactorAlert', this.metrics.profitFactor);
      logger.warn(`Low profit factor alert: ${this.metrics.profitFactor.toFixed(2)}`);
    }

    if (this.metrics.maxDrawdown > this.ALERT_THRESHOLDS.maxDrawdown) {
      this.emit('highDrawdownAlert', this.metrics.maxDrawdown);
      logger.warn(`High drawdown alert: ${(this.metrics.maxDrawdown * 100).toFixed(2)}%`);
    }

    if (this.metrics.sharpeRatio < this.ALERT_THRESHOLDS.minSharpeRatio) {
      this.emit('lowSharpeRatioAlert', this.metrics.sharpeRatio);
      logger.warn(`Low Sharpe ratio alert: ${this.metrics.sharpeRatio.toFixed(2)}`);
    }

    // Check if multiple poor performance indicators are present
    const poorPerformanceIndicators = [
      this.metrics.winRate < this.ALERT_THRESHOLDS.minWinRate,
      this.metrics.profitFactor < this.ALERT_THRESHOLDS.minProfitFactor,
      this.metrics.maxDrawdown > this.ALERT_THRESHOLDS.maxDrawdown,
      this.metrics.sharpeRatio < this.ALERT_THRESHOLDS.minSharpeRatio
    ].filter(Boolean).length;

    if (poorPerformanceIndicators >= 2) {
      logger.error('Multiple poor performance indicators detected');
      safetyMonitor.activateEmergencyStop('Multiple performance issues detected');
      circuitBreaker.tripCircuit('Poor overall performance');
    }
  }

  // Allow other systems to suggest risk threshold adjustments
  public adjustRiskThresholds(_: { volatility: number; regime: string }): void {
    // Currently a no-op — placeholder for dynamic threshold tuning
    logger.debug('adjustRiskThresholds called', _);
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public reset(): void {
    this.recentTrades = [];
    this.metrics = this.initializeMetrics();
    logger.info('Performance monitor reset');
    this.emit('reset');
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();