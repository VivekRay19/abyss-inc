// ============================================================================
// ABYSS INC. — SUPABASE COOPERATIVE MULTIPLAYER CLIENT & STATE SYNCHRONIZER
// ============================================================================
import { createClient } from '@supabase/supabase-js';

const envUrl = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : undefined;
const envKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY : undefined;

const SUPABASE_URL = envUrl || 'https://jfmdfhtgzqgtnlnqwwnr.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = envKey || 'sb_publishable_rTWL68lv50-FX_QikUJS4w_EgliZ_3j';

export const ROLES = {
  OPERATIONS_DIRECTOR: 'OPERATIONS_DIRECTOR',
  MARINE_SCIENTIST: 'MARINE_SCIENTIST'
};

export const ROLE_LABELS = {
  [ROLES.OPERATIONS_DIRECTOR]: 'Operations Director',
  [ROLES.MARINE_SCIENTIST]: 'Marine Scientist'
};

export class CoopMultiplayerManager {
  constructor() {
    this.client = null;
    this.channel = null;
    this.isCoopMode = false;
    this.roomCode = null;
    this.expeditionId = null;
    this.playerId = this.getOrCreatePlayerId();
    this.playerName = 'Alex';
    this.myRole = null;
    this.isHost = false;
    this.hasDbTables = null; // detected at runtime

    this.otherPlayer = null; // { id, name, role, ready, online }
    this.onStateChangeCallbacks = [];
    this.onActionCallbacks = [];
    this.onPresenceCallbacks = [];
    this.onStatusMessageCallbacks = [];

    this.pendingRuleRecommendation = null;
    this.lastSentSyncTime = 0;
    this.cachedSharedState = null;
    this.heartbeatTimer = null;

    this.initClient();
  }

  getOrCreatePlayerId() {
    let id = typeof localStorage !== 'undefined' ? localStorage.getItem('abyss_player_id') : null;
    if (!id) {
      id = 'p_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('abyss_player_id', id);
      }
    }
    return id;
  }

  initClient() {
    try {
      this.client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        realtime: {
          params: {
            eventsPerSecond: 20
          }
        }
      });
    } catch (err) {
      console.warn('[CoopMultiplayer] Supabase client init error:', err);
    }
  }

  generateRoomCode() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'ABYSS-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  onPresenceUpdate(cb) {
    this.onPresenceCallbacks.push(cb);
  }

  onRemoteAction(cb) {
    this.onActionCallbacks.push(cb);
  }

  onStatusMessage(cb) {
    this.onStatusMessageCallbacks.push(cb);
  }

  emitPresence(data) {
    this.onPresenceCallbacks.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error(e);
      }
    });
  }

  emitRemoteAction(action, payload) {
    this.onActionCallbacks.forEach((cb) => {
      try {
        cb(action, payload);
      } catch (e) {
        console.error(e);
      }
    });
  }

  emitStatus(msg, type = 'info') {
    this.onStatusMessageCallbacks.forEach((cb) => {
      try {
        cb(msg, type);
      } catch (e) {
        console.error(e);
      }
    });
  }

  // Check if public.expeditions table is installed and accessible
  async checkDatabaseTables() {
    if (this.hasDbTables !== null) return this.hasDbTables;
    try {
      const { error } = await this.client
        .from('expeditions')
        .select('id')
        .limit(1);
      this.hasDbTables = !error || error.code !== 'PGRST205';
    } catch (e) {
      this.hasDbTables = false;
    }
    return this.hasDbTables;
  }

  async createExpedition({ playerName, companyName, startingParameters }) {
    this.isCoopMode = true;
    this.isHost = true;
    this.myRole = ROLES.OPERATIONS_DIRECTOR;
    this.playerName = playerName || 'Alex';
    this.roomCode = this.generateRoomCode();

    const hasTables = await this.checkDatabaseTables();
    if (hasTables) {
      try {
        const { data, error } = await this.client
          .from('expeditions')
          .insert({
            room_code: this.roomCode,
            host_player_id: this.playerId,
            company_name: companyName || 'DeepBlue Co.',
            starting_parameters: startingParameters || {},
            status: 'WAITING'
          })
          .select()
          .single();

        if (!error && data) {
          this.expeditionId = data.id;
          await this.client.from('expedition_players').insert({
            expedition_id: this.expeditionId,
            player_id: this.playerId,
            player_name: this.playerName,
            role: this.myRole,
            ready: true
          });
        }
      } catch (e) {
        console.warn('[CoopMultiplayer] DB insert fallback to realtime channel:', e);
      }
    }

    await this.subscribeToRoom(this.roomCode, true);
    return {
      success: true,
      roomCode: this.roomCode,
      role: this.myRole
    };
  }

  async joinExpedition({ roomCode, playerName }) {
    this.isCoopMode = true;
    this.isHost = false;
    this.roomCode = (roomCode || '').trim().toUpperCase();
    this.playerName = playerName || 'Dr. Morgan';

    const hasTables = await this.checkDatabaseTables();
    if (hasTables) {
      try {
        const { data, error } = await this.client.rpc('join_expedition', {
          p_room_code: this.roomCode,
          p_player_id: this.playerId,
          p_player_name: this.playerName
        });

        if (error) {
          return { success: false, error: error.message };
        }
        if (!data.success) {
          return { success: false, error: data.error };
        }

        this.expeditionId = data.expedition.id;
        this.myRole = data.role;
      } catch (e) {
        console.warn('[CoopMultiplayer] RPC join fallback to channel handshake:', e);
        this.myRole = ROLES.MARINE_SCIENTIST;
      }
    } else {
      this.myRole = ROLES.MARINE_SCIENTIST;
    }

    await this.subscribeToRoom(this.roomCode, false);
    return {
      success: true,
      roomCode: this.roomCode,
      role: this.myRole
    };
  }

  async subscribeToRoom(roomCode, isHost) {
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }

    const channelName = `abyss-room-${roomCode}`;
    this.channel = this.client.channel(channelName, {
      config: {
        broadcast: { ack: true, self: false },
        presence: { key: this.playerId }
      }
    });

    // 1. Listen for peer broadcasts (Events, State Sync, Pings)
    this.channel.on('broadcast', { event: 'game_action' }, ({ payload }) => {
      if (!payload || payload.senderId === this.playerId) return;
      this.handleIncomingAction(payload.action, payload.data);
    });

    this.channel.on('broadcast', { event: 'state_snapshot' }, ({ payload }) => {
      if (!payload || payload.senderId === this.playerId) return;
      this.emitRemoteAction('STATE_SNAPSHOT', payload.state);
    });

    this.channel.on('broadcast', { event: 'room_handshake' }, ({ payload }) => {
      if (!payload || payload.senderId === this.playerId) return;
      if (this.isHost && payload.type === 'JOIN_REQUEST') {
        // Enforce maximum 2 players
        const currentPeerCount = this.getPeerCountFromPresence();
        if (currentPeerCount > 2) {
          this.channel.send({
            type: 'broadcast',
            event: 'room_handshake',
            payload: {
              type: 'JOIN_REJECT',
              recipientId: payload.senderId,
              reason: 'Expedition room is already full (Max 2 players).'
            }
          });
          return;
        }

        this.channel.send({
          type: 'broadcast',
          event: 'room_handshake',
          payload: {
            type: 'JOIN_ACCEPT',
            recipientId: payload.senderId,
            hostId: this.playerId,
            hostName: this.playerName,
            role: ROLES.MARINE_SCIENTIST,
            startingParameters: this.cachedStartingParams || null
          }
        });
      }

      if (!this.isHost && payload.recipientId === this.playerId) {
        if (payload.type === 'JOIN_ACCEPT') {
          this.emitStatus(`Connected to host (${payload.hostName}). Role: Marine Scientist`, 'success');
          if (payload.startingParameters) {
            this.emitRemoteAction('SET_STARTING_PARAMS', payload.startingParameters);
          }
        } else if (payload.type === 'JOIN_REJECT') {
          this.emitStatus(`Join failed: ${payload.reason}`, 'error');
          this.leaveExpedition();
        }
      }
    });

    // 2. Presence tracking for 2-player join, roles, and disconnection
    this.channel.on('presence', { event: 'sync' }, () => {
      this.handlePresenceSync();
    });

    this.channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      newPresences.forEach((p) => {
        if (p.id !== this.playerId) {
          this.emitStatus(`${p.name} (${ROLE_LABELS[p.role] || 'Crewmate'}) joined the expedition!`, 'success');
        }
      });
    });

    this.channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      leftPresences.forEach((p) => {
        if (p.id !== this.playerId) {
          this.emitStatus(`${p.name} disconnected. Waiting for reconnection...`, 'warning');
        }
      });
    });

    return new Promise((resolve) => {
      this.channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.channel.track({
            id: this.playerId,
            name: this.playerName,
            role: this.myRole,
            isHost: this.isHost,
            ready: true,
            joinedAt: Date.now()
          });

          if (!this.isHost) {
            // Send join handshake request to host
            this.channel.send({
              type: 'broadcast',
              event: 'room_handshake',
              payload: {
                type: 'JOIN_REQUEST',
                senderId: this.playerId,
                playerName: this.playerName
              }
            });
          }

          resolve(true);
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          this.emitStatus('Connection timeout to Supabase Realtime channel.', 'error');
          resolve(false);
        }
      });
    });
  }

  getPeerCountFromPresence() {
    if (!this.channel) return 1;
    const state = this.channel.presenceState();
    return Object.keys(state).length;
  }

  handlePresenceSync() {
    if (!this.channel) return;
    const state = this.channel.presenceState();
    const presences = Object.values(state).flat();

    const me = presences.find((p) => p.id === this.playerId);
    const peer = presences.find((p) => p.id !== this.playerId);

    this.otherPlayer = peer ? { ...peer, online: true } : null;

    this.emitPresence({
      self: me || { id: this.playerId, name: this.playerName, role: this.myRole, ready: true },
      peer: this.otherPlayer,
      isRoomReady: !!(me && peer),
      totalPlayers: presences.length
    });
  }

  handleIncomingAction(action, data) {
    this.emitRemoteAction(action, data);
  }

  // Send an atomic gameplay action to the peer
  sendAction(action, data = {}) {
    if (!this.isCoopMode || !this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: 'game_action',
      payload: {
        senderId: this.playerId,
        action,
        data,
        timestamp: Date.now()
      }
    });

    // Optionally save critical milestones to DB if tables exist
    if (this.hasDbTables && this.expeditionId) {
      if (['MINE_ORE', 'CLEAN_OIL', 'RULE_ENACTED', 'RESTORE_REEF', 'STAGE_TRANSITION'].includes(action)) {
        this.client
          .from('expedition_events')
          .insert({
            expedition_id: this.expeditionId,
            sender_player_id: this.playerId,
            event_type: action,
            payload: data
          })
          .then(() => {})
          .catch(() => {});
      }
    }
  }

  // Periodic or event-driven full state snapshot synchronization
  broadcastStateSnapshot(stateSnapshot) {
    if (!this.isCoopMode || !this.channel) return;
    const now = Date.now();
    // Throttle high-frequency broadcasts
    if (now - this.lastSentSyncTime < 150) return;
    this.lastSentSyncTime = now;
    this.cachedSharedState = stateSnapshot;

    this.channel.send({
      type: 'broadcast',
      event: 'state_snapshot',
      payload: {
        senderId: this.playerId,
        state: stateSnapshot,
        timestamp: now
      }
    });

    if (this.hasDbTables && this.expeditionId && this.isHost) {
      this.client
        .from('expeditions')
        .update({
          game_state: stateSnapshot,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.expeditionId)
        .then(() => {})
        .catch(() => {});
    }
  }

  leaveExpedition() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.isCoopMode = false;
    this.roomCode = null;
    this.expeditionId = null;
    this.otherPlayer = null;
    this.myRole = null;
    this.isHost = false;
  }
}

export const coopManager = new CoopMultiplayerManager();
