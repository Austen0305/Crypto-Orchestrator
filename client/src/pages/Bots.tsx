import { BotControlPanel } from "@/components/BotControlPanel";
import { BotCreator } from "@/components/BotCreator";
import { useBots, useStatus } from "@/hooks/useApi";
import { Loader2 } from "lucide-react";

export default function Bots() {
  const { data: bots, isLoading: botsLoading, error: botsError } = useBots();
  const { data: status } = useStatus();

  if (botsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading bots...</span>
      </div>
    );
  }

  if (botsError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-destructive">Error Loading Bots</h2>
          <p className="text-muted-foreground mt-2">
            Failed to load bot data. Please check your connection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trading Bots</h1>
          <p className="text-muted-foreground mt-1">
            Manage your automated trading strategies
            {status && (
              <span className="block text-sm mt-1">
                {status.runningBots} bots running • Kraken {status.krakenConnected ? "Connected" : "Disconnected"}
              </span>
            )}
          </p>
        </div>
        <BotCreator />
      </div>

      {bots && bots.length > 0 ? (
        <BotControlPanel bots={bots} />
      ) : (
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            <p className="text-lg mb-2">No trading bots yet</p>
            <p className="text-sm">Create your first bot to start automated trading</p>
          </div>
        </div>
      )}
    </div>
  );
}
