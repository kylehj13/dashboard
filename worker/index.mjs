import { XMLParser, XMLValidator } from 'fast-xml-parser';

const NEWS_URL = 'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko';
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, processEntities: true });
const array = value => Array.isArray(value) ? value : value ? [value] : [];
const updatedAt = () => new Date().toISOString();

export class DataError extends Error {
  constructor(code, message, status = 502) { super(message); this.code = code; this.status = status; }
}

async function get(url, fetcher = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher(url, { signal: controller.signal, headers: { Accept: 'application/json, application/xml, text/xml' } });
    if (!response.ok) throw new DataError('UPSTREAM_ERROR', '정보 제공 서버에 연결할 수 없습니다. 잠시 후 다시 시도합니다.');
    return await response.text();
  } catch (error) {
    if (error instanceof DataError) throw error;
    // Upstream URLs, bodies and exception messages may contain credentials.
    throw new DataError('UPSTREAM_ERROR', '정보 제공 서버의 응답이 지연되고 있습니다. 잠시 후 다시 시도합니다.');
  } finally { clearTimeout(timeout); }
}

export async function gbis(service, operation, parameters, key, fetcher = fetch) {
  const url = new URL('https://apis.data.go.kr/6410000/' + service + '/v2/' + operation);
  url.search = new URLSearchParams({ format: 'json', serviceKey: key, ...parameters }).toString();
  let data;
  try { data = JSON.parse(await get(url, fetcher)); }
  catch (error) {
    if (error instanceof DataError) throw error;
    throw new DataError('BUS_AUTH_ERROR', '버스 API 인증 또는 응답을 확인해 주세요.');
  }
  const response = data.response || data;
  const header = response.msgHeader;
  if (!header || header.resultCode === undefined) throw new DataError('BUS_RESPONSE_ERROR', '버스 정보 형식을 확인할 수 없습니다.');
  const code = String(header.resultCode);
  if (code === '4') return {};
  if (code !== '0') throw new DataError('BUS_API_ERROR', '버스 API 조회에 실패했습니다. 인증키와 서비스 활용 승인을 확인해 주세요.');
  return response.msgBody || {};
}

export function verifyDirection(stops, stationId) {
  const ordered = array(stops).slice().sort((a, b) => Number(a.stationSeq) - Number(b.stationSeq));
  const index = ordered.findIndex(stop => String(stop.stationId) === String(stationId));
  const next = ordered[index + 1];
  if (index < 0 || !next || !String(next.stationName).includes('산본역')) {
    throw new DataError('BUS_DIRECTION_ERROR', '산본역 방향을 확인할 수 없습니다. 정류장과 노선 정보를 확인해 주세요.');
  }
  return Number(ordered[index].stationSeq);
}

export async function resolveBus(key, fetcher = fetch) {
  const stations = await gbis('busstationservice', 'getBusStationListv2', { keyword: '26052' }, key, fetcher);
  const matches = array(stations.busStationList).filter(stop => String(stop.mobileNo).trim() === '26052' && String(stop.stationName).includes('충무') && String(stop.regionName).includes('군포'));
  if (matches.length !== 1) throw new DataError('BUS_STATION_ERROR', '주공2단지충무아파트 정류장(26052)을 확인할 수 없습니다.');
  const stationId = String(matches[0].stationId);
  const routes = await gbis('busstationservice', 'getBusStationViaRouteListv2', { stationId }, key, fetcher);
  const route = array(routes.busRouteList).filter(item => String(item.routeName) === '3500');
  if (route.length !== 1) throw new DataError('BUS_ROUTE_ERROR', '이 정류장의 3500번 노선을 확인할 수 없습니다.');
  const routeId = String(route[0].routeId);
  const stops = await gbis('busrouteservice', 'getBusRouteStationListv2', { routeId }, key, fetcher);
  const stationOrder = verifyDirection(stops.busRouteStationList, stationId);
  return { stationId, routeId, stationOrder };
}

export function normalizeArrivals(item) {
  if (!item || ['STOP', 'WAIT'].includes(item.flag)) return [];
  return [1, 2].flatMap(n => {
    const raw = item['predictTime' + n];
    const minutes = Number(raw);
    if (raw === null || raw === undefined || raw === '' || !Number.isFinite(minutes) || minutes < 0) return [];
    const count = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0 ? null : Number(value);
    return [{ minutes, stopsAway: count(item['locationNo' + n]), seats: count(item['remainSeatCnt' + n]) }];
  });
}

export async function loadBus(key, resolved, fetcher = fetch) {
  const body = await gbis('busarrivalservice', 'getBusArrivalListv2', { stationId: resolved.stationId }, key, fetcher);
  const item = array(body.busArrivalList).find(item => String(item.routeId) === resolved.routeId && Number(item.staOrder) === resolved.stationOrder);
  return { status: 'ok', updatedAt: updatedAt(), station: '주공2단지충무아파트', mobileNo: '26052', route: '3500', direction: '산본역', arrivals: normalizeArrivals(item) };
}

function textValue(value) { return String(typeof value === 'object' && value !== null ? value['#text'] || '' : value || '').replace(/<[^>]*>/g, '').trim(); }
export function parseNews(xml, now = Date.now()) {
  if (xml.length > 2000000 || XMLValidator.validate(xml) !== true) throw new DataError('NEWS_PARSE_ERROR', '뉴스 정보를 읽을 수 없습니다.');
  const items = array(parser.parse(xml)?.rss?.channel?.item);
  const seen = new Set();
  const articles = items.flatMap(item => {
    const title = textValue(item.title);
    const link = textValue(item.link);
    const date = Date.parse(textValue(item.pubDate));
    let url;
    try { url = new URL(link); } catch { return []; }
    if (!title || url.protocol !== 'https:' || url.hostname !== 'news.google.com' || !Number.isFinite(date) || now - date > 48 * 3600000 || date > now + 300000 || seen.has(link)) return [];
    seen.add(link);
    return [{ title: title.slice(0, 240), url: url.href, source: textValue(item.source).slice(0, 80) || '국내 뉴스', publishedAt: new Date(date).toISOString() }];
  }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 6);
  if (!articles.length) throw new DataError('NEWS_EMPTY', '최근 48시간의 주요 뉴스가 없습니다. 잠시 후 다시 확인합니다.');
  return { status: 'ok', updatedAt: updatedAt(), provider: 'Google 뉴스 · 한국 주요 뉴스', articles };
}

export function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS || 'https://kylehj13.github.io').split(',').map(value => value.trim());
  return !origin || allowed.includes(origin);
}

function json(body, request, status = 200) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };
  const origin = request.headers.get('Origin');
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

async function cached(cache, cacheKey, ttl, loader) {
  // Cache keys contain neither credentials nor caller-supplied parameters.
  const request = new Request(cacheKey);
  const hit = cache && await cache.match(request);
  if (hit) return hit.json();
  const data = await loader();
  if (cache) await cache.put(request, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=' + ttl } }));
  return data;
}

export async function handle(request, env, cache, fetcher = fetch) {
  if (!allowedOrigin(request, env)) return new Response('Forbidden', { status: 403 });
  if (request.method === 'OPTIONS') {
    const headers = json({}, request).headers;
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Max-Age', '86400');
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== 'GET') return json({ status: 'error', message: 'GET 요청만 지원합니다.' }, request, 405);
  const url = new URL(request.url);
  if (url.search) return json({ status: 'error', message: '조회 매개변수는 지원하지 않습니다.' }, request, 400);
  try {
    if (url.pathname === '/api/news') {
      return json(await cached(cache, url.origin + '/cache/v1/news', 300, async () => parseNews(await get(NEWS_URL, fetcher))), request);
    }
    if (url.pathname === '/api/bus') {
      const key = env.DATA_GO_KR_SERVICE_KEY;
      if (!key) throw new DataError('BUS_NOT_CONFIGURED', '버스 인증키가 아직 설정되지 않았습니다.', 503);
      const resolved = await cached(cache, url.origin + '/cache/v1/bus-station', 86400, () => resolveBus(key, fetcher));
      return json(await cached(cache, url.origin + '/cache/v1/bus', 30, () => loadBus(key, resolved, fetcher)), request);
    }
    return json({ status: 'error', message: '요청한 주소가 없습니다.' }, request, 404);
  } catch (error) {
    const safe = error instanceof DataError ? error : new DataError('DATA_ERROR', '정보를 갱신할 수 없습니다. 잠시 후 다시 시도합니다.');
    return json({ status: 'error', code: safe.code, message: safe.message, updatedAt: updatedAt() }, request, safe.status);
  }
}

export default { fetch: (request, env) => handle(request, env, caches.default) };
