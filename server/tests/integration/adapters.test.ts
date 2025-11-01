import { freqtradeAdapter, jesseAdapter } from '../../services/tradingFrameworks';
import { tradingOrchestrator } from '../../services/tradingOrchestrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Trading Framework Adapters', () => {
  beforeAll(async () => {
    // Start both adapters before running tests
    tradingOrchestrator.startAll();
  });

  afterAll(async () => {
    // Clean up after tests
    tradingOrchestrator.stopAll();
  });

  describe('Freqtrade Adapter', () => {
    it('should ping successfully', async () => {
      const result = await freqtradeAdapter.ping();
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('should make a prediction', async () => {
      const result = await freqtradeAdapter.predict({
        symbol: 'BTC/USD',
        marketData: []
      });
      expect(result).toBeDefined();
      expect(result.action).toBeDefined();
      expect(typeof result.confidence).toBe('number');
      expect(result.source).toBe('freqtrade');
    });
  });

  describe('Jesse Adapter', () => {
    it('should ping successfully', async () => {
      const result = await jesseAdapter.ping();
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('should make a prediction', async () => {
      const result = await jesseAdapter.predict({
        symbol: 'BTC-USD',
        marketData: []
      });
      expect(result).toBeDefined();
      expect(result.action).toBeDefined();
      expect(typeof result.confidence).toBe('number');
      expect(result.source).toBe('jesse');
    });
  });

  describe('Trading Orchestrator', () => {
    it('should aggregate predictions from both adapters', async () => {
      const result = await tradingOrchestrator.getEnsemblePrediction({
        symbol: 'BTC/USD',
        marketData: []
      });
      expect(result).toBeDefined();
      expect(result.action).toBeDefined();
      expect(typeof result.confidence).toBe('number');
      expect(Array.isArray(result.votes)).toBe(true);
      expect(result.votes.length).toBeGreaterThan(0);
    });

    it('should run backtests on both adapters', async () => {
      const result = await tradingOrchestrator.backtest({
        symbol: 'BTC/USD',
        startDate: '2025-01-01',
        endDate: '2025-10-31'
      });
      expect(result).toBeDefined();
      expect(result.results).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();
      expect(typeof result.summary.avgProfitPct).toBe('number');
      expect(typeof result.summary.totalTrades).toBe('number');
    });
  });
});