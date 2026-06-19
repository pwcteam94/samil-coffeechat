// ─────────────────────────────────────────────────────────────
//  db.js — 진짜 SQLite 데이터베이스 (Node 22 내장 node:sqlite)
//  단일 파일(data/app.db)에 저장되며, 서버에 접속하는 모든 기기/사용자가
//  같은 DB를 공유합니다. 운영 시 Postgres/MySQL로 바꾸려면 이 파일만 교체.
// ─────────────────────────────────────────────────────────────
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { SENIORS, DEMO_JOINERS } = require('./seed-data');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(path.join(DATA_DIR, 'outbox'), { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'app.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  cohort TEXT,
  dept TEXT,
  role TEXT NOT NULL DEFAULT 'joiner',   -- joiner | hr
  courage INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  c1 TEXT, c2 TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS seniors (
  id TEXT PRIMARY KEY,
  name TEXT, initial TEXT, dept TEXT, years INTEGER, loc TEXT,
  rating REAL, lvl TEXT, hot TEXT, bio TEXT,
  tags TEXT, topics TEXT,               -- JSON
  c1 TEXT, c2 TEXT, email TEXT,
  accept_rate REAL DEFAULT 0.65
);
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  senior_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | declined
  template TEXT, message TEXT,
  sent_at INTEGER NOT NULL,
  due_at INTEGER,
  resolved_at INTEGER,
  meet_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT, title TEXT, body TEXT,
  created_at INTEGER NOT NULL,
  read INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  to_addr TEXT, to_name TEXT,
  subject TEXT, body TEXT, kind TEXT,
  transport TEXT, sent INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_req_user ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_req_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
`);

const uid = (p = '') => p + crypto.randomBytes(6).toString('hex');
const now = () => Date.now();

// ---------- seed (idempotent) ----------
function seed() {
  const cnt = db.prepare('SELECT COUNT(*) n FROM seniors').get().n;
  if (cnt === 0) {
    const ins = db.prepare(`INSERT INTO seniors
      (id,name,initial,dept,years,loc,rating,lvl,hot,bio,tags,topics,c1,c2,email,accept_rate)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const s of SENIORS) {
      ins.run(s.id, s.name, s.initial, s.dept, s.years, s.loc, s.rating, s.lvl, s.hot, s.bio,
        JSON.stringify(s.tags), JSON.stringify(s.topics), s.c1, s.c2, s.email, s.accept_rate);
    }
  }
  // HR 관리자 계정
  const hr = db.prepare('SELECT id FROM users WHERE role=?').get('hr');
  if (!hr) {
    db.prepare(`INSERT INTO users (id,email,name,cohort,dept,role,courage,level,c1,c2,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      uid('u_'), 'hr@samil.example.com', '인사팀 (HR)', '-', 'People & L&D', 'hr', 0, 1, '#5C6BC0', '#7E8DE0', now());
  }
  // 데모 동기 (리더보드)
  const jcnt = db.prepare("SELECT COUNT(*) n FROM users WHERE role='joiner'").get().n;
  if (jcnt === 0) {
    const ins = db.prepare(`INSERT INTO users (id,email,name,cohort,dept,role,courage,level,c1,c2,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    DEMO_JOINERS.forEach((j, i) => {
      ins.run(uid('u_'), `demo${i}@samil.example.com`, j.name, j.cohort, j.dept, 'joiner',
        j.courage, levelFor(j.courage), j.c1, j.c2, now() - (i + 1) * 36e5);
    });
  }
}

// ---------- level helpers ----------
function nextLevelPts(level) { return [0, 30, 55, 85, 120, 160, 210][level] || 999; }
function levelFor(courage) { let l = 1; while (courage >= nextLevelPts(l)) l++; return l; }

// ---------- row parsers ----------
function parseSenior(r) {
  if (!r) return r;
  return { ...r, tags: JSON.parse(r.tags || '[]'), topics: JSON.parse(r.topics || '[]') };
}

module.exports = { db, uid, now, seed, nextLevelPts, levelFor, parseSenior };
