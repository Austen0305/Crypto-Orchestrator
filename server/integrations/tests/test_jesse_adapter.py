import asyncio
import pytest

from ..jesse_adapter import JesseManager, respond


@pytest.mark.asyncio
async def test_jesse_predict():
    mgr = JesseManager()
    await mgr.initialize()
    res = await mgr.predict({'symbol': 'BTC/USDT'})
    assert isinstance(res, dict)
    assert res['source'] == 'jesse'


def test_jesse_respond_ping(monkeypatch, capsys):
    req = {'action': 'ping', 'id': 'ping2'}
    asyncio.get_event_loop().run_until_complete(respond(req))
    out = capsys.readouterr().out
    assert 'ping2' in out
