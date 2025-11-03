import { MarketData, Trade, Portfolio, PerformanceMetrics } from '@shared/schema';
import logger from './logger';
import { cacheService, CacheKeyBuilder } from './cacheService';

// 市场分析结果接口
export interface MarketAnalysisResult {
  pair: string;
  timestamp: number;
  trend: {
    direction: 'bullish' | 'bearish' | 'sideways';
    strength: number; // 0-1
    duration: number; // 预期持续时间（小时）
  };
  volatility: {
    current: number; // 当前波动率
    average: number; // 平均波动率
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  support: {
    level: number;
    strength: number; // 0-1
  };
  resistance: {
    level: number;
    strength: number; // 0-1
  };
  volume: {
    current: number;
    average: number;
    ratio: number; // 当前/平均
  };
  indicators: {
    rsi: number;
    macd: {
      value: number;
      signal: number;
      histogram: number;
    };
    bollinger: {
      upper: number;
      middle: number;
      lower: number;
      position: 'above' | 'below' | 'inside';
    };
  };
  prediction: {
    direction: 'buy' | 'sell' | 'hold';
    confidence: number; // 0-1
    timeframe: 'short' | 'medium' | 'long';
    reasoning: string[];
  };
}

// 投资组合分析结果接口
export interface PortfolioAnalysisResult {
  timestamp: number;
  totalValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  dailyReturn: number;
  dailyReturnPercent: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  var: {
    daily95: number; // 95%每日VaR
    daily99: number; // 99%每日VaR
  };
  correlationMatrix: Record<string, Record<string, number>>;
  riskContribution: Record<string, number>; // 每个资产的风险贡献
  performanceAttribution: {
    assetAllocation: number;
    securitySelection: number;
    interaction: number;
  };
  diversificationRatio: number;
  efficientFrontier: {
    lowRisk: { risk: number; return: number };
    mediumRisk: { risk: number; return: number };
    highRisk: { risk: number; return: number };
  };
}

// 交易分析结果接口
export interface TradeAnalysisResult {
  timestamp: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  expectancy: number;
  largestWin: number;
  largestLoss: number;
  averageTradeDuration: number; // 小时
  averageWinDuration: number; // 小时
  averageLossDuration: number; // 小时
  consecutiveWins: number;
  consecutiveLosses: number;
  monthlyReturns: Record<string, number>;
  tradeDistribution: {
    timeOfDay: Record<string, number>; // 按小时分布
    dayOfWeek: Record<string, number>; // 按星期分布
  };
  performanceByPair: Record<string, {
    trades: number;
    winRate: number;
    profit: number;
    profitPercent: number;
  }>;
}

// 高级分析引擎类
export class AdvancedAnalyticsEngine {
  // 分析市场数据
  static async analyzeMarket(pair: string, data: MarketData[]): Promise<MarketAnalysisResult | null> {
    try {
      if (data.length < 50) {
        logger.warn('市场分析数据不足', { pair, dataLength: data.length });
        return null;
      }

      // 检查缓存
      const cacheKey = CacheKeyBuilder.marketData(pair, 'analysis');
      const cached = await cacheService.get<MarketAnalysisResult>(cacheKey);
      if (cached) {
        return cached;
      }

      // 计算趋势
      const trend = this.calculateTrend(data);

      // 计算波动率
      const volatility = this.calculateVolatility(data);

      // 计算支撑和阻力位
      const support = this.calculateSupport(data);
      const resistance = this.calculateResistance(data);

      // 计算成交量指标
      const volume = this.calculateVolumeMetrics(data);

      // 计算技术指标
      const indicators = this.calculateIndicators(data);

      // 生成预测
      const prediction = this.generatePrediction(trend, volatility, indicators);

      const result: MarketAnalysisResult = {
        pair,
        timestamp: Date.now(),
        trend,
        volatility,
        support,
        resistance,
        volume,
        indicators,
        prediction
      };

      // 缓存结果
      await cacheService.set(cacheKey, result, 300); // 缓存5分钟

      return result;
    } catch (error) {
      logger.error('市场分析失败', {
        error: error instanceof Error ? error.message : String(error),
        pair
      });
      return null;
    }
  }

  // 分析投资组合
  static async analyzePortfolio(portfolio: Portfolio, trades: Trade[]): Promise<PortfolioAnalysisResult | null> {
    try {
      if (!portfolio.positions || Object.keys(portfolio.positions).length === 0) {
        logger.warn('投资组合为空');
        return null;
      }

      // 检查缓存
      const cacheKey = CacheKeyBuilder.portfolio('analysis');
      const cached = await cacheService.get<PortfolioAnalysisResult>(cacheKey);
      if (cached) {
        return cached;
      }

      // 计算基本指标
      const totalValue = portfolio.totalBalance;
      const totalReturn = portfolio.profitLossTotal;
      const totalReturnPercent = (totalReturn / (totalValue - totalReturn)) * 100;

      // 计算每日收益率
      const dailyReturns = this.calculateDailyReturns(trades);
      const dailyReturn = dailyReturns.length > 0 ? dailyReturns[dailyReturns.length - 1] : 0;
      const dailyReturnPercent = dailyReturn * 100;

      // 计算波动率
      const volatility = this.calculateReturnsVolatility(dailyReturns);

      // 计算夏普比率
      const sharpeRatio = this.calculateSharpeRatio(dailyReturns);

      // 计算最大回撤
      const maxDrawdown = this.calculateMaxDrawdown(trades);
      const maxDrawdownPercent = (maxDrawdown / totalValue) * 100;

      // 计算VaR
      const var95 = this.calculateVaR(dailyReturns, 0.95);
      const var99 = this.calculateVaR(dailyReturns, 0.99);

      // 计算相关性矩阵
      const correlationMatrix = this.calculateCorrelationMatrix(portfolio, trades);

      // 计算风险贡献
      const riskContribution = this.calculateRiskContribution(portfolio, correlationMatrix);

      // 计算绩效归因
      const performanceAttribution = this.calculatePerformanceAttribution(portfolio, trades);

      // 计算多样化比率
      const diversificationRatio = this.calculateDiversificationRatio(correlationMatrix);

      // 计算有效前沿
      const efficientFrontier = this.calculateEfficientFrontier(portfolio, trades);

      const result: PortfolioAnalysisResult = {
        timestamp: Date.now(),
        totalValue,
        totalReturn,
        totalReturnPercent,
        dailyReturn,
        dailyReturnPercent,
        volatility,
        sharpeRatio,
        maxDrawdown,
        maxDrawdownPercent,
        var: {
          daily95: var95,
          daily99: var99
        },
        correlationMatrix,
        riskContribution,
        performanceAttribution,
        diversificationRatio,
        efficientFrontier
      };

      // 缓存结果
      await cacheService.set(cacheKey, result, 600); // 缓存10分钟

      return result;
    } catch (error) {
      logger.error('投资组合分析失败', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  // 分析交易
  static async analyzeTrades(trades: Trade[]): Promise<TradeAnalysisResult | null> {
    try {
      if (trades.length === 0) {
        logger.warn('没有交易数据可分析');
        return null;
      }

      // 检查缓存
      const cacheKey = CacheKeyBuilder.backtestResults('analysis');
      const cached = await cacheService.get<TradeAnalysisResult>(cacheKey);
      if (cached) {
        return cached;
      }

      // 计算基本统计
      const totalTrades = trades.length;
      const winningTrades = trades.filter(t => t.side === 'sell' && t.total > 0).length;
      const losingTrades = totalTrades - winningTrades;
      const winRate = (winningTrades / totalTrades) * 100;

      // 计算平均盈亏
      const profits = trades.filter(t => t.side === 'sell' && t.total > 0).map(t => t.total);
      const losses = trades.filter(t => t.side === 'sell' && t.total < 0).map(t => Math.abs(t.total));

      const averageWin = profits.length > 0 ? profits.reduce((sum, p) => sum + p, 0) / profits.length : 0;
      const averageLoss = losses.length > 0 ? losses.reduce((sum, l) => sum + l, 0) / losses.length : 0;

      // 计算盈利因子和期望值
      const profitFactor = losses.length > 0 ? profits.reduce((sum, p) => sum + p, 0) / losses.reduce((sum, l) => sum + l, 0) : 0;
      const expectancy = (winRate / 100 * averageWin) - ((100 - winRate) / 100 * averageLoss);

      // 计算最大盈亏
      const largestWin = profits.length > 0 ? Math.max(...profits) : 0;
      const largestLoss = losses.length > 0 ? Math.max(...losses) : 0;

      // 计算平均持仓时间
      const tradeDurations = this.calculateTradeDurations(trades);
      const averageTradeDuration = tradeDurations.reduce((sum, d) => sum + d, 0) / tradeDurations.length;

      const winDurations = trades.filter(t => t.side === 'sell' && t.total > 0).map(t => this.getTradeDuration(t));
      const averageWinDuration = winDurations.length > 0 ? winDurations.reduce((sum, d) => sum + d, 0) / winDurations.length : 0;

      const lossDurations = trades.filter(t => t.side === 'sell' && t.total < 0).map(t => this.getTradeDuration(t));
      const averageLossDuration = lossDurations.length > 0 ? lossDurations.reduce((sum, d) => sum + d, 0) / lossDurations.length : 0;

      // 计算连续盈亏
      const consecutiveStats = this.calculateConsecutiveStats(trades);

      // 计算月度收益
      const monthlyReturns = this.calculateMonthlyReturns(trades);

      // 计算交易分布
      const tradeDistribution = this.calculateTradeDistribution(trades);

      // 计算按交易对的绩效
      const performanceByPair = this.calculatePerformanceByPair(trades);

      const result: TradeAnalysisResult = {
        timestamp: Date.now(),
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        averageWin,
        averageLoss,
        profitFactor,
        expectancy,
        largestWin,
        largestLoss,
        averageTradeDuration,
        averageWinDuration,
        averageLossDuration,
        consecutiveWins: consecutiveStats.wins,
        consecutiveLosses: consecutiveStats.losses,
        monthlyReturns,
        tradeDistribution,
        performanceByPair
      };

      // 缓存结果
      await cacheService.set(cacheKey, result, 1800); // 缓存30分钟

      return result;
    } catch (error) {
      logger.error('交易分析失败', {
        error: error instanceof Error ? error.message : String(error),
        tradesCount: trades.length
      });
      return null;
    }
  }

  // 计算趋势
  private static calculateTrend(data: MarketData[]): MarketAnalysisResult['trend'] {
    // 使用线性回归计算趋势
    const n = data.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const yValues = data.map(d => d.close);

    // 计算线性回归系数
    const sumX = xValues.reduce((sum, x) => sum + x, 0);
    const sumY = yValues.reduce((sum, y) => sum + y, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // 计算趋势方向和强度
    let direction: 'bullish' | 'bearish' | 'sideways';
    let strength: number;

    if (slope > 0.001) {
      direction = 'bullish';
      strength = Math.min(slope * 100, 1);
    } else if (slope < -0.001) {
      direction = 'bearish';
      strength = Math.min(Math.abs(slope) * 100, 1);
    } else {
      direction = 'sideways';
      strength = 0.1;
    }

    // 预期持续时间（基于趋势强度）
    const duration = strength * 24; // 小时

    return { direction, strength, duration };
  }

  // 计算波动率
  private static calculateVolatility(data: MarketData[]): MarketAnalysisResult['volatility'] {
    // 计算日收益率
    const returns = [];
    for (let i = 1; i < data.length; i++) {
      returns.push((data[i].close - data[i - 1].close) / data[i - 1].close);
    }

    // 计算当前波动率（最近20天的标准差）
    const recentReturns = returns.slice(-20);
    const current = Math.sqrt(recentReturns.reduce((sum, r) => sum + r * r, 0) / recentReturns.length);

    // 计算平均波动率
    const average = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length);

    // 计算波动率趋势
    let trend: 'increasing' | 'decreasing' | 'stable';
    const recentVolatility = Math.sqrt(recentReturns.reduce((sum, r) => sum + r * r, 0) / recentReturns.length);
    const olderVolatility = Math.sqrt(returns.slice(-40, -20).reduce((sum, r) => sum + r * r, 0) / 20);

    if (recentVolatility > olderVolatility * 1.1) {
      trend = 'increasing';
    } else if (recentVolatility < olderVolatility * 0.9) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    return { current, average, trend };
  }

  // 计算支撑位
  private static calculateSupport(data: MarketData[]): MarketAnalysisResult['support'] {
    // 使用最近50个数据点计算支撑位
    const recentData = data.slice(-50);

    // 找出局部最小值
    const localMinima = [];
    for (let i = 1; i < recentData.length - 1; i++) {
      if (recentData[i].low < recentData[i - 1].low && recentData[i].low < recentData[i + 1].low) {
        localMinima.push(recentData[i].low);
      }
    }

    // 找出最接近当前价格的支撑位
    const currentPrice = recentData[recentData.length - 1].close;
    const validSupports = localMinima.filter(min => min < currentPrice);

    if (validSupports.length === 0) {
      return { level: currentPrice * 0.95, strength: 0.3 };
    }

    // 计算支撑位强度（基于触及次数）
    const supportLevel = validSupports.reduce((sum, level) => sum + level, 0) / validSupports.length;
    const touches = validSupports.filter(level => Math.abs(level - supportLevel) / supportLevel < 0.01).length;
    const strength = Math.min(touches / validSupports.length, 1);

    return { level: supportLevel, strength };
  }

  // 计算阻力位
  private static calculateResistance(data: MarketData[]): MarketAnalysisResult['resistance'] {
    // 使用最近50个数据点计算阻力位
    const recentData = data.slice(-50);

    // 找出局部最大值
    const localMaxima = [];
    for (let i = 1; i < recentData.length - 1; i++) {
      if (recentData[i].high > recentData[i - 1].high && recentData[i].high > recentData[i + 1].high) {
        localMaxima.push(recentData[i].high);
      }
    }

    // 找出最接近当前价格的阻力位
    const currentPrice = recentData[recentData.length - 1].close;
    const validResistances = localMaxima.filter(max => max > currentPrice);

    if (validResistances.length === 0) {
      return { level: currentPrice * 1.05, strength: 0.3 };
    }

    // 计算阻力位强度（基于触及次数）
    const resistanceLevel = validResistances.reduce((sum, level) => sum + level, 0) / validResistances.length;
    const touches = validResistances.filter(level => Math.abs(level - resistanceLevel) / resistanceLevel < 0.01).length;
    const strength = Math.min(touches / validResistances.length, 1);

    return { level: resistanceLevel, strength };
  }

  // 计算成交量指标
  private static calculateVolumeMetrics(data: MarketData[]): MarketAnalysisResult['volume'] {
    const current = data[data.length - 1].volume;
    const average = data.reduce((sum, d) => sum + d.volume, 0) / data.length;
    const ratio = current / average;

    return { current, average, ratio };
  }

  // 计算技术指标
  private static calculateIndicators(data: MarketData[]): MarketAnalysisResult['indicators'] {
    // 计算RSI
    const rsi = this.calculateRSI(data);

    // 计算MACD
    const macd = this.calculateMACD(data);

    // 计算布林带
    const bollinger = this.calculateBollingerBands(data);

    return { rsi, macd, bollinger };
  }

  // 生成预测
  private static generatePrediction(
    trend: MarketAnalysisResult['trend'],
    volatility: MarketAnalysisResult['volatility'],
    indicators: MarketAnalysisResult['indicators']
  ): MarketAnalysisResult['prediction'] {
    const reasoning: string[] = [];
    let direction: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 0.5;
    let timeframe: 'short' | 'medium' | 'long' = 'medium';

    // 基于趋势的预测
    if (trend.direction === 'bullish' && trend.strength > 0.6) {
      direction = 'buy';
      confidence += 0.2;
      reasoning.push(`强上升趋势 (${(trend.strength * 100).toFixed(1)}%)`);
      timeframe = trend.duration > 12 ? 'long' : 'medium';
    } else if (trend.direction === 'bearish' && trend.strength > 0.6) {
      direction = 'sell';
      confidence += 0.2;
      reasoning.push(`强下降趋势 (${(trend.strength * 100).toFixed(1)}%)`);
      timeframe = trend.duration > 12 ? 'long' : 'medium';
    }

    // 基于RSI的预测
    if (indicators.rsi < 30) {
      if (direction !== 'buy') {
        direction = 'buy';
        confidence = 0.6;
      } else {
        confidence += 0.1;
      }
      reasoning.push(`RSI超卖 (${indicators.rsi.toFixed(1)})`);
    } else if (indicators.rsi > 70) {
      if (direction !== 'sell') {
        direction = 'sell';
        confidence = 0.6;
      } else {
        confidence += 0.1;
      }
      reasoning.push(`RSI超买 (${indicators.rsi.toFixed(1)})`);
    }

    // 基于MACD的预测
    if (indicators.macd.histogram > 0 && indicators.macd.value > indicators.macd.signal) {
      if (direction !== 'buy') {
        direction = 'buy';
        confidence = 0.55;
      } else {
        confidence += 0.1;
      }
      reasoning.push('MACD看涨信号');
    } else if (indicators.macd.histogram < 0 && indicators.macd.value < indicators.macd.signal) {
      if (direction !== 'sell') {
        direction = 'sell';
        confidence = 0.55;
      } else {
        confidence += 0.1;
      }
      reasoning.push('MACD看跌信号');
    }

    // 基于布林带的预测
    if (indicators.bollinger.position === 'below') {
      if (direction !== 'buy') {
        direction = 'buy';
        confidence = 0.5;
      } else {
        confidence += 0.05;
      }
      reasoning.push('价格低于布林带下轨');
    } else if (indicators.bollinger.position === 'above') {
      if (direction !== 'sell') {
        direction = 'sell';
        confidence = 0.5;
      } else {
        confidence += 0.05;
      }
      reasoning.push('价格高于布林带上轨');
    }

    // 基于波动率的调整
    if (volatility.trend === 'increasing') {
      confidence = Math.max(confidence - 0.1, 0.3);
      reasoning.push('高波动率降低预测置信度');
    }

    // 确保置信度在合理范围内
    confidence = Math.min(Math.max(confidence, 0.3), 0.9);

    return {
      direction,
      confidence,
      timeframe,
      reasoning
    };
  }

  // 计算RSI
  private static calculateRSI(data: MarketData[], period: number = 14): number {
    if (data.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = data.length - period; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  // 计算MACD
  private static calculateMACD(data: MarketData[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): MarketAnalysisResult['indicators']['macd'] {
    if (data.length < slowPeriod) {
      return { value: 0, signal: 0, histogram: 0 };
    }

    // 计算EMA
    const ema = (data: MarketData[], period: number): number => {
      const multiplier = 2 / (period + 1);
      let ema = data[0].close;

      for (let i = 1; i < data.length; i++) {
        ema = (data[i].close - ema) * multiplier + ema;
      }

      return ema;
    };

    const fastEMA = ema(data, fastPeriod);
    const slowEMA = ema(data, slowPeriod);

    const macdValue = fastEMA - slowEMA;

    // 简化信号计算
    const signal = macdValue * 0.2;
    const histogram = macdValue - signal;

    return { value: macdValue, signal, histogram };
  }

  // 计算布林带
  private static calculateBollingerBands(data: MarketData[], period: number = 20, stdDev: number = 2): MarketAnalysisResult['indicators']['bollinger'] {
    if (data.length < period) {
      const current = data[data.length - 1].close;
      return { upper: current, middle: current, lower: current, position: 'inside' };
    }

    const recentData = data.slice(-period);
    const closes = recentData.map(d => d.close);

    const middle = closes.reduce((sum, close) => sum + close, 0) / period;

    const variance = closes.reduce((sum, close) => sum + Math.pow(close - middle, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);

    const upper = middle + (standardDeviation * stdDev);
    const lower = middle - (standardDeviation * stdDev);

    const currentPrice = data[data.length - 1].close;
    let position: 'above' | 'below' | 'inside';

    if (currentPrice > upper) {
      position = 'above';
    } else if (currentPrice < lower) {
      position = 'below';
    } else {
      position = 'inside';
    }

    return { upper, middle, lower, position };
  }

  // 计算每日收益率
  private static calculateDailyReturns(trades: Trade[]): number[] {
    // 按日期分组交易
    const tradesByDay: Record<string, Trade[]> = {};

    for (const trade of trades) {
      const date = new Date(trade.timestamp).toISOString().split('T')[0];
      if (!tradesByDay[date]) {
        tradesByDay[date] = [];
      }
      tradesByDay[date].push(trade);
    }

    // 计算每日收益
    const dailyReturns: number[] = [];
    const dates = Object.keys(tradesByDay).sort();

    for (let i = 1; i < dates.length; i++) {
      const prevDate = dates[i - 1];
      const currDate = dates[i];

      const prevDayProfit = tradesByDay[prevDate].reduce((sum, trade) => sum + (trade.total || 0), 0);
      const currDayProfit = tradesByDay[currDate].reduce((sum, trade) => sum + (trade.total || 0), 0);

      if (prevDayProfit !== 0) {
        dailyReturns.push((currDayProfit - prevDayProfit) / Math.abs(prevDayProfit));
      }
    }

    return dailyReturns;
  }

  // 计算收益率波动率
  private static calculateReturnsVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }

  // 计算夏普比率
  private static calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
    if (returns.length === 0) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const standardDeviation = Math.sqrt(variance);

    if (standardDeviation === 0) return 0;

    // 年化收益率和风险
    const annualizedReturn = mean * 252; // 假设252个交易日
    const annualizedVolatility = standardDeviation * Math.sqrt(252);
    const dailyRiskFreeRate = riskFreeRate / 252;

    return (annualizedReturn - riskFreeRate) / annualizedVolatility;
  }

  // 计算最大回撤
  private static calculateMaxDrawdown(trades: Trade[]): number {
    if (trades.length === 0) return 0;

    let maxDrawdown = 0;
    let peak = 0;
    let cumulativeProfit = 0;

    for (const trade of trades) {
      cumulativeProfit += trade.total || 0;

      if (cumulativeProfit > peak) {
        peak = cumulativeProfit;
      } else {
        const drawdown = peak - cumulativeProfit;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
    }

    return maxDrawdown;
  }

  // 计算VaR（风险价值）
  private static calculateVaR(returns: number[], confidence: number): number {
    if (returns.length === 0) return 0;

    // 对收益率进行排序
    const sortedReturns = [...returns].sort((a, b) => a - b);

    // 找到对应置信度的分位数
    const index = Math.floor((1 - confidence) * sortedReturns.length);

    return sortedReturns[index];
  }

  // 计算相关性矩阵
  private static calculateCorrelationMatrix(portfolio: Portfolio, trades: Trade[]): Record<string, Record<string, number>> {
    // 简化实现 - 在实际应用中需要更复杂的计算
    const assets = Object.keys(portfolio.positions);
    const matrix: Record<string, Record<string, number>> = {};

    for (const asset1 of assets) {
      matrix[asset1] = {};

      for (const asset2 of assets) {
        if (asset1 === asset2) {
          matrix[asset1][asset2] = 1;
        } else {
          // 简化计算 - 实际应用中需要基于历史收益率计算
          matrix[asset1][asset2] = 0.2 + Math.random() * 0.6;
        }
      }
    }

    return matrix;
  }

  // 计算风险贡献
  private static calculateRiskContribution(portfolio: Portfolio, correlationMatrix: Record<string, Record<string, number>>): Record<string, number> {
    const assets = Object.keys(portfolio.positions);
    const contributions: Record<string, number> = {};

    // 计算总风险
    let totalRisk = 0;
    for (const asset of assets) {
      totalRisk += portfolio.positions[asset].totalValue;
    }

    // 计算每个资产的风险贡献
    for (const asset of assets) {
      const weight = portfolio.positions[asset].totalValue / totalRisk;

      // 简化计算 - 实际应用中需要更复杂的计算
      let contribution = weight;

      // 考虑相关性
      for (const otherAsset of assets) {
        if (asset !== otherAsset) {
          const otherWeight = portfolio.positions[otherAsset].totalValue / totalRisk;
          contribution += weight * otherWeight * correlationMatrix[asset][otherAsset] * 0.5;
        }
      }

      contributions[asset] = contribution;
    }

    return contributions;
  }

  // 计算绩效归因
  private static calculatePerformanceAttribution(portfolio: Portfolio, trades: Trade[]): MarketAnalysisResult['performanceAttribution'] {
    // 简化实现 - 实际应用中需要更复杂的计算
    return {
      assetAllocation: 0.4,  // 40%来自资产配置
      securitySelection: 0.5,  // 50%来自证券选择
      interaction: 0.1  // 10%来自交互效应
    };
  }

  // 计算多样化比率
  private static calculateDiversificationRatio(correlationMatrix: Record<string, Record<string, number>>): number {
    const assets = Object.keys(correlationMatrix);

    if (assets.length <= 1) return 1;

    // 计算平均相关性
    let totalCorrelation = 0;
    let count = 0;

    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        totalCorrelation += Math.abs(correlationMatrix[assets[i]][assets[j]]);
        count++;
      }
    }

    const averageCorrelation = totalCorrelation / count;

    // 多样化比率 = 1 / (1 + 平均相关性)
    return 1 / (1 + averageCorrelation);
  }

  // 计算有效前沿
  private static calculateEfficientFrontier(portfolio: Portfolio, trades: Trade[]): MarketAnalysisResult['efficientFrontier'] {
    // 简化实现 - 实际应用中需要更复杂的计算
    const currentReturn = portfolio.profitLossTotal / (portfolio.totalBalance - portfolio.profitLossTotal);
    const currentRisk = 0.15; // 假设当前风险为15%

    return {
      lowRisk: { risk: 0.08, return: 0.05 },
      mediumRisk: { risk: currentRisk, return: currentReturn },
      highRisk: { risk: 0.25, return: 0.20 }
    };
  }

  // 计算交易持续时间
  private static calculateTradeDurations(trades: Trade[]): number[] {
    const durations: number[] = [];

    for (const trade of trades) {
      durations.push(this.getTradeDuration(trade));
    }

    return durations;
  }

  // 获取单个交易的持续时间
  private static getTradeDuration(trade: Trade): number {
    // 简化实现 - 实际应用中需要基于开仓和平仓时间计算
    return 24; // 假设平均持仓时间为24小时
  }

  // 计算连续盈亏统计
  private static calculateConsecutiveStats(trades: Trade[]): { wins: number; losses: number } {
    let maxWins = 0;
    let maxLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;

    for (const trade of trades) {
      if (trade.side === 'sell' && trade.total > 0) {
        currentWins++;
        currentLosses = 0;
        maxWins = Math.max(maxWins, currentWins);
      } else if (trade.side === 'sell' && trade.total < 0) {
        currentLosses++;
        currentWins = 0;
        maxLosses = Math.max(maxLosses, currentLosses);
      }
    }

    return { wins: maxWins, losses: maxLosses };
  }

  // 计算月度收益
  private static calculateMonthlyReturns(trades: Trade[]): Record<string, number> {
    const monthlyReturns: Record<string, number> = {};

    for (const trade of trades) {
      const date = new Date(trade.timestamp);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

      if (!monthlyReturns[monthKey]) {
        monthlyReturns[monthKey] = 0;
      }

      monthlyReturns[monthKey] += trade.total || 0;
    }

    return monthlyReturns;
  }

  // 计算交易分布
  private static calculateTradeDistribution(trades: Trade[]): TradeAnalysisResult['tradeDistribution'] {
    const timeOfDay: Record<string, number> = {};
    const dayOfWeek: Record<string, number> = {};

    for (const trade of trades) {
      const date = new Date(trade.timestamp);
      const hour = date.getHours().toString();
      const day = date.getDay();

      if (!timeOfDay[hour]) {
        timeOfDay[hour] = 0;
      }
      timeOfDay[hour]++;

      if (!dayOfWeek[day.toString()]) {
        dayOfWeek[day.toString()] = 0;
      }
      dayOfWeek[day.toString()]++;
    }

    return { timeOfDay, dayOfWeek };
  }

  // 计算按交易对的绩效
  private static calculatePerformanceByPair(trades: Trade[]): TradeAnalysisResult['performanceByPair'] {
    const performanceByPair: Record<string, any> = {};

    // 按交易对分组
    const tradesByPair: Record<string, Trade[]> = {};
    for (const trade of trades) {
      if (!tradesByPair[trade.pair]) {
        tradesByPair[trade.pair] = [];
      }
      tradesByPair[trade.pair].push(trade);
    }

    // 计算每个交易对的绩效
    for (const pair in tradesByPair) {
      const pairTrades = tradesByPair[pair];
      const totalTrades = pairTrades.length;
      const winningTrades = pairTrades.filter(t => t.side === 'sell' && t.total > 0).length;
      const winRate = (winningTrades / totalTrades) * 100;

      const profits = pairTrades.filter(t => t.side === 'sell' && t.total > 0).map(t => t.total);
      const losses = pairTrades.filter(t => t.side === 'sell' && t.total < 0).map(t => t.total);

      const totalProfit = profits.reduce((sum, p) => sum + p, 0) + losses.reduce((sum, l) => sum + l, 0);
      const profitPercent = (totalProfit / 10000) * 100; // 假设初始资本为10000

      performanceByPair[pair] = {
        trades: totalTrades,
        winRate,
        profit: totalProfit,
        profitPercent
      };
    }

    return performanceByPair;
  }
}
