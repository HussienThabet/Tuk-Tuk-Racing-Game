// post.js - post-processing chain:
//   scene -> [GTAO] -> [bloom] -> ACES tone map + sRGB -> final look pass
// The final pass does speed blur, mild far depth of field (High), colour grading,
// vignette and film grain in a single full-screen draw.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

// GTAO renders the scene with a normal override material; transparent helpers
// (beacons, glow planes, particles, sky) must not leave AO halos.
class SceneGTAOPass extends GTAOPass {
  overrideVisibility() {
    const cache = this._visibilityCache;
    this.scene.traverse((o) => {
      cache.set(o, o.visible);
      if (o.isPoints || o.isLine || o.userData.noAO) o.visible = false;
      else if (o.isMesh && o.material && !Array.isArray(o.material) && (o.material.transparent || o.material.isShaderMaterial)) o.visible = false;
    });
  }

  // The shadow maps were already updated by the main render pass this frame.
  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    const auto = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    renderer.shadowMap.autoUpdate = auto;
  }
}

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uSpeedBlur: { value: 0 },
    uDof: { value: 0 },
    uFocus: { value: 60 },
    uNear: { value: 0.5 },
    uFar: { value: 700 },
    uTint: { value: new THREE.Vector3(1, 1, 1) },
    uContrast: { value: 1 },
    uSaturation: { value: 1 },
    uVignette: { value: 0.3 },
    uGrain: { value: 0 }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 uResolution;
    uniform float uTime, uSpeedBlur, uDof, uFocus, uNear, uFar;
    uniform vec3 uTint;
    uniform float uContrast, uSaturation, uVignette, uGrain;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    float viewDepth(vec2 uv) {
      float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
      return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
    }

    void main() {
      vec2 toCentre = vUv - 0.5;
      float edge = dot(toCentre, toCentre);
      vec3 col = texture2D(tDiffuse, vUv).rgb;

      #ifdef USE_SPEED_BLUR
      // radial blur that grows toward the screen edges: reads as motion blur at speed
      if (uSpeedBlur > 0.001) {
        vec2 stepv = -toCentre * uSpeedBlur * edge * 0.05;
        float jitter = hash(gl_FragCoord.xy + uTime) - 0.5;
        vec3 acc = col;
        for (int i = 1; i <= 7; i++) acc += texture2D(tDiffuse, vUv + stepv * (float(i) + jitter)).rgb;
        col = acc / 8.0;
      }
      #endif

      #ifdef USE_DOF
      // mild far-field blur only: the tuk-tuk and the street around it stay sharp
      float coc = smoothstep(uFocus, uFocus * 5.0, viewDepth(vUv)) * uDof;
      if (coc > 0.05) {
        vec2 px = coc / uResolution;
        vec3 acc = col;
        acc += texture2D(tDiffuse, vUv + px * vec2( 0.94,  0.34)).rgb;
        acc += texture2D(tDiffuse, vUv + px * vec2(-0.34,  0.94)).rgb;
        acc += texture2D(tDiffuse, vUv + px * vec2(-0.94, -0.34)).rgb;
        acc += texture2D(tDiffuse, vUv + px * vec2( 0.34, -0.94)).rgb;
        acc += texture2D(tDiffuse, vUv + px * vec2( 0.5,  -0.5)).rgb;
        acc += texture2D(tDiffuse, vUv + px * vec2(-0.5,   0.5)).rgb;
        col = acc / 7.0;
      }
      #endif

      // colour grade (display space): tint, contrast around mid-grey, saturation
      col *= uTint;
      col = (col - 0.5) * uContrast + 0.5;
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, uSaturation);
      // gentle split-tone: cool shadows, warm highlights
      col += (luma - 0.5) * vec3(0.025, 0.0, -0.03);

      col *= 1.0 - uVignette * smoothstep(0.08, 0.62, edge);
      col += (hash(gl_FragCoord.xy * 0.71 + fract(uTime) * 91.7) - 0.5) * uGrain;

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`
};

export class PostFX {
  constructor(renderer, scene, camera, tier) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.tier = tier;
    this.enabled = tier.composer;
    this.speedBlur = 0;
    if (!this.enabled) return;

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: tier.msaaSamples
    });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));

    if (tier.gtao) {
      this.gtao = new SceneGTAOPass(scene, camera, size.x, size.y);
      this.gtao.blendIntensity = 0.85;
      this.gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12, screenSpaceRadius: false });
      this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 8 });
      this.composer.addPass(this.gtao);
    }

    if (tier.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.25, 0.55, 1.0);
      this.composer.addPass(this.bloom);
    }

    this.composer.addPass(new OutputPass());

    this.final = new ShaderPass(FinalShader);
    const defines = this.final.material.defines || (this.final.material.defines = {});
    if (tier.motionBlur) defines.USE_SPEED_BLUR = '';
    if (tier.dof && this.gtao) {
      defines.USE_DOF = '';
      this.final.uniforms.tDepth.value = this.gtao.depthTexture;
    }
    this.final.uniforms.uGrain.value = tier.grain ? 0.035 : 0;
    this.final.uniforms.uResolution.value.copy(size);
    this.composer.addPass(this.final);
  }

  applyPreset(p) {
    if (!this.enabled) return;
    if (this.bloom) this.bloom.strength = p.bloom;
    const u = this.final.uniforms;
    u.uTint.value.set(p.grade.tint[0], p.grade.tint[1], p.grade.tint[2]);
    u.uContrast.value = p.grade.contrast;
    u.uSaturation.value = p.grade.saturation;
    u.uVignette.value = p.grade.vignette;
    u.uDof.value = this.tier.dof ? 2.2 : 0;
  }

  setSize(width, height, pixelRatio) {
    if (!this.enabled) return;
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.final.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
  }

  render(dt) {
    if (!this.enabled) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const u = this.final.uniforms;
    u.uTime.value += dt;
    u.uSpeedBlur.value += (this.speedBlur - u.uSpeedBlur.value) * Math.min(1, dt * 5);
    u.uNear.value = this.camera.near;
    u.uFar.value = this.camera.far;
    this.composer.render(dt);
  }
}
