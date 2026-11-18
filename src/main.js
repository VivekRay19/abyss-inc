import * as THREE from 'three';
import { SoundManager } from './audio/SoundManager.js';
import { OceanEnvironment } from './world/OceanEnvironment.js';
import { EcosystemManager } from './world/EcosystemManager.js';
import { MiningFleetManager } from './machines/MiningMachines.js';
import { SurfaceOceanManager, HumanDiver } from './world/SurfaceAndDiver.js';
import { GameController, RULE_CHANGES } from './game/GameState.js';
import { GAME_BALANCE, GAME_STAGES, PLAYER_LOCATIONS } from './game/GameConfig.js';
import { RestorationMiniGames } from './ui/RestorationMiniGames.js';
import { coopManager, ROLES, ROLE_LABELS } from './multiplayer/CoopManager.js';

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
  const vesselGroup = fleet.surfaceVessel.group;
  const vesselPos = vesselGroup.position;
  fleet.crawler.root.position.set(vesselPos.x, vesselPos.y + 1.25, vesselPos.z - 2.2);
  fleet.crawler.root.rotation.set(vesselGroup.rotation.x, Math.PI, vesselGroup.rotation.z);
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

let welcomeExpeditionStarted = false;
let surfaceIntroStep = 0;

const SURFACE_INTRO_STEPS = [
  {
    screen: 3,
    showBriefingPills: false,
    showStartMiningBtn: false,
    objective: 'Welcome Aboard — Meet Captain Harlin on the Ocean Surface',
    dialogue: "Welcome aboard! I'm Captain Harlin."
  },
  {
    screen: 3,
    showBriefingPills: false,
    showStartMiningBtn: false,
    objective: 'Welcome Aboard — Meet Captain Harlin on the Ocean Surface',
    dialogue:
      "Your mining company is ready. We'll explore the ocean floor, extract valuable minerals and build our business."
  },
  {
    screen: 4,
    showBriefingPills: true,
    showStartMiningBtn: false,
    objective: 'Expedition Briefing — Review Operations with Captain Harlin',
    dialogue: 'Your job is simple. Find the mineral deposits and extract the ore.'
  },
  {
    screen: 4,
    showBriefingPills: true,
    showStartMiningBtn: false,
    objective: 'Expedition Briefing — Review Operations with Captain Harlin',
    dialogue: 'Just remember, every mining operation affects the ocean.'
  },
  {
    screen: 4,
    showBriefingPills: true,
    showStartMiningBtn: false,
    objective: 'Expedition Briefing — Review Operations with Captain Harlin',
    dialogue:
      'You can change up to two business rules during your campaign, but you cannot change the laws of nature.'
  },
  {
    screen: 5,
    showBriefingPills: true,
    showStartMiningBtn: true,
    objective: "Ready for Deployment — Click Let's Start Mining",
    dialogue: "Everything is ready. Let's get our first mining operation started!"
  }
];

function renderSurfaceIntroStep() {
  const stepData =
    SURFACE_INTRO_STEPS[Math.min(surfaceIntroStep, SURFACE_INTRO_STEPS.length - 1)];
  const overlayEl = document.getElementById('surface-briefing-overlay');
  const pillsEl = document.getElementById('surface-briefing-strip');
  const startWrapEl = document.getElementById('start-mining-action-wrap');
  const continueBtnEl = document.getElementById('btn-captain-continue');

  if (overlayEl) {
    overlayEl.classList.toggle(
      'hidden',
      !(stepData.showBriefingPills || stepData.showStartMiningBtn)
    );
  }
  if (pillsEl) {
    pillsEl.classList.toggle('hidden', !stepData.showBriefingPills);
  }
  if (startWrapEl) {
    startWrapEl.classList.toggle('hidden', !stepData.showStartMiningBtn);
  }
  if (continueBtnEl) {
    continueBtnEl.classList.toggle('hidden', stepData.showStartMiningBtn);
  }

  captainCardEl.classList.add('centered-intro');
  setObjective(stepData.objective);
  setCaptainDialogue(stepData.dialogue, true);
}

function hideSurfaceIntroSequenceUI() {
  const overlayEl = document.getElementById('surface-briefing-overlay');
  const continueBtnEl = document.getElementById('btn-captain-continue');
  if (overlayEl) overlayEl.classList.add('hidden');
  if (continueBtnEl) continueBtnEl.classList.add('hidden');
  captainCardEl.classList.remove('centered-intro');
}

function handleStageTransition(stage, location) {
  hideAllModals();
  hideSurfaceIntroSequenceUI();
  document.getElementById('hud-mining').classList.add('hidden');
  document.getElementById('hud-cleanup').classList.add('hidden');

  if (stage === GAME_STAGES.SURFACE_INTRO) {
    stageHudEl.classList.add('hidden');
    const welcomeEl = document.getElementById('welcome-screen');
    if (welcomeEl && !welcomeExpeditionStarted) {
      welcomeEl.classList.remove('hidden', 'fade-out');
      document.getElementById('modal-intro').classList.add('hidden');
    } else {
      if (welcomeEl) welcomeEl.classList.add('hidden');
      document.getElementById('modal-intro').classList.remove('hidden');
    }
    setObjective('Configure starting parameters & launch your company');
    setCaptainDialogue('', false);
    return;
  }

  document.getElementById('hud-company-label').textContent = `${game.companyName} • ${game.playerName}`;

  if (stage === GAME_STAGES.SURFACE_WELCOME) {
    stageHudEl.classList.add('hidden');
    diver.root.visible = false;
    placeCrawlerOnBoatDeck();
    surfaceIntroStep = 0;
    renderSurfaceIntroStep();
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
        ? "Everything is ready. Let's get our first mining operation started!"
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
// 4. SCREEN 1 (TITLE) -> SCREEN 2 (PARAMETERS) -> SCREENS 3-5 (SURFACE BRIEFING)
// ============================================================================
const welcomeScreenEl = document.getElementById('welcome-screen');
const btnStartExpedition = document.getElementById('btn-start-expedition');
const ambientCanvas = document.getElementById('welcome-ambient-canvas');

// Peaceful ambient underwater particles & rising bubbles for Screen 1
const ambientParticles = [];
if (ambientCanvas) {
  for (let i = 0; i < 38; i++) {
    const isBubble = i < 16;
    ambientParticles.push({
      x: Math.random(),
      y: Math.random(),
      r: isBubble ? 2.2 + Math.random() * 4.2 : 1.1 + Math.random() * 1.8,
      speedY: isBubble ? 0.018 + Math.random() * 0.026 : 0.004 + Math.random() * 0.009,
      driftX: (Math.random() - 0.5) * 0.008,
      phase: Math.random() * Math.PI * 2,
      alpha: isBubble ? 0.22 + Math.random() * 0.32 : 0.18 + Math.random() * 0.28,
      isBubble
    });
  }
}

function updateWelcomeAmbientCanvas(dt, elapsed) {
  if (!ambientCanvas || welcomeExpeditionStarted) return;
  const w = window.innerWidth || 1280;
  const h = window.innerHeight || 720;
  if (ambientCanvas.width !== w || ambientCanvas.height !== h) {
    ambientCanvas.width = w;
    ambientCanvas.height = h;
  }
  const ctx = ambientCanvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);

  for (const p of ambientParticles) {
    p.y -= p.speedY * dt;
    p.x += Math.sin(elapsed * 0.9 + p.phase) * 0.00025 + p.driftX * dt;
    if (p.y < -0.04) {
      p.y = 1.04;
      p.x = Math.random();
    }
    if (p.x < -0.02) p.x = 1.02;
    if (p.x > 1.02) p.x = -0.02;

    const px = p.x * w;
    const py = p.y * h;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, p.r, 0, Math.PI * 2);
    if (p.isBubble) {
      ctx.strokeStyle = `rgba(180, 248, 255, ${p.alpha})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = `rgba(150, 240, 255, ${p.alpha * 0.28})`;
      ctx.fill();
    } else {
      ctx.fillStyle = `rgba(195, 250, 255, ${p.alpha})`;
      ctx.fill();
    }
    ctx.restore();
  }
}

// ============================================================================
// COOPERATIVE MULTIPLAYER UI & FLOW
// ============================================================================
const modalCoopLobby = document.getElementById('modal-coop-lobby');
const btnOpenCoopModal = document.getElementById('btn-open-coop-modal');
const btnCloseCoopLobby = document.getElementById('btn-close-coop-lobby');
const coopStepChoice = document.getElementById('coop-step-choice');
const coopStepCreate = document.getElementById('coop-step-create');
const coopStepJoin = document.getElementById('coop-step-join');
const coopStepWaiting = document.getElementById('coop-step-waiting');

const btnCoopGotoCreate = document.getElementById('btn-coop-goto-create');
const btnCoopGotoJoin = document.getElementById('btn-coop-goto-join');
const btnCoopBackFromCreate = document.getElementById('btn-coop-back-from-create');
const btnCoopBackFromJoin = document.getElementById('btn-coop-back-from-join');
const btnCoopSubmitCreate = document.getElementById('btn-coop-submit-create');
const btnCoopSubmitJoin = document.getElementById('btn-coop-submit-join');
const btnCopyRoomCode = document.getElementById('btn-copy-room-code');
const btnCoopLeaveRoom = document.getElementById('btn-coop-leave-room');
const btnCoopStartExpedition = document.getElementById('btn-coop-start-expedition');

function showCoopStep(stepName) {
  if (coopStepChoice) coopStepChoice.classList.toggle('hidden', stepName !== 'choice');
  if (coopStepCreate) coopStepCreate.classList.toggle('hidden', stepName !== 'create');
  if (coopStepJoin) coopStepJoin.classList.toggle('hidden', stepName !== 'join');
  if (coopStepWaiting) coopStepWaiting.classList.toggle('hidden', stepName !== 'waiting');
}

if (btnOpenCoopModal) {
  btnOpenCoopModal.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[ABYSS INC.] Cooperative Play (2P) clicked');
    sound.resume();
    sound.playSonarPing(680);
    showCoopStep('choice');
    if (modalCoopLobby) {
      modalCoopLobby.classList.remove('hidden');
    }
  });
}

if (btnCloseCoopLobby) {
  btnCloseCoopLobby.addEventListener('click', () => {
    if (coopManager.isCoopMode) coopManager.leaveExpedition();
    if (modalCoopLobby) modalCoopLobby.classList.add('hidden');
  });
}

if (btnCoopGotoCreate) {
  btnCoopGotoCreate.addEventListener('click', () => {
    showCoopStep('create');
  });
}

if (btnCoopGotoJoin) {
  btnCoopGotoJoin.addEventListener('click', () => {
    document.getElementById('coop-join-error').classList.add('hidden');
    showCoopStep('join');
  });
}

if (btnCoopBackFromCreate) btnCoopBackFromCreate.addEventListener('click', () => showCoopStep('choice'));
if (btnCoopBackFromJoin) btnCoopBackFromJoin.addEventListener('click', () => showCoopStep('choice'));

if (btnCopyRoomCode) {
  btnCopyRoomCode.addEventListener('click', () => {
    if (coopManager.roomCode) {
      navigator.clipboard.writeText(coopManager.roomCode);
      const fb = document.getElementById('coop-copy-feedback');
      if (fb) {
        fb.classList.remove('hidden');
        setTimeout(() => fb.classList.add('hidden'), 2000);
      }
    }
  });
}

if (btnCoopLeaveRoom) {
  btnCoopLeaveRoom.addEventListener('click', () => {
    coopManager.leaveExpedition();
    showCoopStep('choice');
  });
}

if (btnCoopSubmitCreate) {
  btnCoopSubmitCreate.addEventListener('click', async () => {
    const pName = document.getElementById('input-coop-host-name').value || 'Alex';
    const cName = document.getElementById('input-coop-company-name').value || 'DeepBlue Co.';
    btnCoopSubmitCreate.disabled = true;
    btnCoopSubmitCreate.textContent = 'Creating Room...';

    const res = await coopManager.createExpedition({
      playerName: pName,
      companyName: cName,
      startingParameters: {
        machineCapacity: chosenCapacity,
        workshopCapacity: chosenWorkshopCap,
        oreSellingPrice: Number(sliderPrice.value),
        extractionTarget: Number(sliderTarget.value)
      }
    });

    btnCoopSubmitCreate.disabled = false;
    btnCoopSubmitCreate.textContent = 'Generate Room Code →';

    if (res.success) {
      document.getElementById('coop-display-room-code').textContent = res.roomCode;
      document.getElementById('roster-p1-name').textContent = pName;
      showCoopStep('waiting');
    }
  });
}

if (btnCoopSubmitJoin) {
  btnCoopSubmitJoin.addEventListener('click', async () => {
    const pName = document.getElementById('input-coop-join-name').value || 'Dr. Morgan';
    const rCode = document.getElementById('input-coop-room-code').value || '';
    const errEl = document.getElementById('coop-join-error');
    errEl.classList.add('hidden');

    if (!rCode.trim()) {
      errEl.textContent = 'Please enter a valid room code.';
      errEl.classList.remove('hidden');
      return;
    }

    btnCoopSubmitJoin.disabled = true;
    btnCoopSubmitJoin.textContent = 'Joining Room...';

    const res = await coopManager.joinExpedition({
      roomCode: rCode,
      playerName: pName
    });

    btnCoopSubmitJoin.disabled = false;
    btnCoopSubmitJoin.textContent = 'Join Expedition →';

    if (res.success) {
      document.getElementById('coop-display-room-code').textContent = res.roomCode;
      document.getElementById('roster-p2-name').textContent = pName;
      document.getElementById('roster-p2-status').textContent = '● Connected (Ready)';
      document.getElementById('roster-p2-status').className = 'roster-status val-green';
      showCoopStep('waiting');
    } else {
      errEl.textContent = res.error || 'Failed to join expedition.';
      errEl.classList.remove('hidden');
    }
  });
}

// Presence and Roster UI update
coopManager.onPresenceUpdate(({ self, peer, isRoomReady }) => {
  const p1NameEl = document.getElementById('roster-p1-name');
  const p2NameEl = document.getElementById('roster-p2-name');
  const p2StatusEl = document.getElementById('roster-p2-status');
  const startBtn = document.getElementById('btn-coop-start-expedition');
  const coopPill = document.getElementById('hud-coop-pill');
  const coopRoleEl = document.getElementById('hud-coop-role');
  const coopPeerEl = document.getElementById('hud-coop-peer');

  if (coopManager.isHost) {
    if (p1NameEl) p1NameEl.textContent = `${self.name} (You)`;
    if (peer) {
      if (p2NameEl) p2NameEl.textContent = peer.name;
      if (p2StatusEl) {
        p2StatusEl.textContent = '● Connected (Ready)';
        p2StatusEl.className = 'roster-status val-green';
      }
      if (startBtn) startBtn.classList.remove('hidden');
    } else {
      if (p2NameEl) p2NameEl.textContent = 'Waiting for Scientist...';
      if (p2StatusEl) {
        p2StatusEl.textContent = '○ Waiting to Join...';
        p2StatusEl.className = 'roster-status val-gold';
      }
      if (startBtn) startBtn.classList.add('hidden');
    }
  } else {
    // Marine Scientist view
    if (peer && p1NameEl) p1NameEl.textContent = `${peer.name} (Host)`;
    if (p2NameEl) p2NameEl.textContent = `${self.name} (You)`;
    if (p2StatusEl) {
      p2StatusEl.textContent = '● Connected (Ready)';
      p2StatusEl.className = 'roster-status val-green';
    }
    if (startBtn) startBtn.classList.add('hidden'); // only host clicks start
  }

  // Update In-Game HUD pill if active
  if (coopManager.isCoopMode) {
    coopPill.classList.remove('hidden');
    coopRoleEl.textContent = ROLE_LABELS[coopManager.myRole] || 'Crew';
    coopPeerEl.textContent = peer ? `Crew: ${peer.name} (●)` : 'Crew: Reconnecting... (○)';
  } else {
    coopPill.classList.add('hidden');
  }
});

coopManager.onStatusMessage((msg, type) => {
  const logEl = document.getElementById('coop-status-log');
  if (logEl) {
    logEl.textContent = msg;
    logEl.className = `hud-subnote val-${type === 'error' ? 'amber' : type === 'success' ? 'green' : 'cyan'}`;
  }
});

// Host initiates expedition for both players
if (btnCoopStartExpedition) {
  btnCoopStartExpedition.addEventListener('click', () => {
    sound.resume();
    sound.playSonarPing(720);
    modalCoopLobby.classList.add('hidden');
    welcomeExpeditionStarted = true;
    welcomeScreenEl.classList.add('fade-out');

    // Host opens Starting Parameters Modal to configure or confirm
    const introModal = document.getElementById('modal-intro');
    if (introModal) introModal.classList.remove('hidden');

    coopManager.sendAction('HOST_OPEN_PARAMS', {});
    setTimeout(() => welcomeScreenEl.classList.add('hidden'), 500);
  });
}

// Remote Action Handlers for Synchronized Multiplayer
coopManager.onRemoteAction((action, data) => {
  if (action === 'HOST_OPEN_PARAMS') {
    modalCoopLobby.classList.add('hidden');
    welcomeExpeditionStarted = true;
    welcomeScreenEl.classList.add('fade-out');
    const introModal = document.getElementById('modal-intro');
    if (introModal) {
      introModal.classList.remove('hidden');
      document.getElementById('btn-start-game').textContent = 'Waiting for Host to Launch...';
      document.getElementById('btn-start-game').disabled = true;
    }
    setTimeout(() => welcomeScreenEl.classList.add('hidden'), 500);
  } else if (action === 'START_COOP_GAME') {
    hideAllModals();
    game.startGameWithParameters({
      playerName: data.playerName,
      companyName: data.companyName,
      machineCapacity: data.machineCapacity,
      workshopCapacity: data.workshopCapacity,
      oreSellingPrice: data.oreSellingPrice,
      extractionTarget: data.extractionTarget,
      deferDive: true
    });
    refreshStageHUD();
  } else if (action === 'SYNC_SURFACE_STEP') {
    surfaceIntroStep = data.step;
    renderSurfaceIntroStep();
  } else if (action === 'DIVE_TO_FLOOR') {
    hideSurfaceIntroSequenceUI();
    game.diveToOceanFloor(false);
  } else if (action === 'RETURN_SURFACE') {
    game.returnToSurface();
  } else if (action === 'MINE_TOGGLE') {
    game.isMiningActive = data.isMiningActive;
  } else if (action === 'MINE_ORE_EVENT') {
    game.totalTonsMined = data.totalTonsMined;
    game.oreInHold = data.oreInHold;
    if (game.nearestDeposit && data.depositRemaining !== undefined) {
      game.nearestDeposit.remainingTons = data.depositRemaining;
    }
    refreshStageHUD();
  } else if (action === 'CLEAN_OIL_SLICK') {
    const patch = surfaceOcean.oilPatches[data.patchIndex];
    if (patch) {
      patch.cleaned = true;
      if (patch.group) patch.group.visible = false;
    }
    game.surfacePollutionCollected = data.surfacePollutionCollected;
    game.surfaceTankFill = data.surfaceTankFill;
    refreshStageHUD();
    updateContextualObjective();
  } else if (action === 'SELL_ORE') {
    game.credits = data.credits;
    game.oreStockpile = data.oreStockpile;
    game.totalTonsSold = data.totalTonsSold;
    refreshStageHUD();
    updateContextualObjective();
  } else if (action === 'RULE_RECOMMENDATION') {
    const advEl = document.getElementById('rule-coop-advisory');
    const advText = document.getElementById('rule-coop-advisory-text');
    if (advEl && advText) {
      advEl.classList.remove('hidden');
      advText.textContent = `Marine Scientist recommends: ${data.recommendation}`;
    }
  } else if (action === 'RULE_ENACTED') {
    if (document.getElementById('modal-rule-change')) {
      document.getElementById('modal-rule-change').classList.add('hidden');
    }
    game.enactRuleChange(data.stageKey, data.optionId);
    updateRuleStatusBadges();
  } else if (action === 'PUZZLE_ROTATE_TILE') {
    miniGames.rotateTile(data.tileIndex);
    renderWaterPuzzle();
  } else if (action === 'CORAL_PLANTED') {
    miniGames.plantedSlots.add(data.slotIdx);
    miniGames.coralsPlaced = miniGames.plantedSlots.size;
    renderWaterPuzzle();
    if (miniGames.coralsPlaced >= miniGames.coralsRequired) {
      const completedOutcome = miniGames.currentVariation?.outcome || null;
      setTimeout(() => {
        document.getElementById('modal-restoration-minigame').classList.add('hidden');
        miniGames.advanceToNextRestorationCycle();
        game.completePuzzleAndCoralPlacement(completedOutcome);
      }, 400);
    }
  } else if (action === 'STATE_SNAPSHOT') {
    // Reconcile shared metrics
    if (data.credits !== undefined) game.credits = data.credits;
    if (data.totalTonsMined !== undefined) game.totalTonsMined = data.totalTonsMined;
    if (data.oreStockpile !== undefined) game.oreStockpile = data.oreStockpile;
    if (data.oreInHold !== undefined) game.oreInHold = data.oreInHold;
    if (data.reefCleanProgress !== undefined) game.reefCleanProgress = data.reefCleanProgress;
    refreshStageHUD();
  }
});

if (btnStartExpedition && welcomeScreenEl) {
  btnStartExpedition.addEventListener('click', () => {
    sound.resume();
    sound.playSonarPing(720);
    welcomeExpeditionStarted = true;
    welcomeScreenEl.classList.add('fade-out');

    const introModal = document.getElementById('modal-intro');
    const introCard = introModal ? introModal.querySelector('.modal-card') : null;
    if (introModal) {
      introModal.classList.remove('hidden');
      if (introCard) {
        introCard.classList.remove('modal-card-enter');
        void introCard.offsetWidth;
        introCard.classList.add('modal-card-enter');
      }
    }

    setTimeout(() => {
      welcomeScreenEl.classList.add('hidden');
    }, 500);
  });
}

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

  const startConfig = {
    playerName: pName,
    companyName: cName,
    machineCapacity: chosenCapacity,
    workshopCapacity: chosenWorkshopCap,
    oreSellingPrice: priceVal,
    extractionTarget: targetVal,
    deferDive: true
  };

  // Move to Screen 3 (Ocean Surface Welcome Aboard) before deploying underwater
  game.startGameWithParameters(startConfig);
  refreshStageHUD();

  if (coopManager.isCoopMode && coopManager.isHost) {
    coopManager.sendAction('START_COOP_GAME', startConfig);
  }
});

const btnCaptainContinue = document.getElementById('btn-captain-continue');
if (btnCaptainContinue) {
  btnCaptainContinue.addEventListener('click', () => {
    sound.resume();
    if (game.stage !== GAME_STAGES.SURFACE_WELCOME) return;
    if (surfaceIntroStep < SURFACE_INTRO_STEPS.length - 1) {
      surfaceIntroStep++;
      sound.playSonarPing(660);
      renderSurfaceIntroStep();
      if (coopManager.isCoopMode) {
        coopManager.sendAction('SYNC_SURFACE_STEP', { step: surfaceIntroStep });
      }
    }
  });
}

const btnLetsStartMining = document.getElementById('btn-lets-start-mining');
if (btnLetsStartMining) {
  btnLetsStartMining.addEventListener('click', () => {
    sound.resume();
    hideSurfaceIntroSequenceUI();
    game.diveToOceanFloor(false);
    if (coopManager.isCoopMode) {
      coopManager.sendAction('DIVE_TO_FLOOR', {});
    }
  });
}

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

  const advisoryEl = document.getElementById('rule-coop-advisory');
  const scientistBtnWrap = document.getElementById('rule-scientist-buttons');
  if (coopManager.isCoopMode) {
    if (advisoryEl) advisoryEl.classList.remove('hidden');
    if (coopManager.myRole === ROLES.MARINE_SCIENTIST) {
      if (scientistBtnWrap) scientistBtnWrap.classList.remove('hidden');
      confirmBtn.style.display = 'none'; // Operations Director proposes and confirms
    } else {
      if (scientistBtnWrap) scientistBtnWrap.classList.add('hidden');
      confirmBtn.style.display = '';
    }
  } else {
    if (advisoryEl) advisoryEl.classList.add('hidden');
    confirmBtn.style.display = '';
  }

  document.getElementById('modal-rule-change').classList.remove('hidden');
}

const btnAdviseEco = document.getElementById('btn-scientist-advise-eco');
if (btnAdviseEco) {
  btnAdviseEco.addEventListener('click', () => {
    sound.resume();
    const ecoText = pendingRuleStage === 'extraction' ? 'Restoration-First Permit (Eco Protection)' : 'Eco-Certified Green Market';
    document.getElementById('rule-coop-advisory-text').textContent = `You recommended: ${ecoText}`;
    coopManager.sendAction('RULE_RECOMMENDATION', { recommendation: ecoText });
  });
}

const btnAdviseProfit = document.getElementById('btn-scientist-advise-profit');
if (btnAdviseProfit) {
  btnAdviseProfit.addEventListener('click', () => {
    sound.resume();
    const profitText = pendingRuleStage === 'extraction' ? 'Continuous Extraction (Profit Priority)' : 'Open Market (Immediate Sale)';
    document.getElementById('rule-coop-advisory-text').textContent = `You recommended: ${profitText}`;
    coopManager.sendAction('RULE_RECOMMENDATION', { recommendation: profitText });
  });
}

document.getElementById('btn-confirm-rule').addEventListener('click', () => {
  if (!pendingRuleStage || !pendingRuleOptionId) return;
  document.getElementById('modal-rule-change').classList.add('hidden');
  game.enactRuleChange(pendingRuleStage, pendingRuleOptionId);
  if (coopManager.isCoopMode) {
    coopManager.sendAction('RULE_ENACTED', {
      stageKey: pendingRuleStage,
      optionId: pendingRuleOptionId
    });
  }
});

// Allow clicking Rule 1 / Rule 2 badges in the HUD if still Pending
document.getElementById('rule1-badge').addEventListener('click', () => {
  if (game.stage === GAME_STAGES.SURFACE_INTRO || game.stage === GAME_STAGES.SURFACE_WELCOME) return;
  if (!game.rule1Enacted) openRuleModal('extraction');
});
document.getElementById('rule2-badge').addEventListener('click', () => {
  if (game.stage === GAME_STAGES.SURFACE_INTRO || game.stage === GAME_STAGES.SURFACE_WELCOME) return;
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
      if (coopManager.isCoopMode) {
        coopManager.sendAction('PUZZLE_ROTATE_TILE', { tileIndex: idx });
      }
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

    if (coopManager.isCoopMode) {
      coopManager.sendAction('CORAL_PLANTED', { slotIdx });
    }

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
    if (coopManager.isCoopMode) coopManager.sendAction('DIVE_TO_FLOOR', {});
  } else if (game.canReturnToSurface()) {
    game.returnToSurface();
    if (coopManager.isCoopMode) coopManager.sendAction('RETURN_SURFACE', {});
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
      if (coopManager.isCoopMode) {
        coopManager.sendAction('MINE_TOGGLE', { isMiningActive: game.isMiningActive });
      }
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
  if (coopManager.isCoopMode) {
    coopManager.sendAction('CLEAN_OIL_SLICK', {
      patchIndex: surfaceOcean.oilPatches.indexOf(patch),
      surfacePollutionCollected: game.surfacePollutionCollected,
      surfaceTankFill: game.surfaceTankFill
    });
  }

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
    if (coopManager.isCoopMode) {
      coopManager.sendAction('SELL_ORE', {
        credits: game.credits,
        oreStockpile: game.oreStockpile,
        totalTonsSold: game.totalTonsSold
      });
    }
  }
});

function handleSoundMuteToggle() {
  const muted = sound.toggleMute();
  const icon = muted ? '🔇' : '🔊';
  const hudMuteBtn = document.getElementById('btn-mute');
  const welcomeMuteBtn = document.getElementById('btn-welcome-mute');
  if (hudMuteBtn) hudMuteBtn.textContent = icon;
  if (welcomeMuteBtn) welcomeMuteBtn.textContent = icon;
}

document.getElementById('btn-mute').addEventListener('click', handleSoundMuteToggle);
const btnWelcomeMute = document.getElementById('btn-welcome-mute');
if (btnWelcomeMute) {
  btnWelcomeMute.addEventListener('click', handleSoundMuteToggle);
}

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
  const targetZ = game.diveCount === 1 ? vesselPos.z - 5.2 : lastCrawlerSeabedPos.z;
  const landY = oceanEnv.getTerrainHeight(targetX, targetZ);

  if (game.location === PLAYER_LOCATIONS.DIVING) {
    const duration = game.diveCount === 1 ? 4.4 : 2.2;
    const t = Math.min(1, game.stageTimer / duration);

    if (game.diveCount === 1 && t < 0.28) {
      // Phase 1: Crane lifts mining machine off deck and moves it toward stern deployment point
      const p1 = t / 0.28;
      const ease1 = p1 * p1 * (3 - 2 * p1);
      const curX = THREE.MathUtils.lerp(vesselPos.x, targetX, ease1 * 0.45);
      const curZ = THREE.MathUtils.lerp(vesselPos.z - 2.2, targetZ, ease1);
      const curY = THREE.MathUtils.lerp(vesselPos.y + 1.25, vesselPos.y + 2.35, Math.sin(ease1 * Math.PI * 0.5));
      fleet.crawler.root.position.set(curX, curY, curZ);
      fleet.crawler.root.rotation.set(0, Math.PI + ease1 * 0.35, 0);

      if (fleet.surfaceVessel.craneBoom) {
        fleet.surfaceVessel.craneBoom.rotation.y = ease1 * 0.42;
      }
      camRig.desiredTarget.copy(fleet.crawler.root.position).add(new THREE.Vector3(0, 0.8, 0));
      camRig.desiredPos.copy(vesselPos).add(new THREE.Vector3(12, 7.5, -12.5));
    } else {
      // Phase 2: Crane lowers the mining machine into the water and camera follows descent to seabed
      const p2 = game.diveCount === 1 ? (t - 0.28) / 0.72 : t;
      const ease2 = p2 * p2 * (3 - 2 * p2);
      const startX = game.diveCount === 1 ? THREE.MathUtils.lerp(vesselPos.x, targetX, 0.45) : vesselPos.x;
      const startZ = game.diveCount === 1 ? targetZ : vesselPos.z - 2.2;
      const startY = game.diveCount === 1 ? vesselPos.y + 2.35 : vesselPos.y + 1.25;

      const curX = THREE.MathUtils.lerp(startX, targetX, ease2);
      const curZ = THREE.MathUtils.lerp(startZ, targetZ, ease2);
      const curY = THREE.MathUtils.lerp(startY, landY, ease2);
      fleet.crawler.root.position.set(curX, curY, curZ);

      if (fleet.surfaceVessel.craneBoom) {
        fleet.surfaceVessel.craneBoom.rotation.y = Math.sin((1 - ease2 * 0.5) * Math.PI * 0.5) * 0.42;
      }
      camRig.desiredTarget.copy(fleet.crawler.root.position).add(new THREE.Vector3(0, 1, 0));
      camRig.desiredPos.copy(fleet.crawler.root.position).add(new THREE.Vector3(10, 8, 12));
    }

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

  updateWelcomeAmbientCanvas(dt, elapsed);

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
  } else if (game.stage === GAME_STAGES.SURFACE_WELCOME) {
    placeCrawlerOnBoatDeck();
    const vPos = fleet.surfaceVessel.group.position;
    const gentleOrbitX = Math.sin(elapsed * 0.25) * 1.1;
    camRig.desiredTarget.copy(vPos).add(new THREE.Vector3(0, 1.85, -1.2));
    camRig.desiredPos.copy(vPos).add(new THREE.Vector3(11.2 + gentleOrbitX, 5.8, -11.8));
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

  // Periodic State Broadcast in Co-op Mode (Every ~1 second from host)
  if (coopManager.isCoopMode && coopManager.isHost && Math.floor(elapsed) % 2 === 0) {
    coopManager.broadcastStateSnapshot({
      credits: game.credits,
      totalTonsMined: game.totalTonsMined,
      oreStockpile: game.oreStockpile,
      oreInHold: game.oreInHold,
      reefCleanProgress: game.reefCleanProgress,
      stage: game.stage,
      location: game.location
    });
  }

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
