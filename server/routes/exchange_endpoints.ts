// Get all available exchanges
app.get('/api/exchanges', async (req, res) => {
  try {
    const exchangeNames = exchangeManager.getExchangeNames();
    const exchanges = [];

    for (const name of exchangeNames) {
      exchanges.push({ name, connected: exchangeManager.getExchange(name).isConnected() });
    }

    res.json(exchanges);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get exchanges' });
  }
});

// Get aggregated order book across all exchanges
app.get('/api/markets/:pair/aggregated-orderbook', async (req, res) => {
  try {
    const { pair } = req.params;
    const { limit = 10 } = req.query;

    const orderBook = await exchangeManager.getAggregatedOrderBook(pair, parseInt(limit as string));

    res.json(orderBook);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch aggregated order book' });
  }
});