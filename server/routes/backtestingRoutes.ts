import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { BacktestingEngine } from '../services/backtestingEngine';
import { storage } from '../storage';
import logger from '../services/logger';

const router = express.Router();

// Run backtest
router.post('/run', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { pair, strategyName, strategyType, startDate, endDate, initialBalance, riskPerTrade, stopLossPercentage, takeProfitPercentage, commission } = req.body;

    // Validate input
    if (!pair || !strategyName || !strategyType || !startDate || !endDate || !initialBalance || !riskPerTrade || !stopLossPercentage || !takeProfitPercentage || !commission) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const config = {
      pair,
      strategyName,
      strategyType,
      startDate,
      endDate,
      initialBalance,
      riskPerTrade,
      stopLossPercentage,
      takeProfitPercentage,
      commission
    };

    // Run backtest
    const result = await BacktestingEngine.runBacktest(config);

    res.json(result);
  } catch (error) {
    logger.error('Backtest failed:', error);
    res.status(500).json({ error: 'Failed to run backtest' });
  }
});

// Get backtest results
router.get('/results', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const results = await BacktestingEngine.getBacktestResults();
    res.json(results);
  } catch (error) {
    logger.error('Failed to get backtest results:', error);
    res.status(500).json({ error: 'Failed to get backtest results' });
  }
});

// Get backtest result by ID
router.get('/results/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const result = await BacktestingEngine.getBacktestResult(id);

    if (!result) {
      return res.status(404).json({ error: 'Backtest result not found' });
    }

    res.json(result);
  } catch (error) {
    logger.error('Failed to get backtest result:', error);
    res.status(500).json({ error: 'Failed to get backtest result' });
  }
});

// Optimize strategy
router.post('/optimize', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { pair, strategyName, strategyType, startDate, endDate, initialBalance, riskLevels } = req.body;

    // Validate input
    if (!pair || !strategyName || !strategyType || !startDate || !endDate || !initialBalance || !riskLevels || !Array.isArray(riskLevels) || riskLevels.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await BacktestingEngine.optimizeStrategy({
      pair,
      strategyName,
      strategyType,
      startDate,
      endDate,
      initialBalance,
      riskLevels
    });

    res.json(result);
  } catch (error) {
    logger.error('Strategy optimization failed:', error);
    res.status(500).json({ error: 'Failed to optimize strategy' });
  }
});

// Compare backtest results
router.post('/compare', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { resultIds } = req.body;

    if (!Array.isArray(resultIds) || resultIds.length === 0) {
      return res.status(400).json({ error: 'Invalid result IDs' });
    }

    const results = await Promise.all(
      resultIds.map(id => BacktestingEngine.getBacktestResult(id))
    );

    res.json(results);
  } catch (error) {
    logger.error('Backtest comparison failed:', error);
    res.status(500).json({ error: 'Failed to compare backtest results' });
  }
});

export default router;
