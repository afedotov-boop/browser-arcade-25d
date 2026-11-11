// Постэффекты (DESIGN 2.5.8): muzzle-flash, искры, смерть, телеграфы, «!».
export function drawEffectsPrepass(ctx, effects) {
  // по-над полом: телеграф-линии (до сущностей)
  for (const ef of effects) {
    if (ef.kind === 'sentry-aim') {
      const a = 1 - ef.t / ef.ttl;
      ctx.save();
      ctx.globalAlpha = 0.5 * a;
      ctx.strokeStyle = '#C9A227';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ef.x, ef.y - 30);
      ctx.lineTo(ef.x + Math.cos(ef.angle) * Math.min(ef.dist, 420), ef.y - 30 + Math.sin(ef.angle) * Math.min(ef.dist, 420) * 0.2);
      ctx.stroke();
      ctx.restore();
    } else if (ef.kind === 'melee-telegraph') {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#FF4D88';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(ef.x, ef.y - 24, 34, ef.angle - 0.7, ef.angle + 0.7);
      ctx.stroke();
      ctx.restore();
    }
  }
}

export function drawEffectsPostpass(ctx, effects) {
  for (const ef of effects) {
    const p = ef.t / ef.ttl; // 0..1
    if (ef.kind === 'muzzle') {
      const mx = ef.x + Math.cos(ef.angle) * 26;
      const my = ef.y - 30 + Math.sin(ef.angle) * 8;
      const s = 12 * (1 - p);
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = ef.enemy ? '#FF9EC4' : '#FFD24D';
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const a = ef.angle + i * (Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(mx + Math.cos(a) * 3, my + Math.sin(a) * 3);
        ctx.lineTo(mx + Math.cos(a) * s, my + Math.sin(a) * s);
        ctx.stroke();
      }
      ctx.restore();
    } else if (ef.kind === 'spark') {
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = ef.pink ? '#FF9EC4' : '#BFE3E8';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = ef.angle + (i - 2) * 0.5;
        const r1 = 3 + p * 6;
        const r2 = 8 + p * 14;
        ctx.beginPath();
        ctx.moveTo(ef.x + Math.cos(a) * r1, ef.y - 20 + Math.sin(a) * r1);
        ctx.lineTo(ef.x + Math.cos(a) * r2, ef.y - 20 + Math.sin(a) * r2);
        ctx.stroke();
      }
      ctx.restore();
    } else if (ef.kind === 'death') {
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = '#FF4D88';
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const a = i * (Math.PI / 4) + 0.4;
        const r1 = 6 + p * 10;
        const r2 = 14 + p * 22;
        ctx.beginPath();
        ctx.moveTo(ef.x + Math.cos(a) * r1, ef.y - 24 + Math.sin(a) * r1);
        ctx.lineTo(ef.x + Math.cos(a) * r2, ef.y - 24 + Math.sin(a) * r2);
        ctx.stroke();
      }
      ctx.strokeStyle = '#FF4D88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ef.x, ef.y - 24, 8 + p * 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// «!» над головой обнаруженного врага (1.2s, подпрыгивает)
export function drawAlerts(ctx, enemies, t) {
  for (const e of enemies) {
    if (e.alertT <= 0 || e.dead) continue;
    const bob = Math.sin(t * 10) * 2;
    ctx.save();
    ctx.globalAlpha = Math.min(1, e.alertT / 0.3);
    ctx.fillStyle = '#FF4D88';
    roundRectLocal(ctx, e.x - 7, e.y - 78 + bob, 14, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('!', e.x, e.y - 64 + bob);
    ctx.restore();
  }
}

function roundRectLocal(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
