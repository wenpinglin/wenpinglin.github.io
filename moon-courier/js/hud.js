// hud.js — HUD 与页面控制（M4：三模式菜单/图鉴/成就/排行/商店/战报卡/氧气条；M5-3：存档备份）
import { CHARACTERS, getCharacter } from './characters.js';
import { LEVELS } from './levels.js';
import { BOOKS, RARITY_INFO } from './codex.js';
import { SHOP_ITEMS } from './shop.js';
import { ACHIEVEMENTS } from './achievements.js';

const EMOJI = {
  rabbit: '🐰', mouse: '🐭', ox: '🐮', tiger: '🐯', dragon: '🐲', snake: '🐍',
  horse: '🐴', sheep: '🐑', monkey: '🐵', rooster: '🐔', dog: '🐶', pig: '🐷', duck: '🦆',
};

// HTML 转义：昵称会进入 innerHTML，避免"自 XSS"
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 昵称清洗：去标签字符 + 截断 + 基础敏感词过滤（需求文档 9.1 的最小可用词库）
const NICK_BAD = ['fuck', 'shit', 'bitch', 'asshole', '傻逼', '煞笔', '妈的', '操你', '滚你', '强奸', '淫', '色情', '赌', '毒品', '枪支'];
export function sanitizeNick(raw, max = 12) {
  let s = String(raw ?? '').replace(/[<>"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  const low = s.toLowerCase();
  for (const w of NICK_BAD) {
    if (low.includes(w.toLowerCase())) s = s.replace(new RegExp(w, 'gi'), '*'.repeat(Math.min(w.length, 3)));
  }
  return s;
}

export class HUD {
  constructor(save) {
    this.save = save;
    this.elDist = document.getElementById('hud-distance');
    this.elDust = document.getElementById('hud-dust');
    this.elCombo = document.getElementById('hud-combo');
    this.elComboWrap = document.getElementById('hud-combo-wrap');
    this.elChargeBar = document.getElementById('charge-bar');
    this.elChargeFill = document.getElementById('charge-fill');
    this.elOxygen = document.getElementById('oxygen-bar');
    this.elOxygenFill = document.getElementById('oxygen-fill');
    this.elDailyTimer = document.getElementById('daily-timer');
    this.popLayer = document.getElementById('pop-layer');
    this.elHud = document.getElementById('hud');

    this.sSetup = document.getElementById('setup-screen');
    this.sMenu = document.getElementById('menu-screen');
    this.sLevel = document.getElementById('level-screen');
    this.sChar = document.getElementById('char-screen');
    this.sDeath = document.getElementById('death-screen');
    this.sClear = document.getElementById('clear-screen');
    this.sCodex = document.getElementById('codex-screen');
    this.sAchv = document.getElementById('achv-screen');
    this.sRank = document.getElementById('rank-screen');
    this.sShop = document.getElementById('shop-screen');
    this.sResult = document.getElementById('result-screen');
    this.sCard = document.getElementById('card-modal');
    this.sBackup = document.getElementById('backup-screen');
    this.sPause = document.getElementById('pause-screen');
    this.elIntro = document.getElementById('level-intro');
    this._backCb = null;
  }

  // ===== 对局 HUD =====
  update(dist, dust, combo) {
    this.elDist.textContent = Math.floor(dist);
    this.elDust.textContent = dust;
    if (combo >= 3) {
      this.elCombo.textContent = `x${combo}`;
      this.elComboWrap.style.display = 'block';
      let level = combo >= 8 ? 3 : combo >= 5 ? 2 : 1;
      this.elComboWrap.dataset.level = level;
    } else {
      this.elComboWrap.style.display = 'none';
    }
  }

  updateCharge(progress, active) {
    this.elChargeBar.classList.toggle('active', active);
    if (active) this.elChargeFill.style.width = (progress * 100) + '%';
  }

  updateOxygen(oxygen, max) {
    if (oxygen === null) { this.elOxygen.style.display = 'none'; return; }
    this.elOxygen.style.display = 'block';
    this.elOxygenFill.style.width = Math.max(0, Math.min(100, oxygen / max * 100)) + '%';
  }

  setDailyTimer(sec) {
    if (sec === null) { this.elDailyTimer.style.display = 'none'; return; }
    this.elDailyTimer.style.display = 'block';
    this.elDailyTimer.textContent = `⏱ ${Math.ceil(sec)}s`;
    this.elDailyTimer.classList.toggle('urgent', sec <= 15);
  }

  setHudVisible(vis) { this.elHud.style.display = vis ? 'block' : 'none'; }

  // ===== 提示 / 弹字 =====
  toast(msg, ms = 2000) {
    const t = document.createElement('div');
    t.className = 'hud-toast';
    t.textContent = msg;
    this.popLayer.appendChild(t);
    setTimeout(() => t.classList.add('out'), ms - 300);
    setTimeout(() => t.remove(), ms);
    const all = this.popLayer.querySelectorAll('.hud-toast');
    if (all.length > 3) all[0].remove();
  }

  popDust(gain, perfect) {
    const d = document.createElement('div');
    d.className = 'pop-dust' + (perfect ? ' perfect' : '');
    d.textContent = `+${gain} 月尘`;
    this.popLayer.appendChild(d);
    setTimeout(() => d.remove(), 1000);
  }

  popPerfect() {
    const p = document.createElement('div');
    p.className = 'pop-perfect';
    p.textContent = 'PERFECT';
    this.popLayer.appendChild(p);
    setTimeout(() => p.remove(), 950);
  }

  // ===== 页面控制 =====
  hideAll() {
    [this.sSetup, this.sMenu, this.sLevel, this.sChar, this.sDeath, this.sClear,
     this.sCodex, this.sAchv, this.sRank, this.sShop, this.sResult, this.sCard, this.sBackup, this.sPause]
      .forEach(s => { if (s) s.style.display = 'none'; });
    this.setHudVisible(true);
  }

  onBackToMenu(cb) { this._backCb = cb; }

  // ===== 首启引导 =====
  showSetup(audio, onDone) {
    this.hideAll(); this.setHudVisible(false);
    this.sSetup.style.display = 'flex';
    const input = this.sSetup.querySelector('#nickname-input');
    const grid = this.sSetup.querySelector('#setup-char-grid');
    const btn = this.sSetup.querySelector('#setup-done-btn');
    grid.innerHTML = '';
    let selected = 'rabbit';
    this._renderCharGrid(grid, selected, (id) => { selected = id; });
    btn.onclick = () => {
      let nick = sanitizeNick(input.value);
      if (!nick) nick = `无名快递员${Math.floor(1000 + Math.random() * 9000)}`;
      onDone(nick, selected);
    };
  }

  // ===== 角色卡网格（首启/换角共用） =====
  _renderCharGrid(container, selectedId, onPick) {
    CHARACTERS.forEach(c => {
      const card = document.createElement('div');
      card.className = 'char-card' + (c.id === selectedId ? ' selected' : '') + (c.id === 'duck' ? ' guest' : '');
      card.innerHTML = `
        <div class="char-emoji">${EMOJI[c.id]}</div>
        <div class="char-name">${c.name}</div>
        <div class="char-tag">${c.tagline}</div>
        <div class="char-perk">${c.perkText}</div>`;
      card.onclick = () => {
        container.querySelectorAll('.char-card').forEach(x => x.classList.remove('selected'));
        card.classList.add('selected');
        onPick(c.id);
      };
      container.appendChild(card);
    });
  }

  // ===== 主菜单 =====
  showMenu({ onLevels, onEndless, onDaily, onChar, onShop, onCodex, onAchv, onRank, onSfx, onAbout, onBackup }) {
    this.hideAll(); this.setHudVisible(false);
    this.sMenu.style.display = 'flex';
    const char = getCharacter(this.save.data.character);
    const nick = this.save.data.nickname || '无名快递员';
    this.sMenu.querySelector('#menu-courier').innerHTML = `
      <div class="menu-avatar">${EMOJI[char.id]}</div>
      <div class="menu-nick">${esc(nick)}</div>
      <div class="menu-char">${char.name} · ${char.perkText}</div>
      <div class="menu-dust">月尘 ${this.save.data.moonDust} · 图鉴 ${this.save.codexList.length} 坑 · 成就 ${this.save.data.achievements.length}/${ACHIEVEMENTS.length}</div>`;

    const endlessUnlocked = this.save.data.unlockedLevel >= 4;
    const streak = this.save.data.daily?.lastDoneDate === this._today() ? (this.save.data.daily?.streak || 0) : null;
    const btns = [
      { id: 'menu-btn-levels', label: '开始冒险', cls: 'btn-primary', fn: onLevels },
      { id: 'menu-btn-endless', label: endlessUnlocked ? '无尽模式' : '无尽模式 🔒通关前3关', cls: endlessUnlocked ? 'btn-primary btn-gold' : 'btn-secondary', fn: endlessUnlocked ? onEndless : () => this.toast('通关前 3 关解锁无尽模式', 2000) },
      { id: 'menu-btn-daily', label: streak ? `今日特快（连击${streak}天✓）` : '今日特快', cls: 'btn-primary btn-gold', fn: onDaily },
      { id: 'menu-btn-char', label: '更换角色', cls: 'btn-secondary', fn: onChar },
      { id: 'menu-btn-shop', label: `装备商店（${this.save.data.moonDust}尘）`, cls: 'btn-secondary', fn: onShop },
      { id: 'menu-btn-codex', label: `月球小百科（${this.save.data.codex.length}）`, cls: 'btn-secondary', fn: onCodex },
      { id: 'menu-btn-achv', label: '成就', cls: 'btn-secondary', fn: onAchv },
      { id: 'menu-btn-rank', label: '排行榜', cls: 'btn-secondary', fn: onRank },
      { id: 'menu-btn-sfx', label: `音效：${this.save.data.settings.sfx ? '开' : '关'}`, cls: 'btn-secondary', fn: onSfx },
      { id: 'menu-btn-backup', label: '存档备份 / 恢复', cls: 'btn-secondary', fn: onBackup },
      { id: 'menu-btn-about', label: '关于', cls: 'btn-secondary', fn: onAbout },
    ];
    const wrap = this.sMenu.querySelector('#menu-btns');
    wrap.innerHTML = '';
    btns.forEach(b => {
      const el = document.createElement('button');
      el.id = b.id; el.className = b.cls; el.textContent = b.label;
      el.onclick = b.fn;
      wrap.appendChild(el);
    });
  }

  _today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ===== 关卡选择 =====
  showLevelSelect(onStart) {
    this.hideAll(); this.setHudVisible(false);
    this.sLevel.style.display = 'flex';
    const grid = this.sLevel.querySelector('#level-grid');
    grid.innerHTML = '';
    LEVELS.forEach(lv => {
      const unlocked = this.save.isLevelUnlocked(lv.id);
      const stars = this.save.stars[lv.id] || 0;
      const post = this.save.getPostReached(lv.id);
      const card = document.createElement('div');
      card.className = 'level-card' + (unlocked ? '' : ' locked');
      card.innerHTML = `
        <div class="lv-head">
          <div class="lv-id">${unlocked ? `第 ${lv.id} 关` : '🔒 未解锁'}</div>
          <div class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
        </div>
        <div class="lv-name">${lv.name}</div>
        <div class="lv-sub">${lv.subtitle}</div>
        <div class="lv-meta">${lv.length}m · 速度x${lv.speedMult} · 达标${lv.dustThreshold}尘${lv.oxygen ? ' · 氧气' : ''}${lv.meteor ? ' · 陨石雨' : ''}${lv.eclipse ? ' · 月食' : ''}</div>
        ${post > 0 ? `<div class="lv-post">驿站进度 ${post}m</div>` : ''}
        <div class="lv-btns"></div>`;
      const btns = card.querySelector('.lv-btns');
      if (unlocked) {
        const bStart = document.createElement('button');
        bStart.className = 'btn-primary btn-sm';
        bStart.textContent = post > 0 ? '从头开始' : '出发';
        bStart.onclick = () => onStart(lv.id, false);
        btns.appendChild(bStart);
        if (post > 0) {
          const bCont = document.createElement('button');
          bCont.className = 'btn-primary btn-sm btn-gold';
          bCont.textContent = `从驿站继续(${post}m)`;
          bCont.onclick = () => onStart(lv.id, true);
          btns.appendChild(bCont);
        }
      } else {
        const t = document.createElement('div');
        t.className = 'lv-locked-tip'; t.textContent = '通关上一关解锁';
        btns.appendChild(t);
      }
      grid.appendChild(card);
    });
    this.sLevel.querySelector('#level-back-btn').onclick = () => { if (this._backCb) this._backCb(); };
  }

  // ===== 更换角色 =====
  showCharSelect(audio, onPick, onBack) {
    this.hideAll(); this.setHudVisible(false);
    this.sChar.style.display = 'flex';
    const grid = this.sChar.querySelector('#char-grid');
    grid.innerHTML = '';
    let selected = this.save.data.character;
    this._renderCharGrid(grid, selected, (id) => { selected = id; });
    this.sChar.querySelector('#char-confirm-btn').onclick = () => { if (selected) onPick(selected); };
    this.sChar.querySelector('#char-back-btn').onclick = onBack;
  }

  // ===== 图鉴 =====
  showCodex(codex, achv, onBack) {
    this.hideAll(); this.setHudVisible(false);
    this.sCodex.style.display = 'flex';
    const wrap = this.sCodex.querySelector('#codex-page-grid');
    wrap.innerHTML = '';
    const counts = codex.bookCounts();
    BOOKS.forEach(b => {
      const c = counts[b.id] || { collected: 0, total: 0, open: true };
      const book = document.createElement('div');
      book.className = 'codex-book';
      book.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div class="book-name">${b.name}</div>
            <div class="book-desc">${b.desc}</div>
          </div>
          <div class="book-count">${c.collected}/${c.total > 0 ? c.total : '∞'}</div>
        </div>
        <div class="codex-entries"></div>`;
      const body = book.querySelector('.codex-entries');
      let open = false;
      book.onclick = () => {
        open = !open;
        if (open) {
          body.innerHTML = '';
          const entries = codex.bookEntries(b.id);
          if (entries.length === 0) {
            body.innerHTML = '<div class="codex-entry locked" style="opacity:.7">还没有收集到这一册的坑——跑起来吧。</div>';
          }
          entries.forEach(en => {
            const info = RARITY_INFO[en.rarity];
            const got = en.got ?? true;
            const e = document.createElement('div');
            e.className = 'codex-entry' + (got ? '' : ' locked');
            e.innerHTML = `
              <div class="ce-head">
                <span class="rarity-badge" style="color:${info.color};border-color:${info.color}">${info.label}</span>
                <span class="ce-name">${en.name}</span>
              </div>
              <div class="ce-text">${en.text}</div>`;
            body.appendChild(e);
          });
          book.classList.add('open-book');
        } else {
          body.innerHTML = '';
          book.classList.remove('open-book');
        }
      };
      wrap.appendChild(book);
    });
    this.sCodex.querySelector('#codex-back-btn').onclick = onBack;
  }

  // ===== 成就 =====
  showAchievements(achv, onBack) {
    this.hideAll(); this.setHudVisible(false);
    this.sAchv.style.display = 'flex';
    const grid = this.sAchv.querySelector('#achv-grid');
    grid.innerHTML = '';
    ACHIEVEMENTS.forEach(a => {
      const got = achv.isUnlocked(a.id);
      const item = document.createElement('div');
      item.className = 'achv-item' + (got ? ' got' : '');
      item.innerHTML = `
        <div class="achv-icon">${a.icon}</div>
        <div>
          <div class="achv-name">${a.name}${got ? ' ✓' : ''}</div>
          <div class="achv-cond">${a.cond}</div>
          <div class="achv-reward">${a.reward}</div>
        </div>`;
      grid.appendChild(item);
    });
    this.sAchv.querySelector('#achv-back-btn').onclick = onBack;
  }

  // ===== 排行榜 =====
  showRanking(save, onBack) {
    this.hideAll(); this.setHudVisible(false);
    this.sRank.style.display = 'flex';
    const body = this.sRank.querySelector('#rank-body');
    body.innerHTML = '';
    const EMO = { rabbit: '🐰', mouse: '🐭', ox: '🐮', tiger: '🐯', dragon: '🐲', snake: '🐍', horse: '🐴', sheep: '🐑', monkey: '🐵', rooster: '🐔', dog: '🐶', pig: '🐷', duck: '🦆' };
    const renderBoard = (title, board, levelId) => {
      const rows = save.getRanking(board, levelId);
      const h = document.createElement('h3');
      h.textContent = title;
      body.appendChild(h);
      if (!rows || rows.length === 0) {
        const e = document.createElement('div');
        e.className = 'rank-empty'; e.textContent = '暂无记录——跑一局吧！';
        body.appendChild(e);
        return;
      }
      rows.forEach((r, i) => {
        const row = document.createElement('div');
        row.className = 'rank-row';
        row.innerHTML = `
          <span class="rk-no">${i + 1}</span>
          <span class="rk-char">${EMO[r.char] || '🐰'}</span>
          <span class="rk-nick">${esc(r.nick) || '无名'}</span>
          <span class="rk-dist">${r.dist}m</span>
          <span class="rk-date">${r.date || ''}</span>`;
        body.appendChild(row);
      });
    };
    renderBoard('无尽巡游 TOP10', 'endless');
    renderBoard('今日特快 TOP10', 'daily');
    const h3 = document.createElement('h3');
    h3.textContent = '关卡最佳';
    body.appendChild(h3);
    LEVELS.forEach(lv => renderBoard(`第${lv.id}关 · ${lv.name}`, 'level', lv.id));
    this.sRank.querySelector('#rank-back-btn').onclick = onBack;
  }

  // ===== 商店 =====
  showShop(shop, audio, onBack) {
    this.hideAll(); this.setHudVisible(false);
    this.sShop.style.display = 'flex';
    this.sShop.querySelector('#shop-dust').textContent = `当前月尘：${shop.dust}`;
    const grid = this.sShop.querySelector('#shop-grid');
    grid.innerHTML = '';
    const render = () => {
      grid.innerHTML = '';
      this.sShop.querySelector('#shop-dust').textContent = `当前月尘：${shop.dust}`;
      SHOP_ITEMS.forEach(item => {
        const state = shop.canBuy(item);
        const el = document.createElement('div');
        el.className = 'shop-item';
        el.innerHTML = `
          <div class="shop-icon">${item.icon}</div>
          <div class="shop-body">
            <div class="shop-name">${item.name}${state === 'owned' ? '<span class="shop-owned">已拥有</span>' : ''}</div>
            <div class="shop-desc">${item.desc}</div>
          </div>
          <button class="shop-buy ${state !== 'ok' ? 'disabled' : ''}">${state === 'owned' ? '已拥有' : state === 'poor' ? `${item.price}尘` : `${item.price}尘 购买`}</button>`;
        const buyBtn = el.querySelector('.shop-buy');
        buyBtn.onclick = () => {
          if (state === 'owned') { this.toast('已拥有该装备', 1600); return; }
          if (state === 'poor') { this.toast('月尘不足', 1600); return; }
          const r = shop.buy(item);
          if (r === 'ok') {
            audio.coin ? audio.coin() : null;
            this.toast(`购入：${item.name} ✓`, 1800);
            render();
          } else {
            this.toast('购买失败', 1600);
          }
        };
        grid.appendChild(el);
      });
    };
    render();
    this.sShop.querySelector('#shop-back-btn').onclick = onBack;
  }

  // ===== 死亡页 =====
  showDeath(dist, dust, quote, hasPost, onRespawn, onMenu, onCard) {
    this.hideAll(); this.setHudVisible(false);
    this.sDeath.style.display = 'flex';
    this.sDeath.querySelector('#death-quote').textContent = quote || '';
    this.sDeath.querySelector('#death-distance').textContent = Math.floor(dist);
    this.sDeath.querySelector('#death-dust').textContent = dust;
    const retry = this.sDeath.querySelector('#retry-btn');
    retry.textContent = hasPost ? '从驿站继续' : '重新出发';
    retry.onclick = onRespawn;
    this.sDeath.querySelector('#death-card-btn').onclick = onCard;
    this.sDeath.querySelector('#death-menu-btn').onclick = onMenu;
  }

  // ===== 无尽/每日结算页 =====
  showEndlessResult(title, dist, dust, comboMax, sub, onRetry, onMenu, onCard) {
    this.hideAll(); this.setHudVisible(false);
    this.sResult.style.display = 'flex';
    this.sResult.querySelector('#result-title').textContent = title;
    this.sResult.querySelector('#result-dist').textContent = Math.floor(dist);
    this.sResult.querySelector('#result-dust').textContent = dust;
    this.sResult.querySelector('#result-combo').textContent = `x${comboMax}`;
    this.sResult.querySelector('#result-sub').textContent = sub || '';
    this.sResult.querySelector('#result-retry-btn').onclick = onRetry;
    this.sResult.querySelector('#result-card-btn').onclick = onCard;
    this.sResult.querySelector('#result-menu-btn').onclick = onMenu;
  }

  // ===== 通关结算 =====
  showClear(lv, stars, dust, bonus, dustOk, noDeath, hasNext, onNext, onReplay, onMenu, onCard) {
    this.hideAll(); this.setHudVisible(false);
    this.sClear.style.display = 'flex';
    this.sClear.querySelector('#clear-title').textContent = `${lv.name} · 派送完成`;
    const starBox = this.sClear.querySelector('#clear-stars');
    starBox.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.className = i < stars ? 'on' : '';
      s.textContent = '★';
      starBox.appendChild(s);
    }
    this.sClear.querySelector('#clear-detail').innerHTML = `
      ${dustOk ? '<span class="ok">✓ 月尘达标</span>' : '<span class="miss">✗ 月尘未达标</span>'} · 
      ${noDeath ? '<span class="ok">✓ 全程无坠落</span>' : '<span class="miss">✗ 途中坠落</span>'}`;
    this.sClear.querySelector('#clear-dust').textContent =
      `获得月尘 ${dust + (bonus || 0)}${bonus ? `（含三星奖励 +${bonus}）` : ''}`;
    const nextBtn = this.sClear.querySelector('#clear-next-btn');
    if (hasNext) {
      nextBtn.style.display = 'inline-block';
      nextBtn.onclick = onNext;
    } else {
      nextBtn.style.display = 'none';
    }
    this.sClear.querySelector('#clear-replay-btn').onclick = onReplay;
    this.sClear.querySelector('#clear-card-btn').onclick = onCard;
    this.sClear.querySelector('#clear-menu-btn').onclick = onMenu;
  }

  // ===== 战报卡 =====
  showCardModal(dataUrl, onDownload) {
    this.sCard.style.display = 'flex';
    this.sCard.querySelector('#card-img').src = dataUrl;
    this.sCard.querySelector('#card-download-btn').onclick = onDownload;
    this.sCard.querySelector('#card-close-btn').onclick = () => this.sCard.style.display = 'none';
  }

  // ===== M5-3：存档备份 / 恢复 =====
  showBackup(onClose) {
    this.hideAll(); this.setHudVisible(false);
    this.sBackup.style.display = 'flex';
    const ta = this.sBackup.querySelector('#backup-code');
    ta.value = this.save.backupCode();
    this.sBackup.querySelector('#backup-copy-btn').onclick = () => {
      ta.select();
      const done = () => this.toast('备份码已复制到剪贴板', 1600);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value).then(done).catch(() => done());
      } else { done(); }
    };
    this.sBackup.querySelector('#backup-import-btn').onclick = () => {
      if (this.save.restoreCode(ta.value)) {
        this.toast('存档已恢复 ✓', 2000);
        onClose();
      } else {
        this.toast('备份码无效 ✗', 2600);
      }
    };
    this.sBackup.querySelector('#backup-close-btn').onclick = () => onClose();
  }

  // ===== 暂停 =====
  showPause(onResume, onRestart, onMenu) {
    this.hideAll(); this.setHudVisible(false);
    this.sPause.style.display = 'flex';
    this.sPause.querySelector('#pause-resume-btn').onclick = onResume;
    this.sPause.querySelector('#pause-restart-btn').onclick = onRestart;
    this.sPause.querySelector('#pause-menu-btn').onclick = onMenu;
  }

  // ===== 关于 =====
  showAbout() {
    this.toast('《月球快递员》M5 打磨版 · 月宫快递公司出品', 3200);
  }

  // ===== 关卡开场横幅 =====
  showIntro(level) {
    const el = this.elIntro;
    if (!el) return;
    el.innerHTML = `
      <div class="intro-name">${level.name}</div>
      <div class="intro-sub">${level.intro || ''}</div>`;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3000);
  }
}