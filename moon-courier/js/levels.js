// levels.js — 8 关全量数据 + 坑型规则（M4：L4-L8 新机制）
// 对齐需求文档 6.1：三条难度曲线（速度/密度/机制）

export const LEVELS = [
  {
    id: 1, name: '静海·新手之路', subtitle: '基础小跳教学',
    length: 500, speedMult: 0.85,
    intro: '欢迎入职月宫快递！点按空格小跳跨坑；留意迎面滚来的陨石——←→ 左右移动躲避！',
    pitPlan: { wide: 0, twin: 0, rolling: 0, bounce: 0, collapse: 0, abyss: 0 },
    gapRange: [14, 20], dustThreshold: 500,
    pitWidthScale: 0.85, toleranceBonus: 0.2,   // M5.1 新手关：坑更窄、判定更宽容
    hazard: { interval: [26, 34], speed: [8, 10] },   // M5.2 迎面陨石：稀疏慢速教学
    oxygen: false, meteor: false, eclipse: false,
  },
  {
    id: 2, name: '丰富海·初试身手', subtitle: '新机制：宽幅月海（蓄力跳）',
    length: 800, speedMult: 1.1,
    intro: '宽坑来了！按住空格蓄力再松开，跳得更远。',
    pitPlan: { wide: 0.28, twin: 0, rolling: 0, bounce: 0, collapse: 0, abyss: 0 },
    gapRange: [7, 12], dustThreshold: 1200,
    hazard: { interval: [18, 26], speed: [9, 11] },
    oxygen: false, meteor: false, eclipse: false,
  },
  {
    id: 3, name: '澄海·丘陵回廊', subtitle: '新机制：双子坑（连跳节奏）',
    length: 1200, speedMult: 1.2,
    intro: '双子坑！两个坑中间只有窄脊——连续两次精准小跳，忌蓄力过猛。',
    pitPlan: { wide: 0.18, twin: 0.25, rolling: 0, bounce: 0, collapse: 0, abyss: 0 },
    gapRange: [6, 11], dustThreshold: 1800,
    hazard: { interval: [15, 22], speed: [9, 12] },
    oxygen: false, meteor: false, eclipse: false,
  },
  {
    id: 4, name: '雨海·陨石峡谷', subtitle: '新机制：滚石坑 + 陨石雨预警',
    length: 1600, speedMult: 1.35,
    intro: '滚石坑：陨石周期弹起挡住跳跃窗口——看准节奏再跳。小心天上的陨石雨！',
    pitPlan: { wide: 0.15, twin: 0.12, rolling: 0.25, bounce: 0, collapse: 0, abyss: 0 },
    gapRange: [6, 10], dustThreshold: 2400,
    hazard: { interval: [13, 19], speed: [10, 13] },
    oxygen: false, meteor: true, eclipse: false,
  },
  {
    id: 5, name: '危海·深渊边缘', subtitle: '新机制：弹力坑（机遇与风险）',
    length: 2000, speedMult: 1.5,
    intro: '弹力坑：坑沿弹射区会把你弹上天——借力二连跳，或被弹出赛道。',
    pitPlan: { wide: 0.12, twin: 0.12, rolling: 0.15, bounce: 0.22, collapse: 0, abyss: 0 },
    gapRange: [6, 10], dustThreshold: 3000,
    hazard: { interval: [11, 17], speed: [10, 13] },
    oxygen: false, meteor: true, eclipse: false,
  },
  {
    id: 6, name: '云海·月夜迷航', subtitle: '新机制：塌陷坑 + 月食低能见度',
    length: 2400, speedMult: 1.6,
    intro: '塌陷坑：坑沿跑过后塌陷，起跳点只有一次机会。月食将至，盯紧坑沿光环。',
    pitPlan: { wide: 0.12, twin: 0.10, rolling: 0.10, bounce: 0.10, collapse: 0.22, abyss: 0 },
    gapRange: [5, 10], dustThreshold: 3600,
    hazard: { interval: [10, 15], speed: [11, 14] },
    oxygen: false, meteor: true, eclipse: true,
  },
  {
    id: 7, name: '冷海·极地远征', subtitle: '新机制：深渊坑 + 氧气管理',
    length: 2800, speedMult: 1.75,
    intro: '深渊坑：坑口引力异常，靠近会被下坠力拉扯。注意氧气——驿站可补充。',
    pitPlan: { wide: 0.12, twin: 0.10, rolling: 0.10, bounce: 0.10, collapse: 0.10, abyss: 0.22 },
    gapRange: [5, 9], dustThreshold: 4200,
    hazard: { interval: [9, 14], speed: [11, 14] },
    oxygen: true, meteor: true, eclipse: false,
  },
  {
    id: 8, name: '风暴洋·终极奔月', subtitle: '终章：全要素混合',
    length: 3600, speedMult: 1.9,
    intro: '风暴洋——月球最大的"海"。六种坑型全部登场，广寒站就在前面！',
    pitPlan: { wide: 0.15, twin: 0.15, rolling: 0.15, bounce: 0.12, collapse: 0.12, abyss: 0.12 },
    gapRange: [5, 9], dustThreshold: 5000,
    hazard: { interval: [8, 12], speed: [12, 15] },
    oxygen: true, meteor: true, eclipse: true,
  },
];

export function getLevel(id) { return LEVELS.find(l => l.id === id) || LEVELS[0]; }

export const POST_INTERVAL = 400;

// ============ 无尽模式规则 ============
export const ENDLESS = {
  name: '无尽模式·风暴洋巡游',
  intro: '没有终点的派送路线——坑型随距离越来越野，看看你能跑多远。',
  length: Infinity,
  speedAt(dist) {
    const mult = 1.0 + Math.floor(dist / 500) * 0.07;
    return Math.min(1.9, mult);
  },
  // 坑型权重随距离阶段变化
  pitPlanAt(dist) {
    if (dist < 500)  return { wide: 0.22, twin: 0, rolling: 0, bounce: 0, collapse: 0, abyss: 0 };
    if (dist < 1500) return { wide: 0.16, twin: 0.14, rolling: 0.14, bounce: 0, collapse: 0, abyss: 0 };
    if (dist < 3000) return { wide: 0.14, twin: 0.12, rolling: 0.10, bounce: 0.12, collapse: 0.10, abyss: 0 };
    return { wide: 0.13, twin: 0.12, rolling: 0.10, bounce: 0.10, collapse: 0.10, abyss: 0.12 };
  },
  gapRange: [6, 11],
  oxygen: false, meteor: true, eclipse: true,
};

// ============ 每日挑战（日期种子） ============
export const DAILY = {
  name: '今日特快',
  timeLimit: 120,   // 秒
};
