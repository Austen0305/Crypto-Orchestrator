import { ExchangeService } from './exchangeService';

// Provide a KrakenService class that preserves the previous public API shape
// by subclassing the generic ExchangeService. This keeps `EnhancedKrakenService`
// and other code that `extends KrakenService` working.
export class KrakenService extends ExchangeService {
	constructor() {
		super('kraken', process.env.USE_MOCK_KRAKEN === 'true');
	}
}

export const krakenService = new KrakenService();

export default krakenService;
