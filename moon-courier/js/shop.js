// shop.js — 月宫快递装备商店：道具定义 + 购买 + 生效参数
import { Config } from './config.js';

export const SHOP_ITEMS = [
  {
    id: 'shield', permanent: false,
    name: '月壤护盾', price: Config.prices.shield,
    desc: '单局一次免死——掉坑瞬间被弹回坑沿，继续派送。',
    icon: '🛡️',
  },
  {
    id: 'magnet', permanent: true,
    name: '磁力手套', price: Config.prices.magnet,
    desc: '永久：星屑吸附半径 +50%，月尘收集效率起飞。',
    icon: '🧲',
  },
  {
    id: 'boots', permanent: true,
    name: '跳跃强化鞋', price: Config.prices.boots,
    desc: '永久：蓄力跳最大初速 +8%，跨过更宽的月海。',
    icon: '👟',
  },
  {
    id: 'mask', permanent: true,
    name: '氧气面罩', price: Config.prices.mask,
    desc: '永久：极地远征（第7关+）氧气消耗 -20%。',
    icon: '😷',
  },
  {
    id: 'tank', permanent: false,
    name: '氧气瓶补给', price: Config.prices.tank,
    desc: '单局携带：氧气耗尽瞬间自动补满，免坠一次。',
    icon: '🫧',
  },
];

export class Shop {
  constructor(save) { this.save = save; }

  get owned() { return this.save.owned; }
  get inventory() { return this.save.inventory; }
  get dust() { return this.save.data.moonDust; }

  canBuy(item) {
    if (item.permanent && this.save.owned[item.id]) return 'owned';
    if (this.dust < item.price) return 'poor';
    return 'ok';
  }

  buy(item) {
    const state = this.canBuy(item);
    if (state !== 'ok') return state;
    if (!this.save.spendMoonDust(item.price)) return 'poor';
    if (item.permanent) this.save.buyPermanent(item.id);
    else this.save.addItem(item.id, 1);
    return 'ok';
  }

  // === 对局生效参数 ===
  shieldCount() { return this.save.inventory.shield || 0; }
  useShield() { return this.save.useItem('shield'); }
  magnetMult() { return this.save.owned.magnet ? 1.5 : 1; }
  bootsMult() { return this.save.owned.boots ? 1.08 : 1; }
  maskMult() { return this.save.owned.mask ? 0.8 : 1; }
  hasTank() { return (this.save.inventory.tank || 0) > 0; }
  useTank() { return this.save.useItem('tank'); }
}
