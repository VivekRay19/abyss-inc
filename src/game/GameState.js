import * as THREE from 'three';
import { GAME_BALANCE, GAME_STAGES, PLAYER_LOCATIONS } from './GameConfig.js';
import { ConstitutionPersistence } from './ConstitutionPersistence.js';

// ============================================================================
// THE TWO MANDATORY IN-CAMPAIGN DYNAMIC RULE CHANGES
// ============================================================================
export const RULE_CHANGES = {
  extraction: {
    id: 'extraction',
    number: 1,
    title: 'RULE CHANGE 1 — THE EXTRACTION RULE',
    subtitle: 'Company Operations Policy',
    description:
      'Sediment from mining is damaging the seabed and waste has reached the surface. Choose your company’s permanent extraction policy for this campaign.',
    options: [
      {
        id: 'continuous_extraction',
        badge: 'PROFIT PRIORITY',
        badgeClass: 'badge-amber',
        title: 'Continuous Extraction',
        shortTitle: 'Continuous Extraction',
        pros: 'Permitted to continue mining immediately to reach or exceed your ore target.',
        cons: 'Additional mining causes heavier seabed damage and spawns more surface oil.',
        effectsText: 'Mining Remains Unlocked • Higher Pollution & Restoration Difficulty',
        apply: (state) => {
          state.miningProhibited = false;
          state.pollutionMultiplier *= 1.25;
        }
      },
      {
        id: 'restoration_first',
        badge: 'ECO CHECKPOINT',
        badgeClass: 'badge-green',
        title: 'Restoration-First Permit',
        shortTitle: 'Restoration-First Permit',
        pros: 'Protects the reef from further mining damage and keeps restoration manageable.',
        cons: 'Further mining is prohibited until surface cleanup and reef restoration are completed.',
        effectsText: 'Mining Prohibited Until Restoration Complete • Lower Environmental Damage',
        apply: (state) => {
          state.miningProhibited = true;
          state.fleet.crawler.state = 'IDLE';
        }
      }
    ]
  },
  sales: {
    id: 'sales',
    number: 2,
    title: 'RULE CHANGE 2 — THE MINERAL SALES RULE',
    subtitle: 'Market & Certification Policy',
    description:
      'Surface waters are clear, but the underwater reef is still damaged. Choose how your company will sell its extracted minerals.',
    options: [
      {
        id: 'open_market',
        badge: 'IMMEDIATE SALE',
        badgeClass: 'badge-amber',
        title: 'Open Market',
        shortTitle: 'Open Market',
        pros: 'Sell extracted minerals immediately without waiting for environmental certification.',
        cons: 'No eco-certified premium; price depends on buyer acceptance and ocean condition.',
        effectsText: 'Immediate Sale Allowed • Standard Market Price',
        apply: (state) => {
          state.requiresEcoCertification = false;
        }
      },
      {
        id: 'eco_certified',
        badge: 'CERTIFIED PREMIUM',
        badgeClass: 'badge-cyan',
        title: 'Eco-Certified Market',
        shortTitle: 'Eco-Certified Market',
        pros: 'Grants a +35% Eco-Certified sales premium once surface and reef restoration are complete.',
        cons: 'Mineral sales are blocked until all restoration requirements are fulfilled.',
        effectsText: 'Sale Locked Until Reef Restored • +35% Certified Premium',
        apply: (state) => {
          state.requiresEcoCertification = true;
        }
      }
    ]
  }
};

export class GameController {
  constructor(oceanEnv, ecosystem, fleet, sound, uiCallbacks) {
    this.oceanEnv = oceanEnv;
    this.ecosystem = ecosystem;
    this.fleet = fleet;
    this.sound = sound;
    this.ui = uiCallbacks || {};

    // Authoritative Location & Stage State
    this.location = PLAYER_LOCATIONS.SURFACE;
    this.stage = GAME_STAGES.SURFACE_INTRO;
    this.stageTimer = 0;
    this.diveCount = 0;

    // Separate Tutorial State from Persistent Campaign / Ongoing Operations
    this.tutorialCompleted = false;
    this.initialOilSpawned = false;

    // Single-Player Company Identity
    this.playerName = 'Alex';
    this.companyName = 'DeepBlue Co.';

    // Initial Business Settings (Separate from the 2 dynamic rule changes)
    this.businessSettings = {
      machineCapacity: 35,
      oreSellingPrice: 2800,
      extractionTarget: 60
    };

    // Core Resources
    this.credits = GAME_BALANCE.campaign.startingCredits;
    this.startingCredits = GAME_BALANCE.campaign.startingCredits;
    this.creditsEarnedFromSales = 0;
    this.oreInHold = 0;
    this.oreStockpile = 0;
    this.totalTonsMined = 0;
    this.totalTonsSold = 0;

    // Modifiers & Upgrades
    this.priceMultiplier = 1.0;
    this.pollutionMultiplier = 1.0;
    this.crawlerSpeedMultiplier = 1.0;
    this.miningSpeedMultiplier = 1.0;
    this.upgrades = {
      hopperLevel: 0,
      drillLevel: 0
    };

    this.charter = ConstitutionPersistence.loadCharter();
    if (this.charter && this.charter.runModifiers) {
      const mod = this.charter.runModifiers;
      this.credits += mod.bonusStartingCredits || 0;
      this.startingCredits = this.credits;
      this.priceMultiplier *= mod.basePriceBonusMultiplier || 1.0;
      this.pollutionMultiplier *= mod.pollutionBonusMultiplier || 1.0;
      this.crawlerSpeedMultiplier *= mod.crawlerSpeedBonus || 1.0;
    }

    // Two Dynamic In-Campaign Rule Changes
    this.rulesUsedCount = 0;
    this.maxRuleChanges = 2;
    this.rule1Enacted = null;
    this.rule2Enacted = null;
    this.miningProhibited = false;
    this.requiresEcoCertification = false;
    this.environmentalWarningTriggered = false;

    // Surface Cleanup State
    this.surfacePollutionTotal = GAME_BALANCE.campaign.surfaceOilPatchesCount;
    this.surfacePollutionCollected = 0;
    this.surfaceTankFill = 0;
    this.surfaceTankCapacity = GAME_BALANCE.campaign.surfaceTankCapacity;
    this.surfaceCleaned = false;
    this.pendingExtraOilSlicks = 0;
    this.ongoingOreSinceOil = 0;

    // Single-Player Restoration Budget State
    this.budgetSelected = false;
    this.agreedBudgetId = null;
    this.restorationSupplies = {
      cleaningPower: 1.5,
      coralKits: 4,
      puzzleClues: 2
    };

    // Reef Restoration State
    this.reefCleanProgress = 0;
    this.puzzleSolved = false;
    this.coralsPlaced = 0;
    this.coralsRequired = 3;
    this.reefRestored = false;
    this.underwaterMode = 'CRAWLER'; // 'CRAWLER' or 'DIVER'

    // Defeat / Summary
    this.defeatTriggered = false;
    this.defeatReason = null;
    this.endingResult = null;

    // Internal accumulators
    this.mineTickAccum = 0;
    this.isMiningActive = false;
    this.lastPopupTime = 0;
    this.lastBuyerNote = '';
    this.nearestDeposit = null;
  }

  // --------------------------------------------------------------------------
  // SETUP & BUSINESS SETTINGS (SINGLE-PLAYER)
  // --------------------------------------------------------------------------
  setCompanyInfo(playerName, companyName) {
    this.playerName = (playerName || 'Alex').trim() || 'Alex';
    this.companyName = (companyName || 'DeepBlue Co.').trim() || 'DeepBlue Co.';
    this.location = PLAYER_LOCATIONS.SURFACE;
    this.stage = GAME_STAGES.BUSINESS_SETTINGS;
    this.notifyStageChange();
  }

  confirmBusinessSettings(capacity, sellingPrice, extractionTarget) {
    const cap = Number(capacity);
    const price = Number(sellingPrice);
    const target = Number(extractionTarget);

    if (![20, 35, 50].includes(cap)) return { ok: false, error: 'Invalid capacity.' };
    if (price < 2000 || price > 4500) return { ok: false, error: 'Invalid selling price.' };
    if (target < 40 || target > 100) return { ok: false, error: 'Invalid extraction target.' };

    this.businessSettings = {
      machineCapacity: cap,
      oreSellingPrice: price,
      extractionTarget: target
    };

    this.fleet.crawler.maxCapacity = cap;
    this.fleet.crawler.speed = 6.5 * this.crawlerSpeedMultiplier;

    return this.diveToOceanFloor();
  }

  notifyStageChange() {
    if (this.ui.onStageChange) {
      this.ui.onStageChange(this.stage, this.location);
    }
  }

  getGlobalOceanHealth() {
    return this.oceanEnv ? Math.round(this.oceanEnv.getGlobalOceanHealth()) : 96;
  }

  getTotalRemainingSeabedOre() {
    if (!this.ecosystem) return 0;
    return Math.round(
      this.ecosystem.deposits.reduce((sum, d) => sum + Math.max(0, d.remainingTons), 0)
    );
  }

  // --------------------------------------------------------------------------
  // REPEATABLE SURFACE <-> UNDERWATER NAVIGATION ([F] KEY & BUTTONS)
  // --------------------------------------------------------------------------
  canDiveToOceanFloor() {
    if (this.defeatTriggered) return false;
    if (this.location !== PLAYER_LOCATIONS.SURFACE) return false;
    if (
      this.stage === GAME_STAGES.SURFACE_INTRO ||
      this.stage === GAME_STAGES.BUSINESS_SETTINGS ||
      this.stage === GAME_STAGES.RULE_CHANGE_1 ||
      this.stage === GAME_STAGES.RULE_CHANGE_2 ||
      this.stage === GAME_STAGES.BUDGET_NEGOTIATION ||
      this.stage === GAME_STAGES.TUTORIAL_COMPLETE
    ) {
      return false;
    }
    return true;
  }

  diveToOceanFloor(asDiver = false) {
    if (
      this.location === PLAYER_LOCATIONS.DIVING ||
      this.location === PLAYER_LOCATIONS.SURFACING ||
      this.location === PLAYER_LOCATIONS.UNDERWATER
    ) {
      return { ok: false, error: 'Already underwater or in transition.' };
    }

    this.diveCount++;
    this.isMiningActive = false;
    this.underwaterMode = asDiver ? 'DIVER' : 'CRAWLER';
    this.location = PLAYER_LOCATIONS.DIVING;
    this.stage = GAME_STAGES.DEPLOYMENT;
    this.stageTimer = 0;
    this.notifyStageChange();
    return { ok: true, diveCount: this.diveCount };
  }

  completeDiveTransition() {
    this.location = PLAYER_LOCATIONS.UNDERWATER;
    if (this.tutorialCompleted) {
      this.stage = GAME_STAGES.ONGOING_OPERATIONS;
    } else if (this.budgetSelected && !this.reefRestored) {
      this.stage = GAME_STAGES.DIVE_RESTORATION;
      this.underwaterMode = 'DIVER';
    } else {
      this.stage = GAME_STAGES.UNDERWATER_MINING;
    }
    this.notifyStageChange();
  }

  canReturnToSurface() {
    if (this.defeatTriggered) return false;
    if (this.location !== PLAYER_LOCATIONS.UNDERWATER) return false;
    if (
      this.stage === GAME_STAGES.RULE_CHANGE_1 ||
      this.stage === GAME_STAGES.RULE_CHANGE_2 ||
      this.stage === GAME_STAGES.BUDGET_NEGOTIATION ||
      this.stage === GAME_STAGES.TUTORIAL_COMPLETE
    ) {
      return false;
    }
    return true;
  }

  returnToSurface() {
    if (
      this.location === PLAYER_LOCATIONS.SURFACING ||
      this.location === PLAYER_LOCATIONS.DIVING ||
      this.location === PLAYER_LOCATIONS.SURFACE
    ) {
      return { ok: false, error: 'Already on surface or in transition.' };
    }

    this.isMiningActive = false;
    this.fleet.crawler.state = 'IDLE';
    if (this.oreInHold > 0) {
      this.offloadCrawlerToBoat();
    }

    this.location = PLAYER_LOCATIONS.SURFACING;
    this.stage = GAME_STAGES.ASCENT_TO_SURFACE;
    this.stageTimer = 0;
    this.notifyStageChange();
    return { ok: true };
  }

  beginAscentToSurface() {
    return this.returnToSurface();
  }

  completeAscentTransition() {
    this.location = PLAYER_LOCATIONS.SURFACE;
    if (this.tutorialCompleted) {
      this.stage = GAME_STAGES.ONGOING_OPERATIONS;
    } else {
      this.stage = GAME_STAGES.SURFACE_CLEANUP;
    }
    this.notifyStageChange();
  }

  // --------------------------------------------------------------------------
  // RULE CHANGES (EXACTLY TWO IN-CAMPAIGN)
  // --------------------------------------------------------------------------
  enactRuleChange(stageKey, optionId) {
    if (this.rulesUsedCount >= this.maxRuleChanges) return false;
    if (stageKey === 'extraction' && this.rule1Enacted) return false;
    if (stageKey === 'sales' && this.rule2Enacted) return false;

    const ruleDef = RULE_CHANGES[stageKey];
    if (!ruleDef) return false;
    const option = ruleDef.options.find((o) => o.id === optionId);
    if (!option) return false;

    option.apply(this);
    this.rulesUsedCount++;
    if (stageKey === 'extraction') {
      this.rule1Enacted = option;
      if (this.miningProhibited) {
        this.returnToSurface();
      } else {
        this.stage = this.tutorialCompleted ? GAME_STAGES.ONGOING_OPERATIONS : GAME_STAGES.UNDERWATER_MINING;
        this.notifyStageChange();
      }
    } else if (stageKey === 'sales') {
      this.rule2Enacted = option;
      this.stage = GAME_STAGES.BUDGET_NEGOTIATION;
      this.notifyStageChange();
    }

    this.sound.playRuleChangeAlert();
    if (this.ui.onRuleEnacted) {
      this.ui.onRuleEnacted(stageKey, option);
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // MINERAL SALES & UPGRADES
  // --------------------------------------------------------------------------
  canSellOre() {
    if (this.oreStockpile <= 0) {
      return { allowed: false, reason: 'No extracted ore in boat stockpile.' };
    }
    if (this.requiresEcoCertification && !(this.surfaceCleaned && this.reefRestored)) {
      return {
        allowed: false,
        reason: 'Eco-Certified Market requires surface cleanup & reef restoration first!'
      };
    }
    return { allowed: true };
  }

  sellStockpileOre() {
    const check = this.canSellOre();
    if (!check.allowed) {
      return { ok: false, error: check.reason };
    }

    const tons = this.oreStockpile;
    const requestedPrice = this.businessSettings.oreSellingPrice;

    let acceptanceFactor = 1.0;
    let buyerNote = 'Buyers accepted your asking price.';
    if (requestedPrice > GAME_BALANCE.economy.maxSafePrice) {
      const excessRatio = (requestedPrice - GAME_BALANCE.economy.maxSafePrice) / 1000;
      const pushback = Math.min(0.32, excessRatio * 0.24);
      acceptanceFactor = 1.0 - pushback;
      buyerNote = `Buyers negotiated a ${Math.round(pushback * 100)}% discount on high asking price ($${requestedPrice}/t).`;
    }

    const ecoBonus =
      this.requiresEcoCertification && this.surfaceCleaned && this.reefRestored
        ? GAME_BALANCE.economy.ecoCertifiedPremium
        : 1.0;

    const unitPrice = Math.round(requestedPrice * acceptanceFactor * ecoBonus * this.priceMultiplier);
    const totalPayout = tons * unitPrice;

    this.credits += totalPayout;
    this.creditsEarnedFromSales += totalPayout;
    this.totalTonsSold += tons;
    this.oreStockpile = 0;
    this.lastBuyerNote = buyerNote;

    this.sound.playCashDeposit();
    return {
      ok: true,
      tons,
      unitPrice,
      totalPayout,
      buyerNote,
      ecoCertified: ecoBonus > 1.0
    };
  }

  purchaseUpgrade(type) {
    if (type === 'hopper') {
      const cfg = GAME_BALANCE.upgrades.hopper;
      if (this.credits < cfg.cost) return { ok: false, error: 'Insufficient credits for Hopper Upgrade.' };
      this.credits -= cfg.cost;
      this.upgrades.hopperLevel++;
      this.businessSettings.machineCapacity += cfg.capacityBonus;
      this.fleet.crawler.maxCapacity = this.businessSettings.machineCapacity;
      this.sound.playCashDeposit();
      return { ok: true, label: `Capacity increased to ${this.businessSettings.machineCapacity}t!` };
    } else if (type === 'drill') {
      const cfg = GAME_BALANCE.upgrades.drill;
      if (this.credits < cfg.cost) return { ok: false, error: 'Insufficient credits for Drill Upgrade.' };
      this.credits -= cfg.cost;
      this.upgrades.drillLevel++;
      this.miningSpeedMultiplier *= cfg.speedBonus;
      this.sound.playCashDeposit();
      return { ok: true, label: 'Mining drill speed increased by +25%!' };
    }
    return { ok: false, error: 'Unknown upgrade.' };
  }

  offloadCrawlerToBoat() {
    if (this.oreInHold <= 0) return 0;
    const offloaded = Math.round(this.oreInHold);
    this.oreStockpile += offloaded;
    this.oreInHold = 0;
    this.fleet.crawler.capacity = 0;
    this.fleet.spawnRiserOreTransfer();
    this.sound.playCashDeposit();
    return offloaded;
  }

  // --------------------------------------------------------------------------
  // SINGLE-PLAYER RESTORATION BUDGET SELECTION (ATOMIC CREDIT CHECK)
  // --------------------------------------------------------------------------
  finalizeBudget(budgetId) {
    const tier = GAME_BALANCE.restorationBudgets[budgetId];
    if (!tier) return { ok: false, error: 'Invalid budget tier.' };

    if (this.credits < tier.cost) {
      return {
        ok: false,
        error: `Insufficient credits ($${(this.credits / 1000).toFixed(0)}K available, needs $${(tier.cost / 1000).toFixed(0)}K).`
      };
    }

    this.credits -= tier.cost;
    this.agreedBudgetId = budgetId;
    this.budgetSelected = true;
    this.restorationSupplies = {
      cleaningPower: tier.cleaningPower,
      coralKits: tier.coralKits,
      puzzleClues: tier.puzzleClues
    };

    this.sound.playCashDeposit();
    this.diveToOceanFloor(true);
    return { ok: true, tier };
  }

  // --------------------------------------------------------------------------
  // REEF RESTORATION & TUTORIAL COMPLETION -> ONGOING OPERATIONS
  // --------------------------------------------------------------------------
  applyReefCleaningStep(amount) {
    this.reefCleanProgress = Math.min(100, this.reefCleanProgress + amount * this.restorationSupplies.cleaningPower);
    this.oceanEnv.restoreSectorAt(0, 2, amount * 0.45, amount * 0.7);
    this.ecosystem.updateCoralRecoveryVisuals(this.reefCleanProgress / 100);
    return this.reefCleanProgress;
  }

  completePuzzleAndCoralPlacement() {
    this.puzzleSolved = true;
    this.coralsPlaced = this.coralsRequired;
    this.reefRestored = true;
    // Fulfilling restoration unlocks mining if Restoration-First Permit was active!
    this.miningProhibited = false;

    this.ecosystem.damagedSites.forEach((site) => {
      site.restored = true;
      site.restorationProgress = 100;
      if (site.plumeGroup) site.plumeGroup.visible = false;
      if (site.debrisGroup) site.debrisGroup.visible = false;
      if (site.restoredGroup) site.restoredGroup.visible = true;
      if (site.warnRing) site.warnRing.material.color.setHex(0x55d99a);
    });

    for (const s of this.oceanEnv.sectors) {
      this.oceanEnv.restoreSectorAt(s.x, s.z, 25, 35);
    }
    this.ecosystem.updateCoralRecoveryVisuals(1.0);
    this.sound.playRestorationChime();

    // Ensure both dynamic rule changes were resolved before completing tutorial
    if (!this.tutorialCompleted && this.rule1Enacted && this.rule2Enacted) {
      this.endingResult = this.evaluateCampaignEnding();
      this.stage = GAME_STAGES.TUTORIAL_COMPLETE;
      this.notifyStageChange();
    } else {
      this.stage = GAME_STAGES.ONGOING_OPERATIONS;
      this.notifyStageChange();
    }
  }

  continueOperations() {
    this.tutorialCompleted = true;
    this.miningProhibited = false;
    this.underwaterMode = 'CRAWLER';
    this.stage = GAME_STAGES.ONGOING_OPERATIONS;
    this.notifyStageChange();
  }

  // --------------------------------------------------------------------------
  // BANKRUPTCY & CAMPAIGN EVALUATION
  // --------------------------------------------------------------------------
  checkDefeatConditions() {
    if (this.defeatTriggered) return;
    const health = this.getGlobalOceanHealth();
    if (health <= GAME_BALANCE.campaign.collapseHealthThreshold) {
      this.defeatTriggered = true;
      this.defeatReason = 'ECOLOGICAL COLLAPSE';
      this.stage = GAME_STAGES.DEFEAT;
      this.notifyStageChange();
      if (this.ui.onDefeat) this.ui.onDefeat(this.defeatReason);
      return;
    }

    const minBudget = GAME_BALANCE.restorationBudgets.small.cost;
    const cantAffordRestoration =
      this.stage === GAME_STAGES.BUDGET_NEGOTIATION &&
      this.credits < minBudget &&
      (this.oreStockpile <= 0 || this.requiresEcoCertification);

    if (this.credits < GAME_BALANCE.campaign.bankruptcyThreshold || cantAffordRestoration) {
      this.defeatTriggered = true;
      this.defeatReason = 'BANKRUPTCY';
      this.stage = GAME_STAGES.DEFEAT;
      this.notifyStageChange();
      if (this.ui.onDefeat) this.ui.onDefeat(this.defeatReason);
    }
  }

  evaluateCampaignEnding() {
    const health = this.getGlobalOceanHealth();
    const targetMet = this.totalTonsMined >= this.businessSettings.extractionTarget;
    const netBusinessGain = this.credits - this.startingCredits;

    let ratingTitle = 'THE OCEAN IS NOT FOR SALE';
    let badge = 'TUTORIAL COMPLETE — OPERATIONS UNLOCKED';
    let badgeClass = 'badge-green';

    if (this.surfaceCleaned && this.reefRestored && health >= 75 && targetMet) {
      ratingTitle = 'THE OCEAN IS NOT FOR SALE';
      badge = 'MODEL STEWARDSHIP';
      badgeClass = 'badge-green';
    } else if (this.surfaceCleaned && this.reefRestored && !targetMet) {
      ratingTitle = 'OCEAN PROTECTED, TARGET IN PROGRESS';
      badge = 'CONSERVATION PRIORITY';
      badgeClass = 'badge-cyan';
    } else {
      ratingTitle = 'OPERATIONS IN PROGRESS';
      badge = 'ACTIVE EXPEDITION';
      badgeClass = 'badge-amber';
    }

    return {
      title: ratingTitle,
      badge,
      badgeClass,
      playerName: this.playerName,
      companyName: this.companyName,
      totalTonsMined: Math.round(this.totalTonsMined),
      extractionTarget: this.businessSettings.extractionTarget,
      targetMet,
      credits: Math.round(this.credits),
      netBusinessGain: Math.round(netBusinessGain),
      creditsEarnedFromSales: Math.round(this.creditsEarnedFromSales),
      surfacePollutionCollected: this.surfacePollutionCollected,
      surfacePollutionTotal: this.surfacePollutionTotal,
      reefRestored: this.reefRestored,
      oceanHealth: health,
      rule1: this.rule1Enacted ? this.rule1Enacted.shortTitle : 'Pending',
      rule2: this.rule2Enacted ? this.rule2Enacted.shortTitle : 'Pending'
    };
  }

  // --------------------------------------------------------------------------
  // MAIN UPDATE LOOP (LOCATION & STAGE AWARE)
  // --------------------------------------------------------------------------
  update(dt, elapsed, keyInput) {
    this.stageTimer += dt;
    this.checkDefeatConditions();
    if (this.defeatTriggered) return;

    if (this.location === PLAYER_LOCATIONS.UNDERWATER) {
      if (
        this.stage === GAME_STAGES.UNDERWATER_MINING ||
        this.stage === GAME_STAGES.ONGOING_OPERATIONS ||
        this.stage === GAME_STAGES.DIVE_RESTORATION
      ) {
        this.updateUnderwaterGameplay(dt, elapsed, keyInput);
      }
    } else if (this.location === PLAYER_LOCATIONS.SURFACE) {
      if (this.stage === GAME_STAGES.SURFACE_CLEANUP || this.stage === GAME_STAGES.ONGOING_OPERATIONS) {
        this.updateSurfaceGameplay(dt, elapsed, keyInput);
      }
    }
  }

  updateUnderwaterGameplay(dt, elapsed, keyInput) {
    const c = this.fleet.crawler;
    const hasMove =
      this.underwaterMode === 'CRAWLER' &&
      (Math.abs(keyInput.forward) > 0.01 || Math.abs(keyInput.turn) > 0.01);

    if (hasMove) {
      c.root.rotation.y -= keyInput.turn * c.turnSpeed * dt;
      const forwardVec = new THREE.Vector3(0, 0, 1).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        c.root.rotation.y
      );

      const nextX = Math.max(-24, Math.min(24, c.root.position.x + forwardVec.x * keyInput.forward * c.speed * dt));
      const nextZ = Math.max(-24, Math.min(24, c.root.position.z + forwardVec.z * keyInput.forward * c.speed * dt));
      const nextY = this.oceanEnv.getTerrainHeight(nextX, nextZ);

      c.root.position.set(nextX, nextY, nextZ);
      c.state = 'MOVING';

      const moveDist = Math.abs(keyInput.forward) * c.speed * dt;
      c.trackProgress = (c.trackProgress + moveDist * 0.35) % 1;
      c.stepDist += moveDist;
      if (c.stepDist > 1.25) {
        c.stepDist = 0;
        this.fleet.spawnCrawlerTreadMark(nextX, nextZ, c.root.rotation.y);
        this.ecosystem.spawnSedimentBurst(c.root.position, 2, false);
      }
    } else if (!this.isMiningActive) {
      c.state = 'IDLE';
    }

    // Auto-offload if near Riser Hub
    const distToHub = Math.hypot(
      c.root.position.x - this.oceanEnv.riserHubPosition.x,
      c.root.position.z - this.oceanEnv.riserHubPosition.z
    );
    if (distToHub < 5.2 && this.oreInHold > 0) {
      const off = this.offloadCrawlerToBoat();
      if (this.ui.onWorldPopup && off > 0) {
        this.ui.onWorldPopup(
          c.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)),
          `Offloaded ${off}t Ore to Boat!`,
          'popup-gold'
        );
      }
    }

    const nearestDep = this.ecosystem.deposits.find(
      (d) => !d.depleted && Math.hypot(d.x - c.root.position.x, d.z - c.root.position.z) < 4.6
    );
    this.nearestDeposit = nearestDep || null;

    if (this.isMiningActive && this.miningProhibited) {
      this.isMiningActive = false;
      c.state = 'IDLE';
      if (elapsed - this.lastPopupTime > 2.0) {
        this.lastPopupTime = elapsed;
        if (this.ui.onWorldPopup) {
          this.ui.onWorldPopup(
            c.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)),
            'Mining Prohibited: Complete Restoration First!',
            'popup-gold'
          );
        }
      }
      return;
    }

    if (this.isMiningActive && nearestDep && this.oreInHold < this.businessSettings.machineCapacity) {
      c.state = 'MINING';
      this.mineTickAccum += dt * this.miningSpeedMultiplier;
      if (this.mineTickAccum >= 0.45) {
        this.mineTickAccum = 0;

        const extractTons = Math.min(
          4,
          nearestDep.remainingTons,
          this.businessSettings.machineCapacity - this.oreInHold
        );

        if (extractTons > 0) {
          nearestDep.remainingTons -= extractTons;
          this.oreInHold += extractTons;
          c.capacity = this.oreInHold;
          this.totalTonsMined += extractTons;

          if (this.tutorialCompleted) {
            this.ongoingOreSinceOil += extractTons;
            if (this.ongoingOreSinceOil >= 20) {
              this.ongoingOreSinceOil -= 20;
              this.pendingExtraOilSlicks += 2;
              this.surfaceCleaned = false;
            }
          }

          const nodStart = new THREE.Vector3(
            nearestDep.x + (Math.random() - 0.5) * 1.4,
            this.oceanEnv.getTerrainHeight(nearestDep.x, nearestDep.z) + 0.3,
            nearestDep.z + (Math.random() - 0.5) * 1.4
          );
          this.ecosystem.spawnFlyingNodule(nodStart, c, nearestDep.color);
          this.ecosystem.spawnSedimentBurst(c.getIntakeWorldPosition(), 6, false);
          this.sound.playNoduleCollect();

          const ratioLeft = nearestDep.remainingTons / nearestDep.maxTons;
          const visibleNodules = Math.ceil(ratioLeft * nearestDep.noduleMeshes.length);
          nearestDep.noduleMeshes.forEach((m, idx) => {
            m.visible = idx < visibleNodules;
          });

          this.oceanEnv.damageSectorAt(
            nearestDep.x,
            nearestDep.z,
            4.5 * this.pollutionMultiplier,
            7.5 * this.pollutionMultiplier
          );
          this.ecosystem.damageNearbyCorals(nearestDep.x, nearestDep.z, 0.14 * this.pollutionMultiplier);

          if (ratioLeft < 0.55) {
            this.ecosystem.createOrIntensifyDamagedSite(nearestDep.x, nearestDep.z, nearestDep.name);
          }

          if (this.ui.onWorldPopup) {
            this.ui.onWorldPopup(
              c.root.position.clone().add(new THREE.Vector3(0, 2.6, 0)),
              `+${extractTons}t Ore (${Math.round(this.oreInHold)}/${this.businessSettings.machineCapacity}t)`,
              'popup-cyan'
            );
          }

          if (nearestDep.remainingTons <= 0.1) {
            nearestDep.remainingTons = 0;
            nearestDep.depleted = true;
            nearestDep.ringMesh.material.color.setHex(0xf16f75);
            this.isMiningActive = false;
            c.state = 'IDLE';
          }

          const health = this.getGlobalOceanHealth();
          if (
            !this.environmentalWarningTriggered &&
            this.totalTonsMined >= GAME_BALANCE.campaign.warningMinOre &&
            health <= GAME_BALANCE.campaign.warningHealthThreshold
          ) {
            this.environmentalWarningTriggered = true;
            this.isMiningActive = false;
            c.state = 'IDLE';
            this.stage = GAME_STAGES.RULE_CHANGE_1;
            this.notifyStageChange();
          }
        }
      }
    } else if (!this.isMiningActive && c.state === 'MINING') {
      c.state = 'IDLE';
    }

    const anyMoving = c.state === 'MOVING';
    const anyMining = c.state === 'MINING';
    this.sound.updateMachinerySound(anyMoving, anyMining, false);
  }

  updateSurfaceGameplay(dt, elapsed, keyInput) {
    const vessel = this.fleet.surfaceVessel;
    if (!vessel || !vessel.group) return;

    const hasMove = Math.abs(keyInput.forward) > 0.01 || Math.abs(keyInput.turn) > 0.01;
    if (hasMove) {
      vessel.group.rotation.y -= keyInput.turn * 1.65 * dt;
      const forwardVec = new THREE.Vector3(0, 0, 1).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        vessel.group.rotation.y
      );
      const nx = Math.max(-32, Math.min(32, vessel.group.position.x + forwardVec.x * keyInput.forward * 9.0 * dt));
      const nz = Math.max(-32, Math.min(32, vessel.group.position.z + forwardVec.z * keyInput.forward * 9.0 * dt));
      vessel.group.position.x = nx;
      vessel.group.position.z = nz;
    }

    this.sound.updateMachinerySound(hasMove, false, false);
  }
}
