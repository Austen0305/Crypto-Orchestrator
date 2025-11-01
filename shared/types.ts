// Add to existing schema.ts file

export interface RateLimitInfo {
  remaining: number;
  reset: number;
}

export interface OrderParameters {
  symbol: string;
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
}

export interface OrderResult {
  success: boolean;
  orderId: string;
  executedPrice: number;
  executedAmount: number;
  status: string;
  error?: string;
}

export interface SystemHealth {
  isHealthy: boolean;
  lastCheck: number;
  errors: string[];
  warnings: string[];
  apiQuota: RateLimitInfo;
  metrics: {
    latency: number;
    successRate: number;
    errorRate: number;
  };
}