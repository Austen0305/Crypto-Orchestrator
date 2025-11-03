import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { riskManagementService } from '../services/riskManagementService';
import logger from '../services/logger';

const router = express.Router();

// Get risk metrics for portfolio
router.get('/metrics', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const portfolio = await storage.getPortfolio('paper');
    const trades = await storage.getTrades();

    if (!portfolio || !trades || trades.length === 0) {
      return res.status(400).json({ error: 'No portfolio or trades found' });
    }

    const riskMetrics = await riskManagementService.calculateRiskMetrics(portfolio, trades);
    res.json(riskMetrics);
  } catch (error) {
    logger.error('Failed to get risk metrics:', error);
    res.status(500).json({ error: 'Failed to get risk metrics' });
  }
});

// Get risk alerts
router.get('/alerts', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const portfolio = await storage.getPortfolio('paper');
    const trades = await storage.getTrades();
    const riskLimits = await riskManagementService.getRiskLimits(req.user?.id);

    if (!portfolio || !trades || trades.length === 0) {
      return res.status(400).json({ error: 'No portfolio or trades found' });
    }

    const riskMetrics = await riskManagementService.calculateRiskMetrics(portfolio, trades);
    const alerts = await riskManagementService.generateRiskAlerts(riskMetrics, riskLimits);
    res.json(alerts);
  } catch (error) {
    logger.error('Failed to get risk alerts:', error);
    res.status(500).json({ error: 'Failed to get risk alerts' });
  }
});

// Acknowledge risk alert
router.post('/alerts/:alertId/acknowledge', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { alertId } = req.params;
    const success = await riskManagementService.acknowledgeRiskAlert(alertId);

    if (success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Failed to acknowledge alert' });
    }
  } catch (error) {
    logger.error('Failed to acknowledge risk alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge risk alert' });
  }
});

// Get risk limits
router.get('/limits', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const riskLimits = await riskManagementService.getRiskLimits(req.user?.id);
    res.json(riskLimits);
  } catch (error) {
    logger.error('Failed to get risk limits:', error);
    res.status(500).json({ error: 'Failed to get risk limits' });
  }
});

// Update risk limits
router.post('/limits', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { limits } = req.body;
    const success = await riskManagementService.updateRiskLimits(limits, req.user?.id);

    if (success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Failed to update risk limits' });
    }
  } catch (error) {
    logger.error('Failed to update risk limits:', error);
    res.status(500).json({ error: 'Failed to update risk limits' });
  }
});

export default router;
