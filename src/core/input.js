// Input (ARCHITECTURE §4.3): WASD по event.code (работает в русской раскладке), мышь — window-tracked.
const KEYS = { KeyW: 'up', KeyA: 'left', KeyS: 'down', KeyD: 'right', KeyR: 'reload', Escape: 'esc', Enter: 'enter', Digit1: 'one', Digit2: 'two' };

export class Input {
  constructor() {
    this.keys = {};
    this.mouseScreen = { x: 0, y: 0 };
    this.mouseDown = false;
    this.edges = { pressed: new Set(), released: new Set(), clicked: false, clickPos: { x: 0, y: 0 } };
    this._handlers = [];
  }
  attach(canvas) {
    const on = (target, type, fn) => { target.addEventListener(type, fn); this._handlers.push([target, type, fn]); };
    const kd = (e) => {
      const k = KEYS[e.code];
      if (!k) return;
      e.preventDefault();
      if (!this.keys[k]) this.edges.pressed.add(k);
      this.keys[k] = true;
    };
    const ku = (e) => { const k = KEYS[e.code]; if (k) { this.keys[k] = false; this.edges.released.add(k); } };
    const mm = (e) => { this.mouseScreen = { x: e.clientX, y: e.clientY }; };
    const md = (e) => {
      if (e.button !== 0) return;
      this.mouseDown = true;
      this.edges.clicked = true;
      this.edges.clickPos = { x: e.clientX, y: e.clientY };
    };
    const mu = (e) => { if (e.button === 0) this.mouseDown = false; };
    const cm = (e) => e.preventDefault();
    on(window, 'keydown', kd);
    on(window, 'keyup', ku);
    on(window, 'mousemove', mm);
    on(window, 'mousedown', md);
    on(window, 'mouseup', mu);
    on(canvas, 'contextmenu', cm);
  }
  detach() { for (const [t, ty, fn] of this._handlers) t.removeEventListener(ty, fn); this._handlers = []; }
  poll() {
    const s = {
      up: !!this.keys.up, down: !!this.keys.down, left: !!this.keys.left, right: !!this.keys.right,
      firing: this.mouseDown
    };
    let x = (s.right ? 1 : 0) - (s.left ? 1 : 0);
    let y = (s.down ? 1 : 0) - (s.up ? 1 : 0);
    const len = Math.hypot(x, y);
    if (len > 0) { x /= len; y /= len; } // диагональ нормализована (длина ≤ 1)
    s.move = { x, y };
    return s;
  }
  consumeEdges() {
    const e = {
      pressed: this.edges.pressed, released: this.edges.released,
      clicked: this.edges.clicked, clickPos: this.edges.clickPos
    };
    this.edges = { pressed: new Set(), released: new Set(), clicked: false, clickPos: { x: 0, y: 0 } };
    return e;
  }
}
