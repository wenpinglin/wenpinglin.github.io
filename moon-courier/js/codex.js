// codex.js — 月球坑名库 + 稀有度分配 + 全息百科卡弹出 UI
//
// 坑名全部取自真实月球地理（月海/环形山/IAU 中国地名），
// 科普文案基于公开探月史实，正式发布前按需求文档要求统一核验。
// 稀有度四级：common 普通 / rare 稀有 / epic 史诗 / legend 传说

export const RARITY_INFO = {
  common: { label: '普通', color: '#8a99b3', bg: 'rgba(138,153,179,0.18)', border: 'rgba(138,153,179,0.5)', dust: 10 },
  rare:   { label: '稀有', color: '#5aa8ff', bg: 'rgba(90,168,255,0.16)', border: 'rgba(90,168,255,0.55)', dust: 15 },
  epic:   { label: '史诗', color: '#b07aff', bg: 'rgba(176,122,255,0.16)', border: 'rgba(176,122,255,0.55)', dust: 25 },
  legend: { label: '传说', color: '#ffd76a', bg: 'rgba(255,215,106,0.15)', border: 'rgba(255,215,106,0.6)', dust: 50 },
};

// 月球坑名库（正式版将扩充至 40+，此为首批核验过的核心库）
// book: sea 月海册 / crater 环形山册 / china 中国地名册（编号坑入 numbered 册）
const NAMED_PITS = [
  // === 稀有：著名环形山 ===
  { name: '第谷环形山', rarity: 'rare', book: 'crater', text: '月面最"闪"的撞击坑——满月时肉眼可见，向四周撒出长达一千多公里的辐射纹，像一枚银色勋章。' },
  { name: '哥白尼环形山', rarity: 'rare', book: 'crater', text: '直径约 93 公里的经典大坑，是望远镜时代月面观测的教科书目标。' },
  { name: '开普勒环形山', rarity: 'rare', book: 'crater', text: '以"行星运动三定律"的发现者命名，月面上一座年轻的亮辐射坑。' },
  // === 史诗：月海 ===
  { name: '静海', rarity: 'epic', book: 'sea', text: '1969 年 7 月，阿波罗 11 号在这里着陆——"个人的一小步，人类的一大步"，就踩在静海之上。' },
  { name: '危海', rarity: 'epic', book: 'sea', text: '直径约 600 公里的圆形月海，轮廓规整得像圆规画的——古人叫它"危"，其实稳得很。' },
  { name: '澄海', rarity: 'epic', book: 'sea', text: '阿波罗计划的谢幕舞台——阿波罗 17 号在这一区域着陆，是迄今最后一次载人登月。' },
  { name: '丰富海', rarity: 'epic', book: 'sea', text: '名字来自 17 世纪天文学家的乐观想象——其实它和"丰富"没什么关系，但月球背光面难得的开阔地。' },
  { name: '雨海', rarity: 'epic', book: 'sea', text: '直径约 1145 公里的巨大盆地，月球上最大的撞击盆地之一，古老得能看见月壳的伤疤。' },
  { name: '云海', rarity: 'epic', book: 'sea', text: '南部高地间一片暗色平原——古人觉得它像一朵云，其实是一片凝固的熔岩海。' },
  { name: '酒海', rarity: 'epic', book: 'sea', text: '一片被环形山环绕的小月海——名字很醉人，地形其实很硬核。' },
  { name: '冷海', rarity: 'epic', book: 'sea', text: '月球北极附近的寒冷平原，未来的月球基地选址热门——永久阴影区里可能藏着水冰。' },
  // === 传说：中国地名 / 之最 ===
  { name: '广寒宫', rarity: 'legend', book: 'china', text: '嫦娥三号着陆点附近的正式地名，2015 年获国际天文学联合会批准——中国神话，从此住进了月球地图。' },
  { name: '风暴洋', rarity: 'legend', book: 'sea', text: '月球最大的"海"，面积约 400 万平方公里，却没有一滴水——"海"只是古代天文学家望文生义的浪漫误会。' },
  { name: '紫微垣', rarity: 'legend', book: 'china', text: '月球背面的三大盆地之一（另两座为天市垣、太微垣），以中国古代星官命名——月球背面，住着中国星图。' },
  { name: '天市垣', rarity: 'legend', book: 'china', text: '月背三大盆地之一，"天上的街市"——古人为它取了一个烟火气的名字。' },
  { name: '太微垣', rarity: 'legend', book: 'china', text: '月背三大盆地之一，古人眼中"天庭的官署"——如今是中国深空探测的坐标之一。' },
];

// 图鉴四册定义
export const BOOKS = [
  { id: 'sea', name: '月海册', desc: '月球上的"暗色平原"——古人以为是海，其实是凝固的熔岩。' },
  { id: 'crater', name: '环形山册', desc: '月面撞击坑中的名门望族——望远镜时代的明星。' },
  { id: 'china', name: '中国地名册', desc: 'IAU 正式命名的中国地名——神话与星图住进月球。' },
  { id: 'numbered', name: '编号坑册', desc: '散落月面的小环形坑——每一座都有月海的姓氏。' },
];

// 普通编号坑用的月海姓氏池
const SURNAME_POOL = ['静海', '澄海', '危海', '雨海', '云海', '酒海', '丰富海', '冷海'];

// 稀有度抽取权重：普通 72% / 稀有 15% / 史诗 10% / 传说 3%
const WEIGHTS = { common: 72, rare: 15, epic: 10, legend: 3 };

export class Codex {
  constructor(save) {
    this.save = save;               // SaveManager（M3：图鉴持久化）
    this.collected = new Set(save ? save.codexList : []);
    this.container = null;
    this.usedSeq = new Set();
    this._initDOM();
  }

  _initDOM() {
    this.container = document.createElement('div');
    this.container.id = 'codex-layer';
    document.body.appendChild(this.container);
  }

  // 按权重抽取稀有度
  rollRarity() {
    const total = WEIGHTS.common + WEIGHTS.rare + WEIGHTS.epic + WEIGHTS.legend;
    let r = Math.random() * total;
    for (const key of ['legend', 'epic', 'rare', 'common']) {
      if (r < WEIGHTS[key]) return key;
      r -= WEIGHTS[key];
    }
    return 'common';
  }

  // 生成一个坑名条目 { name, rarity, text, fresh }
  // fresh: 是否首次遇到（控制完整卡 vs 简版角标）
  nextEntry() {
    const rarity = this.rollRarity();
    if (rarity === 'common') {
      // 编号坑：月海姓氏 + 随机序号
      const surname = SURNAME_POOL[Math.floor(Math.random() * SURNAME_POOL.length)];
      // 池子只有 8×99 = 792 个；长局（无尽模式）累计上千个普通坑后若不清理，
      // 下面的 do...while 会死循环把页面卡死 —— 用尽前重置 + 兜底重试上限
      if (this.usedSeq.size >= 700) this.usedSeq.clear();
      let seq, guard = 0;
      do {
        seq = 1 + Math.floor(Math.random() * 99);
        guard++;
      } while (this.usedSeq.has(surname + '-' + seq) && guard < 60);
      this.usedSeq.add(surname + '-' + seq);
      const name = `${surname}-${seq} 号坑`;
      const fresh = !this.collected.has(name);
      return { name, rarity, text: `${surname}上一座不起眼的小环形坑。它最大的骄傲，是拥有一整片${surname}的姓氏。`, fresh };
    }
    // 具名坑：从库中随机取该稀有度的一个
    const pool = NAMED_PITS.filter(p => p.rarity === rarity);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const fresh = !this.collected.has(pick.name);
    return { name: pick.name, rarity, text: pick.text, fresh };
  }

  // 跳过坑成功后调用：收录（持久化）+ 弹出百科卡
  collect(entry, { perfect = false } = {}) {
    const isNew = !this.collected.has(entry.name);
    this.collected.add(entry.name);
    if (isNew && this.save) this.save.addCodex(entry.name);
    this.showCard(entry, { perfect, fresh: isNew || entry.fresh });
    return isNew;
  }

  // 全息百科卡弹出（新坑完整卡 / 老坑简版角标）
  showCard(entry, { perfect = false, fresh = true } = {}) {
    const info = RARITY_INFO[entry.rarity];
    if (!fresh) {
      // 简版：仅右上角小角标，不打扰
      this._showBadge(entry, info, perfect);
      return;
    }
    const card = document.createElement('div');
    card.className = 'codex-card' + (perfect ? ' perfect' : '');
    card.style.setProperty('--rc', info.color);
    card.style.setProperty('--rc-bg', info.bg);
    card.style.setProperty('--rc-border', info.border);
    card.innerHTML = `
      <div class="codex-rarity" style="color:${info.color};background:${info.bg};border:1px solid ${info.border}">${info.label}</div>
      <div class="codex-name">${entry.name}</div>
      <div class="codex-text">${entry.text}</div>
      <div class="codex-dust">+${info.dust} 月尘${perfect ? ' · 完美!' : ''}</div>
    `;
    this.container.appendChild(card);
    // 入场动画由 CSS 处理；1.8s 后移除
    setTimeout(() => { card.classList.add('out'); }, 1500);
    setTimeout(() => { card.remove(); }, 2100);
    // 同屏最多保留 2 张
    const cards = this.container.querySelectorAll('.codex-card');
    if (cards.length > 2) cards[0].remove();
  }

  _showBadge(entry, info, perfect) {
    const badge = document.createElement('div');
    badge.className = 'codex-badge' + (perfect ? ' perfect' : '');
    badge.style.setProperty('--rc', info.color);
    badge.textContent = `${entry.name}${perfect ? ' · 完美' : ''}`;
    this.container.appendChild(badge);
    setTimeout(() => badge.classList.add('out'), 1200);
    setTimeout(() => badge.remove(), 1600);
    const badges = this.container.querySelectorAll('.codex-badge');
    if (badges.length > 2) badges[0].remove();
  }

  get collectedCount() { return this.collected.size; }

  // 图鉴四册收集统计（成就"百科全书"用）
  bookCounts() {
    const counts = {};
    for (const b of BOOKS) {
      if (b.id === 'numbered') {
        const n = [...this.collected].filter(name => /号坑$/.test(name)).length;
        counts[b.id] = { collected: n, total: 0, open: true };
      } else {
        const pool = NAMED_PITS.filter(p => p.book === b.id);
        const got = pool.filter(p => this.collected.has(p.name)).length;
        counts[b.id] = { collected: got, total: pool.length, open: false };
      }
    }
    return counts;
  }

  // 某册内全部词条（图鉴页展示）
  bookEntries(bookId) {
    if (bookId === 'numbered') {
      return [...this.collected].filter(name => /号坑$/.test(name)).map(name => ({ name, rarity: 'common', text: `${name}——月海上一座不起眼的小环形坑。` }));
    }
    return NAMED_PITS.filter(p => p.book === bookId).map(p => ({ ...p, got: this.collected.has(p.name) }));
  }

  reset() {
    // 重开不清空图鉴（收集是长线内容），仅清理屏幕上的卡片
    this.container.innerHTML = '';
  }
}
