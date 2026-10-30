// world.js - Realistic 3D Cairo Shaabi Architecture & Neighborhood Builder

class CairoWorld {
  constructor(scene) {
    this.scene = scene;
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);

    this.roadWidth = 17;
    this.curve = null;
    this.trackPoints = [];
    this.trackLength = 0;

    this.laundryLines = [];
    this.ramadanGroup = new THREE.Group();
    this.worldGroup.add(this.ramadanGroup);

    this.potholes = [];
    this.ramps = [];
    this.buildings = [];

    this.ambientLight = null;
    this.dirLight = null;
    this.hemiLight = null;

    // Generate rich procedural textures for ALL 4 sides of Cairo buildings & roads
    this.facadeMaterials = this.createBuildingMaterials();
    this.asphaltTexture = this.createAsphaltTexture();
    this.sidewalkTexture = this.createSidewalkTexture();

    this.initLights();
    this.buildTrack();
    this.buildNeighborhood();
    this.buildCairoSkyline();
    this.setEnvironment('ramadan');
  }

  initLights() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.72);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xffeeb1, 0x2b253a, 0.65);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff2dd, 1.05);
    this.dirLight.position.set(90, 160, 75);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.scene.add(this.dirLight);
  }

  setEnvironment(mode) {
    this.currentEnv = mode;
    if (mode === 'day') {
      this.scene.background = new THREE.Color(0x68b5ff);
      this.scene.fog = new THREE.FogExp2(0x9ed0ff, 0.0014);
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 0.85;
      this.dirLight.color.setHex(0xfff6e0);
      this.dirLight.intensity = 1.15;
      this.ramadanGroup.visible = true;
    } else if (mode === 'sunset') {
      this.scene.background = new THREE.Color(0xf76b45);
      this.scene.fog = new THREE.FogExp2(0xd15852, 0.0018);
      this.ambientLight.color.setHex(0xffb480);
      this.ambientLight.intensity = 0.75;
      this.dirLight.color.setHex(0xff7733);
      this.dirLight.intensity = 1.05;
      this.ramadanGroup.visible = true;
    } else if (mode === 'night') {
      this.scene.background = new THREE.Color(0x0b081a);
      this.scene.fog = new THREE.FogExp2(0x110b29, 0.0022);
      this.ambientLight.color.setHex(0x6359ad);
      this.ambientLight.intensity = 0.65;
      this.dirLight.color.setHex(0x88aaff);
      this.dirLight.intensity = 0.58;
      this.ramadanGroup.visible = false;
    } else {
      this.scene.background = new THREE.Color(0x150c2a);
      this.scene.fog = new THREE.FogExp2(0x1d1138, 0.0018);
      this.ambientLight.color.setHex(0xffc988);
      this.ambientLight.intensity = 0.8;
      this.dirLight.color.setHex(0xffd166);
      this.dirLight.intensity = 0.82;
      this.ramadanGroup.visible = true;
    }
  }

  createAsphaltTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#2b2933';
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
    }

    // Subtle worn lane marks
    ctx.fillStyle = 'rgba(255, 190, 11, 0.35)';
    ctx.fillRect(124, 20, 8, 90);
    ctx.fillRect(124, 150, 8, 80);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  createSidewalkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#78717e';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = '#534d59';
    ctx.lineWidth = 3;
    for (let x = 0; x <= 256; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
    for (let y = 0; y <= 256; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 60);
    tex.needsUpdate = true;
    return tex;
  }

  // Create rich architectural wall textures (with brick mortar, concrete slabs, windows & shutters)
  // Applied to ALL sides of the building so no wall ever looks flat!
  createBuildingMaterials() {
    const palettes = [
      { name: 'redBrick', bg: '#8f3424', brick: true, concrete: '#b5afa6', shutter: '#1b4332', sill: '#ded8ce' },
      { name: 'cairoOchre', bg: '#cf9263', brick: false, concrete: '#e3d5ca', shutter: '#2d6a4f', sill: '#f5ebe0' },
      { name: 'imbabaBrick', bg: '#7d2e22', brick: true, concrete: '#a8a29e', shutter: '#582f0e', sill: '#d6d3d1' },
      { name: 'shubraBlue', bg: '#6c8ea4', brick: false, concrete: '#d8e2dc', shutter: '#1d3557', sill: '#ffffff' },
      { name: 'sayedaSand', bg: '#b87d65', brick: false, concrete: '#d5bdaf', shutter: '#386641', sill: '#edede9' },
      { name: 'warmTerracotta', bg: '#a44a3f', brick: true, concrete: '#bab3a9', shutter: '#22333b', sill: '#eae0d5' }
    ];

    return palettes.map((pal) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      // Base wall color
      ctx.fillStyle = pal.bg;
      ctx.fillRect(0, 0, 512, 512);

      if (pal.brick) {
        // Detailed Egyptian Red-Brick coursing + mortar grid
        for (let y = 0; y < 512; y += 12) {
          ctx.fillStyle = 'rgba(35, 12, 8, 0.42)';
          ctx.fillRect(0, y, 512, 2);
          const rowOffset = (y / 12) % 2 === 0 ? 0 : 14;
          for (let x = rowOffset; x < 512; x += 28) {
            ctx.fillStyle = 'rgba(35, 12, 8, 0.35)';
            ctx.fillRect(x, y, 2, 12);
            ctx.fillStyle = (x + y) % 5 === 0 ? 'rgba(255, 160, 120, 0.08)' : 'rgba(0, 0, 0, 0.08)';
            ctx.fillRect(x + 2, y + 2, 24, 8);
          }
        }
      } else {
        // Weathered Cairo stucco/plaster texture with horizontal score lines
        for (let i = 0; i < 1200; i++) {
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.055)';
          ctx.fillRect(Math.random() * 512, Math.random() * 512, 10, 5);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let y = 0; y < 512; y += 20) {
          ctx.fillRect(0, y, 512, 2);
        }
      }

      // Vertical Concrete Columns on Left, Center, Right ("عمدان خرسانة")
      ctx.fillStyle = pal.concrete;
      ctx.fillRect(0, 0, 26, 512);
      ctx.fillRect(243, 0, 26, 512);
      ctx.fillRect(486, 0, 26, 512);

      // Draw 4 Floor Levels with Concrete Beams & Detailed Windows
      for (let f = 0; f < 4; f++) {
        const floorTop = f * 128;
        // Horizontal concrete slab beam
        ctx.fillStyle = pal.concrete;
        ctx.fillRect(0, floorTop, 512, 16);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(0, floorTop + 16, 512, 4);

        // 2 Pairs of Apartment Windows per floor
        [72, 312].forEach((wx, wIdx) => {
          const wy = floorTop + 34;
          const ww = 92;
          const wh = 72;

          // Window stone sill & lintel
          ctx.fillStyle = pal.sill;
          ctx.fillRect(wx - 6, wy - 6, ww + 12, wh + 14);

          // Window recess shadow
          ctx.fillStyle = '#10141d';
          ctx.fillRect(wx, wy, ww, wh);

          // Lit warm Egyptian apartment window or dark glass with curtains
          const isLit = (f + wIdx) % 2 === 0;
          ctx.fillStyle = isLit ? '#ffd166' : '#1d2d44';
          ctx.fillRect(wx + 4, wy + 4, ww - 8, wh - 8);

          // Window muntin bars
          ctx.fillStyle = pal.sill;
          ctx.fillRect(wx + ww / 2 - 2, wy, 4, wh);
          ctx.fillRect(wx, wy + wh / 2 - 2, ww, 4);

          // Louvered Wooden Shutters (ضلف الشيش الخشب) on both sides of the window
          ctx.fillStyle = pal.shutter;
          ctx.fillRect(wx - 22, wy, 20, wh);
          ctx.fillRect(wx + ww + 2, wy, 20, wh);

          // Horizontal slats on the shutters
          ctx.fillStyle = 'rgba(0,0,0,0.38)';
          for (let sy = wy + 4; sy < wy + wh - 4; sy += 6) {
            ctx.fillRect(wx - 20, sy, 16, 2);
            ctx.fillRect(wx + ww + 4, sy, 16, 2);
          }
        });
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return {
        wallMat: new THREE.MeshLambertMaterial({ map: tex }),
        concreteMat: new THREE.MeshLambertMaterial({ color: pal.concrete }),
        shutterMat: new THREE.MeshLambertMaterial({ color: pal.shutter })
      };
    });
  }

  createArabicSignTexture(text, bgColor, textColor, subText = '') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#ffbe0b';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    ctx.fillStyle = textColor;
    ctx.font = '900 46px Cairo, Tajawal, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, subText ? 62 : 80);

    if (subText) {
      ctx.fillStyle = '#ffbe0b';
      ctx.font = '700 26px Cairo, Tajawal, sans-serif';
      ctx.fillText(subText, canvas.width / 2, 120);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  buildTrack() {
    const controlPoints = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -130),
      new THREE.Vector3(55, 0, -240),
      new THREE.Vector3(165, 0, -255),
      new THREE.Vector3(245, 0, -175),
      new THREE.Vector3(235, 0, -55),
      new THREE.Vector3(165, 0, 35),
      new THREE.Vector3(195, 0, 145),
      new THREE.Vector3(110, 0, 215),
      new THREE.Vector3(15, 0, 145)
    ];

    this.curve = new THREE.CatmullRomCurve3(controlPoints, true, 'catmullrom', 0.5);
    this.trackLength = this.curve.getLength();
    const divisions = 320;
    this.trackPoints = this.curve.getSpacedPoints(divisions);

    const groundGeo = new THREE.PlaneGeometry(1800, 1800);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x352f3d });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    this.worldGroup.add(ground);

    const roadPositions = [];
    const roadUVs = [];
    const roadIndices = [];
    const curbLeftPositions = [];
    const curbRightPositions = [];
    const curbColors = [];
    const curbIndices = [];
    const walkLeftPositions = [];
    const walkRightPositions = [];
    const walkUVs = [];

    const halfW = this.roadWidth * 0.5;
    const curbW = 1.25;
    const walkW = 20.0;

    for (let i = 0; i <= divisions; i++) {
      const t = i / divisions;
      const pt = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      const leftPt = pt.clone().addScaledVector(normal, halfW);
      const rightPt = pt.clone().addScaledVector(normal, -halfW);

      roadPositions.push(leftPt.x, 0.02, leftPt.z, rightPt.x, 0.02, rightPt.z);
      roadUVs.push(0, t * 75, 1, t * 75);

      const leftOuter = pt.clone().addScaledVector(normal, halfW + curbW);
      const rightOuter = pt.clone().addScaledVector(normal, -(halfW + curbW));
      curbLeftPositions.push(leftOuter.x, 0.25, leftOuter.z, leftPt.x, 0.25, leftPt.z);
      curbRightPositions.push(rightPt.x, 0.25, rightPt.z, rightOuter.x, 0.25, rightOuter.z);

      const leftWalk = pt.clone().addScaledVector(normal, halfW + curbW + walkW);
      const rightWalk = pt.clone().addScaledVector(normal, -(halfW + curbW + walkW));
      walkLeftPositions.push(leftWalk.x, 0.2, leftWalk.z, leftOuter.x, 0.2, leftOuter.z);
      walkRightPositions.push(rightOuter.x, 0.2, rightOuter.z, rightWalk.x, 0.2, rightWalk.z);
      walkUVs.push(0, t * 80, 1, t * 80);

      const stripe = i % 2 === 0 ? [0.95, 0.95, 0.95] : (i % 4 === 1 ? [0.1, 0.1, 0.1] : [0.88, 0.12, 0.18]);
      curbColors.push(...stripe, ...stripe);

      if (i < divisions) {
        const idx = i * 2;
        roadIndices.push(idx, idx + 1, idx + 2, idx + 1, idx + 3, idx + 2);
        curbIndices.push(idx, idx + 1, idx + 2, idx + 1, idx + 3, idx + 2);
      }
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUVs, 2));
    roadGeo.setIndex(roadIndices);
    roadGeo.computeVertexNormals();
    this.worldGroup.add(new THREE.Mesh(roadGeo, new THREE.MeshLambertMaterial({ map: this.asphaltTexture })));

    const makeCurb = (positions) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(curbColors, 3));
      geo.setIndex(curbIndices);
      geo.computeVertexNormals();
      return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    };
    this.worldGroup.add(makeCurb(curbLeftPositions));
    this.worldGroup.add(makeCurb(curbRightPositions));

    const makeWalk = (positions) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(walkUVs, 2));
      geo.setIndex(curbIndices);
      geo.computeVertexNormals();
      return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: this.sidewalkTexture }));
    };
    this.worldGroup.add(makeWalk(walkLeftPositions));
    this.worldGroup.add(makeWalk(walkRightPositions));

    this.buildStartBanner();
  }

  buildStartBanner() {
    const pt = this.curve.getPointAt(0);
    const tangent = this.curve.getTangentAt(0).normalize();
    const angle = Math.atan2(tangent.x, tangent.z);

    const archGroup = new THREE.Group();
    archGroup.position.copy(pt);
    archGroup.rotation.y = angle;

    const poleGeo = new THREE.CylinderGeometry(0.45, 0.55, 11, 10);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0xffbe0b });
    const leftPole = new THREE.Mesh(poleGeo, poleMat);
    leftPole.position.set(-this.roadWidth * 0.55, 5.5, 0);
    const rightPole = new THREE.Mesh(poleGeo, poleMat);
    rightPole.position.set(this.roadWidth * 0.55, 5.5, 0);
    archGroup.add(leftPole, rightPole);

    const signTex = this.createArabicSignTexture(
      '🏁 حارة التوكتوك الباشا 🏁',
      '#e6192e',
      '#ffffff',
      'أجدع سواقين في بر مصر'
    );
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(this.roadWidth * 1.15, 3.2, 0.6),
      new THREE.MeshBasicMaterial({ map: signTex })
    );
    banner.position.set(0, 9.6, 0);
    archGroup.add(banner);

    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(this.roadWidth, 2.2),
      new THREE.MeshBasicMaterial({ color: 0xffbe0b, side: THREE.DoubleSide })
    );
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.05;
    archGroup.add(line);

    this.worldGroup.add(archGroup);
  }

  // Construct a detailed 3D Multi-Story Egyptian Residential & Commercial Building
  createDetailedEgyptianBuilding(width, depth, floors, styleIndex, shopInfo) {
    const bGroup = new THREE.Group();
    const floorH = 4.0;
    const groundH = 4.4;
    const totalH = groundH + (floors - 1) * floorH;

    const style = this.facadeMaterials[styleIndex % this.facadeMaterials.length];
    const wallMat = style.wallMat;
    const concreteMat = style.concreteMat;
    const shutterMat = style.shutterMat;

    const windowLitMat = new THREE.MeshBasicMaterial({ color: 0xffe194 });
    const windowDarkMat = new THREE.MeshLambertMaterial({ color: 0x1b263b });
    const ironRailMat = new THREE.MeshLambertMaterial({ color: 0x1f2421 });

    // 1. Main Building Core with Textured Brick/Plaster & Windows on ALL 4 SIDES!
    const core = new THREE.Mesh(new THREE.BoxGeometry(width, totalH, depth), wallMat);
    core.position.y = totalH * 0.5;
    bGroup.add(core);

    // 2. 3D Protruding Structural Concrete Corner Pillars ("أعمدة الخرسانة البارزة")
    [-width * 0.5, width * 0.5].forEach((cx) => {
      [-depth * 0.5, depth * 0.5].forEach((cz) => {
        const col = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, totalH + 1.9, 0.55),
          concreteMat
        );
        col.position.set(cx, (totalH + 1.9) * 0.5, cz);
        bGroup.add(col);
      });
    });

    // 3. Ground Floor Commercial Shopfront ("الدور الأرضي: المحلات والفترينة والتندة")
    const shopFrame = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.92, groundH - 0.3, 0.45),
      new THREE.MeshLambertMaterial({ color: 0x22223b })
    );
    shopFrame.position.set(0, (groundH - 0.3) * 0.5, depth * 0.5 + 0.18);
    bGroup.add(shopFrame);

    // Two Shop Bays (Lit display window + Corrugated steel roller door)
    [-width * 0.23, width * 0.23].forEach((sx, idx) => {
      const bay = new THREE.Mesh(
        new THREE.PlaneGeometry(width * 0.38, groundH - 1.2),
        idx === 0
          ? new THREE.MeshBasicMaterial({ color: 0xfff3b0 })
          : new THREE.MeshLambertMaterial({ color: 0x4a4e69 })
      );
      bay.position.set(sx, (groundH - 0.9) * 0.5, depth * 0.5 + 0.42);
      bGroup.add(bay);
    });

    // Slanted Shop Awning Canopy ("تندة المحل")
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.95, 0.22, 1.6),
      new THREE.MeshLambertMaterial({ color: styleIndex % 2 === 0 ? 0xe6192e : 0x2ec4b6 })
    );
    awning.position.set(0, groundH - 0.75, depth * 0.5 + 0.85);
    awning.rotation.x = 0.28;
    bGroup.add(awning);

    // Illuminated 3D Arabic Shop Billboard
    const signTex = this.createArabicSignTexture(shopInfo.title, shopInfo.bg, shopInfo.fg, shopInfo.sub);
    const signMesh = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.96, 1.65, 0.48),
      new THREE.MeshBasicMaterial({ map: signTex })
    );
    signMesh.position.set(0, groundH + 0.25, depth * 0.5 + 0.42);
    bGroup.add(signMesh);

    // 4. Upper Floors: 3D Protruding Floor Ledges, 3D Balconies, 3D Shutters & AC Units
    for (let f = 1; f < floors; f++) {
      const floorBaseY = groundH + (f - 1) * floorH;

      // Wrap-around 3D concrete floor slab ledge
      const floorLedge = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.65, 0.35, depth + 0.65),
        concreteMat
      );
      floorLedge.position.set(0, floorBaseY, 0);
      bGroup.add(floorLedge);

      // 3D Window Frames + Angled Wooden Shutters ("شبابيك بشيش خشب بارز")
      [-width * 0.27, width * 0.27].forEach((bx, bayIdx) => {
        const winY = floorBaseY + 2.1;

        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.9, 0.28), concreteMat);
        frame.position.set(bx, winY, depth * 0.5 + 0.12);
        const glass = new THREE.Mesh(
          new THREE.PlaneGeometry(1.32, 1.58),
          (f + bayIdx + styleIndex) % 2 === 0 ? windowLitMat : windowDarkMat
        );
        glass.position.set(bx, winY, depth * 0.5 + 0.27);
        bGroup.add(frame, glass);

        // 3D Wooden Shutters sticking out at realistic angles
        [-0.76, 0.76].forEach((shSide) => {
          const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.78, 0.1), shutterMat);
          shutter.position.set(bx + shSide, winY, depth * 0.5 + 0.34);
          shutter.rotation.y = shSide < 0 ? 0.38 : -0.38;
          bGroup.add(shutter);
        });
      });

      // Deep 3D Protruding Egyptian Balcony ("بلكونة بارزة")
      const balWidth = width * 0.48;
      const balDepth = 1.75;
      const balX = (f % 2 === 0 ? -1 : 1) * (width * 0.2);

      const balSlab = new THREE.Mesh(new THREE.BoxGeometry(balWidth, 0.28, balDepth), concreteMat);
      balSlab.position.set(balX, floorBaseY + 0.14, depth * 0.5 + balDepth * 0.5);
      bGroup.add(balSlab);

      const balFrontWall = new THREE.Mesh(
        new THREE.BoxGeometry(balWidth, 0.82, 0.18),
        new THREE.MeshLambertMaterial({ color: (f + styleIndex) % 2 === 0 ? 0xe09f3e : 0x2ec4b6 })
      );
      balFrontWall.position.set(balX, floorBaseY + 0.64, depth * 0.5 + balDepth - 0.09);

      const balRail = new THREE.Mesh(new THREE.BoxGeometry(balWidth + 0.08, 0.26, 0.14), ironRailMat);
      balRail.position.set(balX, floorBaseY + 1.18, depth * 0.5 + balDepth - 0.09);
      bGroup.add(balFrontWall, balRail);

      // Balcony Left & Right Side Walls
      [-balWidth * 0.5 + 0.09, balWidth * 0.5 - 0.09].forEach((sx) => {
        const sideW = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.05, balDepth), concreteMat);
        sideW.position.set(balX + sx, floorBaseY + 0.66, depth * 0.5 + balDepth * 0.5);
        bGroup.add(sideW);
      });

      // Egyptian Rug / Blanket draped over the balcony railing ("سجادة أو بطانية على البلكونة")
      const rug = new THREE.Mesh(
        new THREE.BoxGeometry(balWidth * 0.42, 0.65, 0.24),
        new THREE.MeshLambertMaterial({ color: f % 2 === 0 ? 0xe6192e : 0xffbe0b })
      );
      rug.position.set(balX, floorBaseY + 0.95, depth * 0.5 + balDepth);
      bGroup.add(rug);

      // 3D Split AC Compressor Unit on wall beside balcony ("تكييف خارجي")
      const acX = -balX * 1.15;
      const acBox = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.68, 0.52),
        new THREE.MeshLambertMaterial({ color: 0xedf2f4 })
      );
      acBox.position.set(acX, floorBaseY + 2.9, depth * 0.5 + 0.28);
      bGroup.add(acBox);
    }

    // 5. Rooftop Parapet, Water Tank, Satellite Dish & Wooden Pigeon Tower ("غية حمام على السطح")
    const roofCornice = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.8, 0.85, depth + 0.8),
      concreteMat
    );
    roofCornice.position.set(0, totalH + 0.42, 0);
    bGroup.add(roofCornice);

    // Rooftop Satellite Dish ("طبق دش")
    const dish = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.2, 0.38, 12),
      new THREE.MeshLambertMaterial({ color: 0xdad7cd })
    );
    dish.rotation.x = 0.72;
    dish.position.set(-width * 0.26, totalH + 1.2, depth * 0.24);
    bGroup.add(dish);

    // Traditional Egyptian Wooden Pigeon Tower ("غية حمام مصرية")
    if (styleIndex % 2 === 0) {
      const coopGroup = new THREE.Group();
      coopGroup.position.set(width * 0.22, totalH + 0.8, 0);
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.95, 2.8, 6),
        new THREE.MeshLambertMaterial({ color: 0x6f4e37 })
      );
      tower.position.y = 1.4;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.75, 2.3, 6),
        new THREE.MeshLambertMaterial({ color: 0x9c6644 })
      );
      cone.position.y = 3.5;
      coopGroup.add(tower, cone);
      bGroup.add(coopGroup);
    }

    return bGroup;
  }

  buildNeighborhood() {
    const shops = [
      { title: 'كشري التحرير والبرنس', bg: '#b5179e', fg: '#ffffff', sub: 'كمالة ودقة وشطة نار 🔥' },
      { title: 'عصير قصب المعلم زغلول', bg: '#2ec4b6', fg: '#0b132b', sub: 'اشرب وروّق دمك يا عطشان' },
      { title: 'قهوة الفيشاوي الشعبية', bg: '#7f4f24', fg: '#ffbe0b', sub: 'شاي على الفحم ودومينو وطاولة' },
      { title: 'ورشة الأسطى عبده للتكاتك', bg: '#e6192e', fg: '#ffffff', sub: 'عمرة موتور وعفشة ونيون' },
      { title: 'فول وطعمية الحاج سيد', bg: '#38b000', fg: '#ffffff', sub: 'فول بالزيت الحار والطحينة' },
      { title: 'فرارجي السعادة والأمانة', bg: '#fb5607', fg: '#ffffff', sub: 'فراخ بلدي طازة كل يوم' },
      { title: 'حواوشي وكبدة الإسكندراني', bg: '#8338ec', fg: '#ffbe0b', sub: 'الطعم الأصلي من قلب الحارة' },
      { title: 'مقلة السيدة للّب والسوداني', bg: '#ff006e', fg: '#ffffff', sub: 'لب سوبر وأسمر وبطيخ' }
    ];

    const placedBuildingCenters = [];
    const totalSteps = 88;

    for (let i = 2; i < totalSteps - 1; i++) {
      const t = i / totalSteps;
      const pt = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const angle = Math.atan2(tangent.x, tangent.z);

      [-1, 1].forEach((side, sIdx) => {
        const width = 11.5 + (i % 3) * 1.6;
        const depth = 10.0 + (i % 2) * 1.8;
        const floors = 3 + ((i + sIdx) % 3);

        const distFromCenter = this.roadWidth * 0.5 + 3.8 + depth * 0.5;
        const bPos = pt.clone().addScaledVector(normal, side * distFromCenter);

        // Keep buildings strictly outside the road and prevent corner overlapping
        const trackCheck = this.getTrackInfo(bPos);
        if (trackCheck.distance < this.roadWidth * 0.5 + depth * 0.45) return;

        for (const prev of placedBuildingCenters) {
          const dx = bPos.x - prev.x;
          const dz = bPos.z - prev.z;
          if (dx * dx + dz * dz < 12.2 * 12.2) return;
        }
        placedBuildingCenters.push(bPos.clone());

        const shopInfo = shops[(i + sIdx * 3) % shops.length];
        const bGroup = this.createDetailedEgyptianBuilding(width, depth, floors, i + sIdx * 2, shopInfo);
        bGroup.position.set(bPos.x, 0.2, bPos.z);
        // Orient the building's +Z front facade directly toward the street!
        bGroup.lookAt(pt.x, 0.2, pt.z);
        this.worldGroup.add(bGroup);

        // Street Vendors & Sidewalk Cafes
        if (i % 5 === 0 && side === 1) {
          this.buildStreetVendor(pt.clone().addScaledVector(normal, side * (this.roadWidth * 0.5 + 1.9)), angle, i);
        } else if (i % 6 === 0 && side === -1) {
          this.buildAhwaCafe(pt.clone().addScaledVector(normal, side * (this.roadWidth * 0.5 + 2.2)), angle);
        }
      });

      // Street Lamps & Overhead Ramadan Decorations
      if (i % 3 === 0) {
        this.buildOverheadDecorations(pt, normal, angle, i);
      }
      if (i % 4 === 0) {
        this.buildStreetLamp(pt.clone().addScaledVector(normal, this.roadWidth * 0.5 + 1.2), angle);
        this.buildStreetLamp(pt.clone().addScaledVector(normal, -(this.roadWidth * 0.5 + 1.2)), angle + Math.PI);
      }
      if (i % 11 === 4) {
        const offset = (Math.random() - 0.5) * (this.roadWidth * 0.55);
        this.buildPothole(pt.clone().addScaledVector(normal, offset));
      }
      if (i % 16 === 8) {
        const offset = (Math.random() - 0.5) * (this.roadWidth * 0.45);
        this.buildJumpRamp(pt.clone().addScaledVector(normal, offset), angle);
      }
    }
  }

  buildStreetLamp(pos, angle) {
    const lampGroup = new THREE.Group();
    lampGroup.position.set(pos.x, 0.2, pos.z);
    lampGroup.rotation.y = angle;

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 6.8, 8),
      new THREE.MeshLambertMaterial({ color: 0x2b2d42 })
    );
    pole.position.y = 3.4;

    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6),
      new THREE.MeshLambertMaterial({ color: 0x2b2d42 })
    );
    arm.rotation.z = Math.PI / 2;
    arm.position.set(-0.7, 6.6, 0);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffe169 })
    );
    bulb.position.set(-1.35, 6.45, 0);

    lampGroup.add(pole, arm, bulb);
    this.worldGroup.add(lampGroup);
  }

  buildCairoSkyline() {
    const landmarkCoords = [
      new THREE.Vector3(115, 0, -95),
      new THREE.Vector3(90, 0, 95),
      new THREE.Vector3(-85, 0, -60)
    ];

    landmarkCoords.forEach((pos) => {
      const mosque = new THREE.Group();
      mosque.position.copy(pos);

      const base = new THREE.Mesh(
        new THREE.BoxGeometry(24, 16, 24),
        new THREE.MeshLambertMaterial({ color: 0xd8b48b })
      );
      base.position.y = 8;

      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(9.0, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshLambertMaterial({ color: 0xe6ccb2 })
      );
      dome.position.y = 16;

      const minaret = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 2.1, 40, 12),
        new THREE.MeshLambertMaterial({ color: 0xe6ccb2 })
      );
      minaret.position.set(9.5, 20, 9.5);

      const minaretTop = new THREE.Mesh(
        new THREE.ConeGeometry(1.9, 6.0, 12),
        new THREE.MeshBasicMaterial({ color: 0xffbe0b })
      );
      minaretTop.position.set(9.5, 43.0, 9.5);

      mosque.add(base, dome, minaret, minaretTop);
      this.worldGroup.add(mosque);
    });
  }

  buildOverheadDecorations(pt, normal, angle, index) {
    const span = this.roadWidth + 10;
    const group = new THREE.Group();
    group.position.copy(pt);
    group.rotation.y = angle;

    const ropeGeo = new THREE.CylinderGeometry(0.04, 0.04, span, 6);
    ropeGeo.rotateZ(Math.PI / 2);
    const rope = new THREE.Mesh(ropeGeo, new THREE.MeshBasicMaterial({ color: 0xdddddd }));
    rope.position.y = 9.2;
    group.add(rope);

    const flagColors = [0xe6192e, 0xffbe0b, 0x00f5d4, 0xff006e, 0x38b000];
    for (let x = -span * 0.42; x <= span * 0.42; x += 1.8) {
      const coneGeo = new THREE.ConeGeometry(0.42, 0.95, 3);
      coneGeo.rotateX(Math.PI);
      const flag = new THREE.Mesh(
        coneGeo,
        new THREE.MeshBasicMaterial({ color: flagColors[Math.abs(Math.round(x)) % flagColors.length] })
      );
      flag.position.set(x, 8.7, 0);
      group.add(flag);
    }

    const fanousGroup = new THREE.Group();
    fanousGroup.position.set(0, 7.8, 0);
    const topMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.65, 0.8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffbe0b })
    );
    topMesh.position.y = 0.7;
    const glassMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.4, 1.1, 6),
      new THREE.MeshBasicMaterial({ color: index % 2 === 0 ? 0xffbe0b : 0x00f5d4 })
    );
    fanousGroup.add(topMesh, glassMesh);
    group.add(fanousGroup);

    if (index % 6 === 0) {
      const laundryGroup = new THREE.Group();
      laundryGroup.position.y = 11.8;
      const clothesColors = [0xffffff, 0xff006e, 0x00b4d8, 0xffbe0b, 0x2ec4b6];
      for (let lx = -6; lx <= 6; lx += 2.4) {
        const cloth = new THREE.Mesh(
          new THREE.PlaneGeometry(1.3, 1.7),
          new THREE.MeshLambertMaterial({
            color: clothesColors[Math.abs(lx) % clothesColors.length],
            side: THREE.DoubleSide
          })
        );
        cloth.position.set(lx, -0.85, 0);
        laundryGroup.add(cloth);
      }
      group.add(laundryGroup);
      this.laundryLines.push(laundryGroup);
    }

    this.ramadanGroup.add(group);
  }

  buildStreetVendor(pos, angle, index) {
    const cart = new THREE.Group();
    cart.position.copy(pos);
    cart.rotation.y = angle;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.3, 3.2),
      new THREE.MeshLambertMaterial({ color: index % 2 === 0 ? 0x2ec4b6 : 0xe6192e })
    );
    body.position.y = 1.0;
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.25, 3.6),
      new THREE.MeshLambertMaterial({ color: 0xffbe0b })
    );
    roof.position.y = 2.6;
    const pot = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 10, 10),
      new THREE.MeshLambertMaterial({ color: 0xd97706 })
    );
    pot.position.set(0, 1.9, 0);
    cart.add(body, roof, pot);
    this.worldGroup.add(cart);
  }

  buildAhwaCafe(pos, angle) {
    const ahwa = new THREE.Group();
    ahwa.position.copy(pos);
    ahwa.rotation.y = angle;

    const chairColors = [0xe6192e, 0x00b4d8, 0xffbe0b, 0x38b000];
    for (let z = -2; z <= 2; z += 2) {
      const table = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 0.8, 8),
        new THREE.MeshLambertMaterial({ color: 0xffffff })
      );
      table.position.set(0, 0.4, z);
      const chair = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.75, 0.55),
        new THREE.MeshLambertMaterial({ color: chairColors[Math.abs(z) % chairColors.length] })
      );
      chair.position.set(0.9, 0.38, z);
      ahwa.add(table, chair);
    }
    this.worldGroup.add(ahwa);
  }

  buildPothole(pos) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.35, 0.08, 12),
      new THREE.MeshBasicMaterial({ color: 0x16131d })
    );
    mesh.position.set(pos.x, 0.04, pos.z);
    const ringGeo = new THREE.RingGeometry(1.35, 1.65, 14);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffbe0b, side: THREE.DoubleSide }));
    ring.position.y = 0.02;
    mesh.add(ring);
    this.worldGroup.add(mesh);
    this.potholes.push({ position: pos.clone(), radius: 1.55 });
  }

  buildJumpRamp(pos, angle) {
    const rampGroup = new THREE.Group();
    rampGroup.position.set(pos.x, 0, pos.z);
    rampGroup.rotation.y = angle;

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.8, 4.2),
      new THREE.MeshLambertMaterial({ color: 0xff006e })
    );
    mesh.rotation.x = 0.22;
    mesh.position.y = 0.28;
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 3.6),
      new THREE.MeshBasicMaterial({ color: 0xffbe0b, side: THREE.DoubleSide })
    );
    stripe.rotation.x = -Math.PI / 2 + 0.22;
    stripe.position.y = 0.72;
    rampGroup.add(mesh, stripe);
    this.worldGroup.add(rampGroup);
    this.ramps.push({ position: pos.clone(), radius: 2.3 });
  }

  update(dt, elapsed) {
    for (let i = 0; i < this.laundryLines.length; i++) {
      this.laundryLines[i].rotation.x = Math.sin(elapsed * 2.5 + i) * 0.22;
    }
  }

  getTrackInfo(pos) {
    let bestIdx = 0;
    let minDistSq = Infinity;
    const len = this.trackPoints.length;

    for (let i = 0; i < len; i++) {
      const p = this.trackPoints[i];
      const dx = pos.x - p.x;
      const dz = pos.z - p.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        bestIdx = i;
      }
    }

    const t = bestIdx / len;
    const point = this.trackPoints[bestIdx];
    const tangent = this.curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    const toVehicle = new THREE.Vector3(pos.x - point.x, 0, pos.z - point.z);
    const lateralOffset = toVehicle.dot(normal);

    return {
      t,
      point,
      tangent,
      normal,
      distance: Math.sqrt(minDistSq),
      lateralOffset
    };
  }
}

window.CairoWorld = CairoWorld;
