# ── 삼일 커피챗 서버 환경변수 (.env.example) ──
# 복사해서 .env 로 쓰거나, 실행 시 앞에 붙여도 됩니다.

# 서버 포트
PORT=3000

# HR 대시보드 접근 키 (/admin)
ADMIN_KEY=samil-hr

# 답장 시뮬레이터: 선배 회신을 자동 생성할지 (데모용). 끄려면 false
SIMULATE_REPLIES=true

# 데모 모드: 신청 후 N초 뒤 자동 회신 (라이브 시연용). 비우면 실제 24~48시간
# DEMO_REPLY_SECONDS=15

# 실제 회신 대기 시간(시간 단위). DEMO_REPLY_SECONDS 가 없을 때 적용
REPLY_MIN_HOURS=24
REPLY_MAX_HOURS=48

# ── 실제 이메일 발송 (선택) ──
# 아래를 채우고 `npm i nodemailer` 하면 진짜 메일이 나갑니다.
# 비워두면 data/outbox/*.eml 파일 + 인앱 알림으로만 동작(설치 불필요).
# 예: SMTP_URL=smtps://user:pass@smtp.gmail.com:465
# SMTP_URL=
# MAIL_FROM=삼일 커피챗 <no-reply@samil.example.com>
