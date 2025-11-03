import { MarketData, Trade, Portfolio, PerformanceMetrics } from '@shared/schema';
import logger from './logger';
import { cacheService, CacheKeyBuilder } from './cacheService';

// 继续高级分析引擎实现
export class AdvancedAnalyticsEnginePart2 {
  // 计算波动率（继续第一部分）
  private static calculateVolatility(data: MarketData[]): MarketAnalysisResult['volatility'] {
    // 计算收益率
    const returns = [];
    for (let i = 1; i < data.length; i++) {
      returns.push((data[i].close - data[i - 1].close) / data[i - 1].close);
    }

    // 计算当前波动率（最近20个数据点）
    const recentReturns = returns.slice(-20);
    const currentVolatility = Math.sqrt(
      recentReturns.reduce((sum, r) => sum + r * r, 0) / recentReturns.length
    ) * Math.sqrt(24 * 365); // 年化波动率

    // 计算平均波动率（所有数据）
    const averageVolatility = Math.sqrt(
      returns.reduce((sum, r) => sum + r * r, 0) / returns.length
    ) * Math.sqrt(24 * 365); // 年化波动率

    // 确定波动率趋势
    let trend: 'increasing' | 'decreasing' | 'stable';
    const recentVolatility = Math.sqrt(
      returns.slice(-5).reduce((sum, r) => sum + r * r, 0) / 5
    ) * Math.sqrt(24 * 365);

    if (recentVolatility > averageVolatility * 1.1) {
      trend = 'increasing';
    } else if (recentVolatility < averageVolatility * 0.9) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    return {
      current: currentVolatility,
      average: averageVolatility,
      trend
    };
  }

  // 计算支撑位
  private static calculateSupport(data: MarketData[]): MarketAnalysisResult['support'] {
    // 使用局部最小值算法找到支撑位
    const lookback = 10;
    const minima = [];

    for (let i = lookback; i < data.length - lookback; i++) {
      let isMinima = true;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (data[j].low < data[i].low) {
          isMinima = false;
          break;
        }
      }

      if (isMinima) {
        minima.push({
          price: data[i].low,
          index: i
        });
      }
    }

    // 如果没有找到支撑位，使用最近最低价
    if (minima.length === 0) {
      const recentLow = Math.min(...data.slice(-20).map(d => d.low));
      return {
        level: recentLow,
        strength: 0.3
      };
    }

    // 找到最强支撑位（触及次数最多的价格）
    const priceGroups = minima.reduce((groups, minima) => {
      // 将相近的价格分组（在1%范围内）
      const group = groups.find(g => 
        Math.abs(g.price - minima.price) / minima.price < 0.01
      );

      if (group) {
        group.count++;
        group.prices.push(minima.price);
      } else {
        groups.push({
          price: minima.price,
          count: 1,
          prices: [minima.price]
        });
      }

      return groups;
    }, [] as Array<{ price: number; count: number; prices: number[] }>);

    // 按计数排序，取最强的支撑位
    priceGroups.sort((a, b) => b.count - a.count);
    const strongestSupport = priceGroups[0];
    const supportLevel = strongestSupport.prices.reduce((sum, p) => sum + p, 0) / strongestSupport.prices.length;

    // 计算支撑强度（基于触及次数和近期性）
    const strength = Math.min(strongestSupport.count / 5, 1);

    return {
      level: supportLevel,
      strength
    };
  }

  // 计算阻力位
  private static calculateResistance(data: MarketData[]): MarketAnalysisResult['resistance'] {
    // 使用局部最大值算法找到阻力位
    const lookback = 10;
    const maxima = [];

    for (let i = lookback; i < data.length - lookback; i++) {
      let isMaxima = true;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (data[j].high > data[i].high) {
          isMaxima = false;
          break;
        }
      }

      if (isMaxima) {
        maxima.push({
          price: data[i].high,
          index: i
        });
      }
    }

    // 如果没有找到阻力位，使用最近最高价
    if (maxima.length === 0) {
      const recentHigh = Math.max(...data.slice(-20).map(d => d.high));
      return {
        level: recentHigh,
        strength: 0.3
      };
    }

    // 找到最强阻力位（触及次数最多的价格）
    const priceGroups = maxima.reduce((groups, maxima) => {
      // 将相近的价格分组（在1%范围内）
      const group = groups.find(g => 
        Math.abs(g.price - maxima.price) / maxima.price < 0.01
      );

      if (group) {
        group.count++;
        group.prices.push(maxima.price);
      } else {
        groups.push({
          price: maxima.price,
          count: 1,
          prices: [maxima.price]
        });
      }

      return groups;
    }, [] as Array<{ price: number; count: number; prices: number[] }>);

    // 按计数排序，取最强的阻力位
    priceGroups.sort((a, b) => b.count - a.count);
    const strongestResistance = priceGroups[0];
    const resistanceLevel = strongestResistance.prices.reduce((sum, p) => sum + p, 0) / strongestResistance.prices.length;

    // 计算阻力强度（基于触及次数和近期性）
    const strength = Math.min(strongestResistance.count / 5, 1);

    return {
      level: resistanceLevel,
      strength
    };
  }

  // 计算成交量指标
  private static calculateVolumeMetrics(data: MarketData[]): MarketAnalysisResult['volume'] {
    const currentVolume = data[data.length - 1].volume;

    // 计算平均成交量（最近20个数据点）
    const recentVolumes = data.slice(-20).map(d => d.volume);
    const averageVolume = recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length;

    // 计算成交量比率
    const ratio = currentVolume / averageVolume;

    return {
      current: currentVolume,
      average: averageVolume,
      ratio
    };
  }

  // 计算技术指标
  private static calculateIndicators(data: MarketData[]): MarketAnalysisResult['indicators'] {
    // 计算RSI
    const rsi = this.calculateRSI(data);

    // 计算MACD
    const macd = this.calculateMACD(data);

    // 计算布林带
    const bollinger = this.calculateBollingerBands(data);

    // 确定价格相对于布林带的位置
    const currentPrice = data[data.length - 1].close;
    let position: 'above' | 'below' | 'inside';

    if (currentPrice > bollinger.upper) {
      position = 'above';
    } else if (currentPrice < bollinger.lower) {
      position = 'below';
    } else {
      position = 'inside';
    }

    return {
      rsi,
      macd,
      bollinger: {
        ...bollinger,
        position
      }
    };
  }

  // 计算RSI
  private static calculateRSI(data: MarketData[], period: number = 14): number {
    if (data.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    // 计算初始平均收益和损失
    for (let i = 1; i <= period; i++) {
      const change = data[i].close - data[i - 1].close;
      if (change > 0) gains += change;
      else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // 计算RSI
    for (let i = period + 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;

      if (change > 0) {
        avgGain = (avgGain * (period - 1) + change) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) - change) / period;
      }
    }

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  // 计算MACD
  private static calculateMACD(data: MarketData[]): MarketAnalysisResult['indicators']['macd'] {
    const fastPeriod = 12;
    const slowPeriod = 26;
    const signalPeriod = 9;

    if (data.length < slowPeriod) {
      return { value: 0, signal: 0, histogram: 0 };
    }

    // 计算EMA
    const ema = (data: number[], period: number): number[] => {
      const multiplier = 2 / (period + 1);
      const emaArray = [data[0]];

      for (let i = 1; i < data.length; i++) {
        emaArray.push((data[i] - emaArray[i - 1]) * multiplier + emaArray[i - 1]);
      }

      return emaArray;
    };

    const closes = data.map(d => d.close);
    const fastEMA = ema(closes, fastPeriod);
    const slowEMA = ema(closes, slowPeriod);

    // 计算MACD线
    const macdLine = fastEMA.slice(slowPeriod - fastPeriod).map((value, index) => 
      value - slowEMA[index]
    );

    // 计算信号线
    const signalLine = ema(macdLine, signalPeriod);

    // 计算柱状图
    const histogram = macdLine.slice(signalPeriod - macdLine.length).map((value, index) => 
      value - signalLine[index]
    );

    return {
      value: macdLine[macdLine.length - 1],
      signal: signalLine[signalLine.length - 1],
      histogram: histogram[histogram.length - 1]
    };
  }

  // 计算布林带
  private static calculateBollingerBands(data: MarketData[], period: number = 20, stdDev: number = 2): MarketAnalysisResult['indicators']['bollinger'] {
    if (data.length < period) {
      const currentPrice = data[data.length - 1].close;
      return {
        upper: currentPrice,
        middle: currentPrice,
        lower: currentPrice
      };
    }

    const closes = data.map(d => d.close);

    // 计算简单移动平均线
    let sum = 0;
    const sma = [];

    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) {
        sum += closes[i];
        sma.push(NaN);
      } else {
        if (i === period - 1) {
          for (let j = 0; j < period; j++) {
            sum += closes[j];
          }
        } else {
          sum += closes[i] - closes[i - period];
        }

        sma.push(sum / period);
      }
    }

    // 计算标准差
    const standardDeviation = [];

    for (let i = period - 1; i < closes.length; i++) {
      const variance = closes.slice(i - period + 1, i + 1).reduce((sum, price) => {
        return sum + Math.pow(price - sma[i], 2);
      }, 0) / period;

      standardDeviation.push(Math.sqrt(variance));
    }

    // 计算布林带
    const lastIndex = closes.length - 1;
    const middle = sma[lastIndex];
    const deviation = standardDeviation[standardDeviation.length - 1];

    return {
      upper: middle + (deviation * stdDev),
      middle,
      lower: middle - (deviation * stdDev)
    };
  }

  // 生成预测
  private static generatePrediction(
    trend: MarketAnalysisResult['trend'],
    volatility: MarketAnalysisResult['volatility'],
    indicators: MarketAnalysisResult['indicators']
  ): MarketAnalysisResult['prediction'] {
    const reasoning = [];
    let direction: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 0.5;
    let timeframe: 'short' | 'medium' | 'long' = 'medium';

    // 基于趋势的预测
    if (trend.direction === 'bullish' && trend.strength > 0.5) {
      direction = 'buy';
      confidence += trend.strength * 0.3;
      reasoning.push(`强上升趋势 (${(trend.strength * 100).toFixed(1)}%)`);
    } else if (trend.direction === 'bearish' && trend.strength > 0.5) {
      direction = 'sell';
      confidence += trend.strength * 0.3;
      reasoning.push(`强下降趋势 (${(trend.strength * 100).toFixed(1)}%)`);
    }

    // 基于RSI的预测
    if (indicators.rsi < 30) {
      if (direction !== 'buy') {
        direction = 'buy';
        confidence = 0.6;
      }
      confidence += 0.2;
      reasoning.push(`RSI超卖 (${indicators.rsi.toFixed(1)})`);
    } else if (indicators.rsi > 70) {
      if (direction !== 'sell') {
        direction = 'sell';
        confidence = 0.6;
      }
      confidence += 0.2;
      reasoning.push(`RSI超买 (${indicators.rsi.toFixed(1)})`);
    }

    // 基于MACD的预测
    if (indicators.macd.histogram > 0 && indicators.macd.value > indicators.macd.signal) {
      if (direction !== 'buy') {
        direction = 'buy';
        confidence = 0.6;
      }
      confidence += 0.15;
      reasoning.push('MACD看涨信号');
    } else if (indicators.macd.histogram < 0 && indicators.macd.value < indicators.macd.signal) {
      if (direction !== 'sell') {
        direction = 'sell';
        confidence = 0.6;
      }
      confidence += 0.15;
      reasoning.push('MACD看跌信号');
    }

    // 基于布林带的预测
    if (indicators.bollinger.position === 'below') {
      if (direction !== 'buy') {
        direction = 'buy';
        confidence = 0.6;
      }
      confidence += 0.1;
      reasoning.push('价格触及布林带下轨');
    } else if (indicators.bollinger.position === 'above') {
      if (direction !== 'sell') {
        direction = 'sell';
        confidence = 0.6;
      }
      confidence += 0.1;
      reasoning.push('价格触及布林带上轨');
    }

    // 基于波动率的预测
    if (volatility.trend === 'increasing' && volatility.current > volatility.average * 1.5) {
      timeframe = 'short';
      confidence -= 0.1; // 高波动率降低信心
      reasoning.push('高波动率环境，建议短期交易');
    } else if (volatility.trend === 'decreasing' && volatility.current < volatility.average * 0.7) {
      timeframe = 'long';
      confidence += 0.1; // 低波动率增加信心
      reasoning.push('低波动率环境，适合长期持仓');
    }

    // 确保置信度在0-1范围内
    confidence = Math.max(0.1, Math.min(0.9, confidence));

    // 如果没有明确信号，默认为持有
    if (confidence < 0.6) {
      direction = 'hold';
      reasoning.push('信号不明确，建议持有');
    }

    return {
      direction,
      confidence,
      timeframe,
      reasoning
    };
  }

  // 计算每日收益率
  private static calculateDailyReturns(trades: Trade[]): number[] {
    // 按日期分组交易
    const tradesByDate = trades.reduce((groups, trade) => {
      const date = new Date(trade.timestamp).toISOString().split('T')[0];
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(trade);
      return groups;
    }, {} as Record<string, Trade[]>);

    // 计算每日收益
    const dates = Object.keys(tradesByDate).sort();
    const dailyReturns = [];
    let previousDayValue = 0;

    for (const date of dates) {
      const dayTrades = tradesByDate[date];
      const dayValue = dayTrades.reduce((sum, trade) => sum + trade.total, 0);

      if (previousDayValue !== 0) {
        dailyReturns.push(dayValue / previousDayValue);
      }

      previousDayValue += dayValue;
    }

    return dailyReturns;
  }

  // 计算收益率波动率
  private static calculateReturnsVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }

  // 计算夏普比率
  private static calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
    if (returns.length < 2) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);

    if (volatility === 0) return 0;

    // 年化
    const annualizedMean = mean * 365;
    const annualizedVolatility = volatility * Math.sqrt(365);

    return (annualizedMean - riskFreeRate) / annualizedVolatility;
  }

  // 计算最大回撤
  private static calculateMaxDrawdown(trades: Trade[]): number {
    let maxDrawdown = 0;
    let peak = 0;
    let currentValue = 0;

    for (const trade of trades) {
      currentValue += trade.total;

      if (currentValue > peak) {
        peak = currentValue;
      }

      const drawdown = peak - currentValue;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  // 计算VaR（风险价值）
  private static calculateVaR(returns: number[], confidence: number): number {
    if (returns.length === 0) return 0;

    // 排序收益率
    const sortedReturns = [...returns].sort((a, b) => a - b);

    // 计算分位数
    const index = Math.floor((1 - confidence) * sortedReturns.length);

    return sortedReturns[index];
  }

  // 计算相关性矩阵
  private static calculateCorrelationMatrix(portfolio: Portfolio, trades: Trade[]): Record<string, Record<string, number>> {
    const assets = Object.keys(portfolio.positions);
    const correlationMatrix: Record<string, Record<string, number>> = {};

    // 初始化矩阵
    for (const asset1 of assets) {
      correlationMatrix[asset1] = {};
      for (const asset2 of assets) {
        correlationMatrix[asset1][asset2] = asset1 === asset2 ? 1 : 0;
      }
    }

    // 计算每对资产的相关性
    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        const asset1 = assets[i];
        const asset2 = assets[j];

        // 获取每个资产的价格历史
        const prices1 = this.getAssetPriceHistory(asset1, trades);
        const prices2 = this.getAssetPriceHistory(asset2, trades);

        // 计算相关性
        const correlation = this.calculateCorrelation(prices1, prices2);

        correlationMatrix[asset1][asset2] = correlation;
        correlationMatrix[asset2][asset1] = correlation;
      }
    }

    return correlationMatrix;
  }

  // 获取资产价格历史
  private static getAssetPriceHistory(asset: string, trades: Trade[]): number[] {
    // 筛选与资产相关的交易
    const assetTrades = trades.filter(t => t.pair.includes(asset));

    // 按时间排序
    assetTrades.sort((a, b) => a.timestamp - b.timestamp);

    // 提取价格
    return assetTrades.map(t => t.price);
  }

  // 计算两个价格序列的相关性
  private static calculateCorrelation(prices1: number[], prices2: number[]): number {
    if (prices1.length !== prices2.length || prices1.length === 0) return 0;

    const n = prices1.length;

    // 计算均值
    const mean1 = prices1.reduce((sum, p) => sum + p, 0) / n;
    const mean2 = prices2.reduce((sum, p) => sum + p, 0) / n;

    // 计算协方差和方差
    let covariance = 0;
    let variance1 = 0;
    let variance2 = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = prices1[i] - mean1;
      const diff2 = prices2[i] - mean2;

      covariance += diff1 * diff2;
      variance1 += diff1 * diff1;
      variance2 += diff2 * diff2;
    }

    covariance /= n;
    variance1 /= n;
    variance2 /= n;

    // 计算相关系数
    if (variance1 === 0 || variance2 === 0) return 0;

    return covariance / Math.sqrt(variance1 * variance2);
  }

  // 计算风险贡献
  private static calculateRiskContribution(
    portfolio: Portfolio,
    correlationMatrix: Record<string, Record<string, number>>
  ): Record<string, number> {
    const assets = Object.keys(portfolio.positions);
    const riskContribution: Record<string, number> = {};

    // 计算每个资产的风险贡献
    for (const asset of assets) {
      let contribution = 0;

      for (const otherAsset of assets) {
        const weight = portfolio.positions[asset].totalValue / portfolio.totalBalance;
        const otherWeight = portfolio.positions[otherAsset].totalValue / portfolio.totalBalance;
        const correlation = correlationMatrix[asset][otherAsset];

        contribution += weight * otherWeight * correlation;
      }

      riskContribution[asset] = contribution;
    }

    return riskContribution;
  }

  // 计算绩效归因
  private static calculatePerformanceAttribution(
    portfolio: Portfolio,
    trades: Trade[]
  ): PortfolioAnalysisResult['performanceAttribution'] {
    // 简化实现，实际应用中需要更复杂的计算
    return {
      assetAllocation: 0.6,  // 示例值
      securitySelection: 0.3,  // 示例值
      interaction: 0.1  // 示例值
    };
  }

  // 计算多样化比率
  private static calculateDiversificationRatio(
    correlationMatrix: Record<string, Record<string, number>>
  ): number {
    const assets = Object.keys(correlationMatrix);
    if (assets.length <= 1) return 1;

    // 计算平均相关性
    let totalCorrelation = 0;
    let count = 0;

    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        totalCorrelation += correlationMatrix[assets[i]][assets[j]];
        count++;
      }
    }

    const averageCorrelation = totalCorrelation / count;

    // 多样化比率 = 1 - 平均相关性
    return Math.max(0, 1 - averageCorrelation);
  }

  // 计算有效前沿
  private static calculateEfficientFrontier(
    portfolio: Portfolio,
    trades: Trade[]
  ): PortfolioAnalysisResult['efficientFrontier'] {
    // 简化实现，实际应用中需要更复杂的优化
    return {
      lowRisk: { risk: 0.05, return: 0.08 },    // 示例值
      mediumRisk: { risk: 0.15, return: 0.15 },  // 示例值
      highRisk: { risk: 0.25, return: 0.25 }   // 示例值
    };
  }

  // 计算交易持续时间
  private static getTradeDuration(trade: Trade): number {
    // 简化实现，假设交易在开仓后24小时平仓
    return 24;
  }

  // 计算所有交易的持续时间
  private static calculateTradeDurations(trades: Trade[]): number[] {
    return trades.map(t => this.getTradeDuration(t));
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
    // 按月份分组交易
    const tradesByMonth = trades.reduce((groups, trade) => {
      const date = new Date(trade.timestamp);
      const month = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

      if (!groups[month]) {
        groups[month] = [];
      }
      groups[month].push(trade);
      return groups;
    }, {} as Record<string, Trade[]>);

    // 计算每月收益
    const monthlyReturns: Record<string, number> = {};

    for (const month in tradesByMonth) {
      const monthTrades = tradesByMonth[month];
      const monthReturn = monthTrades.reduce((sum, trade) => sum + trade.total, 0);
      monthlyReturns[month] = monthReturn;
    }

    return monthlyReturns;
  }

  // 计算交易分布
  private static calculateTradeDistribution(trades: Trade[]): TradeAnalysisResult['tradeDistribution'] {
    // 按小时分布
    const timeOfDay: Record<string, number> = {};
    for (let i = 0; i < 24; i++) {
      timeOfDay[i.toString()] = 0;
    }

    // 按星期分布
    const dayOfWeek: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      dayOfWeek[dayNames[i]] = 0;
    }

    for (const trade of trades) {
      const date = new Date(trade.timestamp);
      const hour = date.getHours().toString();
      const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];

      timeOfDay[hour]++;
      dayOfWeek[day]++;
    }

    return { timeOfDay, dayOfWeek };
  }

  // 计算按交易对的绩效
  private static calculatePerformanceByPair(trades: Trade[]): TradeAnalysisResult['performanceByPair'] {
    // 按交易对分组
    const tradesByPair = trades.reduce((groups, trade) => {
      if (!groups[trade.pair]) {
        groups[trade.pair] = [];
      }
      groups[trade.pair].push(trade);
      return groups;
    }, {} as Record<string, Trade[]>);

    // 计算每个交易对的绩效
    const performanceByPair: TradeAnalysisResult['performanceByPair'] = {};

    for (const pair in tradesByPair) {
      const pairTrades = tradesByPair[pair];
      const profit = pairTrades.reduce((sum, trade) => sum + trade.total, 0);
      const winningTrades = pairTrades.filter(t => t.side === 'sell' && t.total > 0).length;
      const winRate = (winningTrades / pairTrades.length) * 100;

      // 计算投资额（简化）
      const investment = pairTrades.reduce((sum, trade) => sum + trade.amount * trade.price, 0);
      const profitPercent = (profit / investment) * 100;

      performanceByPair[pair] = {
        trades: pairTrades.length,
        winRate,
        profit,
        profitPercent
      };
    }

    return performanceByPair;
  }
}
