import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

export const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket(`ws://localhost:5000/ws`);

      ws.onopen = () => {
        console.log("WebSocket connected");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("WebSocket message:", data);

          // Handle different message types
          switch (data.type) {
            case "market_data":
              queryClient.invalidateQueries({ queryKey: ["markets"] });
              break;
            case "portfolio_update":
              queryClient.invalidateQueries({ queryKey: ["portfolio", data.data.mode] });
              break;
            case "trade_executed":
              queryClient.invalidateQueries({ queryKey: ["trades"] });
              break;
            case "bot_created":
            case "bot_updated":
            case "bot_deleted":
            case "bot_status_changed":
              queryClient.invalidateQueries({ queryKey: ["bots"] });
              queryClient.invalidateQueries({ queryKey: ["status"] });
              break;
            default:
              console.log("Unknown WebSocket message type:", data.type);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected, attempting to reconnect...");
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [queryClient]);

  return wsRef.current;
};
