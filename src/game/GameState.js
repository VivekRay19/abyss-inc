import * as THREE from 'three';
import { GAME_BALANCE } from './GameConfig.js';
import { ConstitutionPersistence } from './ConstitutionPersistence.js';

export const RULE_CHANGES = {
  stage1: {
    id: 'stage1',
    title: 'RULE CHANGE I — CORPORATE CHARTER AMENDMENT',
    subtitle: 'International Seabed Authority & Board of Directors',
    description:
      'Use 1 of your 2 corporate rule changes to rewrite market pricing or environmental filtration standards. This decision is permanent for the remainder of this campaign.',
    options: [
      {
        id: 'boost_price',
        badge: 'MARKET BOOST',
        badgeClass: 'badge-amber',
        title: 'Premium Price Agreement (+45% Base Value)',
        shortTitle: 'Boost mineral price',
        oneLine: 'Negotiate premium off-take contracts: +45% Base Mineral Price, but +20% Turbidity penalty.',
        costText: 'Cost: Free Charter Vote',
        effectsText: '+45% Base Ore Value • +15% Mining Torque • +20% Sediment Dispersal',
        apply: (state) => {
          state.priceMultiplier *= 1.45;
          state.miningSpeedMultiplier *= 1.15;
          state.pollutionMultiplier *= 1.20;
        }
      },
      {
        id: 'filtration',
        badge: 'CLEAN EXTRACTION',
        badgeClass: 'badge-cyan',
        title: 'Clean Extraction Mandate (-40% Damage)',
        shortTitle: 'Clean extraction',
        oneLine: 'Mandate hydraulic shroud filtration: cuts sediment pollution by 40% and claims a $90K green grant.',
        costText: 'Grant: +$90K Cash',
        effectsText: '-40% Seabed Disturbance • +$90K Compliance Grant',
        apply: (state) => {
          state.pollutionMultiplier *= 0.60;
          state.treasury += 90000;
          state.netProfit += 90000;
        }
      }
    ]
  },
  stage2: {
    id: 'stage2',
    title: 'RULE CHANGE II — EXPEDITION FOCUS & RECLAMATION',
    subtitle: 'Deep-Basin Survey & Ecological Tribunal',
    description:
      'Use your final rule change to unlock high-grade mineral extraction permits or pivot corporate operations toward ocean habitat restoration contracts.',
    options: [
      {
        id: 'open_zone',
        badge: 'NEW MINING ZONE',
        badgeClass: 'badge-purple',
        title: 'Expanded Commercial Permits (+250t Veins)',
        shortTitle: 'Open new zone',
        oneLine: 'Unlocks deep fault extraction rights, spawns +250t rich veins & increases crawler speed +25%.',
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
        title: 'Restoration Mandate Charter ($95K / Reef)',
        shortTitle: 'Restoration bounty',
        oneLine: 'Pivots corporate subsidies to environmental reclamation: doubles restoration bounties to $95K/site.',
        costText: 'Bounty: $95K / Zone',
        effectsText: '$95K Bounty per Restored Site • +50% Restoration Speed',
        apply: (state) => {
          state.phase = 'RESTORATION FOCUS';
          state.restorationBounty = 95000;
          state.restorationSpeedMultiplier *= 1.50;
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
    this.restorationBounty = 65000;
    this.esgBonusPerRestore = 0.08;

    // Apply active persistent constitution charter modifiers if present
    this.charter = ConstitutionPersistence.loadCharter();
    if (this.charter && this.charter.runModifiers) {
      const mod = this.charter.runModifiers;
      this.treasury += (mod.bonusStartingCredits || 0);
      this.priceMultiplier *= (mod.basePriceBonusMultiplier || 1.0);
      this.pollutionMultiplier *= (mod.pollutionBonusMultiplier || 1.0);
      this.restorationBounty += (mod.bonusRestorationBounty || 0);
      if (this.fleet.crawler && mod.crawlerSpeedBonus) {
        this.fleet.crawler.speed *= mod.crawlerSpeedBonus;
      }
      if (this.fleet.crawler && mod.crawlerHopperBonus) {
        this.fleet.crawler.maxCapacity += mod.crawlerHopperBonus;
      }
    }

    this.round = 1;
    this.maxRounds = 12;
    this.roundTimer = 0;
    this.secondsPerRound = 40;

    this.currentAct = 1; // 1: The Gold Rush, 2: The Reckoning, 3: The Pivot
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

  getGlobalOceanHealth() {
    return this.oceanEnv ? this.oceanEnv.getGlobalOceanHealth() : 96;
  }

  // Calculate Eco-Rating multiplier based on global ocean health
  // 80-100: 1.15 | 50: 1.00 | 35: 0.60 | <35: 0.60 down to 0.40
  getEcoRatingMultiplier() {
    const health = this.getGlobalOceanHealth();
    if (health >= 80) return 1.15;
    if (health >= 50) {
      return 1.00 + ((health - 50) / 30) * 0.15;
    }
    if (health >= 35) {
      return 0.60 + ((health - 35) / 15) * 0.40;
    }
    return Math.max(0.40, 0.40 + (health / 35) * 0.20);
  }

  // Calculate Ore Grade for a specific location / region:
  // oreGrade = clamp(0.65 + 0.35 * (localHealth / 100), 0.55, 1.0)
  calculateOreGrade(localHealth) {
    const norm = Math.max(0, Math.min(100, localHealth)) / 100;
    return Math.max(0.55, Math.min(1.0, 0.65 + 0.35 * norm));
  }

  // Calculate Extraction Yield Multiplier based on local regional health:
  // >= 80: 1.0
  // 50..80: 0.55 + 1.5 * (health/100 - 0.5)
  // 30..50: 0.15 + 2.0 * (health/100 - 0.3)
  // < 30: 0.10 + 0.05 * (health / 30)
  calculateYieldMultiplier(localHealth) {
    if (localHealth >= 80) return 1.0;
    if (localHealth >= 50) {
      return Math.max(0.55, Math.min(1.0, 0.55 + 1.5 * (localHealth / 100 - 0.5)));
    }
    if (localHealth >= 30) {
      return Math.max(0.15, Math.min(0.55, 0.15 + 2.0 * (localHealth / 100 - 0.3)));
    }
    return Math.max(0.10, Math.min(0.15, 0.10 + 0.05 * (localHealth / 30)));
  }

  // Formula: finalSalePrice = baseMineralPrice * amendmentMultiplier * oreGrade * ecoRatingMultiplier * marketEventModifier
  calculateMineralSaleTelemetry(tons, rawValue, zoneId = 'nodule_fields') {
    let localHealth = 96;
    if (this.worldMap) {
      const stats = this.worldMap.getZoneLiveStats(zoneId);
      if (stats) localHealth = stats.localHealth;
    }

    const oreGrade = this.calculateOreGrade(localHealth);
    const ecoMult = this.getEcoRatingMultiplier();
    const amendmentMult = this.priceMultiplier;
    const marketMod = this.marketIndex;

    const baseUnit = tons > 0 ? rawValue / tons : 2800;
    const finalUnit = baseUnit * amendmentMult * oreGrade * ecoMult * marketMod;
    const totalPayout = Math.round(tons * finalUnit);

    return {
      tons,
      baseUnitPrice: Math.round(baseUnit),
      amendmentMult: Number(amendmentMult.toFixed(2)),
      oreGrade: Number(oreGrade.toFixed(2)),
      ecoMult: Number(ecoMult.toFixed(2)),
      marketMod: Number(marketMod.toFixed(2)),
      finalUnitPrice: Math.round(finalUnit),
      totalPayout
    };
  }

  offloadMachineCargo(mach) {
    if (mach.capacity <= 0.5) return;

    const tons = Math.round(mach.capacity);
    const telemetry = this.calculateMineralSaleTelemetry(tons, mach.cargoValue, mach.lastZoneId || 'nodule_fields');
    const payout = telemetry.totalPayout;

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
        `Sold ${tons}t Ore • +$${(payout / 1000).toFixed(1)}K (Grade: ${(telemetry.oreGrade * 100).toFixed(0)}%, Eco: ${telemetry.ecoMult}x)`,
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

  evaluateCampaignEnding() {
    const health = this.getGlobalOceanHealth();
    const profit = this.netProfit;
    const restored = this.ecosystem.damagedSites.filter((s) => s.restored).length;

    if (health >= 80 && restored >= 2) {
      return {
        id: 'ending_ocean_not_for_sale',
        title: 'THE OCEAN IS NOT FOR SALE',
        badge: 'PRISTINE RESTORATION',
        badgeClass: 'badge-green',
        desc: 'You demonstrated that corporate ingenuity can serve marine ecosystems. ABYSS INC. has fully transitioned from an extraction company into a global ocean-monitoring and restoration foundation.',
        health,
        profit
      };
    } else if (health >= 55) {
      return {
        id: 'ending_sustainable_balance',
        title: 'SUSTAINABLE BALANCE',
        badge: 'BALANCED STEWARDSHIP',
        badgeClass: 'badge-cyan',
        desc: 'You extracted necessary technological minerals while actively containing sediment plumes and restoring damaged seabed sectors. The corporation survives, though benthic scars remain.',
        health,
        profit
      };
    } else if (health >= 25) {
      return {
        id: 'ending_too_little_too_late',
        title: 'TOO LITTLE, TOO LATE',
        badge: 'DEPLETED MARGINS',
        badgeClass: 'badge-amber',
        desc: 'Extraction profits were high initially, but accumulated sediment plumes and collapsed habitats degraded ore quality and prompted buyer boycotts. Reclamation efforts began too late to save the basin.',
        health,
        profit
      };
    } else {
      return {
        id: 'ending_collapse',
        title: 'ECOLOGICAL COLLAPSE',
        badge: 'TOTAL EXTINCTION',
        badgeClass: 'badge-red',
        desc: 'The Meridian Basin ecosystem has collapsed under catastrophic turbidity and habitat destruction. All commercial permits have been revoked by the ISA tribunal.',
        health,
        profit
      };
    }
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

        // Dynamic 3-Act Campaign progression based on actual conditions & round
        const globalHealth = this.getGlobalOceanHealth();
        if (this.currentAct === 1 && (this.round >= 5 || globalHealth < 75 || this.totalTonsMined >= 60)) {
          this.currentAct = 2;
          this.phase = 'TURBIDITY RECKONING';
          if (this.ui.onActTransition) this.ui.onActTransition(2, 'ACT 2: THE RECKONING');
        } else if (this.currentAct === 2 && (this.round >= 8 || globalHealth < 50 || this.totalTonsMined >= 120)) {
          this.currentAct = 3;
          this.phase = 'ECOLOGICAL PIVOT';
          if (this.ui.onActTransition) this.ui.onActTransition(3, 'ACT 3: THE PIVOT');
        }
      } else {
        // End of campaign triggered!
        if (this.ui.onCampaignEnd) {
          this.ui.onCampaignEnd(this.evaluateCampaignEnding());
        }
      }
    }

    // Check Defeat / Collapse condition (Global Ocean Health < 10% or Bankruptcy)
    if (this.getGlobalOceanHealth() <= 9.5 && !this.defeatTriggered) {
      this.defeatTriggered = true;
      if (this.ui.onDefeat) {
        this.ui.onDefeat('ECOLOGICAL COLLAPSE');
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

        // Apply local health yield penalty
        let localHealth = 96;
        if (this.worldMap && activeDep.zoneId) {
          const stats = this.worldMap.getZoneLiveStats(activeDep.zoneId);
          if (stats) localHealth = stats.localHealth;
        }
        const yieldMult = this.calculateYieldMultiplier(localHealth);
        const maxNominal = 5 * yieldMult;

        const extractTons = Math.min(maxNominal, activeDep.remainingTons, c.maxCapacity - c.capacity);

        if (extractTons > 0) {
          activeDep.remainingTons -= extractTons;
          c.capacity += extractTons;
          const batchValue = extractTons * activeDep.yieldPerTon;
          c.cargoValue += batchValue;
          c.lastZoneId = activeDep.zoneId;
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
