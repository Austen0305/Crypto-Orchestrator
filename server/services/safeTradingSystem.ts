import { EventEmitter } from 'events';
import { safetyMonitor } from './safetyMonitor';
import { circuitBreaker } from './circuitBreaker';
import { performanceMonitor } from './performanceMonitor';
import { crashRecoverySystem } from './crashRecoverySystem';
import logger from './logger';
import type { Bot, Trade } from '@shared/schema';

export class SafeTradingSystem extends EventEmitter {
  private static instance: SafeTradingSystem;
  private activeBots: Map<string, Bot> = new Map();
  private isInitialized = false;

  private constructor() {
    super();
    this.setupEventListeners();
  }

  public static getInstance(): SafeTradingSystem {
    if (!SafeTradingSystem.instance) {
      SafeTradingSystem.instance = new SafeTradingSystem();
    }
    return SafeTradingSystem.instance;
  }

  private setupEventListeners(): void {
    safetyMonitor.on('emergencyStop', (reason) => {
      this.handleEmergencyStop(reason);
    });

    circuitBreaker.on('circuitOpen', ({ reason }) => {
      this.handleCircuitBreaker(reason);
    });

    performanceMonitor.on('metricsUpdated', (metrics) => {
      this.handlePerformanceUpdate(metrics);
    });

    crashRecoverySystem.on('recoveryStarted', ({ type, reason }) => {
      logger.info('Trading system recovery initiated', { type, reason });
    });
  }

  public async initialize(initialBalance: number): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Start safety monitoring
      safetyMonitor.startMonitoring();

      // Initialize circuit breaker
      circuitBreaker.initializeBalance(initialBalance);

      // Reset performance monitor
      performanceMonitor.reset();

      this.isInitialized = true;
      logger.info('Trading system initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize trading system', { error });
      throw error;
    }
  }

  public async startBot(bot: Bot): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('Trading system not initialized');
    }

    if (!this.isSafeToTrade()) {
      logger.warn('Cannot start bot - system safety checks failed', {
        botId: bot.id,
        health: safetyMonitor.getHealthStatus(),
        circuit: circuitBreaker.getState()
      });
      return false;
    }

    try {
      // Validate bot configuration
      this.validateBotConfig(bot);

      // Register bot
      this.activeBots.set(bot.id, bot);
      logger.info('Bot started successfully', { botId: bot.id });

      return true;
    } catch (error) {
      logger.error('Failed to start bot', { botId: bot.id, error });
      return false;
    }
  }

  public async stopBot(botId: string): Promise<void> {
    if (this.activeBots.has(botId)) {
      try {
        // Cancel any pending orders
        await this.cancelPendingOrders(botId);

        // Close any open positions
        await this.closeOpenPositions(botId);

        this.activeBots.delete(botId);
        logger.info('Bot stopped successfully', { botId });
      } catch (error) {
        logger.error('Error stopping bot', { botId, error });
        throw error;
      }
    }
  }

  private validateBotConfig(bot: Bot): void {
    // Validate risk parameters
      if (bot.riskLimits.maxPosition > 0.1) { // 10% max position size
      throw new Error('Position size exceeds safety limit');
    }

      if (bot.riskLimits.stopLoss && bot.riskLimits.stopLoss < 0.01) { // 1% minimum stop loss
      throw new Error('Stop loss too tight');
    }

    // Add more validation as needed
  }

  private async cancelPendingOrders(botId: string): Promise<void> {
    // Implementation for cancelling pending orders
  }

  private async closeOpenPositions(botId: string): Promise<void> {
    // Implementation for closing open positions
  }

  private isSafeToTrade(): boolean {
    return (
      safetyMonitor.isSystemHealthy() &&
      !circuitBreaker.getState().isOpen &&
      !crashRecoverySystem.getState().isRecovering
    );
  }

  private async handleEmergencyStop(reason: string): Promise<void> {
    logger.error('Emergency stop triggered', { reason });

    // Stop all bots
    for (const [botId] of this.activeBots) {
      await this.stopBot(botId);
    }

    // Initiate crash recovery if needed
    if (!crashRecoverySystem.getState().isRecovering) {
      crashRecoverySystem.initializeRecovery('emergencyStop', reason);
    }
  }

  private handleCircuitBreaker(reason: string): void {
    logger.warn('Circuit breaker triggered', { reason });
    this.emit('circuitBreakerTripped', reason);
  }

  private handlePerformanceUpdate(metrics: any): void {
    // React to performance metrics
    if (metrics.consecutiveLosses >= 3) {
      logger.warn('Performance alert: Multiple consecutive losses', { metrics });
      this.emit('performanceAlert', metrics);
    }
  }

  public getSystemStatus(): any {
    return {
      initialized: this.isInitialized,
      activeBots: Array.from(this.activeBots.keys()),
      safetyStatus: safetyMonitor.getHealthStatus(),
      circuitBreakerState: circuitBreaker.getState(),
      performanceMetrics: performanceMonitor.getMetrics(),
      recoveryState: crashRecoverySystem.getState()
    };
  }

  public dispose(): void {
    safetyMonitor.stopMonitoring();
    circuitBreaker.dispose();
    crashRecoverySystem.dispose();
    this.removeAllListeners();
  }
}

export const safeTradingSystem = SafeTradingSystem.getInstance();