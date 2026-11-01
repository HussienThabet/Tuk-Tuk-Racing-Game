// game.js - Open-world Cairo taxi game (Crazy Taxi style): free roam, passengers, fares, tips.

class TukTukBashaGame {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 700);
    this.cameraMode = 0; // 0: chase, 1: low action, 2: high panorama

    // Persistent profile
    this.profile = {
      coins: 500,
      color: '#e6192e',
      neon: '#00f5d4',
      slogan: 'عيون الحسود فيها عود 🧿',
      upgrades: { speed: 1, nitro: 1, handling: 1 },
      stats: { fares: 0, best: 0, earned: 0 }
    };
    this.loadProfile();

    // World + living city
    this.world = new CairoCity(this.scene);
    this.life = new CityLife(this.scene, this.world);

    // Player
    this.player = new TukTukVehicle(this.scene, {
      isPlayer: true,
      name: 'الأسطى باشا',
      color: this.profile.color,
      neonColor: this.profile.neon,
      slogan: this.profile.slogan
    });
    this.applyUpgradesToPlayer(this.player);
    this.spawnPlayer();

    // GPS arrow floating above the tuk-tuk
    this.arrow = this.createGpsArrow();

    // State
    this.state = 'MENU'; // MENU | GARAGE | PLAYING
    this.mode = 'taxi';  // taxi | freeroam
    this.fare = this.newFareState();
    this.airTime = 0;
    this.driftAcc = 0;
    this.crashCooldown = 0;
    this.visTimer = 0;
    this.hudCache = {};

    // Input
    this.keys = {};
    this.touchInput = { left: false, right: false, gas: false, brake: false, drift: false, nitro: false, steerAnalog: 0 };

    // Minimap
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas.getContext('2d');

    this.clock = new THREE.Clock();
    this.elapsed = 0;

    this.bindEvents();
    this.updateMenuUI();
    this.animate();
  }

  // ------------------------------------------------------------------ profile
  loadProfile() {
    try {
      const saved = localStorage.getItem('tuktuk_basha_profile_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(this.profile, parsed);
        if (!this.profile.stats) this.profile.stats = { fares: 0, best: 0, earned: 0 };
      }
    } catch (e) {}
  }

  saveProfile() {
    try {
      localStorage.setItem('tuktuk_basha_profile_v1', JSON.stringify(this.profile));
    } catch (e) {}
  }

  applyUpgradesToPlayer(v) {
    v.maxSpeed = 43 + (this.profile.upgrades.speed - 1) * 4.5;
    v.accel = 28 + (this.profile.upgrades.speed - 1) * 3.0;
    v.nitroPower = 1.45 + (this.profile.upgrades.nitro - 1) * 0.12;
    v.handling = 2.55 + (this.profile.upgrades.handling - 1) * 0.25;
    v.applyCustomization(this.profile.color, this.profile.neon, this.profile.slogan);
  }

  spawnPlayer() {
    this.player.resetAt(4 * this.world.C, 4 * this.world.C, 0);
  }

  // --------------------------------------------------------------------- events
  bindEvents() {
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (this.state !== 'PLAYING') return;
      if (e.code === 'KeyH') {
        window.audioSys.playHorn();
      } else if (e.code === 'KeyC') {
        this.cameraMode = (this.cameraMode + 1) % 3;
      } else if (e.code === 'KeyM') {
        const on = window.audioSys.toggleMusic();
        document.getElementById('hud-music-btn').classList.toggle('active', on);
      } else if (e.code === 'KeyR') {
        this.respawnPlayer();
      } else if (e.code === 'Escape') {
        this.returnToMenu();
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    // Mode buttons
    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.startMode(btn.getAttribute('data-mode')));
    });

    // Environment buttons
    document.querySelectorAll('.env-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.env-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.world.setEnvironment(btn.getAttribute('data-env'));
      });
    });

    // Garage
    document.getElementById('open-garage-btn').addEventListener('click', () => {
      this.state = 'GARAGE';
      document.getElementById('main-menu').classList.add('hidden');
      document.getElementById('garage-screen').classList.remove('hidden');
      this.updateGarageUI();
    });
    document.getElementById('close-garage-btn').addEventListener('click', () => {
      this.state = 'MENU';
      document.getElementById('garage-screen').classList.add('hidden');
      document.getElementById('main-menu').classList.remove('hidden');
      this.updateMenuUI();
    });

    document.querySelectorAll('#color-swatches .swatch').forEach((sw) => {
      sw.addEventListener('click', () => {
        document.querySelectorAll('#color-swatches .swatch').forEach((s) => s.classList.remove('active'));
        sw.classList.add('active');
        this.profile.color = sw.getAttribute('data-color');
        this.applyUpgradesToPlayer(this.player);
        this.saveProfile();
      });
    });
    document.querySelectorAll('#neon-swatches .neon-btn').forEach((nb) => {
      nb.addEventListener('click', () => {
        document.querySelectorAll('#neon-swatches .neon-btn').forEach((n) => n.classList.remove('active'));
        nb.classList.add('active');
        this.profile.neon = nb.getAttribute('data-neon');
        this.applyUpgradesToPlayer(this.player);
        this.saveProfile();
      });
    });
    document.getElementById('slogan-select').addEventListener('change', (e) => {
      this.profile.slogan = e.target.value;
      this.applyUpgradesToPlayer(this.player);
      this.saveProfile();
    });
    document.querySelectorAll('.buy-upgrade-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-upgrade');
        if (this.profile.upgrades[type] < 5 && this.profile.coins >= 150) {
          this.profile.coins -= 150;
          this.profile.upgrades[type]++;
          this.applyUpgradesToPlayer(this.player);
          this.saveProfile();
          this.updateGarageUI();
          window.audioSys.playCoin();
        }
      });
    });

    // HUD buttons
    const mobileControlsEl = document.getElementById('mobile-controls');
    const touchToggleBtn = document.getElementById('hud-touch-btn');
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.innerWidth <= 950;
    if (isTouchDevice && mobileControlsEl) {
      mobileControlsEl.classList.add('force-show');
      if (touchToggleBtn) touchToggleBtn.classList.add('active');
    }
    if (touchToggleBtn && mobileControlsEl) {
      touchToggleBtn.addEventListener('click', () => {
        const shown = mobileControlsEl.classList.toggle('force-show');
        touchToggleBtn.classList.toggle('active', shown);
      });
    }
    document.getElementById('hud-horn-btn').addEventListener('click', () => window.audioSys.playHorn());
    document.getElementById('hud-cam-btn').addEventListener('click', () => { this.cameraMode = (this.cameraMode + 1) % 3; });
    document.getElementById('hud-music-btn').addEventListener('click', () => {
      const on = window.audioSys.toggleMusic();
      document.getElementById('hud-music-btn').classList.toggle('active', on);
    });
    document.getElementById('hud-pause-btn').addEventListener('click', () => this.returnToMenu());

    this.bindTouchControls();
  }

  bindTouchControls() {
    // PlayStation-style analog stick
    const analogZone = document.getElementById('ps-analog-zone');
    const analogKnob = document.getElementById('ps-analog-knob');
    if (analogZone && analogKnob) {
      let activeTouchId = null;
      let isPointerDown = false;
      const maxRadius = 44;

      const updateStick = (clientX, clientY) => {
        const rect = analogZone.getBoundingClientRect();
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.5;
        let dx = clientX - cx, dy = clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > maxRadius) { dx = (dx / dist) * maxRadius; dy = (dy / dist) * maxRadius; }
        analogKnob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
        const nx = dx / maxRadius, ny = dy / maxRadius;
        this.touchInput.steerAnalog = Math.abs(nx) > 0.06 ? nx : 0;
        this.touchInput.left = nx < -0.18;
        this.touchInput.right = nx > 0.18;
        this.touchInput.analogGas = ny < -0.35;
        this.touchInput.analogBrake = ny > 0.45;
      };
      const resetStick = () => {
        activeTouchId = null;
        isPointerDown = false;
        analogZone.classList.remove('active');
        analogKnob.style.transform = 'translate(0px, 0px)';
        this.touchInput.steerAnalog = 0;
        this.touchInput.left = false;
        this.touchInput.right = false;
        this.touchInput.analogGas = false;
        this.touchInput.analogBrake = false;
      };

      analogZone.addEventListener('touchstart', (e) => {
        if (e.cancelable) e.preventDefault();
        const t = e.changedTouches[0];
        activeTouchId = t.identifier;
        analogZone.classList.add('active');
        updateStick(t.clientX, t.clientY);
      }, { passive: false });
      analogZone.addEventListener('touchmove', (e) => {
        if (activeTouchId === null) return;
        if (e.cancelable) e.preventDefault();
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === activeTouchId) { updateStick(e.touches[i].clientX, e.touches[i].clientY); break; }
        }
      }, { passive: false });
      const endTouch = (e) => {
        if (activeTouchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === activeTouchId) { resetStick(); break; }
        }
      };
      analogZone.addEventListener('touchend', endTouch, { passive: false });
      analogZone.addEventListener('touchcancel', endTouch, { passive: false });

      analogZone.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        isPointerDown = true;
        analogZone.setPointerCapture(e.pointerId);
        analogZone.classList.add('active');
        updateStick(e.clientX, e.clientY);
      });
      analogZone.addEventListener('pointermove', (e) => {
        if (!isPointerDown || e.pointerType === 'touch') return;
        updateStick(e.clientX, e.clientY);
      });
      analogZone.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') resetStick(); });
      analogZone.addEventListener('pointercancel', resetStick);
    }

    const bindTouch = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      const press = (e) => {
        if (e && e.cancelable) e.preventDefault();
        this.touchInput[key] = true;
        el.classList.add('pressed');
      };
      const release = (e) => {
        if (e && e.cancelable) e.preventDefault();
        this.touchInput[key] = false;
        el.classList.remove('pressed');
      };
      el.addEventListener('touchstart', press, { passive: false });
      el.addEventListener('touchend', release, { passive: false });
      el.addEventListener('touchcancel', release, { passive: false });
      el.addEventListener('pointerdown', press);
      el.addEventListener('pointerup', release);
      el.addEventListener('pointerleave', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    bindTouch('touch-gas', 'gas');
    bindTouch('touch-brake', 'brake');
    bindTouch('touch-drift', 'drift');
    bindTouch('touch-nitro', 'nitro');

    const hornBtn = document.getElementById('touch-horn');
    if (hornBtn) {
      const horn = (e) => {
        if (e && e.cancelable) e.preventDefault();
        window.audioSys.playHorn();
      };
      hornBtn.addEventListener('touchstart', horn, { passive: false });
      hornBtn.addEventListener('pointerdown', horn);
    }
  }

  // ------------------------------------------------------------------------ UI
  updateMenuUI() {
    document.getElementById('menu-coin-count').textContent = this.profile.coins;
    const badge = document.getElementById('career-stage-badge');
    if (badge) badge.textContent = `${this.profile.stats.fares} توصيلة`;
    document.getElementById('selected-tuktuk-label').innerHTML =
      `التوكتوك الحالي: <strong>"${this.profile.slogan}"</strong>`;
  }

  updateGarageUI() {
    document.getElementById('garage-coins').textContent = this.profile.coins;
    document.getElementById('bar-speed').style.width = `${this.profile.upgrades.speed * 20}%`;
    document.getElementById('bar-nitro').style.width = `${this.profile.upgrades.nitro * 20}%`;
    document.getElementById('bar-handling').style.width = `${this.profile.upgrades.handling * 20}%`;
  }

  setText(id, value) {
    if (this.hudCache[id] === value) return;
    this.hudCache[id] = value;
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  popup(text, color = '#ffbe0b') {
    const stack = document.getElementById('popup-stack');
    if (!stack) return;
    const d = document.createElement('div');
    d.className = 'popup-item';
    d.textContent = text;
    d.style.color = color;
    stack.appendChild(d);
    while (stack.children.length > 5) stack.removeChild(stack.firstChild);
    setTimeout(() => d.remove(), 1700);
  }

  // ------------------------------------------------------------------- modes
  startMode(mode) {
    this.mode = mode;
    window.audioSys.init();
    window.audioSys.startShaabiMusic();
    window.audioSys.startEngine();

    this.applyUpgradesToPlayer(this.player);
    this.spawnPlayer();
    this.clearFare();
    this.airTime = 0;
    this.driftAcc = 0;
    this.shiftEarned = 0;

    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('results-screen').classList.add('hidden');
    document.getElementById('game-hud').classList.remove('hidden');
    document.getElementById('hud-slogan').textContent = this.profile.slogan;

    this.state = 'PLAYING';
    this.world.updateVisibility(this.player.position.x, this.player.position.z, true);

    if (mode === 'taxi') {
      this.fare.idleTimer = 0.4;
      this.life.showEventBanner('🛺', 'ابدأ وردية التاكسي!', 'اقف جنب راكب (علامة ملونة) وبعدين وصّله قبل ما الوقت يخلص');
    } else {
      this.life.showEventBanner('🌆', 'القاهرة كلها بتاعتك', 'لف براحتك، لمّ الجنيهات وجرّب القفزات والاختصارات');
    }
    window.audioSys.speakCategory('start');
  }

  returnToMenu() {
    this.clearFare();
    this.saveProfile();
    this.state = 'MENU';
    window.audioSys.stopEngine();
    document.getElementById('game-hud').classList.add('hidden');
    document.getElementById('results-screen').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    this.updateMenuUI();
  }

  respawnPlayer() {
    const p = this.player;
    const n = this.world.nearestIntersection(p.position.x, p.position.z);
    p.resetAt(n.x, n.z, p.heading);
    this.popup('↩️ رجّعناك للشارع', '#00f5d4');
  }

  // ------------------------------------------------------------------- fares
  newFareState() {
    return {
      state: 'IDLE',      // IDLE | WAITING | ONBOARD
      waiting: [],        // waiting passengers { x,z,dest,fare,limit,marker,color,name }
      active: null,
      destMarker: null,
      timeLeft: 0,
      tip: 0,
      idleTimer: 0
    };
  }

  clearFare() {
    const f = this.fare;
    if (f && f.waiting) f.waiting.forEach((p) => this.life.group.remove(p.marker));
    if (f && f.destMarker) this.life.group.remove(f.destMarker);
    this.fare = this.newFareState();
  }

  dist2D(ax, az, bx, bz) {
    return Math.hypot(ax - bx, az - bz);
  }

  spawnPassengers() {
    const f = this.fare;
    const px = this.player.position.x, pz = this.player.position.z;
    const names = ['أم محمود', 'الأستاذ هشام', 'حودة الطالب', 'الحاجة سعاد', 'المهندس كريم', 'منى المدرّسة', 'عم فتحي'];

    for (let n = 0; n < 3; n++) {
      let pick = null;
      for (let tries = 0; tries < 40; tries++) {
        const c = this.world.randomCurbPoint();
        const d = this.dist2D(c.x, c.z, px, pz);
        if (d > 50 && d < 380) { pick = c; break; }
      }
      if (!pick) pick = this.world.randomCurbPoint();

      let dest = null;
      for (let tries = 0; tries < 60; tries++) {
        const c = this.world.randomCurbPoint();
        const d = this.dist2D(c.x, c.z, pick.x, pick.z);
        // short / medium / long trips by slot so the player always has a choice
        const want = [[90, 190], [190, 330], [330, 620]][n];
        if (d >= want[0] && d <= want[1]) { dest = c; break; }
      }
      if (!dest) dest = this.world.randomCurbPoint();

      const manhattan = Math.abs(dest.x - pick.x) + Math.abs(dest.z - pick.z);
      const straight = this.dist2D(dest.x, dest.z, pick.x, pick.z);
      const color = straight < 190 ? 0x38e07b : straight < 330 ? 0xffd23f : 0xff4d6d;
      const marker = this.life.createPassengerMarker(color);
      marker.position.set(pick.x, 0.3, pick.z);
      this.life.group.add(marker);

      f.waiting.push({
        x: pick.x, z: pick.z, dest,
        fare: Math.round(15 + manhattan * 0.25),
        limit: 9 + manhattan / 18,
        marker, color,
        name: names[Math.floor(Math.random() * names.length)]
      });
    }
    f.state = 'WAITING';
  }

  startRide(pax) {
    const f = this.fare;
    f.waiting.forEach((p) => this.life.group.remove(p.marker));
    f.waiting = [];
    f.active = pax;
    f.state = 'ONBOARD';
    f.timeLeft = pax.limit;
    f.tip = 0;

    f.destMarker = this.life.createDestinationMarker();
    f.destMarker.position.set(pax.dest.x, 0.3, pax.dest.z);
    this.life.group.add(f.destMarker);

    window.audioSys.playCoin();
    window.audioSys.speakCategory('pickup');
    this.life.showEventBanner('🧑🏽', `ركب معاك ${pax.name}`, `الأجرة ${pax.fare} ج.م • الوقت ${Math.round(pax.limit)} ثانية • اتبع السهم الذهبي`);
  }

  completeRide() {
    const f = this.fare;
    const pax = f.active;
    const timeBonus = Math.round(Math.max(0, f.timeLeft) * 1.2);
    const tip = Math.round(f.tip);
    const total = pax.fare + timeBonus + tip;

    this.profile.coins += total;
    this.profile.stats.fares++;
    this.profile.stats.earned += total;
    this.profile.stats.best = Math.max(this.profile.stats.best, total);
    this.shiftEarned = (this.shiftEarned || 0) + total;
    this.saveProfile();

    window.audioSys.playCoin();
    window.audioSys.speakCategory('dropoff');
    this.life.showEventBanner('💰', `+${total} ج.م`, `أجرة ${pax.fare} + وقت ${timeBonus} + إكرامية ${tip}`);

    this.life.group.remove(f.destMarker);
    this.fare = this.newFareState();
    this.fare.idleTimer = 1.6;
  }

  failRide() {
    const f = this.fare;
    window.audioSys.speakCategory('timeout');
    this.life.showEventBanner('😡', 'الراكب نزل غضبان!', 'الوقت خلص قبل ما توصّله');
    this.life.group.remove(f.destMarker);
    this.fare = this.newFareState();
    this.fare.idleTimer = 2.0;
  }

  addTip(amount, label) {
    this.fare.tip = Math.max(0, this.fare.tip + amount);
    this.popup(label, amount >= 0 ? '#ffbe0b' : '#ff4d6d');
  }

  updateMission(dt) {
    if (this.mode !== 'taxi') return;
    const f = this.fare;
    const p = this.player;
    const spd = Math.abs(p.speed);

    // Tip bonuses while a passenger is aboard
    if (f.state === 'ONBOARD') {
      if (p.yOffset > 0.4) this.airTime += dt;
      else {
        if (this.airTime > 0.55) this.addTip(12, '🚀 طيران! +12');
        this.airTime = 0;
      }
      if (p.isDrifting) {
        this.driftAcc += dt;
        if (this.driftAcc >= 0.6) { this.driftAcc = 0; this.addTip(3, '💨 تخميس! +3'); }
      } else this.driftAcc = 0;
    }

    if (f.state === 'IDLE') {
      f.idleTimer -= dt;
      if (f.idleTimer <= 0) this.spawnPassengers();
    } else if (f.state === 'WAITING') {
      f.waiting.forEach((pax, idx) => {
        const m = pax.marker;
        if (m.userData.update) {
          m.userData.update(this.elapsed + idx);
        } else if (m.userData.arm) {
          m.userData.arm.rotation.z = Math.sin(this.elapsed * 7 + idx) * 0.8 - 0.4;
        }
        if (m.userData.ring) {
          m.userData.ring.scale.setScalar(1 + Math.sin(this.elapsed * 4 + idx) * 0.08);
        }
        const d = this.dist2D(p.position.x, p.position.z, pax.x, pax.z);
        if (d < 6.5 && spd < 20) this.startRide(pax);
        else if (d < 22 && spd >= 20 && !pax.hinted) {
          pax.hinted = true;
          this.popup('🛑 هدّي السرعة عشان الراكب يركب', '#00f5d4');
        }
      });
    } else if (f.state === 'ONBOARD') {
      f.timeLeft -= dt;
      f.destMarker.userData.gem.rotation.y += dt * 2.4;
      const d = this.dist2D(p.position.x, p.position.z, f.active.dest.x, f.active.dest.z);
      if (d < 7.5 && spd < 22) this.completeRide();
      else if (f.timeLeft <= 0) this.failRide();
    }
  }

  // ------------------------------------------------------------------- input
  getInput() {
    const k = this.keys, t = this.touchInput;
    return {
      gas: !!(k['KeyW'] || k['ArrowUp'] || t.gas || t.analogGas),
      brake: !!(k['KeyS'] || k['ArrowDown'] || t.brake || t.analogBrake),
      left: !!(k['KeyA'] || k['ArrowLeft'] || t.left),
      right: !!(k['KeyD'] || k['ArrowRight'] || t.right),
      steerAnalog: t.steerAnalog || 0,
      drift: !!(k['Space'] || t.drift),
      nitro: !!(k['ShiftLeft'] || k['ShiftRight'] || t.nitro)
    };
  }

  // --------------------------------------------------------------------- GPS
  createGpsArrow() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffbe0b });
    const coneGeo = new THREE.ConeGeometry(0.75, 1.9, 4);
    coneGeo.rotateX(Math.PI / 2);
    const cone = new THREE.Mesh(coneGeo, mat);
    cone.position.z = 0.9;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 1.3), mat);
    tail.position.z = -0.5;
    g.add(cone, tail);
    g.visible = false;
    this.scene.add(g);
    return g;
  }

  currentTarget() {
    const f = this.fare;
    if (this.mode !== 'taxi') return null;
    if (f.state === 'ONBOARD') return { x: f.active.dest.x, z: f.active.dest.z, color: 0xffbe0b, kind: 'dest' };
    if (f.state === 'WAITING' && f.waiting.length) {
      const p = this.player.position;
      let best = f.waiting[0], bd = Infinity;
      f.waiting.forEach((w) => {
        const d = this.dist2D(p.x, p.z, w.x, w.z);
        if (d < bd) { bd = d; best = w; }
      });
      return { x: best.x, z: best.z, color: best.color, kind: 'pax' };
    }
    return null;
  }

  updateArrow() {
    const t = this.currentTarget();
    if (!t || this.state !== 'PLAYING') { this.arrow.visible = false; return; }
    const p = this.player;
    this.arrow.visible = true;
    this.arrow.children.forEach((c) => c.material.color.setHex(t.color));
    this.arrow.position.set(p.position.x, p.yOffset + 5.4 + Math.sin(this.elapsed * 4) * 0.2, p.position.z);
    this.arrow.rotation.y = Math.atan2(t.x - p.position.x, t.z - p.position.z);
  }

  // --------------------------------------------------------------------- HUD
  updateHUD() {
    const p = this.player;
    const f = this.fare;
    this.setText('hud-speed', String(Math.round(Math.abs(p.speed) * 2.6)));
    document.getElementById('hud-nitro-bar').style.width = `${p.nitro}%`;
    document.getElementById('hud-fuel-bar').style.width = `${p.fuel}%`;
    this.setText('hud-coins', `${this.profile.coins} ج.م`);
    document.getElementById('drift-Chain-badge').classList.toggle('hidden', !p.isDrifting);

    const rankLabel = document.querySelector('#hud-rank-box .stat-label');
    const card = document.getElementById('fare-card');

    if (this.mode === 'taxi') {
      const target = this.currentTarget();
      const dist = target ? Math.round(this.dist2D(p.position.x, p.position.z, target.x, target.z)) : 0;
      if (rankLabel) rankLabel.textContent = 'الحالة';
      this.setText('hud-position', f.state === 'ONBOARD' ? 'راكب معاك 🧑🏽' : f.state === 'WAITING' ? 'دوّر على راكب' : 'استنى شوية...');
      this.setText('hud-lap-label', 'المسافة');
      this.setText('hud-lap', target ? `${dist} م` : '--');
      this.setText('hud-timer-label', 'وقت التوصيلة');
      if (f.state === 'ONBOARD') {
        const t = Math.max(0, f.timeLeft);
        this.setText('hud-timer', `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`);
      } else this.setText('hud-timer', '--:--');

      if (card) {
        if (f.state === 'ONBOARD') {
          card.classList.remove('hidden');
          this.setText('fare-name', `🧑🏽 ${f.active.name}`);
          this.setText('fare-money', `الأجرة ${f.active.fare} ج.م`);
          this.setText('fare-tip', `إكرامية +${Math.round(f.tip)}`);
        } else if (f.state === 'WAITING') {
          card.classList.remove('hidden');
          this.setText('fare-name', '🟢 قصير • 🟡 متوسط • 🔴 طويل');
          this.setText('fare-money', `${f.waiting.length} راكب مستني`);
          this.setText('fare-tip', 'اقف جنب العلامة');
        } else card.classList.add('hidden');
      }
    } else {
      if (rankLabel) rankLabel.textContent = 'الوضع';
      this.setText('hud-position', 'تمشية حرة 🌆');
      this.setText('hud-lap-label', 'الجنيهات');
      this.setText('hud-lap', `${this.profile.coins}`);
      this.setText('hud-timer-label', 'الوقت');
      this.setText('hud-timer', `${String(Math.floor(this.elapsed / 60) % 100).padStart(2, '0')}:${String(Math.floor(this.elapsed % 60)).padStart(2, '0')}`);
      if (card) card.classList.add('hidden');
    }
  }

  drawMinimap() {
    const ctx = this.minimapCtx;
    const W = this.minimapCanvas.width, H = this.minimapCanvas.height;
    const w = this.world;
    const p = this.player;
    const s = 0.52; // px per world unit
    const cx = W / 2, cy = H * 0.58;
    const h = p.heading;
    const cosH = Math.cos(h), sinH = Math.sin(h);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#141122';
    ctx.fillRect(0, 0, W, H);

    // world -> screen (forward is up)
    const a = -s * cosH, c = s * sinH, b = -s * sinH, d = -s * cosH;
    const e = cx - a * p.position.x - c * p.position.z;
    const f = cy - b * p.position.x - d * p.position.z;
    ctx.setTransform(a, b, c, d, e, f);

    // Nile
    ctx.fillStyle = '#1f77b4';
    ctx.fillRect(-300, w.size + w.R / 2 + 2, w.size + 600, 700);

    // plazas
    w.plazas.forEach((pl) => {
      ctx.fillStyle = pl.type === 'park' ? '#2f7d3a' : '#8c7a5b';
      ctx.fillRect(pl.x - w.B / 2, pl.z - w.B / 2, w.B, w.B);
    });

    // roads
    ctx.strokeStyle = '#6d6a7d';
    ctx.lineWidth = w.R;
    ctx.beginPath();
    for (let k = 0; k <= w.N; k++) {
      ctx.moveTo(0, k * w.C); ctx.lineTo(w.size, k * w.C);
      ctx.moveTo(k * w.C, 0); ctx.lineTo(k * w.C, w.size);
    }
    ctx.stroke();

    // markers in world space (screen-clamped below)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const toScreen = (x, z) => {
      const dx = x - p.position.x, dz = z - p.position.z;
      return { x: cx + a * dx + c * dz, y: cy + b * dx + d * dz };
    };
    const drawMarker = (x, z, color, r) => {
      let pt = toScreen(x, z);
      let vx = pt.x - W / 2, vy = pt.y - H / 2;
      const lim = W / 2 - 9;
      const len = Math.hypot(vx, vy);
      if (len > lim) { vx = (vx / len) * lim; vy = (vy / len) * lim; }
      ctx.fillStyle = color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(W / 2 + vx, H / 2 + vy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };

    if (this.mode === 'taxi') {
      const fs = this.fare;
      fs.waiting.forEach((wp) => drawMarker(wp.x, wp.z, '#' + wp.color.toString(16).padStart(6, '0'), 6));
      if (fs.state === 'ONBOARD') drawMarker(fs.active.dest.x, fs.active.dest.z, '#ffbe0b', 8);
    }

    // player arrow (always centre, pointing up)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 9);
    ctx.lineTo(cx + 6, cy + 7);
    ctx.lineTo(cx, cy + 3);
    ctx.lineTo(cx - 6, cy + 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ camera
  updateFollowCamera(dt) {
    const v = this.player;
    const presets = [
      { dist: 7.6, height: 3.4, lookAhead: 5.2 },
      { dist: 5.8, height: 2.6, lookAhead: 6.5 },
      { dist: 13.5, height: 7.0, lookAhead: 4.0 }
    ];
    const pr = presets[this.cameraMode];
    const extra = v.isNitro ? 1.8 : 0;
    const dist = pr.dist + extra;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const baseY = v.position.y + v.yOffset;

    // pull the camera forward if a building would block the view
    let t = 1;
    for (; t > 0.28; t -= 0.12) {
      const x = v.position.x - fx * dist * t;
      const z = v.position.z - fz * dist * t;
      if (!this.world.pointBlocked(x, z, 0.9)) break;
    }
    const tx = v.position.x - fx * dist * t;
    const tz = v.position.z - fz * dist * t;
    const ty = baseY + pr.height * (0.75 + 0.25 * t);

    this.camera.position.lerp(new THREE.Vector3(tx, ty, tz), Math.min(1, dt * 8.5));
    this.camera.lookAt(
      v.position.x + fx * pr.lookAhead,
      baseY + 1.35,
      v.position.z + fz * pr.lookAhead
    );

    const targetFov = v.isNitro ? 74 : 60;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 6);
    this.camera.updateProjectionMatrix();
  }

  // --------------------------------------------------------------------- loop
  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;

    this.world.update(dt, this.elapsed);

    this.visTimer -= dt;
    if (this.visTimer <= 0) {
      this.visTimer = 0.25;
      this.world.updateVisibility(this.player.position.x, this.player.position.z);
    }

    if (this.state === 'MENU' || this.state === 'GARAGE') {
      // keep the city alive behind the menu
      const pl = this.player;
      this.life.updateLife(dt, this.elapsed, { position: new THREE.Vector3(-999, 0, -999), speed: 0, yOffset: 0, heading: 0, nitro: 0, fuel: 0, verticalVel: 0 }, null, { noEvents: true });

      const isGarage = this.state === 'GARAGE';
      const radius = isGarage ? 4.8 : 7.2;
      const height = isGarage ? 2.15 : 3.3;
      const angle = this.elapsed * 0.6;
      this.camera.position.set(pl.position.x + Math.sin(angle) * radius, height, pl.position.z + Math.cos(angle) * radius);
      const rightOffset = isGarage ? 1.15 : 0;
      this.camera.lookAt(
        pl.position.x + Math.cos(angle) * rightOffset,
        1.2,
        pl.position.z - Math.sin(angle) * rightOffset
      );
      this.camera.fov = 60;
      this.camera.updateProjectionMatrix();
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // ---- PLAYING ----
    const p = this.player;
    p.updatePhysics(dt, this.getInput(), this.world);

    this.life.updateLife(dt, this.elapsed, p, {
      onCrash: (impact) => {
        window.audioSys.playCrash();
        if (this.fare.state === 'ONBOARD') this.addTip(-8, '💥 خبطة! -8');
        if (Math.random() < 0.4) window.audioSys.speakCategory('crash');
      },
      onNearMiss: () => {
        if (this.fare.state === 'ONBOARD') this.addTip(6, '😮 قريبة! +6');
        else this.popup('😮 قريبة!', '#00f5d4');
        if (Math.random() < 0.25) window.audioSys.speakCategory('nearmiss');
      },
      onPedHit: () => {
        window.audioSys.playCrash();
        if (this.fare.state === 'ONBOARD') this.addTip(-5, '🚶 أوبس! -5');
        else this.popup('🚶 أوبس!', '#ff4d6d');
        window.audioSys.speakCategory('pedestrian');
      },
      onPickup: (type) => {
        window.audioSys.playCoin();
        if (type === 'coin') {
          this.profile.coins += 5;
          this.popup('+5 ج.م', '#ffbe0b');
        } else if (type === 'nitro') this.popup('🚀 نيترو متشحن!', '#00f5d4');
        else this.popup('⛽ بنزين!', '#38e07b');
      }
    });

    // building impacts
    if (this.crashCooldown > 0) this.crashCooldown -= dt;
    if (p.crashImpact > 9 && this.crashCooldown <= 0) {
      this.crashCooldown = 0.6;
      window.audioSys.playCrash();
      if (this.fare.state === 'ONBOARD') this.addTip(-8, '🧱 خبطة في حيطة! -8');
      if (Math.random() < 0.35) window.audioSys.speakCategory('crash');
    }

    this.updateMission(dt);
    window.audioSys.updateEngine(p.speed / p.maxSpeed, p.isDrifting, p.isNitro);

    this.updateArrow();
    this.updateHUD();
    this.drawMinimap();

    this.updateFollowCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new TukTukBashaGame();
});
