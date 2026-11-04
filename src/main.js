import * as THREE from 'three';
import { SoundManager } from './audio/SoundManager.js';
import { OceanEnvironment } from './world/OceanEnvironment.js';
import { EcosystemManager } from './world/EcosystemManager.js';
import { MiningFleetManager } from './machines/MiningMachines.js';
import { WorldMapSystem, WORLD_ZONES_CONFIG } from './world/WorldMapSystem.js';
import { GameController, RULE_CHANGES } from './game/GameState.js';

// ============================================================================
// 0. CONSTANTS & DOM ELEMENT REFERENCES (INITIALIZED FIRST TO AVOID TDZ)
// ============================================================================
const STATUS_META = {
  ACCESSIBLE: {
    label: 'ACCESSIBLE',
    color: '#55d99a',
    icon: '✓',
    actIcon: '⛏️',
    badgeClass: 'badge-green'
  },
  LOCKED: {
    label: 'LOCKED REGION',
    color: '#ffc83d',
    icon: '🔒',
    actIcon: '🧭',
    badgeClass: 'badge-amber'
  },
  PROTECTED: {
    label: 'PROTECTED — NO MINING',
    color: '#f16f75',
    icon: '🛡️',
    actIcon: '🛡️',
    badgeClass: 'badge-purple'
  },
  RESTORATION: {
    label: 'RESTORATION ZONE',
    color: '#18c8da',
    icon: '🌿',
    actIcon: '🌿',
    badgeClass: 'badge-cyan'
  },
  UNDISCOVERED: {
    label: 'UNDISCOVERED',
    color: '#5c7a8f',
    icon: '?',
    actIcon: '🧭',
    badgeClass: 'badge-cyan'
  }
};

// Distinctive stylized polygon contours (in 0..100 SVG viewBox coordinates) for each of the 7 regions
const ZONE_MAP_POLYGONS = {
  riser_hub: '7,26 21,23 26,35 22,47 10,46 5,36',
  nodule_fields: '33,36 51,33 56,47 51,60 36,61 31,48',
  coral_sanctuary: '7,67 23,64 28,76 23,90 10,89 5,78',
  the_scar: '37,71 54,69 60,81 55,94 40,93 34,82',
  abyssal_trench: '63,36 81,34 86,48 81,61 65,60 61,48',
  vent_gardens: '66,6 85,5 90,17 84,29 68,28 64,16',
  outer_abyss: '72,70 91,68 96,81 91,94 75,93 70,82'
};

const ZONE_ACTIVITY_ICONS = {
  riser_hub: '⚓',
  nodule_fields: '⛏️',
  coral_sanctuary: '🛡️',
  the_scar: '🌿',
  abyssal_trench: '⛏️',
  vent_gardens: '🌋',
  outer_abyss: '🧭'
};

const container = document.getElementById('canvas-container');
const labelsLayer = document.getElementById('world-labels-layer');
const zoneBadgesLayer = document.getElementById('zone-world-badges-layer');
const worldMapModal = document.getElementById('world-map-modal');
const mapSvgEl = document.getElementById('map-connections-svg');
const mapNodesLayerEl = document.getElementById('map-nodes-layer');
const previewCanvas = document.getElementById('machine-preview-canvas');
const pctx = previewCanvas ? previewCanvas.getContext('2d') : null;
const ruleModal = document.getElementById('rule-modal');
const settingsModal = document.getElementById('settings-modal');
const summaryModal = document.getElementById('summary-modal');
const statsDrawer = document.getElementById('expandable-stats-drawer');
const toggleStatsBtn = document.getElementById('btn-toggle-stats');
const toggleMarkersBtn = document.getElementById('btn-toggle-markers');

// ============================================================================
// 1. INITIALIZE RENDERER, SCENE, AND ISOMETRIC / THREE-QUARTER CAMERA
// ============================================================================
function createWebGLRenderer() {
  try {
    return new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e1) {
    return new THREE.WebGLRenderer({ antialias: false });
  }
}

const renderer = createWebGLRenderer();
const initW = Math.max(1, container.clientWidth || window.innerWidth || 1280);
const initH = Math.max(1, container.clientHeight || window.innerHeight || 720);
renderer.setSize(initW, initH);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
container.innerHTML = '';
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(36, initW / initH, 1.0, 240);

const DEFAULT_CAMERA_STATE = {
  target: new THREE.Vector3(-1.5, 0.5, 1.5),
  yaw: 0.54,
  pitch: 0.58,
  distance: 34
};

const camRig = {
  target: DEFAULT_CAMERA_STATE.target.clone(),
  desiredTarget: DEFAULT_CAMERA_STATE.target.clone(),
  yaw: DEFAULT_CAMERA_STATE.yaw,
  desiredYaw: DEFAULT_CAMERA_STATE.yaw,
  pitch: DEFAULT_CAMERA_STATE.pitch,
  desiredPitch: DEFAULT_CAMERA_STATE.pitch,
  distance: DEFAULT_CAMERA_STATE.distance,
  desiredDistance: DEFAULT_CAMERA_STATE.distance,
  followMachine: false
};

function syncCameraTransformImmediate() {
  const horizDist = Math.cos(camRig.pitch) * camRig.distance;
  const vertDist = Math.sin(camRig.pitch) * camRig.distance;
  camera.position.set(
    camRig.target.x + Math.sin(camRig.yaw) * horizDist,
    camRig.target.y + vertDist,
    camRig.target.z + Math.cos(camRig.yaw) * horizDist
  );
  camera.lookAt(camRig.target);
  camera.updateMatrixWorld();
}

syncCameraTransformImmediate();

// ============================================================================
// 2. BUILD WORLD, ECOSYSTEM, WORLD MAP SYSTEM, FLEET, AUDIO, AND CONTROLLER
// ============================================================================
const sound = new SoundManager();
const oceanEnv = new OceanEnvironment(scene);
const ecosystem = new EcosystemManager(scene, oceanEnv);
const worldMap = new WorldMapSystem(scene, oceanEnv, ecosystem);
const fleet = new MiningFleetManager(scene, oceanEnv, ecosystem);

// Create 49 Sector Cells in the expandable HUD Mini-Grid
const sectorGridEl = document.getElementById('sector-mini-grid');
const sectorCellEls = [];
for (let i = 0; i < oceanEnv.sectors.length; i++) {
  const cell = document.createElement('div');
  cell.className = 'sector-cell';
  sectorGridEl.appendChild(cell);
  sectorCellEls.push(cell);
}

// Create Subtle World-Space Zone Badges (togglable with [V] or Marker Button)
const zoneBadgeEls = new Map();
for (const z of worldMap.zones.values()) {
  const pill = document.createElement('div');
  pill.className = 'zone-world-pill';
  pill.style.display = 'none';
  pill.innerHTML = `<span class="zw-dot"></span><span class="zw-text">${z.name}</span>`;
  pill.addEventListener('click', (e) => {
    e.stopPropagation();
    worldMap.selectZone(z.id);
    openWorldMapModal(z.id);
  });
  zoneBadgesLayer.appendChild(pill);
  zoneBadgeEls.set(z.id, pill);
}

function formatCompactCash(amount) {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1000000) {
    return `${sign}$${(abs / 1000000).toFixed(2)}M`;
  }
  if (abs >= 1000) {
    return `${sign}$${Math.round(abs / 1000)}K`;
  }
  return `${sign}$${Math.round(abs)}`;
}

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

  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 1850);
}

const game = new GameController(
  oceanEnv,
  ecosystem,
  fleet,
  sound,
  {
    onSelectionChange: (mach) => {
      if (mach) {
        updateUnitSwitcherUI(mach.id);
      }
      refreshHUD();
    },
    onWorldPopup: (pos, text, cls) => spawnWorldPopup(pos, text, cls),
    onRulePrompt: (stageKey) => openRuleModal(stageKey),
    onZoneSelectedInWorld: (zoneId) => {
      worldMap.selectZone(zoneId);
      renderWorldMapGraph();
      renderZoneInspector(zoneId);
    },
    onRuleEnacted: (stageKey, option, remaining) => {
      const leftEl = document.getElementById('rules-left-count');
      if (leftEl) leftEl.textContent = `${remaining} LEFT`;

      const isStage1 = stageKey === 'stage1';
      const statusEl = document.getElementById(isStage1 ? 'rule-1-status' : 'rule-2-status');
      const nameEl = document.getElementById(isStage1 ? 'rule-1-name' : 'rule-2-name');
      const btnEl = document.getElementById(isStage1 ? 'btn-rule-1' : 'btn-rule-2');

      if (nameEl) nameEl.textContent = option.shortTitle || option.title;
      if (statusEl) statusEl.textContent = 'ACTIVE ✓';
      if (btnEl) {
        btnEl.classList.add('enacted');
        btnEl.disabled = true;
      }

      if (remaining <= 0) {
        document.getElementById('btn-rule-1').disabled = true;
        document.getElementById('btn-rule-2').disabled = true;
      }

      spawnWorldPopup(
        fleet.crawler.root.position.clone().add(new THREE.Vector3(0, 3.2, 0)),
        `Rule Enacted: ${option.shortTitle || option.title}`,
        'popup-gold'
      );
      if (!worldMapModal.classList.contains('hidden')) {
        renderWorldMapGraph();
        renderZoneInspector(worldMap.selectedZoneId);
      }
      refreshHUD();
    }
  },
  worldMap
);

// ============================================================================
// 3. CONNECTED UNDERWATER WORLD MAP UI (7 REGIONS)
// ============================================================================
const mapNodeEls = new Map();

function worldToMapPercent(wx, wz) {
  // Approximate mapping from world coordinates (-36..36) to schematic map (8..94%)
  const nearest = worldMap.getZoneAtPoint(wx, wz) || worldMap.getNearestZone(wx, wz);
  if (!nearest) return { x: 42, y: 50 };
  const dx = THREE.MathUtils.clamp((wx - nearest.x) * 0.45, -6, 6);
  const dy = THREE.MathUtils.clamp((wz - nearest.z) * 0.45, -6, 6);
  return {
    x: THREE.MathUtils.clamp(nearest.mapPos.x + dx, 6, 94),
    y: THREE.MathUtils.clamp(nearest.mapPos.y + dy, 8, 92)
  };
}

function openWorldMapModal(focusZoneId = null) {
  sound.resume();
  sound.playSonarPing(860);
  if (focusZoneId) {
    worldMap.selectZone(focusZoneId);
  } else if (!worldMap.selectedZoneId) {
    const sel = game.getSelectedMachine();
    const curZ = sel
      ? worldMap.getZoneAtPoint(sel.root.position.x, sel.root.position.z) ||
        worldMap.getNearestZone(sel.root.position.x, sel.root.position.z)
      : null;
    worldMap.selectZone(curZ ? curZ.id : 'nodule_fields');
  }
  renderWorldMapGraph();
  renderZoneInspector(worldMap.selectedZoneId);
  worldMapModal.classList.remove('hidden');
}

function closeWorldMapModal() {
  worldMapModal.classList.add('hidden');
}

function toggleWorldMapModal() {
  if (worldMapModal.classList.contains('hidden')) {
    openWorldMapModal();
  } else {
    closeWorldMapModal();
  }
}

function renderWorldMapGraph() {
  mapSvgEl.innerHTML = '';
  mapNodesLayerEl.innerHTML = '';
  mapNodeEls.clear();

  // 1. Draw Stylized Region Territory Shapes on the SVG Layer
  for (const zone of worldMap.zones.values()) {
    const meta = STATUS_META[zone.status] || STATUS_META.ACCESSIBLE;
    const isSel = worldMap.selectedZoneId === zone.id;
    const pts = ZONE_MAP_POLYGONS[zone.id];
    if (pts) {
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', pts);
      poly.setAttribute('fill', meta.color);
      poly.setAttribute('fill-opacity', isSel ? '0.24' : '0.10');
      poly.setAttribute('stroke', isSel ? '#ffffff' : meta.color);
      poly.setAttribute('stroke-width', isSel ? '0.75' : '0.38');
      poly.setAttribute('stroke-opacity', isSel ? '0.92' : '0.48');
      if (zone.status === 'UNDISCOVERED') {
        poly.setAttribute('stroke-dasharray', '1.2, 1.2');
      }
      mapSvgEl.appendChild(poly);
    }
  }

  // 2. Draw SVG Corridor Connections between the 7 Regions
  const drawnPairs = new Set();
  for (const zone of worldMap.zones.values()) {
    for (const targetId of zone.connectedTo) {
      const pairKey = [zone.id, targetId].sort().join('--');
      if (drawnPairs.has(pairKey)) continue;
      drawnPairs.add(pairKey);

      const target = worldMap.getZoneById(targetId);
      if (!target) continue;

      const bothUnlocked =
        worldMap.isZoneUnlocked(zone.id) && worldMap.isZoneUnlocked(target.id);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', zone.mapPos.x);
      line.setAttribute('y1', zone.mapPos.y);
      line.setAttribute('x2', target.mapPos.x);
      line.setAttribute('y2', target.mapPos.y);
      line.setAttribute('stroke', bothUnlocked ? '#55d99a' : '#ffc83d');
      line.setAttribute('stroke-width', bothUnlocked ? '1.05' : '0.72');
      line.setAttribute('stroke-opacity', bothUnlocked ? '0.84' : '0.54');
      if (!bothUnlocked) {
        line.setAttribute('stroke-dasharray', '1.8, 1.5');
      }
      mapSvgEl.appendChild(line);

      // Midpoint corridor waypoint dot
      const midDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      midDot.setAttribute('cx', (zone.mapPos.x + target.mapPos.x) * 0.5);
      midDot.setAttribute('cy', (zone.mapPos.y + target.mapPos.y) * 0.5);
      midDot.setAttribute('r', '0.85');
      midDot.setAttribute('fill', bothUnlocked ? '#55d99a' : '#ffc83d');
      midDot.setAttribute('fill-opacity', '0.85');
      mapSvgEl.appendChild(midDot);
    }
  }

  // 3. Render the 7 Interactive Region Nodes
  for (const zone of worldMap.zones.values()) {
    const live = worldMap.getZoneLiveStats(zone.id);
    const meta = STATUS_META[zone.status] || STATUS_META.ACCESSIBLE;
    const actIcon = ZONE_ACTIVITY_ICONS[zone.id] || meta.actIcon;

    const node = document.createElement('div');
    node.className = `map-zone-node status-${zone.status} ${
      worldMap.selectedZoneId === zone.id ? 'selected' : ''
    }`;
    node.dataset.zoneId = zone.id;
    node.style.left = `${zone.mapPos.x}%`;
    node.style.top = `${zone.mapPos.y}%`;

    const healthColor =
      live.localHealth >= 72
        ? '#55d99a'
        : live.localHealth >= 42
        ? '#ffc83d'
        : '#f16f75';

    const resourceText =
      zone.status === 'UNDISCOVERED'
        ? 'Uncharted'
        : zone.status === 'PROTECTED'
        ? 'No Mining'
        : live.remainingTons > 0
        ? `${live.remainingTons}t Ore`
        : 'Base / Clean';

    node.innerHTML = `
      <div class="mzn-top">
        <span class="mzn-name"><i class="mzn-act-icon">${actIcon}</i> ${zone.name}</span>
        <span class="mzn-icon">${meta.icon}</span>
      </div>
      <div class="mzn-sub">
        <span class="mzn-res-text">${resourceText}</span>
        <span class="mzn-hp-text" style="color:${healthColor}">${live.localHealth}% HP</span>
      </div>
      <div class="mzn-bar-track">
        <div class="mzn-bar-fill" style="width:${live.localHealth}%; background:${healthColor}"></div>
      </div>
    `;

    node.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.playSonarPing(790);
      worldMap.selectZone(zone.id);
      renderWorldMapGraph();
      renderZoneInspector(zone.id);
    });

    mapNodesLayerEl.appendChild(node);
    mapNodeEls.set(zone.id, node);
  }

  // 4. Render Live Machine Position Pin for Selected Machine
  const sel = game.getSelectedMachine();
  if (sel) {
    const mpos = worldToMapPercent(sel.root.position.x, sel.root.position.z);
    const pin = document.createElement('div');
    pin.className = 'map-machine-pin';
    pin.id = 'map-machine-pin';
    pin.style.left = `${mpos.x}%`;
    pin.style.top = `${Math.max(6, mpos.y - 8)}%`;
    pin.title = `${sel.name} Current Location`;
    pin.innerHTML = `<span class="mmp-dot"></span><span>${sel.name}</span>`;
    mapNodesLayerEl.appendChild(pin);
  }
}

// Non-destructive update of World Map telemetry so clicks are never interrupted
function updateWorldMapLiveTelemetry() {
  for (const zone of worldMap.zones.values()) {
    const node = mapNodeEls.get(zone.id);
    if (!node) continue;
    const live = worldMap.getZoneLiveStats(zone.id);
    if (!live) continue;

    const healthColor =
      live.localHealth >= 72
        ? '#55d99a'
        : live.localHealth >= 42
        ? '#ffc83d'
        : '#f16f75';

    const resourceText =
      zone.status === 'UNDISCOVERED'
        ? 'Uncharted'
        : zone.status === 'PROTECTED'
        ? 'No Mining'
        : live.remainingTons > 0
        ? `${live.remainingTons}t Ore`
        : 'Base / Clean';

    const resEl = node.querySelector('.mzn-res-text');
    const hpEl = node.querySelector('.mzn-hp-text');
    const fillEl = node.querySelector('.mzn-bar-fill');
    if (resEl) resEl.textContent = resourceText;
    if (hpEl) {
      hpEl.textContent = `${live.localHealth}% HP`;
      hpEl.style.color = healthColor;
    }
    if (fillEl) {
      fillEl.style.width = `${live.localHealth}%`;
      fillEl.style.background = healthColor;
    }
  }

  const pin = document.getElementById('map-machine-pin');
  const sel = game.getSelectedMachine();
  if (pin && sel) {
    const mpos = worldToMapPercent(sel.root.position.x, sel.root.position.z);
    pin.style.left = `${mpos.x}%`;
    pin.style.top = `${Math.max(6, mpos.y - 8)}%`;
  }
}

function renderZoneInspector(zoneId) {
  const live = worldMap.getZoneLiveStats(zoneId);
  if (!live) return;
  const { zone } = live;
  const meta = STATUS_META[zone.status] || STATUS_META.ACCESSIBLE;

  const badgeEl = document.getElementById('insp-status-badge');
  badgeEl.textContent = meta.label;
  badgeEl.style.background = `${meta.color}28`;
  badgeEl.style.color = meta.color;
  badgeEl.style.border = `1px solid ${meta.color}70`;

  document.getElementById('insp-zone-title').textContent = zone.name;
  document.getElementById('insp-zone-desc').textContent = zone.shortDesc;
  document.getElementById('insp-unlock-req').textContent = zone.unlockReqText;

  const minEl = document.getElementById('insp-minerals');
  if (zone.status === 'PROTECTED') {
    minEl.textContent = 'Protected (Mining Prohibited)';
    minEl.style.color = '#f16f75';
  } else if (zone.status === 'UNDISCOVERED') {
    minEl.textContent = 'Unknown (Unlock Abyssal Trench first)';
    minEl.style.color = '#9cb7c8';
  } else if (live.depositCount === 0) {
    minEl.textContent = '0 t (Operations Base)';
    minEl.style.color = '#9cb7c8';
  } else {
    minEl.textContent = `${live.remainingTons} t / ${live.maxTons} t (${live.depositCount} Veins)`;
    minEl.style.color = '#ffc83d';
  }

  const healthEl = document.getElementById('insp-health');
  healthEl.textContent = `${live.localHealth}% (${
    live.localHealth >= 75 ? 'Healthy' : live.localHealth >= 42 ? 'Damaged' : 'Critical'
  })`;
  healthEl.style.color =
    live.localHealth >= 75 ? '#55d99a' : live.localHealth >= 42 ? '#ffc83d' : '#f16f75';

  document.getElementById('insp-risk').textContent = zone.environmentalRisk;
  document.getElementById('insp-scars').textContent =
    live.totalScars === 0
      ? 'None'
      : `${live.activeScars} Active • ${live.restoredScars} Restored`;

  const tagsEl = document.getElementById('insp-activity-tags');
  tagsEl.innerHTML = '';
  zone.activities.forEach((act) => {
    const chip = document.createElement('span');
    chip.className = 'activity-chip';
    chip.textContent = act;
    tagsEl.appendChild(chip);
  });

  // Unlock Button vs Navigate Button vs Focus Camera Button state
  const unlockBtn = document.getElementById('btn-map-unlock-zone');
  const unlockLabel = document.getElementById('btn-map-unlock-label');
  const navBtn = document.getElementById('btn-map-navigate');
  const focusBtn = document.getElementById('btn-map-focus');

  const isLockedOrUndiscovered = zone.status === 'LOCKED' || zone.status === 'UNDISCOVERED';

  if (isLockedOrUndiscovered) {
    unlockBtn.classList.remove('hidden');
    const canUnlockNow = zone.canUnlock(game, worldMap);
    unlockLabel.textContent =
      zone.unlockCost > 0
        ? `UNLOCK REGION ($${Math.round(zone.unlockCost / 1000)}K)`
        : 'UNLOCK REGION';
    unlockBtn.style.opacity = canUnlockNow ? '1' : '0.6';
    navBtn.disabled = true;
    navBtn.style.opacity = '0.5';
    focusBtn.disabled = true;
    focusBtn.style.opacity = '0.5';
    focusBtn.textContent = '🔒 Unlock Region to Focus Camera';
  } else {
    unlockBtn.classList.add('hidden');
    navBtn.disabled = false;
    navBtn.style.opacity = '1';
    focusBtn.disabled = false;
    focusBtn.style.opacity = '1';
    focusBtn.textContent = 'Focus Camera on Region';
  }
}

document.getElementById('btn-world-map').addEventListener('click', () => {
  toggleWorldMapModal();
});
document.getElementById('btn-open-map-from-mission').addEventListener('click', () => {
  openWorldMapModal();
});
document.getElementById('world-map-close').addEventListener('click', () => {
  closeWorldMapModal();
});
worldMapModal.addEventListener('click', (e) => {
  if (e.target === worldMapModal) {
    closeWorldMapModal();
  }
});

// Map Inspector Action 1: Unlock Region
document.getElementById('btn-map-unlock-zone').addEventListener('click', () => {
  const zoneId = worldMap.selectedZoneId;
  const res = worldMap.unlockZone(zoneId, game);
  if (res.ok) {
    sound.playRestorationChime();
    renderWorldMapGraph();
    renderZoneInspector(zoneId);
    refreshHUD();
    spawnWorldPopup(
      res.zone.centerVec.clone().add(new THREE.Vector3(0, 3.0, 0)),
      `🔓 ${res.zone.name} Unlocked!`,
      'popup-green'
    );
  } else {
    sound.playRuleChangeAlert();
    spawnWorldPopup(
      fleet.crawler.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)),
      res.reason,
      'popup-gold'
    );
  }
});

// Map Inspector Action 2: Navigate Machine Here
document.getElementById('btn-map-navigate').addEventListener('click', () => {
  const zoneId = worldMap.selectedZoneId;
  const z = worldMap.getZoneById(zoneId);
  if (!z || !worldMap.isZoneUnlocked(zoneId)) return;

  const stats = worldMap.getZoneLiveStats(zoneId);
  if (stats && stats.activeScars > 0) {
    game.selectMachine('drone');
  }

  const ok = game.navigateSelectedMachineToZone(zoneId);
  if (ok) {
    closeWorldMapModal();
    focusCameraOnZone(zoneId);
  }
});

// Map Inspector Action 3: Focus 3D Camera on Region (when region is accessible)
document.getElementById('btn-map-focus').addEventListener('click', () => {
  const zoneId = worldMap.selectedZoneId;
  if (!worldMap.isZoneUnlocked(zoneId)) return;
  closeWorldMapModal();
  focusCameraOnZone(zoneId);
});

function focusCameraOnZone(zoneId) {
  const z = worldMap.getZoneById(zoneId);
  if (!z) return;
  worldMap.selectZone(zoneId);
  camRig.followMachine = false;
  camRig.desiredTarget.set(z.x, oceanEnv.getTerrainHeight(z.x, z.z) * 0.4, z.z);
  camRig.desiredDistance = 32;
}

function resetCamera() {
  sound.resume();
  sound.playSonarPing(760);
  camRig.followMachine = false;
  camRig.desiredTarget.copy(DEFAULT_CAMERA_STATE.target);
  camRig.desiredYaw = DEFAULT_CAMERA_STATE.yaw;
  camRig.desiredPitch = DEFAULT_CAMERA_STATE.pitch;
  camRig.desiredDistance = DEFAULT_CAMERA_STATE.distance;
  spawnWorldPopup(
    new THREE.Vector3(-1.5, 2.5, 1.5),
    'Camera Reset to Starting Region',
    'popup-cyan'
  );
}

const resetCamBtn = document.getElementById('btn-reset-camera');
if (resetCamBtn) {
  resetCamBtn.addEventListener('click', resetCamera);
}

// Toggle 3D World Markers & Zone Boundaries
function handleToggleMarkers() {
  const visible = worldMap.toggleMarkersVisibility();
  zoneBadgesLayer.style.display = visible ? 'block' : 'none';
  toggleMarkersBtn.style.opacity = visible ? '1.0' : '0.5';
  sound.playSonarPing(visible ? 840 : 540);
}
toggleMarkersBtn.addEventListener('click', handleToggleMarkers);

// ============================================================================
// 4. LIVE ILLUSTRATED MACHINE PREVIEW CANVAS
// ============================================================================
function drawRoundedBox(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
  }
}

function drawMachinePreview(elapsed) {
  if (!pctx || !previewCanvas) return;
  const w = previewCanvas.width;
  const h = previewCanvas.height;
  pctx.clearRect(0, 0, w, h);

  // Deep underwater backdrop gradient
  const bgGrad = pctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#092b42');
  bgGrad.addColorStop(0.65, '#12506b');
  bgGrad.addColorStop(1, '#1d6c80');
  pctx.fillStyle = bgGrad;
  pctx.fillRect(0, 0, w, h);

  // Subtle volumetric light rays in preview
  pctx.save();
  pctx.fillStyle = 'rgba(122, 248, 255, 0.07)';
  pctx.beginPath();
  pctx.moveTo(40, 0);
  pctx.lineTo(95, 0);
  pctx.lineTo(65, h);
  pctx.lineTo(15, h);
  pctx.closePath();
  pctx.fill();
  pctx.restore();

  // Sunlit sandy seabed contour
  pctx.fillStyle = '#3396a3';
  pctx.beginPath();
  pctx.moveTo(0, h - 24);
  pctx.quadraticCurveTo(w * 0.5, h - 33, w, h - 20);
  pctx.lineTo(w, h);
  pctx.lineTo(0, h);
  pctx.closePath();
  pctx.fill();

  // Polymetallic nodules on seabed floor
  const nodX = [24, 42, 62, 84];
  nodX.forEach((nx, idx) => {
    pctx.fillStyle = '#182b3a';
    pctx.beginPath();
    pctx.ellipse(nx, h - 12 - (idx % 2) * 4, 6.5, 4.2, 0, 0, Math.PI * 2);
    pctx.fill();
    pctx.fillStyle = idx % 2 === 0 ? '#18c8da' : '#39d9c4';
    pctx.beginPath();
    pctx.arc(nx - 1, h - 13 - (idx % 2) * 4, 2.0, 0, Math.PI * 2);
    pctx.fill();
  });

  const sel = game.getSelectedMachine();
  const id = sel ? sel.id : 'crawler';

  if (id === 'crawler') {
    const isMining = sel && sel.state === 'MINING';
    const isMoving = sel && sel.state === 'MOVING';
    const bounce = isMining
      ? Math.sin(elapsed * 22) * 1.3
      : isMoving
      ? Math.sin(elapsed * 10) * 0.9
      : Math.sin(elapsed * 3) * 0.5;

    // Warm floodlight cone
    const beamGrad = pctx.createLinearGradient(118, 56, 20, 108);
    beamGrad.addColorStop(0, 'rgba(255, 232, 140, 0.58)');
    beamGrad.addColorStop(1, 'rgba(255, 232, 140, 0.0)');
    pctx.fillStyle = beamGrad;
    pctx.beginPath();
    pctx.moveTo(118, 56 + bounce);
    pctx.lineTo(16, 82);
    pctx.lineTo(58, 114);
    pctx.closePath();
    pctx.fill();

    // Caterpillar track frame
    pctx.fillStyle = '#182634';
    drawRoundedBox(pctx, 116, 66 + bounce, 94, 28, 12);
    pctx.fill();
    pctx.strokeStyle = '#3d566e';
    pctx.lineWidth = 2;
    pctx.stroke();

    // Bogie wheels
    pctx.fillStyle = '#4a6680';
    for (let wx = 130; wx <= 194; wx += 16) {
      pctx.beginPath();
      pctx.arc(wx, 80 + bounce, 5.5, 0, Math.PI * 2);
      pctx.fill();
    }

    // Main yellow industrial hull
    pctx.fillStyle = '#ffc83d';
    drawRoundedBox(pctx, 120, 36 + bounce, 84, 33, 7);
    pctx.fill();

    // White upper armored deck
    pctx.fillStyle = '#e8f4fc';
    drawRoundedBox(pctx, 128, 29 + bounce, 66, 11, 4);
    pctx.fill();

    // Side dark vents & cyan telemetry strip
    pctx.fillStyle = '#182634';
    pctx.fillRect(134, 45 + bounce, 14, 10);
    pctx.fillRect(154, 45 + bounce, 14, 10);
    pctx.fillRect(174, 45 + bounce, 14, 10);
    pctx.fillStyle = '#18c8da';
    pctx.fillRect(126, 61 + bounce, 72, 3);

    // Hydraulic boom arm
    pctx.strokeStyle = '#ffc83d';
    pctx.lineWidth = 7;
    pctx.lineCap = 'round';
    pctx.beginPath();
    pctx.moveTo(122, 54 + bounce);
    pctx.lineTo(74, 79 + bounce);
    pctx.stroke();

    // Rotating Nodule Cutter Drum
    pctx.save();
    pctx.translate(68, 82 + bounce);
    pctx.rotate(elapsed * (isMining ? 11 : isMoving ? 4 : 1.5));
    pctx.fillStyle = '#243748';
    pctx.beginPath();
    pctx.arc(0, 0, 16, 0, Math.PI * 2);
    pctx.fill();
    pctx.fillStyle = '#18c8da';
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2;
      pctx.beginPath();
      pctx.arc(Math.cos(ang) * 11.5, Math.sin(ang) * 11.5, 3.2, 0, Math.PI * 2);
      pctx.fill();
    }
    pctx.restore();

    // Front floodlight lens
    pctx.fillStyle = '#fff5c0';
    pctx.beginPath();
    pctx.arc(118, 52 + bounce, 4.8, 0, Math.PI * 2);
    pctx.fill();
  } else if (id === 'submarine') {
    const hover = Math.sin(elapsed * 3.2) * 4;
    pctx.fillStyle = '#ffc83d';
    pctx.beginPath();
    pctx.ellipse(w * 0.54, 58 + hover, 46, 31, 0, 0, Math.PI * 2);
    pctx.fill();

    pctx.fillStyle = '#071826';
    pctx.beginPath();
    pctx.ellipse(w * 0.5, 58 + hover, 28, 19, 0, 0, Math.PI * 2);
    pctx.fill();

    pctx.fillStyle = '#70f8ff';
    pctx.beginPath();
    pctx.arc(w * 0.45, 55 + hover, 4.5, 0, Math.PI * 2);
    pctx.arc(w * 0.55, 55 + hover, 4.5, 0, Math.PI * 2);
    pctx.fill();

    pctx.strokeStyle = '#70f8ff';
    pctx.lineWidth = 2.5;
    pctx.beginPath();
    pctx.arc(w * 0.5, 58 + hover, 7, 0.2 * Math.PI, 0.8 * Math.PI);
    pctx.stroke();
  } else {
    const hover = Math.sin(elapsed * 3.5) * 3.5;
    const laserGrad = pctx.createLinearGradient(w * 0.54, 65 + hover, w * 0.54, h);
    laserGrad.addColorStop(0, 'rgba(85, 217, 154, 0.52)');
    laserGrad.addColorStop(1, 'rgba(85, 217, 154, 0.05)');
    pctx.fillStyle = laserGrad;
    pctx.beginPath();
    pctx.moveTo(w * 0.54 - 18, 66 + hover);
    pctx.lineTo(w * 0.54 - 48, h);
    pctx.lineTo(w * 0.54 + 48, h);
    pctx.lineTo(w * 0.54 + 18, 66 + hover);
    pctx.closePath();
    pctx.fill();

    pctx.fillStyle = '#55d99a';
    pctx.beginPath();
    pctx.arc(w * 0.54, 52 + hover, 24, Math.PI, 0);
    pctx.fill();

    pctx.fillStyle = '#e8f4fc';
    drawRoundedBox(pctx, w * 0.54 - 42, 50 + hover, 84, 18, 9);
    pctx.fill();
  }

  // Live Telemetry Overlay Text on Preview Canvas
  pctx.fillStyle = 'rgba(7, 28, 43, 0.72)';
  drawRoundedBox(pctx, 8, 8, 94, 20, 6);
  pctx.fill();
  pctx.font = '700 10px "JetBrains Mono", monospace';
  pctx.fillStyle = '#7af8ff';
  const stateLabel = sel ? sel.state : 'IDLE';
  pctx.fillText(`STATE: ${stateLabel}`, 14, 21);

  pctx.fillStyle = 'rgba(7, 28, 43, 0.72)';
  drawRoundedBox(pctx, w - 74, 8, 66, 20, 6);
  pctx.fill();
  pctx.fillStyle = '#9cb7c8';
  pctx.fillText('FOCUS [F]', w - 67, 21);
}

// ============================================================================
// 5. CAMERA & MOUSE / KEYBOARD INPUT HANDLING
// ============================================================================
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();
const keyState = {};

let isDragging = false;
let dragButton = -1;
let dragStart = { x: 0, y: 0 };
let pointerMovedDist = 0;

function isTypingInInput(e) {
  const el = e.target;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

window.addEventListener('keydown', (e) => {
  if (isTypingInInput(e)) return;

  keyState[e.code] = true;
  if (e.code === 'KeyF') {
    focusCameraOnSelected();
  }
  if (e.code === 'KeyR') {
    resetCamera();
  }
  if (e.code === 'KeyM') {
    e.preventDefault();
    toggleWorldMapModal();
  }
  if (e.code === 'KeyV') {
    handleToggleMarkers();
  }
  if (e.code === 'Escape') {
    closeWorldMapModal();
    ruleModal.classList.add('hidden');
    settingsModal.classList.add('hidden');
    summaryModal.classList.add('hidden');
  }
  if (e.code === 'Digit1') game.selectMachine('crawler');
  if (e.code === 'Digit2') game.selectMachine('submarine');
  if (e.code === 'Digit3') game.selectMachine('drone');
});

window.addEventListener('keyup', (e) => {
  keyState[e.code] = false;
});

renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

renderer.domElement.addEventListener('pointerdown', (e) => {
  sound.resume();
  isDragging = true;
  dragButton = e.button;
  dragStart = { x: e.clientX, y: e.clientY };
  pointerMovedDist = 0;
});

window.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;
  pointerMovedDist += Math.hypot(dx, dy);
  dragStart = { x: e.clientX, y: e.clientY };

  // Right-drag, Middle-drag, or Shift+Left-drag pans the camera target across the seabed
  if (dragButton === 2 || dragButton === 1 || (dragButton === 0 && e.shiftKey)) {
    camRig.followMachine = false;
    const panSpeed = camRig.distance * 0.0014;
    const cosY = Math.cos(camRig.yaw);
    const sinY = Math.sin(camRig.yaw);
    const moveX = (-dx * cosY - dy * sinY) * panSpeed;
    const moveZ = (dx * sinY - dy * cosY) * panSpeed;
    camRig.desiredTarget.x = THREE.MathUtils.clamp(camRig.desiredTarget.x + moveX, -36, 36);
    camRig.desiredTarget.z = THREE.MathUtils.clamp(camRig.desiredTarget.z + moveZ, -36, 36);
    camRig.desiredTarget.y =
      oceanEnv.getTerrainHeight(camRig.desiredTarget.x, camRig.desiredTarget.z) * 0.35;
  } else if (dragButton === 0 && pointerMovedDist > 6) {
    // Left-drag orbits the camera
    camRig.desiredYaw -= dx * 0.0055;
    camRig.desiredPitch = THREE.MathUtils.clamp(camRig.desiredPitch + dy * 0.0045, 0.32, 1.22);
  }
});

window.addEventListener('pointerup', (e) => {
  if (isDragging && dragButton === 0 && pointerMovedDist < 7 && !e.shiftKey) {
    handleCanvasClick(e);
  }
  isDragging = false;
  dragButton = -1;
});

renderer.domElement.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    camRig.desiredDistance = THREE.MathUtils.clamp(
      camRig.desiredDistance + e.deltaY * 0.03,
      18,
      72
    );
  },
  { passive: false }
);

function handleCanvasClick(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  const w = rect.width || window.innerWidth;
  const h = rect.height || window.innerHeight;
  mouseNDC.x = ((e.clientX - rect.left) / w) * 2 - 1;
  mouseNDC.y = -((e.clientY - rect.top) / h) * 2 + 1;
  raycaster.setFromCamera(mouseNDC, camera);

  const interactables = [
    fleet.crawler.hitMesh,
    fleet.submarine.hitMesh,
    fleet.restorationDrone.hitMesh,
    ...ecosystem.deposits.filter((d) => !d.depleted).map((d) => d.hitMesh),
    ...ecosystem.damagedSites.filter((s) => !s.restored).map((s) => s.hitMesh),
    oceanEnv.terrainMesh
  ];

  const hits = raycaster.intersectObjects(interactables, false);
  if (hits.length > 0) {
    const topHit = hits[0];
    game.issueWorldCommand(topHit.point, topHit.object.userData);
    spawnClickRipple(topHit.point);
  }
}

const clickRipples = [];
function spawnClickRipple(pt) {
  const ringGeo = new THREE.RingGeometry(0.3, 0.52, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: game.selectedMachineId === 'drone' ? 0x55d99a : 0x18c8da,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9
  });
  const mesh = new THREE.Mesh(ringGeo, ringMat);
  mesh.position.set(pt.x, oceanEnv.getTerrainHeight(pt.x, pt.z) + 0.18, pt.z);
  scene.add(mesh);
  clickRipples.push({ mesh, mat: ringMat, age: 0 });
}

function focusCameraOnSelected() {
  const mach = game.getSelectedMachine();
  if (!mach) return;
  camRig.followMachine = true;
  camRig.desiredTarget.set(
    mach.root.position.x,
    mach.root.position.y * 0.35,
    mach.root.position.z
  );
  camRig.desiredDistance = 28;
}

// ============================================================================
// 6. WIRE UP HUD CONTROLS & MODALS
// ============================================================================
function updateUnitSwitcherUI(machineId) {
  document.querySelectorAll('.unit-chip').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.machine === machineId);
  });
}

document.querySelectorAll('.unit-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    game.selectMachine(btn.dataset.machine);
  });
});

document.getElementById('machine-preview-frame').addEventListener('click', () => {
  focusCameraOnSelected();
});

document.getElementById('btn-mine-nearest').addEventListener('click', () => {
  game.dispatchCrawlerToNearestDeposit();
  refreshHUD();
});

document.getElementById('btn-offload-hub').addEventListener('click', () => {
  game.sellCollectedOre();
  refreshHUD();
});

document.getElementById('btn-restore-nearest').addEventListener('click', () => {
  game.dispatchDroneToNearestDamagedSite();
  refreshHUD();
});

toggleStatsBtn.addEventListener('click', () => {
  const isHidden = statsDrawer.classList.toggle('hidden');
  toggleStatsBtn.textContent = isHidden ? 'Stats ▾' : 'Stats ▴';
});

document.getElementById('btn-settings-toggle').addEventListener('click', () => {
  settingsModal.classList.remove('hidden');
});
document.getElementById('settings-modal-close').addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

document.querySelectorAll('.cam-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.cam;
    if (mode === 'diorama') {
      resetCamera();
    } else if (mode === 'crawler') {
      game.selectMachine('crawler');
      focusCameraOnSelected();
    } else if (mode === 'surface') {
      camRig.followMachine = false;
      camRig.desiredTarget.set(
        oceanEnv.riserHubPosition.x,
        24,
        oceanEnv.riserHubPosition.z
      );
      camRig.desiredDistance = 32;
      camRig.desiredPitch = 0.42;
    }
    settingsModal.classList.add('hidden');
  });
});

document.getElementById('upg-cutter').addEventListener('click', () => {
  game.purchaseUpgrade('cutter');
  refreshHUD();
});
document.getElementById('upg-hopper').addEventListener('click', () => {
  game.purchaseUpgrade('hopper');
  refreshHUD();
});
document.getElementById('upg-biolaser').addEventListener('click', () => {
  game.purchaseUpgrade('biolaser');
  refreshHUD();
});

document.getElementById('btn-next-round').addEventListener('click', () => {
  sound.resume();
  game.roundTimer = game.secondsPerRound + 1;
  sound.playSonarPing(820);
  refreshHUD();
});

const audioBtn = document.getElementById('btn-audio-toggle');
audioBtn.addEventListener('click', () => {
  sound.resume();
  const muted = sound.toggleMute();
  audioBtn.textContent = muted ? 'Audio: OFF' : 'Audio: ON';
});

document.getElementById('btn-end-summary').addEventListener('click', () => {
  openSummaryModal();
});

function openRuleModal(stageKey) {
  if (game.getRulesRemaining() <= 0) return;
  if (stageKey === 'stage1' && game.rule1Enacted) return;
  if (stageKey === 'stage2' && game.rule2Enacted) return;

  const stage = RULE_CHANGES[stageKey];
  if (!stage) return;

  document.getElementById('rule-modal-subtitle').textContent = `${stage.subtitle} • ${game.getRulesRemaining()} LEFT`;
  document.getElementById('rule-modal-title').textContent = stage.title;
  document.getElementById('rule-modal-desc').textContent = stage.description;

  const containerEl = document.getElementById('rule-options-container');
  containerEl.innerHTML = '';

  stage.options.forEach((opt) => {
    const card = document.createElement('div');
    card.className = 'rule-card';
    card.innerHTML = `
      <div>
        <span class="rule-badge ${opt.badgeClass}">${opt.badge}</span>
        <h3>${opt.title}</h3>
        <p>${opt.oneLine}</p>
      </div>
      <div>
        <div class="rule-effects">${opt.effectsText}</div>
        <button class="rule-confirm-btn">Confirm & Enact (${opt.costText})</button>
      </div>
    `;
    card.addEventListener('click', () => {
      game.enactRuleChange(stageKey, opt.id);
      ruleModal.classList.add('hidden');
      refreshHUD();
    });
    containerEl.appendChild(card);
  });

  ruleModal.classList.remove('hidden');
}

document.getElementById('btn-rule-1').addEventListener('click', () => openRuleModal('stage1'));
document.getElementById('btn-rule-2').addEventListener('click', () => openRuleModal('stage2'));
document.getElementById('rule-modal-close').addEventListener('click', () => {
  ruleModal.classList.add('hidden');
});

function openSummaryModal() {
  const health = Math.round(oceanEnv.getGlobalOceanHealth());
  const restoredSites = ecosystem.damagedSites.filter((s) => s.restored).length;
  const totalSites = ecosystem.damagedSites.length;

  let verdictTitle = 'BALANCED DEEP-SEA STEWARDSHIP';
  let verdictDesc =
    'ABYSS INC. balanced industrial mineral extraction with proactive benthic remediation, preserving key coral habitats while maintaining shareholder solvency.';

  if (health >= 85 && restoredSites >= 2) {
    verdictTitle = 'EXEMPLARY OCEAN RESTORATION PIONEER';
    verdictDesc =
      'By deploying the AEGIS-B10 Restoration ROV and planting coral bio-domes, ABYSS INC. healed the seabed and set a historic maritime standard.';
  } else if (health < 45) {
    verdictTitle = 'ECOLOGICAL WARNING — HIGH PROFIT, HEAVY SEABED DAMAGE';
    verdictDesc =
      'Aggressive mining filled the company treasury, but sediment plumes and waste scarred the ocean floor. Click RESTORE to clean up damaged zones!';
  }

  document.getElementById('sum-verdict-title').textContent = verdictTitle;
  document.getElementById('sum-verdict-desc').textContent = verdictDesc;
  document.getElementById('sum-treasury').textContent = formatCompactCash(game.treasury);
  document.getElementById('sum-profit').textContent = `${game.netProfit >= 0 ? '+' : ''}${formatCompactCash(game.netProfit)}`;
  document.getElementById('sum-health').textContent = `${health}%`;
  document.getElementById('sum-mined').textContent = `${Math.round(game.totalTonsMined)} t`;
  document.getElementById('sum-restored').textContent = `${restoredSites} / ${Math.max(2, totalSites)}`;

  const rulesSummary =
    [
      game.rule1Enacted ? game.rule1Enacted.shortTitle : null,
      game.rule2Enacted ? game.rule2Enacted.shortTitle : null
    ]
      .filter(Boolean)
      .join(' • ') || 'Standard Charter';
  document.getElementById('sum-rules').textContent = rulesSummary;

  summaryModal.classList.remove('hidden');
}

document.getElementById('summary-modal-close').addEventListener('click', () => {
  summaryModal.classList.add('hidden');
});
document.getElementById('btn-close-summary').addEventListener('click', () => {
  summaryModal.classList.add('hidden');
});
document.getElementById('btn-continue-restoring').addEventListener('click', () => {
  summaryModal.classList.add('hidden');
  game.phase = 'RESTORATION PHASE';
  game.dispatchDroneToNearestDamagedSite();
});

// ============================================================================
// 7. REAL-TIME HUD & WORLD BADGE SYNCHRONIZATION
// ============================================================================
function updateWorldZoneBadges() {
  if (!worldMap.markersVisible) return;
  camera.updateMatrixWorld();

  for (const z of worldMap.zones.values()) {
    const pill = zoneBadgeEls.get(z.id);
    if (!pill) continue;

    const worldPos = new THREE.Vector3(
      z.x,
      oceanEnv.getTerrainHeight(z.x, z.z) + 3.4,
      z.z
    );
    const projected = worldPos.project(camera);

    if (projected.z > 1 || projected.z < -1) {
      pill.style.display = 'none';
      continue;
    }

    const sx = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-projected.y * 0.5 + 0.5) * window.innerHeight;

    // Keep badges clear of screen edges and side HUD panels
    if (sx < 80 || sx > window.innerWidth - 80 || sy < 75 || sy > window.innerHeight - 55) {
      pill.style.display = 'none';
      continue;
    }

    pill.style.display = 'flex';
    pill.style.left = `${sx}px`;
    pill.style.top = `${sy}px`;

    const meta = STATUS_META[z.status] || STATUS_META.ACCESSIBLE;
    const dot = pill.querySelector('.zw-dot');
    const txt = pill.querySelector('.zw-text');
    if (dot) dot.style.background = meta.color;
    if (txt) {
      txt.textContent =
        z.status === 'LOCKED'
          ? `🔒 ${z.name}`
          : z.status === 'PROTECTED'
          ? `🛡️ ${z.name}`
          : z.name;
    }
  }
}

function refreshHUD() {
  document.getElementById('hud-phase-label').textContent = game.phase;
  document.getElementById('hud-treasury').textContent = formatCompactCash(game.treasury);

  const profitMini = document.getElementById('hud-profit-mini');
  if (profitMini) {
    profitMini.textContent = `${game.netProfit >= 0 ? '+' : ''}${formatCompactCash(game.netProfit)}`;
    profitMini.style.color = game.netProfit >= 0 ? '#55d99a' : '#ff9b45';
  }

  let remReserves = 0;
  for (const d of ecosystem.deposits) {
    remReserves += d.remainingTons;
  }
  document.getElementById('hud-reserves').textContent = `${Math.round(remReserves)} t`;
  document.getElementById('hud-round').textContent = `${game.round} / ${game.maxRounds}`;

  // Ocean Health Progress Bar
  const health = oceanEnv.getGlobalOceanHealth();
  const healthRounded = Math.round(health);
  document.getElementById('hud-health-pct').textContent = `${healthRounded}%`;
  const healthBar = document.getElementById('hud-health-bar');
  healthBar.style.width = `${healthRounded}%`;

  const warnBanner = document.getElementById('env-warning-banner');
  const warnText = document.getElementById('env-warning-text');

  if (health >= 72) {
    healthBar.style.background = 'linear-gradient(90deg, #39d9c4, #55d99a)';
    warnBanner.classList.add('hidden');
  } else if (health >= 42) {
    healthBar.style.background = 'linear-gradient(90deg, #ffc83d, #ff9b45)';
    warnBanner.classList.remove('hidden');
    warnText.textContent =
      'Warning: Sediment plumes are reducing water clarity around mining zones. Click RESTORE to clean damaged areas.';
  } else {
    healthBar.style.background = 'linear-gradient(90deg, #ff9b45, #f16f75)';
    warnBanner.classList.remove('hidden');
    warnText.textContent =
      'Critical Ocean Health! Severe seabed scarring is driving marine life away. Click RESTORE immediately!';
  }

  // Left Mission Checklist
  const minedTons = Math.round(game.totalTonsMined);
  const mineTarget = game.missions.mineTargetTons;
  const row1 = document.getElementById('mission-row-1');
  const badge1 = document.getElementById('mission-badge-1');
  const sub1 = document.getElementById('mission-sub-1');
  if (minedTons >= mineTarget) {
    row1.classList.add('completed');
    badge1.textContent = '✓';
    sub1.textContent = `${minedTons} t mined (Complete!)`;
  } else {
    row1.classList.remove('completed');
    badge1.textContent = '1';
    sub1.textContent = `${minedTons} / ${mineTarget} t extracted`;
  }

  const sub2 = document.getElementById('mission-sub-2');
  const badge2 = document.getElementById('mission-badge-2');
  const row2 = document.getElementById('mission-row-2');
  if (healthRounded >= 75) {
    sub2.textContent = `Healthy (${healthRounded}%)`;
    sub2.style.color = '#55d99a';
    row2.classList.add('completed');
    badge2.textContent = '✓';
  } else if (healthRounded >= 42) {
    sub2.textContent = `Warning (${healthRounded}%)`;
    sub2.style.color = '#ffc83d';
    row2.classList.remove('completed');
    badge2.textContent = '2';
  } else {
    sub2.textContent = `Critical (${healthRounded}%)`;
    sub2.style.color = '#f16f75';
    row2.classList.remove('completed');
    badge2.textContent = '!';
  }

  const totalDamaged = ecosystem.damagedSites.length;
  const restoredCount = ecosystem.damagedSites.filter((s) => s.restored).length;
  const restoreTarget = Math.max(game.missions.restoreTargetZones, totalDamaged);
  const row3 = document.getElementById('mission-row-3');
  const badge3 = document.getElementById('mission-badge-3');
  const sub3 = document.getElementById('mission-sub-3');

  if (restoredCount >= game.missions.restoreTargetZones) {
    row3.classList.add('completed');
    badge3.textContent = '✓';
    sub3.textContent = `${restoredCount} / ${restoreTarget} zones restored`;
  } else {
    row3.classList.remove('completed');
    badge3.textContent = '3';
    sub3.textContent = `${restoredCount} / ${restoreTarget} zones restored`;
  }

  // Update Current Region Strip based on Selected Machine's position
  const sel = game.getSelectedMachine();
  if (sel) {
    const curZone =
      worldMap.getZoneAtPoint(sel.root.position.x, sel.root.position.z) ||
      worldMap.getNearestZone(sel.root.position.x, sel.root.position.z);
    if (curZone) {
      const meta = STATUS_META[curZone.status] || STATUS_META.ACCESSIBLE;
      document.getElementById('hud-cur-zone-name').textContent = curZone.name;
      const czDot = document.getElementById('hud-cur-zone-dot');
      czDot.style.background = meta.color;
      czDot.style.boxShadow = `0 0 8px ${meta.color}`;
    }
  }

  // Expandable drawer stats
  const activeScars = totalDamaged - restoredCount;
  document.getElementById('hud-damaged-count').textContent = `${activeScars}`;
  document.getElementById('obj-mined-tons').textContent = `${Math.round(game.totalTonsSold)} t`;
  document.getElementById('obj-biodiversity').textContent = `${Math.max(15, Math.round(health * 0.99))}%`;
  document.getElementById('hud-market').textContent = `${(game.marketIndex * game.priceMultiplier).toFixed(2)}x`;

  for (let i = 0; i < oceanEnv.sectors.length; i++) {
    const sh = oceanEnv.sectors[i].health;
    const cell = sectorCellEls[i];
    if (sh >= 75) {
      cell.style.background = 'rgba(85, 217, 154, 0.52)';
    } else if (sh >= 40) {
      cell.style.background = 'rgba(255, 200, 61, 0.78)';
    } else {
      cell.style.background = 'rgba(241, 111, 117, 0.88)';
    }
  }

  // Right Selected-Machine Panel
  if (sel) {
    document.getElementById('sel-machine-name').textContent = sel.name;
    const dotEl = document.getElementById('sel-status-dot');
    const statusTextEl = document.getElementById('sel-status-text');

    if (sel.id === 'crawler' || sel.id === 'submarine') {
      const isFull = sel.capacity >= sel.maxCapacity;
      if (isFull) {
        dotEl.className = 'status-dot dot-full';
        statusTextEl.textContent = 'Hopper Full — Sell Ore!';
      } else if (sel.state === 'MINING') {
        dotEl.className = 'status-dot dot-mining';
        statusTextEl.textContent = 'Mining nodules...';
      } else if (sel.state === 'MOVING') {
        dotEl.className = 'status-dot dot-ready';
        statusTextEl.textContent = 'Moving to target...';
      } else {
        dotEl.className = 'status-dot dot-ready';
        statusTextEl.textContent = 'Ready to mine';
      }
      document.getElementById('sel-capacity-text').textContent = `${Math.round(sel.capacity)} / ${sel.maxCapacity} t`;
      document.getElementById('sel-capacity-fill').style.width = `${(sel.capacity / sel.maxCapacity) * 100}%`;
    } else {
      dotEl.className = 'status-dot dot-ready';
      statusTextEl.textContent =
        sel.state === 'RESTORING'
          ? 'Restoring coral zone...'
          : sel.state === 'MOVING'
          ? 'Flying to scar site...'
          : 'Ready to restore';
      document.getElementById('sel-capacity-text').textContent = 'Bio-ROV';
      document.getElementById('sel-capacity-fill').style.width = '100%';
    }
  }

  const crawlerCargo = Math.round(fleet.crawler.capacity);
  const sellLabelEl = document.getElementById('btn-sell-label');
  if (crawlerCargo > 0) {
    const estPayout = Math.round(
      fleet.crawler.cargoValue * game.priceMultiplier * game.marketIndex
    );
    sellLabelEl.textContent = `SELL ORE (+${formatCompactCash(estPayout)})`;
  } else {
    sellLabelEl.textContent = 'SELL ORE';
  }

  document.getElementById('upg-cutter-lvl').textContent = `Lv.${game.upgrades.cutterLevel}`;
  document.getElementById('upg-cutter-cost').textContent =
    game.upgrades.cutterLevel >= 4 ? 'MAX' : `$${75 * game.upgrades.cutterLevel}K`;

  document.getElementById('upg-hopper-lvl').textContent = `Lv.${game.upgrades.hopperLevel}`;
  document.getElementById('upg-hopper-cost').textContent =
    game.upgrades.hopperLevel >= 4 ? 'MAX' : `$${65 * game.upgrades.hopperLevel}K`;

  document.getElementById('upg-biolaser-lvl').textContent = `Lv.${game.upgrades.bioLaserLevel}`;
  document.getElementById('upg-biolaser-cost').textContent =
    game.upgrades.bioLaserLevel >= 4 ? 'MAX' : `$${70 * game.upgrades.bioLaserLevel}K`;

  // If World Map Modal is currently open, update telemetry in-place without destroying node DOM
  if (!worldMapModal.classList.contains('hidden')) {
    updateWorldMapLiveTelemetry();
    renderZoneInspector(worldMap.selectedZoneId);
  }
}

// ============================================================================
// 8. MAIN ANIMATION LOOP & INITIALIZATION
// ============================================================================
const clock = new THREE.Clock();
let hudTimer = 0;

function handleViewportResize() {
  const w = Math.max(1, container.clientWidth || window.innerWidth || 1280);
  const h = Math.max(1, container.clientHeight || window.innerHeight || 720);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

window.addEventListener('resize', handleViewportResize);

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.getElapsedTime();

  const forward =
    (keyState['KeyW'] || keyState['ArrowUp'] ? 1 : 0) -
    (keyState['KeyS'] || keyState['ArrowDown'] ? 1 : 0);
  const turn =
    (keyState['KeyD'] || keyState['ArrowRight'] ? 1 : 0) -
    (keyState['KeyA'] || keyState['ArrowLeft'] ? 1 : 0);

  game.update(dt, elapsed, { forward, turn });
  oceanEnv.update(dt, elapsed);
  ecosystem.update(dt, elapsed);
  worldMap.update(dt, elapsed);
  fleet.update(dt, elapsed);
  drawMachinePreview(elapsed);

  for (let i = clickRipples.length - 1; i >= 0; i--) {
    const r = clickRipples[i];
    r.age += dt;
    if (r.age > 0.75) {
      scene.remove(r.mesh);
      clickRipples.splice(i, 1);
    } else {
      const s = 1 + r.age * 4.5;
      r.mesh.scale.set(s, s, 1);
      r.mat.opacity = 0.9 * (1 - r.age / 0.75);
    }
  }

  if (camRig.followMachine || Math.abs(forward) > 0 || Math.abs(turn) > 0) {
    const sel = game.getSelectedMachine();
    if (sel) {
      camRig.desiredTarget.set(
        sel.root.position.x,
        sel.root.position.y * 0.35,
        sel.root.position.z
      );
    }
  }

  camRig.target.lerp(camRig.desiredTarget, Math.min(1, dt * 6.5));
  camRig.yaw = THREE.MathUtils.lerp(camRig.yaw, camRig.desiredYaw, Math.min(1, dt * 8));
  camRig.pitch = THREE.MathUtils.lerp(camRig.pitch, camRig.desiredPitch, Math.min(1, dt * 8));
  camRig.distance = THREE.MathUtils.lerp(
    camRig.distance,
    camRig.desiredDistance,
    Math.min(1, dt * 8)
  );

  const horizDist = Math.cos(camRig.pitch) * camRig.distance;
  const vertDist = Math.sin(camRig.pitch) * camRig.distance;

  camera.position.set(
    camRig.target.x + Math.sin(camRig.yaw) * horizDist,
    camRig.target.y + vertDist,
    camRig.target.z + Math.cos(camRig.yaw) * horizDist
  );
  camera.lookAt(camRig.target);

  renderer.render(scene, camera);
  updateWorldZoneBadges();

  hudTimer += dt;
  if (hudTimer >= 0.15) {
    hudTimer = 0;
    refreshHUD();
  }
}

// Boot sequence after all DOM refs and constants are initialized
game.selectMachine('crawler');
refreshHUD();
drawMachinePreview(0);
animate();
