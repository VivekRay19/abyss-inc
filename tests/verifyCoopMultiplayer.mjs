import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, ROLE_LABELS, CoopMultiplayerManager } from '../src/multiplayer/CoopManager.js';

test('CoopMultiplayerManager initializes with valid roles and generates unique room codes', () => {
  const manager = new CoopMultiplayerManager();
  assert.equal(manager.isCoopMode, false);
  assert.equal(typeof manager.playerId, 'string');
  assert.ok(manager.playerId.startsWith('p_'));

  const code1 = manager.generateRoomCode();
  const code2 = manager.generateRoomCode();
  assert.ok(code1.startsWith('ABYSS-'));
  assert.equal(code1.length, 10);
  assert.notEqual(code1, code2);

  assert.equal(ROLE_LABELS[ROLES.OPERATIONS_DIRECTOR], 'Operations Director');
  assert.equal(ROLE_LABELS[ROLES.MARINE_SCIENTIST], 'Marine Scientist');
});

test('CoopMultiplayerManager respects 2-player capacity checks', () => {
  const manager = new CoopMultiplayerManager();
  // Simulate presence state
  let presenceCount = 1;
  const mockChannel = {
    presenceState: () => {
      const state = {};
      for (let i = 0; i < presenceCount; i++) {
        state[`user_${i}`] = [{ id: `user_${i}` }];
      }
      return state;
    }
  };
  manager.channel = mockChannel;

  assert.equal(manager.getPeerCountFromPresence(), 1);
  presenceCount = 2;
  assert.equal(manager.getPeerCountFromPresence(), 2);
  presenceCount = 3;
  assert.equal(manager.getPeerCountFromPresence(), 3);
});
