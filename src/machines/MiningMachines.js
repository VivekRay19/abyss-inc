import * as THREE from 'three';

function createMachineMaterials() {
  let hazardTex = null;
  let subFaceTex = null;

  if (typeof document !== 'undefined') {
    // Procedural hazard stripe texture
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffc83d';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#182430';
    for (let i = -128; i < 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 16, 0);
      ctx.lineTo(i - 48, 128);
      ctx.lineTo(i - 64, 128);
      ctx.closePath();
      ctx.fill();
    }
    hazardTex = new THREE.CanvasTexture(canvas);
    hazardTex.wrapS = THREE.RepeatWrapping;
    hazardTex.wrapT = THREE.RepeatWrapping;

    // Friendly glowing digital face texture for NAUTILUS-IV companion sub (matching reference!)
    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = 256;
    faceCanvas.height = 128;
    const fctx = faceCanvas.getContext('2d');
    fctx.fillStyle = '#071826';
    fctx.fillRect(0, 0, 256, 128);
    fctx.shadowColor = '#38f4ff';
    fctx.shadowBlur = 14;
    fctx.fillStyle = '#70f8ff';
    // Left eye
    fctx.beginPath();
    fctx.arc(82, 54, 14, 0, Math.PI * 2);
    fctx.fill();
    // Right eye
    fctx.beginPath();
    fctx.arc(174, 54, 14, 0, Math.PI * 2);
    fctx.fill();
    // Friendly smile arc
    fctx.strokeStyle = '#70f8ff';
    fctx.lineWidth = 7;
    fctx.lineCap = 'round';
    fctx.beginPath();
    fctx.arc(128, 60, 22, 0.25 * Math.PI, 0.75 * Math.PI);
    fctx.stroke();
    subFaceTex = new THREE.CanvasTexture(faceCanvas);
  }

  return {
    yellowArmor: new THREE.MeshStandardMaterial({
      color: 0xffc83d,
      roughness: 0.34,
      metalness: 0.28
    }),
    whiteArmor: new THREE.MeshStandardMaterial({
      color: 0xe6f2fa,
      roughness: 0.3,
      metalness: 0.22
    }),
    orangeAccent: new THREE.MeshStandardMaterial({
      color: 0xff9b45,
      roughness: 0.38,
      metalness: 0.28
    }),
    darkChassis: new THREE.MeshStandardMaterial({
      color: 0x1a2a3a,
      roughness: 0.55,
      metalness: 0.65
    }),
    gunmetal: new THREE.MeshStandardMaterial({
      color: 0x354b60,
      roughness: 0.42,
      metalness: 0.75
    }),
    trackRubber: new THREE.MeshStandardMaterial({
      color: 0x151e28,
      roughness: 0.85,
      metalness: 0.25
    }),
    hazardStripe: new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.45,
      metalness: 0.3
    }),
    subFaceMat: new THREE.MeshBasicMaterial({ map: subFaceTex }),
    cyanLight: new THREE.MeshBasicMaterial({ color: 0x18c8da }),
    warmFloodlight: new THREE.MeshBasicMaterial({ color: 0xfff3c4 }),
    emeraldLight: new THREE.MeshBasicMaterial({ color: 0x55d99a }),
    amberStrobe: new THREE.MeshBasicMaterial({ color: 0xffb838 }),
    redStrobe: new THREE.MeshBasicMaterial({ color: 0xf16f75 }),
    bioWhite: new THREE.MeshStandardMaterial({
      color: 0xf0f8fc,
      roughness: 0.25,
      metalness: 0.2
    }),
    bioTeal: new THREE.MeshStandardMaterial({
      color: 0x18a89e,
      roughness: 0.35,
      metalness: 0.35
    })
  };
}

export class MiningFleetManager {
  constructor(scene, oceanEnv, ecosystem) {
    this.scene = scene;
    this.oceanEnv = oceanEnv;
    this.ecosystem = ecosystem;
    this.mats = createMachineMaterials();

    this.crawler = null;
    this.crawler2 = null; // Second Mining Machine for Player 2 (Co-op mode)
    this.submarine = null;
    this.surfaceVessel = null;
    this.restorationDrone = null;

    this.treadMarks = [];
    this.riserPulses = [];
    this.tetherSegments = [];

    this.crawler = this.createCrawlerInstance({
      id: 'crawler',
      name: 'TRITON-IX (P1)',
      fullName: 'TRITON-IX Seafloor Crawler',
      role: 'Operations Director Vehicle',
      playerLabel: 'P1 • OPERATIONS',
      badgeColorHex: 0xffc83d, // Amber gold
      ringColor: 0x18c8da,
      startX: -1.8,
      startZ: 0.6,
      rotY: 0.72
    });

    this.buildSupportSubmarine();
    this.buildSurfaceVesselAndRiser();
    this.buildRestorationDrone();
  }

  // =========================================================================
  // A. AUTONOMOUS SEAFLOOR MINING VEHICLE ("TRITON-IX" Heavy Tracked Crawler)
  // =========================================================================
  createCrawlerInstance(config = {}) {
    const root = new THREE.Group();
    const startX = config.startX !== undefined ? config.startX : -1.8;
    const startZ = config.startZ !== undefined ? config.startZ : 0.6;
    const startY = this.oceanEnv.getTerrainHeight(startX, startZ);
    root.position.set(startX, startY, startZ);
    root.rotation.y = config.rotY !== undefined ? config.rotY : 0.72;

    const ringColor = config.ringColor || 0x18c8da;
    // Selection indicator ring underneath machine
    const selRingGeo = new THREE.RingGeometry(2.75, 3.05, 36);
    selRingGeo.rotateX(-Math.PI / 2);
    const selRingMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const selectionRing = new THREE.Mesh(selRingGeo, selRingMat);
    selectionRing.position.y = 0.14;
    root.add(selectionRing);

    // Player Identification Floating Badge above the machine
    let playerBadgeMesh = null;
    if (typeof document !== 'undefined') {
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 256;
      labelCanvas.height = 64;
      const lctx = labelCanvas.getContext('2d');
      lctx.fillStyle = 'rgba(7, 26, 42, 0.85)';
      lctx.strokeStyle = config.badgeColorHex ? `#${config.badgeColorHex.toString(16).padStart(6, '0')}` : '#18c8da';
      lctx.lineWidth = 4;
      lctx.beginPath();
      lctx.roundRect(8, 8, 240, 48, 12);
      lctx.fill();
      lctx.stroke();

      lctx.fillStyle = '#ffffff';
      lctx.font = 'bold 22px Fredoka, Inter, sans-serif';
      lctx.textAlign = 'center';
      lctx.textBaseline = 'middle';
      lctx.fillText(config.playerLabel || 'TRITON-IX', 128, 32);

      const labelTex = new THREE.CanvasTexture(labelCanvas);
      const labelGeo = new THREE.PlaneGeometry(2.4, 0.6);
      const labelMat = new THREE.MeshBasicMaterial({
        map: labelTex,
        transparent: true,
        side: THREE.DoubleSide
      });
      playerBadgeMesh = new THREE.Mesh(labelGeo, labelMat);
      playerBadgeMesh.position.set(0, 3.6, 0);
      root.add(playerBadgeMesh);
    } else {
      playerBadgeMesh = new THREE.Object3D();
      root.add(playerBadgeMesh);
    }

    // 1. Dual Heavy Articulated Caterpillar Tracks (Left & Right)
    const wheelMeshes = [];
    const treadCleats = [];

    for (let side of [-1, 1]) {
      const trackGroup = new THREE.Group();
      trackGroup.position.set(side * 1.52, 0.56, 0);

      // Heavy armored track frame
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.72, 3.85),
        this.mats.darkChassis
      );
      frame.castShadow = true;
      trackGroup.add(frame);

      // Suspension bogie rail bar
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.74, 0.22, 3.1),
        this.mats.gunmetal
      );
      rail.position.y = -0.04;
      trackGroup.add(rail);

      // 6 Heavy Bogie Wheels + Drive Sprockets
      for (let wz of [-1.62, -0.96, -0.32, 0.32, 0.96, 1.62]) {
        const radius = Math.abs(wz) > 1.3 ? 0.4 : 0.31;
        const wheelGeo = new THREE.CylinderGeometry(radius, radius, 0.72, 12);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheel = new THREE.Mesh(wheelGeo, this.mats.gunmetal);
        wheel.position.set(0, -0.06, wz);
        trackGroup.add(wheel);
        wheelMeshes.push(wheel);
      }

      // 14 Chunky Track Tread Cleats looping around each track
      for (let c = 0; c < 14; c++) {
        const cleat = new THREE.Mesh(
          new THREE.BoxGeometry(0.72, 0.12, 0.24),
          this.mats.trackRubber
        );
        trackGroup.add(cleat);
        treadCleats.push({ mesh: cleat, offset: c / 14 });
      }

      root.add(trackGroup);
    }

    // 2. Heavy Industrial Main Chassis (Yellow, White & Dark Gunmetal like Reference)
    const chassisGroup = new THREE.Group();
    chassisGroup.position.y = 1.15;

    // Lower gunmetal chassis bed
    const lowerBed = new THREE.Mesh(
      new THREE.BoxGeometry(2.45, 0.45, 3.45),
      this.mats.darkChassis
    );
    lowerBed.position.y = -0.28;
    lowerBed.castShadow = true;
    chassisGroup.add(lowerBed);

    // Main yellow industrial body
    const mainHull = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.95, 3.15),
      this.mats.yellowArmor
    );
    mainHull.castShadow = true;
    mainHull.receiveShadow = true;
    chassisGroup.add(mainHull);

    // Upper white armored roof deck (matching reference TRITON-IX!)
    const whiteDeck = new THREE.Mesh(
      new THREE.BoxGeometry(2.15, 0.32, 2.65),
      this.mats.whiteArmor
    );
    whiteDeck.position.set(0, 0.54, -0.1);
    whiteDeck.castShadow = true;
    chassisGroup.add(whiteDeck);

    // Dark side vent windows & cyan telemetry strips on sides
    for (let sx of [-1.21, 1.21]) {
      for (let vz of [-0.85, 0.0, 0.85]) {
        const vent = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.36, 0.52),
          this.mats.darkChassis
        );
        vent.position.set(sx, 0.12, vz);
        chassisGroup.add(vent);
      }

      const cyanStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.08, 2.4),
        this.mats.cyanLight
      );
      cyanStrip.position.set(sx, -0.22, 0);
      chassisGroup.add(cyanStrip);
    }

    // 3. Rear Open-Top Ore Hopper & Umbilical Socket
    const hopperGroup = new THREE.Group();
    hopperGroup.position.set(0, 0.65, -0.75);

    const hopperBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.52, 1.45),
      this.mats.darkChassis
    );
    hopperBase.castShadow = true;
    hopperGroup.add(hopperBase);

    // Visual Ore Pile inside the hopper that scales up with storage capacity
    const orePileGroup = new THREE.Group();
    for (let n = 0; n < 12; n++) {
      const nod = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.25, 0),
        new THREE.MeshStandardMaterial({
          color: 0x1d2f40,
          emissive: n % 2 === 0 ? 0x18c8da : 0x39d9c4,
          emissiveIntensity: 0.75,
          roughness: 0.35,
          metalness: 0.7
        })
      );
      const nx = ((n % 3) - 1) * 0.44;
      const nz = (Math.floor(n / 3) - 1.2) * 0.34;
      nod.position.set(nx, 0.22 + (n % 2) * 0.14, nz);
      orePileGroup.add(nod);
    }
    orePileGroup.scale.set(1, 0.01, 1);
    orePileGroup.visible = false;
    hopperGroup.add(orePileGroup);
    chassisGroup.add(hopperGroup);

    // 4. Camera Sensor Mast & Beacon Strobe
    const mastGroup = new THREE.Group();
    mastGroup.position.set(0.68, 0.7, 0.85);
    const mastPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.75, 8),
      this.mats.gunmetal
    );
    mastPole.position.y = 0.35;
    mastGroup.add(mastPole);

    const sensorHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.24, 0.32),
      this.mats.yellowArmor
    );
    sensorHead.position.y = 0.78;
    mastGroup.add(sensorHead);

    const strobeBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      this.mats.amberStrobe
    );
    strobeBulb.position.set(0, 1.0, 0);
    mastGroup.add(strobeBulb);
    chassisGroup.add(mastGroup);

    // 5. Twin Warm-Gold Volumetric Floodlights Illuminating the Seabed Ahead (like Reference!)
    const floodlightCones = [];
    for (let lx of [-0.72, 0.72]) {
      const lampHousing = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.28, 0.32),
        this.mats.darkChassis
      );
      lampHousing.position.set(lx, 0.28, 1.62);
      chassisGroup.add(lampHousing);

      const lens = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 10),
        this.mats.warmFloodlight
      );
      lens.position.set(lx, 0.28, 1.76);
      chassisGroup.add(lens);

      // Warm golden-white volumetric light cone
      const coneGeo = new THREE.ConeGeometry(1.65, 5.2, 16, 1, true);
      coneGeo.translate(0, -2.6, 0);
      coneGeo.rotateX(-Math.PI / 2 + 0.34);
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xffe8a3,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(lx, 0.28, 1.78);
      chassisGroup.add(cone);
      floodlightCones.push(cone);
    }

    const frontLight = new THREE.PointLight(0xffe49e, 3.2, 12);
    frontLight.position.set(0, 1.2, 3.5);
    chassisGroup.add(frontLight);

    // 6. Heavy Articulated Yellow Hydraulic Boom & Multi-Head Nodule Cutter Drum (Matching Reference!)
    const boomPivot = new THREE.Group();
    boomPivot.position.set(0, 0.1, 1.55);

    // Dual heavy yellow hydraulic yoke arms
    for (let bx of [-0.52, 0.52]) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.32, 1.75),
        this.mats.yellowArmor
      );
      arm.position.set(bx, -0.18, 0.78);
      arm.rotation.x = 0.26;
      arm.castShadow = true;
      boomPivot.add(arm);

      const joint = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.36, 10),
        this.mats.darkChassis
      );
      joint.rotation.z = Math.PI / 2;
      joint.position.set(bx, 0.02, 0.15);
      boomPivot.add(joint);
    }

    // Multi-lobed Rotating Rock-Cutter & Nodule Harvester Head
    const cutterHead = new THREE.Group();
    cutterHead.position.set(0, -0.45, 1.72);

    const drumCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.46, 2.05, 12),
      this.mats.gunmetal
    );
    drumCore.rotation.z = Math.PI / 2;
    drumCore.castShadow = true;
    cutterHead.add(drumCore);

    // Cluster of rounded dark cutter lobes & glowing cyan teeth across the drum
    for (let t = 0; t < 12; t++) {
      const angle = (t / 12) * Math.PI * 2;
      const offsetX = ((t % 3) - 1) * 0.62;
      const lobe = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.32, 1),
        this.mats.darkChassis
      );
      lobe.position.set(offsetX, Math.cos(angle) * 0.42, Math.sin(angle) * 0.42);
      cutterHead.add(lobe);

      // Glowing cyan mineral tooth
      const glint = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.11, 0),
        this.mats.cyanLight
      );
      glint.position.set(offsetX, Math.cos(angle) * 0.64, Math.sin(angle) * 0.64);
      cutterHead.add(glint);
    }
    boomPivot.add(cutterHead);

    // Dual lateral stabilizer arms
    const leftClawArm = new THREE.Group();
    leftClawArm.position.set(-0.98, -0.1, 1.65);
    const clawSegment = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 1.05),
      this.mats.yellowArmor
    );
    clawSegment.position.z = 0.48;
    leftClawArm.add(clawSegment);
    chassisGroup.add(leftClawArm);

    const rightClawArm = leftClawArm.clone();
    rightClawArm.position.x = 0.98;
    chassisGroup.add(rightClawArm);

    chassisGroup.add(boomPivot);
    root.add(chassisGroup);

    const hitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(4.0, 3.0, 4.6),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitMesh.position.y = 1.4;
    root.add(hitMesh);

    this.scene.add(root);

    const crawlerObj = {
      id: config.id || 'crawler',
      name: config.name || 'TRITON-IX',
      fullName: config.fullName || 'TRITON-IX Seafloor Crawler',
      role: config.role || 'Heavy Polymetallic Extraction Vehicle',
      playerLabel: config.playerLabel || 'TRITON-IX',
      ownerRole: config.ownerRole || 'OPERATIONS_DIRECTOR',
      root,
      playerBadgeMesh,
      chassisGroup,
      selectionRing,
      wheelMeshes,
      treadCleats,
      boomPivot,
      cutterHead,
      leftClawArm,
      rightClawArm,
      orePileGroup,
      floodlightCones,
      sensorHead,
      strobeBulb,
      hitMesh,
      speed: 7.5,
      turnSpeed: 3.5,
      capacity: 0,
      maxCapacity: 100,
      cargoValue: 0,
      targetPos: null,
      targetDeposit: null,
      state: 'IDLE',
      trackProgress: 0,
      stepDist: 0,
      getIntakeWorldPosition: () => {
        const pos = new THREE.Vector3();
        cutterHead.getWorldPosition(pos);
        return pos;
      }
    };

    hitMesh.userData = { type: 'machine', machineId: crawlerObj.id };
    return crawlerObj;
  }

  ensureSecondCrawler() {
    if (this.crawler2) return this.crawler2;
    this.crawler2 = this.createCrawlerInstance({
      id: 'crawler2',
      name: 'TRITON-X (P2)',
      fullName: 'TRITON-X Research & Extraction Vehicle',
      role: 'Marine Scientist Mining Crawler',
      playerLabel: 'P2 • SCIENTIST',
      badgeColorHex: 0x39d9c4, // Cyan turquoise
      ringColor: 0x39d9c4,
      ownerRole: 'MARINE_SCIENTIST',
      startX: 3.5,
      startZ: 2.2,
      rotY: 2.45
    });
    return this.crawler2;
  }

  // =========================================================================
  // B. MINING SUPPORT SUBMARINE ("NAUTILUS-IV" Playful Companion Sub like Reference!)
  // =========================================================================
  buildSupportSubmarine() {
    const root = new THREE.Group();
    const startX = 3.2;
    const startZ = -1.2;
    const startY = this.oceanEnv.getTerrainHeight(startX, startZ) + 4.4;
    root.position.set(startX, startY, startZ);
    root.rotation.y = -0.55;

    const selRingGeo = new THREE.RingGeometry(1.9, 2.15, 28);
    selRingGeo.rotateX(-Math.PI / 2);
    const selectionRing = new THREE.Mesh(
      selRingGeo,
      new THREE.MeshBasicMaterial({
        color: 0x18c8da,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.0
      })
    );
    selectionRing.position.y = -3.8;
    root.add(selectionRing);

    const bodyGroup = new THREE.Group();

    // Playful rounded yellow submersible body (matching reference!)
    const hullGeo = new THREE.SphereGeometry(1.05, 18, 16);
    const hull = new THREE.Mesh(hullGeo, this.mats.yellowArmor);
    hull.scale.set(1.18, 0.96, 1.12);
    hull.castShadow = true;
    bodyGroup.add(hull);

    // Front Dark Bezel & Glowing Friendly Screen Face (• ◡ •)
    const bezelGeo = new THREE.CylinderGeometry(0.76, 0.82, 0.35, 18);
    bezelGeo.rotateX(Math.PI / 2);
    const bezel = new THREE.Mesh(bezelGeo, this.mats.darkChassis);
    bezel.position.set(0, 0.05, 0.98);
    bodyGroup.add(bezel);

    const screenGeo = new THREE.CircleGeometry(0.7, 18);
    const screen = new THREE.Mesh(screenGeo, this.mats.subFaceMat);
    screen.position.set(0, 0.05, 1.16);
    bodyGroup.add(screen);

    // Top roll-bar handle & sensor antennas
    const handleArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.07, 8, 16, Math.PI),
      this.mats.darkChassis
    );
    handleArch.position.set(0, 0.95, 0);
    bodyGroup.add(handleArch);

    // Side Thruster Pods & Propellers
    const propellers = [];
    for (let sx of [-1.25, 1.25]) {
      const pod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.65, 12),
        this.mats.darkChassis
      );
      pod.rotation.x = Math.PI / 2;
      pod.position.set(sx, -0.05, -0.1);
      bodyGroup.add(pod);

      const prop = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.08, 0.06),
        this.mats.orangeAccent
      );
      prop.position.set(sx, -0.05, -0.45);
      bodyGroup.add(prop);
      propellers.push(prop);
    }

    // Twin glowing cyan/white bottom headlights & downward light cone
    const sampleArms = new THREE.Group();
    for (let lx of [-0.52, 0.52]) {
      const lightOrb = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 10, 10),
        this.mats.cyanLight
      );
      lightOrb.position.set(lx, -0.68, 0.65);
      bodyGroup.add(lightOrb);
    }
    bodyGroup.add(sampleArms);

    const scanConeGeo = new THREE.ConeGeometry(1.5, 3.6, 16, 1, true);
    const scanConeMat = new THREE.MeshBasicMaterial({
      color: 0x70f8ff,
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const scanCone = new THREE.Mesh(scanConeGeo, scanConeMat);
    scanCone.position.set(0, -2.2, 0.35);
    bodyGroup.add(scanCone);

    root.add(bodyGroup);

    const hitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 2.6, 3.0),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    root.add(hitMesh);
    this.scene.add(root);

    this.submarine = {
      id: 'submarine',
      name: 'NAUTILUS-IV',
      fullName: 'NAUTILUS-IV Support Sub',
      role: 'Rapid Core Sampler & Ore Shuttle',
      root,
      bodyGroup,
      selectionRing,
      propellers,
      sampleArms,
      scanCone,
      hitMesh,
      speed: 10.5,
      turnSpeed: 4.2,
      capacity: 0,
      maxCapacity: 50,
      cargoValue: 0,
      targetPos: null,
      targetDeposit: null,
      autoPatrolAngle: 0,
      autonomous: true,
      state: 'SHUTTLING',
      getIntakeWorldPosition: () => {
        const pos = new THREE.Vector3();
        root.getWorldPosition(pos);
        return pos;
      }
    };

    hitMesh.userData = { type: 'machine', machineId: 'submarine' };
  }

  // =========================================================================
  // C. DETAILED INDUSTRIAL SURFACE VESSEL, CRANE, SKIMMER & TETHER
  // =========================================================================
  buildSurfaceVesselAndRiser() {
    const shipGroup = new THREE.Group();
    const surfaceY = 26.0;
    const hx = this.oceanEnv.riserHubPosition.x;
    const hz = this.oceanEnv.riserHubPosition.z;
    shipGroup.position.set(hx, surfaceY, hz);

    const hullNavyMat = new THREE.MeshStandardMaterial({
      color: 0x0d2d44,
      roughness: 0.42,
      metalness: 0.38
    });
    const keelRedMat = new THREE.MeshStandardMaterial({
      color: 0x8c2d22,
      roughness: 0.52,
      metalness: 0.25
    });
    const containerTealMat = new THREE.MeshStandardMaterial({
      color: 0x167d94,
      roughness: 0.48,
      metalness: 0.32
    });

    // 1. Lower Anti-Fouling Keel + Main Midship Hull + Tapered Bow Wedge
    const lowerKeel = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.95, 11.6), keelRedMat);
    lowerKeel.position.set(0, -0.55, -0.4);
    lowerKeel.castShadow = true;
    shipGroup.add(lowerKeel);

    const midHull = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.55, 11.4), hullNavyMat);
    midHull.position.set(0, 0.35, -0.5);
    midHull.castShadow = true;
    midHull.receiveShadow = true;
    shipGroup.add(midHull);

    // Sculpted V-Bow section at +Z front
    const bowGeo = new THREE.CylinderGeometry(0.2, 3.1, 3.8, 4);
    bowGeo.rotateX(Math.PI / 2);
    bowGeo.rotateZ(Math.PI / 4);
    const bowMesh = new THREE.Mesh(bowGeo, hullNavyMat);
    bowMesh.scale.set(1.0, 0.52, 1.0);
    bowMesh.position.set(0, 0.38, 6.8);
    bowMesh.castShadow = true;
    shipGroup.add(bowMesh);

    // Gunwale Hazard Stripe & Rubber Fenders along port/starboard sides
    for (let sx of [-3.16, 3.16]) {
      const bumper = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.28, 11.2),
        this.mats.hazardStripe
      );
      bumper.position.set(sx, 0.92, -0.5);
      shipGroup.add(bumper);

      for (let fz of [-4.5, -1.8, 0.9, 3.6]) {
        const tireFender = new THREE.Mesh(
          new THREE.TorusGeometry(0.32, 0.11, 8, 14),
          this.mats.trackRubber
        );
        tireFender.rotation.y = Math.PI / 2;
        tireFender.position.set(sx + (sx > 0 ? 0.08 : -0.08), 0.45, fz);
        shipGroup.add(tireFender);
      }
    }

    // 2. Non-Slip Steel Work Deck & Perimeter Safety Railings
    const deck = new THREE.Mesh(new THREE.BoxGeometry(5.85, 0.22, 11.2), this.mats.gunmetal);
    deck.position.set(0, 1.15, -0.5);
    deck.receiveShadow = true;
    shipGroup.add(deck);

    // Safety railings along port and starboard deck edges
    for (let sx of [-2.82, 2.82]) {
      const topRail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 10.6, 6),
        this.mats.yellowArmor
      );
      topRail.rotation.x = Math.PI / 2;
      topRail.position.set(sx, 1.82, -0.5);
      shipGroup.add(topRail);

      for (let rz = -5.4; rz <= 4.6; rz += 1.65) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 0.62, 6),
          this.mats.yellowArmor
        );
        post.position.set(sx, 1.52, rz);
        shipGroup.add(post);
      }
    }

    // 3. Multi-Tier Wheelhouse / Captain's Bridge (Forward Deck)
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(0, 1.25, 3.1);

    // Lower crew cabin with bevelled dark trim
    const lowerCabin = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.45, 3.2), this.mats.whiteArmor);
    lowerCabin.position.y = 0.72;
    lowerCabin.castShadow = true;
    bridgeGroup.add(lowerCabin);

    const cabinStripe = new THREE.Mesh(new THREE.BoxGeometry(4.46, 0.22, 3.26), containerTealMat);
    cabinStripe.position.y = 0.25;
    bridgeGroup.add(cabinStripe);

    // Upper panoramic wheelhouse
    const upperBridge = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.25, 2.6), this.mats.whiteArmor);
    upperBridge.position.set(0, 1.98, 0.1);
    upperBridge.castShadow = true;
    bridgeGroup.add(upperBridge);

    // Angled Sun Visor Roof
    const roofVisor = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.18, 3.0), this.mats.darkChassis);
    roofVisor.position.set(0, 2.65, 0.2);
    bridgeGroup.add(roofVisor);

    // Recessed Dark Window Frames + Glowing Cyan Instrument Windows (Front, Back & Sides)
    const frontWinFrame = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.68, 0.16), this.mats.darkChassis);
    frontWinFrame.position.set(0, 2.05, 1.36);
    bridgeGroup.add(frontWinFrame);

    for (let wx of [-1.05, 0, 1.05]) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.48, 0.18), this.mats.cyanLight);
      pane.position.set(wx, 2.05, 1.38);
      bridgeGroup.add(pane);
    }

    // Aft bridge window overlooking the work deck & crane
    const aftPane = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.45, 0.14), this.mats.cyanLight);
    aftPane.position.set(0, 2.05, -1.22);
    bridgeGroup.add(aftPane);

    // Twin Exhaust Stacks behind the wheelhouse
    for (let ex of [-1.35, 1.35]) {
      const stack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.28, 2.3, 10),
        this.mats.darkChassis
      );
      stack.position.set(ex, 1.65, -1.65);
      stack.castShadow = true;
      bridgeGroup.add(stack);

      const stackBand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.26, 0.32, 10),
        this.mats.yellowArmor
      );
      stackBand.position.set(ex, 2.35, -1.65);
      bridgeGroup.add(stackBand);
    }

    // Radar Mast, Rotating Scanner Bar & Navigation Lights
    const mastPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 1.45, 8),
      this.mats.gunmetal
    );
    mastPole.position.set(0, 3.4, 0.1);
    bridgeGroup.add(mastPole);

    const radarSpinner = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.14, 0.26),
      this.mats.whiteArmor
    );
    radarSpinner.position.set(0, 4.12, 0.1);
    bridgeGroup.add(radarSpinner);

    // Port (Red) & Starboard (Green) Running Lights
    const portLight = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), this.mats.redStrobe);
    portLight.position.set(-2.0, 2.1, 0.8);
    bridgeGroup.add(portLight);

    const stbdLight = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), this.mats.emeraldLight);
    stbdLight.position.set(2.0, 2.1, 0.8);
    bridgeGroup.add(stbdLight);

    shipGroup.add(bridgeGroup);

    // 4. Corrugated ISO Cargo Container & Coiled Winch Drum on Mid-Deck
    const containerGroup = new THREE.Group();
    containerGroup.position.set(-1.35, 1.82, -0.35);
    const isoBox = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.15, 2.45), containerTealMat);
    isoBox.castShadow = true;
    containerGroup.add(isoBox);

    // Corrugation ribs so it never looks like a plain box
    for (let cz = -0.9; cz <= 0.9; cz += 0.45) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(1.81, 1.05, 0.12), hullNavyMat);
      rib.position.z = cz;
      containerGroup.add(rib);
    }
    shipGroup.add(containerGroup);

    // Horizontal Oil Recovery Separator Tank & Piping
    const tankGroup = new THREE.Group();
    tankGroup.position.set(1.45, 1.82, 0.2);
    const sepTank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 2.2, 14),
      this.mats.orangeAccent
    );
    sepTank.rotation.x = Math.PI / 2;
    sepTank.castShadow = true;
    tankGroup.add(sepTank);

    for (let bz of [-0.7, 0.7]) {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.66, 0.66, 0.16, 14),
        this.mats.darkChassis
      );
      band.rotation.x = Math.PI / 2;
      band.position.z = bz;
      tankGroup.add(band);
    }
    shipGroup.add(tankGroup);

    // 5. Stern Articulated A-Frame Crane & Lowering Mechanism
    const craneGroup = new THREE.Group();
    craneGroup.position.set(0, 1.25, -4.6);

    const craneBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.78, 0.55, 12),
      this.mats.darkChassis
    );
    craneBase.position.y = 0.25;
    craneGroup.add(craneBase);

    const craneBoom = new THREE.Group();
    craneBoom.position.set(0, 0.55, 0);

    // Twin A-frame lattice arms
    for (let ax of [-0.48, 0.48]) {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 2.8, 0.32),
        this.mats.yellowArmor
      );
      pillar.position.set(ax, 1.3, -0.35);
      pillar.rotation.x = -0.22;
      pillar.castShadow = true;
      craneBoom.add(pillar);
    }

    const topJib = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.34, 4.2),
      this.mats.yellowArmor
    );
    topJib.position.set(0, 2.65, -2.1);
    topJib.castShadow = true;
    craneBoom.add(topJib);

    const pulleySheave = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.36, 0.42, 12),
      this.mats.darkChassis
    );
    pulleySheave.rotation.z = Math.PI / 2;
    pulleySheave.position.set(0, 2.55, -3.9);
    craneBoom.add(pulleySheave);

    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 4.2, 8),
      this.mats.darkChassis
    );
    cable.position.set(0, 0.3, -3.9);
    craneBoom.add(cable);

    craneGroup.add(craneBoom);
    shipGroup.add(craneGroup);

    // 6. Starboard Hinged Surface Oil Skimmer Boom & Rotating Collector Drum
    const skimmerGroup = new THREE.Group();
    skimmerGroup.position.set(2.85, 0.85, -0.6);

    const outriggerArm = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.22, 0.32),
      this.mats.yellowArmor
    );
    outriggerArm.position.set(1.3, -0.22, 0.4);
    outriggerArm.rotation.z = -0.18;
    skimmerGroup.add(outriggerArm);

    const outriggerAft = outriggerArm.clone();
    outriggerAft.position.z = -0.8;
    skimmerGroup.add(outriggerAft);

    // Floating orange containment pontoons & rotating skimmer drum on water surface
    const pontoon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 2.1, 12),
      this.mats.orangeAccent
    );
    pontoon.rotation.x = Math.PI / 2;
    pontoon.position.set(2.65, -0.68, -0.2);
    skimmerGroup.add(pontoon);

    const skimmerDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 1.35, 14),
      this.mats.hazardStripe
    );
    skimmerDrum.rotation.x = Math.PI / 2;
    skimmerDrum.position.set(2.25, -0.65, -0.2);
    skimmerGroup.add(skimmerDrum);

    shipGroup.add(skimmerGroup);
    this.scene.add(shipGroup);

    // 7. Segmented Umbilical Tether (visible when crawler is underwater or deploying)
    const segCount = 18;
    for (let i = 0; i < segCount; i++) {
      const isBand = i % 3 === 1;
      const segGeo = new THREE.CylinderGeometry(
        isBand ? 0.22 : 0.15,
        isBand ? 0.22 : 0.15,
        0.75,
        8
      );
      segGeo.rotateX(Math.PI / 2);
      const segMesh = new THREE.Mesh(
        segGeo,
        isBand ? this.mats.yellowArmor : this.mats.darkChassis
      );
      segMesh.castShadow = true;
      this.scene.add(segMesh);
      this.tetherSegments.push(segMesh);
    }

    this.surfaceVessel = {
      group: shipGroup,
      craneBoom,
      cable,
      skimmerGroup,
      skimmerDrum,
      radarSpinner,
      baseY: surfaceY
    };
  }

  spawnRiserOreTransfer() {
    const hx = this.oceanEnv.riserHubPosition.x;
    const hz = this.oceanEnv.riserHubPosition.z;
    const hy = this.oceanEnv.riserHubPosition.y + 2.5;
    for (let i = 0; i < 4; i++) {
      const pulse = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 10, 10),
        this.mats.cyanLight
      );
      pulse.position.set(hx, hy - i * 1.4, hz);
      this.scene.add(pulse);
      this.riserPulses.push(pulse);
    }
  }

  // =========================================================================
  // D. OCEAN RESTORATION DRONE ("AEGIS-BIO" Restoration ROV)
  // =========================================================================
  buildRestorationDrone() {
    const root = new THREE.Group();
    const startX = -9.5;
    const startZ = 3.5;
    const startY = this.oceanEnv.getTerrainHeight(startX, startZ) + 2.4;
    root.position.set(startX, startY, startZ);

    const selRingGeo = new THREE.RingGeometry(2.1, 2.35, 32);
    selRingGeo.rotateX(-Math.PI / 2);
    const selectionRing = new THREE.Mesh(
      selRingGeo,
      new THREE.MeshBasicMaterial({
        color: 0x55d99a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.0
      })
    );
    selectionRing.position.y = -2.1;
    root.add(selectionRing);

    const bodyGroup = new THREE.Group();

    const topShell = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.35, 0.68, 16),
      this.mats.bioWhite
    );
    topShell.castShadow = true;
    bodyGroup.add(topShell);

    const tealBand = new THREE.Mesh(
      new THREE.CylinderGeometry(1.38, 1.38, 0.22, 16),
      this.mats.bioTeal
    );
    tealBand.position.y = -0.05;
    bodyGroup.add(tealBand);

    const bioDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({
        color: 0x55d99a,
        emissive: 0x149e6b,
        emissiveIntensity: 0.75,
        roughness: 0.15,
        transparent: true,
        opacity: 0.88
      })
    );
    bioDome.position.y = 0.32;
    bodyGroup.add(bioDome);

    const hoverFans = [];
    const thrusterAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
    thrusterAngles.forEach((ang) => {
      const tx = Math.cos(ang) * 1.48;
      const tz = Math.sin(ang) * 1.48;

      const pod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 0.32, 12, 1, true),
        this.mats.bioTeal
      );
      pod.position.set(tx, 0, tz);
      bodyGroup.add(pod);

      const fan = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.05, 0.12),
        this.mats.emeraldLight
      );
      fan.position.set(tx, 0, tz);
      bodyGroup.add(fan);
      hoverFans.push(fan);
    });

    const repairArms = new THREE.Group();
    for (let sx of [-0.62, 0.62]) {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 1.15, 8),
        this.mats.bioWhite
      );
      arm.rotation.x = Math.PI / 2 + 0.38;
      arm.position.set(sx, -0.45, 0.85);
      repairArms.add(arm);

      const emitterTip = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 8, 8),
        this.mats.emeraldLight
      );
      emitterTip.position.set(sx, -0.68, 1.35);
      repairArms.add(emitterTip);
    }
    bodyGroup.add(repairArms);

    const laserBeamGeo = new THREE.ConeGeometry(2.15, 2.6, 20, 1, true);
    const laserBeamMat = new THREE.MeshBasicMaterial({
      color: 0x55d99a,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const laserBeam = new THREE.Mesh(laserBeamGeo, laserBeamMat);
    laserBeam.position.set(0, -1.35, 0);
    bodyGroup.add(laserBeam);

    root.add(bodyGroup);

    const hitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 2.4, 3.4),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    root.add(hitMesh);
    this.scene.add(root);

    this.restorationDrone = {
      id: 'drone',
      name: 'AEGIS-B10',
      fullName: 'AEGIS-B10 Restoration ROV',
      role: 'Seabed Remediation & Coral Seeding ROV',
      root,
      bodyGroup,
      selectionRing,
      hoverFans,
      repairArms,
      laserBeam,
      hitMesh,
      speed: 9.5,
      turnSpeed: 4.0,
      unlocked: true,
      targetPos: null,
      targetSite: null,
      state: 'STANDBY'
    };

    hitMesh.userData = { type: 'machine', machineId: 'drone' };
  }

  spawnCrawlerTreadMark(x, z, rotY) {
    const y = this.oceanEnv.getTerrainHeight(x, z) + 0.06;
    const markGroup = new THREE.Group();
    markGroup.position.set(x, y, z);
    markGroup.rotation.y = rotY;

    const markMat = new THREE.MeshBasicMaterial({
      color: 0x164459,
      transparent: true,
      opacity: 0.38,
      depthWrite: false
    });

    for (let sx of [-1.52, 1.52]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.44), markMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.x = sx;
      markGroup.add(strip);
    }

    this.scene.add(markGroup);
    this.treadMarks.push({ mesh: markGroup, mat: markMat, age: 0 });
  }

  update(dt, elapsed) {
    if (this.surfaceVessel) {
      const vx = this.surfaceVessel.group.position.x;
      const vz = this.surfaceVessel.group.position.z;
      const waveY =
        Math.sin(vx * 0.13 + elapsed * 1.45) * 0.22 +
        Math.cos(vz * 0.11 + elapsed * 1.15) * 0.18;
      this.surfaceVessel.group.position.y = this.surfaceVessel.baseY + waveY;
      this.surfaceVessel.group.rotation.z = Math.sin(elapsed * 1.3) * 0.025;
      this.surfaceVessel.group.rotation.x = Math.cos(elapsed * 1.1) * 0.018;

      if (this.surfaceVessel.radarSpinner) {
        this.surfaceVessel.radarSpinner.rotation.y += dt * 2.8;
      }
      if (this.surfaceVessel.skimmerDrum) {
        this.surfaceVessel.skimmerDrum.rotation.z += dt * 4.5;
      }
    }

    // Update 3D Segmented Umbilical Cable when crawler is underwater or deploying
    if (this.crawler && this.tetherSegments.length > 0) {
      const onBoatDeck = this.crawler.root.position.y >= 24.5;
      for (const seg of this.tetherSegments) {
        seg.visible = !onBoatDeck;
      }

      if (!onBoatDeck) {
        const start = new THREE.Vector3(
          this.oceanEnv.riserHubPosition.x + 1.5,
          this.oceanEnv.riserHubPosition.y + 1.6,
          this.oceanEnv.riserHubPosition.z + 1.5
        );
        const backOffset = new THREE.Vector3(0, 1.35, -1.65).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          this.crawler.root.rotation.y
        );
        const end = this.crawler.root.position.clone().add(backOffset);

        const n = this.tetherSegments.length;
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          const tNext = Math.min(1, (i + 1) / n);
          const px = THREE.MathUtils.lerp(start.x, end.x, t);
          const pz = THREE.MathUtils.lerp(start.z, end.z, t);
          const sag = -Math.sin(t * Math.PI) * 1.1;
          const groundY = this.oceanEnv.getTerrainHeight(px, pz) + 0.25;
          const py = Math.max(groundY, THREE.MathUtils.lerp(start.y, end.y, t) + sag);

          const nx = THREE.MathUtils.lerp(start.x, end.x, tNext);
          const nz = THREE.MathUtils.lerp(start.z, end.z, tNext);
          const ny = Math.max(
            this.oceanEnv.getTerrainHeight(nx, nz) + 0.25,
            THREE.MathUtils.lerp(start.y, end.y, tNext) - Math.sin(tNext * Math.PI) * 1.1
          );

          const seg = this.tetherSegments[i];
          seg.position.set(px, py, pz);
          seg.lookAt(nx, ny, nz);
        }
      }
    }

    // Animate Crawlers (Player 1 TRITON-IX & optional Player 2 TRITON-X)
    const crawlersToAnimate = [this.crawler, this.crawler2].filter(Boolean);
    for (const c of crawlersToAnimate) {
      c.sensorHead.rotation.y = Math.sin(elapsed * 1.5) * 0.65;

      const capRatio = c.capacity / c.maxCapacity;
      if (capRatio > 0.02) {
        c.orePileGroup.visible = true;
        c.orePileGroup.scale.set(1, 0.25 + capRatio * 1.15, 1);
      } else {
        c.orePileGroup.visible = false;
      }

      if (c.state === 'MINING') {
        c.cutterHead.rotation.x += dt * 14.0;
        c.boomPivot.rotation.x = 0.14 + Math.sin(elapsed * 12) * 0.05;
        c.leftClawArm.rotation.y = 0.22 + Math.sin(elapsed * 6) * 0.18;
        c.rightClawArm.rotation.y = -0.22 - Math.sin(elapsed * 6) * 0.18;
      } else {
        c.cutterHead.rotation.x += dt * (c.state === 'MOVING' ? 3.8 : 0.7);
        c.boomPivot.rotation.x = THREE.MathUtils.lerp(c.boomPivot.rotation.x, 0, dt * 4);
        c.leftClawArm.rotation.y = THREE.MathUtils.lerp(c.leftClawArm.rotation.y, 0, dt * 4);
        c.rightClawArm.rotation.y = THREE.MathUtils.lerp(c.rightClawArm.rotation.y, 0, dt * 4);
      }

      for (const cleat of c.treadCleats) {
        const p = (cleat.offset + c.trackProgress) % 1;
        if (p < 0.5) {
          const t = p * 2;
          cleat.mesh.position.set(0, 0.38, THREE.MathUtils.lerp(-1.72, 1.72, t));
        } else {
          const t = (p - 0.5) * 2;
          cleat.mesh.position.set(0, -0.38, THREE.MathUtils.lerp(1.72, -1.72, t));
        }
      }
    }

    // Animate NAUTILUS-IV Companion Sub
    if (this.submarine) {
      const sub = this.submarine;
      sub.bodyGroup.position.y = Math.sin(elapsed * 2.2) * 0.22;
      sub.bodyGroup.rotation.z = Math.sin(elapsed * 1.5) * 0.05;
      for (const prop of sub.propellers) {
        prop.rotation.z += dt * 18;
      }
    }

    // Animate AEGIS-BIO Restoration ROV
    if (this.restorationDrone) {
      const dr = this.restorationDrone;
      dr.bodyGroup.position.y = Math.sin(elapsed * 2.6) * 0.16;
      for (const fan of dr.hoverFans) {
        fan.rotation.y += dt * 20;
      }
      if (dr.state === 'RESTORING') {
        dr.laserBeam.material.opacity = 0.26 + Math.sin(elapsed * 10) * 0.08;
        dr.laserBeam.rotation.y += dt * 2.8;
        dr.repairArms.rotation.x = Math.sin(elapsed * 7) * 0.15;
      } else {
        dr.laserBeam.material.opacity = 0.07;
        dr.repairArms.rotation.x = 0;
      }
    }

    for (let i = this.riserPulses.length - 1; i >= 0; i--) {
      const p = this.riserPulses[i];
      p.position.y += dt * 14;
      if (p.position.y >= 12.0) {
        this.scene.remove(p);
        this.riserPulses.splice(i, 1);
      }
    }

    for (let i = this.treadMarks.length - 1; i >= 0; i--) {
      const tm = this.treadMarks[i];
      tm.age += dt;
      if (tm.age > 18) {
        this.scene.remove(tm.mesh);
        this.treadMarks.splice(i, 1);
      } else {
        tm.mat.opacity = 0.38 * (1 - tm.age / 18);
      }
    }
  }
}
