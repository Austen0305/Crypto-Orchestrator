import { Trade, Portfolio, BotConfig } from '@shared/schema';
import { storage } from '../storage';
import logger from './logger';

export interface RiskMetrics {
  portfolioRisk: number; // Overall portfolio risk score (0-100)
  maxDrawdown: number; // Maximum historical drawdown percentage
  var95: number; // 95% Value at Risk
  var99: number; // 99% Value at Risk
  sharpeRatio: number; // Risk-adjusted return metric
  correlationScore: number; // Portfolio correlation score (0-100)
  diversificationRatio: number; // How well diversified the portfolio is
  exposureByAsset: Record<string, number>; // Exposure percentage by asset
  leverageRisk: number; // Risk from leverage usage
  liquidityRisk: number; // Risk from low liquidity assets
  concentrationRisk: number; // Risk from concentrated positions
}

export interface RiskAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: number;
  acknowledged: boolean;
}

export interface RiskLimits {
  maxPositionSize: number; // Maximum position size as percentage of portfolio
  maxDailyLoss: number; // Maximum daily loss limit
  maxPortfolioRisk: number; // Maximum portfolio risk score
  maxLeverage: number; // Maximum allowed leverage
  maxCorrelation: number; // Maximum correlation between assets
  minDiversification: number; // Minimum diversification ratio
}

export class RiskManagementService {
  private riskLimits: RiskLimits = {
    maxPositionSize: 20, // 20% of portfolio
    maxDailyLoss: 5, // 5% of portfolio
    maxPortfolioRisk: 70, // Risk score out of 100
    maxLeverage: 3, // 3x leverage
    maxCorrelation: 0.7, // 70% correlation
    minDiversification: 0.6, // 60% diversification
  };

  // Calculate comprehensive risk metrics for portfolio
  async calculateRiskMetrics(portfolio: Portfolio, trades: Trade[]): Promise<RiskMetrics> {
    try {
      if (!portfolio || !portfolio.positions || Object.keys(portfolio.positions).length === 0) {
        return {
          portfolioRisk: 0,
          maxDrawdown: 0,
          var95: 0,
          var99: 0,
          sharpeRatio: 0,
          correlationScore: 0,
          diversificationRatio: 0,
          exposureByAsset: {},
          leverageRisk: 0,
          liquidityRisk: 0,
          concentrationRisk: 0,
        };
      }

      // Calculate portfolio value and returns
      const portfolioValue = portfolio.totalBalance;
      const dailyReturns = this.calculateDailyReturns(trades, portfolioValue);

      // Calculate maximum drawdown
      const maxDrawdown = this.calculateMaxDrawdown(dailyReturns);

      // Calculate Value at Risk (VaR)
      const sortedReturns = [...dailyReturns].sort((a, b) => a - b);
      const var95 = this.calculateVaR(sortedReturns, 0.05);
      const var99 = this.calculateVaR(sortedReturns, 0.01);

      // Calculate Sharpe ratio (assuming 2% risk-free rate)
      const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
      const returnStdDev = this.calculateStandardDeviation(dailyReturns);
      const sharpeRatio = returnStdDev > 0 ? (avgReturn - 0.02) / returnStdDev * Math.sqrt(252) : 0;

      // Calculate correlation matrix and score
      const correlationMatrix = await this.calculateCorrelationMatrix(portfolio.positions);
      const correlationScore = this.calculateCorrelationScore(correlationMatrix);

      // Calculate diversification ratio
      const diversificationRatio = this.calculateDiversificationRatio(portfolio.positions);

      // Calculate exposure by asset
      const exposureByAsset = this.calculateExposureByAsset(portfolio.positions, portfolioValue);

      // Calculate leverage risk
      const leverageRisk = this.calculateLeverageRisk(portfolio.positions);

      // Calculate liquidity risk
      const liquidityRisk = this.calculateLiquidityRisk(portfolio.positions);

      // Calculate concentration risk
      const concentrationRisk = this.calculateConcentrationRisk(portfolio.positions);

      // Calculate overall portfolio risk score
      const portfolioRisk = this.calculateOverallRiskScore({
        maxDrawdown,
        var95,
        leverageRisk,
        liquidityRisk,
        concentrationRisk,
        correlationScore,
      });

      return {
        portfolioRisk,
        maxDrawdown,
        var95,
        var99,
        sharpeRatio,
        correlationScore,
        diversificationRatio,
        exposureByAsset,
        leverageRisk,
        liquidityRisk,
        concentrationRisk,
      };
    } catch (error) {
      logger.error('Failed to calculate risk metrics:', error);
      throw error;
    }
  }

  // Generate risk alerts based on current metrics
  async generateRiskAlerts(riskMetrics: RiskMetrics, riskLimits: RiskLimits): Promise<RiskAlert[]> {
    try {
      const alerts: RiskAlert[] = [];

      // Portfolio risk alert
      if (riskMetrics.portfolioRisk > riskLimits.maxPortfolioRisk) {
        alerts.push({
          id: `portfolio-risk-${Date.now()}`,
          type: 'critical',
          message: `Portfolio risk score (${riskMetrics.portfolioRisk.toFixed(1)}) exceeds maximum allowed (${riskLimits.maxPortfolioRisk})`,
          threshold: riskLimits.maxPortfolioRisk,
          currentValue: riskMetrics.portfolioRisk,
          timestamp: Date.now(),
          acknowledged: false,
        });
      }

      // Max drawdown alert
      if (riskMetrics.maxDrawdown > riskLimits.maxDailyLoss) {
        alerts.push({
          id: `drawdown-${Date.now()}`,
          type: 'warning',
          message: `Maximum drawdown (${(riskMetrics.maxDrawdown * 100).toFixed(2)}%) exceeds daily loss limit (${riskLimits.maxDailyLoss}%)`,
          threshold: riskLimits.maxDailyLoss,
          currentValue: riskMetrics.maxDrawdown,
          timestamp: Date.now(),
          acknowledged: false,
        });
      }

      // VaR alert
      if (riskMetrics.var95 > riskLimits.maxDailyLoss) {
        alerts.push({
          id: `var95-${Date.now()}`,
          type: 'warning',
          message: `95% VaR (${(riskMetrics.var95 * 100).toFixed(2)}%) exceeds daily loss limit (${riskLimits.maxDailyLoss}%)`,
          threshold: riskLimits.maxDailyLoss,
          currentValue: riskMetrics.var95,
          timestamp: Date.now(),
          acknowledged: false,
        });
      }

      // Leverage alert
      if (riskMetrics.leverageRisk > riskLimits.maxLeverage) {
        alerts.push({
          id: `leverage-${Date.now()}`,
          type: 'critical',
          message: `Leverage risk (${riskMetrics.leverageRisk.toFixed(2)}) exceeds maximum allowed (${riskLimits.maxLeverage})`,
          threshold: riskLimits.maxLeverage,
          currentValue: riskMetrics.leverageRisk,
          timestamp: Date.now(),
          acknowledged: false,
        });
      }

      // Correlation alert
      if (riskMetrics.correlationScore > riskLimits.maxCorrelation) {
        alerts.push({
          id: `correlation-${Date.now()}`,
          type: 'warning',
          message: `Correlation score (${riskMetrics.correlationScore.toFixed(2)}) exceeds maximum allowed (${riskLimits.maxCorrelation})`,
          threshold: riskLimits.maxCorrelation,
          currentValue: riskMetrics.correlationScore,
          timestamp: Date.now(),
          acknowledged: false,
        });
      }

      // Diversification alert
      if (riskMetrics.diversificationRatio < riskLimits.minDiversification) {
        alerts.push({
          id: `diversification-${Date.now()}`,
          type: 'warning',
          message: `Diversification ratio (${(riskMetrics.diversificationRatio * 100).toFixed(2)}%) below minimum required (${(riskLimits.minDiversification * 100).toFixed(2)}%)`,
          threshold: riskLimits.minDiversification,
          currentValue: riskMetrics.diversificationRatio,
          timestamp: Date.now(),
          acknowledged: false,
        });
      }

      return alerts;
    } catch (error) {
      logger.error('Failed to generate risk alerts:', error);
      throw error;
    }
  }

  // Acknowledge risk alert
  async acknowledgeRiskAlert(alertId: string): Promise<boolean> {
    try {
      // In a real implementation, this would update the alert in the database
      // For now, we'll just return true to simulate acknowledgment
      return true;
    } catch (error) {
      logger.error('Failed to acknowledge risk alert:', error);
      return false;
    }
  }

  // Get risk limits for user
  async getRiskLimits(userId?: string): Promise<RiskLimits> {
    try {
      // In a real implementation, this would fetch from user settings
      // For now, we'll return default limits
      return this.riskLimits;
    } catch (error) {
      logger.error('Failed to get risk limits:', error);
      return this.riskLimits;
    }
  }

  // Update risk limits for user
  async updateRiskLimits(limits: Partial<RiskLimits>, userId?: string): Promise<boolean> {
    try {
      // In a real implementation, this would update in the database
      // For now, we'll just update the local limits
      this.riskLimits = { ...this.riskLimits, ...limits };
      return true;
    } catch (error) {
      logger.error('Failed to update risk limits:', error);
      return false;
    }
  }

  // Helper methods for calculations
  private calculateDailyReturns(trades: Trade[], portfolioValue: number): number[] {
    // Group trades by day and calculate daily returns
    const dailyReturns: number[] = [];
    const tradesByDay = new Map<string, Trade[]>();

    trades.forEach(trade => {
      const day = new Date(trade.timestamp).toISOString().split('T')[0];
      if (!tradesByDay.has(day)) {
        tradesByDay.set(day, []);
      }
      tradesByDay.get(day)!.push(trade);
    });

    // Calculate daily portfolio values and returns
    let previousValue = portfolioValue;
    const sortedDays = Array.from(tradesByDay.keys()).sort();

    sortedDays.forEach(day => {
      const dayTrades = tradesByDay.get(day)!;
      let dayValue = previousValue;

      dayTrades.forEach(trade => {
        if (trade.side === 'sell') {
          dayValue += trade.total;
        }
      });

      if (dayValue > 0) {
        dailyReturns.push(dayValue / previousValue - 1);
        previousValue = dayValue;
      }
    });

    return dailyReturns;
  }

  private calculateMaxDrawdown(dailyReturns: number[]): number {
    let peak = 0;
    let maxDrawdown = 0;
    let currentValue = 0;

    dailyReturns.forEach(returnValue => {
      currentValue = currentValue * (1 + returnValue);
      if (currentValue > peak) {
        peak = currentValue;
      }

      const drawdown = (peak - currentValue) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    return maxDrawdown;
  }

  private calculateVaR(sortedReturns: number[], percentile: number): number {
    const index = Math.floor(sortedReturns.length * percentile);
    return sortedReturns[index];
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((sum, squaredDiff) => sum + squaredDiff, 0) / values.length;
    return Math.sqrt(variance);
  }

  private async calculateCorrelationMatrix(positions: Record<string, any>): Promise<Record<string, Record<string, number>>> {
    // Simplified correlation calculation
    // In a real implementation, this would use historical price data
    const assets = Object.keys(positions);
    const correlationMatrix: Record<string, Record<string, number>> = {};

    assets.forEach(asset1 => {
      correlationMatrix[asset1] = {};
      assets.forEach(asset2 => {
        // Simplified correlation calculation
        // In a real implementation, this would use historical price data
        correlationMatrix[asset1][asset2] = asset1 === asset2 ? 1 : Math.random() * 0.7;
      });
    });

    return correlationMatrix;
  }

  private calculateCorrelationScore(correlationMatrix: Record<string, Record<string, number>>): number {
    const assets = Object.keys(correlationMatrix);
    if (assets.length < 2) return 0;

    let totalCorrelation = 0;
    let count = 0;

    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        totalCorrelation += correlationMatrix[assets[i]][assets[j]];
        count++;
      }
    }

    return count > 0 ? totalCorrelation / count : 0;
  }

  private calculateDiversificationRatio(positions: Record<string, any>): number {
    const assets = Object.keys(positions);
    if (assets.length < 2) return 1;

    // Calculate equal weight for perfect diversification
    const equalWeight = 1 / assets.length;

    // Calculate actual weights
    const totalValue = Object.values(positions).reduce((sum, pos) => sum + (pos.amount * pos.price), 0);
    const weights: Record<string, number> = {};

    assets.forEach(asset => {
      weights[asset] = (positions[asset].amount * positions[asset].price) / totalValue;
    });

    // Calculate diversification ratio
    let diversificationScore = 0;
    assets.forEach(asset => {
      diversificationScore += Math.min(weights[asset] / equalWeight, 1);
    });

    return diversificationScore / assets.length;
  }

  private calculateExposureByAsset(positions: Record<string, any>, portfolioValue: number): Record<string, number> {
    const exposureByAsset: Record<string, number> = {};
    const totalValue = Object.values(positions).reduce((sum, pos) => sum + (pos.amount * pos.price), 0);

    Object.keys(positions).forEach(asset => {
      exposureByAsset[asset] = ((positions[asset].amount * positions[asset].price) / totalValue) * 100;
    });

    return exposureByAsset;
  }

  private calculateLeverageRisk(positions: Record<string, any>): number {
    // Simplified leverage calculation
    // In a real implementation, this would use actual leverage data
    return Object.values(positions).reduce((maxLeverage, pos) => {
      return Math.max(maxLeverage, pos.leverage || 1);
    }, 1);
  }

  private calculateLiquidityRisk(positions: Record<string, any>): number {
    // Simplified liquidity risk calculation
    // In a real implementation, this would use actual liquidity data
    return Object.values(positions).reduce((totalRisk, pos) => {
      // Lower volume assets have higher liquidity risk
      const volumeRisk = pos.volume24h ? Math.min(1, 100000 / pos.volume24h) : 0.5;
      return totalRisk + volumeRisk;
    }, 0) / Object.keys(positions).length;
  }

  private calculateConcentrationRisk(positions: Record<string, any>): number {
    // Calculate concentration risk based on position sizes
    const totalValue = Object.values(positions).reduce((sum, pos) => sum + (pos.amount * pos.price), 0);
    const maxPositionValue = Math.max(...Object.values(positions).map(pos => pos.amount * pos.price));

    // Higher concentration in fewer assets increases risk
    return (maxPositionValue / totalValue) * (1 - 1 / Object.keys(positions).length);
  }

  private calculateOverallRiskScore(riskFactors: {
    maxDrawdown: number;
    var95: number;
    leverageRisk: number;
    liquidityRisk: number;
    concentrationRisk: number;
    correlationScore: number;
  }): number {
    // Weighted risk factors
    const drawdownRisk = Math.min(riskFactors.maxDrawdown * 100, 30); // Max 30% from drawdown
    const varRisk = Math.min(riskFactors.var95 * 100, 25); // Max 25% from VaR
    const leverageScore = Math.min(riskFactors.leverageRisk * 10, 20); // Max 20 from leverage
    const liquidityScore = Math.min(riskFactors.liquidityRisk * 15, 15); // Max 15 from liquidity
    const concentrationScore = Math.min(riskFactors.concentrationRisk * 20, 20); // Max 20 from concentration
    const correlationScore = Math.min(riskFactors.correlationScore * 15, 15); // Max 15 from correlation

    // Calculate overall risk score (0-100)
    const totalRisk = drawdownRisk + varRisk + leverageScore + liquidityScore + concentrationScore + correlationScore;
    return Math.min(totalRisk, 100);
  }
}

export const riskManagementService = new RiskManagementService();
