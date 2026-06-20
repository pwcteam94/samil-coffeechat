// 시드 데이터 — 선배 + 데모 동기 + 후기 + 동료 신청 주제
const SENIORS = [
  { id:"park", name:"박민서", initial:"박", dept:"세무본부 (Tax)", years:15, loc:"강남오피스", rating:4.9,
    c1:"#E8775A", c2:"#F5A98A", lvl:"멘토 인증", email:"minseo.park@samil.example.com",
    tags:["#이전가격","#법인세","#15년차","#리더십"], hot:"#법인세", accept_rate:0.7,
    bio:"국내 대기업 이전가격 자문을 이끄는 <b>세무본부 디렉터</b>. 합격 직후 입사를 앞둔 그 시기를 누구보다 잘 압니다.",
    topics:[["합격 후 입사 전, 무엇을 준비할까","선배가 추천하는 이 시기의 준비"],["세무 실무에서 진짜 쓰는 역량","시험 지식과 실무의 간극 좁히기"],["Tax 영역 커리어 패스","감사 vs 세무 vs 컨설팅, 무엇이 맞을까"]] },
  { id:"kim", name:"김도윤", initial:"김", dept:"감사1본부 (Audit)", years:8, loc:"을지로오피스", rating:4.7,
    c1:"#5B8DEF", c2:"#8FB4F7", lvl:"네트워커", email:"doyun.kim@samil.example.com",
    tags:["#제조업감사","#IFRS","#8년차","#멘토링"], hot:"#IFRS", accept_rate:0.85,
    bio:"제조·중공업 상장사 감사를 담당하는 <b>인차지 시니어</b>. 후배 커피챗 신청은 거의 다 받아줍니다.",
    topics:[["입사 첫 달, 무엇을 준비할까","감사 시즌 전 미리 익혀두면 좋은 것"],["인차지가 보는 좋은 주니어","평가받는 핵심 태도와 협업 방식"],["워라밸과 시즌 생존법","바쁜 시즌을 버티는 현실적인 팁"]] },
  { id:"lee", name:"이수아", initial:"이", dept:"Deals (재무자문)", years:11, loc:"강남오피스", rating:4.8,
    c1:"#9B6BD6", c2:"#C19BEC", lvl:"멘토 인증", email:"sua.lee@samil.example.com",
    tags:["#M&A","#밸류에이션","#11년차","#딜클로징"], hot:"#M&A", accept_rate:0.6,
    bio:"크로스보더 M&A 딜을 다루는 <b>Deals 본부 시니어 매니저</b>. 숫자 너머의 비즈니스를 보는 눈을 길러줍니다.",
    topics:[["Deals 본부는 무슨 일을 하나","감사·세무와 다른 업무의 결"],["밸류에이션 첫걸음","실무에서 모델을 어떻게 쓰는지"],["딜 마감의 짜릿함","왜 이 일을 계속하는지"]] },
  { id:"jung", name:"정하늘", initial:"정", dept:"Consulting (Digital)", years:6, loc:"여의도오피스", rating:4.6,
    c1:"#22A98A", c2:"#5FD3B8", lvl:"네트워커", email:"haneul.jung@samil.example.com",
    tags:["#디지털전환","#데이터","#6년차","#애자일"], hot:"#디지털전환", accept_rate:0.55,
    bio:"금융사 디지털 전환 프로젝트를 뛰는 <b>컨설팅 본부 컨설턴트</b>. AI·자동화 툴을 실무에 녹이는 걸 좋아합니다.",
    topics:[["비전공자도 디지털 직무 가능?","문과 출신의 데이터 적응기"],["컨설팅의 하루","프로젝트가 굴러가는 방식"],["AI 툴, 실무에서 진짜 쓰나","실제 활용 사례 솔직 토크"]] },
  { id:"choi", name:"최지훈", initial:"최", dept:"감사3본부 (금융)", years:20, loc:"을지로오피스", rating:5.0,
    c1:"#D9893A", c2:"#EFB877", lvl:"멘토 인증", email:"jihoon.choi@samil.example.com",
    tags:["#금융감사","#파트너트랙","#20년차","#리더십"], hot:"#금융감사", accept_rate:0.75,
    bio:"은행·보험 감사를 20년간 이끈 <b>감사본부 파트너</b>. 커피챗 멘토링에 가장 진심인 선배.",
    topics:[["20년 커리어의 변곡점","선택의 순간, 무엇을 기준 삼았나"],["핵심가치를 일에 녹인다는 것","말이 아닌 행동으로 보여준 사례"],["신입에게 꼭 해주고 싶은 말","첫 1년을 보내는 마음가짐"]] },
  { id:"han", name:"한예린", initial:"한", dept:"People & L&D", years:9, loc:"강남오피스", rating:4.8,
    c1:"#E86A9C", c2:"#F4A0C2", lvl:"네트워커", email:"yerin.han@samil.example.com",
    tags:["#조직문화","#온보딩","#9년차","#사람중심"], hot:"#온보딩", accept_rate:0.8,
    bio:"신규 입사자 온보딩을 설계하는 <b>인사본부 L&D 매니저</b>. 사실상 이 챌린지의 숨은 응원단장.",
    topics:[["삼일인의 밤, 어떻게 즐길까","온보딩을 200% 활용하는 법"],["회사가 보는 핵심가치","평가가 아닌 문화로서의 가치"],["동기와 잘 지내는 법","오래가는 네트워크 만들기"]] },
];

const DEMO_JOINERS = [
  { name:"윤서진", cohort:"36기", dept:"Tax",        courage:128, c1:"#E8775A", c2:"#F5A98A" },
  { name:"강태오", cohort:"37기", dept:"Audit",      courage:112, c1:"#5B8DEF", c2:"#8FB4F7" },
  { name:"문지아", cohort:"36기", dept:"Deals",      courage:58,  c1:"#22A98A", c2:"#5FD3B8" },
  { name:"배현우", cohort:"37기", dept:"Consulting", courage:51,  c1:"#9B6BD6", c2:"#C19BEC" },
  { name:"서다은", cohort:"36기", dept:"Tax",        courage:44,  c1:"#D9893A", c2:"#EFB877" },
];

const TEMPLATES = {
  formal:  "{name} 선배님께,\n\n안녕하세요. {cohort} 신규 입사 예정자입니다. {dept} 분야 경험을 듣고 싶어 커피챗을 신청드립니다.",
  friendly:"{name} 선배님 안녕하세요!\n\n곧 입사하는 {cohort} {myname}입니다. {tag} 쪽 이야기가 궁금해 용기 내어 연락드려요.",
  humor:   "{name} 선배님, 안녕하세요!\n\n곧 입사하는 {cohort}입니다. {years}년차 내공이 궁금해 용기 내어 노크합니다.",
};

const BADGES = {
  first:   { e:"🌱", n:"첫 용기",    d:"처음으로 커피챗을 신청했어요" },
  connect: { e:"🤝", n:"커넥터",     d:"커피챗이 성사되었어요" },
  immune:  { e:"💪", n:"거절 면역",  d:"거절에도 굴하지 않고 다시 도전" },
  streak:  { e:"🔥", n:"연속 도전",  d:"하루에 3회 이상 신청" },
};

const TESTIMONIALS = [
  { ju:"윤서진", ju_i:"윤", jc1:"#E8775A", jc2:"#F5A98A", se:"박민서", se_i:"박", sc1:"#E8775A", sc2:"#F5A98A", dept:"세무본부 (Tax)", topic:"합격 후 입사 전 준비", rating:5,
    quote:"막막하던 공백기에 선배님 한마디가 큰 힘이 됐어요. 궁금한 걸 메모해 갔더니 입사 첫날이 두렵지 않았어요." },
  { ju:"강태오", ju_i:"강", jc1:"#5B8DEF", jc2:"#8FB4F7", se:"김도윤", se_i:"김", sc1:"#5B8DEF", sc2:"#8FB4F7", dept:"감사1본부 (Audit)", topic:"감사 시즌 생존법", rating:5,
    quote:"시즌 루틴을 솔직하게 공유해 주셔서, 막연한 불안이 해볼 만하다는 자신감으로 바뀌었습니다." },
  { ju:"문지아", ju_i:"문", jc1:"#22A98A", jc2:"#5FD3B8", se:"이수아", se_i:"이", sc1:"#9B6BD6", sc2:"#C19BEC", dept:"Deals (재무자문)", topic:"Deals 본부의 하루", rating:5,
    quote:"숫자 너머의 비즈니스를 보는 눈이 왜 중요한지 알게 됐어요. 커피 한 잔에 커리어 방향이 또렷해졌습니다." },
  { ju:"배현우", ju_i:"배", jc1:"#9B6BD6", jc2:"#C19BEC", se:"정하늘", se_i:"정", sc1:"#22A98A", sc2:"#5FD3B8", dept:"Consulting (Digital)", topic:"비전공자의 디지털 직무", rating:4,
    quote:"문과 출신도 데이터 직무에 잘 적응할 수 있다는 걸 실제 경험으로 들려주셔서 용기를 얻었어요." },
];

const PEER_TOPICS = [
  "같은 기수끼리 입사 전 미리 친해져요",
  "본부는 다르지만 동기 네트워킹 하고 싶어요!",
  "입사 전 스터디/모임 같이 만들어볼래요?",
  "연수원 가기 전에 얼굴 한 번 봬요",
  "커피챗 챌린지 같이 달려요",
];

module.exports = { SENIORS, DEMO_JOINERS, TEMPLATES, BADGES, TESTIMONIALS, PEER_TOPICS };
