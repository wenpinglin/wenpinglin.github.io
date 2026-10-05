// hazard.js — M5.2 迎面陨石（"惊喜"障碍）：沿车道滚向玩家，需左右横移躲避
// 设计：从玩家前方 55~70m 滚来（红色路径光带提前标示车道），速度 9~13 m/s，撞上即死
import * as THREE from 'three';
import { Config } from './config.js';

const ROCK_COLORS = [0x6b6258, 0x7a6a55, 0x5a5f6e, 0x4e4a58];

export class Hazards {
  constructor(scene, audio, hud) {
    this.scene = scene;
    this.audio = audio;
    this.hud = hud;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.items = [];
    this.level = null;
    this.time = 0;
    this.nextAt = 6 + Math.random() * 5;   // 开局 6~11s 第一颗
    this.taught = false;                    // 教学提示（每局一次）
  }

  setLevel(level) { this.level = level; }

  reset() {
    for (const h of this.items) this._dispose(h);
    this.items = [];
    this.time = 0;
    this.nextAt = 6 + Math.random() * 5;
    this.taught = false;
  }

  // 每帧：生成 / 移动 / 撞击判定 / 回收；返回 { hit: bool }
  update(playerZ, playerX, dt) {
    this.time += dt;
    if (!this.level) return { hit: false };

    const cfg = this.level.hazard || {};
    const [iMin, iMax] = cfg.interval || Config.hazardInterval;
    if (this.time >= this.nextAt) {
      this.nextAt = this.time + iMin + Math.random() * (iMax - iMin);
      this.spawn();
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const h = this.items[i];
      // 迎面滚动（世界坐标向 -z）
      h.mesh.position.z -= h.speed * dt;
      // 滚动自转（滚过来的视觉感）
      h.mesh.rotation.x -= h.speed * dt * 1.1;
      h.mesh.rotation.z += dt * 0.5;
      // 车道光带跟随陨石（独立挂载，不随陨石自转翻滚）
      if (h.lane) h.lane.position.z = h.mesh.position.z - h.laneBack;
      // 回收：滚过玩家身后
      if (h.mesh.position.z < -14) {
        this._dispose(h);
        this.items.splice(i, 1);
        continue;
      }
      // 撞击判定（玩家世界 z ≈ 0）
      if (Math.abs(h.mesh.position.z) < 1.0 &&
          Math.abs(h.mesh.position.x - playerX) < h.hitR + Config.hazardHitPad) {
        return { hit: true, item: h };
      }
    }
    return { hit: false };
  }

  spawn() {
    const cfg = this.level.hazard || {};
    const [sMin, sMax] = cfg.speed || Config.hazardSpeed;
    const speed = sMin + Math.random() * (sMax - sMin);
    const size = 0.55 + Math.random() * 0.3;

    // 车道：跑道边界内随机（连续，不搞离散 lane）
    const x = (Math.random() * 2 - 1) * (Config.lateralMax - 0.6);
    const z = Config.hazardSpawnZ + Math.random() * 15;

    const geo = new THREE.DodecahedronGeometry(size, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: ROCK_COLORS[(Math.random() * ROCK_COLORS.length) | 0],
      roughness: 0.9, flatShading: true,
      emissive: 0x2a1608, emissiveIntensity: 0.4,   // 暗红微光，警示感
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.position.set(x, size * 0.72, z);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

    // 路径警示光带：标示陨石将滚过的车道（长条红色，朝玩家延伸）
    // 注意：不能挂到陨石 mesh 下当子物体——陨石每帧 rotation.x 自转，地面光带会跟着翻跟头
    const laneBack = 23;
    const laneGeo = new THREE.PlaneGeometry(size * 1.6 + 0.5, 46);
    laneGeo.rotateX(-Math.PI / 2);
    const laneMat = new THREE.MeshBasicMaterial({
      color: 0xff2a1a, transparent: true, opacity: 0.34,
      depthWrite: false, side: THREE.DoubleSide,
    });
    const lane = new THREE.Mesh(laneGeo, laneMat);
    lane.position.set(x, 0.045, z - laneBack);   // 独立于陨石，贴地朝玩家（-z）延伸
    this.group.add(lane);

    this.group.add(mesh);
    this.items.push({ mesh, lane, laneBack, speed, hitR: size * 0.8 });

    if (this.audio && this.audio.meteorWarn) this.audio.meteorWarn();
    if (!this.taught && this.hud) {
      this.taught = true;
      this.hud.toast('⚠ 陨石滚来！←→ 左右移动躲避！', 2400);
    }
  }

  _dispose(h) {
    this.group.remove(h.mesh);
    h.mesh.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
    if (h.lane) {
      this.group.remove(h.lane);
      h.lane.geometry.dispose();
      h.lane.material.dispose();
    }
  }
}