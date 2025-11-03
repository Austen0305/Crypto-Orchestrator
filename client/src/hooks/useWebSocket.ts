import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const connectWebSocket = () => {
      const wsBase =
        (typeof window !== 'undefined' && (window as any).__WS_BASE__) ||
        (import.meta as any)?.env?.VITE_WS_BASE_URL ||
        // derive from API_BASE if present
        (() => {
          const api = (typeof window !== 'undefined' && (window as any).__API_BASE__) || (import.meta as any)?.env?.VITE_API_BASE_URL || '';
          if (api.startsWith('http')) {
            return api.replace(/^http/, 'ws');
          }
          return 'ws://localhost:8000';
        })();
      const ws = new WebSocket(`${wsBase}/api/ws`);

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
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
        setIsConnected(false);
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

  const sendMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  return { ws: wsRef.current, isConnected, sendMessage };
};
