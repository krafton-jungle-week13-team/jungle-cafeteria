// 식키타카: 오늘의 메뉴 요약
// 데이터는 홈과 같은 /api/menu.txt (리버스 프록시 → 식단 백엔드)

// 홈(home.js)과 같은 기준 날짜. 주소 끝에 #2026-11-27 을 붙이면 그 날짜로 테스트
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 로컬 시간 기준 YYYY-MM-DD (toISOString은 UTC라서 오전 9시 전엔 어제가 됨)
function ymd(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// 홈(home.js)과 같은 기준: 주소 끝에 #2026-11-26 을 붙이면 그 날짜, 없으면 실제 오늘
function targetDateStr() {
  const hash = location.hash.slice(1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(hash)) return hash;
  return ymd(new Date());
}

// "날짜|요일|끼니|메뉴1, 메뉴2" → { 날짜: { day, 점심: [...], 저녁: [...] } }
function parseMenu(text) {
  const byDate = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [date, day, meal, items] = t.split('|');
    if (!items) continue;
    byDate[date] ??= { day };
    byDate[date][meal] = items.split(',').map(s => s.trim());
  }
  return byDate;
}

let todayMenu = null;    // { day, 점심: [...], 저녁: [...] } 또는 null

// 오늘의 메뉴 요약
function showSummary(dateStr) {
  const box = document.getElementById('today-menu');
  const d = new Date(dateStr + 'T00:00:00');
  const title = `${d.getMonth() + 1}/${d.getDate()} (${DAYS[d.getDay()]}) 오늘의 메뉴`;

  box.innerHTML = '';
  const h = document.createElement('div');
  h.className = 'today-menu-title';
  h.textContent = title;
  box.appendChild(h);

  if (!todayMenu) {
    const p = document.createElement('div');
    p.textContent = '메뉴를 불러오지 못했어요. 메뉴 태그 없이 글을 남길 수 있어요.';
    box.appendChild(p);
    return;
  }
  for (const label of ['점심', '저녁']) {
    const row = document.createElement('div');
    const tag = document.createElement('span');
    tag.className = `tag ${label === '점심' ? 'lunch' : 'dinner'}`;
    tag.textContent = label;
    const main = document.createElement('b');
    main.textContent = todayMenu[label]?.[0] ?? '-';
    const rest = document.createElement('span');
    rest.className = 'rest';
    rest.textContent = (todayMenu[label] ?? []).slice(1).join(' · ');
    row.append(tag, main, rest);
    box.appendChild(row);
  }
}

let menuByDate = null;   // 받아 온 식단 전체 (실패하면 null)

// 지금 날짜(해시 또는 오늘)에 맞춰 요약 상자를 다시 그린다
function render() {
  const dateStr = targetDateStr();
  todayMenu = menuByDate?.[dateStr] ?? null;
  showSummary(dateStr);
}

async function main() {
  try {
    const res = await fetch('/api/menu.txt', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    menuByDate = parseMenu(await res.text());
  } catch (e) {
    menuByDate = null;                                  // 식단 서버가 꺼져 있어도 글쓰기는 가능
  }

  render();
  // 페이지를 연 채로 주소창의 해시만 바꾸면 새로고침이 일어나지 않는다 → 직접 다시 그린다
  window.addEventListener('hashchange', render);
}

main();
