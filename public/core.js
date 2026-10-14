(function (root) {
  'use strict';
  function dayKey(date) {
    var kst = new Date(date.getTime() + 9 * 3600000);
    return kst.getUTCFullYear() + '-' + pad(kst.getUTCMonth() + 1) + '-' + pad(kst.getUTCDate());
  }
  function pad(n) { return ('0' + n).slice(-2); }
  function dayNumber(date) { return Math.floor((date.getTime() + 9 * 3600000) / 86400000); }
  var quotes = [
    '작은 시작도 충분히 좋은 시작이다.', '오늘의 한 걸음이 내일의 길을 만든다.', '속도보다 소중한 것은 나의 방향이다.',
    '잘 쉬는 시간도 앞으로 가는 시간이다.', '완벽한 하루보다 진심인 하루를 살자.', '비교를 내려놓으면 나의 길이 보인다.',
    '어제보다 조금 다정해진 오늘이면 충분하다.', '시작할 용기는 작은 행동에서 자란다.', '꾸준함은 눈에 보이지 않는 날에도 쌓인다.',
    '나에게 건네는 응원도 힘이 된다.', '모르는 것을 묻는 순간 배움이 시작된다.', '느린 걸음에도 도착할 곳은 있다.',
    '마음을 돌보는 일이 오늘의 첫 일이다.', '작은 기쁨을 발견하는 눈을 잊지 말자.', '실수는 다음 시도를 위한 메모다.',
    '새로운 길은 익숙한 문밖에서 시작된다.', '오늘 할 수 있는 하나에 마음을 모으자.', '고마움을 말하면 하루가 따뜻해진다.',
    '지금의 나도 충분히 애쓰고 있다.', '불안한 날에도 나의 걸음은 이어진다.', '좋은 습관 하나가 하루의 중심을 잡는다.',
    '내가 지킬 수 있는 약속부터 시작하자.', '휴식은 멈춤이 아니라 나를 채우는 일이다.', '평범한 하루에도 빛나는 순간은 있다.',
    '결과를 기다리는 동안에도 나는 자란다.', '용기는 두려움과 함께 한 발 내딛는 일이다.', '다정한 한마디가 누군가의 아침을 바꾼다.',
    '나의 리듬을 찾는 일에는 시간이 필요하다.', '어제의 답이 오늘의 유일한 답은 아니다.', '작은 성취를 알아봐 주는 사람이 되자.',
    '오늘이라는 새 페이지에 나의 이야기를 쓰자.'
  ];
  var cheers = ['서두르지 않아도 괜찮아요. 오늘도 당신의 속도로.', '작은 일 하나를 해낸 당신에게 박수를 보내요.', '물 한 잔, 깊은 숨 한 번. 좋은 시작이에요.', '오늘의 당신에게 조금 더 다정해 주세요.', '마음에 드는 순간을 하나 발견하는 하루가 되길.', '모든 일을 끝내지 않아도 충분히 애썼어요.', '새로운 하루를 시작하는 당신을 응원해요.'];
  var labels = ['차분한 시작', '기분 좋은 발견', '다정한 연결', '작은 도전', '나만의 리듬', '가벼운 마음', '꾸준한 한 걸음'];
  var openings = ['작게 미뤄 둔 일을 하나 정리하면 마음이 가벼워질 수 있어요.', '익숙한 일상에서 새로운 아이디어를 발견하는 하루를 상상해 보세요.', '주변 사람에게 먼저 건네는 인사가 기분 좋은 대화로 이어질 수 있어요.', '처음 해 보는 일을 가볍게 시도하기에 좋은 날로 정해 보세요.', '다른 사람의 속도보다 나의 리듬에 집중해 보세요.', '복잡한 생각은 종이에 적고 오늘 할 일 하나를 골라 보세요.', '눈에 띄지 않던 작은 성취를 스스로 알아봐 주세요.'];
  var endings = ['마무리한 뒤에는 짧은 휴식을 선물하세요.', '결정을 서두르기보다 한 번 더 확인해 보세요.', '좋아하는 음악과 함께 기분을 환기해 보세요.', '부담스러운 약속보다 편안한 시간을 골라 보세요.', '스스로에게 고맙다는 말을 건네 보세요.'];
  var tips = ['오늘의 작은 행운 · 따뜻한 차 한 잔', '오늘의 작은 행운 · 5분 산책', '오늘의 작은 행운 · 좋아하는 노래', '오늘의 작은 행운 · 창가의 햇빛', '오늘의 작은 행운 · 반가운 안부', '오늘의 작은 행운 · 정리된 책상', '오늘의 작은 행운 · 한 줄의 기록'];
  function daily(date, year) {
    var n = dayNumber(date), offset = year === 1993 ? 2 : 5;
    return { label: labels[(n + offset) % labels.length], message: openings[(n + offset) % openings.length] + ' ' + endings[(Math.floor(n / 7) + offset) % endings.length], tip: tips[(n + offset) % tips.length] };
  }
  function note(date) { var n = dayNumber(date); return { quote: quotes[n % quotes.length], encouragement: cheers[n % cheers.length] }; }
  function weather(code) {
    if (code === 0) return { text: '맑음', icon: '☀' };
    if (code <= 2) return { text: '구름 조금', icon: '☀' };
    if (code === 3) return { text: '흐림', icon: '☁' };
    if (code === 45 || code === 48) return { text: '안개', icon: '≋' };
    if ([71, 73, 75, 77, 85, 86].indexOf(code) !== -1) return { text: '눈', icon: '❄' };
    if (code >= 95) return { text: '뇌우', icon: 'ϟ' };
    if (code >= 51 && code <= 82) return { text: '비', icon: '☂' };
    return { text: '날씨 확인 중', icon: '☁' };
  }
  function isFresh(value, maxAge, now) {
    var timestamp = Date.parse(value);
    return isFinite(timestamp) && now - timestamp >= -300000 && now - timestamp <= maxAge;
  }
  function safeNewsUrl(value) {
    try { var url = new URL(value); return url.protocol === 'https:' && url.hostname === 'news.google.com' ? url.href : null; } catch (_) { return null; }
  }
  root.DashboardCore = { dayKey: dayKey, pad: pad, daily: daily, note: note, weather: weather, isFresh: isFresh, safeNewsUrl: safeNewsUrl };
}(typeof window !== 'undefined' ? window : globalThis));
