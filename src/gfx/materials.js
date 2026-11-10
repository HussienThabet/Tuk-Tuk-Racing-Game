// materials.js - PBR material presets shared by the city, vehicles and people.
import * as THREE from 'three';

export class Materials {
  constructor(tier, textures) {
    this.tier = tier;
    this.textures = textures;
    this.roadMaterials = [];
    this.wetness = { value: 0.25 };
    this.time = { value: 0 };
  }

  // One shared instance per key (keeps identical parts in the same draw-call batch).
  shared(key, make) {
    if (!this._shared) this._shared = new Map();
    if (!this._shared.has(key)) this._shared.set(key, make());
    return this._shared.get(key);
  }

  // Generic lit surface (replaces the old MeshLambertMaterial everywhere).
  lit(params = {}) {
    return new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0, ...params });
  }

  // Glossy vehicle body paint with a clearcoat layer.
  paint(color, opts = {}) {
    const m = this.tier.clearcoat
      ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.07, ...opts })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.2, ...opts });
    m.userData.keep = true; // colour is changed at runtime by the garage
    return m;
  }

  chrome(color = 0xe8eef2) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.16, metalness: 1 });
  }

  metal(color, roughness = 0.45) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.85 });
  }

  rubber(color = 0x0e0e11) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.96, metalness: 0 });
  }

  vinyl(color) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0 });
  }

  glass(color = 0x1b2a33) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.06, metalness: 0.9 });
  }

  canvasRoof(color = 0x1e192b, opts = {}) {
    const t = this.textures.surface('canvas_roof', 5);
    t.normalMap.repeat.set(3, 3);
    return new THREE.MeshStandardMaterial({
      color, roughness: 0.82, metalness: 0, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), ...opts
    });
  }

  // Self-lit surface (lamps, LEDs, tail-lights). Intensity above 1 feeds the bloom pass.
  glow(color, intensity = 2.5, opts = {}) {
    const m = new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: color, emissiveIntensity: intensity, roughness: 0.4, ...opts
    });
    m.userData.keep = true;
    return m;
  }

  // Tiling ground surface. `repeat` is how many times the tile repeats over the mesh.
  ground(kind, repeatX, repeatY, opts = {}) {
    const t = this.textures.surface(kind, 3);
    for (const k of Object.keys(t)) t[k].repeat.set(repeatX, repeatY);
    return new THREE.MeshStandardMaterial({
      map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, aoMap: t.aoMap || null,
      roughness: 1, metalness: 0, ...opts
    });
  }

  // Asphalt with world-space wet patches: lower roughness + darker albedo where
  // large-scale noise says a puddle has not dried yet.
  road(repeatX, repeatY) {
    const m = this.ground('asphalt', repeatX, repeatY, { normalScale: new THREE.Vector2(0.9, 0.9) });
    const wetness = this.wetness;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uWetness = wetness;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vTTWorldXZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTTWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec2 vTTWorldXZ;
          uniform float uWetness;
          float ttHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float ttNoise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(ttHash(i), ttHash(i + vec2(1.0, 0.0)), f.x),
                       mix(ttHash(i + vec2(0.0, 1.0)), ttHash(i + vec2(1.0, 1.0)), f.x), f.y);
          }
          float ttWet() {
            float n = ttNoise(vTTWorldXZ * 0.045) * 0.65 + ttNoise(vTTWorldXZ * 0.17) * 0.35;
            return smoothstep(0.52, 0.72, n) * uWetness;
          }`)
        .replace('#include <color_fragment>', '#include <color_fragment>\nfloat ttWetAmount = ttWet();\ndiffuseColor.rgb *= mix(1.0, 0.72, ttWetAmount);')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= mix(1.0, 0.12, ttWetAmount);')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, ttWetAmount * 0.9));');
    };
    m.customProgramCacheKey = () => 'tt-road-wet';
    this.roadMaterials.push(m);
    return m;
  }

  water() {
    const t = this.textures.surface('water', 9);
    t.normalMap.repeat.set(90, 32);
    this.waterNormal = t.normalMap;
    return new THREE.MeshStandardMaterial({
      color: 0x16475c, roughness: 0.08, metalness: 0.55,
      normalMap: t.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.3
    });
  }

  update(dt) {
    this.time.value += dt;
    if (this.waterNormal) {
      this.waterNormal.offset.x = (this.time.value * 0.012) % 1;
      this.waterNormal.offset.y = (this.time.value * 0.02) % 1;
    }
  }
}
