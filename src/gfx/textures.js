// textures.js - PBR surface texture sets.
//
// Each surface is { map, normalMap, roughnessMap }. If assets/higgsfield/manifest.json
// marks the matching asset as "ready" the albedo is loaded from disk; otherwise a
// seeded procedural placeholder is generated. Normal and roughness maps are derived
// from the albedo luminance unless the manifest lists them in "extraMaps".
import * as THREE from 'three';

const BASE = 'assets/higgsfield/';

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tileable multi-octave value noise in [0,1], Float32Array of n*n.
function tileNoise(n, seed, baseCells, octaves) {
  const out = new Float32Array(n * n);
  let amp = 1, total = 0, cells = baseCells;
  for (let o = 0; o < octaves; o++) {
    const rnd = mulberry(seed + o * 101);
    const grid = new Float32Array(cells * cells);
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    const scale = cells / n;
    for (let y = 0; y < n; y++) {
      const fy = y * scale, y0 = Math.floor(fy), ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      const ya = (y0 % cells) * cells, yb = ((y0 + 1) % cells) * cells;
      for (let x = 0; x < n; x++) {
        const fx = x * scale, x0 = Math.floor(fx), tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const xa = x0 % cells, xb = (x0 + 1) % cells;
        const a = grid[ya + xa] + (grid[ya + xb] - grid[ya + xa]) * sx;
        const b = grid[yb + xa] + (grid[yb + xb] - grid[yb + xa]) * sx;
        out[y * n + x] += (a + (b - a) * sy) * amp;
      }
    }
    total += amp;
    amp *= 0.5;
    cells = Math.min(n, cells * 2);
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

const RECIPES = {
  // base colour (sRGB 0-255), tonal contrast, fine speckle strength, relief strength
  asphalt: { base: [96, 93, 92], contrast: 24, speckle: 30, relief: 2.2, rough: [0.78, 0.97], cells: 6 },
  cracked_road: { base: [78, 74, 72], contrast: 34, speckle: 22, relief: 2.6, rough: [0.8, 0.98], cells: 5, cracks: 14 },
  sidewalk: { base: [150, 142, 132], contrast: 22, speckle: 14, relief: 1.8, rough: [0.82, 0.96], cells: 8, pavers: 4 },
  sand: { base: [176, 150, 112], contrast: 30, speckle: 16, relief: 1.6, rough: [0.9, 1.0], cells: 5 },
  canvas_roof: { base: [34, 32, 40], contrast: 10, speckle: 8, relief: 1.2, rough: [0.7, 0.9], cells: 16, weave: 64 },
  water: { base: [128, 128, 128], contrast: 60, speckle: 0, relief: 1.4, rough: [0.05, 0.1], cells: 7 }
};

function buildProcedural(kind, n, seed) {
  const r = RECIPES[kind];
  const rnd = mulberry(seed);
  const broad = tileNoise(n, seed, r.cells, 4);
  const fine = tileNoise(n, seed + 7, Math.min(n / 2, 64), 2);
  const height = new Float32Array(n * n);
  const albedo = new Uint8ClampedArray(n * n * 4);

  for (let i = 0; i < n * n; i++) {
    let h = broad[i] * 0.55 + fine[i] * 0.45;
    let tone = (broad[i] - 0.5) * r.contrast + (fine[i] - 0.5) * r.speckle;
    if (r.speckle && rnd() < 0.035) { const s = (rnd() - 0.35) * r.speckle * 2.2; tone += s; h += s / 120; }
    height[i] = h;
    albedo[i * 4] = r.base[0] + tone;
    albedo[i * 4 + 1] = r.base[1] + tone;
    albedo[i * 4 + 2] = r.base[2] + tone * 0.9;
    albedo[i * 4 + 3] = 255;
  }

  const darken = (i, amount, depth) => {
    albedo[i * 4] *= amount; albedo[i * 4 + 1] *= amount; albedo[i * 4 + 2] *= amount;
    height[i] -= depth;
  };

  if (r.pavers) {
    const step = n / r.pavers;
    const joint = Math.max(1, Math.round(n / 170));
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (x % step < joint || y % step < joint) darken(y * n + x, 0.62, 0.35);
      }
    }
  }
  if (r.weave) {
    const p = n / r.weave;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        height[y * n + x] += 0.12 * Math.sin((x / p) * Math.PI * 2) * Math.sin((y / p) * Math.PI * 2);
      }
    }
  }
  if (r.cracks) {
    for (let c = 0; c < r.cracks; c++) {
      let x = rnd() * n, y = rnd() * n, a = rnd() * Math.PI * 2;
      const len = n * (0.25 + rnd() * 0.5);
      for (let s = 0; s < len; s++) {
        a += (rnd() - 0.5) * 0.5;
        x += Math.cos(a); y += Math.sin(a);
        const xi = ((Math.round(x) % n) + n) % n, yi = ((Math.round(y) % n) + n) % n;
        darken(yi * n + xi, 0.45, 0.5);
        darken(yi * n + ((xi + 1) % n), 0.7, 0.25);
      }
    }
  }
  return { albedo, height, n, recipe: r };
}

function canvasFrom(pixels, n) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  c.getContext('2d').putImageData(new ImageData(pixels, n, n), 0, 0);
  return c;
}

// Sobel normal map + roughness map from a height field (both tile).
function deriveMaps(height, n, relief, roughRange) {
  const normal = new Uint8ClampedArray(n * n * 4);
  const rough = new Uint8ClampedArray(n * n * 4);
  const at = (x, y) => height[((y + n) % n) * n + ((x + n) % n)];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * relief * (n / 128);
      const dy = (at(x, y + 1) - at(x, y - 1)) * relief * (n / 128);
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y * n + x) * 4;
      normal[i] = (-dx * inv * 0.5 + 0.5) * 255;
      normal[i + 1] = (dy * inv * 0.5 + 0.5) * 255;
      normal[i + 2] = (inv * 0.5 + 0.5) * 255;
      normal[i + 3] = 255;
      // low spots collect dust (rougher), high spots are polished by tyres
      const h = Math.min(1, Math.max(0, height[y * n + x]));
      const v = (roughRange[1] - (roughRange[1] - roughRange[0]) * h) * 255;
      rough[i] = rough[i + 1] = rough[i + 2] = v;
      rough[i + 3] = 255;
    }
  }
  return { normal, rough };
}

function heightFromImage(img, n) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, n, n);
  const d = ctx.getImageData(0, 0, n, n).data;
  const h = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) h[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255;
  return h;
}

export class TextureLibrary {
  constructor(tier, maxAnisotropy) {
    this.tier = tier;
    this.anisotropy = Math.min(tier.anisotropy, maxAnisotropy || 1);
    this.manifest = null;
    this.images = new Map(); // "id" / "id:normal" -> HTMLImageElement
    this.cache = new Map();
  }

  // Loads the manifest and every image marked ready. Never rejects: missing files
  // simply fall back to the procedural placeholder.
  async preload(onProgress) {
    try {
      const res = await fetch(BASE + 'manifest.json', { cache: 'no-cache' });
      this.manifest = await res.json();
    } catch (e) {
      this.manifest = { assets: [] };
    }
    const jobs = [];
    for (const a of this.manifest.assets) {
      if (a.kind !== 'texture' || a.status !== 'ready') continue;
      const id = a.id.replace(/^tex_/, '');
      jobs.push([id, a.file]);
      for (const extra of a.extraMaps || []) if (a[extra]) jobs.push([`${id}:${extra}`, a[extra]]);
    }
    let done = 0;
    await Promise.all(jobs.map(([key, file]) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { this.images.set(key, img); onProgress && onProgress(++done / jobs.length); resolve(); };
      img.onerror = () => { onProgress && onProgress(++done / jobs.length); resolve(); };
      img.src = BASE + file;
    })));
  }

  asset(id) {
    return this.manifest ? this.manifest.assets.find((a) => a.id === id) : null;
  }

  url(asset) {
    return BASE + asset.file;
  }

  finish(tex, srgb) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = this.anisotropy;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  // Returns a fresh set of textures (own repeat/offset) sharing the cached pixels.
  surface(kind, seed = 1) {
    if (!this.cache.has(kind)) this.cache.set(kind, this.build(kind, seed));
    const src = this.cache.get(kind);
    const out = {};
    for (const k of Object.keys(src)) {
      out[k] = src[k].clone();
      out[k].needsUpdate = true;
    }
    return out;
  }

  build(kind, seed) {
    const n = this.tier.textureSize;
    const recipe = RECIPES[kind] || RECIPES.asphalt;
    const img = this.images.get(kind);
    let map, height;

    if (img) {
      map = this.finish(new THREE.Texture(img), true);
      height = heightFromImage(img, n);
    } else {
      const p = buildProcedural(kind, n, seed * 7919 + kind.length * 31);
      map = this.finish(new THREE.CanvasTexture(canvasFrom(p.albedo, n)), true);
      height = p.height;
    }

    const derived = deriveMaps(height, n, recipe.relief, recipe.rough);
    const nImg = this.images.get(kind + ':normal');
    const rImg = this.images.get(kind + ':roughness');
    const set = {
      map,
      normalMap: this.finish(nImg ? new THREE.Texture(nImg) : new THREE.CanvasTexture(canvasFrom(derived.normal, n)), false),
      roughnessMap: this.finish(rImg ? new THREE.Texture(rImg) : new THREE.CanvasTexture(canvasFrom(derived.rough, n)), false)
    };
    const aImg = this.images.get(kind + ':ao');
    if (aImg) set.aoMap = this.finish(new THREE.Texture(aImg), false);
    return set;
  }

  // Soft round blob used for contact shadows and dust sprites.
  radial(inner, outer, size = 128) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
}
