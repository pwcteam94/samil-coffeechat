# 삼일 커피챗 챌린지 — 풀스택 버전

신규 입사자가 입사 전 선배들과 **커피챗으로 연결**되는 게이미피케이션 네트워킹 앱입니다.
단일 HTML 프로토타입을 **진짜 서버 + 데이터베이스 + 이메일/알림 + 인사팀(HR) 대시보드**로 확장한 버전이에요.

> 핵심: 데이터가 **서버 DB에 저장**되므로 기기·사람이 바뀌어도 공유·누적됩니다.
> (단일 HTML의 localStorage는 그 브라우저에만 저장되던 것과 대비)

---

## 빠른 실행 (설치 불필요)

Node.js **22.5 이상**만 있으면 됩니다. 외부 패키지를 전혀 쓰지 않아 `npm install`이 필요 없어요.

```bash
cd samil-coffeechat
npm start
#  = node --experimental-sqlite server.js
```

- 사용자 앱:   http://localhost:3000/
- HR 대시보드: http://localhost:3000/admin   (접근 키: `samil-hr`)

### 라이브 시연 모드 (선배 회신을 15초 뒤 자동으로)
```bash
npm run demo          # DEMO_REPLY_SECONDS=15
```
신청하면 약 15초 뒤 선배 회신(수락/거절)이 도착하고, 종 알림이 실시간으로 뜹니다.
기본 실행에서는 실제처럼 24~48시간 후 회신됩니다.

---

## 데모 흐름 (제안 시연용)

1. `/` 접속 → 이름·회사 이메일로 로그인 (계정 자동 생성).
2. **신청하기**에서 선배 카드를 보고 메시지 템플릿(격식/친근/유머)을 골라 신청 → 용기 +10, 선배에게 이메일 발송.
3. **내 일정**에서 응답 대기/수락/거절 상태 추적.
4. 잠시 후(데모 15초) 선배 회신 도착 → 우상단 🔔 알림 + 점수 적립.
5. **네트워크 맵 / 리더보드**에서 연결·순위 확인.
6. 다른 브라우저(또는 휴대폰)에서 다른 이메일로 로그인 → **같은 서버 DB를 공유**, 리더보드에 함께 집계.
7. `/admin` (키 `samil-hr`) → 전체 신청 현황, 성사율·참여율, 수락/거절 직접 처리, **전체 공지 발송**.

---

## 아키텍처

```
브라우저(사용자 앱)  ─┐
브라우저(HR 대시보드) ─┤── HTTP/JSON ──▶  Node 서버(server.js)
모바일/타 기기       ─┘                     │
                                   ┌────────┼─────────┐
                              SQLite DB   이메일/알림   정적 파일
                            (data/app.db) (lib/notify) (public/)
```

- **server.js** — 의존성 0(Node 내장 `http`)으로 만든 REST API + 정적 서버 + 백그라운드 회신 시뮬레이터.
- **lib/db.js** — Node 22 내장 `node:sqlite` 기반 실제 SQLite DB. 스키마·시드 포함.
- **lib/notify.js** — 인앱 알림(항상) + 이메일(아웃박스 기본, SMTP 연동 훅).
- **lib/seed-data.js** — 선배 멘토 풀·데모 동기·메시지 템플릿.
- **public/** — 사용자 앱(index.html, app.js) + HR 대시보드(admin.html, admin.js).

### 주요 API
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/login` | 이메일로 로그인/가입 (토큰=userId 반환) |
| GET  | `/api/bootstrap` | 앱 초기 상태(선배·내 신청·알림·리더보드·통계) |
| POST | `/api/requests` | 커피챗 신청 (+10, 선배에게 메일) |
| POST | `/api/notifications/read` | 알림 읽음 처리 |
| GET  | `/api/admin/overview` | (HR) 전체 통계·신청·메일 |
| POST | `/api/admin/respond` | (HR) 신청 수락/거절 |
| POST | `/api/admin/announce` | (HR) 전체 공지 메일+알림 |

> 인증은 데모용으로 `Authorization: Bearer <userId>` 단순 토큰을 씁니다.
> HR 권한은 `x-admin-key` 헤더 또는 `hr@`로 시작하는 이메일 계정.

---

## 이메일·알림 동작

- **인앱 알림**은 항상 실제로 동작합니다 (DB `notifications` → 🔔 패널, 실시간 폴링).
- **이메일**은 기본적으로 `data/outbox/<id>.eml` 파일 + `emails` 테이블에 기록됩니다.
  (실제 메일서버 없이도 "무엇이 누구에게 발송됐는지" 확인 가능 — HR 대시보드 'Outbox'에 표시)
- **진짜 발송으로 전환**: `npm i nodemailer` 후 `.env`에 `SMTP_URL` 지정 →
  `lib/notify.js`가 자동으로 실제 SMTP 발송으로 전환됩니다. (SendGrid/SES 등 API 방식은 `sendEmail` 내부만 교체)

---

## 운영(프로덕션) 전환 가이드

이 코드는 **제안용 동작 예시**입니다. 실서비스로 올릴 때 권장 사항:

1. **DB**: `node:sqlite` → PostgreSQL/MySQL. `lib/db.js`의 쿼리 인터페이스만 교체하면 나머지는 그대로.
2. **인증**: 단순 토큰 → 사내 SSO(SAML/OIDC) 또는 JWT 세션. 선배 본인이 수락/거절하는 별도 로그인 추가.
3. **이메일**: `SMTP_URL`/SendGrid 연결, 발신 도메인 인증(SPF/DKIM).
4. **배포**: Render·Railway·Fly.io 등에 `npm start`로 배포하면 **모든 기기에서 공유되는 진짜 백엔드**가 됩니다.
   (SQLite 사용 시 영구 디스크 볼륨 마운트, 또는 관리형 Postgres 권장)
5. **개인정보**: 이메일·이름 등은 사내 정책에 맞게 암호화/보존기간 설정.

---

## 환경변수
`.env.example` 참고. 자주 쓰는 것:

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | 3000 | 서버 포트 |
| `ADMIN_KEY` | samil-hr | HR 대시보드 키 |
| `SIMULATE_REPLIES` | true | 선배 자동 회신(데모) |
| `DEMO_REPLY_SECONDS` | (없음) | 설정 시 N초 후 자동 회신 |
| `REPLY_MIN_HOURS` / `REPLY_MAX_HOURS` | 24 / 48 | 실제 회신 대기 범위 |
| `SMTP_URL` | (없음) | 실제 메일 발송 시 |
