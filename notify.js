// ─────────────────────────────────────────────────────────────
//  notify.js — 이메일 + 인앱 알림 발송
//
//  ● 인앱 알림: 항상 DB(notifications)에 생성 → 사용자/HR 화면에 실시간 표시
//  ● 이메일: 기본은 "아웃박스"(data/outbox/*.eml 파일 + emails 테이블 기록).
//            환경변수 SMTP_URL 이 있고 nodemailer 가 설치돼 있으면 실제 발송.
//            → 운영 전환 시 `npm i nodemailer` 후 .env 에 SMTP_URL 만 넣으면 됩니다.
//            (SendGrid/SES 등 API 발송도 sendEmail 내부만 바꾸면 됨)
// ─────────────────────────────────────────────────────────────
const path = require('path');
const fs = require('fs');
const { db, uid, now } = require('./db');

const OUTBOX = path.join(__dirname, '..', 'data', 'outbox');

// 실제 SMTP 발송(있으면). 설치/설정 안 됐으면 false 반환 → 아웃박스로 폴백.
async function trySmtp({ to, subject, body }) {
  if (!process.env.SMTP_URL) return false;
  let nodemailer;
  try { nodemailer = require('nodemailer'); }
  catch { console.warn('[notify] SMTP_URL은 있으나 nodemailer 미설치 → 아웃박스로 폴백 (npm i nodemailer)'); return false; }
  const tx = nodemailer.createTransport(process.env.SMTP_URL);
  await tx.sendMail({
    from: process.env.MAIL_FROM || '삼일 커피챗 <no-reply@samil.example.com>',
    to, subject, text: body,
  });
  return true;
}

async function sendEmail({ to, toName, subject, body, kind }) {
  let transport = 'outbox', sent = 0;
  try {
    if (await trySmtp({ to, subject, body })) { transport = 'smtp'; sent = 1; }
  } catch (e) { console.error('[notify] SMTP 발송 실패, 아웃박스 기록:', e.message); }

  const id = uid('e_');
  if (transport === 'outbox') {
    // 운영자가 열어볼 수 있도록 .eml 파일로도 남김
    const eml = `To: ${toName ? `"${toName}" ` : ''}<${to}>\nSubject: ${subject}\nDate: ${new Date().toISOString()}\nX-Kind: ${kind}\n\n${body}\n`;
    try { fs.writeFileSync(path.join(OUTBOX, `${id}.eml`), eml); } catch {}
  }
  db.prepare(`INSERT INTO emails (id,to_addr,to_name,subject,body,kind,transport,sent,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(id, to, toName || '', subject, body, kind, transport, sent, now());
  return { id, transport, sent };
}

function notify(userId, { type, title, body }) {
  const id = uid('n_');
  db.prepare(`INSERT INTO notifications (id,user_id,type,title,body,created_at,read)
    VALUES (?,?,?,?,?,?,0)`).run(id, userId, type, title, body, now());
  return id;
}

module.exports = { sendEmail, notify };
