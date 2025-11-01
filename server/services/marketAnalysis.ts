import type { MarketData } from '@shared/schema';

interface VolumeProfile {
  buyVolume: number;
  sellVolume: number;
  volumeRatio: number;
  largeOrders: number;
}

interface MarketMetrics {
  volatility: number;
  riskScore: number;
  trend: number;
  volume: number;
  mer: number;
  volumeProfile: VolumeProfile;
}

export class MarketAnalysisService {
  private calculateTrendStrength(data: MarketData[]): number {
    if (data.length < 2) return 0;
    
    // Calculate directional movement
    const dmPlus = [];
    const dmMinus = [];
    
    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevHigh = data[i - 1].high;
      const prevLow = data[i - 1].low;
      
      const upMove = high - prevHigh;
      const downMove = prevLow - low;
      
      if (upMove > downMove && upMove > 0) {
        dmPlus.push(upMove);
        dmMinus.push(0);
      } else if (downMove > upMove && downMove > 0) {
        dmPlus.push(0);
        dmMinus.push(downMove);
      } else {
        dmPlus.push(0);
        dmMinus.push(0);
      }
    }
    
    // Calculate ADX
    const smoothedDmPlus = this.smoothSeries(dmPlus, 14);
    const smoothedDmMinus = this.smoothSeries(dmMinus, 14);
    const adx = (smoothedDmPlus - smoothedDmMinus) / (smoothedDmPlus + smoothedDmMinus);
    
    return Math.abs(adx);
  }
  
  private analyzeVolumeProfile(data: MarketData[]): VolumeProfile {
    let buyVolume = 0;
    let sellVolume = 0;
    let largeOrders = 0;
    const averageVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;
    
    data.forEach(candle => {
      const isUp = candle.close > candle.open;
      if (isUp) {
        buyVolume += candle.volume;
      } else {
        sellVolume += candle.volume;
      }
      
      if (candle.volume > averageVolume * 2) {
        largeOrders++;
      }
    });
    
    return {
      buyVolume,
      sellVolume,
      volumeRatio: buyVolume / (sellVolume || 1),
      largeOrders
    };
  }
  
  private calculateMarketEfficiencyRatio(data: MarketData[]): number {
    if (data.length < 2) return 0;
    
    let directionalMove = 0;
    let totalMove = 0;
    
    for (let i = 1; i < data.length; i++) {
      const directional = Math.abs(data[i].close - data[i-1].close);
      const total = Math.abs(data[i].high - data[i].low);
      
      directionalMove += directional;
      totalMove += total;
    }
    
    return directionalMove / (totalMove || 1);
  }
  
  private calculateOverallScore(metrics: MarketMetrics): number {
    const weights = {
      volatility: 0.2,
      riskScore: 0.2,
      trend: 0.2,
      volume: 0.15,
      mer: 0.15,
      volumeProfile: 0.1
    };
    
    // Normalize metrics to 0-100 scale
    const normalizedVolatility = 100 - (metrics.volatility * 100); // Lower volatility is better
    const normalizedRiskScore = 100 - metrics.riskScore; // Lower risk is better
    const normalizedTrend = metrics.trend * 100;
    const normalizedVolume = Math.min(100, (metrics.volume / 1000000)); // Cap at 1M volume
    const normalizedMER = metrics.mer * 100;
    const normalizedVolumeProfile = (
      (metrics.volumeProfile.volumeRatio > 1 ? 100 : 50) + 
      (metrics.volumeProfile.largeOrders * 10)
    ) / 2;
    
    return (
      normalizedVolatility * weights.volatility +
      normalizedRiskScore * weights.riskScore +
      normalizedTrend * weights.trend +
      normalizedVolume * weights.volume +
      normalizedMER * weights.mer +
      normalizedVolumeProfile * weights.volumeProfile
    );
  }
  
  private smoothSeries(data: number[], period: number): number {
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[data.length - 1 - i];
    }
    return sum / period;
  }
}