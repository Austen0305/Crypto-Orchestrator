import { EventEmitter } from 'events';
import logger from './logger';
import { safetyMonitor } from './safetyMonitor';

interface CircuitBreakerConfig {
  maxDailyLoss: number;          // Maximum allowed daily loss as a percentage
  maxDrawdown: number;           // Maximum allowed drawdown as a percentage
  cooldownPeriod: number;        // Time in ms before circuit can be reset
  volatilityThreshold: number;   // Threshold for market volatility
}

interface CircuitBreakerState {
  isOpen: boolean;
  lastTripped: number | null;
  totalDailyLoss: number;
  maxDrawdown: number;
  startingBalance: number;
  currentBalance: number;
  highWaterMark: number;
  reason?: string;
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitBreakerState;
  private config: CircuitBreakerConfig;
  private dailyResetTimeout: NodeJS.Timeout | null = null;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    super();
    this.config = {
      maxDailyLoss: config.maxDailyLoss || 0.05,      // 5% max daily loss
      maxDrawdown: config.maxDrawdown || 0.10,         // 10% max drawdown
      cooldownPeriod: config.cooldownPeriod || 3600000, // 1 hour cooldown
      volatilityThreshold: config.volatilityThreshold || 0.03 // 3% volatility threshold
    };

    this.state = {
      isOpen: false,
      lastTripped: null,
      totalDailyLoss: 0,
      maxDrawdown: 0,
      startingBalance: 0,
      currentBalance: 0,
      highWaterMark: 0
    };

    this.setupDailyReset();
  }

  private setupDailyReset(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const timeUntilReset = tomorrow.getTime() - now.getTime();

    this.dailyResetTimeout = setTimeout(() => {
      this.resetDaily();
      this.setupDailyReset(); // Setup next day's reset
    }, timeUntilReset);
  }

  public initializeBalance(balance: number): void {
    this.state.startingBalance = balance;
    this.state.currentBalance = balance;
    this.state.highWaterMark = balance;
    logger.info('Circuit breaker initialized', { balance });
  }

  public updateBalance(newBalance: number): void {
    const oldBalance = this.state.currentBalance;
    this.state.currentBalance = newBalance;

    // Update high water mark if new balance is higher
    if (newBalance > this.state.highWaterMark) {
      this.state.highWaterMark = newBalance;
    }

    // Calculate current drawdown
    const currentDrawdown = (this.state.highWaterMark - newBalance) / this.state.highWaterMark;
    this.state.maxDrawdown = Math.max(this.state.maxDrawdown, currentDrawdown);

    // Update daily loss
    if (newBalance < oldBalance) {
      this.state.totalDailyLoss += (oldBalance - newBalance) / this.state.startingBalance;
    }

    // Check circuit breaker conditions
    this.checkConditions();
  }

  public checkVolatility(currentVolatility: number): void {
    if (currentVolatility > this.config.volatilityThreshold) {
      this.tripCircuit(`High volatility detected: ${(currentVolatility * 100).toFixed(2)}%`);
    }
  }

  private checkConditions(): void {
    if (this.state.isOpen) return; // Already tripped

    if (this.state.totalDailyLoss >= this.config.maxDailyLoss) {
      this.tripCircuit(`Daily loss limit exceeded: ${(this.state.totalDailyLoss * 100).toFixed(2)}%`);
    }

    if (this.state.maxDrawdown >= this.config.maxDrawdown) {
      this.tripCircuit(`Maximum drawdown exceeded: ${(this.state.maxDrawdown * 100).toFixed(2)}%`);
    }
  }

  public tripCircuit(reason: string): void {
    if (!this.state.isOpen) {
      this.state.isOpen = true;
      this.state.lastTripped = Date.now();
      this.state.reason = reason;

      logger.warn('Circuit breaker tripped', {
        reason,
        state: this.state
      });

      this.emit('circuitOpen', { reason, state: this.state });
      safetyMonitor.activateEmergencyStop(`Circuit breaker: ${reason}`);
    }
  }

  public canReset(): boolean {
    if (!this.state.isOpen || !this.state.lastTripped) return false;
    return Date.now() - this.state.lastTripped >= this.config.cooldownPeriod;
  }

  public reset(): boolean {
    if (!this.canReset()) return false;

    this.state.isOpen = false;
    this.state.lastTripped = null;
    this.state.reason = undefined;

    logger.info('Circuit breaker reset', {
      state: this.state
    });

    this.emit('circuitClosed', { state: this.state });
    return true;
  }

  private resetDaily(): void {
    const oldState = { ...this.state };

    this.state.totalDailyLoss = 0;
    this.state.startingBalance = this.state.currentBalance;
    
    logger.info('Daily circuit breaker reset', {
      oldState,
      newState: this.state
    });

    this.emit('dailyReset', {
      oldState,
      newState: this.state
    });
  }

  public getState(): CircuitBreakerState {
    return { ...this.state };
  }

  public dispose(): void {
    if (this.dailyResetTimeout) {
      clearTimeout(this.dailyResetTimeout);
    }
  }
}

export const circuitBreaker = new CircuitBreaker();