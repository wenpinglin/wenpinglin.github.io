// ranking.js — 本地三榜：无尽模式 / 关卡分数 / 每日挑战（各前 10）
// daily.js 的种子随机也放这里（按日期生成固定伪随机序列）

// mulberry32 伪随机数生成器（每日挑战固定种子用）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dateSeed() {
  // YYYYMMDD → 整数种子
  return parseInt(todayStr().replace(/-/g, ''), 10);
}

export class Ranking {
  constructor(save, hud, audio) {
    this.save = save;
    this.hud = hud;
    this.audio = audio;
  }

  // 提交无尽模式成绩
  submitEndless(dist, dust, nick, charId) {
    const entry = { nick, char: charId, dist: Math.floor(dist), dust, date: todayStr() };
    const isTop = this.save.submitScore('endless', entry);
    if (dist > (this.save.data.bestRecords.endless || 0)) {
      this.save.data.bestRecords.endless = Math.floor(dist);
      this.save.flush();
    }
    return isTop;
  }

  // 提交关卡成绩
  submitLevel(levelId, dist, dust, nick, charId) {
    const entry = { nick, char: charId, dist: Math.floor(dist), dust, date: todayStr() };
    const isTop = this.save.submitScore('level', entry, levelId);
    const best = this.save.data.bestRecords.level;
    if (dist > (best[levelId] || 0)) { best[levelId] = Math.floor(dist); this.save.flush(); }
    return isTop;
  }

  // 提交每日挑战成绩
  submitDaily(dist, dust, nick, charId) {
    const entry = { nick, char: charId, dist: Math.floor(dist), dust, date: todayStr() };
    const isTop = this.save.submitScore('daily', entry);
    return isTop;
  }
}
