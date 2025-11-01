import type { RateLimitInfo } from '@shared/schema';
import logger from './logger';
import { safetyMonitor } from './safetyMonitor';
import { KrakenService } from './krakenService';

type OrderParameters = any;
type OrderResult = any;

export class EnhancedKrakenService extends KrakenService {
  private rateLimitInfo: RateLimitInfo = {
    remaining: 100,
    reset: Date.now() + 3600000,
  };

  private lastOrderCheck = new Map<string, number>();
  private readonly ORDER_CHECK_TIMEOUT = 30000; // 30 seconds

  constructor() {
    super();
    this.setupRateLimitTracking();
  }

  private setupRateLimitTracking(): void {
    // Track rate limits after each API call
  const originalRequest = this.exchange.request.bind(this.exchange);
  this.exchange.request = async (...args: any[]) => {
      try {
        const response = await originalRequest(...args);
        this.updateRateLimits(response.headers);
        return response;
      } catch (error) {
        this.handleAPIError(error);
        throw error;
      }
    };
  }

  private updateRateLimits(headers: any): void {
    const remaining = parseInt(headers['x-ratelimit-remaining'] || '100');
    const reset = parseInt(headers['x-ratelimit-reset'] || (Date.now() + 3600000).toString());

    this.rateLimitInfo = { remaining, reset };

    if (remaining < 10) {
      logger.warn(`API rate limit low: ${remaining} calls remaining`);
      safetyMonitor.emit('lowApiQuota', remaining);
    }
  }

  private handleAPIError(error: any): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown API error';
    logger.error(`Kraken API error: ${errorMessage}`);

    if (this.isRateLimitError(error)) {
      safetyMonitor.activateEmergencyStop('Rate limit exceeded');
    } else if (this.isConnectionError(error)) {
      safetyMonitor.emit('connectionError', errorMessage);
    }
  }

  private isRateLimitError(error: any): boolean {
    return error.message?.includes('Rate limit exceeded') || error.code === 'EAPI_RATE_LIMIT';
  }

  private isConnectionError(error: any): boolean {
    return error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED';
  }

  async validateOrderParameters(order: OrderParameters): Promise<boolean> {
    try {
      const { symbol, type, side, amount, price } = order;

      // Check minimum order size
      const market = await this.exchange.loadMarket(symbol);
      if (amount < market.limits.amount.min) {
        throw new Error(`Order amount ${amount} below minimum ${market.limits.amount.min}`);
      }

      // Check price precision
      if (price && market.precision.price) {
        const correctPrice = this.exchange.priceToPrecision(symbol, price);
        if (correctPrice !== price.toString()) {
          throw new Error(`Invalid price precision. Use ${correctPrice}`);
        }
      }

      // Check available balance
      const balance = await this.exchange.fetchBalance();
      const requiredCurrency = side === 'buy' ? market.quote : market.base;
      const available = balance[requiredCurrency]?.free || 0;

      if (side === 'buy' && price && available < price * amount) {
        throw new Error(`Insufficient ${requiredCurrency} balance`);
      } else if (side === 'sell' && available < amount) {
        throw new Error(`Insufficient ${requiredCurrency} balance`);
      }

      return true;
    } catch (error) {
      logger.error(`Order validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  async executeOrderWithSafety(orderParams: OrderParameters): Promise<OrderResult> {
    if (!this.isConnected()) {
      throw new Error('Exchange connection not established');
    }

    if (!safetyMonitor.isSystemHealthy()) {
      throw new Error('System health check failed');
    }

    const isValid = await this.validateOrderParameters(orderParams);
    if (!isValid) {
      throw new Error('Order validation failed');
    }

    try {
      const order = await this.exchange.createOrder(
        orderParams.symbol,
        orderParams.type,
        orderParams.side,
        orderParams.amount,
        orderParams.price
      );

      // Start monitoring the order
      this.monitorOrder(order.id);

      return {
        success: true,
        orderId: order.id,
        executedPrice: order.price,
        executedAmount: order.amount,
        status: order.status,
      };
    } catch (error) {
      logger.error(`Order execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private async monitorOrder(orderId: string): Promise<void> {
    const checkOrder = async () => {
      try {
        const order = await this.exchange.fetchOrder(orderId);
        
        if (order.status === 'closed') {
          this.lastOrderCheck.delete(orderId);
          logger.info(`Order ${orderId} completed successfully`);
        } else if (order.status === 'canceled' || order.status === 'expired') {
          this.lastOrderCheck.delete(orderId);
          logger.warn(`Order ${orderId} ${order.status}`);
        } else {
          const lastCheck = this.lastOrderCheck.get(orderId) || Date.now();
          
          if (Date.now() - lastCheck > this.ORDER_CHECK_TIMEOUT) {
            logger.warn(`Order ${orderId} pending for too long`);
            safetyMonitor.emit('orderTimeout', orderId);
          }
          
          this.lastOrderCheck.set(orderId, Date.now());
          setTimeout(() => checkOrder(), 5000); // Check again in 5 seconds
        }
      } catch (error) {
        logger.error(`Order monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        safetyMonitor.emit('orderMonitoringError', { orderId, error });
      }
    };

    checkOrder();
  }

  async getAPIQuota(): Promise<RateLimitInfo> {
    return { ...this.rateLimitInfo };
  }
}