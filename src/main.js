import * as THREE from 'three';
import { SoundManager } from './audio/SoundManager.js';
import { OceanEnvironment } from './world/OceanEnvironment.js';
import { EcosystemManager } from './world/EcosystemManager.js';
import { MiningFleetManager } from './machines/MiningMachines.js';
import { SurfaceOceanManager, HumanDiver } from './world/SurfaceAndDiver.js';
import { GameController, RULE_CHANGES } from './game/GameState.js';
import { GAME_BALANCE, GAME_STAGES, PLAYER_LOCATIONS } from './game/GameConfig.js';
import { ConstitutionPersistence } from './game/ConstitutionPersistence.js';
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

// Keep strictly one boat, one mining machine, and one human diver
if (fleet.submarine && fleet.submarine.root) fleet.submarine.root.visible = false;
if (fleet.restorationDrone && fleet.restorationDrone.root) fleet.restorationDrone.root.visible = false;

// Remember where crawler was on the seabed across repeatable dives
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
    document.getElementById('r-clean-pct').textContent = `${val}%`;
    if (val >= 90) {
      document.getElementById('btn-proceed-puzzle').classList.remove('hidden');
    }
  }
});

// ============================================================================
// 3. UI & STAGE TRANSITION HANDLER
// ============================================================================
const captainTextEl = document.getElementById('captain-text');
const objectiveEl = document.getElementById('hud-objective');
const modeBadgeEl = document.getElementById('hud-mode-badge');
const stageHudEl = document.getElementById('stage-hud');

function setCaptainDialogue(text) {
  captainTextEl.textContent = text;
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
    r1.textContent = `Rule 1: ${game.rule1Enacted.shortTitle}`;
    r1.classList.add('active');
  }
  if (game.rule2Enacted) {
    r2.textContent = `Rule 2: ${game.rule2Enacted.shortTitle}`;
    r2.classList.add('active');
  }
}

function hideAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach((m) => m.classList.add('hidden'));
}

function updateContextualObjective() {
  modeBadgeEl.textContent = game.tutorialCompleted ? 'ONGOING OPS' : 'TUTORIAL';

  if (game.tutorialCompleted) {
    const uncleanedOil = surfaceOcean.oilPatches.filter((p) => !p.cleaned).length;
    const remOre = game.getTotalRemainingSeabedOre();
    if (game.location === PLAYER_LOCATIONS.SURFACE) {
      if (uncleanedOil > 0) {
        setObjective(`Clean ${uncleanedOil} remaining floating oil slicks or press [F] to Dive`);
      } else if (game.oreStockpile > 0) {
        setObjective('Sell extracted ore stockpile or press [F] to Dive to the seabed');
      } else {
        setObjective('Navigate the ocean surface or press [F] to Dive and explore remaining deposits');
      }
    } else if (game.location === PLAYER_LOCATIONS.UNDERWATER) {
      if (remOre > 0) {
        setObjective(`Explore & extract remaining seabed deposits (${remOre}t left) or press [F] to Surface`);
      } else {
        setObjective('All mineral veins extracted! Restore damaged reefs or press [F] to Surface');
      }
    }
    return;
  }

  // Tutorial contextual objectives
  if (game.location === PLAYER_LOCATIONS.SURFACE) {
    const uncleanedOil = surfaceOcean.oilPatches.filter((p) => !p.cleaned).length;
    if (uncleanedOil > 0) {
      setObjective(`Clean floating oil slicks (${game.surfacePollutionCollected}/${game.surfacePollutionTotal}) or press [F] to Dive`);
    } else {
      setObjective('Surface clean! Press [F] to Dive to the ocean floor');
    }
  } else if (game.location === PLAYER_LOCATIONS.UNDERWATER) {
    if (game.stage === GAME_STAGES.DIVE_RESTORATION || game.underwaterMode === 'DIVER') {
      setObjective('Clean the damaged coral reef [E] & solve the water-flow puzzle');
    } else if (!game.rule1Enacted) {
      setObjective(`Extract ore toward your ${game.businessSettings.extractionTarget}t target (or press [F] to Surface)`);
    } else if (game.miningProhibited) {
      setObjective('Mining paused by Restoration-First Permit — Press [F] to Return to Surface');
    } else {
      setObjective(`Mine ore (${Math.round(game.totalTonsMined)}/${game.businessSettings.extractionTarget}t) or press [F] to Return to Surface`);
    }
  }
}

function handleStageTransition(stage, location) {
  hideAllModals();
  document.getElementById('hud-mining').classList.add('hidden');
  document.getElementById('hud-cleanup').classList.add('hidden');
  document.getElementById('hud-restoration').classList.add('hidden');
  document.getElementById('hud-sell-box').classList.add('hidden');

  if (stage === GAME_STAGES.SURFACE_INTRO) {
    stageHudEl.classList.add('hidden');
    document.getElementById('modal-intro').classList.remove('hidden');
    setObjective('Establish your deep-sea mining company');
    setCaptainDialogue(
      "Welcome aboard, new recruit! Ready to start your very own deep-sea mining company? The ocean is full of valuable resources. Let's get started!"
    );
    return;
  }

  if (stage === GAME_STAGES.BUSINESS_SETTINGS) {
    stageHudEl.classList.add('hidden');
    document.getElementById('modal-settings').classList.remove('hidden');
    document.getElementById('hud-company-label').textContent = `${game.companyName} • ${game.playerName}`;
    setObjective('Configure initial business settings');
    setCaptainDialogue(
      `Welcome, ${game.playerName}! Before we deploy, set ${game.companyName}'s machine capacity, asking price, and extraction target.`
    );
    return;
  }

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
        ? "Everything is ready. Let's send our little mining machine down! Find the mineral deposits, extract the ore and bring it back."
        : 'Lowering down to the ocean floor. All systems green!'
    );
    sound.playSonarPing(620);
    return;
  }

  if (stage === GAME_STAGES.ASCENT_TO_SURFACE) {
    lastCrawlerSeabedPos.copy(fleet.crawler.root.position);
    diver.root.visible = false;
    stageHudEl.classList.add('hidden');
    setObjective('Returning to the surface vessel...');
    setCaptainDialogue('Winching back up to the surface boat. Hold tight!');
    sound.playSonarPing(520);
    return;
  }

  if (stage === GAME_STAGES.RULE_CHANGE_1) {
    stageHudEl.classList.add('hidden');
    setObjective('Decision: Choose Extraction Rule (Rule Change 1)');
    setCaptainDialogue(
      "Hey! We've got a problem. The water is becoming cloudy, the reef is covered in sediment, and waste has reached the surface!"
    );
    openRuleModal('extraction');
    return;
  }

  if (stage === GAME_STAGES.RULE_CHANGE_2) {
    stageHudEl.classList.add('hidden');
    setObjective('Decision: Choose Mineral Sales Rule (Rule Change 2)');
    setCaptainDialogue('Surface waters are clean! Now decide how your company will sell its extracted minerals.');
    openRuleModal('sales');
    return;
  }

  if (stage === GAME_STAGES.BUDGET_NEGOTIATION) {
    stageHudEl.classList.add('hidden');
    setObjective('Allocate the reef restoration budget');
    setCaptainDialogue(
      'Good work! The surface looks much better, but the reef below is still damaged. Choose a restoration budget to outfit our diver.'
    );
    openNegotiationModal();
    return;
  }

  if (stage === GAME_STAGES.TUTORIAL_COMPLETE) {
    stageHudEl.classList.add('hidden');
    setObjective('Tutorial Complete — Ready for Ongoing Operations');
    setCaptainDialogue(
      'Your company is officially operational! Click Continue Operations to keep exploring, diving, mining, and protecting the ocean.'
    );
    showSummaryModal({ isTutorialComplete: true });
    return;
  }

  // Active Gameplay HUDs (Surface or Underwater)
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
    document.getElementById('hud-sell-box').classList.remove('hidden');

    if (game.tutorialCompleted) {
      setCaptainDialogue(
        'On the surface! Steer the boat with WASD, skim any oil [E], sell ore, or press [F] to Dive to the ocean floor.'
      );
    } else {
      setCaptainDialogue(
        "We've got floating oil slicks on the surface. Steer the boat with WASD and press [E] to skim them, or press [F] to dive!"
      );
    }
  } else if (location === PLAYER_LOCATIONS.UNDERWATER) {
    stageHudEl.classList.remove('hidden');
    if (stage === GAME_STAGES.DIVE_RESTORATION || game.underwaterMode === 'DIVER') {
      diver.root.visible = true;
      diver.root.position.set(
        fleet.crawler.root.position.x + 2.2,
        oceanEnv.getTerrainHeight(fleet.crawler.root.position.x + 2.2, fleet.crawler.root.position.z + 1.5) + 1.5,
        fleet.crawler.root.position.z + 1.5
      );
      document.getElementById('hud-restoration').classList.remove('hidden');
      setCaptainDialogue(
        "Now it's time to repair what we've damaged. Swim with WASD, press [E] to clean & rebuild the coral reef, or press [F] to surface."
      );
    } else {
      diver.root.visible = false;
      document.getElementById('hud-mining').classList.remove('hidden');
      setCaptainDialogue(
        'Underwater on the seabed! Drive to a glowing mineral deposit and press [E] to mine, or press [F] anytime to Return to Surface.'
      );
    }
  }

  updateContextualObjective();
}

// ============================================================================
// 4. MODAL CONTROLLERS (SINGLE-PLAYER SETUP, SETTINGS, RULES, BUDGET)
// ============================================================================
document.getElementById('btn-start-game').addEventListener('click', () => {
  sound.resume();
  const pName = document.getElementById('input-player-name').value;
  const cName = document.getElementById('input-company-name').value;
  game.setCompanyInfo(pName, cName);
});

let chosenCapacity = 35;
document.querySelectorAll('.cap-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cap-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    chosenCapacity = Number(btn.dataset.cap);
    document.getElementById('val-capacity').textContent = `${chosenCapacity} t`;
    const opt = GAME_BALANCE.businessSettings.capacityOptions.find((o) => o.value === chosenCapacity);
    if (opt) document.getElementById('desc-capacity').textContent = opt.consequence;
  });
});

const sliderPrice = document.getElementById('slider-price');
sliderPrice.addEventListener('input', () => {
  document.getElementById('val-price').textContent = `$${Number(sliderPrice.value).toLocaleString()} / t`;
});

const sliderTarget = document.getElementById('slider-target');
sliderTarget.addEventListener('input', () => {
  document.getElementById('val-target').textContent = `${sliderTarget.value} t`;
});

document.getElementById('btn-confirm-settings').addEventListener('click', () => {
  sound.resume();
  game.confirmBusinessSettings(chosenCapacity, sliderPrice.value, sliderTarget.value);
});

// Rule Change Modal
let pendingRuleStage = null;
let pendingRuleOptionId = null;

function openRuleModal(stageKey) {
  const def = RULE_CHANGES[stageKey];
  if (!def) return;
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
  game.enactRuleChange(pendingRuleStage, pendingRuleOptionId);
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
      <button class="btn-primary">Approve ${t.label}</button>
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
// 5. RESTORATION MINI-GAMES UI
// ============================================================================
function openCleanReefModal() {
  document.getElementById('mg-badge').textContent = 'MINI-GAME A — CLEAN THE REEF';
  document.getElementById('mg-title').textContent = 'Scrub Sediment Off the Coral';
  document.getElementById('mg-desc').textContent =
    'Click and drag across the dark sediment patches to clean the coral reef underneath.';
  document.getElementById('mg-clean-view').classList.remove('hidden');
  document.getElementById('mg-puzzle-view').classList.add('hidden');
  document.getElementById('modal-restoration-minigame').classList.remove('hidden');
  miniGames.initCleanReefGame(document.getElementById('clean-reef-canvas'));
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
  const { connected, visited } = miniGames.isWaterPathConnected();
  const gridEl = document.getElementById('puzzle-grid');
  gridEl.innerHTML = '';

  miniGames.grid.forEach((tile, idx) => {
    const btn = document.createElement('button');
    btn.className = `puzzle-tile ${visited.has(idx) ? 'powered' : ''}`;
    btn.innerHTML = drawTileSvg(tile, visited.has(idx));
    btn.addEventListener('click', () => {
      miniGames.rotateTile(idx);
      renderWaterPuzzle();
    });
    gridEl.appendChild(btn);
  });

  if (connected) {
    document.getElementById('r-puzzle-status').textContent = 'Connected ✓';
    document.getElementById('coral-placement-section').classList.remove('hidden');
  }
}

function openWaterPuzzleModal() {
  document.getElementById('mg-badge').textContent = 'MINI-GAME B — REBUILD THE REEF';
  document.getElementById('mg-title').textContent = 'Water-Flow Logic Puzzle & Coral Placement';
  document.getElementById('mg-desc').textContent =
    'Rotate the coral-support channels to connect Fresh Current Inlet (top-left) to Coral Nursery Outlet (bottom-right).';
  document.getElementById('mg-clean-view').classList.add('hidden');
  document.getElementById('mg-puzzle-view').classList.remove('hidden');
  document.getElementById('coral-placement-section').classList.add('hidden');

  const clues = game.restorationSupplies.puzzleClues;
  document.getElementById('puzzle-clue-box').textContent =
    clues >= 2
      ? 'Marine Advisory Clue: Route the current from Top-Left → Top-Center → Center → Bottom-Center → Bottom-Right.'
      : 'Marine Advisory Clue: Start by connecting the Top-Left tile horizontally to the center column.';

  miniGames.initWaterFlowPuzzle();
  // Reset coral slot buttons for repeatable restoration
  document.querySelectorAll('.coral-slot-btn').forEach((btn, idx) => {
    btn.classList.remove('planted');
    btn.textContent = `🪸 Plant Coral ${idx + 1}`;
  });
  renderWaterPuzzle();
  document.getElementById('modal-restoration-minigame').classList.remove('hidden');
}

document.getElementById('btn-open-clean-reef').addEventListener('click', openCleanReefModal);
document.getElementById('btn-open-reef-underwater').addEventListener('click', openCleanReefModal);
document.getElementById('btn-proceed-puzzle').addEventListener('click', () => {
  document.getElementById('btn-open-puzzle').classList.remove('hidden');
  openWaterPuzzleModal();
});
document.getElementById('btn-open-puzzle').addEventListener('click', openWaterPuzzleModal);

document.querySelectorAll('.coral-slot-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('planted')) return;
    btn.classList.add('planted');
    btn.textContent = '🪸 Coral Planted ✓';
    miniGames.coralsPlaced++;
    sound.playRestorationChime();
    if (miniGames.coralsPlaced >= miniGames.coralsRequired) {
      setTimeout(() => {
        document.getElementById('modal-restoration-minigame').classList.add('hidden');
        game.completePuzzleAndCoralPlacement();
      }, 450);
    }
  });
});

// ============================================================================
// 6. TUTORIAL COMPLETE, ONGOING SUMMARY & DEFEAT MODAL
// ============================================================================
function showSummaryModal({ isDefeat = false, reason = '', isTutorialComplete = false } = {}) {
  hideAllModals();
  const res = game.evaluateCampaignEnding();
  const badgeEl = document.getElementById('end-badge');
  const titleEl = document.getElementById('end-title');
  const quoteEl = document.getElementById('end-quote');
  const gridEl = document.getElementById('end-summary-grid');
  const continueBtn = document.getElementById('btn-continue-operations');
  const charBtn = document.getElementById('btn-open-constitution');

  if (isDefeat) {
    badgeEl.textContent = `CAMPAIGN DEFEAT — ${reason}`;
    badgeEl.className = 'modal-badge badge-amber';
    titleEl.textContent = reason === 'BANKRUPTCY' ? 'COMPANY BANKRUPTCY' : 'ECOLOGICAL COLLAPSE';
    quoteEl.textContent =
      reason === 'BANKRUPTCY'
        ? 'Your company ran out of credits to sustain operations and environmental restoration.'
        : 'Ocean health fell below critical survival thresholds.';
    continueBtn.classList.add('hidden');
    charBtn.classList.remove('hidden');
  } else if (isTutorialComplete) {
    badgeEl.textContent = 'TUTORIAL COMPLETE — ONGOING OPERATIONS UNLOCKED';
    badgeEl.className = 'modal-badge badge-green';
    titleEl.textContent = 'TUTORIAL COMPLETE!';
    quoteEl.textContent =
      '"Your company is officially operational. The ocean is still waiting to be explored."';
    continueBtn.classList.remove('hidden');
    charBtn.classList.add('hidden');
  } else {
    badgeEl.textContent = res.badge;
    badgeEl.className = `modal-badge ${res.badgeClass}`;
    titleEl.textContent = `ABYSS INC. — ${res.title}`;
    quoteEl.textContent =
      '"Your company is active. Continue diving, mining remaining deposits, and protecting the reef."';
    continueBtn.classList.remove('hidden');
    charBtn.classList.add('hidden');
  }

  gridEl.innerHTML = `
    <div class="summary-item"><span>Company</span><strong>${res.companyName} (${res.playerName})</strong></div>
    <div class="summary-item"><span>Ore Extracted / Target</span><strong>${res.totalTonsMined}t / ${res.extractionTarget}t ${res.targetMet ? '✓' : 'In Progress'}</strong></div>
    <div class="summary-item"><span>Company Credits</span><strong>${formatCash(res.credits)}</strong></div>
    <div class="summary-item"><span>Surface Oil Cleaned</span><strong>${res.surfacePollutionCollected} / ${res.surfacePollutionTotal}</strong></div>
    <div class="summary-item"><span>Reef Restored & Health</span><strong>${res.reefRestored ? 'Yes ✓' : 'In Progress'} (${res.oceanHealth}%)</strong></div>
    <div class="summary-item"><span>Rule 1 & Rule 2</span><strong>${res.rule1} / ${res.rule2}</strong></div>
  `;

  document.getElementById('modal-ending').classList.remove('hidden');
}

// Continue Operations does NOT reset the game!
document.getElementById('btn-continue-operations').addEventListener('click', () => {
  sound.resume();
  document.getElementById('modal-ending').classList.add('hidden');
  game.continueOperations();
});

// Explicit Replay Tutorial / Main Menu buttons (require player click)
document.getElementById('btn-replay-tutorial').addEventListener('click', () => {
  window.location.reload();
});
document.getElementById('btn-return-main-menu').addEventListener('click', () => {
  window.location.reload();
});

// Optional Between-Run Constitution Modal
function openCharterModal() {
  const charter = ConstitutionPersistence.loadCharter();
  const listEl = document.getElementById('charter-options-list');
  listEl.innerHTML = '';
  const selected = new Set(charter.activePermanentAmendments || []);

  GAME_BALANCE.constitutionOptions.forEach((opt) => {
    const card = document.createElement('div');
    card.className = `rule-option-card ${selected.has(opt.id) ? 'selected' : ''}`;
    card.innerHTML = `
      <h3>${opt.title}</h3>
      <p class="rule-effect">${opt.shortTitle}</p>
      <p class="modal-desc">${opt.desc}</p>
    `;
    card.addEventListener('click', () => {
      if (selected.has(opt.id)) {
        selected.delete(opt.id);
      } else if (selected.size < 2) {
        selected.add(opt.id);
      }
      card.classList.toggle('selected', selected.has(opt.id));
    });
    listEl.appendChild(card);
  });

  document.getElementById('btn-save-charter').onclick = () => {
    ConstitutionPersistence.ratifyNewCharter(Array.from(selected), GAME_BALANCE.constitutionOptions, 'Manual Charter');
    document.getElementById('modal-constitution').classList.add('hidden');
  };
  document.getElementById('btn-reset-charter').onclick = () => {
    ConstitutionPersistence.resetCharter();
    openCharterModal();
  };

  document.getElementById('modal-constitution').classList.remove('hidden');
}

document.getElementById('btn-view-charter').addEventListener('click', openCharterModal);
document.getElementById('btn-open-constitution').addEventListener('click', openCharterModal);

// ============================================================================
// 7. SINGLE-PLAYER INPUT & REPEATABLE NAVIGATION ([F] DIVE / SURFACE)
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
    if (game.stage === GAME_STAGES.DIVE_RESTORATION || game.underwaterMode === 'DIVER') {
      if (game.reefCleanProgress < 90) {
        openCleanReefModal();
      } else {
        openWaterPuzzleModal();
      }
      return;
    }

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
      spawnWorldPopup(fleet.crawler.root.position, `Offloaded ${off}t Ore to Boat!`, 'popup-gold');
    } else {
      game.returnToSurface();
    }
  } else if (game.location === PLAYER_LOCATIONS.SURFACE) {
    if (game.surfaceTankFill > 0) {
      game.surfaceTankFill = 0;
      sound.playRestorationChime();
      spawnWorldPopup(fleet.surfaceVessel.group.position, 'Collection Tank Emptied!', 'popup-green');
    }
  }
}

function skimNearestOilSlick() {
  const vesselPos = fleet.surfaceVessel.group.position;
  const patch = surfaceOcean.oilPatches.find(
    (p) => !p.cleaned && Math.hypot(p.x - vesselPos.x, p.z - vesselPos.z) < 8.2
  );
  if (!patch) {
    spawnWorldPopup(vesselPos, 'Steer closer to a floating oil slick!', 'popup-gold');
    return;
  }
  if (game.surfaceTankFill >= game.surfaceTankCapacity) {
    spawnWorldPopup(vesselPos, 'Tank full! Press [R] to Empty Tank.', 'popup-gold');
    return;
  }

  // Progressive oil collection
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

// Repeatable Dive / Surface button bindings
document.getElementById('btn-dive-from-surface').addEventListener('click', () => {
  sound.resume();
  game.diveToOceanFloor(false);
});
document.getElementById('btn-surface-from-mining').addEventListener('click', () => {
  sound.resume();
  game.returnToSurface();
});
document.getElementById('btn-surface-from-restoration').addEventListener('click', () => {
  sound.resume();
  game.returnToSurface();
});

document.getElementById('btn-sell-ore').addEventListener('click', () => {
  const res = game.sellStockpileOre();
  const msgEl = document.getElementById('s-status-msg');
  if (!res.ok) {
    msgEl.textContent = res.error;
  } else {
    msgEl.textContent = `Sold ${res.tons}t for ${formatCash(res.totalPayout)}! ${res.buyerNote}`;
    updateContextualObjective();
  }
});

document.getElementById('btn-up-hopper').addEventListener('click', () => {
  const res = game.purchaseUpgrade('hopper');
  document.getElementById('s-status-msg').textContent = res.ok ? res.label : res.error;
});
document.getElementById('btn-up-drill').addEventListener('click', () => {
  const res = game.purchaseUpgrade('drill');
  document.getElementById('s-status-msg').textContent = res.ok ? res.label : res.error;
});

document.getElementById('btn-mute').addEventListener('click', () => {
  const muted = sound.toggleMute();
  document.getElementById('btn-mute').textContent = muted ? '🔇' : '🔊';
});
document.getElementById('btn-help').addEventListener('click', () => {
  document.getElementById('modal-help').classList.remove('hidden');
});
document.getElementById('btn-close-help').addEventListener('click', () => {
  document.getElementById('modal-help').classList.add('hidden');
});
document.getElementById('btn-help-summary').addEventListener('click', () => {
  document.getElementById('modal-help').classList.add('hidden');
  showSummaryModal({ isDefeat: false, isTutorialComplete: false });
});

// ============================================================================
// 8. MAIN ANIMATION LOOP & CAMERA TRANSITIONS
// ============================================================================
const clock = new THREE.Clock();

function refreshStageHUD() {
  const health = game.getGlobalOceanHealth();
  if (game.location === PLAYER_LOCATIONS.UNDERWATER) {
    document.getElementById('m-credits').textContent = formatCash(game.credits);
    document.getElementById('m-hold').textContent = `${Math.round(game.oreInHold)} / ${game.businessSettings.machineCapacity} t`;
    document.getElementById('m-extracted').textContent = `${Math.round(game.totalTonsMined)} / ${game.businessSettings.extractionTarget} t`;
    document.getElementById('m-reserves').textContent = `${game.getTotalRemainingSeabedOre()} t`;
    document.getElementById('m-health').textContent = `${health}%`;
    document.getElementById('m-prompt').textContent = game.nearestDeposit
      ? `[E] ${game.isMiningActive ? 'Stop Mining' : 'Mine'} ${game.nearestDeposit.name} • [F] Surface`
      : 'Drive with WASD to a glowing deposit • Press [F] to Surface';

    document.getElementById('r-credits').textContent = formatCash(game.credits);
    document.getElementById('r-clean-pct').textContent = `${game.reefCleanProgress}%`;
    document.getElementById('r-health').textContent = `${health}%`;
  } else if (game.location === PLAYER_LOCATIONS.SURFACE) {
    document.getElementById('c-credits').textContent = formatCash(game.credits);
    document.getElementById('c-cleaned').textContent = `${game.surfacePollutionCollected} / ${game.surfacePollutionTotal}`;
    document.getElementById('c-tank').textContent = `${game.surfaceTankFill} / ${game.surfaceTankCapacity}`;
    document.getElementById('c-stockpile').textContent = `${game.oreStockpile} t`;
    document.getElementById('c-health').textContent = `${health}%`;
    document.getElementById('s-tons').textContent = `${game.oreStockpile} t`;
    document.getElementById('s-rule').textContent = game.rule2Enacted ? game.rule2Enacted.shortTitle : 'Open';
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

function updateDiverControls(dt, elapsed) {
  const fwd =
    (keysDown.has('w') || keysDown.has('arrowup') ? 1 : 0) -
    (keysDown.has('s') || keysDown.has('arrowdown') ? 1 : 0);
  const turn =
    (keysDown.has('d') || keysDown.has('arrowright') ? 1 : 0) -
    (keysDown.has('a') || keysDown.has('arrowleft') ? 1 : 0);
  const vert = (keysDown.has(' ') ? 1 : 0) - (keysDown.has('shift') ? 1 : 0);

  const isMoving = Math.abs(fwd) > 0.01 || Math.abs(turn) > 0.01 || Math.abs(vert) > 0.01;
  if (isMoving) {
    diver.root.rotation.y -= turn * diver.turnSpeed * dt;
    const fVec = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), diver.root.rotation.y);
    const nx = Math.max(-24, Math.min(24, diver.root.position.x + fVec.x * fwd * diver.speed * dt));
    const nz = Math.max(-24, Math.min(24, diver.root.position.z + fVec.z * fwd * diver.speed * dt));
    const minH = oceanEnv.getTerrainHeight(nx, nz) + 0.8;
    const ny = Math.max(minH, Math.min(18, diver.root.position.y + vert * 4.5 * dt));
    diver.root.position.set(nx, ny, nz);
  }
  diver.animate(elapsed, isMoving, false);
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
    if (game.stage === GAME_STAGES.DIVE_RESTORATION || game.underwaterMode === 'DIVER') {
      updateDiverControls(dt, elapsed);
      camRig.desiredTarget.copy(diver.root.position);
      camRig.desiredPos.copy(diver.root.position).add(new THREE.Vector3(7, 5, 9));
    } else {
      camRig.desiredTarget.copy(fleet.crawler.root.position).add(new THREE.Vector3(0, 1, 0));
      camRig.desiredPos.copy(fleet.crawler.root.position).add(new THREE.Vector3(11, 10, 14));
    }
  } else {
    // Surface location: keep crawler parked on boat deck and follow boat
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
