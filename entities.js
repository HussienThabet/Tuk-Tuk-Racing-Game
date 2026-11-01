// entities.js - Egyptian Tuk-Tuk 3D Vehicle, AI Rivals, Microbus Traffic, Collectibles & Funny Street Events

class TukTukVehicle {
  constructor(scene, config = {}) {
    this.scene = scene;
    this.isPlayer = !!config.isPlayer;
    this.playerIndex = config.playerIndex || 1;
    this.name = config.name || 'الأسطى باشا';
    this.color = config.color || '#e6192e';
    this.neonColor = config.neonColor || '#00f5d4';
    this.slogan = config.slogan || 'عيون الحسود فيها عود 🧿';

    // Upgrades & Performance stats
    this.maxSpeed = config.maxSpeed || 44;
    this.accel = config.accel || 28;
    this.handling = config.handling || 2.55;
    this.nitroPower = config.nitroPower || 1.48;

    // Physics state
    this.position = new THREE.Vector3();
    this.heading = 0; // radians
    this.speed = 0;
    this.verticalVel = 0;
    this.yOffset = 0;

    this.driftAngle = 0;
    this.isDrifting = false;
    this.driftTime = 0;
    this.isNitro = false;
    this.nitro = 100;
    this.fuel = 100;

    // Race progression
    this.lap = 1;
    this.lastT = 0;
    this.totalProgress = 0;
    this.coinsCollected = 0;

    // AI parameters
    this.aiLaneOffset = config.aiLaneOffset || 0;
    this.aiTargetLane = this.aiLaneOffset;
    this.aiLaneTimer = 0;
    this.aiSkill = config.aiSkill || 0.92;

    this.mesh = new THREE.Group();
    this.bodyTiltGroup = new THREE.Group();
    this.mesh.add(this.bodyTiltGroup);

    this.wheels = [];
    this.nitroFlames = [];
    this.neonMesh = null;
    this.paintMeshes = [];
    this.sloganMesh = null;

    this.buildTukTukModel();
    this.scene.add(this.mesh);
  }

  createSloganTexture(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');

    // Ornate Shaabi metallic sign background
    const grad = ctx.createLinearGradient(0, 0, 512, 160);
    grad.addColorStop(0, '#140d26');
    grad.addColorStop(0.5, '#2b193d');
    grad.addColorStop(1, '#140d26');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Double ornamental border
    ctx.strokeStyle = '#ffbe0b';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
    ctx.strokeStyle = '#00f5d4';
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

    ctx.fillStyle = '#ffbe0b';
    ctx.font = '900 34px Cairo, Tajawal, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  createRearCanvasDecal() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Leatherette dark hood texture
    ctx.fillStyle = '#1b1726';
    ctx.fillRect(0, 0, 512, 256);

    // Gold decorative stitching border
    ctx.strokeStyle = '#ffbe0b';
    ctx.setLineDash([12, 8]);
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, 484, 228);
    ctx.setLineDash([]);

    // Rear plastic window in the canvas hood
    ctx.fillStyle = 'rgba(120, 210, 235, 0.45)';
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(136, 40, 240, 95, 22) : ctx.rect(136, 40, 240, 95);
    ctx.fill();
    ctx.stroke();

    // Evil eye & Shaabi blessings on left/right of rear window
    ctx.font = '900 44px Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🧿', 70, 95);
    ctx.fillText('✋', 442, 95);

    ctx.fillStyle = '#00f5d4';
    ctx.font = '900 32px Cairo, Tajawal, sans-serif';
    ctx.fillText('✨ ما شاء الله ✨ BAJAJ RE ✨', 256, 195);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  createEgyptPlateTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 128);
    // Egyptian Blue top header bar ("مصر EGYPT")
    ctx.fillStyle = '#0077b6';
    ctx.fillRect(0, 0, 256, 42);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EGYPT   مصر', 128, 29);

    ctx.strokeStyle = '#111';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 250, 122);

    ctx.fillStyle = '#111111';
    ctx.font = '900 36px Cairo, sans-serif';
    ctx.fillText('ب ا ش ا  ١٠٠', 128, 96);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  buildTukTukModel() {
    const paintMat = new THREE.MeshLambertMaterial({ color: this.color });
    const blackBodyMat = new THREE.MeshLambertMaterial({ color: 0x181820 });
    const tireMat = new THREE.MeshLambertMaterial({ color: 0x141419 });
    const chromeMat = new THREE.MeshLambertMaterial({ color: 0xe8eef2 });
    const goldMat = new THREE.MeshBasicMaterial({ color: 0xffbe0b });
    const hoodMat = new THREE.MeshLambertMaterial({ color: 0x1e192b });
    const seatMat = new THREE.MeshLambertMaterial({ color: 0x6f1d1b });
    const cyanLedMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4 });
    const pinkLedMat = new THREE.MeshBasicMaterial({ color: 0xff006e });

    this.frontForkGroup = new THREE.Group();
    this.frontForkGroup.position.set(0, 0, 1.38);
    this.bodyTiltGroup.add(this.frontForkGroup);

    // =========================================================================
    // 1. CHASSIS FLOORBOARD (Teardrop Platform: narrow in front, wide in back)
    // =========================================================================
    const rearFloor = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.14, 1.65), blackBodyMat);
    rearFloor.position.set(0, 0.38, -0.45);
    const midFloor = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.14, 0.95), blackBodyMat);
    midFloor.position.set(0, 0.38, 0.55);
    const frontFloor = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.14, 0.7), blackBodyMat);
    frontFloor.position.set(0, 0.38, 1.15);
    this.bodyTiltGroup.add(rearFloor, midFloor, frontFloor);

    // =========================================================================
    // 2. ICONIC BAJAJ CURVED FRONT APRON / SHIELD ("صدر التوكتوك المقوس")
    // =========================================================================
    const apronGroup = new THREE.Group();
    apronGroup.position.set(0, 0.96, 1.26);
    apronGroup.rotation.x = -0.18; // Slanted backward toward driver

    // Rounded vertical front shield using half-cylinder
    const shieldGeo = new THREE.CylinderGeometry(0.56, 0.68, 1.05, 16, 1, false, -Math.PI * 0.55, Math.PI * 1.1);
    const shieldMesh = new THREE.Mesh(shieldGeo, paintMat);
    apronGroup.add(shieldMesh);
    this.paintMeshes.push(shieldMesh);

    // Center Bajaj Chrome Vertical Nose Strip + Emblem
    const noseStrip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.95, 0.08), chromeMat);
    noseStrip.position.set(0, 0, 0.62);
    apronGroup.add(noseStrip);

    // Central Round Bajaj Headlight Housing + Bright Lamp
    const bezelGeo = new THREE.CylinderGeometry(0.24, 0.27, 0.22, 16);
    bezelGeo.rotateX(Math.PI / 2);
    const bezel = new THREE.Mesh(bezelGeo, chromeMat);
    bezel.position.set(0, -0.05, 0.64);

    const lampGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.24, 16);
    lampGeo.rotateX(Math.PI / 2);
    const lamp = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0xffffdd }));
    lamp.position.set(0, -0.05, 0.65);
    apronGroup.add(bezel, lamp);

    // Twin Amber Turn Signal Blinkers on Left & Right Cheeks
    [-0.48, 0.48].forEach(bx => {
      const blinker = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xff9f1c })
      );
      blinker.position.set(bx, -0.08, 0.46);
      apronGroup.add(blinker);

      // Decorative Shaabi LED Heart / Fog lights on front apron
      const fogLed = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), cyanLedMat);
      fogLed.position.set(bx * 0.85, 0.28, 0.52);
      apronGroup.add(fogLed);
    });

    this.bodyTiltGroup.add(apronGroup);

    // =========================================================================
    // 3. SLANTED WINDSHIELD FRAME, WIPER & LONG SIDE MIRRORS ("برواز الإزاز والمرايات")
    // =========================================================================
    const wsGroup = new THREE.Group();
    wsGroup.position.set(0, 1.82, 0.98);
    wsGroup.rotation.x = -0.32;

    // Painted metal frame around glass
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.12, 0.1), paintMat);
    topFrame.position.set(0, 0.48, 0);
    const botFrame = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.14, 0.12), paintMat);
    botFrame.position.set(0, -0.46, 0);
    const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.98, 0.1), paintMat);
    leftFrame.position.set(-0.66, 0, 0);
    const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.98, 0.1), paintMat);
    rightFrame.position.set(0.66, 0, 0);
    const centerBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.94, 0.11), chromeMat);
    wsGroup.add(topFrame, botFrame, leftFrame, rightFrame, centerBar);
    this.paintMeshes.push(topFrame, botFrame, leftFrame, rightFrame);

    // Tinted Glass Pane
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.26, 0.86),
      new THREE.MeshBasicMaterial({
        color: 0xa8f0ff,
        transparent: true,
        opacity: 0.48,
        side: THREE.DoubleSide
      })
    );
    wsGroup.add(glass);

    // Single Black Windshield Wiper
    const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 0.04), blackBodyMat);
    wiper.position.set(0.12, 0.08, 0.07);
    wiper.rotation.z = -0.35;
    wsGroup.add(wiper);

    // Top Shaabi LED Visor Strip ("مسطرة ليد فوق الإزاز")
    for (let lx = -0.55; lx <= 0.55; lx += 0.22) {
      const led = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.07, 0.12),
        Math.abs(Math.round(lx * 10)) % 2 === 0 ? goldMat : pinkLedMat
      );
      led.position.set(lx, 0.55, 0.03);
      wsGroup.add(led);
    }

    // Long Chrome Side Mirrors with tassels ("مرايات توكتوك طويلة")
    [-1, 1].forEach(side => {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6), chromeMat);
      stalk.rotation.z = side * 1.15;
      stalk.position.set(side * 0.84, -0.1, 0.05);

      const mirrorHead = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.06), chromeMat);
      mirrorHead.position.set(side * 1.04, -0.02, 0.05);
      wsGroup.add(stalk, mirrorHead);
    });

    this.bodyTiltGroup.add(wsGroup);

    // =========================================================================
    // 4. OPEN CABIN INTERIOR: DRIVER ("الأسطى"), HANDLEBARS & PASSENGER BENCH
    // =========================================================================
    // Steering Column & Motorcycle Handlebars ("جادون التوكتوك")
    this.handlebarGroup = new THREE.Group();
    this.handlebarGroup.position.set(0, 1.28, 0.86);

    const steerCol = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.85, 8), blackBodyMat);
    steerCol.position.set(0, -0.35, 0.12);
    steerCol.rotation.x = -0.28;

    const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.82, 8), chromeMat);
    handleBar.rotation.z = Math.PI / 2;
    this.handlebarGroup.add(steerCol, handleBar);
    this.bodyTiltGroup.add(this.handlebarGroup);

    // Dashboard & Pioneer Speakers ("تابلوه وسماعتين بايونير")
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.26, 0.32), blackBodyMat);
    dash.position.set(0, 1.22, 1.05);
    this.bodyTiltGroup.add(dash);

    // Driver Seat Saddle & Realistic Articulated Driver ("الأسطى المعلم")
    const driverSeat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.48), seatMat);
    driverSeat.position.set(0, 0.72, 0.45);
    this.bodyTiltGroup.add(driverSeat);

    if (window.EgyptianPeople && window.EgyptianPeople.createDriver) {
      this.driverGroup = window.EgyptianPeople.createDriver({
        shirtColor: 0x0096c7,
        skinColor: 0xd2976c
      });
      this.bodyTiltGroup.add(this.driverGroup);
    } else {
      const driverTorso = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.31, 0.78, 10),
        new THREE.MeshLambertMaterial({ color: 0x00b4d8 })
      );
      driverTorso.position.set(0, 1.22, 0.42);
      const driverHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.23, 12, 12),
        new THREE.MeshLambertMaterial({ color: 0xd49a6a })
      );
      driverHead.position.set(0, 1.78, 0.42);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.235, 0.24, 0.14, 12),
        new THREE.MeshLambertMaterial({ color: 0xffffff })
      );
      cap.position.set(0, 1.9, 0.42);
      this.bodyTiltGroup.add(driverTorso, driverHead, cap);
    }

    // Rear Passenger Bench Seat ("الكنبة الخلفية المنجدة")
    const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.26, 0.62), seatMat);
    benchSeat.position.set(0, 0.78, -0.58);
    const benchBack = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.65, 0.18), seatMat);
    benchBack.position.set(0, 1.18, -0.88);
    this.bodyTiltGroup.add(benchSeat, benchBack);

    // =========================================================================
    // 5. REAR LOWER BODY TUB, WHEEL FENDERS & OPEN DOOR ARCHES ("حوض التوكتوك الخلفي")
    // =========================================================================
    // Rear engine bay lower box (does NOT block the open middle side doors!)
    const rearEngineBox = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.85, 1.05), paintMat);
    rearEngineBox.position.set(0, 0.82, -0.82);
    this.bodyTiltGroup.add(rearEngineBox);
    this.paintMeshes.push(rearEngineBox);

    // Left & Right Curved Rear Wheel Arches / Side Panels + Chrome Side Bars
    [-1, 1].forEach(side => {
      // Rear quarter panel over wheel
      const fender = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 1.25), paintMat);
      fender.position.set(side * 0.92, 0.76, -0.68);
      this.bodyTiltGroup.add(fender);
      this.paintMeshes.push(fender);

      // Lower side sill step bar ("عتبة الجنب")
      const sill = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 1.4), paintMat);
      sill.position.set(side * 0.78, 0.45, 0.2);
      this.bodyTiltGroup.add(sill);
      this.paintMeshes.push(sill);

      // Angled Side Chrome Safety Bar across passenger entry ("حاجز الجنب النيكل")
      const sideBar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.78, 8), chromeMat);
      sideBar.rotation.x = Math.PI / 2 + 0.35;
      sideBar.position.set(side * 0.88, 0.95, 0.15);
      this.bodyTiltGroup.add(sideBar);

      // Upper Side Triangular Leatherette Curtain ("ستارة الجنب الجلد")
      const curtainGeo = new THREE.PlaneGeometry(0.85, 0.65);
      const curtain = new THREE.Mesh(
        curtainGeo,
        new THREE.MeshLambertMaterial({ color: 0x1e192b, side: THREE.DoubleSide })
      );
      curtain.rotation.y = Math.PI / 2;
      curtain.position.set(side * 0.92, 1.88, -0.78);
      this.bodyTiltGroup.add(curtain);
    });

    // =========================================================================
    // 6. ARCHED CANVAS HOOD ("التندة القماش المقوسة والفرنشة")
    // =========================================================================
    // Symmetrical multi-panel arched Bajaj canvas roof
    const roofCenter = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.16, 2.26), hoodMat);
    roofCenter.position.set(0, 2.28, -0.12);
    const roofCrown = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.12, 2.16), hoodMat);
    roofCrown.position.set(0, 2.36, -0.12);
    const roofLeftEave = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 2.26), hoodMat);
    roofLeftEave.position.set(-0.78, 2.22, -0.12);
    roofLeftEave.rotation.z = 0.28;
    const roofRightEave = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 2.26), hoodMat);
    roofRightEave.position.set(0.78, 2.22, -0.12);
    roofRightEave.rotation.z = -0.28;
    this.bodyTiltGroup.add(roofCenter, roofCrown, roofLeftEave, roofRightEave);

    // Sloped Rear Canvas Back Panel with Window & Evil Eye 🧿 ("ضهر التندة المائل")
    const rearHoodTex = this.createRearCanvasDecal();
    const rearHoodGeo = new THREE.PlaneGeometry(1.84, 0.98);
    const rearHood = new THREE.Mesh(
      rearHoodGeo,
      new THREE.MeshBasicMaterial({ map: rearHoodTex, side: THREE.DoubleSide })
    );
    rearHood.position.set(0, 1.72, -1.24);
    rearHood.rotation.x = 0.24; // Slanted like a real Bajaj hood
    rearHood.rotation.y = Math.PI;
    this.bodyTiltGroup.add(rearHood);

    // Tubular Metal Roof Frame Pillars ("مواسير التندة")
    const bowGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.32, 8);
    [
      [-0.86, 1.58, 0.42],
      [0.86, 1.58, 0.42],
      [-0.9, 1.55, -0.25],
      [0.9, 1.55, -0.25]
    ].forEach(([px, py, pz]) => {
      const p = new THREE.Mesh(bowGeo, chromeMat);
      p.position.set(px, py, pz);
      this.bodyTiltGroup.add(p);
    });

    // Colorful Hanging Egyptian Faransha Tassels along both sides & back ("فرنشة وشراشيب التوكتوك")
    const tasselColors = [0xffbe0b, 0xe6192e, 0x00f5d4, 0xff006e];
    for (let z = -1.15; z <= 0.85; z += 0.22) {
      const tMat = new THREE.MeshBasicMaterial({
        color: tasselColors[Math.abs(Math.round(z * 10)) % tasselColors.length]
      });
      [-0.93, 0.93].forEach(xSide => {
        const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.19, 5), tMat);
        tassel.rotation.x = Math.PI;
        tassel.position.set(xSide, 2.16, z);
        this.bodyTiltGroup.add(tassel);
      });
    }

    // =========================================================================
    // 7. ICONIC REAR END: SLOGAN, EGYPT PLATE, SPARE TIRE & CHROME BUMPER
    // =========================================================================
    // Custom Egyptian Slogan Sign on the back ("عيون الحسود فيها عود")
    const sloganTex = this.createSloganTexture(this.slogan);
    const plateGeo = new THREE.PlaneGeometry(1.78, 0.48);
    const plateMat = new THREE.MeshBasicMaterial({ map: sloganTex });
    this.sloganMesh = new THREE.Mesh(plateGeo, plateMat);
    this.sloganMesh.position.set(0, 1.04, -1.36);
    this.sloganMesh.rotation.y = Math.PI;
    this.bodyTiltGroup.add(this.sloganMesh);

    // Rear-Mounted Spare Wheel ("عجلة الاستبن المعلقة في ضهر التوكتوك")
    const spareGroup = new THREE.Group();
    spareGroup.position.set(-0.48, 0.62, -1.42);
    const spareTire = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 16), tireMat);
    spareTire.rotation.x = Math.PI / 2;
    const spareHub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.22, 12), goldMat);
    spareHub.rotation.x = Math.PI / 2;
    spareGroup.add(spareTire, spareHub);
    this.bodyTiltGroup.add(spareGroup);

    // Egyptian License Plate ("مصر - ب ا ش ا ١٠٠") on right rear
    const egPlateTex = this.createEgyptPlateTexture();
    const egPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.52, 0.28),
      new THREE.MeshBasicMaterial({ map: egPlateTex })
    );
    egPlate.position.set(0.42, 0.64, -1.36);
    egPlate.rotation.y = Math.PI;
    this.bodyTiltGroup.add(egPlate);

    // Classic Bajaj Tri-Color Tail Lights + Rear Mudflaps ("الفوانيس الخلفية والدلايات")
    [-0.78, 0.78].forEach(tx => {
      const stopLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.14, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xff0033 })
      );
      stopLight.position.set(tx, 0.66, -1.36);
      const turnLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.14, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xff9f1c })
      );
      turnLight.position.set(tx * 1.12, 0.66, -1.36);
      this.bodyTiltGroup.add(stopLight, turnLight);

      // Rear Mudflap ("دلاية كاوتش خلفية")
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.04), blackBodyMat);
      flap.position.set(tx * 1.15, 0.26, -1.28);
      this.bodyTiltGroup.add(flap);
    });

    // Wide Chrome Rear Crash Guard Bumper ("اكصدام خلفي نيكل")
    const rearBumper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.98, 10), chromeMat);
    rearBumper.rotation.z = Math.PI / 2;
    rearBumper.position.set(0, 0.36, -1.46);
    this.bodyTiltGroup.add(rearBumper);

    // Twin Angled Chrome Exhaust Pipes ("شكمانين ديفيل نيكل")
    [-0.58, 0.58].forEach(ex => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.65, 10), chromeMat);
      pipe.rotation.x = Math.PI / 2 - 0.22;
      pipe.position.set(ex, 0.32, -1.48);
      this.bodyTiltGroup.add(pipe);
    });

    // =========================================================================
    // 8. STEERABLE FRONT WHEEL + MUDGUARD + EAGLE ORNAMENT & TWO REAR WHEELS
    // =========================================================================
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.24, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.26, 12);
    rimGeo.rotateZ(Math.PI / 2);
    const capGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.28, 8);
    capGeo.rotateZ(Math.PI / 2);

    // A) Single Front Wheel inside steerable Front Fork Group
    const frontWheelGroup = new THREE.Group();
    frontWheelGroup.position.set(0, 0.38, 0);
    frontWheelGroup.add(
      new THREE.Mesh(wheelGeo, tireMat),
      new THREE.Mesh(rimGeo, chromeMat),
      new THREE.Mesh(capGeo, goldMat)
    );
    this.frontForkGroup.add(frontWheelGroup);
    this.wheels.push(frontWheelGroup);

    // Bulbous Bajaj Front Mudguard ("رفرف العجلة الأمامية المنفوخ")
    const mudguardGeo = new THREE.SphereGeometry(0.46, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.58);
    const mudguard = new THREE.Mesh(mudguardGeo, paintMat);
    mudguard.scale.set(0.72, 0.95, 1.35);
    mudguard.rotation.x = -0.25;
    mudguard.position.set(0, 0.42, 0.02);
    this.frontForkGroup.add(mudguard);
    this.paintMeshes.push(mudguard);

    // Golden Eagle Ornament on Front Mudguard ("نسر التوكتوك النيكل")
    const eagle = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 6), goldMat);
    eagle.rotation.x = Math.PI / 2 - 0.3;
    eagle.position.set(0, 0.86, 0.28);
    this.frontForkGroup.add(eagle);

    // Dual Chrome Front Fork Shock Absorbers ("المساعدين الأمامي")
    [-0.24, 0.24].forEach(fx => {
      const shock = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.68, 8), chromeMat);
      shock.position.set(fx, 0.58, -0.05);
      shock.rotation.x = -0.2;
      this.frontForkGroup.add(shock);
    });

    // B) Two Rear Wheels
    [-0.95, 0.95].forEach(wx => {
      const wGroup = new THREE.Group();
      wGroup.position.set(wx, 0.38, -0.82);
      wGroup.add(
        new THREE.Mesh(wheelGeo, tireMat),
        new THREE.Mesh(rimGeo, chromeMat),
        new THREE.Mesh(capGeo, goldMat)
      );
      this.mesh.add(wGroup);
      this.wheels.push(wGroup);
    });

    // =========================================================================
    // 9. NEON UNDERGLOW & NITRO FLAMES
    // =========================================================================
    const neonGeo = new THREE.PlaneGeometry(2.15, 2.95);
    neonGeo.rotateX(-Math.PI / 2);
    const neonMat = new THREE.MeshBasicMaterial({
      color: this.neonColor,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide
    });
    this.neonMesh = new THREE.Mesh(neonGeo, neonMat);
    this.neonMesh.position.set(0, 0.05, -0.05);
    this.mesh.add(this.neonMesh);

    [-0.58, 0.58].forEach(nx => {
      const flameGeo = new THREE.ConeGeometry(0.22, 1.35, 8);
      flameGeo.rotateX(-Math.PI / 2);
      const flameMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4 });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(nx, 0.34, -2.05);
      flame.visible = false;
      this.bodyTiltGroup.add(flame);
      this.nitroFlames.push(flame);
    });
  }

  applyCustomization(color, neonColor, slogan) {
    this.color = color;
    this.neonColor = neonColor;
    this.slogan = slogan;

    this.paintMeshes.forEach(m => m.material.color.set(color));
    if (this.neonMesh) this.neonMesh.material.color.set(neonColor);
    if (this.sloganMesh) {
      this.sloganMesh.material.map = this.createSloganTexture(slogan);
      this.sloganMesh.material.needsUpdate = true;
    }
  }

  // Place the tuk-tuk at an arbitrary world position (open-world mode)
  resetAt(x, z, heading = 0) {
    this.position.set(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.verticalVel = 0;
    this.yOffset = 0;
    this.driftAngle = 0;
    this.nitro = 100;
    this.fuel = 100;
    this.coinsCollected = 0;
    this.syncMesh(0);
  }

  resetAtTrackT(world, t, laneOffset = 0) {
    const pt = world.curve.getPointAt(t % 1);
    const tangent = world.curve.getTangentAt(t % 1).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    this.position.copy(pt).addScaledVector(normal, laneOffset);
    this.position.y = 0;
    this.heading = Math.atan2(tangent.x, tangent.z);
    this.speed = 0;
    this.verticalVel = 0;
    this.yOffset = 0;
    this.driftAngle = 0;
    this.lap = 1;
    this.lastT = t;
    this.totalProgress = t;
    this.nitro = 100;
    this.fuel = 100;
    this.coinsCollected = 0;
    this.syncMesh(0);
  }

  updatePhysics(dt, input, world) {
    // Consume slight fuel when accelerating
    if (input.gas && this.fuel > 0) {
      this.fuel = Math.max(8, this.fuel - dt * 1.15);
    }

    // Nitro Boost
    this.isNitro = !!(input.nitro && this.nitro > 2 && input.gas);
    if (this.isNitro) {
      this.nitro = Math.max(0, this.nitro - dt * 28);
    } else {
      this.nitro = Math.min(100, this.nitro + dt * 4.5);
    }

    const topSpeed = this.maxSpeed * (this.isNitro ? this.nitroPower : 1.0);

    // Acceleration / Braking
    if (input.gas) {
      const boostAccel = this.accel * (this.isNitro ? 1.75 : 1.0);
      this.speed += boostAccel * dt;
    } else if (input.brake) {
      if (this.speed > 2) {
        this.speed -= this.accel * 1.65 * dt;
      } else {
        this.speed -= this.accel * 0.75 * dt;
      }
    } else {
      // Natural friction
      this.speed *= Math.pow(0.32, dt);
    }

    this.speed = Math.max(-16, Math.min(topSpeed, this.speed));

    // Steering & Handbrake Drifting ("تخميس بالتوكتوك") - supports proportional PS Analog Stick
    const digitalSteer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const steerDir = (input.steerAnalog && Math.abs(input.steerAnalog) > 0.04)
      ? -input.steerAnalog
      : digitalSteer;
    const speedFactor = Math.min(1, Math.abs(this.speed) / 10);
    const reverseSign = this.speed >= -0.2 ? 1 : -1;

    this.isDrifting = !!(input.drift && Math.abs(this.speed) > 14 && Math.abs(steerDir) > 0.12);
    const turnRate = this.handling * (this.isDrifting ? 1.42 : 1.0);

    this.heading += steerDir * turnRate * speedFactor * reverseSign * dt;

    if (this.isDrifting) {
      this.driftTime += dt;
      const targetDrift = steerDir * 0.42;
      this.driftAngle += (targetDrift - this.driftAngle) * Math.min(1, dt * 8);
      // Recharge nitro while drifting!
      this.nitro = Math.min(100, this.nitro + dt * 14);
    } else {
      this.driftTime = 0;
      this.driftAngle *= Math.pow(0.05, dt);
    }

    // Forward velocity vector
    const vx = Math.sin(this.heading) * this.speed;
    const vz = Math.cos(this.heading) * this.speed;
    this.position.x += vx * dt;
    this.position.z += vz * dt;

    // Gravity & Jump physics
    if (this.yOffset > 0 || this.verticalVel !== 0) {
      this.yOffset += this.verticalVel * dt;
      this.verticalVel -= 34 * dt;
      if (this.yOffset <= 0) {
        this.yOffset = 0;
        this.verticalVel = 0;
      }
    }

    // Check Ramps & Potholes
    for (const ramp of world.ramps) {
      const dx = this.position.x - ramp.position.x;
      const dz = this.position.z - ramp.position.z;
      if (dx * dx + dz * dz < ramp.radius * ramp.radius && this.yOffset < 0.2 && this.speed > 15) {
        this.verticalVel = Math.min(16, this.speed * 0.36);
      }
    }

    for (const hole of world.potholes) {
      const dx = this.position.x - hole.position.x;
      const dz = this.position.z - hole.position.z;
      if (dx * dx + dz * dz < hole.radius * hole.radius && this.yOffset < 0.1) {
        this.speed *= Math.pow(0.35, dt);
      }
    }

    // Open-world city: collide with buildings/props instead of following a track
    if (world.isCity) {
      world.resolveCollisions(this);
      this.syncMesh(steerDir, dt);
      return;
    }

    // Keep within Cairo street curb boundaries & track progress
    const info = world.getTrackInfo(this.position);
    const maxOffset = world.roadWidth * 0.52;
    if (Math.abs(info.lateralOffset) > maxOffset) {
      const sign = Math.sign(info.lateralOffset);
      const clampedPos = info.point.clone().addScaledVector(info.normal, sign * maxOffset);
      this.position.x = clampedPos.x;
      this.position.z = clampedPos.z;
      this.speed *= 0.86;
    }

    // Update lap & progress along closed loop
    let deltaT = info.t - this.lastT;
    if (deltaT < -0.5) {
      // Crossed finish line forward!
      this.lap++;
      deltaT += 1;
    } else if (deltaT > 0.5) {
      // Crossed finish line backward
      this.lap = Math.max(1, this.lap - 1);
      deltaT -= 1;
    }
    this.lastT = info.t;
    this.totalProgress = (this.lap - 1) + info.t;

    this.syncMesh(steerDir, dt);
  }

  updateAI(dt, world, playerProgress) {
    const info = world.getTrackInfo(this.position);

    // Periodically switch lanes to dodge obstacles or block player
    this.aiLaneTimer -= dt;
    if (this.aiLaneTimer <= 0) {
      this.aiLaneTimer = 1.5 + Math.random() * 2.5;
      this.aiTargetLane = (Math.random() - 0.5) * (world.roadWidth * 0.65);
    }
    this.aiLaneOffset += (this.aiTargetLane - this.aiLaneOffset) * dt * 2.0;

    // Look ahead on spline
    const lookAheadT = (info.t + 0.032) % 1;
    const targetPt = world.curve.getPointAt(lookAheadT);
    const targetTangent = world.curve.getTangentAt(lookAheadT).normalize();
    const targetNormal = new THREE.Vector3(-targetTangent.z, 0, targetTangent.x).normalize();
    const aimPoint = targetPt.clone().addScaledVector(targetNormal, this.aiLaneOffset);

    const desiredHeading = Math.atan2(aimPoint.x - this.position.x, aimPoint.z - this.position.z);
    let diff = desiredHeading - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    // Rubber-banding so races stay exciting and competitive!
    const progressGap = playerProgress - this.totalProgress;
    let rubberBand = 1.0;
    if (progressGap > 0.08) rubberBand = 1.12;
    else if (progressGap < -0.08) rubberBand = 0.90;

    const input = {
      gas: true,
      brake: false,
      left: diff > 0.08,
      right: diff < -0.08,
      drift: Math.abs(diff) > 0.45,
      nitro: progressGap > 0.06 && Math.random() < 0.25
    };

    const origMax = this.maxSpeed;
    this.maxSpeed = origMax * this.aiSkill * rubberBand;
    this.updatePhysics(dt, input, world);
    this.maxSpeed = origMax;
  }

  syncMesh(steerDir = 0, dt = 0.016) {
    this.mesh.position.set(this.position.x, this.position.y + this.yOffset, this.position.z);
    this.mesh.rotation.y = this.heading + this.driftAngle;

    // Steer the front wheel fork & motorcycle handlebars ("جادون التوكتوك والرفرف الأمامي")
    const targetSteerAngle = steerDir * 0.42;
    if (this.frontForkGroup) {
      this.frontForkGroup.rotation.y += (targetSteerAngle - this.frontForkGroup.rotation.y) * Math.min(1, dt * 12);
    }
    if (this.handlebarGroup) {
      this.handlebarGroup.rotation.y += (targetSteerAngle - this.handlebarGroup.rotation.y) * Math.min(1, dt * 12);
    }

    // Fun comedic Tuk-Tuk body lean on turns (رفع عجلة على السوكة!)
    const targetRoll = -steerDir * Math.min(0.28, Math.abs(this.speed) * 0.0065);
    const targetPitch = this.isNitro ? -0.09 : (this.yOffset > 0.1 ? -0.14 : 0);
    this.bodyTiltGroup.rotation.z += (targetRoll - this.bodyTiltGroup.rotation.z) * Math.min(1, dt * 10);
    this.bodyTiltGroup.rotation.x += (targetPitch - this.bodyTiltGroup.rotation.x) * Math.min(1, dt * 10);

    // Realistic driver dynamic steering & posture reaction
    if (this.driverGroup && this.driverGroup.userData && this.driverGroup.userData.updateDriver) {
      const curSteer = this.frontForkGroup ? this.frontForkGroup.rotation.y : targetSteerAngle;
      this.driverGroup.userData.updateDriver(curSteer, this.speed, this.bodyTiltGroup.rotation.z, targetPitch);
    }

    // Spin wheels
    this.wheels.forEach(w => {
      w.rotation.x += this.speed * dt * 1.6;
    });

    // Nitro flames
    this.nitroFlames.forEach(f => {
      f.visible = this.isNitro;
      if (this.isNitro) {
        f.scale.setScalar(0.85 + Math.random() * 0.4);
      }
    });
  }
}

// Manages Traffic Microbuses, Coins, Fuel, Nitro Pickups, Delivery Checkpoints & Funny Random Events
class StreetEntitiesManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.traffic = [];
    this.collectibles = [];
    this.funnyEvents = [];
    this.eventCooldown = 10;

    // Delivery mission marker
    this.deliveryTarget = null;
    this.deliveryT = 0.18;

    // Racing-track extras are only built for the old spline world
    if (!world.isCity) {
      this.spawnTraffic();
      this.spawnCollectibles();
      this.buildDeliveryMarker();
    }
  }

  createVehicleDecalTexture(topText, bottomText, bgColor, textColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#ffbe0b';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 248, 120);

    ctx.fillStyle = textColor;
    ctx.font = '900 30px Cairo, Tajawal, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(topText, 128, 48);
    ctx.fillStyle = '#ffbe0b';
    ctx.font = '800 24px Cairo, Tajawal, sans-serif';
    ctx.fillText(bottomText, 128, 92);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  buildDetailedMicrobus(index) {
    const vGroup = new THREE.Group();
    const wheels = [];

    const lowerColors = [0x0077b6, 0x0096c7, 0x1d3557];
    const stripeMat = new THREE.MeshLambertMaterial({ color: lowerColors[index % lowerColors.length] });
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf8f9fa });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x181a20 });
    const chromeMat = new THREE.MeshLambertMaterial({ color: 0xd8e2dc });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x223843 });
    const headLightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
    const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });

    // 1. Lower Blue Body & Upper White Cabin
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.92, 4.9), stripeMat);
    lowerBody.position.set(0, 0.82, 0);
    const upperCabin = new THREE.Mesh(new THREE.BoxGeometry(2.28, 1.05, 4.55), whiteMat);
    upperCabin.position.set(0, 1.75, -0.1);
    const roofCap = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 4.3), whiteMat);
    roofCap.position.set(0, 2.34, -0.1);
    vGroup.add(lowerBody, upperCabin, roofCap);

    // Slanted Aerodynamic Front Nose & Windshield
    const frontNose = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.95, 0.45), stripeMat);
    frontNose.position.set(0, 0.84, 2.35);
    frontNose.rotation.x = 0.18;
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(2.02, 0.88), glassMat);
    windshield.position.set(0, 1.78, 2.22);
    windshield.rotation.x = -0.22;
    vGroup.add(frontNose, windshield);

    // Side Passenger Windows (4 windows per side)
    [-1.15, 1.15].forEach((sx) => {
      for (let wz = -1.55; wz <= 1.35; wz += 0.95) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.68), glassMat);
        win.position.set(sx, 1.78, wz);
        win.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
        vGroup.add(win);
      }
    });

    // Rear Window + Egyptian Microbus Route Sticker ("خط شبرا - رمسيس / إمبابة")
    const rearWin = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.72), glassMat);
    rearWin.position.set(0, 1.82, -2.39);
    rearWin.rotation.y = Math.PI;
    vGroup.add(rearWin);

    const routeTex = this.createVehicleDecalTexture('خط شبرا - رمسيس', 'أجرة القاهرة 🚐', '#003566', '#ffffff');
    const routeSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.65, 0.55),
      new THREE.MeshBasicMaterial({ map: routeTex })
    );
    routeSign.position.set(0, 1.05, -2.47);
    routeSign.rotation.y = Math.PI;
    vGroup.add(routeSign);

    // Front Grille, Bumpers, Headlights & Taillights
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.28, 0.35), darkMat);
    frontBumper.position.set(0, 0.46, 2.52);
    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.28, 0.32), darkMat);
    rearBumper.position.set(0, 0.46, -2.48);
    const grille = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.42), darkMat);
    grille.position.set(0, 0.85, 2.59);
    vGroup.add(frontBumper, rearBumper, grille);

    [-0.82, 0.82].forEach((lx) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.1), headLightMat);
      hl.position.set(lx, 0.92, 2.58);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.45, 0.1), tailLightMat);
      tl.position.set(lx * 1.1, 0.95, -2.46);
      vGroup.add(hl, tl);
    });

    // Rooftop Chrome Luggage Rack ("شبكة الميكروباص")
    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.14, 3.2), chromeMat);
    rack.position.set(0, 2.48, -0.2);
    vGroup.add(rack);

    // 4 Spinning 3D Wheels with Chrome Rims
    const wheelGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.32, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.34, 12);
    rimGeo.rotateZ(Math.PI / 2);

    [
      [-1.12, 0.44, 1.55],
      [1.12, 0.44, 1.55],
      [-1.12, 0.44, -1.55],
      [1.12, 0.44, -1.55]
    ].forEach(([wx, wy, wz]) => {
      const wGroup = new THREE.Group();
      wGroup.position.set(wx, wy, wz);
      wGroup.add(new THREE.Mesh(wheelGeo, darkMat), new THREE.Mesh(rimGeo, chromeMat));
      vGroup.add(wGroup);
      wheels.push(wGroup);
    });

    return { vGroup, wheels };
  }

  buildDetailedCairoTaxi(index) {
    const vGroup = new THREE.Group();
    const wheels = [];

    const isWhiteTaxi = index % 3 === 0;
    const bodyMat = new THREE.MeshLambertMaterial({ color: isWhiteTaxi ? 0xf8f9fa : 0x16181d });
    const cabinMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const stripeMat = new THREE.MeshLambertMaterial({ color: isWhiteTaxi ? 0x16181d : 0xffffff });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x141419 });
    const chromeMat = new THREE.MeshLambertMaterial({ color: 0xd8e2dc });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x264653 });
    const headLightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
    const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });

    // 1. Sedan Lower Chassis (Hood, Doors, Trunk)
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.78, 4.35), bodyMat);
    lowerBody.position.set(0, 0.68, 0);
    // Side beltline stripe
    const sideStripe = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.22, 4.2), stripeMat);
    sideStripe.position.set(0, 0.72, 0);
    vGroup.add(lowerBody, sideStripe);

    // 2. Passenger Cabin Roof + Sloped Front & Rear Glass
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.68, 2.15), cabinMat);
    cabin.position.set(0, 1.38, -0.15);

    const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 0.75), glassMat);
    frontGlass.position.set(0, 1.36, 1.08);
    frontGlass.rotation.x = -0.52;

    const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 0.72), glassMat);
    rearGlass.position.set(0, 1.36, -1.36);
    rearGlass.rotation.x = 0.52;
    rearGlass.rotation.y = Math.PI;
    vGroup.add(cabin, frontGlass, rearGlass);

    // Side Windows (Front & Rear Doors)
    [-0.95, 0.95].forEach((sx) => {
      [-0.62, 0.32].forEach((wz) => {
        const sWin = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.52), glassMat);
        sWin.position.set(sx, 1.38, wz);
        sWin.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
        vGroup.add(sWin);
      });
    });

    // 3. Glowing Yellow "TAXI أجرة" Roof Sign
    const taxiTex = this.createVehicleDecalTexture('TAXI أجرة', 'القاهرة', '#ffbe0b', '#111111');
    const taxiSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.32, 0.36),
      new THREE.MeshBasicMaterial({ map: taxiTex })
    );
    taxiSign.position.set(0, 1.88, -0.05);
    vGroup.add(taxiSign);

    // 4. Bumpers, Grille, Headlights, Taillights & License Plate
    const fBumper = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.24, 0.28), darkMat);
    fBumper.position.set(0, 0.42, 2.18);
    const rBumper = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.24, 0.28), darkMat);
    rBumper.position.set(0, 0.42, -2.18);
    vGroup.add(fBumper, rBumper);

    [-0.72, 0.72].forEach((lx) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.1), headLightMat);
      hl.position.set(lx, 0.78, 2.16);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.24, 0.1), tailLightMat);
      tl.position.set(lx, 0.8, -2.16);
      vGroup.add(hl, tl);
    });

    // 5. 4 Spinning 3D Wheels with Chrome Hubcaps
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.3, 12);
    rimGeo.rotateZ(Math.PI / 2);

    [
      [-1.02, 0.38, 1.32],
      [1.02, 0.38, 1.32],
      [-1.02, 0.38, -1.32],
      [1.02, 0.38, -1.32]
    ].forEach(([wx, wy, wz]) => {
      const wGroup = new THREE.Group();
      wGroup.position.set(wx, wy, wz);
      wGroup.add(new THREE.Mesh(wheelGeo, darkMat), new THREE.Mesh(rimGeo, chromeMat));
      vGroup.add(wGroup);
      wheels.push(wGroup);
    });

    return { vGroup, wheels };
  }

  spawnTraffic() {
    // 8 Detailed 3D Egyptian Microbuses & Cairo Taxis moving along the street
    const totalTraffic = 8;
    for (let i = 0; i < totalTraffic; i++) {
      const isMicrobus = i % 2 === 0;
      const built = isMicrobus ? this.buildDetailedMicrobus(i) : this.buildDetailedCairoTaxi(i);

      this.group.add(built.vGroup);
      this.traffic.push({
        mesh: built.vGroup,
        wheels: built.wheels,
        t: (i / totalTraffic + 0.06) % 1,
        lane: (i % 2 === 0 ? 1 : -1) * 4.2,
        speed: 0.015 + (i % 3) * 0.0035,
        radius: 2.35
      });
    }
  }

  spawnCollectibles() {
    // 36 Collectibles around track: Coins (جنيه دهب), Nitro (أنبوبة), Fuel (جركن بنزين)
    const count = 36;
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const pt = this.world.curve.getPointAt(t);
      const tangent = this.world.curve.getTangentAt(t).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      const lane = ((i % 3) - 1) * 4.2;
      const pos = pt.clone().addScaledVector(normal, lane);

      let type = 'coin';
      let mesh;

      if (i % 9 === 0) {
        type = 'nitro';
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.45, 1.3, 10),
          new THREE.MeshBasicMaterial({ color: 0x00f5d4 })
        );
      } else if (i % 11 === 0) {
        type = 'fuel';
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 1.1, 0.6),
          new THREE.MeshBasicMaterial({ color: 0x38b000 })
        );
      } else {
        const coinGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.18, 14);
        coinGeo.rotateX(Math.PI / 2);
        mesh = new THREE.Mesh(coinGeo, new THREE.MeshBasicMaterial({ color: 0xffbe0b }));
      }

      mesh.position.set(pos.x, 1.15, pos.z);
      this.group.add(mesh);
      this.collectibles.push({
        mesh,
        type,
        position: pos,
        active: true,
        respawnTimer: 0
      });
    }
  }

  buildDeliveryMarker() {
    const group = new THREE.Group();
    const ringGeo = new THREE.CylinderGeometry(3.2, 3.2, 6.0, 18, 1, true);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(ringGeo, ringMat);
    beam.position.y = 3.0;
    group.add(beam);

    // Floating Koshary pot icon
    const box = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1, 0),
      new THREE.MeshBasicMaterial({ color: 0xffbe0b })
    );
    box.position.y = 2.6;
    group.add(box);

    group.visible = false;
    this.group.add(group);
    this.deliveryTarget = group;
  }

  placeNextDeliveryZone(currentT) {
    this.deliveryT = (currentT + 0.18 + Math.random() * 0.14) % 1;
    const pt = this.world.curve.getPointAt(this.deliveryT);
    this.deliveryTarget.position.set(pt.x, 0, pt.z);
    this.deliveryTarget.visible = true;
  }

  // Trigger Funny Random Cairo Street Events (Chicken crossing road / Spilled Watermelon Cart)
  triggerRandomFunnyEvent(playerVehicle) {
    const info = this.world.getTrackInfo(playerVehicle.position);
    const eventT = (info.t + 0.045) % 1;
    const pt = this.world.curve.getPointAt(eventT);
    const tangent = this.world.curve.getTangentAt(eventT).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    const isChicken = Math.random() < 0.55;
    const eventGroup = new THREE.Group();
    eventGroup.position.copy(pt);

    if (isChicken) {
      // Giant comedic flock of white chickens crossing the road!
      for (let c = -2; c <= 2; c++) {
        const chick = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.SphereGeometry(0.55, 8, 8),
          new THREE.MeshLambertMaterial({ color: 0xffffff })
        );
        body.position.y = 0.6;
        const comb = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.35, 0.35),
          new THREE.MeshBasicMaterial({ color: 0xe6192e })
        );
        comb.position.set(0, 1.15, 0.2);
        const beak = new THREE.Mesh(
          new THREE.ConeGeometry(0.15, 0.35, 6),
          new THREE.MeshBasicMaterial({ color: 0xffbe0b })
        );
        beak.rotation.x = Math.PI / 2;
        beak.position.set(0, 0.85, 0.55);
        chick.add(body, comb, beak);
        chick.position.set(c * 1.5, 0, (Math.random() - 0.5) * 1.5);
        eventGroup.add(chick);
      }

      this.group.add(eventGroup);
      this.funnyEvents.push({
        type: 'chicken',
        mesh: eventGroup,
        basePos: pt.clone(),
        normal,
        phase: 0,
        ttl: 9.0
      });

      window.audioSys.playChickenCluck();
      window.audioSys.speakCategory('chicken');
      this.showEventBanner('🐔', 'خلي بالك من الفرخة يا معلم!', 'فراخ عم محروس الفرارجي فلتت وبتعدي الحارة!');
    } else {
      // Spilled Watermelon Cart rolling across the street!
      for (let w = -2; w <= 2; w++) {
        const melon = new THREE.Mesh(
          new THREE.SphereGeometry(0.75, 10, 10),
          new THREE.MeshLambertMaterial({ color: 0x2b9348 })
        );
        melon.position.set(w * 2.1, 0.75, (Math.random() - 0.5) * 2.0);
        eventGroup.add(melon);
      }

      this.group.add(eventGroup);
      this.funnyEvents.push({
        type: 'watermelon',
        mesh: eventGroup,
        basePos: pt.clone(),
        normal,
        phase: 0,
        ttl: 9.0
      });

      window.audioSys.speakCategory('watermelon');
      this.showEventBanner('🍉', 'عربية البطيخ اتقلبت في الحارة!', 'حاسب لتزحلق على البطيخ يا أسطى!');
    }
  }

  showEventBanner(icon, title, desc) {
    const alertEl = document.getElementById('event-alert');
    if (!alertEl) return;
    document.getElementById('event-icon').textContent = icon;
    document.getElementById('event-title').textContent = title;
    document.getElementById('event-desc').textContent = desc;
    alertEl.classList.remove('hidden');
    clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => {
      alertEl.classList.add('hidden');
    }, 4200);
  }

  update(dt, elapsed, vehicles, activeMode, onDeliveryComplete) {
    // 1. Update Moving Traffic Microbuses & Taxis
    for (const tr of this.traffic) {
      tr.t = (tr.t + tr.speed * dt) % 1;
      const pt = this.world.curve.getPointAt(tr.t);
      const tangent = this.world.curve.getTangentAt(tr.t).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      tr.mesh.position.copy(pt).addScaledVector(normal, tr.lane);
      tr.mesh.rotation.y = Math.atan2(tangent.x, tangent.z);

      // Spin 3D wheels on traffic vehicles
      if (tr.wheels) {
        tr.wheels.forEach((w) => {
          w.rotation.x += dt * 18.0;
        });
      }

      // Check collision with Tuk-Tuks
      for (const v of vehicles) {
        const dx = v.position.x - tr.mesh.position.x;
        const dz = v.position.z - tr.mesh.position.z;
        const minDist = 2.6;
        if (dx * dx + dz * dz < minDist * minDist && v.yOffset < 1.2) {
          const len = Math.sqrt(dx * dx + dz * dz) || 1;
          v.position.x += (dx / len) * 1.4;
          v.position.z += (dz / len) * 1.4;
          v.speed *= 0.55;
          if (v.isPlayer) {
            window.audioSys.playCrash();
            if (Math.random() < 0.45) window.audioSys.speakCategory('crash');
          }
        }
      }
    }

    // 2. Update Collectibles (Coins, Nitro, Fuel)
    for (const c of this.collectibles) {
      if (!c.active) {
        c.respawnTimer -= dt;
        if (c.respawnTimer <= 0) {
          c.active = true;
          c.mesh.visible = true;
        }
        continue;
      }

      c.mesh.rotation.y += dt * 2.8;

      for (const v of vehicles) {
        const dx = v.position.x - c.position.x;
        const dz = v.position.z - c.position.z;
        if (dx * dx + dz * dz < 4.8) {
          c.active = false;
          c.mesh.visible = false;
          c.respawnTimer = 8.0;

          if (c.type === 'coin') {
            v.coinsCollected += 10;
            if (v.isPlayer) window.audioSys.playCoin();
          } else if (c.type === 'nitro') {
            v.nitro = 100;
            if (v.isPlayer) window.audioSys.playCoin();
          } else if (c.type === 'fuel') {
            v.fuel = 100;
            if (v.isPlayer) window.audioSys.playCoin();
          }
        }
      }
    }

    // 3. Delivery Challenge Mode Checkpoint
    if (activeMode === 'delivery' && this.deliveryTarget) {
      this.deliveryTarget.visible = true;
      this.deliveryTarget.rotation.y += dt * 2.2;
      const p = vehicles[0];
      const dx = p.position.x - this.deliveryTarget.position.x;
      const dz = p.position.z - this.deliveryTarget.position.z;
      if (dx * dx + dz * dz < 14.0) {
        if (onDeliveryComplete) onDeliveryComplete();
      }
    } else if (this.deliveryTarget) {
      this.deliveryTarget.visible = false;
    }

    // 4. Funny Random Street Events
    this.eventCooldown -= dt;
    if (this.eventCooldown <= 0 && vehicles[0] && vehicles[0].speed > 10) {
      this.eventCooldown = 16 + Math.random() * 10;
      this.triggerRandomFunnyEvent(vehicles[0]);
    }

    for (let i = this.funnyEvents.length - 1; i >= 0; i--) {
      const ev = this.funnyEvents[i];
      ev.ttl -= dt;
      ev.phase += dt * 3.2;

      const offset = Math.sin(ev.phase) * 5.5;
      ev.mesh.position.copy(ev.basePos).addScaledVector(ev.normal, offset);
      ev.mesh.position.y = Math.abs(Math.sin(ev.phase * 4)) * 0.35;

      // Check collision with player
      for (const v of vehicles) {
        const dx = v.position.x - ev.mesh.position.x;
        const dz = v.position.z - ev.mesh.position.z;
        if (dx * dx + dz * dz < 7.5 && v.yOffset < 1.0) {
          v.verticalVel = 7.5; // Comedic bounce!
          if (v.isPlayer) window.audioSys.playChickenCluck();
        }
      }

      if (ev.ttl <= 0) {
        this.group.remove(ev.mesh);
        this.funnyEvents.splice(i, 1);
      }
    }
  }
}

window.TukTukVehicle = TukTukVehicle;
window.StreetEntitiesManager = StreetEntitiesManager;
