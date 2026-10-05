// battlecard.js — 战报卡：Canvas 生成"月球快递单"PNG
import { getCharacter } from './characters.js';

const EMOJI = {
  rabbit: '🐰', mouse: '🐭', ox: '🐮', tiger: '🐯', dragon: '🐲', snake: '🐍',
  horse: '🐴', sheep: '🐑', monkey: '🐵', rooster: '🐔', dog: '🐶', pig: '🐷', duck: '🦆',
};

export function generateBattleCard({ nick, charId, dist, dust, combo, pits, legends, quote }) {
  const W = 640, H = 420;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // 底色：深蓝夜空
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d1626');
  bg.addColorStop(1, '#141f36');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 星星
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 40; i++) {
    const x = (i * 137) % W, y = (i * 89) % 180;
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  // 月亮
  ctx.beginPath();
  ctx.arc(W - 90, 80, 46, 0, Math.PI * 2);
  const mg = ctx.createRadialGradient(W - 105, 65, 8, W - 90, 80, 46);
  mg.addColorStop(0, '#f7ecc8');
  mg.addColorStop(1, '#b79a4a');
  ctx.fillStyle = mg;
  ctx.fill();
  ctx.fillStyle = 'rgba(120,98,50,0.3)';
  ctx.beginPath(); ctx.arc(W - 100, 68, 9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W - 78, 92, 6, 0, Math.PI * 2); ctx.fill();

  // 边框
  ctx.strokeStyle = 'rgba(183,154,74,0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, W - 32, H - 32);
  ctx.strokeStyle = 'rgba(183,154,74,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(22, 22, W - 44, H - 44);

  // 抬头
  ctx.fillStyle = '#ffd76a';
  ctx.font = '900 28px "Microsoft YaHei", sans-serif';
  ctx.fillText('月宫快递 · MOON EXPRESS', 44, 64);
  ctx.fillStyle = '#8a99b3';
  ctx.font = '13px "Microsoft YaHei", sans-serif';
  ctx.fillText('LUNAR DELIVERY SERVICE —— 派送战报', 44, 86);

  // 单号（日期+距离）
  const d = new Date();
  const no = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(Math.floor(dist)).padStart(5, '0')}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#b79a4a';
  ctx.font = '15px Consolas, monospace';
  ctx.fillText(`单号 ${no}`, W - 44, 148);
  ctx.textAlign = 'left';

  // 分隔虚线
  ctx.strokeStyle = 'rgba(183,154,74,0.5)';
  ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(44, 160); ctx.lineTo(W - 44, 160); ctx.stroke();
  ctx.setLineDash([]);

  // 寄件人（角色+昵称）
  const char = getCharacter(charId);
  ctx.font = '40px serif';
  ctx.fillText(EMOJI[charId] || '🐰', 48, 215);
  ctx.fillStyle = '#f0e8d0';
  ctx.font = '800 22px "Microsoft YaHei", sans-serif';
  ctx.fillText(nick, 108, 208);
  ctx.fillStyle = '#8a99b3';
  ctx.font = '13px "Microsoft YaHei", sans-serif';
  ctx.fillText(`${char.name} · ${char.tagline}`, 108, 230);

  // 数据
  const rows = [
    ['最远距离', `${Math.floor(dist)} m`],
    ['本月尘', `${dust}`],
    ['连击峰值', `x${combo}`],
    ['跳过坑数', `${pits}`],
  ];
  ctx.font = '700 16px "Microsoft YaHei", sans-serif';
  rows.forEach((r, i) => {
    const y = 260 + i * 26;
    ctx.fillStyle = '#8a99b3';
    ctx.fillText(r[0], 48, y);
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(r[1], 150, y);
  });

  // 传说坑列表
  if (legends && legends.length) {
    ctx.fillStyle = '#8a99b3';
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    ctx.fillText('途经传说:', 260, 260);
    ctx.fillStyle = '#ffd76a';
    legends.slice(0, 4).forEach((l, i) => {
      ctx.fillText(`「${l}」`, 260, 280 + i * 22);
    });
  }

  // 吐槽
  ctx.fillStyle = 'rgba(255,215,106,0.85)';
  ctx.font = 'italic 15px "Microsoft YaHei", sans-serif';
  ctx.fillText(quote || char.quote, 48, 382);

  // 底部小字
  ctx.fillStyle = '#5a6a85';
  ctx.font = '11px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('月球快递员 MOON COURIER · 月宫快递公司 出品', W - 44, 402);
  ctx.textAlign = 'left';

  return cv.toDataURL('image/png');
}

// 下载战报卡
export function downloadBattleCard(dataUrl, dist) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `月球快递单-${Math.floor(dist)}m-${Date.now()}.png`;
  a.click();
}
