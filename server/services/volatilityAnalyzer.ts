import type { MarketData } from "@shared/schema";

export class VolatilityAnalyzer {
  // Calculate Average True Range (ATR) for volatility measurement
  calculateATR(data: MarketData[], period: number = 14): number {
    if (data.length < period) return 0;
    
    const trueRanges: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevClose = data[i - 1].close;
      
      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    // Calculate ATR using Wilder's smoothing
    let atr = trueRanges.slice(0, period).reduce((a, b) => a + b) / period;
    for (let i = period; i < trueRanges.length; i++) {
      atr = ((atr * (period - 1)) + trueRanges[i]) / period;
    }
    
    return atr;
  }

  // Calculate Volatility Index
  calculateVolatilityIndex(data: MarketData[], period: number = 20): number {
    if (data.length < period) return 0;
    
    const returns = [];
    for (let i = 1; i < data.length; i++) {
      returns.push((data[i].close - data[i-1].close) / data[i-1].close);
    }
    
    const mean = returns.reduce((a, b) => a + b) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance * 252); // Annualized volatility
  }

  // Calculate Risk-Adjusted Position Size
  calculateVolatilityAdjustedSize(
    baseSize: number,
    currentVolatility: number,
    averageVolatility: number,
    maxVolatilityIncrease: number = 2
  ): number {
    const volatilityRatio = averageVolatility / currentVolatility;
    const adjustmentFactor = Math.min(Math.max(volatilityRatio, 1/maxVolatilityIncrease), maxVolatilityIncrease);
    
    return baseSize * adjustmentFactor;
  }

  // Calculate Market Regime
  analyzeMarketRegime(data: MarketData[]): 'low_volatility' | 'normal' | 'high_volatility' {
    const volatility = this.calculateVolatilityIndex(data);
    
    if (volatility < 0.15) return 'low_volatility';
    if (volatility > 0.35) return 'high_volatility';
    return 'normal';
  }

  // Calculate Risk Score (0-100)
  calculateRiskScore(data: MarketData[]): number {
    const volatility = this.calculateVolatilityIndex(data);
    const atr = this.calculateATR(data);
    const regime = this.analyzeMarketRegime(data);
    
    // Normalize volatility to 0-100 scale
    const volatilityScore = Math.min(100, (volatility * 100) / 0.5);
    
    // Adjust based on market regime
    const regimeMultiplier = 
      regime === 'high_volatility' ? 1.2 :
      regime === 'low_volatility' ? 0.8 : 1;
    
    return Math.min(100, volatilityScore * regimeMultiplier);
  }
}