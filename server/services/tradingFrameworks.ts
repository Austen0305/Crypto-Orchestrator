import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

type AdapterRequest = { id?: string; action: string; payload?: any };
type AdapterResponse = { id: string; result?: any; error?: string };

class PythonAdapter {
  protected proc: ChildProcessWithoutNullStreams | null = null;
  protected pending = new Map<string, { resolve: (r: any) => void; reject: (e: any) => void }>();
  protected buffer = '';
  protected scriptPath: string;
  protected restarting = false;
  protected restartDelay = 3000; // ms
  protected maxRestarts = 5;
  protected restartCount = 0;

  constructor(scriptPath: string) {
    this.scriptPath = scriptPath;
  }

  public start(): void {
    if (this.proc) return;
    const python = process.env.PYTHON || 'python';
  this.proc = spawn(python, [this.scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });

  if (!this.proc || !this.proc.stdout) return;

  this.proc.stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf8');
      let idx: number;
      while ((idx = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, idx).trim();
        this.buffer = this.buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const msg: AdapterResponse = JSON.parse(line);
          const p = this.pending.get(msg.id);
          if (p) {
            this.pending.delete(msg.id);
            if (msg.error) p.reject(new Error(msg.error));
            else p.resolve(msg.result);
          }
        } catch (e) {
          // ignore parse errors
        }
      }
    });

    if (this.proc) {
      this.proc.on('exit', (code, signal) => {
        // reject all pending
        for (const [, p] of this.pending) p.reject(new Error('adapter exited'));
        this.pending.clear();
        this.proc = null;
        // attempt restart with backoff, but cap restarts
        if (!this.restarting && this.restartCount < this.maxRestarts) {
          this.restarting = true;
          this.restartCount += 1;
          setTimeout(() => {
            this.restarting = false;
            try {
              this.start();
            } catch (e) {
              // ignore
            }
          }, this.restartDelay * this.restartCount);
        }
      });
    }
  }

  public stop(): void {
    if (!this.proc) return;
    try {
      this.proc.kill();
    } catch (e) {
      // ignore
    }
    this.proc = null;
  }

  protected send(action: string, payload?: any, timeout = 10000): Promise<any> {
    if (!this.proc) this.start();
    return new Promise((resolve, reject) => {
      if (!this.proc) return reject(new Error('failed to start adapter'));
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const msg: AdapterRequest = { id, action, payload } as any;
      this.pending.set(id, { resolve, reject });
      try {
        this.proc.stdin.write(JSON.stringify(msg) + '\n', 'utf8');
      } catch (e) {
        this.pending.delete(id);
        return reject(e);
      }
      const t = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('adapter timeout'));
        }
      }, timeout);
      // clear timeout when resolved/rejected
      const wrappedResolve = (r: any) => { clearTimeout(t); resolve(r); };
      const wrappedReject = (e: any) => { clearTimeout(t); reject(e); };
      this.pending.set(id, { resolve: wrappedResolve, reject: wrappedReject });
    });
  }

  // Convenience health check that calls the adapter's ping action
  public async ping(timeout = 2000): Promise<any> {
    try {
      return await this.send('ping', {}, timeout);
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
}

export class FreqtradeAdapter extends PythonAdapter {
  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const script = path.resolve(__dirname, '../integrations/freqtrade_adapter.py');
    super(script);
  }

  public async ping(): Promise<any> { return this.send('ping'); }
  public async predict(payload: any): Promise<any> { return this.send('predict', payload); }
  public async backtest(payload: any): Promise<any> { return this.send('backtest', payload); }
}

export class JesseAdapter extends PythonAdapter {
  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const script = path.resolve(__dirname, '../integrations/jesse_adapter.py');
    super(script);
  }

  public async ping(): Promise<any> { return this.send('ping'); }
  public async predict(payload: any): Promise<any> { return this.send('predict', payload); }
  public async backtest(payload: any): Promise<any> { return this.send('backtest', payload); }
}

// Export a simple factory
export const freqtradeAdapter = new FreqtradeAdapter();
export const jesseAdapter = new JesseAdapter();
