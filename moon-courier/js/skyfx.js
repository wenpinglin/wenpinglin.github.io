// skyfx.js — 天空特效（M4.5 视觉美化）：装饰流星 + 亮星闪烁
// 注意：与 events.js 的"陨石雨"（砸向玩家的致命陨石）完全无关，这里是纯背景装饰流星。
import * as THREE from 'three';

// 加色混合发光材质工厂（流星拖尾球用）
function mkGlow(hex, op) {
  return new THREE.MeshBasicMaterial({
    color: hex, transparent: true, opacity: op,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
}

const COLORS = [0xfff2cc, 0xffc36a, 0xaad8ff];   // 暖白 / 橙 / 冰蓝

export class MeteorShower {
  constructor(scene) {
    this.scene = scene;
    this.meteors = [];
    this.time = 0;
    this.nextAt = 1.5 + Math.random() * 2.5;   // 开局 1.5~4s 后出现第一颗

    this.headGeo = new THREE.SphereGeometry(1, 8, 8);
    this._zAxis = new THREE.Vector3(0, 0, 1);
  }

  // 每帧：主流星更新 + 亮星闪烁
  update(dt, starsBright) {
    this.time += dt;

    // 同屏最多 3 颗，间隔 2.5~7.5 秒（让"时不时划过流星"更明显）
    if (this.meteors.length < 3 && this.time >= this.nextAt) {
      this.spawn();
      this.nextAt = this.time + 2.5 + Math.random() * 5;
    }

    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.age += dt;
      if (m.age >= m.life) { this.dispose(m); this.meteors.splice(i, 1); continue; }
      m.pos.addScaledVector(m.dir, m.speed * dt);
      const k = 1 - Math.pow(m.age / m.life, 1.7);          // 尾段渐隐
      m.group.position.copy(m.pos);
      m.group.quaternion.setFromUnitVectors(this._zAxis, m.dir);  // +z 对齐运动方向
      m.group.children.forEach((s, ci) => {
        if (s === m.halo) { s.material.opacity = Math.max(0, 0.30 * k); return; }  // 光晕恒定偏亮
        const f = Math.pow(1 - ci / (m.group.children.length - 2), 0.6);   // 越靠尾越淡
        s.material.opacity = Math.max(0, f * k * m.opacity);
        if (ci === 0) s.scale.setScalar(1 + k * 0.3);
      });
    }

    // 亮星闪烁（材质 opacity 正弦微动）
    if (starsBright) starsBright.opacity = 0.82 + 0.18 * Math.sin(this.time * 1.9);
  }

  spawn() {
    // 起点：相机前方背景天空、视野上缘内，保证玩家能看到（相机是俯视跑酷）
    const z = 55 + Math.random() * 70;                         // 前方背景距离 55~125
    const y = 8 + Math.random() * Math.max(12, z * 0.5 - 10);   // 视野上缘近似 0.5*z 之内
    const sx = Math.random() < 0.5 ? -1 : 1;
    const x = sx * (30 + Math.random() * 55);
    const pos = new THREE.Vector3(x, y, z);

    // 方向：横穿画面（沿 x 从一侧滑向另一侧）+ 轻微下掠，背景可见
    const dir = new THREE.Vector3(-sx * 1.0, -(0.05 + Math.random() * 0.2), 0).normalize();
    const speed = 150 + Math.random() * 100;
    const life = 1.2 + Math.random() * 0.6;

    const group = new THREE.Group();
    group.position.copy(pos);
    group.quaternion.setFromUnitVectors(this._zAxis, dir);

    const color = COLORS[(Math.random() * COLORS.length) | 0];
    const opacity = 0.9 + Math.random() * 0.1;
    // 头部光晕（大、淡、加色）+ 6 级拖尾球（沿 -z 向后递减）
    const segs = 7;
    const tailLen = 13 + Math.random() * 9;
    for (let i = 0; i < segs; i++) {
      const f = 1 - i / (segs - 1);
      const s = 0.18 + f * 0.34;                       // 头 0.52 → 尾 0.18
      const mesh = new THREE.Mesh(this.headGeo, mkGlow(color, opacity * 0.95));
      mesh.scale.setScalar(s);
      mesh.position.z = -i * (tailLen / (segs - 1));   // 尾巴沿 -z（运动反方向）
      group.add(mesh);
    }
    // 头部外围光晕（增强辨识度）
    const halo = new THREE.Mesh(this.headGeo, mkGlow(0xffffff, 0.30));
    halo.scale.setScalar(1.25);
    group.add(halo);
    group.position.copy(pos);
    this.scene.add(group);

    this.meteors.push({ group, halo, pos, dir, speed, life, age: 0, opacity });
  }

  dispose(m) {
    this.scene.remove(m.group);
    m.group.traverse(o => {
      if (o.material) o.material.dispose();
      if (o.geometry && o !== m.group) o.geometry.dispose();
    });
  }
}