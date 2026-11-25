# 정글 식당

정글 A코너 식단을 보여 주고, 오늘 식사에 대한 한마디를 남기는 웹 서비스입니다.
[mini-web-server](https://github.com/krafton-jungle-week13-team/mini-web-server)의 `tiny` 하나로 정적 파일, CGI, 리버스 프록시를 모두 처리합니다.

## 실행
mini-web-server를 이 저장소와 같은 폴더에 클론하고 `tiny/`에서 `make`로 빌드한 뒤 실행합니다.

```bash
git clone https://github.com/krafton-jungle-week13-team/mini-web-server
(cd mini-web-server/tiny && make)
cd jungle-cafeteria && bash run.sh                 # → http://localhost:8000/
```

tiny가 다른 위치에 있으면 경로를 직접 지정합니다.

```bash
TINY=/경로/tiny bash run.sh
```

`run.sh`는 tiny를 세 개 띄웁니다. Ctrl+C로 프록시를 끄면 백엔드도 함께 종료됩니다.

| 포트 | 역할 | 문서 루트 |
|---|---|---|
| 8000 | 웹 서버 + 리버스 프록시 (브라우저는 여기로 접속) | `web/` |
| 8001 | 식단 API 백엔드 1 | `menu-api/backend1/` |
| 8002 | 식단 API 백엔드 2 | `menu-api/backend2/` |

```
브라우저 ──► :8000 tiny (web/)
              ├─ /api/*      ──► :8001 / :8002 tiny (라운드로빈)
              ├─ /cgi-bin/*  ──► CGI 프로그램 실행
              └─ 그 외        ──► web/ 아래 정적 파일
```

## 구조
```
jungle-cafeteria/
├── run.sh                  # tiny 3개 실행
├── routes.conf             # /api → 8001, 8002
├── menu-api/
│   ├── menu.txt            # 주간 식단 (원본)
│   ├── backend1/api/       # menu.txt(링크), whoami.txt = "backend-1 (:8001)"
│   └── backend2/api/       # menu.txt(링크), whoami.txt = "backend-2 (:8002)"
├── web/
│   ├── home.html           # 홈
│   ├── css/ js/ img/       # 정적 파일
│   └── cgi-bin/
│       ├── talk            # 식키타카 (Python CGI)
│       └── slow            # 블로킹 시연용 CGI
└── data/talk.txt           # 식키타카 글 저장 (웹 루트 밖, git 제외)
```

## 웹 기능
### 홈 (`/`)
- **오늘의 식사**: 점심·저녁 사진과 메뉴 이름을 보여 줍니다. 지금 시간에 맞는 끼니(15시 전이면 점심)를 강조합니다.
- **이번 주 식단**: 날짜별 점심·저녁 메뉴를 표로 보여 주고, 오늘 줄을 강조합니다.
- **날짜 바꿔 보기**: 주소 끝에 `#2026-11-25`처럼 날짜를 붙이면 그 날짜 기준으로 다시 그립니다.

### 식키타카 (`/cgi-bin/talk`)
- **오늘의 메뉴 요약**: 홈과 같은 식단 데이터에서 오늘의 대표 메뉴를 보여 줍니다.
- **한마디 남기기**: 이름(비우면 익명), 끼니, 내용(최대 300자)을 POST로 보냅니다.
- **글 보기**: 날짜별로 묶어 최신순으로 보여 줍니다. 탭으로 점심·저녁만 골라 볼 수 있습니다.

## 사용하는 mini-web-server 기능
| mini-web-server 기능 | 정글 식당에서 쓰는 곳 |
|---|---|
| 정적 콘텐츠 | `home.html`, `css/`, `js/`, `img/` |
| `/` → `home.html` | 홈 주소 `/` |
| 확장자별 MIME 타입, `charset=utf-8` | `.png` 사진, `.css`, `.js`, 한글이 든 `menu.txt` |
| 404 응답 | 사진이 없는 날 → 준비 중 이미지로 교체 |
| 쿼리 스트링 미처리 (정적) | 날짜 지정을 `?date=` 대신 `#날짜`로 처리 |
| CGI GET + `QUERY_STRING` | `/cgi-bin/talk?meal=lunch` 끼니 필터 |
| CGI POST + stdin, `CONTENT_LENGTH` | 식키타카 글 등록 |
| CGI가 헤더를 직접 출력 | `talk`, `slow`가 `Content-Type`, `Content-Length` 출력 |
| 리버스 프록시 (`-c routes.conf`) | `/api/menu.txt`를 식단 백엔드로 전달 |
| 라운드로빈 | 백엔드 8001, 8002에 번갈아 전달 |
| 502 응답 | 백엔드가 꺼지면 식단 대신 오류 안내 |
| 413 응답 (body 8KB 초과) | 너무 긴 글 요청을 서버가 거절 |
| select 이벤트 루프 / 블로킹 한계 | `/cgi-bin/slow`로 확인 |

### 정적 콘텐츠
프록시 tiny(:8000)는 `web/`에서 실행되므로 `web/`이 문서 루트입니다. `/`로 접속하면 `web/home.html`을 보냅니다.

서버가 확장자로 `Content-Type`을 정하고, 텍스트 파일에는 `charset=utf-8`을 붙입니다. 그래서 `menu.txt`의 한글이 깨지지 않고, 브라우저가 `style.css`와 `home.js`를 스타일시트와 스크립트로 인식합니다.

tiny는 HEAD를 지원하지 않으므로(`curl -I`는 501) GET으로 헤더만 출력해 확인합니다.

```bash
curl -s -D - -o /dev/null http://localhost:8000/                # Content-type: text/html; charset=utf-8
curl -s -D - -o /dev/null http://localhost:8000/css/style.css   # text/css; charset=utf-8
curl -s -D - -o /dev/null http://localhost:8000/api/menu.txt    # text/plain; charset=utf-8
curl -s -D - -o /dev/null http://localhost:8000/img/ready.png   # image/png
```

**404를 이용한 사진 대체**: 홈은 `/img/meals/<날짜>-lunch.png`를 요청합니다. 사진이 없으면 tiny가 404를 응답하고, `home.js`의 `onerror`가 준비 중 이미지(`/img/ready.png`)로 바꿉니다.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/img/meals/2026-11-25-lunch.png   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/img/meals/2026-11-26-lunch.png   # 404 → 화면엔 준비 중 이미지
```

**쿼리 스트링 대신 해시**: tiny는 정적 파일 요청의 쿼리 스트링을 처리하지 않아 `/home.html?a=1`도 404를 응답합니다. 그래서 날짜는 `/#2026-11-25`처럼 해시로 넘깁니다. 해시는 서버로 보내지 않으므로 tiny는 `/`만 받고, 날짜는 브라우저의 JavaScript가 읽습니다.

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8000/?date=2026-11-25"   # 404
# 브라우저: http://localhost:8000/#2026-11-25      → 11/25 사진과 메뉴
```

**405**: 정적 파일은 GET만 받습니다.

```bash
curl -i -X POST http://localhost:8000/home.html   # 405 Method Not Allowed, Allow: GET
```

### 동적 콘텐츠 (CGI)
경로에 `cgi-bin`이 있으면 tiny가 `web/cgi-bin/` 아래 프로그램을 실행합니다. `talk`와 `slow`는 Python 스크립트이고 실행 권한(`chmod +x`)이 있어야 합니다. 권한이 없으면 403이 납니다.

tiny는 상태 줄과 `Server` 헤더만 보내므로, `talk`가 `Content-Type`, `Content-Length`와 빈 줄을 직접 출력합니다.

**GET + `QUERY_STRING`**: 끼니 탭을 누르면 `/cgi-bin/talk?meal=lunch`를 요청합니다. tiny가 `?` 뒤의 `meal=lunch`를 `QUERY_STRING`에 넣고, `talk`가 이를 읽어 점심 글만 보여 줍니다.

```bash
curl "http://localhost:8000/cgi-bin/talk?meal=lunch"
```

**POST + stdin**: 글을 남기면 브라우저가 폼을 POST로 보냅니다. tiny는 body 길이를 `CONTENT_LENGTH`에, body를 표준 입력에 넣어 `talk`에 넘깁니다. `talk`는 이를 읽어 `data/talk.txt`에 한 줄씩 저장합니다.

```bash
curl -d "name=정글러&meal=lunch&text=비빔밥 맛있어요" http://localhost:8000/cgi-bin/talk
```

**411 / 413**: Content-Length가 없거나 body가 8KB를 넘으면 `talk`를 실행하기 전에 tiny가 거절합니다.

```bash
head -c 9000 /dev/zero | tr '\0' a | curl -i --data-binary @- http://localhost:8000/cgi-bin/talk   # 413
```

### 리버스 프록시
프록시 tiny는 `-c routes.conf`로 실행합니다.

```
# prefix  strip  backends
/api      no     127.0.0.1:8001 127.0.0.1:8002
```

- `/api`로 시작하는 요청은 경로를 그대로 두고 백엔드로 넘깁니다. 백엔드는 자기 문서 루트의 `api/menu.txt`를 정적 파일로 응답합니다.
- 홈과 식키타카는 모두 `/api/menu.txt`를 요청합니다. 브라우저는 백엔드 포트를 모르고 8000에만 요청합니다.
- 두 백엔드의 `api/menu.txt`는 같은 `menu-api/menu.txt`를 가리키는 링크라서 어느 쪽이 응답해도 내용이 같습니다.

**라운드로빈**: 백엔드마다 다른 `whoami.txt`를 두어, 요청이 번갈아 가는 것을 확인할 수 있습니다.

```bash
for i in 1 2 3 4; do curl -s http://localhost:8000/api/whoami.txt; echo; done
# backend-1 (:8001)
# backend-2 (:8002)
# backend-1 (:8001)
# backend-2 (:8002)
```

**502**: 백엔드가 모두 꺼지면 프록시가 502를 응답합니다. 홈은 사진과 화면 틀은 그대로 보여 주고, 식단 자리에만 "식단을 불러오지 못했어요 (HTTP 502)"를 표시합니다. 식키타카는 메뉴 요약 없이 글쓰기를 계속할 수 있습니다.

```bash
pkill -f "tiny 8001"; pkill -f "tiny 8002"
curl -i http://localhost:8000/api/menu.txt        # 502 Bad Gateway
```

### 동시성
tiny는 select 이벤트 루프로 프로세스 하나가 여러 연결을 처리합니다. 다만 CGI 실행과 백엔드 응답은 블로킹으로 기다립니다([개선 방향](https://github.com/krafton-jungle-week13-team/mini-web-server#개선-방향)의 논블로킹 I/O 항목). `/cgi-bin/slow`로 이 한계를 볼 수 있습니다.

```bash
curl "http://localhost:8000/cgi-bin/slow?sec=5" &       # 5초 걸리는 요청 (최대 30초)
time curl -s -o /dev/null http://localhost:8000/        # 홈도 약 5초 기다림
```

## 시연 순서
| 순서 | 화면 / 명령 | 보여 줄 기능 |
|---|---|---|
| 1 | `bash run.sh` | tiny 하나로 웹 서버와 백엔드 3개 실행 |
| 2 | 브라우저 `http://localhost:8000/` | 정적 콘텐츠, `/` → `home.html`, MIME 타입 |
| 3 | 홈의 식단표 + `curl .../api/whoami.txt` 반복 | 리버스 프록시, 라운드로빈 |
| 4 | 주소를 `/#2026-11-25` → `/#2026-11-26`으로 변경 | 사진 200 / 404 → 준비 중 이미지, 쿼리 대신 해시 |
| 5 | 식키타카에서 글 쓰기, 점심·저녁 탭 | CGI POST(stdin) / GET(`QUERY_STRING`) |
| 6 | 백엔드 종료 후 홈 새로고침 | 502와 화면의 오류 처리 |
| 7 | `/cgi-bin/slow?sec=5` 중 홈 요청 | 블로킹 한계와 개선 방향 |
