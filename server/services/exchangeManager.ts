import { ExchangeService } from './exchangeService';

class ExchangeManager {
  private exchanges: Map<string, ExchangeService> = new Map();
  private currentExchangeName: string;
  
  constructor() {
    // Initialize with default exchange from environment
    this.currentExchangeName = process.env.EXCHANGE_NAME || 'kraken';
    this.exchanges.set(this.currentExchangeName, new ExchangeService(this.currentExchangeName));
  }
  
  get currentExchange(): ExchangeService {
    return this.exchanges.get(this.currentExchangeName)!;
  }
  
  async switchExchange(name: string): Promise<void> {
    if (!this.exchanges.has(name)) {
      // Create new exchange if not already initialized
      this.exchanges.set(name, new ExchangeService(name));
    }
    
    // Connect to the new exchange
    const exchange = this.exchanges.get(name)!;
    await exchange.connect();
    
    // Update current exchange
    this.currentExchangeName = name;
    
    console.log(`Switched to ${name} exchange`);
  }
  
  getExchangeNames(): string[] {
    return Array.from(this.exchanges.keys());
  }
  
  async getAllTradingPairs(): Promise<any[]> {
    const allPairs: any[] = [];
    
    for (const [name, exchange] of this.exchanges.entries()) {
      try {
        const pairs = await exchange.getAllTradingPairs();
        allPairs.push(...pairs.map(pair => ({ ...pair, exchange: name })));
      } catch (error) {
        console.error(`Failed to get trading pairs from ${name}:`, error);
      }
    }
    
    return allPairs;
  }
  
  async getBestPrice(pair: string): Promise<{ exchange: string; price: number } | null> {
    let bestPrice = null;
    
    for (const [name, exchange] of this.exchanges.entries()) {
      try {
        const price = await exchange.getMarketPrice(pair);
        if (price !== null) {
          if (bestPrice === null || price > bestPrice.price) {
            bestPrice = { exchange: name, price };
          }
        }
      } catch (error) {
        console.error(`Failed to get price from ${name}:`, error);
      }
    }
    
    return bestPrice;
  }
  
  async getAggregatedOrderBook(pair: string, limit: number = 10): Promise<{ bids: Array<[number, number]>; asks: Array<[number, number]> }> {
    const aggregatedOrderBook = { bids: [], asks: [] };
    
    for (const [name, exchange] of this.exchanges.entries()) {
      try {
        const orderBook = await exchange.getOrderBook(pair);
        
        // Aggregate bids
        for (let i = 0; i < Math.min(limit, orderBook.bids.length); i++) {
          const [price, amount] = orderBook.bids[i];
          const existingBidIndex = aggregatedOrderBook.bids.findIndex(([p]) => p === price);
          
          if (existingBidIndex >= 0) {
            aggregatedOrderBook.bids[existingBidIndex] = [price, aggregatedOrderBook.bids[existingBidIndex][1] + amount];
          } else {
            aggregatedOrderBook.bids.push([price, amount]);
          }
        }
        
        // Aggregate asks
        for (let i = 0; i < Math.min(limit, orderBook.asks.length); i++) {
          const [price, amount] = orderBook.asks[i];
          const existingAskIndex = aggregatedOrderBook.asks.findIndex(([p]) => p === price);
          
          if (existingAskIndex >= 0) {
            aggregatedOrderBook.asks[existingAskIndex] = [price, aggregatedOrderBook.asks[existingAskIndex][1] + amount];
          } else {
            aggregatedOrderBook.asks.push([price, amount]);
          }
        }
      } catch (error) {
        console.error(`Failed to get order book from ${name}:`, error);
      }
    }
    
    // Sort bids (highest price first) and asks (lowest price first)
    aggregatedOrderBook.bids.sort((a, b) => b[0] - a[0]);
    aggregatedOrderBook.asks.sort((a, b) => a[0] - b[0]);
    
    return aggregatedOrderBook;
  }
}

export const exchangeManager = new ExchangeManager();

// Backward compatibility
export function getExchange(name: string, useMock?: boolean): ExchangeService {
  return exchangeManager.getExchange(name) || new ExchangeService(name, useMock);
}

export function getDefaultExchange(): ExchangeService {
  if (!exchangeManager.currentExchange) {
    // Fallback to a mock Kraken exchange if none is set
    const inst = getExchange('kraken', true);
    // set as default
    (exchangeManager as any).currentExchange = inst;
  }
  return exchangeManager.currentExchange;
}

export function setDefaultExchange(name: string, useMock?: boolean): ExchangeService {
  const inst = getExchange(name, useMock);
  (exchangeManager as any).currentExchange = inst;
  return inst;
}
