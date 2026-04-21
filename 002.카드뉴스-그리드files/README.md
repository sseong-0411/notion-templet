# Notion Gallery Widget

노션 `📅 게시물 DB` 데이터베이스의 게시물을 갤러리(카드) 형태로 보여주는 위젯입니다.

## 아키텍처

```
카드뉴스 생성기(Netlify)
        │ 게시물 생성 → 노션 DB에 저장
        ▼
   노션 데이터베이스 (📅 게시물 DB)
        │ 1 게시물 = 1 페이지 (본문에 슬라이드 이미지 인라인 삽입)
        ▼
   Express 프록시 서버 (server.js)
        │ Notion API Token 은닉
        │ DB 페이지 조회 + 본문 이미지 블록 추출
        ▼
   갤러리 프론트엔드 (public/index.html)
        카드 그리드 + 이미지 카루셀 + 피그마 임베드
```

## 기능

- **반응형 카드 그리드**: 데스크톱 3~4열 / 모바일 1열 자동 조절
- **다중 이미지 카루셀**: 좌/우 화살표, scroll-snap, 도트 인디케이터
- **피그마 임베드**: URL 자동 변환, node-id 포커싱 지원
- **상태별 필터**: 전체/초안/디자인 중/검토/예약됨/게시완료/보관
- **게시 유형별 비율**: 피드 1:1, 피드 4:5, 스토리(9:16) 자동 적용
- **자동 새로고침**: 55분 주기 (노션 이미지 URL 만료 대응)

## 설치 및 실행

### 1. 사전 준비

1. [Notion Integration 생성](https://www.notion.so/my-integrations)에서 Internal Integration 생성
2. 발급된 `Secret` 토큰 복사
3. 노션에서 `📅 게시물 DB`가 있는 페이지 → `...` → `연결` → 방금 만든 Integration 추가

### 2. 환경 설정

```bash
cd notion-gallery-widget
cp .env.example .env
```

`.env` 파일을 열어 아래 값을 입력:

```
NOTION_TOKEN=secret_실제토큰값
NOTION_DATABASE_ID=365d578f62fc44cb86b03bed704c2688
PORT=3000
ALLOWED_ORIGIN=*
```

### 3. 의존성 설치 및 실행

```bash
npm install
npm start
```

### 4. 확인

- 갤러리: http://localhost:3000
- API 확인: http://localhost:3000/api/posts

## 배포 옵션

### Railway / Render (추천)
1. GitHub 저장소에 코드 push
2. Railway 또는 Render에서 저장소 연결
3. 환경변수(`NOTION_TOKEN`, `NOTION_DATABASE_ID`) 설정
4. 자동 배포

### Vercel (Serverless)
- `server.js`를 `api/posts.js` 형태로 분리 필요
- `vercel.json`으로 라우팅 설정

### 자체 서버
- `npm start`로 직접 실행
- 또는 pm2: `pm2 start server.js --name gallery`

## 주의사항

### 노션 이미지 URL 만료
노션에 직접 업로드된 이미지의 URL은 약 **1시간 후 만료**됩니다.
위젯은 55분마다 자동으로 데이터를 재로드하여 URL을 갱신합니다.

### 피그마 임베드 권한
피그마 파일의 공유 권한이 **"링크가 있는 모든 사용자"**로 설정되어 있어야 iframe에서 정상 렌더링됩니다.

### API 호출량
각 게시물마다 본문 블록 조회 API를 1회 추가 호출합니다.
게시물 100개 기준 약 101회 API 호출이 발생합니다.
(Notion API 속도 제한: 평균 3 requests/sec)

## API 엔드포인트

### `GET /api/posts`
전체 게시물 목록 (이미지 포함).

쿼리 파라미터:
- `status` (선택): 특정 상태만 필터 (예: `?status=게시완료`)

### `GET /api/posts/:pageId`
단일 게시물 상세 조회.
