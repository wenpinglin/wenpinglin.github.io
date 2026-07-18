// 小厨 · 交互逻辑
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const state = { cat: 'all', q: '' };

const catName = (k) => (CATS.find(c => c.key === k) || {}).name || k;

function filtered() {
  const q = state.q.trim().toLowerCase();
  return RECIPES.filter(r => {
    const okCat = state.cat === 'all' || r.cat === state.cat;
    if (!okCat) return false;
    if (!q) return true;
    const hay = (r.name + r.summary + r.tags.join(' ') + catName(r.cat)).toLowerCase();
    return hay.includes(q);
  });
}

function cardHTML(r) {
  return `
  <article class="card" data-id="${r.id}" tabindex="0">
    <div class="card-emoji">${r.emoji}</div>
    <div class="card-body">
      <div class="card-cat">${catName(r.cat)}</div>
      <h3 class="card-name">${r.name}</h3>
      <p class="card-sum">${r.summary}</p>
      <div class="card-meta">
        <span>⏱ ${r.time}</span>
        <span>🔥 ${r.difficulty}</span>
        <span>👥 ${r.servings}</span>
      </div>
    </div>
  </article>`;
}

function renderGrid() {
  const list = filtered();
  const grid = $('#grid');
  if (!list.length) {
    grid.innerHTML = `<p class="empty">没有找到匹配的食谱，换个关键词试试～</p>`;
  } else {
    grid.innerHTML = list.map(cardHTML).join('');
  }
  $('#count').textContent = `共 ${list.length} 道`;
}

function renderChips() {
  $('#chips').innerHTML = CATS.map(c =>
    `<button class="chip ${c.key === state.cat ? 'on' : ''}" data-cat="${c.key}">${c.name}</button>`
  ).join('');
}

function openModal(id) {
  const r = RECIPES.find(x => x.id === id);
  if (!r) return;
  $('#m-emoji').textContent = r.emoji;
  $('#m-name').textContent = r.name;
  $('#m-cat').textContent = catName(r.cat);
  $('#m-meta').innerHTML =
    `<span>⏱ ${r.time}</span><span>🔥 ${r.difficulty}</span><span>👥 ${r.servings}</span>`;
  $('#m-tags').innerHTML = r.tags.map(t => `<span class="tag">${t}</span>`).join('');
  $('#m-ing').innerHTML = r.ingredients.map(i => `<li>${i}</li>`).join('');
  $('#m-step').innerHTML = r.steps.map((s, i) =>
    `<li><span class="num">${i + 1}</span><span>${s}</span></li>`).join('');
  $('#m-tips').innerHTML = r.tips.map(t => `<li>${t}</li>`).join('');
  $('#modal').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $('#modal').classList.remove('show');
  document.body.style.overflow = '';
}

function randomPick() {
  const r = RECIPES[Math.floor(Math.random() * RECIPES.length)];
  openModal(r.id);
}

// 事件
document.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (chip) { state.cat = chip.dataset.cat; renderChips(); renderGrid(); return; }
  const card = e.target.closest('.card');
  if (card) { openModal(card.dataset.id); return; }
  if (e.target.id === 'modal' || e.target.classList.contains('m-close')) closeModal();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
$('#search').addEventListener('input', (e) => { state.q = e.target.value; renderGrid(); });
$('#random').addEventListener('click', randomPick);

// 初始化
renderChips();
renderGrid();
