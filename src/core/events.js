// Bus (ARCHITECTURE §4.6): события — единственный канал симуляция → audio/effects/UI.
const listeners = new Map();
let queue = null;

export const Bus = {
  _inStep: false,
  on(evt, fn) {
    if (!listeners.has(evt)) listeners.set(evt, new Set());
    listeners.get(evt).add(fn);
    return () => listeners.get(evt).delete(fn);
  },
  off(evt, fn) { listeners.get(evt)?.delete(fn); },
  emit(evt, payload) {
    if (Bus._inStep) {
      (queue ||= []).push({ evt, payload });
    } else {
      const l = listeners.get(evt);
      if (l) for (const fn of [...l]) fn(payload);
    }
  },
  beginStep() { Bus._inStep = true; queue = []; },
  flush() {
    if (queue) {
      const q = queue; queue = null;
      for (const { evt, payload } of q) {
        const l = listeners.get(evt);
        if (l) for (const fn of [...l]) fn(payload);
      }
    }
    Bus._inStep = false;
  }
};
