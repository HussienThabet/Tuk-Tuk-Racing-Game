// boot.js - entry point. Loads Three.js and the graphics layer as ES modules, exposes
// them to the classic game scripts as globals, then loads those scripts in order
// behind a progress bar.
import { gfx, THREE } from './gfx/index.js';

const GAME_SCRIPTS = ['audio.js', 'people.js', 'city.js', 'entities.js', 'citylife.js', 'game.js'];

const loader = document.getElementById('boot-loader');
const bar = document.getElementById('boot-bar');
const text = document.getElementById('boot-text');

function progress(fraction, label) {
  if (bar) bar.style.width = Math.round(Math.max(0.04, Math.min(1, fraction)) * 100) + '%';
  if (label && text) text.textContent = label;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.body.appendChild(s);
  });
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

// Canvas textures drawn by the game are all colour data: tag them sRGB and give them
// the tier's anisotropic filtering so signs and facades stay sharp at grazing angles.
class ColorCanvasTexture extends THREE.CanvasTexture {
  constructor(...args) {
    super(...args);
    this.colorSpace = THREE.SRGBColorSpace;
    this.anisotropy = gfx.textures.anisotropy;
  }
}

async function boot() {
  window.THREE = { ...THREE, CanvasTexture: ColorCanvasTexture };
  window.TTGfx = gfx;

  progress(0.1, 'جاري تحميل الخامات...');
  await gfx.preload((f) => progress(0.1 + f * 0.25));

  for (let i = 0; i < GAME_SCRIPTS.length; i++) {
    progress(0.35 + (i / GAME_SCRIPTS.length) * 0.35, 'جاري تحميل اللعبة...');
    await loadScript(GAME_SCRIPTS[i]);
  }

  progress(0.75, 'جاري بناء شوارع القاهرة...');
  await nextFrame();
  await nextFrame();
  window.startTukTukGame();

  progress(1, 'يلا بينا!');
  await nextFrame();
  await nextFrame();
  if (loader) {
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 600);
  }
}

boot().catch((err) => {
  console.error(err);
  if (loader) loader.classList.add('error');
  if (text) text.textContent = 'حصلت مشكلة في التحميل: ' + err.message;
});
