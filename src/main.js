// Входная точка: единственный module-скрипт в index.html (src/main.js).
import { createGame } from './core/loop.js';

const canvas = document.getElementById('game');
if (!canvas) {
  console.error('[main] canvas#game not found');
  throw new Error('canvas#game not found');
}
const { game, start } = createGame(canvas);
window.__game = game; // для диагностики
start();
console.log('[main] ПОСЛЕДНИЙ ЗАКАЗ: core-slice started, mode=' + game.state.mode);
