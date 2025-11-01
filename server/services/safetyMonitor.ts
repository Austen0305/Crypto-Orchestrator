import { EventEmitter } from 'events';
import { getDefaultExchange } from './exchangeManager';
import logger from './logger';

interface HealthStatus {
  isHealthy: boolean;
  lastCheck: number;
  errors: string[];
  apiQuotaRemaining: number;
  connectionLatency: number;
}

export class SafetyMonitor extends EventEmitter {
  private static instance: SafetyMonitor;
  private healthStatus: HealthStatus;
  private checkInterval: NodeJS.Timer | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly MAX_LATENCY = 2000; // 2 seconds
  private readonly MIN_API_QUOTA = 10; // Minimum API calls remaining
  private emergencyStopActive = false;

  private constructor() {
    super();
    this.healthStatus = {
      isHealthy: true,
      lastCheck: Date.now(),
      errors: [],
      apiQuotaRemaining: 100,
      connectionLatency: 0,
    };
  }

  public static getInstance(): SafetyMonitor {
    if (!SafetyMonitor.instance) {
      SafetyMonitor.instance = new SafetyMonitor();
    }
    return SafetyMonitor.instance;
  }

  public startMonitoring(): void {
    if (!this.checkInterval) {
      this.checkInterval = setInterval(() => this.performHealthCheck(), this.HEALTH_CHECK_INTERVAL);
      logger.info('Safety monitoring started');
    }
  }

  public stopMonitoring(): void {
    if (this.checkInterval) {
      if (this.checkInterval) {
        clearInterval(this.checkInterval as unknown as number);
        this.checkInterval = null;
      }
      this.checkInterval = null;
      logger.info('Safety monitoring stopped');
    }
  }

  public isSystemHealthy(): boolean {
    return this.healthStatus.isHealthy && !this.emergencyStopActive;
  }

  public getHealthStatus(): HealthStatus {
    return { ...this.healthStatus };
  }

  public activateEmergencyStop(reason: string): void {
    this.emergencyStopActive = true;
    this.healthStatus.isHealthy = false;
    this.healthStatus.errors.push(`Emergency stop activated: ${reason}`);
    logger.error(`Emergency stop activated: ${reason}`);
    this.emit('emergencyStop', reason);
  }

  public resetEmergencyStop(): void {
    if (this.emergencyStopActive) {
      this.emergencyStopActive = false;
      this.healthStatus.isHealthy = true;
      this.healthStatus.errors = [];
      logger.info('Emergency stop reset');
      this.emit('emergencyStopReset');
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const startTime = Date.now();
      
  // Check exchange connection
  const exchange = getDefaultExchange();
  const isConnected = await exchange.isConnected();
      const latency = Date.now() - startTime;
      
      this.healthStatus.connectionLatency = latency;
      this.healthStatus.lastCheck = Date.now();

  // Check API quota
  const quota = await exchange.getAPIQuota();
  this.healthStatus.apiQuotaRemaining = quota.remaining;

      if (!isConnected) {
        this.updateHealth(false, 'Exchange connection lost');
      } else if (latency > this.MAX_LATENCY) {
        this.updateHealth(false, `High latency detected: ${latency}ms`);
      } else if (quota.remaining < this.MIN_API_QUOTA) {
        this.updateHealth(false, `Low API quota remaining: ${quota.remaining}`);
      } else {
        this.updateHealth(true);
      }
    } catch (error) {
      this.updateHealth(false, `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private updateHealth(isHealthy: boolean, error?: string): void {
    const previousHealth = this.healthStatus.isHealthy;
    this.healthStatus.isHealthy = isHealthy;

    if (!isHealthy && error) {
      this.healthStatus.errors.push(error);
      logger.error(error);
      
      if (previousHealth) {
        this.emit('healthStatusChanged', this.healthStatus);
      }
    } else if (isHealthy && !previousHealth) {
      this.healthStatus.errors = [];
      logger.info('System health restored');
      this.emit('healthStatusChanged', this.healthStatus);
    }
  }
}

export const safetyMonitor = SafetyMonitor.getInstance();