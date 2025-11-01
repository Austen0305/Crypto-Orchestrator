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
    const { winRate, averageWin, averageLoss } = performanceMonitor.getMetrics();
    
    if (averageLoss === 0 || !winRate) return 0;

    const probability = winRate;
    const odds = averageWin / averageLoss;

    let kellyFraction = (probability * (odds + 1) - 1) / odds;

    // Limit kelly fraction to reasonable bounds
    kellyFraction = Math.min(Math.max(kellyFraction, 0), 0.5);

    return kellyFraction;
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
    // Implementation for current risk calculation
    return 0; // Placeholder
  }

  private calculateExpectedDrawdown(): number {
    // Implementation for expected drawdown calculation
    return 0; // Placeholder
  }

  private calculateOptimalLeverage(): number {
    // Implementation for optimal leverage calculation
    return 1; // Placeholder
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