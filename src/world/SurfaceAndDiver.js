import * as THREE from 'three';

// ============================================================================
// UPGRADED SURFACE OCEAN, BOAT WAKE FOAM, ORGANIC OIL SLICKS & HUMAN DIVER
// ============================================================================

function createWaterSurfaceTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#0e6d96');
  grad.addColorStop(0.5, '#168ab8');
  grad.addColorStop(1, '#0c5e85');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle stylized wave ripples and caustic highlights
  for (let i = 0; i < 90; i++) {
    const x = (Math.sin(i * 19.7) * 0.5 + 0.5) * 512;
    const y = (Math.cos(i * 31.3) * 0.5 + 0.5) * 512;
    const rx = 28 + (i % 6) * 12;
    const ry = 6 + (i % 4) * 3;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(155, 248, 255, 0.22)' : 'rgba(7, 36, 58, 0.20)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, (i % 5) * 0.15, 0, Math.PI * 2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  return tex;
}

function createOrganicOilTexture(seed = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  // Outer feathered dark-brown emulsified oil edge
  const outerGrad = ctx.createRadialGradient(128, 128, 18, 128, 128, 118);
  outerGrad.addColorStop(0, 'rgba(12, 15, 19, 0.98)');
  outerGrad.addColorStop(0.45, 'rgba(22, 24, 28, 0.94)');
  outerGrad.addColorStop(0.72, 'rgba(46, 33, 24, 0.78)');
  outerGrad.addColorStop(0.9, 'rgba(30, 44, 52, 0.35)');
  outerGrad.addColorStop(1.0, 'rgba(15, 25, 32, 0.0)');

  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  const pts = 24;
  for (let i = 0; i <= pts; i++) {
    const ang = (i / pts) * Math.PI * 2;
    const wobble =
      1.0 +
      Math.sin(ang * 3 + seed) * 0.18 +
      Math.cos(ang * 5 - seed * 1.7) * 0.12 +
      Math.sin(ang * 7 + seed * 0.5) * 0.07;
    const r = 92 * wobble;
    const px = 128 + Math.cos(ang) * r;
    const py = 128 + Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // Subtle iridescent rainbow/petroleum sheen swirls inside the slick
  const sheenGrad = ctx.createLinearGradient(48, 48, 200, 200);
  sheenGrad.addColorStop(0, 'rgba(56, 180, 198, 0.22)');
  sheenGrad.addColorStop(0.45, 'rgba(148, 92, 175, 0.20)');
  sheenGrad.addColorStop(0.8, 'rgba(215, 145, 65, 0.18)');
  sheenGrad.addColorStop(1, 'rgba(20, 30, 36, 0.0)');
  ctx.strokeStyle = sheenGrad;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(124, 126, 46, 0.3 + seed, 3.8 + seed);
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

export class SurfaceOceanManager {
  constructor(scene) {
    this.scene = scene;
    this.surfaceY = 26.0;
    this.waterMesh = null;
    this.waterTex = null;
    this.basePositions = null;
    this.boatFoamGroup = null;
    this.foamRings = [];
    this.sunGlintMesh = null;
    this.oilPatches = [];

    this.buildSurfaceWater();
    this.buildBoatFoamAndSunGlint();
  }

  buildSurfaceWater() {
    const segs = 88;
    const geo = new THREE.PlaneGeometry(320, 320, segs, segs);
    geo.rotateX(-Math.PI / 2);
    this.basePositions = new Float32Array(geo.attributes.position.array);

    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = 0.12;
      colors[i * 3 + 1] = 0.62;
      colors[i * 3 + 2] = 0.78;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.waterTex = createWaterSurfaceTexture();

    const mat = new THREE.MeshStandardMaterial({
      map: this.waterTex,
      vertexColors: true,
      roughness: 0.18,
      metalness: 0.28,
      transparent: true,
      opacity: 0.91,
      side: THREE.DoubleSide
    });

    this.waterMesh = new THREE.Mesh(geo, mat);
    this.waterMesh.position.y = this.surfaceY;
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);
  }

  buildBoatFoamAndSunGlint() {
    // Gentle white water-foam cushions & wake around the boat hull
    this.boatFoamGroup = new THREE.Group();
    this.boatFoamGroup.position.y = this.surfaceY + 0.04;

    const foamCanvas = document.createElement('canvas');
    foamCanvas.width = 256;
    foamCanvas.height = 256;
    const fctx = foamCanvas.getContext('2d');
    const fgrad = fctx.createRadialGradient(128, 128, 36, 128, 128, 120);
    fgrad.addColorStop(0, 'rgba(220, 252, 255, 0.0)');
    fgrad.addColorStop(0.55, 'rgba(215, 252, 255, 0.55)');
    fgrad.addColorStop(0.78, 'rgba(140, 240, 255, 0.28)');
    fgrad.addColorStop(1, 'rgba(140, 240, 255, 0.0)');
    fctx.fillStyle = fgrad;
    fctx.fillRect(0, 0, 256, 256);
    const foamTex = new THREE.CanvasTexture(foamCanvas);

    for (let i = 0; i < 2; i++) {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(9.2 + i * 2.2, 16.8 + i * 2.8),
        new THREE.MeshBasicMaterial({
          map: foamTex,
          transparent: true,
          opacity: 0.55 - i * 0.18,
          depthWrite: false
        })
      );
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = i * 0.01;
      this.boatFoamGroup.add(plane);
      this.foamRings.push(plane);
    }

    this.scene.add(this.boatFoamGroup);
  }

  getWaveHeightAt(x, z, elapsed) {
    return (
      Math.sin(x * 0.13 + elapsed * 1.45) * 0.22 +
      Math.cos(z * 0.11 + elapsed * 1.15) * 0.18 +
      Math.sin((x + z) * 0.22 - elapsed * 1.8) * 0.08
    );
  }

  spawnOilSlicks(count = 8, startIndexOffset = 0) {
    if (startIndexOffset === 0) {
      this.clearOilSlicks();
    }

    const drumMat = new THREE.MeshStandardMaterial({
      color: 0x6e2c1e,
      roughness: 0.65,
      metalness: 0.45
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x4d3928,
      roughness: 0.85
    });

    for (let i = 0; i < count; i++) {
      const idx = startIndexOffset + i;
      const angle = (i / count) * Math.PI * 2 + (idx % 3) * 0.32;
      const radius = 10.5 + (i % 3) * 5.8;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const group = new THREE.Group();
      group.position.set(x, this.surfaceY + 0.05, z);

      // Multi-layered irregular organic oil slick (NO ring indicator!)
      const texMain = createOrganicOilTexture(idx * 2.1 + 1.0);
      const texSub = createOrganicOilTexture(idx * 3.7 + 2.5);

      const mainMat = new THREE.MeshStandardMaterial({
        map: texMain,
        roughness: 0.12,
        metalness: 0.72,
        transparent: true,
        opacity: 0.96,
        depthWrite: false
      });

      const subMat = new THREE.MeshStandardMaterial({
        map: texSub,
        roughness: 0.16,
        metalness: 0.62,
        transparent: true,
        opacity: 0.88,
        depthWrite: false
      });

      const mainPlane = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 5.8), mainMat);
      mainPlane.rotation.x = -Math.PI / 2;
      mainPlane.rotation.z = idx * 0.8;
      group.add(mainPlane);

      for (let l = 0; l < 2; l++) {
        const subPlane = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.8), subMat.clone());
        subPlane.rotation.x = -Math.PI / 2;
        subPlane.rotation.z = idx * 1.3 + l * 1.9;
        subPlane.position.set((l === 0 ? 1 : -1) * 2.1, 0.01 + l * 0.005, (l - 0.5) * 1.4);
        group.add(subPlane);
      }

      // Floating industrial barrel & driftwood debris trapped in the slick
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.68, 12), drumMat);
      barrel.rotation.z = Math.PI / 2 + 0.18;
      barrel.rotation.y = idx * 0.9;
      barrel.position.set(0.8, 0.04, -0.4);
      group.add(barrel);

      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.22), woodMat);
      plank.position.set(-0.9, 0.03, 0.65);
      plank.rotation.y = idx * 1.4 + 0.5;
      group.add(plank);

      this.scene.add(group);
      this.oilPatches.push({
        id: `oil-${idx}`,
        group,
        mainMat,
        x,
        z,
        pollutionAmount: 5,
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

  update(elapsed, vesselGroup = null) {
    if (!this.waterMesh) return;

    if (this.waterTex) {
      this.waterTex.offset.x = Math.sin(elapsed * 0.12) * 0.08 + elapsed * 0.015;
      this.waterTex.offset.y = Math.cos(elapsed * 0.1) * 0.06 + elapsed * 0.01;
    }

    const pos = this.waterMesh.geometry.attributes.position;
    const col = this.waterMesh.geometry.attributes.color;

    const cDeep = new THREE.Color(0x0b4c73);
    const cMid = new THREE.Color(0x1686b0);
    const cCrest = new THREE.Color(0x68f0ff);
    const cSun = new THREE.Color(0xfff0b8);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const bx = this.basePositions[i * 3];
      const bz = this.basePositions[i * 3 + 2];
      const wave = this.getWaveHeightAt(bx, bz, elapsed);
      pos.setY(i, wave);

      // Dynamic depth + wave crest vertex coloring + sunlight shimmer path
      const dist = Math.hypot(bx, bz);
      const horizonFade = Math.min(1, dist / 145);
      const normWave = Math.max(0, Math.min(1, (wave + 0.45) / 0.9));

      tmp.lerpColors(cDeep, cMid, 1 - horizonFade * 0.65);
      if (normWave > 0.58) {
        tmp.lerp(cCrest, (normWave - 0.58) * 1.15);
      }

      // Sunlight reflection path along positive X/Z diagonal
      const sunAlign = Math.max(0, 1 - Math.abs(bx - bz * 0.85) / 26);
      if (sunAlign > 0 && normWave > 0.52) {
        tmp.lerp(cSun, sunAlign * (normWave - 0.5) * 0.65);
      }

      col.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.waterMesh.geometry.computeVertexNormals();

    // Update boat foam ring position and pulse
    if (vesselGroup && this.boatFoamGroup) {
      const vx = vesselGroup.position.x;
      const vz = vesselGroup.position.z;
      const waveY = this.getWaveHeightAt(vx, vz, elapsed);
      this.boatFoamGroup.position.set(vx, this.surfaceY + waveY + 0.05, vz);
      this.boatFoamGroup.rotation.y = vesselGroup.rotation.y;
      this.foamRings.forEach((r, idx) => {
        const s = 1.0 + Math.sin(elapsed * 2.4 + idx * 1.5) * 0.06;
        r.scale.set(s, s, 1);
      });
    }

    // Gently bob and tilt organic oil slicks with waves, and scale by remaining oil
    for (const p of this.oilPatches) {
      if (!p.cleaned) {
        const waveY = this.getWaveHeightAt(p.x, p.z, elapsed);
        p.group.position.y = this.surfaceY + 0.05 + waveY;
        p.group.rotation.z = Math.sin(elapsed * 1.2 + p.x) * 0.03;
        p.group.rotation.x = Math.cos(elapsed * 1.1 + p.z) * 0.03;

        const ratio = Math.max(0.15, p.remaining / p.pollutionAmount);
        const curScale = THREE.MathUtils.lerp(p.group.scale.x, ratio, 0.15);
        p.group.scale.set(curScale, 1, curScale);
        if (p.mainMat) {
          p.mainMat.opacity = 0.35 + ratio * 0.6;
        }
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
    const suitMat = new THREE.MeshStandardMaterial({ color: 0x0b2d43, roughness: 0.42 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x18c8da, roughness: 0.32 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf0c29e, roughness: 0.55 });
    const tankMat = new THREE.MeshStandardMaterial({ color: 0xffc83d, roughness: 0.28, metalness: 0.45 });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x7af8ff });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.72, 8, 14), suitMat);
    torso.castShadow = true;
    this.root.add(torso);

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.52, 0.44), accentMat);
    vest.position.set(0, 0.1, 0.05);
    this.root.add(vest);

    // Dual scuba tanks on back
    for (let tx of [-0.14, 0.14]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.74, 12), tankMat);
      tank.position.set(tx, 0.14, -0.34);
      this.root.add(tank);
    }

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 14), skinMat);
    head.position.set(0, 0.68, 0.02);
    this.root.add(head);

    const maskRim = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.16), suitMat);
    maskRim.position.set(0, 0.7, 0.2);
    this.root.add(maskRim);

    const maskGlass = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.15, 0.14), glassMat);
    maskGlass.position.set(0, 0.7, 0.23);
    this.root.add(maskGlass);

    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.15, -0.45, 0);
    const lLegMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.48, 4, 8), suitMat);
    lLegMesh.position.y = -0.25;
    const lFin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.48), accentMat);
    lFin.position.set(0, -0.58, 0.14);
    this.leftLeg.add(lLegMesh, lFin);
    this.root.add(this.leftLeg);

    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.15, -0.45, 0);
    const rLegMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.48, 4, 8), suitMat);
    rLegMesh.position.y = -0.25;
    const rFin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.48), accentMat);
    rFin.position.set(0, -0.58, 0.14);
    this.rightLeg.add(rLegMesh, rFin);
    this.root.add(this.rightLeg);

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
