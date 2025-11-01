import asyncio
import pytest

# Import the manager from the adapter
from .. import freqtrade_adapter as fa


@pytest.mark.asyncio
async def test_freqtrade_predict_mock():
    # Ensure manager uses mock by default
    mgr = fa.FreqtradeManager()
    # Force mock exchange if misconfigured
    mgr.exchange = fa.MockExchange(mgr.config)
    await mgr.exchange.initialize()

    res = await mgr.predict({'symbol': 'BTC/USDT'})
    assert isinstance(res, dict)
    assert 'action' in res
    assert res['source'] == 'freqtrade'


def test_freqtrade_respond_ping(monkeypatch, capsys):
    # Test respond wrapper with ping
    req = {'action': 'ping', 'id': 'ping1'}
    asyncio.get_event_loop().run_until_complete(fa.respond(req))
    captured = capsys.readouterr()
    assert 'ping1' in captured.out
