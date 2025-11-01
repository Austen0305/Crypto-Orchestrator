import type { MarketData } from "@shared/schema";
import { MLEngine } from "./mlEngine";
import { NeuralNetworkEngine } from "./neuralNetworkEngine";

interface EnsemblePrediction {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  votes: {
    qLearning: { action: 'buy' | 'sell' | 'hold'; confidence: number };
    neuralNetwork: { action: 'buy' | 'sell' | 'hold'; confidence: number };
  };
}

export class EnsembleEngine {
  private qLearningEngine: MLEngine;
  private neuralNetworkEngine: NeuralNetworkEngine;
  private qTable: Record<string, Record<string, number>> = {};

  constructor() {
    this.qLearningEngine = new MLEngine(0.1, 0.95, 0.1);
    this.neuralNetworkEngine = new NeuralNetworkEngine({
      inputSize: 30,
      hiddenLayers: [64, 32],
      learningRate: 0.001,
      epochs: 50,
    });
  }

  async initialize(botId: string): Promise<void> {
    await this.neuralNetworkEngine.loadModel(botId);
  }

  setQTable(qTable: Record<string, Record<string, number>>): void {
    Object.assign(this.qTable, qTable);
  }

  async train(marketData: MarketData[]): Promise<void> {
    try {
      await this.neuralNetworkEngine.train(marketData);
      console.log('Neural network training completed');
    } catch (error) {
      console.error('Neural network training failed:', error);
    }
  }

  private calculateQLearningConfidenceFromStateKey(stateKey: string): number {
    const qValues = this.qTable[stateKey] || { buy: 0, sell: 0, hold: 0 };
    const vals = Object.values(qValues);
    if (!vals.length) return 0;
    const maxQ = Math.max(...vals);
    const minQ = Math.min(...vals);
    return maxQ - minQ > 0 ? (maxQ - minQ) / (Math.abs(maxQ) + 1) : 0;
  }

  async predict(marketData: MarketData[]): Promise<EnsemblePrediction> {
    const [qLearningPrediction, nnPrediction] = await Promise.all([
      this.qLearningEngine.predict(marketData),
      this.neuralNetworkEngine.predict(marketData),
    ]);

    // derive q-learning confidence from qTable using current state
    const state = this.qLearningEngine.deriveState(marketData, Math.max(0, marketData.length - 1));
    const stateKey = this.qLearningEngine.getStateKey(state);
    const qLearningConfidence = this.calculateQLearningConfidenceFromStateKey(stateKey);

    const qLearningWeight = this.qLearningEngine.getRecentAccuracy();
    const nnWeight = this.neuralNetworkEngine.getRecentAccuracy();
    const totalWeight = qLearningWeight + nnWeight || 1;

    const votes: Record<'buy' | 'sell' | 'hold', number> = { buy: 0, sell: 0, hold: 0 };

    votes[qLearningPrediction.action] += (qLearningWeight / totalWeight) * qLearningConfidence;
    votes[nnPrediction.action] += (nnWeight / totalWeight) * nnPrediction.confidence;

    let maxAction: 'buy' | 'sell' | 'hold' = 'hold';
    let maxScore = votes.hold;

    if (votes.buy > maxScore) {
      maxScore = votes.buy;
      maxAction = 'buy';
    }
    if (votes.sell > maxScore) {
      maxScore = votes.sell;
      maxAction = 'sell';
    }

    return {
      action: maxAction,
      confidence: maxScore,
      votes: {
        qLearning: { action: qLearningPrediction.action, confidence: qLearningConfidence },
        neuralNetwork: { action: nnPrediction.action, confidence: nnPrediction.confidence },
      },
    };
  }

  updateQValue(state: any, action: 'buy' | 'sell' | 'hold', reward: number, nextState: any): void {
    this.qLearningEngine.updateQValue(this.qTable, state, action, reward, nextState);
  }

  calculateReward(action: 'buy' | 'sell' | 'hold', entryPrice: number, exitPrice: number, position: 'long' | 'short' | null): number {
    return this.qLearningEngine.calculateReward(action, entryPrice, exitPrice, position);
  }

  deriveState(marketData: MarketData[], currentIndex: number): any {
    return this.qLearningEngine.deriveState(marketData, currentIndex);
  }

  async saveModel(botId: string): Promise<void> {
    await this.neuralNetworkEngine.saveModel(botId);
  }

  dispose(): void {
    this.neuralNetworkEngine.dispose();
  }
}

export const ensembleEngine = new EnsembleEngine();
