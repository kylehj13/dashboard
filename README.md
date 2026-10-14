# Morning Dashboard · 산본

갤럭시 탭 S3에서 하루를 시작하기 위한 한국어 대시보드입니다. 다크 테마에 한국 시간, 산본의 현재 날씨, 집 앞 3500번 버스, 국내 주요 뉴스, 매일 바뀌는 창작 명언과 응원, 1993년생·1998년생의 오락용 창작 운세를 표시합니다.

게시 후 사용할 주소: **https://kylehj13.github.io/dashboard/**

소스 ZIP으로 받았다면 압축을 푼 `morning-dashboard` 폴더에서 아래 명령으로 빈 저장소에 코드를 올릴 수 있습니다. GitHub 쓰기 권한이 있는 로컬 Git 또는 Codex 저장소 환경에서 실행합니다. `dist/`는 빌드 결과로 Git에 포함하지 않습니다.

```bash
git init -b main
git add .
git commit -m "Build Sanbon Morning Dashboard"
git remote add origin https://github.com/kylehj13/dashboard.git
git push -u origin main
```

이미 저장소에 코드가 있다면 먼저 해당 저장소를 내려받고 소스를 옮겨 변경 내용을 검토한 뒤 커밋합니다.

## 동작과 데이터

| 항목 | 데이터 경로 | 갱신 |
| --- | --- | --- |
| 시간·날짜 | 기기 시각을 한국 시간으로 변환 | 매초 |
| 산본 날씨 | Open-Meteo 현재 예보 모델, 37.359 / 126.932 | 10분 |
| 3500번 버스 | Worker → 경기도 공식 버스 API | 30초 |
| 국내 주요 뉴스 | Google 뉴스 한국 주요 뉴스 RSS | Worker 연결 시 5분 |
| 기본 뉴스 | GitHub Actions → 공개 `news.json` | 15분 간격 게시 예약, 화면에서 5분마다 확인 |
| 명언·응원·운세 | 날짜별 창작 메시지 | 한국 시간 자정 |

GitHub Actions 예약 실행은 GitHub 상황에 따라 지연될 수 있습니다. 기본 뉴스가 45분 이상 갱신되지 않으면 오류를 표시합니다. Worker 뉴스는 15분, 버스는 90초 이후 정보가 오래되었다고 표시합니다. 버스 갱신 실패 시 이전 도착 시간을 지웁니다. 뉴스와 날씨는 마지막 정보가 있으면 오류 안내와 함께 이전 정보임을 표시합니다. 뉴스는 최근 48시간의 주요 기사에서 최대 6개 제목·출처·원문 링크만 제공합니다.

명언과 운세는 이 대시보드를 위한 창작 문구이며 실제 인물의 인용이나 미래 예측으로 제시하지 않습니다. 날씨는 Open-Meteo의 현재 예보 모델 값입니다.

## 1. GitHub Pages 배포

1. 저장소의 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 선택합니다.
2. **Actions → Deploy Morning Dashboard → Run workflow → main**을 실행합니다. `main`에 코드를 푸시해도 자동 배포됩니다.
3. 성공한 실행의 `deploy` 작업과 Settings → Pages에서 게시 주소를 확인합니다.
4. https://kylehj13.github.io/dashboard/ 에 접속합니다.

워크플로는 검증 후 `public/`을 `dist/`로 복사하고, 최신 뉴스 파일을 만들어 Pages에 게시합니다. 서버 코드와 인증키는 정적 배포 파일에 포함하지 않습니다. 저장소 이름을 경로로 사용하는 Pages 환경을 위해 모든 정적 자산 경로는 상대 경로입니다.

버스 설정을 하기 전에도 시간·날씨·뉴스·오늘의 메시지를 사용할 수 있고, 버스에는 연결 설정이 필요하다는 상태가 표시됩니다.

## 2. 버스 API 활용 신청

[공공데이터포털](https://www.data.go.kr/)에 로그인해 아래 세 서비스를 검색하고 활용 신청합니다.

- **경기도 버스도착정보 조회서비스** — [서비스 신청 페이지](https://www.data.go.kr/data/15080346/openapi.do)
- **경기도 버스정류소 조회서비스**
- **경기도 버스노선 조회서비스**

각 서비스의 활용 승인이 필요합니다. 포털의 **디코딩 인증키**를 사용합니다. 코드에서 `URLSearchParams`로 인코딩하므로 이미 인코딩된 키를 넣으면 이중 인코딩으로 인증에 실패할 수 있습니다. 실제 키를 GitHub 파일·공개 변수·브라우저 설정에 넣지 마세요.

`26052`는 정류장에 표시되는 번호(`mobileNo`)이며 API용 `stationId`와 다릅니다. Worker는 공식 API에서 군포시의 주공2단지충무아파트(26052)를 찾아 API ID로 변환하고, 이 정류장을 지나는 3500번 노선의 다음 정류장이 산본역인지 확인합니다. 방향을 검증할 수 없으면 오류를 표시합니다. 테스트용 ID를 실제 운영 값으로 사용하지 않습니다.

## 3. 인증키를 보관하는 Worker 배포

GitHub Pages에서는 서버 코드를 실행할 수 없어 별도 Cloudflare Worker를 사용합니다. Cloudflare 계정은 직접 준비해야 하며, 공공데이터포털 인증키도 자동 발급하지 않습니다.

로컬 컴퓨터에서 저장소를 내려받고 Node.js 22 이상을 설치한 뒤 실행합니다.

```bash
npm ci
npx wrangler login
npm run api:deploy
npx wrangler secret put DATA_GO_KR_SERVICE_KEY --config worker/wrangler.toml
```

마지막 명령의 입력 프롬프트에서 디코딩 인증키를 붙여 넣습니다. 키는 **Worker Secret**으로만 저장됩니다. Cloudflare 대시보드에서도 Worker → Settings → Variables and Secrets → Add → Secret에서 같은 이름으로 저장할 수 있습니다.

배포 결과로 나온 `https://morning-dashboard-api.<계정>.workers.dev` 주소를 기록합니다. `worker/wrangler.toml`의 `ALLOWED_ORIGINS`에는 `https://kylehj13.github.io`가 기본 등록되어 있습니다. 다른 호스트로 사이트를 옮기면 실제 사이트의 origin을 추가합니다. `/dashboard/` 경로는 origin에 넣지 않습니다.

확인할 주소:

```text
https://<배포한-Worker-주소>/api/news
https://<배포한-Worker-주소>/api/bus
```

`/api/news`는 키 없이 동작합니다. `/api/bus`는 인증키·세 서비스 활용 승인이 완료돼야 동작합니다. 버스가 오지 않는 시각에는 정상 응답이어도 `arrivals: []`일 수 있습니다. 인증·조회·방향 확인 실패는 `status: "error"`로 반환됩니다.

Worker는 정해진 두 조회 경로만 제공하며 사용자 지정 URL·정류장·노선 매개변수를 허용하지 않습니다. 정상 뉴스는 5분, 버스는 30초, 정류장·방향 확인 결과는 하루 동안 서버에서 캐시합니다. 오류 응답과 캐시 주소에는 인증키나 원본 API 오류를 넣지 않습니다. CORS는 허용한 브라우저 origin만 제한하며, 공개 API 자체의 인증 수단은 아닙니다. 이용량은 Cloudflare에서 확인할 수 있습니다.

## 4. 사이트에 Worker 주소 연결

1. 저장소의 **Settings → Secrets and variables → Actions → Variables → New repository variable**을 엽니다.
2. 이름은 `DASHBOARD_API_BASE_URL`, 값은 배포한 Worker의 HTTPS 주소를 입력합니다. `/api` 경로·검색 매개변수·인증키를 포함하지 않습니다.
3. **Deploy Morning Dashboard** 워크플로를 다시 실행합니다.

이 공개 변수에는 서버 주소만 들어갑니다. `DATA_GO_KR_SERVICE_KEY`를 GitHub Actions 변수에 추가할 필요가 없습니다. Worker 주소를 연결하면 뉴스도 서버에서 5분마다 갱신하고 버스 조회를 시작합니다. 주소 연결을 제거하면 뉴스는 기본 정적 게시 방식으로 돌아갑니다.

## 5. 태블릿 키오스크 사용

- 브라우저에서 사이트를 연 뒤 오른쪽 위 **⛶** 버튼으로 전체 화면을 시작합니다. 종료는 같은 버튼이나 브라우저 뒤로가기를 사용합니다.
- 가로·세로 회전 시 카드가 재배치됩니다. 2048×1536·1536×2048 픽셀과 탭 S3의 일반적인 CSS 화면 크기인 1024×768·768×1024에 대응합니다. 작은 휴대폰에서는 세로 스크롤을 사용합니다.
- 지원 브라우저에서는 전체 화면 중 Screen Wake Lock으로 화면 꺼짐을 방지합니다. 오래된 브라우저에서는 Android의 화면 꺼짐 시간이나 사용하는 키오스크 앱의 설정을 이용합니다.
- 브라우저 메뉴의 **홈 화면에 추가**도 사용할 수 있습니다. 전체 화면 API와 화면 유지 기능은 브라우저 지원에 따라 다릅니다.
- 켜져 있는 화면에서 인터넷이 끊겨도 시간·오늘의 메시지는 계속 동작합니다. 연결 복구 또는 화면 복귀 때 데이터를 다시 확인합니다. 최초 오프라인 로딩을 위한 서비스 워커는 포함하지 않습니다.
- 시계는 기기의 시간을 사용하므로 태블릿의 자동 날짜·시간 설정을 켭니다.

## 개발 및 검증

```bash
npm ci
npm run check
npm test
npm run build
python -m http.server 8080 --directory dist
```

로컬에서 기본 뉴스를 가져오는 빌드:

```bash
DASHBOARD_FETCH_NEWS=1 npm run build
```

로컬 API 개발은 `worker/.dev.vars.example`을 `worker/.dev.vars`로 복사해 키를 입력하고 `npm run api:dev`를 실행합니다. 공개 설정 `public/config.js`의 `apiBaseUrl`을 출력된 로컬 API 주소로 바꾸고 정적 사이트를 다시 빌드합니다. `.dev.vars`는 Git에서 제외됩니다. 실서비스 설정은 GitHub의 URL 변수를 사용하는 것이 편합니다.

자동 테스트는 한국 시간 자정의 문구 변경, 정류장 번호 변환, 산본역 방향 검증, 잘못된 도착 값, 인증키 누락, 오류 응답의 인증키 보호, CORS, RSS·기사 링크 검증, 서버 캐시를 확인합니다. 실제 버스 API는 키가 준비된 후 `/api/bus`에서 별도로 확인해야 합니다.

## 공식 참고 문서

- [GitHub Pages 게시 소스 설정](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [GitHub Pages 사용자 지정 워크플로](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [경기버스정보 도착정보 목록 API](https://www.gbis.go.kr/gbis2014/publicService.action?cmd=mBusArrivalStation)
- [경기버스정보 정류소 검색 API](https://www.gbis.go.kr/gbis2014/publicService.action?cmd=mBusStation)
- [경기버스정보 경유정류소 API](https://www.gbis.go.kr/gbis2014/publicService.action?cmd=mBusRouteStation)
- [Cloudflare Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Open-Meteo 날씨 API 및 출처](https://open-meteo.com/en/docs) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
