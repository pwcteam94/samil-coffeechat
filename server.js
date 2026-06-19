// ─────────────────────────────────────────────────────────────
//  server.js — 삼일 커피챗 백엔드 (Node 내장 모듈만 사용, 의존성 0)
//  실행:  node --experimental-sqlite server.js
//  포트:  PORT(기본 3000)
// ─────────────────────────────────────────────────────────────
const http = require('http');
const fs = require('fs');
const path = require('path');
const { db, uid, now, seed, nextLevelPts, levelFor, parseSenior } = require('./lib/db');
const { sendEmail, notify } = require('./lib/notify');

seed();

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'samil-hr';
const SIMULATE = process.env.SIMULATE_REPLIES !== 'false';
const PUB = path.join(__dirname, 'public');
const PALETTES = [['#5C6BC0','#7E8DE0'],['#E8775A','#F5A98A'],['#22A98A','#5FD3B8'],
  ['#9B6BD6','#C19BEC'],['#E86A9C','#F4A0C2'],['#D9893A','#EFB877'],['#5B8DEF','#8FB4F7']];

// ───────── helpers ─────────
const send = (res, code, obj) => {
  const s = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(s);
};
const readBody = (req) => new Promise((resolve) => {
  let d = ''; req.on('data', c => { d += c; if (d.length > 1e6) req.destroy(); });
  req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
});
const auth = (req) => {
  const h = req.headers['authorization'] || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!tok) return null;
  return db.prepare('SELECT * FROM users WHERE id=?').get(tok) || null;
};
const isAdmin = (req, user) =>
  (user && user.role === 'hr') || req.headers['x-admin-key'] === ADMIN_KEY;

function replyWindowMs() {
  if (process.env.DEMO_REPLY_SECONDS) return Number(process.env.DEMO_REPLY_SECONDS) * 1000;
  const min = Number(process.env.REPLY_MIN_HOURS || 24);
  const max = Number(process.env.REPLY_MAX_HOURS || 48);
  return (min + Math.random() * (max - min)) * 3600e3;
}
function genMeet(loc) {
  const days = ['일','월','화','수','목','금','토'];
  const d = new Date(Date.now() + (3 + Math.floor(Math.random() * 5)) * 864e5);
  const slot = ['오전 10:00', '오후 2:00', '오후 4:00'][Math.floor(Math.random() * 3)];
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${days[d.getDay()]}) ${slot} · ${loc}`;
}
function roleShort() { return '선배'; }

// 신청 1건을 사용자/선배 관점 객체로 변환
function reqView(r) {
  const s = parseSenior(db.prepare('SELECT * FROM seniors WHERE id=?').get(r.senior_id));
  return {
    id: r.id, status: r.status, sentAt: r.sent_at, dueAt: r.due_at,
    resolvedAt: r.resolved_at, meetAt: r.meet_at, template: r.template,
    senior: s ? { id: s.id, name: s.name, initial: s.initial, dept: s.dept,
      years: s.years, c1: s.c1, c2: s.c2 } : null,
  };
}
function userStats(uid_) {
  const rows = db.prepare('SELECT status, COUNT(*) n FROM requests WHERE user_id=? GROUP BY status').all(uid_);
  const m = { pending: 0, accepted: 0, declined: 0 };
  rows.forEach(x => m[x.status] = x.n);
  return { applied: m.pending + m.accepted + m.declined, ...m };
}
function leaderboard(meId) {
  const rows = db.prepare(`SELECT id,name,cohort,dept,courage,c1,c2,
      (SELECT COUNT(*) FROM requests WHERE user_id=users.id AND status='accepted') succ
    FROM users WHERE role='joiner' ORDER BY courage DESC, succ DESC LIMIT 12`).all();
  return rows.map((r, i) => ({ rank: i + 1, ...r, me: r.id === meId }));
}

// 신청 처리(수락/거절) — 백그라운드 시뮬레이터와 HR 응답이 공용으로 사용
function resolveRequest(r, decision, meetAt) {
  if (!r || r.status !== 'pending') return null;
  const s = db.prepare('SELECT * FROM seniors WHERE id=?').get(r.senior_id);
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(r.user_id);
  const accept = decision === 'accept';
  const meet = accept ? (meetAt || genMeet(s ? s.loc : '강남오피스')) : null;
  db.prepare('UPDATE requests SET status=?, resolved_at=?, meet_at=? WHERE id=?')
    .run(accept ? 'accepted' : 'declined', now(), meet, r.id);
  const gain = accept ? 30 : 15;
  const courage = u.courage + gain;
  db.prepare('UPDATE users SET courage=?, level=? WHERE id=?').run(courage, levelFor(courage), u.id);
  const sName = s ? s.name : '선배';
  if (accept) {
    notify(u.id, { type: 'accepted', title: `🎉 ${sName} 선배가 커피챗을 수락했어요!`,
      body: `${meet} 확정. 용기 점수 +30이 적립됐어요.` });
    sendEmail({ to: emailOf(u), toName: u.name, kind: 'reply',
      subject: `[삼일 커피챗] ${sName} 선배가 신청을 수락했어요`,
      body: `${u.name}님, ${sName} 선배가 커피챗 신청을 수락했습니다.\n일정: ${meet}\n\n앱 '내 일정'에서 확인하세요.` });
  } else {
    notify(u.id, { type: 'declined', title: `💌 ${sName} 선배의 회신이 도착했어요`,
      body: `이번엔 일정이 어려웠대요. 거절도 용기 — 용기 점수 +15가 적립됐어요.` });
    sendEmail({ to: emailOf(u), toName: u.name, kind: 'reply',
      subject: `[삼일 커피챗] ${sName} 선배의 회신`,
      body: `${u.name}님, 아쉽게도 ${sName} 선배가 이번엔 일정을 맞추기 어렵다고 회신했어요.\n한 발 내디딘 그 용기가 더 중요합니다. 다른 선배에게도 도전해보세요!` });
  }
  return reqView(db.prepare('SELECT * FROM requests WHERE id=?').get(r.id));
}
function emailOf(u) { return u.email; }

// ───────── background: 기한 지난 대기 건 자동 회신(시뮬레이터) ─────────
function tick() {
  if (!SIMULATE) return;
  const due = db.prepare("SELECT * FROM requests WHERE status='pending' AND due_at IS NOT NULL AND due_at<=?").all(now());
  for (const r of due) {
    const s = db.prepare('SELECT * FROM seniors WHERE id=?').get(r.senior_id);
    const rate = s ? s.accept_rate : 0.65;
    resolveRequest(r, Math.random() < rate ? 'accept' : 'decline');
  }
}
setInterval(tick, 2000);

// ───────── static files ─────────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.json': 'application/json' };
function serveStatic(req, res, urlPath) {
  let rel = urlPath === '/' ? 'index.html' : urlPath === '/admin' ? 'admin.html' : urlPath.replace(/^\/+/, '');
  const file = path.join(PUB, path.normalize(rel));
  if (!file.startsWith(PUB)) { send(res, 403, { error: 'forbidden' }); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

// ───────── API ─────────
async function api(req, res, url) {
  const p = url.pathname;
  const m = req.method;
  const body = (m === 'POST' || m === 'PUT') ? await readBody(req) : {};
  const me = auth(req);

  // --- login / upsert ---
  if (p === '/api/login' && m === 'POST') {
    const email = (body.email || '').trim().toLowerCase();
    if (!email || !body.name) return send(res, 400, { error: 'email·name 필요' });
    let u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if (!u) {
      const pal = PALETTES[Math.floor(Math.random() * PALETTES.length)];
      const id = uid('u_');
      const role = email.startsWith('hr@') ? 'hr' : 'joiner';
      db.prepare(`INSERT INTO users (id,email,name,cohort,dept,role,courage,level,c1,c2,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
        id, email, body.name, body.cohort || '36기', body.dept || 'Audit', role, 0, 1, pal[0], pal[1], now());
      u = db.prepare('SELECT * FROM users WHERE id=?').get(id);
    }
    return send(res, 200, { token: u.id, user: u });
  }

  // ───────── ADMIN (HR) — x-admin-key 또는 hr 계정 ─────────
  if (p.startsWith('/api/admin/')) {
    if (!isAdmin(req, me)) return send(res, 403, { error: '관리자 권한이 필요합니다' });

    if (p === '/api/admin/overview' && m === 'GET') {
      const totals = { pending: 0, accepted: 0, declined: 0 };
      db.prepare('SELECT status, COUNT(*) n FROM requests GROUP BY status').all().forEach(r => totals[r.status] = r.n);
      const total = totals.pending + totals.accepted + totals.declined;
      const resolved = totals.accepted + totals.declined;
      const joiners = db.prepare("SELECT COUNT(*) n FROM users WHERE role='joiner'").get().n;
      const active = db.prepare("SELECT COUNT(DISTINCT user_id) n FROM requests").get().n;
      const reqs = db.prepare(`SELECT r.*, u.name uname, u.cohort ucohort, u.dept udept,
          s.name sname, s.dept sdept, s.initial sinit, s.c1 sc1, s.c2 sc2, u.c1 uc1, u.c2 uc2
        FROM requests r JOIN users u ON u.id=r.user_id JOIN seniors s ON s.id=r.senior_id
        ORDER BY r.sent_at DESC LIMIT 200`).all();
      const byDept = db.prepare(`SELECT s.dept dept, COUNT(*) n,
          SUM(CASE WHEN r.status='accepted' THEN 1 ELSE 0 END) acc
        FROM requests r JOIN seniors s ON s.id=r.senior_id GROUP BY s.dept ORDER BY n DESC`).all();
      const emails = db.prepare('SELECT * FROM emails ORDER BY created_at DESC LIMIT 15').all();
      return send(res, 200, {
        stats: { total, ...totals, resolved, joiners, active,
          acceptRate: resolved ? Math.round(totals.accepted / resolved * 100) : 0,
          participation: joiners ? Math.round(active / joiners * 100) : 0 },
        requests: reqs, byDept, emails, leaderboard: leaderboard(null),
      });
    }
    if (p === '/api/admin/respond' && m === 'POST') {
      const r = db.prepare('SELECT * FROM requests WHERE id=?').get(body.requestId);
      if (!r) return send(res, 404, { error: 'not found' });
      const out = resolveRequest(r, body.decision === 'accept' ? 'accept' : 'decline', body.meetAt);
      return send(res, 200, { request: out });
    }
    if (p === '/api/admin/announce' && m === 'POST') {
      const subject = body.subject || '[삼일 커피챗] 공지', text = body.body || '';
      const joiners = db.prepare("SELECT * FROM users WHERE role='joiner'").all();
      joiners.forEach(u => {
        notify(u.id, { type: 'notice', title: `📢 ${subject}`, body: text });
        sendEmail({ to: u.email, toName: u.name, kind: 'notice', subject, body: text });
      });
      return send(res, 200, { ok: true, count: joiners.length });
    }
    return send(res, 404, { error: 'unknown admin endpoint' });
  }

  // 이하 인증 필요
  if (!me) return send(res, 401, { error: '로그인이 필요합니다' });

  // --- bootstrap: 앱이 필요한 전체 상태 ---
  if (p === '/api/bootstrap' && m === 'GET') {
    const seniors = db.prepare('SELECT * FROM seniors').all().map(parseSenior);
    const myReqIds = new Set(db.prepare("SELECT senior_id FROM requests WHERE user_id=? AND status!='declined'").all(me.id).map(r => r.senior_id));
    const myRequests = db.prepare('SELECT * FROM requests WHERE user_id=? ORDER BY sent_at DESC').all(me.id).map(reqView);
    const notifs = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 20').all(me.id);
    const unread = db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0').get(me.id).n;
    return send(res, 200, {
      me, seniors: seniors.map(s => ({ ...s, requested: myReqIds.has(s.id) })),
      requests: myRequests, notifications: notifs, unread,
      leaderboard: leaderboard(me.id), stats: userStats(me.id),
      nextLevel: nextLevelPts(me.level),
    });
  }

  // --- 신청하기 ---
  if (p === '/api/requests' && m === 'POST') {
    const s = db.prepare('SELECT * FROM seniors WHERE id=?').get(body.seniorId);
    if (!s) return send(res, 404, { error: '선배를 찾을 수 없습니다' });
    const dup = db.prepare("SELECT 1 FROM requests WHERE user_id=? AND senior_id=? AND status!='declined'").get(me.id, s.id);
    if (dup) return send(res, 409, { error: '이미 신청한 선배예요' });
    const id = uid('r_'), t = now(), due = t + replyWindowMs();
    db.prepare(`INSERT INTO requests (id,user_id,senior_id,status,template,message,sent_at,due_at)
      VALUES (?,?,?,?,?,?,?,?)`).run(id, me.id, s.id, 'pending', body.template || 'friendly', body.message || '', t, due);
    const courage = me.courage + 10;
    db.prepare('UPDATE users SET courage=?, level=? WHERE id=?').run(courage, levelFor(courage), me.id);
    notify(me.id, { type: 'sent', title: `📨 ${s.name} 선배에게 신청을 보냈어요`,
      body: `회신이 오면 알려드릴게요. 보내는 용기 +10점 적립!` });
    sendEmail({ to: s.email, toName: s.name, kind: 'request',
      subject: `[삼일 커피챗] ${me.name}님이 커피챗을 신청했어요`,
      body: `${s.name} 선배님,\n\n${me.cohort} 신규 입사자 ${me.name}님이 커피챗을 신청했습니다.\n\n"${body.message || ''}"\n\n수락/거절은 인사팀 대시보드 또는 회신 링크에서 처리할 수 있어요.` });
    const meNow = db.prepare('SELECT * FROM users WHERE id=?').get(me.id);
    return send(res, 200, { request: reqView(db.prepare('SELECT * FROM requests WHERE id=?').get(id)),
      me: meNow, stats: userStats(me.id), nextLevel: nextLevelPts(meNow.level) });
  }

  // --- 알림 읽음 ---
  if (p === '/api/notifications/read' && m === 'POST') {
    if (body.id) db.prepare('UPDATE notifications SET read=1 WHERE id=? AND user_id=?').run(body.id, me.id);
    else db.prepare('UPDATE notifications SET read=1 WHERE user_id=?').run(me.id);
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { error: 'unknown endpoint' });
}

// ───────── server ─────────
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    return serveStatic(req, res, url.pathname);
  } catch (e) {
    console.error('ERR', e);
    send(res, 500, { error: 'server error', detail: e.message });
  }
}).listen(PORT, () => {
  console.log(`\n  삼일 커피챗 서버 실행 → http://localhost:${PORT}`);
  console.log(`  · 사용자 앱   http://localhost:${PORT}/`);
  console.log(`  · HR 대시보드 http://localhost:${PORT}/admin  (key: ${ADMIN_KEY})`);
  console.log(`  · 답장 시뮬레이터 ${SIMULATE ? 'ON' : 'OFF'}${process.env.DEMO_REPLY_SECONDS ? ` (${process.env.DEMO_REPLY_SECONDS}s)` : ''}\n`);
});
