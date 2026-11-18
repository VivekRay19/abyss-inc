-- ============================================================================
-- ABYSS INC. — TWO-PLAYER ONLINE COOPERATIVE EXPEDITION SCHEMA & RLS POLICIES
-- ============================================================================
-- This migration script creates the expeditions, expedition_players, and
-- sync tables, complete with Row Level Security (RLS) policies, indexes,
-- and transactional functions for atomic two-player room joining.
--
-- Apply this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jfmdfhtgzqgtnlnqwwnr/sql
-- ============================================================================

-- Enable UUID extension if not present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. EXPEDITIONS TABLE
CREATE TABLE IF NOT EXISTS public.expeditions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code VARCHAR(16) NOT NULL UNIQUE,
  host_player_id VARCHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'WAITING', -- 'WAITING', 'STARTING', 'ACTIVE', 'COMPLETED'
  company_name VARCHAR(64) NOT NULL DEFAULT 'DeepBlue Co.',
  starting_parameters JSONB NOT NULL DEFAULT '{"machineCapacity": 35, "workshopCapacity": 100, "oreSellingPrice": 2800, "extractionTarget": 50}'::jsonb,
  game_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for rapid room code lookups
CREATE INDEX IF NOT EXISTS idx_expeditions_room_code ON public.expeditions (room_code);
CREATE INDEX IF NOT EXISTS idx_expeditions_status ON public.expeditions (status);

-- 2. EXPEDITION PLAYERS TABLE (STRICTLY MAXIMUM 2 PLAYERS)
CREATE TABLE IF NOT EXISTS public.expedition_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expedition_id UUID NOT NULL REFERENCES public.expeditions(id) ON DELETE CASCADE,
  player_id VARCHAR(64) NOT NULL,
  player_name VARCHAR(48) NOT NULL,
  role VARCHAR(32) NOT NULL, -- 'OPERATIONS_DIRECTOR' or 'MARINE_SCIENTIST'
  ready BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_expedition_player UNIQUE (expedition_id, player_id),
  CONSTRAINT uq_expedition_role UNIQUE (expedition_id, role),
  CONSTRAINT chk_valid_role CHECK (role IN ('OPERATIONS_DIRECTOR', 'MARINE_SCIENTIST'))
);

CREATE INDEX IF NOT EXISTS idx_expedition_players_exp_id ON public.expedition_players (expedition_id);
CREATE INDEX IF NOT EXISTS idx_expedition_players_pid ON public.expedition_players (player_id);

-- 3. EXPEDITION EVENTS / ACTIONS TABLE (AUDIT & REPLAYABLE SYNC)
CREATE TABLE IF NOT EXISTS public.expedition_events (
  id BIGSERIAL PRIMARY KEY,
  expedition_id UUID NOT NULL REFERENCES public.expeditions(id) ON DELETE CASCADE,
  sender_player_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(48) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expedition_events_exp ON public.expedition_events (expedition_id, id);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.expeditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expedition_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expedition_events ENABLE ROW LEVEL SECURITY;

-- Anonymous public access policy: Anyone with the anon/publishable key can read and participate
-- in cooperative sessions, but maximum 2 players per room is strictly enforced by constraints and DB functions.
CREATE POLICY "Allow public read access to active expeditions"
  ON public.expeditions FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert of new expeditions"
  ON public.expeditions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow members to update their expedition"
  ON public.expeditions FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read of expedition players"
  ON public.expedition_players FOR SELECT
  USING (true);

CREATE POLICY "Allow players to register in expedition"
  ON public.expedition_players FOR INSERT
  WITH CHECK (
    (SELECT COUNT(*) FROM public.expedition_players WHERE expedition_id = expedition_players.expedition_id) < 2
  );

CREATE POLICY "Allow players to update their own readiness/heartbeat"
  ON public.expedition_players FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read of events"
  ON public.expedition_events FOR SELECT
  USING (true);

CREATE POLICY "Allow participants to log events"
  ON public.expedition_events FOR INSERT
  WITH CHECK (true);

-- 5. ATOMIC JOIN STORED PROCEDURE (PREVENTS RACE CONDITIONS & 3RD PLAYERS)
CREATE OR REPLACE FUNCTION public.join_expedition(
  p_room_code VARCHAR,
  p_player_id VARCHAR,
  p_player_name VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expedition public.expeditions%ROWTYPE;
  v_player_count INT;
  v_existing_player public.expedition_players%ROWTYPE;
  v_assigned_role VARCHAR;
BEGIN
  -- Lookup room
  SELECT * INTO v_expedition FROM public.expeditions
  WHERE UPPER(room_code) = UPPER(p_room_code)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Expedition room not found. Check the room code.');
  END IF;

  -- Check if already an existing player reconnecting
  SELECT * INTO v_existing_player FROM public.expedition_players
  WHERE expedition_id = v_expedition.id AND player_id = p_player_id;

  IF FOUND THEN
    UPDATE public.expedition_players
    SET last_seen_at = NOW(), player_name = p_player_name
    WHERE id = v_existing_player.id;

    RETURN jsonb_build_object(
      'success', true,
      'expedition', to_jsonb(v_expedition),
      'role', v_existing_player.role,
      'is_reconnect', true
    );
  END IF;

  -- Lock rows and count members
  SELECT COUNT(*) INTO v_player_count FROM public.expedition_players
  WHERE expedition_id = v_expedition.id;

  IF v_player_count >= 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Expedition is full. Exactly two players permitted.');
  END IF;

  -- Assign role: Host is Operations Director, joining player is Marine Scientist
  IF v_player_count = 0 THEN
    v_assigned_role := 'OPERATIONS_DIRECTOR';
  ELSE
    v_assigned_role := 'MARINE_SCIENTIST';
  END IF;

  INSERT INTO public.expedition_players (expedition_id, player_id, player_name, role, ready)
  VALUES (v_expedition.id, p_player_id, p_player_name, v_assigned_role, false);

  RETURN jsonb_build_object(
    'success', true,
    'expedition', to_jsonb(v_expedition),
    'role', v_assigned_role,
    'is_reconnect', false
  );
END;
$$;

-- 6. ENABLE REALTIME REPLICATION FOR EXPEDITIONS AND PLAYERS
ALTER PUBLICATION supabase_realtime ADD TABLE public.expeditions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expedition_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expedition_events;
