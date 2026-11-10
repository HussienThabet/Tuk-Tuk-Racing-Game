// index.js - graphics facade used by the game scripts as `window.TTGfx`.
import * as THREE from 'three';
import { resolveQuality, saveChoice, DynamicResolution } from './quality.js';
import { TextureLibrary } from './textures.js';
import { Materials } from './materials.js';
import { Environment } from './environment.js';
import { mergeStatic, mergeRig } from './batching.js';
import { PostFX } from './post.js';
import { DustSystem, SkidMarks, createContactShadow } from './effects.js';
import { ChaseCamera } from './camera.js';

class Gfx {
  constructor() {
    this.quality = resolveQuality();
    this.tier = this.quality.tier;
    this.textures = new TextureLibrary(this.tier, 16);
    this.mat = new Materials(this.tier, this.textures);
    this.frameStats = { fps: 0, calls: 0, triangles: 0 };
    this._statAcc = 0;
    this._statFrames = 0;
    this._landed = true;
    this._dustAcc = 0;
  }

  preload(onProgress) {
    return this.textures.preload(onProgress);
  }

  // ------------------------------------------------------------------ renderer
  createRenderer(container, scene) {
    const tier = this.tier;
    const renderer = new THREE.WebGLRenderer({ antialias: tier.antialias, powerPreference: 'high-performance' });
    this.dynRes = new DynamicResolution(tier, this.quality.auto);
    renderer.setPixelRatio(this.dynRes.current);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = tier.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.info.autoReset = false;
    container.appendChild(renderer.domElement);

    this.renderer = renderer;
    this.scene = scene;
    this.textures.anisotropy = Math.min(tier.anisotropy, renderer.capabilities.getMaxAnisotropy());
    this.env = new Environment(renderer, scene, tier, this.textures);
    this.env.lampPool = this.mat.lampPool();
    this.blobTexture = this.textures.radial('rgba(0,0,0,1)', 'rgba(0,0,0,0)');
    document.body.classList.add('gfx-' + tier.name);
    return renderer;
  }

  // -------------------------------------------------------------------- shortcuts
  lit(params) { return this.mat.lit(params); }

  // -------------------------------------------------------------------- batching
  onBakedMaterial(m) {
    if (m.isMeshBasicMaterial) {
      this.env.glowMaterials.push(m);
      m.color.setScalar(this.env.preset.glow);
    }
  }

  // Static scenery: one set of batches per city chunk + one for loose props.
  batchCity(city) {
    const opts = { castShadow: this.tier.shadows, receiveShadow: this.tier.shadows, onBakedMaterial: (m) => this.onBakedMaterial(m) };
    let batches = 0;
    for (const chunk of city.chunks) {
      chunk.decor.userData.keepEmpty = true;
      batches += mergeStatic(chunk.decor, { ...opts, castShadow: false });
      batches += mergeStatic(chunk.group, { ...opts, shadowProxy: true, skip: (o) => o === chunk.decor });
    }
    const chunkGroups = new Set(city.chunks.map((c) => c.group));
    batches += mergeStatic(city.group, {
      ...opts,
      skip: (o) => chunkGroups.has(o) || city.boats.includes(o) || o.userData.ground
    });
    city.boats.forEach((b) => mergeRig(b, { ...opts, isPivot: () => false }));
    city.chunkRadius = this.tier.chunkRadius;
    this.cityBatches = batches;
  }

  // Articulated rigs (vehicles, people): everything is baked into the nearest
  // animated node. `pivots` lists those nodes; without it every Group is kept.
  batchRig(group, { shadowBlob, pivots, keepGroupsUnder } = {}) {
    const set = pivots ? new Set(pivots) : null;
    const inKept = (node) => {
      for (let n = node; n && n !== group; n = n.parent) if (n === keepGroupsUnder) return true;
      return false;
    };
    mergeRig(group, {
      castShadow: this.tier.shadows,
      receiveShadow: false,
      isPivot: set ? (node) => set.has(node) || (keepGroupsUnder ? inKept(node) : false) : undefined,
      onBakedMaterial: (m) => this.onBakedMaterial(m)
    });
    if (shadowBlob) {
      const blob = createContactShadow(this.blobTexture, shadowBlob[0], shadowBlob[1], this.tier.shadows ? 0.4 : 0.6);
      group.add(blob);
    }
  }

  // ------------------------------------------------------------------ environment
  setupCity(city) {
    this.city = city;
    this.env.adoptLights(city);
    this.batchCity(city);
  }

  applyEnvironment(mode) {
    this.env.apply(mode);
    const p = this.env.preset;
    this.mat.wetness.value = p.wetness;
    if (this.post) this.post.applyPreset(p);
    if (this.dust) this.dust.material.uniforms.uColor.value.setHex(p.night ? 0x4a4658 : 0xc9b08a);
    this.updateVehicleLights(0, false);
  }

  // ------------------------------------------------------------------- game hookup
  attach(game) {
    this.game = game;
    this.camera = game.camera;
    this.player = game.player;
    this.chase = new ChaseCamera(game.camera);
    this.post = new PostFX(this.renderer, this.scene, game.camera, this.tier);
    this.dust = new DustSystem(this.scene, this.tier.dust);
    this.skids = new SkidMarks(this.scene, this.tier.skid);

    this.playerBlob = createContactShadow(this.blobTexture, 2.5, 3.9, this.tier.shadows ? 0.42 : 0.62);
    this.scene.add(this.playerBlob);

    if (this.tier.headlight && this.player.bodyTiltGroup) {
      const spot = new THREE.SpotLight(0xfff0cf, 0, 55, 0.52, 0.7, 1.6);
      spot.position.set(0, 0.95, 1.95);
      spot.target.position.set(0, -0.6, 16);
      this.player.bodyTiltGroup.add(spot, spot.target);
      this.headlight = spot;
    }

    this.applyEnvironment(this.env.mode);
    this.resize();
    this.bindQualityUI();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = this.dynRes.current;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    if (this.post) this.post.setSize(w, h, pr);
  }

  // -------------------------------------------------------------- vehicle feedback
  updateVehicleLights(dt, braking) {
    const p = this.player;
    if (!p || !p.fx) return;
    const preset = this.env.preset;
    if (p.fx.headMat) p.fx.headMat.emissiveIntensity = 1.2 + preset.headlight * 5;
    const brakeTarget = braking ? 7 : 0.7 + preset.headlight * 1.4;
    p.fx.brakeMats.forEach((m) => {
      m.emissiveIntensity += (brakeTarget - m.emissiveIntensity) * (dt > 0 ? Math.min(1, dt * 18) : 1);
    });
    if (this.headlight) this.headlight.intensity = preset.headlight * 900;
  }

  // Dust, skid marks, contact shadow and lights for the player's tuk-tuk.
  updateVehicle(dt, input) {
    const p = this.player;
    const grounded = p.yOffset < 0.12;
    const speed = Math.abs(p.speed);
    const sr = Math.min(1.4, speed / p.maxSpeed);
    const yaw = p.heading + p.driftAngle;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);     // body forward
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);    // body right
    const tx = Math.sin(p.heading), tz = Math.cos(p.heading); // travel direction
    const braking = !!input.brake && p.speed > 1;

    // contact shadow stays on the ground while the body jumps
    const lift = p.yOffset;
    this.playerBlob.position.set(p.position.x, 0.04, p.position.z);
    this.playerBlob.rotation.y = yaw;
    this.playerBlob.scale.set(2.5 * (1 + lift * 0.18), 1, 3.9 * (1 + lift * 0.18));
    this.playerBlob.material.opacity = this.playerBlob.material.userData.baseOpacity / (1 + lift * 0.9);

    // landing burst
    if (grounded && !this._landed) {
      this._landed = true;
      this.chase.addImpulse(0.55);
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 3;
        this.dust.emit(p.position.x + Math.cos(a) * 0.8, 0.15, p.position.z + Math.sin(a) * 0.8,
          Math.cos(a) * s, 0.8 + Math.random(), Math.sin(a) * s, 0.9 + Math.random() * 0.6, 0.9 + Math.random() * 0.5, 0.34);
      }
    } else if (!grounded) {
      this._landed = false;
    }

    // per-wheel dust + skid marks (two rear wheels)
    let rate = 0, alpha = 0.14, size = 0.5, skid = 0;
    if (grounded) {
      if (p.isDrifting) { rate = 60; alpha = 0.26; size = 1.25; skid = 0.7; }
      else if (braking && speed > 9) { rate = 40; alpha = 0.22; size = 1.0; skid = Math.min(0.6, speed / 40); }
      else if (input.gas && speed < 9) { rate = 16; alpha = 0.22; size = 0.6; }
      else if (speed > 9) { rate = 5 + sr * 9; alpha = 0.1 + sr * 0.06; size = 0.5; }
      if (p.isNitro) rate += 14;
    }
    this._dustAcc += rate * dt;
    const emitCount = Math.floor(this._dustAcc);
    this._dustAcc -= emitCount;

    for (let w = 0; w < 2; w++) {
      const side = w === 0 ? -0.95 : 0.95;
      const wx = p.position.x + rx * side - fx * 0.82;
      const wz = p.position.z + rz * side - fz * 0.82;
      this.skids.mark(w, wx, wz, tx, tz, 0.24, skid);
      for (let i = 0; i < emitCount; i++) {
        if ((i + w) % 2) continue; // alternate wheels
        const back = 0.8 + Math.random() * 1.6;
        this.dust.emit(
          wx + (Math.random() - 0.5) * 0.3, 0.12 + Math.random() * 0.15, wz + (Math.random() - 0.5) * 0.3,
          -tx * back + (Math.random() - 0.5) * 1.4 + rx * side * 0.6, 0.5 + Math.random() * 1.1, -tz * back + (Math.random() - 0.5) * 1.4 + rz * side * 0.6,
          size * (0.7 + Math.random() * 0.6), 0.7 + Math.random() * 0.8, alpha);
      }
    }

    this.updateVehicleLights(dt, braking || (!!input.brake && p.speed <= 1));
    this.post.speedBlur = Math.max(0, sr - 0.5) * 1.3 + (p.isNitro ? 0.5 : 0);
  }

  // ----------------------------------------------------------------------- frame
  // focus: world position the shadow frustum should follow.
  render(dt, focus) {
    this.renderer.info.reset();
    this.mat.update(dt);
    this.dust.update(dt);
    this.dust.material.uniforms.uScale.value =
      this.renderer.domElement.height / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.env.update(this.camera, focus || this.player.position);
    this.post.render(dt);

    const info = this.renderer.info.render;
    this.frameStats.calls = info.calls;
    this.frameStats.triangles = info.triangles;
    const changed = this.dynRes.tick(dt);
    this.frameStats.fps = this.dynRes.fps;
    if (changed !== null) this.resize();
  }

  stats() {
    return { ...this.frameStats, tier: this.tier.name, auto: this.quality.auto, pixelRatio: +this.dynRes.current.toFixed(2) };
  }

  // ------------------------------------------------------------------- quality UI
  setQuality(choice) {
    saveChoice(choice);
    const url = new URL(location.href);
    url.searchParams.delete('quality');
    location.replace(url.toString());
  }

  bindQualityUI() {
    document.querySelectorAll('.quality-btn').forEach((btn) => {
      const q = btn.getAttribute('data-quality');
      btn.classList.toggle('active', q === this.quality.choice);
      if (q === 'auto') btn.title = `Auto → ${this.tier.name}`;
      btn.addEventListener('click', () => { if (q !== this.quality.choice) this.setQuality(q); });
    });
    const label = document.getElementById('quality-current');
    if (label) label.textContent = this.quality.auto ? `(${this.tier.name})` : '';
  }
}

export const gfx = new Gfx();
export { THREE };
