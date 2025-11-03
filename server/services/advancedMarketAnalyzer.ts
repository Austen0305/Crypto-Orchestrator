import { EventEmitter } from 'events';
import logger from './logger';
import { performanceMonitor } from './performanceMonitor';
import { safetyMonitor } from './safetyMonitor';

interface MarketConditions {
  regime: 'trending' | 'ranging' | 'volatile' | 'uncertain';
  volatility: number;
  trend: {
    direction: 'up' | 'down' | 'sideways';
    strength: number;
  };
  volume: {
    level: 'high' | 'medium' | 'low';
    anomaly: boolean;
  };
  liquidity: {
    score: number;
    sufficient: boolean;
  };
}

interface MarketAlert {
  type: 'warning' | 'danger' | 'info';
  message: string;
  timestamp: number;
  data?: any;
}

export class AdvancedMarketAnalyzer extends EventEmitter {
  private static instance: AdvancedMarketAnalyzer;
  private readonly VOLUME_THRESHOLD = 1.5;
  private readonly LIQUIDITY_THRESHOLD = 0.8;
  private readonly VOLATILITY_WINDOW = 24; // hours
  private readonly UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private updateTimer?: ReturnType<typeof setInterval>;
  private lastConditions: MarketConditions | null = null;
  private alerts: MarketAlert[] = [];

  private constructor() {
    super();
    this.startAnalysis();
  }

  public static getInstance(): AdvancedMarketAnalyzer {
    if (!AdvancedMarketAnalyzer.instance) {
      AdvancedMarketAnalyzer.instance = new AdvancedMarketAnalyzer();
    }
    return AdvancedMarketAnalyzer.instance;
  }

  private startAnalysis(): void {
    this.updateTimer = setInterval(async () => {
      await this.updateMarketAnalysis();
    }, this.UPDATE_INTERVAL);
  }

  private async updateMarketAnalysis(): Promise<void> {
    try {
      const conditions = await this.analyzeMarketConditions();
      this.checkForChanges(conditions);
      this.lastConditions = conditions;

      // Update safety systems
      this.updateSafetySystems(conditions);

      // Emit update event
      this.emit('marketUpdate', conditions);
    } catch (error) {
      logger.error('Market analysis update failed', { error });
      this.emit('analysisError', error);
    }
  }

  private async analyzeMarketConditions(): Promise<MarketConditions> {
    const volatility = await this.analyzeVolatility();
    const trend = await this.analyzeTrend();
    const volume = await this.analyzeVolume();
    const liquidity = await this.analyzeLiquidity();

    return {
      regime: this.determineMarketRegime(volatility, trend, volume),
      volatility,
      trend,
      volume,
      liquidity
    };
  }

  private async analyzeVolatility(): Promise<number> {
    try {
      // Implementation for volatility analysis
      return 0.1; // Placeholder
    } catch (error) {
      console.error('Volatility analysis failed:', error);
      return 0; // Return safe default value
    }
  }

  private async analyzeTrend(): Promise<{ direction: string; strength: number }> {
    try {
      // Implementation for trend analysis
      return { direction: 'up', strength: 0.5 }; // Placeholder
    } catch (error) {
      console.error('Trend analysis failed:', error);
      return { direction: 'neutral', strength: 0 }; // Return safe default value
    }
  }

  private async analyzeVolume(): Promise<{ level: 'high' | 'medium' | 'low'; anomaly: boolean }> {
    // Implementation for volume analysis
    return { level: 'medium', anomaly: false }; // Placeholder
  }

  private async analyzeLiquidity(): Promise<{ score: number; sufficient: boolean }> {
    // Implementation for liquidity analysis
    return { score: 1, sufficient: true }; // Placeholder
  }

  private determineMarketRegime(
    volatility: number,
    trend: { direction: string; strength: number },
    volume: { level: string; anomaly: boolean }
  ): 'trending' | 'ranging' | 'volatile' | 'uncertain' {
    if (volatility > 0.2) return 'volatile';
    if (trend.strength > 0.7) return 'trending';
    if (trend.strength < 0.3) return 'ranging';
    return 'uncertain';
  }

  private checkForChanges(newConditions: MarketConditions): void {
    if (!this.lastConditions) return;

    // Check for regime changes
    if (newConditions.regime !== this.lastConditions.regime) {
      this.addAlert({
        type: 'warning',
        message: `Market regime changed from ${this.lastConditions.regime} to ${newConditions.regime}`,
        timestamp: Date.now()
      });
    }

    // Check for volatility spikes
    if (newConditions.volatility > this.lastConditions.volatility * 1.5) {
      this.addAlert({
        type: 'danger',
        message: 'Significant volatility increase detected',
        timestamp: Date.now(),
        data: { volatility: newConditions.volatility }
      });
    }

    // Check for liquidity issues
    if (!newConditions.liquidity.sufficient && this.lastConditions.liquidity.sufficient) {
      this.addAlert({
        type: 'danger',
        message: 'Liquidity dropped below safe threshold',
        timestamp: Date.now(),
        data: { liquidityScore: newConditions.liquidity.score }
      });
    }
  }

  private updateSafetySystems(conditions: MarketConditions): void {
    // Update performance monitoring thresholds
    performanceMonitor.adjustRiskThresholds({
      volatility: conditions.volatility,
      regime: conditions.regime
    });

    // Update safety monitor
    if (conditions.volatility > 0.3 || !conditions.liquidity.sufficient) {
      safetyMonitor.activateEmergencyStop('Adverse market conditions detected');
    }

    // Emit market conditions for other systems
    this.emit('marketConditionsUpdate', conditions);
  }

  private addAlert(alert: MarketAlert): void {
    this.alerts.push(alert);
    this.emit('alert', alert);
    logger.warn('Market alert', alert);

    // Keep only recent alerts
    const ONE_DAY = 24 * 60 * 60 * 1000;
    this.alerts = this.alerts.filter(a => Date.now() - a.timestamp < ONE_DAY);
  }

  public getMarketConditions(): MarketConditions | null {
    return this.lastConditions;
  }

  public getRecentAlerts(): MarketAlert[] {
    return [...this.alerts];
  }

  public dispose(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    this.removeAllListeners();
  }
}

export const advancedMarketAnalyzer = AdvancedMarketAnalyzer.getInstance();