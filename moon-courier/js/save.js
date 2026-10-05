// save.js — localStorage 存档系统（M4 扩展：统计/背包/成就/三榜/每日）
const SAVE_KEY = 'moon_courier_save_v1';
const SAVE_VERSION = 2;

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    nickname: null,
    character: 'rabbit',
    charactersPlayed: [],
    moonDust: 0,
    unlockedLevel: 1,
    levelStars: {},
    postReached: {},
    levelDust: {},
    codex: [],
    achievements: [],
    bestRecords: { endless: 0, level: {} },
    settings: { sfx: true, cardShow: 'full' },
    // === M4 新增 ===
    stats: { totalJumps: 0, totalDistance: 0, totalPits: 0, dailyStreak: 0, lastDailyDate: null, bestCombo: 0 },
    inventory: { shield: 0, tank: 0 },      // 消耗品数量
    owned: { magnet: false, boots: false, mask: false },  // 永久道具
    rankings: { endless: [], level: {}, daily: [] },       // 三榜
    daily: { date: null, dist: 0, done: false },           // 每日挑战
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('存档读取失败，使用新档', e);
    return defaultSave();
  }
}

function migrate(data) {
  const save = defaultSave();
  if (typeof data !== 'object' || !data) return save;
  save.nickname = data.nickname ?? null;
  save.character = data.character ?? 'rabbit';
  save.charactersPlayed = Array.isArray(data.charactersPlayed) ? data.charactersPlayed : [];
  save.moonDust = Number(data.moonDust) || 0;
  save.unlockedLevel = Number(data.unlockedLevel) || 1;
  save.levelStars = data.levelStars && typeof data.levelStars === 'object' ? data.levelStars : {};
  save.postReached = data.postReached && typeof data.postReached === 'object' ? data.postReached : {};
  save.levelDust = data.levelDust && typeof data.levelDust === 'object' ? data.levelDust : {};
  save.codex = Array.isArray(data.codex) ? data.codex : [];
  save.achievements = Array.isArray(data.achievements) ? data.achievements : [];
  save.bestRecords = data.bestRecords && typeof data.bestRecords === 'object'
    ? { endless: Number(data.bestRecords.endless) || 0, level: data.bestRecords.level || {} }
    : { endless: 0, level: {} };
  save.settings = data.settings && typeof data.settings === 'object'
    ? { sfx: data.settings.sfx !== false, cardShow: data.settings.cardShow || 'full' }
    : save.settings;
  // M4 字段（V1 档迁移补全）
  if (data.stats && typeof data.stats === 'object') {
    save.stats = { ...save.stats, ...data.stats };
  }
  if (data.inventory) save.inventory = { ...save.inventory, ...data.inventory };
  if (data.owned) save.owned = { ...save.owned, ...data.owned };
  if (data.rankings) save.rankings = { ...save.rankings, ...data.rankings };
  if (data.daily) save.daily = { ...save.daily, ...data.daily };
  save.version = SAVE_VERSION;
  return save;
}

export function persist(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); return true; }
  catch (e) { console.warn('存档写入失败', e); return false; }
}

export function exportCode(save) { return btoa(unescape(encodeURIComponent(JSON.stringify(save)))); }
export function importCode(code) {
  try { return migrate(JSON.parse(decodeURIComponent(escape(atob(code.trim()))))); }
  catch (e) { return null; }
}

export class SaveManager {
  constructor() { this.data = loadSave(); }
  get isNewPlayer() { return this.data.nickname === null; }

  setNickname(n) { this.data.nickname = n; this.flush(); }
  setCharacter(c) {
    this.data.character = c;
    if (!this.data.charactersPlayed.includes(c)) this.data.charactersPlayed.push(c);
    this.flush();
  }
  get stars() { return this.data.levelStars; }
  setStars(levelId, stars) {
    const cur = this.data.levelStars[levelId] || 0;
    this.data.levelStars[levelId] = Math.max(cur, stars);
    this.flush();
  }
  unlockLevel(id) { if (id > this.data.unlockedLevel) { this.data.unlockedLevel = id; this.flush(); } }
  isLevelUnlocked(id) { return id <= this.data.unlockedLevel; }

  get moonDust() { return this.data.moonDust; }
  addMoonDust(n) { this.data.moonDust += Math.floor(n); this.flush(); }
  spendMoonDust(n) {
    if (this.data.moonDust < n) return false;
    this.data.moonDust -= n; this.flush(); return true;
  }

  setPostReached(levelId, z) {
    const cur = this.data.postReached[levelId] || 0;
    if (z > cur) { this.data.postReached[levelId] = z; this.flush(); }
  }
  getPostReached(levelId) { return this.data.postReached[levelId] || 0; }
  clearPostReached(levelId) { delete this.data.postReached[levelId]; delete this.data.levelDust[levelId]; this.flush(); }
  setLevelDust(levelId, n) { this.data.levelDust[levelId] = n; this.flush(); }
  getLevelDust(levelId) { return this.data.levelDust[levelId] || 0; }

  addCodex(name) { if (!this.data.codex.includes(name)) { this.data.codex.push(name); this.flush(); } }
  hasCodex(name) { return this.data.codex.includes(name); }
  get codexList() { return this.data.codex; }

  unlock(a) {
    if (!this.data.achievements.includes(a)) { this.data.achievements.push(a); this.flush(); return true; }
    return false;
  }
  get achievementsList() { return this.data.achievements; }

  setSetting(k, v) { this.data.settings[k] = v; this.flush(); }

  // ===== M4：统计 =====
  addStat(k, n) { this.data.stats[k] = (this.data.stats[k] || 0) + n; }
  // 统计写入节流：对局中每帧都会累加统计，若每帧都序列化整个存档写 localStorage，
  // 就是每秒约 60 次写盘 → 周期性卡顿。这里最多每 3 秒落盘一次；关键节点用 flushNow() 强制落盘。
  flushStats() {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (!this._lastStatFlush || now - this._lastStatFlush >= 3000 || now < this._lastStatFlush) {
      this._lastStatFlush = now;
      this.flush();
    }
  }
  // 立即落盘（死亡 / 通关 / 复活 / 回菜单等关键节点）
  flushNow() {
    this._lastStatFlush = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    this.flush();
  }
  get stats() { return this.data.stats; }

  // ===== M4：商店 =====
  get inventory() { return this.data.inventory; }
  get owned() { return this.data.owned; }
  addItem(id, n = 1) { this.data.inventory[id] = (this.data.inventory[id] || 0) + n; this.flush(); }
  useItem(id) { if ((this.data.inventory[id] || 0) > 0) { this.data.inventory[id]--; this.flush(); return true; } return false; }
  buyPermanent(id) { this.data.owned[id] = true; this.flush(); }

  // ===== M4：排行榜 =====
  submitScore(board, entry, levelId = null) {
    const b = levelId ? (this.data.rankings[board][levelId] = this.data.rankings[board][levelId] || []) : this.data.rankings[board];
    b.push(entry);
    b.sort((x, y) => y.dist - x.dist);
    if (b.length > 10) b.length = 10;
    this.flush();
    // 返回是否破纪录（榜首）
    return b[0] === entry;
  }
  getRanking(board, levelId = null) {
    return levelId ? (this.data.rankings[board][levelId] || []) : this.data.rankings[board];
  }

  // ===== M4：每日挑战 =====
  get daily() { return this.data.daily; }
  // 每日完成：连续天数 +1（断签清零），并记录最远距离
  completeDaily(date, dist) {
    const d = this.data.daily;
    if (d.date !== date) {
      const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      d.streak = (d.lastDoneDate === y) ? (d.streak || 0) + 1 : 1;
      d.lastDoneDate = date;
      d.date = date;
    }
    d.dist = Math.max(d.dist || 0, dist);
    d.done = true;
    this.flush();
    return d.streak || 1;
  }

  flush() { persist(this.data); }

  // ===== M5-3：存档备份 / 恢复（跨设备迁移）=====
  backupCode() { return exportCode(this.data); }
  restoreCode(code) {
    const d = importCode(code);
    if (!d) return false;
    this.data = d;
    return persist(this.data);
  }
}
