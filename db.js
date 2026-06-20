{
  "name": "samil-coffeechat",
  "version": "1.0.0",
  "description": "삼일 커피챗 챌린지 — 신규 입사자 네트워킹 풀스택 앱 (서버 + SQLite DB + 이메일/알림 + HR 대시보드)",
  "main": "server.js",
  "scripts": {
    "start": "node --experimental-sqlite server.js",
    "demo": "DEMO_REPLY_SECONDS=15 node --experimental-sqlite server.js"
  },
  "engines": {
    "node": ">=22.5.0"
  },
  "license": "MIT"
}
