// achievements.js — 成就系统（M4：11 个）
export const ACHIEVEMENTS = [
  { id: 'first_step',   name: '一小步',       cond: '累计跳跃 100 次',             reward: '月尘×500（致敬阿姆斯特朗）', icon: '👣' },
  { id: 'all_hands',    name: '全员集合',     cond: '试玩全部 13 位角色',           reward: '称号"月宫全员"+月尘×600',   icon: '🐰' },
  { id: 'palace_owner', name: '广寒宫主',     cond: '首次跳过传说级坑',             reward: '金色名片框',               icon: '🏮' },
  { id: 'combo_master', name: '连击大师',     cond: '单局达成 x8 连击',             reward: '月尘×800',                 icon: '⚡' },
  { id: 'walker',       name: '月面漫步者',   cond: '累计奔跑 10km',               reward: '月尘×1000',                icon: '🚶' },
  { id: 'stormer',      name: '风暴征服者',   cond: '通关第 8 关',                 reward: '结算页"登月英雄"勋章',     icon: '🏆' },
  { id: 'encyclopedia', name: '百科全书',     cond: '任一册图鉴集齐',               reward: '月尘×1000/册',             icon: '📖' },
  { id: 'rain_or_shine',name: '风雨无阻',     cond: '连续 7 天完成每日挑战',        reward: '月尘×800+限定称号',        icon: '📅' },
  { id: 'daily_king',   name: '今日单王',     cond: '今日挑战榜登顶',               reward: '月尘×200',                 icon: '👑' },
  { id: 'pit_hundred',  name: '千坑万险',     cond: '累计跳过 100 个坑',            reward: '月尘×300',                 icon: '🕳️' },
  { id: 'endless_traveler', name: '无尽旅人', cond: '无尽模式跑到 2000m',           reward: '月尘×500',                 icon: '🚀' },
];

export class AchievementSystem {
  constructor(save, hud, audio) {
    this.save = save;
    this.hud = hud;
    this.audio = audio;
  }

  isUnlocked(id) { return this.save.achievementsList.includes(id); }

  unlock(id) {
    if (this.isUnlocked(id)) return false;
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def) return false;
    this.save.unlock(id);
    // 成就奖励：部分直接发尘
    const dustRewards = { first_step: 500, all_hands: 600, combo_master: 800, walker: 1000, rain_or_shine: 800, daily_king: 200, pit_hundred: 300, endless_traveler: 500 };
    if (dustRewards[id]) this.save.addMoonDust(dustRewards[id]);
    this.audio.achieve();
    this.hud.toast(`成就解锁：${def.icon} ${def.name}`, 2400);
    return true;
  }

  // 每次跳坑后调用
  onJump() {
    const s = this.save.stats;
    s.totalJumps = (s.totalJumps || 0) + 1;
    if (s.totalJumps >= 100) this.unlock('first_step');
    this.save.flushStats();
  }

  onPitCrossed(rarity, count) {
    const s = this.save.stats;
    s.totalPits = (s.totalPits || 0) + 1;
    if (rarity === 'legend') this.unlock('palace_owner');
    if (s.totalPits >= 100) this.unlock('pit_hundred');
    this.save.flushStats();
  }

  onCombo(combo) {
    if (combo >= 8) this.unlock('combo_master');
    const s = this.save.stats;
    if (combo > (s.bestCombo || 0)) { s.bestCombo = combo; this.save.flushStats(); }
  }

  onDistanceRun(dist) {
    const s = this.save.stats;
    s.totalDistance = (s.totalDistance || 0) + dist;
    if (s.totalDistance >= 10000) this.unlock('walker');
    this.save.flushStats();
  }

  onCharacterChange() {
    if (this.save.data.charactersPlayed.length >= 13) this.unlock('all_hands');
  }

  onLevelClear(levelId) {
    if (levelId === 8) this.unlock('stormer');
  }

  onCodexCollected(codexBookCounts) {
    // 任一册集齐
    for (const b of Object.values(codexBookCounts)) {
      if (b.collected >= b.total && b.total > 0) { this.unlock('encyclopedia'); break; }
    }
  }

  onDailyComplete(streak, isTop) {
    if (streak >= 7) this.unlock('rain_or_shine');
    if (isTop) this.unlock('daily_king');
  }

  onEndlessRun(dist) {
    if (dist >= 2000) this.unlock('endless_traveler');
  }
}
