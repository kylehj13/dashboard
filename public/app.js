(function () {
  'use strict';
  var core = window.DashboardCore, config = window.DASHBOARD_CONFIG || {}, base = '', lastDay = '', lastNews = null, wakeLock = null;
  var latest = {}, busy = {}, weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  var WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=37.359&longitude=126.932&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&wind_speed_unit=ms&timezone=Asia%2FSeoul';
  function el(id) { return document.getElementById(id); }
  function put(id, value) { el(id).textContent = value; }
  function status(name, message, error) { put(name + '-status', message); el(name + '-status').className = 'data-status' + (error ? ' error' : ''); }
  function node(tag, className, text) { var item = document.createElement(tag); if (className) item.className = className; if (text !== undefined) item.textContent = text; return item; }
  function timeLabel(value) { return new Date(value).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }); }
  function tick() {
    var now = new Date(), kst = new Date(now.getTime() + 9 * 3600000), key = core.dayKey(now);
    put('clock', core.pad(kst.getUTCHours()) + ':' + core.pad(kst.getUTCMinutes()));
    el('clock').setAttribute('datetime', now.toISOString());
    put('seconds', core.pad(kst.getUTCSeconds()));
    put('greeting', kst.getUTCHours() < 12 ? '좋은 아침, 오늘도 당신의 속도로' : kst.getUTCHours() < 18 ? '좋은 오후, 잠깐의 여유를 담아' : '편안한 저녁, 오늘도 수고했어요');
    if (key !== lastDay) {
      lastDay = key;
      put('date', kst.getUTCFullYear() + '년 ' + (kst.getUTCMonth() + 1) + '월 ' + kst.getUTCDate() + '일 ' + weekdays[kst.getUTCDay()]);
      var note = core.note(now); put('quote', note.quote); put('encouragement', note.encouragement);
      [1993, 1998].forEach(function (year) { var fortune = core.daily(now, year); put('fortune-' + year, fortune.message); put('fortune-label-' + year, fortune.label); put('fortune-tip-' + year, fortune.tip); });
    }
    if (latest.bus && !core.isFresh(latest.bus, 90000, Date.now())) {
      el('bus-arrivals').textContent = ''; el('bus-arrivals').appendChild(node('div', 'empty-state', '도착정보가 오래되어 다시 확인이 필요합니다.'));
      status('bus', '갱신 지연 · 마지막 확인 ' + timeLabel(latest.bus), true);
    }
    if (latest.news && !core.isFresh(latest.news, (lastNews && lastNews.delivery === 'static' ? 45 : 15) * 60000, Date.now())) status('news', '갱신 지연 · 이전 뉴스 표시 · 마지막 확인 ' + timeLabel(latest.news), true);
    if (latest.weather && !core.isFresh(latest.weather, 30 * 60000, Date.now())) status('weather', '갱신 지연 · 이전 날씨 표시 · 마지막 확인 ' + timeLabel(latest.weather), true);
  }
  function request(url, timeout) {
    return new Promise(function (resolve, reject) {
      var controller = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { if (controller) controller.abort(); reject(new Error('응답 시간이 초과되었습니다. 잠시 후 다시 시도합니다.')); }, timeout || 15000);
      var options = { cache: 'no-store' }; if (controller) options.signal = controller.signal;
      fetch(url, options).then(function (response) {
        return response.json().then(function (data) { if (!response.ok || data.status === 'error') throw new Error(data.message || '정보를 갱신할 수 없습니다.'); return data; });
      }).then(function (data) { clearTimeout(timer); resolve(data); }, function (error) { clearTimeout(timer); reject(error); });
    });
  }
  function api(path) {
    if (!base) return Promise.reject(new Error('실시간 정보 연결이 아직 설정되지 않았습니다.'));
    if (!navigator.onLine) return Promise.reject(new Error('인터넷 연결을 확인해 주세요.'));
    return request(base + path, 40000);
  }
  function refreshBus() {
    if (busy.bus) return Promise.resolve(); busy.bus = true;
    return api('/api/bus').then(function (data) {
      if (!core.isFresh(data.updatedAt, 90000, Date.now()) || !Array.isArray(data.arrivals)) throw new Error('버스 정보가 오래되었거나 올바르지 않습니다.');
      el('bus-arrivals').textContent = '';
      data.arrivals.slice(0, 2).forEach(function (arrival, index) {
        var item = node('div', 'arrival'); item.appendChild(node('span', 'arrival-label', index === 0 ? '곧 오는 버스' : '다음 버스'));
        var value = node('strong', '', arrival.minutes === 0 ? '곧 도착' : arrival.minutes); if (arrival.minutes !== 0) value.appendChild(node('small', '', '분')); item.appendChild(value);
        item.appendChild(node('span', 'arrival-detail', (arrival.stopsAway === null ? '위치 정보 없음' : arrival.stopsAway + '정류장 전') + (arrival.seats === null ? '' : ' · 빈자리 ' + arrival.seats)));
        el('bus-arrivals').appendChild(item);
      });
      if (!data.arrivals.length) el('bus-arrivals').appendChild(node('div', 'empty-state', '현재 도착 예정 정보가 없습니다.'));
      latest.bus = data.updatedAt; status('bus', '갱신 ' + timeLabel(data.updatedAt) + ' · 30초마다 확인', false);
    }).catch(function (error) {
      latest.bus = null; el('bus-arrivals').textContent = ''; el('bus-arrivals').appendChild(node('div', 'empty-state', '도착정보를 확인할 수 없습니다.'));
      status('bus', error.message || '버스 연결 오류 · 잠시 후 자동 재시도', true);
    }).then(function () { busy.bus = false; });
  }
  function renderNews(data) {
    el('news-list').textContent = '';
    data.articles.slice(0, 6).forEach(function (article, index) {
      var url = core.safeNewsUrl(article.url); if (!url) return;
      var item = node('li'), link = node('a'), content = node('div'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.title = article.title;
      link.appendChild(node('span', 'news-number', core.pad(index + 1))); content.appendChild(node('span', 'headline', article.title));
      content.appendChild(node('span', 'news-meta', article.source + ' · ' + timeLabel(article.publishedAt))); link.appendChild(content); item.appendChild(link); el('news-list').appendChild(item);
    });
  }
  function refreshNews() {
    if (busy.news) return Promise.resolve(); busy.news = true;
    return (base ? api('/api/news') : request('./news.json')).then(function (data) {
      if (!core.isFresh(data.updatedAt, (data.delivery === 'static' ? 45 : 15) * 60000, Date.now()) || !Array.isArray(data.articles) || !data.articles.length) throw new Error('최신 뉴스를 확인할 수 없습니다.');
      renderNews(data); lastNews = data; latest.news = data.updatedAt;
      status('news', '갱신 ' + timeLabel(data.updatedAt) + ' · Google 뉴스 · ' + (data.delivery === 'static' ? '15분 간격 자동 게시' : '5분마다 확인'), false);
      try { localStorage.setItem('morning-news-v1', JSON.stringify(data)); } catch (_) {}
    }).catch(function (error) {
      if (!lastNews) { el('news-list').textContent = ''; el('news-list').appendChild(node('li', 'empty-state', '최신 뉴스를 불러오지 못했습니다.')); }
      status('news', (error.message || '뉴스 연결 오류') + (lastNews ? ' · 이전 뉴스 표시 (' + timeLabel(lastNews.updatedAt) + ')' : ' · 자동 재시도'), true);
    }).then(function () { busy.news = false; });
  }
  function refreshWeather() {
    if (busy.weather) return Promise.resolve(); busy.weather = true;
    return request(WEATHER_URL).then(function (data) {
      var current = data.current;
      if (!current || typeof current.temperature_2m !== 'number') throw new Error('날씨 정보를 확인할 수 없습니다.');
      // Open-Meteo's local time string has no offset; parse it explicitly as KST.
      var observedAt = current.time + '+09:00';
      if (!core.isFresh(observedAt, 30 * 60000, Date.now())) throw new Error('날씨 제공 서버의 정보가 오래되었습니다.');
      var weather = core.weather(current.weather_code);
      put('temperature', Math.round(current.temperature_2m) + '°'); put('weather-icon', current.weather_code === 0 && current.is_day === 0 ? '☾' : weather.icon);
      put('weather-description', weather.text); put('feels-like', Math.round(current.apparent_temperature) + '°'); put('humidity', current.relative_humidity_2m + '%'); put('wind', Number(current.wind_speed_10m).toFixed(1) + ' m/s');
      latest.weather = observedAt; status('weather', '기준 ' + timeLabel(observedAt) + ' · Open-Meteo 예보 모델', false);
    }).catch(function (error) { status('weather', (error.message || '날씨 연결 오류') + (latest.weather ? ' · 이전 날씨 표시' : ' · 자동 재시도'), true); }).then(function () { busy.weather = false; });
  }
  function refreshAll() {
    el('refresh').disabled = true;
    return Promise.all([refreshBus(), refreshNews(), refreshWeather()]).then(function () { el('refresh').disabled = false; });
  }
  function connection() { el('connection').hidden = navigator.onLine; put('connection', '오프라인입니다. 시간과 오늘의 메시지는 계속 표시되며, 연결이 복구되면 정보를 갱신합니다.'); }
  function keepAwake() {
    if (navigator.wakeLock && document.visibilityState === 'visible' && (document.fullscreenElement || document.webkitFullscreenElement)) {
      navigator.wakeLock.request('screen').then(function (lock) { wakeLock = lock; }).catch(function () {});
    }
  }
  el('fullscreen').addEventListener('click', function () {
    var active = document.fullscreenElement || document.webkitFullscreenElement, result;
    if (active) {
      var exit = document.exitFullscreen || document.webkitExitFullscreen; if (exit) result = exit.call(document);
      if (wakeLock) { wakeLock.release(); wakeLock = null; }
    } else {
      var enter = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
      if (!enter) { put('footer-status', '브라우저 메뉴에서 전체 화면을 사용해 주세요.'); return; }
      result = enter.call(document.documentElement);
    }
    if (result && result.catch) result.catch(function () { put('footer-status', '전체 화면을 시작할 수 없습니다.'); });
  });
  function fullscreenChanged() { var active = document.fullscreenElement || document.webkitFullscreenElement; el('fullscreen').setAttribute('aria-label', active ? '전체 화면 종료' : '전체 화면 시작'); if (active) keepAwake(); else if (wakeLock) { wakeLock.release(); wakeLock = null; } }
  document.addEventListener('fullscreenchange', fullscreenChanged); document.addEventListener('webkitfullscreenchange', fullscreenChanged);
  el('refresh').addEventListener('click', refreshAll);
  window.addEventListener('offline', connection); window.addEventListener('online', function () { connection(); refreshAll(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { tick(); refreshAll(); keepAwake(); } });
  try { var url = new URL(config.apiBaseUrl); if (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].indexOf(url.hostname) !== -1)) base = url.origin; } catch (_) {}
  try { var cached = JSON.parse(localStorage.getItem('morning-news-v1')); if (cached && core.isFresh(cached.updatedAt, 48 * 3600000, Date.now()) && Array.isArray(cached.articles)) { lastNews = cached; renderNews(cached); status('news', '이전 뉴스 표시 · 연결 확인 중', true); } } catch (_) {}
  tick(); connection(); refreshAll();
  setInterval(tick, 1000);
  setInterval(function () { if (!document.hidden) refreshBus(); }, Math.max(30000, config.busRefreshMs || 30000));
  setInterval(function () { if (!document.hidden) refreshNews(); }, Math.max(300000, config.newsRefreshMs || 300000));
  setInterval(function () { if (!document.hidden) refreshWeather(); }, Math.max(600000, config.weatherRefreshMs || 600000));
}());
