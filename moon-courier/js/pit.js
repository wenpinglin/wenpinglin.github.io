// pit.js — 月球坑系统（M4：6 种坑型；M4.5 视觉升级：环形山式立体坑+六坑型差异化坑面+坑沿碎石+动画）
// 注意：跑道月面是完整实心平面（y=0），任何 y<0 的几何都会被遮住，故坑采用"月面上方"的环形山式浮雕：
//   凸起坑沿(rim) + 径向渐暗坑面纹理（坑型差异化色调）+ 下陷阴影环 + 稀有度光环 + 坑沿碎石
import * as THREE from 'three';
import { Config } from './config.js';
import { RARITY_INFO } from './codex.js';

const TWIN_RIDGE = 2.0;   // 双子坑之间的窄脊基准宽度（m，随关卡速度等比放大）

// 坑面渐暗纹理：中心最暗（模拟下凹深度），坑型用不同底色
function pitTexture(baseHex, deepRatio = 0.55) {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const base = new THREE.Color(baseHex);
  const deep = base.clone().multiplyScalar(deepRatio);
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.12, S / 2, S / 2, S / 2);
  g.addColorStop(0, `#${deep.getHexString()}`);
  g.addColorStop(0.55, `#${base.clone().multiplyScalar(deepRatio + 0.18).getHexString()}`);
  g.addColorStop(0.88, `#${base.getHexString()}`);
  g.addColorStop(1, `#${base.clone().multiplyScalar(1.25).getHexString()}`);   // 坑沿内缘稍亮
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // 细颗粒
  const img = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(cv);
}

// 递归释放一个对象树的 geometry/material
function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}

export class PitManager {
  constructor(scene, codex) {
    this.scene = scene;
    this.codex = codex;
    this.pits = [];
    this.nextZ = 25;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.level = null;
    this.time = 0;              // 关卡内累计时间（滚石相位 / 动画用）
    this.rng = Math.random;      // 随机源（每日挑战注入种子随机）
    this.pitWidthScale = 1;
  }

  // 坑宽随关卡速度等比缩放：跑得越快、坑越宽 → 射程/坑宽比恒定，
  // "小跳 vs 蓄力跳"的选择在任何关卡都成立（批次二·A 方案核心）
  setLevel(level) {
    this.level = level;
    this.pitWidthScale = level?.pitWidthScale ?? level?.speedMult ?? 1;
  }
  setRng(fn) { this.rng = fn; }

  // 每帧维护：生成前方坑，回收身后坑
  update(playerDist, dt = 0) {
    this.time += dt;
    if (!this.level) return;
    const [gMin, gMax] = this.level.gapRange;
    while (this.nextZ < playerDist + 60) {
      const plan = this.level.pitPlan;
      const roll = this.rng();
      let adv;
      const w = Config.pitWidth * (this.pitWidthScale ?? 1);
      if (roll < plan.twin) {
        // 双子坑：两坑之间留窄脊（脊宽也随关卡等比放大，保持"两次快跳"的节奏感）
        const off = w + TWIN_RIDGE * (this.pitWidthScale ?? 1);
        this.spawnPit(this.nextZ, 1.0, 'normal');
        const p2 = this.spawnPit(this.nextZ + off, 1.0, 'normal');
        adv = off + p2.halfW * 2;
      } else if (roll < plan.twin + plan.rolling) {
        adv = this.spawnPit(this.nextZ, 1.15, 'rolling').halfW * 2;
      } else if (roll < plan.twin + plan.rolling + plan.bounce) {
        adv = this.spawnPit(this.nextZ, 1.0, 'bounce').halfW * 2;
      } else if (roll < plan.twin + plan.rolling + plan.bounce + plan.collapse) {
        adv = this.spawnPit(this.nextZ, 1.0, 'collapse').halfW * 2;
      } else if (roll < plan.twin + plan.rolling + plan.bounce + plan.collapse + plan.abyss) {
        adv = this.spawnPit(this.nextZ, 1.0, 'abyss').halfW * 2;
      } else if (roll < plan.twin + plan.rolling + plan.bounce + plan.collapse + plan.abyss + plan.wide) {
        adv = this.spawnPit(this.nextZ, Config.pitWideScale, 'normal').halfW * 2;
      } else {
        adv = this.spawnPit(this.nextZ, 1.0, 'normal').halfW * 2;
      }
      this.nextZ += adv + (gMin + this.rng() * (gMax - gMin));
    }
    // 回收
    for (let i = this.pits.length - 1; i >= 0; i--) {
      const p = this.pits[i];
      if (p.z < playerDist - 20) {
        this._disposePit(p);
        this.pits.splice(i, 1);
      } else {
        this._animatePit(p, dt);
      }
    }
  }

  spawnPit(z, widthScale = 1.0, type = 'normal') {
    const isWide = widthScale > 1.2;            // 判定基于"坑型系数"，不受关卡缩放影响
    widthScale *= (this.pitWidthScale ?? 1);    // 关卡坑宽缩放（第 1 关 0.85 新手友好）
    const entry = this.codex.nextEntry();
    const w = Config.pitWidth * widthScale;
    const halfW = w / 2;

    // 坑型色调（渐变坑面底色）与深度视觉参数
    let faceColor, faceDeep, depth;
    if (type === 'rolling') { faceColor = 0x35333c; faceDeep = 0.5; depth = 2.4; }
    else if (type === 'bounce') { faceColor = 0x3a3f47; faceDeep = 0.5; depth = 2.2; }
    else if (type === 'collapse') { faceColor = 0x2f2c36; faceDeep = 0.45; depth = 2.4; }
    else if (type === 'abyss') { faceColor = 0x241a3e; faceDeep = 0.32; depth = 3.2; }
    else if (isWide) { faceColor = 0x55505c; faceDeep = 0.62; depth = 1.6; }
    else { faceColor = 0x48434f; faceDeep = 0.52; depth = 2.5; }
    const darkColor = faceColor;

    const mesh = new THREE.Group();
    mesh.position.set(0, 0, z);

    // === 坑面：径向渐暗纹理圆片（俯视下呈"下凹"渐变） ===
    const faceTex = pitTexture(faceColor, faceDeep);
    const faceGeo = new THREE.CircleGeometry(halfW, 28);
    faceGeo.rotateX(-Math.PI / 2);
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.95, metalness: 0.05 });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(0, 0.02, 0);
    face.receiveShadow = true;
    mesh.add(face);

    // === 凸起坑沿：真实环形山体（Lathe 环脊，全在月面 y>0 之上，太阳光下产生明暗立体） ===
    const rimProf = [
      new THREE.Vector2(halfW * 0.88, 0.03),   // 内侧（贴坑面边缘）
      new THREE.Vector2(halfW * 1.0, 0.16),    // 山脊顶
      new THREE.Vector2(halfW * 1.28, 0.07),
      new THREE.Vector2(halfW * 1.55, 0.0),    // 外沿回落月面
    ];
    const rimGeo = new THREE.LatheGeometry(rimProf, 28);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xa89f8d, roughness: 0.9, metalness: 0.05, side: THREE.DoubleSide });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(0, 0, 0);
    rim.receiveShadow = true;
    mesh.add(rim);

    // === 坑口下陷阴影环（山体外一圈暗晕 → "陷进去"） ===
    const shGeo = new THREE.RingGeometry(halfW + 0.6, halfW + 1.05, 26);
    shGeo.rotateX(-Math.PI / 2);
    const shMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false });
    const shadowRing = new THREE.Mesh(shGeo, shMat);
    shadowRing.position.set(0, 0.02, 0);
    mesh.add(shadowRing);

    // === 坑沿光环（颜色按稀有度） ===
    const ringColor = { common: 0xb79a4a, rare: 0x5aa8ff, epic: 0xb07aff, legend: 0xffd76a }[entry.rarity];
    const ringOpacity = { common: 0.35, rare: 0.5, epic: 0.65, legend: 0.85 }[entry.rarity];
    const ringGeo = new THREE.RingGeometry(halfW - 0.02, halfW + 0.16, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: ringOpacity, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(0, 0.12, 0);
    mesh.add(ring);

    // === 坑沿碎石（随坑回收；传说坑 5 颗，其余 3 颗） ===
    const rimCount = entry.rarity === 'legend' ? 5 : 3;
    const rimMat2 = new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 1, flatShading: true });
    const rims = [];
    for (let i = 0; i < rimCount; i++) {
      const rRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + this.rng() * 0.14, 0), rimMat2.clone());
      rRock.position.set(
        (this.rng() - 0.5) * halfW * 1.6,
        0.1 + this.rng() * 0.12,
        (this.rng() - 0.5) * halfW * 0.9
      );
      rRock.rotation.set(this.rng() * Math.PI, this.rng() * Math.PI, 0);
      mesh.add(rRock);
      rims.push(rRock);
    }

    // === 宽坑：坑面涟漪双环 ===
    const ripples = [];
    if (isWide) {
      for (const rr of [halfW * 0.45, halfW * 0.68]) {
        const rg = new THREE.RingGeometry(rr, rr + 0.1, 24);
        rg.rotateX(-Math.PI / 2);
        const rm = new THREE.MeshBasicMaterial({ color: 0xbfd0ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
        const rM = new THREE.Mesh(rg, rm);
        rM.position.set(0, 0.06, 0);
        mesh.add(rM);
        ripples.push(rM);
      }
    }

    const pit = { z, halfW, type, mesh, face, ring, crossed: false, entry, depth, rims, ripples };

    // === 坑型专属部件 ===
    if (type === 'rolling') {
      // 滚石：坑面内周期弹起的陨石
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.4, 0),
        new THREE.MeshStandardMaterial({ color: 0x6b6560, roughness: 0.9, flatShading: true })
      );
      rock.position.set(0, 0.18, 0);
      rock.castShadow = true;
      this.group.add(rock);
      pit.rock = rock;
      pit.baseY = 0.18;
      pit.phase = this.rng() * Config.rollingCycle;
    }
    if (type === 'bounce') {
      // 弹射区：坑后沿弹力带（发光脉冲）
      const bGeo = new THREE.RingGeometry(halfW + 0.1, halfW + 0.7, 16, 1, 0, Math.PI);
      bGeo.rotateX(-Math.PI / 2);
      bGeo.rotateZ(Math.PI / 2);
      const bMat = new THREE.MeshBasicMaterial({ color: 0x51e08a, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
      const bZone = new THREE.Mesh(bGeo, bMat);
      bZone.position.set(0, 0.1, z + halfW + 0.4);
      this.group.add(bZone);
      pit.bZone = bZone;
    }
    if (type === 'collapse') {
      // 塌陷坑：坑沿裂纹碎块（6 块，跨坑后下沉）
      for (let i = 0; i < 6; i++) {
        const frag = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.15, 0),
          new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 1, flatShading: true })
        );
        frag.position.set(-halfW * 0.7 + this.rng() * halfW * 1.4, 0.1, z - halfW * 0.8 - this.rng() * 0.3);
        this.group.add(frag);
        (pit.frags = pit.frags || []).push(frag);
      }
    }
    if (type === 'abyss') {
      // 深渊坑：坑面紫雾光（呼吸动画）
      const glowGeo = new THREE.CircleGeometry(halfW * 0.8, 20);
      glowGeo.rotateX(-Math.PI / 2);
      const glowMat = new THREE.MeshBasicMaterial({ color: 0x5a3aa8, transparent: true, opacity: 0.55, depthWrite: false });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.set(0, 0.09, 0);
      mesh.add(glow);
      pit.glow = glow;
      pit.glowMat = glowMat;
    }
    if (type === 'normal' && isWide) entry.wide = true;

    // 传说/史诗小旗
    if (entry.rarity === 'legend' || entry.rarity === 'epic') {
      const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0xd9c07a }));
      flagPole.position.set(0, 0.7, z - halfW - 0.6);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.28), new THREE.MeshBasicMaterial({ color: entry.rarity === 'legend' ? 0xffd76a : 0xb07aff, side: THREE.DoubleSide }));
      flag.position.set(0.22, 1.25, z - halfW - 0.6);
      this.group.add(flagPole, flag);
      entry._markers = [flagPole, flag];
    }

    this.group.add(mesh);
    this.pits.push(pit);
    if (this.onSpawn) this.onSpawn(pit);
    return pit;
  }

  // game.js 注入：坑生成时同步散布星屑
  hookSpawn(fn) { this.onSpawn = fn; }

  // 每帧坑动画（滚石相位 / 塌陷回落 / 弹力垫脉冲 / 深渊雾呼吸）
  _animatePit(p, dt) {
    if (p.type === 'rolling' && p.rock) {
      const t = (this.time + p.phase) % Config.rollingCycle;
      const k = t / Config.rollingCycle;
      if (k < Config.rollingDangerWindow) {
        const h = Math.sin((k / Config.rollingDangerWindow) * Math.PI);
        p.rock.position.y = p.baseY + h * 1.9;
        p.rock.rotation.x += dt * 3; p.rock.rotation.z += dt * 2;
      } else {
        p.rock.position.y = p.baseY;
        p.rock.rotation.x += dt * 0.8;
      }
    }
    if (p.type === 'collapse' && p.crossed && p.frags) {
      p.frags.forEach((f) => {
        if (f.position.y > -1.4) f.position.y -= dt * 0.5;
      });
    }
    if (p.type === 'bounce' && p.bZone) {
      p.bZone.material.opacity = 0.5 + 0.4 * Math.abs(Math.sin(this.time * 3.2));
    }
    if (p.type === 'abyss' && p.glowMat) {
      const b = 0.28 + 0.3 * Math.abs(Math.sin(this.time * 1.6));
      p.glowMat.opacity = b;
      const sc = 1 + 0.06 * Math.sin(this.time * 1.6);
      p.glow.scale.setScalar(sc);
    }
  }

  // 滚石是否处于危险弹起期
  _rollingDanger(p) {
    const t = (this.time + p.phase) % Config.rollingCycle;
    return (t / Config.rollingCycle) < Config.rollingDangerWindow;
  }

  // 深渊引力：玩家在深渊坑上方空中时，返回附加下坠加速度
  abyssPull(playerZ, playerY) {
    for (const p of this.pits) {
      if (p.type !== 'abyss' || p.crossed) continue;
      if (playerZ > p.z - p.halfW - 1 && playerZ < p.z + p.halfW + 1 && playerY > 0.3) {
        return Config.abyssPull;
      }
    }
    return 0;
  }

  // 弹力区检测：落点是否踩中弹射带（返回弹起初速或 0）
  bounceCheck(playerZ) {
    for (const p of this.pits) {
      if (p.type !== 'bounce' || p.crossed) continue;
      const zoneStart = p.z + p.halfW + 0.1;
      const zoneEnd = p.z + p.halfW + 0.75;
      if (playerZ >= zoneStart && playerZ <= zoneEnd) {
        return Config.bounceKick;
      }
    }
    return 0;
  }

  // 预测：从当前位置 (z,y) 以竖直速度 vy 抛出、落到月面（y=0）时的 z 坐标
  // 用于 Perfect 判定——"落点"应当是真正落地之处，而不是帧内越界的那一点点位移
  _predictLandingZ(z, y, { vy = 0, speed = 0, gravity = Config.gravity } = {}) {
    if (y <= 0) return z;
    // 解 y + vy·t − g·t²/2 = 0 的正根
    const t = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * gravity * y))) / gravity;
    return z + speed * Math.max(0, t);
  }

  // 每帧判定
  // opts：{ vy, speed } —— 玩家竖直速度与前进速度（预测落点用）
  // 返回：{ died, crossedPit, perfect, results:[{pit,perfect}] }
  //   同一帧越过多个坑（双子坑等）时，results 会给出全部，避免"吞掉第二个坑的奖励"
  check(playerZ, playerY, prevZ, tolerance = 0, opts = {}) {
    const results = [];
    for (const p of this.pits) {
      if (p.crossed) continue;
      const tol = Config.pitTolerance + tolerance;
      // ① 掉坑：身处坑内且贴近坑面（已越过坑后沿就不算）
      if (playerZ > p.z - p.halfW + tol && playerZ < p.z + p.halfW - tol) {
        if (playerY < 0.5) {
          return { died: true, crossedPit: null, perfect: false };
        }
      }
      // ② 越过坑后沿 → 结算
      if (prevZ < p.z + p.halfW && playerZ >= p.z + p.halfW) {
        if (p.type === 'rolling' && this._rollingDanger(p) && playerY < 2.4) {
          return { died: true, crossedPit: null, perfect: false, cause: 'rolling' };
        }
        p.crossed = true;
        // Perfect：预测落点落在"坑后沿 ±20% 坑宽"带内（需求文档 5.2）
        const landZ = this._predictLandingZ(playerZ, playerY, opts);
        const perfect = Math.abs(landZ - (p.z + p.halfW)) < p.halfW * 2 * Config.perfectRatio;
        results.push({ pit: p, perfect, landZ });
      }
    }
    if (results.length) {
      return { died: false, crossedPit: results[0].pit, perfect: results[0].perfect, results };
    }
    return { died: false, crossedPit: null, perfect: false, results: [] };
  }

  _disposePit(p) {
    this.group.remove(p.mesh);
    disposeTree(p.mesh);
    if (p.rock) { this.group.remove(p.rock); p.rock.geometry.dispose(); p.rock.material.dispose(); }
    if (p.bZone) { this.group.remove(p.bZone); p.bZone.geometry.dispose(); p.bZone.material.dispose(); }
    if (p.frags) p.frags.forEach(f => { this.group.remove(f); f.geometry.dispose(); f.material.dispose(); });
    if (p.entry._markers) {
      p.entry._markers.forEach(m => { this.group.remove(m); m.geometry.dispose(); m.material.dispose(); });
    }
  }

  reset() {
    for (const p of this.pits) this._disposePit(p);
    this.pits = [];
    this.nextZ = 25;
    this.time = 0;
  }

  nearestPitDist(playerZ) {
    let min = Infinity;
    for (const p of this.pits) {
      if (p.z > playerZ && p.z - playerZ < min) min = p.z - playerZ;
    }
    return min === Infinity ? null : min;
  }
}