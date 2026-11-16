import * as THREE from 'three';

// ============================================================================
// SURFACE OCEAN, OIL SLICKS, BOAT CRANE/SKIMMER & HUMAN DIVER
// ============================================================================

export class SurfaceOceanManager {
  constructor(scene) {
    this.scene = scene;
    this.surfaceY = 26.0;
    this.waterMesh = null;
    this.basePositions = null;
    this.oilPatches = [];
    this.buildSurfaceWater();
  }

  buildSurfaceWater() {
    // Large animated ocean surface extending toward horizon
    const geo = new THREE.PlaneGeometry(260, 260, 48, 48);
    geo.rotateX(-Math.PI / 2);
    this.basePositions = new Float32Array(geo.attributes.position.array);

    const mat = new THREE.MeshStandardMaterial({
      color: 0x0f7ba8,
      emissive: 0x052b44,
      emissiveIntensity: 0.35,
      roughness: 0.22,
      metalness: 0.35,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide
    });

    this.waterMesh = new THREE.Mesh(geo, mat);
    this.waterMesh.position.y = this.surfaceY;
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);
  }

  spawnOilSlicks(count = 8) {
    this.clearOilSlicks();
    const oilMat = new THREE.MeshStandardMaterial({
      color: 0x171c20,
      emissive: 0x080a0c,
      roughness: 0.14,
      metalness: 0.65,
      transparent: true,
      opacity: 0.92,
      depthWrite: false
    });
    const sheenMat = new THREE.MeshBasicMaterial({
      color: 0x26323a,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });
    const debrisMat = new THREE.MeshStandardMaterial({
      color: 0x4a3b2c,
      roughness: 0.8
    });

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (i % 2) * 0.35;
      const radius = 9 + (i % 3) * 5.5;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const group = new THREE.Group();
      group.position.set(x, this.surfaceY + 0.06, z);

      // Irregular multi-lobe flat oil slick floating on water
      for (let l = 0; l < 3; l++) {
        const lobeGeo = new THREE.CircleGeometry(1.7 + l * 0.55, 14);
        lobeGeo.rotateX(-Math.PI / 2);
        const lobe = new THREE.Mesh(lobeGeo, l === 2 ? sheenMat.clone() : oilMat.clone());
        lobe.position.set((l - 1) * 1.1, l * 0.005, ((l % 2) - 0.5) * 0.9);
        lobe.scale.set(1.25, 1, 0.82);
        lobe.rotation.y = l * 0.9;
        group.add(lobe);
      }

      // Small floating debris pieces
      for (let d = 0; d < 2; d++) {
        const deb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.3), debrisMat);
        deb.position.set((d - 0.5) * 1.4, 0.08, (d - 0.5) * 0.8);
        deb.rotation.y = d * 1.1;
        group.add(deb);
      }

      // Subtle warning ring on surface
      const ringGeo = new THREE.RingGeometry(2.8, 3.05, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: 0xff9b45, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
      );
      ring.position.y = 0.03;
      group.add(ring);

      this.scene.add(group);
      this.oilPatches.push({
        id: `oil-${i}`,
        group,
        x,
        z,
        pollutionAmount: 5, // 5 units per patch (8 patches = 40 units)
        remaining: 5,
        cleaned: false
      });
    }
  }

  clearOilSlicks() {
    for (const p of this.oilPatches) {
      this.scene.remove(p.group);
    }
    this.oilPatches = [];
  }

  update(elapsed) {
    if (!this.waterMesh) return;
    const pos = this.waterMesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const bx = this.basePositions[i * 3];
      const bz = this.basePositions[i * 3 + 2];
      const wave =
        Math.sin(bx * 0.16 + elapsed * 1.4) * 0.22 +
        Math.cos(bz * 0.14 + elapsed * 1.1) * 0.18;
      pos.setY(i, wave);
    }
    pos.needsUpdate = true;
    this.waterMesh.geometry.computeVertexNormals();

    // Gently bob oil slicks with waves
    for (const p of this.oilPatches) {
      if (!p.cleaned) {
        const waveY =
          Math.sin(p.x * 0.16 + elapsed * 1.4) * 0.2 +
          Math.cos(p.z * 0.14 + elapsed * 1.1) * 0.16;
        p.group.position.y = this.surfaceY + 0.06 + waveY;
        p.group.rotation.y += 0.002;
      }
    }
  }
}

export class HumanDiver {
  constructor(scene, oceanEnv) {
    this.scene = scene;
    this.oceanEnv = oceanEnv;
    this.root = new THREE.Group();
    this.root.visible = false;
    this.speed = 6.8;
    this.turnSpeed = 3.2;
    this.leftLeg = null;
    this.rightLeg = null;
    this.rightArm = null;
    this.cleaningBeam = null;

    this.buildDiverMesh();
    this.scene.add(this.root);
  }

  buildDiverMesh() {
    const suitMat = new THREE.MeshStandardMaterial({ color: 0x0b2d43, roughness: 0.45 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x18c8da, roughness: 0.35 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf0c29e, roughness: 0.6 });
    const tankMat = new THREE.MeshStandardMaterial({ color: 0xffc83d, roughness: 0.3, metalness: 0.4 });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x7af8ff });

    // Torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.72, 6, 12), suitMat);
    this.root.add(torso);

    // Chest accent
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.5, 0.42), accentMat);
    vest.position.set(0, 0.1, 0.05);
    this.root.add(vest);

    // Oxygen Tank on back
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.72, 10), tankMat);
    tank.position.set(0, 0.12, -0.34);
    this.root.add(tank);

    // Head + Diving Mask
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), skinMat);
    head.position.set(0, 0.68, 0.02);
    this.root.add(head);

    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.14), glassMat);
    mask.position.set(0, 0.7, 0.22);
    this.root.add(mask);

    // Legs + Flippers
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.15, -0.45, 0);
    const lLegMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.48, 4, 8), suitMat);
    lLegMesh.position.y = -0.25;
    const lFin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.45), accentMat);
    lFin.position.set(0, -0.58, 0.12);
    this.leftLeg.add(lLegMesh, lFin);
    this.root.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.15, -0.45, 0);
    const rLegMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.48, 4, 8), suitMat);
    rLegMesh.position.y = -0.25;
    const rFin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.45), accentMat);
    rFin.position.set(0, -0.58, 0.12);
    this.rightLeg.add(rLegMesh, rFin);
    this.root.add(this.rightLeg);

    // Right arm holding reef-cleaning nozzle
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.4, 0.28, 0.05);
    const armMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 4, 8), suitMat);
    armMesh.rotation.x = Math.PI / 2.4;
    armMesh.position.set(0, -0.1, 0.25);
    this.rightArm.add(armMesh);

    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.35, 8), tankMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, -0.18, 0.52);
    this.rightArm.add(nozzle);

    const beamGeo = new THREE.ConeGeometry(0.45, 1.8, 12, 1, true);
    beamGeo.rotateX(-Math.PI / 2);
    this.cleaningBeam = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({
        color: 0x39d9c4,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide
      })
    );
    this.cleaningBeam.position.set(0, -0.18, 1.45);
    this.cleaningBeam.visible = false;
    this.rightArm.add(this.cleaningBeam);

    this.root.add(this.rightArm);
  }

  animate(elapsed, isMoving, isCleaning) {
    if (!this.root.visible) return;
    const kickSpeed = isMoving ? 9.0 : 2.5;
    const kickAmp = isMoving ? 0.45 : 0.12;
    this.leftLeg.rotation.x = Math.sin(elapsed * kickSpeed) * kickAmp;
    this.rightLeg.rotation.x = -Math.sin(elapsed * kickSpeed) * kickAmp;
    this.cleaningBeam.visible = isCleaning;
    if (isCleaning) {
      this.rightArm.rotation.y = Math.sin(elapsed * 8) * 0.22;
    } else {
      this.rightArm.rotation.y = 0;
    }
  }
}
