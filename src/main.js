import * as THREE from 'three';
import { SoundManager } from './audio/SoundManager.js';
import { OceanEnvironment } from './world/OceanEnvironment.js';
import { EcosystemManager } from './world/EcosystemManager.js';
import { MiningFleetManager } from './machines/MiningMachines.js';
import { SurfaceOceanManager, HumanDiver } from './world/SurfaceAndDiver.js';
import { GameController, RULE_CHANGES } from './game/GameState.js';
import { GAME_BALANCE, GAME_STAGES, PLAYER_LOCATIONS } from './game/GameConfig.js';
import { RestorationMiniGames } from './ui/RestorationMiniGames.js';

// ============================================================================
// 1. RENDERER & SCENE INITIALIZATION
// ============================================================================
const container = document.getElementById('canvas-container');
const labelsLayer = document.getElementById('world-labels-layer');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const initW = Math.max(1, container.clientWidth || window.innerWidth || 1280);
const initH = Math.max(1, container.clientHeight || window.innerHeight || 720);
renderer.setSize(initW, initH);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.innerHTML = '';
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const SURFACE_SKY_COLOR = new THREE.Color(0x4ba3d0);
const UNDERWATER_COLOR = new THREE.Color(0x07263b);
scene.background = SURFACE_SKY_COLOR.clone();
scene.fog = new THREE.FogExp2(0x4ba3d0, 0.0042);

const camera = new THREE.PerspectiveCamera(42, initW / initH, 0.5, 260);
const camRig = {
  target: new THREE.Vector3(-11, 26.5, -9),
  desiredTarget: new THREE.Vector3(-11, 26.5, -9),
  pos: new THREE.Vector3(-2, 34, 6),
  desiredPos: new THREE.Vector3(-2, 34, 6)
};
camera.position.copy(camRig.pos);
camera.lookAt(camRig.target);

// ============================================================================
// 2. WORLD, FLEET, DIVER, SOUND & AUTHORITATIVE CONTROLLER
// ============================================================================
const sound = new SoundManager();
const oceanEnv = new OceanEnvironment(scene);
const ecosystem = new EcosystemManager(scene, oceanEnv);
const fleet = new MiningFleetManager(scene, oceanEnv, ecosystem);
const surfaceOcean = new SurfaceOceanManager(scene);
const diver = new HumanDiver(scene, oceanEnv);

if (fleet.submarine && fleet.submarine.root) fleet.submarine.root.visible = false;
if (fleet.restorationDrone && fleet.restorationDrone.root) fleet.restorationDrone.root.visible = false;

const lastCrawlerSeabedPos = new THREE.Vector3(-2.5, oceanEnv.getTerrainHeight(-2.5, -1.5), -1.5);

function placeCrawlerOnBoatDeck() {
  const vesselPos = fleet.surfaceVessel.group.position;
  fleet.crawler.root.position.set(vesselPos.x, vesselPos.y + 1.25, vesselPos.z - 2.2);
  fleet.crawler.root.rotation.set(0, Math.PI, 0);
}
placeCrawlerOnBoatDeck();

function spawnWorldPopup(worldPos, text, cssClass = 'popup-cyan') {
  camera.updateMatrixWorld();
  const projected = worldPos.clone().project(camera);
  if (projected.z > 1) return;
  const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;

  const el = document.createElement('div');
  el.className = `world-popup ${cssClass}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.textContent = text;
  labelsLayer.appendChild(el);
  setTimeout(() => el.remove(), 1650);
}

const game = new GameController(oceanEnv, ecosystem, fleet, sound, {
  onWorldPopup: (pos, text, cls) => spawnWorldPopup(pos, text, cls),
  onStageChange: (stage, location) => handleStageTransition(stage, location),
  onRuleEnacted: () => updateRuleStatusBadges(),
  onDefeat: (reason) => showSummaryModal({ isDefeat: true, reason })
});

const miniGames = new RestorationMiniGames(game, sound, (kind, val) => {
  if (kind === 'clean') {
    document.getElementById('mg-clean-pct').textContent = `${val}%`;
  }
});

// ============================================================================
// 3. UI & STAGE TRANSITION HANDLER
// ============================================================================
const captainCardEl = document.getElementById('captain-card');
const captainTextEl = document.getElementById('captain-text');
const objectiveEl = document.getElementById('hud-objective');
const modeBadgeEl = document.getElementById('hud-mode-badge');
const stageHudEl = document.getElementById('stage-hud');

function setCaptainDialogue(text, visible = true) {
  captainTextEl.textContent = text;
  captainCardEl.classList.toggle('hidden', !visible);
}

function setObjective(text) {
  objectiveEl.textContent = text;
}

function formatCash(n) {
  return n >= 1000 || n <= -1000 ? `$${Math.round(n / 1000)}K` : `$${Math.round(n)}`;
}

function updateRuleStatusBadges() {
  const r1 = document.getElementById('rule1-badge');
  const r2 = document.getElementById('rule2-badge');
  if (game.rule1Enacted) {
    r1.textContent = `Rule 1: ${game.rule1Enacted.shortTitle} ✓`;
    r1.classList.add('active');
  } else {
    r1.textContent = 'Rule 1: Pending';
    r1.classList.remove('active');
  }
  if (game.rule2Enacted) {
    r2.textContent = `Rule 2: ${game.rule2Enacted.shortTitle} ✓`;
    r2.classList.add('active');
  } else {
    r2.textContent = 'Rule 2: Pending';
    r2.classList.remove('active');
  }
}

function hideAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach((m) => m.classList.add('hidden'));
}

function updateContextualObjective() {
  modeBadgeEl.textContent = game.tutorialCompleted ? 'ONGOING OPS' : 'OBJECTIVE';

  if (game.location === PLAYER_LOCATIONS.SURFACE) {
    const uncleanedOil = surfaceOcean.oilPatches.filter((p) => !p.cleaned).length;
    if (uncleanedOil > 0) {
      setObjective(`Clean floating oil slicks (${game.surfacePollutionCollected}/${game.surfacePollutionTotal}) or press F to Dive`);
    } else if (!game.reefRestored) {
      setObjective('Surface clean! Click Restore Reef or press F to Dive to the ocean floor');
    } else if (game.oreStockpile > 0) {
      setObjective(`Sell Workshop Ore (${game.oreStockpile}/${game.businessSettings.workshopCapacity}T) or press F to Dive`);
    } else {
      setObjective('Navigate the ocean surface, Restore Reef, or press F to Dive to the seabed');
    }
  } else if (game.location === PLAYER_LOCATIONS.UNDERWATER) {
    const remOre = game.getTotalRemainingSeabedOre();
    if (game.miningProhibited) {
      setObjective('Mining paused by Restoration-First Permit — Press F to Return to Surface');
    } else if (remOre > 0) {
      setObjective(
        `Extract Ore (${Math.round(game.totalTonsMined)} / ${game.businessSettings.extractionTarget}T) • Deposit Remaining: ${remOre}T`
      );
    } else {
      setObjective('All seabed mineral deposits extracted! Press F to Return to Surface');
    }
  }
}

function handleStageTransition(stage, location) {
  hideAllModals();
  document.getElementById('hud-mining').classList.add('hidden');
  document.getElementById('hud-cleanup').classList.add('hidden');

  if (stage === GAME_STAGES.SURFACE_INTRO) {
    stageHudEl.classList.add('hidden');
    document.getElementById('modal-intro').classList.remove('hidden');
    setObjective('Configure starting parameters & launch your company');
    setCaptainDialogue(
      "Welcome aboard! Set your company's four starting parameters and let's begin operations.",
      true
    );
    return;
  }

  document.getElementById('hud-company-label').textContent = `${game.companyName} • ${game.playerName}`;

  if (stage === GAME_STAGES.DEPLOYMENT) {
    stageHudEl.classList.add('hidden');
    diver.root.visible = false;
    setObjective(
      game.diveCount === 1
        ? 'Deploying mining machine to the seabed...'
        : 'Diving to the ocean floor...'
    );
    setCaptainDialogue(
      game.diveCount === 1
        ? "Everything is ready. Let's send our mining machine down to the ocean floor!"
        : 'Lowering mining machine to the seabed.',
      true
    );
    sound.playSonarPing(620);
    return;
  }

  if (stage === GAME_STAGES.ASCENT_TO_SURFACE) {
    lastCrawlerSeabedPos.copy(fleet.crawler.root.position);
    diver.root.visible = false;
    stageHudEl.classList.add('hidden');
    setObjective('Returning to the surface vessel...');
    setCaptainDialogue('Retrieving mining machine back to the boat. Hold tight!', true);
    sound.playSonarPing(520);
    return;
  }

  if (stage === GAME_STAGES.RULE_CHANGE_1) {
    stageHudEl.classList.add('hidden');
    setObjective('Decision: Select Rule 1 — The Extraction Rule');
    setCaptainDialogue(
      'Sediment is clouding the reef and oil waste has reached the surface! Select your Extraction Rule.',
      true
    );
    openRuleModal('extraction');
    return;
  }

  if (stage === GAME_STAGES.RULE_CHANGE_2) {
    stageHudEl.classList.add('hidden');
    setObjective('Decision: Select Rule 2 — The Mineral Sales Rule');
    setCaptainDialogue('Surface waters are clean! Now select your company’s Mineral Sales Rule.', true);
    openRuleModal('sales');
    return;
  }

  if (stage === GAME_STAGES.BUDGET_NEGOTIATION) {
    stageHudEl.classList.add('hidden');
    setObjective('Allocate the reef restoration budget');
    setCaptainDialogue(
      'Good work! Now allocate a restoration budget to outfit our reef restoration supplies.',
      true
    );
    openNegotiationModal();
    return;
  }

  if (stage === GAME_STAGES.TUTORIAL_COMPLETE) {
    stageHudEl.classList.add('hidden');
    setObjective('Tutorial Complete — Ready for Ongoing Operations');
    setCaptainDialogue(
      'Your company is officially operational! Click Continue Operations to keep exploring, diving, and restoring.',
      true
    );
    showSummaryModal({ isTutorialComplete: true });
    return;
  }

  // Active Gameplay Screens
  if (location === PLAYER_LOCATIONS.SURFACE) {
    if (!game.initialOilSpawned && game.environmentalWarningTriggered) {
      game.initialOilSpawned = true;
      surfaceOcean.spawnOilSlicks(GAME_BALANCE.campaign.surfaceOilPatchesCount, 0);
      game.surfacePollutionTotal = surfaceOcean.oilPatches.length;
    } else if (game.pendingExtraOilSlicks > 0) {
      surfaceOcean.spawnOilSlicks(game.pendingExtraOilSlicks, surfaceOcean.oilPatches.length);
      game.surfacePollutionTotal = surfaceOcean.oilPatches.length;
      game.pendingExtraOilSlicks = 0;
    }

    stageHudEl.classList.remove('hidden');
    document.getElementById('hud-cleanup').classList.remove('hidden');

    // Captain Harlan speaks on the boat/surface
    setCaptainDialogue(
      game.tutorialCompleted
        ? 'Back on the boat! Sell workshop ore, clean any surface oil, restore the reef, or press F to dive again.'
        : 'Welcome back to the boat! Skim the floating oil slicks, sell your ore, or open Restore Reef.',
      true
    );
  } else if (location === PLAYER_LOCATIONS.UNDERWATER) {
    stageHudEl.classList.remove('hidden');
    document.getElementById('hud-mining').classList.remove('hidden');

    // IMPORTANT (Section 4): Remove Captain Harlan's persistent card during underwater mining!
    setCaptainDialogue('', false);

    if (stage === GAME_STAGES.DIVE_RESTORATION) {
      diver.root.visible = true;
      diver.root.position.set(
        fleet.crawler.root.position.x + 2.2,
        oceanEnv.getTerrainHeight(fleet.crawler.root.position.x + 2.2, fleet.crawler.root.position.z + 1.5) + 1.5,
        fleet.crawler.root.position.z + 1.5
      );
      openRestorationScreen();
    } else {
      diver.root.visible = false;
    }
  }

  refreshStageHUD();
  updateContextualObjective();
}

// ============================================================================
// 4. STARTING SCREEN — ALL FOUR STARTING PARAMETERS FUNCTIONAL
// ============================================================================
let chosenCapacity = 35;
let chosenWorkshopCap = 100;

document.querySelectorAll('.cap-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cap-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    chosenCapacity = Number(btn.dataset.cap);
    document.getElementById('val-capacity').textContent = `${chosenCapacity}T`;
    const opt = GAME_BALANCE.businessSettings.capacityOptions.find((o) => o.value === chosenCapacity);
    if (opt) document.getElementById('desc-capacity').textContent = opt.consequence;
  });
});

document.querySelectorAll('.wcap-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.wcap-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    chosenWorkshopCap = Number(btn.dataset.wcap);
    document.getElementById('val-workshop').textContent = `${chosenWorkshopCap}T`;
    const opt = GAME_BALANCE.businessSettings.workshopCapacityOptions.find(
      (o) => o.value === chosenWorkshopCap
    );
    if (opt) document.getElementById('desc-workshop').textContent = opt.consequence;
  });
});

const sliderPrice = document.getElementById('slider-price');
sliderPrice.addEventListener('input', () => {
  document.getElementById('val-price').textContent = `$${Number(sliderPrice.value).toLocaleString()} / T`;
});

const sliderTarget = document.getElementById('slider-target');
sliderTarget.addEventListener('input', () => {
  document.getElementById('val-target').textContent = `${sliderTarget.value}T`;
});

document.getElementById('btn-start-game').addEventListener('click', () => {
  sound.resume();
  const pName = document.getElementById('input-player-name').value;
  const cName = document.getElementById('input-company-name').value;
  const priceVal = Number(sliderPrice.value);
  const targetVal = Number(sliderTarget.value);

  game.startGameWithParameters({
    playerName: pName,
    companyName: cName,
    machineCapacity: chosenCapacity,
    workshopCapacity: chosenWorkshopCap,
    oreSellingPrice: priceVal,
    extractionTarget: targetVal
  });
  refreshStageHUD();
});

// ============================================================================
// 5. TWO-RULE CHANGING MECHANISM (ACCESSIBLE & CAPPED AT 2)
// ============================================================================
let pendingRuleStage = null;
let pendingRuleOptionId = null;
let stageBeforeRuleModal = null;

function openRuleModal(stageKey) {
  const def = RULE_CHANGES[stageKey];
  if (!def) return;
  if (stageKey === 'extraction' && game.rule1Enacted) return;
  if (stageKey === 'sales' && game.rule2Enacted) return;
  if (game.rulesUsedCount >= game.maxRuleChanges) return;

  stageBeforeRuleModal = game.stage;
  pendingRuleStage = stageKey;
  pendingRuleOptionId = null;

  document.getElementById('rule-badge').textContent = `IN-CAMPAIGN RULE CHANGE ${def.number} OF 2`;
  document.getElementById('rule-title').textContent = def.title;
  document.getElementById('rule-desc').textContent = def.description;

  const confirmBtn = document.getElementById('btn-confirm-rule');
  confirmBtn.disabled = true;

  const grid = document.getElementById('rule-options-grid');
  grid.innerHTML = '';
  def.options.forEach((opt) => {
    const card = document.createElement('div');
    card.className = 'rule-option-card';
    card.innerHTML = `
      <span class="modal-badge ${opt.badgeClass}">${opt.badge}</span>
      <h3>${opt.title}</h3>
      <p class="rule-pros">✓ ${opt.pros}</p>
      <p class="rule-cons">⚠ ${opt.cons}</p>
      <div class="rule-effect">${opt.effectsText}</div>
    `;
    card.addEventListener('click', () => {
      grid.querySelectorAll('.rule-option-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      pendingRuleOptionId = opt.id;
      confirmBtn.disabled = false;
    });
    grid.appendChild(card);
  });

  document.getElementById('modal-rule-change').classList.remove('hidden');
}

document.getElementById('btn-confirm-rule').addEventListener('click', () => {
  if (!pendingRuleStage || !pendingRuleOptionId) return;
  document.getElementById('modal-rule-change').classList.add('hidden');
  game.enactRuleChange(pendingRuleStage, pendingRuleOptionId);
});

// Allow clicking Rule 1 / Rule 2 badges in the HUD if still Pending
document.getElementById('rule1-badge').addEventListener('click', () => {
  if (game.stage === GAME_STAGES.SURFACE_INTRO) return;
  if (!game.rule1Enacted) openRuleModal('extraction');
});
document.getElementById('rule2-badge').addEventListener('click', () => {
  if (game.stage === GAME_STAGES.SURFACE_INTRO) return;
  if (!game.rule2Enacted) openRuleModal('sales');
});

// Single-Player Restoration Budget Selection Modal
function openNegotiationModal() {
  const modal = document.getElementById('modal-negotiation');
  const containerEl = document.getElementById('neg-options-container');
  const errEl = document.getElementById('neg-error');
  document.getElementById('neg-credits').textContent = formatCash(game.credits);
  errEl.classList.add('hidden');
  containerEl.innerHTML = '';

  const tiers = Object.values(GAME_BALANCE.restorationBudgets);
  tiers.forEach((t) => {
    const card = document.createElement('div');
    card.className = 'neg-card';
    card.innerHTML = `
      <h3>${t.label} (${formatCash(t.cost)})</h3>
      <p class="modal-desc">${t.desc}</p>
      <button type="button" class="btn-primary">Select ${t.label}</button>
    `;
    card.querySelector('button').addEventListener('click', () => {
      const res = game.finalizeBudget(t.id);
      if (!res.ok) {
        errEl.textContent = res.error;
        errEl.classList.remove('hidden');
      }
    });
    containerEl.appendChild(card);
  });

  modal.classList.remove('hidden');
}

// ============================================================================
// 6. REEF RESTORATION SCREEN (WITH BACK BUTTON, PUZZLE VARIETY & OUTCOMES)
// ============================================================================
function openRestorationScreen() {
  // Load or preserve current puzzle variation without resetting existing progress
  const variation = miniGames.initWaterFlowPuzzle(false);

  document.getElementById('mg-kits-count').textContent = `${game.restorationSupplies.coralKits} Kits`;
  document.getElementById('mg-outcome-name').textContent = variation.outcome.name;
  document.getElementById('mg-clean-pct').textContent = `${game.reefCleanProgress}%`;

  if (game.reefCleanProgress < 90) {
    document.getElementById('mg-badge').textContent = 'STEP 1 — CLEAN THE REEF';
    document.getElementById('mg-title').textContent = `Clean Reef for ${variation.outcome.regionName}`;
    document.getElementById('mg-desc').textContent =
      'Click and drag across the dark sediment patches to clean the coral reef, or click Open Water-Flow Puzzle.';
    document.getElementById('mg-clean-view').classList.remove('hidden');
    document.getElementById('mg-puzzle-view').classList.add('hidden');
    document.getElementById('modal-restoration-minigame').classList.remove('hidden');
    miniGames.initCleanReefGame(document.getElementById('clean-reef-canvas'), false);
  } else {
    openWaterPuzzleView();
  }
}

function drawTileSvg(tile, powered) {
  const ports = miniGames.getTilePorts(tile);
  const stroke = powered ? '#18c8da' : '#6c8ba1';
  let paths = '';
  if (ports.includes(0)) paths += `<line x1="36" y1="36" x2="36" y2="4" stroke="${stroke}" stroke-width="10" stroke-linecap="round"/>`;
  if (ports.includes(1)) paths += `<line x1="36" y1="36" x2="68" y2="36" stroke="${stroke}" stroke-width="10" stroke-linecap="round"/>`;
  if (ports.includes(2)) paths += `<line x1="36" y1="36" x2="36" y2="68" stroke="${stroke}" stroke-width="10" stroke-linecap="round"/>`;
  if (ports.includes(3)) paths += `<line x1="36" y1="36" x2="4" y2="36" stroke="${stroke}" stroke-width="10" stroke-linecap="round"/>`;
  return `<svg width="68" height="68" viewBox="0 0 72 72">${paths}<circle cx="36" cy="36" r="6" fill="${stroke}"/></svg>`;
}

function renderWaterPuzzle() {
  const variation = miniGames.initWaterFlowPuzzle(false);
  const { connected, visited } = miniGames.isWaterPathConnected();
  const gridEl = document.getElementById('puzzle-grid');
  gridEl.innerHTML = '';

  miniGames.grid.forEach((tile, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `puzzle-tile ${visited.has(idx) ? 'powered' : ''}`;
    btn.innerHTML = drawTileSvg(tile, visited.has(idx));
    btn.addEventListener('click', () => {
      miniGames.rotateTile(idx);
      renderWaterPuzzle();
    });
    gridEl.appendChild(btn);
  });

  // Render varied coral species buttons for this variation's outcome
  const slots = document.querySelectorAll('.coral-slot-btn');
  slots.forEach((btn, idx) => {
    const fragLabel = variation.outcome.fragments[idx] || `🪸 Coral Species ${idx + 1}`;
    const isPlanted = miniGames.plantedSlots.has(idx);
    btn.classList.toggle('planted', isPlanted);
    btn.textContent = isPlanted ? `${fragLabel} ✓` : fragLabel;
  });

  document.getElementById('coral-outcome-banner').textContent =
    `✓ Current connected! Plant ${variation.outcome.name} in ${variation.outcome.regionName}:`;

  if (connected) {
    document.getElementById('coral-placement-section').classList.remove('hidden');
  } else {
    document.getElementById('coral-placement-section').classList.add('hidden');
  }
}

function openWaterPuzzleView() {
  const variation = miniGames.initWaterFlowPuzzle(false);
  document.getElementById('mg-badge').textContent = 'STEP 2 — REBUILD THE REEF';
  document.getElementById('mg-title').textContent = variation.title;
  document.getElementById('mg-desc').textContent = variation.instruction;
  document.getElementById('mg-kits-count').textContent = `${game.restorationSupplies.coralKits} Kits`;
  document.getElementById('mg-outcome-name').textContent = variation.outcome.name;

  document.getElementById('mg-clean-view').classList.add('hidden');
  document.getElementById('mg-puzzle-view').classList.remove('hidden');

  const clues = game.restorationSupplies.puzzleClues;
  document.getElementById('puzzle-clue-box').textContent =
    clues >= 2 ? variation.clueFull : variation.clueShort;

  renderWaterPuzzle();
  document.getElementById('modal-restoration-minigame').classList.remove('hidden');
}

// Back button on Reef Restoration screen: returns to previous gameplay screen without losing progress!
function closeRestorationScreenBack() {
  document.getElementById('modal-restoration-minigame').classList.add('hidden');
  if (game.location === PLAYER_LOCATIONS.UNDERWATER && game.stage === GAME_STAGES.DIVE_RESTORATION) {
    game.stage = game.tutorialCompleted ? GAME_STAGES.ONGOING_OPERATIONS : GAME_STAGES.UNDERWATER_MINING;
    game.underwaterMode = 'CRAWLER';
    diver.root.visible = false;
  }
  handleStageTransition(game.stage, game.location);
}

document.getElementById('btn-back-restoration').addEventListener('click', closeRestorationScreenBack);
document.getElementById('btn-back-restoration-bottom').addEventListener('click', closeRestorationScreenBack);
document.getElementById('btn-open-reef-surface').addEventListener('click', () => {
  sound.resume();
  openRestorationScreen();
});
document.getElementById('btn-proceed-puzzle').addEventListener('click', openWaterPuzzleView);

document.querySelectorAll('.coral-slot-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const slotIdx = Number(btn.dataset.slot);
    if (miniGames.plantedSlots.has(slotIdx)) return;
    miniGames.plantedSlots.add(slotIdx);
    miniGames.coralsPlaced = miniGames.plantedSlots.size;
    sound.playRestorationChime();
    renderWaterPuzzle();

    if (miniGames.coralsPlaced >= miniGames.coralsRequired) {
      const completedOutcome = miniGames.currentVariation?.outcome || null;
      setTimeout(() => {
        document.getElementById('modal-restoration-minigame').classList.add('hidden');
        miniGames.advanceToNextRestorationCycle();
        game.completePuzzleAndCoralPlacement(completedOutcome);
        if (completedOutcome) {
          spawnWorldPopup(
            fleet.surfaceVessel.group.position,
            `Restored: ${completedOutcome.name}!`,
            'popup-green'
          );
        }
      }, 400);
    }
  });
});

// ============================================================================
// 7. TUTORIAL COMPLETE & SUMMARY MODAL
// ============================================================================
function showSummaryModal({ isDefeat = false, reason = '', isTutorialComplete = false } = {}) {
  hideAllModals();
  const res = game.evaluateCampaignEnding();
  const badgeEl = document.getElementById('end-badge');
  const titleEl = document.getElementById('end-title');
  const quoteEl = document.getElementById('end-quote');
  const gridEl = document.getElementById('end-summary-grid');
  const continueBtn = document.getElementById('btn-continue-operations');

  if (isDefeat) {
    badgeEl.textContent = `CAMPAIGN DEFEAT — ${reason}`;
    badgeEl.className = 'modal-badge badge-amber';
    titleEl.textContent = reason === 'BANKRUPTCY' ? 'COMPANY BANKRUPTCY' : 'ECOLOGICAL COLLAPSE';
    quoteEl.textContent =
      reason === 'BANKRUPTCY'
        ? 'Your company ran out of credits to sustain operations and environmental restoration.'
        : 'Ocean health fell below critical survival thresholds.';
    continueBtn.classList.add('hidden');
  } else if (isTutorialComplete) {
    badgeEl.textContent = 'TUTORIAL COMPLETE — ONGOING OPERATIONS UNLOCKED';
    badgeEl.className = 'modal-badge badge-green';
    titleEl.textContent = 'TUTORIAL COMPLETE!';
    quoteEl.textContent =
      '"Your company is officially operational. The ocean is still waiting to be explored."';
    continueBtn.classList.remove('hidden');
  } else {
    badgeEl.textContent = res.badge;
    badgeEl.className = `modal-badge ${res.badgeClass}`;
    titleEl.textContent = `ABYSS INC. — ${res.title}`;
    quoteEl.textContent =
      '"Your company is active. Continue diving, mining remaining deposits, and protecting the reef."';
    continueBtn.classList.remove('hidden');
  }

  const lastRestored =
    game.completedRestorations.length > 0
      ? game.completedRestorations[game.completedRestorations.length - 1].name
      : res.reefRestored
        ? 'Restored ✓'
        : 'In Progress';

  gridEl.innerHTML = `
    <div class="summary-item"><span>Company</span><strong>${res.companyName} (${res.playerName})</strong></div>
    <div class="summary-item"><span>Ore Extracted / Target</span><strong>${res.totalTonsMined}T / ${res.extractionTarget}T</strong></div>
    <div class="summary-item"><span>Machine / Workshop Cap</span><strong>${res.machineCapacity}T / ${res.workshopCapacity}T</strong></div>
    <div class="summary-item"><span>Company Credits</span><strong>${formatCash(res.credits)}</strong></div>
    <div class="summary-item"><span>Reef Sanctuary Restored</span><strong>${lastRestored} (${res.oceanHealth}%)</strong></div>
    <div class="summary-item"><span>Rule 1 & Rule 2</span><strong>${res.rule1} / ${res.rule2}</strong></div>
  `;

  document.getElementById('modal-ending').classList.remove('hidden');
}

document.getElementById('btn-continue-operations').addEventListener('click', () => {
  sound.resume();
  document.getElementById('modal-ending').classList.add('hidden');
  game.continueOperations();
});

document.getElementById('btn-replay-tutorial').addEventListener('click', () => {
  window.location.reload();
});
document.getElementById('btn-return-main-menu').addEventListener('click', () => {
  window.location.reload();
});

// ============================================================================
// 8. SINGLE-PLAYER INPUT & REPEATABLE NAVIGATION (E AND F)
// ============================================================================
const keysDown = new Set();
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  keysDown.add(k);

  if (k === 'e') handleInteractAction();
  if (k === 'r') handleOffloadOrEmptyAction();
  if (k === 'f') handleDiveOrSurfaceToggle();
});

window.addEventListener('keyup', (e) => {
  keysDown.delete(e.key.toLowerCase());
});

function handleDiveOrSurfaceToggle() {
  sound.resume();
  if (game.canDiveToOceanFloor()) {
    game.diveToOceanFloor(false);
  } else if (game.canReturnToSurface()) {
    game.returnToSurface();
  }
}

function handleInteractAction() {
  sound.resume();
  if (game.location === PLAYER_LOCATIONS.UNDERWATER) {
    if (game.miningProhibited) {
      spawnWorldPopup(
        fleet.crawler.root.position,
        'Mining Prohibited until Restoration Complete!',
        'popup-gold'
      );
      return;
    }
    if (game.nearestDeposit) {
      game.isMiningActive = !game.isMiningActive;
    } else {
      spawnWorldPopup(fleet.crawler.root.position, 'Move closer to a glowing deposit!', 'popup-cyan');
    }
  } else if (game.location === PLAYER_LOCATIONS.SURFACE) {
    skimNearestOilSlick();
  }
}

function handleOffloadOrEmptyAction() {
  sound.resume();
  if (game.location === PLAYER_LOCATIONS.UNDERWATER) {
    if (game.oreInHold > 0) {
      const off = game.offloadCrawlerToBoat();
      if (off > 0) {
        spawnWorldPopup(
          fleet.crawler.root.position,
          `Offloaded ${off}T to Workshop (${game.oreStockpile}/${game.businessSettings.workshopCapacity}T)`,
          'popup-gold'
        );
      } else {
        spawnWorldPopup(
          fleet.crawler.root.position,
          `Workshop Full (${game.businessSettings.workshopCapacity}T)! Sell ore on surface.`,
          'popup-gold'
        );
      }
    }
  } else if (game.location === PLAYER_LOCATIONS.SURFACE) {
    if (game.surfaceTankFill > 0) {
      game.surfaceTankFill = 0;
      sound.playRestorationChime();
      spawnWorldPopup(fleet.surfaceVessel.group.position, 'Skimmer Tank Emptied!', 'popup-green');
    }
  }
}

function skimNearestOilSlick() {
  const vesselPos = fleet.surfaceVessel.group.position;
  const patch = surfaceOcean.oilPatches.find(
    (p) => !p.cleaned && Math.hypot(p.x - vesselPos.x, p.z - vesselPos.z) < 8.5
  );
  if (!patch) {
    spawnWorldPopup(vesselPos, 'Steer closer to a floating oil slick!', 'popup-gold');
    return;
  }
  if (game.surfaceTankFill >= game.surfaceTankCapacity) {
    spawnWorldPopup(vesselPos, 'Tank full! Press R to Empty Tank.', 'popup-gold');
    return;
  }

  const skimStep = Math.min(patch.remaining, 5);
  patch.remaining -= skimStep;
  game.surfaceTankFill = Math.min(game.surfaceTankCapacity, game.surfaceTankFill + skimStep);
  sound.playNoduleCollect();

  if (patch.remaining <= 0) {
    patch.cleaned = true;
    patch.group.visible = false;
    game.surfacePollutionCollected++;
    spawnWorldPopup(
      vesselPos,
      `Oil Slick Cleaned (${game.surfacePollutionCollected}/${game.surfacePollutionTotal})`,
      'popup-green'
    );
  } else {
    spawnWorldPopup(vesselPos, 'Skimming oil...', 'popup-cyan');
  }

  const remainingPatches = surfaceOcean.oilPatches.filter((p) => !p.cleaned).length;
  if (remainingPatches === 0 && surfaceOcean.oilPatches.length > 0) {
    game.surfaceCleaned = true;
    if (!game.rule2Enacted) {
      game.stage = GAME_STAGES.RULE_CHANGE_2;
      handleStageTransition(game.stage, game.location);
    } else {
      updateContextualObjective();
    }
  } else {
    updateContextualObjective();
  }
}

// Button bindings
document.getElementById('btn-mine-toggle').addEventListener('click', handleInteractAction);
document.getElementById('btn-skim-oil').addEventListener('click', skimNearestOilSlick);
document.getElementById('btn-empty-tank').addEventListener('click', handleOffloadOrEmptyAction);

document.getElementById('btn-dive-from-surface').addEventListener('click', () => {
  sound.resume();
  game.diveToOceanFloor(false);
});
document.getElementById('btn-surface-from-mining').addEventListener('click', () => {
  sound.resume();
  game.returnToSurface();
});

document.getElementById('btn-sell-ore').addEventListener('click', () => {
  const res = game.sellStockpileOre();
  const msgEl = document.getElementById('s-status-msg');
  if (!res.ok) {
    msgEl.textContent = res.error;
  } else {
    msgEl.textContent = `Sold ${res.tons}T at $${res.unitPrice.toLocaleString()}/T for ${formatCash(res.totalPayout)}!`;
    refreshStageHUD();
    updateContextualObjective();
  }
});

document.getElementById('btn-mute').addEventListener('click', () => {
  const muted = sound.toggleMute();
  document.getElementById('btn-mute').textContent = muted ? '🔇' : '🔊';
});

// ============================================================================
// 9. MAIN ANIMATION LOOP & AUTHORITATIVE HUD REFRESH
// ============================================================================
const clock = new THREE.Clock();

function refreshStageHUD() {
  const totalReserves = game.getTotalRemainingSeabedOre();

  if (game.location === PLAYER_LOCATIONS.UNDERWATER) {
    document.getElementById('m-extracted').textContent =
      `${Math.round(game.totalTonsMined)} / ${game.businessSettings.extractionTarget}T`;
    document.getElementById('m-hold').textContent =
      `${Math.round(game.oreInHold)} / ${game.businessSettings.machineCapacity}T`;

    if (game.nearestDeposit) {
      const depRem = Math.round(game.nearestDeposit.remainingTons);
      document.getElementById('m-reserves').textContent = `${depRem}T (${totalReserves}T Total)`;
      document.getElementById('m-deposit-feedback').textContent = game.isMiningActive
        ? `Mining ${game.nearestDeposit.name} (${depRem}T remaining)...`
        : `Near ${game.nearestDeposit.name} (${depRem}T remaining)`;
    } else {
      document.getElementById('m-reserves').textContent = `${totalReserves}T`;
      document.getElementById('m-deposit-feedback').textContent =
        'Approach a glowing mineral deposit on the seabed';
    }
  } else if (game.location === PLAYER_LOCATIONS.SURFACE) {
    document.getElementById('c-credits').textContent = formatCash(game.credits);
    document.getElementById('c-stockpile').textContent =
      `${Math.round(game.oreStockpile)} / ${game.businessSettings.workshopCapacity}T`;
    document.getElementById('c-price').textContent =
      `$${game.businessSettings.oreSellingPrice.toLocaleString()} / T`;
    document.getElementById('c-cleaned').textContent =
      `${game.surfacePollutionCollected} / ${game.surfacePollutionTotal}`;
    document.getElementById('c-tank').textContent =
      `${game.surfaceTankFill} / ${game.surfaceTankCapacity}`;
  }
}

function updateDeploymentOrAscent() {
  const vesselPos = fleet.surfaceVessel.group.position;
  const targetX = game.diveCount === 1 ? vesselPos.x + 2.5 : lastCrawlerSeabedPos.x;
  const targetZ = game.diveCount === 1 ? vesselPos.z - 2.0 : lastCrawlerSeabedPos.z;
  const landY = oceanEnv.getTerrainHeight(targetX, targetZ);

  if (game.location === PLAYER_LOCATIONS.DIVING) {
    const duration = game.diveCount === 1 ? 3.8 : 2.2;
    const t = Math.min(1, game.stageTimer / duration);
    const curX = THREE.MathUtils.lerp(vesselPos.x, targetX, t);
    const curZ = THREE.MathUtils.lerp(vesselPos.z - 2.2, targetZ, t);
    const curY = THREE.MathUtils.lerp(vesselPos.y + 1.25, landY, t);
    fleet.crawler.root.position.set(curX, curY, curZ);

    if (fleet.surfaceVessel.craneBoom) {
      fleet.surfaceVessel.craneBoom.rotation.y = Math.sin(t * Math.PI) * 0.55;
    }
    camRig.desiredTarget.copy(fleet.crawler.root.position).add(new THREE.Vector3(0, 1, 0));
    camRig.desiredPos.copy(fleet.crawler.root.position).add(new THREE.Vector3(10, 8, 12));

    if (t >= 1) {
      game.completeDiveTransition();
    }
  } else if (game.location === PLAYER_LOCATIONS.SURFACING) {
    const duration = 2.4;
    const t = Math.min(1, game.stageTimer / duration);
    const curX = THREE.MathUtils.lerp(lastCrawlerSeabedPos.x, vesselPos.x, t);
    const curZ = THREE.MathUtils.lerp(lastCrawlerSeabedPos.z, vesselPos.z - 2.2, t);
    const curY = THREE.MathUtils.lerp(lastCrawlerSeabedPos.y, vesselPos.y + 1.25, t);
    fleet.crawler.root.position.set(curX, curY, curZ);

    if (fleet.surfaceVessel.craneBoom) {
      fleet.surfaceVessel.craneBoom.rotation.y = Math.sin(t * Math.PI) * 0.55;
    }
    camRig.desiredTarget.copy(fleet.crawler.root.position);
    camRig.desiredPos.copy(fleet.crawler.root.position).add(new THREE.Vector3(10, 8, 12));

    if (t >= 1) {
      placeCrawlerOnBoatDeck();
      game.completeAscentTransition();
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const elapsed = clock.getElapsedTime();

  const fwd =
    (keysDown.has('w') || keysDown.has('arrowup') ? 1 : 0) -
    (keysDown.has('s') || keysDown.has('arrowdown') ? 1 : 0);
  const turn =
    (keysDown.has('d') || keysDown.has('arrowright') ? 1 : 0) -
    (keysDown.has('a') || keysDown.has('arrowleft') ? 1 : 0);

  game.update(dt, elapsed, { forward: fwd, turn });
  oceanEnv.update(dt, elapsed);
  ecosystem.update(dt, elapsed);
  fleet.update(dt, elapsed);
  surfaceOcean.update(elapsed, fleet.surfaceVessel ? fleet.surfaceVessel.group : null);

  if (game.location === PLAYER_LOCATIONS.DIVING || game.location === PLAYER_LOCATIONS.SURFACING) {
    updateDeploymentOrAscent();
  } else if (game.location === PLAYER_LOCATIONS.UNDERWATER) {
    camRig.desiredTarget.copy(fleet.crawler.root.position).add(new THREE.Vector3(0, 1, 0));
    camRig.desiredPos.copy(fleet.crawler.root.position).add(new THREE.Vector3(11, 10, 14));
  } else {
    placeCrawlerOnBoatDeck();
    const vPos = fleet.surfaceVessel.group.position;
    camRig.desiredTarget.copy(vPos).add(new THREE.Vector3(0, 1.5, 0));
    camRig.desiredPos.copy(vPos).add(new THREE.Vector3(14, 11, 16));
  }

  camRig.target.lerp(camRig.desiredTarget, 1 - Math.exp(-5 * dt));
  camRig.pos.lerp(camRig.desiredPos, 1 - Math.exp(-5 * dt));
  camera.position.copy(camRig.pos);
  camera.lookAt(camRig.target);

  const isUnderwater = camera.position.y < surfaceOcean.surfaceY;
  const targetBg = isUnderwater ? UNDERWATER_COLOR : SURFACE_SKY_COLOR;
  scene.background.lerp(targetBg, 1 - Math.exp(-6 * dt));
  scene.fog.color.copy(scene.background);

  const health = game.getGlobalOceanHealth();
  const murkiness = isUnderwater ? 0.011 + (1 - health / 100) * 0.024 : 0.0042;
  scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, murkiness, 1 - Math.exp(-4 * dt));

  refreshStageHUD();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  const w = Math.max(1, container.clientWidth || window.innerWidth);
  const h = Math.max(1, container.clientHeight || window.innerHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

handleStageTransition(GAME_STAGES.SURFACE_INTRO, PLAYER_LOCATIONS.SURFACE);
animate();
