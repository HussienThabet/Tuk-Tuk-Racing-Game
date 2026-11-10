// camera.js - spring-damped chase camera with speed FOV and high-speed shake.
import * as THREE from 'three';

// Critically damped spring (same behaviour as Unity's SmoothDamp), per component.
function smoothDamp(current, target, velocity, key, smoothTime, dt) {
  const omega = 2 / Math.max(0.0001, smoothTime);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity[key] + omega * change) * dt;
  velocity[key] = (velocity[key] - omega * temp) * exp;
  return target + (change + temp) * exp;
}

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.posVel = { x: 0, y: 0, z: 0 };
    this.lookVel = { x: 0, y: 0, z: 0 };
    this.trauma = 0;      // one-off impulses (crashes, landings), decays over time
    this.time = 0;
    this.roll = 0;
    this.needsSnap = true;
  }

  snap() { this.needsSnap = true; }

  addImpulse(amount) { this.trauma = Math.min(1, this.trauma + amount); }

  // preset: { dist, height, lookAhead }
  update(dt, v, preset, world, steer) {
    this.time += dt;
    const speedRatio = Math.min(1.5, Math.abs(v.speed) / v.maxSpeed);
    const dist = preset.dist + (v.isNitro ? 1.6 : 0) + speedRatio * 0.9;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const baseY = v.position.y + v.yOffset;

    // pull the camera forward if a building would block the view
    let t = 1;
    for (; t > 0.28; t -= 0.12) {
      if (!world.pointBlocked(v.position.x - fx * dist * t, v.position.z - fz * dist * t, 0.9)) break;
    }
    const tx = v.position.x - fx * dist * t;
    const tz = v.position.z - fz * dist * t;
    const ty = baseY + preset.height * (0.75 + 0.25 * t);
    const lx = v.position.x + fx * preset.lookAhead;
    const ly = baseY + 1.35;
    const lz = v.position.z + fz * preset.lookAhead;

    if (this.needsSnap || Math.hypot(this.pos.x - tx, this.pos.z - tz) > 40) {
      this.pos.set(tx, ty, tz);
      this.look.set(lx, ly, lz);
      this.posVel.x = this.posVel.y = this.posVel.z = 0;
      this.lookVel.x = this.lookVel.y = this.lookVel.z = 0;
      this.needsSnap = false;
    } else {
      this.pos.x = smoothDamp(this.pos.x, tx, this.posVel, 'x', 0.13, dt);
      this.pos.z = smoothDamp(this.pos.z, tz, this.posVel, 'z', 0.13, dt);
      this.pos.y = smoothDamp(this.pos.y, ty, this.posVel, 'y', 0.2, dt);
      this.look.x = smoothDamp(this.look.x, lx, this.lookVel, 'x', 0.07, dt);
      this.look.z = smoothDamp(this.look.z, lz, this.lookVel, 'z', 0.07, dt);
      this.look.y = smoothDamp(this.look.y, ly, this.lookVel, 'y', 0.12, dt);
      // the spring can cut a corner: never let it end up inside a building
      if (world.pointBlocked(this.pos.x, this.pos.z, 0.4)) {
        this.pos.x += (tx - this.pos.x) * 0.5;
        this.pos.z += (tz - this.pos.z) * 0.5;
      }
    }

    // shake: continuous rumble above ~70% speed and on nitro, plus decaying impulses
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const rumble = Math.max(0, speedRatio - 0.7) * 0.9 + (v.isNitro ? 0.22 : 0);
    const k = Math.min(1, rumble + this.trauma);
    const amp = k * k;
    const n = this.time;
    const sx = (Math.sin(n * 37.1) + Math.sin(n * 61.7 + 1.3)) * 0.5;
    const sy = (Math.sin(n * 43.3 + 2.1) + Math.sin(n * 71.9)) * 0.5;
    const sr = Math.sin(n * 29.7 + 0.7);

    const cam = this.camera;
    cam.position.set(this.pos.x + sx * amp * 0.09, this.pos.y + sy * amp * 0.07, this.pos.z);
    cam.lookAt(this.look);
    const targetRoll = -(steer || 0) * 0.035 * Math.min(1, speedRatio) + sr * amp * 0.006;
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 6);
    cam.rotateZ(this.roll);

    const targetFov = 58 + 12 * Math.pow(Math.min(1, speedRatio), 1.6) + (v.isNitro ? 8 : 0);
    cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 4);
    cam.updateProjectionMatrix();
    return speedRatio;
  }
}
