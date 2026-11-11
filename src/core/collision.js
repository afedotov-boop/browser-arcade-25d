// Collision (ARCHITECTURE §4.7): grid, circle-AABB, swept segment, LOS.
import { TILE } from '../config.js';

export function buildGrid(levelData) {
  const { w, h } = levelData.size;
  const solid = new Uint8Array(w * h);
  for (const wl of levelData.walls) {
    for (let ty = wl.y; ty < wl.y + wl.h; ty++) {
      for (let tx = wl.x; tx < wl.x + wl.w; tx++) {
        if (tx >= 0 && ty >= 0 && tx < w && ty < h) solid[ty * w + tx] = 1;
      }
    }
  }
  return { solid, w, h };
}

export function coversOf(levelData) {
  return (levelData.cover || []).map((c) => ({
    id: c.id, x: c.x * TILE, y: c.y * TILE, w: c.w * TILE, h: c.h * TILE,
    front: c.front ?? 16, blockMove: c.blockMove !== false, blockBullets: c.blockBullets !== false
  }));
}

// Ось-за-осью circle-AABB (X→resolve, Y→resolve). pos — точка стопы; возвращает {x, y, hitX, hitY}.
export function moveCircle(pos, r, dx, dy, grid, covers) {
  let { x, y } = pos;
  let hitX = false, hitY = false;
  // X
  const nx = x + dx;
  if (circleHitsSolid(nx, y, r, grid) || circleHitsCovers(nx, y, r, covers)) { hitX = true; }
  else x = nx;
  // Y
  const ny = y + dy;
  if (circleHitsSolid(x, ny, r, grid) || circleHitsCovers(x, ny, r, covers)) { hitY = true; }
  else y = ny;
  return { x, y, hitX, hitY };
}

function circleHitsSolid(cx, cy, r, grid) {
  const { solid, w, h } = grid;
  const t0x = Math.floor((cx - r) / TILE), t1x = Math.floor((cx + r) / TILE);
  const t0y = Math.floor((cy - r) / TILE), t1y = Math.floor((cy + r) / TILE);
  for (let ty = t0y; ty <= t1y; ty++) {
    for (let tx = t0x; tx <= t1x; tx++) {
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) { if (tileRectCircle(tx * TILE, ty * TILE, TILE, TILE, cx, cy, r)) return true; continue; }
      if (!solid[ty * w + tx]) continue;
      if (tileRectCircle(tx * TILE, ty * TILE, TILE, TILE, cx, cy, r)) return true;
    }
  }
  return false;
}

function circleHitsCovers(cx, cy, r, covers) {
  if (!covers) return false;
  for (const c of covers) {
    if (!c.blockMove) continue;
    if (rectCircle(c.x, c.y, c.w, c.h, cx, cy, r)) return true;
  }
  return false;
}

// rect (x,y,w,h) vs circle (cx,cy,r)
function rectCircle(x, y, w, h, cx, cy, r) {
  const px = Math.max(x, Math.min(cx, x + w));
  const py = Math.max(y, Math.min(cy, y + h));
  const dx = cx - px, dy = cy - py;
  return dx * dx + dy * dy <= r * r;
}
function tileRectCircle(tx, ty, w, h, cx, cy, r) { return rectCircle(tx, ty, w, h, cx, cy, r); }

// Swept segment vs solid grid + cover-AABB (blockBullets). a,b — точки в px.
export function segmentHitsSolid(a, b, grid, covers) {
  if (segGrid(a, b, grid)) return true;
  if (covers) {
    for (const c of covers) {
      if (!c.blockBullets) continue;
      if (segRect(a, b, c.x, c.y, c.w, c.h)) return true;
    }
  }
  return false;
}

function segGrid(a, b, grid) {
  const { solid, w, h } = grid;
  const dx = b.x - a.x, dy = b.y - a.y;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (TILE / 4)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + dx * t, y = a.y + dy * t;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) return true;
    if (solid[ty * w + tx]) return true;
  }
  return false;
}

// Segment vs AABB (slab method).
export function segRect(a, b, x, y, w, h) {
  const dx = b.x - a.x, dy = b.y - a.y;
  let tmin = 0, tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (a.x < x || a.x > x + w) return false;
  } else {
    const inv = 1 / dx;
    let t1 = (x - a.x) * inv, t2 = (x + w - a.x) * inv;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (a.y < y || a.y > y + h) return false;
  } else {
    const inv = 1 / dy;
    let t1 = (y - a.y) * inv, t2 = (y + h - a.y) * inv;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

// segmentCircle: отрезок a→b проходит в пределах r от c.
export function segmentCircle(a, b, c, r) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const acx = c.x - a.x, acy = c.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-9) return Math.hypot(acx, acy) <= r;
  let t = (acx * abx + acy * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + abx * t - c.x, py = a.y + aby * t - c.y;
  return px * px + py * py <= r * r;
}

export function lineOfSight(a, b, grid, covers) {
  return !segmentHitsSolid(a, b, grid, covers);
}
