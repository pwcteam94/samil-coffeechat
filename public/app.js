/* ===================== 삼일 커피챗 — 서버 연동 클라이언트 ===================== */

let SENIORS = [];      // 서버 bootstrap에서 채움
let LEADERS = [];
let REQUESTS = [];
let NOTIFS = [];
let UNREAD = 0;
let INCOMING = [];     // 나에게 온 동료 미팅 신청
let CONNS = [];        // 수락된 연결(선배+동료)
let PENDNET = [];      // 시각화 보조용 대기/거절 선배
let TESTI = [];        // 우수 연결 후기
let TIDX = 0;          // 후기 회전 인덱스

const TEMPLATES = {
  formal:  s => `${s.name} 선배님께,\n\n안녕하세요. ${S.cohort} 신규 입사 예정자입니다. ${s.dept} 분야에서 쌓아오신 경험을 듣고 싶어 조심스럽게 커피챗을 신청드립니다. 짧게라도 시간 내어 주신다면 큰 배움이 될 것 같습니다.`,
  friendly:s => `${s.name} 선배님 안녕하세요! 😊\n\n곧 입사하는 ${S.cohort} ${S.name}입니다. ${(s.tags&&s.tags[0]||'').replace('#','')} 쪽 이야기가 너무 궁금해서 용기 내어 연락드려요. 커피 한 잔 하면서 편하게 이야기 나눌 수 있을까요?`,
  humor:   s => `${s.name} 선배님, 안녕하세요! ☕\n\n곧 입사하는 ${S.cohort}입니다. ${s.years}년차 내공이 궁금해 용기 내어 노크합니다 ✊ 신입 1인분에게 커피 한 잔만큼의 시간, 살짝 나눠주실 수 있을까요? 커피값은 제가 쏘겠습니다(아마도)!`,
};
function roleShort(s){ return '선배'; }

const H = 3600e3, DAY = 24*H;
function pendingCount(){ return REQUESTS.filter(r=>r.status==='pending').length; }
function updateReqBadge(){
  const b = document.querySelector('[data-v="schedule"] .badge');
  if(b){ const n=pendingCount() + (INCOMING?INCOMING.length:0); b.textContent=n; b.style.display = n? '' : 'none'; }
}
function relLabel(ts){
  const d = Date.now()-ts;
  if(d < H)        return '방금 신청';
  if(d < DAY)      return '오늘 신청';
  if(d < 2*DAY)    return '어제 신청';
  return Math.floor(d/DAY)+'일 전 신청';
}
function hrsLeft(dueAt){ return Math.max(1, Math.ceil((dueAt-Date.now())/H)); }

/* ---------- API ---------- */
const TOKEN_KEY = 'cc_token';
let TOKEN = localStorage.getItem(TOKEN_KEY) || null;
async function api(path, method='GET', body){
  const h = { 'Content-Type':'application/json' };
  if(TOKEN) h['Authorization'] = 'Bearer '+TOKEN;
  const res = await fetch('/api'+path, { method, headers:h, body: body?JSON.stringify(body):undefined });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw Object.assign(new Error(data.error||'error'), { status:res.status, data });
  return data;
}

/* ---------- state ---------- */
const S = {
  view:'discover', cardIndex:0, template:'friendly',
  courage:0, level:1, next:30,
  applied:0, declines:0, successes:0,
  name:'', cohort:'36기', dept:'Audit', email:'', initial:'나', c1:'#5C6BC0', c2:'#7E8DE0',
};
const $ = s => document.querySelector(s);
const view = $('#view');

function applyBootstrap(d){
  SENIORS = d.seniors || [];
  REQUESTS = (d.requests||[]).map(r=>({
    id:r.id, status:r.status, sentAt:r.sentAt, dueAt:r.dueAt, resolvedAt:r.resolvedAt, meetAt:r.meetAt,
    name:r.senior?r.senior.name:'', initial:r.senior?r.senior.initial:'', c1:r.senior?r.senior.c1:'#ccc',
    c2:r.senior?r.senior.c2:'#ddd', dept:r.senior?`${r.senior.dept} · ${r.senior.years}년차`:'',
    seniorId:r.senior?r.senior.id:null,
  }));
  LEADERS = (d.leaderboard||[]).map(l=>({
    rank:l.rank, name:l.name, initial:(l.name||'·')[0], c1:l.c1, c2:l.c2,
    dept:`${l.cohort||''} · ${l.dept||''}`, pts:l.courage, succ:l.succ, me:l.me,
    badges: l.courage>=100?['🔥','🤝','🎯']:l.courage>=55?['🤝','⚡']:['⚡'],
  }));
  NOTIFS = d.notifications||[]; UNREAD = d.unread||0;
  INCOMING = d.incoming||[]; CONNS = d.connections||[]; PENDNET = d.pendingNet||[];
  TESTI = d.testimonials||[];
  const me = d.me||{};
  S.courage=me.courage||0; S.level=me.level||1; S.next=d.nextLevel||30;
  S.name=me.name||''; S.cohort=me.cohort||'36기'; S.dept=me.dept||'Audit';
  S.email=me.email||''; S.initial=(me.name||'나')[0]; S.c1=me.c1||S.c1; S.c2=me.c2||S.c2;
  if(d.stats){ S.applied=d.stats.applied; S.declines=d.stats.declined; S.successes=d.stats.accepted; }
  paintMe();
}
function paintMe(){
  const mt=$('#meTxt'); if(mt) mt.innerHTML = `${S.name} (${S.cohort} New Joiner)<small>${S.dept} · 사전 입사자</small>`;
  const av=$('#meAv'); if(av){ av.textContent=S.initial; av.style.background=`linear-gradient(135deg,${S.c1},${S.c2})`; }
}

/* ---------- nav ---------- */
const TITLES = {
  discover:['오늘의 추천 선배','AI가 나와 결이 맞는 선배를 골라드려요'],
  schedule:['내 일정','받은 동료 신청과 보낸 신청을 한눈에'],
  network:['나의 네트워크 맵','용기로 연결한 사람들'],
  leaderboard:['이번 주 리더보드','용기 점수로 겨루는 동기들'],
};
function navTo(v){
  S.view = v;
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('on', x.dataset.v===v));
  $('#tbTitle').textContent = TITLES[v][0];
  $('#tbSub').textContent = TITLES[v][1];
  render();
}
document.querySelectorAll('.nav-item').forEach(b=>{
  b.onclick = ()=> navTo(b.dataset.v);
});

/* ---------- courage / gauge ---------- */
function nextLevelPts(lvl){ return [0,30,55,85,120,160,210][lvl] || 999; }
function syncCourage(){
  const need = S.next || nextLevelPts(S.level);
  const prev = nextLevelPts(S.level-1);
  const pct = Math.max(0,Math.min(100,((S.courage-prev)/(need-prev))*100));
  $('#cPts').innerHTML = S.courage + '<span>pts</span>';
  $('#cGauge').style.width = pct+'%';
  $('#lvlTag').textContent = 'Lv.'+S.level;
  $('#cNext').textContent = `레벨 ${S.level+1}까지 ${Math.max(0,need-S.courage)} pts · 거절 ${S.declines}회`;
}

/* ============================================================= RENDER */
function render(){
  view.classList.remove('fade'); void view.offsetWidth; view.classList.add('fade');
  if(S.view==='discover') renderDiscover();
  else if(S.view==='schedule') renderRequests();
  else if(S.view==='network') renderNetwork();
  else renderLeaderboard();
}

/* ---------- DISCOVER ---------- */
function renderTesti(){
  if(!TESTI.length) return '<div class="t-empty">후기를 불러오는 중…</div>';
  const t = TESTI[TIDX % TESTI.length];
  const stars = '★'.repeat(t.rating)+'☆'.repeat(5-t.rating);
  return `
    <div class="testi">
      <div class="t-pair">
        <span class="t-av" style="background:linear-gradient(135deg,${t.jc1},${t.jc2})">${t.ju_i}</span>
        <svg class="t-arrow" viewBox="0 0 24 24" fill="none"><path d="M5 12h12M12 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="t-av" style="background:linear-gradient(135deg,${t.sc1},${t.sc2})">${t.se_i}</span>
        <div class="t-names"><b>${t.ju}</b> × <b>${t.se}</b> 선배<div class="t-dept">${t.dept}</div></div>
      </div>
      <div class="t-topic">☕ ${t.topic}<span class="t-stars">${stars}</span></div>
      <div class="t-quote">“${t.quote}”</div>
    </div>`;
}
function rotateTesti(){ TIDX=(TIDX+1)%Math.max(1,TESTI.length); const b=document.getElementById('testiBox'); if(b) b.innerHTML=renderTesti(); }

function renderDiscover(){
  const s = SENIORS[S.cardIndex % SENIORS.length];
  view.innerHTML = `
  <div class="discover">
    <div class="swipe-wrap">
      <div class="deck-hint">
        <span class="t">${S.cardIndex+1} / ${SENIORS.length} · 오늘의 매칭</span>
        <span class="ai-pill"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" fill="currentColor"/></svg>AI 매칭 92%</span>
      </div>
      <div class="card" id="card">
        <div class="card-banner" style="background:linear-gradient(120deg,${s.c1},${s.c2})">
          <div class="blob" style="width:120px;height:120px;background:rgba(255,255,255,.18);top:-40px;right:30px"></div>
          <div class="blob" style="width:80px;height:80px;background:rgba(255,255,255,.12);top:30px;right:120px"></div>
          <div class="card-rating"><span class="star">★</span>${s.rating.toFixed(1)}</div>
        </div>
        <div class="card-head">
          <div class="av-lg" style="background:linear-gradient(135deg,${s.c1},${s.c2})">${s.initial}</div>
          <div class="head-meta">
            <div class="nm">${s.name} <span class="lvl-tag">${s.lvl}</span></div>
            <div class="rl">${s.dept} · ${s.years}년차 · ${s.loc}</div>
          </div>
        </div>
        <div class="tags">${s.tags.map(t=>`<span class="tag ${t===s.hot?'hot':''}">${t}</span>`).join('')}</div>
        <div class="bio">${s.bio}</div>

        <div class="ai-topics">
          <div class="h">
            <div class="l"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" fill="currentColor"/><circle cx="18.5" cy="17.5" r="1.3" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></svg>AI 추천 대화 주제</div>
            <button class="regen" onclick="regen()"><svg viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 4v3h-3M6 20v-3h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>다시 추천</button>
          </div>
          <div id="topicList">
            ${s.topics.map((t,i)=>`<div class="topic"><span class="n">${i+1}</span><div><b>${t[0]}</b><br><span style="color:var(--ink-faint)">${t[1]}</span></div></div>`).join('')}
          </div>
        </div>

        <div class="card-foot">
          <div class="tmpl-lab">✉️ 신청 메시지 템플릿</div>
          <div class="tmpl-row" id="tmplRow">
            <button class="tmpl ${S.template==='formal'?'on':''}" data-t="formal">격식체</button>
            <button class="tmpl ${S.template==='friendly'?'on':''}" data-t="friendly">친근체</button>
            <button class="tmpl ${S.template==='humor'?'on':''}" data-t="humor">유머러스</button>
          </div>
          <div class="msg-preview" id="msgPrev">${TEMPLATES[S.template](s)}</div>
          <div class="act-row">
            <button class="btn btn-pass" onclick="passCard()" title="다음 선배">
              <svg viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="btn btn-apply" onclick="applyCard()">
              <svg viewBox="0 0 24 24" fill="none"><path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              용기 내어 신청하기
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="rail">
      <div class="panel">
        <div class="streak">
          <div class="ico">🔥</div>
          <div class="x"><div class="n">3일 연속 도전 중</div><div class="s">오늘 1번만 더 신청하면 +10 pts</div></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-h"><div class="t">✨ 우수 연결 후기</div><div class="more" onclick="rotateTesti()">다른 후기 ›</div></div>
        <div id="testiBox">${renderTesti()}</div>
      </div>
      <div class="panel">
        <div class="panel-h"><div class="t"><svg viewBox="0 0 24 24" fill="none"><path d="M7 20h10M9 20v-3m6 3v-3M6 4h12v4a6 6 0 0 1-12 0V4Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>이번 주 리더보드</div><div class="more">전체 ›</div></div>
        ${LEADERS.slice(0,4).map(l=>`
          <div class="lb-row ${l.me?'me':''}">
            <div class="rank ${l.rank<=3?'r'+l.rank:'rx'}">${l.rank}</div>
            <div class="lb-av" style="background:linear-gradient(135deg,${l.c1},${l.c2})">${l.initial}</div>
            <div class="lb-info"><div class="n">${l.name}</div><div class="s">${l.dept} · ${l.succ}회 성사</div></div>
            <div class="lb-pt">${l.pts}</div>
          </div>`).join('')}
      </div>
      <div class="panel">
        <div class="panel-h"><div class="t"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3l2.4 5.5 6 .5-4.5 3.9 1.4 5.8L12 16l-5.3 3.2 1.4-5.8L3.6 9.5l6-.5L12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>용기 점수 가이드</div></div>
        <div class="tip">
          <div class="row"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><div><b>신청 +10</b> · 보내는 순간 점수 적립</div></div>
          <div class="row"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><div><b>거절 +15</b> · 거절은 더 큰 용기, 보너스 적립</div></div>
          <div class="row"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><div><b>성사 +30</b> · 커피챗 확정 시 배지 획득</div></div>
        </div>
      </div>
    </div>
  </div>`;

  // template switching
  document.querySelectorAll('#tmplRow .tmpl').forEach(b=>{
    b.onclick=()=>{
      S.template=b.dataset.t;
      document.querySelectorAll('#tmplRow .tmpl').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      const mp=$('#msgPrev'); mp.style.opacity=0;
      setTimeout(()=>{ mp.textContent=TEMPLATES[S.template](s); mp.style.opacity=1; },140);
    };
  });
}

const ALT_TOPICS = [
  [['요즘 가장 즐거운 프로젝트','일에서 찾는 몰입의 순간'],['신입 때 가장 큰 실수','실수를 성장으로 바꾼 이야기'],['10년 뒤 나에게 한마디','커리어 장기 시야 넓히기']],
  [['삼일을 선택한 이유','수많은 선택지 중 이곳인 까닭'],['일과 삶의 균형 잡기','지속가능하게 일하는 법'],['후배에게 추천하는 책 한 권','관점을 바꿔준 인생 책']],
];
function regen(){
  const s = SENIORS[S.cardIndex % SENIORS.length];
  const pick = ALT_TOPICS[Math.floor(Math.random()*ALT_TOPICS.length)];
  const list = $('#topicList');
  list.style.opacity=0;
  setTimeout(()=>{
    list.innerHTML = pick.map((t,i)=>`<div class="topic"><span class="n">${i+1}</span><div><b>${t[0]}</b><br><span style="color:var(--ink-faint)">${t[1]}</span></div></div>`).join('');
    list.style.opacity=1;
  },160);
  toast('🤖','AI가 새 대화 주제를 추천했어요');
}

function passCard(){
  const c=$('#card');
  c.style.transition='.3s'; c.style.transform='translateX(40px) rotate(2deg)'; c.style.opacity=0;
  setTimeout(()=>{ S.cardIndex++; renderDiscover(); },240);
}

async function applyCard(){
  const s = SENIORS[S.cardIndex % SENIORS.length];
  if(REQUESTS.some(r=>r.seniorId===s.id)){
    toast('📋','이미 신청한 선배예요 · 내 일정에서 확인하세요');
    setTimeout(()=>navTo('schedule'), 650);
    return;
  }
  const btn = $('#card .btn-apply');
  if(btn){ btn.disabled = true; btn.style.opacity = .6; }
  const msg = ($('#msgPrev') ? $('#msgPrev').textContent : '');
  const animDone = playSendAnim(s);     // 용기 불꽃 + 편지 날아가기
  try{
    const d = await api('/requests','POST',{ seniorId:s.id, template:S.template, message:msg });
    // merge server truth
    S.courage = d.me.courage; S.level = d.me.level; S.next = d.nextLevel;
    S.applied = d.stats.applied; S.successes = d.stats.accepted; S.declines = d.stats.declined;
    const r = d.request;
    REQUESTS.unshift({ id:r.id, status:r.status, sentAt:r.sentAt, dueAt:r.dueAt, meetAt:r.meetAt,
      name:r.senior.name, initial:r.senior.initial, c1:r.senior.c1, c2:r.senior.c2,
      dept:`${r.senior.dept} · ${r.senior.years}년차`, seniorId:r.senior.id, fresh:true });
    syncCourage(); updateReqBadge();
    const win = Math.round((r.dueAt - r.sentAt)/H);
    await animDone;
    showSent(s, win);
  }catch(e){
    clearSendAnim();
    if(btn){ btn.disabled=false; btn.style.opacity=1; }
    toast('⚠️', e.message==='이미 신청한 선배예요' ? '이미 신청한 선배예요' : '신청 전송에 실패했어요');
  }
}

/* ---------- 신청 전송 애니메이션 (용기 불꽃 + 편지) ---------- */
function clearSendAnim(){ const e=document.getElementById('sendAnim'); if(e) e.remove(); }
function playSendAnim(s){
  return new Promise(resolve=>{
    clearSendAnim();
    const ov=document.createElement('div'); ov.id='sendAnim'; ov.className='send-anim';
    const sparks=Array.from({length:12}).map((_,i)=>{
      const ang=(i/12)*Math.PI*2, d=80+Math.random()*70;
      return `<span class="spark" style="--tx:${(Math.cos(ang)*d).toFixed(0)}px;--ty:${(Math.sin(ang)*d).toFixed(0)}px;animation-delay:${(0.12+Math.random()*0.22).toFixed(2)}s"></span>`;
    }).join('');
    ov.innerHTML=`
      <div class="send-stage">
        <div class="ring"></div>
        <div class="flame">🔥</div>
        ${sparks}
        <div class="letter">✉️</div>
        <div class="plus">+10 용기</div>
      </div>
      <div class="send-cap">용기를 담아 전송 중…</div>`;
    document.body.appendChild(ov);
    setTimeout(()=>{ const c=ov.querySelector('.send-cap'); if(c) c.textContent='전송 완료! 🎉'; }, 950);
    setTimeout(()=>{ ov.classList.add('out'); }, 1300);
    setTimeout(()=>{ clearSendAnim(); resolve(); }, 1560);
  });
}

/* ---------- sent modal (응답 대기) ---------- */
function showSent(s, hrs){
  const r=$('#result');
  r.innerHTML = `
    <div class="burst" style="background:var(--brand-soft)">📨</div>
    <h2>신청이 전송됐어요!</h2>
    <p><b>${s.name} ${roleShort(s)}</b>님에게 커피챗 신청을 보냈어요.<br>보통 <b>${hrs}시간 이내</b>에 수락 여부 회신이 와요.</p>
    <div class="pts-gain"><span class="p">+10</span> 용기 점수 <span class="pts-sub">· 보내는 순간 적립</span></div>
    <div class="sent-note">
      <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div><b>응답을 기다리는 중</b><br><span>‘내 일정’에서 수락·거절 여부를 추적할 수 있어요. 회신이 오면 알림과 함께 점수가 추가됩니다.</span></div>
    </div>
    <button class="btn-done" onclick="goRequests()">내 일정에서 확인</button>
    <button class="btn-ghost" onclick="closeResult()">다음 선배 계속 보기</button>
  `;
  $('#scrim').classList.add('show');
}
function goRequests(){
  $('#scrim').classList.remove('show');
  S.cardIndex++;
  navTo('schedule');
}

/* ---------- result modal ---------- */
function showResult(s, accept){
  const r=$('#result');
  let badge;
  if(accept) badge = {e:'🤝',n:'커넥터 배지 획득!',d:`${s.name} 선배와의 커피챗이 확정됐어요`};
  else badge = {e:'💪',n:'거절 면역 배지 획득!',d:'거절도 용기예요. 다음 도전이 더 쉬워집니다'};
  r.innerHTML = `
    <div class="burst" style="background:${accept?'var(--go-soft)':'var(--courage-soft)'}">${accept?'🎉':'💌'}</div>
    <h2>${accept?'커피챗이 성사됐어요!':'용기를 냈다는 게 중요해요'}</h2>
    <p>${accept
        ? `<b>${s.name} ${roleShort(s)}</b>님이 신청을 수락했어요.<br>내 일정에 자동으로 추가했습니다.`
        : `<b>${s.name} ${roleShort(s)}</b>님은 이번엔 일정이 어려웠대요.<br>그래도 한 발 내디딘 당신, 충분히 멋져요.`}</p>
    <div class="pts-gain"><span class="p">+${accept?30:15}</span> 용기 점수 적립</div>
    <div class="result-badge"><span class="e">${badge.e}</span><div class="x"><div class="n">${badge.n}</div><div class="d">${badge.d}</div></div></div>
    <button class="btn-done" onclick="closeResult()">${accept?'좋아요!':'다음 선배 보기'}</button>
  `;
  $('#scrim').classList.add('show');
  if(accept) confetti();
}
function closeResult(){
  $('#scrim').classList.remove('show');
  S.cardIndex++;
  if(S.view==='discover') renderDiscover();
}
$('#scrim').onclick = e=>{ if(e.target.id==='scrim') closeResult(); };

function confetti(){
  const cols=['#EE5836','#F2A93B','#1FA266','#5B8DEF','#E86A9C','#FFC766'];
  for(let i=0;i<46;i++){
    const c=document.createElement('div');
    c.className='confetti';
    c.style.left=(20+Math.random()*60)+'%';
    c.style.background=cols[i%cols.length];
    c.style.transform=`rotate(${Math.random()*360}deg)`;
    document.body.appendChild(c);
    const dx=(Math.random()-.5)*240, dur=1100+Math.random()*900;
    c.animate([
      {transform:`translate(0,0) rotate(0)`,opacity:1},
      {transform:`translate(${dx}px,${window.innerHeight+60}px) rotate(${Math.random()*720}deg)`,opacity:.9}
    ],{duration:dur,easing:'cubic-bezier(.2,.6,.4,1)'}).onfinish=()=>c.remove();
  }
}

/* ---------- toast ---------- */
let toastT;
function toast(e,txt){
  $('#toast .e').textContent=e; $('#toastTxt').textContent=txt;
  $('#toast').classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>$('#toast').classList.remove('show'),2200);
}

/* ---------- SCHEDULE ---------- */
function renderSchedule(){
  const upcoming = [
    { n:'김도윤 선배', d:'감사1본부 · 8년차', date:'6월 18일 (수)', time:'오후 3:00', where:'을지로오피스 9F 라운지', st:'확정', c1:'#5B8DEF',c2:'#8FB4F7' },
    { n:'한예린 선배', d:'People & L&D · 9년차', date:'6월 20일 (금)', time:'오전 11:00', where:'온라인 (Teams)', st:'대기', c1:'#E86A9C',c2:'#F4A0C2' },
  ];
  const daysMap = {18:'go',20:'wait'};
  let daysHTML='';
  const firstDow=0; // June 2026 starts... we'll fake a clean grid
  for(let i=0;i<3;i++) daysHTML+=`<div class="day mut">${29+i}</div>`;
  for(let d=1; d<=30; d++){
    const cls = d===15?'today':'';
    const dot = daysMap[d]?`<div class="dot ${daysMap[d]}"></div>`:'';
    daysHTML+=`<div class="day ${cls} ${daysMap[d]?'has':''}">${d}${dot}</div>`;
  }
  for(let i=1;i<=4;i++) daysHTML+=`<div class="day mut">${i}</div>`;

  view.innerHTML = `
  <div class="page-wrap">
    <div class="kpi-row">
      ${kpi('#FFE9E1','#EE5836','📨', REQUESTS.length, '보낸 신청', '+'+S.applied+' 오늘')}
      ${kpi('#E4F5EC','#1FA266','🤝', S.successes, '성사된 만남', '수락률 62%')}
      ${kpi('#FFF1DB','#F2A93B','⚡', S.courage, '누적 용기 점수', 'Lv.'+S.level)}
      ${kpi('#EFE9FB','#7A5AB5','🎖️', 2, '획득 배지', '커넥터·면역')}
    </div>
    <div class="sched-grid">
      <div class="cal">
        <div class="cal-h">
          <div class="m">2026년 6월</div>
          <div class="cal-nav"><button>‹</button><button>›</button></div>
        </div>
        <div class="dow"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
        <div class="days">${daysHTML}</div>
        <div style="display:flex;gap:16px;margin-top:16px;font-size:11.5px;color:var(--ink-soft);font-weight:600">
          <span style="display:flex;align-items:center;gap:6px"><i style="width:8px;height:8px;border-radius:50%;background:var(--go);display:inline-block"></i> 확정된 커피챗</span>
          <span style="display:flex;align-items:center;gap:6px"><i style="width:8px;height:8px;border-radius:50%;background:var(--courage);display:inline-block"></i> 수락 대기 중</span>
        </div>
      </div>
      <div>
        <div style="font-size:13px;font-weight:800;color:var(--ink-soft);margin-bottom:12px">다가오는 만남</div>
        <div class="up-list">
          ${upcoming.map(u=>`
            <div class="up-item">
              <div class="bar" style="background:${u.st==='확정'?'var(--go)':'var(--courage)'}"></div>
              <div class="av" style="background:linear-gradient(135deg,${u.c1},${u.c2})">${u.n[0]}</div>
              <div class="x">
                <div class="n">${u.n}</div>
                <div class="s">${u.d}<br>📍 ${u.where}</div>
              </div>
              <div class="when">
                <div class="d">${u.date}</div>
                <div class="t">${u.time}</div>
                <span class="st ${u.st==='확정'?'go':'wait'}" style="margin-top:6px;display:inline-block">${u.st}</span>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}
function kpi(bg,fg,ico,v,l,d){
  return `<div class="kpi"><div class="ic" style="background:${bg};color:${fg};font-size:18px">${ico}</div>
    <div class="v">${v}</div><div class="l">${l}</div><div class="d up">↑ ${d}</div></div>`;
}

/* ---------- NETWORK MAP ---------- */
function renderNetwork(){
  const W=640,Hh=440,cx=W/2,cy=Hh/2;
  // 연결(수락)된 선배/동료 + 대기/거절 선배
  const conns = CONNS.map(c=>({ ...c, state:'go' }));
  const pend = PENDNET.map(c=>({ ...c, state: c.status==='pending'?'wait':'sent' }));
  const items = [...conns, ...pend].slice(0,9);
  const n = items.length;
  const nodes=[{x:cx,y:cy,r:34,me:true,label:S.name||'나',c1:S.c1,c2:S.c2}];
  items.forEach((c,i)=>{
    const ang = (-90 + i*(360/Math.max(1,n))) * Math.PI/180;
    const rad = 150 + (i%2?22:0);
    nodes.push({ x:cx+Math.cos(ang)*rad, y:cy+Math.sin(ang)*(rad*0.72),
      r: c.state==='go'?24:20, label:c.name, sub:c.dept||'',
      state:c.state, kind:c.kind, c1:c.c1, c2:c.c2 });
  });
  // 엣지 색: 선배 연결=초록, 동료 연결=인디고, 대기=주황, 신청=흐림
  const edgeCol = nd => nd.state!=='go' ? (nd.state==='wait'?'#F2A93B':'#C9BEB0')
                      : (nd.kind==='peer'?'#5C6BC0':'#1FA266');
  let edges='';
  nodes.slice(1).forEach(nd=>{
    const dash = nd.state==='sent'?'stroke-dasharray="5 5"':'';
    edges+=`<line x1="${cx}" y1="${cy}" x2="${nd.x}" y2="${nd.y}" stroke="${edgeCol(nd)}" stroke-width="${nd.state==='go'?2.6:2}" ${dash} opacity="${nd.state==='sent'?.5:.85}"/>`;
  });
  let circles='';
  nodes.forEach((nd,idx)=>{
    const ringCol = nd.me?'#5C6BC0':edgeCol(nd);
    const badge = (!nd.me && nd.state==='go')
      ? `<circle cx="${nd.x+nd.r*0.78}" cy="${nd.y-nd.r*0.78}" r="8" fill="${nd.kind==='peer'?'#5C6BC0':'#1FA266'}" stroke="#fff" stroke-width="2"/>
         <text x="${nd.x+nd.r*0.78}" y="${nd.y-nd.r*0.78+1}" text-anchor="middle" dominant-baseline="middle" font-size="9">${nd.kind==='peer'?'🧑':'✓'}</text>` : '';
    circles+=`
      <defs><linearGradient id="g_${idx}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${nd.c1}"/><stop offset="1" stop-color="${nd.c2}"/></linearGradient></defs>
      <circle cx="${nd.x}" cy="${nd.y}" r="${nd.r+(nd.me?6:4)}" fill="${ringCol}" opacity="${nd.me?.14:.12}"/>
      <circle cx="${nd.x}" cy="${nd.y}" r="${nd.r}" fill="url(#g_${idx})" stroke="#fff" stroke-width="3"/>
      <text x="${nd.x}" y="${nd.y+(nd.me?2:1)}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-weight="800" font-size="${nd.me?16:13}" font-family="Pretendard,sans-serif">${(nd.label||'·')[0]}</text>
      ${badge}
      <text x="${nd.x}" y="${nd.y+nd.r+15}" text-anchor="middle" fill="#2A231D" font-weight="800" font-size="12" font-family="Pretendard,sans-serif">${nd.label||''}</text>
      ${nd.sub?`<text x="${nd.x}" y="${nd.y+nd.r+30}" text-anchor="middle" fill="#A99D90" font-weight="600" font-size="10.5" font-family="Pretendard,sans-serif">${nd.sub}</text>`:''}`;
  });
  const accS = CONNS.filter(c=>c.kind==='senior').length;
  const accP = CONNS.filter(c=>c.kind==='peer').length;
  const empty = n===0 ? '<div style="text-align:center;color:var(--ink-faint);font-size:13px;padding:40px 0">아직 연결이 없어요. ‘신청하기’에서 첫 용기를 내보세요!</div>' : '';

  view.innerHTML=`
  <div class="page-wrap">
    <div class="kpi-row" style="grid-template-columns:repeat(3,1fr)">
      ${kpi('#E4F5EC','#1FA266','🤝',accS,'연결된 선배','커피챗 성사')}
      ${kpi('#EEF0FB','#5C6BC0','🧑‍🤝‍🧑',accP,'연결된 동료','동기 네트워크')}
      ${kpi('#FFF1DB','#F2A93B','⏳',pendingCount(),'수락 대기','응답 기다리는 중')}
    </div>
    <div class="netbox">
      <div class="net-head">
        <div class="t">용기로 만든 나의 네트워크</div>
        <div class="lg">
          <span><i style="background:#1FA266"></i>선배 연결</span>
          <span><i style="background:#5C6BC0"></i>동료 연결</span>
          <span><i style="background:#F2A93B"></i>대기 중</span>
          <span><i style="background:#C9BEB0"></i>신청함</span>
        </div>
      </div>
      ${empty || `<svg class="net-svg" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="xMidYMid meet" style="height:460px">${edges}${circles}</svg>`}
    </div>
  </div>`;
}

/* ---------- LEADERBOARD ---------- */
function renderLeaderboard(){
  const top3=LEADERS.slice(0,3);
  view.innerHTML=`
  <div class="page-wrap">
    <div class="lead-head">
      <div class="podium">
        <div class="pod side"><div class="av" style="background:linear-gradient(135deg,${top3[1].c1},${top3[1].c2})">${top3[1].initial}</div><div class="nm">${top3[1].name}</div><div class="pt">${top3[1].pts}</div></div>
        <div class="pod first"><div class="crown">👑</div><div class="av" style="background:linear-gradient(135deg,${top3[0].c1},${top3[0].c2})">${top3[0].initial}</div><div class="nm">${top3[0].name}</div><div class="pt">${top3[0].pts}</div></div>
        <div class="pod side"><div class="av" style="background:linear-gradient(135deg,${top3[2].c1},${top3[2].c2})">${top3[2].initial}</div><div class="nm">${top3[2].name}</div><div class="pt">${top3[2].pts}</div></div>
      </div>
      <div class="lead-copy">
        <h3>이번 주 가장 용감했던 동기들 🔥</h3>
        <p>커피챗 신청·성사·도전을 합산한 <b>용기 점수</b> 순위예요. 거절도 점수가 되니, 결과보다 <b>한 발 내딛는 시도</b> 자체가 챔피언을 만듭니다. 매주 월요일 리셋!</p>
      </div>
    </div>
    <div class="lead-table">
      ${LEADERS.map(l=>`
        <div class="lt-row ${l.me?'me':''}">
          <div class="rank ${l.rank<=3?'r'+l.rank:'rx'}">${l.rank}</div>
          <div class="av" style="background:linear-gradient(135deg,${l.c1},${l.c2})">${l.initial}</div>
          <div class="info"><div class="n">${l.name}${l.me?' <span style="font-size:10px;color:var(--brand-deep);font-weight:800">· 나</span>':''}</div><div class="s">${l.dept} · ${l.succ}회 성사</div></div>
          <div class="badges">${l.badges.map(b=>`<span class="bdg">${b}</span>`).join('')}</div>
          <div class="pt">${l.pts}</div>
        </div>`).join('')}
    </div>
  </div>`;
}

/* ---------- REQUESTS (신청 현황) ---------- */
function renderRequests(){
  const pend=pendingCount();
  const acc =REQUESTS.filter(r=>r.status==='accepted').length;
  const dec =REQUESTS.filter(r=>r.status==='declined').length;
  const meta={pending:{lab:'응답 대기',cls:'wait'},accepted:{lab:'수락됨',cls:'go'},declined:{lab:'정중히 거절',cls:'dec'}};
  view.innerHTML=`
  <div class="page-wrap">
    <div class="kpi-row">
      ${kpi('#EEF0FB','#5C6BC0','📥',INCOMING.length,'받은 신청','동료 미팅 요청')}
      ${kpi('#FFF1DB','#F2A93B','⏳',pend,'응답 대기','회신 기다리는 중')}
      ${kpi('#E4F5EC','#1FA266','🤝',acc + CONNS.filter(c=>c.kind==='peer').length,'연결됨','커피챗 성사')}
      ${kpi('#FFE9E1','#EE5836','📨',REQUESTS.length,'보낸 신청','이번 주')}
    </div>
    ${INCOMING.length ? `
    <div class="req-card incoming-card">
      <div class="req-head">
        <div class="t">📥 받은 동료 미팅 신청 <span class="inbadge">${INCOMING.length}</span></div>
        <div class="lg muted">같은 기수·동료가 보낸 커피챗 신청이에요</div>
      </div>
      ${INCOMING.map(p=>`
        <div class="req-row in-row">
          <div class="av" style="background:linear-gradient(135deg,${p.from.c1},${p.from.c2})">${p.from.initial}</div>
          <div class="x">
            <div class="n">${p.from.name} <span class="when">${p.from.cohort||''} · ${p.from.dept||''}</span></div>
            <div class="s">“${p.topic}”</div>
          </div>
          <div class="in-actions">
            <button class="in-acc" onclick="respondPeer('${p.id}','accept')">수락</button>
            <button class="in-dec" onclick="respondPeer('${p.id}','decline')">거절</button>
          </div>
        </div>`).join('')}
    </div>` : ''}
    <div class="req-card">
      <div class="req-head">
        <div class="t">📤 보낸 신청 · 수락/거절 대기</div>
        <div class="lg"><span><i style="background:#F2A93B"></i>대기</span><span><i style="background:#1FA266"></i>수락</span><span><i style="background:#C9BEB0"></i>거절</span></div>
      </div>
      ${REQUESTS.map(r=>{
        const m=meta[r.status];
        const when = relLabel(r.sentAt);
        const detail = r.status==='pending'
          ? `약 ${hrsLeft(r.dueAt)}시간 내 회신 예정`
          : r.status==='accepted'
            ? `${r.meetAt && r.meetAt!=='일정 조율 중' ? r.meetAt+' 확정' : '수락됨 · 일정 조율 중'}`
            : '이번엔 일정이 어려웠어요 · 다음 기회에';
        return `
        <div class="req-row ${r.fresh?'fresh':''}">
          <div class="av" style="background:linear-gradient(135deg,${r.c1},${r.c2})">${r.initial}</div>
          <div class="x">
            <div class="n">${r.name} 선배 <span class="when">${when}</span></div>
            <div class="s">${r.dept}</div>
          </div>
          <div class="req-detail">
            <span class="req-st ${m.cls}">${r.status==='pending'?'<i class="pulse"></i>':''}${m.lab}</span>
            <div class="d">${detail}</div>
          </div>
        </div>`;}).join('')}
    </div>
  </div>`;
  REQUESTS.forEach(r=>r.fresh=false);
}

async function respondPeer(id, decision){
  try{
    const d = await api('/peer-requests/respond','POST',{ id, decision });
    INCOMING = d.incoming||[]; if(d.connections) CONNS = d.connections;
    S.courage=d.me.courage; S.level=d.me.level; S.next=d.nextLevel;
    syncCourage(); updateReqBadge();
    if(decision==='accept'){ confetti(); toast('🤝','동료와 연결됐어요! 용기 +20'); }
    else toast('🙏','정중히 거절했어요');
    renderRequests();
  }catch(e){ toast('⚠️','처리에 실패했어요'); }
}

/* ---------- notifications UI ---------- */
function renderNotifs(){
  const dot=$('#bellDot'); if(dot) dot.hidden = UNREAD===0;
  const list=$('#notifList'); if(!list) return;
  if(!NOTIFS.length){ list.innerHTML='<div class="notif-empty">아직 알림이 없어요</div>'; return; }
  list.innerHTML = NOTIFS.map(n=>`
    <div class="notif-item ${n.read?'':'unread'}">
      <div>
        <div class="nt">${n.title}</div>
        <div class="nb">${n.body||''}</div>
        <div class="nx">${relLabel(n.created_at)}</div>
      </div>
    </div>`).join('');
}
function toggleNotif(){
  const p=$('#notifPanel'); if(!p) return;
  p.hidden = !p.hidden;
  if(!p.hidden) renderNotifs();
}
async function markAllRead(){
  try{ await api('/notifications/read','POST',{}); }catch(e){}
  NOTIFS = NOTIFS.map(n=>({...n,read:1})); UNREAD=0; renderNotifs();
}
document.addEventListener('click', e=>{
  const p=$('#notifPanel'); const bell=$('#bell');
  if(p && !p.hidden && !p.contains(e.target) && bell && !bell.contains(e.target)) p.hidden=true;
});

/* ---------- live polling: new replies arrive without refresh ---------- */
let lastUnread = 0;
async function poll(){
  if(!TOKEN) return;
  try{
    const d = await api('/bootstrap');
    const prevReq = new Map(REQUESTS.map(r=>[r.id,r.status]));
    applyBootstrap(d);
    syncCourage(); updateReqBadge();
    // detect newly resolved
    let changed=null;
    REQUESTS.forEach(r=>{ if(prevReq.has(r.id) && prevReq.get(r.id)==='pending' && r.status!=='pending') changed=r; });
    if(UNREAD>lastUnread && changed){
      toast(changed.status==='accepted'?'🎉':'💌', `${changed.name} 선배의 회신 도착!`);
    }
    lastUnread = UNREAD;
    renderNotifs();
    if(S.view==='schedule') renderRequests();
    else if(S.view==='leaderboard') renderLeaderboard();
    else if(S.view==='network') renderNetwork();
    else if(S.view==='discover'){ /* keep card; just refreshed gauge */ }
  }catch(e){ if(e.status===401) logout(); }
}

/* ---------- auth / boot ---------- */
async function boot(){
  if(!TOKEN){ return; }   // 로그인 오버레이는 CSS 기본값으로 표시됨
  try{
    const d = await api('/bootstrap');
    applyBootstrap(d);
    document.body.classList.add('authed');
    $('#login').style.display='none';
    syncCourage(); updateReqBadge(); renderNotifs();
    lastUnread = UNREAD;
    navTo('discover');
    setInterval(poll, 8000);
  }catch(e){ TOKEN=null; localStorage.removeItem(TOKEN_KEY); document.body.classList.remove('authed'); }
}
async function doLogin(){
  const name=$('#inName').value.trim(), email=$('#inEmail').value.trim();
  const cohort=$('#inCohort').value, dept=$('#inDept').value;
  const err=$('#loginErr');
  if(!name||!email){ err.textContent='이름과 회사 이메일을 입력해주세요'; return; }
  const btn=$('#loginBtn'); btn.disabled=true; btn.textContent='연결 중…';
  try{
    const d = await api('/login','POST',{ name, email, cohort, dept });
    TOKEN=d.token; localStorage.setItem(TOKEN_KEY, TOKEN);
    await boot();
  }catch(e){ err.textContent='로그인에 실패했어요. 다시 시도해주세요.'; btn.disabled=false; btn.textContent='시작하기 →'; }
}
function logout(){
  localStorage.removeItem(TOKEN_KEY); TOKEN=null;
  document.body.classList.remove('authed');
  location.reload();
}

boot();

/* ---------- landing → app ---------- */
function enterApp(){ const l=document.getElementById("landing"); if(l) l.classList.add("hide"); window.scrollTo(0,0); }
