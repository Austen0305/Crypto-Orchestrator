import { apiRequest, getQueryFn } from "./queryClient";
import type {
  BotConfig,
  InsertBotConfig,
  Trade,
  Portfolio,
  TradingPair,
  MLModelState,
  PerformanceMetrics,
} from "../../../shared/schema";

// Bot API functions
export const botApi = {
  getBots: () => apiRequest("GET", "/api/bots").then((res) => res.json()),
  getBot: (id: string) =>
    apiRequest("GET", `/api/bots/${id}`).then((res) => res.json()),
  createBot: (bot: InsertBotConfig) =>
    apiRequest("POST", "/api/bots", bot).then((res) => res.json()),
  updateBot: (id: string, updates: Partial<BotConfig>) =>
    apiRequest("PATCH", `/api/bots/${id}`, updates).then((res) => res.json()),
  deleteBot: (id: string) =>
    apiRequest("DELETE", `/api/bots/${id}`).then((res) => res.json()),
  startBot: (id: string) =>
    apiRequest("POST", `/api/bots/${id}/start`).then((res) => res.json()),
  stopBot: (id: string) =>
    apiRequest("POST", `/api/bots/${id}/stop`).then((res) => res.json()),
  getBotModel: (id: string) =>
    apiRequest("GET", `/api/bots/${id}/model`).then((res) => res.json()),
  getBotPerformance: (id: string) =>
    apiRequest("GET", `/api/bots/${id}/performance`).then((res) => res.json()),
};

// Trade API functions
export const tradeApi = {
  getTrades: (botId?: string, mode?: "paper" | "live") => {
    const params = new URLSearchParams();
    if (botId) params.append("botId", botId);
    if (mode) params.append("mode", mode);
    const query = params.toString() ? `?${params.toString()}` : "";
    return apiRequest("GET", `/api/trades${query}`).then((res) => res.json());
  },
  createTrade: (trade: any) =>
    apiRequest("POST", "/api/trades", trade).then((res) => res.json()),
};

// Portfolio API functions
export const portfolioApi = {
  getPortfolio: (mode: "paper" | "live") =>
    apiRequest("GET", `/api/portfolio/${mode}`).then((res) => res.json()),
};

// Market API functions
export const marketApi = {
  getMarkets: () =>
    apiRequest("GET", "/api/markets").then((res) => res.json()),
  getOHLCV: (pair: string, timeframe = "1h", limit = 100) =>
    apiRequest("GET", `/api/markets/${pair}/ohlcv?timeframe=${timeframe}&limit=${limit}`).then((res) => res.json()),
  getOrderBook: (pair: string) =>
    apiRequest("GET", `/api/markets/${pair}/orderbook`).then((res) => res.json()),
};

// Fee API functions
export const feeApi = {
  getFees: (volumeUSD = 0) =>
    apiRequest("GET", `/api/fees?volumeUSD=${volumeUSD}`).then((res) => res.json()),
  calculateFees: (data: { amount: number; price: number; side: "buy" | "sell"; isMaker?: boolean; volumeUSD?: number }) =>
    apiRequest("POST", "/api/fees/calculate", data).then((res) => res.json()),
};

// Status API functions
export const statusApi = {
  getStatus: () =>
    apiRequest("GET", "/api/status").then((res) => res.json()),
};

// Integrations API
export const integrationsApi = {
  predict: (payload: any) => apiRequest('POST', '/api/integrations/predict', payload).then((r) => r.json()),
  backtest: (payload: any) => apiRequest('POST', '/api/integrations/backtest', payload).then((r) => r.json()),
  ping: () => apiRequest('GET', '/api/integrations/ping').then((r) => r.json()),
  startAll: () => apiRequest('POST', '/api/integrations/start-all').then((r) => r.json()),
  stopAll: () => apiRequest('POST', '/api/integrations/stop-all').then((r) => r.json()),
};
