// Automated verification suite for ABYSS INC.
// Tests: Repeatable diving (3+ cycles), State preservation, Tutorial -> Ongoing Operations,
// Single-player enforcement (no multiplayer UI), Dynamic rules, Upgrades & Water-Flow Puzzle.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GameController } from '../src/game/GameState.js';
import { GAME_STAGES, PLAYER_LOCATIONS } from '../src/game/GameConfig.js';
import { RestorationMiniGames } from '../src/ui/RestorationMiniGames.js';

const mockSound = {
  resume() {},
  playSonarPing() {},
  playNoduleCollect() {},
  playCashDeposit() {},
  playRuleChangeAlert() {},
  playRestorationChime() {},
  updateMachinerySound() {}
};

const mockOceanEnv = {
  sectors: [{ x: 0, z: 2, health: 96 }],
  riserHubPosition: { x: -11, y: 0, z: -9 },
  getTerrainHeight: () => 0,
  getGlobalOceanHealth: () => mockOceanEnv.sectors[0].health,
  damageSectorAt: (x, z, hLoss) => {
    mockOceanEnv.sectors[0].health = Math.max(0, mockOceanEnv.sectors[0].health - hLoss);
  },
  restoreSectorAt: (x, z, hGain) => {
    mockOceanEnv.sectors[0].health = Math.min(100, mockOceanEnv.sectors[0].health + hGain);
  }
};

function createMockEcosystem() {
  return {
    deposits: [
      { id: 'dep-1', name: 'Bed 1', x: 0, z: 0, maxTons: 240, remainingTons: 240, depleted: false, noduleMeshes: [], ringMesh: { material: { color: { setHex() {} } } } }
    ],
    damagedSites: [],
    updateCoralRecoveryVisuals() {},
    damageNearbyCorals() {},
    createOrIntensifyDamagedSite() {}
  };
}

const mockFleet = {
  crawler: { root: { position: { x: 0, y: 0, z: 0, set() {}, clone: () => ({ add: () => ({}) }) }, rotation: { y: 0 } }, speed: 6, turnSpeed: 2, capacity: 0, maxCapacity: 35, state: 'IDLE', getIntakeWorldPosition: () => ({}) },
  surfaceVessel: { group: { position: { x: -11, y: 26, z: -9 }, rotation: { y: 0 } } },
  spawnRiserOreTransfer() {}
};

// ============================================================================
// TEST 1: REPEATABLE SURFACE <-> UNDERWATER NAVIGATION (3+ CYCLES) & STATE PRESERVATION
// ============================================================================
const eco1 = createMockEcosystem();
const g1 = new GameController(mockOceanEnv, eco1, mockFleet, mockSound, {});
g1.setCompanyInfo('Maya', 'Pacific Deep');
assert.equal(g1.playerName, 'Maya');
assert.equal(g1.companyName, 'Pacific Deep');

// Confirm settings triggers Dive #1
const startRes = g1.confirmBusinessSettings(35, 2800, 60);
assert.equal(startRes.ok, true);
assert.equal(g1.location, PLAYER_LOCATIONS.DIVING);
assert.equal(g1.diveCount, 1);
g1.completeDiveTransition();
assert.equal(g1.location, PLAYER_LOCATIONS.UNDERWATER);

// Perform 3 full Dive -> Mine -> Return to Surface cycles
for (let cycle = 1; cycle <= 3; cycle++) {
  if (g1.location === PLAYER_LOCATIONS.SURFACE) {
    assert.equal(g1.canDiveToOceanFloor(), true);
    const dRes = g1.diveToOceanFloor();
    assert.equal(dRes.ok, true);
    assert.equal(g1.location, PLAYER_LOCATIONS.DIVING);
    g1.completeDiveTransition();
    assert.equal(g1.location, PLAYER_LOCATIONS.UNDERWATER);
  }

  // Simulate mining 10t on seabed
  eco1.deposits[0].remainingTons -= 10;
  g1.oreInHold += 10;
  g1.totalTonsMined += 10;

  // Return to surface
  assert.equal(g1.canReturnToSurface(), true);
  const sRes = g1.returnToSurface();
  assert.equal(sRes.ok, true);
  assert.equal(g1.location, PLAYER_LOCATIONS.SURFACING);
  g1.completeAscentTransition();
  assert.equal(g1.location, PLAYER_LOCATIONS.SURFACE);

  // Verify ore was offloaded to boat stockpile & state preserved
  assert.equal(g1.oreInHold, 0);
  assert.equal(g1.oreStockpile, cycle * 10);
  assert.equal(g1.getTotalRemainingSeabedOre(), 240 - cycle * 10);
  assert.equal(g1.playerName, 'Maya');
  assert.equal(g1.companyName, 'Pacific Deep');
}
assert.equal(g1.diveCount, 3);

// ============================================================================
// TEST 2: TUTORIAL COMPLETION -> CONTINUE OPERATIONS (NO FORCED RESET)
// ============================================================================
g1.stage = GAME_STAGES.RULE_CHANGE_1;
g1.enactRuleChange('extraction', 'continuous_extraction');
assert.equal(g1.rule1Enacted.id, 'continuous_extraction');

g1.surfaceCleaned = true;
g1.stage = GAME_STAGES.RULE_CHANGE_2;
g1.enactRuleChange('sales', 'eco_certified');
assert.equal(g1.rule2Enacted.id, 'eco_certified');

// Complete budget & reef restoration
const bRes = g1.finalizeBudget('standard');
assert.equal(bRes.ok, true);
g1.completeDiveTransition();
g1.completePuzzleAndCoralPlacement();

// Must enter TUTORIAL_COMPLETE (not reset!)
assert.equal(g1.stage, GAME_STAGES.TUTORIAL_COMPLETE);
assert.equal(g1.tutorialCompleted, false);

// Select CONTINUE OPERATIONS
g1.continueOperations();
assert.equal(g1.tutorialCompleted, true);
assert.equal(g1.stage, GAME_STAGES.ONGOING_OPERATIONS);
assert.equal(g1.miningProhibited, false);
assert.equal(g1.rule1Enacted.id, 'continuous_extraction');
assert.equal(g1.rule2Enacted.id, 'eco_certified');

// Return to surface, sell certified ore (+35% bonus), buy upgrade, and dive again!
g1.returnToSurface();
g1.completeAscentTransition();
const sellRes = g1.sellStockpileOre();
assert.equal(sellRes.ok, true);
assert.equal(sellRes.ecoCertified, true);

const upRes = g1.purchaseUpgrade('hopper');
assert.equal(upRes.ok, true);
assert.equal(g1.businessSettings.machineCapacity, 50);

// Dive #4 in Ongoing Operations
const dive4 = g1.diveToOceanFloor();
assert.equal(dive4.ok, true);
g1.completeDiveTransition();
assert.equal(g1.location, PLAYER_LOCATIONS.UNDERWATER);
assert.equal(g1.stage, GAME_STAGES.ONGOING_OPERATIONS);

// ============================================================================
// TEST 3: MULTIPLAYER REMOVAL VERIFICATION
// ============================================================================
const htmlContent = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.equal(htmlContent.includes('mode-coop'), false, 'No mode-coop button should exist in index.html');
assert.equal(htmlContent.includes('Local Co-op'), false, 'No Local Co-op text should exist in index.html');
assert.equal(htmlContent.includes('Player 2'), false, 'No Player 2 text should exist in index.html');
assert.equal('coopMode' in g1, false, 'GameController must not have coopMode property');

// ============================================================================
// TEST 4: WATER-FLOW LOGIC PUZZLE BFS VERIFICATION
// ============================================================================
const mg = new RestorationMiniGames(g1, mockSound, null);
mg.initWaterFlowPuzzle();
assert.equal(mg.isWaterPathConnected().connected, false);
[0, 1, 4, 7, 8].forEach((idx) => {
  while (mg.grid[idx].rot !== 0) mg.rotateTile(idx);
});
assert.equal(mg.isWaterPathConnected().connected, true);

console.log('ALL AUTOMATED NAVIGATION, TUTORIAL-CONTINUE, SINGLE-PLAYER & PUZZLE TESTS PASSED!');
