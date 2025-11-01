import express from 'express';
import { krakenService } from '../services/krakenService';
import { storage } from '../storage';
import logger from '../services/logger';

const router = express.Router();

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        kraken: await checkKrakenHealth(),
        database: await checkDatabaseHealth(),
        redis: await checkRedisHealth(),
      },
    };

    const isHealthy = Object.values(health.services).every(service => service.status === 'healthy');

    res.status(isHealthy ? 200 : 503).json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Readiness check endpoint
router.get('/ready', async (req, res) => {
  try {
    const ready = {
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: await checkDatabaseHealth(),
        kraken: await checkKrakenHealth(),
      },
    };

    const isReady = Object.values(ready.checks).every(check => check.status === 'healthy');

    res.status(isReady ? 200 : 503).json(ready);
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version,
      },
      application: {
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 5000,
      },
      services: {
        kraken: await checkKrakenHealth(),
        database: await checkDatabaseHealth(),
        redis: await checkRedisHealth(),
      },
    };

    res.json(metrics);
  } catch (error) {
    logger.error('Metrics collection failed:', error);
    res.status(500).json({
      error: 'Failed to collect metrics',
      timestamp: new Date().toISOString(),
    });
  }
});

// Service health check functions
async function checkKrakenHealth() {
  try {
    // Simple ping to Kraken API
  const testPair = 'BTC/USD';
  await krakenService.getMarketPrice(testPair);
    return { status: 'healthy', responseTime: Date.now() };
  } catch (error) {
    logger.warn('Kraken health check failed:', error);
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

async function checkDatabaseHealth() {
  try {
    // Simple database query
    await storage.getTradingPairs();
    return { status: 'healthy', responseTime: Date.now() };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

async function checkRedisHealth() {
  try {
    // Redis ping check would go here if Redis was available
    // For now, return healthy since Redis is optional
    return { status: 'healthy', note: 'Redis check not implemented' };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

export default router;
