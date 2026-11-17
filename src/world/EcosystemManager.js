import * as THREE from 'three';

export class EcosystemManager {
  constructor(scene, oceanEnv) {
    this.scene = scene;
    this.oceanEnv = oceanEnv;

    this.deposits = [];
    this.corals = [];
    this.fishSchools = [];
    this.jellyfish = [];
    this.mantaRays = [];
    this.sedimentPlumes = [];
    this.damagedSites = [];
    this.flyingNodules = [];
    this.transientParticles = [];

    this.noduleDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1a2c3d,
      roughness: 0.48,
      metalness: 0.72,
      flatShading: true
    });

    this.buildMineralDeposits();
    this.buildCoralReefsAndFlora();
    this.buildMarineLife();
  }

  buildMineralDeposits() {
    // 8 finite mineral deposits in the connected canyon (total = 240t)
    const depositSpecs = [
      { id: 'dep-1', zoneId: 'nodule_fields', name: 'Central Canyon Bed', type: 'Cobalt-Rich Nodules', x: 1.5, z: 3.5, yieldPerTon: 2800, maxTons: 35, color: 0x18c8da },
      { id: 'dep-2', zoneId: 'nodule_fields', name: 'Clarion Sandy Terrace', type: 'Polymetallic Nodules', x: -6.5, z: 1.5, yieldPerTon: 2800, maxTons: 30, color: 0x39d9c4 },
      { id: 'dep-3', zoneId: 'nodule_fields', name: 'Pelagic Plain West', type: 'Polymetallic Nodules', x: 4.0, z: -5.5, yieldPerTon: 2800, maxTons: 30, color: 0x18c8da },
      { id: 'dep-4', zoneId: 'nodule_fields', name: 'Reef Edge Sulfide Vein', type: 'Hydrothermal Sulfides', x: 10.5, z: 3.0, yieldPerTon: 2800, maxTons: 30, color: 0xffc83d },
      { id: 'dep-5', zoneId: 'nodule_fields', name: 'South Ridge Deposit', type: 'Manganese-Nickel Bed', x: -3.0, z: 11.5, yieldPerTon: 2800, maxTons: 25, color: 0xff9b45 },
      { id: 'dep-6', zoneId: 'nodule_fields', name: 'East Basin Motherlode', type: 'Cobalt-Rich Crust', x: 15.5, z: -3.5, yieldPerTon: 3100, maxTons: 30, color: 0x70f8ff },
      { id: 'dep-7', zoneId: 'nodule_fields', name: 'North Canyon Shelf', type: 'Hydrothermal Sulfides', x: -12.0, z: 8.5, yieldPerTon: 3000, maxTons: 30, color: 0x39d9c4 },
      { id: 'dep-8', zoneId: 'nodule_fields', name: 'Deep Trench Outcrop', type: 'Rare-Earth Tellurium', x: 12.0, z: 13.5, yieldPerTon: 3200, maxTons: 30, color: 0xffc83d }
    ];

    depositSpecs.forEach((spec) => this.createSingleDeposit(spec));
  }

  damageNearbyCorals(x, z, amount = 0.2) {
    const siltColor = new THREE.Color(0x5d5b4e);
    for (const c of this.corals) {
      const dist = Math.hypot(c.x - x, c.z - z);
      if (dist < 18) {
        c.damageLevel = Math.min(1, (c.damageLevel || 0) + amount * (1 - dist / 18));
        c.mat1.color.copy(c.origColor1).lerp(siltColor, c.damageLevel * 0.85);
        c.mat2.color.copy(c.origColor2).lerp(siltColor, c.damageLevel * 0.85);
        c.frondMat.color.copy(c.origFrond).lerp(siltColor, c.damageLevel * 0.85);
        c.mat1.emissiveIntensity = Math.max(0.05, 0.55 * (1 - c.damageLevel));
        c.mat2.emissiveIntensity = Math.max(0.05, 0.55 * (1 - c.damageLevel));
      }
    }
  }

  updateCoralRecoveryVisuals(recoveryRatio) {
    const siltColor = new THREE.Color(0x5d5b4e);
    const t = Math.max(0, Math.min(1, recoveryRatio));
    for (const c of this.corals) {
      const targetDmg = (c.damageLevel || 0) * (1 - t);
      c.mat1.color.copy(c.origColor1).lerp(siltColor, targetDmg * 0.85);
      c.mat2.color.copy(c.origColor2).lerp(siltColor, targetDmg * 0.85);
      c.frondMat.color.copy(c.origFrond).lerp(siltColor, targetDmg * 0.85);
      c.mat1.emissiveIntensity = 0.05 + 0.5 * (1 - targetDmg);
      c.mat2.emissiveIntensity = 0.05 + 0.5 * (1 - targetDmg);
    }
  }

  spawnRestoredCoralFormation(outcomeSpec, countIndex = 1) {
    // Place distinct newly restored 3D coral sanctuary formations around the central reef
    const angle = countIndex * 1.65;
    const radius = 4.2 + (countIndex % 3) * 2.1;
    const cx = Math.cos(angle) * radius;
    const cz = 1.5 + Math.sin(angle) * radius;
    const cy = this.oceanEnv.getTerrainHeight(cx, cz);

    const group = new THREE.Group();
    group.position.set(cx, cy, cz);

    const primaryHex = outcomeSpec?.primaryColor || 0xff5e7e;
    const secondaryHex = outcomeSpec?.secondaryColor || 0x39d9c4;
    const shapeStyle = outcomeSpec?.shapeStyle || 'staghorn';

    const matPrimary = new THREE.MeshStandardMaterial({
      color: primaryHex,
      emissive: primaryHex,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      flatShading: true
    });
    const matSecondary = new THREE.MeshStandardMaterial({
      color: secondaryHex,
      emissive: secondaryHex,
      emissiveIntensity: 0.42,
      roughness: 0.38,
      flatShading: true
    });

    if (shapeStyle === 'staghorn') {
      // Tall branching antler thicket
      for (let i = 0; i < 7; i++) {
        const branch = new THREE.Mesh(
          new THREE.ConeGeometry(0.22, 1.8 + (i % 3) * 0.45, 6),
          i % 2 === 0 ? matPrimary : matSecondary
        );
        const a = (i / 7) * Math.PI * 2;
        branch.position.set(Math.cos(a) * 0.75, 0.9, Math.sin(a) * 0.75);
        branch.rotation.z = Math.cos(a) * 0.32;
        branch.rotation.x = Math.sin(a) * 0.32;
        group.add(branch);
      }
    } else if (shapeStyle === 'seafan') {
      // Wide lacy gorgonian sea fans + glowing pearls
      for (let i = 0; i < 4; i++) {
        const fan = new THREE.Mesh(
          new THREE.CylinderGeometry(1.15, 0.25, 0.12, 12),
          i % 2 === 0 ? matPrimary : matSecondary
        );
        fan.rotation.x = Math.PI / 2;
        fan.rotation.z = (i * Math.PI) / 4;
        fan.position.set((i - 1.5) * 0.55, 1.1 + (i % 2) * 0.3, 0);
        group.add(fan);
      }
    } else if (shapeStyle === 'brain_pipes') {
      // Massive brain coral dome + organ-pipe chimes
      const dome = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 1), matPrimary);
      dome.scale.set(1.25, 0.78, 1.2);
      dome.position.y = 0.55;
      group.add(dome);
      for (let i = 0; i < 6; i++) {
        const pipe = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.2, 1.6 + (i % 3) * 0.4, 8),
          matSecondary
        );
        const a = (i / 6) * Math.PI * 2;
        pipe.position.set(Math.cos(a) * 1.15, 0.85, Math.sin(a) * 1.15);
        group.add(pipe);
      }
    } else {
      // Tiered table-coral shelves & sunburst rosette
      for (let tier = 0; tier < 3; tier++) {
        const table = new THREE.Mesh(
          new THREE.CylinderGeometry(1.35 - tier * 0.28, 0.45, 0.22, 10),
          tier % 2 === 0 ? matPrimary : matSecondary
        );
        table.position.set(0, 0.55 + tier * 0.52, 0);
        group.add(table);
      }
    }

    this.scene.add(group);
    this.spawnSedimentBurst(new THREE.Vector3(cx, cy + 0.8, cz), 8, true);
    return group;
  }

  createSingleDeposit(spec) {
    const group = new THREE.Group();
    const baseY = this.oceanEnv.getTerrainHeight(spec.x, spec.z);
    group.position.set(spec.x, baseY, spec.z);

    const ringGeo = new THREE.RingGeometry(2.85, 3.08, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: spec.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 0.12;
    group.add(ringMesh);

    const noduleMeshes = [];
    const noduleCount = 15;
    const veinMat = new THREE.MeshStandardMaterial({
      color: spec.color,
      emissive: spec.color,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.4
    });

    for (let i = 0; i < noduleCount; i++) {
      const angle = (i / noduleCount) * Math.PI * 2 + (i % 4) * 0.42;
      const dist = 0.4 + ((i * 0.68) % 2.25);
      const nx = Math.cos(angle) * dist;
      const nz = Math.sin(angle) * dist;
      const ny = this.oceanEnv.getTerrainHeight(spec.x + nx, spec.z + nz) - baseY;

      const nodHolder = new THREE.Group();
      nodHolder.position.set(nx, ny + 0.22, nz);

      const size = 0.34 + (i % 4) * 0.08;
      const rockGeo = new THREE.IcosahedronGeometry(size, 1);
      const rockMesh = new THREE.Mesh(rockGeo, this.noduleDarkMat);
      rockMesh.scale.set(1.22, 0.78, 1.1);
      rockMesh.castShadow = true;
      rockMesh.receiveShadow = true;
      nodHolder.add(rockMesh);

      for (let s = 0; s < 3; s++) {
        const sAng = s * 2.1 + i;
        const crystalGeo = new THREE.DodecahedronGeometry(size * 0.26, 0);
        const crystalMesh = new THREE.Mesh(crystalGeo, veinMat);
        crystalMesh.position.set(
          Math.cos(sAng) * size * 0.52,
          size * 0.45,
          Math.sin(sAng) * size * 0.52
        );
        nodHolder.add(crystalMesh);
      }

      nodHolder.rotation.y = i * 1.3;
      group.add(nodHolder);
      noduleMeshes.push(nodHolder);
    }

    const hitGeo = new THREE.CylinderGeometry(3.2, 3.2, 2.4, 12);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.position.y = 0.9;
    group.add(hitMesh);

    const depositObj = {
      ...spec,
      remainingTons: spec.maxTons,
      depleted: false,
      group,
      ringMesh,
      noduleMeshes,
      hitMesh,
      damageSpawned: false
    };

    hitMesh.userData = { type: 'deposit', deposit: depositObj };
    this.scene.add(group);
    this.deposits.push(depositObj);
    return depositObj;
  }

  spawnNewMiningZones() {
    const newSpecs = [
      {
        id: `dep-bonus-${this.deposits.length + 1}`,
        zoneId: 'nodule_fields',
        name: 'Sovereign Deep Rich Vein',
        type: 'High-Grade Cobalt Core',
        x: 5.5,
        z: 7.5,
        yieldPerTon: 4100,
        maxTons: 125,
        color: 0xffc83d
      },
      {
        id: `dep-bonus-${this.deposits.length + 2}`,
        zoneId: 'abyssal_trench',
        name: 'Eastern Trench Motherlode',
        type: 'Rare-Earth Tellurium',
        x: 15.5,
        z: 8.5,
        yieldPerTon: 4300,
        maxTons: 125,
        color: 0x18c8da
      }
    ];
    return newSpecs.map((s) => this.createSingleDeposit(s));
  }

  buildCoralReefsAndFlora() {
    const coralPalette = [
      { main: 0xff6b9d, emissive: 0x6b1435 },
      { main: 0x18c8da, emissive: 0x055866 },
      { main: 0x55d99a, emissive: 0x0d5c38 },
      { main: 0xff9b45, emissive: 0x663000 },
      { main: 0xb978ff, emissive: 0x3b1466 }
    ];

    // Dense coral formations in Coral Sanctuary (-22, 13) + surrounding canyon ledges
    const reefCoords = [
      // Coral Sanctuary Lush Cluster
      [-22, 10], [-25, 13], [-19, 15], [-23, 17], [-17, 11], [-26, 9],
      // Canyon & Nodule Fields Borders
      [-10, 3], [-14, 12], [-7, -14], [2, -14],
      [9, -14], [15, -8], [18, 0], [14, 11], [18, 14],
      [-16, -6], [-21, 3], [5, 19], [-6, 19], [21, -15],
      [-23, -12], [23, 7], [-11, 16], [19, -5], [-3, -18],
      [8, -19], [13, 18], [24, -2]
    ];

    reefCoords.forEach(([cx, cz], idx) => {
      const cy = this.oceanEnv.getTerrainHeight(cx, cz);
      const cluster = new THREE.Group();
      cluster.position.set(cx, cy, cz);

      const pal = coralPalette[idx % coralPalette.length];
      const pal2 = coralPalette[(idx + 2) % coralPalette.length];

      const mat1 = new THREE.MeshStandardMaterial({
        color: pal.main,
        emissive: pal.emissive,
        emissiveIntensity: 0.55,
        roughness: 0.48,
        flatShading: true
      });
      const mat2 = new THREE.MeshStandardMaterial({
        color: pal2.main,
        emissive: pal2.emissive,
        emissiveIntensity: 0.55,
        roughness: 0.48,
        flatShading: true
      });

      const brainGeo = new THREE.IcosahedronGeometry(0.68 + (idx % 3) * 0.2, 1);
      const brain = new THREE.Mesh(brainGeo, mat1);
      brain.scale.set(1.18, 0.75, 1.12);
      brain.position.set(0, 0.36, 0);
      brain.castShadow = true;
      cluster.add(brain);

      for (let t = 0; t < 4; t++) {
        const h = 0.95 + (t % 3) * 0.38;
        const tubeGeo = new THREE.CylinderGeometry(0.14, 0.22, h, 7);
        const tube = new THREE.Mesh(tubeGeo, mat2);
        const ang = t * 1.65;
        tube.position.set(Math.cos(ang) * 0.78, h * 0.46, Math.sin(ang) * 0.78);
        tube.rotation.z = (t - 1.5) * 0.18;
        tube.castShadow = true;
        cluster.add(tube);
      }

      const frondGroup = new THREE.Group();
      const frondMat = new THREE.MeshStandardMaterial({
        color: 0x39d9c4,
        emissive: 0x094d3e,
        roughness: 0.55,
        side: THREE.DoubleSide
      });
      for (let f = 0; f < 3; f++) {
        const bladeGeo = new THREE.ConeGeometry(0.26, 1.85, 5);
        const blade = new THREE.Mesh(bladeGeo, frondMat);
        blade.position.set((f - 1) * 0.68, 0.9, -0.5);
        blade.rotation.z = (f - 1) * 0.14;
        frondGroup.add(blade);
      }
      cluster.add(frondGroup);

      this.scene.add(cluster);
      this.corals.push({
        group: cluster,
        frondGroup,
        x: cx,
        z: cz,
        mat1,
        mat2,
        frondMat,
        origColor1: new THREE.Color(pal.main),
        origEmissive1: new THREE.Color(pal.emissive),
        origColor2: new THREE.Color(pal2.main),
        origEmissive2: new THREE.Color(pal2.emissive),
        origFrond: new THREE.Color(0x39d9c4),
        phase: idx * 0.8
      });
    });
  }

  buildMarineLife() {
    const schoolCenters = [
      { x: -21, z: 13, color: 0xff8533, tail: 0xffd24c }, // Coral Sanctuary school 1
      { x: -23, z: 10, color: 0x55d99a, tail: 0x18c8da }, // Coral Sanctuary school 2
      { x: -11, z: 2, color: 0xff8533, tail: 0xffd24c },
      { x: 11, z: -3, color: 0xffc83d, tail: 0xffffff },
      { x: -5, z: -8, color: 0x18c8da, tail: 0xffc83d },
      { x: 15, z: 4, color: 0xff6b9d, tail: 0xffd24c },
      { x: 17, z: -16, color: 0xff9b45, tail: 0xffffff },
      { x: 25, z: 20, color: 0x18c8da, tail: 0xffffff }
    ];

    schoolCenters.forEach((sc, sIdx) => {
      const schoolGroup = new THREE.Group();
      const fishes = [];

      const bodyMat = new THREE.MeshStandardMaterial({
        color: sc.color,
        emissive: sc.color,
        emissiveIntensity: 0.38,
        roughness: 0.3
      });
      const tailMat = new THREE.MeshBasicMaterial({ color: sc.tail, side: THREE.DoubleSide });

      for (let i = 0; i < 10; i++) {
        const fish = new THREE.Group();

        const bodyGeo = new THREE.ConeGeometry(0.15, 0.54, 6);
        bodyGeo.rotateX(Math.PI / 2);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        fish.add(body);

        const tailGeo = new THREE.BufferGeometry();
        const verts = new Float32Array([
          0, 0, -0.25,
          0, 0.17, -0.46,
          0, -0.17, -0.46
        ]);
        tailGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
        const tail = new THREE.Mesh(tailGeo, tailMat);
        fish.add(tail);

        const offsetAngle = (i / 10) * Math.PI * 2;
        const offsetRadius = 0.65 + (i % 3) * 0.55;
        fish.position.set(
          Math.cos(offsetAngle) * offsetRadius,
          (i % 3) * 0.38,
          Math.sin(offsetAngle) * offsetRadius
        );

        schoolGroup.add(fish);
        fishes.push({ mesh: fish, tail, phase: i * 0.9 });
      }

      const baseY = this.oceanEnv.getTerrainHeight(sc.x, sc.z) + 2.5;
      schoolGroup.position.set(sc.x, baseY, sc.z);
      this.scene.add(schoolGroup);

      this.fishSchools.push({
        group: schoolGroup,
        fishes,
        homeX: sc.x,
        homeZ: sc.z,
        baseY,
        orbitRadius: 3.2 + (sIdx % 3) * 0.85,
        speed: 0.55 + (sIdx % 4) * 0.1,
        angle: sIdx * 1.2
      });
    });

    const jellyPositions = [
      { x: -3.5, z: -1.5, y: 3.6, color: 0xff6bd6 },
      { x: -7.5, z: -3.5, y: 4.2, color: 0x38f4ff },
      { x: -21.0, z: 12.5, y: 4.5, color: 0xff6bd6 },
      { x: 10.5, z: 7.5, y: 3.8, color: 0xff6bd6 },
      { x: 6.5, z: -9.5, y: 6.8, color: 0xd96bff },
      { x: -12.5, z: 6.5, y: 5.2, color: 0x38f4ff },
      { x: 16.5, z: -15.5, y: 5.6, color: 0xff6bd6 },
      { x: 24.0, z: 19.0, y: 5.0, color: 0xd96bff }
    ];

    jellyPositions.forEach((jp, j) => {
      const jellyGroup = new THREE.Group();

      const bellGeo = new THREE.SphereGeometry(0.54, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62);
      const bellMat = new THREE.MeshStandardMaterial({
        color: jp.color,
        emissive: jp.color,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.82,
        roughness: 0.18,
        side: THREE.DoubleSide
      });
      const bell = new THREE.Mesh(bellGeo, bellMat);
      jellyGroup.add(bell);

      const tentacles = [];
      const tentMat = new THREE.MeshBasicMaterial({
        color: jp.color,
        transparent: true,
        opacity: 0.68
      });
      for (let t = 0; t < 6; t++) {
        const ang = (t / 6) * Math.PI * 2;
        const tGeo = new THREE.CylinderGeometry(0.025, 0.01, 1.25, 5);
        const tent = new THREE.Mesh(tGeo, tentMat);
        tent.position.set(Math.cos(ang) * 0.24, -0.62, Math.sin(ang) * 0.24);
        jellyGroup.add(tent);
        tentacles.push(tent);
      }

      jellyGroup.position.set(jp.x, jp.y, jp.z);
      this.scene.add(jellyGroup);
      this.jellyfish.push({
        group: jellyGroup,
        bell,
        tentacles,
        baseX: jp.x,
        baseY: jp.y,
        baseZ: jp.z,
        phase: j * 1.15
      });
    });

    for (let m = 0; m < 2; m++) {
      const rayGroup = new THREE.Group();
      const rayMat = new THREE.MeshStandardMaterial({
        color: 0x104c68,
        emissive: 0x062536,
        roughness: 0.4,
        flatShading: true
      });

      const coreGeo = new THREE.ConeGeometry(0.75, 2.5, 5);
      coreGeo.rotateX(Math.PI / 2);
      coreGeo.scale(1.4, 0.32, 1);
      const core = new THREE.Mesh(coreGeo, rayMat);
      rayGroup.add(core);

      const leftWingGeo = new THREE.ConeGeometry(1.15, 2.3, 4);
      leftWingGeo.rotateZ(Math.PI / 2);
      leftWingGeo.scale(1, 0.2, 1.2);
      const leftWing = new THREE.Mesh(leftWingGeo, rayMat);
      leftWing.position.set(-0.95, 0, 0.1);
      rayGroup.add(leftWing);

      const rightWing = leftWing.clone();
      rightWing.rotation.z = -Math.PI / 2;
      rightWing.position.set(0.95, 0, 0.1);
      rayGroup.add(rightWing);

      const tailWhip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.01, 2.2, 5),
        rayMat
      );
      tailWhip.rotation.x = Math.PI / 2;
      tailWhip.position.set(0, 0, -2.1);
      rayGroup.add(tailWhip);

      this.scene.add(rayGroup);
      this.mantaRays.push({
        group: rayGroup,
        leftWing,
        rightWing,
        orbitRadius: 19 + m * 7,
        altitude: 10.5 + m * 3.0,
        angle: m * Math.PI + 0.6,
        speed: 0.16 + m * 0.04
      });
    }
  }

  spawnFlyingNodule(startPos, targetMachine, color = 0x18c8da) {
    const holder = new THREE.Group();
    holder.position.copy(startPos);

    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.26, 0),
      new THREE.MeshStandardMaterial({
        color: 0x1d2f40,
        emissive: color,
        emissiveIntensity: 0.9,
        roughness: 0.3,
        metalness: 0.7
      })
    );
    holder.add(mesh);
    this.scene.add(holder);

    this.flyingNodules.push({
      mesh: holder,
      startPos: startPos.clone(),
      targetMachine,
      progress: 0
    });
  }

  spawnSedimentBurst(pos, count = 5, isCleanBubble = false) {
    const color = isCleanBubble ? 0x55d99a : 0xd9b882;
    for (let i = 0; i < count; i++) {
      const size = isCleanBubble ? 0.16 + Math.random() * 0.15 : 0.38 + Math.random() * 0.48;
      const geo = isCleanBubble
        ? new THREE.SphereGeometry(size, 6, 6)
        : new THREE.DodecahedronGeometry(size, 1);
      const mat = new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: isCleanBubble ? 0.78 : 0.62,
        roughness: 0.9,
        depthWrite: false
      });
      const puff = new THREE.Mesh(geo, mat);
      puff.position.set(
        pos.x + (Math.random() - 0.5) * 1.8,
        pos.y + 0.35 + Math.random() * 0.55,
        pos.z + (Math.random() - 0.5) * 1.8
      );
      this.scene.add(puff);

      this.transientParticles.push({
        mesh: puff,
        vx: (Math.random() - 0.5) * 1.25,
        vy: isCleanBubble ? 1.6 + Math.random() * 1.2 : 0.6 + Math.random() * 0.65,
        vz: (Math.random() - 0.5) * 1.25,
        age: 0,
        maxAge: isCleanBubble ? 1.4 : 2.1,
        growRate: isCleanBubble ? 0.2 : 0.9
      });
    }
  }

  createOrIntensifyDamagedSite(x, z, sourceName = 'Mined Sector') {
    const existing = this.damagedSites.find(
      (s) => !s.restored && Math.hypot(s.x - x, s.z - z) < 5.5
    );
    if (existing) {
      existing.severity = Math.min(100, existing.severity + 34);
      existing.plumeGroup.scale.setScalar(0.85 + (existing.severity / 100) * 0.65);
      return existing;
    }

    const baseY = this.oceanEnv.getTerrainHeight(x, z);
    const group = new THREE.Group();
    group.position.set(x, baseY, z);

    const warnRingGeo = new THREE.RingGeometry(2.9, 3.2, 28);
    warnRingGeo.rotateX(-Math.PI / 2);
    const warnRingMat = new THREE.MeshBasicMaterial({
      color: 0xff9b45,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72
    });
    const warnRing = new THREE.Mesh(warnRingGeo, warnRingMat);
    warnRing.position.y = 0.15;
    group.add(warnRing);

    const debrisGroup = new THREE.Group();
    const rustMat = new THREE.MeshStandardMaterial({
      color: 0x8f3922,
      roughness: 0.75,
      metalness: 0.4
    });
    const hazardYellowMat = new THREE.MeshStandardMaterial({
      color: 0xffc83d,
      roughness: 0.6
    });
    const sludgeMat = new THREE.MeshStandardMaterial({
      color: 0x2c251f,
      roughness: 0.95
    });

    const mound = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.5, 0.32, 10), sludgeMat);
    mound.position.y = 0.12;
    debrisGroup.add(mound);

    for (let b = 0; b < 2; b++) {
      const drum = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.88, 10),
        b === 0 ? rustMat : hazardYellowMat
      );
      drum.position.set((b - 0.5) * 1.2, 0.38, (b - 0.5) * 0.6);
      drum.rotation.z = 0.4 + b * 0.7;
      drum.rotation.x = 0.3;
      drum.castShadow = true;
      debrisGroup.add(drum);
    }

    group.add(debrisGroup);

    const plumeGroup = new THREE.Group();
    const plumeMat = new THREE.MeshStandardMaterial({
      color: 0x70624f,
      transparent: true,
      opacity: 0.46,
      roughness: 1.0,
      depthWrite: false
    });

    const puffs = [];
    for (let p = 0; p < 7; p++) {
      const ang = (p / 7) * Math.PI * 2;
      const rad = (p % 3) * 0.85;
      const puffGeo = new THREE.DodecahedronGeometry(0.95 + (p % 3) * 0.35, 1);
      const puff = new THREE.Mesh(puffGeo, plumeMat.clone());
      puff.position.set(
        Math.cos(ang) * rad,
        1.4 + (p % 3) * 0.75,
        Math.sin(ang) * rad
      );
      plumeGroup.add(puff);
      puffs.push({ mesh: puff, baseY: puff.position.y, phase: p * 1.1 });
    }
    group.add(plumeGroup);

    const restoredGroup = new THREE.Group();
    restoredGroup.visible = false;

    const bioDomeGeo = new THREE.IcosahedronGeometry(1.45, 1);
    const bioDomeMat = new THREE.MeshStandardMaterial({
      color: 0x55d99a,
      emissive: 0x18a875,
      emissiveIntensity: 0.55,
      wireframe: true
    });
    const bioDome = new THREE.Mesh(bioDomeGeo, bioDomeMat);
    bioDome.position.y = 0.65;
    restoredGroup.add(bioDome);

    const newCoralColors = [0x18c8da, 0xff6b9d, 0x55d99a];
    newCoralColors.forEach((col, cIdx) => {
      const cMesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.48, 1),
        new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.5,
          roughness: 0.4
        })
      );
      const a = (cIdx / 3) * Math.PI * 2;
      cMesh.position.set(Math.cos(a) * 0.65, 0.38, Math.sin(a) * 0.65);
      restoredGroup.add(cMesh);
    });
    group.add(restoredGroup);

    const hitGeo = new THREE.CylinderGeometry(3.2, 3.2, 3.0, 12);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.position.y = 1.2;
    group.add(hitMesh);

    const siteObj = {
      id: `dmg-${this.damagedSites.length + 1}`,
      name: `${sourceName} Scar`,
      x,
      z,
      severity: 65,
      restorationProgress: 0,
      restored: false,
      group,
      warnRing,
      debrisGroup,
      plumeGroup,
      puffs,
      restoredGroup,
      hitMesh
    };

    hitMesh.userData = { type: 'damagedSite', site: siteObj };
    this.scene.add(group);
    this.damagedSites.push(siteObj);
    return siteObj;
  }

  update(dt, elapsed) {
    for (const dep of this.deposits) {
      if (!dep.depleted) {
        dep.ringMesh.rotation.z = elapsed * 0.3;
        const pulse = 0.32 + Math.sin(elapsed * 3.2) * 0.16;
        dep.ringMesh.material.opacity = pulse;
      }
    }

    const bleachedColor = new THREE.Color(0x525d63);
    const blackEmissive = new THREE.Color(0x000000);

    for (const coral of this.corals) {
      const sector = this.oceanEnv.getSectorAt(coral.x, coral.z);
      const hNorm = Math.max(0, Math.min(1, sector.health / 100));

      coral.frondGroup.rotation.z = Math.sin(elapsed * 2.1 + coral.phase) * 0.12 * (0.3 + 0.7 * hNorm);

      coral.mat1.color.lerpColors(bleachedColor, coral.origColor1, hNorm);
      coral.mat1.emissive.lerpColors(blackEmissive, coral.origEmissive1, hNorm);
      coral.mat2.color.lerpColors(bleachedColor, coral.origColor2, hNorm);
      coral.mat2.emissive.lerpColors(blackEmissive, coral.origEmissive2, hNorm);
      coral.frondMat.color.lerpColors(bleachedColor, coral.origFrond, hNorm);

      const targetScale = 0.58 + 0.42 * hNorm;
      coral.group.scale.setScalar(THREE.MathUtils.lerp(coral.group.scale.x, targetScale, dt * 2.5));
    }

    for (const school of this.fishSchools) {
      const sector = this.oceanEnv.getSectorAt(school.homeX, school.homeZ);
      const healthFactor = sector.health / 100;

      school.angle += dt * school.speed * (healthFactor < 0.4 ? 1.6 : 1.0);
      const currentRadius = school.orbitRadius + (1 - healthFactor) * 4.5;
      const nx = school.homeX + Math.cos(school.angle) * currentRadius;
      const nz = school.homeZ + Math.sin(school.angle) * currentRadius;
      const ny = school.baseY + Math.sin(elapsed * 1.4 + school.angle) * 0.55 + (1 - healthFactor) * 3.5;

      school.group.position.set(nx, ny, nz);
      school.group.lookAt(nx - Math.sin(school.angle), ny, nz + Math.cos(school.angle));

      school.fishes.forEach((f, idx) => {
        f.tail.rotation.y = Math.sin(elapsed * 14 + f.phase) * 0.38;
        f.mesh.visible = sector.health > 22 || idx < 2;
      });
    }

    for (const j of this.jellyfish) {
      const pulse = Math.sin(elapsed * 2.6 + j.phase);
      j.bell.scale.set(1 + pulse * 0.12, 1 - pulse * 0.1, 1 + pulse * 0.12);
      j.group.position.y = j.baseY + Math.sin(elapsed * 1.1 + j.phase) * 0.85;
      j.group.position.x = j.baseX + Math.cos(elapsed * 0.5 + j.phase) * 0.65;

      j.tentacles.forEach((t, idx) => {
        t.rotation.z = Math.sin(elapsed * 3.2 + j.phase + idx) * 0.16;
      });
    }

    for (const ray of this.mantaRays) {
      ray.angle += dt * ray.speed;
      const rx = Math.cos(ray.angle) * ray.orbitRadius;
      const rz = Math.sin(ray.angle) * ray.orbitRadius;
      const ry = ray.altitude + Math.sin(elapsed * 0.9 + ray.angle) * 1.1;

      ray.group.position.set(rx, ry, rz);
      ray.group.lookAt(
        rx - Math.sin(ray.angle) * 5,
        ry + Math.cos(elapsed * 0.9) * 0.3,
        rz + Math.cos(ray.angle) * 5
      );

      const flap = Math.sin(elapsed * 3.4) * 0.32;
      ray.leftWing.rotation.y = flap;
      ray.rightWing.rotation.y = -flap;
    }

    for (const site of this.damagedSites) {
      if (!site.restored) {
        site.warnRing.material.opacity = 0.4 + Math.sin(elapsed * 4.5) * 0.28;
        for (const p of site.puffs) {
          p.mesh.position.y = p.baseY + Math.sin(elapsed * 1.8 + p.phase) * 0.32;
          p.mesh.rotation.y += dt * 0.4;
        }
      } else {
        site.restoredGroup.rotation.y += dt * 0.35;
      }
    }

    for (let i = this.flyingNodules.length - 1; i >= 0; i--) {
      const fn = this.flyingNodules.length > i ? this.flyingNodules[i] : null;
      if (!fn) continue;
      fn.progress += dt * 2.8;
      if (fn.progress >= 1) {
        this.scene.remove(fn.mesh);
        this.flyingNodules.splice(i, 1);
      } else {
        const targetPos = fn.targetMachine.getIntakeWorldPosition();
        fn.mesh.position.lerpVectors(fn.startPos, targetPos, fn.progress);
        fn.mesh.position.y += Math.sin(fn.progress * Math.PI) * 1.15;
        fn.mesh.rotation.x += dt * 8;
        fn.mesh.rotation.y += dt * 8;
      }
    }

    for (let i = this.transientParticles.length - 1; i >= 0; i--) {
      const p = this.transientParticles[i];
      p.age += dt;
      if (p.age >= p.maxAge) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.transientParticles.splice(i, 1);
      } else {
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        const lifeRatio = p.age / p.maxAge;
        p.mesh.scale.addScalar(dt * p.growRate);
        p.mesh.material.opacity = (1 - lifeRatio) * 0.58;
      }
    }
  }

  // Signature Event: THE SILENT BLOOM
  // Dim the bioluminescent organisms in the canyon when ecological health collapses
  dimBioluminescentOrganisms(factor = 0.25) {
    for (const j of this.jellyfish) {
      if (j.bell && j.bell.material && j.bell.material.emissive) {
        j.bell.material.emissive.multiplyScalar(factor);
        j.bell.material.opacity = Math.max(0.18, j.bell.material.opacity * factor);
      }
    }
    for (const c of this.corals) {
      if (c.material && c.material.emissive) {
        c.material.emissive.multiplyScalar(factor);
      }
    }
  }
}
