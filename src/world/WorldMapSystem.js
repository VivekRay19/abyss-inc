import * as THREE from 'three';

// ============================================================================
// DATA-DRIVEN 7-REGION CONNECTED UNDERWATER WORLD MAP CONFIGURATION
// ============================================================================
export const WORLD_ZONES_CONFIG = [
  {
    id: 'riser_hub',
    name: 'Riser Hub',
    shortDesc: 'Main operational base, umbilical riser station, and ore processing terminal.',
    x: -15,
    z: -10,
    radius: 9.5,
    mapPos: { x: 16, y: 36 }, // Percentage coordinates on the 2D schematic map
    connectedTo: ['nodule_fields', 'coral_sanctuary'],
    initialStatus: 'ACCESSIBLE', // ACCESSIBLE | LOCKED | PROTECTED | RESTORATION | UNDISCOVERED
    miningAllowed: false,
    restorationAllowed: true,
    environmentalRisk: 'Low (Industrial Base)',
    activities: ['Sell Ore', 'Fleet Upgrades', 'Expedition Prep'],
    unlockReqText: 'Starting Base (Always Accessible)',
    unlockCost: 0,
    canUnlock: () => true
  },
  {
    id: 'nodule_fields',
    name: 'Nodule Fields',
    shortDesc: 'Sunlit sandy canyon floor rich in beginner-friendly polymetallic nodules.',
    x: -1,
    z: 2,
    radius: 11.5,
    mapPos: { x: 44, y: 48 },
    connectedTo: ['riser_hub', 'coral_sanctuary', 'the_scar', 'abyssal_trench'],
    initialStatus: 'ACCESSIBLE',
    miningAllowed: true,
    restorationAllowed: true,
    environmentalRisk: 'Moderate (Sediment Drift)',
    activities: ['Mine Minerals', 'Core Sampling', 'Restore Scars'],
    unlockReqText: 'Initially Accessible',
    unlockCost: 0,
    canUnlock: () => true
  },
  {
    id: 'coral_sanctuary',
    name: 'Coral Sanctuary',
    shortDesc: 'Protected biodiversity terrace teeming with reef fish and bioluminescent corals. Mining is strictly prohibited.',
    x: -22,
    z: 13,
    radius: 9.8,
    mapPos: { x: 17, y: 78 },
    connectedTo: ['riser_hub', 'nodule_fields'],
    initialStatus: 'PROTECTED',
    miningAllowed: false,
    restorationAllowed: true,
    environmentalRisk: 'Protected Non-Mining Sanctuary',
    activities: ['Biodiversity Monitoring', 'Reef Restoration'],
    unlockReqText: 'Protected Zone — Mining Prohibited',
    unlockCost: 0,
    canUnlock: () => true
  },
  {
    id: 'the_scar',
    name: 'The Scar',
    shortDesc: 'Heavily disturbed legacy mining basin containing abandoned drill rigs, toxic waste drums, and restoration objectives.',
    x: -4,
    z: 22,
    radius: 10.2,
    mapPos: { x: 48, y: 83 },
    connectedTo: ['nodule_fields', 'abyssal_trench'],
    initialStatus: 'RESTORATION',
    miningAllowed: false, // Becomes mineable only if player restores all scars here or enacts liquidation
    restorationAllowed: true,
    environmentalRisk: 'High (Legacy Industrial Pollution)',
    activities: ['Cleanup Debris', 'Restore Coral Reefs', 'Habitat Recovery'],
    unlockReqText: 'Accessible for Restoration & Cleanup',
    unlockCost: 0,
    canUnlock: () => true
  },
  {
    id: 'abyssal_trench',
    name: 'Abyssal Trench',
    shortDesc: 'Deep fault canyon holding high-grade cobalt crusts and hydrothermal sulfide veins.',
    x: 16,
    z: 2,
    radius: 11.2,
    mapPos: { x: 74, y: 48 },
    connectedTo: ['nodule_fields', 'the_scar', 'vent_gardens', 'outer_abyss'],
    initialStatus: 'LOCKED',
    miningAllowed: true,
    restorationAllowed: true,
    environmentalRisk: 'High (Deep Trench Turbidity)',
    activities: ['Deep Trench Mining', 'High-Grade Extraction', 'Sub Exploration'],
    unlockReqText: 'Exploration Permit ($45K) OR Any Lv.2 Equipment Upgrade',
    unlockCost: 45000,
    canUnlock: (game) =>
      game.treasury >= 45000 ||
      game.upgrades.cutterLevel >= 2 ||
      game.upgrades.hopperLevel >= 2 ||
      game.upgrades.bioLaserLevel >= 2
  },
  {
    id: 'vent_gardens',
    name: 'Vent Gardens',
    shortDesc: 'Environmentally sensitive hydrothermal black-smoker ecosystem rich in rare sulfides.',
    x: 17,
    z: -18,
    radius: 10.2,
    mapPos: { x: 77, y: 17 },
    connectedTo: ['abyssal_trench', 'outer_abyss'],
    initialStatus: 'LOCKED',
    miningAllowed: true,
    restorationAllowed: true,
    environmentalRisk: 'Severe (Sensitive Hydrothermal Vents)',
    activities: ['Hydrothermal Vent Mining', 'Ecosystem Monitoring', 'Vent Restoration'],
    unlockReqText: 'Unlock Abyssal Trench + Mine 30t Ore ($55K Thermal Shielding)',
    unlockCost: 55000,
    canUnlock: (game, mapSys) =>
      mapSys.isZoneUnlocked('abyssal_trench') &&
      (game.totalTonsMined >= 30 || game.treasury >= 55000)
  },
  {
    id: 'outer_abyss',
    name: 'The Outer Abyss',
    shortDesc: 'Remote endgame frontier at the edge of the continental shelf with massive tellurium motherlodes.',
    x: 26,
    z: 21,
    radius: 10.8,
    mapPos: { x: 83, y: 82 },
    connectedTo: ['abyssal_trench', 'vent_gardens'],
    initialStatus: 'UNDISCOVERED',
    miningAllowed: true,
    restorationAllowed: true,
    environmentalRisk: 'Extreme (Fragile Hadal Ecosystem)',
    activities: ['Endgame Rare-Earth Mining', 'Deep-Basin Reclamation'],
    unlockReqText: 'Unlock Abyssal Trench + (Mine 60t OR Restore 1 Zone) + $75K Permit',
    unlockCost: 75000,
    canUnlock: (game, mapSys) =>
      mapSys.isZoneUnlocked('abyssal_trench') &&
      (game.totalTonsMined >= 60 ||
        game.ecosystem.damagedSites.filter((s) => s.restored).length >= 1) &&
      game.treasury >= 75000
  }
];

export const ZONE_STATUS_COLORS = {
  ACCESSIBLE: 0x55d99a,   // Green
  LOCKED: 0xffc83d,       // Yellow
  PROTECTED: 0xf16f75,    // Red (Restricted for mining)
  RESTORATION: 0x18c8da,  // Cyan (Restoration-focused)
  UNDISCOVERED: 0x5c7a8f  // Muted blue-grey
};

export class WorldMapSystem {
  constructor(scene, oceanEnv, ecosystem) {
    this.scene = scene;
    this.oceanEnv = oceanEnv;
    this.ecosystem = ecosystem;

    this.zones = new Map();
    this.corridorMeshes = [];
    this.markersVisible = true;
    this.selectedZoneId = 'nodule_fields';

    this.initZones();
    this.buildCorridorsAndLandmarks();
  }

  initZones() {
    WORLD_ZONES_CONFIG.forEach((cfg) => {
      const group = new THREE.Group();
      const baseY = this.oceanEnv.getTerrainHeight(cfg.x, cfg.z);
      group.position.set(cfg.x, 0, cfg.z);

      const colorHex = ZONE_STATUS_COLORS[cfg.initialStatus] || 0x18c8da;

      // 1. Conformed 3D Seabed Zone Boundary Ring
      const segs = 64;
      const ringPoints = [];
      for (let i = 0; i <= segs; i++) {
        const ang = (i / segs) * Math.PI * 2;
        const rx = cfg.x + Math.cos(ang) * cfg.radius;
        const rz = cfg.z + Math.sin(ang) * cfg.radius;
        const ry = this.oceanEnv.getTerrainHeight(rx, rz) + 0.24;
        ringPoints.push(new THREE.Vector3(rx - cfg.x, ry, rz - cfg.z));
      }
      const ringCurve = new THREE.CatmullRomCurve3(ringPoints, true);
      const ringGeo = new THREE.TubeGeometry(ringCurve, 64, 0.14, 6, true);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.52
      });
      const boundaryMesh = new THREE.Mesh(ringGeo, ringMat);
      group.add(boundaryMesh);

      // 2. Subtle Inner Selection Highlight Ring (pulses when zone is selected in Map/3D)
      const innerGeo = new THREE.TubeGeometry(ringCurve, 64, 0.28, 6, true);
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0
      });
      const highlightMesh = new THREE.Mesh(innerGeo, innerMat);
      group.add(highlightMesh);

      // 3. Zone Perimeter Marker Beacons (4 cardinal buoys along the boundary)
      const buoys = [];
      const postMat = new THREE.MeshStandardMaterial({
        color: 0x1c3144,
        roughness: 0.5,
        metalness: 0.6
      });
      for (let b = 0; b < 4; b++) {
        const ang = (b / 4) * Math.PI * 2 + Math.PI / 4;
        const bx = Math.cos(ang) * cfg.radius;
        const bz = Math.sin(ang) * cfg.radius;
        const by = this.oceanEnv.getTerrainHeight(cfg.x + bx, cfg.z + bz);

        const buoyGroup = new THREE.Group();
        buoyGroup.position.set(bx, by, bz);

        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.14, 1.35, 6),
          postMat
        );
        pole.position.y = 0.65;
        buoyGroup.add(pole);

        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 8, 8),
          new THREE.MeshBasicMaterial({ color: colorHex })
        );
        orb.position.y = 1.42;
        buoyGroup.add(orb);

        group.add(buoyGroup);
        buoys.push(orb);
      }

      this.scene.add(group);

      this.zones.set(cfg.id, {
        ...cfg,
        status: cfg.initialStatus,
        discovered: cfg.initialStatus !== 'UNDISCOVERED',
        group,
        boundaryMesh,
        highlightMesh,
        buoys,
        centerVec: new THREE.Vector3(cfg.x, baseY, cfg.z)
      });
    });
  }

  buildCorridorsAndLandmarks() {
    // 1. Build Navigable Seabed Corridors connecting adjacent zones
    const drawnPairs = new Set();

    for (const zone of this.zones.values()) {
      for (const targetId of zone.connectedTo) {
        const pairKey = [zone.id, targetId].sort().join('--');
        if (drawnPairs.has(pairKey)) continue;
        drawnPairs.add(pairKey);

        const targetZone = this.zones.get(targetId);
        if (!targetZone) continue;

        const dir = new THREE.Vector2(targetZone.x - zone.x, targetZone.z - zone.z);
        const totalDist = dir.length();
        dir.normalize();

        // Start & end at zone boundary rims so corridors neatly bridge the passages
        const startX = zone.x + dir.x * (zone.radius * 0.85);
        const startZ = zone.z + dir.y * (zone.radius * 0.85);
        const endX = targetZone.x - dir.x * (targetZone.radius * 0.85);
        const endZ = targetZone.z - dir.y * (targetZone.radius * 0.85);

        const steps = 10;
        const corridorGroup = new THREE.Group();
        const dots = [];

        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const px = THREE.MathUtils.lerp(startX, endX, t);
          const pz = THREE.MathUtils.lerp(startZ, endZ, t);
          const py = this.oceanEnv.getTerrainHeight(px, pz) + 0.16;

          const marker = new THREE.Mesh(
            new THREE.CylinderGeometry(0.24, 0.28, 0.08, 8),
            new THREE.MeshBasicMaterial({
              color: 0x39d9c4,
              transparent: true,
              opacity: 0.48
            })
          );
          marker.position.set(px, py, pz);
          corridorGroup.add(marker);
          dots.push(marker);
        }

        this.scene.add(corridorGroup);
        this.corridorMeshes.push({
          fromId: zone.id,
          toId: targetId,
          group: corridorGroup,
          dots
        });
      }
    }

    // 2. Build Region-Specific 3D Landmarks so each of the 7 zones has an unmistakable visual identity!
    this.buildCoralSanctuaryLandmarks();
    this.buildVentGardensLandmarks();
    this.buildOuterAbyssLandmarks();
  }

  buildCoralSanctuaryLandmarks() {
    const z = this.zones.get('coral_sanctuary');
    if (!z) return;
    const baseY = this.oceanEnv.getTerrainHeight(z.x, z.z);

    // Bioluminescent Sanctuary Observation Arch & Protected Reef Shrine
    const archGroup = new THREE.Group();
    archGroup.position.set(z.x, baseY, z.z);

    const archMat = new THREE.MeshStandardMaterial({
      color: 0x39d9c4,
      emissive: 0x0d5c4e,
      emissiveIntensity: 0.6,
      roughness: 0.35,
      flatShading: true
    });

    const torusGeo = new THREE.TorusGeometry(3.4, 0.42, 8, 20, Math.PI);
    const arch = new THREE.Mesh(torusGeo, archMat);
    arch.rotation.y = 0.6;
    arch.castShadow = true;
    archGroup.add(arch);

    // Central floating sanctuary monitoring buoy
    const dome = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.85, 1),
      new THREE.MeshStandardMaterial({
        color: 0x55d99a,
        emissive: 0x28b580,
        emissiveIntensity: 0.85,
        wireframe: true
      })
    );
    dome.position.y = 2.2;
    archGroup.add(dome);
    this.sanctuaryOrb = dome;

    this.scene.add(archGroup);
  }

  buildVentGardensLandmarks() {
    const z = this.zones.get('vent_gardens');
    if (!z) return;

    // Towering Hydrothermal Black-Smoker Chimneys with glowing orange magma vents
    const ventOffsets = [
      [-2.5, -1.5, 3.8],
      [2.2, 1.8, 4.4],
      [-0.5, 2.8, 3.1],
      [3.0, -2.2, 3.5]
    ];

    const chimMat = new THREE.MeshStandardMaterial({
      color: 0x1c2833,
      roughness: 0.9,
      flatShading: true
    });
    const magmaMat = new THREE.MeshBasicMaterial({ color: 0xff9b45 });

    ventOffsets.forEach(([ox, oz, h]) => {
      const vx = z.x + ox;
      const vz = z.z + oz;
      const vy = this.oceanEnv.getTerrainHeight(vx, vz);

      const vg = new THREE.Group();
      vg.position.set(vx, vy, vz);

      const cone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 1.25, h, 8),
        chimMat
      );
      cone.position.y = h * 0.5;
      cone.castShadow = true;
      vg.add(cone);

      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.38, 0.22, 8),
        magmaMat
      );
      rim.position.y = h + 0.05;
      vg.add(rim);

      this.scene.add(vg);
    });
  }

  buildOuterAbyssLandmarks() {
    const z = this.zones.get('outer_abyss');
    if (!z) return;

    // Crystalline Abyssal Monolith Spires marking the remote frontier
    const spireMat = new THREE.MeshStandardMaterial({
      color: 0x1d3f5e,
      emissive: 0x0d2840,
      roughness: 0.3,
      metalness: 0.6,
      flatShading: true
    });
    const crystalMat = new THREE.MeshBasicMaterial({ color: 0x70f8ff });

    const offsets = [
      [-3.5, 2.5, 5.2],
      [3.8, -2.0, 5.8],
      [0.5, 3.8, 4.6]
    ];

    offsets.forEach(([ox, oz, h]) => {
      const sx = z.x + ox;
      const sz = z.z + oz;
      const sy = this.oceanEnv.getTerrainHeight(sx, sz);

      const sg = new THREE.Group();
      sg.position.set(sx, sy, sz);

      const spire = new THREE.Mesh(new THREE.ConeGeometry(1.1, h, 6), spireMat);
      spire.position.y = h * 0.5;
      spire.castShadow = true;
      sg.add(spire);

      const vein = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), crystalMat);
      vein.position.y = h + 0.35;
      sg.add(vein);

      this.scene.add(sg);
    });
  }

  toggleMarkersVisibility() {
    this.markersVisible = !this.markersVisible;
    for (const z of this.zones.values()) {
      z.group.visible = this.markersVisible;
    }
    for (const c of this.corridorMeshes) {
      c.group.visible = this.markersVisible;
    }
    return this.markersVisible;
  }

  getZoneById(zoneId) {
    return this.zones.get(zoneId) || null;
  }

  // Returns the zone containing world point (x, z), or null if in open corridor between zones
  getZoneAtPoint(x, z) {
    let bestZone = null;
    let bestDist = Infinity;
    for (const zone of this.zones.values()) {
      const d = Math.hypot(x - zone.x, z - zone.z);
      if (d <= zone.radius && d < bestDist) {
        bestDist = d;
        bestZone = zone;
      }
    }
    return bestZone;
  }

  // Returns nearest zone to any world coordinate
  getNearestZone(x, z) {
    let bestZone = null;
    let bestDist = Infinity;
    for (const zone of this.zones.values()) {
      const d = Math.hypot(x - zone.x, z - zone.z);
      if (d < bestDist) {
        bestDist = d;
        bestZone = zone;
      }
    }
    return bestZone;
  }

  isZoneUnlocked(zoneId) {
    const z = this.zones.get(zoneId);
    if (!z) return false;
    return z.status === 'ACCESSIBLE' || z.status === 'PROTECTED' || z.status === 'RESTORATION';
  }

  canMachineEnterPoint(x, z) {
    const zone = this.getZoneAtPoint(x, z);
    if (!zone) return { allowed: true, zone: null };
    if (zone.status === 'LOCKED' || zone.status === 'UNDISCOVERED') {
      return { allowed: false, zone };
    }
    return { allowed: true, zone };
  }

  canMineInZone(zoneId) {
    const z = this.zones.get(zoneId);
    if (!z) return true;
    if (!this.isZoneUnlocked(zoneId)) return false;
    return z.miningAllowed;
  }

  unlockZone(zoneId, game) {
    const z = this.zones.get(zoneId);
    if (!z) return { ok: false, reason: 'Zone not found.' };
    if (this.isZoneUnlocked(zoneId)) return { ok: true, reason: 'Already unlocked.' };

    // Check unlock conditions
    if (!z.canUnlock(game, this)) {
      return { ok: false, reason: `Requires: ${z.unlockReqText}` };
    }

    // Deduct exploration permit cost if player is unlocking via cash investment
    const hasFreeUpgradeUnlock =
      zoneId === 'abyssal_trench' &&
      (game.upgrades.cutterLevel >= 2 ||
        game.upgrades.hopperLevel >= 2 ||
        game.upgrades.bioLaserLevel >= 2);

    if (!hasFreeUpgradeUnlock && z.unlockCost > 0) {
      if (game.treasury < z.unlockCost) {
        return { ok: false, reason: `Need $${(z.unlockCost / 1000).toFixed(0)}K cash for permit.` };
      }
      game.treasury -= z.unlockCost;
      game.netProfit -= z.unlockCost;
    }

    z.status = 'ACCESSIBLE';
    z.discovered = true;
    this.updateZoneVisuals(z);

    // Discovering Abyssal Trench reveals The Outer Abyss as LOCKED on the map!
    if (zoneId === 'abyssal_trench') {
      const outer = this.zones.get('outer_abyss');
      if (outer && outer.status === 'UNDISCOVERED') {
        outer.status = 'LOCKED';
        outer.discovered = true;
        this.updateZoneVisuals(outer);
      }
    }

    return { ok: true, zone: z };
  }

  updateZoneVisuals(zone) {
    const col = ZONE_STATUS_COLORS[zone.status] || 0x18c8da;
    zone.boundaryMesh.material.color.setHex(col);
    for (const orb of zone.buoys) {
      orb.material.color.setHex(col);
    }
  }

  selectZone(zoneId) {
    this.selectedZoneId = zoneId;
    for (const z of this.zones.values()) {
      const isSel = z.id === zoneId;
      z.highlightMesh.material.opacity = isSel ? 0.65 : 0.0;
    }
  }

  // Computes live mineral reserves, damaged sites, and localized ecosystem health for a zone
  getZoneLiveStats(zoneId) {
    const z = this.zones.get(zoneId);
    if (!z) return null;

    // 1. Mineral deposits inside this zone
    const zoneDeposits = this.ecosystem.deposits.filter((d) => d.zoneId === zoneId);
    let remainingTons = 0;
    let maxTons = 0;
    for (const d of zoneDeposits) {
      remainingTons += d.remainingTons;
      maxTons += d.maxTons;
    }

    // 2. Damaged restoration sites inside this zone
    const zoneScars = this.ecosystem.damagedSites.filter(
      (s) => Math.hypot(s.x - z.x, s.z - z.z) <= z.radius + 3.5
    );
    const activeScars = zoneScars.filter((s) => !s.restored).length;
    const restoredScars = zoneScars.filter((s) => s.restored).length;

    // 3. Localized Ocean Health of sectors overlapping this zone
    let healthSum = 0;
    let count = 0;
    for (const sec of this.oceanEnv.sectors) {
      if (Math.hypot(sec.x - z.x, sec.z - z.z) <= z.radius + 5.5) {
        healthSum += sec.health;
        count++;
      }
    }
    const localHealth = count > 0 ? Math.round(healthSum / count) : 96;

    // If all scars in The Scar are restored, unlock optional sustainable mining there too
    if (zoneId === 'the_scar' && zoneScars.length > 0 && activeScars === 0) {
      z.miningAllowed = true;
    }

    return {
      zone: z,
      depositCount: zoneDeposits.length,
      remainingTons: Math.round(remainingTons),
      maxTons: Math.round(maxTons),
      activeScars,
      restoredScars,
      totalScars: zoneScars.length,
      localHealth
    };
  }

  update(dt, elapsed) {
    if (this.sanctuaryOrb) {
      this.sanctuaryOrb.rotation.y += dt * 0.8;
      this.sanctuaryOrb.position.y = 2.2 + Math.sin(elapsed * 2.2) * 0.25;
    }

    // Pulse the selected zone's 3D highlight ring
    for (const z of this.zones.values()) {
      if (z.id === this.selectedZoneId) {
        z.highlightMesh.material.opacity = 0.35 + Math.sin(elapsed * 4.0) * 0.25;
      } else {
        z.highlightMesh.material.opacity = 0.0;
      }
    }

    // Animate corridor guide lights
    for (const corr of this.corridorMeshes) {
      const bothUnlocked =
        this.isZoneUnlocked(corr.fromId) && this.isZoneUnlocked(corr.toId);
      corr.dots.forEach((dot, idx) => {
        dot.material.color.setHex(bothUnlocked ? 0x55d99a : 0xffc83d);
        dot.material.opacity = bothUnlocked
          ? 0.35 + Math.sin(elapsed * 3.5 - idx * 0.5) * 0.22
          : 0.22;
      });
    }
  }
}
