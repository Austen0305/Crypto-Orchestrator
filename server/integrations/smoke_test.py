import asyncio
import json
import sys

from freqtrade_adapter import FreqtradeManager, MockExchange
from jesse_adapter import JesseManager


async def run():
    print('Starting smoke tests...')
    # FreqtradeManager predict (mock)
    mgr = FreqtradeManager()
    # Ensure mock
    mgr.exchange = MockExchange(mgr.config)
    await mgr.exchange.initialize()
    res = await mgr.predict({'symbol': 'BTC/USDT'})
    print('Freqtrade predict ->', json.dumps(res))

    # JesseManager predict
    jmgr = JesseManager()
    await jmgr.initialize()
    jres = await jmgr.predict({'symbol': 'BTC/USDT'})
    print('Jesse predict ->', json.dumps(jres))


if __name__ == '__main__':
    asyncio.get_event_loop().run_until_complete(run())
