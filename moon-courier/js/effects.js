// effects.js — M2 演出特效：连击金光拖尾 + Perfect 落地光环
import * as THREE from 'three';
import { Config } from './config.js';

export class Effects {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;

    // === 连击拖尾：4 个渐隐残影 ===
    this.ghosts = [];
    this._buildGhosts();

    // === Perfect 落地光环：扩散圆环 ===
    this.ringPool = [];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.RingGeometry(0.35, 0.55, 32);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(geo, mat);
      ring.visible = false;
      scene.add(ring);
      this.ringPool.push(ring);
    }

    // === 月尘落地粒子（起跳/落地扬尘）===
    const N = 60;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i*3]=0; pos[i*3+1]=-10; pos[i*3+2]=0; }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0xcfc9bd, size: 0.12, transparent: true, opacity: 0.8 });
    this.particles = new THREE.Points(pGeo, pMat);
    this.particleVels = new Array(N).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));
    this.particleLife = new Array(N).fill(0);
    this.pMax = N;
    scene.add(this.particles);

    this.trailTimer = 0;
    this.trailActive = false;
  }

  // 生成 4 个残影（克隆当前角色模型；材质独立克隆，几何与角色共享 → 回收时不能 dispose 几何）
  _buildGhosts() {
    for (let i = 0; i < 4; i++) {
      const g = this.player.group.clone(true);
      g.traverse(o => {
        if (o.isMesh && o.material && !Array.isArray(o.material)) {
          o.material = o.material.clone();
          o.material.transparent = true;
          o.material.opacity = 0.0;
          o.material.depthWrite = false;
          o.castShadow = false;
        }
      });
      g.visible = false;
      this.scene.add(g);
      this.ghosts.push({ obj: g, life: 0, max: 0.35 + i * 0.12 });
    }
  }

  // 换角色后重建拖尾残影（原残影是构造时克隆的旧模型，否则换角后拖尾仍是旧角色）
  rebuildGhosts() {
    for (const gh of this.ghosts) {
      this.scene.remove(gh.obj);
      // 只释放克隆出来的材质；几何是共享的，不能 dispose
      gh.obj.traverse(o => { if (o.isMesh && o.material && !Array.isArray(o.material)) o.material.dispose(); });
    }
    this.ghosts = [];
    this.trailActive = false;
    this.trailTimer = 0;
    this._buildGhosts();
  }

  // 连击 ≥ N 开启拖尾
  setTrail(active) {
    if (this.trailActive !== active) {
      this.trailActive = active;
      if (!active) this.ghosts.forEach(g => { g.obj.visible = false; g.life = 0; });
    }
  }

  // Perfect 落地光环
  burstRing(y = 0.03) {
    const ring = this.ringPool.find(r => !r.visible) || this.ringPool[0];
    ring.visible = true;
    ring.position.set(this.player.group.position.x, y, this.player.group.position.z);
    ring.scale.set(1, 1, 1);
    ring.material.opacity = 0.85;
    ring.userData.t = 0;
  }

  // 扬尘（起跳/落地）
  dustBurst(n = 14, spread = 0.8) {
    const posAttr = this.particles.geometry.attributes.position;
    let spawned = 0;
    for (let i = 0; i < this.pMax && spawned < n; i++) {
      if (this.particleLife[i] <= 0) {
        const px = this.player.group.position.x + (Math.random() - 0.5) * 0.5;
        const py = this.player.group.position.y + 0.05;
        const pz = this.player.group.position.z + (Math.random() - 0.5) * 0.5;
        posAttr.setXYZ(i, px, py, pz);
        // 低重力：月尘缓慢飘散
        this.particleVels[i] = {
          x: (Math.random() - 0.5) * spread,
          y: 0.5 + Math.random() * 0.8,
          z: -(0.5 + Math.random() * 1.5),
        };
        this.particleLife[i] = 0.8 + Math.random() * 0.6;
        spawned++;
      }
    }
    posAttr.needsUpdate = true;
  }

  update(dt) {
    // === 拖尾残影 ===
    if (this.trailActive) {
      this.trailTimer += dt;
      if (this.trailTimer > 0.045) {
        this.trailTimer = 0;
        // 最旧的一个鬼影刷新到当前位置
        let oldest = this.ghosts[0];
        for (const g of this.ghosts) if (g.life < oldest.life) oldest = g;
        oldest.obj.position.copy(this.player.group.position);
        oldest.obj.rotation.copy(this.player.group.rotation);
        oldest.obj.visible = true;
        oldest.life = oldest.max;
      }
    }
    for (const g of this.ghosts) {
      if (g.life > 0) {
        g.life -= dt;
        const k = Math.max(0, g.life / g.max);
        g.obj.traverse(o => { if (o.isMesh) o.material.opacity = k * 0.35; });
        if (g.life <= 0) g.obj.visible = false;
      }
    }

    // === Perfect 光环扩散 ===
    for (const ring of this.ringPool) {
      if (!ring.visible) continue;
      ring.userData.t += dt;
      const k = ring.userData.t / 0.6;
      ring.scale.set(1 + k * 3.2, 1, 1 + k * 3.2);
      ring.material.opacity = Math.max(0, 0.85 * (1 - k));
      if (k >= 1) ring.visible = false;
    }

    // === 月尘粒子（低重力下落）===
    const posAttr = this.particles.geometry.attributes.position;
    let any = false;
    for (let i = 0; i < this.pMax; i++) {
      if (this.particleLife[i] > 0) {
        this.particleLife[i] -= dt;
        const v = this.particleVels[i];
        // 低重力 g 的 0.4 倍做粒子（视觉更飘）
        v.y -= Config.gravity * 0.4 * dt;
        posAttr.setXYZ(i,
          posAttr.getX(i) + v.x * dt,
          posAttr.getY(i) + v.y * dt,
          posAttr.getZ(i) + v.z * dt
        );
        if (this.particleLife[i] <= 0) posAttr.setY(i, -10);
        any = true;
      }
    }
    if (any) posAttr.needsUpdate = true;
  }

  reset() {
    this.setTrail(false);
    this.ringPool.forEach(r => { r.visible = false; });
    const posAttr = this.particles.geometry.attributes.position;
    for (let i = 0; i < this.pMax; i++) { posAttr.setY(i, -10); this.particleLife[i] = 0; }
    posAttr.needsUpdate = true;
  }
}
