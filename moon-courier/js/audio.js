// audio.js — Web Audio 合成音效（无音频文件依赖，控制包体）
// 起跳"咻" / 落地"噗" / Perfect"叮" / 连击五声音阶升调 / 死亡无线电杂音

export class AudioFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
  }

  // 首次用户交互后初始化（浏览器自动播放策略要求）
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  _osc({ freq = 440, type = 'sine', dur = 0.2, vol = 0.4, slideTo = null, delay = 0 }) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain); gain.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  _noise({ dur = 0.3, vol = 0.3, filterFreq = 800, delay = 0 }) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start(t0);
  }

  // 起跳"咻"：短促上滑音（闯山虎加倍霸气）
  jump(power = 1, charId = null) {
    this.ensure();
    const boost = charId === 'tiger' ? 1.6 : 1;
    this._osc({ freq: (280 + power * 120), type: 'triangle', dur: 0.18, vol: 0.3 * boost, slideTo: 620 + power * 260 });
    if (charId === 'tiger') this._osc({ freq: 160, type: 'sawtooth', dur: 0.14, vol: 0.22, slideTo: 90 });
  }

  // 蓄力中：低频嗡鸣（略）
  charge() {}

  // 落地月尘"噗"：低频闷响 + 噪声
  land() {
    this.ensure();
    this._osc({ freq: 160, type: 'sine', dur: 0.12, vol: 0.35, slideTo: 70 });
    this._noise({ dur: 0.15, vol: 0.12, filterFreq: 500 });
  }

  // 跳过坑：轻"叮"确认
  cross() {
    this.ensure();
    this._osc({ freq: 660, type: 'sine', dur: 0.12, vol: 0.25 });
  }

  // Perfect：清脆"叮"+高频泛音（金色光环时刻）
  perfect() {
    this.ensure();
    this._osc({ freq: 880, type: 'sine', dur: 0.16, vol: 0.4 });
    this._osc({ freq: 1320, type: 'sine', dur: 0.22, vol: 0.25, delay: 0.05 });
    this._osc({ freq: 1760, type: 'sine', dur: 0.28, vol: 0.12, delay: 0.1 });
  }

  // 连击升调：五声音阶（宫商角徵羽）逐级上升
  comboStreak(combo) {
    this.ensure();
    // 宫 商 角 徵 翻 五声音阶频率（C D E G A）
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0];
    const idx = Math.min(scale.length - 1, Math.max(0, combo - 3));
    this._osc({ freq: scale[idx], type: 'sine', dur: 0.14, vol: 0.3 });
  }

  // 断连：下降小滑音（轻微失落感，不刺耳）
  comboBreak() {
    this.ensure();
    this._osc({ freq: 400, type: 'triangle', dur: 0.2, vol: 0.18, slideTo: 220 });
  }

  // 百科卡弹出：摩斯电码风格"嘀嗒"
  codexCard() {
    this.ensure();
    this._osc({ freq: 1200, type: 'square', dur: 0.045, vol: 0.1 });
    this._osc({ freq: 900, type: 'square', dur: 0.05, vol: 0.1, delay: 0.09 });
  }

  // 死亡：无线电杂音"滋……信号丢失" + 低沉；小黄鸭替换为 squeak 嘎吱
  die(charId = null) {
    this.ensure();
    if (charId === 'duck') {
      // 橡皮鸭 squeak：高频挤压颤音（纯快乐）
      this._osc({ freq: 900, type: 'square', dur: 0.12, vol: 0.3, slideTo: 1400 });
      this._osc({ freq: 1200, type: 'square', dur: 0.15, vol: 0.25, slideTo: 700, delay: 0.14 });
      return;
    }
    this._noise({ dur: 0.5, vol: 0.35, filterFreq: 1400 });
    this._osc({ freq: 220, type: 'sawtooth', dur: 0.6, vol: 0.15, slideTo: 60, delay: 0.1 });
  }

  // 驿站点亮：温暖上行双音
  postLit() {
    this.ensure();
    this._osc({ freq: 660, type: 'sine', dur: 0.2, vol: 0.3 });
    this._osc({ freq: 990, type: 'sine', dur: 0.3, vol: 0.28, delay: 0.12 });
  }

  // 通关结算：凯旋四连音
  levelClear() {
    this.ensure();
    [523, 659, 784, 1047].forEach((f, i) => this._osc({ freq: f, type: 'triangle', dur: 0.3, vol: 0.32, delay: i * 0.12 }));
    this._osc({ freq: 1319, type: 'sine', dur: 0.5, vol: 0.25, delay: 0.5 });
  }

  // 陨石雨预警：急促三连警示音
  meteorWarn() {
    this.ensure();
    for (let i = 0; i < 3; i++) {
      this._osc({ freq: 880, type: 'square', dur: 0.09, vol: 0.2, delay: i * 0.14 });
    }
  }

  // 成就解锁：清亮上行三音
  achieve() {
    this.ensure();
    [784, 988, 1319].forEach((f, i) => this._osc({ freq: f, type: 'sine', dur: 0.22, vol: 0.3, delay: i * 0.1 }));
  }

  // 星屑收集：轻快小叮
  shard() {
    this.ensure();
    this._osc({ freq: 1560, type: 'sine', dur: 0.08, vol: 0.18 });
  }

  // 月饼收集：中秋味上行双音
  mooncake() {
    this.ensure();
    this._osc({ freq: 659, type: 'triangle', dur: 0.15, vol: 0.28 });
    this._osc({ freq: 988, type: 'triangle', dur: 0.2, vol: 0.24, delay: 0.12 });
  }

  // 商店购买：收银"叮咚"
  buy() {
    this.ensure();
    this._osc({ freq: 523, type: 'sine', dur: 0.12, vol: 0.3 });
    this._osc({ freq: 784, type: 'sine', dur: 0.2, vol: 0.28, delay: 0.1 });
  }

  // 每日挑战开始：特快专递号角
  dailyHorn() {
    this.ensure();
    [392, 523, 659].forEach((f, i) => this._osc({ freq: f, type: 'triangle', dur: 0.28, vol: 0.3, delay: i * 0.15 }));
  }

  // 角色选择：标志性小叫声
  select(charId) {
    this.ensure();
    const map = {
      duck: { freq: 800, slideTo: 1100, type: 'square' },      // 嘎
      rooster: { freq: 700, slideTo: 500, type: 'sawtooth' },  // 喔
      mouse: { freq: 1400, slideTo: 1800, type: 'square' },     // 吱
      dog: { freq: 400, slideTo: 250, type: 'sawtooth' },       // 汪
      sheep: { freq: 500, slideTo: 420, type: 'triangle' },    // 咩
      tiger: { freq: 200, slideTo: 130, type: 'sawtooth' },     // 嗷
      horse: { freq: 600, slideTo: 500, type: 'sawtooth' },     // 咴
      snake: { freq: 1800, slideTo: 2200, type: 'square' },     // 嘶
    };
    const s = map[charId] || { freq: 880, slideTo: 1100, type: 'sine' };
    this._osc({ freq: s.freq, type: s.type, dur: 0.18, vol: 0.28, slideTo: s.slideTo });
  }

  // 破纪录烟花：上行琶音
  record() {
    this.ensure();
    [523, 659, 784, 1047].forEach((f, i) => this._osc({ freq: f, type: 'triangle', dur: 0.25, vol: 0.3, delay: i * 0.09 }));
  }
}
