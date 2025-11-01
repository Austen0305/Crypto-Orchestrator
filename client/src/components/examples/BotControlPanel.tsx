import { BotControlPanel } from "../BotControlPanel";

const mockBots = [
  {
    id: "bot-1",
    name: "ML Trend Follower",
    strategy: "LSTM Price Prediction",
    status: "running" as const,
    mode: "paper" as const,
    tradingPair: "BTC/USD",
    maxPositionSize: 1000,
    stopLoss: 0.05,
    takeProfit: 0.10,
    riskPerTrade: 0.02,
    profitLoss: 3245,
    winRate: 68,
    totalTrades: 142,
    successfulTrades: 97,
    failedTrades: 45,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
  },
  {
    id: "bot-2",
    name: "RSI Scalper",
    strategy: "Mean Reversion",
    status: "running" as const,
    mode: "live" as const,
    tradingPair: "ETH/USD",
    maxPositionSize: 500,
    stopLoss: 0.03,
    takeProfit: 0.08,
    riskPerTrade: 0.01,
    profitLoss: 1820,
    winRate: 72,
    totalTrades: 89,
    successfulTrades: 64,
    failedTrades: 25,
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now(),
  },
  {
    id: "bot-3",
    name: "Grid Trading Bot",
    strategy: "Grid Strategy",
    status: "stopped" as const,
    mode: "paper" as const,
    tradingPair: "ADA/USD",
    maxPositionSize: 200,
    stopLoss: 0.02,
    takeProfit: 0.05,
    riskPerTrade: 0.005,
    profitLoss: -450,
    winRate: 45,
    totalTrades: 56,
    successfulTrades: 25,
    failedTrades: 31,
    createdAt: Date.now() - 259200000,
    updatedAt: Date.now(),
  },
];

export default function BotControlPanelExample() {
  return (
    <div className="max-w-3xl p-4">
      <BotControlPanel bots={mockBots} />
    </div>
  );
}
