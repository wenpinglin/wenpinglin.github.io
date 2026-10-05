// post.js — 月宫快递驿站：模型 + 点亮 + 存档点（需求 8.1）
import * as THREE from 'three';
import { POST_INTERVAL } from './levels.js';

export class PostManager {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.posts = [];          // { z, mesh, lit, litMeshes }
  }

  // 关卡开始时生成该关全部驿站
  buildForLevel(levelLength) {
    this.clear();
    const count = Math.floor((levelLength - 100) / POST_INTERVAL);
    for (let i = 1; i <= count; i++) {
      this.spawn(i * POST_INTERVAL);
    }
  }

  spawn(z) {
    const g = new THREE.Group();

    // 基座小平台
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.2, 0.18, 10),
      new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.9 })
    );
    base.position.y = 0.09;
    g.add(base);

    // 信标灯塔（未点亮暗灰，点亮金色发光）
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.1, 1.6, 8),
      new THREE.MeshStandardMaterial({ color: 0xd9c07a, roughness: 0.5 })
    );
    tower.position.set(-0.5, 0.95, 0);
    g.add(tower);

    // 灯球（点亮状态切换 emissive）
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x4a4438, emissive: 0x000000, roughness: 0.4 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), lampMat);
    lamp.position.set(-0.5, 1.9, 0);
    g.add(lamp);

    // 点光（点亮后）
    const light = new THREE.PointLight(0xffd76a, 0, 8);
    light.position.set(-0.5, 2.0, 0);
    g.add(light);

    // 小旗
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6),
      new THREE.MeshStandardMaterial({ color: 0xd9c07a })
    );
    pole.position.set(0.45, 0.84, 0);
    g.add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff7a3d, side: THREE.DoubleSide })
    );
    flag.position.set(0.72, 1.4, 0);
    g.add(flag);

    // 小邮筒（月宫快递标配）
    const mailbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.3, 0.26),
      new THREE.MeshStandardMaterial({ color: 0xff7a3d, roughness: 0.6 })
    );
    mailbox.position.set(0, 0.36, 0.35);
    g.add(mailbox);
    const mslot = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.05, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x2a2a3a })
    );
    mslot.position.set(0, 0.42, 0.49);
    g.add(mslot);

    g.position.set(2.4, 0, z);   // 驿站放在跑道右侧，不挡跳跃路线
    this.group.add(g);
    this.posts.push({ z, mesh: g, lit: false, lamp, lampMat, light });
  }

  // 每帧：检查点亮（玩家越过驿站 z）；返回新点亮的驿站 z（用于存档）
  // dynamic=true 时（无尽/每日），随距离动态补生成前方驿站
  update(playerZ, litSet, dynamic = false) {
    if (dynamic) {
      while ((this.lastBuilt || 0) + POST_INTERVAL < playerZ + 90) {
        this.lastBuilt = (this.lastBuilt || 0) + POST_INTERVAL;
        if (this.lastBuilt > 0) this.spawn(this.lastBuilt);
      }
    }
    let newlyLit = null;
    for (const p of this.posts) {
      if (!p.lit && playerZ >= p.z) {
        p.lit = true;
        newlyLit = p.z;
        this._lightUp(p);
      }
      // 已点亮过的（复活场景）：恢复视觉
      if (!p.lit && litSet && litSet.has(p.z)) {
        p.lit = true;
        this._lightUp(p);
      }
    }
    // 视觉跟随：与坑一样随距离后移
    this.group.position.z = -playerZ;
    return newlyLit;
  }

  _lightUp(p) {
    p.lampMat.color.set(0xffd76a);
    p.lampMat.emissive.set(0xffb347);
    p.lampMat.emissiveIntensity = 1.4;
    p.light.intensity = 1.6;
  }

  // 最近已点亮驿站（复活点）；无则返回 0（从起点）
  respawnZ() {
    let z = 0;
    for (const p of this.posts) {
      if (p.lit && p.z > z) z = p.z;
    }
    return z;
  }

  reset() {
    this.clear();
    this.lastBuilt = 0;
  }

  clear() {
    for (const p of this.posts) {
      this.group.remove(p.mesh);
      p.mesh.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    }
    this.posts = [];
  }

  resetVisuals() {
    for (const p of this.posts) {
      p.lit = false;
      p.lampMat.color.set(0x4a4438);
      p.lampMat.emissive.set(0x000000);
      p.lampMat.emissiveIntensity = 0;
      p.light.intensity = 0;
    }
  }
}
