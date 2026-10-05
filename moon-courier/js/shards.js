// shards.js — 星屑收集系统（跳跃弧线上的月尘收集物 + 中秋月饼）
import * as THREE from 'three';
import { Config } from './config.js';

export class ShardManager {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.shards = [];       // { z, y, mesh, got }
    this.collectR = Config.shardCollectR;
    this.onCollect = null;  // 回调：被收集时
  }

  // 每个坑跳跃弧线顶点散布星屑
  spawnForPit(pitZ, pitHalfW) {
    const n = Config.shardsPerPit[0] + Math.floor(Math.random() * (Config.shardsPerPit[1] - Config.shardsPerPit[0] + 1));
    for (let i = 0; i < n; i++) {
      const z = pitZ - 1 + Math.random() * 2;
      // 沿跳跃弧线散布（高度与新手感匹配：小跳 1.53m / 满蓄力 2.37m 的腾空高度）
      const y = 1.1 + Math.random() * 1.0;
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.12, 0),
        new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0x8a6a20, emissiveIntensity: 0.8, roughness: 0.3, flatShading: true })
      );
      mesh.position.set(0, y, z);
      this.group.add(mesh);
      this.shards.push({ z, y, mesh, got: false });
    }
  }

  // 中秋月饼（+50 尘，金色扁圆）
  spawnMooncake(z) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0xe8a23f, emissive: 0x5a3010, emissiveIntensity: 0.6, roughness: 0.5 })
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(0, 1.8, z);
    this.group.add(mesh);
    this.shards.push({ z, y: 1.8, mesh, got: false, mooncake: true });
  }

  // 每帧：跟随滚动 + 收集判定 + 旋转动画
  update(playerZ, playerY, dt, magnetMult = 1) {
    this.group.position.z = -playerZ;
    const r = this.collectR * magnetMult;
    for (const s of this.shards) {
      if (s.got) continue;
      s.mesh.rotation.y += dt * 3;
      s.mesh.rotation.z += dt * 1.5;
      const worldZ = s.z - playerZ;
      if (Math.abs(worldZ) < r && Math.abs(playerY + 0.6 - s.y) < r + 0.4) {
        s.got = true;
        s.mesh.visible = false;
        if (this.onCollect) this.onCollect(s);
      }
    }
    // 回收身后
    this.shards = this.shards.filter(s => {
      if (s.z < playerZ - 25) {
        this.group.remove(s.mesh);
        s.mesh.geometry.dispose(); s.mesh.material.dispose();
        return false;
      }
      return true;
    });
  }

  reset() {
    for (const s of this.shards) {
      this.group.remove(s.mesh);
      s.mesh.geometry.dispose(); s.mesh.material.dispose();
    }
    this.shards = [];
  }
}
