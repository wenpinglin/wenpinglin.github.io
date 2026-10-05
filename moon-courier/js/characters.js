// characters.js — 13 位快递员：数据（名称/性格/轻特性/专属吐槽）+ 建模工厂
// 建模策略：共用基础骨架（身体/头/腿/背包/天线），按角色替换标志性部件

export const CHARACTERS = [
  { id: 'rabbit',  name: '奔月兔', tagline: '月宫元老，跳跃教科书', perk: { type: 'jump', value: 1.03 }, perkText: '滞空 +3%', quote: '"月宫就在前面，我先走一步！"', default: true },
  { id: 'mouse',   name: '机灵鼠', tagline: '体型最小，钻空子专家', perk: { type: 'dust', value: 1.05 }, perkText: '月尘 +5%', quote: '"这坑对我来说，是峡谷。"' },
  { id: 'ox',      name: '稳场牛', tagline: '老师傅，稳字当头', perk: { type: 'tolerance', value: 0.15 }, perkText: '坑沿宽容 +0.15m', quote: '"不急，稳住，下次一定。"' },
  { id: 'tiger',   name: '闯山虎', tagline: '全员气势担当', perk: null, perkText: '起跳音效加倍霸气', quote: '"下次我一掌拍平它！"' },
  { id: 'dragon',  name: '应龙', tagline: '连击时金光化龙纹', perk: null, perkText: '连击特效升级', quote: '"区区小坑，也想困住龙？"' },
  { id: 'snake',   name: '灵蛇', tagline: '走位风骚，S 形跑动', perk: { type: 'air', value: 1.1 }, perkText: '空中微调 +10%', quote: '"绕不过去？那就跳过去。"' },
  { id: 'horse',   name: '追风马', tagline: '全速前进，永不停蹄', perk: { type: 'air', value: 1.3 }, perkText: '空中微调 +30%', quote: '"再宽的坑也拦不住马！"' },
  { id: 'sheep',   name: '云朵羊', tagline: '毛茸茸治愈系', perk: null, perkText: '落地月尘更蓬松', quote: '"咩——摔得不算疼。"' },
  { id: 'monkey',  name: '机灵猴', tagline: '空中杂技演员', perk: null, perkText: '空中翻跟头', quote: '"下次我表演个三连翻！"' },
  { id: 'rooster', name: '报晓鸡', tagline: '司晨官，仪式感担当', perk: null, perkText: '每日首局打鸣', quote: '"喔——今天不吉利！"' },
  { id: 'dog',     name: '忠犬', tagline: '最可靠的搭档', perk: null, perkText: '复活自带坚定表情', quote: '"汪！这个坑我记住了！"' },
  { id: 'pig',     name: '福袋猪', tagline: '圆滚滚，弹性十足', perk: { type: 'dust', value: 1.05 }, perkText: '月尘 +5%', quote: '"吃饱了才有力气跳。"' },
  { id: 'duck',    name: '小黄鸭', tagline: '特邀嘉宾 · 编外员工', perk: null, perkText: '死亡专属嘎吱音（纯快乐）', quote: '"嘎？（翻译：我只是一只鸭子。）"' },
];

export function getCharacter(id) {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}

// ============ 建模工厂 ============
import * as THREE from 'three';

const MAT = {
  white:  () => new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.7 }),
  cream:  () => new THREE.MeshStandardMaterial({ color: 0xf2e8d5, roughness: 0.8 }),
  gray:   () => new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.7 }),
  brown:  () => new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.7 }),
  darkbrown: () => new THREE.MeshStandardMaterial({ color: 0x6e4a2a, roughness: 0.7 }),
  orange: () => new THREE.MeshStandardMaterial({ color: 0xe8862a, roughness: 0.6 }),
  yellow: () => new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.55 }),
  pink:   () => new THREE.MeshStandardMaterial({ color: 0xf2a7b3, roughness: 0.7 }),
  green:  () => new THREE.MeshStandardMaterial({ color: 0x7ab55c, roughness: 0.6 }),
  red:    () => new THREE.MeshStandardMaterial({ color: 0xd94f3d, roughness: 0.6 }),
  gold:   () => new THREE.MeshStandardMaterial({ color: 0xffd76a, roughness: 0.35 }),
  dark:   () => new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.5 }),
  pack:   () => new THREE.MeshStandardMaterial({ color: 0xff7a3d, roughness: 0.6 }),
};

// 构建角色：返回 { group, refs } refs 含动画引用部件
export function buildCharacter(id) {
  const g = new THREE.Group();
  const refs = {};

  const bodyMat = BODY_MAT[id] ? MAT[BODY_MAT[id]]() : MAT.white();
  const accentMat = ACCENT_MAT[id] ? MAT[ACCENT_MAT[id]]() : MAT.white();

  // === 基础骨架（共用）===
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), bodyMat);
  body.position.y = 0.55; body.castShadow = true;
  g.add(body); refs.body = body;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), bodyMat);
  head.position.set(0, 1.05, 0.1); head.castShadow = true;
  g.add(head); refs.head = head;

  const eyeGeo = new THREE.SphereGeometry(0.045, 8, 8);
  refs.eyeL = new THREE.Mesh(eyeGeo, MAT.dark()); refs.eyeL.position.set(-0.1, 1.08, 0.32);
  refs.eyeR = new THREE.Mesh(eyeGeo, MAT.dark()); refs.eyeR.position.set(0.1, 1.08, 0.32);
  g.add(refs.eyeL, refs.eyeR);

  const legGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.35, 8);
  refs.legL = new THREE.Mesh(legGeo, bodyMat); refs.legL.position.set(-0.18, 0.18, 0); refs.legL.castShadow = true;
  refs.legR = new THREE.Mesh(legGeo, bodyMat); refs.legR.position.set(0.18, 0.18, 0); refs.legR.castShadow = true;
  g.add(refs.legL, refs.legR);

  // 快递背包（全员统一工装）
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.25), MAT.pack());
  pack.position.set(0, 0.65, -0.35); pack.castShadow = true;
  g.add(pack);

  // 头顶天线（全员标配）
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.3, 6), MAT.gold());
  ant.position.set(0.18, 1.55, -0.08);
  g.add(ant);
  refs.antBall = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), MAT.gold());
  refs.antBall.position.set(0.18, 1.72, -0.08);
  g.add(refs.antBall);

  // 蛇：隐藏双腿（S 形身体演出）
  if (id === 'snake') {
    refs.legL.visible = false; refs.legR.visible = false;
    // 蛇身：细长椭球拖后
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), bodyMat);
    tail.scale.set(1, 0.55, 2.4); tail.position.set(0, 0.35, -0.55);
    g.add(tail); refs.tail = tail;
  } else if (id === 'duck') {
    // 鸭：短腿（保持可见但短小）
  }

  // === 差异部件 ===
  const ears = buildEars(id, bodyMat, accentMat, refs);
  if (ears) g.add(...ears);
  const extras = buildExtras(id, accentMat, refs);
  if (extras) g.add(...extras);

  return { group: g, refs };
}

// 各角色主体/点缀配色
const BODY_MAT = {
  rabbit: 'white', mouse: 'gray', ox: 'brown', tiger: 'orange', dragon: 'green',
  snake: 'green', horse: 'darkbrown', sheep: 'cream', monkey: 'brown',
  rooster: 'white', dog: 'brown', pig: 'pink', duck: 'yellow',
};
const ACCENT_MAT = {
  rabbit: 'cream', mouse: 'pink', ox: 'cream', tiger: 'dark', dragon: 'gold',
  snake: 'yellow', horse: 'orange', sheep: 'gray', monkey: 'cream',
  rooster: 'red', dog: 'cream', pig: 'pink', duck: 'orange',
};

// 耳朵/角/冠等头部特征（返回部件数组）
function buildEars(id, bodyMat, accentMat, refs) {
  const parts = [];
  switch (id) {
    case 'rabbit': {
      const geo = new THREE.CylinderGeometry(0.05, 0.07, 0.55, 8);
      refs.earL = new THREE.Mesh(geo, bodyMat); refs.earL.position.set(-0.13, 1.5, 0.05); refs.earL.castShadow = true;
      refs.earR = new THREE.Mesh(geo, bodyMat); refs.earR.position.set(0.13, 1.5, 0.05); refs.earR.castShadow = true;
      parts.push(refs.earL, refs.earR);
      break;
    }
    case 'mouse': case 'monkey': {
      // 大圆耳
      const geo = new THREE.SphereGeometry(0.13, 10, 8);
      const m = id === 'mouse' ? accentMat : bodyMat;
      refs.earL = new THREE.Mesh(geo, m); refs.earL.scale.set(1, 1, 0.4); refs.earL.position.set(-0.28, 1.28, 0.08);
      refs.earR = new THREE.Mesh(geo, m); refs.earR.scale.set(1, 1, 0.4); refs.earR.position.set(0.28, 1.28, 0.08);
      parts.push(refs.earL, refs.earR);
      if (id === 'monkey') {
        // 猴尾巴（细长上翘）
        refs.tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.7, 8), bodyMat);
        refs.tail.position.set(0, 0.55, -0.55); refs.tail.rotation.x = 0.8;
        parts.push(refs.tail);
      }
      if (id === 'mouse') {
        // 鼠尾巴（细长拖地）
        refs.tail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xd98a95 }));
        refs.tail.position.set(0, 0.25, -0.6); refs.tail.rotation.x = 1.25;
        parts.push(refs.tail);
      }
      break;
    }
    case 'ox': case 'dragon': {
      // 双角
      const geo = new THREE.ConeGeometry(0.07, 0.3, 8);
      const m = id === 'dragon' ? accentMat : new THREE.MeshStandardMaterial({ color: 0xd9c07a });
      refs.hornL = new THREE.Mesh(geo, m); refs.hornL.position.set(-0.16, 1.42, 0); refs.hornL.rotation.z = 0.3;
      refs.hornR = new THREE.Mesh(geo, m); refs.hornR.position.set(0.16, 1.42, 0); refs.hornR.rotation.z = -0.3;
      parts.push(refs.hornL, refs.hornR);
      break;
    }
    case 'tiger': case 'dog': {
      // 圆耳（虎） / 垂耳（狗）
      const geo = new THREE.SphereGeometry(0.11, 10, 8);
      refs.earL = new THREE.Mesh(geo, bodyMat); refs.earL.position.set(-0.24, 1.34, 0.06);
      refs.earR = new THREE.Mesh(geo, bodyMat); refs.earR.position.set(0.24, 1.34, 0.06);
      if (id === 'dog') { refs.earL.scale.set(0.7, 1.5, 0.4); refs.earR.scale.set(0.7, 1.5, 0.4); refs.earL.position.y = 1.24; refs.earR.position.y = 1.24; }
      parts.push(refs.earL, refs.earR);
      break;
    }
    case 'horse': {
      // 鬃毛（立盒）
      const mane = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }));
      mane.position.set(0, 1.22, -0.12);
      refs.mane = mane; parts.push(mane);
      // 马尾
      refs.tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.45, 8), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }));
      refs.tail.position.set(0, 0.62, -0.52); refs.tail.rotation.x = -2.4;
      parts.push(refs.tail);
      break;
    }
    case 'sheep': {
      // 卷角
      const geo = new THREE.TorusGeometry(0.09, 0.03, 6, 12, Math.PI * 1.5);
      refs.hornL = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xcbb89a }));
      refs.hornL.position.set(-0.22, 1.32, 0); refs.hornL.rotation.y = Math.PI / 2;
      refs.hornR = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xcbb89a }));
      refs.hornR.position.set(0.22, 1.32, 0); refs.hornR.rotation.y = Math.PI / 2;
      parts.push(refs.hornL, refs.hornR);
      // 绒毛冠
      const wool = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), bodyMat);
      wool.position.set(0, 1.36, -0.05); wool.scale.set(1.2, 0.7, 1);
      parts.push(wool);
      break;
    }
    case 'rooster': {
      // 红鸡冠
      const comb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.3), new THREE.MeshStandardMaterial({ color: 0xd94f3d }));
      comb.position.set(0, 1.42, 0.02);
      parts.push(comb);
      // 黄喙
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 6), new THREE.MeshStandardMaterial({ color: 0xffb347 }));
      beak.position.set(0, 1.02, 0.38); beak.rotation.x = Math.PI / 2;
      parts.push(beak);
      // 肉垂
      const wattle = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshStandardMaterial({ color: 0xd94f3d }));
      wattle.position.set(0, 0.9, 0.32); wattle.scale.set(0.7, 1.4, 0.7);
      parts.push(wattle);
      break;
    }
    case 'pig': {
      // 小立耳
      const geo = new THREE.ConeGeometry(0.08, 0.16, 8);
      refs.earL = new THREE.Mesh(geo, bodyMat); refs.earL.position.set(-0.15, 1.38, 0.05);
      refs.earR = new THREE.Mesh(geo, bodyMat); refs.earR.position.set(0.15, 1.38, 0.05);
      parts.push(refs.earL, refs.earR);
      break;
    }
    case 'duck': {
      // 无耳，喙在 extras
      break;
    }
    case 'snake': {
      // 无耳
      break;
    }
  }
  return parts.length ? parts : null;
}

// 其他差异件：鼻/喙/翅膀/背鳍等
function buildExtras(id, accentMat, refs) {
  const parts = [];
  switch (id) {
    case 'ox': {
      // 鼻环 + 浅色口鼻
      const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd9c0a8 }));
      muzzle.position.set(0, 0.96, 0.3); muzzle.scale.set(1.3, 0.8, 0.8);
      parts.push(muzzle);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12), MAT.gold());
      ring.position.set(0, 0.92, 0.42);
      parts.push(ring);
      break;
    }
    case 'tiger': {
      // 条纹（深色贴片）
      for (let i = 0; i < 3; i++) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.02), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }));
        stripe.position.set(-0.2 + i * 0.2, 0.62, 0.41);
        stripe.rotation.z = 0.2;
        parts.push(stripe);
      }
      break;
    }
    case 'dragon': {
      // 背鳍（金色三角串）
      for (let i = 0; i < 4; i++) {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), accentMat);
        fin.position.set(0, 0.92 - i * 0.12, -0.38 - i * 0.12);
        parts.push(fin);
      }
      break;
    }
    case 'mouse': {
      // 尖鼻
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff9aa2 }));
      nose.position.set(0, 1.0, 0.36);
      parts.push(nose);
      break;
    }
    case 'pig': {
      // 猪鼻子（圆柱）
      const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 10), new THREE.MeshStandardMaterial({ color: 0xe88a96 }));
      nose.position.set(0, 0.98, 0.34); nose.rotation.x = Math.PI / 2;
      parts.push(nose);
      break;
    }
    case 'duck': {
      // 扁喙
      const beak = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.18), new THREE.MeshStandardMaterial({ color: 0xff8c42 }));
      beak.position.set(0, 1.0, 0.36);
      parts.push(beak);
      // 小翅膀
      const wingGeo = new THREE.SphereGeometry(0.16, 10, 8);
      refs.wingL = new THREE.Mesh(wingGeo, bodyMatOf('duck')); refs.wingL.scale.set(0.5, 0.8, 1.1); refs.wingL.position.set(-0.44, 0.6, 0);
      refs.wingR = new THREE.Mesh(wingGeo, bodyMatOf('duck')); refs.wingR.scale.set(0.5, 0.8, 1.1); refs.wingR.position.set(0.44, 0.6, 0);
      parts.push(refs.wingL, refs.wingR);
      // 鸭尾（小翘）
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), bodyMatOf('duck'));
      tail.scale.set(0.6, 0.5, 0.8); tail.position.set(0, 0.62, -0.48);
      parts.push(tail);
      break;
    }
    case 'horse': case 'dog': {
      // 口鼻
      const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd9c0a8 }));
      muzzle.position.set(0, 0.95, 0.32); muzzle.scale.set(1.2, 0.85, 0.9);
      parts.push(muzzle);
      if (id === 'dog') {
        // 黑鼻头
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), MAT.dark());
        nose.position.set(0, 0.96, 0.42);
        parts.push(nose);
        // 狗尾
        refs.tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.35, 8), bodyMat);
        refs.tail.position.set(0, 0.72, -0.5); refs.tail.rotation.x = -1.8;
        parts.push(refs.tail);
      }
      break;
    }
    case 'monkey': {
      // 猴脸（浅色心形脸）
      const face = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8cfa5 }));
      face.position.set(0, 1.02, 0.22); face.scale.set(1, 0.9, 0.6);
      parts.push(face);
      break;
    }
    case 'snake': {
      // 蛇信子
      const tongue = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.12, 4), new THREE.MeshStandardMaterial({ color: 0xe84a5f }));
      tongue.position.set(0, 0.98, 0.4); tongue.rotation.x = Math.PI / 2;
      parts.push(tongue);
      break;
    }
  }
  return parts.length ? parts : null;
}

function bodyMatOf(id) { return MAT[BODY_MAT[id]](); }
