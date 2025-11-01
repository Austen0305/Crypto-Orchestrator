import {
  type Trade,
  type InsertTrade,
  type BotConfig,
  type InsertBotConfig,
  type MLModelState,
  type InsertMLModelState,
  type Portfolio,
  type TradingPair,
  type PerformanceMetrics,
  type MarketData,
  type TradingMode,
  type User,
  type InsertUser,
  type Notification,
  type InsertNotification,
  type BacktestResult,
  type ApiKey,
  type InsertApiKey,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getTrades(botId?: string, mode?: TradingMode): Promise<Trade[]>;
  getTradeById(id: string): Promise<Trade | undefined>;
  createTrade(trade: InsertTrade): Promise<Trade>;

  getBots(): Promise<BotConfig[]>;
  getBotById(id: string): Promise<BotConfig | undefined>;
  createBot(bot: InsertBotConfig): Promise<BotConfig>;
  updateBot(id: string, updates: Partial<BotConfig>): Promise<BotConfig | undefined>;
  deleteBot(id: string): Promise<boolean>;

  getMLModelState(botId: string): Promise<MLModelState | undefined>;
  saveMLModelState(state: InsertMLModelState): Promise<MLModelState>;
  updateMLModelState(id: string, updates: Partial<MLModelState>): Promise<MLModelState | undefined>;

  getPortfolio(mode: TradingMode): Promise<Portfolio>;
  updatePortfolio(mode: TradingMode, portfolio: Portfolio): Promise<Portfolio>;

  getTradingPairs(): Promise<TradingPair[]>;
  updateTradingPairs(pairs: TradingPair[]): Promise<void>;

  getPerformanceMetrics(botId: string): Promise<PerformanceMetrics | undefined>;
  savePerformanceMetrics(metrics: PerformanceMetrics): Promise<void>;

  getMarketData(pair: string, limit?: number): Promise<MarketData[]>;
  saveMarketData(data: MarketData): Promise<void>;
  getMarketDataForPeriod(pair: string, startDate: number, endDate: number): Promise<MarketData[]>;

  saveBacktestResult(result: Omit<BacktestResult, 'id' | 'createdAt'>): Promise<BacktestResult>;
  getBacktestResults(botId: string): Promise<BacktestResult[]>;

  // User authentication methods
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // Notification methods
  getNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<boolean>;
  deleteNotification(id: string): Promise<boolean>;

  // API Key methods
  getApiKeysByUserId(userId: string): Promise<ApiKey[]>;
  getApiKeyById(id: string): Promise<ApiKey | undefined>;
  getApiKeyByKey(key: string): Promise<ApiKey | undefined>;
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  updateApiKey(id: string, updates: Partial<ApiKey>): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private trades: Map<string, Trade>;
  private bots: Map<string, BotConfig>;
  private mlModels: Map<string, MLModelState>;
  private portfolios: Map<TradingMode, Portfolio>;
  private tradingPairs: TradingPair[];
  private performanceMetrics: Map<string, PerformanceMetrics>;
  private marketData: Map<string, MarketData[]>;
  private users: Map<string, User>;
  private notifications: Map<string, Notification>;
  private backtestResults: Map<string, BacktestResult>;
  private apiKeys: Map<string, ApiKey>;

  constructor() {
    this.trades = new Map();
    this.bots = new Map();
    this.mlModels = new Map();
    this.portfolios = new Map();
    this.tradingPairs = [];
    this.performanceMetrics = new Map();
    this.marketData = new Map();
    this.users = new Map();
    this.notifications = new Map();
    this.backtestResults = new Map();
    this.apiKeys = new Map();

    this.portfolios.set("paper", {
      totalBalance: 100000,
      availableBalance: 100000,
      positions: {},
      profitLoss24h: 0,
      profitLossTotal: 0,
    });

    this.portfolios.set("live", {
      totalBalance: 0,
      availableBalance: 0,
      positions: {},
      profitLoss24h: 0,
      profitLossTotal: 0,
    });
  }

  async getTrades(botId?: string, mode?: TradingMode): Promise<Trade[]> {
    let trades = Array.from(this.trades.values());
    if (botId) {
      trades = trades.filter((t) => t.botId === botId);
    }
    if (mode) {
      trades = trades.filter((t) => t.mode === mode);
    }
    return trades.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getTradeById(id: string): Promise<Trade | undefined> {
    return this.trades.get(id);
  }

  async createTrade(insertTrade: InsertTrade): Promise<Trade> {
    const id = randomUUID();
    const trade: Trade = {
      ...insertTrade,
      id,
      timestamp: Date.now(),
    };
    this.trades.set(id, trade);
    return trade;
  }

  async getBots(): Promise<BotConfig[]> {
    return Array.from(this.bots.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getBotById(id: string): Promise<BotConfig | undefined> {
    return this.bots.get(id);
  }

  async createBot(insertBot: InsertBotConfig): Promise<BotConfig> {
    const id = randomUUID();
    const now = Date.now();
    const bot: BotConfig = {
      ...insertBot,
      id,
      profitLoss: 0,
      winRate: 0,
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.bots.set(id, bot);
    return bot;
  }

  async updateBot(id: string, updates: Partial<BotConfig>): Promise<BotConfig | undefined> {
    const bot = this.bots.get(id);
    if (!bot) return undefined;

    const updated = {
      ...bot,
      ...updates,
      updatedAt: Date.now(),
    };
    this.bots.set(id, updated);
    return updated;
  }

  async deleteBot(id: string): Promise<boolean> {
    return this.bots.delete(id);
  }

  async getMLModelState(botId: string): Promise<MLModelState | undefined> {
    return Array.from(this.mlModels.values()).find((m) => m.botId === botId);
  }

  async saveMLModelState(insertState: InsertMLModelState): Promise<MLModelState> {
    const existing = await this.getMLModelState(insertState.botId);
    if (existing) {
      const updated: MLModelState = {
        ...existing,
        ...insertState,
        lastUpdated: Date.now(),
      };
      this.mlModels.set(existing.id, updated);
      return updated;
    }

    const id = randomUUID();
    const state: MLModelState = {
      ...insertState,
      id,
      lastUpdated: Date.now(),
    };
    this.mlModels.set(id, state);
    return state;
  }

  async updateMLModelState(id: string, updates: Partial<MLModelState>): Promise<MLModelState | undefined> {
    const state = this.mlModels.get(id);
    if (!state) return undefined;

    const updated: MLModelState = {
      ...state,
      ...updates,
      lastUpdated: Date.now(),
    };
    this.mlModels.set(id, updated);
    return updated;
  }

  async getPortfolio(mode: TradingMode): Promise<Portfolio> {
    return this.portfolios.get(mode) || {
      totalBalance: 0,
      availableBalance: 0,
      positions: {},
      profitLoss24h: 0,
      profitLossTotal: 0,
    };
  }

  async updatePortfolio(mode: TradingMode, portfolio: Portfolio): Promise<Portfolio> {
    this.portfolios.set(mode, portfolio);
    return portfolio;
  }

  async getTradingPairs(): Promise<TradingPair[]> {
    return this.tradingPairs;
  }

  async updateTradingPairs(pairs: TradingPair[]): Promise<void> {
    this.tradingPairs = pairs;
  }

  async getPerformanceMetrics(botId: string): Promise<PerformanceMetrics | undefined> {
    return this.performanceMetrics.get(botId);
  }

  async savePerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
    this.performanceMetrics.set(metrics.botId, metrics);
  }

  async getMarketData(pair: string, limit: number = 100): Promise<MarketData[]> {
    const data = this.marketData.get(pair) || [];
    return data.slice(-limit);
  }

  async saveMarketData(data: MarketData): Promise<void> {
    const existing = this.marketData.get(data.pair) || [];
    existing.push(data);
    if (existing.length > 1000) {
      existing.shift();
    }
    this.marketData.set(data.pair, existing);
  }

  async getMarketDataForPeriod(pair: string, startDate: number, endDate: number): Promise<MarketData[]> {
    const data = this.marketData.get(pair) || [];
    return data.filter(d => d.timestamp >= startDate && d.timestamp <= endDate);
  }

  async saveBacktestResult(result: Omit<BacktestResult, 'id' | 'createdAt'>): Promise<BacktestResult> {
    const id = randomUUID();
    const backtestResult: BacktestResult = {
      ...result,
      id,
      createdAt: Date.now(),
    };
    this.backtestResults.set(id, backtestResult);
    return backtestResult;
  }

  async getBacktestResults(botId: string): Promise<BacktestResult[]> {
    return Array.from(this.backtestResults.values())
      .filter(result => result.botId === botId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  // User authentication methods
  async getUserById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = Date.now();
    const user: User = {
      ...insertUser,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updated = {
      ...user,
      ...updates,
      updatedAt: Date.now(),
    };
    this.users.set(id, updated);
    return updated;
  }

  // Notification methods
  async getNotifications(userId: string): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const notification: Notification = {
      ...insertNotification,
      id,
      createdAt: Date.now(),
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    const notification = this.notifications.get(id);
    if (!notification) return false;

    const updated = {
      ...notification,
      read: true,
    };
    this.notifications.set(id, updated);
    return true;
  }

  async deleteNotification(id: string): Promise<boolean> {
    return this.notifications.delete(id);
  }

  // API Key methods
  async getApiKeysByUserId(userId: string): Promise<ApiKey[]> {
    return Array.from(this.apiKeys.values())
      .filter(apiKey => apiKey.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async getApiKeyById(id: string): Promise<ApiKey | undefined> {
    return this.apiKeys.get(id);
  }

  async getApiKeyByKey(key: string): Promise<ApiKey | undefined> {
    return Array.from(this.apiKeys.values()).find(apiKey => apiKey.key === key);
  }

  async createApiKey(insertApiKey: InsertApiKey): Promise<ApiKey> {
    const id = randomUUID();
    const now = Date.now();
    const apiKey: ApiKey = {
      ...insertApiKey,
      id,
      createdAt: now,
    };
    this.apiKeys.set(id, apiKey);
    return apiKey;
  }

  async updateApiKey(id: string, updates: Partial<ApiKey>): Promise<boolean> {
    const apiKey = this.apiKeys.get(id);
    if (!apiKey) return false;

    const updated = {
      ...apiKey,
      ...updates,
    };
    this.apiKeys.set(id, updated);
    return true;
  }
}

export const storage = new MemStorage();
