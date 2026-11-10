/**
 * people.js – High-Fidelity 3D Character & Pedestrian System for Tuk-Tuk Basha
 * Authentic Cairo street people: Galabeyas, Abayas, Tagias, Tarbooshes,
 * animated walking gait, expressive faces, passenger hailing, and driver "الأسطى".
 */

(function () {
  'use strict';

  // Shared geometry & texture cache for top performance
  const GeoCache = {};
  const TexCache = {};
  const MatCache = {};

  function getBox(w, h, d) {
    const k = `box_${w}_${h}_${d}`;
    if (!GeoCache[k]) GeoCache[k] = new THREE.BoxGeometry(w, h, d);
    return GeoCache[k];
  }

  function getCyl(rt, rb, h, s) {
    const k = `cyl_${rt}_${rb}_${h}_${s}`;
    if (!GeoCache[k]) GeoCache[k] = new THREE.CylinderGeometry(rt, rb, h, s);
    return GeoCache[k];
  }

  function getSphere(r, w, h, phiStart, phiLen, thetaStart, thetaLen) {
    const k = `sph_${r}_${w}_${h}_${phiStart}_${phiLen}_${thetaStart}_${thetaLen}`;
    if (!GeoCache[k]) {
      GeoCache[k] = new THREE.SphereGeometry(r, w, h, phiStart, phiLen, thetaStart, thetaLen);
    }
    return GeoCache[k];
  }

  function getMat(color, roughness = 0.6) {
    const k = `mat_${color}_${roughness}`;
    if (!MatCache[k]) {
      MatCache[k] = TTGfx.lit({ color: color });
    }
    return MatCache[k];
  }

  // Generate procedural realistic face textures with Egyptian features
  function getFaceTexture(opts = {}) {
    const key = `face_${opts.gender || 'm'}_${opts.type || 'mustache'}_${opts.skin || '0xd2976c'}`;
    if (TexCache[key]) return TexCache[key];

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Base skin tone
    ctx.fillStyle = opts.skinCss || '#d79b71';
    ctx.fillRect(0, 0, 128, 128);

    // Subtle facial shading / cheek blush
    const grad = ctx.createRadialGradient(64, 64, 20, 64, 64, 60);
    grad.addColorStop(0, 'rgba(255, 200, 180, 0.15)');
    grad.addColorStop(1, 'rgba(100, 50, 20, 0.18)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    // Eyes
    const eyeY = 50;
    [-1, 1].forEach((dir) => {
      const cx = 64 + dir * 24;

      // Eye white sclera
      ctx.fillStyle = '#f8f9fa';
      ctx.beginPath();
      ctx.ellipse(cx, eyeY, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Kohl / eyeliner rim
      ctx.strokeStyle = '#1b120c';
      ctx.lineWidth = opts.gender === 'f' ? 2.5 : 1.5;
      ctx.stroke();

      // Dark Egyptian brown iris
      ctx.fillStyle = '#2c1810';
      ctx.beginPath();
      ctx.arc(cx + (opts.lookX || 0), eyeY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Pupil & light glint
      ctx.fillStyle = '#050302';
      ctx.beginPath();
      ctx.arc(cx + (opts.lookX || 0), eyeY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - 2, eyeY - 2, 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Eyebrow
      ctx.fillStyle = '#1e130c';
      ctx.beginPath();
      if (opts.gender === 'f') {
        // Elegant arched eyebrow
        ctx.ellipse(cx, eyeY - 11, 12, 2.2, dir * 0.15, 0, Math.PI * 2);
      } else {
        // Thick Egyptian male eyebrow
        ctx.ellipse(cx, eyeY - 12, 13, 3.8, dir * 0.08, 0, Math.PI * 2);
      }
      ctx.fill();
    });

    // Nose bridge and nostrils
    ctx.strokeStyle = 'rgba(110, 55, 20, 0.35)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(64, 46);
    ctx.lineTo(62, 70);
    ctx.lineTo(68, 73);
    ctx.stroke();

    ctx.fillStyle = 'rgba(70, 30, 10, 0.5)';
    ctx.beginPath();
    ctx.arc(58, 74, 2, 0, Math.PI * 2);
    ctx.arc(70, 74, 2, 0, Math.PI * 2);
    ctx.fill();

    // Mouth / Mustache / Beard
    if (opts.type === 'mustache' || opts.type === 'driver') {
      // Iconic thick Egyptian mustache ("شنب بلدي أصيل")
      ctx.fillStyle = '#140c06';
      ctx.beginPath();
      ctx.moveTo(64, 82);
      ctx.quadraticCurveTo(46, 78, 38, 86);
      ctx.quadraticCurveTo(46, 95, 64, 88);
      ctx.quadraticCurveTo(82, 95, 90, 86);
      ctx.quadraticCurveTo(82, 78, 64, 82);
      ctx.fill();

      // Underlip soul patch or lower lip shadow
      ctx.fillStyle = 'rgba(120, 50, 40, 0.4)';
      ctx.beginPath();
      ctx.ellipse(64, 98, 7, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (opts.type === 'beard') {
      // Trimmed beard + mustache
      ctx.fillStyle = '#1a100a';
      ctx.beginPath();
      ctx.moveTo(38, 82);
      ctx.quadraticCurveTo(64, 86, 90, 82);
      ctx.quadraticCurveTo(94, 114, 64, 120);
      ctx.quadraticCurveTo(34, 114, 38, 82);
      ctx.fill();

      ctx.fillStyle = '#c85a54';
      ctx.fillRect(56, 88, 16, 4);
    } else if (opts.gender === 'f') {
      // Feminine lips with natural rosy terracotta hue
      ctx.fillStyle = '#bd4848';
      ctx.beginPath();
      ctx.moveTo(52, 90);
      ctx.quadraticCurveTo(64, 85, 76, 90);
      ctx.quadraticCurveTo(64, 100, 52, 90);
      ctx.fill();
      // Lip shine
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.ellipse(64, 92, 4, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Modern clean look / young smile
      ctx.strokeStyle = '#853229';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(64, 86, 11, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(64, 91, 7, 2, 0, 0, Math.PI);
      ctx.fill();
    }

    // Sunglasses for driver if requested
    if (opts.sunglasses) {
      ctx.fillStyle = '#111315';
      [-1, 1].forEach((dir) => {
        const cx = 64 + dir * 24;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(cx - 16, eyeY - 9, 32, 20, 6) : ctx.rect(cx - 16, eyeY - 9, 32, 20);
        ctx.fill();
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      });
      // Bridge
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(48, eyeY - 3);
      ctx.lineTo(80, eyeY - 3);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    TexCache[key] = tex;
    return tex;
  }

  // Fabric patterns (striped galabeya, embroidery, denim)
  function getFabricTexture(type, baseColor, accentColor) {
    const key = `fab_${type}_${baseColor}_${accentColor}`;
    if (TexCache[key]) return TexCache[key];

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 128, 128);

    if (type === 'stripes') {
      ctx.fillStyle = accentColor;
      for (let x = 0; x < 128; x += 16) {
        ctx.fillRect(x, 0, 4, 128);
      }
    } else if (type === 'plaid') {
      ctx.fillStyle = accentColor;
      ctx.globalAlpha = 0.35;
      for (let x = 0; x < 128; x += 24) ctx.fillRect(x, 0, 6, 128);
      for (let y = 0; y < 128; y += 24) ctx.fillRect(0, y, 128, 6);
      ctx.globalAlpha = 1.0;
    } else if (type === 'embroidery') {
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 3;
      for (let y = 16; y < 128; y += 32) {
        ctx.beginPath();
        for (let x = 0; x < 128; x += 16) {
          ctx.lineTo(x, y + 5 * Math.sin(x));
        }
        ctx.stroke();
      }
    } else if (type === 'tagia') {
      // Traditional crochet mesh cap texture
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 2;
      for (let i = 0; i < 128; i += 12) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i + 128, 128);
        ctx.moveTo(i, 128); ctx.lineTo(i + 128, 0);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    TexCache[key] = tex;
    return tex;
  }

  // Egyptian Character Archetypes definition
  const ARCHETYPES = [
    // 0: Amm Ahmed - Classic Baladi Egyptian in Galabeya
    {
      name: 'Amm Ahmed',
      gender: 'm',
      outfit: 'galabeya',
      faceType: 'mustache',
      skinColor: 0xd2976c,
      skinCss: '#d2976c',
      robeColor: 0xefede6, // White / cream galabeya
      robeAccent: '#d8d4c8',
      headwear: 'tagia',
      footwear: 'slippers',
      shoeColor: 0x6b4226,
      scale: 1.0
    },
    // 1: Shabab Shubra - Modern youth with casual t-shirt & jeans
    {
      name: 'Shabab Shubra',
      gender: 'm',
      outfit: 'casual',
      faceType: 'clean',
      skinColor: 0xdeb887,
      skinCss: '#deb887',
      topColor: 0xe63946, // Vibrant red shirt
      pantsColor: 0x223843, // Denim blue jeans
      headwear: 'hair_modern',
      footwear: 'sneakers',
      shoeColor: 0xffffff,
      scale: 0.98
    },
    // 2: Om Mohamed - Mother in traditional Abaya and Tarha
    {
      name: 'Om Mohamed',
      gender: 'f',
      outfit: 'abaya',
      faceType: 'female',
      skinColor: 0xcca07b,
      skinCss: '#cca07b',
      robeColor: 0x1f2421, // Midnight black abaya
      robeAccent: '#d4af37', // Gold trim
      headwear: 'tarha',
      tarhaColor: 0x2a9d8f, // Emerald green scarf
      footwear: 'shoes',
      shoeColor: 0x111111,
      accessory: 'shopping_bag',
      scale: 0.95
    },
    // 3: El-Qahwagi - Ahwa Baladi server with vest and apron
    {
      name: 'El-Qahwagi',
      gender: 'm',
      outfit: 'qahwagi',
      faceType: 'mustache',
      skinColor: 0xc68642,
      skinCss: '#c68642',
      topColor: 0xfdfdfd,
      vestColor: 0x3d2616,
      pantsColor: 0x1a1a1a,
      apronColor: 0xf4f1de,
      headwear: 'tagia',
      footwear: 'slippers',
      shoeColor: 0x332211,
      accessory: 'tea_tray', // Holds tray with mint tea!
      scale: 0.97
    },
    // 4: El-Afandi - Vintage Cairo clerk with suit slacks, tie & red Tarboosh
    {
      name: 'El-Afandi',
      gender: 'm',
      outfit: 'suit',
      faceType: 'mustache',
      skinColor: 0xdeb887,
      skinCss: '#deb887',
      topColor: 0xf4f1de, // Off-white dress shirt
      tieColor: 0x9b2226,
      pantsColor: 0x4a4e69, // Charcoal slacks
      headwear: 'tarboosh', // Iconic red Tarboosh with black tassel
      footwear: 'shoes',
      shoeColor: 0x0f0e17,
      accessory: 'briefcase',
      scale: 1.02
    },
    // 5: Talib Gam3a - University student with hoodie, backpack & jeans
    {
      name: 'Student',
      gender: 'm',
      outfit: 'casual',
      faceType: 'clean',
      skinColor: 0xd79a6d,
      skinCss: '#d79a6d',
      topColor: 0x457b9d, // Cool blue hoodie
      pantsColor: 0x3a506b,
      headwear: 'hair_curly',
      footwear: 'sneakers',
      shoeColor: 0xdddddd,
      accessory: 'backpack',
      scale: 0.96
    },
    // 6: Sa'idi Baladi - Upper Egyptian man with grey striped Galabeya & wrapped turban
    {
      name: 'Amm Hassanein',
      gender: 'm',
      outfit: 'galabeya',
      faceType: 'beard',
      skinColor: 0xa86f45,
      skinCss: '#a86f45',
      robeColor: 0x7f7f7f, // Striped dark robe
      robeAccent: '#333333',
      headwear: 'emama', // Wrapped turban scarf
      footwear: 'slippers',
      shoeColor: 0x5a3825,
      scale: 1.04
    }
  ];

  class Character3D {
    constructor(archetypeIndex = 0, customOpts = {}) {
      const baseArch = ARCHETYPES[archetypeIndex % ARCHETYPES.length];
      this.cfg = Object.assign({}, baseArch, customOpts);

      this.group = new THREE.Group();
      this.walkTime = Math.random() * 10;
      this.waveTime = 0;
      this.isPassenger = !!this.cfg.isPassenger;
      this.isDriver = !!this.cfg.isDriver;

      this.buildModel();
    }

    buildModel() {
      const cfg = this.cfg;
      const skinMat = getMat(cfg.skinColor, 0.7);

      // Root human container
      this.root = new THREE.Group();
      this.group.add(this.root);

      // =======================================================================
      // 1. LEGS & LOWER BODY (Articulated at Hip Pivot for Natural Walking Gait)
      // =======================================================================
      const legRadius = 0.088;
      const legHeight = 0.68;
      const legX = 0.12;

      this.leftLeg = new THREE.Group();
      this.rightLeg = new THREE.Group();
      this.leftLeg.position.set(-legX, 0.72, 0);
      this.rightLeg.position.set(legX, 0.72, 0);
      this.root.add(this.leftLeg, this.rightLeg);

      let legMat = getMat(cfg.pantsColor || 0x223843, 0.8);
      if (cfg.outfit === 'galabeya' || cfg.outfit === 'abaya') {
        legMat = getMat(cfg.robeColor || 0xdddddd, 0.85);
      }

      // Left leg cylinder & shoe
      const leftLegMesh = new THREE.Mesh(getCyl(legRadius, legRadius * 0.9, legHeight, 8), legMat);
      leftLegMesh.position.y = -legHeight * 0.5;
      this.leftLeg.add(leftLegMesh);

      // Right leg cylinder & shoe
      const rightLegMesh = new THREE.Mesh(getCyl(legRadius, legRadius * 0.9, legHeight, 8), legMat);
      rightLegMesh.position.y = -legHeight * 0.5;
      this.rightLeg.add(rightLegMesh);

      // Egyptian Footwear (Slippers / Balgha / Oxford Shoes / Sneakers)
      const shoeMat = getMat(cfg.shoeColor || 0x2b1e17, 0.5);
      [this.leftLeg, this.rightLeg].forEach((leg) => {
        const shoe = new THREE.Mesh(getBox(0.12, 0.09, 0.22), shoeMat);
        shoe.position.set(0, -legHeight + 0.045, 0.04);
        leg.add(shoe);

        if (cfg.footwear === 'sneakers') {
          // White rubber sneaker sole
          const sole = new THREE.Mesh(getBox(0.125, 0.03, 0.23), getMat(0xffffff, 0.3));
          sole.position.set(0, -legHeight + 0.015, 0.04);
          leg.add(sole);
        }
      });

      // =======================================================================
      // 2. TORSO, ROBES, VESTS, BELT & DRESS DRAPES
      // =======================================================================
      this.torsoGroup = new THREE.Group();
      this.torsoGroup.position.set(0, 0.72, 0);
      this.root.add(this.torsoGroup);

      if (cfg.outfit === 'galabeya' || cfg.outfit === 'abaya') {
        // Authentic flowing Galabeya / Abaya Body
        let fabricMap = null;
        if (cfg.robeAccent) {
          fabricMap = getFabricTexture('stripes', `#${cfg.robeColor.toString(16).padStart(6, '0')}`, cfg.robeAccent);
        }
        const robeMat = fabricMap
          ? TTGfx.lit({ map: fabricMap, color: cfg.robeColor })
          : getMat(cfg.robeColor, 0.85);

        // Flared lower hem of the Galabeya covering thighs
        this.robeHem = new THREE.Mesh(getCyl(0.24, 0.32, 0.65, 10), robeMat);
        this.robeHem.position.y = 0.28;
        this.torsoGroup.add(this.robeHem);

        // Upper torso with authentic chest pocket & neckline slit
        const chestMesh = new THREE.Mesh(getCyl(0.25, 0.23, 0.52, 10), robeMat);
        chestMesh.position.y = 0.66;
        this.torsoGroup.add(chestMesh);

        // Collar band (ياقة الجلابية البلدية)
        const collar = new THREE.Mesh(getCyl(0.13, 0.13, 0.08, 10), getMat(cfg.robeColor, 0.7));
        collar.position.y = 0.94;
        this.torsoGroup.add(collar);

        // Chest pocket detail
        const pocket = new THREE.Mesh(getBox(0.08, 0.09, 0.02), getMat(0xd8d4c8, 0.9));
        pocket.position.set(-0.11, 0.7, 0.22);
        this.torsoGroup.add(pocket);

      } else {
        // Modern Cairo Shirt / Hoodie / Suit Torso
        const shirtMat = getMat(cfg.topColor || 0x0077b6, 0.75);

        // Torso / Chest box with realistic tapered chest
        const chestMesh = new THREE.Mesh(getBox(0.42, 0.46, 0.24), shirtMat);
        chestMesh.position.y = 0.65;
        this.torsoGroup.add(chestMesh);

        // Pelvis / Hips & Belt
        const pelvisMesh = new THREE.Mesh(getBox(0.38, 0.18, 0.22), legMat);
        pelvisMesh.position.y = 0.34;
        this.torsoGroup.add(pelvisMesh);

        // Belt with silver buckle
        const belt = new THREE.Mesh(getBox(0.39, 0.04, 0.23), getMat(0x1a1a1a, 0.4));
        belt.position.y = 0.41;
        const buckle = new THREE.Mesh(getBox(0.06, 0.05, 0.235), getMat(0xd4af37, 0.2));
        buckle.position.y = 0.41;
        this.torsoGroup.add(belt, buckle);

        // Vest for Qahwagi / Afandi
        if (cfg.vestColor) {
          const vestMat = getMat(cfg.vestColor, 0.8);
          [-0.12, 0.12].forEach((vx) => {
            const vestFlap = new THREE.Mesh(getBox(0.12, 0.44, 0.03), vestMat);
            vestFlap.position.set(vx, 0.65, 0.125);
            this.torsoGroup.add(vestFlap);
          });
          const vestBack = new THREE.Mesh(getBox(0.43, 0.44, 0.03), vestMat);
          vestBack.position.set(0, 0.65, -0.125);
          this.torsoGroup.add(vestBack);
        }

        // Waiter's White Apron (مريلة القهوجي البيضاء)
        if (cfg.apronColor) {
          const apronMat = getMat(cfg.apronColor, 0.9);
          const apron = new THREE.Mesh(getBox(0.32, 0.48, 0.02), apronMat);
          apron.position.set(0, 0.32, 0.125);
          this.torsoGroup.add(apron);
        }

        // Necktie for Afandi
        if (cfg.tieColor) {
          const tieMat = getMat(cfg.tieColor, 0.5);
          const tie = new THREE.Mesh(getBox(0.06, 0.32, 0.02), tieMat);
          tie.position.set(0, 0.68, 0.13);
          this.torsoGroup.add(tie);
        }
      }

      // =======================================================================
      // 3. ARMS & HANDS (Articulated at Shoulder for Swing & Beckoning Waves)
      // =======================================================================
      const armLength = 0.56;
      const armRadius = 0.065;
      const shoulderX = 0.25;
      const shoulderY = 0.85;

      this.leftArm = new THREE.Group();
      this.rightArm = new THREE.Group();
      this.leftArm.position.set(-shoulderX, shoulderY, 0);
      this.rightArm.position.set(shoulderX, shoulderY, 0);
      this.torsoGroup.add(this.leftArm, this.rightArm);

      // Arm Sleeve material
      let sleeveMat = getMat(cfg.robeColor || cfg.topColor || 0xffffff, 0.75);
      if (cfg.outfit === 'qahwagi') {
        // Rolled up sleeves - bare forearms
        sleeveMat = skinMat;
      }

      // Left Arm mesh & Hand
      const leftSleeve = new THREE.Mesh(getCyl(armRadius, armRadius * 0.85, armLength * 0.7, 8), sleeveMat);
      leftSleeve.position.y = -armLength * 0.35;
      const leftForearm = new THREE.Mesh(getCyl(armRadius * 0.85, armRadius * 0.75, armLength * 0.4, 8), skinMat);
      leftForearm.position.y = -armLength * 0.7;
      const leftHand = new THREE.Mesh(getBox(0.08, 0.11, 0.04), skinMat);
      leftHand.position.y = -armLength * 0.92;
      this.leftArm.add(leftSleeve, leftForearm, leftHand);

      // Right Arm mesh & Hand
      const rightSleeve = new THREE.Mesh(getCyl(armRadius, armRadius * 0.85, armLength * 0.7, 8), sleeveMat);
      rightSleeve.position.y = -armLength * 0.35;
      const rightForearm = new THREE.Mesh(getCyl(armRadius * 0.85, armRadius * 0.75, armLength * 0.4, 8), skinMat);
      rightForearm.position.y = -armLength * 0.7;
      const rightHand = new THREE.Mesh(getBox(0.08, 0.11, 0.04), skinMat);
      rightHand.position.y = -armLength * 0.92;
      this.rightArm.add(rightSleeve, rightForearm, rightHand);

      // =======================================================================
      // 4. NECK, HEAD & AUTHENTIC EGYPTIAN FACIAL FEATURES
      // =======================================================================
      this.headGroup = new THREE.Group();
      this.headGroup.position.set(0, 0.96, 0);
      this.torsoGroup.add(this.headGroup);

      // Neck
      const neck = new THREE.Mesh(getCyl(0.085, 0.095, 0.14, 8), skinMat);
      neck.position.y = 0.07;
      this.headGroup.add(neck);

      // Head Base Shape with defined jawline
      const headMesh = new THREE.Mesh(getSphere(0.18, 12, 10), skinMat);
      headMesh.position.y = 0.24;
      headMesh.scale.set(0.9, 1.1, 0.95);
      this.headGroup.add(headMesh);

      // High-resolution expressive Egyptian Face Decal (Eyes, Kohl, Mustache/Beard/Smile)
      const faceTex = getFaceTexture({
        gender: cfg.gender,
        type: cfg.faceType,
        skinCss: cfg.skinCss,
        sunglasses: cfg.sunglasses
      });
      const facePlane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.24, 0.24),
        TTGfx.lit({ map: faceTex, transparent: true })
      );
      facePlane.position.set(0, 0.24, 0.17);
      this.headGroup.add(facePlane);

      // Ears on both sides
      [-1, 1].forEach((dir) => {
        const ear = new THREE.Mesh(getSphere(0.045, 6, 6), skinMat);
        ear.scale.set(0.4, 0.9, 0.5);
        ear.position.set(dir * 0.17, 0.24, 0);
        this.headGroup.add(ear);
      });

      // =======================================================================
      // 5. TRADITIONAL EGYPTIAN HEADWEAR & HAIRSTYLES
      // =======================================================================
      if (cfg.headwear === 'tagia') {
        // Traditional Egyptian White Crochet Skullcap (طاقية شبك مطرزة)
        const tagiaTex = getFabricTexture('tagia', '#fcfcfc', '#cccccc');
        const tagiaMat = TTGfx.lit({ map: tagiaTex, color: 0xffffff });
        const tagia = new THREE.Mesh(getSphere(0.186, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), tagiaMat);
        tagia.position.set(0, 0.24, 0);
        tagia.scale.set(0.92, 1.12, 0.97);
        this.headGroup.add(tagia);

      } else if (cfg.headwear === 'tarboosh') {
        // Vintage Red Ottoman/Egyptian Tarboosh with Black Silk Tassel (طربوش الباشا)
        const fezMat = getMat(0xb7094c, 0.5);
        const fez = new THREE.Mesh(getCyl(0.13, 0.155, 0.18, 12), fezMat);
        fez.position.set(0, 0.38, 0);
        fez.rotation.x = -0.05;

        // Black hanging tassel (الشرابة الحرير)
        const tasselMat = getMat(0x111111, 0.2);
        const tasselCord = new THREE.Mesh(getCyl(0.01, 0.01, 0.12, 4), tasselMat);
        tasselCord.position.set(0.08, 0.42, -0.06);
        tasselCord.rotation.z = -0.6;
        const tasselTip = new THREE.Mesh(getCyl(0.03, 0.015, 0.08, 6), tasselMat);
        tasselTip.position.set(0.14, 0.35, -0.06);
        this.headGroup.add(fez, tasselCord, tasselTip);

      } else if (cfg.headwear === 'emama') {
        // Upper Egypt Sa'idi wrapped turban / scarf (شال صعيدي ملفوف)
        const emamaMat = getMat(0xf4f1de, 0.8);
        const emamaTorus = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.055, 8, 16), emamaMat);
        emamaTorus.rotation.x = Math.PI / 2;
        emamaTorus.position.set(0, 0.32, 0);

        // Hanging tail behind neck
        const tail = new THREE.Mesh(getBox(0.09, 0.32, 0.03), emamaMat);
        tail.position.set(0, 0.18, -0.16);
        this.headGroup.add(emamaTorus, tail);

      } else if (cfg.headwear === 'tarha') {
        // Egyptian Tarha / Hijab draped gracefully around head and shoulders (طرحة حشمة)
        const tarhaMat = getMat(cfg.tarhaColor || 0x2a9d8f, 0.7);
        const hood = new THREE.Mesh(getSphere(0.198, 12, 10), tarhaMat);
        hood.position.set(0, 0.24, -0.02);
        hood.scale.set(0.95, 1.15, 1.05);

        // Fabric draped around chest and neck
        const drape = new THREE.Mesh(getCyl(0.24, 0.28, 0.28, 10), tarhaMat);
        drape.position.set(0, 0.05, 0);
        this.headGroup.add(hood, drape);

      } else if (cfg.headwear === 'driver_cap') {
        // Casual Street Driver Newsboy / Flat Cap
        const capMat = getMat(0x2b2d42, 0.6);
        const crown = new THREE.Mesh(getCyl(0.18, 0.19, 0.09, 12), capMat);
        crown.position.set(0, 0.35, 0);
        const visor = new THREE.Mesh(getBox(0.2, 0.02, 0.14), capMat);
        visor.position.set(0, 0.32, 0.18);
        visor.rotation.x = 0.22;
        this.headGroup.add(crown, visor);

      } else {
        // Modern styled dark hair for youth
        const hairMat = getMat(0x191410, 0.9);
        const hair = new THREE.Mesh(getSphere(0.185, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat);
        hair.position.set(0, 0.25, -0.02);
        hair.scale.set(0.92, 1.12, 0.98);
        this.headGroup.add(hair);
      }

      // =======================================================================
      // 6. CULTURAL ACCESSORIES (Ahwa Tea Tray, Shopping Tote, Briefcase)
      // =======================================================================
      if (cfg.accessory === 'tea_tray') {
        // Traditional Ahwa Tea Tray ("صينية الشاي في الخمسينة")
        const brassMat = getMat(0xd4af37, 0.3);
        const glassMat = new THREE.MeshBasicMaterial({ color: 0x90e0ef, transparent: true, opacity: 0.65 });
        const teaMat = getMat(0x9b2226, 0.4);

        const tray = new THREE.Mesh(getCyl(0.18, 0.18, 0.02, 12), brassMat);
        tray.position.set(0, -armLength * 0.92, 0.2);

        // Traditional small tea glass with brewed Egyptian tea
        const glass = new THREE.Mesh(getCyl(0.035, 0.028, 0.08, 8), glassMat);
        glass.position.set(0.04, -armLength * 0.88, 0.2);
        const tea = new THREE.Mesh(getCyl(0.032, 0.026, 0.06, 8), teaMat);
        tea.position.set(0.04, -armLength * 0.89, 0.2);

        this.rightArm.add(tray, glass, tea);
        // Angle right forearm forward to balance the tray
        this.rightArm.rotation.x = -Math.PI / 3;

      } else if (cfg.accessory === 'shopping_bag') {
        // Striped Egyptian Market Shopping Bag
        const bagMat = getMat(0xe76f51, 0.8);
        const bag = new THREE.Mesh(getBox(0.24, 0.32, 0.14), bagMat);
        bag.position.set(0, -armLength * 1.15, 0.06);
        this.leftArm.add(bag);

      } else if (cfg.accessory === 'briefcase') {
        // Classic leather briefcase for El-Afandi
        const briefMat = getMat(0x542611, 0.5);
        const briefcase = new THREE.Mesh(getBox(0.08, 0.26, 0.34), briefMat);
        briefcase.position.set(0, -armLength * 1.05, 0.08);
        this.rightArm.add(briefcase);

      } else if (cfg.accessory === 'backpack') {
        // University Student Backpack
        const packMat = getMat(0x264653, 0.8);
        const pack = new THREE.Mesh(getBox(0.32, 0.38, 0.16), packMat);
        pack.position.set(0, 0.65, -0.2);
        this.torsoGroup.add(pack);
      }

      // Overall scale
      if (cfg.scale) {
        this.root.scale.set(cfg.scale, cfg.scale, cfg.scale);
      }
    }

    // =========================================================================
    // ANIMATION: NATURAL HUMAN WALKING GAIT
    // =========================================================================
    updateWalk(time, speed = 1.6) {
      this.walkTime = time;
      const freq = speed * 4.2;
      const legAmp = 0.52;
      const armAmp = 0.44;

      const cycle = Math.sin(this.walkTime * freq);
      const cosCycle = Math.cos(this.walkTime * freq);

      // 1. Natural hip & leg swing with knee follow-through
      this.leftLeg.rotation.x = cycle * legAmp;
      this.rightLeg.rotation.x = -cycle * legAmp;

      // 2. Counter-phase arm swing
      if (this.cfg.accessory !== 'tea_tray') {
        this.rightArm.rotation.x = cycle * armAmp;
      }
      this.leftArm.rotation.x = -cycle * armAmp;

      // 3. Smooth vertical pelvic bounce (double frequency: two steps per cycle)
      this.torsoGroup.position.y = 0.72 + Math.abs(cycle) * 0.035;

      // 4. Subtle torso twist & shoulder counter-rotation
      this.torsoGroup.rotation.y = -cycle * 0.09;
      this.torsoGroup.rotation.z = cosCycle * 0.025;

      // 5. Head stabilizes with a touch of lifelike head bob
      this.headGroup.rotation.y = cycle * 0.04;
      this.headGroup.rotation.x = -Math.abs(cycle) * 0.03;
    }

    // =========================================================================
    // ANIMATION: PASSENGER HAILING ("يا أسطى! توكتوك!")
    // =========================================================================
    updateWave(time) {
      this.waveTime = time;
      // Right arm raised high waving excitedly
      this.rightArm.rotation.x = -Math.PI * 0.88;
      this.rightArm.rotation.z = -0.35 + Math.sin(this.waveTime * 5.5) * 0.32;
      this.rightArm.rotation.y = Math.cos(this.waveTime * 5.5) * 0.2;

      // Body leaning forward towards incoming traffic
      this.torsoGroup.rotation.x = 0.08;
      this.torsoGroup.rotation.y = 0.15;
      this.headGroup.rotation.y = -0.22 + Math.sin(this.waveTime * 2) * 0.12;

      // Left arm resting naturally or on hip
      this.leftArm.rotation.x = 0.12;
      this.leftArm.rotation.z = -0.15;
    }

    // =========================================================================
    // ANIMATION: COMEDIC FLAIL WHEN KNOCKED
    // =========================================================================
    updateFlail(timer) {
      const flail = Math.sin(timer * 22);
      this.leftArm.rotation.x = -Math.PI * 0.7 + flail * 0.8;
      this.rightArm.rotation.x = -Math.PI * 0.7 - flail * 0.8;
      this.leftLeg.rotation.x = flail * 0.6;
      this.rightLeg.rotation.x = -flail * 0.6;
      this.headGroup.rotation.x = flail * 0.3;
    }
  }

  // ===========================================================================
  // DRIVER "الأسطى" (Realistic seated Tuk-Tuk driver holding the handlebars)
  // ===========================================================================
  function createDriver(customOpts = {}) {
    const dGroup = new THREE.Group();

    const skinColor = customOpts.skinColor || 0xd2976c;
    const skinMat = getMat(skinColor, 0.7);

    // Seated driver root
    const root = new THREE.Group();
    dGroup.add(root);

    // Pelvis / Saddle seat base
    const pantsMat = getMat(0x223843, 0.8);
    const pelvis = new THREE.Mesh(getBox(0.42, 0.2, 0.34), pantsMat);
    pelvis.position.set(0, 0.78, 0.44);
    root.add(pelvis);

    // Thighs reaching forward toward front floorboard
    [-0.14, 0.14].forEach((tx) => {
      const thigh = new THREE.Mesh(getCyl(0.09, 0.08, 0.46, 8), pantsMat);
      thigh.rotation.x = Math.PI / 2 - 0.25;
      thigh.position.set(tx, 0.72, 0.64);

      // Shins bent down to pedals
      const shin = new THREE.Mesh(getCyl(0.08, 0.075, 0.42, 8), pantsMat);
      shin.position.set(tx, 0.46, 0.86);

      // Shoes on footboard
      const shoe = new THREE.Mesh(getBox(0.12, 0.08, 0.2), getMat(0x1a1a1a, 0.5));
      shoe.position.set(tx, 0.26, 0.92);

      root.add(thigh, shin, shoe);
    });

    // Torso - Leaning forward with confident Egyptian driver swagger
    const torsoPivot = new THREE.Group();
    torsoPivot.position.set(0, 0.86, 0.42);
    root.add(torsoPivot);

    const shirtMat = getMat(customOpts.shirtColor || 0x0096c7, 0.7);
    const chest = new THREE.Mesh(getBox(0.44, 0.48, 0.26), shirtMat);
    chest.position.set(0, 0.24, 0);
    torsoPivot.add(chest);

    // Iconic Shaabi Driver Embroidered Vest ("سديري الأسطى")
    const vestMat = getMat(0x1b263b, 0.75);
    [-0.14, 0.14].forEach((vx) => {
      const vestFlap = new THREE.Mesh(getBox(0.13, 0.46, 0.03), vestMat);
      vestFlap.position.set(vx, 0.24, 0.135);
      torsoPivot.add(vestFlap);
    });
    const vestBack = new THREE.Mesh(getBox(0.45, 0.46, 0.03), vestMat);
    vestBack.position.set(0, 0.24, -0.135);
    torsoPivot.add(vestBack);

    // Shoulders & Arms reaching directly forward to grip the motorcycle handlebars!
    const armMat = shirtMat;
    const armRadius = 0.065;

    const leftArmPivot = new THREE.Group();
    const rightArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.25, 0.42, 0);
    rightArmPivot.position.set(0.25, 0.42, 0);
    torsoPivot.add(leftArmPivot, rightArmPivot);

    // Left Arm reaching to left handlebar grip (-0.35, 1.28, 0.86)
    const leftArm = new THREE.Mesh(getCyl(armRadius, armRadius * 0.8, 0.52, 8), armMat);
    leftArm.rotation.x = -Math.PI / 2 + 0.35;
    leftArm.rotation.y = -0.22;
    leftArm.position.set(-0.06, -0.06, 0.22);

    const leftHand = new THREE.Mesh(getBox(0.08, 0.07, 0.1), skinMat);
    leftHand.position.set(-0.14, -0.14, 0.44);
    leftArmPivot.add(leftArm, leftHand);

    // Right Arm reaching to right handlebar grip (0.35, 1.28, 0.86)
    const rightArm = new THREE.Mesh(getCyl(armRadius, armRadius * 0.8, 0.52, 8), armMat);
    rightArm.rotation.x = -Math.PI / 2 + 0.35;
    rightArm.rotation.y = 0.22;
    rightArm.position.set(0.06, -0.06, 0.22);

    const rightHand = new THREE.Mesh(getBox(0.08, 0.07, 0.1), skinMat);
    rightHand.position.set(0.14, -0.14, 0.44);
    rightArmPivot.add(rightArm, rightHand);

    // Blue Egyptian Evil Eye beads / watch on wrist ("خرزة زرقا وساعة يد")
    const watch = new THREE.Mesh(getCyl(0.06, 0.06, 0.03, 8), getMat(0xd4af37, 0.2));
    watch.position.set(-0.14, -0.14, 0.38);
    leftArmPivot.add(watch);

    // Neck & Head
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.52, 0.02);
    torsoPivot.add(headPivot);

    const neck = new THREE.Mesh(getCyl(0.085, 0.095, 0.12, 8), skinMat);
    neck.position.y = 0.05;
    headPivot.add(neck);

    const headMesh = new THREE.Mesh(getSphere(0.18, 12, 10), skinMat);
    headMesh.position.y = 0.22;
    headMesh.scale.set(0.9, 1.1, 0.95);
    headPivot.add(headMesh);

    // Expressive Egyptian Driver Face with signature big mustache & aviator shades
    const faceTex = getFaceTexture({
      gender: 'm',
      type: 'driver',
      skinCss: '#d2976c',
      sunglasses: true // Aviator shades!
    });
    const facePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.24),
      TTGfx.lit({ map: faceTex, transparent: true })
    );
    facePlane.position.set(0, 0.22, 0.17);
    headPivot.add(facePlane);

    // Ears
    [-1, 1].forEach((dir) => {
      const ear = new THREE.Mesh(getSphere(0.045, 6, 6), skinMat);
      ear.scale.set(0.4, 0.9, 0.5);
      ear.position.set(dir * 0.17, 0.22, 0);
      headPivot.add(ear);
    });

    // Egyptian Embroidered Driver Tagia / Cap
    const tagiaTex = getFabricTexture('tagia', '#ffffff', '#cccccc');
    const tagiaMat = TTGfx.lit({ map: tagiaTex, color: 0xffffff });
    const tagia = new THREE.Mesh(getSphere(0.185, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), tagiaMat);
    tagia.position.set(0, 0.23, 0);
    tagia.scale.set(0.92, 1.12, 0.97);
    headPivot.add(tagia);

    // Steering & dynamic reaction hook
    dGroup.userData = {
      torso: torsoPivot,
      head: headPivot,
      leftArm: leftArmPivot,
      rightArm: rightArmPivot,
      updateDriver(steerAngle, speed, roll, accelPitch) {
        // Driver looks into the turn
        headPivot.rotation.y = steerAngle * 0.45;
        // Torso leans into turns and high-G drifts
        torsoPivot.rotation.z = -roll * 0.75;
        // Leans back on nitro acceleration, forward on hard brakes
        torsoPivot.rotation.x = 0.12 - accelPitch * 0.5;
        // Arms adjust with handlebar rotation
        leftArmPivot.rotation.z = steerAngle * 0.25;
        rightArmPivot.rotation.z = steerAngle * 0.25;
      }
    };

    return dGroup;
  }

  // Global namespace
  window.EgyptianPeople = {
    ARCHETYPES,
    Character3D,
    createPedestrian(archetypeIndex, opts) {
      return new Character3D(archetypeIndex, opts);
    },
    createPassenger(colorHex, archetypeIndex = 0) {
      const char = new Character3D(archetypeIndex, { isPassenger: true });
      const g = new THREE.Group();

      // Beacon beam cylinder
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.6, 32, 16, 1, true),
        new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.42,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      beam.position.y = 16;

      // Pulsing sidewalk ring
      const ringGeo = new THREE.RingGeometry(2.0, 2.7, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide }));
      ring.position.y = 0.45;

      g.add(beam, ring, char.group);

      // Beckoning arm animation
      g.userData = {
        char: char,
        ring: ring,
        beam: beam,
        update(time) {
          char.updateWave(time);
        }
      };

      return g;
    },
    createDriver: createDriver
  };
})();
