import type { TradingPair, MarketData } from "@shared/schema";
import type { VolumeProfile, MarketMetrics } from "./marketTypes";
import { krakenService } from "./krakenService";
import { storage } from "../storage";
import { VolatilityAnalyzer } from "./volatilityAnalyzer";

export interface PairAnalysis {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  currentPrice: number;
  volatility: number;
  volumeScore: number;
  momentumScore: number;
  profitabilityScore: number;
  recommendedRiskPerTrade: number;
  recommendedStopLoss: number;
  recommendedTakeProfit: number;
  confidence: number;
  reasoning: string[];
}

export interface TradingRecommendations {
  topPairs: PairAnalysis[];
  optimalRiskSettings: {
    conservative: { riskPerTrade: number; stopLoss: number; takeProfit: number };
    moderate: { riskPerTrade: number; stopLoss: number; takeProfit: number };
    aggressive: { riskPerTrade: number; stopLoss: number; takeProfit: number };
  };
  marketSentiment: 'bullish' | 'bearish' | 'neutral';
  lastUpdated: number;
}

export class MarketAnalysisService {
  private cache: Map<string, { data: PairAnalysis; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private volatilityAnalyzer: VolatilityAnalyzer;
  private historicalVolatility: Map<string, { value: number; timestamp: number }> = new Map();

  constructor() {
    this.volatilityAnalyzer = new VolatilityAnalyzer();
  }

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
    const period = 14;
    const trueRange = [];
    const diPlus = [];
    const diMinus = [];
    
    for (let i = 1; i < data.length; i++) {
      const tr = Math.max(
        data[i].high - data[i].low,
        Math.abs(data[i].high - data[i - 1].close),
        Math.abs(data[i].low - data[i - 1].close)
      );
      trueRange.push(tr);
    }
    
    // Calculate DI+ and DI-
    for (let i = period - 1; i < data.length - 1; i++) {
      const sumDmPlus = dmPlus.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      const sumDmMinus = dmMinus.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      const sumTr = trueRange.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      
      diPlus.push(100 * sumDmPlus / sumTr);
      diMinus.push(100 * sumDmMinus / sumTr);
    }
    
    // Calculate ADX
    const dx = [];
    for (let i = 0; i < diPlus.length; i++) {
      const diff = Math.abs(diPlus[i] - diMinus[i]);
      const sum = diPlus[i] + diMinus[i];
      dx.push(100 * diff / sum);
    }
    
    // Final ADX is a smoothed average of DX
    const adx = dx.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    return Math.min(100, adx); // Normalize to 0-100 scale
  }

  private analyzeVolumeProfile(data: MarketData[]): VolumeProfile {
    if (data.length < 2) {
      return {
        buyVolume: 0,
        sellVolume: 0,
        volumeRatio: 1,
        largeOrders: 0
      };
    }
    
    let buyVolume = 0;
    let sellVolume = 0;
    let largeOrders = 0;
    const averageVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;
    
    for (let i = 0; i < data.length; i++) {
      const isUp = i > 0 && data[i].close > data[i - 1].close;
      const volume = data[i].volume;
      
      if (isUp) {
        buyVolume += volume;
      } else {
        sellVolume += volume;
      }
      
      if (volume > averageVolume * 2) { // Large order threshold
        largeOrders++;
      }
    }
    
    return {
      buyVolume,
      sellVolume,
      volumeRatio: buyVolume / (sellVolume || 1), // Avoid division by zero
      largeOrders
    };
  }

  private calculateMarketEfficiencyRatio(data: MarketData[]): number {
    if (data.length < 2) return 0;
    
    let directionalMovement = 0;
    let volatility = 0;
    
    for (let i = 1; i < data.length; i++) {
      const priceChange = Math.abs(data[i].close - data[i - 1].close);
      const highLowRange = data[i].high - data[i].low;
      
      directionalMovement += priceChange;
      volatility += highLowRange;
    }
    
    // MER = Directional Movement / Volatility
    // Ranges from 0 (inefficient) to 1 (efficient)
    return volatility === 0 ? 0 : directionalMovement / volatility;
  }

  private calculateOverallScore(metrics: MarketMetrics): number {
    const weights = {
      volatility: 0.2,
      riskScore: 0.15,
      trend: 0.25,
      volume: 0.15,
      mer: 0.1,
      volumeProfile: 0.15
    };
    
    // Normalize metrics to 0-100 scale
    const normalizedVolatility = 100 * (1 - metrics.volatility); // Lower volatility is better
    const normalizedRiskScore = 100 * (1 - metrics.riskScore); // Lower risk is better
    const normalizedTrend = metrics.trend; // Already 0-100
    const normalizedMER = metrics.mer * 100;
    
    // Volume score based on volume profile
    const volumeScore = 
      (metrics.volumeProfile.volumeRatio > 1 ? 100 : 50) * 0.4 + // Buy/sell ratio
      Math.min(100, (metrics.volumeProfile.largeOrders / 10) * 100) * 0.3 + // Large orders
      Math.min(100, (metrics.volume / 1000000) * 100) * 0.3; // Raw volume
    
    // Calculate final score
    const score = 
      weights.volatility * normalizedVolatility +
      weights.riskScore * normalizedRiskScore +
      weights.trend * normalizedTrend +
      weights.volume * volumeScore +
      weights.mer * normalizedMER;
    
    return Math.min(100, Math.max(0, score));
  }

  async analyzeTradingPairs(limit: number = 20): Promise<PairAnalysis[]> {
    try {
      const pairs = await krakenService.getAllTradingPairs();

      // If no pairs returned, use mock data for development
      if (!pairs || pairs.length === 0) {
        console.log("No pairs from Kraken, using mock data");
        return this.getMockAnalyses(limit);
      }

      // Get historical data for volatility analysis
      const historicalData = new Map<string, MarketData[]>();
      for (const pair of pairs) {
        const data = await krakenService.getHistoricalData(pair.symbol, "1h", 168);
        historicalData.set(pair.symbol, data);
      }

      // Calculate market scores and filter pairs
      const pairScores = await Promise.all(
        pairs.map(async pair => {
          const data = historicalData.get(pair.symbol) || [];
          const volatility = this.volatilityAnalyzer.calculateVolatilityIndex(data);
          const regime = this.volatilityAnalyzer.analyzeMarketRegime(data);
          const riskScore = this.volatilityAnalyzer.calculateRiskScore(data);
          
          // Calculate trend strength
          const trend = this.calculateTrendStrength(data);
          
          // Calculate volume profile
          const volumeProfile = this.analyzeVolumeProfile(data);
          
          // Calculate market efficiency ratio
          const mer = this.calculateMarketEfficiencyRatio(data);

          return {
            pair,
            score: this.calculateOverallScore({
              volatility,
              riskScore,
              trend,
              volume: pair.volume24h,
              mer,
              volumeProfile
            })
          };
        })
      );

      // Filter and sort pairs by score
      const majorPairs = pairScores
        .filter(({ score }) => score > 60) // Minimum score threshold
        .sort((a, b) => b.score - a.score)
        .map(({ pair }) => pair)
        .slice(0, limit);

      const analyses: PairAnalysis[] = [];

      for (const pair of majorPairs) {
        try {
          const analysis = await this.analyzePair(pair);
          if (analysis) {
            analyses.push(analysis);
          }
        } catch (error) {
          console.error(`Error analyzing pair ${pair.symbol}:`, error);
          // Continue with other pairs
        }
      }

      // If no analyses were successful, use mock data
      if (analyses.length === 0) {
        console.log("No successful analyses, using mock data");
        return this.getMockAnalyses(limit);
      }

      // Sort by profitability score
      return analyses.sort((a, b) => b.profitabilityScore - a.profitabilityScore);
    } catch (error) {
      console.error("Error analyzing trading pairs:", error);
      // Return mock data as fallback
      return this.getMockAnalyses(limit);
    }
  }

  private async analyzePair(pair: TradingPair): Promise<PairAnalysis | null> {
    try {
      // Check cache first
      const cacheKey = pair.symbol;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.data;
      }

      // Get historical data for analysis
      const ohlcv = await krakenService.getOHLCV(pair.symbol, "1h", 168); // 7 days of hourly data
      if (ohlcv.length < 24) {
        return null;
      }

      // Calculate volatility (standard deviation of returns)
      const returns = [];
      for (let i = 1; i < ohlcv.length; i++) {
        const prevClose = ohlcv[i - 1][4];
        const currentClose = ohlcv[i][4];
        returns.push((currentClose - prevClose) / prevClose);
      }

      const volatility = this.calculateStandardDeviation(returns);

      // Calculate momentum score (recent trend strength)
      const recentPrices = ohlcv.slice(-24).map(d => d[4]); // Last 24 hours
      const momentumScore = this.calculateMomentumScore(recentPrices);

      // Calculate volume score (relative to historical average)
      const volumes = ohlcv.map(d => d[5]);
      const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
      const recentVolume = volumes.slice(-24).reduce((sum, vol) => sum + vol, 0) / 24;
      const volumeScore = Math.min(recentVolume / avgVolume, 3); // Cap at 3x

      // Calculate profitability score (combination of factors)
      const profitabilityScore = this.calculateProfitabilityScore(volatility, momentumScore, volumeScore);

      // Calculate optimal parameters
      const { riskPerTrade, stopLoss, takeProfit } = this.calculateOptimalParameters(volatility, momentumScore);

      // Generate reasoning
      const reasoning = this.generateReasoning(volatility, momentumScore, volumeScore, profitabilityScore);

      const analysis: PairAnalysis = {
        symbol: pair.symbol,
        baseAsset: pair.baseAsset,
        quoteAsset: pair.quoteAsset,
        currentPrice: pair.currentPrice,
        volatility,
        volumeScore,
        momentumScore,
        profitabilityScore,
        recommendedRiskPerTrade: riskPerTrade,
        recommendedStopLoss: stopLoss,
        recommendedTakeProfit: takeProfit,
        confidence: Math.min(profitabilityScore / 10, 1), // Scale to 0-1
        reasoning,
      };

      // Cache the result
      this.cache.set(cacheKey, { data: analysis, timestamp: Date.now() });

      return analysis;
    } catch (error) {
      console.error(`Error analyzing pair ${pair.symbol}:`, error);
      return null;
    }
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateMomentumScore(prices: number[]): number {
    if (prices.length < 2) return 0;

    const shortTerm = (prices[prices.length - 1] - prices[prices.length - 5]) / prices[prices.length - 5];
    const longTerm = (prices[prices.length - 1] - prices[0]) / prices[0];

    // Weighted combination favoring recent momentum
    return (shortTerm * 0.7 + longTerm * 0.3) * 100;
  }

  private calculateProfitabilityScore(volatility: number, momentumScore: number, volumeScore: number): number {
    // Normalize and combine factors
    const normalizedVolatility = Math.min(volatility * 100, 10); // Cap at 10
    const normalizedMomentum = Math.abs(momentumScore); // Absolute value for trend strength
    const normalizedVolume = Math.min(volumeScore, 2); // Cap at 2

    // Higher score for moderate volatility, strong momentum, and good volume
    const volatilityScore = Math.max(0, 10 - normalizedVolatility * 2);
    const momentumScoreWeighted = normalizedMomentum * 2;
    const volumeScoreWeighted = normalizedVolume * 3;

    return volatilityScore + momentumScoreWeighted + volumeScoreWeighted;
  }

  private calculateOptimalParameters(volatility: number, momentumScore: number): {
    riskPerTrade: number;
    stopLoss: number;
    takeProfit: number;
  } {
    // Base parameters on volatility and momentum
    const baseVolatility = volatility * 100; // Convert to percentage

    // Risk per trade: lower for high volatility
    const riskPerTrade = Math.max(0.5, Math.min(5, 10 - baseVolatility));

    // Stop loss: wider for volatile pairs
    const stopLoss = Math.max(1, Math.min(10, baseVolatility * 2));

    // Take profit: higher for strong momentum
    const momentumMultiplier = Math.abs(momentumScore) / 10;
    const takeProfit = Math.max(2, Math.min(20, stopLoss * (1 + momentumMultiplier * 2)));

    return {
      riskPerTrade: Math.round(riskPerTrade * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
    };
  }

  private generateReasoning(volatility: number, momentumScore: number, volumeScore: number, profitabilityScore: number): string[] {
    const reasoning: string[] = [];

    const volPercent = (volatility * 100).toFixed(2);
    if (volatility < 0.02) {
      reasoning.push(`Low volatility (${volPercent}%) suggests stable, lower-risk trading`);
    } else if (volatility < 0.05) {
      reasoning.push(`Moderate volatility (${volPercent}%) offers good risk-reward balance`);
    } else {
      reasoning.push(`High volatility (${volPercent}%) indicates potential for larger moves but higher risk`);
    }

    if (Math.abs(momentumScore) > 5) {
      reasoning.push(`Strong ${momentumScore > 0 ? 'upward' : 'downward'} momentum (${momentumScore.toFixed(2)}%) favors trend-following strategies`);
    } else {
      reasoning.push(`Weak momentum suggests ranging market conditions`);
    }

    if (volumeScore > 1.5) {
      reasoning.push(`High trading volume (${(volumeScore * 100).toFixed(0)}% above average) indicates strong market interest`);
    } else if (volumeScore < 0.8) {
      reasoning.push(`Low trading volume may lead to slippage and wider spreads`);
    }

    if (profitabilityScore > 15) {
      reasoning.push(`High profitability score (${profitabilityScore.toFixed(1)}) suggests excellent trading potential`);
    } else if (profitabilityScore > 10) {
      reasoning.push(`Good profitability score (${profitabilityScore.toFixed(1)}) indicates solid trading opportunity`);
    }

    return reasoning;
  }

  async getTradingRecommendations(): Promise<TradingRecommendations> {
    const topPairs = await this.analyzeTradingPairs(10);

    // Calculate market sentiment based on average momentum
    const avgMomentum = topPairs.reduce((sum, pair) => sum + pair.momentumScore, 0) / topPairs.length;
    const marketSentiment = avgMomentum > 2 ? 'bullish' : avgMomentum < -2 ? 'bearish' : 'neutral';

    // Calculate optimal risk settings based on market conditions
    const avgVolatility = topPairs.reduce((sum, pair) => sum + pair.volatility, 0) / topPairs.length;
    const volatilityMultiplier = avgVolatility * 100;

    const optimalRiskSettings = {
      conservative: {
        riskPerTrade: Math.max(0.5, 2 - volatilityMultiplier * 0.1),
        stopLoss: Math.min(5, 2 + volatilityMultiplier * 0.2),
        takeProfit: Math.max(3, 5 + volatilityMultiplier * 0.1),
      },
      moderate: {
        riskPerTrade: Math.max(1, 3 - volatilityMultiplier * 0.1),
        stopLoss: Math.min(8, 3 + volatilityMultiplier * 0.2),
        takeProfit: Math.max(5, 8 + volatilityMultiplier * 0.1),
      },
      aggressive: {
        riskPerTrade: Math.max(2, 5 - volatilityMultiplier * 0.1),
        stopLoss: Math.min(12, 5 + volatilityMultiplier * 0.2),
        takeProfit: Math.max(8, 12 + volatilityMultiplier * 0.1),
      },
    };

    return {
      topPairs,
      optimalRiskSettings,
      marketSentiment,
      lastUpdated: Date.now(),
    };
  }

  async getPairRecommendation(pair: string): Promise<PairAnalysis | null> {
    try {
      const pairs = await krakenService.getAllTradingPairs();
      const pairData = pairs.find(p => p.symbol === pair);

      if (!pairData) {
        // Return mock data for development if pair not found
        return this.getMockPairAnalysis(pair);
      }

      const analysis = await this.analyzePair(pairData);
      if (!analysis) {
        // Fallback to mock data
        return this.getMockPairAnalysis(pair);
      }

      return analysis;
    } catch (error) {
      console.error(`Error getting recommendation for ${pair}:`, error);
      // Return mock data as fallback
      return this.getMockPairAnalysis(pair);
    }
  }

  private getMockAnalyses(limit: number): PairAnalysis[] {
    const mockPairs = [
      { symbol: "BTC/USD", baseAsset: "BTC", quoteAsset: "USD", currentPrice: 45000 },
      { symbol: "ETH/USD", baseAsset: "ETH", quoteAsset: "USD", currentPrice: 3000 },
      { symbol: "SOL/USD", baseAsset: "SOL", quoteAsset: "USD", currentPrice: 100 },
      { symbol: "ADA/USD", baseAsset: "ADA", quoteAsset: "USD", currentPrice: 0.5 },
      { symbol: "DOT/USD", baseAsset: "DOT", quoteAsset: "USD", currentPrice: 8 },
    ];

    return mockPairs.slice(0, limit).map(pair => this.getMockPairAnalysis(pair.symbol)!);
  }

  private getMockPairAnalysis(pair: string): PairAnalysis | null {
    const mockData: Record<string, PairAnalysis> = {
      "BTC/USD": {
        symbol: "BTC/USD",
        baseAsset: "BTC",
        quoteAsset: "USD",
        currentPrice: 45000,
        volatility: 0.025,
        volumeScore: 1.8,
        momentumScore: 3.2,
        profitabilityScore: 16.5,
        recommendedRiskPerTrade: 1.5,
        recommendedStopLoss: 2.5,
        recommendedTakeProfit: 7.5,
        confidence: 0.85,
        reasoning: [
          "Moderate volatility (2.50%) offers good risk-reward balance",
          "Strong upward momentum (3.20%) favors trend-following strategies",
          "High trading volume (180% above average) indicates strong market interest",
          "High profitability score (16.5) suggests excellent trading potential"
        ]
      },
      "ETH/USD": {
        symbol: "ETH/USD",
        baseAsset: "ETH",
        quoteAsset: "USD",
        currentPrice: 3000,
        volatility: 0.032,
        volumeScore: 1.6,
        momentumScore: 2.8,
        profitabilityScore: 14.2,
        recommendedRiskPerTrade: 1.2,
        recommendedStopLoss: 3.2,
        recommendedTakeProfit: 8.2,
        confidence: 0.78,
        reasoning: [
          "Moderate volatility (3.20%) offers good risk-reward balance",
          "Strong upward momentum (2.80%) favors trend-following strategies",
          "High trading volume (160% above average) indicates strong market interest",
          "Good profitability score (14.2) indicates solid trading opportunity"
        ]
      },
      "SOL/USD": {
        symbol: "SOL/USD",
        baseAsset: "SOL",
        quoteAsset: "USD",
        currentPrice: 100,
        volatility: 0.045,
        volumeScore: 2.1,
        momentumScore: 4.5,
        profitabilityScore: 18.3,
        recommendedRiskPerTrade: 1.8,
        recommendedStopLoss: 4.5,
        recommendedTakeProfit: 12.5,
        confidence: 0.92,
        reasoning: [
          "Moderate volatility (4.50%) offers good risk-reward balance",
          "Strong upward momentum (4.50%) favors trend-following strategies",
          "High trading volume (210% above average) indicates strong market interest",
          "High profitability score (18.3) suggests excellent trading potential"
        ]
      },
      "ADA/USD": {
        symbol: "ADA/USD",
        baseAsset: "ADA",
        quoteAsset: "USD",
        currentPrice: 0.5,
        volatility: 0.038,
        volumeScore: 1.4,
        momentumScore: 1.8,
        profitabilityScore: 12.1,
        recommendedRiskPerTrade: 1.0,
        recommendedStopLoss: 3.8,
        recommendedTakeProfit: 9.8,
        confidence: 0.68,
        reasoning: [
          "Moderate volatility (3.80%) offers good risk-reward balance",
          "Moderate upward momentum (1.80%) favors trend-following strategies",
          "Good trading volume (140% above average) indicates market interest",
          "Good profitability score (12.1) indicates solid trading opportunity"
        ]
      },
      "DOT/USD": {
        symbol: "DOT/USD",
        baseAsset: "DOT",
        quoteAsset: "USD",
        currentPrice: 8,
        volatility: 0.042,
        volumeScore: 1.7,
        momentumScore: 2.2,
        profitabilityScore: 13.8,
        recommendedRiskPerTrade: 1.3,
        recommendedStopLoss: 4.2,
        recommendedTakeProfit: 10.2,
        confidence: 0.74,
        reasoning: [
          "Moderate volatility (4.20%) offers good risk-reward balance",
          "Moderate upward momentum (2.20%) favors trend-following strategies",
          "High trading volume (170% above average) indicates strong market interest",
          "Good profitability score (13.8) indicates solid trading opportunity"
        ]
      }
    };

    return mockData[pair] || null;
  }
}

export const marketAnalysisService = new MarketAnalysisService();
