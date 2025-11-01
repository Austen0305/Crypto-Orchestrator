

import { freqtradeAdapter, jesseAdapter } from './tradingFrameworks';

type Prediction = { action: string; confidence: number; source?: string };

export class TradingOrchestrator {
  private started = false;

  public startAll(): void {
    if (this.started) return;
    try {
      freqtradeAdapter.start();
      jesseAdapter.start();
      this.started = true;
    } catch (e) {
      // ignore start failures, adapters may not be available
      this.started = false;
    }
  }

  public stopAll(): void {
    try {
      freqtradeAdapter.stop();
      jesseAdapter.stop();
    } finally {
      this.started = false;
    }
  }

  public async getEnsemblePrediction(payload: any): Promise<{ action: string; confidence: number; votes: Prediction[] }> {
    const votes: Prediction[] = [];

    // Always include a local 'none' baseline to avoid division by zero
    try {
      const f = await freqtradeAdapter.predict(payload).catch(() => null);
      if (f && f.action) votes.push({ action: f.action, confidence: typeof f.confidence === 'number' ? f.confidence : 0.5, source: 'freqtrade' });
    } catch (e) {
      // ignore
    }

    try {
      const j = await jesseAdapter.predict(payload).catch(() => null);
      if (j && j.action) votes.push({ action: j.action, confidence: typeof j.confidence === 'number' ? j.confidence : 0.5, source: 'jesse' });
    } catch (e) {
      // ignore
    }

    // If no external votes, return neutral
    if (votes.length === 0) {
      return { action: 'hold', confidence: 0, votes };
    }

    // Tally weighted votes
    const tally: Record<string, number> = {};
    let total = 0;
    for (const v of votes) {
      tally[v.action] = (tally[v.action] || 0) + v.confidence;
      total += v.confidence;
    }

    let bestAction = 'hold';
    let bestWeight = 0;
    for (const k of Object.keys(tally)) {
      if (tally[k] > bestWeight) {
        bestWeight = tally[k];
        bestAction = k;
      }
    }

    const normalizedConfidence = total > 0 ? bestWeight / total : 0;

    return { action: bestAction, confidence: normalizedConfidence, votes };
  }

  public async pingAll(): Promise<{ freqtrade?: any; jesse?: any }> {
    const out: { freqtrade?: any; jesse?: any } = {};
    try {
      out.freqtrade = await freqtradeAdapter.ping().catch((e) => ({ ok: false, error: String(e) }));
    } catch (e) {
      out.freqtrade = { ok: false, error: String(e) };
    }

    try {
      out.jesse = await jesseAdapter.ping().catch((e) => ({ ok: false, error: String(e) }));
    } catch (e) {
      out.jesse = { ok: false, error: String(e) };
    }

    return out;
  }

  public async backtest(payload: any): Promise<{ results: any[]; summary: { avgProfitPct: number; totalTrades: number } }> {
    const results: any[] = [];
    try {
      const f = await freqtradeAdapter.backtest(payload).catch(() => null);
      if (f) results.push({ source: 'freqtrade', ...f });
    } catch (e) {
      // ignore
    }

    try {
      const j = await jesseAdapter.backtest(payload).catch(() => null);
      if (j) results.push({ source: 'jesse', ...j });
    } catch (e) {
      // ignore
    }

    // compute simple summary
    let totalTrades = 0;
    let sumProfit = 0;
    for (const r of results) {
      if (typeof r.trades === 'number') totalTrades += r.trades;
      if (typeof r.profit_pct === 'number') sumProfit += r.profit_pct;
    }
    const avgProfitPct = results.length > 0 ? sumProfit / results.length : 0;

    return { results, summary: { avgProfitPct, totalTrades } };
  }
}

export const tradingOrchestrator = new TradingOrchestrator();
