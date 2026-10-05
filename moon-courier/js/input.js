// input.js — 输入处理：键盘 + 触屏；蓄力计时
import { Config } from './config.js';

export class Input {
  constructor() {
    this.dir = 0;            // 横向 -1/0/1
    this.jumpQueued = false;       // 一次性小跳请求
    this.chargeStart = null;       // 蓄力开始时间戳（毫秒）
    this.chargeRelease = false;    // 蓄力松开请求
    this.paused = false;

    this._bind();
  }

  _bind() {
    // === 键盘 ===
    window.addEventListener('keydown', (e) => {
      // 输入框内不拦截（首启引导填写昵称）
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.repeat) return;
      switch (e.code) {
        case 'Space': case 'ArrowUp': case 'KeyW':
          e.preventDefault();
          if (this.chargeStart === null) this.chargeStart = performance.now();
          break;
        case 'ArrowLeft': case 'KeyA':
          this.dir = -1; break;
        case 'ArrowRight': case 'KeyD':
          this.dir = 1; break;
        case 'Escape':
          this.paused = !this.paused; break;
      }
    });
    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'Space': case 'ArrowUp': case 'KeyW':
          if (this.chargeStart !== null) {
            this.chargeRelease = true;
          }
          break;
        case 'ArrowLeft': case 'KeyA':
          if (this.dir === -1) this.dir = 0; break;
        case 'ArrowRight': case 'KeyD':
          if (this.dir === 1) this.dir = 0; break;
      }
    });

    // === 触屏/鼠标（Pointer Events 统一：手机触摸 + 桌面鼠标点击） ===
  // 手势分离：点按（位移<3px）=跳跃；拖动（≥3px）=横移且取消本次蓄力（M5.2）
    const canvas = document.getElementById('game-canvas');
    let lastX = null;   // 上一次移动点（用"增量"比较，同一次拖动即可左右换向）
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      lastX = e.clientX;
      if (this.chargeStart === null) this.chargeStart = performance.now();
    }, { passive: false });
    canvas.addEventListener('pointermove', (e) => {
      if (lastX === null) return;
      const dx = e.clientX - lastX;
      if (Math.abs(dx) >= 3) {
        this.dir = dx > 0 ? 1 : -1;
        lastX = e.clientX;    // 更新基准点：手指反向时方向立即跟着换（原来只在按下时赋值 → 只能单向）
        // 拖动视为横移手势：取消本次跳跃蓄力（拖完松手不会误跳）
        if (this.chargeStart !== null) this.chargeStart = null;
      }
    }, { passive: false });
    canvas.addEventListener('pointerup', (e) => {
      e.preventDefault();
      lastX = null;
      this.dir = 0;
      if (this.chargeStart !== null) this.chargeRelease = true;
    }, { passive: false });
    canvas.addEventListener('pointercancel', () => {
      lastX = null;
      this.dir = 0;
      if (this.chargeStart !== null) this.chargeRelease = true;
    });
  }

  // 由 Game 每帧调用：返回本帧要执行的动作
  // { jumpVel: number|null, dir: -1/0/1, paused: bool }
  consume() {
    let jumpVel = null;
    const now = performance.now();
    // 长按超过 chargeTime → 视为蓄力跳（按住期间不跳，松开时按蓄力时长决定初速）
    // 短按（点按 < 120ms 释放）→ 小跳
    if (this.chargeRelease) {
      const held = (now - this.chargeStart) / 1000;   // 秒
      if (held < 0.12) {
        // 短按：小跳
        jumpVel = Config.jumpVelMin;
      } else {
        // 蓄力：按 held 比例映射到 [jumpVelMin, jumpVelMax]
        const t = Math.min(1, held / Config.chargeTime);
        jumpVel = Config.jumpVelMin + (Config.jumpVelMax - Config.jumpVelMin) * t;
      }
      this.chargeStart = null;
      this.chargeRelease = false;
    }
    const out = { jumpVel, dir: this.dir, paused: this.paused };
    return out;
  }

  // 蓄力进度 0-1（HUD 显示）
  chargeProgress() {
    if (this.chargeStart === null) return 0;
    const held = (performance.now() - this.chargeStart) / 1000;
    return Math.min(1, held / Config.chargeTime);
  }

  isCharging() {
    return this.chargeStart !== null;
  }

  reset() {
    this.dir = 0;
    this.jumpQueued = false;
    this.chargeStart = null;
    this.chargeRelease = false;
    this.paused = false;
  }
}
