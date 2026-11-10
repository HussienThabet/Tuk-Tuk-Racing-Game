// city.js - Open-world Cairo district: street grid, Egyptian buildings, plazas, Nile corniche.
// Replaces the old single-loop race track with a free-roam city (Crazy Taxi style).

class CairoCity {
  constructor(scene) {
    this.isCity = true;
    this.scene = scene;

    // --- City layout constants ---
    this.B = 44;               // block size (building footprint area)
    this.R = 18;               // road width (centre line to centre line gap minus block)
    this.C = this.B + this.R;  // grid pitch: road centre lines sit at multiples of C
    this.N = 8;                // N x N blocks
    this.size = this.N * this.C;
    this.roadWidth = this.R;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.chunks = [];
    this.colliders = new Map();
    this.potholes = [];
    this.ramps = [];
    this.boats = [];
    this.plazas = [];
    this.decorOn = true;
    this.visTimer = 0;
    this.chunkRadius = 270;

    // Deterministic RNG so the city is identical every session
    this._seed = 20260611;

    this.ambientLight = null;
    this.dirLight = null;
    this.hemiLight = null;

    this.initLights();
    this.initSharedResources();
    this.buildGround();
    this.buildPerimeter();
    this.buildBlocks();
    this.buildRoadHazards();
    this.buildNile();
    this.buildSkyline();
    // Graphics layer: adopts the lights, then batches the static city into few draw calls
    TTGfx.setupCity(this);
    this.setEnvironment('day');
  }

  // ---------------------------------------------------------------- utilities
  rand() {
    // mulberry32
    let t = (this._seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  initLights() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.72);
    this.scene.add(this.ambientLight);
    this.hemiLight = new THREE.HemisphereLight(0xffeeb1, 0x2b253a, 0.65);
    this.scene.add(this.hemiLight);
    this.dirLight = new THREE.DirectionalLight(0xfff2dd, 1.05);
    this.dirLight.position.set(90, 160, 75);
    this.scene.add(this.dirLight);
  }

  setEnvironment(mode) {
    this.currentEnv = mode;
    if (mode === 'day') {
      this.scene.background = new THREE.Color(0x68b5ff);
      this.scene.fog = new THREE.FogExp2(0x9ed0ff, 0.0022);
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 0.85;
      this.dirLight.color.setHex(0xfff6e0);
      this.dirLight.intensity = 1.15;
      this.decorOn = true;
    } else if (mode === 'sunset') {
      this.scene.background = new THREE.Color(0xf76b45);
      this.scene.fog = new THREE.FogExp2(0xd15852, 0.0026);
      this.ambientLight.color.setHex(0xffb480);
      this.ambientLight.intensity = 0.75;
      this.dirLight.color.setHex(0xff7733);
      this.dirLight.intensity = 1.05;
      this.decorOn = true;
    } else if (mode === 'night') {
      this.scene.background = new THREE.Color(0x0b081a);
      this.scene.fog = new THREE.FogExp2(0x110b29, 0.003);
      this.ambientLight.color.setHex(0x6359ad);
      this.ambientLight.intensity = 0.7;
      this.dirLight.color.setHex(0x88aaff);
      this.dirLight.intensity = 0.6;
      this.decorOn = false;
    } else {
      // Ramadan nights with lanterns
      this.scene.background = new THREE.Color(0x150c2a);
      this.scene.fog = new THREE.FogExp2(0x1d1138, 0.0026);
      this.ambientLight.color.setHex(0xffc988);
      this.ambientLight.intensity = 0.8;
      this.dirLight.color.setHex(0xffd166);
      this.dirLight.intensity = 0.82;
      this.decorOn = true;
    }
    // Sky, image-based lighting, sun, fog and exposure are owned by the graphics layer
    TTGfx.applyEnvironment(mode);
    this.updateVisibility(this._lastX || 0, this._lastZ || 0, true);
  }

  // ----------------------------------------------------------- shared assets
  initSharedResources() {
    this.facade = this.createBuildingMaterials();
    this.roofMat = TTGfx.lit({ color: 0x3d3846, roughness: 0.95 });
    this.concreteMat = TTGfx.lit({ color: 0xc2bdb6, roughness: 0.92 });
    this.darkMat = TTGfx.lit({ color: 0x22223b });
    this.ironMat = TTGfx.mat.metal(0x1f2421, 0.6);

    // Sidewalk pavers (PBR set, shared by all block slabs)
    this.sidewalkMat = TTGfx.mat.ground('sidewalk', 7, 7);

    // Shop signs (shared)
    this.shops = [
      { title: 'كشري التحرير والبرنس', bg: '#b5179e', fg: '#ffffff', sub: 'كمالة ودقة وشطة نار 🔥' },
      { title: 'عصير قصب المعلم زغلول', bg: '#2ec4b6', fg: '#0b132b', sub: 'اشرب وروّق دمك يا عطشان' },
      { title: 'قهوة الفيشاوي الشعبية', bg: '#7f4f24', fg: '#ffbe0b', sub: 'شاي على الفحم ودومينو وطاولة' },
      { title: 'ورشة الأسطى عبده للتكاتك', bg: '#e6192e', fg: '#ffffff', sub: 'عمرة موتور وعفشة ونيون' },
      { title: 'فول وطعمية الحاج سيد', bg: '#38b000', fg: '#ffffff', sub: 'فول بالزيت الحار والطحينة' },
      { title: 'فرارجي السعادة والأمانة', bg: '#fb5607', fg: '#ffffff', sub: 'فراخ بلدي طازة كل يوم' },
      { title: 'حواوشي وكبدة الإسكندراني', bg: '#8338ec', fg: '#ffbe0b', sub: 'الطعم الأصلي من قلب الحارة' },
      { title: 'مقلة السيدة للّب والسوداني', bg: '#ff006e', fg: '#ffffff', sub: 'لب سوبر وأسمر وبطيخ' },
      { title: 'صيدلية الشفا', bg: '#0077b6', fg: '#ffffff', sub: 'خدمة ٢٤ ساعة' },
      { title: 'محل موبايلات النيل', bg: '#111827', fg: '#ffbe0b', sub: 'صيانة وإكسسوارات' }
    ];
    this.signMats = this.shops.map((s) => new THREE.MeshBasicMaterial({
      map: this.createArabicSignTexture(s.title, s.bg, s.fg, s.sub)
    }));
    // shop signs are back-lit: they brighten (and bloom) at night
    TTGfx.env.glowMaterials.push(...this.signMats);

    // Shared geometries for repeated props
    this.geo = {
      lampPole: new THREE.CylinderGeometry(0.14, 0.2, 7, 8),
      lampBulb: new THREE.SphereGeometry(0.4, 8, 8),
      rope: new THREE.CylinderGeometry(0.04, 0.04, this.R + 2, 5),
      flag: new THREE.ConeGeometry(0.42, 0.95, 3),
      fanousTop: new THREE.ConeGeometry(0.6, 0.7, 6),
      fanousBody: new THREE.CylinderGeometry(0.5, 0.36, 1.0, 6),
      palmTrunk: new THREE.CylinderGeometry(0.22, 0.34, 6, 6),
      palmLeaf: new THREE.ConeGeometry(0.4, 3.2, 4)
    };
    this.mat = {
      lampPole: TTGfx.mat.metal(0x2b2d42, 0.55),
      lampBulb: new THREE.MeshBasicMaterial({ color: 0xffe169 }),
      rope: new THREE.MeshBasicMaterial({ color: 0xdddddd }),
      gold: new THREE.MeshBasicMaterial({ color: 0xffbe0b }),
      trunk: TTGfx.lit({ color: 0x7a5230 }),
      leaf: TTGfx.lit({ color: 0x2d8a3e })
    };
    this.flagMats = [0xe6192e, 0xffbe0b, 0x00f5d4, 0xff006e, 0x38b000].map(
      (c) => new THREE.MeshBasicMaterial({ color: c })
    );
  }

  createArabicSignTexture(text, bgColor, textColor, subText = '') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = '#ffbe0b';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 496, 144);
    ctx.fillStyle = textColor;
    ctx.font = '900 46px Cairo, Tajawal, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, subText ? 62 : 80);
    if (subText) {
      ctx.fillStyle = '#ffbe0b';
      ctx.font = '700 26px Cairo, Tajawal, sans-serif';
      ctx.fillText(subText, 256, 120);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  // Facade textures: red brick / stucco, concrete beams, windows with wooden shutters
  createBuildingMaterials() {
    const palettes = [
      { bg: '#8f3424', brick: true, concrete: '#b5afa6', shutter: '#1b4332', sill: '#ded8ce' },
      { bg: '#cf9263', brick: false, concrete: '#e3d5ca', shutter: '#2d6a4f', sill: '#f5ebe0' },
      { bg: '#7d2e22', brick: true, concrete: '#a8a29e', shutter: '#582f0e', sill: '#d6d3d1' },
      { bg: '#6c8ea4', brick: false, concrete: '#d8e2dc', shutter: '#1d3557', sill: '#ffffff' },
      { bg: '#b87d65', brick: false, concrete: '#d5bdaf', shutter: '#386641', sill: '#edede9' },
      { bg: '#a44a3f', brick: true, concrete: '#bab3a9', shutter: '#22333b', sill: '#eae0d5' }
    ];

    return palettes.map((pal) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = pal.bg;
      ctx.fillRect(0, 0, 512, 512);

      // emissive mask: only the lit windows glow at night
      const glowCanvas = document.createElement('canvas');
      glowCanvas.width = glowCanvas.height = 512;
      const gctx = glowCanvas.getContext('2d');
      gctx.fillStyle = '#000000';
      gctx.fillRect(0, 0, 512, 512);
      gctx.fillStyle = '#ffffff';

      if (pal.brick) {
        for (let y = 0; y < 512; y += 12) {
          ctx.fillStyle = 'rgba(35, 12, 8, 0.42)';
          ctx.fillRect(0, y, 512, 2);
          const off = (y / 12) % 2 === 0 ? 0 : 14;
          for (let x = off; x < 512; x += 28) {
            ctx.fillStyle = 'rgba(35, 12, 8, 0.35)';
            ctx.fillRect(x, y, 2, 12);
          }
        }
      } else {
        for (let i = 0; i < 1000; i++) {
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.055)';
          ctx.fillRect(Math.random() * 512, Math.random() * 512, 10, 5);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let y = 0; y < 512; y += 20) ctx.fillRect(0, y, 512, 2);
      }

      ctx.fillStyle = pal.concrete;
      ctx.fillRect(0, 0, 26, 512);
      ctx.fillRect(243, 0, 26, 512);
      ctx.fillRect(486, 0, 26, 512);

      for (let f = 0; f < 4; f++) {
        const top = f * 128;
        ctx.fillStyle = pal.concrete;
        ctx.fillRect(0, top, 512, 16);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(0, top + 16, 512, 4);

        [72, 312].forEach((wx, wIdx) => {
          const wy = top + 34, ww = 92, wh = 72;
          ctx.fillStyle = pal.sill;
          ctx.fillRect(wx - 6, wy - 6, ww + 12, wh + 14);
          ctx.fillStyle = '#10141d';
          ctx.fillRect(wx, wy, ww, wh);
          ctx.fillStyle = (f + wIdx) % 2 === 0 ? '#ffd166' : '#1d2d44';
          ctx.fillRect(wx + 4, wy + 4, ww - 8, wh - 8);
          if ((f + wIdx) % 2 === 0) gctx.fillRect(wx + 4, wy + 4, ww - 8, wh - 8);
          ctx.fillStyle = pal.sill;
          ctx.fillRect(wx + ww / 2 - 2, wy, 4, wh);
          ctx.fillRect(wx, wy + wh / 2 - 2, ww, 4);
          ctx.fillStyle = pal.shutter;
          ctx.fillRect(wx - 22, wy, 20, wh);
          ctx.fillRect(wx + ww + 2, wy, 20, wh);
          ctx.fillStyle = 'rgba(0,0,0,0.38)';
          for (let sy = wy + 4; sy < wy + wh - 4; sy += 6) {
            ctx.fillRect(wx - 20, sy, 16, 2);
            ctx.fillRect(wx + ww + 4, sy, 16, 2);
          }
        });
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.needsUpdate = true;
      const glowTex = new THREE.CanvasTexture(glowCanvas);
      glowTex.wrapS = glowTex.wrapT = THREE.RepeatWrapping;
      const wallMat = TTGfx.lit({
        map: tex, roughness: pal.brick ? 0.93 : 0.88,
        emissiveMap: glowTex, emissive: 0xffc878, emissiveIntensity: 0
      });
      TTGfx.env.windowMaterials.push(wallMat);
      return { wallMat, shutter: pal.shutter };
    });
  }

  // ------------------------------------------------------------------ ground
  buildGround() {
    const C = this.C;
    const shadows = TTGfx.tier.shadows;

    // Dusty sand under and around the district
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(2600, 2600),
      TTGfx.mat.ground('sand', 220, 220, { color: 0xb9a78c })
    );
    base.rotation.x = -Math.PI / 2;
    base.position.y = -0.12;
    base.userData.ground = true;
    this.group.add(base);

    const xMin = -C / 2, xMax = this.size + C / 2;
    const zMin = -C / 2, zMax = this.size + this.R / 2 + 2;
    const w = xMax - xMin, h = zMax - zMin;

    // Asphalt: PBR tile every 6 m with world-space wet patches
    const road = new THREE.Mesh(new THREE.PlaneGeometry(w, h), TTGfx.mat.road(w / 6, h / 6));
    road.rotation.x = -Math.PI / 2;
    road.position.set((xMin + xMax) / 2, 0, (zMin + zMax) / 2);
    road.receiveShadow = shadows;
    road.userData.ground = true;
    this.group.add(road);

    // Road paint on a transparent overlay: one tile per city block, road centre
    // lines sit on the tile edges and intersections on the tile corners.
    const T = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = T;
    const ctx = canvas.getContext('2d');
    const hw = (this.R / 2 / C) * T;       // half road width in pixels
    const zebra = (3.2 / C) * T;           // crossing depth
    const clear = hw + zebra + 34;         // keep intersections free of centre dashes

    ctx.fillStyle = 'rgba(244, 184, 28, 0.88)';
    for (let p = 0; p < T; p += 96) {
      if (p < clear || p + 52 > T - clear) continue;
      ctx.fillRect(p, 0, 52, 5);
      ctx.fillRect(p, T - 5, 52, 5);
      ctx.fillRect(0, p, 5, 52);
      ctx.fillRect(T - 5, p, 5, 52);
    }

    // zebra crossings on all four arms of every intersection
    ctx.fillStyle = 'rgba(232, 230, 220, 0.82)';
    const bar = (0.5 / C) * T;
    [hw + 12, T - hw - 12 - zebra].forEach((a) => {
      for (let v = 8; v + bar < hw - 6; v += bar * 2) {
        ctx.fillRect(a, v, zebra, bar);
        ctx.fillRect(a, T - v - bar, zebra, bar);
        ctx.fillRect(v, a, bar, zebra);
        ctx.fillRect(T - v - bar, a, bar, zebra);
      }
    });
    // worn paint: knock random specks out of the markings
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 5200; i++) {
      ctx.fillStyle = 'rgba(0,0,0,' + (0.25 + Math.random() * 0.5) + ')';
      ctx.fillRect(Math.random() * T, Math.random() * T, 2 + Math.random() * 4, 2 + Math.random() * 3);
    }
    ctx.globalCompositeOperation = 'source-over';

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this.asphaltTex = tex;
    tex.repeat.set(w / C, h / C);
    tex.offset.set(xMin / C - Math.floor(xMin / C), -(zMax / C - Math.floor(zMax / C)));

    const paint = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      TTGfx.lit({
        map: tex, transparent: true, depthWrite: false, roughness: 0.7,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
      })
    );
    paint.rotation.x = -Math.PI / 2;
    paint.position.set((xMin + xMax) / 2, 0.012, (zMin + zMax) / 2);
    paint.receiveShadow = shadows;
    paint.renderOrder = 1;
    paint.userData.ground = true;
    paint.userData.noAO = true;
    this.group.add(paint);
  }

  buildPerimeter() {
    const s = this.size, R = this.R;
    const wallMat = TTGfx.lit({ color: 0x8a7f78 });
    const e = R / 2 + 1.5;
    const mk = (w, h, d, x, y, z, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || wallMat);
      m.position.set(x, y, z);
      this.group.add(m);
    };
    const len = s + 2 * e + 4;
    mk(2, 5, len, -e, 2.5, s / 2);          // west
    mk(2, 5, len, s + e, 2.5, s / 2);       // east
    mk(len, 5, 2, s / 2, 2.5, -e);          // north
    mk(len, 1.4, 2, s / 2, 0.7, s + e, TTGfx.lit({ color: 0xcfc7b8 })); // south corniche rail
  }

  // -------------------------------------------------------------------- blocks
  getChunk(i, j) {
    const key = i + ',' + j;
    if (!this._chunkMap) this._chunkMap = new Map();
    return this._chunkMap.get(key);
  }

  addCollider(i, j, minX, maxX, minZ, maxZ) {
    const key = i + ',' + j;
    if (!this.colliders.has(key)) this.colliders.set(key, []);
    this.colliders.get(key).push({ minX, maxX, minZ, maxZ });
  }

  buildBlocks() {
    this._chunkMap = new Map();
    const plazaSpec = {
      '3,3': 'fountain',
      '5,2': 'market',
      '2,5': 'mosque',
      '6,6': 'park'
    };

    for (let i = 0; i < this.N; i++) {
      for (let j = 0; j < this.N; j++) {
        const cx = (i + 0.5) * this.C;
        const cz = (j + 0.5) * this.C;
        const chunk = { group: new THREE.Group(), decor: new THREE.Group(), cx, cz, i, j };
        chunk.group.add(chunk.decor);
        this.group.add(chunk.group);
        this.chunks.push(chunk);
        this._chunkMap.set(i + ',' + j, chunk);

        // sidewalk slab
        const slab = new THREE.Mesh(new THREE.BoxGeometry(this.B + 3, 0.3, this.B + 3), this.sidewalkMat);
        slab.position.set(cx, 0.15, cz);
        chunk.group.add(slab);

        const spec = plazaSpec[i + ',' + j];
        if (spec) {
          this.buildPlaza(chunk, spec);
        } else {
          this.buildBuildingRing(chunk);
        }

        this.buildBlockProps(chunk, !!spec);
      }
    }
  }

  buildBuildingRing(chunk) {
    const { cx, cz, i, j } = chunk;
    const B = this.B, D = 13;
    const placeBuilding = (px, pz, w, rotY, halfX, halfZ, styleSeed) => {
      const floors = 3 + Math.floor(this.rand() * 3);
      const b = this.createBuilding(w, D, floors, styleSeed, Math.floor(this.rand() * this.shops.length));
      b.position.set(px, 0.3, pz);
      b.rotation.y = rotY;
      chunk.group.add(b);
      this.addCollider(i, j, px - halfX, px + halfX, pz - halfZ, pz + halfZ);
    };

    const wHalf = B / 2 - 0.3;       // width of N/S buildings
    const wSide = B - 2 * D - 0.3;   // width of E/W buildings
    const seed = i * 7 + j * 3;

    // North side faces -Z, South faces +Z
    [-1, 1].forEach((sx, k) => {
      placeBuilding(cx + sx * B / 4, cz - B / 2 + D / 2, wHalf, Math.PI, wHalf / 2, D / 2, seed + k);
      placeBuilding(cx + sx * B / 4, cz + B / 2 - D / 2, wHalf, 0, wHalf / 2, D / 2, seed + k + 2);
    });
    // East faces +X, West faces -X
    placeBuilding(cx + B / 2 - D / 2, cz, wSide, Math.PI / 2, D / 2, wSide / 2, seed + 4);
    placeBuilding(cx - B / 2 + D / 2, cz, wSide, -Math.PI / 2, D / 2, wSide / 2, seed + 5);
  }

  scaleFacadeUV(geo, w, h, d) {
    const uv = geo.attributes.uv;
    const faceW = [d, d, 1, 1, w, w];
    for (let f = 0; f < 6; f++) {
      if (f === 2 || f === 3) continue;
      for (let k = 0; k < 4; k++) {
        const idx = f * 4 + k;
        uv.setXY(idx, (uv.getX(idx) * faceW[f]) / 11, (uv.getY(idx) * h) / 16);
      }
    }
    uv.needsUpdate = true;
  }

  // One Egyptian apartment building. Local +Z is the street-facing front.
  createBuilding(w, d, floors, styleSeed, shopIdx) {
    const g = new THREE.Group();
    const floorH = 4.0, groundH = 4.4;
    const h = groundH + (floors - 1) * floorH;
    const style = this.facade[Math.abs(styleSeed) % this.facade.length];

    const geo = new THREE.BoxGeometry(w, h, d);
    this.scaleFacadeUV(geo, w, h, d);
    const wall = style.wallMat;
    const core = new THREE.Mesh(geo, [wall, wall, this.roofMat, this.roofMat, wall, wall]);
    core.position.y = h / 2;
    g.add(core);

    // concrete roof cornice
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.8, d + 0.8), this.concreteMat);
    cap.position.y = h + 0.4;
    g.add(cap);

    // ground floor shop: door, awning, sign
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.76, 2.6),
      new THREE.MeshBasicMaterial({ color: shopIdx % 2 === 0 ? 0xffecd1 : 0x4a4e69 })
    );
    door.position.set(0, 1.4, d / 2 + 0.05);
    g.add(door);

    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.9, 0.2, 1.6),
      TTGfx.lit({ color: shopIdx % 2 === 0 ? 0xe6192e : 0x2ec4b6 })
    );
    awning.position.set(0, 2.85, d / 2 + 0.8);
    awning.rotation.x = 0.25;
    g.add(awning);

    const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 1.5, 0.45), this.signMats[shopIdx % this.signMats.length]);
    sign.position.set(0, 3.7, d / 2 + 0.25);
    g.add(sign);

    // two protruding balconies
    for (let f = 1; f <= Math.min(2, floors - 1); f++) {
      const bw = w * 0.4;
      const bx = (f % 2 === 0 ? -1 : 1) * w * 0.22;
      const by = groundH + (f - 1) * floorH + 0.25;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.26, 1.7), this.concreteMat);
      slab.position.set(bx, by, d / 2 + 0.85);
      g.add(slab);
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(bw, 0.95, 0.16),
        TTGfx.lit({ color: f % 2 === 0 ? 0xe09f3e : 0x2ec4b6 })
      );
      rail.position.set(bx, by + 0.6, d / 2 + 1.65);
      g.add(rail);
    }

    // rooftop: water tank or satellite dish
    if (styleSeed % 2 === 0) {
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 0.9, 1.6, 10),
        TTGfx.lit({ color: 0x3b82f6 })
      );
      tank.position.set(-w * 0.25, h + 1.6, 0);
      g.add(tank);
    }
    const dish = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.2, 0.35, 10),
      TTGfx.lit({ color: 0xdad7cd })
    );
    dish.rotation.x = 0.7;
    dish.position.set(w * 0.25, h + 1.2, d * 0.2);
    g.add(dish);

    return g;
  }

  buildBlockProps(chunk, isPlaza) {
    const { cx, cz, i, j } = chunk;
    const B = this.B;

    // street lamps at the four corners
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const x = cx + sx * (B / 2 + 1.8);
      const z = cz + sz * (B / 2 + 1.8);
      const pole = new THREE.Mesh(this.geo.lampPole, this.mat.lampPole);
      pole.position.set(x, 3.5, z);
      const bulb = new THREE.Mesh(this.geo.lampBulb, this.mat.lampBulb);
      bulb.position.set(x, 7.1, z);
      chunk.group.add(pole, bulb);
    });

    // bunting + lantern across the road to the north and west of this block
    if ((i + j) % 2 === 0) this.buildBunting(chunk, cx, cz - this.C / 2, 'z');
    if ((i * 2 + j) % 3 !== 1) this.buildBunting(chunk, cx - this.C / 2, cz, 'x');

    // street life: vendor cart (solid) or ahwa chairs
    const r = this.rand();
    if (!isPlaza) {
      if (r < 0.34) {
        const sideNorth = this.rand() < 0.5;
        const vx = cx + (this.rand() - 0.5) * 24;
        const vz = cz + (sideNorth ? -1 : 1) * (B / 2 + 4.2);
        this.buildVendorCart(chunk, vx, vz, i + j);
        this.addCollider(i, j, vx - 1.5, vx + 1.5, vz - 1.4, vz + 1.4);
      } else if (r < 0.62) {
        const vx = cx + (this.rand() - 0.5) * 24;
        const vz = cz + (this.rand() < 0.5 ? -1 : 1) * (B / 2 + 1.0);
        this.buildAhwa(chunk, vx, vz);
      }
    }
  }

  buildBunting(chunk, x, z, axis) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    // rope runs across the road; for 'z' road (rope along Z axis) rotate accordingly
    const rope = new THREE.Mesh(this.geo.rope, this.mat.rope);
    rope.position.y = 9.2;
    rope.rotation.x = Math.PI / 2; // along Z
    g.add(rope);
    for (let k = -3; k <= 3; k++) {
      const flag = new THREE.Mesh(this.geo.flag, this.flagMats[(k + 3) % this.flagMats.length]);
      flag.rotation.x = Math.PI;
      flag.position.set(0, 8.7, k * 2.4);
      g.add(flag);
    }
    const top = new THREE.Mesh(this.geo.fanousTop, this.mat.gold);
    top.position.set(0, 8.35, 0);
    const body = new THREE.Mesh(this.geo.fanousBody, this.flagMats[2]);
    body.position.set(0, 7.5, 0);
    g.add(top, body);

    // the 'z'-labelled road runs along X, so the rope (along Z) is as built.
    // for the other axis rotate a quarter turn so the rope still spans the road.
    if (axis === 'x') g.rotation.y = Math.PI / 2;
    chunk.decor.add(g);
  }

  buildVendorCart(chunk, x, z, idx) {
    const cart = new THREE.Group();
    cart.position.set(x, 0, z);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.2, 2.8),
      TTGfx.lit({ color: idx % 2 === 0 ? 0x2ec4b6 : 0xe6192e })
    );
    body.position.y = 1.0;
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 0.2, 3.4),
      TTGfx.lit({ color: 0xffbe0b })
    );
    roof.position.y = 2.8;
    const pot = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 8, 8),
      TTGfx.lit({ color: 0xd97706 })
    );
    pot.position.y = 1.9;
    cart.add(body, roof, pot);
    chunk.group.add(cart);
  }

  buildAhwa(chunk, x, z) {
    const a = new THREE.Group();
    a.position.set(x, 0.3, z);
    const colors = [0xe6192e, 0x00b4d8, 0xffbe0b, 0x38b000];
    for (let k = -1; k <= 1; k++) {
      const table = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 0.75, 8),
        TTGfx.lit({ color: 0xffffff })
      );
      table.position.set(k * 2.8, 0.38, 0);
      const chair = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.75, 0.55),
        TTGfx.lit({ color: colors[(k + 1) % colors.length] })
      );
      chair.position.set(k * 2.8 + 0.9, 0.38, 0);
      a.add(table, chair);
    }
    chunk.group.add(a);
  }

  // --------------------------------------------------------------------- plazas
  buildPlaza(chunk, type) {
    const { cx, cz, i, j } = chunk;
    this.plazas.push({ x: cx, z: cz, type });

    const paving = new THREE.Mesh(
      new THREE.BoxGeometry(this.B - 2, 0.12, this.B - 2),
      TTGfx.lit({ color: type === 'park' ? 0x3f7d3a : 0xb8a58a })
    );
    paving.position.set(cx, 0.36, cz);
    chunk.group.add(paving);

    const addPalm = (px, pz) => {
      const trunk = new THREE.Mesh(this.geo.palmTrunk, this.mat.trunk);
      trunk.position.set(px, 3.3, pz);
      chunk.group.add(trunk);
      for (let k = 0; k < 5; k++) {
        const leaf = new THREE.Mesh(this.geo.palmLeaf, this.mat.leaf);
        const a = (k / 5) * Math.PI * 2;
        leaf.position.set(px + Math.cos(a) * 1.4, 6.4, pz + Math.sin(a) * 1.4);
        leaf.rotation.z = Math.cos(a) * 1.2;
        leaf.rotation.x = -Math.sin(a) * 1.2;
        chunk.group.add(leaf);
      }
    };

    if (type === 'fountain') {
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.4, 1.2, 20), this.concreteMat);
      basin.position.set(cx, 0.9, cz);
      const water = new THREE.Mesh(
        new THREE.CylinderGeometry(4.5, 4.5, 1.25, 20),
        TTGfx.lit({ color: 0x39a0ed })
      );
      water.position.set(cx, 0.95, cz);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 4, 10), this.concreteMat);
      col.position.set(cx, 2.4, cz);
      chunk.group.add(basin, water, col);
      this.addCollider(i, j, cx - 5.2, cx + 5.2, cz - 5.2, cz + 5.2);
      [[-16, -16], [16, -16], [-16, 16], [16, 16]].forEach(([dx, dz]) => addPalm(cx + dx, cz + dz));
    } else if (type === 'market') {
      const colors = [0xe6192e, 0x2ec4b6, 0xffbe0b, 0x8338ec, 0xfb5607, 0x38b000];
      for (let a = 0; a < 3; a++) {
        for (let b = 0; b < 3; b++) {
          if (a === 1 && b === 1) continue;
          const sx = cx + (a - 1) * 12;
          const sz = cz + (b - 1) * 12;
          const canopy = new THREE.Mesh(
            new THREE.BoxGeometry(4.6, 0.25, 4.6),
            TTGfx.lit({ color: colors[(a * 3 + b) % colors.length] })
          );
          canopy.position.set(sx, 3.0, sz);
          const table = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.0, 2.0), TTGfx.lit({ color: 0x8b5e3c }));
          table.position.set(sx, 0.9, sz);
          chunk.group.add(canopy, table);
          this.addCollider(i, j, sx - 1.9, sx + 1.9, sz - 1.1, sz + 1.1);
        }
      }
    } else if (type === 'mosque') {
      const base = new THREE.Mesh(new THREE.BoxGeometry(18, 11, 18), TTGfx.lit({ color: 0xe0c9a6 }));
      base.position.set(cx, 5.8, cz);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(8, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
        TTGfx.lit({ color: 0xe9d9bd })
      );
      dome.position.set(cx, 11.2, cz);
      const minaret = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 30, 12), TTGfx.lit({ color: 0xe9d9bd }));
      minaret.position.set(cx + 11, 15.3, cz + 11);
      const minTop = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 12), this.mat.gold);
      minTop.position.set(cx + 11, 32.8, cz + 11);
      chunk.group.add(base, dome, minaret, minTop);
      this.addCollider(i, j, cx - 9, cx + 9, cz - 9, cz + 9);
      this.addCollider(i, j, cx + 9.4, cx + 12.6, cz + 9.4, cz + 12.6);
      [[-17, 17], [17, -17]].forEach(([dx, dz]) => addPalm(cx + dx, cz + dz));
    } else {
      // park
      [[-12, -12], [12, -12], [-12, 12], [12, 12], [0, -15], [0, 15], [-15, 0], [15, 0]].forEach(([dx, dz]) => addPalm(cx + dx, cz + dz));
      const pond = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.2, 18), TTGfx.lit({ color: 0x39a0ed }));
      pond.position.set(cx, 0.46, cz);
      chunk.group.add(pond);
    }
  }

  // ------------------------------------------------------------ road hazards
  buildRoadHazards() {
    const addPothole = (x, z) => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1.35, 1.35, 0.06, 12),
        new THREE.MeshBasicMaterial({ color: 0x16131d })
      );
      mesh.position.set(x, 0.05, z);
      const ringGeo = new THREE.RingGeometry(1.35, 1.65, 14);
      ringGeo.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffbe0b, side: THREE.DoubleSide }));
      ring.position.y = 0.02;
      mesh.add(ring);
      this.group.add(mesh);
      this.potholes.push({ position: new THREE.Vector3(x, 0, z), radius: 1.55 });
    };

    const addRamp = (x, z, rotY) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      const wedge = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.8, 4.4), TTGfx.lit({ color: 0xff006e }));
      wedge.rotation.x = 0.22;
      wedge.position.y = 0.3;
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 3.8),
        new THREE.MeshBasicMaterial({ color: 0xffbe0b, side: THREE.DoubleSide })
      );
      stripe.rotation.x = -Math.PI / 2 + 0.22;
      stripe.position.y = 0.74;
      g.add(wedge, stripe);
      this.group.add(g);
      this.ramps.push({ position: new THREE.Vector3(x, 0, z), radius: 2.5 });
    };

    // potholes + kickers on straight road segments (away from intersections)
    for (let n = 0; n < 46; n++) {
      const horizontal = this.rand() < 0.5;
      const line = Math.floor(this.rand() * (this.N + 1));
      const seg = Math.floor(this.rand() * this.N);
      const along = (seg + 0.5) * this.C + (this.rand() - 0.5) * 16;
      const lane = (this.rand() - 0.5) * 9;
      if (horizontal) addPothole(along, line * this.C + lane);
      else addPothole(line * this.C + lane, along);
    }
    for (let n = 0; n < 14; n++) {
      const horizontal = this.rand() < 0.5;
      const line = Math.floor(this.rand() * (this.N + 1));
      const seg = Math.floor(this.rand() * this.N);
      const along = (seg + 0.5) * this.C + (this.rand() - 0.5) * 10;
      const lane = (this.rand() > 0.5 ? 1 : -1) * 3.2;
      if (horizontal) addRamp(along, line * this.C + lane, Math.PI / 2);
      else addRamp(line * this.C + lane, along, 0);
    }
  }

  // ---------------------------------------------------------------------- Nile
  buildNile() {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(2600, 900),
      TTGfx.mat.water()
    );
    water.userData.ground = true;
    water.rotation.x = -Math.PI / 2;
    water.position.set(this.size / 2, -0.02, this.size + this.R / 2 + 2 + 450);
    this.group.add(water);

    for (let k = 0; k < 4; k++) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 9), TTGfx.lit({ color: 0xf4f1de }));
      hull.position.y = 0.5;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 9, 6), TTGfx.lit({ color: 0x5c4033 }));
      mast.position.set(0, 5, 0);
      const sail = new THREE.Mesh(
        new THREE.ConeGeometry(3.4, 8, 3),
        TTGfx.lit({ color: 0xffffff, side: THREE.DoubleSide })
      );
      sail.rotation.z = Math.PI / 2;
      sail.position.set(0, 5.5, 0);
      boat.add(hull, mast, sail);
      boat.position.set(60 + k * 120, 0, this.size + 60 + (k % 2) * 40);
      boat.userData.phase = k * 1.7;
      this.group.add(boat);
      this.boats.push(boat);
    }
  }

  buildSkyline() {
    const s = this.size;
    const mat = (c) => TTGfx.lit({ color: c });
    const cols = [0xd8b48b, 0xc9a27a, 0xb5896a, 0xcdbfa8, 0xa88b78];
    for (let k = 0; k < 44; k++) {
      const ang = (k / 44) * Math.PI * 2;
      const rad = s * 0.5 + 330 + this.rand() * 160;
      const px = s / 2 + Math.cos(ang) * rad;
      const pz = s / 2 + Math.sin(ang) * rad;
      if (pz > s + 40 && Math.abs(px - s / 2) < s) continue; // keep the Nile view clear
      const hgt = 28 + this.rand() * 70;
      const b = new THREE.Mesh(new THREE.BoxGeometry(22 + this.rand() * 18, hgt, 22 + this.rand() * 18), mat(cols[k % cols.length]));
      b.position.set(px, hgt / 2, pz);
      this.group.add(b);
    }
  }

  // ----------------------------------------------------------------- per frame
  update(dt, elapsed) {
    for (let k = 0; k < this.boats.length; k++) {
      const b = this.boats[k];
      b.position.y = Math.sin(elapsed * 1.2 + b.userData.phase) * 0.15;
      b.rotation.z = Math.sin(elapsed * 0.9 + b.userData.phase) * 0.04;
    }
  }

  updateVisibility(px, pz, force) {
    this._lastX = px;
    this._lastZ = pz;
    const r2 = this.chunkRadius * this.chunkRadius;
    for (let k = 0; k < this.chunks.length; k++) {
      const c = this.chunks[k];
      const dx = c.cx - px, dz = c.cz - pz;
      const vis = dx * dx + dz * dz < r2;
      c.group.visible = vis;
      if (vis) c.decor.visible = this.decorOn;
    }
  }

  // ------------------------------------------------------------------ collisions
  resolveCollisions(v) {
    const p = v.position;
    const r = 1.35;
    const min = -this.R / 2 + 2;
    const max = this.size + this.R / 2 - 2;
    let impact = 0;

    if (p.x < min) { p.x = min; impact = Math.max(impact, Math.abs(v.speed) * 0.8); v.speed *= 0.6; }
    if (p.x > max) { p.x = max; impact = Math.max(impact, Math.abs(v.speed) * 0.8); v.speed *= 0.6; }
    if (p.z < min) { p.z = min; impact = Math.max(impact, Math.abs(v.speed) * 0.8); v.speed *= 0.6; }
    if (p.z > max) { p.z = max; impact = Math.max(impact, Math.abs(v.speed) * 0.8); v.speed *= 0.6; }

    const bi = Math.floor(p.x / this.C);
    const bj = Math.floor(p.z / this.C);
    const list = this.colliders.get(bi + ',' + bj);
    if (list) {
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      for (let k = 0; k < list.length; k++) {
        const b = list[k];
        const cxp = Math.max(b.minX, Math.min(p.x, b.maxX));
        const czp = Math.max(b.minZ, Math.min(p.z, b.maxZ));
        let dx = p.x - cxp, dz = p.z - czp;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;

        let nx, nz;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          nx = dx / d; nz = dz / d;
          p.x += nx * (r - d);
          p.z += nz * (r - d);
        } else {
          const toL = p.x - b.minX, toR = b.maxX - p.x, toU = p.z - b.minZ, toD = b.maxZ - p.z;
          const m = Math.min(toL, toR, toU, toD);
          if (m === toL) { p.x = b.minX - r; nx = -1; nz = 0; }
          else if (m === toR) { p.x = b.maxX + r; nx = 1; nz = 0; }
          else if (m === toU) { p.z = b.minZ - r; nx = 0; nz = -1; }
          else { p.z = b.maxZ + r; nx = 0; nz = 1; }
        }
        // frontal hits kill speed, grazing hits only scrub it
        const fr = Math.max(0, -(fx * nx + fz * nz)) * Math.sign(v.speed || 1);
        const frontal = Math.abs(fr);
        impact = Math.max(impact, Math.abs(v.speed) * frontal);
        v.speed *= 1 - 0.7 * frontal;
      }
    }

    v.crashImpact = impact;
  }

  // ------------------------------------------------------------- helpers for game
  // True when a point (e.g. a camera position) is inside / close to a building footprint
  pointBlocked(x, z, pad = 0.6) {
    const bi = Math.floor(x / this.C), bj = Math.floor(z / this.C);
    const list = this.colliders.get(bi + ',' + bj);
    if (!list) return false;
    for (let k = 0; k < list.length; k++) {
      const b = list[k];
      if (x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad) return true;
    }
    return false;
  }

  // Random point on a sidewalk beside a road (used for passengers)
  randomCurbPoint(rng) {
    const rnd = rng || Math.random;
    const N = this.N, C = this.C;
    const horizontal = rnd() < 0.5;
    const line = Math.floor(rnd() * (N + 1));
    const seg = Math.floor(rnd() * N);
    const along = (seg + 0.5) * C + (rnd() - 0.5) * 20;
    let side = rnd() < 0.5 ? -1 : 1;
    if (line === 0) side = 1;
    if (line === N) side = -1;
    const off = side * 8.2;
    return horizontal
      ? { x: along, z: line * C + off }
      : { x: line * C + off, z: along };
  }

  // Nearest intersection (used for spawning / respawn)
  nearestIntersection(x, z) {
    const i = Math.max(0, Math.min(this.N, Math.round(x / this.C)));
    const j = Math.max(0, Math.min(this.N, Math.round(z / this.C)));
    return { i, j, x: i * this.C, z: j * this.C };
  }
}

window.CairoCity = CairoCity;
