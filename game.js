// game.js - Main Game Loop, Modes, Camera System, Garage, Minimap & UI Controller

class TukTukBashaGame {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // Primary Camera & Secondary Camera (for Local 2-Player Split Screen)
    this.camera1 = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 900);
    this.camera2 = new THREE.PerspectiveCamera(62, (window.innerWidth * 0.5) / window.innerHeight, 0.5, 900);
    this.cameraMode = 0; // 0: Chase, 1: Close Action, 2: High Shaabi Cinematic

    // Persistent Player Profile
    this.profile = {
      coins: 500,
      careerStage: 1,
      color: '#e6192e',
      neon: '#00f5d4',
      slogan: 'عيون الحسود فيها عود 🧿',
      upgrades: { speed: 1, nitro: 1, handling: 1 }
    };
    this.loadProfile();

    // Build 3D Cairo World & Street Entities
    this.world = new CairoWorld(this.scene);
    this.entities = new StreetEntitiesManager(this.scene, this.world);

    // Vehicles
    this.player1 = null;
    this.player2 = null;
    this.rivals = [];
    this.allVehicles = [];

    this.spawnVehicles();

    // Game State
    this.state = 'MENU'; // MENU, GARAGE, COUNTDOWN, PLAYING, RESULTS
    this.mode = 'career';
    this.totalLaps = 3;
    this.timer = 0;
    this.deliveriesMade = 0;
    this.deliveriesGoal = 5;
    this.lastPlayerRank = 1;

    // Input State
    this.keys = {};
    this.touchInput = { left: false, right: false, gas: false, brake: false, drift: false, nitro: false };

    // Minimap
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas.getContext('2d');

    this.clock = new THREE.Clock();
    this.elapsed = 0;

    this.bindEvents();
    this.updateMenuUI();
    this.animate();
  }

  loadProfile() {
    try {
      const saved = localStorage.getItem('tuktuk_basha_profile_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(this.profile, parsed);
      }
    } catch (e) {}
  }

  saveProfile() {
    try {
      localStorage.setItem('tuktuk_basha_profile_v1', JSON.stringify(this.profile));
    } catch (e) {}
  }

  spawnVehicles() {
    this.player1 = new TukTukVehicle(this.scene, {
      isPlayer: true,
      playerIndex: 1,
      name: 'الأسطى باشا',
      color: this.profile.color,
      neonColor: this.profile.neon,
      slogan: this.profile.slogan
    });
    this.applyUpgradesToPlayer(this.player1);

    // Player 2 / Rival configs
    const rivalConfigs = [
      { name: 'المعلم زغلول', color: '#00b4d8', neonColor: '#ffbe0b', slogan: 'طير إنت يا معلم! 🚀', lane: -3.5, skill: 0.94 },
      { name: 'الأسطى حودة', color: '#ffbe0b', neonColor: '#ff006e', slogan: 'الحلوة من شبرا ❤️', lane: 3.5, skill: 0.91 },
      { name: 'المعلم شطة', color: '#8338ec', neonColor: '#00f5d4', slogan: 'ربنا يحميك يا ابني 🤲', lane: -5.5, skill: 0.89 },
      { name: 'كابتن بيبو', color: '#2ec4b6', neonColor: '#38b000', slogan: 'سكة السلامة ⚓', lane: 5.5, skill: 0.86 }
    ];

    this.rivals = rivalConfigs.map((rc, idx) => {
      return new TukTukVehicle(this.scene, {
        isPlayer: false,
        playerIndex: idx + 2,
        name: rc.name,
        color: rc.color,
        neonColor: rc.neonColor,
        slogan: rc.slogan,
        aiLaneOffset: rc.lane,
        aiSkill: rc.skill
      });
    });

    this.player2 = this.rivals[0];
    this.allVehicles = [this.player1, ...this.rivals];
    this.resetAllVehicles();
  }

  applyUpgradesToPlayer(v) {
    v.maxSpeed = 43 + (this.profile.upgrades.speed - 1) * 4.5;
    v.accel = 28 + (this.profile.upgrades.speed - 1) * 3.0;
    v.nitroPower = 1.45 + (this.profile.upgrades.nitro - 1) * 0.12;
    v.handling = 2.55 + (this.profile.upgrades.handling - 1) * 0.25;
    v.applyCustomization(this.profile.color, this.profile.neon, this.profile.slogan);
  }

  resetAllVehicles() {
    this.player1.resetAtTrackT(this.world, 0.992, 0);
    this.rivals.forEach((r, idx) => {
      const startT = 0.985 - idx * 0.006;
      const lane = (idx % 2 === 0 ? -1 : 1) * (3.2 + (idx >> 1) * 2.2);
      r.resetAtTrackT(this.world, startT, lane);
    });
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera1.aspect = window.innerWidth / window.innerHeight;
      this.camera1.updateProjectionMatrix();
      this.camera2.aspect = (window.innerWidth * 0.5) / window.innerHeight;
      this.camera2.updateProjectionMatrix();
    });

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyH' && this.state === 'PLAYING') {
        window.audioSys.playHorn();
        window.audioSys.speakCategory('start');
      } else if (e.code === 'KeyC' && this.state === 'PLAYING') {
        this.cameraMode = (this.cameraMode + 1) % 3;
      } else if (e.code === 'KeyM') {
        const on = window.audioSys.toggleMusic();
        document.getElementById('hud-music-btn').classList.toggle('active', on);
      } else if (e.code === 'Escape' && this.state === 'PLAYING') {
        this.returnToMenu();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Mode Selection Buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        this.startMode(mode);
      });
    });

    // Environment Buttons
    document.querySelectorAll('.env-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.env-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.world.setEnvironment(btn.getAttribute('data-env'));
      });
    });

    // Garage Buttons
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

    // Color swatches
    document.querySelectorAll('#color-swatches .swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        document.querySelectorAll('#color-swatches .swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        this.profile.color = sw.getAttribute('data-color');
        this.applyUpgradesToPlayer(this.player1);
        this.saveProfile();
      });
    });

    // Neon swatches
    document.querySelectorAll('#neon-swatches .neon-btn').forEach(nb => {
      nb.addEventListener('click', () => {
        document.querySelectorAll('#neon-swatches .neon-btn').forEach(n => n.classList.remove('active'));
        nb.classList.add('active');
        this.profile.neon = nb.getAttribute('data-neon');
        this.applyUpgradesToPlayer(this.player1);
        this.saveProfile();
      });
    });

    // Slogan select
    document.getElementById('slogan-select').addEventListener('change', (e) => {
      this.profile.slogan = e.target.value;
      this.applyUpgradesToPlayer(this.player1);
      this.saveProfile();
    });

    // Upgrades
    document.querySelectorAll('.buy-upgrade-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-upgrade');
        if (this.profile.upgrades[type] < 5 && this.profile.coins >= 150) {
          this.profile.coins -= 150;
          this.profile.upgrades[type]++;
          this.applyUpgradesToPlayer(this.player1);
          this.saveProfile();
          this.updateGarageUI();
          window.audioSys.playCoin();
        }
      });
    });

    // HUD Action Buttons
    const mobileControlsEl = document.getElementById('mobile-controls');
    const touchToggleBtn = document.getElementById('hud-touch-btn');
    if (mobileControlsEl) {
      mobileControlsEl.classList.add('force-show');
      if (touchToggleBtn) touchToggleBtn.classList.add('active');
    }

    if (touchToggleBtn && mobileControlsEl) {
      touchToggleBtn.addEventListener('click', () => {
        const shown = mobileControlsEl.classList.toggle('force-show');
        touchToggleBtn.classList.toggle('active', shown);
      });
    }

    document.getElementById('hud-horn-btn').addEventListener('click', () => {
      window.audioSys.playHorn();
      window.audioSys.speakCategory('start');
    });
    document.getElementById('hud-cam-btn').addEventListener('click', () => {
      this.cameraMode = (this.cameraMode + 1) % 3;
    });
    document.getElementById('hud-music-btn').addEventListener('click', () => {
      const on = window.audioSys.toggleMusic();
      document.getElementById('hud-music-btn').classList.toggle('active', on);
    });
    document.getElementById('hud-pause-btn').addEventListener('click', () => {
      this.returnToMenu();
    });

    // Multi-touch PlayStation Analog Stick (L3) & Diamond Face Buttons (△ ○ × □)
    const analogZone = document.getElementById('ps-analog-zone');
    const analogKnob = document.getElementById('ps-analog-knob');
    if (analogZone && analogKnob) {
      let activeTouchId = null;
      let isPointerDown = false;
      const maxRadius = 44;

      const updateStickFromPoint = (clientX, clientY) => {
        const rect = analogZone.getBoundingClientRect();
        const centerX = rect.left + rect.width * 0.5;
        const centerY = rect.top + rect.height * 0.5;
        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const dist = Math.hypot(dx, dy);
        if (dist > maxRadius) {
          dx = (dx / dist) * maxRadius;
          dy = (dy / dist) * maxRadius;
        }
        analogKnob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;

        const normX = dx / maxRadius; // -1 (left) to +1 (right)
        const normY = dy / maxRadius; // -1 (up/forward) to +1 (down/reverse)
        this.touchInput.steerAnalog = Math.abs(normX) > 0.06 ? normX : 0;
        this.touchInput.left = normX < -0.18;
        this.touchInput.right = normX > 0.18;
        this.touchInput.analogGas = normY < -0.35;
        this.touchInput.analogBrake = normY > 0.45;
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
        const touch = e.changedTouches[0];
        activeTouchId = touch.identifier;
        analogZone.classList.add('active');
        updateStickFromPoint(touch.clientX, touch.clientY);
      }, { passive: false });

      analogZone.addEventListener('touchmove', (e) => {
        if (activeTouchId === null) return;
        if (e.cancelable) e.preventDefault();
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === activeTouchId) {
            updateStickFromPoint(e.touches[i].clientX, e.touches[i].clientY);
            break;
          }
        }
      }, { passive: false });

      const endTouch = (e) => {
        if (activeTouchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === activeTouchId) {
            resetStick();
            break;
          }
        }
      };
      analogZone.addEventListener('touchend', endTouch, { passive: false });
      analogZone.addEventListener('touchcancel', endTouch, { passive: false });

      // Mouse / Pointer fallback for desktop testing
      analogZone.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        isPointerDown = true;
        analogZone.setPointerCapture(e.pointerId);
        analogZone.classList.add('active');
        updateStickFromPoint(e.clientX, e.clientY);
      });
      analogZone.addEventListener('pointermove', (e) => {
        if (!isPointerDown || e.pointerType === 'touch') return;
        updateStickFromPoint(e.clientX, e.clientY);
      });
      analogZone.addEventListener('pointerup', (e) => {
        if (e.pointerType === 'touch') return;
        resetStick();
      });
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

    const touchHornBtn = document.getElementById('touch-horn');
    if (touchHornBtn) {
      const triggerHorn = (e) => {
        if (e && e.cancelable) e.preventDefault();
        window.audioSys.playHorn();
        window.audioSys.speakCategory('start');
      };
      touchHornBtn.addEventListener('touchstart', triggerHorn, { passive: false });
      touchHornBtn.addEventListener('pointerdown', triggerHorn);
    }

    // Results Screen Buttons
    document.getElementById('btn-restart-race').addEventListener('click', () => {
      document.getElementById('results-screen').classList.add('hidden');
      this.startMode(this.mode);
    });
    document.getElementById('btn-next-career').addEventListener('click', () => {
      document.getElementById('results-screen').classList.add('hidden');
      this.startMode('career');
    });
    document.getElementById('btn-back-menu').addEventListener('click', () => {
      this.returnToMenu();
    });
  }

  updateMenuUI() {
    document.getElementById('menu-coin-count').textContent = this.profile.coins;
    document.getElementById('career-stage-badge').textContent = `المرحلة ${this.profile.careerStage}`;
    document.getElementById('selected-tuktuk-label').innerHTML =
      `التوكتوك الحالي: <strong>"${this.profile.slogan}"</strong>`;
  }

  updateGarageUI() {
    document.getElementById('garage-coins').textContent = this.profile.coins;
    document.getElementById('bar-speed').style.width = `${this.profile.upgrades.speed * 20}%`;
    document.getElementById('bar-nitro').style.width = `${this.profile.upgrades.nitro * 20}%`;
    document.getElementById('bar-handling').style.width = `${this.profile.upgrades.handling * 20}%`;
  }

  startMode(mode) {
    this.mode = mode;
    window.audioSys.init();
    window.audioSys.startShaabiMusic();
    window.audioSys.startEngine();

    this.applyUpgradesToPlayer(this.player1);
    this.resetAllVehicles();

    // Configure mode rules
    const splitDivider = document.getElementById('split-divider');
    splitDivider.classList.toggle('hidden', mode !== 'multiplayer');

    this.player2.isPlayer = (mode === 'multiplayer');

    // Toggle rival visibility in solo modes
    const showRivals = (mode !== 'delivery' && mode !== 'freeroam');
    this.rivals.forEach((r, idx) => {
      if (mode === 'multiplayer') {
        r.mesh.visible = (idx === 0); // Only Player 2 + traffic in 2P mode
      } else {
        r.mesh.visible = showRivals;
      }
    });

    if (mode === 'career') {
      this.totalLaps = 2 + Math.min(2, Math.floor(this.profile.careerStage / 2));
      this.timer = 0;
      // Scale AI difficulty gently with Career Stage
      this.rivals.forEach((r, idx) => {
        r.aiSkill = 0.86 + this.profile.careerStage * 0.025 - idx * 0.015;
      });
    } else if (mode === 'quick' || mode === 'multiplayer') {
      this.totalLaps = 3;
      this.timer = 0;
    } else if (mode === 'delivery') {
      this.deliveriesMade = 0;
      this.deliveriesGoal = 5;
      this.timer = 75; // 75 seconds countdown
      this.entities.placeNextDeliveryZone(0);
    } else if (mode === 'freeroam') {
      this.timer = 0;
    }

    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('results-screen').classList.add('hidden');
    document.getElementById('game-hud').classList.remove('hidden');
    document.getElementById('hud-slogan').textContent = this.profile.slogan;

    // 3 - 2 - 1 - انطلق Countdown
    this.state = 'COUNTDOWN';
    const banner = document.getElementById('countdown-banner');
    banner.classList.remove('hidden');
    const steps = ['٣', '٢', '١', 'انطلق يا باشا! 🛺'];
    let sIdx = 0;
    banner.textContent = steps[0];
    window.audioSys.playHorn();

    clearInterval(this.countdownInterval);
    this.countdownInterval = setInterval(() => {
      sIdx++;
      if (sIdx < steps.length) {
        banner.textContent = steps[sIdx];
        if (sIdx === steps.length - 1) {
          this.state = 'PLAYING';
          window.audioSys.speakCategory('start');
        }
      } else {
        banner.classList.add('hidden');
        clearInterval(this.countdownInterval);
      }
    }, 850);
  }

  returnToMenu() {
    clearInterval(this.countdownInterval);
    this.state = 'MENU';
    window.audioSys.stopEngine();
    document.getElementById('game-hud').classList.add('hidden');
    document.getElementById('results-screen').classList.add('hidden');
    document.getElementById('split-divider').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    this.updateMenuUI();
  }

  getPlayer1Input() {
    if (this.mode === 'multiplayer') {
      // In 2P Split Screen: Player 1 uses WASD + Space + ShiftLeft + PS Analog
      return {
        gas: !!(this.keys['KeyW'] || this.touchInput.gas || this.touchInput.analogGas),
        brake: !!(this.keys['KeyS'] || this.touchInput.brake || this.touchInput.analogBrake),
        left: !!(this.keys['KeyA'] || this.touchInput.left),
        right: !!(this.keys['KeyD'] || this.touchInput.right),
        steerAnalog: this.touchInput.steerAnalog || 0,
        drift: !!(this.keys['Space'] || this.touchInput.drift),
        nitro: !!(this.keys['ShiftLeft'] || this.touchInput.nitro)
      };
    }
    // Single player accepts WASD, Arrow Keys, and PlayStation Analog + Face Buttons
    return {
      gas: !!(this.keys['KeyW'] || this.keys['ArrowUp'] || this.touchInput.gas || this.touchInput.analogGas),
      brake: !!(this.keys['KeyS'] || this.keys['ArrowDown'] || this.touchInput.brake || this.touchInput.analogBrake),
      left: !!(this.keys['KeyA'] || this.keys['ArrowLeft'] || this.touchInput.left),
      right: !!(this.keys['KeyD'] || this.keys['ArrowRight'] || this.touchInput.right),
      steerAnalog: this.touchInput.steerAnalog || 0,
      drift: !!(this.keys['Space'] || this.touchInput.drift),
      nitro: !!(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.touchInput.nitro)
    };
  }

  getPlayer2Input() {
    return {
      gas: !!this.keys['ArrowUp'],
      brake: !!this.keys['ArrowDown'],
      left: !!this.keys['ArrowLeft'],
      right: !!this.keys['ArrowRight'],
      drift: !!(this.keys['Slash'] || this.keys['ControlRight']),
      nitro: !!(this.keys['ShiftRight'] || this.keys['Enter'])
    };
  }

  handleVehicleCollisions() {
    const activeList = this.allVehicles.filter(v => v.mesh.visible);
    for (let i = 0; i < activeList.length; i++) {
      for (let j = i + 1; j < activeList.length; j++) {
        const a = activeList[i];
        const b = activeList[j];
        const dx = a.position.x - b.position.x;
        const dz = a.position.z - b.position.z;
        const distSq = dx * dx + dz * dz;
        const minDist = 2.35;
        if (distSq < minDist * minDist && distSq > 0.001) {
          const dist = Math.sqrt(distSq);
          const overlap = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const nz = dz / dist;
          a.position.x += nx * overlap;
          a.position.z += nz * overlap;
          b.position.x -= nx * overlap;
          b.position.z -= nz * overlap;

          if (a.isPlayer || b.isPlayer) {
            window.audioSys.playCrash();
          }
        }
      }
    }
  }

  finishRace(won, customTitle, customSub, rankLabel, bonusCoins) {
    this.state = 'RESULTS';
    window.audioSys.stopEngine();

    const earnedCoins = this.player1.coinsCollected;
    const totalAdded = earnedCoins + bonusCoins;
    this.profile.coins += totalAdded;

    const nextCareerBtn = document.getElementById('btn-next-career');
    if (this.mode === 'career' && won) {
      this.profile.careerStage++;
      nextCareerBtn.classList.remove('hidden');
    } else {
      nextCareerBtn.classList.add('hidden');
    }
    this.saveProfile();

    document.getElementById('results-icon').textContent = won ? '🏆' : '🛺';
    document.getElementById('results-title').textContent = customTitle;
    document.getElementById('results-subtitle').textContent = customSub;
    document.getElementById('res-rank').textContent = rankLabel;
    document.getElementById('res-coins').textContent = `+${earnedCoins} ج.م 💰`;
    document.getElementById('res-bonus').textContent = `+${bonusCoins} ج.م 🎁`;

    document.getElementById('results-screen').classList.remove('hidden');
  }

  updateHUD() {
    const speedKmh = Math.round(Math.abs(this.player1.speed) * 2.6);
    document.getElementById('hud-speed').textContent = speedKmh;
    document.getElementById('hud-nitro-bar').style.width = `${this.player1.nitro}%`;
    document.getElementById('hud-fuel-bar').style.width = `${this.player1.fuel}%`;
    document.getElementById('hud-coins').textContent = `${this.profile.coins + this.player1.coinsCollected} ج.م`;

    const driftBadge = document.getElementById('drift-Chain-badge');
    driftBadge.classList.toggle('hidden', !this.player1.isDrifting);

    // Format Timer
    const mins = Math.floor(Math.abs(this.timer) / 60);
    const secs = Math.floor(Math.abs(this.timer) % 60);
    document.getElementById('hud-timer').textContent =
      `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (this.mode === 'delivery') {
      document.getElementById('hud-lap-label').textContent = 'الطلبات';
      document.getElementById('hud-lap').textContent = `${this.deliveriesMade} / ${this.deliveriesGoal}`;
      document.getElementById('hud-position').textContent = 'دليفري 🍲';
    } else if (this.mode === 'freeroam') {
      document.getElementById('hud-lap-label').textContent = 'الوضع';
      document.getElementById('hud-lap').textContent = 'تمشية حرة';
      document.getElementById('hud-position').textContent = 'باشا 👑';
    } else {
      document.getElementById('hud-lap-label').textContent = 'اللفة';
      document.getElementById('hud-lap').textContent = `${Math.min(this.player1.lap, this.totalLaps)} / ${this.totalLaps}`;

      const activeRacers = this.allVehicles.filter(v => v.mesh.visible);
      const sorted = [...activeRacers].sort((a, b) => b.totalProgress - a.totalProgress);
      const rank = sorted.indexOf(this.player1) + 1;
      document.getElementById('hud-position').textContent = `${rank} / ${activeRacers.length}`;

      // Overtake voice line celebration!
      if (rank < this.lastPlayerRank && this.timer > 3) {
        window.audioSys.speakCategory('overtake');
      }
      this.lastPlayerRank = rank;

      // Check race completion
      if (this.player1.lap > this.totalLaps) {
        const won = rank === 1;
        const bonus = won ? 250 : Math.max(50, 200 - rank * 35);
        this.finishRace(
          won,
          won ? 'مبروك يا باشا الحارة! كسبت السباق!' : 'فرقت على تكّة يا أسطى!',
          won ? 'سواقة معلمين ما يغلبهاش ميكروباص ولا زحمة!' : 'شد حيلك في الجولة الجاية وروّق التوكتوك في الورشة!',
          `المركز ${rank}`,
          bonus
        );
      }
    }
  }

  drawMinimap() {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    ctx.clearRect(0, 0, w, h);

    // Map world bounds: x in [-40, 275], z in [-280, 240]
    const mapX = (x) => ((x + 55) / 345) * (w - 24) + 12;
    const mapY = (z) => ((z + 285) / 535) * (h - 24) + 12;

    // Draw Track Loop
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    this.world.trackPoints.forEach((pt, idx) => {
      const mx = mapX(pt.x);
      const my = mapY(pt.z);
      if (idx === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    });
    ctx.closePath();
    ctx.stroke();

    // Draw Delivery Target if in Delivery mode
    if (this.mode === 'delivery' && this.entities.deliveryTarget.visible) {
      const dp = this.entities.deliveryTarget.position;
      ctx.fillStyle = '#00f5d4';
      ctx.beginPath();
      ctx.arc(mapX(dp.x), mapY(dp.z), 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Rivals
    this.rivals.forEach(r => {
      if (!r.mesh.visible) return;
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.arc(mapX(r.position.x), mapY(r.position.z), 4.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Player 1
    ctx.fillStyle = '#ffbe0b';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mapX(this.player1.position.x), mapY(this.player1.position.z), 5.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  updateFollowCamera(cam, vehicle, dt) {
    const presets = [
      { dist: 7.4, height: 3.15, lookAhead: 5.2 }, // Close Egyptian Tuk-Tuk Chase
      { dist: 5.6, height: 2.45, lookAhead: 6.5 }, // Bumper / Hood Action Chase
      { dist: 12.5, height: 6.2, lookAhead: 4.0 }  // High Street Panorama
    ];
    const p = presets[this.cameraMode];
    const extraDist = vehicle.isNitro ? 1.8 : 0;

    const targetX = vehicle.position.x - Math.sin(vehicle.heading) * (p.dist + extraDist);
    const targetY = vehicle.position.y + vehicle.yOffset + p.height;
    const targetZ = vehicle.position.z - Math.cos(vehicle.heading) * (p.dist + extraDist);

    cam.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), Math.min(1, dt * 8.5));

    const lookX = vehicle.position.x + Math.sin(vehicle.heading) * p.lookAhead;
    const lookY = vehicle.position.y + vehicle.yOffset + 1.35;
    const lookZ = vehicle.position.z + Math.cos(vehicle.heading) * p.lookAhead;
    cam.lookAt(lookX, lookY, lookZ);

    // Dynamic FOV boost when firing Nitro!
    const targetFov = vehicle.isNitro ? 74 : 60;
    cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 6);
    cam.updateProjectionMatrix();
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;

    this.world.update(dt, this.elapsed);

    if (this.state === 'MENU' || this.state === 'GARAGE') {
      // Showcase rotating camera around Player's Tuk-Tuk in Cairo street
      const isGarage = this.state === 'GARAGE';
      const radius = isGarage ? 4.8 : 6.8;
      const height = isGarage ? 2.15 : 3.1;
      const angle = this.elapsed * 0.75;
      const camX = this.player1.position.x + Math.sin(angle) * radius;
      const camZ = this.player1.position.z + Math.cos(angle) * radius;
      this.camera1.position.set(camX, height, camZ);

      // In Garage, shift lookAt slightly right so Tuk-Tuk sits in the open left viewport
      const rightOffset = isGarage ? 1.15 : 0;
      const lookX = this.player1.position.x + Math.cos(angle) * rightOffset;
      const lookZ = this.player1.position.z - Math.sin(angle) * rightOffset;
      this.camera1.lookAt(lookX, 1.18, lookZ);

      this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
      this.renderer.setScissorTest(false);
      this.renderer.render(this.scene, this.camera1);
      return;
    }

    if (this.state === 'PLAYING') {
      // Timer update
      if (this.mode === 'delivery') {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.finishRace(
            false,
            'الكشري برد يا أسطى! 🍲',
            'الوقت خلص قبل ما تسلّم كل الطلبات للزباين!',
            `${this.deliveriesMade} من ${this.deliveriesGoal} طلبات`,
            this.deliveriesMade * 35
          );
          return;
        }
      } else {
        this.timer += dt;
      }

      // Player 1 Physics
      const p1Input = this.getPlayer1Input();
      this.player1.updatePhysics(dt, p1Input, this.world);
      window.audioSys.updateEngine(
        this.player1.speed / this.player1.maxSpeed,
        this.player1.isDrifting,
        this.player1.isNitro
      );

      // Rivals or Player 2 Physics
      if (this.mode === 'multiplayer') {
        const p2Input = this.getPlayer2Input();
        this.player2.updatePhysics(dt, p2Input, this.world);
        if (this.player2.lap > this.totalLaps) {
          this.finishRace(
            false,
            'لاعب ٢ (المعلم زغلول) كسب السباق! 🏆',
            'تحدي عالمي بين صحاب الحارة!',
            'فوز لاعب ٢',
            150
          );
          return;
        }
      } else if (this.mode !== 'delivery' && this.mode !== 'freeroam') {
        this.rivals.forEach(r => {
          r.updateAI(dt, this.world, this.player1.totalProgress);
        });
      }

      // Vehicle collisions & Street entities
      this.handleVehicleCollisions();
      this.entities.update(dt, this.elapsed, this.allVehicles, this.mode, () => {
        // Delivery completed!
        this.deliveriesMade++;
        this.timer += 14; // Bonus time
        window.audioSys.playCoin();
        window.audioSys.speakCategory('delivery');
        this.entities.showEventBanner('🍲', 'تسلم إيدك يا أسطى!', '+١٤ ثانية وقت إضافي! اجري على الطلب اللي بعده!');

        if (this.deliveriesMade >= this.deliveriesGoal) {
          this.finishRace(
            true,
            'أسرع دليفري في مصر! 🍲🏆',
            'وصلت كل طلبات الكشري والحواوشي سخنة مولعة في الميعاد!',
            `${this.deliveriesGoal} / ${this.deliveriesGoal} طلبات`,
            300
          );
        } else {
          const info = this.world.getTrackInfo(this.player1.position);
          this.entities.placeNextDeliveryZone(info.t);
        }
      });

      this.updateHUD();
      this.drawMinimap();
    }

    // Camera Follow & Render (Single vs Split-Screen 2-Player)
    this.updateFollowCamera(this.camera1, this.player1, dt);

    if (this.mode === 'multiplayer') {
      this.updateFollowCamera(this.camera2, this.player2, dt);
      const w = window.innerWidth;
      const h = window.innerHeight;
      const halfW = Math.floor(w * 0.5);

      this.renderer.setScissorTest(true);

      // Right half: Player 1
      this.renderer.setViewport(halfW, 0, w - halfW, h);
      this.renderer.setScissor(halfW, 0, w - halfW, h);
      this.camera1.aspect = (w - halfW) / h;
      this.camera1.updateProjectionMatrix();
      this.renderer.render(this.scene, this.camera1);

      // Left half: Player 2
      this.renderer.setViewport(0, 0, halfW, h);
      this.renderer.setScissor(0, 0, halfW, h);
      this.camera2.aspect = halfW / h;
      this.camera2.updateProjectionMatrix();
      this.renderer.render(this.scene, this.camera2);
    } else {
      this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
      this.renderer.setScissorTest(false);
      this.renderer.render(this.scene, this.camera1);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new TukTukBashaGame();
});
