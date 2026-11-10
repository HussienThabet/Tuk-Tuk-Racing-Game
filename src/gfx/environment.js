// environment.js - sky, image-based lighting, sun + shadows, fog and exposure per time of day.
import * as THREE from 'three';

const deg = Math.PI / 180;

// Linear-space colours. `sun` values are for the directional light; `env` scales IBL.
export const PRESETS = {
  day: {
    elevation: 57, azimuth: 33,
    sunColor: 0xfff1d6, sunIntensity: 3.4,
    skyTop: 0x2f6fc4, skyHorizon: 0xcfd9e2, ground: 0x8a7a66,
    fog: 0xc9d3dc, fogDensity: 0.0021,
    exposure: 1.08, env: 1.05, hemi: 0.3, wetness: 0.22, glow: 1.0, windows: 0.0,
    bloom: 0.18, headlight: 0, night: false,
    grade: { tint: [1.02, 1.0, 0.97], contrast: 1.06, saturation: 1.05, vignette: 0.28 }
  },
  sunset: {
    elevation: 17, azimuth: 84,
    sunColor: 0xffa95c, sunIntensity: 3.6,
    skyTop: 0x41639c, skyHorizon: 0xf2b27a, ground: 0x7d6650,
    fog: 0xe0a877, fogDensity: 0.0034,
    exposure: 1.12, env: 1.1, hemi: 0.3, wetness: 0.32, glow: 1.4, windows: 0.25,
    bloom: 0.32, headlight: 0.5, night: false,
    grade: { tint: [1.06, 1.0, 0.9], contrast: 1.1, saturation: 1.08, vignette: 0.36 }
  },
  night: {
    elevation: 46, azimuth: -30,
    sunColor: 0x8fa8ff, sunIntensity: 0.55,
    skyTop: 0x04050d, skyHorizon: 0x151a33, ground: 0x0b0b12,
    fog: 0x0d1024, fogDensity: 0.0036,
    exposure: 1.15, env: 0.55, hemi: 0.35, wetness: 0.6, glow: 2.1, windows: 1.0,
    bloom: 0.55, headlight: 1, night: true,
    grade: { tint: [0.94, 0.99, 1.08], contrast: 1.1, saturation: 0.95, vignette: 0.42 }
  },
  ramadan: {
    elevation: 34, azimuth: 120,
    sunColor: 0xffc98a, sunIntensity: 0.7,
    skyTop: 0x0a0718, skyHorizon: 0x35204a, ground: 0x130d1c,
    fog: 0x24163a, fogDensity: 0.0032,
    exposure: 1.18, env: 0.65, hemi: 0.4, wetness: 0.45, glow: 2.3, windows: 1.0,
    bloom: 0.62, headlight: 1, night: true,
    grade: { tint: [1.05, 0.98, 1.02], contrast: 1.08, saturation: 1.1, vignette: 0.4 }
  }
};

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
    gl_Position.z = gl_Position.w; // always at the far plane
  }`;

const SKY_FRAG = /* glsl */`
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunGain;
  uniform float uStars;
  varying vec3 vDir;

  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.48));
    col = mix(col, uGround, smoothstep(0.0, -0.12, h));

    float mu = max(dot(d, uSunDir), 0.0);
    // haze glow around the sun, strongest near the horizon
    col += uSunColor * pow(mu, 6.0) * 0.22 * (1.0 - smoothstep(0.0, 0.7, h) * 0.6);
    col += uSunColor * pow(mu, 48.0) * 0.5;
    col += uSunColor * smoothstep(0.9993, 0.9998, mu) * uSunGain * step(-0.02, h);

    if (uStars > 0.0 && h > 0.02) {
      vec3 cell = floor(d * 190.0);
      float s = step(0.9975, hash(cell)) * hash(cell + 3.1);
      col += vec3(s) * uStars * smoothstep(0.02, 0.3, h);
    }

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export class Environment {
  constructor(renderer, scene, tier, textures) {
    this.renderer = renderer;
    this.scene = scene;
    this.tier = tier;
    this.textures = textures;
    this.mode = 'day';
    this.preset = PRESETS.day;
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envTarget = null;
    this.equirect = null;       // loaded Higgsfield panorama (lazy)
    this.equirectLoading = false;
    this.windowMaterials = [];  // facade materials with a lit-window emissive map
    this.glowMaterials = [];    // unlit batches that should brighten at night

    this.uniforms = {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGround: { value: new THREE.Color() },
      uSunDir: { value: this.sunDir },
      uSunColor: { value: new THREE.Color() },
      uSunGain: { value: 18 },
      uStars: { value: 0 }
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: THREE.BackSide, depthWrite: false, fog: false
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMat);
    this.sky.scale.setScalar(500);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.sky.userData.noAO = true;
    this.sky.userData.noMerge = true;
    scene.add(this.sky);

    // Separate copy used only to bake the environment map (sun clamped to avoid fireflies).
    this.envUniforms = THREE.UniformsUtils.clone(this.uniforms);
    this.envScene = new THREE.Scene();
    this.envScene.add(new THREE.Mesh(this.sky.geometry, new THREE.ShaderMaterial({
      uniforms: this.envUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false
    })));
    this.envScene.children[0].scale.setScalar(50);

    this.sun = null;
    this.hemi = null;
    this.ambient = null;
    this.shadowTarget = new THREE.Vector3();
  }

  // Takes over the lights the city created.
  adoptLights(city) {
    this.sun = city.dirLight;
    this.hemi = city.hemiLight;
    this.ambient = city.ambientLight;
    this.scene.add(this.sun.target);
    if (this.tier.shadows) {
      const s = this.sun.shadow;
      const r = this.tier.shadowRange;
      this.sun.castShadow = true;
      s.mapSize.set(this.tier.shadowSize, this.tier.shadowSize);
      s.camera.left = -r; s.camera.right = r; s.camera.top = r; s.camera.bottom = -r;
      s.camera.near = 20; s.camera.far = 420;
      s.bias = -0.0004;
      s.normalBias = 0.06;
      s.radius = 2.5;
      s.camera.updateProjectionMatrix();
    }
  }

  apply(mode) {
    const p = PRESETS[mode] || PRESETS.day;
    this.mode = mode;
    this.preset = p;

    const el = p.elevation * deg, az = p.azimuth * deg;
    this.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();

    const u = this.uniforms;
    u.uTop.value.setHex(p.skyTop);
    u.uHorizon.value.setHex(p.skyHorizon);
    u.uGround.value.setHex(p.ground);
    u.uSunColor.value.setHex(p.sunColor);
    u.uSunGain.value = p.night ? 2.5 : 22;
    u.uStars.value = p.night ? 1.6 : 0;

    const e = this.envUniforms;
    e.uTop.value.copy(u.uTop.value);
    e.uHorizon.value.copy(u.uHorizon.value);
    e.uGround.value.copy(u.uGround.value);
    e.uSunDir.value.copy(this.sunDir);
    e.uSunColor.value.copy(u.uSunColor.value);
    e.uSunGain.value = p.night ? 1 : 4;
    e.uStars.value = 0;

    this.scene.background = new THREE.Color(p.fog);
    this.scene.fog = new THREE.FogExp2(p.fog, p.fogDensity);
    this.renderer.toneMappingExposure = p.exposure;

    if (this.sun) {
      this.sun.color.setHex(p.sunColor);
      this.sun.intensity = p.sunIntensity;
    }
    if (this.hemi) {
      this.hemi.color.setHex(p.skyTop).lerp(new THREE.Color(p.skyHorizon), 0.5);
      this.hemi.groundColor.setHex(p.ground);
      this.hemi.intensity = p.hemi;
    }
    if (this.ambient) this.ambient.intensity = 0; // image-based lighting replaces flat ambient

    this.windowMaterials.forEach((m) => { m.emissiveIntensity = p.windows * 1.6; });
    this.glowMaterials.forEach((m) => { m.color.setScalar(p.glow); });

    this.bakeEnvironment();
    if (mode === 'sunset') this.loadEquirect();
    else this.sky.visible = true;
  }

  bakeEnvironment() {
    const old = this.envTarget;
    this.envTarget = this.pmrem.fromScene(this.envScene, 0.03, 1, 200);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = this.preset.env;
    if (old) old.dispose();
  }

  // Lazy: the generated golden-hour panorama replaces the procedural sky once loaded.
  loadEquirect() {
    const asset = this.textures.asset('env_sky_golden_hour');
    if (!asset || asset.status !== 'ready') return;
    if (this.equirect) return this.useEquirect();
    if (this.equirectLoading) return;
    this.equirectLoading = true;
    new THREE.TextureLoader().load(this.textures.url(asset), (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      this.equirect = tex;
      this.equirectEnv = this.pmrem.fromEquirectangular(tex);
      if (this.mode === 'sunset') this.useEquirect();
    }, undefined, () => { this.equirectLoading = false; });
  }

  useEquirect() {
    this.scene.background = this.equirect;
    this.scene.environment = this.equirectEnv.texture;
    this.sky.visible = false;
  }

  // Keeps the sky centred on the camera and the shadow frustum centred on the player.
  update(camera, focus) {
    this.sky.position.copy(camera.position);
    if (!this.sun) return;
    const t = this.shadowTarget.copy(focus);
    if (this.tier.shadows) {
      // snap to shadow texels so the shadow edge does not shimmer while driving
      const texel = (this.tier.shadowRange * 2) / this.tier.shadowSize * 4;
      t.x = Math.round(t.x / texel) * texel;
      t.z = Math.round(t.z / texel) * texel;
    }
    t.y = 0;
    this.sun.target.position.copy(t);
    this.sun.position.copy(t).addScaledVector(this.sunDir, 200);
  }
}
