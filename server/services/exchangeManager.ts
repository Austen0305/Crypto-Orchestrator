import { ExchangeService } from './exchangeService';

const instances = new Map<string, ExchangeService>();

export function getExchange(name: string, useMock?: boolean): ExchangeService {
  const key = name.toLowerCase();
  if (!instances.has(key)) {
    instances.set(key, new ExchangeService(name, useMock));
  }
  return instances.get(key)!;
}

export function getDefaultExchange(): ExchangeService {
  const name = process.env.EXCHANGE_NAME || 'kraken';
  return getExchange(name, process.env.USE_MOCK_KRAKEN === 'true');
}

export function setDefaultExchange(name: string, useMock?: boolean): ExchangeService {
  process.env.EXCHANGE_NAME = name;
  return getExchange(name, useMock);
}
