import ccxt from 'ccxt';
import type { TradingPair, KrakenFee, MarketData } from '@shared/schema';

const DEFAULT_MOCK_FLAG = process.env.USE_MOCK_KRAKEN === 'true';

export class ExchangeService {
  protected exchange: any;
  private connected: boolean = false;
  private useMock: boolean;
  private name: string;

  constructor(name: string, useMock?: boolean) {
    this.name = name;
    this.useMock = typeof useMock === 'boolean' ? useMock : DEFAULT_MOCK_FLAG;

    if (!this.useMock) {
      try {
        const ExchangeCtor = (ccxt as any)[name];
        if (!ExchangeCtor) {
          console.warn(`Exchange ${name} not found in ccxt; falling back to undefined exchange client`);
          this.exchange = undefined;
          return;
        }

        this.exchange = new ExchangeCtor({
          apiKey: process.env[`${name.toUpperCase()}_API_KEY`] || process.env.KRAKEN_API_KEY,
          secret: process.env[`${name.toUpperCase()}_SECRET_KEY`] || process.env.KRAKEN_SECRET_KEY,
          enableRateLimit: true,
        });
      } catch (err) {
        console.error(`Failed to construct exchange client for ${name}:`, err);
        this.exchange = undefined;
      }
    } else {
      console.log(`ExchangeService(${name}): running in MOCK mode`);
    }
  }

  async connect(): Promise<void> {
    try {
      if (this.useMock) {
        this.connected = true;
        return;
      }

      if (!this.exchange) {
        console.error(`No exchange client available for ${this.name}`);
        this.connected = false;
        return;
      }

      await this.exchange.loadMarkets();
      this.connected = true;
      console.log(`Connected to ${this.name} API`);
    } catch (error) {
      console.error(`Failed to connect to ${this.name}:`, error);
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getHistoricalData(symbol: string, timeframe: string = '1h', limit: number = 168): Promise<MarketData[]> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      if (this.useMock) {
        const now = Date.now();
        const data: MarketData[] = [];
        for (let i = 0; i < Math.min(limit, 24); i++) {
          const timestamp = now - i * 60 * 60 * 1000;
          const close = symbol.startsWith('BTC') ? 50000 + i : symbol.startsWith('ETH') ? 3500 + i : 1 + i;
          data.push({ pair: symbol, timestamp, open: close - 5, high: close + 10, low: close - 10, close, volume: Math.random() * 10 });
        }
        return data;
      }

      if (!this.exchange || typeof this.exchange.fetchOHLCV !== 'function') {
        console.error('Exchange client missing or does not support fetchOHLCV');
        return [];
      }

      const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);

      return ohlcv.map(([timestamp, open, high, low, close, volume]: [number, number, number, number, number, number]) => ({
        pair: symbol,
        timestamp,
        open,
        high,
        low,
        close,
        volume,
      }));
    } catch (error) {
      console.error(`Failed to fetch historical data for ${symbol} on ${this.name}:`, error);
      return [];
    }
  }

  async getAllTradingPairs(): Promise<TradingPair[]> {
    if (!this.connected) await this.connect();
    try {
      if (this.useMock) {
        return [
          { symbol: 'BTC/USD', baseAsset: 'BTC', quoteAsset: 'USD', currentPrice: 50000, change24h: 1.2, volume24h: 1200000, high24h: 50500, low24h: 49000 },
          { symbol: 'ETH/USD', baseAsset: 'ETH', quoteAsset: 'USD', currentPrice: 3500, change24h: -0.5, volume24h: 600000, high24h: 3600, low24h: 3400 },
          { symbol: 'XRP/USD', baseAsset: 'XRP', quoteAsset: 'USD', currentPrice: 0.45, change24h: 0.7, volume24h: 200000, high24h: 0.47, low24h: 0.42 },
        ];
      }

      if (!this.exchange || typeof this.exchange.fetchTickers !== 'function') {
        console.error('Exchange client missing or does not support fetchTickers');
        return [];
      }

      const tickers = await this.exchange.fetchTickers();
      const pairs: TradingPair[] = [];

      for (const [symbol, ticker] of Object.entries(tickers)) {
        const [baseAsset, quoteAsset] = (symbol as string).split('/');
        if (!baseAsset || !quoteAsset) continue;
        const t = ticker as any;
        pairs.push({
          symbol: symbol as string,
          baseAsset,
          quoteAsset,
          currentPrice: t.last || 0,
          change24h: t.percentage || 0,
          volume24h: t.quoteVolume || 0,
          high24h: t.high || 0,
          low24h: t.low || 0,
        });
      }

      return pairs.sort((a, b) => b.volume24h - a.volume24h);
    } catch (error) {
      console.error(`Error fetching trading pairs from ${this.name}:`, error);
      return [];
    }
  }

  async getMarketPrice(pair: string): Promise<number | null> {
    try {
      if (this.useMock) {
        if (pair === 'BTC/USD') return 50000;
        if (pair === 'ETH/USD') return 3500;
        return 1;
      }

      if (!this.exchange || typeof this.exchange.fetchTicker !== 'function') return null;
      const ticker = await this.exchange.fetchTicker(pair);
      return ticker.last || null;
    } catch (error) {
      console.error(`Error fetching price for ${pair} on ${this.name}:`, error);
      return null;
    }
  }

  async getOrderBook(pair: string): Promise<{ bids: Array<[number, number]>; asks: Array<[number, number]> }> {
    try {
      if (this.useMock) {
        return { bids: [[49990, 0.5], [49980, 1.2], [49950, 0.1]], asks: [[50010, 0.4], [50020, 2.0], [50050, 0.3]] };
      }

      if (!this.exchange || typeof this.exchange.fetchOrderBook !== 'function') return { bids: [], asks: [] };
      const orderBook = await this.exchange.fetchOrderBook(pair);
      return { bids: orderBook.bids.slice(0, 10), asks: orderBook.asks.slice(0, 10) };
    } catch (error) {
      console.error(`Error fetching order book for ${pair} on ${this.name}:`, error);
      return { bids: [], asks: [] };
    }
  }

  async placeOrder(pair: string, side: 'buy' | 'sell', type: 'market' | 'limit', amount: number, price?: number): Promise<any> {
    try {
      if (this.useMock) {
        return { id: `mock-${Date.now()}`, pair, side, type, amount, price: price || null, status: 'closed', timestamp: Date.now() };
      }

      if (!this.exchange) throw new Error('Exchange client not initialized');

      let order;
      if (type === 'market') {
        order = side === 'buy' ? await this.exchange.createMarketBuyOrder(pair, amount) : await this.exchange.createMarketSellOrder(pair, amount);
      } else if (type === 'limit' && price) {
        order = side === 'buy' ? await this.exchange.createLimitBuyOrder(pair, amount, price) : await this.exchange.createLimitSellOrder(pair, amount, price);
      } else {
        throw new Error('Invalid order type or missing price for limit order');
      }

      return order;
    } catch (error) {
      console.error(`Error placing order on ${this.name}:`, error);
      throw error;
    }
  }

  async getBalance(): Promise<Record<string, number>> {
    try {
      if (this.useMock) return { USD: 100000, BTC: 1.2, ETH: 10 };
      if (!this.exchange || typeof this.exchange.fetchBalance !== 'function') return {};
      const balance = await this.exchange.fetchBalance();
      return balance.total || {};
    } catch (error) {
      console.error(`Error fetching balance from ${this.name}:`, error);
      return {};
    }
  }

  async getOHLCV(pair: string, timeframe: string = '1h', limit: number = 100): Promise<any[]> {
    try {
      if (this.useMock) {
        const now = Date.now();
        const close = pair.startsWith('BTC') ? 50000 : pair.startsWith('ETH') ? 3500 : 1;
        const open = close - 10;
        const high = Math.max(close, open) + 5;
        const low = Math.min(close, open) - 5;
        const volume = Math.random() * 100;
        return [[now, open, high, low, close, volume]];
      }

      if (!this.connected) await this.connect();
      if (!this.exchange || typeof this.exchange.fetchOHLCV !== 'function') {
        console.error('Exchange OHLCV not supported or client missing');
        return [];
      }
      const ohlcv = await this.exchange.fetchOHLCV(pair, timeframe, undefined, limit);
      return ohlcv;
    } catch (error) {
      console.error(`Error fetching OHLCV for ${pair} on ${this.name}:`, error);
      return [];
    }
  }

  async getAPIQuota(): Promise<{ remaining: number; reset: number }> {
    try {
      if (this.useMock) return { remaining: 1000, reset: Date.now() + 60 * 1000 };
      if (!this.exchange) return { remaining: 0, reset: 0 };
      // best-effort: some exchanges may not provide headers; keep previous Kraken style if available
      if (typeof this.exchange.rateLimit === 'number') {
        // Fake a quota based on rateLimit
        return { remaining: Math.max(0, 1000 - this.exchange.rateLimit), reset: Date.now() + 60 * 1000 };
      }
      return { remaining: 0, reset: 0 };
    } catch (error) {
      console.error(`Error fetching API quota from ${this.name}:`, error);
      return { remaining: 0, reset: 0 };
    }
  }

  getFees(volumeUSD: number = 0): KrakenFee {
    if (volumeUSD < 50000) return { maker: 0.0016, taker: 0.0026 };
    if (volumeUSD < 100000) return { maker: 0.0014, taker: 0.0024 };
    if (volumeUSD < 250000) return { maker: 0.0012, taker: 0.0022 };
    if (volumeUSD < 500000) return { maker: 0.0010, taker: 0.0020 };
    if (volumeUSD < 1000000) return { maker: 0.0008, taker: 0.0018 };
    if (volumeUSD < 2500000) return { maker: 0.0006, taker: 0.0016 };
    if (volumeUSD < 5000000) return { maker: 0.0004, taker: 0.0014 };
    if (volumeUSD < 10000000) return { maker: 0.0002, taker: 0.0012 };
    return { maker: 0.0000, taker: 0.0010 };
  }

  calculateFee(amount: number, price: number, isMaker: boolean = false, volumeUSD: number = 0): number {
    const fees = this.getFees(volumeUSD);
    const feeRate = isMaker ? fees.maker : fees.taker;
    return amount * price * feeRate;
  }

  calculateTotalWithFee(amount: number, price: number, side: 'buy' | 'sell', isMaker: boolean = false, volumeUSD: number = 0) {
    const subtotal = amount * price;
    const fee = this.calculateFee(amount, price, isMaker, volumeUSD);
    const total = side === 'buy' ? subtotal + fee : subtotal - fee;
    return { subtotal, fee, total };
  }
}

// convenience factory for default exchange from env or fallback to kraken
export const defaultExchangeName = process.env.EXCHANGE_NAME || 'kraken';
export const defaultExchange = new ExchangeService(defaultExchangeName);
