// player.js — 快递员角色：13 选 1 建模 + 自动跑 + 跳跃物理 + 动画
// M3：外观由 characters.js 工厂生成；轻特性由 Game 应用
import * as THREE from 'three';
import { Config } from './config.js';
import { buildCharacter, getCharacter } from './characters.js';

export class Player {
  constructor(characterId = 'rabbit') {
    this.charId = characterId;
    this.group = new THREE.Group();
    this.build(characterId);
    this.reset();
  }

  build(characterId) {
    // 清空重建（换角用）
    while (this.group.children.length) {
      const c = this.group.children[0];
      this.group.remove(c);
    }
    const { group, refs } = buildCharacter(characterId);
    // 把工厂产物并入 this.group（保留外部对 group 的引用）
    for (const child of [...group.children]) this.group.add(child);
    this.refs = refs;
    this.charId = characterId;
    this.charInfo = getCharacter(characterId);
  }

  // 换角色
  changeCharacter(id) {
    this.build(id);
    this.reset();
  }

  reset() {
    this.group.position.set(0, Config.groundY, 0);
    this.vy = 0;
    this.x = 0;               // M5.2 横移位置
    this.airOffsetX = 0;
    this.onGround = true;
    this.isDead = false;
    this.distance = 0;
    this.runPhase = 0;
    this.flutterPhase = 0;
  }

  // 从驿站复活（distance 继续而非归零）
  respawnAt(z) {
    this.group.position.set(0, Config.groundY, 0);
    this.vy = 0;
    this.x = 0;
    this.airOffsetX = 0;
    this.onGround = true;
    this.isDead = false;
    this.distance = z;
  }

  jump(velY) {
    if (!this.onGround || this.isDead) return false;
    this.vy = velY;
    this.onGround = false;
    return true;
  }

  update(dt, dir, opts = {}) {
    if (this.isDead) return;

    // 自动前跑（速度 = 基础速度 × 关卡系数）
    const speed = opts.speed ?? Config.runSpeed;
    this.distance += speed * dt;

    // === M5.2 横移躲避：地面/空中全程速度型移动（落地不归零，位置保留） ===
    const latBase = this.onGround
      ? (opts.lateralGround ?? Config.lateralGround)
      : (opts.lateralAir ?? Config.lateralAir) * (opts.airMult ?? 1);
    this.x = Math.max(-Config.lateralMax, Math.min(Config.lateralMax, (this.x || 0) + dir * latBase * dt));
    this.group.position.x = this.x;

    // 重力积分
    if (!this.onGround) {
      this.vy -= Config.gravity * dt;
      this.group.position.y += this.vy * dt;

      if (this.group.position.y <= Config.groundY) {
        this.group.position.y = Config.groundY;
        this.vy = 0;
        this.onGround = true;
        this.airOffsetX = this.x;   // 保留横向位置（不再强制回中）
      }
    }

    // 动画
    const r = this.refs;
    if (this.onGround) {
      this.runPhase += dt * 12;
      const swing = Math.sin(this.runPhase) * 0.25;
      if (r.legL) r.legL.rotation.x = swing;
      if (r.legR) r.legR.rotation.x = -swing;
      if (r.body) r.body.position.y = 0.55 + Math.abs(Math.sin(this.runPhase)) * 0.04;
      if (r.earL) { r.earL.rotation.x = 0.1 + Math.sin(this.runPhase) * 0.05; r.earR.rotation.x = 0.1 - Math.sin(this.runPhase) * 0.05; }
      // 蛇：S 形跑动韵律
      if (this.charId === 'snake' && r.tail) {
        r.tail.rotation.y = Math.sin(this.runPhase * 0.8) * 0.35;
      }
      // 鸭：摇摆步
      if (this.charId === 'duck') {
        this.group.rotation.z = Math.sin(this.runPhase * 0.6) * 0.06;
      } else {
        this.group.rotation.z = 0;
      }
    } else {
      // 滞空：标志性部件夸张漂浮（低重力感）
      this.flutterPhase += dt * 4;
      if (r.earL) { r.earL.rotation.x = -0.5 + Math.sin(this.flutterPhase) * 0.15; r.earR.rotation.x = -0.5 - Math.sin(this.flutterPhase) * 0.15; }
      if (r.legL) { r.legL.rotation.x = -0.4; r.legR.rotation.x = -0.4; }
      // 猴：空中翻跟头
      if (this.charId === 'monkey') {
        this.group.rotation.x = -Math.min(2, this.flutterPhase * 1.2);
      } else {
        this.group.rotation.x = 0;
      }
      // 鸭：翅膀扑扇
      if (this.charId === 'duck' && r.wingL) {
        r.wingL.rotation.z = Math.sin(this.flutterPhase * 2) * 0.5;
        r.wingR.rotation.z = -Math.sin(this.flutterPhase * 2) * 0.5;
      }
      // 蛇：滞空舒展
      if (this.charId === 'snake' && r.tail) {
        r.tail.rotation.y = Math.sin(this.flutterPhase) * 0.5;
      }
    }
  }

  die() {
    this.isDead = true;
  }
}
