import type { BotConfig, MarketData } from "@shared/schema";
import { storage } from "../storage";
import { krakenService } from "./krakenService";
import { mlEngine, MLEngine } from "./mlEngine";
import { paperTradingService } from "./paperTradingService";
import { EnsembleEngine } from "./ensembleEngine";
import { RiskManagementEngine } from "./riskManagementEngine";
import { tradingOrchestrator } from './tradingOrchestrator';

interface RunningBot {
  config: BotConfig;
  ensembleEngine: EnsembleEngine;
  intervalId: NodeJS.Timeout | null;
  qTable: Record<string, Record<string, number>>;
  position: "long" | "short" | null;
  entryPrice: number | null;
  trainingEpisodes: number;
  totalReward: number;
}

export class BotRunner {
  private runningBots: Map<string, RunningBot>;
  private riskEngine: RiskManagementEngine;

  constructor() {
    this.runningBots = new Map();
    this.riskEngine = new RiskManagementEngine();
    // Start trading framework adapters (freqtrade/jesse) as background helpers
    try {
      tradingOrchestrator.startAll();
    } catch (e) {
      // ignore failures to start adapters at runtime
    }
  }

  async startBot(botId: string): Promise<{ success: boolean; message: string }> {
    try {
      const config = await storage.getBotById(botId);
      if (!config) {
        return { success: false, message: "Bot not found" };
      }

      if (this.runningBots.has(botId)) {
        return { success: false, message: "Bot is already running" };
      }

      const ensembleEngine = new EnsembleEngine();
      await ensembleEngine.initialize(botId);

      // Load existing Q-table
      const existingModel = await storage.getMLModelState(botId);

      const runningBot: RunningBot = {
        config,
        ensembleEngine,
        intervalId: null,
        qTable: existingModel?.qTable || {},
        position: null,
        entryPrice: null,
        trainingEpisodes: existingModel?.trainingEpisodes || 0,
        totalReward: existingModel?.totalReward || 0,
      };

      await storage.updateBot(botId, { status: "running" });

      runningBot.intervalId = setInterval(async () => {
        await this.executeBotCycle(botId);
      }, 30000); // Run every 30 seconds

      this.runningBots.set(botId, runningBot);

      return { success: true, message: "Bot started successfully" };
    } catch (error) {
      console.error("Error starting bot:", error);
      return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async stopBot(botId: string): Promise<{ success: boolean; message: string }> {
    const runningBot = this.runningBots.get(botId);
    if (!runningBot) {
      return { success: false, message: "Bot is not running" };
    }

    if (runningBot.intervalId) {
      clearInterval(runningBot.intervalId);
    }

    // Save ensemble model
    await runningBot.ensembleEngine.saveModel(botId);

    await storage.updateBot(botId, { status: "stopped" });

    this.runningBots.delete(botId);

    return { success: true, message: "Bot stopped successfully" };
  }

  private async executeBotCycle(botId: string): Promise<void> {
    const runningBot = this.runningBots.get(botId);
    if (!runningBot) return;

    try {
      const { config, ensembleEngine, qTable } = runningBot;

      // Get real-time market data from Kraken
      const ohlcv = await krakenService.getOHLCV(config.tradingPair, "1h", 100);
      if (ohlcv.length < 50) {
        console.log(`Not enough market data for bot ${botId} (${ohlcv.length} data points)`);
        return;
      }

      // Convert OHLCV to MarketData format and save to storage
      const marketData = ohlcv.map(([timestamp, open, high, low, close, volume]) => ({
        pair: config.tradingPair,
        timestamp,
        open,
        high,
        low,
        close,
        volume,
      }));

      // Save latest market data
      for (const data of marketData.slice(-10)) {
        await storage.saveMarketData(data);
      }

      const currentIndex = marketData.length - 1;
      const currentPrice = marketData[currentIndex].close;

      // Check risk management limits
      const portfolio = await storage.getPortfolio("paper");
      const riskCheck = await this.riskEngine.shouldStopTrading(botId, portfolio);

      if (riskCheck.shouldStop) {
        console.log(`Bot ${botId} stopped due to risk management: ${riskCheck.reason}`);
        await this.stopBot(botId);
        return;
      }

      // Get ensemble prediction (internal models)
      ensembleEngine.setQTable(qTable);
      const ensemblePrediction = await ensembleEngine.predict(marketData.slice(0, currentIndex + 1));

      // Get external framework ensemble (freqtrade + jesse)
      const external = await tradingOrchestrator.getEnsemblePrediction({ marketData, botConfig: config }).catch(() => ({ action: 'hold', confidence: 0, votes: [] }));

      // Combine internal + external using weighted voting
      // Each source contributes its confidence weight
      const votes: { action: string; confidence: number; source: string }[] = [];
      if (ensemblePrediction && typeof ensemblePrediction.confidence === 'number') {
        votes.push({ action: ensemblePrediction.action, confidence: ensemblePrediction.confidence, source: 'ensemble' });
      } else if (ensemblePrediction && ensemblePrediction.action) {
        votes.push({ action: ensemblePrediction.action, confidence: 0.6, source: 'ensemble' });
      }
      if (external && external.votes && Array.isArray(external.votes)) {
        for (const v of external.votes) votes.push({ action: v.action, confidence: v.confidence || 0.5, source: v.source || 'external' });
      }

      // Tally
      const tally: Record<string, number> = {};
      let totalWeight = 0;
      for (const v of votes) {
        tally[v.action] = (tally[v.action] || 0) + v.confidence;
        totalWeight += v.confidence;
      }
      let action = 'hold';
      let best = 0;
      for (const k of Object.keys(tally)) {
        if (tally[k] > best) {
          best = tally[k];
          action = k;
        }
      }
      const combinedConfidence = totalWeight > 0 ? best / totalWeight : 0;

      // Calculate position size with risk management
      const positionSize = this.riskEngine.calculatePositionSize(config, portfolio, currentPrice);

      // Stop-loss and take-profit checks
      if (runningBot.position && runningBot.entryPrice) {
        const stopLossPrice = this.riskEngine.calculateDynamicStopLoss(
          runningBot.entryPrice,
          currentPrice,
          config
        );

        const takeProfitPrice = this.riskEngine.calculateTakeProfit(runningBot.entryPrice, config);

        let shouldClose = false;
        let closeReason = '';

        if (runningBot.position === "long") {
          if (currentPrice <= stopLossPrice) {
            shouldClose = true;
            closeReason = 'stop-loss';
          } else if (currentPrice >= takeProfitPrice) {
            shouldClose = true;
            closeReason = 'take-profit';
          }
        } else { // short position
          if (currentPrice >= stopLossPrice) {
            shouldClose = true;
            closeReason = 'stop-loss';
          } else if (currentPrice <= takeProfitPrice) {
            shouldClose = true;
            closeReason = 'take-profit';
          }
        }

        if (shouldClose) {
          console.log(`Bot ${botId} closing position via ${closeReason} at ${currentPrice}`);
          const result = await paperTradingService.executeTrade(
            config.tradingPair,
            runningBot.position === "long" ? "sell" : "buy",
            "market",
            positionSize,
            currentPrice,
            botId
          );

          if (result.success) {
            const reward = ensembleEngine.calculateReward(
              "sell",
              runningBot.entryPrice,
              currentPrice,
              runningBot.position
            );
            runningBot.totalReward += reward;

            const profitLoss = runningBot.position === "long"
              ? (currentPrice - runningBot.entryPrice) * positionSize
              : (runningBot.entryPrice - currentPrice) * positionSize;
            const profitLossPercent = ((currentPrice - runningBot.entryPrice) / runningBot.entryPrice) * 100 *
              (runningBot.position === "long" ? 1 : -1);

            runningBot.position = null;
            runningBot.entryPrice = null;
            runningBot.trainingEpisodes++;

            console.log(`Bot ${botId} ${closeReason} executed at ${currentPrice}, P&L: $${profitLoss.toFixed(2)} (${profitLossPercent.toFixed(2)}%), reward: ${reward.toFixed(4)}`);

            const isWin = profitLoss > 0;
            await storage.updateBot(botId, {
              profitLoss: config.profitLoss + profitLoss,
              successfulTrades: config.successfulTrades + (isWin ? 1 : 0),
              failedTrades: config.failedTrades + (isWin ? 0 : 1),
              winRate: ((config.successfulTrades + (isWin ? 1 : 0)) / (config.totalTrades + 1)) * 100,
            });
          }
          return;
        }
      }

      // Execute new trades
      if (action === "buy" && runningBot.position === null) {
        // Check if we have enough balance
        if (portfolio.availableBalance < positionSize * currentPrice * 1.01) {
          console.log(`Bot ${botId} insufficient balance for trade`);
          return;
        }

        const result = await paperTradingService.executeTrade(
          config.tradingPair,
          "buy",
          "market",
          positionSize,
          currentPrice,
          botId
        );

          if (result.success) {
          runningBot.position = "long";
          runningBot.entryPrice = currentPrice;
          console.log(`Bot ${botId} opened long position at ${currentPrice}, size: ${positionSize.toFixed(6)}`);

          await storage.updateBot(botId, {
            totalTrades: config.totalTrades + 1,
          });

          // Save trade to storage
          await storage.createTrade(result.trade);
        }
      } else if (action === "sell" && runningBot.position === "long") {
        const result = await paperTradingService.executeTrade(
          config.tradingPair,
          "sell",
          "market",
          positionSize,
          currentPrice,
          botId
        );

        if (result.success && runningBot.entryPrice) {
          const reward = ensembleEngine.calculateReward(action, runningBot.entryPrice, currentPrice, runningBot.position);
          runningBot.totalReward += reward;

          const profitLoss = (currentPrice - runningBot.entryPrice) * positionSize;
          const profitLossPercent = ((currentPrice - runningBot.entryPrice) / runningBot.entryPrice) * 100;

          // Update Q-table for learning
          if (currentIndex < marketData.length - 1) {
            const state = ensembleEngine.deriveState(marketData, currentIndex);
            const nextState = ensembleEngine.deriveState(marketData, currentIndex + 1);
            ensembleEngine.updateQValue(state, action, reward, nextState);
          }

          runningBot.position = null;
          runningBot.entryPrice = null;
          runningBot.trainingEpisodes++;

          console.log(`Bot ${botId} closed position at ${currentPrice}, P&L: $${profitLoss.toFixed(2)} (${profitLossPercent.toFixed(2)}%), reward: ${reward.toFixed(4)}`);

          const isWin = profitLoss > 0;
          await storage.updateBot(botId, {
            profitLoss: config.profitLoss + profitLoss,
            successfulTrades: config.successfulTrades + (isWin ? 1 : 0),
            failedTrades: config.failedTrades + (isWin ? 0 : 1),
            winRate: ((config.successfulTrades + (isWin ? 1 : 0)) / (config.totalTrades + 1)) * 100,
          });

          // Save trade to storage
          await storage.createTrade({
            botId,
            pair: config.tradingPair,
            side: "sell",
            type: "market",
            amount: positionSize,
            price: currentPrice,
            fee: result.trade.fee,
            total: result.trade.total,
            totalWithFee: result.trade.totalWithFee,
            status: "completed",
            mode: config.mode,
          });
        }
      }

      // Save model periodically
      if (runningBot.trainingEpisodes % 10 === 0) {
        await ensembleEngine.saveModel(botId);
        console.log(`Bot ${botId} saved ensemble model after ${runningBot.trainingEpisodes} episodes`);
      }

      // Log bot status every 10 cycles
        if (runningBot.trainingEpisodes % 10 === 0) {
        const trades = await storage.getTrades(botId, "paper");
        const totalTrades = config.totalTrades;
        const winRate = config.winRate || 0;
        const totalPnL = config.profitLoss || 0;

  console.log(`Bot ${botId} status: Episodes: ${runningBot.trainingEpisodes}, Total Trades: ${totalTrades}, Win Rate: ${winRate.toFixed(1)}%, Total P&L: $${totalPnL.toFixed(2)}, Total Reward: ${runningBot.totalReward.toFixed(4)}, Ensemble Confidence: ${combinedConfidence.toFixed(2)}`);
      }
    } catch (error) {
      console.error(`Error in bot cycle for ${botId}:`, error);
    }
  }

  async getRunningBots(): Promise<string[]> {
    return Array.from(this.runningBots.keys());
  }

  isRunning(botId: string): boolean {
    return this.runningBots.has(botId);
  }
}

export const botRunner = new BotRunner();
