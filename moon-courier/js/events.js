// events.js — 环境事件：陨石雨（关4+）/ 月食（关6+）/ 地出彩蛋 / 中秋限定
import * as THREE from 'three';
import { Config } from './config.js';

// 中秋限定：窗口判断（硬编码农历窗口 + 调参预览开关）
export function isMidAutumn() {
  const now = new Date();
  const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [start, end] = Config.midAutumnWindow;
  return mmdd >= start && mmdd <= end || Config.midAutumnPreview;
}

export class EventManager {
  constructor(scene, hud, audio) {
    this.scene = scene;
    this.hud = hud;
    this.audio = audio;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.meteorEnabled = false;
    this.eclipseEnabled = false;
    this.nextMeteorAt = 12 + Math.random() * 8;   // 距关卡开始秒数
    this.warnings = [];       // { x, z, warnT, elapsed, landed, mesh, marker }
    this.eclipseState = { active: false, t: 0 };

    // 地出彩蛋（每关一次机会）
    this.earthriseDone = false;

    // 中秋：月亮位置不变，但给月面挂灯笼（由驿站处挂）
    this.midAutumn = isMidAutumn();
  }

  setLevel(level) {
    this.meteorEnabled = !!level.meteor;
    this.eclipseEnabled = !!level.eclipse;
    this.nextMeteorAt = 10 + Math.random() * 10;
    this.earthriseDone = false;
    this.reset();
  }

  reset() {
    for (const w of this.warnings) this._disposeWarning(w);
    this.warnings = [];
    this.eclipseState = { active: false, t: 0 };
    this._earthriseAcc = 0;
  }

  // 每帧：dt 秒；playerZ 当前距离；playerSpeed 前进速度（陨石落点前瞻用）
  // 返回 { meteorHit: bool, eclipseDark: 0-1 }
  update(dt, playerZ, playerX, playerY, sun, ambient, playerSpeed = Config.runSpeed) {
    let result = { meteorHit: false, eclipseDark: 0 };

    // 事件层与坑/星屑一样随玩家后移 —— 否则跑远后陨石在视野之外仍然能砸死玩家
    this.group.position.z = -playerZ;

    // === 陨石雨 ===
    if (this.meteorEnabled) {
      this.nextMeteorAt -= dt;
      if (this.nextMeteorAt <= 0) {
        const [iMin, iMax] = Config.meteorInterval;
        this.nextMeteorAt = iMin + Math.random() * (iMax - iMin);
        // 落点前瞻：预警结束时玩家大约前进 playerSpeed × 预警时长，
        // 把落点放在那个位置附近 → 玩家必须靠左右横移躲避（否则会有一半陨石落在身后空转）
        const lead = playerSpeed * Config.meteorWarnTime;
        this._spawnMeteor(playerZ + lead + (Math.random() - 0.25) * 6);
      }
      // 预警与坠落
      for (const w of this.warnings) {
        w.elapsed += dt;
        if (!w.landed) {
          const k = Math.min(1, w.elapsed / Config.meteorWarnTime);
          w.mesh.position.y = w.startPos * (1 - k);                                  // 高空缓慢下压
          w.marker.material.opacity = 0.45 + 0.35 * Math.abs(Math.sin(w.elapsed * 9)); // 红圈急促闪烁
          if (w.elapsed >= Config.meteorWarnTime) {
            w.landed = true;
            w.mesh.position.y = 0.05;
            w.mesh.material.color.set(0xff7a45);
            w.mesh.material.emissive = new THREE.Color(0x8a2a10);
          }
        }
        // 命中判定：落地后保留 0.4s 窗口（玩家此时正通过该点）
        if (w.landed && !w.hitDone && w.elapsed < Config.meteorWarnTime + 0.4) {
          const dz = w.z - playerZ;
          if (Math.abs(dz) < Config.meteorRadius && Math.abs(w.x - playerX) < Config.meteorRadius && playerY < 1.2) {
            result.meteorHit = true;
            w.hitDone = true;
          }
        }
        // 落地后 3 秒淡出
        if (w.landed && w.elapsed > Config.meteorWarnTime + 3) {
          w.marker.material.opacity = Math.max(0, w.marker.material.opacity - dt * 2);
        }
        if (w.elapsed > Config.meteorWarnTime + 4.5) {
          this._disposeWarning(w);
        }
      }
      this.warnings = this.warnings.filter(w => !w._dead);
    }

    // === 月食 ===
    if (this.eclipseEnabled) {
      if (!this.eclipseState.active && !this.eclipseState.used && playerZ > 250 + Math.random() * 400) {
        this.eclipseState.active = true;
        this.eclipseState.used = true;
        this.eclipseState.t = 0;
        this.hud.toast('月食降临！能见度下降，盯紧坑沿光环', 2200);
      }
      if (this.eclipseState.active) {
        this.eclipseState.t += dt;
        const t = this.eclipseState.t;
        let dark;
        if (t < 2) dark = t / 2;                    // 2s 渐暗
        else if (t < 20) dark = 1;                   // 16s 全暗
        else if (t < 22) dark = 1 - (t - 20) / 2;    // 2s 恢复
        else { this.eclipseState.active = false; dark = 0; }
        result.eclipseDark = dark;
        if (sun && ambient) {
          sun.intensity = 1.6 * (1 - dark * 0.75);
          ambient.intensity = 0.55 * (1 - dark * 0.45);
        }
      }
    }

    // === 地出彩蛋（每关一次）===
    // 按"累计时间"每秒判定一次固定概率：避免逐帧判定导致高刷屏（144Hz）触发率翻倍
    if (!this.earthriseDone) {
      this._earthriseAcc = (this._earthriseAcc || 0) + dt;
      if (this._earthriseAcc >= 1) {
        this._earthriseAcc = 0;
        if (playerZ > 12 && Math.random() < 0.02) {
          this.earthriseDone = true;
          this.hud.toast('地出！——阿波罗 8 号名场面', 2600);
          this.audio.record();
        }
      }
    }

    return result;
  }

  _spawnMeteor(z) {
    const x = (Math.random() - 0.5) * 3.5;
    // 预警红圈
    const markerGeo = new THREE.RingGeometry(Config.meteorRadius * 0.7, Config.meteorRadius, 20);
    markerGeo.rotateX(-Math.PI / 2);
    const marker = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0xff4a3d, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
    marker.position.set(x, 0.06, z);
    this.group.add(marker);
    // 陨石本体（预警期悬在高空缓慢下压视觉）
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.5, 0),
      new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.9, flatShading: true, emissive: 0x3a1a0a, emissiveIntensity: 0.6 })
    );
    mesh.position.set(x, 14, z);
    this.group.add(mesh);
    this.warnings.push({ x, z, elapsed: 0, landed: false, hitDone: false, mesh, marker, startPos: 14 });
    this.audio.meteorWarn();
    this.hud.toast('陨石雨预警！远离红色落点', 1600);
  }

  _disposeWarning(w) {
    this.group.remove(w.mesh); w.mesh.geometry.dispose(); w.mesh.material.dispose();
    this.group.remove(w.marker); w.marker.geometry.dispose(); w.marker.material.dispose();
    w._dead = true;
  }
}
