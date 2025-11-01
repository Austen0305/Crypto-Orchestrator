import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { botApi, tradeApi, portfolioApi, marketApi, feeApi, statusApi, integrationsApi } from "@/lib/api";
import type { InsertBotConfig, BotConfig } from "../../../shared/schema";

// Bot hooks
export const useBots = () => {
  return useQuery({
    queryKey: ["bots"],
    queryFn: botApi.getBots,
    refetchInterval: 5000, // Refetch every 5 seconds
  });
};

export const useBot = (id: string) => {
  return useQuery({
    queryKey: ["bots", id],
    queryFn: () => botApi.getBot(id),
    enabled: !!id,
  });
};

export const useCreateBot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: botApi.createBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
    },
  });
};

export const useUpdateBot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<BotConfig> }) =>
      botApi.updateBot(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
    },
  });
};

export const useDeleteBot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: botApi.deleteBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
    },
  });
};

export const useStartBot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: botApi.startBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
    },
  });
};

export const useStopBot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: botApi.stopBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      queryClient.invalidateQueries({ queryKey: ["status"] });
    },
  });
};

export const useBotModel = (id: string) => {
  return useQuery({
    queryKey: ["bots", id, "model"],
    queryFn: () => botApi.getBotModel(id),
    enabled: !!id,
  });
};

export const useBotPerformance = (id: string) => {
  return useQuery({
    queryKey: ["bots", id, "performance"],
    queryFn: () => botApi.getBotPerformance(id),
    enabled: !!id,
  });
};

// Trade hooks
export const useTrades = (botId?: string, mode?: "paper" | "live") => {
  return useQuery({
    queryKey: ["trades", botId, mode],
    queryFn: () => tradeApi.getTrades(botId, mode),
    refetchInterval: 2000, // Refetch every 2 seconds for live updates
  });
};

export const useCreateTrade = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tradeApi.createTrade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
};

// Portfolio hooks
export const usePortfolio = (mode: "paper" | "live" = "paper") => {
  return useQuery({
    queryKey: ["portfolio", mode],
    queryFn: () => portfolioApi.getPortfolio(mode),
    refetchInterval: 3000, // Refetch every 3 seconds
  });
};

// Market hooks
export const useMarkets = () => {
  return useQuery({
    queryKey: ["markets"],
    queryFn: marketApi.getMarkets,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
};

export const useOHLCV = (pair: string, timeframe = "1h", limit = 100) => {
  return useQuery({
    queryKey: ["ohlcv", pair, timeframe, limit],
    queryFn: () => marketApi.getOHLCV(pair, timeframe, limit),
    enabled: !!pair,
  });
};

export const useOrderBook = (pair: string) => {
  return useQuery({
    queryKey: ["orderbook", pair],
    queryFn: () => marketApi.getOrderBook(pair),
    enabled: !!pair,
    refetchInterval: 5000, // Refetch every 5 seconds
  });
};

// Fee hooks
export const useFees = (volumeUSD = 0) => {
  return useQuery({
    queryKey: ["fees", volumeUSD],
    queryFn: () => feeApi.getFees(volumeUSD),
  });
};

export const useCalculateFees = () => {
  return useMutation({
    mutationFn: feeApi.calculateFees,
  });
};

// Status hooks
export const useStatus = () => {
  return useQuery({
    queryKey: ["status"],
    queryFn: statusApi.getStatus,
    refetchInterval: 5000, // Refetch every 5 seconds
  });
};

// Integrations hooks
export const useIntegrationsStatus = () => {
  return useQuery({
    queryKey: ['integrations', 'status'],
    queryFn: () => integrationsApi.status(),
    refetchInterval: 5000,
  });
};

export const useStartIntegrations = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => integrationsApi.startAll(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations', 'status'] }),
  });
};

export const useStopIntegrations = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => integrationsApi.stopAll(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations', 'status'] }),
  });
};
