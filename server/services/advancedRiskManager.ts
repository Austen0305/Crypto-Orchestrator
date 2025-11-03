import { EventEmitter } from 'events';
import logger from './logger';
import { advancedMarketAnalyzer } from './advancedMarketAnalyzer';
import { performanceMonitor } from './performanceMonitor';
import type { Trade, MarketData } from '@shared/schema';

interface RiskProfile {
  maxPositionSize: number;
  stopLossDistance: number;
  takeProfitDistance: number;
  entryConfidence: number;
}

interface RiskMetrics {
  currentRisk: number;
  historicalVolatility: number;
  expectedDrawdown: number;
  optimalLeverage: number;
  kellyFraction: number;
}

export class AdvancedRiskManager extends EventEmitter {
  private static instance: AdvancedRiskManager;
  private historicalData: MarketData[] = [];
  private recentTrades: Trade[] = [];
  private riskMetrics: RiskMetrics = {
    currentRisk: 0,
    historicalVolatility: 0,
    expectedDrawdown: 0,
    optimalLeverage: 1,
    kellyFraction: 0.5
  };

  private readonly MAX_TRADES_HISTORY = 1000;
  private readonly RISK_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private updateTimer?: ReturnType<typeof setInterval>;

  private constructor() {
    super();
    this.setupEventListeners();
    this.startRiskUpdates();
  }

  public static getInstance(): AdvancedRiskManager {
    if (!AdvancedRiskManager.instance) {
      AdvancedRiskManager.instance = new AdvancedRiskManager();
    }
    return AdvancedRiskManager.instance;
  }

  private setupEventListeners(): void {
    advancedMarketAnalyzer.on('marketConditionsUpdate', (conditions) => {
      this.updateRiskMetrics(conditions);
    });

    performanceMonitor.on('metricsUpdated', (metrics) => {
      this.adjustRiskParameters(metrics);
    });
  }

  private startRiskUpdates(): void {
    this.updateTimer = setInterval(() => {
      this.updateRiskAssessment();
    }, this.RISK_UPDATE_INTERVAL);
  }

  public async calculateOptimalRiskProfile(
    currentPrice: number,
    volatility: number,
    marketConditions: any
  ): Promise<RiskProfile> {
    const metrics = this.riskMetrics;
    const kellyFraction = this.calculateKellyFraction();

    // Base position size on Kelly Criterion and current market conditions
    let maxPositionSize = kellyFraction * metrics.optimalLeverage;

    // Adjust for market volatility
    maxPositionSize *= (1 - Math.min(volatility, 0.5));

    // Calculate dynamic stop loss based on volatility and market conditions
    const stopLossDistance = this.calculateDynamicStopLoss(volatility, marketConditions);

    // Calculate take profit based on risk:reward ratio
    const takeProfitDistance = stopLossDistance * this.calculateRiskRewardRatio(marketConditions);

    // Calculate entry confidence score
    const entryConfidence = this.calculateEntryConfidence(marketConditions);

    return {
      maxPositionSize: Math.min(maxPositionSize, 0.1), // Cap at 10%
      stopLossDistance,
      takeProfitDistance,
      entryConfidence
    };
  }

  private calculateKellyFraction(): number {
    if (this.recentTrades.length < 10) return 0.1; // Default

    const winRate = this.recentTrades.filter(t => t.profitLoss > 0).length / this.recentTrades.length;
    const avgWin = this.calculateAverageWin();
    const avgLoss = this.calculateAverageLoss();

    if (avgLoss === 0) return 0; // Avoid division by zero
    const payoffRatio = avgWin / avgLoss;

    // Standard Kelly formula: f* = p - (1 - p)/b
    return winRate - (1 - winRate) / payoffRatio;
  }

  private calculateAverageWin(): number {
    const wins = this.recentTrades.filter(t => t.profitLoss > 0);
    return wins.reduce((sum, t) => sum + t.profitLoss, 0) / (wins.length || 1);
  }

  private calculateAverageLoss(): number {
    const losses = this.recentTrades.filter(t => t.profitLoss <= 0);
    return Math.abs(losses.reduce((sum, t) => sum + t.profitLoss, 0) / (losses.length || 1));
  }

  private calculateDynamicStopLoss(volatility: number, marketConditions: any): number {
    // Base stop loss on ATR (Average True Range)
    let stopLoss = volatility * 2;

    // Adjust for market conditions
    if (marketConditions.regime === 'volatile') {
      stopLoss *= 1.5;
    }

    // Ensure minimum stop loss
    return Math.max(stopLoss, 0.01);
  }

  private calculateRiskRewardRatio(marketConditions: any): number {
    // Base RR ratio on market regime
    switch (marketConditions.regime) {
      case 'trending':
        return 3; // Higher reward target in trending markets
      case 'ranging':
        return 2; // Lower targets in ranging markets
      case 'volatile':
        return 2.5; // Balanced in volatile markets
      default:
        return 2;
    }
  }

  private calculateEntryConfidence(marketConditions: any): number {
    let confidence = 0.5; // Base confidence

    // Adjust for market conditions
    if (marketConditions.trend.strength > 0.7) {
      confidence += 0.2;
    }

    if (marketConditions.volume.level === 'high') {
      confidence += 0.1;
    }

    if (!marketConditions.liquidity.sufficient) {
      confidence -= 0.3;
    }

    // Ensure bounds
    return Math.min(Math.max(confidence, 0), 1);
  }

  private async updateRiskAssessment(): Promise<void> {
    try {
      const marketConditions = advancedMarketAnalyzer.getMarketConditions();
      if (!marketConditions) return;

      // Update risk metrics
      this.riskMetrics = {
        currentRisk: this.calculateCurrentRisk(),
        historicalVolatility: marketConditions.volatility,
        expectedDrawdown: this.calculateExpectedDrawdown(),
        optimalLeverage: this.calculateOptimalLeverage(),
        kellyFraction: this.calculateKellyFraction()
      };

      this.emit('riskMetricsUpdated', this.riskMetrics);
      logger.info('Risk metrics updated', { metrics: this.riskMetrics });
    } catch (error) {
      logger.error('Error updating risk assessment', { error });
    }
  }

  private calculateCurrentRisk(): number {
    if (this.recentTrades.length === 0) return 0.5; // Default medium risk

    // Calculate win rate and profit factor
    const winningTrades = this.recentTrades.filter(t => t.profitLoss > 0);
    const winRate = winningTrades.length / this.recentTrades.length;
    const totalProfit = winningTrades.reduce((sum, t) => sum + t.profitLoss, 0);
    const totalLoss = this.recentTrades
      .filter(t => t.profitLoss <= 0)
      .reduce((sum, t) => sum + Math.abs(t.profitLoss), 0);
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : Infinity;

    // Combine factors into risk score (0-1)
    const riskScore = (
      0.4 * (1 - winRate) +
      0.3 * (1 - Math.min(1, profitFactor / 5)) +
      0.3 * (this.calculatePositionConcentrationRisk())
    );

    return Math.min(1, Math.max(0, riskScore));
  }

  private calculatePositionConcentrationRisk(): number {
    if (this.recentTrades.length === 0) return 0;

    // Count positions per symbol
    const positionCounts: Record<string, number> = {};
    this.recentTrades.forEach(t => {
      positionCounts[t.symbol] = (positionCounts[t.symbol] || 0) + 1;
    });

    // Calculate concentration risk (0-1)
    const totalCount = this.recentTrades.length;
    const counts = Object.values(positionCounts);
    const concentrationRisk = counts.reduce((sum, cnt) => {
      return sum + Math.pow(cnt / totalCount, 2);
    }, 0);

    return concentrationRisk;
  }

  private calculateExpectedDrawdown(): number {
    if (this.historicalData.length < 30) return 0.2; // Default

    // Calculate rolling volatility
    const returns = [];
    for (let i = 1; i < this.historicalData.length; i++) {
      returns.push(Math.log(this.historicalData[i].close / this.historicalData[i - 1].close));
    }

    const volatility = this.calculateStandardDeviation(returns);
    const expectedDrawdown = volatility * 2.5; // 2.5 sigma event

    return Math.min(0.5, Math.max(0.05, expectedDrawdown));
  }

  private calculateStandardDeviation(values: number[]): number {
    const avg = values.reduce((a, b) => a + b) / values.length;
    return Math.sqrt(values.reduce((a, v) => a + Math.pow(v - avg, 2), 0) / values.length);
  }

  private calculateOptimalLeverage(): number {
    const riskMetrics = this.getRiskMetrics();
    if (riskMetrics.kellyFraction <= 0) return 1;

    // Use modified Kelly criterion with volatility adjustment
    const maxLeverage = 10;
    const safetyMargin = 0.7; // Conservative factor
    const volatilityFactor = Math.min(1, 0.2 / riskMetrics.historicalVolatility);

    return Math.min(
      maxLeverage,
      Math.max(1, riskMetrics.kellyFraction * safetyMargin * volatilityFactor)
    );
  }

  private updateRiskMetrics(marketConditions: any): void {
    // Update risk metrics based on market conditions
    const volatility = marketConditions.volatility;
    const regime = marketConditions.regime;

    if (volatility > 0.3 || regime === 'volatile') {
      this.emit('highRiskAlert', { volatility, regime });
    }
  }

  private adjustRiskParameters(performanceMetrics: any): void {
    // Adjust risk parameters based on performance
    if (performanceMetrics.consecutiveLosses > 3) {
      this.reduceRiskExposure();
    }
  }

  private reduceRiskExposure(): void {
    this.riskMetrics.optimalLeverage *= 0.8;
    this.emit('riskExposureReduced', this.riskMetrics);
  }

  public addTrade(trade: Trade): void {
    this.recentTrades.push(trade);
    if (this.recentTrades.length > this.MAX_TRADES_HISTORY) {
      this.recentTrades.shift();
    }
  }

  public getRiskMetrics(): RiskMetrics {
    return { ...this.riskMetrics };
  }

  public dispose(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    this.removeAllListeners();
  }
}

export const advancedRiskManager = AdvancedRiskManager.getInstance();