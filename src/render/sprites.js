// Процедурные спрайты (DESIGN 2.4/2.5). Ножки в (x,y) — точка на полу; вёрстка:
// тень → (по y) сущности → эффекты. 2.5D: тень + вертикальная вёрстка + передняя грань.
import { TILE } from '../config.js';

const OUTLINE = '#241F2E';

export function drawShadow(ctx, x, y, rx, alpha = 0.35) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, rx, rx * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawPlayer(ctx, pl, t) {
  const walk = pl.moving ? Math.sin(pl.aimAngle * 0 + t * 12) : 0;
  const bob = pl.moving ? Math.abs(Math.sin(t * 12)) * 2 : 0;
  const leg = pl.moving ? Math.sin(t * 12) * 3 : 0;
  ctx.save();
  ctx.translate(pl.x, pl.y - bob);
  if (pl.facing < 0) ctx.scale(-1, 1);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = OUTLINE;
  // кейс-посылка (горчица) на спине
  roundRect(ctx, -24, -58, 28, 36, 6);
  ctx.fillStyle = '#C9A227';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8A6E12';
  ctx.fillRect(-22, -50, 24, 3);
  ctx.fillRect(-22, -36, 24, 3);
  // ботинки (петроль)
  ctx.fillStyle = '#2E6E8E';
  roundRect(ctx, -12 + leg, -10, 10, 10, 3); ctx.fill(); ctx.stroke();
  roundRect(ctx, 2 - leg, -10, 10, 10, 3); ctx.fill(); ctx.stroke();
  // тело-капсула (крем, двухзонная подсветка: сверху теплее)
  capsule(ctx, 0, -34, 21, 24);
  ctx.fillStyle = '#F2E8CF';
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#D9CBA8';
  ctx.fillRect(-21, -28, 42, 18);   // нижняя зона темнее
  ctx.fillStyle = 'rgba(232,98,44,0.18)';
  ctx.fillRect(-21, -58, 42, 12);   // тёплый верх
  ctx.restore();
  // визор (оранжевый) — «лицо»
  roundRect(ctx, -10, -52, 22, 10, 4);
  ctx.fillStyle = '#E8622C';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#FFD24D';
  ctx.fillRect(6, -50, 6, 3);
  // рука впереди
  ctx.fillStyle = '#F2E8CF';
  ctx.beginPath();
  ctx.arc(15, -30, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function drawEnemy(ctx, e, t) {
  const walk = e.discovered ? 0 : Math.sin(e.walkT * 10) * 2;
  const bob = walk;
  ctx.save();
  ctx.translate(e.x, e.y - bob);
  if (e.facing < 0) ctx.scale(-1, 1);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = OUTLINE;
  // ноги
  ctx.fillStyle = '#3E464E';
  roundRect(ctx, -13, -10, 11, 10, 2); ctx.fill(); ctx.stroke();
  roundRect(ctx, 2, -10, 11, 10, 2); ctx.fill(); ctx.stroke();
  // корпус-ящик (серый)
  roundRect(ctx, -18, -56, 36, 48, 5);
  ctx.fillStyle = '#5C6670';
  ctx.fill();
  ctx.stroke();
  // шлем
  ctx.beginPath();
  ctx.arc(0, -52, 13, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = '#454E57';
  ctx.fill();
  ctx.stroke();
  // визор (горчичная щель)
  roundRect(ctx, -9, -50, 20, 7, 3);
  ctx.fillStyle = e.discovered ? '#FF4D88' : '#C9A227';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // щит (хром) на груди
  roundRect(ctx, -11, -40, 20, 22, 3);
  ctx.fillStyle = '#9FB4C0';
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#DCE8EE';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-7, -37); ctx.lineTo(-7, -22);
  ctx.stroke();
  ctx.restore();
}

// Труп: fade за последние 0.5s из 1.5s (DESIGN 3.2)
export function corpseAlpha(deadT) {
  return Math.max(0, Math.min(1, deadT / 0.5));
}

export function drawBullet(ctx, b) {
  const ang = Math.atan2(b.vy, b.vx);
  const cy = b.y - 22; // на высоте груди (коллизии — по ножкам, §2.3)
  const enemy = b.owner !== 'player';
  ctx.save();
  ctx.translate(b.x, cy);
  ctx.rotate(ang);
  ctx.shadowColor = enemy ? '#FF4D88' : '#E8622C';
  ctx.shadowBlur = 8;
  ctx.fillStyle = enemy ? '#FF9EC4' : '#FFD24D';
  roundRect(ctx, -7, -2, 14, 4, 2);
  ctx.fill();
  ctx.restore();
}

export function drawCrosshair(ctx, x, y, overEnemy) {
  const c = overEnemy ? '#FF4D88' : '#F2E8CF';
  ctx.save();
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();
  const g = overEnemy ? 6 : 4;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * g, y + dy * g);
    ctx.lineTo(x + dx * (g + 8), y + dy * (g + 8));
    ctx.stroke();
  }
  ctx.restore();
}

export function drawExitMarker(ctx, exit, armed, t) {
  const pulse = Math.sin(t * 4) * 4;
  ctx.save();
  ctx.strokeStyle = armed ? '#37B5B0' : 'rgba(55,181,176,0.3)';
  ctx.lineWidth = armed ? 3 : 2;
  ctx.beginPath();
  ctx.arc(exit.x, exit.y, exit.r + (armed ? pulse : 0), 0, Math.PI * 2);
  ctx.stroke();
  if (armed) {
    ctx.fillStyle = 'rgba(55,181,176,0.15)';
    ctx.beginPath();
    ctx.arc(exit.x, exit.y, exit.r + pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = armed ? '#7FE0DB' : 'rgba(127,224,219,0.4)';
  ctx.font = '12px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(exit.label || 'ВЫХОД', exit.x, exit.y - exit.r - 8);
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function capsule(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
}

// Босс «ВЕГА» (DESIGN 2.7 / 3.3): крупный ящик с хромовым ядром (r26),
// щит (P3), ядро светится в окно уязвимости (coreActive)
export function drawBoss(ctx, B, t) {
  const pulse = 0.6 + 0.4 * Math.sin(t * 6);
  ctx.save();
  ctx.translate(B.x, B.y);
  if (B.facing < 0) ctx.scale(-1, 1);
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  // ноги
  ctx.fillStyle = '#3E464E';
  roundRect(ctx, -24, -18, 20, 18, 3); ctx.fill(); ctx.stroke();
  roundRect(ctx, 4, -18, 20, 18, 3); ctx.fill(); ctx.stroke();
  // корпус (тёмно-серый, хромовые швы)
  roundRect(ctx, -34, -78, 68, 62, 8);
  ctx.fillStyle = B.coreActive ? '#7A6A4E' : '#5C6670';
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#DCE8EE';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-34, -58); ctx.lineTo(34, -58); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-34, -34); ctx.lineTo(34, -34); ctx.stroke();
  // ядро (DESIGN: xромовое ядро, светится в окно уязвимости)
  const glow = B.coreActive ? 1 : B.shielded ? 0.3 : 0.6;
  ctx.globalAlpha = glow;
  ctx.fillStyle = B.coreActive ? '#FFB84D' : '#37B5B0';
  ctx.beginPath();
  ctx.arc(0, -52, 13 + pulse * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#E8622C';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, -52, 13 + pulse * 2, 0, Math.PI * 2);
  ctx.stroke();
  // визор
  roundRect(ctx, -14, -84, 28, 8, 3);
  ctx.fillStyle = B.dead ? '#37B5B0' : '#FF4D88';
  ctx.fill();
  // щит (P3)
  if (B.shielded) {
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 8);
    ctx.strokeStyle = '#DCE8EE';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -44, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
