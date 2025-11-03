import express from 'express';
import { AdvancedAnalyticsEngine } from '../services/advancedAnalyticsEngine';
import { authenticateToken, AuthenticatedRequest } from '../middleware/enhancedAuth';
import { cacheMiddleware } from '../middleware/cache';

const router = express.Router();

// Get market analysis
router.get('/api/market-analysis/:pair', cacheMiddleware(300), async (req, res) => {
  try {
    const { pair } = req.params;
    const { timeframe = '1h', limit = 100 } = req.query;

    const data = await storage.getMarketData(pair, parseInt(limit as string));
    const result = await AdvancedAnalyticsEngine.analyzeMarket(pair, data);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze market' });
  }
});

// Get portfolio analysis
router.get('/api/portfolio-analysis', authenticateToken, cacheMiddleware(600), async (req, res) => {
  try {
    const portfolio = await storage.getPortfolio('paper');
    const trades = await storage.getTrades();

    const result = await AdvancedAnalyticsEngine.analyzePortfolio(portfolio, trades);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze portfolio' });
  }
});

// Get trade analysis
router.get('/api/trade-analysis', authenticateToken, cacheMiddleware(1800), async (req, res) => {
  try {
    const trades = await storage.getTrades();

    const result = await AdvancedAnalyticsEngine.analyzeTrades(trades);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze trades' });
  }
});

// Get performance metrics
router.get('/api/performance-metrics/:botId', authenticateToken, cacheMiddleware(300), async (req, res) => {
  try {
    const { botId } = req.params;

    const trades = await storage.getTrades(botId);
    const metrics = await storage.getPerformanceMetrics(botId);

    if (!trades.length || !metrics) {
      // Calculate metrics if not already stored
      const calculatedMetrics = await AdvancedAnalyticsEngine.calculatePerformanceMetrics(trades);
      await storage.savePerformanceMetrics({
        botId,
        ...calculatedMetrics,
        period: '30d'
      });
    }

    const result = metrics || await AdvancedAnalyticsEngine.calculatePerformanceMetrics(trades);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get performance metrics' });
  }
});

export default router;
