import { EventEmitter } from 'events';
import { storage } from "../storage";
import { logger } from "./logger";
import type { MLModelState, MarketData } from "@shared/schema";

// Enhanced state definition
interface State {
  priceDirection: "up" | "down" | "stable";
  rsi: "oversold" | "neutral" | "overbought";
  volume: "low" | "medium" | "high";
  volatility: "low" | "medium" | "high";
  trend: "bullish" | "bearish" | "neutral";
}

type Action = "buy" | "sell" | "hold" | "wait";

interface Prediction {
  action: Action;
  confidence: number;
  riskScore: number;
  expectedReturn: number;
}

export class MLEngine extends EventEmitter {
  private learningRate: number;
  private discountFactor: number;
  private epsilon: number;
  private epsilonDecay: number = 0.995;
  private epsilonMin: number = 0.01;
  private recentPredictions: { predicted: Action; actual: Action }[] = [];
  private qTable: Record<string, Record<string, number>> = {};
  private maxRecentPredictions = 1000;
  private performanceMetrics = {
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1Score: 0
  };

  constructor(
    learningRate: number = 0.1,
    discountFactor: number = 0.95,
    epsilon: number = 1.0
  ) {
    super();
    this.learningRate = learningRate;
    this.discountFactor = discountFactor;
    this.epsilon = epsilon;
    this.loadModel();
    this.startMetricsUpdate();
  }

  private startMetricsUpdate() {
    setInterval(() => {
      this.calculatePerformanceMetrics();
      this.emit('metricsUpdate', this.performanceMetrics);
    }, 60000); // Update metrics every minute
  }

  private calculatePerformanceMetrics() {
    if (this.recentPredictions.length === 0) return;

    const truePositives = this.recentPredictions.filter(
      p => p.predicted === p.actual && p.predicted !== 'hold'
    ).length;
    
    const falsePositives = this.recentPredictions.filter(
      p => p.predicted !== p.actual && p.predicted !== 'hold'
    ).length;
    
    const falseNegatives = this.recentPredictions.filter(
      p => p.predicted === 'hold' && p.actual !== 'hold'
    ).length;

    this.performanceMetrics.precision = truePositives / (truePositives + falsePositives);
    this.performanceMetrics.recall = truePositives / (truePositives + falseNegatives);
    this.performanceMetrics.f1Score = 
      (2 * this.performanceMetrics.precision * this.performanceMetrics.recall) /
      (this.performanceMetrics.precision + this.performanceMetrics.recall);
  }

  async saveModel() {
    try {
      await storage.set('mlModel', {
        qTable: this.qTable,
        recentPredictions: this.recentPredictions,
        performanceMetrics: this.performanceMetrics
      });
      logger.info('ML model saved successfully');
    } catch (error) {
      logger.error('Failed to save ML model', { error });
    }
  }

  async loadModel() {
    try {
      const model = await storage.get<MLModelState>('mlModel');
      if (model) {
        this.qTable = model.qTable || {};
        this.recentPredictions = model.recentPredictions || [];
        this.performanceMetrics = model.performanceMetrics || this.performanceMetrics;
        logger.info('ML model loaded successfully');
      }
    } catch (error) {
      logger.error('Failed to load ML model', { error });
    }
  }
}
