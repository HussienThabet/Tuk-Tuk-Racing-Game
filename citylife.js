// citylife.js - Living open-world city: road-graph traffic, pedestrians, pickups, funny events,
// plus helpers to build passenger / destination markers for the taxi missions.

class CityLife extends StreetEntitiesManager {
  constructor(scene, world) {
    super(scene, world); // base skips the old race-track spawns when world.isCity

    this.cars = [];
    this.peds = [];
    this.pickups = [];
    this.events = [];
    this.eventCooldown = 24;
    this.crashCooldown = 0;

    this.spawnCars(24);
    this.spawnPeds(46);
    this.spawnPickups(90);
  }

  // ================================================================ TRAFFIC
  spawnCars(count) {
    const w = this.world;
    const spawn = { x: 4 * w.C, z: 4 * w.C };
    for (let n = 0; n < count; n++) {
      const built = n % 2 === 0 ? this.buildDetailedMicrobus(n) : this.buildDetailedCairoTaxi(n);
      this.group.add(built.vGroup);

      const car = {
        mesh: built.vGroup,
        wheels: built.wheels,
        axis: 'x',
        sign: 1,
        line: 0,
        a: 0,
        k: 0,
        speed: 0,
        base: 9 + Math.random() * 7,
        hold: 0,
        nm: 0,
        x: 0,
        z: 0,
        heading: 0,
        snap: true
      };

      // pick a start slot that is not on top of the player spawn
      for (let tries = 0; tries < 12; tries++) {
        car.axis = Math.random() < 0.5 ? 'x' : 'z';
        car.sign = Math.random() < 0.5 ? -1 : 1;
        car.line = Math.floor(Math.random() * (w.N + 1));
        car.a = 12 + Math.random() * (w.size - 24);
        this.carPose(car);
        const dx = car.x - spawn.x, dz = car.z - spawn.z;
        if (dx * dx + dz * dz > 60 * 60) break;
      }
      this.carNextNode(car);
      this.cars.push(car);
    }
  }

  carPose(car) {
    const C = this.world.C;
    const lane = 3.6;
    if (car.axis === 'x') {
      car.x = car.a;
      car.z = car.line * C + car.sign * lane;
      car.heading = car.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.z = car.a;
      car.x = car.line * C - car.sign * lane;
      car.heading = car.sign > 0 ? 0 : Math.PI;
    }
  }

  carNextNode(car) {
    const C = this.world.C, N = this.world.N;
    if (car.sign > 0) car.k = Math.min(N, Math.floor(car.a / C + 1e-6) + 1);
    else car.k = Math.max(0, Math.ceil(car.a / C - 1e-6) - 1);
  }

  carChoose(car) {
    const C = this.world.C, N = this.world.N;
    const opts = [];
    if (car.k + car.sign >= 0 && car.k + car.sign <= N) opts.push({ t: 's', w: 0.56 });
    [-1, 1].forEach((ns) => {
      const nk = car.line + ns;
      if (nk >= 0 && nk <= N) opts.push({ t: 't', ns, w: 0.22 });
    });
    let total = 0;
    opts.forEach((o) => (total += o.w));
    let r = Math.random() * total;
    let pick = opts[0];
    for (const o of opts) {
      r -= o.w;
      if (r <= 0) { pick = o; break; }
    }

    if (pick.t === 's') {
      car.k += car.sign;
    } else {
      const oldLine = car.line, oldK = car.k;
      car.axis = car.axis === 'x' ? 'z' : 'x';
      car.line = oldK;
      car.a = oldLine * C;
      car.sign = pick.ns;
      car.k = oldLine + pick.ns;
    }
  }

  updateCars(dt, player, cb) {
    const C = this.world.C;
    const px = player.position.x, pz = player.position.z;

    for (let n = 0; n < this.cars.length; n++) {
      const car = this.cars[n];
      if (car.hold > 0) car.hold -= dt;
      if (car.nm > 0) car.nm -= dt;

      let target = car.hold > 0 ? 0 : car.base;
      for (let m = 0; m < this.cars.length; m++) {
        const o = this.cars[m];
        if (o === car || o.axis !== car.axis || o.line !== car.line || o.sign !== car.sign) continue;
        const d = car.sign * (o.a - car.a);
        if (d > 0 && d < 12) target = Math.min(target, d < 6.5 ? 0 : o.speed * 0.9);
      }

      car.speed += (target - car.speed) * Math.min(1, dt * 2.6);
      car.a += car.sign * car.speed * dt;
      if (car.sign * (car.a - car.k * C) >= 0) {
        car.a = car.k * C;
        this.carChoose(car);
      }
      this.carPose(car);

      const mesh = car.mesh;
      if (car.snap) {
        mesh.position.set(car.x, 0, car.z);
        mesh.rotation.y = car.heading;
        car.snap = false;
      } else {
        const k = Math.min(1, dt * 9);
        mesh.position.x += (car.x - mesh.position.x) * k;
        mesh.position.z += (car.z - mesh.position.z) * k;
        let diff = car.heading - mesh.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        mesh.rotation.y += diff * Math.min(1, dt * 7);
      }

      const dxp = mesh.position.x - px, dzp = mesh.position.z - pz;
      const d2 = dxp * dxp + dzp * dzp;
      mesh.visible = d2 < 330 * 330;
      if (!mesh.visible) continue;
      car.wheels.forEach((w) => (w.rotation.x += car.speed * dt * 2.2));

      // collision / near miss with the player
      const dist = Math.sqrt(d2);
      if (dist < 3.3 && player.yOffset < 1.4) {
        const len = dist || 1;
        const overlap = 3.3 - dist;
        // dxp points from the player to the car, so push the player the opposite way
        player.position.x -= (dxp / len) * overlap;
        player.position.z -= (dzp / len) * overlap;
        const impact = Math.abs(player.speed);
        player.speed *= 0.5;
        car.hold = 1.4;
        if (this.crashCooldown <= 0) {
          this.crashCooldown = 0.5;
          if (cb && cb.onCrash) cb.onCrash(impact, 'car');
        }
      } else if (dist < 5.2 && Math.abs(player.speed) > 16 && car.nm <= 0) {
        car.nm = 3;
        if (cb && cb.onNearMiss) cb.onNearMiss();
      }
    }
  }

  // ============================================================ PEDESTRIANS
  spawnPeds(count) {
    const shirts = [0xe63946, 0x457b9d, 0xf4a261, 0x2a9d8f, 0xe9c46a, 0x8338ec, 0xffffff, 0x6d597a];
    this.pedGeo = {
      body: new THREE.CylinderGeometry(0.3, 0.36, 1.0, 8),
      head: new THREE.SphereGeometry(0.27, 8, 8)
    };
    this.pedMats = shirts.map((c) => new THREE.MeshLambertMaterial({ color: c }));
    this.pedSkin = new THREE.MeshLambertMaterial({ color: 0xd49a6a });

    for (let n = 0; n < count; n++) {
      let charObj = null;
      let g = null;
      if (window.EgyptianPeople && window.EgyptianPeople.createPedestrian) {
        charObj = window.EgyptianPeople.createPedestrian(n);
        g = charObj.group;
      } else {
        g = new THREE.Group();
        const body = new THREE.Mesh(this.pedGeo.body, this.pedMats[n % this.pedMats.length]);
        body.position.y = 0.95;
        const head = new THREE.Mesh(this.pedGeo.head, this.pedSkin);
        head.position.y = 1.7;
        g.add(body, head);
      }
      this.group.add(g);

      const ped = {
        mesh: g,
        char: charObj,
        axis: 'x',
        line: 0,
        side: 1,
        sign: 1,
        a: 0,
        speed: 1.2 + Math.random() * 0.9,
        state: 'walk',
        t: Math.random() * 10,
        vel: new THREE.Vector3(),
        timer: 0
      };
      this.pedRespawn(ped);
      this.peds.push(ped);
    }
  }

  pedRespawn(ped) {
    const w = this.world;
    ped.axis = Math.random() < 0.5 ? 'x' : 'z';
    ped.line = Math.floor(Math.random() * (w.N + 1));
    ped.side = ped.line === 0 ? 1 : ped.line === w.N ? -1 : Math.random() < 0.5 ? -1 : 1;
    ped.sign = Math.random() < 0.5 ? -1 : 1;
    ped.a = 6 + Math.random() * (w.size - 12);
    ped.state = 'walk';
    ped.timer = 0;
    ped.mesh.rotation.set(0, 0, 0);
    ped.mesh.position.y = 0.3;
    this.pedPose(ped);
    ped.mesh.position.x = ped.x;
    ped.mesh.position.z = ped.z;
  }

  pedPose(ped) {
    const C = this.world.C;
    if (ped.axis === 'x') {
      ped.x = ped.a;
      ped.z = ped.line * C + ped.side * 8.2;
    } else {
      ped.z = ped.a;
      ped.x = ped.line * C + ped.side * 8.2;
    }
  }

  updatePeds(dt, player, cb) {
    const w = this.world;
    const px = player.position.x, pz = player.position.z;
    for (let n = 0; n < this.peds.length; n++) {
      const p = this.peds[n];
      const m = p.mesh;
      const dxp = m.position.x - px, dzp = m.position.z - pz;
      const d2 = dxp * dxp + dzp * dzp;

      if (p.state === 'walk') {
        p.a += p.sign * p.speed * dt;
        if (p.a < 4) { p.a = 4; p.sign = 1; }
        if (p.a > w.size - 4) { p.a = w.size - 4; p.sign = -1; }
        p.t += dt;
        this.pedPose(p);
        m.position.x = p.x;
        m.position.z = p.z;
        m.position.y = 0.3 + Math.abs(Math.sin(p.t * 7)) * 0.04;
        m.rotation.y = p.axis === 'x' ? (p.sign > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.sign > 0 ? 0 : Math.PI);
        m.visible = d2 < 190 * 190;

        if (m.visible && p.char && p.char.updateWalk) {
          p.char.updateWalk(p.t, p.speed);
        }

        if (m.visible && d2 < 2.9 * 2.9 && Math.abs(player.speed) > 5 && player.yOffset < 1.0) {
          const len = Math.sqrt(d2) || 1;
          p.state = 'fly';
          p.timer = 0;
          // dxp points from the player to the pedestrian: fling them away + along the tuk-tuk heading
          p.vel.set(
            (dxp / len) * Math.abs(player.speed) * 0.5 + Math.sin(player.heading) * player.speed * 0.4,
            7 + Math.random() * 3,
            (dzp / len) * Math.abs(player.speed) * 0.5 + Math.cos(player.heading) * player.speed * 0.4
          );
          player.speed *= 0.93;
          if (cb && cb.onPedHit) cb.onPedHit();
        }
      } else if (p.state === 'fly') {
        p.timer += dt;
        if (p.char && p.char.updateFlail) {
          p.char.updateFlail(p.timer);
        }
        p.vel.y -= 26 * dt;
        m.position.x += p.vel.x * dt;
        m.position.z += p.vel.z * dt;
        m.position.y += p.vel.y * dt;
        m.rotation.x += dt * 9;
        m.rotation.z += dt * 6;
        if (m.position.y <= 0.3 && p.vel.y < 0) {
          m.position.y = 0.3;
          p.state = 'down';
          p.timer = 0;
          m.rotation.set(Math.PI / 2, m.rotation.y, 0);
        }
      } else {
        p.timer += dt;
        if (p.timer > 2.8) this.pedRespawn(p);
      }
    }
  }

  // ================================================================ PICKUPS
  spawnPickups(count) {
    const w = this.world;
    const coinGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.18, 14);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshBasicMaterial({ color: 0xffbe0b });
    const nitroGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.3, 10);
    const nitroMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4 });
    const fuelGeo = new THREE.BoxGeometry(0.9, 1.1, 0.6);
    const fuelMat = new THREE.MeshBasicMaterial({ color: 0x38b000 });

    for (let n = 0; n < count; n++) {
      const horizontal = Math.random() < 0.5;
      const line = Math.floor(Math.random() * (w.N + 1));
      const along = 8 + Math.random() * (w.size - 16);
      const lane = (Math.random() - 0.5) * 11;
      const x = horizontal ? along : line * w.C + lane;
      const z = horizontal ? line * w.C + lane : along;

      let type = 'coin';
      let mesh;
      if (n % 11 === 0) { type = 'nitro'; mesh = new THREE.Mesh(nitroGeo, nitroMat); }
      else if (n % 13 === 0) { type = 'fuel'; mesh = new THREE.Mesh(fuelGeo, fuelMat); }
      else mesh = new THREE.Mesh(coinGeo, coinMat);

      mesh.position.set(x, 1.2, z);
      this.group.add(mesh);
      this.pickups.push({ mesh, type, x, z, active: true, respawn: 0 });
    }
  }

  updatePickups(dt, player, cb) {
    const px = player.position.x, pz = player.position.z;
    for (let n = 0; n < this.pickups.length; n++) {
      const it = this.pickups[n];
      if (!it.active) {
        it.respawn -= dt;
        if (it.respawn <= 0) it.active = true;
        it.mesh.visible = false;
        continue;
      }
      const dx = it.x - px, dz = it.z - pz;
      const d2 = dx * dx + dz * dz;
      it.mesh.visible = d2 < 170 * 170;
      if (!it.mesh.visible) continue;
      it.mesh.rotation.y += dt * 2.8;
      it.mesh.position.y = 1.2 + Math.sin(performance.now() * 0.004 + n) * 0.15;

      if (d2 < 5.2) {
        it.active = false;
        it.respawn = 25;
        it.mesh.visible = false;
        if (it.type === 'nitro') player.nitro = 100;
        else if (it.type === 'fuel') player.fuel = 100;
        if (cb && cb.onPickup) cb.onPickup(it.type);
      }
    }
  }

  // ============================================================ RANDOM EVENTS
  buildChickenFlock() {
    const g = new THREE.Group();
    for (let c = -2; c <= 2; c++) {
      const chick = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      body.position.y = 0.6;
      const comb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 0.35), new THREE.MeshBasicMaterial({ color: 0xe6192e }));
      comb.position.set(0, 1.15, 0.2);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.35, 6), new THREE.MeshBasicMaterial({ color: 0xffbe0b }));
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.85, 0.55);
      chick.add(body, comb, beak);
      chick.position.set(c * 1.5, 0, (Math.random() - 0.5) * 1.5);
      g.add(chick);
    }
    return g;
  }

  buildWatermelons() {
    const g = new THREE.Group();
    for (let w = -2; w <= 2; w++) {
      const melon = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 10), new THREE.MeshLambertMaterial({ color: 0x2b9348 }));
      melon.position.set(w * 2.1, 0.75, (Math.random() - 0.5) * 2.0);
      g.add(melon);
    }
    return g;
  }

  triggerCityEvent(player) {
    const w = this.world;
    const C = w.C;
    const px = player.position.x, pz = player.position.z;
    const lineX = Math.max(0, Math.min(w.N, Math.round(px / C)));
    const lineZ = Math.max(0, Math.min(w.N, Math.round(pz / C)));
    const offX = Math.abs(px - lineX * C);
    const offZ = Math.abs(pz - lineZ * C);
    const fx = Math.sin(player.heading), fz = Math.cos(player.heading);

    let x, z, axis;
    if (offZ <= offX) {
      // driving along a horizontal road (z ~ lineZ*C)
      x = Math.max(8, Math.min(w.size - 8, px + Math.sign(fx || 1) * 55));
      z = lineZ * C;
      axis = 'z'; // creatures cross along Z
    } else {
      z = Math.max(8, Math.min(w.size - 8, pz + Math.sign(fz || 1) * 55));
      x = lineX * C;
      axis = 'x';
    }

    const isChicken = Math.random() < 0.55;
    const mesh = isChicken ? this.buildChickenFlock() : this.buildWatermelons();
    if (axis === 'x') mesh.rotation.y = Math.PI / 2;
    mesh.position.set(x, 0, z);
    this.group.add(mesh);
    this.events.push({ mesh, base: new THREE.Vector3(x, 0, z), axis, phase: 0, ttl: 10, type: isChicken ? 'chicken' : 'watermelon' });

    if (isChicken) {
      window.audioSys.playChickenCluck();
      window.audioSys.speakCategory('chicken');
      this.showEventBanner('🐔', 'خلي بالك من الفرخة يا معلم!', 'فراخ عم محروس الفرارجي فلتت وبتعدي الحارة!');
    } else {
      window.audioSys.speakCategory('watermelon');
      this.showEventBanner('🍉', 'عربية البطيخ اتقلبت في الحارة!', 'حاسب لتزحلق على البطيخ يا أسطى!');
    }
  }

  updateEvents(dt, player, freeze) {
    if (!freeze) {
      this.eventCooldown -= dt;
      if (this.eventCooldown <= 0 && player.speed > 10) {
        this.eventCooldown = 30 + Math.random() * 20;
        this.triggerCityEvent(player);
      }
    }
    for (let i = this.events.length - 1; i >= 0; i--) {
      const ev = this.events[i];
      ev.ttl -= dt;
      ev.phase += dt * 3.0;
      const off = Math.sin(ev.phase) * 6;
      ev.mesh.position.set(
        ev.base.x + (ev.axis === 'x' ? off : 0),
        Math.abs(Math.sin(ev.phase * 4)) * 0.3,
        ev.base.z + (ev.axis === 'z' ? off : 0)
      );
      const dx = player.position.x - ev.mesh.position.x;
      const dz = player.position.z - ev.mesh.position.z;
      if (dx * dx + dz * dz < 8 && player.yOffset < 1.0) {
        player.verticalVel = 7.5;
        window.audioSys.playChickenCluck();
      }
      if (ev.ttl <= 0) {
        this.group.remove(ev.mesh);
        this.events.splice(i, 1);
      }
    }
  }

  // ================================================================ MASTER UPDATE
  updateLife(dt, elapsed, player, cb, opts = {}) {
    if (this.crashCooldown > 0) this.crashCooldown -= dt;
    this.updateCars(dt, player, cb);
    this.updatePeds(dt, player, cb);
    this.updatePickups(dt, player, cb);
    this.updateEvents(dt, player, !!opts.noEvents);
  }

  // ================================================================ MARKERS
  createPassengerMarker(colorHex) {
    if (window.EgyptianPeople && window.EgyptianPeople.createPassenger) {
      const archIdx = Math.floor(Math.random() * window.EgyptianPeople.ARCHETYPES.length);
      const marker = window.EgyptianPeople.createPassenger(colorHex, archIdx);
      // Fallback arm for legacy rotation code in game.js
      if (!marker.userData.arm) marker.userData.arm = { rotation: { z: 0 } };
      return marker;
    }

    const g = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 30, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 15;
    const ringGeo = new THREE.RingGeometry(2.0, 2.7, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide }));
    ring.position.y = 0.45;

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.1, 8), new THREE.MeshLambertMaterial({ color: 0xfff3b0 }));
    body.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshLambertMaterial({ color: 0xd49a6a }));
    head.position.y = 1.78;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 0.14), new THREE.MeshLambertMaterial({ color: 0xfff3b0 }));
    arm.position.set(0.45, 2.0, 0);
    g.add(beam, ring, body, head, arm);
    g.userData.arm = arm;
    g.userData.ring = ring;
    return g;
  }

  createDestinationMarker() {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.4, 40, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffbe0b, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 20;
    const ringGeo = new THREE.RingGeometry(4.2, 5.2, 28);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffbe0b, side: THREE.DoubleSide }));
    ring.position.y = 0.5;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.3, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    gem.position.y = 4.5;
    g.add(beam, ring, gem);
    g.userData.gem = gem;
    return g;
  }
}

window.CityLife = CityLife;
