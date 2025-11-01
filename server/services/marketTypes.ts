import type { MarketData } from '@shared/schema';

export interface VolumeProfile {
  buyVolume: number;
  sellVolume: number;
  volumeRatio: number;
  largeOrders: number;
}

export interface MarketMetrics {
  volatility: number;
  riskScore: number;
  trend: number;
  volume: number;
  mer: number;
  volumeProfile: VolumeProfile;
}