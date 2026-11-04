import * as THREE from 'three';

export class OceanEnvironment {
  constructor(scene) {
    this.scene = scene;
    this.worldSize = 84;
    this.gridDivisions = 7; // 7x7 = 49 localized ecosystem sectors
    this.sectors = [];
    this.terrainMesh = null;
    this.terrainGeo = null;
    this.baseVertexColors = null;
    this.causticsMesh = null;
    this.causticsTexture = null;
    this.waterSurface = null;
    this.lightShafts = [];
    this.beaconLights = [];
    this.pipelinePulses = [];
    this.hydroVents = [];
    // Position the main domed station hub in the upper-left canyon shelf like the reference
    this.riserHubPosition = new THREE.Vector3(-11, 0, -9);

    this.initSectors();
    this.buildLighting();
    this.buildTerrainAndDioramaBase();
    this.buildCausticsAndWaterSurface();
    this.buildGeologicalFormations();
    this.buildSubseaInfrastructure();
    this.buildAtmosphericParticles();
  }

  initSectors() {
    const cellSize = this.worldSize / this.gridDivisions;
    const half = this.worldSize / 2;

    for (let gz = 0; gz < this.gridDivisions; gz++) {
      for (let gx = 0; gx < this.gridDivisions; gx++) {
        const cx = -half + (gx + 0.5) * cellSize;
        const cz = -half + (gz + 0.5) * cellSize;
        this.sectors.push({
          id: `${gx}-${gz}`,
          gx,
          gz,
          x: cx,
          z: cz,
          health: 96,       // Starts at 96% like the reference HUD
          turbidity: 0,     // 0..100 local sediment cloud intensity
          minedCount: 0,
          restoredCount: 0
        });
      }
    }
  }

  // Sculpted canyon valley with flat sunlit sandy central floor & terraced cliff walls
  getTerrainHeight(x, z) {
    const distFromCenter = Math.hypot(x, z);

    // Central sandy canyon pathway running diagonally from NW station to SE basin
    const canyonAxisDist = Math.abs(x * 0.65 + z * 0.45) / 11.5;
    const valleyFloor = Math.min(1, canyonAxisDist * canyonAxisDist);

    const wave1 = Math.sin(x * 0.09) * Math.cos(z * 0.09) * 1.65;
    const wave2 = Math.sin(x * 0.18 + 1.1) * Math.sin(z * 0.16 - 0.5) * 0.75;

    // Stepped cliff terraces framing the left, back, and right sides
    const terraceRise = valleyFloor * 2.8;
    const rimFactor = Math.max(0, (distFromCenter - 25) / 15);
    const outerRim = Math.pow(rimFactor, 1.55) * 4.5;

    const rawHeight = (wave1 + wave2) * (0.35 + 0.65 * valleyFloor) + terraceRise + outerRim - 1.4;
    return Math.max(-3.2, Math.min(7.0, rawHeight));
  }

  getSectorAt(x, z) {
    const half = this.worldSize / 2;
    const cellSize = this.worldSize / this.gridDivisions;
    const gx = Math.max(0, Math.min(this.gridDivisions - 1, Math.floor((x + half) / cellSize)));
    const gz = Math.max(0, Math.min(this.gridDivisions - 1, Math.floor((z + half) / cellSize)));
    return this.sectors[gz * this.gridDivisions + gx];
  }

  damageSectorAt(x, z, healthLoss = 14, turbidityGain = 22) {
    const cellSize = this.worldSize / this.gridDivisions;
    const centerSector = this.getSectorAt(x, z);

    for (const sector of this.sectors) {
      const dist = Math.hypot(sector.x - x, sector.z - z);
      if (dist < cellSize * 1.45) {
        const falloff = Math.max(0.15, 1 - dist / (cellSize * 1.45));
        sector.health = Math.max(0, sector.health - healthLoss * falloff);
        sector.turbidity = Math.min(100, sector.turbidity + turbidityGain * falloff);
        if (sector === centerSector) sector.minedCount++;
      }
    }
    this.updateTerrainColors();
  }

  restoreSectorAt(x, z, healthGain = 22, turbidityClean = 32) {
    const cellSize = this.worldSize / this.gridDivisions;
    const centerSector = this.getSectorAt(x, z);

    for (const sector of this.sectors) {
      const dist = Math.hypot(sector.x - x, sector.z - z);
      if (dist < cellSize * 1.65) {
        const falloff = Math.max(0.2, 1 - dist / (cellSize * 1.65));
        sector.health = Math.min(100, sector.health + healthGain * falloff);
        sector.turbidity = Math.max(0, sector.turbidity - turbidityClean * falloff);
        if (sector === centerSector) sector.restoredCount++;
      }
    }
    this.updateTerrainColors();
  }

  getGlobalOceanHealth() {
    let sum = 0;
    for (const s of this.sectors) sum += s.health;
    return sum / this.sectors.length;
  }

  buildLighting() {
    // Rich turquoise-cobalt underwater atmosphere matching the reference image
    this.scene.background = new THREE.Color(0x07263d);
    this.scene.fog = new THREE.FogExp2(0x0a3552, 0.0072);

    // Bright turquoise-cyan surface light + deep ocean bounce
    const hemiLight = new THREE.HemisphereLight(0x68f4ff, 0x09243a, 1.55);
    hemiLight.position.set(0, 48, 0);
    this.scene.add(hemiLight);
    this.hemiLight = hemiLight;

    // Warm-cyan directional sunlight casting crisp shadows across the sandy canyon floor
    const sunLight = new THREE.DirectionalLight(0x9cf8ff, 2.1);
    sunLight.position.set(24, 50, 26);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 120;
    const d = 46;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);
    this.sunLight = sunLight;

    // Warm golden-amber fill light so yellow machinery and coral pop vibrantly
    const rimLight = new THREE.DirectionalLight(0xffd080, 0.65);
    rimLight.position.set(-28, 22, 18);
    this.scene.add(rimLight);
  }

  buildTerrainAndDioramaBase() {
    const segs = 112;
    const geo = new THREE.PlaneGeometry(this.worldSize, this.worldSize, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const posAttr = geo.attributes.position;
    const count = posAttr.count;
    const colors = new Float32Array(count * 3);
    this.baseVertexColors = new Float32Array(count * 3);

    // Palette matching the reference: sunlit turquoise-sandy seabed floor + deep teal cliff terraces
    const cSandyFloor = new THREE.Color(0x52cfc8);
    const cBrightSand = new THREE.Color(0x74dfd2);
    const cTurquoiseSlope = new THREE.Color(0x23899e);
    const cTealTerrace = new THREE.Color(0x13526e);
    const cDeepCliff = new THREE.Color(0x0b3149);
    const tempColor = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = this.getTerrainHeight(vx, vz);
      posAttr.setY(i, vy);

      if (vy < -0.6) {
        const t = Math.max(0, Math.min(1, (vy + 2.2) / 1.6));
        tempColor.lerpColors(cSandyFloor, cBrightSand, t);
      } else if (vy < 0.9) {
        const t = (vy + 0.6) / 1.5;
        tempColor.lerpColors(cBrightSand, cTurquoiseSlope, t);
      } else if (vy < 2.6) {
        const t = (vy - 0.9) / 1.7;
        tempColor.lerpColors(cTurquoiseSlope, cTealTerrace, t);
      } else {
        const t = Math.min(1, (vy - 2.6) / 3.2);
        tempColor.lerpColors(cTealTerrace, cDeepCliff, t);
      }

      const noise = (Math.sin(vx * 0.65) * Math.cos(vz * 0.65)) * 0.03;
      this.baseVertexColors[i * 3] = Math.max(0, Math.min(1, tempColor.r + noise));
      this.baseVertexColors[i * 3 + 1] = Math.max(0, Math.min(1, tempColor.g + noise));
      this.baseVertexColors[i * 3 + 2] = Math.max(0, Math.min(1, tempColor.b + noise));

      colors[i * 3] = this.baseVertexColors[i * 3];
      colors[i * 3 + 1] = this.baseVertexColors[i * 3 + 1];
      colors[i * 3 + 2] = this.baseVertexColors[i * 3 + 2];
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.06,
      flatShading: true
    });

    this.terrainMesh = new THREE.Mesh(geo, mat);
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.name = 'SeabedTerrain';
    this.scene.add(this.terrainMesh);
    this.terrainGeo = geo;

    this.riserHubPosition.set(-11, this.getTerrainHeight(-11, -9), -9);

    // Diorama Pedestal Base
    const pedestalGroup = new THREE.Group();
    const baseDepth = 9.5;
    const strataGeo = new THREE.BoxGeometry(this.worldSize + 0.6, baseDepth, this.worldSize + 0.6);
    const strataMat = new THREE.MeshStandardMaterial({
      color: 0x071c2b,
      roughness: 0.9,
      metalness: 0.15
    });
    const strataMesh = new THREE.Mesh(strataGeo, strataMat);
    strataMesh.position.y = -baseDepth / 2 - 2.2;
    pedestalGroup.add(strataMesh);
    this.scene.add(pedestalGroup);
  }

  updateTerrainColors() {
    if (!this.terrainGeo) return;
    const posAttr = this.terrainGeo.attributes.position;
    const colAttr = this.terrainGeo.attributes.color;
    const count = posAttr.count;

    const cModerateScar = new THREE.Color(0x525748); // Muddy disturbed silt
    const cSevereScar = new THREE.Color(0x302620);   // Dark scarred crater sludge
    const cRestoredGlow = new THREE.Color(0x55d99a); // Healthy restored emerald-turquoise tint
    const baseC = new THREE.Color();
    const finalC = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const sector = this.getSectorAt(vx, vz);

      baseC.setRGB(
        this.baseVertexColors[i * 3],
        this.baseVertexColors[i * 3 + 1],
        this.baseVertexColors[i * 3 + 2]
      );

      if (sector.health >= 75) {
        finalC.copy(baseC);
        if (sector.restoredCount > 0) {
          finalC.lerp(cRestoredGlow, 0.18);
        }
      } else if (sector.health >= 35) {
        const damageRatio = (75 - sector.health) / 40;
        finalC.copy(baseC).lerp(cModerateScar, damageRatio * 0.72);
      } else {
        const severeRatio = (35 - sector.health) / 35;
        finalC.copy(baseC).lerp(cModerateScar, 0.72).lerp(cSevereScar, severeRatio * 0.85);
      }

      colAttr.setXYZ(i, finalC.r, finalC.g, finalC.b);
    }

    colAttr.needsUpdate = true;
  }

  buildCausticsAndWaterSurface() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = 'rgba(110, 248, 255, 0.34)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 36; i++) {
      const cx = (Math.sin(i * 17.3) * 0.5 + 0.5) * 256;
      const cy = (Math.cos(i * 23.7) * 0.5 + 0.5) * 256;
      const r = 18 + (i % 5) * 9;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    this.causticsTexture = new THREE.CanvasTexture(canvas);
    this.causticsTexture.wrapS = THREE.RepeatWrapping;
    this.causticsTexture.wrapT = THREE.RepeatWrapping;
    this.causticsTexture.repeat.set(7, 7);

    const causticGeo = new THREE.PlaneGeometry(this.worldSize - 2, this.worldSize - 2, 48, 48);
    causticGeo.rotateX(-Math.PI / 2);
    const pos = causticGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, this.getTerrainHeight(x, z) + 0.09);
    }
    causticGeo.computeVertexNormals();

    const causticMat = new THREE.MeshBasicMaterial({
      map: this.causticsTexture,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.causticsMesh = new THREE.Mesh(causticGeo, causticMat);
    this.scene.add(this.causticsMesh);

    // Upper Ocean Surface Plane
    const waterGeo = new THREE.PlaneGeometry(this.worldSize, this.worldSize, 24, 24);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x22a8c4,
      emissive: 0x06354a,
      roughness: 0.18,
      metalness: 0.1,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.waterSurface = new THREE.Mesh(waterGeo, waterMat);
    this.waterSurface.position.y = 26;
    this.scene.add(this.waterSurface);

    // Sunlit Volumetric Light Rays piercing down from the surface
    const shaftPositions = [
      [-14, 14, -10],
      [4, 14, -14],
      [14, 14, -4],
      [-6, 14, 12],
      [12, 14, 10]
    ];

    const shaftMat = new THREE.MeshBasicMaterial({
      color: 0x7ef8ff,
      transparent: true,
      opacity: 0.065,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    shaftPositions.forEach(([sx, sy, sz], idx) => {
      const coneGeo = new THREE.CylinderGeometry(2.2, 7.0, 28, 16, 1, true);
      const shaft = new THREE.Mesh(coneGeo, shaftMat.clone());
      shaft.position.set(sx, sy, sz);
      shaft.rotation.z = -0.22;
      shaft.rotation.x = 0.12;
      shaft.userData = { baseOpacity: 0.055 + (idx % 3) * 0.015, phase: idx * 1.4 };
      this.scene.add(shaft);
      this.lightShafts.push(shaft);
    });
  }

  buildGeologicalFormations() {
    // Stepped dark-teal cliff blocks & rocky ledges framing the canyon like the reference image
    const cliffMat = new THREE.MeshStandardMaterial({
      color: 0x0f3d56,
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true
    });
    const cliffLightMat = new THREE.MeshStandardMaterial({
      color: 0x165370,
      roughness: 0.8,
      metalness: 0.12,
      flatShading: true
    });

    const cliffSpecs = [
      // Back & Right canyon ridge formations
      [4, -18, 5.5, 6.2],
      [12, -16, 4.8, 5.4],
      [20, -12, 5.2, 6.8],
      [18, -3, 4.2, 4.5],
      [15, 7, 4.0, 4.2],
      // Left & Foreground ridge outcrops
      [-20, -4, 4.8, 5.5],
      [-18, 6, 4.2, 4.6],
      [-26, -16, 5.5, 7.2],
      [-28, 18, 5.0, 6.4],
      [26, 20, 5.2, 6.5],
      [-4, -24, 5.0, 6.8],
      [28, -22, 5.8, 7.5]
    ];

    cliffSpecs.forEach(([rx, rz, radius, height], idx) => {
      const group = new THREE.Group();
      const baseH = this.getTerrainHeight(rx, rz);

      // Stylized faceted rock block
      const rockGeo = new THREE.CylinderGeometry(radius * 0.78, radius * 1.08, height, 7);
      const pos = rockGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vz = pos.getZ(i);
        const jitter = Math.sin(vx * 1.7 + idx) * 0.35;
        pos.setX(i, vx + jitter);
        pos.setZ(i, vz - jitter * 0.7);
      }
      rockGeo.computeVertexNormals();

      const rock = new THREE.Mesh(rockGeo, idx % 2 === 0 ? cliffMat : cliffLightMat);
      rock.castShadow = true;
      rock.receiveShadow = true;
      group.add(rock);

      group.position.set(rx, baseH + height * 0.38, rz);
      group.rotation.y = idx * 0.9;
      this.scene.add(group);
    });
  }

  buildSubseaInfrastructure() {
    const whiteDomeMat = new THREE.MeshStandardMaterial({
      color: 0xdcebf5,
      roughness: 0.32,
      metalness: 0.25
    });
    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x1b3144,
      roughness: 0.5,
      metalness: 0.65
    });
    const gunmetalMat = new THREE.MeshStandardMaterial({
      color: 0x2d4860,
      roughness: 0.45,
      metalness: 0.55
    });
    const warmAmberMat = new THREE.MeshBasicMaterial({ color: 0xffb838 });
    const cyanGlowMat = new THREE.MeshBasicMaterial({ color: 0x18c8da });

    // =========================================================================
    // 1. MAIN WHITE DOMED MINING & ORE PROCESSING STATION (Upper-Left like Reference)
    // =========================================================================
    const mainHub = new THREE.Group();
    const hx = this.riserHubPosition.x;
    const hz = this.riserHubPosition.z;
    const hy = this.riserHubPosition.y;

    // Circular base foundation pad
    const basePad = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.9, 0.7, 16),
      gunmetalMat
    );
    basePad.position.y = 0.35;
    basePad.receiveShadow = true;
    mainHub.add(basePad);

    // Glowing cyan/green docking ring
    const dockRingGeo = new THREE.RingGeometry(4.6, 4.95, 32);
    dockRingGeo.rotateX(-Math.PI / 2);
    this.hubDockRing = new THREE.Mesh(
      dockRingGeo,
      new THREE.MeshBasicMaterial({
        color: 0x39d9c4,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65
      })
    );
    this.hubDockRing.position.y = 0.14;
    mainHub.add(this.hubDockRing);

    // 6 Heavy vertical support legs around the perimeter (matching reference!)
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const lx = Math.cos(ang) * 3.4;
      const lz = Math.sin(ang) * 3.4;
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.32, 3.8, 10),
        darkSteelMat
      );
      leg.position.set(lx, 2.1, lz);
      leg.castShadow = true;
      mainHub.add(leg);

      // Amber ring joint on each leg
      const legRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.18, 10),
        warmAmberMat
      );
      legRing.position.set(lx, 1.3, lz);
      mainHub.add(legRing);
    }

    // Lower dark industrial substructure with glowing warm amber windows
    const lowerCore = new THREE.Mesh(
      new THREE.CylinderGeometry(2.8, 3.0, 2.2, 16),
      darkSteelMat
    );
    lowerCore.position.y = 1.8;
    mainHub.add(lowerCore);

    // Warm amber light panels around lower hull
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + 0.2;
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.38, 0.2),
        warmAmberMat
      );
      win.position.set(Math.cos(ang) * 2.85, 2.1, Math.sin(ang) * 2.85);
      win.rotation.y = -ang + Math.PI / 2;
      mainHub.add(win);
    }

    // Upper Large White Cylindrical & Domed Hull (matching the iconic top-left building in reference!)
    const upperHull = new THREE.Mesh(
      new THREE.CylinderGeometry(3.55, 3.55, 2.1, 20),
      whiteDomeMat
    );
    upperHull.position.y = 3.6;
    upperHull.castShadow = true;
    mainHub.add(upperHull);

    const topCap = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 3.5, 0.85, 20),
      whiteDomeMat
    );
    topCap.position.y = 5.05;
    topCap.castShadow = true;
    mainHub.add(topCap);

    const topHatch = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.25, 0.45, 12),
      gunmetalMat
    );
    topHatch.position.y = 5.65;
    mainHub.add(topHatch);

    // Warm point light under the main station
    const stationLight = new THREE.PointLight(0xffb838, 2.2, 14);
    stationLight.position.set(0, 2.4, 2.5);
    mainHub.add(stationLight);

    mainHub.position.set(hx, hy, hz);
    this.scene.add(mainHub);

    // =========================================================================
    // 2. SECONDARY AUXILIARY PROCESSING POD (Behind Main Hub, matching Reference)
    // =========================================================================
    const auxX = -4.5;
    const auxZ = -13.5;
    const auxY = this.getTerrainHeight(auxX, auxZ);
    const auxGroup = new THREE.Group();

    const auxBase = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.5, 1.1, 14),
      whiteDomeMat
    );
    auxBase.position.y = 0.65;
    auxBase.castShadow = true;
    auxGroup.add(auxBase);

    // Twin vertical tower chimneys
    for (let tx of [-0.6, 0.7]) {
      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 3.4, 8),
        darkSteelMat
      );
      spire.position.set(tx, 2.4, 0);
      auxGroup.add(spire);
    }

    const auxGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 8),
      warmAmberMat
    );
    auxGlow.position.set(0, 1.5, 1.8);
    auxGroup.add(auxGlow);

    auxGroup.position.set(auxX, auxY, auxZ);
    this.scene.add(auxGroup);

    // =========================================================================
    // 3. FOREGROUND RELAY BEACON POD (Bottom-Left like Reference!)
    // =========================================================================
    const fgX = -14.5;
    const fgZ = 8.5;
    const fgY = this.getTerrainHeight(fgX, fgZ);
    const fgPod = new THREE.Group();

    const podHull = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.6, 1.6, 14),
      whiteDomeMat
    );
    podHull.position.y = 0.8;
    podHull.castShadow = true;
    fgPod.add(podHull);

    // Tall central orange beacon mast
    const antennaMast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.2, 3.8, 8),
      darkSteelMat
    );
    antennaMast.position.y = 2.8;
    fgPod.add(antennaMast);

    for (let ringY of [2.4, 3.4, 4.5]) {
      const beaconBulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 10),
        warmAmberMat.clone()
      );
      beaconBulb.position.y = ringY;
      fgPod.add(beaconBulb);
      this.beaconLights.push({ mesh: beaconBulb, phase: ringY });
    }

    // Pipeline connecting Foreground Pod to Main Hub
    this.buildSubseaPipeline(
      new THREE.Vector3(fgX, fgY + 0.6, fgZ),
      new THREE.Vector3(hx, hy + 0.8, hz)
    );

    fgPod.position.set(fgX, fgY, fgZ);
    this.scene.add(fgPod);
  }

  buildSubseaPipeline(startVec, endVec) {
    const points = [];
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = THREE.MathUtils.lerp(startVec.x, endVec.x, t);
      const pz = THREE.MathUtils.lerp(startVec.z, endVec.z, t);
      const py = this.getTerrainHeight(px, pz) + 0.28;
      points.push(new THREE.Vector3(px, py, pz));
    }

    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeo = new THREE.TubeGeometry(curve, 28, 0.22, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x1c3a52,
      roughness: 0.5,
      metalness: 0.55
    });
    const pipe = new THREE.Mesh(tubeGeo, tubeMat);
    pipe.castShadow = true;
    this.scene.add(pipe);

    const pulseGeo = new THREE.SphereGeometry(0.28, 8, 8);
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0x18c8da });
    const pulse = new THREE.Mesh(pulseGeo, pulseMat);
    this.scene.add(pulse);
    this.pipelinePulses.push({ mesh: pulse, curve, progress: Math.random() });
  }

  buildAtmosphericParticles() {
    const count = 380;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const cCyan = new THREE.Color(0x68f4ff);
    const cSeafoam = new THREE.Color(0x55d99a);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * (this.worldSize - 6);
      positions[i * 3 + 1] = Math.random() * 23 + 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * (this.worldSize - 6);

      const c = i % 2 === 0 ? cCyan : cSeafoam;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.marineSnow = new THREE.Points(geo, mat);
    this.scene.add(this.marineSnow);
  }

  update(dt, elapsed) {
    if (this.causticsTexture) {
      this.causticsTexture.offset.x = elapsed * 0.022;
      this.causticsTexture.offset.y = Math.sin(elapsed * 0.4) * 0.04 + elapsed * 0.014;
    }

    if (this.hubDockRing) {
      const s = 1 + Math.sin(elapsed * 3.0) * 0.03;
      this.hubDockRing.scale.set(s, s, 1);
      this.hubDockRing.material.opacity = 0.45 + Math.sin(elapsed * 3.0) * 0.2;
    }

    for (const shaft of this.lightShafts) {
      shaft.material.opacity =
        shaft.userData.baseOpacity + Math.sin(elapsed * 1.3 + shaft.userData.phase) * 0.016;
    }

    for (const b of this.beaconLights) {
      const pulse = (Math.sin(elapsed * 4.5 + b.phase) + 1) * 0.5;
      b.mesh.scale.setScalar(0.85 + pulse * 0.32);
    }

    for (const p of this.pipelinePulses) {
      p.progress = (p.progress + dt * 0.22) % 1;
      const pt = p.curve.getPointAt(p.progress);
      p.mesh.position.copy(pt);
    }

    if (this.marineSnow) {
      this.marineSnow.rotation.y = elapsed * 0.015;
      const pos = this.marineSnow.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let py = pos.getY(i) - dt * 0.22;
        if (py < 0.2) py = 23.5;
        pos.setY(i, py);
      }
      pos.needsUpdate = true;
    }

    const globalHealth = this.getGlobalOceanHealth();
    const healthNorm = globalHealth / 100;
    const healthyFog = new THREE.Color(0x0a3552);
    const pollutedFog = new THREE.Color(0x182a34);
    this.scene.fog.color.lerpColors(pollutedFog, healthyFog, healthNorm);
    this.scene.fog.density = THREE.MathUtils.lerp(0.0108, 0.0072, healthNorm);
  }
}
