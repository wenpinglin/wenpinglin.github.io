// config.js — 游戏参数（M1 手感定案基线 + M4 新系统参数）
export const Config = {
  // === 物理（批次二·A 方案：收紧手感，滞空回归需求文档 3.3 的 1.2~1.5s）===
  // 小跳滞空 2×5.1/8.5 = 1.20s；满蓄力 2×6.35/8.5 ≈ 1.49s（两者都落在文档区间内）
  // 跳跃高度 小跳 ≈1.53m / 满蓄力 ≈2.37m，保留"又高又长"的月球弧线
  gravity: 8.5,
  runSpeed: 5.5,
  jumpVelMin: 5.1,
  jumpVelMax: 6.35,
  chargeTime: 0.45,
  airControl: 3.8,
  groundY: 0,

  // === 坑 ===
  // 坑宽 = pitWidth × 关卡速度系数（level.speedMult）× 坑型系数，
  // 使"跑得越快、坑越宽"，射程/坑宽比恒定 → 蓄力与小跳的选择真正有意义
  pitWidth: 4.4,
  pitDepth: 2.5,
  pitTolerance: 0.55,
  pitWideScale: 1.40,   // 宽幅月海宽度系数（≈小跳射程极限，必须蓄力才稳）

  // === 角色参数 ===
  playerScale: 1.0,

  // === 渲染 ===
  fov: 62,
  drawDistance: 220,
  cameraHeight: 4.2,
  cameraBack: 7.5,
  cameraLookAhead: 9,

  // === M5.2：横移躲避（地面/空中速度 + 跑道边界） ===
  lateralGround: 6.2,      // 地面横移速度 m/s
  lateralAir: 4.2,         // 空中横移速度 m/s
  lateralMax: 8.5,         // 横移边界（跑道 ±12 内留余量）

  // === M5.2：迎面陨石（hazard）默认参数（关卡可用 level.hazard 覆盖） ===
  hazardInterval: [12, 22], // 生成间隔秒
  hazardSpeed: [9, 13],     // 滚动速度 m/s（迎面）
  hazardSpawnZ: 55,         // 出生距离（玩家前方 m）
  hazardHitPad: 0.35,       // 撞击判定横向附加宽容

  // === M2：判定与连击 ===
  // Perfect：预测落点落在"坑后沿 ±20% 坑宽"带内（需求文档 5.2）
  perfectRatio: 0.2,
  comboBreakOnNonPerfect: true,
  comboMult: [ {n: 8, m: 4}, {n: 5, m: 3}, {n: 3, m: 2} ],
  trailAtCombo: 3,

  // === M2：月尘经济 ===
  dustBase: { common: 10, rare: 15, epic: 25, legend: 50 },
  dustPerfect: 20,

  // === M4：星屑 ===
  shardDust: 5,            // 每颗星屑月尘
  shardCollectR: 1.2,      // 收集判定半径 m
  shardsPerPit: [2, 3],    // 每坑散布星屑数范围

  // === M4：新坑型机制 ===
  rollingCycle: 2.6,       // 滚石坑：弹起周期 s
  rollingDangerWindow: 0.42, // 滚石危险相位窗口（0-1，滚石在空中时跨坑即死）
  bounceKick: 5.2,          // 弹力坑：踩到弹射区自动弹起初速
  abyssPull: 2.6,          // 深渊坑：坑口引力异常附加下坠加速度
  collapseShrink: 1.25,    // 塌陷坑：跨过后坑沿塌陷视觉扩比

  // === M4：氧气（关7+）===
  oxygenMax: 100,
  oxygenPerMeter: 0.12,    // 每米消耗
  oxygenRefillPost: true,   // 驿站复活回满

  // === M4：陨石雨（关4+）===
  meteorInterval: [22, 36], // 事件间隔秒
  meteorWarnTime: 3.0,      // 预警时间 s
  meteorRadius: 1.3,        // 落点致死半径

  // === M4：无尽模式 ===
  endlessSpeedStart: 1.0,
  endlessSpeedPer500m: 0.07,
  endlessSpeedMax: 1.9,

  // === M4：每日挑战 ===
  dailyTimeLimit: 120,      // 限时秒

  // === M4：中秋限定（农历八月十五前后；含调参预览开关）===
  midAutumnWindow: ['09-22', '10-02'],  // 2026 硬编码窗口（每年更新）
  midAutumnPreview: false,  // 调参面板可开启预览
  mooncakeDust: 50,

  // === M4：商店价格（对齐需求文档 7.1 装备表）===
  prices: {
    shield: 300,       // 月壤护盾（个）
    magnet: 500,       // 磁力手套（永久）
    boots: 800,        // 跳跃强化鞋（永久）
    mask: 600,         // 氧气面罩（永久）
    tank: 200,         // 氧气瓶（个）
  },

  // === 调试 ===
  showHitbox: false,
};
