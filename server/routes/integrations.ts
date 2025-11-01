import express from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { tradingOrchestrator } from '../services/tradingOrchestrator';
import { freqtradeAdapter, jesseAdapter } from '../services/tradingFrameworks';

const router = express.Router();

// Ensemble prediction (uses freqtrade + jesse via tradingOrchestrator)
router.post('/predict', optionalAuth, async (req, res) => {
  try {
    const payload = req.body || {};
    const prediction = await tradingOrchestrator.getEnsemblePrediction(payload);
    res.json(prediction);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get prediction' });
  }
});

// Backtest both frameworks and return summary
router.post('/backtest', authenticateToken, async (req, res) => {
  try {
    const payload = req.body || {};
    const result = await tradingOrchestrator.backtest(payload);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to run backtest' });
  }
});

// Ping integrations (health)
router.get('/ping', async (req, res) => {
  try {
    const p = await tradingOrchestrator.pingAll();
    res.json(p);
  } catch (error) {
    res.status(500).json({ error: 'Failed to ping integrations' });
  }
});

// Start/stop adapters (admin)
router.post('/start', authenticateToken, async (req, res) => {
  try {
    tradingOrchestrator.startAll();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start adapters' });
  }
});

router.post('/stop', authenticateToken, async (req, res) => {
  try {
    tradingOrchestrator.stopAll();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to stop adapters' });
  }
});

router.get('/status', async (req, res) => {
  try {
    const p = await tradingOrchestrator.pingAll();
    res.json({ ok: true, status: p });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get adapter status' });
  }
});

// Per-adapter health and control endpoints
router.get('/adapter/:name/health', async (req, res) => {
  try {
    const { name } = req.params;
    if (name === 'freqtrade') {
      const h = await freqtradeAdapter.ping();
      return res.json({ adapter: name, health: h });
    }
    if (name === 'jesse') {
      const h = await jesseAdapter.ping();
      return res.json({ adapter: name, health: h });
    }
    return res.status(404).json({ error: 'adapter not found' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get adapter health' });
  }
});

router.post('/adapter/:name/restart', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    if (name === 'freqtrade') {
      freqtradeAdapter.stop();
      freqtradeAdapter.start();
      return res.json({ ok: true, adapter: name });
    }
    if (name === 'jesse') {
      jesseAdapter.stop();
      jesseAdapter.start();
      return res.json({ ok: true, adapter: name });
    }
    return res.status(404).json({ error: 'adapter not found' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restart adapter' });
  }
});

export default router;
