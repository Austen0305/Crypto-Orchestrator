import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { krakenService } from "./services/krakenService";
import { getDefaultExchange, setDefaultExchange } from './services/exchangeManager';
import { paperTradingService } from "./services/paperTradingService";
import { botRunner } from "./services/botRunner";
import { tradingOrchestrator } from './services/tradingOrchestrator';
import { marketAnalysisService } from "./services/marketAnalysisService";
import { insertTradeSchema, insertBotConfigSchema } from "@shared/schema";
import authRoutes from "./routes/auth";
import notificationRoutes from "./routes/notifications";
import healthRoutes from "./routes/health";
import integrationsRoutes from './routes/integrations';
import { apiLimiter, authLimiter, tradeLimiter } from "./middleware/rateLimit";
import { authenticateToken, optionalAuth } from "./middleware/auth";
import { cacheMiddleware, invalidateCache } from "./middleware/cache";
import logger from "./services/logger";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    logger.info("WebSocket client connected");
    ws.send(JSON.stringify({ type: "connected", message: "Connected to CryptoML Trading Platform" }));
  });

  const broadcastUpdate = (type: string, data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type, data }));
      }
    });
  };

  // connect the configured default exchange (env EXCHANGE_NAME or 'kraken')
  const defaultExchange = getDefaultExchange();
  await defaultExchange.connect();

  const ingestMarketData = async () => {
    try {
  const pairs = await defaultExchange.getAllTradingPairs();
      await storage.updateTradingPairs(pairs);
      await paperTradingService.updatePortfolioPrices(pairs);

      for (const pair of pairs.slice(0, 20)) {
        try {
          const ohlcv = await defaultExchange.getOHLCV(pair.symbol, "1h", 1);
          if (ohlcv && ohlcv.length > 0) {
            const [timestamp, open, high, low, close, volume] = ohlcv[0];
            await storage.saveMarketData({
              pair: pair.symbol,
              timestamp,
              open,
              high,
              low,
              close,
              volume,
            });
          }
        } catch (error) {
          logger.error(`Error ingesting data for ${pair.symbol}:`, error);
        }
      }

      broadcastUpdate("market_data", pairs);
    } catch (error) {
      logger.error("Error updating market data:", error);
    }
  };

  ingestMarketData();

  setInterval(ingestMarketData, 60000);

  // Apply rate limiting to all routes
  app.use(apiLimiter);

  // Auth routes with stricter rate limiting
  app.use("/api/auth", authLimiter);
  app.use("/api/auth", authRoutes);

  // Health routes (no auth required)
  app.use("/api/health", healthRoutes);

  // Notification routes (require authentication)
  app.use("/api/notifications", authenticateToken, notificationRoutes);

  app.get("/api/markets", cacheMiddleware(600), async (req, res) => {
    try {
      const pairs = await storage.getTradingPairs();
      res.json(pairs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch markets" });
    }
  });

  app.get("/api/markets/:pair/ohlcv", cacheMiddleware(300), async (req, res) => {
    try {
      const { pair } = req.params;
      const { timeframe = "1h", limit = "100" } = req.query;
      const ohlcv = await defaultExchange.getOHLCV(pair, timeframe as string, parseInt(limit as string));
      res.json(ohlcv);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch OHLCV data" });
    }
  });

  app.get("/api/markets/:pair/orderbook", cacheMiddleware(60), async (req, res) => {
    try {
      const { pair } = req.params;
      const orderBook = await defaultExchange.getOrderBook(pair);
      res.json(orderBook);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order book" });
    }
  });

  app.get("/api/portfolio/:mode", optionalAuth, async (req, res) => {
    try {
      const { mode } = req.params;
      if (mode !== "paper" && mode !== "live") {
        return res.status(400).json({ error: "Invalid mode" });
      }
      const portfolio = await storage.getPortfolio(mode);
      res.json(portfolio);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch portfolio" });
    }
  });

  app.get("/api/trades", optionalAuth, async (req, res) => {
    try {
      const { botId, mode } = req.query;
      const trades = await storage.getTrades(botId as string, mode as any);
      res.json(trades);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trades" });
    }
  });

  app.post("/api/trades", authenticateToken, tradeLimiter, async (req, res) => {
    try {
      const validated = insertTradeSchema.parse(req.body);

      if (validated.mode === "paper") {
        const result = await paperTradingService.executeTrade(
          validated.pair,
          validated.side,
          validated.type === "stop-loss" ? "limit" : validated.type,
          validated.amount,
          validated.price,
          validated.botId
        );

        if (result.success) {
          const portfolio = await storage.getPortfolio("paper");
          broadcastUpdate("portfolio_update", { mode: "paper", portfolio });
          broadcastUpdate("trade_executed", result.trade);
          res.json(result.trade);
        } else {
          res.status(400).json({ error: result.error });
        }
      } else {
        res.status(501).json({ error: "Live trading not implemented yet" });
      }
    } catch (error) {
      res.status(400).json({ error: "Invalid trade data" });
    }
  });

  app.get("/api/bots", optionalAuth, async (req, res) => {
    try {
      const bots = await storage.getBots();
      res.json(bots);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bots" });
    }
  });

  app.get("/api/bots/:id", optionalAuth, async (req, res) => {
    try {
      const bot = await storage.getBotById(req.params.id);
      if (!bot) {
        return res.status(404).json({ error: "Bot not found" });
      }
      res.json(bot);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bot" });
    }
  });

  app.post("/api/bots", authenticateToken, async (req, res) => {
    try {
      const validated = insertBotConfigSchema.parse(req.body);
      const bot = await storage.createBot(validated);
      broadcastUpdate("bot_created", bot);
      res.json(bot);
    } catch (error) {
      res.status(400).json({ error: "Invalid bot configuration" });
    }
  });

  app.patch("/api/bots/:id", authenticateToken, async (req, res) => {
    try {
      const bot = await storage.updateBot(req.params.id, req.body);
      if (!bot) {
        return res.status(404).json({ error: "Bot not found" });
      }
      broadcastUpdate("bot_updated", bot);
      res.json(bot);
    } catch (error) {
      res.status(500).json({ error: "Failed to update bot" });
    }
  });

  app.delete("/api/bots/:id", authenticateToken, async (req, res) => {
    try {
      const success = await storage.deleteBot(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Bot not found" });
      }
      broadcastUpdate("bot_deleted", { id: req.params.id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete bot" });
    }
  });

  app.post("/api/bots/:id/start", authenticateToken, async (req, res) => {
    try {
      const result = await botRunner.startBot(req.params.id);
      if (result.success) {
        const bot = await storage.getBotById(req.params.id);
        broadcastUpdate("bot_status_changed", bot);
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to start bot" });
    }
  });

  app.post("/api/bots/:id/stop", authenticateToken, async (req, res) => {
    try {
      const result = await botRunner.stopBot(req.params.id);
      if (result.success) {
        const bot = await storage.getBotById(req.params.id);
        broadcastUpdate("bot_status_changed", bot);
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to stop bot" });
    }
  });

  app.get("/api/bots/:id/model", optionalAuth, async (req, res) => {
    try {
      const model = await storage.getMLModelState(req.params.id);
      if (!model) {
        return res.status(404).json({ error: "Model not found" });
      }
      res.json(model);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch model" });
    }
  });

  app.get("/api/bots/:id/performance", optionalAuth, async (req, res) => {
    try {
      const metrics = await storage.getPerformanceMetrics(req.params.id);
      if (!metrics) {
        return res.status(404).json({ error: "Metrics not found" });
      }
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  app.get("/api/fees", async (req, res) => {
    try {
      const { volumeUSD = "0" } = req.query;
      const fees = krakenService.getFees(parseFloat(volumeUSD as string));
      res.json(fees);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch fees" });
    }
  });

  // Switch default exchange at runtime (requires auth)
  app.post('/api/exchange/switch', authenticateToken, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Missing exchange name' });
      const ex = setDefaultExchange(name);
      await ex.connect();
      broadcastUpdate('exchange_changed', { exchange: name });
      res.json({ success: true, exchange: name });
    } catch (error) {
      res.status(500).json({ error: 'Failed to switch exchange' });
    }
  });

  app.post("/api/fees/calculate", async (req, res) => {
    try {
      const { amount, price, side, isMaker, volumeUSD } = req.body;
      const result = krakenService.calculateTotalWithFee(
        amount,
        price,
        side,
        isMaker || false,
        volumeUSD || 0
      );
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: "Invalid calculation parameters" });
    }
  });

  app.get("/api/status", async (req, res) => {
    try {
      const runningBots = await botRunner.getRunningBots();
      res.json({
        krakenConnected: krakenService.isConnected(),
        runningBots: runningBots.length,
        timestamp: Date.now(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch status" });
    }
  });

  // Integration endpoints for external frameworks (freqtrade / jesse)
  // Handled by a separate router to keep this file smaller and optional
  app.use('/api/integrations', integrationsRoutes);

  app.get("/api/recommendations", async (req, res) => {
    try {
      const recommendations = await marketAnalysisService.getTradingRecommendations();
      res.setHeader('Content-Type', 'application/json');
      res.json(recommendations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trading recommendations" });
    }
  });

  app.get("/api/recommendations/:pair", async (req, res) => {
    try {
      const { pair } = req.params;
      const recommendation = await marketAnalysisService.getPairRecommendation(pair);
      if (!recommendation) {
        return res.status(404).json({ error: "Pair not found or insufficient data" });
      }
      res.json(recommendation);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pair recommendation" });
    }
  });

  app.post("/api/recommendations/optimize", authenticateToken, async (req, res) => {
    try {
      const { pair, currentConfig } = req.body;

      // Get pair analysis
      const pairAnalysis = await marketAnalysisService.getPairRecommendation(pair);
      if (!pairAnalysis) {
        return res.status(404).json({ error: "Pair not found or insufficient data" });
      }

      // Optimize parameters based on current bot performance
      const optimization = {
        recommendedConfig: {
          tradingPair: pair,
          riskPerTrade: pairAnalysis.recommendedRiskPerTrade,
          stopLoss: pairAnalysis.recommendedStopLoss,
          takeProfit: pairAnalysis.recommendedTakeProfit,
          maxPositionSize: Math.min(1000, pairAnalysis.currentPrice * 10), // Max 10 units at current price
        },
        reasoning: pairAnalysis.reasoning,
        expectedPerformance: {
          estimatedWinRate: Math.min(60, 40 + pairAnalysis.profitabilityScore * 2),
          estimatedProfitFactor: Math.max(1.1, 1 + pairAnalysis.profitabilityScore * 0.1),
          riskAdjustedReturn: pairAnalysis.profitabilityScore * pairAnalysis.confidence,
        },
        alternatives: {
          conservative: {
            riskPerTrade: pairAnalysis.recommendedRiskPerTrade * 0.5,
            stopLoss: pairAnalysis.recommendedStopLoss * 1.5,
            takeProfit: pairAnalysis.recommendedTakeProfit * 0.8,
          },
          aggressive: {
            riskPerTrade: Math.min(10, pairAnalysis.recommendedRiskPerTrade * 2),
            stopLoss: pairAnalysis.recommendedStopLoss * 0.7,
            takeProfit: pairAnalysis.recommendedTakeProfit * 1.5,
          },
        },
      };

      res.json(optimization);
    } catch (error) {
      res.status(500).json({ error: "Failed to optimize bot configuration" });
    }
  });

  return httpServer;
}
