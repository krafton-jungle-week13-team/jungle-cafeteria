// 홈: 오늘의 식사(사진 + 메뉴 이름) + 이번 주 식단표
// /api/menu.txt 는 한 번만 받아서 두 곳에 같이 쓴다.

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MEALS = { lunch: '점심', dinner: '저녁' };
let menuByDate = null;          // 받아 온 식단 (실패하면 null)
let menuError = '';

// ---------- 날짜 ----------
// 주소 끝에 #2026-11-26 을 붙이면 그 날짜로 테스트 (해시는 서버로 안 보내짐)
function targetDate() {
  const hash = location.hash.slice(1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(hash)) return new Date(hash + 'T00:00:00');
  return new Date();
}

// 로컬 시간 기준 YYYY-MM-DD (toISOString은 UTC라서 오전 9시 전엔 어제가 됨)
function ymd(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// ---------- 식단 데이터 ----------

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

async function fetchMenu() {
  try {
    const res = await fetch('/api/menu.txt', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    menuByDate = parseMenu(await res.text());
  } catch (e) {
    menuByDate = null;
    menuError = e.message;
  }
}

// ---------- 오늘의 식사 ----------

function showMealPhotos(dateStr) {
  for (const meal of Object.keys(MEALS)) {
    const img = document.querySelector(`#${meal} img`);
    img.onerror = () => {          // 사진이 없으면 서버가 404 → 준비 중 이미지
      img.onerror = null;          // ready.jpg도 없을 때 무한 반복 방지
      img.src = '/img/ready.png';
    };
    img.src = `/img/meals/${dateStr}-${meal}.png`;
  }

  // 지금 시간에 맞는 끼니 강조 (15시 전이면 점심)
  const lunchTime = new Date().getHours() < 15;
  document.getElementById('lunch').classList.toggle('now', lunchTime);
  document.getElementById('dinner').classList.toggle('now', !lunchTime);
}

function showMealItems(dateStr) {
  for (const [meal, label] of Object.entries(MEALS)) {
    const box = document.querySelector(`#${meal} .meal-items`);
    box.innerHTML = '';
    if (!menuByDate) {
      box.textContent = '메뉴를 불러오지 못했어요.';
      continue;
    }
    const items = menuByDate[dateStr]?.[label];
    if (!items) {
      box.textContent = '등록된 메뉴가 없어요.';
      continue;
    }
    items.forEach((item, i) => {
      const span = document.createElement('span');
      span.textContent = item;
      if (i === 0) span.className = 'main-dish';
      box.appendChild(span);
    });
  }
}

// ---------- 이번 주 식단표 ----------

function mealCell(items) {
  const td = document.createElement('td');
  if (!items) { td.textContent = '-'; return td; }
  items.forEach((item, i) => {
    const div = document.createElement('div');
    div.textContent = item;                     // textContent: 데이터에 태그가 있어도 안전
    if (i === 0) div.className = 'main-dish';
    td.appendChild(div);
  });
  return td;
}

function showTable(dateStr) {
  const tbody = document.getElementById('menu-body');
  tbody.innerHTML = '';

  if (!menuByDate) {
    const td = tbody.insertRow().insertCell();
    td.colSpan = 3;
    td.textContent = `식단을 불러오지 못했어요 (${menuError}). 식단 서버가 켜져 있는지 확인하세요.`;
    return;
  }

  for (const date of Object.keys(menuByDate).sort()) {
    const { day, 점심, 저녁 } = menuByDate[date];
    const tr = document.createElement('tr');
    if (date === dateStr) tr.className = 'today';

    const th = document.createElement('th');
    th.textContent = `${Number(date.slice(5, 7))}/${Number(date.slice(8))} (${day})`;
    tr.append(th, mealCell(점심), mealCell(저녁));
    tbody.appendChild(tr);
  }
}

// ---------- 그리기 ----------

function render() {
  const d = targetDate();
  const dateStr = ymd(d);
  document.getElementById('today-title').textContent =
    `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]}) 오늘의 식사`;

  showMealItems(dateStr);
  showTable(dateStr);
}

async function main() {
  showMealPhotos(ymd(targetDate()));   // 사진은 식단 서버와 상관없이 먼저 요청
  await fetchMenu();                   // 식단은 한 번만 요청
  render();
  window.addEventListener('hashchange', () => {
    showMealPhotos(ymd(targetDate()));  // 날짜가 바뀌면 사진 다시 요청
    render();                           // 메뉴와 식단표 다시 그리기 (menu.txt는 재요청 안 함)
  });
}

main();
