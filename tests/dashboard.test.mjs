import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../public/core.js';
import { handle, resolveBus, loadBus, normalizeArrivals, parseNews, verifyDirection } from '../worker/index.mjs';

const core = globalThis.DashboardCore;
const origin = 'https://kylehj13.github.io';
const request = (path, options = {}) => new Request('https://dashboard-api.example' + path, { headers: { Origin: origin }, ...options });
const envelope = body => new Response(JSON.stringify({ response: { msgHeader: { resultCode: 0 }, msgBody: body } }));
const station = { stationId: '225000001', mobileNo: '26052', stationName: '주공2단지충무아파트', regionName: '군포시' };
const stops = [ { ...station, stationSeq: 50 }, { stationId: '225000002', stationName: '산본역', stationSeq: 51 } ];
function mockBus(url) {
  switch (url.pathname.split('/').pop()) {
    case 'getBusStationListv2': assert.equal(url.searchParams.get('keyword'), '26052'); return envelope({ busStationList: [station, { ...station, mobileNo: '26053' }] });
    case 'getBusStationViaRouteListv2': assert.equal(url.searchParams.get('stationId'), station.stationId); return envelope({ busRouteList: [{ routeName: '3500', routeId: '234000051' }] });
    case 'getBusRouteStationListv2': return envelope({ busRouteStationList: stops.slice().reverse() });
    case 'getBusArrivalListv2': return envelope({ busArrivalList: [{ routeId: 'other', staOrder: 50, predictTime1: 1 }, { routeId: '234000051', staOrder: 50, flag: 'RUN', predictTime1: 4, locationNo1: 2, remainSeatCnt1: 0, predictTime2: -1 }] });
    default: throw new Error('Unexpected API');
  }
}

test('Korean date and daily content change at Korean midnight', () => {
  const before = new Date('2026-10-14T14:59:59Z'), after = new Date('2026-10-14T15:00:00Z');
  assert.equal(core.dayKey(before), '2026-10-14'); assert.equal(core.dayKey(after), '2026-10-15');
  assert.deepEqual(core.daily(before, 1993), core.daily(new Date('2026-10-14T02:00:00Z'), 1993));
  assert.notDeepEqual(core.daily(before, 1993), core.daily(after, 1993));
  assert.notDeepEqual(core.daily(before, 1993), core.daily(before, 1998));
  assert.notEqual(core.note(before).quote, core.note(after).quote);
});

test('stale and invalid timestamps are rejected, malicious news links cannot be used', () => {
  const now = Date.now();
  assert.equal(core.isFresh(new Date(now - 91000).toISOString(), 90000, now), false);
  assert.equal(core.isFresh('invalid', 90000, now), false);
  assert.equal(core.safeNewsUrl('javascript:alert(1)'), null);
  assert.equal(core.safeNewsUrl('https://news.google.com.evil.example/article'), null);
});

test('bus lookup converts mobileNo to stationId and verifies next stop is Sanbon station', async () => {
  const resolved = await resolveBus('synthetic-test-key', mockBus);
  assert.deepEqual(resolved, { stationId: station.stationId, routeId: '234000051', stationOrder: 50 });
  const data = await loadBus('synthetic-test-key', resolved, mockBus);
  assert.deepEqual(data.arrivals, [{ minutes: 4, stopsAway: 2, seats: 0 }]);
  assert.throws(() => verifyDirection([{ ...station, stationSeq: 1 }, { stationName: '반대 방향', stationSeq: 2 }], station.stationId));
});

test('missing, negative, stopped and unknown bus values are not fabricated', () => {
  assert.deepEqual(normalizeArrivals({ predictTime1: null, predictTime2: -1 }), []);
  assert.deepEqual(normalizeArrivals({ flag: 'STOP', predictTime1: 3 }), []);
  assert.deepEqual(normalizeArrivals({ predictTime1: 0, locationNo1: 0, remainSeatCnt1: -1 }), [{ minutes: 0, stopsAway: 0, seats: null }]);
});

test('bus missing key returns a visible configuration error, never fake arrivals', async () => {
  const response = await handle(request('/api/bus'), {}, null);
  assert.equal(response.status, 503); assert.equal((await response.json()).code, 'BUS_NOT_CONFIGURED');
});

test('upstream error cannot leak secret in response or cache keys', async () => {
  const secret = 'synthetic-secret-with-characters+/=';
  const keys = [];
  const cache = { match: async value => { keys.push(value.url); return null; } };
  const response = await handle(request('/api/bus'), { DATA_GO_KR_SERVICE_KEY: secret }, cache, async () => { throw new Error('Failure at ?serviceKey=' + secret); });
  assert.equal(response.status, 502); assert.equal((await response.text()).includes(secret), false);
  assert.equal(keys.some(key => key.includes(secret)), false);
});

test('CORS permits the Pages origin, rejects others and supports empty preflight', async () => {
  const denied = await handle(request('/api/news', { headers: { Origin: 'https://untrusted.example' } }), {}, null);
  assert.equal(denied.status, 403); assert.equal(denied.headers.has('Access-Control-Allow-Origin'), false);
  const preflight = await handle(request('/api/news', { method: 'OPTIONS' }), {}, null);
  assert.equal(preflight.status, 204); assert.equal(await preflight.text(), ''); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal((await handle(request('/api/news?url=https://untrusted.example'), {}, null)).status, 400);
});

test('RSS parsing handles entities, single items, duplicate and stale articles', () => {
  const date = new Date().toUTCString();
  const item = '<item><title><![CDATA[오늘의 <b>뉴스</b> &amp; 소식]]></title><link>https://news.google.com/rss/articles/one</link><pubDate>' + date + '</pubDate><source url="https://example.com">테스트 언론</source></item>';
  const data = parseNews('<rss><channel>' + item + item + '<item><title>이전 뉴스</title><link>https://news.google.com/old</link><pubDate>Wed, 01 Jan 2020 00:00:00 GMT</pubDate></item></channel></rss>');
  assert.equal(data.articles.length, 1); assert.equal(data.articles[0].source, '테스트 언론'); assert.equal(data.articles[0].title.includes('<b>'), false);
  assert.throws(() => parseNews('<rss>broken'));
});

test('news failure produces an error payload rather than a successful empty feed', async () => {
  const response = await handle(request('/api/news'), {}, null, async () => new Response('unavailable', { status: 503 }));
  assert.equal(response.status, 502); assert.equal((await response.json()).status, 'error');
});

test('cache returns data without repeating upstream calls', async () => {
  const map = new Map();
  const cache = { match: async key => { const value = map.get(key.url); return value ? new Response(value) : undefined; }, put: async (key, value) => map.set(key.url, await value.text()) };
  let count = 0;
  const fetcher = async url => { count++; return mockBus(url); };
  const env = { DATA_GO_KR_SERVICE_KEY: 'test-key' };
  const first = await handle(request('/api/bus'), env, cache, fetcher);
  assert.equal(first.status, 200); assert.equal(count, 4);
  const second = await handle(request('/api/bus'), env, cache, fetcher);
  assert.equal(second.status, 200); assert.equal(count, 4);
});

test('the static page loads no credential field or backend source', async () => {
  const html = await readFile('public/index.html', 'utf8'), app = await readFile('public/app.js', 'utf8'), config = await readFile('public/config.js', 'utf8');
  assert.equal((html + app + config).includes('DATA_GO_KR_SERVICE_KEY'), false);
  assert.equal(html.includes('worker/index'), false);
});
