// effects.js - wheel dust, skid marks and soft contact shadows.
import * as THREE from 'three';

// ---------------------------------------------------------------- dust particles
export class DustSystem {
  constructor(scene, count) {
    this.count = count;
    this.cursor = 0;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);     // remaining seconds
    this.maxLife = new Float32Array(count);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.baseAlpha = new Float32Array(count);
    this.baseSize = new Float32Array(count);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xc9b08a) },
        uScale: { value: 400 }
      },
      vertexShader: /* glsl */`
        attribute float aSize;
        attribute float aAlpha;
        uniform float uScale;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / max(0.1, -mv.z);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = smoothstep(1.0, 0.15, d) * vAlpha;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.points.userData.noMerge = true;
    scene.add(this.points);
  }

  setLook(color, viewportHeight, fov) {
    this.material.uniforms.uColor.value.copy(color);
    this.material.uniforms.uScale.value = viewportHeight / (2 * Math.tan((fov * Math.PI) / 360));
  }

  emit(x, y, z, vx, vy, vz, size, life, alpha) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.count;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = this.maxLife[i] = life;
    this.baseSize[i] = size;
    this.baseAlpha[i] = alpha;
  }

  update(dt) {
    const drag = Math.pow(0.18, dt);
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const t = 1 - Math.max(0, this.life[i]) / this.maxLife[i]; // 0 -> 1
      this.vel[i * 3] *= drag; this.vel[i * 3 + 2] *= drag;
      this.vel[i * 3 + 1] += (0.5 - this.vel[i * 3 + 1]) * Math.min(1, dt * 2);
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.baseSize[i] * (0.6 + t * 2.2);
      this.alpha[i] = this.baseAlpha[i] * Math.min(1, t * 8) * (1 - t) * (1 - t);
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = true;
    a.aSize.needsUpdate = true;
    a.aAlpha.needsUpdate = true;
  }
}

// -------------------------------------------------------------------- skid marks
export class SkidMarks {
  constructor(scene, segments) {
    this.segments = segments;
    this.cursor = 0;
    this.pos = new Float32Array(segments * 6 * 3);
    this.col = new Float32Array(segments * 6 * 4);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x0a0a0c, vertexColors: true, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.userData.noMerge = true;
    this.mesh.userData.noAO = true;
    scene.add(this.mesh);
    this.last = new Map(); // wheel id -> { x, z, lx, lz, rx, rz, alpha }
  }

  // Call every frame per wheel. `strength` 0 lifts the "pen".
  mark(id, x, z, dirX, dirZ, width, strength) {
    if (strength <= 0.02) { this.last.delete(id); return; }
    // perpendicular to travel direction
    const px = -dirZ * width * 0.5, pz = dirX * width * 0.5;
    const cur = { x, z, lx: x - px, lz: z - pz, rx: x + px, rz: z + pz, alpha: Math.min(0.75, strength) };
    const prev = this.last.get(id);
    if (!prev) { this.last.set(id, cur); return; }
    const d = Math.hypot(x - prev.x, z - prev.z);
    if (d < 0.35) return;
    if (d < 6) this.quad(prev, cur);
    this.last.set(id, cur);
  }

  quad(a, b) {
    const y = 0.035;
    const i = this.cursor * 18, c = this.cursor * 24;
    this.cursor = (this.cursor + 1) % this.segments;
    const v = [a.lx, a.lz, a.alpha, a.rx, a.rz, a.alpha, b.lx, b.lz, b.alpha, b.lx, b.lz, b.alpha, a.rx, a.rz, a.alpha, b.rx, b.rz, b.alpha];
    for (let k = 0; k < 6; k++) {
      this.pos[i + k * 3] = v[k * 3];
      this.pos[i + k * 3 + 1] = y;
      this.pos[i + k * 3 + 2] = v[k * 3 + 1];
      this.col[c + k * 4] = 1; this.col[c + k * 4 + 1] = 1; this.col[c + k * 4 + 2] = 1;
      this.col[c + k * 4 + 3] = v[k * 3 + 2];
    }
    const g = this.mesh.geometry.attributes;
    g.position.needsUpdate = true;
    g.color.needsUpdate = true;
  }

  clear() {
    this.pos.fill(0);
    this.col.fill(0);
    this.last.clear();
    const g = this.mesh.geometry.attributes;
    g.position.needsUpdate = true;
    g.color.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- contact shadow
let blobGeo = null;

export function createContactShadow(texture, width, length, opacity = 0.55) {
  if (!blobGeo) {
    blobGeo = new THREE.PlaneGeometry(1, 1);
    blobGeo.rotateX(-Math.PI / 2);
  }
  const mat = new THREE.MeshBasicMaterial({
    map: texture, color: 0x000000, transparent: true, opacity, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, fog: false
  });
  mat.userData.baseOpacity = opacity;
  const mesh = new THREE.Mesh(blobGeo, mat);
  mesh.scale.set(width, 1, length);
  mesh.position.y = 0.04;
  mesh.renderOrder = 3;
  mesh.userData.noMerge = true;
  mesh.userData.noAO = true;
  return mesh;
}
