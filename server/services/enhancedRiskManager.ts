import { EventEmitter } from 'events';
import logger from './logger';
import type { Trade, BotConfig, Portfolio } from '@shared/schema';

interface RiskMetrics {
  currentDrawdown: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  valueAtRisk: number;
  expectedShortfall: number;
  volatility: number;
  beta: number;
  riskAdjustedReturn: number;
  kellyFraction: number;
  optimalPositionSize: number;
  portfolioHeat: number;
  consecutiveLosses: number;
  winRate: number;
  profitFactor: number;
  recoveryFactor: number;
  calmarRatio: number;
}

interface PositionSizingParams {
  accountBalance: number;
  riskPerTrade: number;
  stopLossPercent: number;
  volatility: number;
  confidence: number;
  correlation: number;
}

interface RiskAlert {
  level: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  metric: string;
  value: number;
  threshold: number;
}

export class EnhancedRiskManager extends EventEmitter {
  private static instance: EnhancedRiskManager;
  private tradeHistory: Trade[] = [];
  private dailyReturns: number[] = [];
  private portfolioValue: number = 100000;
  private initialBalance: number = 100000;
  private currentDrawdown: number = 0;
  private maxDrawdown: number = 0;
  private consecutiveLosses: number = 0;
  private consecutiveWins: number = 0;
  private riskAlerts: RiskAlert[] = [];
  private readonly MAX_ALERTS = 100;
  private readonly MAX_HISTORY = 1000;

  // Risk thresholds
  private readonly MAX_POSITION_SIZE_PERCENT = 10;
  private readonly MAX_PORTFOLIO_HEAT = 30;
  private readonly MAX_DRAWDOWN_PERCENT = 20;
  private readonly MAX_CONSECUTIVE_LOSSES = 5;
  private readonly MIN_SHARPE_RATIO = 0.5;
  private readonly MAX_VAR_PERCENT = 5;

  private constructor() {
    super();
  }

  public static getInstance(): EnhancedRiskManager {
    if (!EnhancedRiskManager.instance) {
      EnhancedRiskManager.instance = new EnhancedRiskManager();
    }
    return EnhancedRiskManager.instance;
  }

  public initialize(initialBalance: number): void {
    this.initialBalance = initialBalance;
    this.portfolioValue = initialBalance;
    logger.info('Enhanced risk manager initialized', { initialBalance });
  }

  public addTrade(trade: Trade): void {
    this.tradeHistory.push(trade);
    
    if (this.tradeHistory.length > this.MAX_HISTORY) {
      this.tradeHistory.shift();
    }

    // Update metrics
    this.updateMetrics(trade);
    this.checkRiskThresholds();
  }

  private updateMetrics(trade: Trade): void {
    const profit = trade.side === 'buy' 
      ? (trade.price - trade.amount) * trade.amount
      : (trade.amount - trade.price) * trade.amount;

    const profitPercent = (profit / this.portfolioValue) * 100;
    this.dailyReturns.push(profitPercent / 100);

    if (this.dailyReturns.length > 252) { // ~ 1 year of trading days
      this.dailyReturns.shift();
    }

    // Update consecutive wins/losses
    if (profit > 0) {
      this.consecutiveWins++;
      this.consecutiveLosses = 0;
    } else if (profit < 0) {
      this.consecutiveLosses++;
      this.consecutiveWins = 0;
    }

    // Update portfolio value and drawdown
    this.portfolioValue += profit;
    const drawdown = ((this.portfolioValue - this.initialBalance) / this.initialBalance) * 100;
    
    if (drawdown < this.currentDrawdown) {
      this.currentDrawdown = drawdown;
      if (this.currentDrawdown < this.maxDrawdown) {
        this.maxDrawdown = this.currentDrawdown;
      }
    }
  }

  private checkRiskThresholds(): void {
    const metrics = this.calculateRiskMetrics();

    // Check max drawdown
    if (Math.abs(metrics.currentDrawdown) > this.MAX_DRAWDOWN_PERCENT) {
      this.addAlert({
        level: 'critical',
        message: 'Maximum drawdown exceeded',
        timestamp: Date.now(),
        metric: 'drawdown',
        value: metrics.currentDrawdown,
        threshold: this.MAX_DRAWDOWN_PERCENT,
      });
      this.emit('maxDrawdownExceeded', metrics.currentDrawdown);
    }

    // Check consecutive losses
    if (this.consecutiveLosses >= this.MAX_CONSECUTIVE_LOSSES) {
      this.addAlert({
        level: 'high',
        message: 'Maximum consecutive losses reached',
        timestamp: Date.now(),
        metric: 'consecutiveLosses',
        value: this.consecutiveLosses,
        threshold: this.MAX_CONSECUTIVE_LOSSES,
      });
      this.emit('consecutiveLossesExceeded', this.consecutiveLosses);
    }

    // Check Sharpe ratio
    if (metrics.sharpeRatio < this.MIN_SHARPE_RATIO) {
      this.addAlert({
        level: 'medium',
        message: 'Sharpe ratio below minimum threshold',
        timestamp: Date.now(),
        metric: 'sharpeRatio',
        value: metrics.sharpeRatio,
        threshold: this.MIN_SHARPE_RATIO,
      });
    }

    // Check VaR
    if (Math.abs(metrics.valueAtRisk) > this.MAX_VAR_PERCENT) {
      this.addAlert({
        level: 'high',
        message: 'Value at Risk exceeds threshold',
        timestamp: Date.now(),
        metric: 'valueAtRisk',
        value: metrics.valueAtRisk,
        threshold: this.MAX_VAR_PERCENT,
      });
    }
  }

  private addAlert(alert: RiskAlert): void {
    this.riskAlerts.unshift(alert);
    if (this.riskAlerts.length > this.MAX_ALERTS) {
      this.riskAlerts.pop();
    }
    this.emit('riskAlert', alert);
    logger.warn('Risk alert', alert);
  }

  public calculateRiskMetrics(): RiskMetrics {
    if (this.tradeHistory.length === 0) {
      return this.getDefaultMetrics();
    }

    const sharpeRatio = this.calculateSharpeRatio();
    const sortinoRatio = this.calculateSortinoRatio();
    const valueAtRisk = this.calculateVaR(0.95);
    const expectedShortfall = this.calculateExpectedShortfall(0.95);
    const volatility = this.calculateVolatility();
    const beta = this.calculateBeta();
    const riskAdjustedReturn = this.calculateRiskAdjustedReturn();
    const kellyFraction = this.calculateKellyFraction();
    const optimalPositionSize = this.calculateOptimalPositionSize();
    const portfolioHeat = this.calculatePortfolioHeat();
    const winRate = this.calculateWinRate();
    const profitFactor = this.calculateProfitFactor();
    const recoveryFactor = this.calculateRecoveryFactor();
    const calmarRatio = this.calculateCalmarRatio();

    return {
      currentDrawdown: this.currentDrawdown,
      maxDrawdown: this.maxDrawdown,
      sharpeRatio,
      sortinoRatio,
      valueAtRisk,
      expectedShortfall,
      volatility,
      beta,
      riskAdjustedReturn,
      kellyFraction,
      optimalPositionSize,
      portfolioHeat,
      consecutiveLosses: this.consecutiveLosses,
      winRate,
      profitFactor,
      recoveryFactor,
      calmarRatio,
    };
  }

  private getDefaultMetrics(): RiskMetrics {
    return {
      currentDrawdown: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      valueAtRisk: 0,
      expectedShortfall: 0,
      volatility: 0,
      beta: 1,
      riskAdjustedReturn: 0,
      kellyFraction: 0.1,
      optimalPositionSize: 0.05,
      portfolioHeat: 0,
      consecutiveLosses: 0,
      winRate: 0,
      profitFactor: 0,
      recoveryFactor: 0,
      calmarRatio: 0,
    };
  }

  private calculateSharpeRatio(): number {
    if (this.dailyReturns.length < 2) return 0;

    const avgReturn = this.dailyReturns.reduce((sum, r) => sum + r, 0) / this.dailyReturns.length;
    const variance = this.dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / this.dailyReturns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    // Annualized Sharpe ratio (assuming 252 trading days)
    const riskFreeRate = 0.02 / 252; // 2% annual risk-free rate
    return ((avgReturn - riskFreeRate) / stdDev) * Math.sqrt(252);
  }

  private calculateSortinoRatio(): number {
    if (this.dailyReturns.length < 2) return 0;

    const avgReturn = this.dailyReturns.reduce((sum, r) => sum + r, 0) / this.dailyReturns.length;
    const downsideReturns = this.dailyReturns.filter(r => r < 0);
    
    if (downsideReturns.length === 0) return Infinity;

    const downsideDeviation = Math.sqrt(
      downsideReturns.reduce((sum, r) => sum + r * r, 0) / downsideReturns.length
    );

    if (downsideDeviation === 0) return 0;

    const riskFreeRate = 0.02 / 252;
    return ((avgReturn - riskFreeRate) / downsideDeviation) * Math.sqrt(252);
  }

  private calculateVaR(confidence: number): number {
    if (this.dailyReturns.length === 0) return 0;

    const sorted = [...this.dailyReturns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sorted.length);
    return sorted[index] * this.portfolioValue;
  }

  private calculateExpectedShortfall(confidence: number): number {
    if (this.dailyReturns.length === 0) return 0;

    const sorted = [...this.dailyReturns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sorted.length);
    const tailReturns = sorted.slice(0, index);
    
    if (tailReturns.length === 0) return 0;

    const avgTailReturn = tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
    return avgTailReturn * this.portfolioValue;
  }

  private calculateVolatility(): number {
    if (this.dailyReturns.length < 2) return 0;

    const avgReturn = this.dailyReturns.reduce((sum, r) => sum + r, 0) / this.dailyReturns.length;
    const variance = this.dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / this.dailyReturns.length;
    
    // Annualized volatility
    return Math.sqrt(variance * 252);
  }

  private calculateBeta(): number {
    // Simplified beta calculation (would need market returns for actual calculation)
    // Using correlation with average market volatility as proxy
    return 1.0;
  }

  private calculateRiskAdjustedReturn(): number {
    if (this.dailyReturns.length === 0) return 0;

    const totalReturn = (this.portfolioValue - this.initialBalance) / this.initialBalance;
    const volatility = this.calculateVolatility();
    
    if (volatility === 0) return 0;

    return totalReturn / volatility;
  }

  private calculateKellyFraction(): number {
    const winRate = this.calculateWinRate();
    const avgWin = this.calculateAverageWin();
    const avgLoss = this.calculateAverageLoss();

    if (avgLoss === 0) return 0;

    const winLossRatio = Math.abs(avgWin / avgLoss);
    const kellyPercent = (winRate * winLossRatio - (1 - winRate)) / winLossRatio;

    // Apply fractional Kelly for safety (half-Kelly)
    return Math.max(0, Math.min(0.25, kellyPercent * 0.5));
  }

  private calculateOptimalPositionSize(): number {
    const kellyFraction = this.calculateKellyFraction();
    const volatility = this.calculateVolatility();
    
    // Adjust position size based on volatility
    const volatilityAdjustment = Math.max(0.5, Math.min(1.5, 1 / (1 + volatility)));
    const optimalSize = kellyFraction * volatilityAdjustment;
    
    return Math.max(0.01, Math.min(this.MAX_POSITION_SIZE_PERCENT / 100, optimalSize));
  }

  private calculatePortfolioHeat(): number {
    // Calculate total risk exposure as percentage of portfolio
    const openRisk = this.tradeHistory
      .filter(t => t.status === 'pending')
      .reduce((sum, t) => sum + (t.amount * t.price), 0);
    
    return (openRisk / this.portfolioValue) * 100;
  }

  private calculateWinRate(): number {
    if (this.tradeHistory.length === 0) return 0;

    const wins = this.tradeHistory.filter(t => {
      const profit = t.side === 'buy' 
        ? (t.price - t.amount) * t.amount
        : (t.amount - t.price) * t.amount;
      return profit > 0;
    }).length;

    return wins / this.tradeHistory.length;
  }

  private calculateAverageWin(): number {
    const wins = this.tradeHistory.filter(t => {
      const profit = t.side === 'buy' 
        ? (t.price - t.amount) * t.amount
        : (t.amount - t.price) * t.amount;
      return profit > 0;
    });

    if (wins.length === 0) return 0;

    const totalWinProfit = wins.reduce((sum, t) => {
      const profit = t.side === 'buy' 
        ? (t.price - t.amount) * t.amount
        : (t.amount - t.price) * t.amount;
      return sum + profit;
    }, 0);

    return totalWinProfit / wins.length;
  }

  private calculateAverageLoss(): number {
    const losses = this.tradeHistory.filter(t => {
      const profit = t.side === 'buy' 
        ? (t.price - t.amount) * t.amount
        : (t.amount - t.price) * t.amount;
      return profit < 0;
    });

    if (losses.length === 0) return 0;

    const totalLossProfit = losses.reduce((sum, t) => {
      const profit = t.side === 'buy' 
        ? (t.price - t.amount) * t.amount
        : (t.amount - t.price) * t.amount;
      return sum + Math.abs(profit);
    }, 0);

    return totalLossProfit / losses.length;
  }

  private calculateProfitFactor(): number {
    const avgWin = this.calculateAverageWin();
    const avgLoss = this.calculateAverageLoss();
    const winRate = this.calculateWinRate();

    if (avgLoss === 0) return 0;

    const totalWins = avgWin * this.tradeHistory.length * winRate;
    const totalLosses = avgLoss * this.tradeHistory.length * (1 - winRate);

    if (totalLosses === 0) return 0;

    return totalWins / totalLosses;
  }

  private calculateRecoveryFactor(): number {
    const totalReturn = (this.portfolioValue - this.initialBalance) / this.initialBalance;
    
    if (this.maxDrawdown === 0) return 0;

    return totalReturn / Math.abs(this.maxDrawdown);
  }

  private calculateCalmarRatio(): number {
    if (this.dailyReturns.length === 0) return 0;

    const avgDailyReturn = this.dailyReturns.reduce((sum, r) => sum + r, 0) / this.dailyReturns.length;
    const annualizedReturn = avgDailyReturn * 252;

    if (this.maxDrawdown === 0) return 0;

    return annualizedReturn / Math.abs(this.maxDrawdown);
  }

  public calculateDynamicPositionSize(params: PositionSizingParams): number {
    const {
      accountBalance,
      riskPerTrade,
      stopLossPercent,
      volatility,
      confidence,
      correlation,
    } = params;

    // Base position size from risk per trade
    const baseSize = (accountBalance * (riskPerTrade / 100)) / stopLossPercent;

    // Adjust for volatility
    const volatilityAdjustment = Math.max(0.5, Math.min(1.5, 1 / (1 + volatility)));

    // Adjust for confidence
    const confidenceAdjustment = Math.pow(confidence, 2);

    // Adjust for correlation (reduce size if highly correlated with existing positions)
    const correlationAdjustment = Math.max(0.5, 1 - Math.abs(correlation) * 0.5);

    // Apply Kelly Criterion adjustment
    const kellyFraction = this.calculateKellyFraction();
    const kellyAdjustment = Math.max(0.5, Math.min(1.5, kellyFraction / 0.1));

    // Calculate final position size
    const adjustedSize = baseSize * 
      volatilityAdjustment * 
      confidenceAdjustment * 
      correlationAdjustment * 
      kellyAdjustment;

    // Ensure within limits
    const maxPositionSize = accountBalance * (this.MAX_POSITION_SIZE_PERCENT / 100);
    return Math.max(0, Math.min(maxPositionSize, adjustedSize));
  }

  public shouldStopTrading(): { shouldStop: boolean; reason?: string } {
    const metrics = this.calculateRiskMetrics();

    // Check max drawdown
    if (Math.abs(metrics.currentDrawdown) > this.MAX_DRAWDOWN_PERCENT) {
      return {
        shouldStop: true,
        reason: `Maximum drawdown of ${this.MAX_DRAWDOWN_PERCENT}% exceeded (current: ${metrics.currentDrawdown.toFixed(2)}%)`,
      };
    }

    // Check consecutive losses
    if (this.consecutiveLosses >= this.MAX_CONSECUTIVE_LOSSES) {
      return {
        shouldStop: true,
        reason: `Maximum consecutive losses of ${this.MAX_CONSECUTIVE_LOSSES} reached (current: ${this.consecutiveLosses})`,
      };
    }

    // Check portfolio heat
    if (metrics.portfolioHeat > this.MAX_PORTFOLIO_HEAT) {
      return {
        shouldStop: true,
        reason: `Portfolio heat exceeds ${this.MAX_PORTFOLIO_HEAT}% (current: ${metrics.portfolioHeat.toFixed(2)}%)`,
      };
    }

    // Check VaR
    if (Math.abs(metrics.valueAtRisk) > this.MAX_VAR_PERCENT * this.portfolioValue / 100) {
      return {
        shouldStop: true,
        reason: `Value at Risk exceeds ${this.MAX_VAR_PERCENT}% threshold`,
      };
    }

    return { shouldStop: false };
  }

  public getAlerts(): RiskAlert[] {
    return [...this.riskAlerts];
  }

  public clearAlerts(): void {
    this.riskAlerts = [];
  }

  public resetMetrics(): void {
    this.tradeHistory = [];
    this.dailyReturns = [];
    this.currentDrawdown = 0;
    this.maxDrawdown = 0;
    this.consecutiveLosses = 0;
    this.consecutiveWins = 0;
    this.portfolioValue = this.initialBalance;
    logger.info('Risk metrics reset');
  }

  public dispose(): void {
    this.removeAllListeners();
  }
}

export const enhancedRiskManager = EnhancedRiskManager.getInstance();
