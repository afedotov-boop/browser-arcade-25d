// Camera (ARCHITECTURE §4.4): жёсткий follow, кламп к границам уровня.
import { VIEWPORT } from '../config.js';

export class Camera {
  constructor() { this.x = 0; this.y = 0; }
  follow(playerPos, levelW, levelH) {
    let x, y;
    if (levelW <= VIEWPORT.w) x = (levelW - VIEWPORT.w) / 2;
    else x = Math.max(0, Math.min(playerPos.x - VIEWPORT.w / 2, levelW - VIEWPORT.w));
    if (levelH <= VIEWPORT.h) y = (levelH - VIEWPORT.h) / 2;
    else y = Math.max(0, Math.min(playerPos.y - VIEWPORT.h / 2, levelH - VIEWPORT.h));
    this.x = x; this.y = y;
  }
  worldToScreen(p) { return { x: p.x - this.x, y: p.y - this.y }; }
  screenToWorld(p) { return { x: p.x + this.x, y: p.y + this.y }; }
}
