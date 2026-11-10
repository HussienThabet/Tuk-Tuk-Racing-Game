// quality.js - Low / Medium / High graphics tiers with auto-detection.
//
// Override order: ?quality=low|medium|high|auto in the URL, then the saved menu
// choice (localStorage), then auto-detection from the device.

const STORAGE_KEY = 'tuktuk_quality_v1';

export const TIERS = {
  low: {
    name: 'low',
    pixelRatio: 1,          // max device pixel ratio
    antialias: true,        // MSAA on the default framebuffer (no composer on Low)
    composer: false,        // post-processing chain
    msaaSamples: 0,
    shadows: false,
    shadowSize: 0,
    shadowRange: 0,
    bloom: false,
    gtao: false,
    dof: false,
    motionBlur: false,
    grain: false,
    clearcoat: false,
    headlight: false,
    anisotropy: 2,
    textureSize: 256,       // procedural placeholder resolution
    dust: 48,
    skid: 160,
    chunkRadius: 200,
    targetFps: 30
  },
  medium: {
    name: 'medium',
    pixelRatio: 1.5,
    antialias: false,
    composer: true,
    msaaSamples: 2,
    shadows: true,
    shadowSize: 1024,
    shadowRange: 48,
    bloom: true,
    gtao: false,
    dof: false,
    motionBlur: true,
    grain: true,
    clearcoat: true,
    headlight: true,
    anisotropy: 4,
    textureSize: 512,
    dust: 140,
    skid: 400,
    chunkRadius: 250,
    targetFps: 45
  },
  high: {
    name: 'high',
    pixelRatio: 2,
    antialias: false,
    composer: true,
    msaaSamples: 4,
    shadows: true,
    shadowSize: 2048,
    shadowRange: 64,
    bloom: true,
    gtao: true,
    dof: true,
    motionBlur: true,
    grain: true,
    clearcoat: true,
    headlight: true,
    anisotropy: 8,
    textureSize: 1024,
    dust: 260,
    skid: 800,
    chunkRadius: 270,
    targetFps: 60
  }
};

function gpuName() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return String(name || '');
  } catch (e) {
    return '';
  }
}

export function detectTier() {
  const ua = navigator.userAgent || '';
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const gpu = gpuName();

  if (/SwiftShader|llvmpipe|Software|Basic Render/i.test(gpu)) return 'low';

  if (mobile) {
    // Recent flagship GPUs can take Medium; everything else starts on Low.
    const strong = /Apple GPU|Apple A1[5-9]|Apple M\d|Adreno \(TM\) (7[3-9]\d|8\d\d)|Mali-G(71[05]|72\d|9\d\d)|Xclipse/i.test(gpu);
    return strong && cores >= 6 && memory >= 4 ? 'medium' : 'low';
  }

  const discrete = /NVIDIA|GeForce|RTX|GTX|Radeon RX|Radeon Pro|Arc\(TM\)|Apple M\d/i.test(gpu);
  if (discrete && cores >= 6) return 'high';
  if (cores <= 2 || memory <= 2) return 'low';
  return 'medium';
}

export function readChoice() {
  const q = new URLSearchParams(location.search).get('quality');
  if (q && (q === 'auto' || TIERS[q])) return q;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (saved === 'auto' || TIERS[saved])) return saved;
  } catch (e) {}
  return 'auto';
}

export function saveChoice(choice) {
  try { localStorage.setItem(STORAGE_KEY, choice); } catch (e) {}
}

export function resolveQuality() {
  const choice = readChoice();
  const name = choice === 'auto' ? detectTier() : choice;
  return { choice, auto: choice === 'auto', tier: { ...TIERS[name] } };
}

// In auto mode, trims the render resolution when the frame rate stays under target
// and restores it when there is headroom. Never changes the tier itself.
export class DynamicResolution {
  constructor(tier, enabled) {
    this.enabled = enabled;
    this.target = tier.targetFps;
    this.max = Math.min(window.devicePixelRatio || 1, tier.pixelRatio);
    this.min = Math.max(0.6, this.max * 0.55);
    this.current = this.max;
    this.acc = 0;
    this.frames = 0;
    this.fps = 0;
  }

  // Returns the new pixel ratio when it changed, otherwise null.
  tick(dt) {
    this.acc += dt;
    this.frames++;
    if (this.acc < 2) return null;
    this.fps = this.frames / this.acc;
    this.acc = 0;
    this.frames = 0;
    if (!this.enabled || document.hidden) return null;

    let next = this.current;
    if (this.fps < this.target * 0.85) next = Math.max(this.min, this.current * 0.85);
    else if (this.fps > this.target * 1.15) next = Math.min(this.max, this.current * 1.08);
    if (Math.abs(next - this.current) < 0.02) return null;
    this.current = next;
    return next;
  }
}
