/* ===================== 삼일 커피챗 · HR 대시보드 ===================== */
const KEY_LS = 'cc_admin_key';
let ADMIN_KEY = localStorage.getItem(KEY_LS) || '';
let FILTER = 'all';
let DATA = null;

const $ = s => document.querySelector(s);
const esc = s => (s||'').replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

async function adminApi(path, method='GET', body){
  const res = await fetch('/api/admin'+path, {
    method,
    headers:{ 'Content-Type':'application/json', 'x-admin-key':ADMIN_KEY },
    body: body?JSON.stringify(body):undefined,
  });
  if(!res.ok){ const e=await res.json().catch(()=>({})); throw Object.assign(new Error(e.error||'err'),{status:res.status}); }
  return res.json();
}

let toastT;
function toast(msg){
  const t=$('#toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),2200);
}

async function unlock(){
  ADMIN_KEY = $('#keyIn').value.trim();
  try{
    await adminApi('/overview');
    localStorage.setItem(KEY_LS, ADMIN_KEY);
    document.body.classList.add('ok');
    load();
    setInterval(load, 8000);
  }catch(e){ $('#gateErr').textContent = e.status===403?'키가 올바르지 않습니다.':'접속에 실패했어요.'; }
}

function relTime(ts){
  const d=Date.now()-ts, H=36e5, DAY=24*H;
  if(d<60000) return '방금';
  if(d<H) return Math.floor(d/60000)+'분 전';
  if(d<DAY) return Math.floor(d/H)+'시간 전';
  return Math.floor(d/DAY)+'일 전';
}

async function load(){
  try{ DATA = await adminApi('/overview'); }
  catch(e){ if(e.status===403){ document.body.classList.remove('ok'); } return; }
  renderKpis(); renderReqs(); renderByDept(); renderLb(); renderMails();
}

function renderKpis(){
  const s=DATA.stats;
  $('#kpis').innerHTML = [
    ['#23211F', s.total, '총 신청', '누적 커피챗 신청'],
    ['#B07A1C', s.pending, '응답 대기', '회신 대기 중'],
    ['#15784A', s.accepted, '수락 (성사)', '커피챗 확정'],
    ['#8A857E', s.declined, '정중히 거절', '용기 +15 적립'],
    ['#EE5836', s.acceptRate+'%', '성사율', '수락 / 응답완료'],
    ['#5C6BC0', s.participation+'%', '참여율', `${s.active} / ${s.joiners}명 참여`],
  ].map(([c,v,l,d])=>`<div class="kpi"><div class="v" style="color:${c}">${v}</div><div class="l">${l}</div><div class="d">${d}</div></div>`).join('');
}

function renderReqs(){
  const seg=$('#seg'); seg.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b.dataset.f===FILTER));
  const rows = DATA.requests.filter(r=>FILTER==='all'||r.status===FILTER);
  const stLab={pending:'응답 대기',accepted:'수락됨',declined:'정중히 거절'};
  const body=$('#reqBody');
  if(!rows.length){ body.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--ink-faint);padding:30px">해당 상태의 신청이 없어요</td></tr>'; return; }
  body.innerHTML = rows.map(r=>`
    <tr>
      <td><div class="who"><div class="av" style="background:linear-gradient(135deg,${r.uc1||'#5C6BC0'},${r.uc2||'#7E8DE0'})">${esc((r.uname||'·')[0])}</div>
        <div><div class="nm">${esc(r.uname)}</div><div class="sb">${esc(r.ucohort)} · ${esc(r.udept)}</div></div></div></td>
      <td><div class="who"><div class="av" style="background:linear-gradient(135deg,${r.sc1},${r.sc2})">${esc(r.sinit)}</div>
        <div><div class="nm">${esc(r.sname)}</div><div class="sb">${esc(r.sdept)}</div></div></div></td>
      <td><span class="st ${r.status}">${stLab[r.status]}</span></td>
      <td style="color:var(--ink-faint);font-weight:600">${relTime(r.sent_at)}</td>
      <td>${r.status==='pending'
        ? `<div class="act"><button class="acc" onclick="respond('${r.id}','accept')">수락</button><button class="dec" onclick="respond('${r.id}','decline')">거절</button></div>`
        : r.status==='accepted' ? `<span class="sb" style="font-size:11px">${esc(r.meet_at||'성사')}</span>` : '<span class="sb">—</span>'}</td>
    </tr>`).join('');
}

function renderByDept(){
  const max = Math.max(1, ...DATA.byDept.map(d=>d.n));
  $('#byDept').innerHTML = DATA.byDept.map(d=>`
    <div class="bar"><div class="nm">${esc(d.dept)}</div>
      <div class="track"><div class="fill" style="width:${Math.round(d.n/max*100)}%"></div></div>
      <div class="n">${d.n}건 · 성사 ${d.acc}</div></div>`).join('') || '<div style="padding:18px;color:var(--ink-faint);font-size:12px">데이터 없음</div>';
}

function renderLb(){
  $('#lb').innerHTML = DATA.leaderboard.slice(0,6).map(l=>`
    <div class="lb-row"><div class="rk">${l.rank}</div>
      <div class="av" style="background:linear-gradient(135deg,${l.c1},${l.c2})">${esc((l.name||'·')[0])}</div>
      <div><div class="nm" style="font-size:12.5px;font-weight:800">${esc(l.name)}</div>
        <div class="sb" style="font-size:10.5px;color:var(--ink-faint)">${esc(l.cohort||'')} · ${esc(l.dept||'')} · ${l.succ}회 성사</div></div>
      <div class="pt">${l.courage}</div></div>`).join('');
}

function renderMails(){
  const kindLab={request:'신청',reply:'회신',notice:'공지'};
  $('#mails').innerHTML = DATA.emails.map(m=>`
    <div class="mail"><div class="mh"><span class="mt">${esc(m.subject)}</span><span class="tag">${kindLab[m.kind]||m.kind}</span></div>
      <div class="mto">→ ${esc(m.to_name||'')} &lt;${esc(m.to_addr)}&gt; · ${relTime(m.created_at)} · ${m.transport==='smtp'?'발송됨':'아웃박스'}</div></div>`).join('')
    || '<div style="padding:18px;color:var(--ink-faint);font-size:12px">발송된 메일 없음</div>';
}

async function respond(id, decision){
  try{ await adminApi('/respond','POST',{ requestId:id, decision }); toast(decision==='accept'?'수락 처리됨 · 신청자에게 알림 발송':'거절 처리됨 · 신청자에게 알림 발송'); load(); }
  catch(e){ toast('처리 실패'); }
}
async function announce(){
  const subject=$('#anSub').value.trim(), body=$('#anBody').value.trim();
  if(!subject||!body){ toast('제목과 내용을 입력하세요'); return; }
  try{ const r=await adminApi('/announce','POST',{subject,body}); toast(`${r.count}명에게 공지 발송 완료`); $('#anSub').value='';$('#anBody').value=''; load(); }
  catch(e){ toast('발송 실패'); }
}

$('#seg').addEventListener('click', e=>{ if(e.target.dataset.f){ FILTER=e.target.dataset.f; renderReqs(); } });

// 자동 입장(저장된 키)
if(ADMIN_KEY){ adminApi('/overview').then(()=>{ document.body.classList.add('ok'); load(); setInterval(load,8000); }).catch(()=>{}); }
