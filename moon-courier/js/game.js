// game.js — 主入口（M4：关卡/无尽/每日三模式 + 商店/成就/排行/事件/星屑/氧气全系统接线）
// M4.5：天空特效(流星/地球自转) + 跑道周期循环 + 岩石滚动；M5-1：帧率自适应降画质
import * as THREE from 'three';
import GUI from 'lil-gui';
import { Config } from './config.js';
import { createScene } from './scene.js';
import { MeteorShower } from './skyfx.js';
import { Player } from './player.js';
import { PitManager } from './pit.js';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { Codex } from './codex.js';
import { AudioFX } from './audio.js';
import { Effects } from './effects.js';
import { SaveManager } from './save.js';
import { PostManager } from './post.js';
import { getLevel, LEVELS, ENDLESS, DAILY } from './levels.js';
import { getCharacter } from './characters.js';
import { Shop } from './shop.js';
import { AchievementSystem } from './achievements.js';
import { Ranking, mulberry32, dateSeed, todayStr } from './ranking.js';
import { EventManager, isMidAutumn } from './events.js';
import { ShardManager } from './shards.js';
import { Hazards } from './hazard.js';
import { generateBattleCard, downloadBattleCard } from './battlecard.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.save = new SaveManager();
    this.hud = new HUD(this.save);
    this.input = new Input();
    this.audio = new AudioFX();
    this.audio.enabled = this.save.data.settings.sfx;
    this.shop = new Shop(this.save);
    this.achv = new AchievementSystem(this.save, this.hud, this.audio);
    this.rank = new Ranking(this.save, this.hud, this.audio);
    this.events = null;

    // 对局状态
    this.state = 'boot';
    this.mode = 'level';        // level | endless | daily
    this.dust = 0;
    this.combo = 0;
    this.level = null;
    this.deaths = 0;
    this.levelSpeed = Config.runSpeed;
    this.oxygen = null;
    this.dailyTimeLeft = null;
    this.runStats = { jumps: 0, pits: 0, legends: [], comboMax: 0, distStart: 0 };
    this.shieldUsedThisRun = false;

    // M5-1 性能自适应：帧率监控
    this.quality = 0;                 // 0=高 1=中 2=低 3=极低
    this._fpsAcc = 0; this._fpsFrames = 0; this._lowFpsStreak = 0; this._lastDegrade = 0;

    this.init3D();
    this.initGUI();
    this.applyPerks();
    // 暂停按钮（HUD 内，仅对局时可见）：与 Esc 等效
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) pauseBtn.onclick = () => { if (this.state === 'playing') this.input.paused = true; };
    this.route();
  }

  init3D() {
    const env = createScene(this.canvas);
    this.renderer = env.renderer;
    this.scene = env.scene;
    this.camera = env.camera;
    this.sun = env.sun;
    this.ambient = env.ambient;
    this.moon = env.moon;
    this.earthUpdate = env.earthUpdate;     // 地球自转
    this.starsBright = env.starsBright;      // 亮星材质（skyfx 闪烁）
    this.updateRocks = env.updateRocks;     // 岩石逐颗循环
    this.setQualityFn = env.setQuality;     // M5-1 动态画质降级
    this.skyfx = new MeteorShower(this.scene);
    this.player = new Player(this.save.data.character);
    this.scene.add(this.player.group);
    this.codex = new Codex(this.save);
    this.pits = new PitManager(this.scene, this.codex);
    this.posts = new PostManager(this.scene);
    this.shards = new ShardManager(this.scene);
    this.hazards = new Hazards(this.scene, this.audio, this.hud);
    this.effects = new Effects(this.scene, this.player);
    this.events = new EventManager(this.scene, this.hud, this.audio);

    // 星屑收集回调
    this.shards.onCollect = (s) => {
      if (s.mooncake) {
        this.dust += Config.mooncakeDust;
        this.audio.mooncake();
        this.hud.popDust(Config.mooncakeDust, false);
        this.hud.toast('中秋月饼 +50 月尘！', 1400);
      } else {
        const gain = Math.floor(Config.shardDust * this.perkDust);
        this.dust += gain;
        this.audio.shard();
        this.hud.popDust(gain, false);
      }
    };
    // 坑生成时散布星屑
    this.pits.hookSpawn((pit) => {
      this.shards.spawnForPit(pit.z, pit.halfW);
    });
  }

  initGUI() {
    // 调参面板只在开发模式显示（地址追加 ?dev=1 或 #dev 打开），避免正式版玩家误触
    const dev = /(?:^|[?&#])dev\b/.test(location.search + location.hash);
    if (!dev) { this.gui = null; return; }
    this.gui = new GUI({ title: '调参面板（开发）' });
    const f = this.gui.addFolder('物理');
    f.add(Config, 'gravity', 0.4, 16, 0.1).name('月球重力');
    f.add(Config, 'jumpVelMax', 4, 16, 0.1).name('蓄力满初速');
    const fEvt = this.gui.addFolder('事件/演示');
    fEvt.add(Config, 'midAutumnPreview').name('中秋限定预览');
    f.close(); fEvt.close();
  }

  applyPerks() {
    const c = getCharacter(this.player.charId);
    const p = c.perk;
    this.perkJump = p?.type === 'jump' ? p.value : 1;
    this.perkTolerance = p?.type === 'tolerance' ? p.value : 0;
    this.perkAir = p?.type === 'air' ? p.value : 1;
    this.perkDust = p?.type === 'dust' ? p.value : 1;
  }

  route() {
    if (this.save.isNewPlayer) {
      this.state = 'setup';
      this.hud.showSetup(this.audio, (nick, charId) => {
        this.save.setNickname(nick);
        this.save.setCharacter(charId);
        this.player.changeCharacter(charId);
        this.effects.rebuildGhosts();     // 连击拖尾残影随新角色重建
        this.applyPerks();
        this.audio.select(charId);
        this.achv.onCharacterChange();
        // 报晓鸡：每天首局打鸣彩蛋
        this.checkRooster();
        this.toMenu();
      });
    } else {
      this.toMenu();
    }
  }

  checkRooster() {
    if (this.player.charId !== 'rooster') return;
    const today = todayStr();
    if (this.save.data.stats.lastRoosterDay !== today) {
      this.save.data.stats.lastRoosterDay = today;
      this.save.flushStats();
      this.hud.toast('喔喔喔——今日开工！', 1800);
      this.audio.select('rooster');
    }
  }

  toMenu() {
    this.state = 'menu';
    this._pauseShown = false;
    this.input.paused = false;
    this.save.flushNow();                 // 回菜单时把统计累计值落盘
    this.hud.onBackToMenu(() => this.toMenu());
    this.hud.showMenu({
      onLevels: () => this.showLevelSelect(),
      onEndless: () => this.startEndless(),
      onDaily: () => this.startDaily(),
      onChar: () => this.showCharSelect(),
      onShop: () => this.hud.showShop(this.shop, this.audio, () => this.toMenu()),
      onCodex: () => this.hud.showCodex(this.codex, this.achv, () => this.toMenu()),
      onAchv: () => this.hud.showAchievements(this.achv, () => this.toMenu()),
      onRank: () => this.hud.showRanking(this.save, () => this.toMenu()),
      onSfx: () => {
        const sfx = !this.save.data.settings.sfx;
        this.save.setSetting('sfx', sfx);
        this.audio.enabled = sfx;
        this.hud.toast(`音效已${sfx ? '开启' : '关闭'}`);
        this.toMenu();
      },
      onBackup: () => this.hud.showBackup(() => this.toMenu()),
      onAbout: () => this.hud.showAbout(),
    });
  }

  showLevelSelect() {
    this.state = 'menu';
    this.hud.showLevelSelect((levelId, cont) => this.startLevel(levelId, cont));
  }

  showCharSelect() {
    this.state = 'menu';
    this.hud.showCharSelect(this.audio,
      (charId) => {
        this.save.setCharacter(charId);
        this.player.changeCharacter(charId);
        this.effects.rebuildGhosts();     // 连击拖尾残影随新角色重建
        this.applyPerks();
        this.achv.onCharacterChange();
        this.checkRooster();
        this.hud.toast(`已换角：${getCharacter(charId).name}`);
        this.toMenu();
      },
      () => this.toMenu());
  }

  // ============ 关卡 ============
  startLevel(levelId, continueFromPost = false) {
    this.mode = 'level';
    this.level = getLevel(levelId);
    this.beginRun(continueFromPost);
  }

  // ============ 无尽模式 ============
  startEndless() {
    this.mode = 'endless';
    this.level = {
      id: 'endless', name: ENDLESS.name, intro: ENDLESS.intro,
      length: Infinity, speedMult: 1.0,
      pitPlan: ENDLESS.pitPlanAt(0), gapRange: ENDLESS.gapRange,
      hazard: { interval: [12, 20], speed: [9, 13] },
      oxygen: ENDLESS.oxygen, meteor: ENDLESS.meteor, eclipse: ENDLESS.eclipse,
      dustThreshold: 0,
    };
    this.beginRun(false);
  }

  // ============ 每日挑战 ============
  startDaily() {
    this.mode = 'daily';
    this.audio.dailyHorn();
    this.level = {
      id: 'daily', name: DAILY.name, intro: `今日特快——全球同路线，限时 ${DAILY.timeLimit} 秒，一局定成绩！`,
      length: Infinity, speedMult: 1.0,
      pitPlan: { wide: 0.2, twin: 0.15, rolling: 0.1, bounce: 0.05, collapse: 0, abyss: 0 },
      gapRange: [7, 12],
      hazard: { interval: [14, 20], speed: [9, 12] },
      oxygen: false, meteor: false, eclipse: false,
      dustThreshold: 0,
    };
    this.dailyTimeLeft = DAILY.timeLimit;
    // 日期种子：所有玩家同一坑布局
    this.pits.setRng(mulberry32(dateSeed()));
    this.beginRun(false);
  }

  // 通用开局
  beginRun(continueFromPost) {
    this.levelSpeed = Config.runSpeed * this.level.speedMult;
    this.pits.setLevel(this.level);
    this.pits.reset();
    if (this.mode === 'daily') this.pits.setRng(mulberry32(dateSeed()));
    else this.pits.setRng(Math.random);

    // 驿站：关卡=固定；无尽/每日=动态生成
    this.posts.reset();
    if (this.mode === 'level') this.posts.buildForLevel(this.level.length);

    this.events.setLevel(this.level);
    this.hazards.setLevel(this.level);
    this.hazards.reset();
    this.effects.reset();
    this.codex.reset();
    this.shards.reset();
    this.input.reset();

    let startZ = 0;
    if (this.mode === 'level') {
      if (continueFromPost) {
        startZ = this.save.getPostReached(this.level.id);
        this.dust = this.save.getLevelDust(this.level.id);
        this.posts.update(startZ, null);
      } else {
        this.save.clearPostReached(this.level.id);
        this.dust = 0;
      }
      this.deaths = continueFromPost ? 1 : 0;
      // 氧气：驿站复活回满
      this.oxygen = this.level.oxygen ? Config.oxygenMax : null;
    } else {
      this.dust = 0;
      this.deaths = 0;
      this.oxygen = null;
      this.dailyTimeLeft = this.mode === 'daily' ? DAILY.timeLimit : null;
    }

    this.player.respawnAt(startZ);
    this.pits.nextZ = startZ + 18;
    this.prevPlayerZ = startZ;
    this.combo = 0;
    this.shieldUsedThisRun = false;
    this.runStats = { jumps: 0, pits: 0, legends: [], comboMax: 0, distStart: startZ };
    // 中秋限定：跑道撒月饼
    if (isMidAutumn() && this.mode !== 'daily') {
      for (let z = startZ + 30; z < startZ + 200; z += 35) this.shards.spawnMooncake(z);
    }

    this.state = 'playing';
    this.hud.hideAll();
    this.hud.showIntro(this.level);
    this.hud.update(startZ, this.dust, 0);
    this.hud.updateOxygen(this.oxygen, Config.oxygenMax);
    this.hud.setDailyTimer(this.dailyTimeLeft);
    this.lastTime = performance.now();
  }

  loop = (now) => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    // M5-1：每 0.5s 评估帧率，连续低帧自动降画质（15s 冷却）
    this._fpsAcc += dt; this._fpsFrames++;
    if (this._fpsAcc >= 0.5) {
      const fps = this._fpsFrames / this._fpsAcc;
      this._fpsAcc = 0; this._fpsFrames = 0;
      if (fps < 22) { this._lowFpsStreak++; }
      else if (fps >= 30) { this._lowFpsStreak = 0; }
      if (this._lowFpsStreak >= 2 && this.quality < 3 && this.setQualityFn && (now - this._lastDegrade) > 15000) {
        this.quality++;
        this.setQualityFn(this.quality);
        this._lastDegrade = now;
        this._lowFpsStreak = 0;
        console.log('[M5] 帧率偏低，画质自动降档 → ' + this.quality);
      }
    }
    // 天空特效（流星 + 亮星闪烁）与地球自转：任何状态都持续（菜单背景也生动）
    if (this.skyfx) this.skyfx.update(dt, this.starsBright);
    if (this.earthUpdate) this.earthUpdate(dt);
    if (this.state === 'playing') {
      if (this.input.paused) {
        if (!this._pauseShown) this.enterPause();   // 暂停界面（Esc / 手机右上角按钮）
      } else {
        if (this._pauseShown) this.exitPause();
        this.update(dt);
      }
    }
    this.renderer.render(this.scene, this.camera);
  };

  // ============ 暂停 ============
  enterPause() {
    this._pauseShown = true;
    this.hud.showPause(
      () => { this.input.paused = false; },                       // 继续（下一帧走 exitPause 分支）
      () => this.restartRun(),                                    // 重开本局
      () => { this.input.paused = false; this.toMenu(); }         // 回主菜单
    );
  }

  exitPause() {
    this._pauseShown = false;
    this.hud.hideAll();
    this.lastTime = performance.now();   // 避免暂停期间累积 dt 造成瞬移
  }

  restartRun() {
    this.input.paused = false;
    this._pauseShown = false;
    if (this.mode === 'daily') this.startDaily();
    else if (this.mode === 'endless') this.startEndless();
    else this.startLevel(this.level.id, false);
  }

  comboMultiplier() {
    for (const { n, m } of Config.comboMult) {
      if (this.combo >= n) return m;
    }
    return 1;
  }

  update(dt) {
    const action = this.input.consume();

    // 起跳
    if (action.jumpVel !== null) {
      let vel = action.jumpVel * this.perkJump;
      if (vel > Config.jumpVelMin) vel *= this.shop.bootsMult();   // 强化鞋只增益蓄力段
      const power = (action.jumpVel - Config.jumpVelMin) / (Config.jumpVelMax - Config.jumpVelMin);
      if (this.player.jump(vel)) {
        this.audio.jump(power, this.player.charId);
        this.effects.dustBurst(12, 0.7);
        this.runStats.jumps += 1;
        this.achv.onJump();
      }
    }

    const prevZ = this.prevPlayerZ;
    const wasOnGround = this.player.onGround;
    const prevDist = this.player.distance;

    // 深渊引力（影响本帧积分）
    const pull = this.pits.abyssPull(this.player.distance, this.player.group.position.y);
    if (pull && !this.player.onGround) this.player.vy -= pull * dt;

    this.player.update(dt, action.dir, {
      speed: this.levelSpeed,
      lateralGround: Config.lateralGround,               // M5.2 地面横移
      lateralAir: Config.lateralAir * this.perkAir,      // 空中横移（角色 perk 强化）
    });
    const curZ = this.player.distance;
    this.prevPlayerZ = curZ;

    // 统计：累计距离
    this.achv.onDistanceRun(curZ - prevDist);

    // 落地：音效 + 扬尘 + 弹力坑检测
    if (!wasOnGround && this.player.onGround) {
      this.audio.land();
      this.effects.dustBurst(this.player.charId === 'sheep' ? 24 : 16, 1.0);
      const kick = this.pits.bounceCheck(curZ);
      if (kick > 0) {
        this.player.jump(kick);
        this.audio.jump(0.8, this.player.charId);
        this.hud.toast('弹力坑！被弹起来了！', 1000);
      }
    }

    // 坑维护与判定
    this.pits.update(curZ, dt);
    if (prevZ !== undefined) {
      const res = this.pits.check(
        curZ, this.player.group.position.y, prevZ,
        this.perkTolerance + (this.level?.toleranceBonus || 0),
        { vy: this.player.vy, speed: this.levelSpeed }
      );
      if (res.crossedPit) {
        this.onPitCrossed(res.crossedPit, res.perfect);
        // 同一帧越过多个坑（双子坑等）：补发其余坑的月尘与图鉴，不重复计连击
        if (res.results && res.results.length > 1) {
          for (let i = 1; i < res.results.length; i++) {
            const p = res.results[i].pit;
            const base = Config.dustBase[p.entry.rarity] ?? 10;
            const gain = Math.floor(base * this.perkDust);
            this.dust += gain;
            this.runStats.pits += 1;
            this.codex.collect(p.entry, { perfect: false });
            this.hud.popDust(gain, false);
          }
        }
      } else if (res.died) {
        // 月壤护盾：掉坑瞬间弹回坑沿（陨石雨/迎面陨石撞击不可保）
        if (!this.shieldUsedThisRun && this.shop.shieldCount() > 0 && res.cause !== 'meteor' && res.cause !== 'hazard') {
          this.shop.useShield();
          this.shieldUsedThisRun = true;
          this.rescueFromPit(res);
        } else {
          this.die(res.cause || 'pit');
          return;
        }
      }
    }

    // M5.2 迎面陨石：撞击判定（左右横移躲避）
    const hz = this.hazards.update(curZ, this.player.group.position.x, dt);
    if (hz.hit) {
      this.die('hazard');
      return;
    }

    // 星屑
    this.shards.update(curZ, this.player.group.position.y, dt, this.shop.magnetMult());

    // 驿站（关卡模式存档点亮；无尽模式只做视觉+复活参考不存档）
    const litZ = this.posts.update(curZ, null, this.mode !== 'level');
    if (litZ) {
      this.audio.postLit();
      if (this.mode === 'level') {
        this.save.setPostReached(this.level.id, litZ);
        this.hud.toast('驿站已点亮 · 进度已保存');
      } else {
        this.hud.toast('驿站已点亮（补给）');
      }
      if (this.oxygen !== null) this.oxygen = Config.oxygenMax;   // 驿站补氧
    }

    // 氧气消耗（关7+）
    if (this.oxygen !== null) {
      this.oxygen -= (curZ - prevDist) * Config.oxygenPerMeter * this.shop.maskMult();
      if (this.oxygen <= 0) {
        if (this.shop.hasTank()) {
          this.shop.useTank();
          this.oxygen = Config.oxygenMax;
          this.hud.toast('氧气瓶自动补满！', 1500);
          this.audio.postLit();
        } else {
          this.die('oxygen');
          return;
        }
      }
    }

    // 环境事件（陨石雨/月食/地出）
    const evt = this.events.update(dt, curZ, this.player.group.position.x, this.player.group.position.y, this.sun, this.ambient, this.levelSpeed);
    if (evt.meteorHit) {
      this.die('meteor');
      return;
    }

    // 每日挑战计时
    if (this.dailyTimeLeft !== null) {
      this.dailyTimeLeft -= dt;
      if (this.dailyTimeLeft <= 10.5 && this.dailyTimeLeft > 10) this.hud.toast('最后 10 秒！', 1200);
      if (this.dailyTimeLeft <= 0) {
        this.finishDaily(true);
        return;
      }
    }

    // 无尽模式：动态速度与坑型权重
    if (this.mode === 'endless') {
      const mult = ENDLESS.speedAt(curZ);
      this.levelSpeed = Config.runSpeed * mult;
      this.level.pitPlan = ENDLESS.pitPlanAt(curZ);
      this.pits.pitWidthScale = mult;   // 坑宽随速度等比放大 → 射程/坑宽比恒定
    }

    // 通关判定（仅关卡模式）
    if (this.mode === 'level' && curZ >= this.level.length) {
      this.finishLevel();
      return;
    }

    // 地形流动 + 相机
    // 跑道平面固定不动（覆盖玩家视野 [-100,300]），前进感由坑/岩石/星屑沿 -z 后退提供
    this.pits.group.position.z = -curZ;
    if (this.updateRocks) this.updateRocks(curZ);
    this.camera.position.z = -Config.cameraBack;
    this.camera.position.x = this.player.group.position.x * 0.3;
    this.camera.lookAt(this.player.group.position.x * 0.5, 1, Config.cameraLookAhead);

    this.effects.update(dt);
    this.hud.update(this.player.distance, this.dust, this.combo);
    this.hud.updateOxygen(this.oxygen, Config.oxygenMax);
    this.hud.setDailyTimer(this.dailyTimeLeft);
    this.hud.updateCharge(this.input.chargeProgress(), this.input.isCharging());

    const np = this.pits.pits.find(p => !p.crossed);
    window.__dbg = { dist: this.player.distance, nextPit: np ? np.z : null, combo: this.combo, dust: this.dust, state: this.state, mode: this.mode, oxygen: this.oxygen };
  }

  // 护盾救援：弹回坑沿
  rescueFromPit() {
    // 找到玩家所在的坑，弹到坑后沿
    let target = null;
    for (const p of this.pits.pits) {
      if (!p.crossed && this.player.distance > p.z - p.halfW && this.player.distance < p.z + p.halfW) {
        target = p; break;
      }
    }
    if (target) {
      target.crossed = true;   // 标记已处理（护盾救场不给奖励）
      this.player.distance = target.z + target.halfW + 0.4;
    } else {
      this.player.distance += 2;
    }
    this.player.group.position.y = 0.6;
    this.player.vy = 2;
    this.player.onGround = false;
    this.prevPlayerZ = this.player.distance;
    this.effects.burstRing();
    this.hud.toast('月壤护盾生效！', 1500);
    this.audio.perfect();
  }

  // 跳坑结算
  onPitCrossed(pit, perfect) {
    const entry = pit.entry;
    const base = Config.dustBase[entry.rarity] ?? 10;
    const mult = this.comboMultiplier();

    if (perfect) {
      this.combo += 1;
      this.audio.perfect();
      this.audio.comboStreak(this.combo);
      this.effects.burstRing();
      this.hud.popPerfect();
    } else if (Config.comboBreakOnNonPerfect) {
      if (this.combo >= 3) this.audio.comboBreak();
      this.combo = 0;
      this.audio.cross();
    } else {
      this.audio.cross();
    }
    this.runStats.comboMax = Math.max(this.runStats.comboMax, this.combo);
    this.achv.onCombo(this.combo);

    const gain = (base + (perfect ? Config.dustPerfect : 0)) * mult * this.perkDust;
    this.dust += Math.floor(gain);
    this.runStats.pits += 1;
    if (entry.rarity === 'legend') this.runStats.legends.push(entry.name);
    this.achv.onPitCrossed(entry.rarity, this.runStats.pits);

    this.effects.setTrail(this.combo >= Config.trailAtCombo);
    this.codex.collect(entry, { perfect });
    this.achv.onCodexCollected(this.codex.bookCounts());
    if (perfect || entry.rarity !== 'common') this.audio.codexCard();
    this.hud.popDust(gain, perfect);

    if (this.mode === 'level') this.save.setLevelDust(this.level.id, this.dust);
  }

  // 死亡
  die(cause = 'pit') {
    this.state = 'dead';
    this.deaths += 1;
    this.combo = 0;
    this.audio.die(this.player.charId);
    this.effects.setTrail(false);
    this.save.flushNow();              // 统计类累计值此刻落盘（平时只做节流写入）
    const c = getCharacter(this.player.charId);

    if (this.mode === 'level') {
      this.dust = Math.floor(this.dust * 0.7);
      this.save.setLevelDust(this.level.id, this.dust);
      const hasPost = this.posts.respawnZ() > 0;
      this.hud.showDeath(
        this.player.distance, this.dust, c.quote, hasPost,
        () => this.respawn(),
        () => this.toMenu(),
        () => this.makeBattleCard(c.quote)
      );
    } else if (this.mode === 'endless') {
      // 无尽：本局月尘入账 + 结算入榜
      this.save.addMoonDust(this.dust);
      const isTop = this.rank.submitEndless(this.player.distance, this.dust, this.save.data.nickname, this.player.charId);
      this.achv.onEndlessRun(this.player.distance);
      if (isTop) { this.audio.record(); this.hud.toast('新纪录！榜单登顶！', 2200); }
      this.hud.showEndlessResult('无尽巡游结束', this.player.distance, this.dust, this.runStats.comboMax, c.quote,
        () => this.startEndless(),
        () => this.toMenu(),
        () => this.makeBattleCard(c.quote));
    } else {
      // 每日：结算
      this.finishDaily(false);
    }
  }

  // 每日挑战结算（超时或死亡）
  finishDaily(timeUp) {
    this.state = 'dead';
    const dist = this.player.distance;
    const streak = this.save.completeDaily(todayStr(), Math.floor(dist));
    const bonus = 100;                       // 完成奖励
    this.save.addMoonDust(Math.floor(this.dust) + bonus);   // 本局月尘 + 完成奖励，一并入账
    this.save.flushNow();
    const isTop = this.rank.submitDaily(dist, this.dust, this.save.data.nickname, this.player.charId);
    this.achv.onDailyComplete(streak, isTop);
    const c = getCharacter(this.player.charId);
    this.audio.levelClear();
    const backToMenu = () => this.toMenu();
    this.hud.showEndlessResult(
      timeUp ? '今日特快 · 时间到！' : '今日特快 · 派送中断',
      dist, this.dust + bonus, this.runStats.comboMax,
      `连续完成 ${streak} 天${isTop ? ' · 今日单王！' : ''}（+${bonus} 月尘）`,
      backToMenu,
      backToMenu,
      () => this.makeBattleCard(c.quote)
    );
  }

  // 驿站复活
  respawn() {
    const z = this.posts.respawnZ();
    this.player.respawnAt(z);
    this.pits.reset();
    this.pits.nextZ = z + 15;
    this.shards.reset();
    this.hazards.reset();   // 复活清场：避免复活瞬间被迎面陨石撞死
    this.prevPlayerZ = z;
    this.combo = 0;
    this.codex.reset();
    this.effects.reset();
    this.input.reset();
    this.shieldUsedThisRun = false;
    if (this.oxygen !== null) this.oxygen = Config.oxygenMax;
    this.hud.hideAll();
    this.hud.toast(z > 0 ? `从 ${z}m 驿站复活 · 月尘损失 30%` : '从起点重新出发');
    this.state = 'playing';
    this.lastTime = performance.now();
    this.save.flushNow();
  }

  // 通关结算
  finishLevel() {
    this.state = 'clear';
    const lv = this.level;
    const dustOk = this.dust >= lv.dustThreshold;
    const noDeath = this.deaths === 0;
    const stars = 1 + (dustOk ? 1 : 0) + (noDeath ? 1 : 0);

    this.save.setStars(lv.id, stars);
    const bonus = stars === 3 ? 200 : 0;      // 三星满勤奖励
    this.save.addMoonDust(this.dust + bonus);
    this.save.flushNow();
    this.save.clearPostReached(lv.id);
    this.save.unlockLevel(lv.id + 1);
    this.achv.onLevelClear(lv.id);
    const isTop = this.rank.submitLevel(lv.id, this.player.distance, this.dust, this.save.data.nickname, this.player.charId);
    if (isTop) { this.audio.record(); }
    this.audio.levelClear();
    this.effects.setTrail(false);

    const hasNext = lv.id < LEVELS.length;
    this.hud.showClear(
      lv, stars, this.dust, bonus, dustOk, noDeath, hasNext,
      () => this.startLevel(lv.id + 1, false),
      () => this.startLevel(lv.id, false),
      () => this.toMenu(),
      () => this.makeBattleCard(getCharacter(this.player.charId).quote)
    );
  }

  // 战报卡
  makeBattleCard(quote) {
    const dataUrl = generateBattleCard({
      nick: this.save.data.nickname || '无名快递员',
      charId: this.player.charId,
      dist: this.player.distance,
      dust: this.dust,
      combo: this.runStats.comboMax,
      pits: this.runStats.pits,
      legends: this.runStats.legends,
      quote,
    });
    this.hud.showCardModal(dataUrl, () => downloadBattleCard(dataUrl, this.player.distance));
  }

  start() {
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.start();
  window.__game = game;   // 调试钩子（与 __dbg 同类，供测试与控制台诊断）
});