import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { parseNews } from '../worker/index.mjs';

// Only public/ is packaged. Worker sources, dependencies and secrets stay out of Pages.
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
if (process.env.DASHBOARD_FETCH_NEWS === '1') {
  let news;
  try {
    const response = await fetch('https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko', { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('News provider unavailable');
    news = { ...parseNews(await response.text()), delivery: 'static' };
  } catch {
    news = { status: 'error', message: '뉴스 게시 과정에서 갱신에 실패했습니다. 다음 자동 게시 때 다시 시도합니다.', updatedAt: new Date().toISOString() };
  }
  await writeFile('dist/news.json', JSON.stringify(news));
  console.log('News snapshot: ' + news.status);
}
const apiBaseUrl = process.env.DASHBOARD_API_BASE_URL;
if (apiBaseUrl) {
  const url = new URL(apiBaseUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('DASHBOARD_API_BASE_URL must be an HTTPS Worker origin without credentials, path or query.');
  }
  const config = await readFile('dist/config.js', 'utf8');
  await writeFile('dist/config.js', config.replace('apiBaseUrl: ""', 'apiBaseUrl: ' + JSON.stringify(url.origin)));
}
await writeFile('dist/.nojekyll', '');
console.log('Static dashboard built in dist/');
