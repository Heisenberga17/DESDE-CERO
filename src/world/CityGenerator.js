import * as THREE from 'three';

/**
 * Procedural city generator — grid-based layout with buildings, roads,
 * sidewalks, lamp posts, and traffic lights.
 *
 * City footprint : 800 x 800 units (1 unit = 1 metre)
 * Ground plane   : 1000 x 1000 (grass surround)
 * Road grid      : main every 160 u, secondary every 80 u
 */
class CityGenerator {
  constructor(scene) {
    this._scene = scene;
    this._group = new THREE.Group();
    this._group.name = 'city';

    // Shared palette -----------------------------------------------------------
    this._roadColor       = 0x333333;
    this._sidewalkColor   = 0x999999;
    this._grassColor      = 0x3a5f0b;
    this._markingYellow   = 0xd4a017;
    this._markingWhite    = 0xe8e8e8;
    this._lampWarmColor   = 0xffe4b5;

    // Layout constants ---------------------------------------------------------
    this._citySize        = 800;
    this._half            = this._citySize / 2; // 400
    this._mainSpacing     = 160;
    this._secSpacing      = 80;
    this._mainRoadW       = 12;
    this._secRoadW        = 8;
    this._sidewalkW       = 3;
    this._roadY           = 0.01;
    this._sidewalkY       = 0.1;
    this._markingY        = 0.02;
    this._buildingGap     = 2;   // gap from sidewalk edge into the block

    // Track light budget -------------------------------------------------------
    this._pointLightCount = 0;
    this._maxPointLights  = 18;

    // Pre-compute road positions so every helper can share them -----------------
    this._mainRoadsX = [];
    this._mainRoadsZ = [];
    this._secRoadsX  = [];
    this._secRoadsZ  = [];

    for (let v = -this._half; v <= this._half; v += this._mainSpacing) {
      this._mainRoadsX.push(v);
      this._mainRoadsZ.push(v);
    }
    for (let v = -this._half; v <= this._half; v += this._secSpacing) {
      if (!this._mainRoadsX.includes(v)) this._secRoadsX.push(v);
      if (!this._mainRoadsZ.includes(v)) this._secRoadsZ.push(v);
    }

    this._allRoadsX = [...this._mainRoadsX, ...this._secRoadsX].sort((a, b) => a - b);
    this._allRoadsZ = [...this._mainRoadsZ, ...this._secRoadsZ].sort((a, b) => a - b);

    // Build! -------------------------------------------------------------------
    this._createGround();
    this._createRoads();
    this._createSidewalks();
    this._createBuildings();
    this._createStreetProps();

    scene.add(this._group);
  }

  // =========================================================================
  //  GROUND
  // =========================================================================
  _createGround() {
    const geo = new THREE.PlaneGeometry(1000, 1000);
    const mat = new THREE.MeshStandardMaterial({
      color: this._grassColor,
      roughness: 0.92,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    mesh.name = 'ground';
    this._group.add(mesh);
  }

  // =========================================================================
  //  ROADS  (merged into two meshes — EW & NS)
  // =========================================================================
  _createRoads() {
    // We merge every road strip, marking, and crosswalk into as few meshes as
    // possible.  Geometry is accumulated in arrays then merged via
    // BufferGeometryUtils-style manual merge (to avoid the addon import).

    const roadGeos     = [];
    const markingGeos  = [];
    const crosswalkGeos = [];

    const addRoadStrip = (cx, cz, length, width, alongX) => {
      const geo = new THREE.PlaneGeometry(
        alongX ? length : width,
        alongX ? width  : length,
      );
      geo.rotateX(-Math.PI / 2);
      geo.translate(cx, this._roadY, cz);
      roadGeos.push(geo);
    };

    const addDashedLine = (cx, cz, length, alongX, color) => {
      const dashLen = 3;
      const gapLen  = 3;
      const step    = dashLen + gapLen;
      const start   = alongX ? cx - length / 2 : cz - length / 2;
      const end     = alongX ? cx + length / 2 : cz + length / 2;
      const arr     = color === this._markingYellow ? markingGeos : markingGeos;

      for (let p = start; p < end; p += step) {
        const geo = new THREE.PlaneGeometry(
          alongX ? dashLen : 0.2,
          alongX ? 0.2     : dashLen,
        );
        geo.rotateX(-Math.PI / 2);
        const px = alongX ? p + dashLen / 2 : cx;
        const pz = alongX ? cz : p + dashLen / 2;
        geo.translate(px, this._markingY, pz);
        arr.push(geo);
      }
    };

    const addSolidLine = (cx, cz, length, alongX) => {
      const geo = new THREE.PlaneGeometry(
        alongX ? length : 0.15,
        alongX ? 0.15   : length,
      );
      geo.rotateX(-Math.PI / 2);
      geo.translate(cx, this._markingY, cz);
      markingGeos.push(geo);
    };

    const addCrosswalk = (cx, cz, roadWidth, alongX) => {
      const stripes = 6;
      const stripeW = 0.6;
      const gap     = 0.5;
      const total   = stripes * stripeW + (stripes - 1) * gap;
      const start   = -total / 2;
      for (let i = 0; i < stripes; i++) {
        const offset = start + i * (stripeW + gap) + stripeW / 2;
        const geo = new THREE.PlaneGeometry(
          alongX ? stripeW : roadWidth * 0.7,
          alongX ? roadWidth * 0.7 : stripeW,
        );
        geo.rotateX(-Math.PI / 2);
        const px = alongX ? cx + offset : cx;
        const pz = alongX ? cz : cz + offset;
        geo.translate(px, this._markingY + 0.001, pz);
        crosswalkGeos.push(geo);
      }
    };

    // Helper: width of the road at a given position
    const roadWidthAt = (pos, mainArr) => mainArr.includes(pos) ? this._mainRoadW : this._secRoadW;

    // East-West roads (along X) -------------------------------------------------
    const allZ = [...this._mainRoadsZ, ...this._secRoadsZ].sort((a, b) => a - b);
    for (const z of allZ) {
      const w = roadWidthAt(z, this._mainRoadsZ);
      addRoadStrip(0, z, this._citySize, w, true);

      // Yellow dashed center line
      addDashedLine(0, z, this._citySize, true, this._markingYellow);

      // White lane edge lines
      const laneOffset = w / 4;
      addSolidLine(0, z - laneOffset, this._citySize, true);
      addSolidLine(0, z + laneOffset, this._citySize, true);
    }

    // North-South roads (along Z) -----------------------------------------------
    const allX = [...this._mainRoadsX, ...this._secRoadsX].sort((a, b) => a - b);
    for (const x of allX) {
      const w = roadWidthAt(x, this._mainRoadsX);
      addRoadStrip(x, 0, this._citySize, w, false);

      addDashedLine(x, 0, this._citySize, false, this._markingYellow);

      const laneOffset = w / 4;
      addSolidLine(x - laneOffset, 0, this._citySize, false);
      addSolidLine(x + laneOffset, 0, this._citySize, false);
    }

    // Crosswalks at every intersection ------------------------------------------
    for (const x of allX) {
      for (const z of allZ) {
        const wX = roadWidthAt(x, this._mainRoadsX);
        const wZ = roadWidthAt(z, this._mainRoadsZ);
        // Crosswalk on the EW road, just outside the NS road
        addCrosswalk(x, z + wZ / 2 + 2, wX, false);
        addCrosswalk(x, z - wZ / 2 - 2, wX, false);
        // Crosswalk on the NS road, just outside the EW road
        addCrosswalk(x + wX / 2 + 2, z, wZ, true);
        addCrosswalk(x - wX / 2 - 2, z, wZ, true);
      }
    }

    // --- Merge & add ----------------------------------------------------------
    if (roadGeos.length > 0) {
      const merged = this._mergeBufferGeometries(roadGeos);
      const mat = new THREE.MeshStandardMaterial({
        color: this._roadColor,
        roughness: 0.85,
        metalness: 0.05,
      });
      const mesh = new THREE.Mesh(merged, mat);
      mesh.receiveShadow = true;
      mesh.name = 'roads';
      this._group.add(mesh);
    }

    if (markingGeos.length > 0) {
      const merged = this._mergeBufferGeometries(markingGeos);
      const mat = new THREE.MeshStandardMaterial({
        color: this._markingYellow,
        roughness: 0.5,
        metalness: 0.0,
        emissive: this._markingYellow,
        emissiveIntensity: 0.15,
      });
      const mesh = new THREE.Mesh(merged, mat);
      mesh.receiveShadow = true;
      mesh.name = 'road_markings';
      this._group.add(mesh);
    }

    if (crosswalkGeos.length > 0) {
      const merged = this._mergeBufferGeometries(crosswalkGeos);
      const mat = new THREE.MeshStandardMaterial({
        color: this._markingWhite,
        roughness: 0.5,
        metalness: 0.0,
      });
      const mesh = new THREE.Mesh(merged, mat);
      mesh.receiveShadow = true;
      mesh.name = 'crosswalks';
      this._group.add(mesh);
    }
  }

  // =========================================================================
  //  SIDEWALKS  (merged into one mesh)
  // =========================================================================
  _createSidewalks() {
    const geos = [];
    const sw   = this._sidewalkW;
    const h    = this._sidewalkY;

    // We extrude sidewalks as thin boxes so they have visible height
    const addSidewalkStrip = (cx, cz, length, width, alongX) => {
      const geo = new THREE.BoxGeometry(
        alongX ? length : width,
        h,
        alongX ? width  : length,
      );
      geo.translate(cx, h / 2, cz);
      geos.push(geo);
    };

    const allX = this._allRoadsX;
    const allZ = this._allRoadsZ;

    const roadW = (pos, mainArr) => mainArr.includes(pos) ? this._mainRoadW : this._secRoadW;

    // Sidewalks alongside EW roads
    for (const z of allZ) {
      const rw = roadW(z, this._mainRoadsZ);
      addSidewalkStrip(0, z - rw / 2 - sw / 2, this._citySize, sw, true);
      addSidewalkStrip(0, z + rw / 2 + sw / 2, this._citySize, sw, true);
    }

    // Sidewalks alongside NS roads
    for (const x of allX) {
      const rw = roadW(x, this._mainRoadsX);
      addSidewalkStrip(x - rw / 2 - sw / 2, 0, this._citySize, sw, false);
      addSidewalkStrip(x + rw / 2 + sw / 2, 0, this._citySize, sw, false);
    }

    if (geos.length > 0) {
      const merged = this._mergeBufferGeometries(geos);
      const mat = new THREE.MeshStandardMaterial({
        color: this._sidewalkColor,
        roughness: 0.9,
        metalness: 0.0,
      });
      const mesh = new THREE.Mesh(merged, mat);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      mesh.name = 'sidewalks';
      this._group.add(mesh);
    }
  }

  // =========================================================================
  //  BUILDINGS  (instanced by colour band + window emissive planes)
  // =========================================================================
  _createBuildings() {
    // Deterministic PRNG for reproducibility
    const rng = this._seededRandom(42);

    // Palette: urban facade colours
    const facadeColors = [
      0x8a8a8a, 0x6e6e6e, 0x9e9e9e, // grays
      0xb5a48c, 0xa89279, 0xc4b198, // tans / sandstone
      0x7a6e62, 0x6b5e52, 0x8c7f73, // browns
      0x6b7d8d, 0x7b8fa0, 0x5a6f7f, // blue-grays
      0xc2b8a3, 0xa69e8c,            // warm beige
    ];

    // Collect building data first, then batch by colour
    const buildingDefs = []; // { cx, cz, w, d, h, colorIdx }

    const allX = this._allRoadsX;
    const allZ = this._allRoadsZ;
    const roadW = (pos, mainArr) => mainArr.includes(pos) ? this._mainRoadW : this._secRoadW;

    // Iterate every city block (space between consecutive roads)
    for (let xi = 0; xi < allX.length - 1; xi++) {
      for (let zi = 0; zi < allZ.length - 1; zi++) {
        const x0 = allX[xi];
        const x1 = allX[xi + 1];
        const z0 = allZ[zi];
        const z1 = allZ[zi + 1];

        const rwLeft   = roadW(x0, this._mainRoadsX);
        const rwRight  = roadW(x1, this._mainRoadsX);
        const rwTop    = roadW(z0, this._mainRoadsZ);
        const rwBottom = roadW(z1, this._mainRoadsZ);

        // Usable interior of block (inside sidewalks + gap)
        const inset = this._sidewalkW + this._buildingGap;
        const bx0 = x0 + rwLeft  / 2 + inset;
        const bx1 = x1 - rwRight / 2 - inset;
        const bz0 = z0 + rwTop   / 2 + inset;
        const bz1 = z1 - rwBottom / 2 - inset;

        const blockW = bx1 - bx0;
        const blockD = bz1 - bz0;

        if (blockW < 10 || blockD < 10) continue; // too small

        // Fill block with buildings using a simple packing loop
        let curX = bx0;
        while (curX + 8 <= bx1) {
          let curZ = bz0;
          const bw = Math.min(bx1 - curX, 8 + Math.floor(rng() * 13)); // 8-20
          while (curZ + 8 <= bz1) {
            const bd = Math.min(bz1 - curZ, 8 + Math.floor(rng() * 13));
            const bh = 10 + Math.floor(rng() * 51); // 10-60
            const colorIdx = Math.floor(rng() * facadeColors.length);
            buildingDefs.push({
              cx: curX + bw / 2,
              cz: curZ + bd / 2,
              w: bw,
              d: bd,
              h: bh,
              colorIdx,
            });
            curZ += bd + 1.5; // small gap between buildings
          }
          curX += bw + 1.5;
        }
      }
    }

    // --- Batch buildings by colour using InstancedMesh -------------------------
    // Group indices by colour
    const byColor = {};
    for (let i = 0; i < buildingDefs.length; i++) {
      const ci = buildingDefs[i].colorIdx;
      if (!byColor[ci]) byColor[ci] = [];
      byColor[ci].push(i);
    }

    // Because buildings vary in size we cannot share a single unit-box instanced
    // mesh efficiently (non-uniform scale causes normal issues with shadows).
    // Instead we merge geometries per colour band, which keeps the mesh count at
    // ~14 and triangle count bounded.

    const windowGeos = []; // emissive planes collected globally then merged

    for (const ci of Object.keys(byColor)) {
      const indices = byColor[ci];
      const geos = [];

      for (const idx of indices) {
        const b = buildingDefs[idx];
        const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
        geo.translate(b.cx, b.h / 2, b.cz);
        geos.push(geo);

        // --- Windows on each face ---
        this._addWindowsToBuilding(b, rng, windowGeos);
      }

      const merged = this._mergeBufferGeometries(geos);
      const mat = new THREE.MeshStandardMaterial({
        color: facadeColors[ci],
        roughness: 0.75,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `buildings_color_${ci}`;
      this._group.add(mesh);
    }

    // --- Merge all window emissive planes into one mesh -----------------------
    if (windowGeos.length > 0) {
      const merged = this._mergeBufferGeometries(windowGeos);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        emissive: 0xffd88a,
        emissiveIntensity: 0.7,
        roughness: 0.3,
        metalness: 0.0,
      });
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = 'building_windows';
      this._group.add(mesh);
    }
  }

  /**
   * Add small emissive window planes to a building definition.
   */
  _addWindowsToBuilding(b, rng, windowGeos) {
    const winW   = 1.2;
    const winH   = 1.6;
    const spacH  = 3.5;  // floor-to-floor height
    const spacW  = 3.0;  // window spacing along wall
    const startY = 3;    // first window centre height

    const faces = [
      { axis: 'x', dir:  1, wallW: b.d, nx: b.cx + b.w / 2 + 0.05 },
      { axis: 'x', dir: -1, wallW: b.d, nx: b.cx - b.w / 2 - 0.05 },
      { axis: 'z', dir:  1, wallW: b.w, nz: b.cz + b.d / 2 + 0.05 },
      { axis: 'z', dir: -1, wallW: b.w, nz: b.cz - b.d / 2 - 0.05 },
    ];

    for (const face of faces) {
      const wallLen = face.wallW;
      const cols = Math.max(1, Math.floor((wallLen - 2) / spacW));
      const rows = Math.max(1, Math.floor((b.h - startY) / spacH));

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // ~60 % lit
          if (rng() > 0.6) continue;

          const y = startY + r * spacH;
          const offset = -wallLen / 2 + 1 + (c + 0.5) * ((wallLen - 2) / cols);

          let geo;
          if (face.axis === 'x') {
            geo = new THREE.PlaneGeometry(winW, winH);
            geo.rotateY(face.dir > 0 ? 0 : Math.PI);
            geo.translate(face.nx, y, b.cz + offset);
          } else {
            geo = new THREE.PlaneGeometry(winW, winH);
            geo.rotateY(face.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
            geo.translate(b.cx + offset, y, face.nz);
          }
          windowGeos.push(geo);
        }
      }
    }
  }

  // =========================================================================
  //  STREET PROPS — lamp posts + traffic lights
  // =========================================================================
  _createStreetProps() {
    const lampGeos       = [];      // geometry-only posts (no light)
    const lampBulbGeos   = [];      // bulb spheres (emissive)
    const trafficGeos    = [];      // traffic light housing
    const trafficRedGeos   = [];
    const trafficYelGeos   = [];
    const trafficGrnGeos   = [];

    const allX = this._allRoadsX;
    const allZ = this._allRoadsZ;
    const roadW = (pos, mainArr) => mainArr.includes(pos) ? this._mainRoadW : this._secRoadW;

    // ---- Lamp posts ----------------------------------------------------------
    // Place at intersections + along roads every ~30 u
    const lampPositions = [];

    // Intersection lamp posts (one at each corner)
    for (const x of allX) {
      for (const z of allZ) {
        const rwX = roadW(x, this._mainRoadsX);
        const rwZ = roadW(z, this._mainRoadsZ);
        const offset = 1; // just outside sidewalk on road side
        // Place at two opposing corners to avoid clutter
        lampPositions.push({ x: x + rwX / 2 + this._sidewalkW + offset, z: z + rwZ / 2 + this._sidewalkW + offset });
        lampPositions.push({ x: x - rwX / 2 - this._sidewalkW - offset, z: z - rwZ / 2 - this._sidewalkW - offset });
      }
    }

    // Mid-block lamp posts along NS roads
    for (const x of allX) {
      const rwX = roadW(x, this._mainRoadsX);
      for (let z = -this._half + 15; z < this._half; z += 30) {
        // Skip if too close to an intersection
        let tooClose = false;
        for (const rz of allZ) {
          if (Math.abs(z - rz) < 12) { tooClose = true; break; }
        }
        if (tooClose) continue;
        lampPositions.push({ x: x + rwX / 2 + this._sidewalkW + 1, z });
      }
    }

    // Create lamp geometry at each position
    const poleRadius = 0.15;
    const poleHeight = 7;
    const bulbRadius = 0.4;
    const armLength  = 2.5;

    for (let i = 0; i < lampPositions.length; i++) {
      const lp = lampPositions[i];

      // Pole (cylinder)
      const pole = new THREE.CylinderGeometry(poleRadius, poleRadius, poleHeight, 6);
      pole.translate(lp.x, poleHeight / 2, lp.z);
      lampGeos.push(pole);

      // Arm (horizontal cylinder)
      const arm = new THREE.CylinderGeometry(poleRadius * 0.7, poleRadius * 0.7, armLength, 4);
      arm.rotateZ(Math.PI / 2);
      arm.translate(lp.x + armLength / 2, poleHeight, lp.z);
      lampGeos.push(arm);

      // Bulb (sphere)
      const bulb = new THREE.SphereGeometry(bulbRadius, 8, 6);
      bulb.translate(lp.x + armLength, poleHeight, lp.z);
      lampBulbGeos.push(bulb);

      // Point light for a limited subset
      if (this._pointLightCount < this._maxPointLights) {
        const light = new THREE.PointLight(this._lampWarmColor, 0.5, 30, 1.5);
        light.position.set(lp.x + armLength, poleHeight - 0.3, lp.z);
        light.castShadow = false; // perf: no shadow from point lights
        this._group.add(light);
        this._pointLightCount++;
      }
    }

    // ---- Traffic lights at main intersections ---------------------------------
    const mainIntersections = [];
    for (const x of this._mainRoadsX) {
      for (const z of this._mainRoadsZ) {
        mainIntersections.push({ x, z });
      }
    }

    for (const inter of mainIntersections) {
      const rwX = roadW(inter.x, this._mainRoadsX);
      const rwZ = roadW(inter.z, this._mainRoadsZ);

      // Place two traffic lights per intersection (opposing corners)
      const corners = [
        { x: inter.x + rwX / 2 + 1, z: inter.z + rwZ / 2 + 1, rotY: Math.PI * 0.75 },
        { x: inter.x - rwX / 2 - 1, z: inter.z - rwZ / 2 - 1, rotY: -Math.PI * 0.25 },
      ];

      for (const c of corners) {
        // Pole
        const pole = new THREE.CylinderGeometry(0.12, 0.12, 5.5, 6);
        pole.translate(c.x, 2.75, c.z);
        trafficGeos.push(pole);

        // Housing (tall box)
        const housing = new THREE.BoxGeometry(0.6, 1.8, 0.6);
        housing.translate(c.x, 5.5 + 0.9, c.z);
        trafficGeos.push(housing);

        // Light discs (red, yellow, green — top to bottom)
        const discRadius = 0.18;
        const discGeo    = (yOff) => {
          const g = new THREE.CircleGeometry(discRadius, 8);
          g.rotateY(c.rotY);
          g.translate(c.x, 5.5 + 0.9 + yOff, c.z);
          return g;
        };
        trafficRedGeos.push(discGeo(0.55));
        trafficYelGeos.push(discGeo(0));
        trafficGrnGeos.push(discGeo(-0.55));
      }
    }

    // ---- Merge & add prop meshes ---------------------------------------------
    // Lamp poles
    if (lampGeos.length > 0) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6, metalness: 0.6 });
      const mesh = new THREE.Mesh(this._mergeBufferGeometries(lampGeos), mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = 'lamp_poles';
      this._group.add(mesh);
    }

    // Lamp bulbs (emissive)
    if (lampBulbGeos.length > 0) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        emissive: this._lampWarmColor,
        emissiveIntensity: 1.0,
        roughness: 0.2,
        metalness: 0.0,
      });
      const mesh = new THREE.Mesh(this._mergeBufferGeometries(lampBulbGeos), mat);
      mesh.name = 'lamp_bulbs';
      this._group.add(mesh);
    }

    // Traffic light housing
    if (trafficGeos.length > 0) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.3 });
      const mesh = new THREE.Mesh(this._mergeBufferGeometries(trafficGeos), mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = 'traffic_housing';
      this._group.add(mesh);
    }

    // Traffic light discs
    const addTrafficDiscs = (geos, color, emissiveColor, name) => {
      if (geos.length === 0) return;
      const mat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        emissive: emissiveColor,
        emissiveIntensity: 0.9,
        roughness: 0.3,
        metalness: 0.0,
      });
      const mesh = new THREE.Mesh(this._mergeBufferGeometries(geos), mat);
      mesh.name = name;
      this._group.add(mesh);
    };

    addTrafficDiscs(trafficRedGeos, 0xff0000, 0xff2222, 'traffic_red');
    addTrafficDiscs(trafficYelGeos, 0xffcc00, 0xffcc00, 'traffic_yellow');
    addTrafficDiscs(trafficGrnGeos, 0x00ff00, 0x22ff44, 'traffic_green');
  }

  // =========================================================================
  //  UTILITIES
  // =========================================================================

  /**
   * Merge an array of BufferGeometries into a single BufferGeometry.
   * This avoids importing BufferGeometryUtils from the addons.
   */
  _mergeBufferGeometries(geometries) {
    let totalVerts = 0;
    let totalIdx   = 0;

    // Determine which attributes are present across ALL geometries
    const attrs = new Set();
    for (const geo of geometries) {
      for (const name in geo.attributes) attrs.add(name);
      totalVerts += geo.attributes.position.count;
      if (geo.index) {
        totalIdx += geo.index.count;
      } else {
        totalIdx += geo.attributes.position.count;
      }
    }

    const mergedPositions = new Float32Array(totalVerts * 3);
    const mergedNormals   = attrs.has('normal') ? new Float32Array(totalVerts * 3) : null;
    const mergedUVs       = attrs.has('uv') ? new Float32Array(totalVerts * 2) : null;
    const mergedIndices   = new Uint32Array(totalIdx);

    let vertOffset = 0;
    let idxOffset  = 0;

    for (const geo of geometries) {
      const posArr = geo.attributes.position.array;
      const count  = geo.attributes.position.count;

      // Positions
      mergedPositions.set(posArr, vertOffset * 3);

      // Normals
      if (mergedNormals && geo.attributes.normal) {
        mergedNormals.set(geo.attributes.normal.array, vertOffset * 3);
      }

      // UVs
      if (mergedUVs && geo.attributes.uv) {
        mergedUVs.set(geo.attributes.uv.array, vertOffset * 2);
      }

      // Indices
      if (geo.index) {
        const idxArr = geo.index.array;
        for (let i = 0; i < idxArr.length; i++) {
          mergedIndices[idxOffset + i] = idxArr[i] + vertOffset;
        }
        idxOffset += idxArr.length;
      } else {
        for (let i = 0; i < count; i++) {
          mergedIndices[idxOffset + i] = vertOffset + i;
        }
        idxOffset += count;
      }

      vertOffset += count;
      geo.dispose();
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
    if (mergedNormals) merged.setAttribute('normal', new THREE.BufferAttribute(mergedNormals, 3));
    if (mergedUVs)     merged.setAttribute('uv', new THREE.BufferAttribute(mergedUVs, 2));
    merged.setIndex(new THREE.BufferAttribute(mergedIndices, 1));

    return merged;
  }

  /**
   * Simple seeded PRNG (mulberry32) for reproducible layouts.
   */
  _seededRandom(seed) {
    let s = seed | 0;
    return () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // =========================================================================
  //  DISPOSE
  // =========================================================================
  dispose() {
    this._group.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
    this._scene.remove(this._group);
  }
}

export default CityGenerator;
