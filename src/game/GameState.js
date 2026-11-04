import * as THREE from 'three';

export const RULE_CHANGES = {
  stage1: {
    id: 'stage1',
    title: 'RULE CHANGE I — BOOST MINERAL PRICE CHARTER',
    subtitle: 'International Seabed Authority & Board of Directors',
    description:
      'Use 1 of your 2 corporate rule changes to rewrite market pricing or environmental filtration standards. This decision is permanent for the remainder of the game.',
    options: [
      {
        id: 'boost_price',
        badge: 'MARKET BOOST',
        badgeClass: 'badge-amber',
        title: 'Boost Mineral Price (+45% Value)',
        shortTitle: 'Boost mineral price',
        oneLine: 'Increase all polymetallic ore sell prices by +45% immediately.',
        costText: 'Cost: Free Charter Vote',
        effectsText: '+45% Ore Sell Value • +15% Cutter Torque • +20% Turbidity',
        apply: (state) => {
          state.priceMultiplier *= 1.45;
          state.miningSpeedMultiplier *= 1.15;
          state.pollutionMultiplier *= 1.2;
        }
      },
      {
        id: 'filtration',
        badge: 'CLEAN EXTRACTION',
        badgeClass: 'badge-cyan',
        title: 'Cleaner Extraction Incentives',
        shortTitle: 'Cleaner extraction',
        oneLine: 'Cut seabed sediment damage by 40% and claim a $90K green grant.',
        costText: 'Grant: +$90K Cash',
        effectsText: '-40% Ecosystem Damage • +$90K Compliance Grant',
        apply: (state) => {
          state.pollutionMultiplier *= 0.6;
          state.treasury += 90000;
          state.netProfit += 90000;
        }
      }
    ]
  },
  stage2: {
    id: 'stage2',
    title: 'RULE CHANGE II — EXPAND ZONE & RECLAMATION',
    subtitle: 'Deep-Basin Survey & Ecological Tribunal',
    description:
      'Use a rule change to unlock high-grade mineral veins or pivot ABYSS INC. toward high-bounty coral reef restoration.',
    options: [
      {
        id: 'open_zone',
        badge: 'NEW MINING ZONE',
        badgeClass: 'badge-purple',
        title: 'Open New High-Grade Zone (+250t)',
        shortTitle: 'Open new zone',
        oneLine: 'Unlocks Abyssal Trench access, spawns +250t rich veins & boosts speed +25%.',
        costText: 'Permit Cost: $30K',
        effectsText: 'Unlocks Abyssal Trench • +250t Reserves • +25% Speed',
        apply: (state) => {
          if (state.treasury >= 30000) {
            state.treasury -= 30000;
          }
          if (state.worldMap) {
            const tr = state.worldMap.getZoneById('abyssal_trench');
            if (tr && tr.status === 'LOCKED') {
              tr.status = 'ACCESSIBLE';
              tr.discovered = true;
              state.worldMap.updateZoneVisuals(tr);
              const outer = state.worldMap.getZoneById('outer_abyss');
              if (outer && outer.status === 'UNDISCOVERED') {
                outer.status = 'LOCKED';
                outer.discovered = true;
                state.worldMap.updateZoneVisuals(outer);
              }
            }
          }
          state.ecosystem.spawnNewMiningZones();
          state.fleet.crawler.speed *= 1.25;
          state.fleet.submarine.speed *= 1.25;
          state.miningSpeedMultiplier *= 1.25;
        }
      },
      {
        id: 'moratorium',
        badge: 'RESTORATION PACT',
        badgeClass: 'badge-green',
        title: 'Reef Restoration Bounty Charter',
        shortTitle: 'Restoration bounty',
        oneLine: 'Doubles payouts for restoring damaged zones ($95K per reef).',
        costText: 'Bounty: $95K / Zone',
        effectsText: '$95K Bounty per Restored Zone • +50% Restoration Speed',
        apply: (state) => {
          state.phase = 'RESTORATION FOCUS';
          state.restorationBounty = 95000;
          state.restorationSpeedMultiplier *= 1.5;
        }
      }
    ]
  }
};

export class GameController {
  constructor(oceanEnv, ecosystem, fleet, sound, uiCallbacks, worldMap = null) {
    this.oceanEnv = oceanEnv;
    this.ecosystem = ecosystem;
    this.fleet = fleet;
    this.sound = sound;
    this.ui = uiCallbacks;
    this.worldMap = worldMap;

    this.treasury = 434000;
    this.netProfit = 0;
    this.totalTonsMined = 0;
    this.totalTonsSold = 0;
    this.stockpileTons = 0;
    this.stockpileValue = 0;
    this.marketIndex = 1.0;
    this.priceMultiplier = 1.0;
    this.miningSpeedMultiplier = 1.0;
    this.pollutionMultiplier = 1.0;
    this.restorationSpeedMultiplier = 1.0;
    this.restorationBounty = 50000;
    this.esgBonusPerRestore = 0.08;

    this.round = 3;
    this.maxRounds = 12;
    this.roundTimer = 0;
    this.secondsPerRound = 35;

    this.phase = 'DEEP-SEA MINING';
    this.selectedMachineId = 'crawler';

    this.maxRuleChanges = 2;
    this.rulesUsedCount = 0;
    this.rule1Enacted = null;
    this.rule2Enacted = null;
    this.rule1Prompted = false;
    this.rule2Prompted = false;

    this.missions = {
      mineTargetTons: 50,
      restoreTargetZones: 2
    };

    this.upgrades = {
      cutterLevel: 1,
      hopperLevel: 1,
      bioLaserLevel: 1
    };

    this.mineTickAccum = 0;
    this.restoreTickAccum = 0;
    this.lastBoundaryWarnTime = 0;
  }

  getRulesRemaining() {
    return Math.max(0, this.maxRuleChanges - this.rulesUsedCount);
  }

  getSelectedMachine() {
    if (this.selectedMachineId === 'submarine') return this.fleet.submarine;
    if (this.selectedMachineId === 'drone') return this.fleet.restorationDrone;
    return this.fleet.crawler;
  }

  selectMachine(machineId) {
    this.selectedMachineId = machineId;
    if (machineId) {
      this.sound.playSonarPing(machineId === 'drone' ? 980 : 740);
    }

    this.fleet.crawler.selectionRing.material.opacity = machineId === 'crawler' ? 0.88 : 0.0;
    this.fleet.submarine.selectionRing.material.opacity = machineId === 'submarine' ? 0.88 : 0.0;
    this.fleet.restorationDrone.selectionRing.material.opacity = machineId === 'drone' ? 0.88 : 0.0;

    if (this.ui.onSelectionChange) {
      this.ui.onSelectionChange(machineId ? this.getSelectedMachine() : null);
    }
  }

  // Navigate the currently selected machine to a specific unlocked zone via the real movement system
  navigateSelectedMachineToZone(zoneId) {
    if (!this.worldMap) return false;
    const z = this.worldMap.getZoneById(zoneId);
    if (!z) return false;

    if (!this.worldMap.isZoneUnlocked(zoneId)) {
      if (this.ui.onWorldPopup) {
        this.ui.onWorldPopup(
          new THREE.Vector3(z.x, this.oceanEnv.getTerrainHeight(z.x, z.z) + 2.5, z.z),
          `🔒 ${z.name} is Locked! Unlock in World Map first.`,
          'popup-gold'
        );
      }
      return false;
    }

    const mach = this.getSelectedMachine() || this.fleet.crawler;
    const hoverOffset = mach.id === 'crawler' ? 0 : mach.id === 'drone' ? 2.2 : 4.2;

    // If zone has an eligible deposit and machine is crawler, target that deposit
    if (mach.id === 'crawler' && z.miningAllowed) {
      const dep = this.ecosystem.deposits.find((d) => d.zoneId === zoneId && !d.depleted);
      if (dep) {
        mach.targetDeposit = dep;
        mach.targetPos = new THREE.Vector3(dep.x, this.oceanEnv.getTerrainHeight(dep.x, dep.z), dep.z);
        mach.state = 'MOVING';
        this.sound.playSonarPing(720);
        return true;
      }
    }

    // If zone is The Scar / has damaged sites and machine is drone, target damaged site
    if (mach.id === 'drone') {
      const scar = this.ecosystem.damagedSites.find(
        (s) => !s.restored && Math.hypot(s.x - z.x, s.z - z.z) <= z.radius + 3.5
      );
      if (scar) {
        mach.targetSite = scar;
        mach.targetPos = new THREE.Vector3(
          scar.x,
          this.oceanEnv.getTerrainHeight(scar.x, scar.z) + 2.2,
          scar.z
        );
        mach.state = 'MOVING';
        this.sound.playSonarPing(1040);
        return true;
      }
    }

    mach.targetDeposit = null;
    mach.targetSite = null;
    mach.targetPos = new THREE.Vector3(
      z.x,
      this.oceanEnv.getTerrainHeight(z.x, z.z) + hoverOffset,
      z.z
    );
    mach.state = 'MOVING';
    if (mach.id === 'submarine') mach.autonomous = false;
    this.sound.playSonarPing(640);
    return true;
  }

  issueWorldCommand(point, hitData) {
    this.sound.resume();

    if (hitData && hitData.type === 'machine') {
      this.selectMachine(hitData.machineId);
      return;
    }

    // Check zone access at clicked destination
    if (this.worldMap) {
      const targetX = hitData?.deposit?.x ?? hitData?.site?.x ?? point.x;
      const targetZ = hitData?.deposit?.z ?? hitData?.site?.z ?? point.z;
      const check = this.worldMap.canMachineEnterPoint(targetX, targetZ);

      if (check.zone) {
        this.worldMap.selectZone(check.zone.id);
      }

      if (!check.allowed && check.zone) {
        this.sound.playRuleChangeAlert();
        if (this.ui.onWorldPopup) {
          this.ui.onWorldPopup(
            new THREE.Vector3(targetX, this.oceanEnv.getTerrainHeight(targetX, targetZ) + 2.6, targetZ),
            `🔒 ${check.zone.name} Locked — Open Map [M] to Unlock`,
            'popup-gold'
          );
        }
        if (this.ui.onZoneSelectedInWorld) {
          this.ui.onZoneSelectedInWorld(check.zone.id);
        }
        return;
      }
    }

    if (hitData && hitData.type === 'deposit') {
      const dep = hitData.deposit;
      if (dep.depleted) return;

      // Check if deposit is inside a zone where mining is currently restricted (e.g., The Scar before cleanup)
      if (this.worldMap && dep.zoneId && !this.worldMap.canMineInZone(dep.zoneId)) {
        const z = this.worldMap.getZoneById(dep.zoneId);
        if (this.ui.onWorldPopup) {
          this.ui.onWorldPopup(
            new THREE.Vector3(dep.x, this.oceanEnv.getTerrainHeight(dep.x, dep.z) + 2.6, dep.z),
            z && z.status === 'RESTORATION'
              ? `⚠️ Restore Damaged Sites in ${z.name} Before Mining!`
              : `🛑 Mining Prohibited in ${z ? z.name : 'this zone'}!`,
            'popup-gold'
          );
        }
        return;
      }

      if (!this.selectedMachineId || this.selectedMachineId === 'drone') {
        this.selectMachine('crawler');
      }
      const mach = this.getSelectedMachine();
      mach.targetDeposit = dep;
      mach.targetPos = new THREE.Vector3(dep.x, this.oceanEnv.getTerrainHeight(dep.x, dep.z), dep.z);
      mach.state = 'MOVING';
      if (mach.id === 'submarine') mach.autonomous = false;
      this.sound.playSonarPing(660);
      return;
    }

    if (hitData && hitData.type === 'damagedSite') {
      const site = hitData.site;
      if (site.restored) return;

      this.selectMachine('drone');
      const drone = this.fleet.restorationDrone;
      drone.targetSite = site;
      drone.targetPos = new THREE.Vector3(site.x, this.oceanEnv.getTerrainHeight(site.x, site.z) + 2.2, site.z);
      drone.state = 'MOVING';
      this.sound.playSonarPing(1040);
      return;
    }

    // Clicked open seabed terrain
    if (!this.selectedMachineId) {
      this.selectMachine('crawler');
    }
    const mach = this.getSelectedMachine();
    const clampedX = Math.max(-36, Math.min(36, point.x));
    const clampedZ = Math.max(-36, Math.min(36, point.z));
    const targetY =
      mach.id === 'crawler'
        ? this.oceanEnv.getTerrainHeight(clampedX, clampedZ)
        : this.oceanEnv.getTerrainHeight(clampedX, clampedZ) + (mach.id === 'drone' ? 2.2 : 4.2);

    mach.targetDeposit = null;
    mach.targetSite = null;
    mach.targetPos = new THREE.Vector3(clampedX, targetY, clampedZ);
    mach.state = 'MOVING';
    if (mach.id === 'submarine') mach.autonomous = false;
    this.sound.playSonarPing(580);
  }

  // Primary Yellow Button: MINE
  dispatchCrawlerToNearestDeposit() {
    this.sound.resume();
    this.selectMachine('crawler');
    const c = this.fleet.crawler;

    // Check if crawler is currently inside Coral Sanctuary (Protected)
    if (this.worldMap) {
      const curZone = this.worldMap.getZoneAtPoint(c.root.position.x, c.root.position.z);
      if (curZone && curZone.status === 'PROTECTED') {
        if (this.ui.onWorldPopup) {
          this.ui.onWorldPopup(
            c.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)),
            '🛑 Coral Sanctuary: Mining Prohibited! Navigating to Nodule Fields...',
            'popup-gold'
          );
        }
      }
    }

    if (c.capacity >= c.maxCapacity) {
      if (this.ui.onWorldPopup) {
        this.ui.onWorldPopup(
          c.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)),
          'Hopper Full! Click SELL ORE to offload',
          'popup-gold'
        );
      }
      return false;
    }

    let best = null;
    let bestDist = Infinity;
    for (const dep of this.ecosystem.deposits) {
      const canMineZone = !this.worldMap || !dep.zoneId || this.worldMap.canMineInZone(dep.zoneId);
      if (!dep.depleted && dep.remainingTons > 1 && canMineZone) {
        const d = Math.hypot(dep.x - c.root.position.x, dep.z - c.root.position.z);
        if (d < bestDist) {
          bestDist = d;
          best = dep;
        }
      }
    }
    if (best) {
      c.targetDeposit = best;
      c.targetPos = new THREE.Vector3(best.x, this.oceanEnv.getTerrainHeight(best.x, best.z), best.z);
      c.state = 'MOVING';
      this.sound.playSonarPing(720);
      return true;
    }

    if (this.ui.onWorldPopup) {
      this.ui.onWorldPopup(
        c.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)),
        'No unlocked deposits left — Open World Map [M] to unlock new regions!',
        'popup-gold'
      );
    }
    return false;
  }

  // Primary Blue Button: SELL ORE
  sellCollectedOre() {
    this.sound.resume();
    const c = this.fleet.crawler;
    const sub = this.fleet.submarine;

    if (c.capacity >= 1) {
      this.offloadMachineCargo(c);
      return true;
    }
    if (sub.capacity >= 1) {
      this.offloadMachineCargo(sub);
      return true;
    }

    if (this.ui.onWorldPopup) {
      this.ui.onWorldPopup(
        c.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)),
        'No ore in hopper yet — mining nearest deposit!',
        'popup-cyan'
      );
    }
    this.dispatchCrawlerToNearestDeposit();
    return false;
  }

  returnCrawlerToHub() {
    const c = this.fleet.crawler;
    c.targetDeposit = null;
    const hx = this.oceanEnv.riserHubPosition.x + 3.5;
    const hz = this.oceanEnv.riserHubPosition.z + 3.5;
    c.targetPos = new THREE.Vector3(hx, this.oceanEnv.getTerrainHeight(hx, hz), hz);
    c.state = 'MOVING';
    this.sound.playSonarPing(520);
  }

  // Primary Green Button: RESTORE
  dispatchDroneToNearestDamagedSite() {
    this.sound.resume();
    this.selectMachine('drone');
    const dr = this.fleet.restorationDrone;
    let best = null;
    let bestDist = Infinity;

    for (const site of this.ecosystem.damagedSites) {
      if (!site.restored) {
        const check = this.worldMap ? this.worldMap.canMachineEnterPoint(site.x, site.z) : { allowed: true };
        if (check.allowed) {
          const d = Math.hypot(site.x - dr.root.position.x, site.z - dr.root.position.z);
          if (d < bestDist) {
            bestDist = d;
            best = site;
          }
        }
      }
    }

    if (best) {
      dr.targetSite = best;
      dr.targetPos = new THREE.Vector3(best.x, this.oceanEnv.getTerrainHeight(best.x, best.z) + 2.2, best.z);
      dr.state = 'MOVING';
      this.sound.playSonarPing(1080);
      return true;
    }

    let worstSector = null;
    let lowestHealth = 99.5;
    for (const s of this.oceanEnv.sectors) {
      const check = this.worldMap ? this.worldMap.canMachineEnterPoint(s.x, s.z) : { allowed: true };
      if (check.allowed && s.health < lowestHealth) {
        lowestHealth = s.health;
        worstSector = s;
      }
    }

    if (worstSector) {
      const site = this.ecosystem.createOrIntensifyDamagedSite(worstSector.x, worstSector.z, 'Benthic Habitat');
      dr.targetSite = site;
      dr.targetPos = new THREE.Vector3(site.x, this.oceanEnv.getTerrainHeight(site.x, site.z) + 2.2, site.z);
      dr.state = 'MOVING';
      this.sound.playSonarPing(1080);
      return true;
    }

    return false;
  }

  offloadMachineCargo(mach) {
    if (mach.capacity <= 0.5) return;

    const tons = Math.round(mach.capacity);
    const payout = Math.round(mach.cargoValue * this.priceMultiplier * this.marketIndex);

    this.treasury += payout;
    this.netProfit += payout;
    this.stockpileTons += tons;
    this.totalTonsSold += tons;

    mach.capacity = 0;
    mach.cargoValue = 0;

    this.fleet.spawnRiserOreTransfer();
    this.sound.playCashDeposit();

    if (this.ui.onWorldPopup) {
      this.ui.onWorldPopup(
        mach.root.position.clone().add(new THREE.Vector3(0, 3.0, 0)),
        `Sold ${tons}t Ore • +$${(payout / 1000).toFixed(1)}K`,
        'popup-gold'
      );
    }
  }

  purchaseUpgrade(type) {
    this.sound.resume();
    let upgraded = false;
    if (type === 'cutter') {
      const cost = 75000 * this.upgrades.cutterLevel;
      if (this.treasury < cost || this.upgrades.cutterLevel >= 4) return false;
      this.treasury -= cost;
      this.netProfit -= cost;
      this.upgrades.cutterLevel++;
      this.miningSpeedMultiplier *= 1.28;
      this.fleet.crawler.speed *= 1.12;
      this.sound.playCashDeposit();
      upgraded = true;
    } else if (type === 'hopper') {
      const cost = 65000 * this.upgrades.hopperLevel;
      if (this.treasury < cost || this.upgrades.hopperLevel >= 4) return false;
      this.treasury -= cost;
      this.netProfit -= cost;
      this.upgrades.hopperLevel++;
      this.fleet.crawler.maxCapacity += 50;
      this.sound.playCashDeposit();
      upgraded = true;
    } else if (type === 'biolaser') {
      const cost = 70000 * this.upgrades.bioLaserLevel;
      if (this.treasury < cost || this.upgrades.bioLaserLevel >= 4) return false;
      this.treasury -= cost;
      this.netProfit -= cost;
      this.upgrades.bioLaserLevel++;
      this.restorationSpeedMultiplier *= 1.38;
      this.fleet.restorationDrone.speed *= 1.15;
      this.sound.playRestorationChime();
      upgraded = true;
    }

    // Upgrading equipment to Lv.2 automatically unlocks Abyssal Trench!
    if (upgraded && this.worldMap && !this.worldMap.isZoneUnlocked('abyssal_trench')) {
      const res = this.worldMap.unlockZone('abyssal_trench', this);
      if (res.ok && this.ui.onWorldPopup) {
        this.ui.onWorldPopup(
          this.fleet.crawler.root.position.clone().add(new THREE.Vector3(0, 3.4, 0)),
          '🔓 Equipment Upgraded: Abyssal Trench Unlocked!',
          'popup-green'
        );
      }
    }
    return upgraded;
  }

  enactRuleChange(stageKey, optionId) {
    if (this.rulesUsedCount >= this.maxRuleChanges) return false;
    if (stageKey === 'stage1' && this.rule1Enacted) return false;
    if (stageKey === 'stage2' && this.rule2Enacted) return false;

    const stage = RULE_CHANGES[stageKey];
    if (!stage) return false;
    const option = stage.options.find((o) => o.id === optionId);
    if (!option) return false;

    option.apply(this);
    this.rulesUsedCount++;
    if (stageKey === 'stage1') this.rule1Enacted = option;
    if (stageKey === 'stage2') this.rule2Enacted = option;

    this.sound.playRuleChangeAlert();
    if (this.ui.onRuleEnacted) {
      this.ui.onRuleEnacted(stageKey, option, this.getRulesRemaining());
    }
    return true;
  }

  update(dt, elapsed, keyInput) {
    this.roundTimer += dt;
    if (this.roundTimer >= this.secondsPerRound) {
      this.roundTimer = 0;
      if (this.round < this.maxRounds) {
        this.round++;
        this.marketIndex = Number(
          (0.92 + Math.sin(this.round * 1.3) * 0.18 + Math.random() * 0.12).toFixed(2)
        );
      }
    }

    const activeMach = this.getSelectedMachine();
    const hasKeyInput =
      activeMach && (Math.abs(keyInput.forward) > 0.01 || Math.abs(keyInput.turn) > 0.01);

    if (hasKeyInput) {
      activeMach.targetPos = null;
      activeMach.targetDeposit = null;
      activeMach.targetSite = null;
      if (activeMach.id === 'submarine') activeMach.autonomous = false;

      activeMach.root.rotation.y -= keyInput.turn * activeMach.turnSpeed * dt;
      const forwardVec = new THREE.Vector3(0, 0, 1).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        activeMach.root.rotation.y
      );

      const nextX = Math.max(
        -36,
        Math.min(36, activeMach.root.position.x + forwardVec.x * keyInput.forward * activeMach.speed * dt)
      );
      const nextZ = Math.max(
        -36,
        Math.min(36, activeMach.root.position.z + forwardVec.z * keyInput.forward * activeMach.speed * dt)
      );

      // Enforce Locked Region Boundaries during direct WASD driving!
      const entryCheck = this.worldMap
        ? this.worldMap.canMachineEnterPoint(nextX, nextZ)
        : { allowed: true };

      if (!entryCheck.allowed && entryCheck.zone) {
        activeMach.state = 'IDLE';
        if (elapsed - this.lastBoundaryWarnTime > 2.2) {
          this.lastBoundaryWarnTime = elapsed;
          this.sound.playRuleChangeAlert();
          if (this.ui.onWorldPopup) {
            this.ui.onWorldPopup(
              activeMach.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)),
              `🔒 ${entryCheck.zone.name} Locked — Open Map [M] to Unlock`,
              'popup-gold'
            );
          }
        }
      } else {
        const hoverOffset =
          activeMach.id === 'crawler' ? 0 : activeMach.id === 'drone' ? 2.2 : 4.2;
        const nextY = this.oceanEnv.getTerrainHeight(nextX, nextZ) + hoverOffset;

        activeMach.root.position.set(nextX, nextY, nextZ);
        activeMach.state = 'MOVING';

        if (activeMach.id === 'crawler') {
          const moveDist = Math.abs(keyInput.forward) * activeMach.speed * dt;
          activeMach.trackProgress = (activeMach.trackProgress + moveDist * 0.35) % 1;
          activeMach.stepDist += moveDist;
          if (activeMach.stepDist > 1.2) {
            activeMach.stepDist = 0;
            this.fleet.spawnCrawlerTreadMark(nextX, nextZ, activeMach.root.rotation.y);
            this.ecosystem.spawnSedimentBurst(activeMach.root.position, 2, false);
          }
        }
      }
    } else if (activeMach && !activeMach.targetPos && activeMach.state === 'MOVING') {
      activeMach.state = 'IDLE';
    }

    this.updateCrawlerBehavior(dt, elapsed);
    this.updateSubmarineBehavior(dt, elapsed);
    this.updateRestorationDroneBehavior(dt);

    const anyMoving =
      this.fleet.crawler.state === 'MOVING' ||
      this.fleet.restorationDrone.state === 'MOVING';
    const anyMining = this.fleet.crawler.state === 'MINING';
    const anyRestoring = this.fleet.restorationDrone.state === 'RESTORING';
    this.sound.updateMachinerySound(anyMoving, anyMining, anyRestoring);
  }

  updateCrawlerBehavior(dt, elapsed = 0) {
    const c = this.fleet.crawler;

    if (c.targetPos) {
      const dx = c.targetPos.x - c.root.position.x;
      const dz = c.targetPos.z - c.root.position.z;
      const dist = Math.hypot(dx, dz);

      const stopDist = c.targetDeposit ? 3.2 : 1.4;
      if (dist > stopDist) {
        const step = Math.min(dist, c.speed * dt);
        const nx = c.root.position.x + (dx / dist) * step;
        const nz = c.root.position.z + (dz / dist) * step;

        // Check locked zone boundary along path
        const check = this.worldMap ? this.worldMap.canMachineEnterPoint(nx, nz) : { allowed: true };
        if (!check.allowed && check.zone) {
          c.targetPos = null;
          c.targetDeposit = null;
          c.state = 'IDLE';
          if (this.ui.onWorldPopup) {
            this.ui.onWorldPopup(
              c.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)),
              `🔒 Route Blocked: ${check.zone.name} is Locked!`,
              'popup-gold'
            );
          }
          return;
        }

        c.state = 'MOVING';
        const desiredYaw = Math.atan2(dx, dz);
        let diff = desiredYaw - c.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        c.root.rotation.y += diff * Math.min(1, dt * c.turnSpeed * 2.2);

        const ny = this.oceanEnv.getTerrainHeight(nx, nz);
        c.root.position.set(nx, ny, nz);

        c.trackProgress = (c.trackProgress + step * 0.35) % 1;
        c.stepDist += step;
        if (c.stepDist > 1.25) {
          c.stepDist = 0;
          this.fleet.spawnCrawlerTreadMark(nx, nz, c.root.rotation.y);
          this.ecosystem.spawnSedimentBurst(c.root.position, 2, false);
        }
      } else {
        c.targetPos = null;
        if (!c.targetDeposit) c.state = 'IDLE';
      }
    }

    const distToHub = Math.hypot(
      c.root.position.x - this.oceanEnv.riserHubPosition.x,
      c.root.position.z - this.oceanEnv.riserHubPosition.z
    );
    if (distToHub < 6.2 && c.capacity >= 1) {
      this.offloadMachineCargo(c);
    }

    // Block mining if inside a Protected Zone (Coral Sanctuary)
    if (this.worldMap) {
      const curZone = this.worldMap.getZoneAtPoint(c.root.position.x, c.root.position.z);
      if (curZone && curZone.status === 'PROTECTED') {
        if (c.state === 'MINING') c.state = 'IDLE';
        return;
      }
    }

    let activeDep = c.targetDeposit;
    if (!activeDep || activeDep.depleted) {
      activeDep = this.ecosystem.deposits.find(
        (d) =>
          !d.depleted &&
          Math.hypot(d.x - c.root.position.x, d.z - c.root.position.z) < 4.4 &&
          (!this.worldMap || !d.zoneId || this.worldMap.canMineInZone(d.zoneId))
      );
    } else if (Math.hypot(activeDep.x - c.root.position.x, activeDep.z - c.root.position.z) >= 4.6) {
      activeDep = null;
    }

    if (
      activeDep &&
      !activeDep.depleted &&
      c.capacity < c.maxCapacity &&
      (!this.worldMap || !activeDep.zoneId || this.worldMap.canMineInZone(activeDep.zoneId))
    ) {
      c.state = 'MINING';
      const dx = activeDep.x - c.root.position.x;
      const dz = activeDep.z - c.root.position.z;
      const desiredYaw = Math.atan2(dx, dz);
      let diff = desiredYaw - c.root.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.root.rotation.y += diff * Math.min(1, dt * 4);

      this.mineTickAccum += dt * this.miningSpeedMultiplier;
      if (this.mineTickAccum >= 0.55) {
        this.mineTickAccum = 0;
        const extractTons = Math.min(5, activeDep.remainingTons, c.maxCapacity - c.capacity);

        if (extractTons > 0) {
          activeDep.remainingTons -= extractTons;
          c.capacity += extractTons;
          const batchValue = extractTons * activeDep.yieldPerTon;
          c.cargoValue += batchValue;
          this.totalTonsMined += extractTons;

          const nodStart = new THREE.Vector3(
            activeDep.x + (Math.random() - 0.5) * 1.8,
            this.oceanEnv.getTerrainHeight(activeDep.x, activeDep.z) + 0.3,
            activeDep.z + (Math.random() - 0.5) * 1.8
          );
          this.ecosystem.spawnFlyingNodule(nodStart, c, activeDep.color);
          this.ecosystem.spawnSedimentBurst(c.getIntakeWorldPosition(), 5, false);
          this.sound.playNoduleCollect();

          const ratioLeft = activeDep.remainingTons / activeDep.maxTons;
          const visibleNodules = Math.ceil(ratioLeft * activeDep.noduleMeshes.length);
          activeDep.noduleMeshes.forEach((m, idx) => {
            m.visible = idx < visibleNodules;
          });

          // Vent Gardens is flagged as environmentally sensitive (1.45x turbidity sensitivity)
          const zoneSensitivity = activeDep.zoneId === 'vent_gardens' ? 1.45 : 1.0;

          this.oceanEnv.damageSectorAt(
            activeDep.x,
            activeDep.z,
            3.0 * this.pollutionMultiplier * zoneSensitivity,
            5.2 * this.pollutionMultiplier * zoneSensitivity
          );

          if (ratioLeft < 0.35) {
            this.ecosystem.createOrIntensifyDamagedSite(activeDep.x, activeDep.z, activeDep.name);
          }

          if (this.ui.onWorldPopup) {
            const estCash = Math.round(batchValue * this.priceMultiplier * this.marketIndex);
            this.ui.onWorldPopup(
              c.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)),
              `+${extractTons}t Ore ($${(estCash / 1000).toFixed(1)}K)`,
              'popup-cyan'
            );
          }

          if (activeDep.remainingTons <= 0.1) {
            activeDep.remainingTons = 0;
            activeDep.depleted = true;
            activeDep.ringMesh.material.color.setHex(0xf16f75);
            c.targetDeposit = null;
            c.state = 'IDLE';
          }
        }
      }
    } else if (c.state === 'MINING') {
      c.state = 'IDLE';
    }
  }

  updateSubmarineBehavior(dt, elapsed) {
    const sub = this.fleet.submarine;

    if (sub.targetPos) {
      const dx = sub.targetPos.x - sub.root.position.x;
      const dz = sub.targetPos.z - sub.root.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 1.8) {
        const step = Math.min(dist, sub.speed * dt);
        const nx = sub.root.position.x + (dx / dist) * step;
        const nz = sub.root.position.z + (dz / dist) * step;

        const check = this.worldMap ? this.worldMap.canMachineEnterPoint(nx, nz) : { allowed: true };
        if (!check.allowed) {
          sub.targetPos = null;
          sub.state = 'SHUTTLING';
          return;
        }

        sub.state = 'MOVING';
        const desiredYaw = Math.atan2(dx, dz);
        let diff = desiredYaw - sub.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        sub.root.rotation.y += diff * Math.min(1, dt * sub.turnSpeed * 2);

        const ny = this.oceanEnv.getTerrainHeight(nx, nz) + 4.2;
        sub.root.position.set(nx, ny, nz);
      } else {
        sub.targetPos = null;
        sub.state = 'SHUTTLING';
      }
    } else if (sub.autonomous) {
      sub.autoPatrolAngle += dt * 0.35;
      const cPos = this.fleet.crawler.root.position;
      const targetX = cPos.x + 3.8 + Math.cos(sub.autoPatrolAngle) * 2.6;
      const targetZ = cPos.z - 2.2 + Math.sin(sub.autoPatrolAngle) * 2.2;
      const dx = targetX - sub.root.position.x;
      const dz = targetZ - sub.root.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.3) {
        const desiredYaw = Math.atan2(dx, dz);
        let diff = desiredYaw - sub.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        sub.root.rotation.y += diff * Math.min(1, dt * 3);

        const step = Math.min(dist, sub.speed * 0.45 * dt);
        const nx = sub.root.position.x + (dx / dist) * step;
        const nz = sub.root.position.z + (dz / dist) * step;
        const ny = this.oceanEnv.getTerrainHeight(nx, nz) + 4.2;
        sub.root.position.set(nx, ny, nz);
      }
    }
  }

  updateRestorationDroneBehavior(dt) {
    const dr = this.fleet.restorationDrone;

    if (dr.targetPos) {
      const dx = dr.targetPos.x - dr.root.position.x;
      const dz = dr.targetPos.z - dr.root.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 1.8) {
        const step = Math.min(dist, dr.speed * dt);
        const nx = dr.root.position.x + (dx / dist) * step;
        const nz = dr.root.position.z + (dz / dist) * step;

        const check = this.worldMap ? this.worldMap.canMachineEnterPoint(nx, nz) : { allowed: true };
        if (!check.allowed) {
          dr.targetPos = null;
          dr.targetSite = null;
          dr.state = 'STANDBY';
          return;
        }

        dr.state = 'MOVING';
        const desiredYaw = Math.atan2(dx, dz);
        let diff = desiredYaw - dr.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        dr.root.rotation.y += diff * Math.min(1, dt * dr.turnSpeed * 2.2);

        const ny = this.oceanEnv.getTerrainHeight(nx, nz) + 2.2;
        dr.root.position.set(nx, ny, nz);
      } else {
        dr.targetPos = null;
        if (!dr.targetSite) dr.state = 'STANDBY';
      }
    }

    let activeSite = dr.targetSite;
    if (!activeSite || activeSite.restored) {
      activeSite = this.ecosystem.damagedSites.find(
        (s) => !s.restored && Math.hypot(s.x - dr.root.position.x, s.z - dr.root.position.z) < 4.2
      );
    } else if (Math.hypot(activeSite.x - dr.root.position.x, activeSite.z - dr.root.position.z) >= 4.4) {
      activeSite = null;
    }

    if (activeSite && !activeSite.restored) {
      dr.state = 'RESTORING';
      this.restoreTickAccum += dt * this.restorationSpeedMultiplier;

      if (this.restoreTickAccum >= 0.45) {
        this.restoreTickAccum = 0;
        activeSite.restorationProgress = Math.min(100, activeSite.restorationProgress + 20);

        const remRatio = 1 - activeSite.restorationProgress / 100;
        activeSite.plumeGroup.scale.setScalar(Math.max(0.05, remRatio));
        activeSite.debrisGroup.scale.setScalar(Math.max(0.05, remRatio));

        this.oceanEnv.restoreSectorAt(activeSite.x, activeSite.z, 9.5, 16.0);
        this.ecosystem.spawnSedimentBurst(
          new THREE.Vector3(
            activeSite.x,
            this.oceanEnv.getTerrainHeight(activeSite.x, activeSite.z) + 0.5,
            activeSite.z
          ),
          4,
          true
        );

        if (activeSite.restorationProgress >= 100) {
          activeSite.restored = true;
          activeSite.plumeGroup.visible = false;
          activeSite.debrisGroup.visible = false;
          activeSite.warnRing.material.color.setHex(0x55d99a);
          activeSite.restoredGroup.visible = true;

          dr.targetSite = null;
          dr.state = 'STANDBY';

          this.treasury += this.restorationBounty;
          this.netProfit += this.restorationBounty;
          this.priceMultiplier += this.esgBonusPerRestore;
          this.sound.playRestorationChime();

          if (this.ui.onWorldPopup) {
            this.ui.onWorldPopup(
              dr.root.position.clone().add(new THREE.Vector3(0, 2.2, 0)),
              `Zone Restored! +$${(this.restorationBounty / 1000).toFixed(0)}K`,
              'popup-green'
            );
          }
        }
      }
    } else if (dr.state === 'RESTORING') {
      const sector = this.oceanEnv.getSectorAt(dr.root.position.x, dr.root.position.z);
      if (sector.health < 98) {
        this.oceanEnv.restoreSectorAt(dr.root.position.x, dr.root.position.z, dt * 12, dt * 18);
      } else {
        dr.state = 'STANDBY';
      }
    }
  }
}
