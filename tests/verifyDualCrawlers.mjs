import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MiningFleetManager } from '../src/machines/MiningMachines.js';

test('MiningFleetManager creates independent second crawler for Co-op without duplicates', () => {
  const scene = new THREE.Scene();
  const mockOceanEnv = {
    getTerrainHeight: (x, z) => -1.2,
    riserHubPosition: new THREE.Vector3(0, 0, 0)
  };
  const mockEcosystem = {
    deposits: [],
    damagedSites: []
  };

  const fleet = new MiningFleetManager(scene, mockOceanEnv, mockEcosystem);

  // Single player starts with only 1 primary crawler
  assert.ok(fleet.crawler);
  assert.equal(fleet.crawler.id, 'crawler');
  assert.equal(fleet.crawler2, null);

  // In Co-op mode, ensure second crawler
  const c2 = fleet.ensureSecondCrawler();
  assert.ok(c2);
  assert.equal(c2.id, 'crawler2');
  assert.equal(fleet.crawler2, c2);

  // Verify calling ensureSecondCrawler again returns the same instance without duplicating meshes
  const c2Again = fleet.ensureSecondCrawler();
  assert.equal(c2Again, c2);

  // Verify independent starting coordinates and identification
  assert.notEqual(fleet.crawler.root.position.x, fleet.crawler2.root.position.x);
  assert.notEqual(fleet.crawler.root.position.z, fleet.crawler2.root.position.z);
  assert.equal(fleet.crawler.ownerRole, 'OPERATIONS_DIRECTOR');
  assert.equal(fleet.crawler2.ownerRole, 'MARINE_SCIENTIST');

  // Verify badges and selection rings
  assert.ok(fleet.crawler.playerBadgeMesh);
  assert.ok(fleet.crawler2.playerBadgeMesh);
  assert.ok(fleet.crawler.selectionRing);
  assert.ok(fleet.crawler2.selectionRing);
});
