// Automated logic verification for ABYSS INC. core game state, rules, bugs & puzzle
import assert from 'node:assert/strict';
import { GameController } from '../src/game/GameState.js';
import { GAME_STAGES } from '../src/game/GameConfig.js';
import { RestorationMiniGames } from '../src/ui/RestorationMiniGames.js';

// Mock minimal 3D dependencies for headless Node verification
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

const mockEcosystem = {
  deposits: [
    { id: 'dep-1', name: 'Test Bed', x: 0, z: 0, maxTons: 140, remainingTons: 140, depleted: false, noduleMeshes: [], ringMesh: { material: { color: { setHex() {} } } } }
  ],
  damagedSites: [],
  updateCoralRecoveryVisuals() {},
  damageNearbyCorals() {},
  createOrIntensifyDamagedSite() {}
};

const mockFleet = {
  crawler: { root: { position: { x: 0, y: 0, z: 0, set() {}, clone: () => ({ add: () => ({}) }) }, rotation: { y: 0 } }, speed: 6, turnSpeed: 2, capacity: 0, maxCapacity: 35, state: 'IDLE', getIntakeWorldPosition: () => ({}) },
  surfaceVessel: { group: { position: { x: -11, y: 26, z: -9 }, rotation: { y: 0 } } },
  spawnRiserOreTransfer() {}
};

// Test 1: Business settings & finite ore
const g1 = new GameController(mockOceanEnv, mockEcosystem, mockFleet, mockSound, {});
g1.setCompanyInfo('Sam', 'OceanCo', true);
assert.equal(g1.stage, GAME_STAGES.BUSINESS_SETTINGS);
const resSettings = g1.confirmBusinessSettings(50, 3000, 70);
assert.equal(resSettings.ok, true);
assert.equal(g1.getTotalRemainingSeabedOre(), 140);

// Test 2: Rule Change 1 (Restoration-First Permit prohibits mining)
g1.stage = GAME_STAGES.RULE_CHANGE_1;
g1.enactRuleChange('extraction', 'restoration_first');
assert.equal(g1.miningProhibited, true);
assert.equal(g1.stage, GAME_STAGES.ASCENT_TO_SURFACE);

// Test 3: Rule Change 2 (Eco-Certified Market blocks sale until restored)
g1.oreStockpile = 30;
g1.surfaceCleaned = true;
g1.reefRestored = false;
g1.stage = GAME_STAGES.RULE_CHANGE_2;
g1.enactRuleChange('sales', 'eco_certified');
assert.equal(g1.requiresEcoCertification, true);
const blockedSale = g1.sellStockpileOre();
assert.equal(blockedSale.ok, false);

// Test 4: Atomic Budget Validation (Bug 1 fix - no deduction/unlock on insufficient credits)
g1.credits = 10000;
const badBudget = g1.finalizeBudget('generous');
assert.equal(badBudget.ok, false);
assert.equal(g1.credits, 10000);
assert.notEqual(g1.stage, GAME_STAGES.DIVE_RESTORATION);

// Test 5: Bankruptcy condition (Bug 2 fix)
g1.credits = -500;
g1.checkDefeatConditions();
assert.equal(g1.defeatTriggered, true);
assert.equal(g1.defeatReason, 'BANKRUPTCY');

// Test 6: Ending evaluation checks extraction target (Bug 3 fix)
const g2 = new GameController(mockOceanEnv, mockEcosystem, mockFleet, mockSound, {});
g2.confirmBusinessSettings(35, 2800, 60);
g2.totalTonsMined = 30; // Missed 60t target
g2.surfaceCleaned = true;
g2.reefRestored = true;
const endMissed = g2.evaluateCampaignEnding();
assert.equal(endMissed.targetMet, false);
assert.equal(endMissed.title, 'OCEAN PROTECTED, TARGET MISSED');

// Test 7: Water-Flow Logic Puzzle solvability
const mg = new RestorationMiniGames(g2, mockSound, null);
mg.initWaterFlowPuzzle();
assert.equal(mg.isWaterPathConnected().connected, false);
// Rotate solution path tiles to rot=0: indices 0, 1, 4, 7, 8
[0, 1, 4, 7, 8].forEach((idx) => {
  while (mg.grid[idx].rot !== 0) mg.rotateTile(idx);
});
assert.equal(mg.isWaterPathConnected().connected, true);

console.log('ALL 7 AUTOMATED VERIFICATION TESTS PASSED!');
